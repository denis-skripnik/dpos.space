package space.dpos.android

import android.Manifest
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.content.pm.PackageManager
import android.os.Looper
import org.json.JSONObject
import org.junit.After
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import space.dpos.android.bridge.BridgeRequest
import space.dpos.android.bridge.DposAndroidBridge
import space.dpos.android.voice.*
import java.io.File
import java.util.concurrent.CountDownLatch
import java.util.concurrent.ExecutorService
import java.util.concurrent.TimeUnit

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class VoiceSessionBehaviorTest {
    class PermissionActivity : Activity(), VoicePermissionHost {
        var foreground = true
        val permission = VoicePermissionController(this) { foreground }
        override fun requestVoicePermission(callback: (Boolean) -> Unit) = permission.request(callback)
        override fun isVoiceForeground(): Boolean = foreground
        override fun onRequestPermissionsResult(code: Int, permissions: Array<out String>, grants: IntArray) {
            permission.result(code, permissions, grants)
        }
    }
    private lateinit var activity: PermissionActivity
    private lateinit var session: VoiceSession
    private lateinit var bridge: DposAndroidBridge
    private lateinit var prefs: SharedPreferences
    private val sessions = mutableListOf<VoiceSession>()
    private val recorder = FakeRecorder()
    private val remote = FakeRemote()
    private val key = "fixture-not-a-real-key"

    private class FakeRecorder : VoiceRecorder {
        var stops = 0
        var releases = 0
        var limit: (() -> Unit)? = null
        override fun start(file: File, onStop: (String) -> Unit) { file.writeText("synthetic audio fixture"); limit = { onStop("audio_limit") } }
        override fun stop() { stops++ }
        override fun release() { releases++ }
        override fun pause() {}
        override fun resume() {}
    }
    private class FakeRemote : VoiceRemote {
        var sttCalls = 0
        var formatCalls = 0
        var failStt = false
        var failFormat = false
        var hold = false
        val entered = CountDownLatch(1)
        val release = CountDownLatch(1)
        var titleCalls = 0
        var titleKey = ""
        var titleText = ""
        var titleFailure = false
        override fun suggestTitles(key: String, text: String, operation: VoiceOperation): List<String> {
            titleCalls++; titleKey = key; titleText = text
            entered.countDown()
            if (hold) assertTrue(release.await(10, TimeUnit.SECONDS))
            if (titleFailure) throw VoiceFailure("groq_auth")
            return listOf("Первый", "Второй", "Третий") // Intentionally ignores cancellation.
        }
        override fun check(key: String, operation: VoiceOperation) { if (failStt) throw VoiceFailure("groq_auth") }
        override fun transcribe(key: String, audio: File, operation: VoiceOperation): String {
            sttCalls++; assertTrue(audio.isFile)
            entered.countDown()
            if (hold) assertTrue(release.await(10, TimeUnit.SECONDS))
            if (failStt) throw VoiceFailure("groq_rate_limit")
            // Deliberately ignores cancellation, proving completion ownership independently of transport.
            return "DPoS Space, исходный текст."
        }
        override fun format(key: String, transcript: String, operation: VoiceOperation): String {
            formatCalls++
            if (failFormat) throw VoiceFailure("groq_http_error")
            return "DPoS Space — исходный текст."
        }
    }
    private fun newSession(): VoiceSession {
        val constructor = VoiceSession::class.java.declaredConstructors.first { it.parameterCount == 4 }
        constructor.isAccessible = true
        val value = constructor.newInstance(activity.applicationContext, remote, { recorder }, { prefs }) as VoiceSession
        sessions.add(value)
        return value
    }
    private fun install(value: VoiceSession) {
        VoiceSession::class.java.getDeclaredField("instance").apply { isAccessible = true }.set(null, value)
    }
    @Before fun setup() {
        activity = Robolectric.buildActivity(PermissionActivity::class.java).setup().get()
        // Application startup writes its version independently of voice operations.
        val startup = CountDownLatch(1)
        space.dpos.android.storage.NativeStorageQueue.execute { startup.countDown() }
        assertTrue(startup.await(10, TimeUnit.SECONDS))
        File(activity.filesDir, "voice-input").deleteRecursively()
        prefs = activity.getSharedPreferences("voice-test-secure", Context.MODE_PRIVATE)
        prefs.edit().clear().commit()
        session = newSession(); install(session)
        bridge = DposAndroidBridge(activity, statusProvider = { JSONObject() })
    }
    @After fun teardown() {
        remote.release.countDown()
        bridge.close()
        sessions.forEach { s ->
            val latch = CountDownLatch(1)
            s.execute { stop(); latch.countDown() }; latch.await(10, TimeUnit.SECONDS)
            for (field in listOf("queue", "network")) {
                val executor = VoiceSession::class.java.getDeclaredField(field).apply { isAccessible = true }.get(s) as ExecutorService
                executor.shutdown(); executor.awaitTermination(10, TimeUnit.SECONDS)
            }
        }
        installNull()
        activity.finish()
    }
    private fun installNull() { VoiceSession::class.java.getDeclaredField("instance").apply { isAccessible = true }.set(null, null) }
    private fun call(method: String, payload: JSONObject = JSONObject()): JSONObject {
        val latch = CountDownLatch(1)
        var result: JSONObject? = null
        bridge.dispatch(BridgeRequest("voice-test", method, payload)) { result = it; latch.countDown() }
        shadowOf(Looper.getMainLooper()).idle()
        assertTrue("bridge reply $method", latch.await(10, TimeUnit.SECONDS))
        val response = result!!
        if (!response.optBoolean("ok")) throw AssertionError(response.toString())
        assertFalse("key must never be returned", response.toString().contains(key))
        return response.getJSONObject("result")
    }
    private fun status() = call("voiceStatus")
    private fun drainHttp() {
        val executor = VoiceSession::class.java.getDeclaredField("network").apply { isAccessible = true }.get(session) as ExecutorService
        executor.submit {}.get(10, TimeUnit.SECONDS)
    }
    private fun command(task: VoiceSession.() -> Unit) {
        val latch = CountDownLatch(1)
        var failure: Throwable? = null
        session.execute { try { task() } catch (e: Throwable) { failure = e } finally { latch.countDown() } }
        assertTrue(latch.await(10, TimeUnit.SECONDS)); failure?.let { throw it }
    }
    private fun start(): Long {
        shadowOf(activity).grantPermissions(Manifest.permission.RECORD_AUDIO)
        assertEquals("recording", call("voiceStart").getString("state"))
        val intent = shadowOf(activity.application).nextStartedService
        assertEquals(VoiceRecordingService::class.java.name, intent.component!!.className)
        val ticket = intent.getLongExtra("owner", -1)
        command { serviceStart(ticket) { assertTrue(it) } }
        assertEquals("recording", status().getString("state"))
        return ticket
    }
    private fun savedRecording() {
        call("voiceSaveSettings", JSONObject().put("apiKey", key).put("mode", "formatted"))
        start(); call("voiceStop")
        assertEquals(0, remote.sttCalls)
        assertEquals("ready", status().getString("state"))
    }
    private fun awaitReady(): JSONObject {
        repeat(200) { val result = status(); if (result.getString("state") == "ready") return result; Thread.sleep(10) }
        throw AssertionError("recognition did not complete")
    }

    @Test fun permissionDeniedThenRetryRequiresExplicitStart() {
        var response: JSONObject? = null
        bridge.dispatch(BridgeRequest("denied", "voiceStart", JSONObject())) { response = it }
        shadowOf(Looper.getMainLooper()).idle()
        val request = shadowOf(activity).lastRequestedPermission
        assertArrayEquals(arrayOf(Manifest.permission.RECORD_AUDIO), request.requestedPermissions)
        activity.onRequestPermissionsResult(VoicePermissionController.REQUEST, arrayOf(Manifest.permission.RECORD_AUDIO), intArrayOf(PackageManager.PERMISSION_DENIED))
        assertEquals("microphone_permission", response!!.getString("errorCode"))
        assertEquals("idle", status().getString("state"))
        assertNull(shadowOf(activity.application).nextStartedService)
        start()
    }
    @Test fun permissionCallbackCannotRestartAfterBackgroundCancellation() {
        var replies = 0
        bridge.dispatch(BridgeRequest("cancel", "voiceStart", JSONObject())) { replies++ }
        shadowOf(Looper.getMainLooper()).idle()
        activity.foreground = false; activity.permission.cancel()
        shadowOf(activity).grantPermissions(Manifest.permission.RECORD_AUDIO)
        activity.onRequestPermissionsResult(VoicePermissionController.REQUEST, arrayOf(Manifest.permission.RECORD_AUDIO), intArrayOf(PackageManager.PERMISSION_GRANTED))
        assertEquals(1, replies)
        assertNull(shadowOf(activity.application).nextStartedService)
    }
    @Test fun stopPauseResumeDeleteAndRawRecognitionAreExplicit() {
        call("voiceSaveSettings", JSONObject().put("apiKey", key).put("mode", "raw"))
        start(); call("voicePause"); assertEquals("paused", status().getString("state"))
        call("voiceResume"); assertEquals("recording", status().getString("state"))
        call("voiceStop"); assertEquals(1, recorder.stops)
        assertEquals(0, remote.sttCalls)
        assertEquals("recognizing", call("voiceRecognize", JSONObject().put("mode", "raw")).getString("state"))
        val result = awaitReady()
        assertEquals("DPoS Space, исходный текст.", result.getString("result"))
        assertEquals(0, remote.formatCalls)
        assertTrue(result.getLong("bytes") > 0)
        call("voiceDelete")
        assertEquals("idle", status().getString("state")); assertEquals(0, status().getLong("bytes"))
    }
    @Test fun formattingFailureRetainsRawAndAudioAcrossRecreation() {
        savedRecording(); remote.failFormat = true
        call("voiceRecognize", JSONObject().put("mode", "formatted"))
        val result = awaitReady()
        assertEquals("groq_http_error", result.getString("error"))
        assertEquals(result.getString("transcript"), result.getString("result"))
        assertTrue(result.getString("transcript").isNotEmpty())
        val restored = newSession()
        val latch = CountDownLatch(1)
        restored.execute { assertEquals(result.toString(), status().toString()); latch.countDown() }
        assertTrue(latch.await(10, TimeUnit.SECONDS))
    }
    @Test fun networkFailureRetainsAudioAndAllowsRetry() {
        savedRecording(); remote.failStt = true
        call("voiceRecognize", JSONObject().put("mode", "raw"))
        val result = awaitReady()
        assertEquals("groq_rate_limit", result.getString("error")); assertTrue(result.getLong("bytes") > 0)
        remote.failStt = false
        call("voiceRecognize", JSONObject().put("mode", "raw"))
        assertTrue(awaitReady().getString("transcript").isNotEmpty())
    }
    @Test fun deleteAndNewRecordingCannotBeResurrectedByOldHttp() {
        savedRecording(); remote.hold = true
        call("voiceRecognize", JSONObject().put("mode", "raw"))
        assertTrue(remote.entered.await(10, TimeUnit.SECONDS))
        call("voiceDelete"); start()
        remote.release.countDown()
        drainHttp()
        assertEquals("recording", status().getString("state"))
        assertEquals("", status().getString("result")); assertTrue(status().getLong("bytes") > 0)
    }
    @Test fun explicitStopCancelsRecognitionButKeepsStoppedAudio() {
        savedRecording(); remote.hold = true
        call("voiceRecognize", JSONObject().put("mode", "raw"))
        assertTrue(remote.entered.await(10, TimeUnit.SECONDS))
        call("voiceStop")
        remote.release.countDown(); drainHttp()
        val result = status()
        assertEquals("ready", result.getString("state"))
        assertEquals("cancelled", result.getString("error"))
        assertEquals("", result.getString("result")); assertTrue(result.getLong("bytes") > 0)
    }
    @Test fun startRefusesToOverwriteRetainedAudio() {
        savedRecording()
        val before = status()
        var response: JSONObject? = null
        val latch = CountDownLatch(1)
        bridge.dispatch(BridgeRequest("retain", "voiceStart", JSONObject())) { response = it; latch.countDown() }
        shadowOf(Looper.getMainLooper()).idle()
        assertTrue(latch.await(10, TimeUnit.SECONDS))
        assertEquals("delete_recording_first", response!!.getString("errorCode"))
        assertEquals(before.getLong("bytes"), status().getLong("bytes"))
        assertEquals("ready", status().getString("state"))
    }
    @Test fun oldActivityCloseCancelsHttpButDoesNotStopRecordingService() {
        savedRecording(); remote.hold = true
        call("voiceRecognize", JSONObject().put("mode", "raw"))
        assertTrue(remote.entered.await(10, TimeUnit.SECONDS)); bridge.close()
        command { assertEquals("ready", status().getString("state")) }
        remote.release.countDown(); drainHttp()
        command { assertEquals("", status().getString("result")); assertTrue(status().getLong("bytes") > 0) }
    }
    @Test fun serviceCrashAndOldDestroyCannotEraseNewRecording() {
        val old = start()
        command { serviceDestroyed(old) }
        assertEquals("ready", status().getString("state"))
        call("voiceDelete"); val current = start()
        command { serviceDestroyed(old) }
        assertEquals("recording", status().getString("state"))
        bridge.close()
        command { assertEquals("recording", status().getString("state")); serviceDestroyed(current) }
    }
    @Test fun abandonedRecordingAndLimitRetainFileWithoutAutostart() {
        start()
        val restored = newSession()
        val latch = CountDownLatch(1)
        restored.execute {
            assertEquals("ready", status().getString("state")); assertTrue(status().getLong("bytes") > 0)
            assertEquals("interrupted", status().getString("error")); latch.countDown()
        }
        assertTrue(latch.await(10, TimeUnit.SECONDS))
        recorder.limit!!.invoke()
        command { assertEquals("ready", status().getString("state")); assertEquals("audio_limit", status().getString("error")) }
    }
    @Test fun actualForegroundServiceHasQuietStopNotificationAndDoesNotRestartOnNullIntent() {
        shadowOf(activity).grantPermissions(Manifest.permission.RECORD_AUDIO)
        call("voiceStart")
        val intent = shadowOf(activity.application).nextStartedService
        val controller = Robolectric.buildService(VoiceRecordingService::class.java).create()
        val service = controller.get()
        assertEquals(android.app.Service.START_NOT_STICKY, service.onStartCommand(intent, 0, 1))
        command { assertEquals("recording", status().getString("state")) }
        shadowOf(Looper.getMainLooper()).idle()
        val notification = shadowOf(service).lastForegroundNotification
        assertEquals("dpos_voice_recording", notification.channelId)
        assertEquals("Остановить запись", notification.actions.single().title)
        val manager = activity.getSystemService(android.app.NotificationManager::class.java)
        assertNull(manager.getNotificationChannel(notification.channelId).sound)
        service.onStartCommand(Intent(service, VoiceRecordingService::class.java).setAction(VoiceRecordingService.STOP), 0, 2)
        command { assertEquals("ready", status().getString("state")) }
        controller.destroy()
        val replacement = Robolectric.buildService(VoiceRecordingService::class.java).create()
        assertEquals(android.app.Service.START_NOT_STICKY, replacement.get().onStartCommand(null, 0, 3))
        command { assertEquals("ready", status().getString("state")) }
        replacement.destroy()
    }
    @Test fun explicitTitlesUseSameKeyAndLeaveRetainedVoiceStateUntouched() {
        savedRecording()
        call("voiceRecognize", JSONObject().put("mode", "raw")); awaitReady(); drainHttp()
        val before = status().toString()
        val files = File(activity.filesDir, "voice-input").listFiles()!!.associate { it.name to it.readBytes().toList() }
        assertEquals(0, remote.titleCalls)
        val result = call("voiceSuggestTitles", JSONObject().put("text", "Synthetic post"))
        assertEquals(listOf("titles"), result.keys().asSequence().toList())
        assertEquals(3, result.getJSONArray("titles").length())
        assertEquals(key, remote.titleKey); assertEquals("Synthetic post", remote.titleText)
        assertEquals(before, status().toString())
        assertEquals(files, File(activity.filesDir, "voice-input").listFiles()!!.associate { it.name to it.readBytes().toList() })
    }
    private fun cancelledTitle(action: String) {
        savedRecording(); remote.hold = true
        val replies = java.util.concurrent.atomic.AtomicInteger()
        val done = CountDownLatch(1)
        var response: JSONObject? = null
        bridge.dispatch(BridgeRequest("title-held", "voiceSuggestTitles", JSONObject().put("text", "Synthetic post"))) {
            response = it; replies.incrementAndGet(); done.countDown()
        }
        assertTrue("HTTP entered", remote.entered.await(5, TimeUnit.SECONDS))
        // Neither a held remote nor its waiting reply may occupy the state/main lane.
        assertEquals("ready", status().getString("state"))
        when (action) {
            "close" -> bridge.close()
            "key" -> call("voiceSaveSettings", JSONObject().put("apiKey", "replacement-fixture-key"))
            else -> call(action)
        }
        command {} // Fence owner close and all queued cancellation work.
        assertTrue("cancellation must reply before remote drains", done.await(2, TimeUnit.SECONDS))
        val cancelled = response!!
        assertFalse(cancelled.getBoolean("ok")); assertEquals("cancelled", cancelled.getString("errorCode"))
        if (action == "voiceDelete") start()
        val snapshot = if (action == "close") { var value = ""; command { value = status().toString() }; value } else status().toString()
        remote.release.countDown(); drainHttp(); command {}
        assertEquals(1, replies.get())
        command { assertEquals(snapshot, status().toString()) }
        if (action != "close") {
            assertEquals(3, call("voiceSuggestTitles", JSONObject().put("text", "New generation")).getJSONArray("titles").length())
        }
    }
    @Test fun titleStopCancelsBeforeLateHttpWithoutStateMutation() = cancelledTitle("voiceStop")
    @Test fun titleDeleteCannotResurrectNewRecording() = cancelledTitle("voiceDelete")
    @Test fun titleKeyReplacementCancelsOldCredentialRequest() = cancelledTitle("key")
    @Test fun titleKeyDeletionCancelsOldCredentialRequest() {
        savedRecording(); remote.hold = true
        val done = CountDownLatch(1)
        var response: JSONObject? = null
        bridge.dispatch(BridgeRequest("delete-key-title", "voiceSuggestTitles", JSONObject().put("text", "Synthetic"))) { response = it; done.countDown() }
        assertTrue(remote.entered.await(5, TimeUnit.SECONDS)); call("voiceDeleteKey")
        assertTrue(done.await(2, TimeUnit.SECONDS)); assertEquals("cancelled", response!!.getString("errorCode"))
        remote.release.countDown(); drainHttp(); assertFalse(status().getBoolean("hasKey"))
    }
    @Test fun titleActivityCloseCancelsOnlyItsOwnOperation() = cancelledTitle("close")
    @Test fun closedActivityRejectsSuccessAlreadyQueuedBeforeOwnerClose() {
        savedRecording(); remote.hold = true
        val done = CountDownLatch(1); var response: JSONObject? = null
        bridge.dispatch(BridgeRequest("queued-title", "voiceSuggestTitles", JSONObject().put("text", "Synthetic"))) { response = it; done.countDown() }
        assertTrue(remote.entered.await(5, TimeUnit.SECONDS))
        val held = CountDownLatch(1); val releaseState = CountDownLatch(1)
        session.execute { held.countDown(); assertTrue(releaseState.await(10, TimeUnit.SECONDS)) }
        try {
            assertTrue(held.await(5, TimeUnit.SECONDS))
            remote.release.countDown(); drainHttp() // Completion is now queued before closeOwner.
            bridge.close()
        } finally { releaseState.countDown() }
        assertTrue(done.await(5, TimeUnit.SECONDS))
        assertFalse(response!!.getBoolean("ok")); assertEquals("cancelled", response!!.getString("errorCode"))
    }
    @Test fun unrelatedOldOwnerCloseDoesNotCancelNewOwnerTitleRequest() {
        savedRecording(); remote.hold = true
        val replacement = DposAndroidBridge(activity, statusProvider = { JSONObject() })
        val done = CountDownLatch(1); var response: JSONObject? = null
        try {
            replacement.dispatch(BridgeRequest("new-owner", "voiceSuggestTitles", JSONObject().put("text", "Synthetic"))) { response = it; done.countDown() }
            assertTrue(remote.entered.await(5, TimeUnit.SECONDS)); bridge.close(); command {}
            assertFalse(done.await(50, TimeUnit.MILLISECONDS))
            remote.release.countDown(); assertTrue(done.await(5, TimeUnit.SECONDS))
            assertTrue(response!!.getBoolean("ok")); assertEquals(3, response!!.getJSONObject("result").getJSONArray("titles").length())
        } finally { replacement.close() }
    }
    @Test fun titleFailureAndMissingKeyDoNotAlterRetainedState() {
        savedRecording(); remote.titleFailure = true
        val before = status().toString()
        val done = CountDownLatch(1); var response: JSONObject? = null
        bridge.dispatch(BridgeRequest("failed-title", "voiceSuggestTitles", JSONObject().put("text", "Synthetic"))) { response = it; done.countDown() }
        assertTrue(done.await(5, TimeUnit.SECONDS)); assertEquals("groq_auth", response!!.getString("errorCode"))
        assertEquals(before, status().toString())
        call("voiceDeleteKey")
        val noKey = CountDownLatch(1)
        bridge.dispatch(BridgeRequest("no-key-title", "voiceSuggestTitles", JSONObject().put("text", "Synthetic"))) { response = it; noKey.countDown() }
        assertTrue(noKey.await(5, TimeUnit.SECONDS)); assertEquals("key_required", response!!.getString("errorCode"))
        assertEquals(1, remote.titleCalls)
    }
    @Test fun titleRequestDoesNotReplaceActiveRecognition() {
        savedRecording(); remote.hold = true
        call("voiceRecognize", JSONObject().put("mode", "raw")); assertTrue(remote.entered.await(5, TimeUnit.SECONDS))
        val done = CountDownLatch(1); var response: JSONObject? = null
        bridge.dispatch(BridgeRequest("busy-title", "voiceSuggestTitles", JSONObject().put("text", "Synthetic"))) { response = it; done.countDown() }
        assertTrue(done.await(5, TimeUnit.SECONDS)); assertEquals("busy", response!!.getString("errorCode")); assertEquals(0, remote.titleCalls)
        remote.release.countDown(); drainHttp(); assertTrue(awaitReady().getString("transcript").isNotEmpty())
    }
    @Test fun titleBridgeRejectsNonStringEmptyAndOversizedTextBeforeHttp() {
        call("voiceSaveSettings", JSONObject().put("apiKey", key))
        for (value in listOf<Any>(42, JSONObject.NULL, "", " ", "x".repeat(20001))) {
            val done = CountDownLatch(1); var response: JSONObject? = null
            bridge.dispatch(BridgeRequest("invalid-title", "voiceSuggestTitles", JSONObject().put("text", value))) { response = it; done.countDown() }
            assertTrue(done.await(5, TimeUnit.SECONDS)); assertEquals("invalid_text", response!!.getString("errorCode"))
        }
        assertEquals(0, remote.titleCalls)
    }
    @Test fun keySaveCheckDeleteNeverEchoesAndDoesNotTouchWorkerSettings() {
        val worker = activity.getSharedPreferences("dpos_worker", Context.MODE_PRIVATE).all
        call("voiceSaveSettings", JSONObject().put("apiKey", key).put("mode", "raw"))
        assertTrue(status().getBoolean("hasKey"))
        assertTrue(call("voiceCheckConnection").getBoolean("ok"))
        remote.failStt = true
        assertFalse(call("voiceCheckConnection").getBoolean("ok"))
        call("voiceDeleteKey"); assertFalse(status().getBoolean("hasKey"))
        assertEquals(worker, activity.getSharedPreferences("dpos_worker", Context.MODE_PRIVATE).all)
    }
}
