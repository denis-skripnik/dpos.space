package space.dpos.android.upvoter

import org.bitcoinj.core.DumpedPrivateKey
import org.bitcoinj.core.ECKey
import org.bitcoinj.core.Sha256Hash
import org.bitcoinj.params.MainNetParams
import org.json.JSONArray
import org.json.JSONObject
import space.dpos.android.core.PayloadSanitizer
import space.dpos.android.storage.EncryptedKeyRef
import java.io.ByteArrayOutputStream
import java.math.BigInteger
import java.net.HttpURLConnection
import java.net.URL
import java.time.LocalDateTime
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import java.util.Locale

private const val GOLOS_CHAIN_ID = "782a3039b478c839e4cb0c941ff4eaeb7df40bdd68bd441afd444b9da763de12"
private const val DEFAULT_GOLOS_RPC = "https://golosapi.ecurrex.ru"

data class VoteOperation(
    val chainId: String,
    val voter: String,
    val author: String,
    val permlink: String,
    val weight: Int
) {
    fun toJson(): JSONObject = JSONObject()
        .put("type", "vote")
        .put("chainId", chainId)
        .put("voter", voter)
        .put("author", author)
        .put("permlink", permlink)
        .put("weight", weight.coerceIn(-10000, 10000))
}

data class BlockHeaderRef(
    val refBlockNum: Int,
    val refBlockPrefix: Long,
    val expirationEpochSeconds: Long,
    val headBlockId: String
)

data class SignedVotePayload(
    val operation: VoteOperation,
    val keyRef: EncryptedKeyRef,
    val signedTransaction: JSONObject,
    val previewOnly: Boolean = false
) {
    fun redactedJson(): JSONObject = JSONObject()
        .put("operation", operation.toJson())
        .put("keyRef", JSONObject()
            .put("chainId", keyRef.chainId)
            .put("account", keyRef.account)
            .put("authority", keyRef.authority)
            .put("alias", keyRef.alias))
        .put("signedTransaction", PayloadSanitizer.text(signedTransaction.toString(), 900))
        .put("previewOnly", previewOnly)
}

data class VoteBroadcastResult(
    val ok: Boolean,
    val status: String,
    val operation: VoteOperation,
    val reason: String,
    val payload: SignedVotePayload? = null,
    val rpcResponse: JSONObject? = null
) {
    fun toJson(): JSONObject = JSONObject()
        .put("ok", ok)
        .put("status", status)
        .put("reason", PayloadSanitizer.text(reason, 300))
        .put("operation", operation.toJson())
        .put("payload", payload?.redactedJson() ?: JSONObject.NULL)
        .put("rpcResponse", PayloadSanitizer.text(rpcResponse?.toString().orEmpty(), 900).ifBlank { JSONObject.NULL })
}

interface TransactionBuilder {
    fun build(operation: VoteOperation, header: BlockHeaderRef, signature: String? = null): JSONObject
    fun signingBytes(operation: VoteOperation, header: BlockHeaderRef): ByteArray
}

interface VoteSigner {
    fun sign(operation: VoteOperation, keyRef: EncryptedKeyRef?, privateWif: String?, header: BlockHeaderRef): VoteBroadcastResult
}

interface VoteBroadcaster {
    fun broadcast(signedTransaction: JSONObject): JSONObject
}

interface GolosRpcClient {
    fun getDynamicGlobalProperties(): JSONObject
    fun broadcastTransactionSynchronous(signedTransaction: JSONObject): JSONObject
}

class GolosTransactionBuilder(private val chainIdHex: String = GOLOS_CHAIN_ID) : TransactionBuilder {
    override fun build(operation: VoteOperation, header: BlockHeaderRef, signature: String?): JSONObject {
        val tx = JSONObject()
            .put("ref_block_num", header.refBlockNum)
            .put("ref_block_prefix", header.refBlockPrefix)
            .put("expiration", DateTimeFormatter.ISO_LOCAL_DATE_TIME.format(LocalDateTime.ofEpochSecond(header.expirationEpochSeconds, 0, ZoneOffset.UTC)))
            .put("operations", JSONArray().put(JSONArray().put("vote").put(JSONObject()
                .put("voter", operation.voter)
                .put("author", operation.author)
                .put("permlink", operation.permlink)
                .put("weight", operation.weight.coerceIn(-10000, 10000)))))
            .put("extensions", JSONArray())
            .put("signatures", JSONArray())
        if (!signature.isNullOrBlank()) tx.getJSONArray("signatures").put(signature)
        return tx
    }

