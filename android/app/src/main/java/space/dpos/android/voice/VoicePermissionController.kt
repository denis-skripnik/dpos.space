package space.dpos.android.voice

import android.Manifest
import android.app.Activity
import android.content.pm.PackageManager

interface VoicePermissionHost {
    fun requestVoicePermission(callback: (Boolean) -> Unit)
    fun isVoiceForeground(): Boolean
}

/** Permission is requested only by voiceStart, with exactly one lifecycle-bound callback. */
class VoicePermissionController(private val activity: Activity, private val foreground: () -> Boolean) {
    private var pending: ((Boolean) -> Unit)? = null
    fun request(callback: (Boolean) -> Unit) {
        if (!foreground() || activity.isFinishing || activity.isDestroyed || pending != null) { callback(false); return }
        if (activity.checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
            callback(true); return
        }
        pending = callback
        try { activity.requestPermissions(arrayOf(Manifest.permission.RECORD_AUDIO), REQUEST) }
        catch (_: Exception) { cancel() }
    }
    fun result(requestCode: Int, permissions: Array<out String>, grants: IntArray): Boolean {
        if (requestCode != REQUEST) return false
        val callback = pending
        pending = null
        val index = permissions.indexOf(Manifest.permission.RECORD_AUDIO)
        callback?.invoke(foreground() && index >= 0 && grants.getOrNull(index) == PackageManager.PERMISSION_GRANTED &&
            activity.checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED)
        return true
    }
    fun cancel() { val callback = pending; pending = null; callback?.invoke(false) }
    companion object { const val REQUEST = 7310 }
}
