package space.dpos.android.worker

import android.app.Service
import android.content.Intent
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.SystemClock
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import space.dpos.android.BuildConfig
import space.dpos.android.notifications.NotificationHelper
import space.dpos.android.storage.WorkerStore
import space.dpos.android.upvoter.VIZ_SELF_AWARD_TICK_MS
import java.util.concurrent.atomic.AtomicBoolean

internal fun foregroundCompletionStatus(summary: WorkerRunSummary): String {
    val counters = "; аккаунтов: ${summary.accountsChecked}; vote сейчас: ${summary.autoUpvoterBroadcasted}; всего vote: ${summary.totalAutoUpvoterBroadcasted}; VIZ сейчас: ${summary.vizSelfAwardBroadcasted}; всего VIZ: ${summary.totalVizSelfAwardBroadcasted}; ошибок: ${summary.errors.size}"
    return when {
        !summary.ok && summary.errors.isNotEmpty() && summary.errors.all { it.contains("broadcast_unknown") } &&
            (summary.autoUpvoterSkipSummary["broadcast_unknown"] ?: 0) > 0 -> "проверка завершена; голосование приостановлено до подтверждения прежней отправки$counters"
        !summary.ok -> "проверка завершена с ошибками$counters"
        summary.status == "pending_confirmation" -> "Подтверждается"
        else -> "проверка завершена$counters"
    }
}

internal fun foregroundFullTickDue(lastFullTickAt: Long, nowElapsed: Long): Boolean =
    lastFullTickAt < 0 || nowElapsed - lastFullTickAt >= VIZ_SELF_AWARD_TICK_MS

class DposForegroundService : Service() {
    private val handler = Handler(Looper.getMainLooper())
    private val tickRunning = AtomicBoolean(false)
    private val destroyed = AtomicBoolean(false)
    private var lastFullTickAt = -1L
    private fun storageVerified(store: WorkerStore): Boolean = store.checkpointStatus().optString("authority") == "verified"
    private fun pauseUnverifiedStorage(store: WorkerStore) {
        WorkerCancellation.cancelAll()
        handler.removeCallbacks(tick)
        WorkManager.getInstance(applicationContext).cancelUniqueWork(DposPeriodicWorker.UNIQUE_WORK)
        store.appendLog("foreground service storage unverified; sends blocked", "warning")
        updateForegroundStatus("хранилище не подтверждено; отправки заблокированы")
        stopSelf()
    }
    private fun nextDelay(store: WorkerStore): Long = if (store.activeAccounts().any {
        it.chainId == "golos" && store.autoUpvoterEnabled("golos", it.account)
    }) 30_000L else VIZ_SELF_AWARD_TICK_MS
    private fun workerStatusText(status: String): String = "DPoS Space: ${space.dpos.android.core.PayloadSanitizer.text(status, 520)}"
    private fun updateForegroundStatus(status: String) {
        if (!destroyed.get()) NotificationHelper.updateForeground(this, NOTIFICATION_ID, workerStatusText(status))
    }
    private val tick = object : Runnable {
        override fun run() {
            val store = WorkerStore(this@DposForegroundService)
            if (destroyed.get() || !store.workerEnabled()) return
            if (!storageVerified(store)) {
                pauseUnverifiedStorage(store)
                return
            }
            updateForegroundStatus("ждёт проверки; аккаунтов: ${store.activeAccounts().size}; Голос до 30 секунд после завершения, VIZ 7 минут 12 секунд")
            if (!tickRunning.compareAndSet(false, true)) {
                store.appendLog("foreground tick skipped; previous tick still running", "warning")
                updateForegroundStatus("предыдущая проверка ещё идёт; следующий тик запланирован")
                handler.postDelayed(this, nextDelay(store))
                return
            }
            Thread {
                try {
                    updateForegroundStatus("проверка запущена; аккаунтов: ${store.activeAccounts().size}")
                    val now = SystemClock.elapsedRealtime()
                    val full = foregroundFullTickDue(lastFullTickAt, now)
                    val summary = DposWorkerRunner(applicationContext) { updateForegroundStatus(it) }
                        .runOnce(reason = if (full) "foreground-7m12s" else "foreground-golos")
                    if (full && summary.status != "skipped_overlap") lastFullTickAt = now
                    if (summary.status == "skipped_overlap") {
                        updateForegroundStatus("предыдущая проверка ещё идёт; последний успешный статус сохраняется")
                    } else {
                        updateForegroundStatus(foregroundCompletionStatus(summary))
                    }
                } catch (e: Exception) {
                    WorkerStore(this@DposForegroundService).appendLog("foreground loop error: ${e.message}", "error")
                    updateForegroundStatus("ошибка проверки: ${e.message ?: "unknown"}")
                } finally {
                    tickRunning.set(false)
                    handler.post {
                        if (!destroyed.get() && store.workerEnabled()) {
                            if (storageVerified(store)) handler.postDelayed(this, nextDelay(store))
                            else pauseUnverifiedStorage(store)
                        }
                    }
                }
            }.start()

        }
    }

