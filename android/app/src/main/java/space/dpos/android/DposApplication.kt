package space.dpos.android

import android.app.Application
import android.content.Intent
import android.os.Build
import androidx.core.content.ContextCompat
import space.dpos.android.notifications.NotificationHelper
import space.dpos.android.storage.WorkerStore
import space.dpos.android.worker.DposForegroundService

class DposApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        NotificationHelper.ensureChannels(this)
        autoStartWorkerIfEnabled()
    }

    private fun autoStartWorkerIfEnabled() {
        val store = WorkerStore(this)
        if (!store.hasAutoStartAccounts()) return
        store.setWorkerEnabled(true)
        store.appendLog("application open auto-start requested")
        val intent = Intent(this, DposForegroundService::class.java).setAction(DposForegroundService.ACTION_START)
        if (Build.VERSION.SDK_INT >= 26) ContextCompat.startForegroundService(this, intent) else startService(intent)
    }
}
