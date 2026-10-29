package space.dpos.android.worker

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import space.dpos.android.core.PayloadSanitizer
import space.dpos.android.BuildConfig
import space.dpos.android.notifications.FallbackGrapheneHistoryClient
import space.dpos.android.notifications.GolosNotificationScanner
import space.dpos.android.notifications.GolosHistoryClient
import space.dpos.android.notifications.HttpGrapheneHistoryClient
import space.dpos.android.notifications.NotificationHelper
import space.dpos.android.notifications.RestWalletNotificationScanner
import space.dpos.android.notifications.RestWalletNotificationSpecs
import space.dpos.android.storage.EncryptedKeyRef
import space.dpos.android.storage.NotificationCursor
import space.dpos.android.storage.WorkerStore
import space.dpos.android.upvoter.AccountSettings
import space.dpos.android.upvoter.AutoUpvoterPlanner
import space.dpos.android.upvoter.AutoVoteEventCollector
import space.dpos.android.upvoter.AutoVoteRuntime
import space.dpos.android.upvoter.AutoVoteRuntimeReport
import space.dpos.android.upvoter.FallbackGolosDiscussionClient
import space.dpos.android.upvoter.FallbackGrapheneRpcClient
import space.dpos.android.upvoter.GolosBroadcastClient
import space.dpos.android.upvoter.GolosRpcClient
import space.dpos.android.upvoter.GrapheneChainSpecs
import space.dpos.android.upvoter.GolosDonatePool
import space.dpos.android.upvoter.GolosDonateRuntime
import space.dpos.android.upvoter.GrapheneVoteSigner
import space.dpos.android.upvoter.HttpGrapheneDiscussionClient
import space.dpos.android.upvoter.HttpGrapheneRpcClient
import space.dpos.android.upvoter.PostingKeyProvider
import space.dpos.android.upvoter.VoteBroadcastResult
import space.dpos.android.upvoter.VoteEvent
import space.dpos.android.upvoter.VoteOperation
import space.dpos.android.upvoter.VotePlan
import space.dpos.android.upvoter.VoteRuntime
import space.dpos.android.upvoter.VizSelfAwardOperation
import space.dpos.android.upvoter.VizSelfAwardResult
import space.dpos.android.upvoter.VizSelfAwardRuntime
import java.time.LocalDateTime
import java.time.ZoneOffset
import java.util.Locale
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.TimeoutException
import java.util.concurrent.atomic.AtomicBoolean

/** Only known VIZ async acceptance and its guarded cadence wait are informational. */
internal fun isNormalVizPending(result: VizSelfAwardResult): Boolean = !result.ok && when (result.status) {
    "broadcast_unconfirmed" -> result.reason == "VIZ async broadcast returned; exact transaction is not yet irreversible; next periodic check will retry read-only confirmation"
    "broadcast_unknown" -> result.reason.matches(Regex("previous VIZ self-award outcome unknown; no replay; waiting for advancing fresh chain head through full 432-second cadence; deadline=[0-9]+"))
    else -> false
}

data class WorkerRunSummary(
    val ok: Boolean,
    val status: String,
    val accountsChecked: Int,
    val notificationChecks: Int,
    val notificationsShown: Int,
    val autoUpvoterChecks: Int,
    val autoUpvoterAttempted: Int,
    val autoUpvoterBroadcasted: Int,
    val skipped: Int,
    val errors: List<String>,
    val messages: List<String>,
    val lastTick: Long,
    val autoUpvoterFeed: List<JSONObject> = emptyList(),
    val vizSelfAwardChecks: Int = 0,
    val vizSelfAwardBroadcasted: Int = 0,
    val autoUpvoterCandidates: Int = 0,
    val autoUpvoterSkipSummary: Map<String, Int> = emptyMap(),
    val totalAutoUpvoterBroadcasted: Int = 0,
    val totalVizSelfAwardBroadcasted: Int = 0
) {
    fun toJson(): JSONObject = JSONObject()
        .put("ok", ok)
        .put("status", status)
        .put("accountsChecked", accountsChecked)
        .put("notificationChecks", notificationChecks)
        .put("notificationsShown", notificationsShown)
        .put("autoUpvoterChecks", autoUpvoterChecks)
        .put("autoUpvoterAttempted", autoUpvoterAttempted)
        .put("autoUpvoterBroadcasted", autoUpvoterBroadcasted)
        .put("vizSelfAwardChecks", vizSelfAwardChecks)
        .put("vizSelfAwardBroadcasted", vizSelfAwardBroadcasted)
        .put("skipped", skipped)
        .put("errors", JSONArray(errors.map { PayloadSanitizer.text(it, 700) }))
        .put("messages", JSONArray(messages.map { PayloadSanitizer.text(it, 700) }))
        .put("lastTick", lastTick)
        .put("autoUpvoterFeed", JSONArray(autoUpvoterFeed))
        .put("autoUpvoterCandidates", autoUpvoterCandidates)
        .put("autoUpvoterSkipSummary", JSONObject(autoUpvoterSkipSummary))
        .put("totalAutoUpvoterBroadcasted", totalAutoUpvoterBroadcasted)
        .put("totalVizSelfAwardBroadcasted", totalVizSelfAwardBroadcasted)
}

