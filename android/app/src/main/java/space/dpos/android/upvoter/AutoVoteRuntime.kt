package space.dpos.android.upvoter

import space.dpos.android.storage.EncryptedKeyRef

interface PostingKeyProvider {
    fun keyRef(chainId: String, account: String): EncryptedKeyRef
    fun privateWif(chainId: String, account: String): String?
}

data class AutoVoteRuntimeReport(
    val attempted: Int,
    val broadcasted: Int,
    val skipped: List<String>,
    val results: List<VoteBroadcastResult>,
    val candidates: Int,
    val skipSummary: Map<String, Int>,
    val donateResults: List<GolosDonateResult> = emptyList()
)

class AutoVoteRuntime(
    private val voteRuntime: VoteRuntime,
    private val keyProvider: PostingKeyProvider,
    private val chainId: String = "golos",
    private val pauseAfterSuccessfulBroadcastMs: Long = 0L,
    private val canAct: () -> Boolean = { true },
    private val donateRuntime: GolosDonateRuntime? = null,
    private val planningBudgetMs: Long = 15_000L,
    private val planningProgress: (Int, Int) -> Unit = { _, _ -> }
) {
    /** Validate individually eligible events before the cumulative energy budget is charged. */
    fun plan(settings: List<AccountSettings>, events: List<VoteEvent>): VotePlan =
        PlanningReadBudget.within(planningBudgetMs) { planWindow(settings, events) }

    private fun planWindow(settings: List<AccountSettings>, events: List<VoteEvent>): VotePlan {
        val planner = AutoUpvoterPlanner()
        if (chainId.trim().lowercase() != "golos") return planner.plan(settings, events)
        val skips = mutableListOf<String>()
        val verdicts = mutableMapOf<Triple<String, String, Boolean>, String?>()
        val archives = mutableMapOf<String, Map<Pair<String, String>, ArchivedVote>>()
        var inspected = 0
        val eligible = events.asSequence().takeWhile { canAct() && PlanningReadBudget.remainingMs()!! > 0 }.filter { event ->
            inspected++
            if (inspected == 1 || inspected % 10 == 0) planningProgress(inspected, events.size)
            val individual = planner.plan(settings, listOf(event))
            if (individual.actions.isEmpty()) return@filter true
            val blocked = individual.actions.mapNotNull { action ->
                if (!canAct()) return@mapNotNull null
                archives.getOrPut(action.account) { voteRuntime.archivedTargets(chainId, action.account) }
                    .get(action.author to action.permlink)?.let { action to it }
            }
            if (blocked.isNotEmpty()) {
                skips += blocked.map { (action, archived) -> "${if (archived.confirmed) "already_voted" else "pending_confirmation"}:${action.account}|${action.author}|${action.permlink}|${event.kind}" }
                return@filter false
            }
            val eligibilityKey = Triple(event.author, event.permlink, event.kind == "favorite_post")
            if (!canAct()) {
                skips += individual.actions.map { "cancelled:${it.account}|${it.author}|${it.permlink}" }
                return@filter false
            }
            val verdict = if (verdicts.containsKey(eligibilityKey)) verdicts[eligibilityKey] else {
                voteRuntime.golosEligibilitySkip(event.author, event.permlink, event.kind == "favorite_post").also { verdicts[eligibilityKey] = it }
            }
            if (!canAct()) {
                skips += individual.actions.map { "cancelled:${it.account}|${it.author}|${it.permlink}" }
                false
            } else if (verdict != null) {
                skips += individual.actions.map { "$verdict:${it.account}|${it.author}|${it.permlink}|${event.kind}" }
                false
            } else {
                // An existing own curator vote must not spend the planner's energy budget.
                // Worker plans are account-scoped; retain the mixed-account case for runtime guards.
                if (event.kind == "curator_vote" && individual.actions.size == 1) {
                    val action = individual.actions.single()
                    val ownSkip = voteRuntime.golosCuratorOwnVoteSkip(action.account, action.author, action.permlink)
                    if (ownSkip != null) {
                        skips += "$ownSkip:${action.account}|${action.author}|${action.permlink}|${event.kind}"
                        false
                    } else true
                } else true
            }
        }
        val plan = planner.plan(settings, eligible.toList())
        planningProgress(inspected, events.size)
        return plan.copy(skips = skips + plan.skips + if (inspected < events.size) listOf("planning_deferred:${events.size - inspected}") else emptyList(), inspectedEvents = inspected)
    }

    fun preview(plan: VotePlan): AutoVoteRuntimeReport = run(plan, previewOnly = true)
    fun execute(plan: VotePlan): AutoVoteRuntimeReport = run(plan, previewOnly = false)

    private fun run(plan: VotePlan, previewOnly: Boolean): AutoVoteRuntimeReport {

        val skips = plan.skips.toMutableList()
        val results = mutableListOf<VoteBroadcastResult>()
        val donateResults = mutableListOf<GolosDonateResult>()
        val chain = chainId.trim().lowercase()
        var attempted = 0
        val awaitingConfirmation = mutableSetOf<String>()
        for ((index, action) in plan.actions.withIndex()) {
            if (!canAct()) {
                skips += "cancelled:${action.account}|${action.author}|${action.permlink}"
                break
            }
            if (action.account in awaitingConfirmation) {
                skips += "pending_confirmation:${action.account}|${action.author}|${action.permlink}"
                continue
            }
            val key = keyProvider.privateWif(chain, action.account)
            if (key.isNullOrBlank()) {
                attempted += 1
                skips += "missing-key:${action.account}|${action.author}|${action.permlink}"
                continue
            }
            attempted += 1
            val operation = VoteOperation(chain, action.account, action.author, action.permlink, action.weight)
            // Old/synthetic history/blog events do not prove a root post. Check before
            // signing or creating a fresh donate intent; pending donations reconcile in the runner.
            if (chain == "golos") {
                val rootSkip = voteRuntime.golosEligibilitySkip(action.author, action.permlink, action.reason == "favorite_post", action.weight)
                if (!canAct()) {
                    skips += "cancelled:${action.account}|${action.author}|${action.permlink}"
                    break
                }
                if (rootSkip != null) {
                    skips += "$rootSkip:${action.account}|${action.author}|${action.permlink}|${action.reason}"
                    continue
                }
            }
            if (!previewOnly && !canAct()) {
                skips += "cancelled:${action.account}|${action.author}|${action.permlink}"
                break
            }
            val result = if (previewOnly) voteRuntime.preview(operation, keyProvider.keyRef(chain, action.account), key) else voteRuntime.execute(operation, keyProvider.keyRef(chain, action.account), key,
                skipAnyExistingVote = chain == "golos" && action.reason == "curator_vote", requireGolosEligibility = chain == "golos", favoritePost = action.reason == "favorite_post")
            results += result
            if (!previewOnly && result.status == "broadcast_unknown" && !(chain == "golos" && voteRuntime.supportsVoteArchive)) awaitingConfirmation += action.account
            if (!previewOnly && chain == "golos" && action.donatePool != null && result.ok && result.status == "broadcast_confirmed") {
                val donation = try {
                    donateRuntime?.execute(operation, action.donatePool, keyProvider.keyRef(chain, action.account), key)
                        ?: GolosDonateResult("donate_unavailable")
                } catch (_: Exception) { GolosDonateResult("donate_error") }
                donateResults += donation
                if (!donation.confirmed) skips += "${donation.status}:${action.account}|${action.author}|${action.permlink}"
            }
            val sent = result.ok && (result.status == "broadcast_confirmed" || result.status == "broadcast_sent")
            if (sent && !previewOnly && pauseAfterSuccessfulBroadcastMs > 0 && index < plan.actions.lastIndex) {
                try {
                    Thread.sleep(pauseAfterSuccessfulBroadcastMs)
                } catch (_: InterruptedException) {
                    Thread.currentThread().interrupt()
                    break
                }
            }
            if (!result.ok) {
                skips += "${result.status}:${action.account}|${action.author}|${action.permlink}"
                if (result.status == "authority_broadcast_mismatch" || result.status == "authority_verify_error" || result.status == "posting_key_mismatch") {
                    skips += "stop-plan:${result.status}:${action.account}"
                    break
                }
            }
        }
        return AutoVoteRuntimeReport(
            attempted = attempted,
            broadcasted = if (previewOnly) 0 else results.count { it.ok && (it.status == "broadcast_confirmed" || it.status == "broadcast_sent") },
            skipped = skips,
            results = results,
            candidates = plan.actions.size,
            skipSummary = skips.groupingBy { it.substringBefore(':') }.eachCount(),
            donateResults = donateResults
        )
    }
}
