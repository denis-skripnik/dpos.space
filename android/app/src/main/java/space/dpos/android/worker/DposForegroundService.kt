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
import space.dpos.android.storage.NativeStorageQueue
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
    private val stopping = AtomicBoolean(false)
    private var lastFullTickAt = -1L
    private fun live() = !destroyed.get() && !stopping.get()
    private fun storageVerified(store: WorkerStore): Boolean = store.checkpointStatus().optString("authority") == "verified"
    private fun pauseUnverifiedStorage(store: WorkerStore) {
        WorkerCancellation.cancelAll()
        WorkManager.getInstance(applicationContext).cancelUniqueWork(DposPeriodicWorker.UNIQUE_WORK)
        store.appendLog("foreground service storage unverified; sends blocked", "warning")
        handler.post {
            if (live()) {
                stopping.set(true)
                handler.removeCallbacks(tick)
                updateForegroundStatus("хранилище не подтверждено; отправки заблокированы")
                stopSelf()
            }
        }
    }
    private fun nextDelay(store: WorkerStore): Long = if (store.activeAccounts().any {
        it.chainId == "golos" && store.autoUpvoterEnabled("golos", it.account)
    }) 30_000L else VIZ_SELF_AWARD_TICK_MS
    private fun workerStatusText(status: String): String = "DPoS Space: ${space.dpos.android.core.PayloadSanitizer.text(status, 520)}"
    private fun updateForegroundStatus(status: String) {
        handler.post {
            if (!destroyed.get()) NotificationHelper.updateForeground(this, NOTIFICATION_ID, workerStatusText(status))
        }
    }
    private val tick = object : Runnable {
        override fun run() {
            // Admission is memory-only. The owner schedules the next tick after all children drain.
            if (!live() || !tickRunning.compareAndSet(false, true)) return
            val admission = WorkerCancellation.token { live() }
            Thread({
                try {
                    val store = WorkerStore(this@DposForegroundService)
                    if (!admission.mayContinue() || !store.workerEnabled()) return@Thread
                    if (!storageVerified(store)) {
                        pauseUnverifiedStorage(store)
                        return@Thread
                    }
                    updateForegroundStatus("проверка запущена; аккаунтов: ${store.activeAccounts().size}")
                    val now = SystemClock.elapsedRealtime()
                    val full = foregroundFullTickDue(lastFullTickAt, now)
                    val summary = DposWorkerRunner(applicationContext, store = store, statusSink = { updateForegroundStatus(it) })
                        .runOnce(reason = if (full) "foreground-7m12s" else "foreground-golos", admission = admission)
                    if (full && summary.status != "skipped_overlap") lastFullTickAt = now
                    if (summary.status == "skipped_overlap") {
                        updateForegroundStatus("предыдущая проверка ещё идёт; последний успешный статус сохраняется")
                    } else {
                        updateForegroundStatus(foregroundCompletionStatus(summary))
                    }
                } catch (error: Exception) {
                    WorkerStore(this@DposForegroundService).appendLog("foreground loop error: ${error.message}", "error")
                    updateForegroundStatus("ошибка проверки: ${error.message ?: "unknown"}")
                } finally {
                    // DposWorkerRunner retains its global guard until children actually terminate.
                    tickRunning.set(false)
                    // Completion's verified reads and scheduling policy also stay off main,
                    // including the exception path. A stopped owner cannot reschedule.
                    // Future timer admission belongs to this live service, not the old
                    // run's generation: a feature revoke must not strand other features.
                    // The next tick obtains a fresh token and revalidates storage/settings.
                    if (live()) {
                        val store = WorkerStore(this@DposForegroundService)
                        if (store.workerEnabled()) {
                            if (storageVerified(store)) {
                                val delay = nextDelay(store)
                                handler.post {
                                    if (live()) handler.postDelayed(this, delay)
                                }
                            } else pauseUnverifiedStorage(store)
                        }
                    }
                }
            }, "dpos-foreground-tick").start()
        }
    }

    override fun onCreate() {
        super.onCreate()
        isRunning = true
        NotificationHelper.ensureWorkerChannel(this)
        val initialStatus = workerStatusText("запущен; проверки идут локально на устройстве; для стабильной работы включите режим батареи без ограничений")
        startForeground(NOTIFICATION_ID, NotificationHelper.foreground(this, initialStatus))
        NativeStorageQueue.execute {
            WorkerStore(this@DposForegroundService).appendLog("foreground service created; apk=${BuildConfig.VERSION_NAME}(${BuildConfig.VERSION_CODE})")
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            stopping.set(true)
            val persisted = WorkerCancellation.beginRevocation()
            handler.removeCallbacks(tick)
            stopSelf()
            NativeStorageQueue.execute {
                val store = WorkerStore(this@DposForegroundService)
                runCatching { store.setWorkerEnabled(false); persisted() }.onFailure {
                    store.appendLog("foreground stop persistence unavailable; cancellation applied", "warning")
                }
                WorkManager.getInstance(applicationContext).cancelUniqueWork(DposPeriodicWorker.UNIQUE_WORK)
                store.appendLog("foreground service stop requested")
            }
            return START_NOT_STICKY
        }
        val admission = WorkerCancellation.token { live() }
        val action = intent?.action
        NativeStorageQueue.execute {
            if (!admission.mayContinue()) return@execute
            val store = WorkerStore(this@DposForegroundService)
            if (!storageVerified(store)) {
                pauseUnverifiedStorage(store)
                return@execute
            }
            if (!admission.mayContinue()) return@execute
            if (action == ACTION_CHECK_NOW) {
                store.appendLog("foreground notification check-now requested")
                if (admission.mayContinue()) WorkManager.getInstance(applicationContext)
                    .enqueue(OneTimeWorkRequestBuilder<DposPeriodicWorker>().build())
            } else {
                store.setWorkerEnabled(true)
                store.appendLog("foreground service started; apk=${BuildConfig.VERSION_NAME}(${BuildConfig.VERSION_CODE})")
                handler.post {
                    if (admission.mayContinue()) {
                        handler.removeCallbacks(tick)
                        handler.post(tick)
                    }
                }
            }
        }
        updateForegroundStatus("работает; следующий тик будет автоматически; для стабильной работы включите режим батареи без ограничений")
        return START_STICKY
    }

    override fun onDestroy() {
        destroyed.set(true)
        WorkerCancellation.cancelAll()
        handler.removeCallbacks(tick)
        NativeStorageQueue.execute { WorkerStore(this@DposForegroundService).appendLog("foreground service stopped") }
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
