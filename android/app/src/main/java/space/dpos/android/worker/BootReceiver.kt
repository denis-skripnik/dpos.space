package space.dpos.android.worker

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Handler
import android.os.Looper
import androidx.core.content.ContextCompat
import space.dpos.android.storage.NativeStorageQueue
import space.dpos.android.storage.WorkerStore
import java.util.concurrent.atomic.AtomicBoolean

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        if (intent?.action != Intent.ACTION_BOOT_COMPLETED) return
        val pending = goAsync()
        val finished = AtomicBoolean(false)
        val handler = Handler(Looper.getMainLooper())
        val admission = WorkerCancellation.token { !finished.get() }
        fun finish() { if (finished.compareAndSet(false, true)) pending?.finish() }
        // A contended checkpoint must not merely move the ANR to a held broadcast.
        // Expiry relinquishes the receiver and fences late service admission.
        val timeout = Runnable { finish() }
        handler.postDelayed(timeout, 8_000L)
        NativeStorageQueue.execute {
            try {
                if (!admission.mayContinue()) return@execute
                val store = WorkerStore(context)
                if (!store.workerEnabled() || store.checkpointStatus().optString("authority") != "verified" ||
                    !admission.mayContinue()) return@execute
                val serviceIntent = Intent(context, DposForegroundService::class.java)
                if (Build.VERSION.SDK_INT >= 26) ContextCompat.startForegroundService(context, serviceIntent)
                else context.startService(serviceIntent)
            } finally {
                finish()
                handler.removeCallbacks(timeout)
            }
        }
    }
}
