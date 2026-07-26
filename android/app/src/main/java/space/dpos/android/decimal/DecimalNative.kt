package space.dpos.android.decimal

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
import java.math.BigDecimal
import java.math.BigInteger
import java.net.HttpURLConnection
import java.net.URL
import java.text.Normalizer
import java.util.Locale

private val DECIMAL_HEX_ADDRESS = Regex("^(0x|dx)[0-9a-fA-F]{40}$")
private val DECIMAL_BECH32_ADDRESS = Regex("^d0[0-9a-z]{39}$")

object DecimalNativeSupport {
    const val CHAIN_ID = "decimal"
    const val AUTHORITY = "seed"
    const val DEFAULT_EVM_CHAIN_ID = 75L
    val supportedOperations: Set<String> = setOf("sendDELPreview", "sendDEL")

    fun defaultSeedRef(address: String): EncryptedKeyRef = EncryptedKeyRef(CHAIN_ID, normalizeAddress(address), AUTHORITY, AUTHORITY)

    fun validateSeed(seedPhrase: String): Boolean {
        val words = seedPhrase.trim().split(Regex("\\s+")).filter { it.isNotBlank() }
        return words.size in 12..24
    }

    fun isValidAddress(value: String): Boolean = runCatching { normalizeAddress(value); true }.getOrDefault(false)

    fun normalizeAddress(value: String): String {
        val text = value.trim().lowercase(Locale.ROOT)
        if (DECIMAL_HEX_ADDRESS.matches(text)) return "0x" + text.removePrefix("0x").removePrefix("dx")
        if (DECIMAL_BECH32_ADDRESS.matches(text)) {
            Bech32.decode(text, expectedPrefix = "d0")
            return text
        }
        throw IllegalArgumentException("invalid Decimal address")
    }

    fun deriveWallet(seedPhrase: String): DecimalWallet {
        val key = privateKeyFromMnemonic(seedPhrase)
        val pub = key.decompress().pubKeyPoint.getEncoded(false).drop(1).toByteArray()
        val hash = Keccak.Digest256().digest(pub)
        val evm = "0x" + hash.takeLast(20).toByteArray().toHex()
        return DecimalWallet(address = Bech32.encode("d0", evm.removePrefix("0x").hexToBytes()), evmAddress = evm)
    }

    fun previewTransfer(request: DecimalTransferRequest, seedPhrase: String): DecimalTransferResult = signTransfer(request, seedPhrase, previewOnly = true)

    fun executeTransfer(request: DecimalTransferRequest, seedPhrase: String, broadcaster: DecimalBroadcaster): DecimalTransferResult {
        val signed = signTransfer(request, seedPhrase, previewOnly = false)
        if (!signed.ok || signed.signedTx.isNullOrBlank()) return signed
        return try {
            val response = broadcaster.broadcast(signed.signedTx)
            signed.copy(status = "broadcast_sent", reason = "native Decimal DEL transaction was submitted through verified eth_sendRawTransaction broadcaster", previewOnly = false, broadcastResponse = response)
        } catch (error: Exception) {
            signed.copy(ok = false, status = "broadcast_error", reason = PayloadSanitizer.text(error.message, 300), previewOnly = false)
        }
    }

    private fun signTransfer(request: DecimalTransferRequest, seedPhrase: String, previewOnly: Boolean): DecimalTransferResult {
        if (!validateSeed(seedPhrase)) return DecimalTransferResult(false, "invalid_seed", "Decimal seed phrase must contain 12-24 words; no signing attempted", request)
        val wallet = deriveWallet(seedPhrase)
        val from = request.from?.let { normalizeAddress(it) }
        if (from != null && !wallet.matches(from)) {
            return DecimalTransferResult(false, "seed_address_mismatch", "seed-derived Decimal address does not match requested sender; no signing attempted", request, wallet = wallet, previewOnly = previewOnly)
        }
        val checked = request.copy(from = wallet.address, to = normalizeAddress(request.to))
        val signedTx = DecimalTransferSigner.sign(checked, seedPhrase)
        return DecimalTransferResult(true, if (previewOnly) "preview_ready" else "signed", if (previewOnly) "signed Decimal DEL transfer preview; not broadcast" else "signed Decimal DEL transfer ready for broadcaster", checked, wallet = wallet, signedTx = signedTx, previewOnly = previewOnly)
    }

