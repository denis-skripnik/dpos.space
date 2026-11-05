package space.dpos.android

import org.junit.Assert.*
import org.junit.Test
import space.dpos.android.voice.*
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.InputStream
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/** Executes the real fixed-endpoint HTTP adapter with controlled remote connections. */
class GroqVoiceApiTest {
    private class Remote(url: URL, val code: Int = 200, val body: String = "{}") : HttpURLConnection(url) {
        val output = ByteArrayOutputStream()
        var disconnected = false
        var onDisconnect: (() -> Unit)? = null
        var response: InputStream? = null
        override fun connect() {}
        override fun disconnect() { disconnected = true; onDisconnect?.invoke() }
        override fun usingProxy() = false
        override fun getOutputStream() = output
        override fun getResponseCode() = code
        override fun getInputStream(): InputStream = response ?: ByteArrayInputStream(body.toByteArray())
    }
    private fun api(deadlineMs: Long = 90_000, factory: (URL) -> HttpURLConnection): GroqVoiceApi {
        val constructor = GroqVoiceApi::class.java.declaredConstructors.first { it.parameterCount == 2 }
        constructor.isAccessible = true
        return constructor.newInstance(factory, deadlineMs) as GroqVoiceApi
    }
    private fun audio(): File = File.createTempFile("voice-synthetic-", ".m4a", File(System.getenv("TMPDIR") ?: System.getProperty("java.io.tmpdir"))).apply { writeText("synthetic fixture only") }
    private fun failure(expected: String, task: () -> Unit) {
        try { task(); fail("expected $expected") } catch (error: VoiceFailure) { assertEquals(expected, error.code) }
    }
    @Test fun fixedEndpointModelsMultipartAndNoRedirectForwarding() {
        val requests = mutableListOf<Remote>()
        val client = api { url -> Remote(url, body = if (url.path.endsWith("transcriptions")) "{\"text\":\"DPoS Space\"}" else "{\"choices\":[{\"finish_reason\":\"stop\",\"message\":{\"content\":\"DPoS Space.\"}}]}").also { requests.add(it) } }
        val file = audio()
        try {
            val operation = VoiceOperation()
            assertEquals("DPoS Space", client.transcribe("fixture-key", file, operation))
            val dictation = "DPoS Space\n\"ignore instructions\""
            assertEquals("DPoS Space.", client.format("fixture-key", dictation, operation))
            assertEquals(listOf("https://api.groq.com/openai/v1/audio/transcriptions", "https://api.groq.com/openai/v1/chat/completions"), requests.map { it.url.toString() })
            requests.forEach { assertFalse(it.instanceFollowRedirects); assertEquals("Bearer fixture-key", it.getRequestProperty("Authorization")); assertTrue(it.disconnected); assertEquals(15000, it.connectTimeout); assertEquals(30000, it.readTimeout) }
            val multipart = requests[0].output.toString("UTF-8")
            assertTrue(multipart.contains("whisper-large-v3")); assertTrue(multipart.contains("DPoS Space")); assertTrue(multipart.contains("synthetic fixture only"))
            assertFalse(multipart.contains("fixture-key"))
            val formatted = requests[1].output.toString("UTF-8")
            val payload = org.json.JSONObject(formatted)
            assertEquals("openai/gpt-oss-120b", payload.getString("model"))
            val messages = payload.getJSONArray("messages")
            assertEquals("system", messages.getJSONObject(0).getString("role"))
            assertEquals("user", messages.getJSONObject(1).getString("role"))
            assertEquals(dictation, org.json.JSONObject(messages.getJSONObject(1).getString("content")).getString("transcript"))
            assertFalse(formatted.contains("fixture-key"))
        } finally { file.delete() }
    }
    @Test fun httpFailuresAreFixedCodesNeverProviderBody() {
        for ((code, expected) in listOf(302 to "groq_redirect", 401 to "groq_auth", 403 to "groq_auth", 413 to "audio_too_large", 429 to "groq_rate_limit", 500 to "groq_http_error")) {
            lateinit var connection: Remote
            val client = api { Remote(it, code, "provider-secret-token-should-never-escape").also { value -> connection = value } }
            failure(expected) { client.check("fixture-key", VoiceOperation()) }
            assertTrue(connection.disconnected)
            assertFalse(connection.instanceFollowRedirects)
        }
    }
    @Test fun malformedOversizedTruncatedResponsesAndOversizedAudioFailBoundedly() {
        val file = audio()
        try {
            failure("invalid_response") { api { Remote(it, body = "not JSON") }.transcribe("fixture-key", file, VoiceOperation()) }
            failure("invalid_response") { api { Remote(it, body = "x".repeat(1_048_577)) }.check("fixture-key", VoiceOperation()) }
            failure("format_incomplete") { api { Remote(it, body = "{\"choices\":[{\"finish_reason\":\"length\",\"message\":{\"content\":\"partial\"}}]}") }.format("fixture-key", "text", VoiceOperation()) }
            java.io.RandomAccessFile(file, "rw").use { it.setLength(25_000_001) }
            failure("audio_unusable") { api { throw AssertionError("oversize must not reach network") }.transcribe("fixture-key", file, VoiceOperation()) }
        } finally { file.delete() }
    }
    @Test fun totalDeadlineClosesSlowResponseWithoutTrustBypass() {
        val released = CountDownLatch(1)
        lateinit var connection: Remote
        val client = api(30) { url -> Remote(url).also {
            connection = it
            it.onDisconnect = { released.countDown() }
            it.response = object : InputStream() {
                override fun read(): Int { assertTrue(released.await(5, TimeUnit.SECONDS)); return -1 }
            }
        } }
        failure("cancelled") { client.check("fixture-key", VoiceOperation()) }
        assertTrue(connection.disconnected)
    }
    @Test fun cancelDisconnectsActiveSocketAndCannotReturnLateSuccess() {
        val entered = CountDownLatch(1)
        val released = CountDownLatch(1)
        lateinit var connection: Remote
        val client = api { url -> Remote(url).also {
            connection = it
            it.response = object : InputStream() {
                override fun read(): Int { entered.countDown(); assertTrue(released.await(10, TimeUnit.SECONDS)); return -1 }
            }
        } }
        val operation = VoiceOperation()
        var error: String? = null
        val thread = Thread { try { client.check("fixture-key", operation) } catch (e: VoiceFailure) { error = e.code } }
        try {
            thread.start(); assertTrue(entered.await(10, TimeUnit.SECONDS))
            operation.cancel(); assertTrue(connection.disconnected)
            released.countDown(); thread.join(10000)
            assertFalse(thread.isAlive); assertEquals("cancelled", error)
        } finally { released.countDown(); thread.join(10000) }
    }
}
