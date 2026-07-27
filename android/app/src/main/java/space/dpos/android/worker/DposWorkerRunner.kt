package space.dpos.android.worker

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import space.dpos.android.core.PayloadSanitizer
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
import space.dpos.android.upvoter.GolosBroadcastClient
import space.dpos.android.upvoter.GrapheneChainSpecs
import space.dpos.android.upvoter.GrapheneVoteSigner
import space.dpos.android.upvoter.HttpGrapheneDiscussionClient
import space.dpos.android.upvoter.HttpGrapheneRpcClient
import space.dpos.android.upvoter.PostingKeyProvider
import space.dpos.android.upvoter.VoteEvent
import space.dpos.android.upvoter.VoteRuntime

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
    val lastTick: Long
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
        .put("skipped", skipped)
        .put("errors", JSONArray(errors.map { PayloadSanitizer.text(it, 300) }))
        .put("messages", JSONArray(messages.map { PayloadSanitizer.text(it, 300) }))
        .put("lastTick", lastTick)
}

class DposWorkerRunner(private val context: Context) {
    private val store = WorkerStore(context)

    fun runOnce(reason: String = "manual"): WorkerRunSummary {
        val startedAt = System.currentTimeMillis()
        store.setLastTick(startedAt)
        store.setLastError(null)
        store.appendLog("check started; reason=$reason")
        var accountsChecked = 0
        var notificationChecks = 0
        var notificationsShown = 0
        var autoUpvoterChecks = 0
        var autoUpvoterAttempted = 0
        var autoUpvoterBroadcasted = 0
        var skipped = 0
        val errors = mutableListOf<String>()
        val messages = mutableListOf<String>()

        for (account in store.activeAccounts()) {
            accountsChecked += 1
            val spec = GrapheneChainSpecs.find(account.chainId)
            if (store.notificationEnabled(account.chainId, account.account)) {
                notificationChecks += 1
                try {
                    val cursor = store.readCursor(account.chainId, account.account)
                    val selectedOps = store.notificationOps(account.chainId, account.account)
                    val (nextCursor, notifications) = if (spec != null) {
                        GolosNotificationScanner(HttpGrapheneHistoryClient(spec.defaultRpcEndpoint, spec.legacyCallRpc, spec.historyApiName), spec.id).fetchAndScan(account.account, cursor.lastIndex.takeIf { it >= 0 }, cursor.baselineDone, selectedOps = selectedOps)
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
                    val msg = "${account.chainId}:${account.account}: ошибка уведомлений: ${e.message}"
                    errors += msg
                    store.setLastError(e.message)
                    store.appendLog(msg, "error")
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
                    val rpc = HttpGrapheneRpcClient(spec)
                    val runtime = AutoVoteRuntime(VoteRuntime(rpc, signer = GrapheneVoteSigner(spec), broadcaster = GolosBroadcastClient(rpc)), object : PostingKeyProvider {
                        override fun keyRef(chainId: String, account: String): EncryptedKeyRef = keyRef
                        override fun privateWif(chainId: String, account: String): String? = key
                    }, chainId = spec.id)
                    val report = runtime.execute(plan)
                    autoUpvoterAttempted += report.attempted
                    autoUpvoterBroadcasted += report.broadcasted
                    skipped += report.skipped.size
                    val msg = "${account.chainId}:${account.account}: лента проверена ($sourceSummary), попыток ${report.attempted}, отправлено ${report.broadcasted}, skip=${report.skipped.size}"
                    store.appendLog(msg)
                    messages += msg
                    report.results.filter { !it.ok }.forEach { result ->
                        errors += "${account.chainId}:${account.account}: ${result.status}"
                        if (result.status == "posting_key_mismatch") {
                            store.removeEncryptedKeyRef(keyRef)
                            store.disableAutoUpvoter(account.chainId, account.account)
                            val cleanup = "${account.chainId}:${account.account}: сохранённый Android posting-ключ удалён, автоапвоутер отключён до повторного сохранения корректного ключа"
                            store.appendLog(cleanup, "error")
                            messages += cleanup
                        }
                    }
                } catch (e: Exception) {
                    val msg = "${account.chainId}:${account.account}: ошибка автоапвоутера: ${e.message}"
                    errors += msg
                    store.setLastError(e.message)
                    store.appendLog(msg, "error")
                }
            }
        }

        val nextTick = System.currentTimeMillis() + store.intervalMinutes() * 60_000L
        store.setNextTick(nextTick)
        val ok = errors.isEmpty()
        val status = if (ok) "checked" else "checked_with_errors"
        store.appendLog("check finished; accounts=$accountsChecked; notifications=$notificationsShown; attempted=$autoUpvoterAttempted; errors=${errors.size}", if (ok) "info" else "error")
        return WorkerRunSummary(ok, status, accountsChecked, notificationChecks, notificationsShown, autoUpvoterChecks, autoUpvoterAttempted, autoUpvoterBroadcasted, skipped, errors, messages.takeLast(12), startedAt)
    }

    private fun collectAutoVoteEvents(chainId: String, settings: List<AccountSettings>): List<VoteEvent> {
        val spec = GrapheneChainSpecs.requireVote(chainId)
        return AutoVoteEventCollector(HttpGrapheneHistoryClient(spec.defaultRpcEndpoint, spec.legacyCallRpc, spec.historyApiName), HttpGrapheneDiscussionClient(spec.defaultRpcEndpoint, spec.legacyCallRpc, spec.discussionApiName)).collect(settings)
    }
}
