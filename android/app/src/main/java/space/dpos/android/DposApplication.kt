package space.dpos.android

import android.app.Application
import android.content.Intent
import android.os.Build
import android.os.SystemClock
import androidx.core.content.ContextCompat
import space.dpos.android.notifications.NotificationHelper
import space.dpos.android.storage.WorkerStore
import space.dpos.android.worker.DposForegroundService

class DposApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        NotificationHelper.ensureChannels(this)
        prepareVersionLog()
    }

    private fun prepareVersionLog() {
        val store = WorkerStore(this)
        val version = "${BuildConfig.VERSION_NAME}(${BuildConfig.VERSION_CODE})"
        if (store.markAppVersion(version)) {
            store.clearLogs()
            store.appendLog("apk updated; fresh worker log started; apk=$version")
        }
    }

    companion object {
        private val workerLifecycleStarter = WorkerLifecycleStarter()

        internal fun resumeEnabledWorker(context: android.content.Context, source: String) {
            workerLifecycleStarter.resume(context, source)
        }
    }
}

internal class WorkerLifecycleStarter(
    private val elapsedRealtime: () -> Long = SystemClock::elapsedRealtime,
    private val serviceRunning: () -> Boolean = { DposForegroundService.isRunning },
    private val serviceStarter: (android.content.Context, Intent) -> Unit = { context, intent ->
        if (Build.VERSION.SDK_INT >= 26) ContextCompat.startForegroundService(context, intent)
        else context.startService(intent)
    }
) {
    private var lastStartRequestAt = Long.MIN_VALUE

    fun resume(context: android.content.Context, source: String): Boolean {
        val store = WorkerStore(context)
        val hasEnabledFeature = store.activeAccounts().any { account ->
            store.notificationEnabled(account.chainId, account.account) ||
                store.autoUpvoterEnabled(account.chainId, account.account) ||
                store.vizSelfAwardEnabled(account.chainId, account.account)
        }
        if (!store.workerEnabled() || !hasEnabledFeature || serviceRunning()) return false

        val now = elapsedRealtime()
        if (lastStartRequestAt != Long.MIN_VALUE && now - lastStartRequestAt < START_REQUEST_DEBOUNCE_MS) return false
        lastStartRequestAt = now
        val previouslyEnabled = store.workerEnabled()
        store.setWorkerEnabled(true)
        store.appendLog("$source worker resume requested; apk=${BuildConfig.VERSION_NAME}(${BuildConfig.VERSION_CODE})")
        return try {
            serviceStarter(
                context,
                Intent(context, DposForegroundService::class.java).setAction(DposForegroundService.ACTION_START)
            )
            true
        } catch (error: Exception) {
            lastStartRequestAt = Long.MIN_VALUE
            store.setWorkerEnabled(previouslyEnabled)
            store.appendLog("worker resume failed; ${error.javaClass.simpleName}: ${error.message}", "error")
            false
        }
    }

    private companion object {
        const val START_REQUEST_DEBOUNCE_MS = 10_000L
    }
}
