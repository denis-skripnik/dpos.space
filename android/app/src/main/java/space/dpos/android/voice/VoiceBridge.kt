package space.dpos.android.voice

import android.app.Activity
import org.json.JSONObject
import space.dpos.android.bridge.AndroidBridgeProtocol
import space.dpos.android.bridge.BridgeRequest
import java.util.concurrent.atomic.AtomicBoolean

/** Separate queue/secret namespace: no worker checkpoint, settings sync or page-side HTTP. */
internal class VoiceBridge(private val activity: Activity) {
    private val closed = AtomicBoolean(false)
    private val owner = Any()
    private val session get() = VoiceSession.get(activity.applicationContext)

    fun dispatch(request: BridgeRequest, respond: (JSONObject) -> Unit) {
        if (request.method == "voiceStart") {
            activity.runOnUiThread {
                if (closed.get()) { respond(failure(request, "cancelled")); return@runOnUiThread }
                val host = activity as? VoicePermissionHost
                if (host == null) { respond(failure(request, "recording_unavailable")); return@runOnUiThread }
                host.requestVoicePermission { granted ->
                    if (!granted || closed.get()) respond(failure(request, "microphone_permission"))
                    else invoke(request, respond)
                }
            }
        } else invoke(request, respond)
    }
    private fun invoke(request: BridgeRequest, respond: (JSONObject) -> Unit) {
        session.execute {
            val response = try {
                if (closed.get()) throw VoiceFailure("cancelled")
                if (request.method == "voiceCheckConnection") {
                    checkConnection(owner) { result -> respond(AndroidBridgeProtocol.success(request.id, result.toString())) }
                    return@execute
                }
                val result = when (request.method) {
                    "voiceStatus" -> status()
                    "voiceSaveSettings" -> saveSettings(request.payload)
                    "voiceDeleteKey" -> deleteKey()

                    "voiceStart" -> {
                        if ((activity as? VoicePermissionHost)?.isVoiceForeground() != true) throw VoiceFailure("cancelled")
                        requestStart()
                    }
                    "voicePause" -> pause()
                    "voiceResume" -> resume()
                    "voiceStop" -> stop()
                    "voiceDelete" -> delete()
                    "voiceRecognize" -> recognize(request.payload.optString("mode", "formatted"), owner)
                    else -> throw VoiceFailure("unsupported_method")
                }
                AndroidBridgeProtocol.success(request.id, result.toString())
            } catch (e: Exception) { failure(request, VoiceSession.safeError(e)) }
            respond(response)
        }
    }
    fun close() {
        closed.set(true)
        session.execute { closeOwner(owner) }
    }
    private fun failure(request: BridgeRequest, code: String) = AndroidBridgeProtocol.failure(request.id, code, code)
    companion object {
        val METHODS = setOf("voiceStatus", "voiceSaveSettings", "voiceDeleteKey", "voiceCheckConnection", "voiceStart", "voicePause", "voiceResume", "voiceStop", "voiceDelete", "voiceRecognize")
    }
}