    override fun onCreate() {
        super.onCreate()
        isRunning = true
        val initialStatus = workerStatusText("запущен; проверки идут локально на устройстве; для стабильной работы включите режим батареи без ограничений")
        startForeground(NOTIFICATION_ID, NotificationHelper.foreground(this, initialStatus))
        WorkerStore(this).appendLog("foreground service created; apk=${BuildConfig.VERSION_NAME}(${BuildConfig.VERSION_CODE})")
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val store = WorkerStore(this)
        when (intent?.action) {
            ACTION_STOP -> {
                WorkerCancellation.cancelAll()
                // Verified bootstrap still persists Stop during physical recovery backoff;
                // unverified bootstrap cannot flush poisoned legacy prefs, but must stop.
                runCatching { store.setWorkerEnabled(false) }.onFailure {
                    store.appendLog("foreground stop persistence unavailable; cancellation applied", "warning")
                }
                WorkManager.getInstance(applicationContext).cancelUniqueWork(DposPeriodicWorker.UNIQUE_WORK)
                store.appendLog("foreground service stop requested")
                handler.removeCallbacks(tick)
                stopSelf()
                return START_NOT_STICKY
            }
            ACTION_CHECK_NOW -> {
                if (!storageVerified(store)) {
                    pauseUnverifiedStorage(store)
                    return START_NOT_STICKY
                }
                store.appendLog("foreground notification check-now requested")
                WorkManager.getInstance(applicationContext).enqueue(OneTimeWorkRequestBuilder<DposPeriodicWorker>().build())
            }
            else -> {
                if (!storageVerified(store)) {
                    pauseUnverifiedStorage(store)
                    return START_NOT_STICKY
                }
                store.setWorkerEnabled(true)
                store.appendLog("foreground service started; apk=${BuildConfig.VERSION_NAME}(${BuildConfig.VERSION_CODE})")
                handler.removeCallbacks(tick)
                handler.post(tick)
            }
        }
        updateForegroundStatus("работает; следующий тик будет автоматически; для стабильной работы включите режим батареи без ограничений")
        return START_STICKY
    }

    override fun onDestroy() {
        destroyed.set(true)
        WorkerCancellation.cancelAll()
        handler.removeCallbacks(tick)
        WorkerStore(this).appendLog("foreground service stopped")
        isRunning = false
        stopForeground(STOP_FOREGROUND_REMOVE)
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    companion object {
        const val ACTION_START = "space.dpos.android.START_WORKER"
        const val ACTION_STOP = "space.dpos.android.STOP_WORKER"
        const val ACTION_CHECK_NOW = "space.dpos.android.CHECK_NOW"
        const val NOTIFICATION_ID = 42
        @Volatile var isRunning: Boolean = false
    }
}
