package space.dpos.android.minter

import org.bitcoinj.core.ECKey
import org.bitcoinj.core.Sha256Hash
import org.bitcoinj.crypto.ChildNumber
import org.bitcoinj.crypto.DeterministicHierarchy
import org.bitcoinj.crypto.HDKeyDerivation
import org.bitcoinj.crypto.MnemonicCode
import org.bouncycastle.jcajce.provider.digest.Keccak
import org.json.JSONObject
import space.dpos.android.core.PayloadSanitizer
import space.dpos.android.storage.EncryptedKeyRef
import java.io.ByteArrayOutputStream
import java.math.BigDecimal
import java.math.BigInteger
import java.net.HttpURLConnection
import java.net.URL
import java.text.Normalizer
import java.util.Locale

private val MINTER_ADDRESS = Regex("^Mx[0-9a-fA-F]{40}$")

object MinterNativeSupport {
    const val CHAIN_ID = "minter"
    const val AUTHORITY = "seed"
    val supportedOperations: Set<String> = setOf("send")

    fun defaultSeedRef(address: String): EncryptedKeyRef = EncryptedKeyRef(CHAIN_ID, address.lowercase(Locale.ROOT), AUTHORITY, AUTHORITY)

    fun deriveAddress(seedPhrase: String): String {
        val key = privateKeyFromMnemonic(seedPhrase)
        val pub = key.decompress().pubKeyPoint.getEncoded(false).drop(1).toByteArray()
        val hash = Keccak.Digest256().digest(pub)
        return "Mx" + hash.takeLast(20).toByteArray().toHex()
    }

    fun validateSeed(seedPhrase: String): Boolean {
        val words = seedPhrase.trim().split(Regex("\\s+")).filter { it.isNotBlank() }
        return words.size in 12..24
    }

    fun signTransfer(request: MinterTransferRequest, seedPhrase: String, previewOnly: Boolean = true): MinterTransferResult {
        if (!validateSeed(seedPhrase)) return MinterTransferResult(false, "invalid_seed", "Minter seed phrase must contain 12-24 words; no signing attempted", request)
        val from = deriveAddress(seedPhrase)
        if (request.from != null && !from.equals(request.from, ignoreCase = true)) {
            return MinterTransferResult(false, "seed_address_mismatch", "seed-derived address does not match requested sender; no signing attempted", request, from = from)
        }
        val signedTx = MinterTransferSigner.sign(request.copy(from = from), seedPhrase)
        return MinterTransferResult(true, if (previewOnly) "preview_ready" else "signed", if (previewOnly) "signed Minter transfer preview; not broadcast" else "signed Minter transfer ready for broadcaster", request.copy(from = from), from = from, signedTx = signedTx, previewOnly = previewOnly)
    }

    fun executeTransfer(request: MinterTransferRequest, seedPhrase: String, broadcaster: MinterBroadcaster): MinterTransferResult {
        val signed = signTransfer(request, seedPhrase, previewOnly = false)
        if (!signed.ok || signed.signedTx.isNullOrBlank()) return signed
        return try {
            val response = broadcaster.broadcast(signed.signedTx)
            signed.copy(status = "broadcast_sent", reason = "native Minter SEND transaction was submitted through verified send_transaction broadcaster", previewOnly = false, broadcastResponse = response)
        } catch (error: Exception) {
            signed.copy(ok = false, status = "broadcast_error", reason = error.message ?: "native Minter broadcast failed", previewOnly = false)
        }
    }

    private fun privateKeyFromMnemonic(seedPhrase: String): ECKey {
        val normalized = Normalizer.normalize(seedPhrase.trim().lowercase(Locale.ROOT), Normalizer.Form.NFKD)
        val seed = MnemonicCode.toSeed(normalized.split(Regex("\\s+")).filter { it.isNotBlank() }, "")
        val master = HDKeyDerivation.createMasterPrivateKey(seed)
        val hierarchy = DeterministicHierarchy(master)
        val path = listOf(
            ChildNumber(44, true),
            ChildNumber(60, true),
            ChildNumber(0, true),
            ChildNumber.ZERO,
            ChildNumber.ZERO
        )
        return ECKey.fromPrivate(hierarchy.get(path, false, true).privKeyBytes, true)
    }

    internal fun privateKeyForTest(seedPhrase: String): ECKey = privateKeyFromMnemonic(seedPhrase)
}


interface MinterBroadcaster {
    fun broadcast(signedTx: String): JSONObject
}

object MinterBroadcastRequestBody {
    fun fromSignedTx(signedTx: String): String = JSONObject().put("tx", signedTx).toString()
}

