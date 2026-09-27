package space.dpos.android.update

import android.util.Base64
import org.json.JSONObject
import java.nio.charset.StandardCharsets
import java.security.KeyFactory
import java.security.MessageDigest
import java.security.Signature
import java.security.spec.X509EncodedKeySpec
import java.time.Instant
import java.io.InputStream
import java.io.OutputStream

/** Wire format of tools/release_signer.py. Reject any noncanonical or ambiguous JSON. */
internal object ReleasePolicy {
    const val MANIFEST_PATH = "/downloads/dpos-space-3.1.2.manifest.json"
    const val APK_PATH = "/downloads/dpos-space-3.1.2.apk"
    const val HOST = "dpos.blinddev.xyz"
    private const val PREFIX = "dpos.space/release/v1\n"
    private val fields = setOf("apk", "sha256", "package", "certificateSha256", "versionCode", "versionName", "sourceCommit", "publishedAt", "notBefore")
    private val envelopeFields = setOf("manifest", "publicKey", "signature")
    private val hex64 = Regex("[0-9a-f]{64}")
    private val hex40 = Regex("[0-9a-f]{40}")

    data class Release(val sha256: String, val certificate: String, val code: Int, val commit: String,
                       val published: Long, val notBefore: Long, val id: String)

    fun parse(raw: ByteArray, pinnedKey: String, historicCert: String, installedCode: Int): Release {
        require(raw.size in 1..8192 && pinnedKey.isNotEmpty() && hex64.matches(historicCert))
        val text = raw.toString(StandardCharsets.UTF_8)
        require(text.toByteArray(StandardCharsets.UTF_8).contentEquals(raw))
        val canonicalText = if (text.endsWith('\n')) text.dropLast(1) else text
        val obj = JSONObject(canonicalText)
        require(obj.keys().asSequence().toSet() == envelopeFields && canonical(obj) == canonicalText)
        val manifest = obj.getJSONObject("manifest")
        require(manifest.keys().asSequence().toSet() == fields)
        fun string(field: String): String = (manifest.get(field) as? String)
            ?: throw IllegalArgumentException("invalid $field")
        require(string("apk") == APK_PATH && string("package") == "space.dpos.android.debug")
        require(string("versionName") == "3.1.2")
        val code = manifest.get("versionCode")
        require(code is Int && code == 80 && code > installedCode)
        val digest = string("sha256")
        val cert = string("certificateSha256")
        val commit = string("sourceCommit")
        require(hex64.matches(digest) && cert == historicCert && hex40.matches(commit))
        fun timestamp(field: String): Long {
            val value = string(field)
            require(Regex("\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}Z").matches(value))
            val instant = Instant.parse(value)
            require(instant.toString() == value)
            return instant.toEpochMilli()
        }
        val published = timestamp("publishedAt")
        val notBefore = timestamp("notBefore")
        require(notBefore - published >= DAY)
        val keyBytes = decode64(pinnedKey, 32)
        require(obj.getString("publicKey") == pinnedKey)
        val signature = decode64(obj.getString("signature"), 64)
        val spki = byteArrayOf(0x30, 0x2a, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x03, 0x21, 0x00) + keyBytes
        val verifier = Signature.getInstance("Ed25519")
        verifier.initVerify(KeyFactory.getInstance("Ed25519").generatePublic(X509EncodedKeySpec(spki)))
        verifier.update((PREFIX + canonical(manifest)).toByteArray(StandardCharsets.UTF_8))
        require(verifier.verify(signature))
        val id = sha256(raw).joinToString("") { "%02x".format(it.toInt() and 255) }
        return Release(digest, cert, code, commit, published, notBefore, id)
    }

    fun eligible(release: Release, firstSeen: Long, lastClock: Long, now: Long): Boolean =
        now >= lastClock && firstSeen >= release.published && now >= release.notBefore &&
            now >= firstSeen && now - firstSeen >= DAY

    const val DAY = 86_400_000L
    fun sha256(bytes: ByteArray): ByteArray = MessageDigest.getInstance("SHA-256").digest(bytes)

    /** Stream exact committed bytes, never accepting an oversized or truncated response. */
    fun copyVerified(input: InputStream, output: OutputStream, size: Long, max: Long,
                     expectedSha256: String, expectedBlobSha1: String) {
        require(size in 1..max && hex64.matches(expectedSha256) && hex40.matches(expectedBlobSha1))
        val sha = MessageDigest.getInstance("SHA-256")
        val git = MessageDigest.getInstance("SHA-1")
        git.update("blob $size\u0000".toByteArray(StandardCharsets.US_ASCII))
        var count = 0L
        val buffer = ByteArray(32768)
        while (true) {
            val n = input.read(buffer)
            if (n < 0) break
            count += n
            require(count <= size && count <= max)
            output.write(buffer, 0, n)
            sha.update(buffer, 0, n)
            git.update(buffer, 0, n)
        }
        output.flush()
        require(count == size && sha.digest().hex() == expectedSha256 && git.digest().hex() == expectedBlobSha1)
    }

    private fun ByteArray.hex() = joinToString("") { "%02x".format(it.toInt() and 255) }

    private fun decode64(text: String, length: Int): ByteArray {
        require(Base64.encodeToString(Base64.decode(text, Base64.NO_WRAP), Base64.NO_WRAP) == text)
        return Base64.decode(text, Base64.NO_WRAP).also { require(it.size == length) }
    }

    private fun canonical(obj: JSONObject): String = obj.keys().asSequence().toList().sorted().joinToString(",", "{", "}") { key ->
        quote(key) + ":" + when (val value = obj.get(key)) {
            is JSONObject -> canonical(value)
            is String -> quote(value)
            is Int -> value.toString()
            else -> throw IllegalArgumentException("unsupported JSON value")
        }
    }

    private fun quote(value: String): String = buildString {
        append('"')
        for (c in value) when (c) {
            '"' -> append("\\\"")
            '\\' -> append("\\\\")
            '\b' -> append("\\b")
            '\u000c' -> append("\\f")
            '\n' -> append("\\n")
            '\r' -> append("\\r")
            '\t' -> append("\\t")
            else -> if (c.code < 32) append("\\u%04x".format(c.code)) else append(c)
        }
        append('"')
    }
}