class DposWorkerRunner(
    private val context: Context,
    private val store: WorkerStore = WorkerStore(context),
    private val historyOverride: ((String) -> GolosHistoryClient)? = null,
    private val rpcOverride: ((String) -> GolosRpcClient)? = null,
    private val eventsOverride: ((String, List<AccountSettings>) -> List<VoteEvent>)? = null,
    private val recoveryWall: () -> Long = { System.currentTimeMillis() },
    private val recoveryMonotonic: () -> Long = { android.os.SystemClock.elapsedRealtime() },
    private val productionPolicy: space.dpos.android.upvoter.GolosProductionPolicy = space.dpos.android.upvoter.GolosProductionPolicy(),
    private val statusSink: ((String) -> Unit)? = null
) {

    private fun pinRecoveryRpc(rpc: GolosRpcClient, permit: () -> Boolean): GolosRpcClient {
        val lane = space.dpos.android.upvoter.GolosRecoveryFence(store::readGolosRecoveryFence, store::saveGolosRecoveryFence, recoveryWall, recoveryMonotonic, permit)
        var detail = "production_endpoint_unavailable"
        for (endpoint in rpc.recoveryClients()) {
            check(permit()) { "recovery_cancelled" }
            val admitted = try { productionPolicy.admit(endpoint, recoveryWall, recoveryMonotonic, permit) }
                catch (e: Exception) { detail = PayloadSanitizer.text(e.message, 180); continue }
            // Ownership is held across admission, atomic retirement and all subsequent writers.
            store.migrateReviewedGolosFence(admitted, permit)
            if (store.requiresGolosRecovery()) {
                try { lane.verify(admitted.rpc) } catch (e: Exception) {
                    store.checkpoint.assertActivated()
                    detail = PayloadSanitizer.text(e.message, 180)
                    continue
                }
            }
            return admitted.rpc
        }
        throw IllegalStateException("production_degraded: $detail; no peer fallback or replay")
    }
    private fun publishStatus(status: String) {
        statusSink?.invoke(PayloadSanitizer.text(status, 520))
    }

    fun runOnce(reason: String = "manual", admission: WorkerCancellation.Token? = null): WorkerRunSummary {
        if (!globalRunLock.compareAndSet(false, true)) {
            val now = System.currentTimeMillis()
            val msg = "worker run skipped; previous run still running; reason=$reason"
            store.appendLog(msg, "warning")
            publishStatus("проверка пропущена: предыдущая проверка ещё выполняется")
            val summary = WorkerRunSummary(
                ok = true,
                status = "skipped_overlap",
                accountsChecked = 0,
                notificationChecks = 0,
                notificationsShown = 0,
                autoUpvoterChecks = 0,
                autoUpvoterAttempted = 0,
                autoUpvoterBroadcasted = 0,
                skipped = 1,
                errors = emptyList(),
                messages = listOf(msg),
                lastTick = now,
                autoUpvoterFeed = emptyList(),
                vizSelfAwardChecks = 0,
                vizSelfAwardBroadcasted = 0
            )
            return summary
        }
        return try {
            runOnceLocked(reason, admission)
        } finally {
            globalRunLock.set(false)
        }
    }

    private fun runOnceLocked(reason: String = "manual", admission: WorkerCancellation.Token? = null): WorkerRunSummary {
        val runToken = WorkerCancellation.token { admission?.mayContinue() != false && store.workerEnabled() }
        val startedAt = System.currentTimeMillis()
        if (store.checkpointStatus().optString("authority") != "verified" && !store.retryCheckpointStorage(force = false)) {
            val message = "Хранилище транзакций не подтверждено; отправка приостановлена, повторная проверка с задержкой; ключи и настройки сохранены."
            publishStatus(message)
            return WorkerRunSummary(false, "storage_unverified", 0, 0, 0, 0, 0, 0, 0, listOf(message), listOf(message), startedAt)
        }
        if (!runToken.mayContinue()) return WorkerRunSummary(true, "cancelled", 0, 0, 0, 0, 0, 0, 1, emptyList(), emptyList(), startedAt)
        store.setLastTick(startedAt)
        store.setLastError(null)
        store.appendLog("check started; reason=$reason; apk=${BuildConfig.VERSION_NAME}(${BuildConfig.VERSION_CODE}); vizBroadcast=${if (GrapheneChainSpecs.require("viz").asyncBroadcastOnly) "broadcast_transaction" else "broadcast_transaction_synchronous"}")
        var accountsChecked = 0
        var notificationChecks = 0
        var notificationsShown = 0
        var autoUpvoterChecks = 0
        var autoUpvoterAttempted = 0
        var autoUpvoterBroadcasted = 0
        var autoUpvoterCandidates = 0
        val autoUpvoterSkipSummary = mutableMapOf<String, Int>()
        var vizSelfAwardChecks = 0
        var vizSelfAwardBroadcasted = 0
        var vizPendingConfirmations = 0
        var skipped = 0
        val errors = mutableListOf<String>()
        val messages = mutableListOf<String>()
        val autoUpvoterFeed = mutableListOf<JSONObject>()
        val storedAccounts = store.readAccounts()
        val golosOnly = reason == "foreground-golos"
        val activeAccounts = storedAccounts.filter { it.enabled && (!golosOnly ||
            it.chainId == "golos" && store.autoUpvoterEnabled("golos", it.account) ||
            it.chainId == "viz" && store.vizSelfAwardEnabled("viz", it.account)) }
        val enabledStored = storedAccounts.count { it.enabled }
        store.appendLog("accounts loaded; active=${activeAccounts.size}; stored=${storedAccounts.size}; enabled=$enabledStored")
        publishStatus("проверка началась; аккаунтов: ${activeAccounts.size}; уведомление обновляется тихо без звука")

        // Due/pending VIZ work must not sit behind a Golos planning window.
        for (account in activeAccounts.sortedBy { if (it.chainId == "viz") 0 else 1 }) {
            if (!runToken.mayContinue()) {
                store.appendLog("worker cancelled before account ${account.chainId}:${account.account}", "warning")
                break
            }
            accountsChecked += 1
            store.appendLog("account started; ${account.chainId}:${account.account}; notifications=${store.notificationEnabled(account.chainId, account.account)}; autoUpvoter=${store.autoUpvoterEnabled(account.chainId, account.account)}; vizSelfAward=${store.vizSelfAwardEnabled(account.chainId, account.account)}")
            publishStatus("аккаунт ${account.chainId}:${account.account}; уведомления=${store.notificationEnabled(account.chainId, account.account)}; автоапвоутер=${store.autoUpvoterEnabled(account.chainId, account.account)}; VIZ self-award=${store.vizSelfAwardEnabled(account.chainId, account.account)}")
            val spec = GrapheneChainSpecs.find(account.chainId)
            if (account.chainId == "viz" && spec != null) {
                val vizEnergy = fetchNativeVoteEnergy(rpcClient(spec), account.account)
                val vizEnergyLabel = vizEnergy?.let { "%.2f".format(Locale.US, it / 100.0) } ?: "unknown"
                store.appendLog("viz:${account.account}: energy monitor; energy=${vizEnergyLabel}%")
            }
            if (!golosOnly && store.notificationEnabled(account.chainId, account.account)) {
                notificationChecks += 1
                try {
                    val cursor = store.readCursor(account.chainId, account.account)
                    val selectedOps = store.notificationOps(account.chainId, account.account)
                    val (nextCursor, notifications) = if (spec != null) {
                        GolosNotificationScanner(historyClient(spec), spec.id).fetchAndScan(account.account, cursor.lastIndex.takeIf { it >= 0 }, cursor.baselineDone, selectedOps = selectedOps)
                    } else if (account.chainId in RestWalletNotificationSpecs.supportedChains) {
                        RestWalletNotificationScanner(account.chainId).fetchAndScan(account.account, cursor.lastIndex.takeIf { it >= 0 }, cursor.baselineDone, selectedOps = selectedOps)
                    } else {
                        val msg = "${account.chainId}:${account.account}: уведомления не поддержаны"
                        store.appendLog(msg)
                        skipped += 1
                        messages += msg
                        cursor.lastIndex to emptyList()
                    }
                    store.saveCursor(NotificationCursor(account.chainId, account.account, nextCursor, true))
                    notifications.forEach { event -> NotificationHelper.showEvent(context, event.title, event.text, event.id, event.route) }
                    notificationsShown += notifications.size
                    val msg = "${account.chainId}:${account.account}: история проверена, новых уведомлений ${notifications.size}, cursor=$nextCursor"
                    store.appendLog(msg)
                    messages += msg
                } catch (e: Exception) {
                    val msg = "${account.chainId}:${account.account}: уведомления временно недоступны: ${e.message}"
                    store.appendLog(msg, "warning")
                    messages += msg
                    skipped += 1
                }
            }
            if (store.autoUpvoterEnabled(account.chainId, account.account) && (!golosOnly || account.chainId == "golos")) {
                autoUpvoterChecks += 1
                store.appendLog("${account.chainId}:${account.account}: автоапвоутер запускается; ищу новые события")
                publishStatus("${account.chainId}:${account.account}: автоапвоутер запускается; ищу новые события")
                if (spec == null || !spec.nativeVoteSupported) {
                    val msg = "${account.chainId}:${account.account}: автоапвоутер пропущен, фоновое голосование для цепочки не поддержано"
                    store.appendLog(msg)
                    messages += msg
                    skipped += 1
                    continue
                }
                // Admission/retirement runs under exclusive ownership BEFORE any GOLOS
                // reconciliation, including donations. Migration/drain cannot settle old work.
                try {
                    val accountPermit = { runToken.mayContinue() && store.autoUpvoterEnabled(account.chainId, account.account) }
                    val configuredRpc = rpcClient(spec)
                    val rpc = if (spec.id == "golos") pinRecoveryRpc(configuredRpc, accountPermit) else configuredRpc
                    val voteHistory = if (spec.id == "golos") rpc.recoveryHistory() ?: error("production_history_unbound") else historyClient(spec)
                    if (spec.id == "golos" && store.autoDonatePool("golos", account.account) != null) {
                        val permit = { accountPermit() && store.autoDonatePool("golos", account.account) != null }
                        val result = GolosDonateRuntime(rpc, voteHistory, store, canAct = permit).reconcilePending(account.account)
                        if (result.status != "donate_no_pending") store.appendLog("golos:${account.account}: pending auto-donate ${result.status}", if (result.confirmed) "info" else "warning")
                    }
                    val pendingVote = if (spec.id == "golos") VoteRuntime(rpc,
                        historyClient = voteHistory, canAct = accountPermit, pendingStore = store, recoveryWall = recoveryWall, recoveryMonotonic = recoveryMonotonic)
                        .reconcilePending(spec.id, account.account) else null
                    if (pendingVote != null) {
                        val msg = "${account.chainId}:${account.account}: recovery ${pendingVote.status}: ${PayloadSanitizer.text(pendingVote.reason, 400)}"
                        store.appendLog(msg, if (pendingVote.ok) "info" else "warning")
                        messages += msg
                        // Late Golos archive confirmation is not a new send/counter or donation.
                        if (pendingVote.ok && spec.id != "golos") autoUpvoterBroadcasted += 1
                    }
                    val keyRef = store.defaultPostingKeyRef(account.chainId, account.account)
                    val key = store.readPostingKey(account.chainId, account.account)
                    if (key.isNullOrBlank()) {
                        val msg = "${account.chainId}:${account.account}: автоапвоутер пропущен, нет сохранённого posting-ключа"
                        store.appendLog(msg)
                        messages += msg
                        skipped += 1
                        continue
                    }
                    val minEnergy = store.minEnergy(account.chainId, account.account)
                    val liveEnergy = fetchNativeVoteEnergy(rpc, account.account)
                    val energyLabel = liveEnergy?.let { "%.2f".format(Locale.US, it / 100.0) } ?: "unknown"
                    store.appendLog("${account.chainId}:${account.account}: автоапвоутер energy check; energy=${energyLabel}%; minEnergy=${minEnergy / 100.0}%")
                    if (liveEnergy == null && minEnergy > 0) {
                        val msg = "${account.chainId}:${account.account}: автоапвоутер пропущен, не удалось прочитать live voting energy; minEnergy=${minEnergy / 100.0}%"
                        store.appendLog(msg, "warning")
                        messages += msg
                        skipped += 1
                        continue
                    }
                    val settings = AccountSettings(
                        account.account,
                        enabled = true,
                        curators = store.curators(account.chainId, account.account),
                        favorites = store.favorites(account.chainId, account.account),
                        minEnergy = minEnergy,
                        curatorMode = store.curatorMode(account.chainId, account.account),
                        curatorCoefficient = store.curatorCoefficient(account.chainId, account.account),
                        favoritesPercent = store.favoritesPercent(account.chainId, account.account),
                        currentEnergy = liveEnergy,
                        maxActionsPerTick = store.maxActions(account.chainId, account.account),
                        chainId = spec.id,
                        donatePool = if (spec.id == "golos") store.autoDonatePool(spec.id, account.account)?.let { GolosDonatePool.parse(it) } else null
                    )
                    store.appendLog("${account.chainId}:${account.account}: автоапвоутер загружаю события; curators=${settings.curators.size}; favorites=${settings.favorites.size}; timeout=45s")
                    val events = collectAutoVoteEventsWithTimeout(spec.id, listOf(settings), pinnedHistory = voteHistory)
                    if (pendingVote != null && !pendingVote.ok) {
                        autoUpvoterSkipSummary["broadcast_unknown"] = (autoUpvoterSkipSummary["broadcast_unknown"] ?: 0) + 1
                        if (spec.id != "golos") {
                            errors += "${account.chainId}: ${space.dpos.android.upvoter.VoteOutcomePresentation.message(pendingVote)}"
                            skipped += 1
                            continue
                        }
                        // Unknown Golos archived votes block their target only, not the account.
                    }
                    store.appendLog("${account.chainId}:${account.account}: автоапвоутер события загружены; count=${events.size}")
                    val curatorEvents = events.count { it.kind == "curator_vote" }
                    val favoriteEvents = events.count { it.kind == "favorite_post" }
                    val sourceSummary = "кураторов=${settings.curators.size}; любимых=${settings.favorites.size}; событий=${events.size}; голоса кураторов=$curatorEvents; посты любимых=$favoriteEvents"
                    publishStatus("${account.chainId}:${account.account}: лента проверена; событий=${events.size}; планирую голоса")
                    store.appendLog("${account.chainId}:${account.account}: автоапвоутер планирую голоса")
                    val donateRuntime = if (spec.id == "golos" && settings.donatePool != null) GolosDonateRuntime(rpc, voteHistory, store,
                        canAct = { accountPermit() && store.autoDonatePool("golos", account.account) != null }) else null
                    val runtime = AutoVoteRuntime(VoteRuntime(rpc, signer = GrapheneVoteSigner(spec), broadcaster = GolosBroadcastClient(rpc), historyClient = voteHistory, canAct = accountPermit, pendingStore = store, recoveryWall = recoveryWall, recoveryMonotonic = recoveryMonotonic), object : PostingKeyProvider {
                        override fun keyRef(chainId: String, account: String): EncryptedKeyRef = keyRef
                        override fun privateWif(chainId: String, account: String): String? = key
                    }, chainId = spec.id, pauseAfterSuccessfulBroadcastMs = 5_000L, canAct = accountPermit, donateRuntime = donateRuntime,
                        planningProgress = { reached, total ->
                            publishStatus("${account.chainId}:${account.account}: планирование проверено $reached из $total; бюджет 15 секунд; остальные сохранены")
                        })
                    val plan = runtime.plan(listOf(settings), events)
                    val planningDeferred = (events.size - (plan.inspectedEvents ?: events.size)).coerceAtLeast(0)
                    if (spec.id == "golos" && accountPermit() && eventsOverride == null)
                        space.dpos.android.upvoter.GolosEventBacklog(voteHistory, store, accountPermit).planned(account.account, events.size, plan.inspectedEvents ?: events.size)
                    store.appendLog("${account.chainId}:${account.account}: автоапвоутер план готов; actions=${plan.actions.size}; skip=${plan.skips.size}")
                    if (plan.actions.isEmpty()) {
                        if (spec.id == "golos" && accountPermit()) space.dpos.android.upvoter.GolosEventBacklog(voteHistory, store).acknowledge(account.account, null, plan)
                        if (accountPermit() && plan.skips.none { it.startsWith("energy:") || it.startsWith("root_post_unknown:") || it.startsWith("cancelled:") }) persistCuratorCursors(spec.id, account.account, events)
                        plan.skips.groupingBy { it.substringBefore(':') }.eachCount().forEach { (key, value) ->
                            autoUpvoterSkipSummary[key] = (autoUpvoterSkipSummary[key] ?: 0) + value
                        }
                        val allUnavailable = spec.id == "golos" && events.isNotEmpty() && plan.skips.isNotEmpty() &&
                            plan.skips.all { space.dpos.android.upvoter.GolosContentStatus.unavailable(it) }
                        if (allUnavailable) {
                            val endpointId = space.dpos.android.storage.TransactionCheckpointStore.digest(rpc.recoveryEndpoint.toByteArray()).take(12)
                            val samples = plan.skips.take(3).joinToString("; ") { PayloadSanitizer.text(it, 130) }
                            val detail = "golos:${account.account}: autovoter_degraded; content verification unavailable; endpoint=$endpointId; policy=${space.dpos.android.upvoter.GolosProductionPolicy.ID}; epoch=${store.golosProductionEpoch() ?: "initial"}; samples=$samples"
                            errors += detail
                            store.appendLog(detail, "warning")
                            messages += detail
                            publishStatus("golos:${account.account}: автоапвоутер временно недоступен: не удалось проверить содержимое постов")
                        }
                        val msg = when {
                            planningDeferred > 0 -> "${account.chainId}:${account.account}: planning_deferred; непроверенных событий сохранено=$planningDeferred; повторная проверка в следующем цикле; skip=${plan.skips.size}"
                            allUnavailable -> "golos:${account.account}: autovoter_degraded; unavailable=${plan.skips.size}; zero sends"
                            else -> "${account.chainId}:${account.account}: лента проверена ($sourceSummary), подходящих действий нет, skip=${plan.skips.size}"
                        }
                        if (planningDeferred > 0) publishStatus("${account.chainId}:${account.account}: планирование отложено; непроверенных событий сохранено=$planningDeferred; продолжу в следующем цикле")
                        else if (!allUnavailable) publishStatus("${account.chainId}:${account.account}: автоапвоутер завершён; действий нет; skip=${plan.skips.size}")
                        store.appendLog(msg)
                        messages += msg
                        skipped += plan.skips.size
                        continue
                    }
                    publishStatus("${account.chainId}:${account.account}: обрабатываю кандидатов vote; кандидатов=${plan.actions.size}; пауза между успешными голосами 5 секунд")
                    store.appendLog("${account.chainId}:${account.account}: автоапвоутер обрабатывает кандидатов vote; candidates=${plan.actions.size}; pauseAfterSuccessfulBroadcast=5s; timeout=dynamic")
                    val report = runAutoVoteRuntimeWithTimeout(account.chainId, account.account, runtime, plan)
                    if (spec.id == "golos" && accountPermit()) space.dpos.android.upvoter.GolosEventBacklog(voteHistory, store).acknowledge(account.account, report, plan)
                    // Candidate outcomes are not failures merely because broadcasted=0.
                    // Log bounded sanitized statuses even for successful already_voted/skip.
                    report.results.take(12).forEach { result ->
                        store.appendLog("${account.chainId}:${account.account}: vote candidate @${result.operation.author}/${result.operation.permlink}; status=${result.status}; ok=${result.ok}; reason=${PayloadSanitizer.text(result.reason, 240)}", "info")
                    }
                    report.skipped.filter { it.startsWith("pending_confirmation:") || it.startsWith("missing-key:") || it.startsWith("cancelled:") || it.startsWith("not_root_post:") || it.startsWith("root_post_unknown:") }.take(12).forEach {
                        store.appendLog("${account.chainId}:${account.account}: vote candidate skip=${PayloadSanitizer.text(it, 220)}", "warning")
                    }
                    if (report.results.size > 12) store.appendLog("${account.chainId}:${account.account}: vote candidate details truncated; total=${report.results.size}")
                    if (accountPermit() && plan.skips.none { it.startsWith("energy:") } && report.skipped.none { it.startsWith("root_post_unknown:") } && report.results.all { it.ok || it.status == "already_voted" }) {
                        persistCuratorCursors(spec.id, account.account, events)
                    }
                    autoUpvoterAttempted += report.attempted
                    autoUpvoterBroadcasted += report.broadcasted
                    autoUpvoterCandidates += report.candidates
                    report.skipSummary.forEach { (key, value) -> autoUpvoterSkipSummary[key] = (autoUpvoterSkipSummary[key] ?: 0) + value }
                    report.donateResults.forEach { store.appendLog("golos:${account.account}: auto-donate ${it.status}" + if (it.confirmed) "; total=${it.amount?.totalMilli} milliGOLOS" else "", if (it.confirmed) "info" else "warning") }
                    skipped += report.skipped.size
                    report.results.mapNotNullTo(autoUpvoterFeed) { resultToFeedEntry(it) }
                    val skipDetails = report.skipSummary.entries.sortedBy { it.key }.joinToString(", ") { "${it.key}=${it.value}" }.ifBlank { "нет" }
                    val msg = "${account.chainId}:${account.account}: лента проверена ($sourceSummary), кандидатов ${report.candidates}, обработано ${report.attempted}, отправлено ${report.broadcasted}, skip=${report.skipped.size} ($skipDetails)"
                    publishStatus("${account.chainId}:${account.account}: автоапвоутер завершён; кандидатов=${report.candidates}; обработано=${report.attempted}; отправлено=${report.broadcasted}; skip=${report.skipped.size}")
                    store.appendLog(msg)
                    messages += msg
                    report.results.filter { !it.ok }.forEach { result ->
                        val errorMsg = if (result.status == "broadcast_unknown") "${account.chainId}: ${space.dpos.android.upvoter.VoteOutcomePresentation.message(result)}" else "${account.chainId}:${account.account}: ${result.status}: ${PayloadSanitizer.text(result.reason, 600)}"
                        errors += errorMsg
                        store.appendLog(errorMsg, if (result.status == "broadcast_unknown") "warning" else "error")
                        messages += errorMsg
                        if (result.status == "posting_key_mismatch") {
                            val warning = "${account.chainId}:${account.account}: сохранённый Android posting-ключ не совпал с authority; автоапвоутер не отключён автоматически — пересохраните posting-ключ в разделе «Аккаунты» и снова нажмите Start"
                            store.appendLog(warning, "error")
                            messages += warning
                        }
                    }
                } catch (e: Exception) {
                    val msg = "${account.chainId}:${account.account}: ошибка автоапвоутера: ${e.message}"
                    errors += msg
                    store.setLastError(e.message)
                    store.appendLog(msg, "error")
                }
            }
            if (account.chainId == "viz") {
                val vizEnabled = store.vizSelfAwardEnabled(account.chainId, account.account)
                val vizAutoStart = store.autoStartEnabled(account.chainId, account.account)
                val hasRegularKey = store.hasRegularKey(account.chainId, account.account)
                val minEnergy = store.minEnergy(account.chainId, account.account)
                store.appendLog("viz:${account.account}: self-award decision; enabled=$vizEnabled; autoStart=$vizAutoStart; regularKey=$hasRegularKey; minEnergy=${minEnergy / 100.0}%")
                if (!vizEnabled && hasRegularKey && vizAutoStart) {
                    store.appendLog("viz:${account.account}: self-award disabled in native storage despite autostart and regular key; open VIZ self-award page or press Start to resync UI flags", "warning")
                }
            }
            if (store.vizSelfAwardEnabled(account.chainId, account.account)) {
                vizSelfAwardChecks += 1
                publishStatus("viz:${account.account}: VIZ self-award запускается")
                if (account.chainId != "viz") {
                    val msg = "${account.chainId}:${account.account}: self-award пропущен, сервис поддержан только для VIZ"
                    store.appendLog(msg)
                    messages += msg
                    skipped += 1
                    continue
                }
                try {
                    store.appendLog("viz:${account.account}: self-award preparing; method=${if (GrapheneChainSpecs.require("viz").asyncBroadcastOnly) "broadcast_transaction" else "broadcast_transaction_synchronous"}")

                    publishStatus("viz:${account.account}: проверяю энергию и regular authority")
                    val keyRef = store.defaultRegularKeyRef("viz", account.account)
                    val key = store.readRegularKey("viz", account.account)
                    if (key.isNullOrBlank()) {
                        val msg = "viz:${account.account}: self-award пропущен, нет сохранённого regular-ключа"
                        store.appendLog(msg)
                        messages += msg
                        skipped += 1
                        continue
                    }
                    store.appendLog("viz:${account.account}: self-award submitting with bounded worker")
                    publishStatus("viz:${account.account}: отправляю self-award; timeout 45 секунд")
                    val confirmedBefore = store.totalVizSelfAwardBroadcasted()
                    val result = try {
                        runVizSelfAwardWithTimeout(account.account, keyRef, key) {
                            runToken.mayContinue() && store.vizSelfAwardEnabled("viz", account.account)
                        }
                    } finally {
                        // Receipt-owned exact-identity tally survives fresh preparation failures.
                        val after = runCatching { store.totalVizSelfAwardBroadcasted() }.getOrNull()
                        if (after != null) vizSelfAwardBroadcasted += (after - confirmedBefore).coerceAtLeast(0)
                    }
                    if (result.diagnostics?.optString("priorPendingOutcome") == "unknown_expired") {
                        store.appendLog("viz:${account.account}: prior self-award unknown_expired; old pending cleared after chain-time cadence and finality check; fresh award evaluated in same check")
                    }

                    if (result.ok && result.status == "low_energy_skip") skipped += 1
                    val msg = "viz:${account.account}: self-award ${result.status}: ${PayloadSanitizer.text(result.reason, 220)}"
                    publishStatus("viz:${account.account}: self-award ${result.status}; ${PayloadSanitizer.text(result.reason, 180)}")
                    val pendingConfirmation = isNormalVizPending(result)
                    if (pendingConfirmation) vizPendingConfirmations += 1
                    store.appendLog(msg, if (result.ok) "info" else if (pendingConfirmation) "warning" else "error")
                    messages += msg
                    if (!result.ok && !pendingConfirmation) errors += msg
                } catch (e: Exception) {
                    val msg = "viz:${account.account}: ошибка self-award: ${e.message}"
                    errors += msg
                    store.setLastError(e.message)
                    store.appendLog(msg, "error")
                }
            }
        }

        val nextDelay = if (DposForegroundService.isRunning || reason.startsWith("foreground-")) {
            if (store.activeAccounts().any { it.chainId == "golos" && store.autoUpvoterEnabled("golos", it.account) ||
                it.chainId == "viz" && store.vizSelfAwardEnabled("viz", it.account) }) 30_000L
            else space.dpos.android.upvoter.VIZ_SELF_AWARD_TICK_MS
        } else store.intervalMinutes() * 60_000L
        val nextTick = System.currentTimeMillis() + nextDelay
        store.setNextTick(nextTick)
        val ok = errors.isEmpty()
        // Vote totals remain best-effort aggregates; VIZ totals commit with exact terminal receipts.
        // Never repair or rewrite an uncertain checkpoint from this result/exception path.
        if (store.checkpointStatus().optString("authority") == "verified") {
            runCatching { store.addAutoUpvoterBroadcasted(autoUpvoterBroadcasted) }
        }
        val totalVotes = runCatching { store.totalAutoUpvoterBroadcasted() }.getOrDefault(0)
        val totalVizSelfAwards = runCatching { store.totalVizSelfAwardBroadcasted() }.getOrDefault(0)
        store.saveAutoUpvoterFeed(autoUpvoterFeed)
        val status = when {
            !ok -> "checked_with_errors"
            vizPendingConfirmations > 0 -> "pending_confirmation"
            else -> "checked"
        }
        store.appendLog("check finished; accounts=$accountsChecked; notifications=$notificationsShown; candidates=$autoUpvoterCandidates; processed=$autoUpvoterAttempted; votes=$autoUpvoterBroadcasted; totalVotes=$totalVotes; vizSelfAwards=$vizSelfAwardBroadcasted; totalVizSelfAwards=$totalVizSelfAwards; errors=${errors.size}", if (ok) "info" else "error")
        publishStatus("проверка завершена; аккаунтов=$accountsChecked; уведомлений=$notificationsShown; vote сейчас=$autoUpvoterBroadcasted; всего vote=$totalVotes; VIZ self-awards сейчас=$vizSelfAwardBroadcasted; всего VIZ=$totalVizSelfAwards; ошибок=${errors.size}")
        val summary = WorkerRunSummary(ok, status, accountsChecked, notificationChecks, notificationsShown, autoUpvoterChecks, autoUpvoterAttempted, autoUpvoterBroadcasted, skipped, errors, messages.takeLast(12), startedAt, autoUpvoterFeed.takeLast(30), vizSelfAwardChecks, vizSelfAwardBroadcasted, autoUpvoterCandidates, autoUpvoterSkipSummary.toMap(), totalVotes, totalVizSelfAwards)
        store.saveLastRunSummary(summary.toJson())
        return summary
    }

    private fun runAutoVoteRuntimeWithTimeout(chainId: String, account: String, runtime: AutoVoteRuntime, plan: VotePlan, timeoutSeconds: Long = autoVoteTimeoutSeconds(chainId, plan.actions.size)): AutoVoteRuntimeReport {
        val executor = Executors.newSingleThreadExecutor()
        return try {
            val future = executor.submit<AutoVoteRuntimeReport> { runtime.execute(plan) }
            future.get(timeoutSeconds, TimeUnit.SECONDS)
        } catch (e: TimeoutException) {
            val first = plan.actions.firstOrNull()
            val operation = VoteOperation(
                chainId = chainId,
                voter = account,
                author = first?.author ?: account,
                permlink = first?.permlink ?: "auto-upvoter-timeout",
                weight = first?.weight ?: 10000
            )
            AutoVoteRuntimeReport(
                attempted = 0,
                broadcasted = 0,
                skipped = listOf("runtime-timeout:$account"),
                results = listOf(VoteBroadcastResult(
                    ok = false,
                    status = "broadcast_timeout",
                    operation = operation,
                    reason = "${chainId} auto-upvoter exceeded ${timeoutSeconds}s after planning ${plan.actions.size} vote actions; worker skipped remaining broadcasts so the foreground service can finish the tick"
                )),
                candidates = plan.actions.size,
                skipSummary = mapOf("runtime-timeout" to 1)
            )
        } catch (e: Exception) {
            val first = plan.actions.firstOrNull()
            val operation = VoteOperation(
                chainId = chainId,
                voter = account,
                author = first?.author ?: account,
                permlink = first?.permlink ?: "auto-upvoter-error",
                weight = first?.weight ?: 10000
            )
            AutoVoteRuntimeReport(
                attempted = 0,
                broadcasted = 0,
                skipped = listOf("runtime-error:$account"),
                results = listOf(VoteBroadcastResult(
                    ok = false,
                    status = "broadcast_error",
                    operation = operation,
                    reason = PayloadSanitizer.text(e.message.orEmpty().ifBlank { "native auto-upvoter runtime failed" }, 300)
                )),
                candidates = plan.actions.size,
                skipSummary = mapOf("runtime-error" to 1)
            )
        } finally {
            WorkerCancellation.shutdownAndAwait(executor)
        }
    }

    private fun fetchNativeVoteEnergy(rpc: space.dpos.android.upvoter.GolosRpcClient, account: String): Int? {
        val accountJson = try { rpc.getAccount(account.trim().removePrefix("@").lowercase(Locale.ROOT)) } catch (_: Exception) { null } ?: return null
        val raw = when {
            accountJson.has("voting_power") -> accountJson.optDouble("voting_power", Double.NaN)
            accountJson.has("energy") -> accountJson.optDouble("energy", Double.NaN)
            else -> Double.NaN
        }
        if (!raw.isFinite()) return null
        val time = accountJson.optString("last_vote_time", accountJson.optString("last_account_update", accountJson.optString("created", "")))
        val last = runCatching { LocalDateTime.parse(time).toEpochSecond(ZoneOffset.UTC) * 1000L }.getOrNull() ?: return raw.toInt().coerceIn(0, 10000)
        val deltaSeconds = ((System.currentTimeMillis() - last).coerceAtLeast(0L)) / 1000.0
        return (raw + deltaSeconds * 10000.0 / 432_000.0).toInt().coerceIn(0, 10000)
    }

    private fun runVizSelfAwardWithTimeout(account: String, keyRef: EncryptedKeyRef, key: String, timeoutSeconds: Long = 45L, canAct: () -> Boolean): VizSelfAwardResult {
        val clean = account.trim().removePrefix("@").lowercase()
        val executor = Executors.newSingleThreadExecutor()
        return try {
            val future = executor.submit<VizSelfAwardResult> {
                val spec = GrapheneChainSpecs.require("viz")
                val rpc = rpcClient(spec)
                VizSelfAwardRuntime(
                    rpc,
                    broadcaster = GolosBroadcastClient(rpc),
                    historyClient = historyClient(spec),
                    canAct = canAct,
                    pendingStore = store
                ).execute(clean, store.minEnergy("viz", clean), keyRef, key)
            }
            future.get(timeoutSeconds, TimeUnit.SECONDS)
        } catch (e: TimeoutException) {
            VizSelfAwardResult(
                ok = false,
                status = "broadcast_timeout",
                reason = "VIZ self-award exceeded ${timeoutSeconds}s for @$clean; worker skipped this account so the foreground service can finish the tick",
                operation = VizSelfAwardOperation(clean, 1),
                rpcResponse = JSONObject().put("timeoutSeconds", timeoutSeconds)
            )
        } catch (e: Exception) {
            VizSelfAwardResult(
                ok = false,
                status = "broadcast_error",
                reason = PayloadSanitizer.text(e.message.orEmpty().ifBlank { "native VIZ self-award failed" }, 300),
                operation = VizSelfAwardOperation(clean, 1),
                rpcResponse = JSONObject().put("error", PayloadSanitizer.text(e.message.orEmpty(), 500))
            )
        } finally {
            WorkerCancellation.shutdownAndAwait(executor)
        }
    }

    private fun resultToFeedEntry(result: VoteBroadcastResult): JSONObject? {
        val operation = result.operation
        val type = when {
            result.ok && (result.status == "broadcast_confirmed" || result.status == "broadcast_sent") -> "success"
            result.ok && result.status == "already_voted" -> return null
            result.status == "broadcast_unknown" -> "warning"
            !result.ok -> "error"
            else -> "info"
        }
        val message = when (type) {
            "warning" -> space.dpos.android.upvoter.VoteOutcomePresentation.message(result)
            "success" -> "OK @${operation.voter} voted @${operation.author}/${operation.permlink}"
            "error" -> "ERROR @${operation.voter} @${operation.author}/${operation.permlink}: ${result.status}: ${PayloadSanitizer.text(result.reason, 160)}"
            else -> "@${operation.voter} @${operation.author}/${operation.permlink}: ${result.status}"
        }
        return JSONObject()
            .put("type", type)
            .put("message", message)
            .put("action", JSONObject()
                .put("type", "vote")
                .put("account", operation.voter)
                .put("author", operation.author)
                .put("permlink", operation.permlink)
                .put("weight", operation.weight)
                .put("source", "android-native"))
            .put("result", JSONObject()
                .put("status", result.status)
                .put("ok", result.ok)
                .put("reason", if (result.status == "broadcast_unknown") space.dpos.android.diagnostics.DiagnosticSanitizer.sanitize(result.reason, 4_000) else PayloadSanitizer.text(result.reason, 700)))
            .put("diagnostics", result.diagnostics ?: JSONObject.NULL)
    }

    private fun collectAutoVoteEventsWithTimeout(chainId: String, settings: List<AccountSettings>, timeoutSeconds: Long = 45L, pinnedHistory: GolosHistoryClient? = null): List<VoteEvent> {
        val executor = Executors.newSingleThreadExecutor()
        return try {
            val future = executor.submit<List<VoteEvent>> { collectAutoVoteEvents(chainId, settings, pinnedHistory) }
            future.get(timeoutSeconds, TimeUnit.SECONDS)
        } catch (e: TimeoutException) {
            throw IllegalStateException("${chainId} auto-upvoter event collection exceeded ${timeoutSeconds}s; curator/favorite feed RPC did not finish in time")
        } finally {
            WorkerCancellation.shutdownAndAwait(executor)
        }
    }

    private fun collectAutoVoteEvents(chainId: String, settings: List<AccountSettings>, pinnedHistory: GolosHistoryClient? = null): List<VoteEvent> {
        eventsOverride?.let { return it(chainId, settings) }
        val spec = GrapheneChainSpecs.requireVote(chainId)
        if (spec.id == "golos") {
            val setting = settings.single()
            val intake = space.dpos.android.upvoter.GolosEventBacklog(pinnedHistory ?: historyClient(spec), store,
                canAct = { store.workerEnabled() && store.autoUpvoterEnabled(chainId, setting.account) && !Thread.currentThread().isInterrupted })
            val events = intake.collect(setting)
            intake.warnings.forEach { store.appendLog("golos:${setting.account}: intake partial: $it", "warning") }
            return events
        }
        val cursors = settings.flatMap { it.curators }.associate { curator ->
            val clean = curator.trim().removePrefix("@").lowercase()
            clean to store.autoVoteSourceCursor(chainId, "${settings.single().account}:$clean")
        }
        return AutoVoteEventCollector(historyClient(spec), discussionClient(spec)).collect(
            settings,
            curatorCursors = cursors
        )
    }

    private fun persistCuratorCursors(chainId: String, account: String, events: List<VoteEvent>) {
        if (chainId == "golos") return // GOLOS progress is atomic epoch+endpoint/API inbox progress, never this legacy counter.
        events.filter { it.kind == "curator_vote" && it.sourceIndex >= 0 }
            .groupBy { it.voter }
            .forEach { (curator, rows) ->
                store.saveAutoVoteSourceCursor(chainId, "$account:$curator", rows.maxOf { it.sourceIndex })
            }
    }

    private fun historyClient(spec: space.dpos.android.upvoter.GrapheneChainSpec): GolosHistoryClient = historyOverride?.invoke(spec.id) ?: FallbackGrapheneHistoryClient(
        spec.rpcEndpoints.map { endpoint -> HttpGrapheneHistoryClient(endpoint, spec.legacyCallRpc, spec.historyApiName) }
    )

    private fun discussionClient(spec: space.dpos.android.upvoter.GrapheneChainSpec) = FallbackGolosDiscussionClient(
        spec.rpcEndpoints.map { endpoint -> HttpGrapheneDiscussionClient(endpoint, spec.legacyCallRpc, spec.discussionApiName) }
    )

    private fun rpcClient(spec: space.dpos.android.upvoter.GrapheneChainSpec): GolosRpcClient = rpcOverride?.invoke(spec.id) ?: FallbackGrapheneRpcClient(
        spec.rpcEndpoints.map { endpoint -> HttpGrapheneRpcClient(spec, endpoint) }
    )

    companion object {
        private val globalRunLock = AtomicBoolean(false)
    }
}

// Cancellation budget only; WorkerCancellation retains ownership until child termination.
// Preserve the existing base and allow one fresh 45s finality window per Golos candidate.
// Cap very large plans at one hour (15 candidates: 180 + 675 = 855 seconds).
internal fun autoVoteTimeoutSeconds(chainId: String, candidates: Int): Long {
    val count = candidates.coerceAtLeast(0).toLong()
    val base = (count * 10L + 30L).coerceIn(60L, 600L)
    return if (chainId == "golos") (base + 45L * count).coerceAtMost(3_600L) else base
}
