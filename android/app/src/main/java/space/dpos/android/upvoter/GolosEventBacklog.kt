package space.dpos.android.upvoter

import org.json.JSONArray
import org.json.JSONObject
import space.dpos.android.notifications.GolosHistoryClient
import space.dpos.android.notifications.HistoryEvent
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

interface GolosEventBacklogStore {
    fun readVoteBacklog(account: String): JSONObject
    fun saveVoteBacklog(account: String, state: JSONObject)
}

/** Durable inbox: a source cursor and its events are committed together, before planning.
 * Cursor namespaces include endpoint/API. A failed source cannot discard healthy results.
 * New installs also backfill older history one page per source/tick; no latest-page gap
 * is treated as proof that older eligible events do not exist.
 */
class GolosEventBacklog(
    private val history: GolosHistoryClient,
    private val store: GolosEventBacklogStore,
    private val canAct: () -> Boolean = { true },
    private val budgetMs: Long = 35_000
) {
    var warnings: List<String> = emptyList()
        private set

    fun collect(settings: AccountSettings): List<VoteEvent> {
        val state = store.readVoteBacklog(settings.account)
        val sources = state.optJSONObject("sources") ?: JSONObject().also { state.put("sources", it) }
        val curators = settings.curators.map { it.trim().removePrefix("@").lowercase() }.toSet()
        val favorites = settings.favorites.map { it.trim().removePrefix("@").lowercase() }.toSet()
        fun roles(name: String) = listOfNotNull("curator".takeIf { name in curators }, "favorite".takeIf { name in favorites }).joinToString(",")
        fun active(row: JSONObject) = when (row.optString("kind")) {
            "curator_vote" -> row.optString("voter") in curators
            "favorite_post" -> row.optString("author") in favorites
            else -> false
        }
        // Keep inactive source/role events durably, without charging active capacity. Existing
        // active deferred/unknown events have priority over restorations; overflow stays archived.
        val inbox = JSONArray()
        val inactive = JSONArray()
        val archived = state.optJSONArray("inactiveInbox") ?: JSONArray()
        val previous = state.optJSONArray("inbox") ?: JSONArray()
        val ids = mutableSetOf<String>()
        for (i in 0 until previous.length()) {
            val row = previous.getJSONObject(i)
            if (ids.add(row.getString("id"))) (if (active(row)) inbox else inactive).put(row)
        }
        for (i in 0 until archived.length()) {
            val row = archived.getJSONObject(i)
            if (ids.add(row.getString("id")))
                (if (active(row) && inbox.length() < 1000) inbox else inactive).put(row)
        }
        state.put("inbox", inbox).put("inactiveInbox", inactive)
        val allNames = (curators + favorites).toList()
        val pollOffset = state.optInt("pollOffset", 0).mod(allNames.size.coerceAtLeast(1))
        val names = allNames.drop(pollOffset) + allNames.take(pollOffset)
        val clients = history.recoverySources().distinctBy { it.historyScope }
        val retryScopes = state.optJSONObject("retryScopes") ?: JSONObject().also { state.put("retryScopes", it) }
        val firstScopes = mutableMapOf<String, String>()
        // Rotate queued sources too: four stalled reads must not monopolize every subsequent tick.
        state.put("pollOffset", (pollOffset + 4) % allNames.size.coerceAtLeast(1))
        if (canAct() && !Thread.currentThread().isInterrupted) store.saveVoteBacklog(settings.account, state)
        val errors = mutableListOf<String>()
        state.put("intakeTick", state.optLong("intakeTick", 0) + 1)
        val tick = state.getLong("intakeTick")
        data class Batch(val name: String, val scope: String, val cursor: Long, val rows: List<HistoryEvent>, val backfillFrom: Long, val warning: String? = null, val retainedBoundary: Long = -1)
        // One outstanding read per source, bounded concurrency. Workers never mutate storage.
        val pool = Executors.newFixedThreadPool(minOf(4, names.size.coerceAtLeast(1)))
        val deadline = System.nanoTime() + TimeUnit.MILLISECONDS.toNanos(budgetMs)
        fun ensureReadAllowed() {
            check(canAct() && !Thread.currentThread().isInterrupted && System.nanoTime() < deadline) { "intake cancelled or read budget exhausted" }
        }
        try {
            val futures = names.associateWith { name ->
                val saved = sources.optJSONObject(name)?.let { JSONObject(it.toString()) }
                val preferred = retryScopes.optString(name).ifBlank { saved?.optString("scope").orEmpty() }
                val first = clients.indexOfFirst { it.historyScope == preferred }.coerceAtLeast(0)
                val candidates = clients.drop(first) + clients.take(first)
                firstScopes[name] = candidates.firstOrNull()?.historyScope.orEmpty()
                pool.submit<Batch> {
                    if (!canAct() || Thread.currentThread().isInterrupted) error("cancelled")
                    var failure: Exception? = null
                    for (client in candidates) try {
                        ensureReadAllowed()
                        // Failover starts an independent full backfill, never reuses a foreign index.
                        // Changed roles (including legacy state without role evidence) re-read
                        // history: operations ignored as noise under an old role may now matter.
                        val local = saved?.takeIf { it.optString("scope") == client.historyScope && it.optString("roles") == roles(name) }
                        val cursor = local?.optLong("cursor", -1) ?: -1L
                        val latest = client.getAccountHistory(name, -1, 100)
                        val head = latest.maxOfOrNull { it.index } ?: return@submit Batch(name, client.historyScope, cursor, emptyList(), local?.optLong("backfillFrom", -1) ?: -1L)
                        val rows = if (cursor < 0 || head <= cursor + 100) latest else {
                            ensureReadAllowed()
                            client.getAccountHistory(name, cursor + 100, 100)
                        }
                        if (cursor >= 0 && head < cursor) error("history index regressed; pinned node not caught up")
                        val fresh = rows.filter { it.index > cursor }.sortedBy { it.index }
                        if (cursor >= 0 && head > cursor && (fresh.isEmpty() || fresh.first().index > cursor + 1))
                            error("history gap; cursor retained")
                        if (fresh.zipWithNext().any { (a, b) -> b.index != a.index + 1 })
                            error("non-contiguous history; cursor retained")
                        var backfillFrom = local?.optLong("backfillFrom", -1) ?: ((rows.minOfOrNull { it.index } ?: 0) - 1)
                        if (backfillFrom <= 0) backfillFrom = -1
                        var retainedBoundary = local?.optLong("retainedBoundary", -1) ?: -1L
                        if (backfillFrom < 0 && retainedBoundary > 0 && tick % 32L == 0L) backfillFrom = retainedBoundary
                        var older = emptyList<HistoryEvent>()
                        var warning: String? = null
                        if (cursor >= 0 && backfillFrom >= 0) {
                            try {
                                ensureReadAllowed()
                                val requestFrom = backfillFrom.coerceAtLeast(1)
                                val page = client.getAccountHistory(name, requestFrom, minOf(100L, requestFrom).toInt()).sortedBy { it.index }
                                if (page.isEmpty()) {
                                    // Successful validated empty page below retained history is not a gap/error.
                                    retainedBoundary = requestFrom
                                    backfillFrom = -1
                                } else {
                                    if (page.last().index != requestFrom || page.zipWithNext().any { (a, b) -> b.index != a.index + 1 })
                                        error("backfill unavailable or non-contiguous")
                                    older = page
                                    retainedBoundary = -1
                                    backfillFrom = (page.first().index - 1).takeIf { it > 0 } ?: -1
                                }
                            } catch (e: Exception) { warning = "$name: older backfill deferred: ${e.message}" }
                        }
                        return@submit Batch(name, client.historyScope, fresh.lastOrNull()?.index ?: cursor, fresh + older, backfillFrom, warning, retainedBoundary)
                    } catch (e: Exception) { failure = e }
                    throw IllegalStateException("$name: ${failure?.message ?: "pinned history node unavailable"}")
                }
            }
            for ((name, future) in futures) {
                try {
                    val remaining = (deadline - System.nanoTime()).coerceAtLeast(1)
                    val batch = if (future.isDone) future.get() else future.get(remaining, TimeUnit.NANOSECONDS)
                    if (!canAct() || Thread.currentThread().isInterrupted) break
                    batch.warning?.let { errors += it }
                    val events = batch.rows.mapNotNull { row ->
                        if (name in curators && row.type == "vote") {
                            // Incoming votes are not curator actions. Identify the actor before
                            // validating candidate fields; an unknown actor must still fail closed.
                            require(!row.data["voter"].isNullOrBlank()) { "incomplete vote operation; cursor retained" }
                            if (row.data["voter"] != name) return@mapNotNull null
                            require(listOf("author", "permlink").all { !row.data[it].isNullOrBlank() } &&
                                row.data["weight"]?.toIntOrNull()?.let { it in -10000..10000 } == true) { "incomplete vote operation; cursor retained" }
                        }
                        if (name in favorites && row.type == "comment")
                            require(!row.data["author"].isNullOrBlank() && !row.data["permlink"].isNullOrBlank()) { "incomplete comment operation; cursor retained" }
                        if (name in curators && row.type == "vote") AutoVoteEventMapper.historyVoteToCuratorEvent(row)?.takeIf { it.voter == name }
                        else if (name in favorites && row.type == "comment" && row.data["author"] == name && row.data["parent_author"].orEmpty() == "")
                            VoteEvent("favorite_post", author = name, permlink = row.data["permlink"].orEmpty(), sourceIndex = row.index)
                        else null
                    }.filter { it.permlink.isNotBlank() }
                    val existing = ((0 until inbox.length()).map { inbox.getJSONObject(it).getString("id") } +
                        (0 until inactive.length()).map { inactive.getJSONObject(it).getString("id") }).toSet()
                    val additions = events.distinctBy { eventId(batch.scope, name, it) }.filter { eventId(batch.scope, name, it) !in existing }
                    if (inbox.length() + additions.size > 1000) {
                        errors += "$name: inbox capacity reached; cursor retained"
                        continue
                    }
                    additions.forEach { event -> inbox.put(JSONObject().put("id", eventId(batch.scope, name, event))
                        .put("kind", event.kind).put("voter", event.voter).put("author", event.author)
                        .put("permlink", event.permlink).put("weight", event.weight).put("sourceIndex", event.sourceIndex)) }
                    sources.put(name, JSONObject().put("scope", batch.scope).put("cursor", batch.cursor).put("backfillFrom", batch.backfillFrom).put("retainedBoundary", batch.retainedBoundary).put("roles", roles(name)))
                    retryScopes.remove(name)
                    store.saveVoteBacklog(settings.account, state) // atomic inbox+source progress
                } catch (e: Exception) {
                    future.cancel(true)
                    errors += "$name: ${e.cause?.message ?: e.message ?: e.javaClass.simpleName}"
                    if (clients.isNotEmpty()) {
                        val first = clients.indexOfFirst { it.historyScope == firstScopes[name] }.coerceAtLeast(0)
                        retryScopes.put(name, clients[(first + 1) % clients.size].historyScope)
                    }
                }
            }
        } finally { pool.shutdownNow() }
        if (canAct() && !Thread.currentThread().isInterrupted) store.saveVoteBacklog(settings.account, state)
        warnings = errors
        val eligible = (0 until inbox.length()).map { i -> inbox.getJSONObject(i).let {
            VoteEvent(it.getString("kind"), it.optString("voter"), it.getString("author"), it.getString("permlink"), it.getInt("weight"), sourceIndex = it.getLong("sourceIndex"))
        } }.filter { (it.kind == "curator_vote" && it.voter in curators) || (it.kind == "favorite_post" && it.author in favorites) }
        if (eligible.isEmpty()) return emptyList()
        val start = state.optInt("processOffset", 0).mod(eligible.size)
        val batch = (eligible.drop(start) + eligible.take(start)).take(50)
        if (canAct() && !Thread.currentThread().isInterrupted) {
            state.put("processOffset", (start + batch.size) % eligible.size)
            store.saveVoteBacklog(settings.account, state)
        }
        return batch
    }

    /** Adjust the selected window stride to work actually reached; all rows remain durable. */
    fun planned(account: String, selected: Int, inspected: Int) {
        if (!canAct() || Thread.currentThread().isInterrupted || inspected >= selected) return
        val state = store.readVoteBacklog(account)
        val size = state.optJSONArray("inbox")?.length() ?: 0
        if (size == 0) return
        state.put("processOffset", (state.optInt("processOffset") - selected + inspected.coerceAtLeast(1)).mod(size))
        if (canAct() && !Thread.currentThread().isInterrupted) store.saveVoteBacklog(account, state)
    }

    fun acknowledge(account: String, report: AutoVoteRuntimeReport?, plan: VotePlan) {
        val state = store.readVoteBacklog(account) ?: return
        val completeTargets = mutableSetOf<Pair<String, String>>()
        val completeKinds = mutableSetOf<Triple<String, String, String>>()
        // Quarantine is durable in the intent archive, not in repeated intake candidates.
        // Removing redundant inbox work must never remove an unknown intent or create a receipt.
        (store as? VoteArchiveStore)?.let { ledger ->
            ledger.archiveActiveVote("golos", account)
            ledger.voteArchive("golos", account).forEach { archived ->
                val target = archived.intent.fingerprint.split('|')
                completeTargets += target[0] to target[1]
            }
        }
        val terminal = setOf("not_root_post", "favorite_edited", "post_paid_out", "payout_ended", "zero_weight", "already_voted", "recovery_old_generation")
        report?.results?.filter { it.operation.voter == account && it.operation.chainId == "golos" }?.forEach { result ->
            val op = result.operation
            val kind = plan.actions.firstOrNull { it.account == account && it.author == op.author && it.permlink == op.permlink && it.weight == op.weight }?.reason
            if (result.status in setOf("not_root_post", "post_paid_out", "payout_ended", "recovery_old_generation")) completeTargets += op.author to op.permlink
            else if ((result.ok && result.status in setOf("broadcast_confirmed", "already_voted")) || result.status == "favorite_edited") {
                if (kind in setOf("curator_vote", "favorite_post")) completeKinds += Triple(op.author, op.permlink, kind!!)
            }
        }
        (plan.skips + (report?.skipped ?: emptyList())).forEach { skip ->
            val reason = skip.substringBefore(':')
            val parts = skip.substringAfter(':', "").split('|')
            if (reason in terminal && parts.size >= 3 && parts[0] == account) {
                if (reason in setOf("not_root_post", "post_paid_out", "payout_ended", "recovery_old_generation")) completeTargets += parts[1] to parts[2]
                else if (parts.size >= 4 && parts[3] in setOf("curator_vote", "favorite_post")) completeKinds += Triple(parts[1], parts[2], parts[3])
            }
        }
        val old = state.optJSONArray("inbox") ?: JSONArray()
        val remaining = JSONArray()
        for (i in 0 until old.length()) {
            val row = old.getJSONObject(i)
            val target = row.getString("author") to row.getString("permlink")
            val typed = Triple(target.first, target.second, row.getString("kind"))
            if (target !in completeTargets && typed !in completeKinds) remaining.put(row)
        }
        state.put("inbox", remaining)
        store.saveVoteBacklog(account, state)
    }

    private fun eventId(scope: String, name: String, event: VoteEvent) = "$scope|$name|${event.sourceIndex}|${event.kind}"
}
