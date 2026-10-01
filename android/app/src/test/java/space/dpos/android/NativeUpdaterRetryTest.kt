package space.dpos.android

import android.app.Activity
import android.app.AlertDialog
import android.os.Looper
import android.util.Base64
import org.json.JSONObject
import org.junit.After
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import org.robolectric.shadows.ShadowAlertDialog
import space.dpos.android.update.NativeUpdater
import space.dpos.android.update.ReleasePolicy
import java.io.ByteArrayInputStream
import java.io.File
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.security.KeyPairGenerator
import java.security.MessageDigest
import java.security.SecureRandom
import java.security.Signature
import java.security.spec.NamedParameterSpec
import java.time.Instant
import java.util.concurrent.ExecutorService
import java.util.concurrent.TimeUnit

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class NativeUpdaterRetryTest {
    private val updaters = mutableListOf<NativeUpdater>()
    private val activity = Robolectric.buildActivity(Activity::class.java).setup().get()
    private val prefs = activity.getSharedPreferences("native_release_312", Activity.MODE_PRIVATE)
    private val payload = "synthetic APK fixture, never installed".toByteArray()
    private val commit = "c".repeat(40)
    private val pair = KeyPairGenerator.getInstance("Ed25519").apply {
        val random = SecureRandom.getInstance("SHA1PRNG")
        random.setSeed("NativeUpdaterRetryTest fixture only".toByteArray())
        initialize(NamedParameterSpec("Ed25519"), random)
    }.generateKeyPair()
    private val pin = Base64.encodeToString(pair.public.encoded.takeLast(32).toByteArray(), Base64.NO_WRAP)
    private val now = System.currentTimeMillis()
    private fun hex(bytes: ByteArray) = bytes.joinToString("") { "%02x".format(it.toInt() and 255) }
    private fun canonical(obj: JSONObject): String = obj.keys().asSequence().toList().sorted()
        .joinToString(",", "{", "}") { key -> JSONObject.quote(key) + ":" + when (val value = obj.get(key)) {
            is JSONObject -> canonical(value)
            is String -> JSONObject.quote(value).replace("\\/", "/")
            else -> value.toString()
        } }
    private val manifest = JSONObject()
        .put("apk", "/downloads/dpos-space-4.2.0.apk")
        .put("certificateSha256", BuildConfig.DPOS_HISTORIC_CERT)
        .put("notBefore", Instant.ofEpochMilli(now - 2 * ReleasePolicy.DAY).truncatedTo(java.time.temporal.ChronoUnit.SECONDS).toString())
        .put("package", "space.dpos.android.debug")
        .put("publishedAt", Instant.ofEpochMilli(now - 3 * ReleasePolicy.DAY).truncatedTo(java.time.temporal.ChronoUnit.SECONDS).toString())
        .put("sha256", hex(MessageDigest.getInstance("SHA-256").digest(payload)))
        .put("sourceCommit", commit).put("versionCode", 140).put("versionName", "4.2.0")
    private val feed = run {
        val signer = Signature.getInstance("Ed25519")
        signer.initSign(pair.private)
        signer.update(("dpos.space/release/v1\n" + canonical(manifest)).toByteArray())
        canonical(JSONObject().put("manifest", manifest).put("publicKey", pin)
            .put("signature", Base64.encodeToString(signer.sign(), Base64.NO_WRAP))).toByteArray()
    }
    private val release = ReleasePolicy.parse(feed, pin, BuildConfig.DPOS_HISTORIC_CERT, BuildConfig.VERSION_CODE)
    private var apkRequests = 0
    private var provenanceValid = true
    private fun updater(owner: Activity = activity): NativeUpdater = NativeUpdater(owner, { url ->
        val bytes = when {
            url.path == ReleasePolicy.MANIFEST_PATH -> feed
            url.host == "api.github.com" && url.path.contains("/commits/") ->
                "{\"sha\":\"${if (provenanceValid) commit else "d".repeat(40)}\"}".toByteArray()
            url.host == "api.github.com" && url.path.contains("/contents/") ->
                JSONObject().put("path", release.repositoryPath).put("type", "file")
                    .put("sha", hex(MessageDigest.getInstance("SHA-1").digest("blob ${payload.size}\u0000".toByteArray() + payload)))
                    .put("size", payload.size).toString().toByteArray()
            url.path == release.apk -> { apkRequests++; null }
            else -> throw AssertionError("Unexpected updater URL: $url")
        }
        object : HttpURLConnection(url) {
            override fun connect() = Unit
            override fun disconnect() = Unit
            override fun usingProxy() = false
            override fun getResponseCode() = 200
            override fun getContentLengthLong() = (bytes?.size ?: payload.size).toLong()
            override fun getInputStream() = bytes?.let { ByteArrayInputStream(it) }
                ?: throw IOException("Synthetic offline APK failure")
        }
    }, pin).also { updaters += it }

    private fun settle(updater: NativeUpdater) {
        // Dispatch button listeners, wait for real updater IO, then drain main callbacks.
        shadowOf(Looper.getMainLooper()).idle()
        val field = NativeUpdater::class.java.getDeclaredField("worker").apply { isAccessible = true }
        (field.get(updater) as ExecutorService).submit {}.get(10, TimeUnit.SECONDS)
        shadowOf(Looper.getMainLooper()).idle()
    }
    private fun seedObservation(first: Long = now - ReleasePolicy.DAY - 1000) {
        prefs.edit().clear().putString("id", release.id).putInt("code", release.code)
            .putLong("first", first).putLong("last", now - 1000).commit()
    }
    private fun check(updater: NativeUpdater) { updater.check(); settle(updater) }
    private fun dialog(): AlertDialog {
        val dialog = ShadowAlertDialog.getLatestAlertDialog()
        assertNotNull("Expected updater dialog after eligible foreground check", dialog)
        return dialog!!
    }
    @After fun cleanup() { updaters.forEach { it.close() }; prefs.edit().clear().commit() }

    @Test fun laterDefersThisActivityButNewActivityCheckOffersAgain() {
        seedObservation()
        val first = updater()
        check(first)
        assertTrue(dialog().isShowing)
        dialog().getButton(AlertDialog.BUTTON_NEGATIVE).performClick()
        check(first)
        assertFalse("Repeated foreground checks must not nag after Later", dialog().isShowing)
        first.close()
        activity.finish()
        val reopened = updater(Robolectric.buildActivity(Activity::class.java).setup().get())
        check(reopened)
        assertTrue("A fresh activity updater must offer the eligible release again", dialog().isShowing)
        assertEquals(0, apkRequests)
        assertEquals(now - ReleasePolicy.DAY - 1000, prefs.getLong("first", 0))
    }

    @Test fun failedDownloadAcknowledgedThenForegroundCheckAllowsRetry() {
        seedObservation()
        val updater = updater()
        check(updater)
        dialog().getButton(AlertDialog.BUTTON_POSITIVE).performClick()
        settle(updater)
        val error = dialog()
        assertTrue(error.isShowing)
        assertEquals("Обновление недоступно", shadowOf(error).title.toString())
        assertFalse(File(activity.filesDir, "updates/${release.filename}").exists())
        check(updater)
        assertSame("Do not stack a prompt on an unacknowledged failure", error, dialog())
        error.getButton(AlertDialog.BUTTON_POSITIVE).performClick()
        shadowOf(Looper.getMainLooper()).idle()
        check(updater)
        assertTrue(dialog().isShowing)
        assertEquals("Доступно обновление DPoS Space 4.2.0", shadowOf(dialog()).title.toString())
        dialog().getButton(AlertDialog.BUTTON_POSITIVE).performClick()
        settle(updater)
        assertEquals(2, apkRequests)
        assertNull(shadowOf(activity).nextStartedActivity)
    }

    @Test fun oldPersistentNotificationDoesNotSuppressEligibleRelease() {
        seedObservation()
        prefs.edit().putString("notified", release.id).commit()
        val updater = updater()
        check(updater)
        assertTrue(dialog().isShowing)
        assertEquals(0, apkRequests)
    }

    @Test fun retryStillRequiresDelayProvenanceAndOpenLifecycle() {
        seedObservation(now - ReleasePolicy.DAY + 60_000)
        val updater = updater()
        check(updater)
        assertNull(ShadowAlertDialog.getLatestAlertDialog())
        seedObservation()
        provenanceValid = false
        check(updater)
        assertNull(ShadowAlertDialog.getLatestAlertDialog())
        provenanceValid = true
        updater.check()
        updater.close()
        val worker = NativeUpdater::class.java.getDeclaredField("worker").apply { isAccessible = true }
            .get(updater) as ExecutorService
        assertTrue(worker.awaitTermination(10, TimeUnit.SECONDS))
        shadowOf(Looper.getMainLooper()).idle()
        assertNull(ShadowAlertDialog.getLatestAlertDialog())
        assertEquals(0, apkRequests)
    }
}
