package space.dpos.android.notifications

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import space.dpos.android.R
import space.dpos.android.core.PayloadSanitizer
import space.dpos.android.core.RoutePolicy
import space.dpos.android.ui.MainActivity
import space.dpos.android.worker.DposForegroundService
import space.dpos.android.worker.DposPeriodicWorker

object NotificationHelper {
    const val CHANNEL_WORKER = "dpos_worker"
    const val CHANNEL_EVENTS = "dpos_events"
    const val EXTRA_ROUTE = "space.dpos.android.ROUTE"

    fun ensureChannels(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = context.getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(NotificationChannel(CHANNEL_WORKER, "DPoS Space runtime", NotificationManager.IMPORTANCE_LOW))
        manager.createNotificationChannel(NotificationChannel(CHANNEL_EVENTS, "DPoS Space events", NotificationManager.IMPORTANCE_DEFAULT))
    }

    fun canPost(context: Context): Boolean = Build.VERSION.SDK_INT < 33 || ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED

    fun contentIntent(context: Context, route: String?): PendingIntent {
        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra(EXTRA_ROUTE, RoutePolicy.sanitizeRoute(route))
        }
        return PendingIntent.getActivity(context, RoutePolicy.sanitizeRoute(route).hashCode(), intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    }

    fun serviceIntent(context: Context, action: String, requestCode: Int): PendingIntent {
        val intent = Intent(context, DposForegroundService::class.java).setAction(action)
        return PendingIntent.getService(context, requestCode, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    }

    fun showEvent(context: Context, title: String?, body: String?, tag: String?, route: String?) {
        ensureChannels(context)
        if (!canPost(context)) return
        val safeTitle = PayloadSanitizer.text(title, 80).ifBlank { "DPoS Space" }
        val notification = NotificationCompat.Builder(context, CHANNEL_EVENTS)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(safeTitle)
            .setContentText(PayloadSanitizer.text(body, 180))
            .setStyle(NotificationCompat.BigTextStyle().bigText(PayloadSanitizer.text(body, 600)))
            .setContentIntent(contentIntent(context, route))
            .setAutoCancel(true)
            .build()
        NotificationManagerCompat.from(context).notify(PayloadSanitizer.tag(tag).hashCode(), notification)
    }

    fun foreground(context: Context, status: String) = NotificationCompat.Builder(context, CHANNEL_WORKER)
        .setSmallIcon(R.mipmap.ic_launcher)
        .setContentTitle("DPoS Space worker")
        .setContentText(PayloadSanitizer.text(status, 120))
        .setStyle(NotificationCompat.BigTextStyle().bigText(PayloadSanitizer.text(status, 600)))
        .setOngoing(true)
        .setContentIntent(contentIntent(context, "#app=notifications"))
        .addAction(R.mipmap.ic_launcher, "Открыть", contentIntent(context, "#app=notifications"))
        .addAction(R.mipmap.ic_launcher, "Проверить", serviceIntent(context, DposForegroundService.ACTION_CHECK_NOW, 4202))
        .addAction(R.mipmap.ic_launcher, "Остановить", serviceIntent(context, DposForegroundService.ACTION_STOP, 4203))
        .build()
}