object MinterBroadcastResponseParser {
    fun parse(rawJson: String): JSONObject {
        val root = JSONObject(rawJson.ifBlank { "{}" })
        val data = root.optJSONObject("data") ?: root
        val tx = data.optJSONObject("transaction")
        if (tx != null) {
            val code = tx.optInt("code", 0)
            if (code > 0) {
                val log = tx.optString("log", "")
                throw IllegalStateException("Transaction included in the block with error code $code${if (log.isBlank()) "" else ": $log"}")
            }
            return tx
        }
        if (data.has("hash")) return JSONObject().put("hash", data.optString("hash"))
        return data
    }
}

class HttpMinterBroadcaster(private val apiBase: String = "https://api.minter.one/v2") : MinterBroadcaster {
    override fun broadcast(signedTx: String): JSONObject {
        require(signedTx.startsWith("0x")) { "signed Minter transaction must be a 0x-prefixed hex string" }
        val url = URL("${apiBase.trimEnd('/')}/send_transaction")
        val body = MinterBroadcastRequestBody.fromSignedTx(signedTx).toByteArray(Charsets.UTF_8)
        val connection = (url.openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            connectTimeout = 15_000
            readTimeout = 20_000
            doOutput = true
            setRequestProperty("Content-Type", "application/json")
            setRequestProperty("Accept", "application/json")
        }
        connection.outputStream.use { it.write(body) }
        val responseCode = connection.responseCode
        val responseText = try {
            val stream = if (responseCode in 200..299) connection.inputStream else connection.errorStream
            stream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() }.orEmpty()
        } finally {
            connection.disconnect()
        }
        if (responseCode !in 200..299) {
            val reason = PayloadSanitizer.text(responseText.ifBlank { "HTTP $responseCode" }, 300)
            throw IllegalStateException("Minter send_transaction HTTP $responseCode: $reason")
        }
        return MinterBroadcastResponseParser.parse(responseText)
    }
}

data class MinterTransferRequest(
    val from: String? = null,
    val to: String,
    val amount: String,
    val coinId: Long = 0,
    val gasCoinId: Long = 0,
    val nonce: Long,
    val memo: String = "",
    val chainId: Int = 1,
    val gasPrice: Long = 1
) {
    fun sanitizedJson(includeSignedTx: String? = null, status: String? = null): JSONObject {
        val obj = JSONObject()
            .put("chainId", "minter")
            .put("operation", "send")
            .put("from", from ?: JSONObject.NULL)
            .put("to", to)
            .put("amount", amount)
            .put("coinId", coinId)
            .put("gasCoinId", gasCoinId)
            .put("nonce", nonce)
            .put("memo", memo)
        if (!includeSignedTx.isNullOrBlank()) obj.put("signedTx", includeSignedTx)
        if (!status.isNullOrBlank()) obj.put("status", status)
        return obj
    }
}

data class MinterTransferResult(
    val ok: Boolean,
    val status: String,
    val reason: String,
    val request: MinterTransferRequest,
    val from: String? = null,
    val signedTx: String? = null,
    val previewOnly: Boolean = true,
    val broadcastResponse: JSONObject? = null
) {
    fun toJson(): JSONObject = JSONObject()
        .put("ok", ok)
        .put("status", status)
        .put("reason", PayloadSanitizer.text(reason, 300))
        .put("chainId", "minter")
        .put("nativeSupport", "send")
        .put("previewOnly", previewOnly)
        .put("broadcasted", broadcastResponse != null)
        .put("from", from ?: JSONObject.NULL)
        .put("request", request.sanitizedJson(if (previewOnly) signedTx else null, status))
        .put("signedTx", if (!previewOnly && !signedTx.isNullOrBlank()) signedTx else JSONObject.NULL)
        .put("broadcastResponse", broadcastResponse ?: JSONObject.NULL)
}

object MinterTransferCodec {
    fun decode(json: String?): MinterTransferRequest {
        val obj = JSONObject(json.orEmpty())
        val to = obj.optString("to").trim()
        if (!MINTER_ADDRESS.matches(to)) throw IllegalArgumentException("to must be a Minter Mx address")
        val from = obj.optString("from", "").trim().takeIf { it.isNotBlank() }
        if (from != null && !MINTER_ADDRESS.matches(from)) throw IllegalArgumentException("from must be a Minter Mx address when provided")
        val amount = obj.optString("amount").trim().replace(',', '.')
        if (amountToPip(amount) <= BigInteger.ZERO) throw IllegalArgumentException("amount must be positive")
        val nonce = obj.optLong("nonce", 0L)
        if (nonce <= 0) throw IllegalArgumentException("nonce must be a positive integer supplied by WebView/API")
        val coinId = numericId(obj, "coinId", "coin", 0L)
        val gasCoinId = numericId(obj, "gasCoinId", "gasCoin", 0L)
        if (coinId < 0 || gasCoinId < 0) throw IllegalArgumentException("coinId and gasCoinId must be non-negative numeric coin ids")
        return MinterTransferRequest(
            from = from,
            to = to,
            amount = amount,
            coinId = coinId,
            gasCoinId = gasCoinId,
            nonce = nonce,
            memo = obj.optString("memo", ""),
            chainId = obj.optInt("minterChainId", 1),
            gasPrice = obj.optLong("gasPrice", 1L).coerceAtLeast(1L)
        )
    }
}

