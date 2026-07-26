package space.dpos.android.worker

import android.app.Service
import android.content.Intent
import android.os.IBinder
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import space.dpos.android.notifications.NotificationHelper
import space.dpos.android.storage.WorkerStore

class DposForegroundService : Service() {
    override fun onCreate() {
        super.onCreate()
        isRunning = true
        WorkerStore(this).appendLog("foreground service created")
        startForeground(42, NotificationHelper.foreground(this, "Работает. Проверки выполняются локально на устройстве. Авто-голосование отправляет операции только при включённом аккаунте, ключе и safety-gates."))
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val store = WorkerStore(this)
        when (intent?.action) {
            ACTION_STOP -> {
                store.setWorkerEnabled(false)
                store.appendLog("foreground service stop requested")
                stopSelf()
                return START_NOT_STICKY
            }
            ACTION_CHECK_NOW -> {
                store.appendLog("foreground notification check-now requested")
                WorkManager.getInstance(applicationContext).enqueue(OneTimeWorkRequestBuilder<DposPeriodicWorker>().build())
            }
            else -> {
                store.setWorkerEnabled(true)
                store.appendLog("foreground service started")
            }
        }
        startForeground(42, NotificationHelper.foreground(this, "Работает. Проверки выполняются локально на устройстве. Авто-голосование отправляет операции только при включённом аккаунте, ключе и safety-gates."))
        return START_STICKY
    }

    override fun onDestroy() {
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
