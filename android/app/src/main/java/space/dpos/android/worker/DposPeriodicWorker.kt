package space.dpos.android.worker

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import space.dpos.android.notifications.GolosNotificationScanner
import space.dpos.android.notifications.HttpGolosHistoryClient
import space.dpos.android.notifications.NotificationHelper
import space.dpos.android.storage.NotificationCursor
import space.dpos.android.storage.WorkerStore
import space.dpos.android.upvoter.DryRunVoteLog
import space.dpos.android.upvoter.VotePlan

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
                val dryRun = DryRunVoteLog.render(VotePlan(emptyList(), listOf("dry-run: native event collection not enabled without live signing approval")))
                store.appendLog("auto-upvoter ${account.chainId}:${account.account}\n$dryRun")
            }
        }
        store.setNextTick(System.currentTimeMillis() + store.intervalMinutes() * 60_000L)
        return if (hadError) Result.retry() else Result.success()
    }

    companion object {
        const val UNIQUE_WORK = "dpos-periodic-worker"
    }
}
