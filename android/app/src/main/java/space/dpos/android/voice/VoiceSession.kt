package space.dpos.android.voice

import android.content.Context
import android.content.Intent

import android.media.MediaRecorder
import android.os.SystemClock
import android.util.AtomicFile
import androidx.core.content.ContextCompat
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import org.json.JSONObject
import java.io.File
import java.util.UUID
import java.util.concurrent.Executors

internal interface VoiceRecorder {
    fun start(file: File, onStop: (String) -> Unit)
    fun pause()
    fun resume()
    fun stop()
    fun release()
}

internal class AndroidVoiceRecorder : VoiceRecorder {
    private val recorder = MediaRecorder()
    override fun start(file: File, onStop: (String) -> Unit) {
        recorder.setAudioSource(MediaRecorder.AudioSource.MIC)
        recorder.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
        recorder.setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
        recorder.setAudioSamplingRate(44100)
        recorder.setAudioEncodingBitRate(64000)
        recorder.setOutputFile(file.absolutePath)
        // Leave container-finalization headroom below the provider's 25 MB limit.
        recorder.setMaxFileSize(24_500_000)
        recorder.setOnInfoListener { _, what, _ -> if (what == MediaRecorder.MEDIA_RECORDER_INFO_MAX_FILESIZE_REACHED) onStop("audio_limit") }
        recorder.setOnErrorListener { _, _, _ -> onStop("recording_unavailable") }
        recorder.prepare()
        recorder.start()
    }
    override fun pause() = recorder.pause()
    override fun resume() = recorder.resume()
    override fun stop() = recorder.stop()
    override fun release() = recorder.release()
}

