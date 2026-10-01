package space.dpos.android

import android.content.Intent
import android.util.Base64
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import org.junit.Before
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import space.dpos.android.update.ReleasePolicy
import space.dpos.android.update.UpdateTransfer
import java.io.ByteArrayInputStream
import java.io.File
import java.security.KeyPairGenerator
import java.security.MessageDigest
import java.security.Signature

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class GenericReleaseUpdateTest {
    @Before fun resetProviderCacheForRobolectricDataDirectory() {
        // Android process roots are stable; Robolectric assigns a new filesDir per test.
        val cache = androidx.core.content.FileProvider::class.java.getDeclaredField("sCache")
        cache.isAccessible = true
        (cache.get(null) as MutableMap<*, *>).clear()
    }
    private val pair = KeyPairGenerator.getInstance("Ed25519").generateKeyPair()
    private val pin = Base64.encodeToString(pair.public.encoded.takeLast(32).toByteArray(), Base64.NO_WRAP)
    private val cert = "a".repeat(64)
    private val commit = "c".repeat(40)
    private fun hex(bytes: ByteArray) = bytes.joinToString("") { "%02x".format(it.toInt() and 255) }
    private fun sha(bytes: ByteArray) = hex(MessageDigest.getInstance("SHA-256").digest(bytes))
    private fun blob(bytes: ByteArray) = hex(MessageDigest.getInstance("SHA-1").digest("blob ${bytes.size}\u0000".toByteArray() + bytes))
    private fun manifest(version: String, code: Int, payload: ByteArray): JSONObject = JSONObject()
        .put("apk", "/downloads/dpos-space-$version.apk").put("certificateSha256", cert)
        .put("notBefore", "2026-09-29T00:00:00Z").put("package", "space.dpos.android.debug")
        .put("publishedAt", "2026-09-28T00:00:00Z").put("sha256", sha(payload))
        .put("sourceCommit", commit).put("versionCode", code).put("versionName", version)
    // Deliberately permits invalid values, so negative fixtures are also genuinely signed.
    private fun canonical(obj: JSONObject): String = obj.keys().asSequence().toList().sorted()
        .joinToString(",", "{", "}") { k -> JSONObject.quote(k).replace("\\/", "/") + ":" + when (val v = obj.get(k)) {
            is JSONObject -> canonical(v)
            is String -> JSONObject.quote(v).replace("\\/", "/")
            else -> v.toString()
        } }
    private fun signed(m: JSONObject): ByteArray {
        val s = Signature.getInstance("Ed25519")
        s.initSign(pair.private)
        s.update(("dpos.space/release/v1\n" + canonical(m)).toByteArray())
        return canonical(JSONObject().put("manifest", m).put("publicKey", pin)
            .put("signature", Base64.encodeToString(s.sign(), Base64.NO_WRAP))).toByteArray()
    }
    private fun parse(m: JSONObject, installed: Int = 80) = ReleasePolicy.parse(signed(m), pin, cert, installed)
    private fun reject(block: () -> Unit) {
        try { block(); fail("accepted invalid release boundary") } catch (_: IllegalArgumentException) { }
    }

    @Test fun twoFutureSignedReleasesThroughProvenanceStreamingIdentityAndInstaller() {
        val activity = Robolectric.buildActivity(space.dpos.android.ui.MainActivity::class.java).get()
        var observation: ReleasePolicy.Observation? = null
        var installed = 80
        for ((version, code) in listOf("3.1.3" to 81, "4.2.0" to 140)) {
            val payload = ByteArray(100_013) { ((it + code) % 251).toByte() } // multiple streaming buffers
            val release = parse(manifest(version, code, payload), installed)
            assertEquals("/downloads/dpos-space-$version.apk", release.apk)
            val first = release.published + code * 1000L + ReleasePolicy.DAY
            observation = ReleasePolicy.observe(release, observation, first)!!
            assertFalse(ReleasePolicy.eligible(release, observation.first, observation.last, first + ReleasePolicy.DAY - 1))
            val now = first + ReleasePolicy.DAY
            assertTrue(ReleasePolicy.eligible(release, observation.first, observation.last, now))
            val file = File(activity.filesDir, "updates/${release.filename}")
            var feedReads = 0
            var identityChecks = 0
            UpdateTransfer.transfer(release, file, 200_000, { feedReads++; parse(manifest(version, code, payload), installed) },
                { ReleasePolicy.eligible(release, observation.first, observation.last, now) },
                { ReleasePolicy.blobMetadata(release, "{\"sha\":\"$commit\"}",
                    JSONObject().put("path", release.repositoryPath).put("type", "file").put("sha", blob(payload))
                        .put("size", payload.size).toString(), 200_000) },
                { ByteArrayInputStream(payload) }, { identityChecks++; ReleasePolicy.identity(release,
                    activity.packageName, version, code.toLong(), cert, activity.packageName, installed, cert) })
            assertEquals(2, feedReads)
            assertEquals(1, identityChecks)
            assertArrayEquals(payload, file.readBytes())
            assertNull(org.robolectric.Shadows.shadowOf(activity).nextStartedActivity) // transfer never installs silently
            val intent = UpdateTransfer.installIntent(activity, file, release)
            assertEquals(Intent.ACTION_VIEW, intent.action)
            assertTrue(intent.data.toString().endsWith(release.filename))
            assertEquals(0, intent.flags and Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
            reject { UpdateTransfer.installIntent(activity, file, release.copy(version = "9.9.9", apk = "/downloads/dpos-space-9.9.9.apk")) }
            installed = code
            file.delete()
        }
    }

    @Test fun signedUnsafePathsWrongTypesAndNonNewerCodesAreRejected() {
        val payload = "synthetic fixture".toByteArray()
        for (path in listOf("https://evil.invalid/downloads/dpos-space-3.1.3.apk", "//evil.invalid/a.apk",
            "/downloads/../dpos-space-3.1.3.apk", "/downloads/%2e%2e/dpos-space-3.1.3.apk",
            "/downloads/dpos-space-3.1.3.apk?x=1", "/downloads/dpos-space-3.1.3.apk#x",
            "/downloads/dpos-space-3.1.2.apk", "/downloads\\dpos-space-3.1.3.apk")) {
            reject { parse(manifest("3.1.3", 81, payload).put("apk", path)) }
        }
        for (version in listOf("03.1.3", "3.01.3", "3.1.03", "3.1", "3.1.3-debug", "../x", "3.1.3+build", "3.1.3\n"))
            reject { parse(manifest(version, 81, payload)) }
        for (code in listOf<Any>(80, 79, 0, -1, "81", 81.0, true, 2147483648L))
            reject { parse(manifest("3.1.3", 81, payload).put("versionCode", code)) }
        reject { parse(manifest("3.1.3", 81, payload).put("versionName", 313)) }
        reject { parse(manifest("3.1.3", 81, payload).put("certificateSha256", "b".repeat(64))) }
        reject { parse(manifest("3.1.3", 81, payload).put("package", "space.dpos.android")) }
        reject { parse(manifest("3.1.3", 81, payload), 81) }
        val envelope = signed(manifest("3.1.3", 81, payload))
        reject { ReleasePolicy.parse(String(envelope).replace("3.1.3", "4.2.0").toByteArray(), pin, cert, 80) }
    }

    @Test fun observationCannotResignDowngradeOrResetClockAndNewerReleaseWaitsAgain() {
        val first = parse(manifest("3.1.3", 81, byteArrayOf(1)))
        val second = parse(manifest("4.2.0", 140, byteArrayOf(2)))
        val time = first.published + 1000
        val observed = ReleasePolicy.observe(first, null, time)!!
        val later = ReleasePolicy.observe(first, observed, time + ReleasePolicy.DAY)!!
        assertEquals(time, later.first)
        assertNull(ReleasePolicy.observe(first.copy(id = "changed"), later, later.last))
        assertNull(ReleasePolicy.observe(second, later, later.last - 1))
        val next = ReleasePolicy.observe(second, later, later.last + 1000)!!
        assertEquals(later.last + 1000, next.first)
        assertFalse(ReleasePolicy.eligible(second, next.first, next.last, next.first))
        assertNull(ReleasePolicy.observe(first, next, next.last + 1000))
        assertNull(ReleasePolicy.observe(first, null, first.published - 1))
    }

    @Test fun metadataIdentityAndCancellationFailClosed() {
        val payload = "test bytes".toByteArray()
        val release = parse(manifest("3.1.3", 81, payload))
        fun metadata(path: String = release.repositoryPath, type: String = "file", hash: String = blob(payload), size: Any = payload.size) =
            JSONObject().put("path", path).put("type", type).put("sha", hash).put("size", size).toString()
        for (content in listOf(metadata(path = "downloads/dpos-space-3.1.2.apk"), metadata(type = "symlink"),
            metadata(hash = "0"), metadata(size = "10"), metadata(size = 10.5), metadata(size = 0), metadata(size = 9999)))
            reject { ReleasePolicy.blobMetadata(release, "{\"sha\":\"$commit\"}", content, 100) }
        reject { ReleasePolicy.blobMetadata(release, "{\"sha\":\"${"d".repeat(40)}\"}", metadata(), 100) }
        fun identity(pkg: String = "space.dpos.android.debug", version: String = release.version, code: Long = 81,
                     apkCert: String? = cert, installedCert: String? = cert, installed: Int = 80) =
            ReleasePolicy.identity(release, pkg, version, code, apkCert, "space.dpos.android.debug", installed, installedCert)
        assertTrue(identity())
        assertFalse(identity(pkg = "evil.package")); assertFalse(identity(version = "3.1.2"))
        assertFalse(identity(code = 82)); assertFalse(identity(installed = 81))
        assertFalse(identity(apkCert = null)); assertFalse(identity(installedCert = "b".repeat(64)))
        val activity = Robolectric.buildActivity(space.dpos.android.ui.MainActivity::class.java).get()
        val file = File(activity.filesDir, "updates/${release.filename}")
        for (cancelBefore in listOf(true, false)) {
            var eligibleCalls = 0
            var downloads = 0
            reject { UpdateTransfer.transfer(release, file, 100, { release },
                { eligibleCalls++; !cancelBefore && eligibleCalls == 1 },
                { blob(payload) to payload.size.toLong() }, { downloads++; ByteArrayInputStream(payload) }, { true }) }
            assertEquals(if (cancelBefore) 0 else 1, downloads)
            assertFalse(file.exists())
        }
    }
}
