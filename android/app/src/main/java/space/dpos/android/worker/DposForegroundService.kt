package space.dpos.android.worker

import android.app.Service
import android.content.Intent
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import space.dpos.android.BuildConfig
import space.dpos.android.notifications.NotificationHelper
import space.dpos.android.storage.WorkerStore
import space.dpos.android.upvoter.VIZ_SELF_AWARD_TICK_MS
import java.util.concurrent.atomic.AtomicBoolean

class DposForegroundService : Service() {
    private val handler = Handler(Looper.getMainLooper())
    private val tickRunning = AtomicBoolean(false)
    private fun workerStatusText(status: String): String = "DPoS Space: ${space.dpos.android.core.PayloadSanitizer.text(status, 520)}"
    private fun updateForegroundStatus(status: String) {
        NotificationHelper.updateForeground(this, NOTIFICATION_ID, workerStatusText(status))
    }
    private val tick = object : Runnable {
        override fun run() {
            val store = WorkerStore(this@DposForegroundService)
            if (!store.workerEnabled()) return
            updateForegroundStatus("ждёт проверки; аккаунтов: ${store.activeAccounts().size}; интервал 7 минут 12 секунд")
            if (!tickRunning.compareAndSet(false, true)) {
                store.appendLog("foreground tick skipped; previous tick still running", "warning")
                updateForegroundStatus("предыдущая проверка ещё идёт; следующий тик запланирован")
                handler.postDelayed(this, VIZ_SELF_AWARD_TICK_MS)
                return
            }
            Thread {
                try {
                    updateForegroundStatus("проверка запущена; аккаунтов: ${store.activeAccounts().size}")
                    val summary = DposWorkerRunner(applicationContext) { updateForegroundStatus(it) }.runOnce(reason = "foreground-7m12s")
                    val status = if (summary.ok) "проверка завершена" else "проверка завершена с ошибками"
                    updateForegroundStatus("$status; аккаунтов: ${summary.accountsChecked}; голосов: ${summary.autoUpvoterBroadcasted}; VIZ self-awards: ${summary.vizSelfAwardBroadcasted}; ошибок: ${summary.errors.size}")
                } catch (e: Exception) {
                    WorkerStore(this@DposForegroundService).appendLog("foreground loop error: ${e.message}", "error")
                    updateForegroundStatus("ошибка проверки: ${e.message ?: "unknown"}")
                } finally {
                    tickRunning.set(false)
                }
            }.start()
            handler.postDelayed(this, VIZ_SELF_AWARD_TICK_MS)
        }
    }

    override fun onCreate() {
        super.onCreate()
        isRunning = true
        WorkerStore(this).appendLog("foreground service created; apk=${BuildConfig.VERSION_NAME}(${BuildConfig.VERSION_CODE})")
        val initialStatus = workerStatusText("запущен; проверки идут локально на устройстве; для стабильной работы включите режим батареи без ограничений")
        startForeground(NOTIFICATION_ID, NotificationHelper.foreground(this, initialStatus))
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val store = WorkerStore(this)
        when (intent?.action) {
            ACTION_STOP -> {
                store.setWorkerEnabled(false)
                store.appendLog("foreground service stop requested")
                handler.removeCallbacks(tick)
                stopSelf()
                return START_NOT_STICKY
            }
            ACTION_CHECK_NOW -> {
                store.appendLog("foreground notification check-now requested")
                WorkManager.getInstance(applicationContext).enqueue(OneTimeWorkRequestBuilder<DposPeriodicWorker>().build())
            }
            else -> {
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
        handler.removeCallbacks(tick)
        WorkerStore(this).appendLog("foreground service stopped")
        isRunning = false
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