    override fun signingBytes(operation: VoteOperation, header: BlockHeaderRef): ByteArray {
        val txBytes = ByteArrayOutputStream().apply {
            writeUInt16LE(header.refBlockNum)
            writeUInt32LE(header.refBlockPrefix)
            writeUInt32LE(header.expirationEpochSeconds)
            writeVarUInt(1)
            writeVarUInt(0) // Golos/Graphene vote operation id.
            writeGrapheneString(operation.voter)
            writeGrapheneString(operation.author)
            writeGrapheneString(operation.permlink)
            writeInt16LE(operation.weight.coerceIn(-10000, 10000))
            writeVarUInt(0) // extensions
        }.toByteArray()
        return hexToBytes(chainIdHex) + txBytes + ByteArray(32)
    }
}

class GolosVoteSigner(private val builder: TransactionBuilder = GolosTransactionBuilder()) : VoteSigner {
    override fun sign(operation: VoteOperation, keyRef: EncryptedKeyRef?, privateWif: String?, header: BlockHeaderRef): VoteBroadcastResult {
        if (keyRef == null) return VoteBroadcastResult(false, "missing_key_ref", operation, "secure key ref is absent; no signing or broadcast attempted")
        if (privateWif.isNullOrBlank()) return VoteBroadcastResult(false, "missing_private_key", operation, "secure key material is absent; no signing or broadcast attempted")
        if (operation.chainId.lowercase(Locale.ROOT) != "golos") return VoteBroadcastResult(false, "unsupported_chain", operation, "native Android signer currently supports Golos vote only")
        if (keyRef.chainId != "golos" || keyRef.account != operation.voter || keyRef.authority != "posting") {
            return VoteBroadcastResult(false, "key_scope_mismatch", operation, "posting key ref does not match Golos voter account")
        }
        val ecKey = try { ecKeyFromWif(privateWif) } catch (e: Exception) {
            return VoteBroadcastResult(false, "invalid_wif", operation, "posting key is not a valid WIF: ${PayloadSanitizer.text(e.message, 80)}")
        }
        val digest = Sha256Hash.wrap(org.bitcoinj.core.Sha256Hash.hash(builder.signingBytes(operation, header)))
        val signature = ecKey.sign(digest)
        val recId = (0..3).firstOrNull { candidate -> ECKey.recoverFromSignature(candidate, signature, digest, true)?.pubKeyPoint == ecKey.pubKeyPoint }
            ?: return VoteBroadcastResult(false, "signature_recovery_failed", operation, "could not derive compact recoverable signature id")
        val compact = ByteArrayOutputStream().apply {
            write(recId + 27 + 4)
            writePadded(signature.r)
            writePadded(signature.s)
        }.toByteArray().toHex()
        val tx = builder.build(operation, header, compact)
        return VoteBroadcastResult(true, "signed", operation, "signed Golos vote transaction locally", SignedVotePayload(operation, keyRef, tx))
    }

    private fun ecKeyFromWif(wif: String): ECKey = DumpedPrivateKey.fromBase58(MainNetParams.get(), wif).key
}

class HttpGolosRpcClient(private val endpoint: String = DEFAULT_GOLOS_RPC) : GolosRpcClient {
    override fun getDynamicGlobalProperties(): JSONObject {
        val result = post("database_api.get_dynamic_global_properties", JSONArray())
        return result.optJSONObject("result") ?: result
    }

    override fun broadcastTransactionSynchronous(signedTransaction: JSONObject): JSONObject =
        post("network_broadcast_api.broadcast_transaction_synchronous", JSONArray().put(signedTransaction))

    private fun post(method: String, params: JSONArray): JSONObject {
        val conn = (URL(endpoint).openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            connectTimeout = 10_000
            readTimeout = 20_000
            doOutput = true
            setRequestProperty("Content-Type", "application/json")
        }
        val body = JSONObject().put("jsonrpc", "2.0").put("id", 1).put("method", method).put("params", params).toString()
        conn.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
        val text = (if (conn.responseCode in 200..299) conn.inputStream else conn.errorStream).bufferedReader().use { it.readText() }
        val json = JSONObject(text)
        if (json.has("error")) throw IllegalStateException(PayloadSanitizer.text(json.get("error").toString(), 500))
        return json
    }
}

class GolosBroadcastClient(private val rpc: GolosRpcClient) : VoteBroadcaster {
    override fun broadcast(signedTransaction: JSONObject): JSONObject = rpc.broadcastTransactionSynchronous(signedTransaction)
}

