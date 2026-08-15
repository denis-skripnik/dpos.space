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

class DposForegroundService : Service() {
    private val handler = Handler(Looper.getMainLooper())
    private val tick = object : Runnable {
        override fun run() {
            if (!WorkerStore(this@DposForegroundService).workerEnabled()) return
            Thread {
                try {
                    DposWorkerRunner(applicationContext).runOnce(reason = "foreground-7m12s")
                } catch (e: Exception) {
                    WorkerStore(this@DposForegroundService).appendLog("foreground loop error: ${e.message}", "error")
                }
            }.start()
            handler.postDelayed(this, VIZ_SELF_AWARD_TICK_MS)
        }
    }

    override fun onCreate() {
        super.onCreate()
        isRunning = true
        WorkerStore(this).appendLog("foreground service created; apk=${BuildConfig.VERSION_NAME}(${BuildConfig.VERSION_CODE})")
        startForeground(42, NotificationHelper.foreground(this, "Работает. Проверки выполняются локально на устройстве. Авто-голосование отправляет операции только при включённом аккаунте, ключе и safety-gates."))
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
        startForeground(42, NotificationHelper.foreground(this, "Работает. Проверки выполняются локально на устройстве. Авто-голосование отправляет операции только при включённом аккаунте, ключе и safety-gates."))
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
        @Volatile var isRunning: Boolean = false
    }
}
