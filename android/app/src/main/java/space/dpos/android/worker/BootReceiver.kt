package space.dpos.android.worker

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.content.ContextCompat
import space.dpos.android.storage.WorkerStore

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        if (intent?.action != Intent.ACTION_BOOT_COMPLETED) return
        if (!WorkerStore(context).workerEnabled()) return
        val serviceIntent = Intent(context, DposForegroundService::class.java)
        if (Build.VERSION.SDK_INT >= 26) ContextCompat.startForegroundService(context, serviceIntent) else context.startService(serviceIntent)
    }
}