/** Process-scoped owner; Activity destruction never destroys retained audio or the recorder. */
internal class VoiceSession private constructor(
    private val context: Context,
    private val remote: VoiceRemote,
    private val recorderFactory: () -> VoiceRecorder,
    private val secureFactory: () -> android.content.SharedPreferences
) {
    private val queue = Executors.newSingleThreadExecutor { Thread(it, "dpos-voice-state").apply { isDaemon = true } }
    private val network = Executors.newSingleThreadExecutor { Thread(it, "dpos-voice-http").apply { isDaemon = true } }
    private val secure by lazy(secureFactory)
    private var loaded = false
    private var metadata = JSONObject()
    private var recorder: VoiceRecorder? = null
    private var recordingAt = 0L
    private var generation = 0L
    private var pendingStart: Long? = null
    private var serviceOwner: Long? = null
    private var operation: VoiceOperation? = null
    private var operationOwner: Any? = null
    private var titleReply: ((List<String>?, String?) -> Unit)? = null
    private var titleDeadline: java.util.concurrent.ScheduledFuture<*>? = null
    private val root get() = File(context.filesDir, "voice-input").apply { mkdirs() }
    private val record get() = AtomicFile(File(root, "session.json"))

    fun execute(task: VoiceSession.() -> Unit) { queue.execute { ensureLoaded(); task() } }

    private fun ensureLoaded() {
        if (loaded) return
        metadata = try { JSONObject(record.openRead().use { it.readBytes().toString(Charsets.UTF_8) }) }
            catch (_: Exception) { JSONObject() }
        loaded = true
        // Only our single retained namespace is used; interrupted sessions never auto-start.
        if (metadata.optString("state") in setOf("recording", "paused", "recognizing")) {
            metadata.put("state", if (audio()?.isFile == true) "ready" else "idle")
            metadata.put("error", "interrupted")
            persist()
        }
        // A crash before metadata commit must not silently orphan a saved recording.
        if (audio() == null) {
            root.listFiles()?.filter { it.name.matches(Regex("voice-[a-f0-9-]+\\.m4a")) && it.length() > 0 }
                ?.minByOrNull { it.lastModified() }?.let {
                    metadata.put("file", it.name).put("state", "ready").put("error", "interrupted")
                    persist()
                }
        }
    }

    private fun audio(): File? = metadata.optString("file").takeIf { it.matches(Regex("voice-[a-f0-9-]+\\.m4a")) }?.let { File(root, it) }
    private fun state() = metadata.optString("state", "idle")
    private fun duration() = metadata.optLong("durationMs") + if (state() == "recording" && recorder != null) (SystemClock.elapsedRealtime() - recordingAt).coerceAtLeast(0) else 0
    fun status(): JSONObject = JSONObject().put("supported", true).put("state", if (pendingStart != null) "recording" else state())
        .put("hasKey", secure.contains("groqApiKey")).put("mode", metadata.optString("mode", "formatted"))
        .put("durationMs", duration()).put("bytes", audio()?.length() ?: 0)
        .put("transcript", metadata.optString("transcript")).put("result", metadata.optString("result"))
        .put("error", metadata.optString("error"))

    private fun persist() {
        val file = record
        val stream = file.startWrite()
        try { stream.write(metadata.toString().toByteArray(Charsets.UTF_8)); file.finishWrite(stream) }
        catch (error: Exception) { file.failWrite(stream); throw VoiceFailure("storage_error") }
    }
    fun error(code: String): JSONObject { metadata.put("error", code); persist(); return status() }
    private fun validMode(mode: String): String {
        if (mode !in setOf("raw", "formatted")) throw VoiceFailure("invalid_mode")
        return mode
    }
    fun saveSettings(payload: JSONObject): JSONObject {
        val mode = validMode(payload.optString("mode", metadata.optString("mode", "formatted")))
        if (payload.has("apiKey")) {
            val key = payload.optString("apiKey").trim()
            if (key.length !in 8..512 || key.any { it <= ' ' || it >= '\u007f' }) throw VoiceFailure("invalid_key")
            cancelRecognition()
            if (!secure.edit().putString("groqApiKey", key).commit()) throw VoiceFailure("storage_error")
        }
        metadata.put("mode", mode).put("error", "")
        persist()
        return status()
    }
    fun deleteKey(): JSONObject {
        cancelRecognition()
        if (!secure.edit().remove("groqApiKey").commit()) throw VoiceFailure("storage_error")
        return status()
    }
    fun checkConnection(owner: Any, reply: (JSONObject) -> Unit) {
        if (operation != null) throw VoiceFailure("busy")
        val key = secure.getString("groqApiKey", null) ?: throw VoiceFailure("key_required")
        val token = VoiceOperation()
        operation = token
        operationOwner = owner
        val current = ++generation
        metadata.put("error", "")
        val answered = java.util.concurrent.atomic.AtomicBoolean(false)
        val finish: (JSONObject) -> Unit = { value -> if (answered.compareAndSet(false, true)) reply(value) }
        val deadline = deadlines.schedule({ execute {
            if (generation == current && operation === token) {
                token.cancel(); operation = null; operationOwner = null
                metadata.put("error", "groq_timeout"); persist()
            }
            finish(status().put("ok", false).put("error", "groq_timeout"))
        } }, 90, java.util.concurrent.TimeUnit.SECONDS)
        network.execute {
            val failure = try { remote.check(key, token); "" } catch (e: Exception) { safeError(e) }
            execute {
                if (generation == current && operation === token) {
                    operation = null; operationOwner = null
                    metadata.put("error", failure)
                    persist()
                    finish(status().put("ok", failure.isEmpty()))
                } else finish(status().put("ok", false).put("error", "cancelled"))
                deadline.cancel(false)
            }
        }
        // The bridge reply waits off-main, never the state/recording command lane.
    }

    fun suggestTitles(value: Any?, owner: Any, reply: (List<String>?, String?) -> Unit) {
        val text = TitleSuggestions.input(value)
        if (operation != null) throw VoiceFailure("busy")
        val key = secure.getString("groqApiKey", null) ?: throw VoiceFailure("key_required")
        val token = VoiceOperation()
        val current = ++generation
        operation = token; operationOwner = owner; titleReply = reply
        // Admission-to-reply budget includes time waiting behind a cancelled transport.
        titleDeadline = deadlines.schedule({ execute {
            if (generation == current && operation === token) {
                token.cancel()
                finishTitles(null, "groq_timeout")
            }
        } }, 90, java.util.concurrent.TimeUnit.SECONDS)
        network.execute {
            var titles: List<String>? = null
            var error: String? = null
            try {
                token.checkActive()
                titles = remote.suggestTitles(key, text, token)
            } catch (failure: Exception) { error = safeError(failure) }
            execute {
                if (generation == current && operation === token) finishTitles(titles, error)
            }
        }
    }
    private fun finishTitles(titles: List<String>?, error: String?) {
        val reply = titleReply
        titleReply = null
        titleDeadline?.cancel(false); titleDeadline = null
        operation = null; operationOwner = null
        reply?.invoke(titles, error)
    }

    fun requestStart(): JSONObject {
        if (recorder != null || pendingStart != null || state() == "recognizing") throw VoiceFailure("busy")
        if (audio()?.exists() == true) throw VoiceFailure("delete_recording_first")
        cancelRecognition()
        val ticket = ++generation
        pendingStart = ticket
        try {
            ContextCompat.startForegroundService(context, Intent(context, VoiceRecordingService::class.java)
                .setAction(VoiceRecordingService.START).putExtra("owner", ticket))
        } catch (_: Exception) { pendingStart = null; throw VoiceFailure("recording_unavailable") }
        return status()
    }

    fun serviceStart(ticket: Long, ready: (Boolean) -> Unit) {
        if (pendingStart != ticket) { ready(false); return }
        pendingStart = null
        serviceOwner = ticket
        val file = File(root, "voice-${UUID.randomUUID()}.m4a")
        metadata = JSONObject().put("mode", metadata.optString("mode", "formatted"))
            .put("file", file.name).put("state", "recording").put("durationMs", 0)
        try {
            persist()
            recorder = recorderFactory()
            recorder!!.start(file) { reason -> execute { if (serviceOwner == ticket) stop(reason) } }
            recordingAt = SystemClock.elapsedRealtime()
            ready(true)
        } catch (_: Exception) {
            recorder?.let { runCatching { it.release() } }; recorder = null; serviceOwner = null
            metadata.put("state", if (file.exists()) "ready" else "idle").put("error", "recording_unavailable")
            try { persist() } finally { ready(false) }
        }
    }
    fun serviceStartFailed(ticket: Long) {
        if (pendingStart == ticket) {
            pendingStart = null
            error("recording_unavailable")
        }
    }
    fun pause(): JSONObject {
        if (state() != "recording" || recorder == null) throw VoiceFailure("not_recording")
        val elapsed = duration()
        try { recorder!!.pause() } catch (_: Exception) { return stop("recording_unavailable") }
        metadata.put("durationMs", elapsed).put("state", "paused")
        persist(); return status()
    }
    fun resume(): JSONObject {
        if (state() != "paused" || recorder == null) throw VoiceFailure("not_paused")
        try { recorder!!.resume() } catch (_: Exception) { return stop("recording_unavailable") }
        recordingAt = SystemClock.elapsedRealtime()
        metadata.put("state", "recording")
        persist(); return status()
    }
    fun stop(reason: String = ""): JSONObject {
        pendingStart = null
        cancelRecognition()
        val elapsed = duration()
        val active = recorder
        recorder = null
        try {
            if (active != null) {
                var error = reason
                try { active.stop() } catch (_: Exception) { error = "audio_unusable" }
                finally { runCatching { active.release() } }
                metadata.put("durationMs", elapsed).put("state", "ready").put("error", error)
                persist()
            }
        } finally {
            serviceOwner = null
            context.stopService(Intent(context, VoiceRecordingService::class.java))
        }
        return status()
    }
    fun serviceDestroyed(ticket: Long) { if (serviceOwner == ticket) stop("interrupted") }
    fun checkpoint(ticket: Long) {
        if (serviceOwner != ticket || recorder == null) return
        val elapsed = duration()
        metadata.put("durationMs", elapsed)
        recordingAt = SystemClock.elapsedRealtime()
        persist()
        if ((audio()?.length() ?: 0) >= 24_500_000) stop("audio_limit")
    }
    fun delete(): JSONObject {
        stop()
        val file = audio()
        if (file != null && file.exists() && !file.delete()) throw VoiceFailure("storage_error")
        metadata = JSONObject().put("mode", metadata.optString("mode", "formatted")).put("state", "idle")
        persist(); return status()
    }

    fun recognize(mode: String, owner: Any): JSONObject {
        validMode(mode)
        if (state() != "ready" || recorder != null || operation != null) throw VoiceFailure("busy")
        val file = audio() ?: throw VoiceFailure("audio_unusable")
        if (!file.isFile || file.length() !in 1..GroqVoiceApi.MAX_AUDIO) throw VoiceFailure("audio_unusable")
        val key = secure.getString("groqApiKey", null) ?: throw VoiceFailure("key_required")
        val token = VoiceOperation()
        operation = token; operationOwner = owner
        val current = ++generation
        metadata.put("state", "recognizing").put("error", "").put("mode", mode)
        persist()
        network.execute {
            try {
                val transcript = remote.transcribe(key, file, token)
                // Persist raw STT before optional formatting; a later failure cannot lose it.
                execute {
                    if (generation == current && operation === token) {
                        metadata.put("transcript", transcript).put("result", transcript); persist()
                    }
                }
                val result = if (mode == "formatted") remote.format(key, transcript, token) else transcript
                execute { complete(current, token, result, "") }
            } catch (e: Exception) { execute { complete(current, token, null, safeError(e)) } }
        }
        return status()
    }
    private fun complete(current: Long, token: VoiceOperation, result: String?, error: String) {
        if (generation != current || operation !== token) return
        operation = null; operationOwner = null
        if (result != null) metadata.put("result", result)
        metadata.put("state", "ready").put("error", error)
        persist()
    }
    private fun cancelRecognition() {
        ++generation
        operation?.cancel()
        if (titleReply != null) finishTitles(null, "cancelled")
        operation = null; operationOwner = null
        if (state() == "recognizing") { metadata.put("state", "ready").put("error", "cancelled"); persist() }
    }
    fun closeOwner(owner: Any) { if (operationOwner === owner) cancelRecognition() }

    companion object {
        private val deadlines = Executors.newSingleThreadScheduledExecutor { Thread(it, "dpos-voice-check-deadline").apply { isDaemon = true } }
        @Volatile private var instance: VoiceSession? = null
        fun get(context: Context): VoiceSession = instance ?: synchronized(this) {
            instance ?: VoiceSession(context.applicationContext, GroqVoiceApi(), { AndroidVoiceRecorder() }, {
                val app = context.applicationContext
                val master = MasterKey.Builder(app).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build()
                EncryptedSharedPreferences.create(app, "dpos_voice_secure", master,
                    EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                    EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM)
            }).also { instance = it }
        }
        fun safeError(error: Exception): String = if (error is VoiceFailure) error.code else "voice_error"
    }
}