    internal fun privateKeyForTest(seedPhrase: String): ECKey = privateKeyFromMnemonic(seedPhrase)

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
}

data class DecimalWallet(val address: String, val evmAddress: String) {
    fun matches(value: String): Boolean {
        val normalized = DecimalNativeSupport.normalizeAddress(value)
        return normalized.equals(address, ignoreCase = true) || normalized.equals(evmAddress, ignoreCase = true)
    }

    fun toJson(): JSONObject = JSONObject().put("address", address).put("evmAddress", evmAddress)
}

data class DecimalTransferRequest(
    val from: String? = null,
    val to: String,
    val amount: String,
    val nonce: Long,
    val gasPrice: BigInteger = BigInteger.valueOf(50_000_000_000L),
    val gasLimit: Long = 21_000L,
    val chainId: Long = DecimalNativeSupport.DEFAULT_EVM_CHAIN_ID
) {
    fun sanitizedJson(includeSignedTx: String? = null): JSONObject {
        val obj = JSONObject()
            .put("chainId", "decimal")
            .put("evmChainId", chainId)
            .put("operation", "sendDEL")
            .put("from", from ?: JSONObject.NULL)
            .put("to", to)
            .put("amount", amount)
            .put("nonce", nonce)
            .put("gasPrice", gasPrice.toString())
            .put("gasLimit", gasLimit)
        if (!includeSignedTx.isNullOrBlank()) obj.put("signedTx", includeSignedTx)
        return obj
    }
}

data class DecimalTransferResult(
    val ok: Boolean,
    val status: String,
    val reason: String,
    val request: DecimalTransferRequest,
    val wallet: DecimalWallet? = null,
    val signedTx: String? = null,
    val previewOnly: Boolean = true,
    val broadcastResponse: JSONObject? = null
) {
    fun toJson(): JSONObject = JSONObject()
        .put("ok", ok)
        .put("status", status)
        .put("reason", PayloadSanitizer.text(reason, 300))
        .put("chainId", "decimal")
        .put("nativeSupport", if (previewOnly) "sendDELPreview" else "sendDEL")
        .put("previewOnly", previewOnly)
        .put("broadcasted", broadcastResponse != null)
        .put("wallet", wallet?.toJson() ?: JSONObject.NULL)
        .put("from", wallet?.address ?: JSONObject.NULL)
        .put("evmFrom", wallet?.evmAddress ?: JSONObject.NULL)
        .put("request", request.sanitizedJson(if (previewOnly) signedTx else null))
        .put("signedTx", if (!previewOnly && !signedTx.isNullOrBlank()) signedTx else JSONObject.NULL)
        .put("broadcastResponse", broadcastResponse ?: JSONObject.NULL)
}

interface DecimalBroadcaster {
    fun broadcast(signedTx: String): JSONObject
}

object DecimalBroadcastRequestBody {
    fun fromSignedTx(signedTx: String): String = JSONObject()
        .put("jsonrpc", "2.0")
        .put("id", 1)
        .put("method", "eth_sendRawTransaction")
        .put("params", listOf(signedTx))
        .toString()
}

object DecimalBroadcastResponseParser {
    fun parse(rawJson: String): JSONObject {
        val root = JSONObject(rawJson.ifBlank { "{}" })
        val error = root.optJSONObject("error")
        if (error != null) {
            val code = if (error.has("code")) " ${error.optInt("code")}" else ""
            val message = PayloadSanitizer.text(error.optString("message", "unknown Decimal JSON-RPC error"), 240)
            throw IllegalStateException("Decimal eth_sendRawTransaction error$code: $message")
        }
        val result = root.optString("result", "").trim()
        if (!Regex("^0x[0-9a-fA-F]{64}$").matches(result)) {
            throw IllegalStateException("Decimal eth_sendRawTransaction response did not include a 32-byte hex transaction hash")
        }
        return JSONObject().put("method", "eth_sendRawTransaction").put("hash", result)
    }
}