object GolosTransactionHeaderFactory {
    fun fromDynamicGlobalProperties(props: JSONObject, expireSeconds: Long = 60): BlockHeaderRef {
        val headBlockNumber = props.optLong("head_block_number")
        val headBlockId = props.optString("head_block_id")
        require(headBlockNumber > 0 && headBlockId.length >= 16) { "missing head block reference" }
        val prefix = hexToBytes(headBlockId.substring(8, 16)).let { bytes ->
            ((bytes[0].toLong() and 0xffL)) or
                ((bytes[1].toLong() and 0xffL) shl 8) or
                ((bytes[2].toLong() and 0xffL) shl 16) or
                ((bytes[3].toLong() and 0xffL) shl 24)
        }
        val time = props.optString("time")
        val epoch = LocalDateTime.parse(time).toEpochSecond(ZoneOffset.UTC) + expireSeconds
        return BlockHeaderRef((headBlockNumber and 0xffff).toInt(), prefix, epoch, headBlockId)
    }
}

class VoteRuntime(
    private val rpcClient: GolosRpcClient,
    private val signer: VoteSigner = GolosVoteSigner(),
    private val broadcaster: VoteBroadcaster = GolosBroadcastClient(rpcClient)
) {
    fun preview(operation: VoteOperation, keyRef: EncryptedKeyRef?, privateWif: String?): VoteBroadcastResult {
        val header = GolosTransactionHeaderFactory.fromDynamicGlobalProperties(rpcClient.getDynamicGlobalProperties())
        val signed = signer.sign(operation, keyRef, privateWif, header)
        return if (signed.ok && signed.payload != null) {
            signed.copy(status = "preview_ready", reason = "preview/check built a signed transaction but did not broadcast", payload = signed.payload.copy(previewOnly = true))
        } else signed
    }

    fun execute(operation: VoteOperation, keyRef: EncryptedKeyRef?, privateWif: String?): VoteBroadcastResult {
        val header = GolosTransactionHeaderFactory.fromDynamicGlobalProperties(rpcClient.getDynamicGlobalProperties())
        val signed = signer.sign(operation, keyRef, privateWif, header)
        if (!signed.ok || signed.payload == null) return signed
        val response = broadcaster.broadcast(signed.payload.signedTransaction)
        return signed.copy(status = "broadcast_sent", reason = "signed transaction was submitted to configured Golos RPC", rpcResponse = response)
    }
}

object VoteOperationFixture {
    fun golosFavoriteVote(account: String = "denis", author: String = "alice", permlink: String = "hello", weight: Int = 10000): VoteOperation =
        VoteOperation(chainId = "golos", voter = account, author = author, permlink = permlink, weight = weight)

    fun unsignedPreviewPayload(operation: VoteOperation = golosFavoriteVote()): VoteBroadcastResult =
        VoteBroadcastResult(false, "missing_key_ref", operation, "secure key ref is absent; no signing or broadcast attempted")
}

private fun ByteArrayOutputStream.writeVarUInt(value: Int) {
    var v = value
    do {
        var b = v and 0x7f
        v = v ushr 7
        if (v > 0) b = b or 0x80
        write(b)
    } while (v > 0)
}

private fun ByteArrayOutputStream.writeGrapheneString(value: String) {
    val bytes = value.toByteArray(Charsets.UTF_8)
    writeVarUInt(bytes.size)
    write(bytes)
}

private fun ByteArrayOutputStream.writeUInt16LE(value: Int) {
    write(value and 0xff)
    write((value ushr 8) and 0xff)
}

private fun ByteArrayOutputStream.writeInt16LE(value: Int) = writeUInt16LE(value and 0xffff)

private fun ByteArrayOutputStream.writeUInt32LE(value: Long) {
    write((value and 0xff).toInt())
    write(((value ushr 8) and 0xff).toInt())
    write(((value ushr 16) and 0xff).toInt())
    write(((value ushr 24) and 0xff).toInt())
}

private fun ByteArrayOutputStream.writePadded(value: BigInteger) {
    val raw = value.toByteArray().dropWhile { it == 0.toByte() }.toByteArray()
    require(raw.size <= 32) { "signature integer too large" }
    write(ByteArray(32 - raw.size))
    write(raw)
}

private fun hexToBytes(hex: String): ByteArray {
    val clean = hex.trim()
    require(clean.length % 2 == 0) { "invalid hex length" }
    return ByteArray(clean.length / 2) { i -> clean.substring(i * 2, i * 2 + 2).toInt(16).toByte() }
}

private fun ByteArray.toHex(): String = joinToString("") { "%02x".format(it) }
