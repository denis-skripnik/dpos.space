package space.dpos.android

import android.util.Base64
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import space.dpos.android.update.ReleasePolicy
import java.security.KeyPairGenerator
import java.security.Signature
import java.security.MessageDigest
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.nio.file.Files

@RunWith(RobolectricTestRunner::class)
class ReleasePolicyTest {
    private val pair = KeyPairGenerator.getInstance("Ed25519").generateKeyPair()
    private val pin = Base64.encodeToString(pair.public.encoded.takeLast(32).toByteArray(), Base64.NO_WRAP)
    private val cert = "a".repeat(64)
    private val manifest = """{"apk":"/downloads/dpos-space-3.1.2.apk","certificateSha256":"$cert","notBefore":"2026-09-29T00:00:00Z","package":"space.dpos.android.debug","publishedAt":"2026-09-28T00:00:00Z","sha256":"${"b".repeat(64)}","sourceCommit":"${"c".repeat(40)}","versionCode":80,"versionName":"3.1.2"}"""

    private fun envelope(body: String = manifest, key: String = pin): ByteArray {
        val signature = Signature.getInstance("Ed25519")
        signature.initSign(pair.private)
        signature.update(("dpos.space/release/v1\n" + body).toByteArray())
        return """{"manifest":$body,"publicKey":"$key","signature":"${Base64.encodeToString(signature.sign(), Base64.NO_WRAP)}"}""".toByteArray()
    }

    private fun rejected(bytes: ByteArray, key: String = pin, installed: Int = 79) {
        try { ReleasePolicy.parse(bytes, key, cert, installed); fail("accepted invalid manifest") }
        catch (_: IllegalArgumentException) { }
    }

    @Test fun signatureSchemaPinAndCanonical() {
        assertEquals(80, ReleasePolicy.parse(envelope(), pin, cert, 79).code)
        rejected(envelope(), "")
        rejected(envelope(), Base64.encodeToString(ByteArray(32), Base64.NO_WRAP))
        rejected(envelope().toString(Charsets.UTF_8).replace("\"versionCode\":80", "\"versionCode\":81").toByteArray())
        rejected(envelope(manifest.replace("\"versionCode\":80", "\"versionCode\":80.0")))
        rejected(envelope(manifest.replace("\"versionCode\":80", "\"versionCode\":80,\"versionCode\":80")))
        rejected(envelope(manifest.replace("\"apk\":", "\"extra\":0,\"apk\":")))
        rejected(envelope(manifest.replace("\"sha256\":\"${"b".repeat(64)}\"", "\"sha256\":\"${"B".repeat(64)}\"")))
        rejected(envelope(manifest.replace("2026-09-29T00:00:00Z", "2026-09-28T01:00:00Z")))
        rejected(envelope(), installed = 80)
        rejected(envelope().toString(Charsets.UTF_8).replace("{\"manifest\"", "{ \"manifest\"").toByteArray())
        rejected(envelope().toString(Charsets.UTF_8).replace("\"signature\"", "\"signature\":\"x\",\"signature\"").toByteArray())
    }

    @Test fun durableTimeGate() {
        val release = ReleasePolicy.parse(envelope(), pin, cert, 79)
        val first = release.published + 1000
        assertFalse(ReleasePolicy.eligible(release, first, first, first + ReleasePolicy.DAY - 1))
        assertTrue(ReleasePolicy.eligible(release, first, first, first + ReleasePolicy.DAY))
        assertFalse(ReleasePolicy.eligible(release, first, first + ReleasePolicy.DAY, first))
        assertFalse(ReleasePolicy.eligible(release, release.published - 1, first, first + ReleasePolicy.DAY))
    }

    @Test fun pythonSignerCanonicalEnvelopeVerifiesInKotlin() {
        val temp = Files.createTempDirectory("dpos-python-signer-test-")
        try {
            // Actual project signer; no second hand-written fixture/signature implementation.
            val script = """import sys,json
sys.path.insert(0,sys.argv[1])
import release_signer as s
from pathlib import Path
key=Path(sys.argv[2]); m=json.loads(sys.argv[3]); password='synthetic-local-test-only'
s.operate({'mode':'init','password':password,'manifest':None},key)
r=s.operate({'mode':'sign','password':password,'manifest':m},key)
sys.stdout.buffer.write(s.canonical({'manifest':m,'publicKey':r['publicKey'],'signature':r['signature']})+bytes([10]))
"""
            val tools = generateSequence(java.io.File(System.getProperty("user.dir")).canonicalFile) { it.parentFile }
                .map { java.io.File(it, "tools") }.first { java.io.File(it, "release_signer.py").isFile }
            val proc = ProcessBuilder("python3", "-c", script, tools.canonicalPath,
                temp.resolve("key.pem").toString(), manifest.replace(cert, BuildConfig.DPOS_HISTORIC_CERT)).redirectErrorStream(true).start()
            val output = proc.inputStream.readBytes()
            assertEquals(output.toString(Charsets.UTF_8), 0, proc.waitFor())
            val actualPin = org.json.JSONObject(output.toString(Charsets.UTF_8)).getString("publicKey")
            assertEquals(80, ReleasePolicy.parse(output, actualPin, BuildConfig.DPOS_HISTORIC_CERT, 79).code)
            rejected(output, "")
        } finally {
            Files.list(temp).use { it.forEach { file -> Files.deleteIfExists(file) } }
            Files.deleteIfExists(temp)
        }
    }

    @Test fun streamedApkRequiresExactBytesLengthAndGitBlob() {
        val bytes = "SYNTHETIC APK FOR TEST ONLY".toByteArray()
        fun hex(data: ByteArray) = data.joinToString("") { "%02x".format(it.toInt() and 255) }
        val sha = hex(MessageDigest.getInstance("SHA-256").digest(bytes))
        val blob = hex(MessageDigest.getInstance("SHA-1").digest("blob ${bytes.size}\u0000".toByteArray() + bytes))
        val output = ByteArrayOutputStream()
        ReleasePolicy.copyVerified(ByteArrayInputStream(bytes), output, bytes.size.toLong(), 100, sha, blob)
        assertArrayEquals(bytes, output.toByteArray())
        for ((data, size, max, digest, git) in listOf(
            listOf("CHANGED".toByteArray(), bytes.size.toLong(), 100L, sha, blob),
            listOf(bytes, bytes.size.toLong() + 1, 100L, sha, blob),
            listOf(bytes, bytes.size.toLong(), 5L, sha, blob),
            listOf(bytes, bytes.size.toLong(), 100L, "0".repeat(64), blob),
            listOf(bytes, bytes.size.toLong(), 100L, sha, "0".repeat(40))
        )) {
            try {
                ReleasePolicy.copyVerified(ByteArrayInputStream(data as ByteArray), ByteArrayOutputStream(),
                    size as Long, max as Long, digest as String, git as String)
                fail("accepted altered artifact")
            } catch (_: IllegalArgumentException) { }
        }
    }
}