class HttpDecimalBroadcaster(private val web3Url: String = "https://node.decimalchain.com/web3/") : DecimalBroadcaster {
    override fun broadcast(signedTx: String): JSONObject {
        require(signedTx.startsWith("0x")) { "signed Decimal transaction must be a 0x-prefixed hex string" }
        val body = DecimalBroadcastRequestBody.fromSignedTx(signedTx).toByteArray(Charsets.UTF_8)
        val connection = (URL(web3Url).openConnection() as HttpURLConnection).apply {
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
            throw IllegalStateException("Decimal eth_sendRawTransaction HTTP $responseCode: $reason")
        }
        return DecimalBroadcastResponseParser.parse(responseText)
    }
}

object DecimalTransferCodec {
    fun decode(json: String?): DecimalTransferRequest {
        val obj = JSONObject(json.orEmpty())
        val to = obj.optString("to").trim()
        if (!DecimalNativeSupport.isValidAddress(to)) throw IllegalArgumentException("to must be a Decimal d0/dx/0x address")
        val from = obj.optString("from", "").trim().takeIf { it.isNotBlank() }
        if (from != null && !DecimalNativeSupport.isValidAddress(from)) throw IllegalArgumentException("from must be a Decimal d0/dx/0x address when provided")
        val amount = obj.optString("amount").trim().replace(',', '.')
        if (amountToWei(amount) <= BigInteger.ZERO) throw IllegalArgumentException("amount must be positive")
        val nonce = obj.optLong("nonce", 0L)
        if (nonce < 0) throw IllegalArgumentException("nonce must be a non-negative EVM nonce supplied by WebView/API")
        val gasPrice = obj.optString("gasPrice", "50000000000").trim().ifBlank { "50000000000" }.toBigIntegerOrNull()
            ?: throw IllegalArgumentException("gasPrice must be a positive integer in wei")
        if (gasPrice <= BigInteger.ZERO) throw IllegalArgumentException("gasPrice must be positive")
        val gasLimit = obj.optLong("gasLimit", 21_000L)
        if (gasLimit < 21_000L) throw IllegalArgumentException("gasLimit must be at least 21000")
        val chainId = obj.optLong("evmChainId", obj.optLong("chainId", DecimalNativeSupport.DEFAULT_EVM_CHAIN_ID))
        if (chainId <= 0) throw IllegalArgumentException("evmChainId must be positive")
        return DecimalTransferRequest(from = from, to = to, amount = amount, nonce = nonce, gasPrice = gasPrice, gasLimit = gasLimit, chainId = chainId)
    }
}

object DecimalTransferSigner {
    fun sign(request: DecimalTransferRequest, seedPhrase: String): String {
        val key = DecimalNativeSupport.privateKeyForTest(seedPhrase)
        val unsigned = encodeTransaction(request, includeEip155Placeholder = true, signature = null)
        val digestBytes = Keccak.Digest256().digest(unsigned)
        val digest = Sha256Hash.wrap(digestBytes)
        val signature = key.sign(digest)
        val recId = (0..3).firstOrNull { candidate -> ECKey.recoverFromSignature(candidate, signature, digest, false)?.pubKeyPoint == key.pubKeyPoint }
            ?: throw IllegalStateException("could not derive Decimal EVM recoverable signature id")
        val v = BigInteger.valueOf(request.chainId * 2 + 35 + recId)
        return "0x" + encodeTransaction(request, includeEip155Placeholder = false, signature = EthSignature(v, signature.r, signature.s)).toHex()
    }

    internal fun unsignedTransferForTest(request: DecimalTransferRequest): String = "0x" + encodeTransaction(request, includeEip155Placeholder = true, signature = null).toHex()

    private fun encodeTransaction(request: DecimalTransferRequest, includeEip155Placeholder: Boolean, signature: EthSignature?): ByteArray {
        val toHex = DecimalNativeSupport.normalizeAddress(request.to).let { if (it.startsWith("0x")) it else "0x" + Bech32.decode(it, "d0").toHex() }
        val base = mutableListOf(
            Rlp.bytes(BigInteger.valueOf(request.nonce).toMinimalBytes()),
            Rlp.bytes(request.gasPrice.toMinimalBytes()),
            Rlp.bytes(BigInteger.valueOf(request.gasLimit).toMinimalBytes()),
            Rlp.bytes(toHex.removePrefix("0x").hexToBytes()),
            Rlp.bytes(amountToWei(request.amount).toMinimalBytes()),
            Rlp.bytes(ByteArray(0))
        )
        if (signature != null) {
            base += Rlp.bytes(signature.v.toMinimalBytes())
            base += Rlp.bytes(signature.r.toMinimalBytes(32))
            base += Rlp.bytes(signature.s.toMinimalBytes(32))
        } else if (includeEip155Placeholder) {
            base += Rlp.bytes(BigInteger.valueOf(request.chainId).toMinimalBytes())
            base += Rlp.bytes(ByteArray(0))
            base += Rlp.bytes(ByteArray(0))
        }
        return Rlp.encodeList(*base.toTypedArray())
    }
}

