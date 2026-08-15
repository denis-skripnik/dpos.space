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
import space.dpos.android.upvoter.VoteRuntime
import space.dpos.android.upvoter.VizSelfAwardRuntime

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
    val vizSelfAwardBroadcasted: Int = 0
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
        .put("errors", JSONArray(errors.map { PayloadSanitizer.text(it, 300) }))
        .put("messages", JSONArray(messages.map { PayloadSanitizer.text(it, 300) }))
        .put("lastTick", lastTick)
        .put("autoUpvoterFeed", JSONArray(autoUpvoterFeed))
}

class DposWorkerRunner(private val context: Context) {
    private val store = WorkerStore(context)

    fun runOnce(reason: String = "manual"): WorkerRunSummary {
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
        var vizSelfAwardChecks = 0
        var vizSelfAwardBroadcasted = 0
        var skipped = 0
        val errors = mutableListOf<String>()
        val messages = mutableListOf<String>()
        val autoUpvoterFeed = mutableListOf<JSONObject>()

        for (account in store.activeAccounts()) {
            accountsChecked += 1
            val spec = GrapheneChainSpecs.find(account.chainId)
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
                    val settings = AccountSettings(
                        account.account,
                        enabled = true,
                        curators = store.curators(account.chainId, account.account),
                        favorites = store.favorites(account.chainId, account.account),
                        minEnergy = store.minEnergy(account.chainId, account.account),
                        curatorMode = store.curatorMode(account.chainId, account.account),
                        curatorCoefficient = store.curatorCoefficient(account.chainId, account.account),
                        favoritesPercent = store.favoritesPercent(account.chainId, account.account),
                        maxActionsPerTick = store.maxActions(account.chainId, account.account)
                    )
                    val events = collectAutoVoteEvents(spec.id, listOf(settings))
                    val curatorEvents = events.count { it.kind == "curator_vote" }
                    val favoriteEvents = events.count { it.kind == "favorite_post" }
                    val sourceSummary = "кураторов=${settings.curators.size}; любимых=${settings.favorites.size}; событий=${events.size}; голоса кураторов=$curatorEvents; посты любимых=$favoriteEvents"
                    val plan = AutoUpvoterPlanner().plan(listOf(settings), events)
                    if (plan.actions.isEmpty()) {
                        val msg = "${account.chainId}:${account.account}: лента проверена ($sourceSummary), подходящих действий нет, skip=${plan.skips.size}"
                        store.appendLog(msg)
                        messages += msg
                        skipped += plan.skips.size
                        continue
                    }
                    val rpc = rpcClient(spec)
                    val runtime = AutoVoteRuntime(VoteRuntime(rpc, signer = GrapheneVoteSigner(spec), broadcaster = GolosBroadcastClient(rpc), historyClient = historyClient(spec)), object : PostingKeyProvider {
                        override fun keyRef(chainId: String, account: String): EncryptedKeyRef = keyRef
                        override fun privateWif(chainId: String, account: String): String? = key
                    }, chainId = spec.id)
                    val report = runtime.execute(plan)
                    autoUpvoterAttempted += report.attempted
                    autoUpvoterBroadcasted += report.broadcasted
                    skipped += report.skipped.size
                    report.results.mapNotNullTo(autoUpvoterFeed) { resultToFeedEntry(it) }
                    val msg = "${account.chainId}:${account.account}: лента проверена ($sourceSummary), попыток ${report.attempted}, отправлено ${report.broadcasted}, skip=${report.skipped.size}"
                    store.appendLog(msg)
                    messages += msg
                    report.results.filter { !it.ok }.forEach { result ->
                        errors += "${account.chainId}:${account.account}: ${result.status}: ${PayloadSanitizer.text(result.reason, 220)}"
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
                if (account.chainId != "viz") {
                    val msg = "${account.chainId}:${account.account}: self-award пропущен, сервис поддержан только для VIZ"
                    store.appendLog(msg)
                    messages += msg
                    skipped += 1
                    continue
                }
                try {
                    val keyRef = store.defaultRegularKeyRef("viz", account.account)
                    val key = store.readRegularKey("viz", account.account)
                    if (key.isNullOrBlank()) {
                        val msg = "viz:${account.account}: self-award пропущен, нет сохранённого regular-ключа"
                        store.appendLog(msg)
                        messages += msg
                        skipped += 1
                        continue
                    }
                    val spec = GrapheneChainSpecs.require("viz")
                    val rpc = rpcClient(spec)
                    val result = VizSelfAwardRuntime(rpc, broadcaster = GolosBroadcastClient(rpc), historyClient = historyClient(spec)).execute(account.account, store.minEnergy("viz", account.account), keyRef, key)
                    if (result.ok && result.status == "broadcast_confirmed") vizSelfAwardBroadcasted += 1
                    if (result.ok && result.status == "low_energy_skip") skipped += 1
                    val msg = "viz:${account.account}: self-award ${result.status}: ${PayloadSanitizer.text(result.reason, 220)}"
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
        store.saveAutoUpvoterFeed(autoUpvoterFeed)
        val status = if (ok) "checked" else "checked_with_errors"
        store.appendLog("check finished; accounts=$accountsChecked; notifications=$notificationsShown; attempted=$autoUpvoterAttempted; vizSelfAwards=$vizSelfAwardBroadcasted; errors=${errors.size}", if (ok) "info" else "error")
        return WorkerRunSummary(ok, status, accountsChecked, notificationChecks, notificationsShown, autoUpvoterChecks, autoUpvoterAttempted, autoUpvoterBroadcasted, skipped, errors, messages.takeLast(12), startedAt, autoUpvoterFeed.takeLast(30), vizSelfAwardChecks, vizSelfAwardBroadcasted)
    }

    private fun resultToFeedEntry(result: VoteBroadcastResult): JSONObject? {
        val operation = result.operation
        val type = when {
            result.ok && result.status == "broadcast_sent" -> "success"
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
                .put("reason", PayloadSanitizer.text(result.reason, 300)))
            .put("diagnostics", result.diagnostics ?: JSONObject.NULL)
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
}
