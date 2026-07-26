package space.dpos.android.worker

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import space.dpos.android.notifications.GolosNotificationScanner
import space.dpos.android.notifications.HttpGolosHistoryClient
import space.dpos.android.notifications.NotificationHelper
import space.dpos.android.storage.EncryptedKeyRef
import space.dpos.android.storage.NotificationCursor
import space.dpos.android.storage.WorkerStore
import space.dpos.android.upvoter.AccountSettings
import space.dpos.android.upvoter.AutoUpvoterPlanner
import space.dpos.android.upvoter.AutoVoteEventCollector
import space.dpos.android.upvoter.AutoVoteRuntime
import space.dpos.android.upvoter.GolosBroadcastClient
import space.dpos.android.upvoter.HttpGolosDiscussionClient
import space.dpos.android.upvoter.HttpGolosRpcClient
import space.dpos.android.upvoter.PostingKeyProvider
import space.dpos.android.upvoter.VoteEvent
import space.dpos.android.upvoter.VoteRuntime

class DposPeriodicWorker(appContext: Context, params: WorkerParameters) : CoroutineWorker(appContext, params) {
    override suspend fun doWork(): Result {
        val store = WorkerStore(applicationContext)
        store.setLastTick(System.currentTimeMillis())
        store.appendLog("periodic check tick")
        var hadError = false
        for (account in store.activeAccounts()) {
            if (account.chainId == "golos" && store.notificationEnabled(account.chainId, account.account)) {
                try {
                    val cursor = store.readCursor(account.chainId, account.account)
                    val (nextCursor, notifications) = GolosNotificationScanner(HttpGolosHistoryClient()).fetchAndScan(account.account, cursor.lastIndex.takeIf { it >= 0 }, cursor.baselineDone)
                    store.saveCursor(NotificationCursor(account.chainId, account.account, nextCursor, true))
                    notifications.forEach { event -> NotificationHelper.showEvent(applicationContext, event.title, event.text, event.id, event.route) }
                    store.appendLog("golos notifications checked for ${account.account}; new=${notifications.size}; cursor=$nextCursor")
                } catch (e: Exception) {
                    hadError = true
                    store.setLastError(e.message)
                    store.appendLog("golos notifications error for ${account.account}: ${e.message}", "error")
                }
            }
            if (account.chainId == "golos" && store.autoUpvoterEnabled(account.chainId, account.account)) {
                try {
                    val keyRef = store.defaultPostingKeyRef(account.chainId, account.account)
                    val key = store.readPostingKey(account.chainId, account.account)
                    if (key.isNullOrBlank()) {
                        store.appendLog("auto-upvoter ${account.chainId}:${account.account} skipped: missing posting key")
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
                    val plan = AutoUpvoterPlanner().plan(
                        listOf(settings),
                        collectAutoVoteEvents(listOf(settings))
                    )
                    if (plan.actions.isEmpty()) {
                        store.appendLog("auto-upvoter ${account.chainId}:${account.account}: no eligible vote actions; skips=${plan.skips.size}")
                        continue
                    }
                    val rpc = HttpGolosRpcClient()
                    val runtime = AutoVoteRuntime(VoteRuntime(rpc, broadcaster = GolosBroadcastClient(rpc)), object : PostingKeyProvider {
                        override fun keyRef(chainId: String, account: String): EncryptedKeyRef = keyRef
                        override fun privateWif(chainId: String, account: String): String? = key
                    })
                    val report = runtime.execute(plan)
                    store.appendLog("auto-upvoter ${account.chainId}:${account.account}: attempted=${report.attempted}; broadcasted=${report.broadcasted}; skipped=${report.skipped.size}")
                    if (report.results.any { !it.ok }) hadError = true
                } catch (e: Exception) {
                    hadError = true
                    store.setLastError(e.message)
                    store.appendLog("golos auto-upvoter error for ${account.account}: ${e.message}", "error")
                }
            }
        }
        store.setNextTick(System.currentTimeMillis() + store.intervalMinutes() * 60_000L)
        return if (hadError) Result.retry() else Result.success()
    }

    private fun collectAutoVoteEvents(settings: List<AccountSettings>): List<VoteEvent> {
        return AutoVoteEventCollector(HttpGolosHistoryClient(), HttpGolosDiscussionClient()).collect(settings)
    }

    companion object {
        const val UNIQUE_WORK = "dpos-periodic-worker"
    }
}
