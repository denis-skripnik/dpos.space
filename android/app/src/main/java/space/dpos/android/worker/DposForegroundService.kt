package space.dpos.android.worker

import android.app.Service
import android.content.Intent
import android.os.IBinder
import space.dpos.android.notifications.NotificationHelper
import space.dpos.android.storage.WorkerStore

class DposForegroundService : Service() {
    override fun onCreate() {
        super.onCreate()
        isRunning = true
        WorkerStore(this).appendLog("foreground service started")
        startForeground(42, NotificationHelper.foreground(this, "Работает. Проверки выполняются локально на устройстве."))
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            stopSelf()
            return START_NOT_STICKY
        }
        return START_STICKY
    }

    override fun onDestroy() {
        WorkerStore(this).appendLog("foreground service stopped")
        isRunning = false
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    companion object {
        const val ACTION_STOP = "space.dpos.android.STOP_WORKER"
        @Volatile var isRunning: Boolean = false
    }
}