data class EthSignature(val v: BigInteger, val r: BigInteger, val s: BigInteger)

fun amountToWei(value: String): BigInteger {
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
        return if (payload.size <= 55) byteArrayOf((0xc0 + payload.size).toByte()) + payload
        else {
            val len = BigInteger.valueOf(payload.size.toLong()).toMinimalBytes()
            byteArrayOf((0xf7 + len.size).toByte()) + len + payload
        }
    }
}

private object Bech32 {
    private const val CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l"
    private val GENERATOR = intArrayOf(0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3)

    fun encode(hrp: String, bytes: ByteArray): String {
        val data = convertBits(bytes.map { it.toInt() and 0xff }, 8, 5, true)
        val checksum = createChecksum(hrp, data)
        return hrp + "1" + (data + checksum).joinToString("") { CHARSET[it].toString() }
    }

    fun decode(value: String, expectedPrefix: String): ByteArray {
        val text = value.lowercase(Locale.ROOT)
        val pos = text.lastIndexOf('1')
        if (pos <= 0) throw IllegalArgumentException("invalid bech32 address")
        val hrp = text.substring(0, pos)
        if (hrp != expectedPrefix) throw IllegalArgumentException("invalid bech32 prefix")
        val data = text.substring(pos + 1).map { CHARSET.indexOf(it).also { idx -> if (idx < 0) throw IllegalArgumentException("invalid bech32 character") } }
        if (!verifyChecksum(hrp, data)) throw IllegalArgumentException("invalid bech32 checksum")
        return convertBits(data.dropLast(6), 5, 8, false).map { it.toByte() }.toByteArray()
    }

    private fun hrpExpand(hrp: String): List<Int> = hrp.map { it.code shr 5 } + listOf(0) + hrp.map { it.code and 31 }
    private fun polymod(values: List<Int>): Int {
        var chk = 1
        for (value in values) {
            val top = chk ushr 25
            chk = (chk and 0x1ffffff shl 5) xor value
            for (i in 0..4) if (((top ushr i) and 1) == 1) chk = chk xor GENERATOR[i]
        }
        return chk
    }
    private fun createChecksum(hrp: String, data: List<Int>): List<Int> {
        val mod = polymod(hrpExpand(hrp) + data + listOf(0, 0, 0, 0, 0, 0)) xor 1
        return (0..5).map { (mod ushr (5 * (5 - it))) and 31 }
    }
    private fun verifyChecksum(hrp: String, data: List<Int>): Boolean = polymod(hrpExpand(hrp) + data) == 1
    private fun convertBits(data: List<Int>, fromBits: Int, toBits: Int, pad: Boolean): List<Int> {
        var acc = 0
        var bits = 0
        val ret = mutableListOf<Int>()
        val maxv = (1 shl toBits) - 1
        val maxAcc = (1 shl (fromBits + toBits - 1)) - 1
        for (value in data) {
            acc = ((acc shl fromBits) or value) and maxAcc
            bits += fromBits
            while (bits >= toBits) {
                bits -= toBits
                ret += (acc shr bits) and maxv
            }
        }
        if (pad && bits > 0) ret += (acc shl (toBits - bits)) and maxv
        else if (!pad && (bits >= fromBits || ((acc shl (toBits - bits)) and maxv) != 0)) throw IllegalArgumentException("invalid bech32 padding")
        return ret
    }
}

private fun String.hexToBytes(): ByteArray = chunked(2).map { it.toInt(16).toByte() }.toByteArray()
private fun BigInteger.toMinimalBytes(size: Int? = null): ByteArray {
    val raw = if (this == BigInteger.ZERO) ByteArray(0) else this.toByteArray().dropWhile { it == 0.toByte() }.toByteArray()
    return if (size == null) raw else ByteArray((size - raw.size).coerceAtLeast(0)) + raw
}
private fun ByteArray.toHex(): String = joinToString("") { "%02x".format(it) }
