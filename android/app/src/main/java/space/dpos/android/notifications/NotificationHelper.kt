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

object NotificationHelper {
    const val CHANNEL_WORKER = "dpos_worker"
    const val CHANNEL_EVENTS = "dpos_events"
    const val EXTRA_ROUTE = "space.dpos.android.ROUTE"
    const val EVENT_SUMMARY_NOTIFICATION_ID = 730_001

    @Synchronized
    fun ensureChannels(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = context.getSystemService(NotificationManager::class.java)
        val workerChannel = NotificationChannel(CHANNEL_WORKER, "DPoS Space runtime", NotificationManager.IMPORTANCE_LOW).apply {
            description = "Silent ongoing notification while DPoS Space keeps Android worker checks active."
            setSound(null, null)
            enableVibration(false)
        }
        manager.createNotificationChannel(workerChannel)
        manager.createNotificationChannel(NotificationChannel(CHANNEL_EVENTS, "DPoS Space events", NotificationManager.IMPORTANCE_DEFAULT))
        if (migrateLegacyEventCards(context, manager) && canPost(context)) {
            postSummary(context, NotificationInbox(context).snapshot())
        }
    }

    /** Remove only old per-event cards. The worker channel and aggregate card are never touched. */
    internal fun migrateLegacyEventCards(context: Context, manager: NotificationManager): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return false
        val legacyCards = manager.activeNotifications
            .filter { it.id != EVENT_SUMMARY_NOTIFICATION_ID && it.notification.channelId == CHANNEL_EVENTS }
        legacyCards.forEach { legacy ->
                val title = legacy.notification.extras.getCharSequence(android.app.Notification.EXTRA_TITLE)?.toString()
                val text = (legacy.notification.extras.getCharSequence(NotificationCompat.EXTRA_BIG_TEXT)
                    ?: legacy.notification.extras.getCharSequence(android.app.Notification.EXTRA_TEXT))?.toString()
                NotificationInbox(context).add("legacy:${legacy.tag.orEmpty()}:${legacy.id}", title, text, "#app=notifications")
                manager.cancel(legacy.tag, legacy.id)
            }
        return legacyCards.isNotEmpty()
    }

    fun canPost(context: Context): Boolean = Build.VERSION.SDK_INT < 33 || ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED

    fun contentIntent(context: Context, route: String?): PendingIntent {
        val safeRoute = RoutePolicy.sanitizeRoute(route)
        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra(EXTRA_ROUTE, safeRoute)
        }
        return PendingIntent.getActivity(context, safeRoute.hashCode(), intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    }

    fun serviceIntent(context: Context, action: String, requestCode: Int): PendingIntent {
        val intent = Intent(context, DposForegroundService::class.java).setAction(action)
        return PendingIntent.getService(context, requestCode, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    }

    @Synchronized
    fun showEvent(context: Context, title: String?, body: String?, tag: String?, route: String?) {
        // Persist sanitized event state even when Android notification permission is denied.
        ensureChannels(context)
        val snapshot = NotificationInbox(context).add(tag, title, body, route) ?: return
        if (!canPost(context)) return
        postSummary(context, snapshot)
    }

    internal fun postSummary(context: Context, snapshot: NotificationInbox.Snapshot) {
        val latest = snapshot.events.lastOrNull { !it.read } ?: snapshot.events.lastOrNull() ?: return
        val count = snapshot.unreadCount
        if (count <= 0) {
            NotificationManagerCompat.from(context).cancel(EVENT_SUMMARY_NOTIFICATION_ID)
            return
        }
        val summaryTitle = if (count == 1) "DPoS Space: 1 непрочитанное событие" else "DPoS Space: $count непрочитанных событий"
        val latestText = listOf(latest.title, latest.text).filter { it.isNotBlank() }.joinToString(" — ")
        val notification = NotificationCompat.Builder(context, CHANNEL_EVENTS)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(summaryTitle)
            .setContentText(latestText)
            .setStyle(NotificationCompat.BigTextStyle().setBigContentTitle(summaryTitle).bigText(latestText))
            .setContentIntent(contentIntent(context, "#app=notifications"))
            .setNumber(count)
            .setOnlyAlertOnce(true)
            .setAutoCancel(true)
            .build()
        NotificationManagerCompat.from(context).notify(EVENT_SUMMARY_NOTIFICATION_ID, notification)
    }

    @Synchronized
    fun markAllRead(context: Context): NotificationInbox.Snapshot {
        val snapshot = NotificationInbox(context).markAllRead()
        NotificationManagerCompat.from(context).cancel(EVENT_SUMMARY_NOTIFICATION_ID)
        return snapshot
    }

    fun updateForeground(context: Context, notificationId: Int, status: String) {
        ensureChannels(context)
        context.getSystemService(NotificationManager::class.java)
            .notify(notificationId, foreground(context, status))
    }

    fun foreground(context: Context, status: String) = NotificationCompat.Builder(context, CHANNEL_WORKER)
        .setSmallIcon(R.mipmap.ic_launcher)
        .setContentTitle("DPoS Space worker")
        .setContentText(PayloadSanitizer.text(status, 120))
        .setStyle(NotificationCompat.BigTextStyle().bigText(PayloadSanitizer.text(status, 600)))
        .setOngoing(true)
        .setShowWhen(false)
        .setOnlyAlertOnce(true)
        .setDefaults(0)
        .setSound(null)
        .setVibrate(null)
        .setSilent(true)
        .setContentIntent(contentIntent(context, "#app=notifications"))
        .addAction(R.mipmap.ic_launcher, "Открыть", contentIntent(context, "#app=notifications"))
        .addAction(R.mipmap.ic_launcher, "Проверить", serviceIntent(context, DposForegroundService.ACTION_CHECK_NOW, 4202))
        .addAction(R.mipmap.ic_launcher, "Остановить", serviceIntent(context, DposForegroundService.ACTION_STOP, 4203))
        .build()
}