private fun numericId(obj: JSONObject, preferred: String, fallback: String, default: Long): Long {
    val key = when {
        obj.has(preferred) -> preferred
        obj.has(fallback) -> fallback
        else -> return default
    }
    val raw = obj.opt(key)
    if (raw is Number) return raw.toLong()
    val text = (raw ?: "").toString().trim()
    if (!Regex("^\\d+$").matches(text)) throw IllegalArgumentException("$key must be a numeric Minter coin id; symbol lookup remains in WebView SDK")
    return text.toLong()
}

object MinterTransferSigner {
    fun sign(request: MinterTransferRequest, seedPhrase: String): String {
        val key = MinterNativeSupport.privateKeyForTest(seedPhrase)
        val unsigned = encodeTransaction(request, signatureData = ByteArray(0))
        val digestBytes = Keccak.Digest256().digest(unsigned)
        val digest = Sha256Hash.wrap(digestBytes)
        val signature = key.sign(digest)
        val recId = (0..3).firstOrNull { candidate -> ECKey.recoverFromSignature(candidate, signature, digest, false)?.pubKeyPoint == key.pubKeyPoint }
            ?: throw IllegalStateException("could not derive Minter recoverable signature id")
        val signatureData = Rlp.encodeList(
            Rlp.bytes(BigInteger.valueOf((recId + 27).toLong()).toMinimalBytes()),
            Rlp.bytes(signature.r.toMinimalBytes(32)),
            Rlp.bytes(signature.s.toMinimalBytes(32))
        )
        return "0x" + encodeTransaction(request, signatureData).toHex()
    }

    internal fun unsignedTransferForTest(request: MinterTransferRequest): String = "0x" + encodeTransaction(request, signatureData = ByteArray(0)).toHex()

    private fun encodeTransaction(request: MinterTransferRequest, signatureData: ByteArray): ByteArray {
        val data = Rlp.encodeList(
            Rlp.bytes(BigInteger.valueOf(request.coinId).toMinimalBytes()),
            Rlp.bytes(hexAddress(request.to)),
            Rlp.bytes(amountToPip(request.amount).toMinimalBytes())
        )
        return Rlp.encodeList(
            Rlp.bytes(BigInteger.valueOf(request.nonce).toMinimalBytes()),
            Rlp.bytes(BigInteger.valueOf(request.chainId.toLong()).toMinimalBytes()),
            Rlp.bytes(BigInteger.valueOf(request.gasPrice).toMinimalBytes()),
            Rlp.bytes(BigInteger.valueOf(request.gasCoinId).toMinimalBytes()),
            Rlp.bytes(byteArrayOf(1)),
            Rlp.bytes(data),
            Rlp.bytes(request.memo.toByteArray(Charsets.UTF_8)),
            Rlp.bytes(ByteArray(0)),
            Rlp.bytes(byteArrayOf(1)),
            Rlp.bytes(signatureData)
        )
    }
}

fun amountToPip(value: String): BigInteger {
    val decimal = BigDecimal(value.trim()).setScale(18)
    return decimal.movePointRight(18).toBigIntegerExact()
}

private object Rlp {
    fun bytes(value: ByteArray): ByteArray = when {
        value.size == 1 && (value[0].toInt() and 0xff) < 0x80 -> value
        value.size <= 55 -> byteArrayOf((0x80 + value.size).toByte()) + value
        else -> {
            val len = BigInteger.valueOf(value.size.toLong()).toMinimalBytes()
            byteArrayOf((0xb7 + len.size).toByte()) + len + value
        }
    }

    fun encodeList(vararg encodedItems: ByteArray): ByteArray {
        val payload = encodedItems.fold(ByteArray(0)) { acc, item -> acc + item }
        return if (payload.size <= 55) {
            byteArrayOf((0xc0 + payload.size).toByte()) + payload
        } else {
            val len = BigInteger.valueOf(payload.size.toLong()).toMinimalBytes()
            byteArrayOf((0xf7 + len.size).toByte()) + len + payload
        }
    }
}

private fun hexAddress(value: String): ByteArray = value.removePrefix("Mx").chunked(2).map { it.toInt(16).toByte() }.toByteArray()
private fun BigInteger.toMinimalBytes(size: Int? = null): ByteArray {
    val raw = if (this == BigInteger.ZERO) ByteArray(0) else this.toByteArray().dropWhile { it == 0.toByte() }.toByteArray()
    return if (size == null) raw else ByteArray((size - raw.size).coerceAtLeast(0)) + raw
}
private fun ByteArray.toHex(): String = joinToString("") { "%02x".format(it) }
