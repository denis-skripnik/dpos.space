package space.dpos.android.voice

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import space.dpos.android.ui.MainActivity

/** Only explicit foreground Start can create a recorder; never restored by boot or START_STICKY. */
class VoiceRecordingService : Service() {
    private val main = Handler(Looper.getMainLooper())
    private var owner = -1L
    private var wake: PowerManager.WakeLock? = null
    private var alive = false
    private val checkpoint = object : Runnable {
        override fun run() {
            if (!alive) return
            val ticket = owner
            VoiceSession.get(applicationContext).execute { checkpoint(ticket) }
            main.postDelayed(this, 5000)
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == STOP) {
            VoiceSession.get(applicationContext).execute { stop() }
            return START_NOT_STICKY
        }
        if (intent?.action != START || !intent.hasExtra("owner")) {
            if (!alive) stopSelf()
            return START_NOT_STICKY
        }
        if (alive && owner == intent.getLongExtra("owner", -1L)) return START_NOT_STICKY
        // A rapid explicit Delete/Start can reuse a service before Android delivers
        // its old destruction. Replace timers/lease, never discard the new owner.
        main.removeCallbacksAndMessages(null)
        wake?.let { if (it.isHeld) it.release() }
        owner = intent.getLongExtra("owner", -1L)
        val ticket = owner
        try {
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(NotificationChannel(CHANNEL, "Голосовая запись", NotificationManager.IMPORTANCE_LOW).apply {
                setSound(null, null); enableVibration(false); setShowBadge(false)
            })
            val open = PendingIntent.getActivity(this, 7300, Intent(this, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
            val stop = PendingIntent.getService(this, 7301, Intent(this, VoiceRecordingService::class.java).setAction(STOP), PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
            val notification = Notification.Builder(this, CHANNEL).setSmallIcon(android.R.drawable.ic_btn_speak_now)
                .setContentTitle("DPoS Space: голосовая запись")
                .setContentText("Микрофон включён. Остановите запись перед распознаванием.")
                .setContentIntent(open).setOngoing(true).setOnlyAlertOnce(true)
                .addAction(Notification.Action.Builder(null, "Остановить запись", stop).build()).build()
            if (Build.VERSION.SDK_INT >= 29) startForeground(ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE)
            else startForeground(ID, notification)
            alive = true
            wake = getSystemService(PowerManager::class.java).newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "dpos:voice-recording").apply {
                setReferenceCounted(false)
                // Recorder's size cap is finite; renew while its service remains live.
                acquire(60_000)
            }
            VoiceSession.get(applicationContext).execute {
                serviceStart(ticket) { started -> main.post {
                    if (owner == ticket) {
                        if (!started) stopSelf() else if (alive) main.post(checkpoint)
                    }
                } }
            }
            main.postDelayed(object : Runnable {
                override fun run() {
                    if (!alive) return
                    wake?.acquire(60_000)
                    main.postDelayed(this, 30_000)
                }
            }, 30_000)
        } catch (_: Exception) {
            VoiceSession.get(applicationContext).execute { serviceStartFailed(ticket) }
            stopSelf()
        }
        return START_NOT_STICKY
    }

    override fun onDestroy() {
        alive = false
        main.removeCallbacksAndMessages(null)
        wake?.let { if (it.isHeld) it.release() }
        wake = null
        val ticket = owner
        VoiceSession.get(applicationContext).execute { serviceDestroyed(ticket) }
        stopForeground(STOP_FOREGROUND_REMOVE)
        super.onDestroy()
    }
    override fun onBind(intent: Intent?): IBinder? = null

    companion object {
        internal const val START = "space.dpos.android.voice.START"
        internal const val STOP = "space.dpos.android.voice.STOP"
        private const val CHANNEL = "dpos_voice_recording"
        private const val ID = 7300
    }
}
