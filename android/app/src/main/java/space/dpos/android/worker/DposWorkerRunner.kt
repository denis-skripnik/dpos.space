package space.dpos.android.worker

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import space.dpos.android.core.PayloadSanitizer
import space.dpos.android.BuildConfig
import space.dpos.android.notifications.FallbackGrapheneHistoryClient
import space.dpos.android.notifications.GolosNotificationScanner
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
import space.dpos.android.upvoter.GrapheneChainSpecs
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

class DposWorkerRunner(private val context: Context, private val statusSink: ((String) -> Unit)? = null) {
    private val store = WorkerStore(context)

    private fun publishStatus(status: String) {
        statusSink?.invoke(PayloadSanitizer.text(status, 520))
    }

    fun runOnce(reason: String = "manual"): WorkerRunSummary {
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
            runOnceLocked(reason)
        } finally {
            globalRunLock.set(false)
        }
    }

    private fun runOnceLocked(reason: String = "manual"): WorkerRunSummary {
        val startedAt = System.currentTimeMillis()
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
        var skipped = 0
        val errors = mutableListOf<String>()
        val messages = mutableListOf<String>()
        val autoUpvoterFeed = mutableListOf<JSONObject>()
        val storedAccounts = store.readAccounts()
        val activeAccounts = storedAccounts.filter { it.enabled }
        val enabledStored = storedAccounts.count { it.enabled }
        store.appendLog("accounts loaded; active=${activeAccounts.size}; stored=${storedAccounts.size}; enabled=$enabledStored")
        publishStatus("проверка началась; аккаунтов: ${activeAccounts.size}; уведомление обновляется тихо без звука")

        for (account in activeAccounts) {
            accountsChecked += 1
            store.appendLog("account started; ${account.chainId}:${account.account}; notifications=${store.notificationEnabled(account.chainId, account.account)}; autoUpvoter=${store.autoUpvoterEnabled(account.chainId, account.account)}; vizSelfAward=${store.vizSelfAwardEnabled(account.chainId, account.account)}")
            publishStatus("аккаунт ${account.chainId}:${account.account}; уведомления=${store.notificationEnabled(account.chainId, account.account)}; автоапвоутер=${store.autoUpvoterEnabled(account.chainId, account.account)}; VIZ self-award=${store.vizSelfAwardEnabled(account.chainId, account.account)}")
            val spec = GrapheneChainSpecs.find(account.chainId)
            if (account.chainId == "viz" && spec != null) {
                val vizEnergy = fetchNativeVoteEnergy(rpcClient(spec), account.account)
                val vizEnergyLabel = vizEnergy?.let { "%.2f".format(Locale.US, it / 100.0) } ?: "unknown"
                store.appendLog("viz:${account.account}: energy monitor; energy=${vizEnergyLabel}%")
            }
            if (store.notificationEnabled(account.chainId, account.account)) {
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
            if (store.autoUpvoterEnabled(account.chainId, account.account)) {
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
                try {
                    val keyRef = store.defaultPostingKeyRef(account.chainId, account.account)
                    val key = store.readPostingKey(account.chainId, account.account)
                    if (key.isNullOrBlank()) {
                        val msg = "${account.chainId}:${account.account}: автоапвоутер пропущен, нет сохранённого posting-ключа"
                        store.appendLog(msg)
                        messages += msg
                        skipped += 1
                        continue
                    }
                    val rpc = rpcClient(spec)
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
                        maxActionsPerTick = store.maxActions(account.chainId, account.account)
                    )
                    store.appendLog("${account.chainId}:${account.account}: автоапвоутер загружаю события; curators=${settings.curators.size}; favorites=${settings.favorites.size}; timeout=45s")
                    val events = collectAutoVoteEventsWithTimeout(spec.id, listOf(settings))
                    store.appendLog("${account.chainId}:${account.account}: автоапвоутер события загружены; count=${events.size}")
                    val curatorEvents = events.count { it.kind == "curator_vote" }
                    val favoriteEvents = events.count { it.kind == "favorite_post" }
                    val sourceSummary = "кураторов=${settings.curators.size}; любимых=${settings.favorites.size}; событий=${events.size}; голоса кураторов=$curatorEvents; посты любимых=$favoriteEvents"
                    publishStatus("${account.chainId}:${account.account}: лента проверена; событий=${events.size}; планирую голоса")
                    store.appendLog("${account.chainId}:${account.account}: автоапвоутер планирую голоса")
                    val plan = AutoUpvoterPlanner().plan(listOf(settings), events)
                    store.appendLog("${account.chainId}:${account.account}: автоапвоутер план готов; actions=${plan.actions.size}; skip=${plan.skips.size}")
                    if (plan.actions.isEmpty()) {
                        val msg = "${account.chainId}:${account.account}: лента проверена ($sourceSummary), подходящих действий нет, skip=${plan.skips.size}"
                        publishStatus("${account.chainId}:${account.account}: автоапвоутер завершён; действий нет; skip=${plan.skips.size}")
                        store.appendLog(msg)
                        messages += msg
                        skipped += plan.skips.size
                        continue
                    }
                    val runtime = AutoVoteRuntime(VoteRuntime(rpc, signer = GrapheneVoteSigner(spec), broadcaster = GolosBroadcastClient(rpc), historyClient = historyClient(spec)), object : PostingKeyProvider {
                        override fun keyRef(chainId: String, account: String): EncryptedKeyRef = keyRef
                        override fun privateWif(chainId: String, account: String): String? = key
                    }, chainId = spec.id, pauseAfterSuccessfulBroadcastMs = 5_000L)
                    publishStatus("${account.chainId}:${account.account}: обрабатываю кандидатов vote; кандидатов=${plan.actions.size}; пауза между успешными голосами 5 секунд")
                    store.appendLog("${account.chainId}:${account.account}: автоапвоутер обрабатывает кандидатов vote; candidates=${plan.actions.size}; pauseAfterSuccessfulBroadcast=5s; timeout=dynamic")
                    val report = runAutoVoteRuntimeWithTimeout(account.chainId, account.account, runtime, plan)
                    autoUpvoterAttempted += report.attempted
                    autoUpvoterBroadcasted += report.broadcasted
                    autoUpvoterCandidates += report.candidates
                    report.skipSummary.forEach { (key, value) -> autoUpvoterSkipSummary[key] = (autoUpvoterSkipSummary[key] ?: 0) + value }
                    skipped += report.skipped.size
                    report.results.mapNotNullTo(autoUpvoterFeed) { resultToFeedEntry(it) }
                    val skipDetails = report.skipSummary.entries.sortedBy { it.key }.joinToString(", ") { "${it.key}=${it.value}" }.ifBlank { "нет" }
                    val msg = "${account.chainId}:${account.account}: лента проверена ($sourceSummary), кандидатов ${report.candidates}, обработано ${report.attempted}, отправлено ${report.broadcasted}, skip=${report.skipped.size} ($skipDetails)"
                    publishStatus("${account.chainId}:${account.account}: автоапвоутер завершён; кандидатов=${report.candidates}; обработано=${report.attempted}; отправлено=${report.broadcasted}; skip=${report.skipped.size}")
                    store.appendLog(msg)
                    messages += msg
                    report.results.filter { !it.ok }.forEach { result ->
                        val errorMsg = "${account.chainId}:${account.account}: ${result.status}: ${PayloadSanitizer.text(result.reason, 600)}"
                        errors += errorMsg
                        store.appendLog(errorMsg, "error")
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
                    val lastAwardAt = store.lastVizSelfAwardAt(account.account)
                    val minAwardIntervalMs = 432_000L
                    if (lastAwardAt != null && System.currentTimeMillis() - lastAwardAt < minAwardIntervalMs) {
                        val secondsLeft = ((minAwardIntervalMs - (System.currentTimeMillis() - lastAwardAt)) / 1000L).coerceAtLeast(1L)
                        val msg = "viz:${account.account}: self-award recent_skip: последняя успешная награда была недавно; следующая попытка не раньше чем через ${secondsLeft} секунд"
                        store.appendLog(msg)
                        messages += msg
                        skipped += 1
                        continue
                    }
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
                    val result = runVizSelfAwardWithTimeout(account.account, keyRef, key)
                    if (result.ok && result.status == "broadcast_confirmed") {
                        vizSelfAwardBroadcasted += 1
                        store.markVizSelfAward(account.account)
                    }
                    if (result.ok && result.status == "low_energy_skip") skipped += 1
                    val msg = "viz:${account.account}: self-award ${result.status}: ${PayloadSanitizer.text(result.reason, 220)}"
                    publishStatus("viz:${account.account}: self-award ${result.status}; ${PayloadSanitizer.text(result.reason, 180)}")
                    store.appendLog(msg, if (result.ok) "info" else "error")
                    messages += msg
                    if (!result.ok) errors += msg
                } catch (e: Exception) {
                    val msg = "viz:${account.account}: ошибка self-award: ${e.message}"
                    errors += msg
                    store.setLastError(e.message)
                    store.appendLog(msg, "error")
                }
            }
        }

        val nextTick = System.currentTimeMillis() + store.intervalMinutes() * 60_000L
        store.setNextTick(nextTick)
        val ok = errors.isEmpty()
        store.addAutoUpvoterBroadcasted(autoUpvoterBroadcasted)
        store.addVizSelfAwardBroadcasted(vizSelfAwardBroadcasted)
        val totalVotes = store.totalAutoUpvoterBroadcasted()
        val totalVizSelfAwards = store.totalVizSelfAwardBroadcasted()
        store.saveAutoUpvoterFeed(autoUpvoterFeed)
        val status = if (ok) "checked" else "checked_with_errors"
        store.appendLog("check finished; accounts=$accountsChecked; notifications=$notificationsShown; candidates=$autoUpvoterCandidates; processed=$autoUpvoterAttempted; votes=$autoUpvoterBroadcasted; totalVotes=$totalVotes; vizSelfAwards=$vizSelfAwardBroadcasted; totalVizSelfAwards=$totalVizSelfAwards; errors=${errors.size}", if (ok) "info" else "error")
        publishStatus("проверка завершена; аккаунтов=$accountsChecked; уведомлений=$notificationsShown; vote сейчас=$autoUpvoterBroadcasted; всего vote=$totalVotes; VIZ self-awards сейчас=$vizSelfAwardBroadcasted; всего VIZ=$totalVizSelfAwards; ошибок=${errors.size}")
        val summary = WorkerRunSummary(ok, status, accountsChecked, notificationChecks, notificationsShown, autoUpvoterChecks, autoUpvoterAttempted, autoUpvoterBroadcasted, skipped, errors, messages.takeLast(12), startedAt, autoUpvoterFeed.takeLast(30), vizSelfAwardChecks, vizSelfAwardBroadcasted, autoUpvoterCandidates, autoUpvoterSkipSummary.toMap(), totalVotes, totalVizSelfAwards)
        store.saveLastRunSummary(summary.toJson())
        return summary
    }

    private fun runAutoVoteRuntimeWithTimeout(chainId: String, account: String, runtime: AutoVoteRuntime, plan: VotePlan, timeoutSeconds: Long = ((plan.actions.size * 10L) + 30L).coerceIn(60L, 600L)): AutoVoteRuntimeReport {
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
            executor.shutdownNow()
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

    private fun runVizSelfAwardWithTimeout(account: String, keyRef: EncryptedKeyRef, key: String, timeoutSeconds: Long = 45L): VizSelfAwardResult {
        val clean = account.trim().removePrefix("@").lowercase()
        val executor = Executors.newSingleThreadExecutor()
        return try {
            val future = executor.submit<VizSelfAwardResult> {
                val spec = GrapheneChainSpecs.require("viz")
                val rpc = rpcClient(spec)
                VizSelfAwardRuntime(
                    rpc,
                    broadcaster = GolosBroadcastClient(rpc),
                    historyClient = historyClient(spec)
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
            executor.shutdownNow()
        }
    }

    private fun resultToFeedEntry(result: VoteBroadcastResult): JSONObject? {
        val operation = result.operation
        val type = when {
            result.ok && (result.status == "broadcast_confirmed" || result.status == "broadcast_sent") -> "success"
            result.ok && result.status == "already_voted" -> return null
            !result.ok -> "error"
            else -> "info"
        }
        val message = when (type) {
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
                .put("reason", PayloadSanitizer.text(result.reason, 700)))
            .put("diagnostics", result.diagnostics ?: JSONObject.NULL)
    }

    private fun collectAutoVoteEventsWithTimeout(chainId: String, settings: List<AccountSettings>, timeoutSeconds: Long = 45L): List<VoteEvent> {
        val executor = Executors.newSingleThreadExecutor()
        return try {
            val future = executor.submit<List<VoteEvent>> { collectAutoVoteEvents(chainId, settings) }
            future.get(timeoutSeconds, TimeUnit.SECONDS)
        } catch (e: TimeoutException) {
            throw IllegalStateException("${chainId} auto-upvoter event collection exceeded ${timeoutSeconds}s; curator/favorite feed RPC did not finish in time")
        } finally {
            executor.shutdownNow()
        }
    }

    private fun collectAutoVoteEvents(chainId: String, settings: List<AccountSettings>): List<VoteEvent> {
        val spec = GrapheneChainSpecs.requireVote(chainId)
        return AutoVoteEventCollector(historyClient(spec), discussionClient(spec)).collect(settings)
    }

    private fun historyClient(spec: space.dpos.android.upvoter.GrapheneChainSpec) = FallbackGrapheneHistoryClient(
        spec.rpcEndpoints.map { endpoint -> HttpGrapheneHistoryClient(endpoint, spec.legacyCallRpc, spec.historyApiName) }
    )

    private fun discussionClient(spec: space.dpos.android.upvoter.GrapheneChainSpec) = FallbackGolosDiscussionClient(
        spec.rpcEndpoints.map { endpoint -> HttpGrapheneDiscussionClient(endpoint, spec.legacyCallRpc, spec.discussionApiName) }
    )

    private fun rpcClient(spec: space.dpos.android.upvoter.GrapheneChainSpec) = FallbackGrapheneRpcClient(
        spec.rpcEndpoints.map { endpoint -> HttpGrapheneRpcClient(spec, endpoint) }
    )

    companion object {
        private val globalRunLock = AtomicBoolean(false)
    }
}
