package space.dpos.android.upvoter

import org.bitcoinj.core.Base58
import org.bitcoinj.core.DumpedPrivateKey
import org.bitcoinj.core.ECKey
import org.bitcoinj.core.Sha256Hash
import org.bitcoinj.params.MainNetParams
import org.json.JSONArray
import org.json.JSONObject
import org.bouncycastle.crypto.digests.RIPEMD160Digest
import org.bouncycastle.crypto.ec.CustomNamedCurves
import space.dpos.android.core.PayloadSanitizer
import space.dpos.android.notifications.GolosHistoryClient
import space.dpos.android.notifications.HistoryEvent
import space.dpos.android.storage.EncryptedKeyRef
import java.io.ByteArrayOutputStream
import java.math.BigInteger
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import java.security.SecureRandom
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec
import java.time.LocalDateTime
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import java.util.Locale

private const val GOLOS_CHAIN_ID = "782a3039b478c839e4cb0c941ff4eaeb7df40bdd68bd441afd444b9da763de12"
private const val HIVE_CHAIN_ID = "beeab0de00000000000000000000000000000000000000000000000000000000"
private const val STEEM_CHAIN_ID = "0000000000000000000000000000000000000000000000000000000000000000"
private const val VIZ_CHAIN_ID = "2040effda178d4fffff5eab7a915d4019879f5205cc5392e4bcced2b6edda0cd"
private const val DEFAULT_GOLOS_RPC = "https://golosapi.ecurrex.ru"
private const val DEFAULT_HIVE_RPC = "https://api.hive.blog"
private const val DEFAULT_STEEM_RPC = "https://api.steemit.com"
private const val DEFAULT_VIZ_RPC = "https://api.viz.world"

data class GrapheneChainSpec(
    val id: String,
    val networkChainIdHex: String,
    val defaultRpcEndpoint: String,
    val rpcEndpoints: List<String> = listOf(defaultRpcEndpoint),
    val publicKeyPrefix: String = "GLS",
    val voteOperationId: Int = 0,
    val postingAuthority: String = "posting",
    val legacyCallRpc: Boolean = false,
    val historyApiName: String = "condenser_api",
    val discussionApiName: String = "condenser_api",
    val nativeVoteSupported: Boolean = true,
    val nativeNotificationsSupported: Boolean = true,
    val notificationOps: List<String> = emptyList(),
    val asyncBroadcastOnly: Boolean = false
)

object GrapheneChainSpecs {
    private val specs = mapOf(
        "golos" to GrapheneChainSpec("golos", GOLOS_CHAIN_ID, DEFAULT_GOLOS_RPC, rpcEndpoints = listOf(DEFAULT_GOLOS_RPC, "https://api-full.golos.id", "https://apibeta.golos.today"), legacyCallRpc = true, historyApiName = "account_history", discussionApiName = "tags", notificationOps = listOf("content_mentions", "comment_mention", "comment", "custom_json", "transfer", "donate", "author_reward", "curation_reward", "comment_benefactor_reward"), asyncBroadcastOnly = true),
        "hive" to GrapheneChainSpec("hive", HIVE_CHAIN_ID, DEFAULT_HIVE_RPC, publicKeyPrefix = "STM", notificationOps = listOf("comment", "transfer", "transfer_to_vesting", "withdraw_vesting", "delegate_vesting_shares", "return_vesting_delegation", "author_reward", "curation_reward", "comment_benefactor_reward", "account_witness_vote", "proposal_create", "proposal_update", "proposal_delete")),
        "steem" to GrapheneChainSpec("steem", STEEM_CHAIN_ID, DEFAULT_STEEM_RPC, publicKeyPrefix = "STM", notificationOps = listOf("comment", "transfer", "transfer_to_vesting", "withdraw_vesting", "delegate_vesting_shares", "return_vesting_delegation", "author_reward", "curation_reward", "comment_benefactor_reward", "account_witness_vote", "producer_reward")),
        "viz" to GrapheneChainSpec("viz", VIZ_CHAIN_ID, DEFAULT_VIZ_RPC, rpcEndpoints = listOf(DEFAULT_VIZ_RPC, "https://node.viz.cx"), publicKeyPrefix = "VIZ", legacyCallRpc = true, historyApiName = "account_history", nativeVoteSupported = false, notificationOps = listOf("comment", "transfer", "award", "fixed_award", "receive_award", "benefactor_award"), asyncBroadcastOnly = true)
    )

    val supportedNativeVoteChains: Set<String> = specs.filterValues { it.nativeVoteSupported }.keys
    val supportedNativeNotificationChains: Set<String> = specs.filterValues { it.nativeNotificationsSupported }.keys

    fun find(chainId: String): GrapheneChainSpec? = specs[chainId.trim().lowercase(Locale.ROOT)]
    fun findVote(chainId: String): GrapheneChainSpec? = find(chainId)?.takeIf { it.nativeVoteSupported }
    fun require(chainId: String): GrapheneChainSpec = find(chainId) ?: throw IllegalArgumentException("unsupported native Graphene chain: $chainId")
    fun requireVote(chainId: String): GrapheneChainSpec = findVote(chainId) ?: throw IllegalArgumentException("unsupported native vote chain: $chainId")
}

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
    val rpcResponse: JSONObject? = null,
    val diagnostics: JSONObject? = null
) {
    fun toJson(): JSONObject = JSONObject()
        .put("ok", ok)
        .put("status", status)
        .put("reason", PayloadSanitizer.text(reason, 300))
        .put("operation", operation.toJson())
        .put("payload", payload?.redactedJson() ?: JSONObject.NULL)
        .put("rpcResponse", PayloadSanitizer.text(rpcResponse?.toString().orEmpty(), 900).ifBlank { JSONObject.NULL })
        .put("diagnostics", diagnostics ?: JSONObject.NULL)
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
    /** VIZ-only read-only lookup; other chains keep their existing confirmation paths. */
    fun getVizTransaction(transactionId: String): JSONObject? = null
    fun getBlock(blockNumber: Long): JSONObject?
    fun getAccount(account: String): JSONObject?
    /** Public content identity/parent proof for Golos automation; absent is not a root post. */
    fun getGolosContent(author: String, permlink: String): JSONObject? = null
    fun getActiveVotePercent(author: String, permlink: String, voter: String): Int? = null
    fun verifyAuthority(signedTransaction: JSONObject): Boolean
    fun verifyAuthorityDetailed(signedTransaction: JSONObject): JSONObject
    fun broadcastTransactionSynchronous(signedTransaction: JSONObject): JSONObject
}

class GrapheneTransactionBuilder(private val spec: GrapheneChainSpec) : TransactionBuilder {
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
        require(operation.chainId.trim().lowercase(Locale.ROOT) == spec.id) { "operation chain does not match ${spec.id}" }
        val txBytes = ByteArrayOutputStream().apply {
            writeUInt16LE(header.refBlockNum)
            writeUInt32LE(header.refBlockPrefix)
            writeUInt32LE(header.expirationEpochSeconds)
            writeVarUInt(1)
            writeVarUInt(spec.voteOperationId)
            writeGrapheneString(operation.voter)
            writeGrapheneString(operation.author)
            writeGrapheneString(operation.permlink)
            writeInt16LE(operation.weight.coerceIn(-10000, 10000))
            writeVarUInt(0)
        }.toByteArray()
        return hexToBytes(spec.networkChainIdHex) + txBytes
    }
}

class GolosTransactionBuilder(chainIdHex: String = GOLOS_CHAIN_ID) : TransactionBuilder by GrapheneTransactionBuilder(GrapheneChainSpec("golos", chainIdHex, DEFAULT_GOLOS_RPC, legacyCallRpc = true))

object GraphenePublicKey {
    fun fromWif(wif: String, prefix: String = "GLS"): String {
        val decoded = Base58.decodeChecked(wif)
        require(decoded.size == 33 || decoded.size == 34) { "invalid WIF payload length" }
        require(decoded[0] == 0x80.toByte()) { "invalid WIF version" }
        val privateKeyBytes = decoded.copyOfRange(1, 33)
        val key = ECKey.fromPrivate(privateKeyBytes, true)
        val pub = key.pubKey
        val digest = RIPEMD160Digest()
        digest.update(pub, 0, pub.size)
        val checksum = ByteArray(20)
        digest.doFinal(checksum, 0)
        return prefix + Base58.encode(pub + checksum.copyOfRange(0, 4))
    }

    fun matchesAuthority(publicKey: String, authority: JSONObject?): Boolean = authorityWeight(publicKey, authority) >= (authority?.optInt("weight_threshold", 1) ?: 1)

    fun authorityWeight(publicKey: String, authority: JSONObject?): Int {
        val keys = authority?.optJSONArray("key_auths") ?: return 0
        var weight = 0
        for (i in 0 until keys.length()) {
            val row = keys.optJSONArray(i) ?: continue
            if (row.optString(0) == publicKey) weight += row.optInt(1, 0)
        }
        return weight
    }

    fun authorityDiagnostics(publicKey: String, authority: JSONObject?): JSONObject {
        val keys = authority?.optJSONArray("key_auths") ?: JSONArray()
        val publicKeys = JSONArray()
        for (i in 0 until keys.length()) {
            val row = keys.optJSONArray(i) ?: continue
            publicKeys.put(row.optString(0))
        }
        return JSONObject()
            .put("derivedPublicKey", publicKey)
            .put("authorityPublicKeys", publicKeys)
            .put("derivedKeyWeight", authorityWeight(publicKey, authority))
            .put("weightThreshold", authority?.optInt("weight_threshold", 1) ?: 1)
    }
}

class GrapheneVoteSigner(
    private val spec: GrapheneChainSpec,
    private val builder: TransactionBuilder = GrapheneTransactionBuilder(spec)
) : VoteSigner {
    override fun sign(operation: VoteOperation, keyRef: EncryptedKeyRef?, privateWif: String?, header: BlockHeaderRef): VoteBroadcastResult {
        val operationChain = operation.chainId.trim().lowercase(Locale.ROOT)
        if (keyRef == null) return VoteBroadcastResult(false, "missing_key_ref", operation, "secure key ref is absent; no signing or broadcast attempted")
        if (privateWif.isNullOrBlank()) return VoteBroadcastResult(false, "missing_private_key", operation, "secure key material is absent; no signing or broadcast attempted")
        if (operationChain != spec.id) return VoteBroadcastResult(false, "unsupported_chain", operation, "native Android signer is configured for ${spec.id}, not $operationChain")
        if (keyRef.chainId != spec.id || keyRef.account != operation.voter || keyRef.authority != spec.postingAuthority) {
            return VoteBroadcastResult(false, "key_scope_mismatch", operation, "${spec.postingAuthority} key ref does not match ${spec.id} voter account")
        }
        val ecKey = try { ecKeyFromWif(privateWif) } catch (e: Exception) {
            return VoteBroadcastResult(false, "invalid_wif", operation, "posting key is not a valid WIF: ${PayloadSanitizer.text(e.message, 80)}")
        }
        val publicKey = GraphenePublicKey.fromWif(privateWif, spec.publicKeyPrefix)
        val digest = Sha256Hash.wrap(Sha256Hash.hash(builder.signingBytes(operation, header)))
        val compact = canonicalCompactSignatureHex(ecKey, digest)
            ?: return VoteBroadcastResult(false, "signature_recovery_failed", operation, "could not produce canonical compact recoverable signature")
        val recoveredPublicKey = recoverPublicKeyFromCompact(compact, digest, spec.publicKeyPrefix)
        if (recoveredPublicKey != publicKey) {
            return VoteBroadcastResult(false, "signature_public_key_mismatch", operation, "Android compact signature recovers ${recoveredPublicKey ?: "no public key"}, expected $publicKey; broadcast stopped before RPC", diagnostics = JSONObject().put("derivedPublicKey", publicKey).put("recoveredPublicKey", recoveredPublicKey ?: JSONObject.NULL).put("signatureHeader", compact.substring(0, 2).toInt(16)))
        }
        val tx = builder.build(operation, header, compact)
        return VoteBroadcastResult(true, "signed", operation, "signed ${spec.id} vote transaction locally", SignedVotePayload(operation, keyRef, tx), diagnostics = JSONObject()
            .put("derivedPublicKey", publicKey)
            .put("signatureHeader", compact.substring(0, 2).toInt(16))
            .put("refBlockNum", header.refBlockNum)
            .put("refBlockPrefix", header.refBlockPrefix)
            .put("expirationEpochSeconds", header.expirationEpochSeconds))
    }

    private fun ecKeyFromWif(wif: String): ECKey {
        val decoded = Base58.decodeChecked(wif)
        require(decoded.size == 33 || decoded.size == 34) { "invalid WIF payload length" }
        require(decoded[0] == 0x80.toByte()) { "invalid WIF version" }
        return ECKey.fromPrivate(decoded.copyOfRange(1, 33), true)
    }

    private fun recoverPublicKeyFromCompact(compactHex: String, digest: Sha256Hash, prefix: String): String? {
        val compact = ByteArray(compactHex.length / 2) { i -> compactHex.substring(i * 2, i * 2 + 2).toInt(16).toByte() }
        if (compact.size != 65) return null
        val recId = (compact[0].toInt() and 0xff) - 27 - 4
        if (recId !in 0..3) return null
        val r = BigInteger(1, compact.copyOfRange(1, 33))
        val s = BigInteger(1, compact.copyOfRange(33, 65))
        val recovered = ECKey.recoverFromSignature(recId, ECKey.ECDSASignature(r, s), digest, true) ?: return null
        val pub = recovered.pubKey
        val digest160 = RIPEMD160Digest()
        digest160.update(pub, 0, pub.size)
        val checksum = ByteArray(20)
        digest160.doFinal(checksum, 0)
        return prefix + Base58.encode(pub + checksum.copyOfRange(0, 4))
    }

    private fun canonicalCompactSignatureHex(ecKey: ECKey, digest: Sha256Hash): String? {
        repeat(100) { nonce ->
            val signature = deterministicEcdsaSignature(ecKey, digest, nonce).toCanonicalised()
            val recId = (0..3).firstOrNull { candidate -> ECKey.recoverFromSignature(candidate, signature, digest, true)?.pubKeyPoint == ecKey.pubKeyPoint }
                ?: return@repeat
            val compact = ByteArrayOutputStream().apply {
                write(recId + 27 + 4)
                writePadded(signature.r)
                writePadded(signature.s)
            }.toByteArray()
            if (isCanonicalCompactSignature(compact)) return compact.toHex()
        }
        return null
    }

    private fun deterministicEcdsaSignature(ecKey: ECKey, digest: Sha256Hash, nonce: Int): ECKey.ECDSASignature {
        val curve = CustomNamedCurves.getByName("secp256k1")
        val n = curve.n
        val message = digest.bytes
        val z = BigInteger(1, message)
        val d = ecKey.privKey
        var k = deterministicK(n, d, message, nonce)
        while (true) {
            val point = curve.g.multiply(k).normalize()
            val r = point.affineXCoord.toBigInteger().mod(n)
            val s = k.modInverse(n).multiply(z.add(d.multiply(r))).mod(n)
            if (r.signum() > 0 && s.signum() > 0) return ECKey.ECDSASignature(r, s)
            k = k.add(BigInteger.ONE).mod(n)
            if (k.signum() == 0) k = BigInteger.ONE
        }
    }

    private fun deterministicK(n: BigInteger, privateKey: BigInteger, message: ByteArray, nonce: Int): BigInteger {
        val x = privateKey.toBytes32()
        val effectiveMessage = if (nonce <= 0) message else sha256(message + ByteArray(nonce))
        var v = ByteArray(32) { 0x01 }
        var k = ByteArray(32) { 0x00 }
        k = hmacSha256(k, v + byteArrayOf(0x00) + x + effectiveMessage)
        v = hmacSha256(k, v)
        k = hmacSha256(k, v + byteArrayOf(0x01) + x + effectiveMessage)
        v = hmacSha256(k, v)
        while (true) {
            v = hmacSha256(k, v)
            val candidate = BigInteger(1, v)
            if (candidate.signum() > 0 && candidate < n) return candidate
            k = hmacSha256(k, v + byteArrayOf(0x00))
            v = hmacSha256(k, v)
        }
    }

    private fun hmacSha256(key: ByteArray, data: ByteArray): ByteArray {
        val mac = Mac.getInstance("HmacSHA256")
        mac.init(SecretKeySpec(key, "HmacSHA256"))
        return mac.doFinal(data)
    }

    private fun sha256(data: ByteArray): ByteArray = MessageDigest.getInstance("SHA-256").digest(data)

    private fun isCanonicalCompactSignature(signature: ByteArray): Boolean {
        if (signature.size != 65) return false
        return (signature[1].toInt() and 0x80) == 0 &&
            !(signature[1].toInt() == 0 && (signature[2].toInt() and 0x80) == 0) &&
            (signature[33].toInt() and 0x80) == 0 &&
            !(signature[33].toInt() == 0 && (signature[34].toInt() and 0x80) == 0)
    }
}

class GolosVoteSigner(builder: TransactionBuilder = GolosTransactionBuilder()) : VoteSigner by GrapheneVoteSigner(GrapheneChainSpecs.requireVote("golos"), builder)

class HttpGrapheneRpcClient(private val spec: GrapheneChainSpec, private val endpoint: String = spec.defaultRpcEndpoint) : GolosRpcClient {
    override fun getGolosContent(author: String, permlink: String): JSONObject? {
        if (spec.id != "golos") return null
        // Explicit Golos social_network optional arguments: no active votes needed.
        return postApi("social_network", "get_content", JSONArray().put(author).put(permlink).put(0).put(0))
            .optJSONObject("result")
    }
    override fun getVizTransaction(transactionId: String): JSONObject? {
        if (spec.id != "viz") return null
        require(transactionId.matches(Regex("[0-9a-fA-F]{40}"))) { "invalid transaction id" }
        val transaction = postApi("operation_history", "get_transaction", JSONArray().put(transactionId)).optJSONObject("result") ?: return null
        // Bind inclusion proof and LIB to the same endpoint (fallback keeps this envelope intact).
        return transaction.put("_vizHead", getDynamicGlobalProperties())
    }
    override fun getDynamicGlobalProperties(): JSONObject {
        val result = postApi("database_api", "get_dynamic_global_properties", JSONArray())
        return result.optJSONObject("result") ?: result
    }

    override fun getBlock(blockNumber: Long): JSONObject? {
        val result = postApi("database_api", "get_block", JSONArray().put(blockNumber))
        return result.optJSONObject("result")
    }

    override fun getAccount(account: String): JSONObject? {
        val clean = account.trim().removePrefix("@").lowercase(Locale.ROOT)
        val result = postApi("database_api", "get_accounts", JSONArray().put(JSONArray().put(clean)))
        val rows = result.optJSONArray("result") ?: return null
        return rows.optJSONObject(0)
    }

    override fun verifyAuthority(signedTransaction: JSONObject): Boolean =
        verifyAuthorityDetailed(signedTransaction).optBoolean("result", false)

    override fun verifyAuthorityDetailed(signedTransaction: JSONObject): JSONObject =
        postApiRaw("database_api", "verify_authority", JSONArray().put(signedTransaction), throwOnRpcError = false)

    override fun getActiveVotePercent(author: String, permlink: String, voter: String): Int? {
        if (spec.id != "golos") return null
        val rows = postApi("social_network", "get_active_votes", JSONArray().put(author).put(permlink))
            .getJSONArray("result")
        for (index in 0 until rows.length()) {
            val row = rows.getJSONObject(index)
            if (row.optString("voter") == voter) {
                // Golos `weight` is curation weight, NOT the voting percentage.
                return row.opt("percent")?.toString()?.toIntOrNull()?.takeIf { it in -10000..10000 }
            }
        }
        return null
    }

    fun broadcastMethodName(): String = if (spec.asyncBroadcastOnly) "broadcast_transaction" else "broadcast_transaction_synchronous"

    override fun broadcastTransactionSynchronous(signedTransaction: JSONObject): JSONObject =
        postApi("network_broadcast_api", broadcastMethodName(), JSONArray().put(signedTransaction))

    private fun postApi(api: String, methodName: String, params: JSONArray): JSONObject =
        postApiRaw(api, methodName, params, throwOnRpcError = true)

    private fun postApiRaw(api: String, methodName: String, params: JSONArray, throwOnRpcError: Boolean): JSONObject {
        val body = if (spec.legacyCallRpc) {
            JSONObject().put("jsonrpc", "2.0").put("id", 1).put("method", "call").put("params", JSONArray().put(api).put(methodName).put(params))
        } else {
            JSONObject().put("jsonrpc", "2.0").put("id", 1).put("method", "$api.$methodName").put("params", params)
        }
        return post(body, "$api.$methodName", throwOnRpcError)
    }

    private fun post(bodyJson: JSONObject, label: String = "rpc", throwOnRpcError: Boolean = true): JSONObject {
        val body = bodyJson.toString()
        try {
            val conn = (URL(endpoint).openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                connectTimeout = 10_000
                readTimeout = if (label.endsWith(".broadcast_transaction")) 8_000 else 20_000
                doOutput = true
                setRequestProperty("Content-Type", "application/json")
                setRequestProperty("User-Agent", "dpos.space-android-worker/1.0")
            }
            conn.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
            val responseCode = conn.responseCode
            val text = (if (responseCode in 200..299) conn.inputStream else conn.errorStream)
                .bufferedReader()
                .use { it.readText() }
            if (responseCode !in 200..299) throw IllegalStateException("Graphene RPC HTTP $responseCode at $endpoint via $label: ${PayloadSanitizer.text(text, 160)}")
            val json = JSONObject(text)
            if (throwOnRpcError && json.has("error")) throw IllegalStateException("Graphene RPC error at $endpoint via $label: ${PayloadSanitizer.text(json.get("error").toString(), 500)}")
            return json
        } catch (e: java.net.SocketTimeoutException) {
            throw IllegalStateException("timeout at $endpoint via $label", e)
        } catch (e: java.io.InterruptedIOException) {
            throw IllegalStateException("interrupted timeout at $endpoint via $label: ${PayloadSanitizer.text(e.message, 120)}", e)
        }
    }
}

class FallbackGrapheneRpcClient(private val clients: List<GolosRpcClient>) : GolosRpcClient {
    override fun getVizTransaction(transactionId: String): JSONObject? {
        // A node can lag in operation_history without a transport failure.
        for (client in clients) {
            val result = runCatching { client.getVizTransaction(transactionId) }.getOrNull()
            if (result != null) return result
        }
        return null
    }
    override fun getDynamicGlobalProperties(): JSONObject = call("dynamic properties") { it.getDynamicGlobalProperties() }
    override fun getBlock(blockNumber: Long): JSONObject? = call("block") { it.getBlock(blockNumber) }
    override fun getAccount(account: String): JSONObject? = call("account") { it.getAccount(account) }
    override fun getGolosContent(author: String, permlink: String): JSONObject? =
        call("content") { it.getGolosContent(author, permlink) }
    override fun getActiveVotePercent(author: String, permlink: String, voter: String): Int? =
        call("active vote") { it.getActiveVotePercent(author, permlink, voter) }
    override fun verifyAuthority(signedTransaction: JSONObject): Boolean = verifyAuthorityDetailed(signedTransaction).optBoolean("result", false)
    override fun verifyAuthorityDetailed(signedTransaction: JSONObject): JSONObject = call("verify authority") { it.verifyAuthorityDetailed(signedTransaction) }
    override fun broadcastTransactionSynchronous(signedTransaction: JSONObject): JSONObject = call("broadcast") { it.broadcastTransactionSynchronous(signedTransaction) }

    private fun <T> call(label: String, block: (GolosRpcClient) -> T): T {
        val errors = mutableListOf<String>()
        for (client in clients) {
            try {
                return block(client)
            } catch (e: Exception) {
                errors += "${e::class.java.simpleName}: ${PayloadSanitizer.text(e.message, 700)}"
            }
        }
        val detail = errors.takeLast(5).joinToString(" | ")
        throw IllegalStateException("all Graphene RPC endpoints failed for $label; errors=$detail")
    }
}

class HttpGolosRpcClient(endpoint: String = DEFAULT_GOLOS_RPC) : GolosRpcClient by HttpGrapheneRpcClient(GrapheneChainSpecs.require("golos"), endpoint)

class GolosBroadcastClient(private val rpc: GolosRpcClient) : VoteBroadcaster {
    override fun broadcast(signedTransaction: JSONObject): JSONObject = rpc.broadcastTransactionSynchronous(signedTransaction)
}

object GolosTransactionHeaderFactory {
    fun fromDynamicGlobalProperties(props: JSONObject, expireSeconds: Long = 60): BlockHeaderRef {
        val headBlockNumber = props.optLong("head_block_number")
        val headBlockId = props.optString("head_block_id")
        require(headBlockNumber > 0 && headBlockId.length >= 16) { "missing head block reference" }
        return fromBlockReference(headBlockNumber, headBlockId, props.optString("time"), expireSeconds)
    }

    fun fromGolosJsReference(props: JSONObject, previousBlock: JSONObject?, expireSeconds: Long = 60): BlockHeaderRef {
        val headBlockNumber = props.optLong("head_block_number")
        val previous = previousBlock?.optString("previous").orEmpty()
        require(headBlockNumber > 3 && previous.length >= 16) { "missing golos-js block reference" }
        return fromBlockReference(headBlockNumber - 3, previous, props.optString("time"), expireSeconds)
    }

    private fun fromBlockReference(refBlockNumberSource: Long, blockId: String, time: String, expireSeconds: Long): BlockHeaderRef {
        val prefix = hexToBytes(blockId.substring(8, 16)).let { bytes ->
            ((bytes[0].toLong() and 0xffL)) or
                ((bytes[1].toLong() and 0xffL) shl 8) or
                ((bytes[2].toLong() and 0xffL) shl 16) or
                ((bytes[3].toLong() and 0xffL) shl 24)
        }
        val epoch = LocalDateTime.parse(time).toEpochSecond(ZoneOffset.UTC) + expireSeconds
        return BlockHeaderRef((refBlockNumberSource and 0xffff).toInt(), prefix, epoch, blockId)
    }
}

class VoteRuntime(
    private val rpcClient: GolosRpcClient,
    private val signer: VoteSigner = GrapheneVoteSigner(GrapheneChainSpecs.requireVote("golos")),
    private val broadcaster: VoteBroadcaster = GolosBroadcastClient(rpcClient),
    private val historyClient: GolosHistoryClient? = null,
    private val confirmationRetries: Int = 2,
    private val confirmationDelayMs: Long = 1_500L,
    private val canAct: () -> Boolean = { true },
    private val pendingStore: PendingBroadcastStore? = null
) {
    private data class ConfirmationCheck(
        val event: HistoryEvent? = null,
        val status: String,
        val detail: String,
        val pagesScanned: Int = 0
    )

    private fun buildHeaderLikeGolosJs(): BlockHeaderRef {
        val props = rpcClient.getDynamicGlobalProperties()
        val head = props.optLong("head_block_number")
        val previousBlock = rpcClient.getBlock(head - 2)
        return GolosTransactionHeaderFactory.fromGolosJsReference(props, previousBlock)
    }

    fun previewUnsigned(operation: VoteOperation): JSONObject {
        val spec = GrapheneChainSpecs.requireVote(operation.chainId)
        val transaction = GrapheneTransactionBuilder(spec).build(operation, buildHeaderLikeGolosJs())
        return JSONObject().put("ok", true).put("status", "preview_ready")
            .put("operation", operation.toJson()).put("unsignedTx", transaction)
            .put("previewOnly", true).put("broadcasted", false)
    }

    fun preview(operation: VoteOperation, keyRef: EncryptedKeyRef?, privateWif: String?): VoteBroadcastResult {
        val header = buildHeaderLikeGolosJs()
        val signed = signer.sign(operation, keyRef, privateWif, header)
        return if (signed.ok && signed.payload != null) {
            signed.copy(status = "preview_ready", reason = "preview/check built a signed transaction but did not broadcast", payload = signed.payload.copy(previewOnly = true))
        } else signed
    }

    /** Auto-upvoter only: manual votes may still target comments. Never coerce JSON fields. */
    internal fun golosRootPostSkip(author: String, permlink: String): String? {
        val content = try { rpcClient.getGolosContent(author, permlink) } catch (_: Exception) { null }
            ?: return "root_post_unknown"
        if (content.opt("author") !is String || content.opt("author") != author ||
            content.opt("permlink") !is String || content.opt("permlink") != permlink ||
            content.opt("parent_author") !is String) return "root_post_unknown"
        return if (content.getString("parent_author").isEmpty()) null else "not_root_post"
    }

    fun execute(operation: VoteOperation, keyRef: EncryptedKeyRef?, privateWif: String?): VoteBroadcastResult {
        if (!canAct()) return VoteBroadcastResult(false, "cancelled", operation, "worker permission was revoked before signing")
        val fingerprint = "${operation.author}|${operation.permlink}|${operation.weight}"
        pendingStore?.readPending("vote", operation.chainId, operation.voter)?.let { pending ->
            val previousAuthor = pending.fingerprint.substringBefore('|')
            val previousWeight = pending.fingerprint.substringAfterLast('|').toIntOrNull()
            val previousPermlink = pending.fingerprint.substringAfter('|', "").substringBeforeLast('|', "")
            val previous = if (previousAuthor.isNotBlank() && previousPermlink.isNotBlank() && previousWeight != null && previousWeight in -10000..10000)
                operation.copy(author = previousAuthor, permlink = previousPermlink, weight = previousWeight) else null
            val check = if (previous != null) confirmVote(previous, pending.historyBaseline, pending.transactionId)
                else ConfirmationCheck(status = "unavailable", detail = "сохранённые параметры операции повреждены")
            val diagnostics = pendingDiagnostics(pending, previous, check)
            if (check.event != null && !pending.transactionId.isNullOrBlank()) {
                pendingStore.clearPending("vote", operation.chainId, operation.voter)
                if (pending.fingerprint == fingerprint) return VoteBroadcastResult(
                    true,
                    "broadcast_confirmed",
                    operation,
                    "Предыдущий голос за @${previous?.author}/${previous?.permlink} подтверждён в истории блокчейна на позиции #${check.event.index}; блокировка безопасно снята.",
                    diagnostics = diagnostics
                )
            } else {
                val oldTarget = if (previous != null) "@${previous.author}/${previous.permlink}, вес ${java.math.BigDecimal(previous.weight).movePointLeft(2).stripTrailingZeros().toPlainString()}%" else pending.fingerprint
                val reason = if (pending.transactionId.isNullOrBlank())
                    "Результат предыдущего голоса ($oldTarget) неизвестен: у сохранённой операции нет ID транзакции; совпадение полей или текущего веса не доказывает её личность (индексы истории разных узлов могут расходиться). Повторная отправка заблокирована. Скачайте журнал «Логи и диагностика» для ручной проверки; не сбрасывайте блокировку вслепую."
                else if (check.status == "unavailable")
                    "Результат предыдущего голоса ($oldTarget) неизвестен: проверка истории сейчас недоступна (${check.detail}). Повторная отправка заблокирована, чтобы не создать дубликат. Приложение повторит проверку в следующем цикле. Если ожидание сохраняется, скачайте журнал «Логи и диагностика»."
                else
                    "Результат предыдущего голоса ($oldTarget) неизвестен: в проверенных записях истории подтверждение пока не найдено (исходная позиция #${pending.historyBaseline}). Повторная отправка заблокирована, чтобы не создать дубликат. Это не подтверждение отказа сети. Приложение повторит проверку в следующем цикле; если ожидание сохраняется, скачайте журнал «Логи и диагностика»."
                return VoteBroadcastResult(false, "broadcast_unknown", operation, reason, diagnostics = diagnostics)
            }
        }
        // A fresh intent may be skipped before any send; this must never resolve a persisted unknown.
        if (operation.chainId == "golos" && operation.weight != 0 &&
            runCatching { rpcClient.getActiveVotePercent(operation.author, operation.permlink, operation.voter) }.getOrNull() == operation.weight) {
            return VoteBroadcastResult(true, "already_voted", operation,
                "Нужный голос за @${operation.author}/${operation.permlink} уже стоит в блокчейне; отправка не требуется.")
        }
        val header = buildHeaderLikeGolosJs()
        val authorityCheck = verifyPostingAuthority(operation, keyRef, privateWif)
        if (authorityCheck != null) return authorityCheck
        if (!canAct()) return VoteBroadcastResult(false, "cancelled", operation, "worker permission was revoked before signing")
        val signed = signer.sign(operation, keyRef, privateWif, header)
        if (!signed.ok || signed.payload == null) return signed
        val signedWithAuthority = signed.copy(diagnostics = mergeDiagnostics(signed.diagnostics, authorityDiagnostics(operation, privateWif)))
        val nodeAuthority = nodeVerifyAuthority(operation, signedWithAuthority)
        if (nodeAuthority != null) return nodeAuthority
        if (!canAct()) return signedWithAuthority.copy(ok = false, status = "cancelled", reason = "worker permission was revoked before broadcast")
        val baseline = try { historyClient?.let { TransactionConfirmation.baseline(it, operation.voter) } ?: -1L } catch (e: Exception) {
            return signedWithAuthority.copy(ok = false, status = "confirmation_baseline_error", reason = "could not establish history baseline before broadcast: ${PayloadSanitizer.text(e.message, 180)}")
        }
        if (!canAct()) return signedWithAuthority.copy(ok = false, status = "cancelled", reason = "worker permission was revoked during history lookup")
        val pending = PendingBroadcastIntent("vote", operation.chainId, operation.voter, fingerprint, baseline,
            transactionId = if (pendingStore != null) TransactionConfirmation.transactionId(GrapheneTransactionBuilder(GrapheneChainSpecs.requireVote(operation.chainId)).signingBytes(operation, header)) else null,
            createdAtMs = System.currentTimeMillis())
        pendingStore?.savePending(pending)
        if (!canAct()) {
            pendingStore?.clearPending("vote", operation.chainId, operation.voter)
            return signedWithAuthority.copy(ok = false, status = "cancelled", reason = "permission revoked before transport")
        }
        var sentPending = pending
        return try {
            val response = broadcaster.broadcast(signed.payload.signedTransaction)
            val txId = pending.transactionId
            sentPending = pending.copy(state = PendingBroadcastState.UNKNOWN)
            pendingStore?.savePending(sentPending)
            val confirmationCheck = confirmVote(operation, baseline, txId)
            val confirmation = confirmationCheck.event
            if (confirmation != null && (pendingStore == null || !txId.isNullOrBlank())) {
                pendingStore?.clearPending("vote", operation.chainId, operation.voter)
                signedWithAuthority.copy(status = "broadcast_confirmed", reason = "vote confirmed in ${operation.chainId} history: @${operation.voter} -> @${operation.author}/${operation.permlink} at #${confirmation.index}", rpcResponse = response, diagnostics = mergeDiagnostics(signedWithAuthority.diagnostics, JSONObject().put("confirmedHistoryIndex", confirmation.index).put("confirmedTimestamp", confirmation.timestamp)))
            } else if (historyClient != null) {
                val unknownPending = pending.copy(state = PendingBroadcastState.UNKNOWN, transactionId = txId)
                val detail = pendingDiagnostics(unknownPending, operation, confirmationCheck)
                val reason = if (confirmationCheck.status == "unavailable")
                    "Результат отправки голоса за @${operation.author}/${operation.permlink}, вес ${java.math.BigDecimal(operation.weight).movePointLeft(2).stripTrailingZeros().toPlainString()}%, неизвестен: проверка истории недоступна (${confirmationCheck.detail}). Повторная отправка заблокирована. Приложение повторит проверку в следующем цикле. Если ожидание сохраняется, скачайте журнал «Логи и диагностика»."
                else
                    "Результат отправки голоса за @${operation.author}/${operation.permlink}, вес ${java.math.BigDecimal(operation.weight).movePointLeft(2).stripTrailingZeros().toPlainString()}%, неизвестен: RPC ответил без ошибки, но подтверждение после позиции #$baseline пока не найдено. Повторная отправка заблокирована. Следующий шаг: повторить проверку истории позже."
                if (pendingStore == null) {
                    signedWithAuthority.copy(ok = false, status = "broadcast_unconfirmed", reason = "${operation.chainId} RPC accepted broadcast but vote was not found in account history after verification", rpcResponse = response)
                } else {
                    signedWithAuthority.copy(ok = false, status = "broadcast_unknown", reason = reason, rpcResponse = response, diagnostics = mergeDiagnostics(signedWithAuthority.diagnostics, detail))
                }
            } else {
                signedWithAuthority.copy(status = "broadcast_sent", reason = "signed transaction was submitted to configured ${operation.chainId} RPC", rpcResponse = response)
            }
        } catch (e: Exception) {
            if (e is InterruptedException) Thread.currentThread().interrupt()
            val unknown = sentPending.copy(state = PendingBroadcastState.UNKNOWN)
            pendingStore?.savePending(unknown)
            val classified = classifyBroadcastFailure(operation, signedWithAuthority, e)
            if (pendingStore != null) {
                val check = confirmVote(operation, baseline, unknown.transactionId)
                val diagnostics = mergeDiagnostics(signedWithAuthority.diagnostics, pendingDiagnostics(unknown, operation, check))
                if (check.event != null && !unknown.transactionId.isNullOrBlank()) {
                    pendingStore.clearPending("vote", operation.chainId, operation.voter)
                    signedWithAuthority.copy(ok = true, status = "broadcast_confirmed", reason = "Голос за @${operation.author}/${operation.permlink} подтверждён в истории на позиции #${check.event.index}, несмотря на ошибку ответа RPC.", diagnostics = diagnostics)
                } else {
                    val state = if (unknown.transactionId.isNullOrBlank()) "ID транзакции отсутствует; совпадение операции не доказывает её личность"
                        else if (check.status == "unavailable") "проверка истории недоступна (${check.detail})" else "подтверждение в доступной истории пока не найдено"
                    signedWithAuthority.copy(ok = false, status = "broadcast_unknown",
                        reason = "Результат отправки голоса за @${operation.author}/${operation.permlink} неизвестен: ошибка ответа RPC (${PayloadSanitizer.text(e.message, 180)}); $state. Повторная отправка заблокирована. Приложение повторит проверку истории; не отправляйте этот голос повторно вслепую.", diagnostics = diagnostics)
                }
            } else classified
        }
    }

    private fun nodeVerifyAuthority(operation: VoteOperation, signed: VoteBroadcastResult): VoteBroadcastResult? {
        val tx = signed.payload?.signedTransaction ?: return null
        val check = try { rpcClient.verifyAuthorityDetailed(tx) } catch (e: Exception) {
            return signed.copy(
                ok = false,
                status = "authority_verify_error",
                reason = "${operation.chainId} verify_authority failed before broadcast: ${PayloadSanitizer.text(e.message, 220)}",
                rpcResponse = JSONObject().put("error", PayloadSanitizer.text(e.message.orEmpty(), 500))
            )
        }
        if (check.optBoolean("result", false)) return null
        val detail = if (check.has("error")) "${check.opt("error")}" else check.toString()
        return signed.copy(
            ok = false,
            status = "authority_broadcast_mismatch",
            reason = "${operation.chainId} node verify_authority rejected signed vote before broadcast: ${PayloadSanitizer.text(detail, 260)}",
            rpcResponse = JSONObject().put("verify_authority", PayloadSanitizer.text(detail, 500))
        )
    }

    private fun confirmVote(operation: VoteOperation, baseline: Long, transactionId: String? = null): ConfirmationCheck {
        if (transactionId.isNullOrBlank() && pendingStore != null)
            return ConfirmationCheck(status = "identity_unavailable", detail = "ID транзакции отсутствует; поля операции и индекс истории не доказывают личность")
        val history = historyClient ?: return ConfirmationCheck(status = "unavailable", detail = "клиент истории не настроен")
        var lastCheck = ConfirmationCheck(status = "unavailable", detail = "проверка ещё не выполнена")
        var totalPages = 0
        repeat(confirmationRetries.coerceAtLeast(1)) { attempt ->
            if (attempt > 0 && confirmationDelayMs > 0) Thread.sleep(confirmationDelayMs)
            var from = -1L
            var limit = 30
            var pages = 0
            try {
                while (totalPages < 20) {
                    if (!canAct() || Thread.currentThread().isInterrupted) return ConfirmationCheck(status = "unavailable", detail = "проверка отменена", pagesScanned = totalPages)
                    val rows = history.getAccountHistory(operation.voter, from, limit)
                    pages += 1
                    totalPages += 1
                    val found = TransactionConfirmation.findCurrent(rows, baseline, transactionId) { event ->
                        event.type == "vote" &&
                            event.data["voter"].orEmpty().trim().removePrefix("@").lowercase(Locale.ROOT) == operation.voter &&
                            event.data["author"].orEmpty().trim().removePrefix("@").lowercase(Locale.ROOT) == operation.author &&
                            event.data["permlink"].orEmpty() == operation.permlink &&
                            event.data["weight"].orEmpty().toIntOrNull() == operation.weight
                    }
                    if (found != null) return ConfirmationCheck(found, "confirmed", "операция найдена в истории", pages)
                    if (rows.isEmpty()) {
                        lastCheck = ConfirmationCheck(status = "checked_not_found", detail = "в доступной истории операция не найдена", pagesScanned = totalPages)
                        return@repeat
                    }
                    val oldest = rows.minOf { it.index }
                    if (oldest <= baseline && transactionId.isNullOrBlank()) {
                        lastCheck = ConfirmationCheck(status = "checked_not_found", detail = "операция не найдена после исходной позиции", pagesScanned = totalPages)
                        return@repeat
                    }
                    val nextFrom = oldest - 1
                    if (nextFrom < 1 || (from >= 0 && nextFrom >= from)) break
                    from = nextFrom
                    // Graphene rejects low `from` values paired with a larger limit.
                    limit = minOf(30L, nextFrom.coerceAtLeast(1L)).toInt()
                }
                return ConfirmationCheck(status = "unavailable", detail = "полная область истории после исходной позиции не поместилась в безопасный лимит", pagesScanned = pages)
            } catch (e: Exception) {
                lastCheck = ConfirmationCheck(status = "unavailable", detail = PayloadSanitizer.text(e.message.orEmpty().ifBlank { e.javaClass.simpleName }, 180), pagesScanned = totalPages)
            }
        }
        return lastCheck
    }

    private fun extractTransactionId(response: JSONObject): String? {
        listOf("transaction_id", "trx_id").forEach { key ->
            response.optString(key).takeIf { it.isNotBlank() }?.let { return it }
        }
        val result = response.opt("result")
        if (result is JSONObject) {
            listOf("transaction_id", "trx_id").forEach { key ->
                result.optString(key).takeIf { it.isNotBlank() }?.let { return it }
            }
        }
        // Top-level `id` is the JSON-RPC request correlation id; generic result/id values are not trusted as transaction ids.
        return null
    }

    private fun pendingDiagnostics(pending: PendingBroadcastIntent, operation: VoteOperation?, check: ConfirmationCheck): JSONObject {
        val pendingOperation = JSONObject()
            .put("chain", pending.chainId)
            .put("account", pending.account)
            .put("author", operation?.author ?: JSONObject.NULL)
            .put("permlink", operation?.permlink ?: JSONObject.NULL)
            .put("weight", operation?.weight ?: JSONObject.NULL)
            .put("pendingTxId", pending.transactionId ?: JSONObject.NULL)
            .put("historyBaseline", pending.historyBaseline)
        val confirmation = JSONObject()
            .put("status", check.status)
            .put("checked", check.status != "unavailable" && check.status != "identity_unavailable")
            .put("detail", check.detail)
            .put("pagesScanned", check.pagesScanned)
        check.event?.let { confirmation.put("historyIndex", it.index).put("timestamp", it.timestamp) }
        val nextStep = if (check.event != null && !pending.transactionId.isNullOrBlank()) "Сохранённая блокировка снята после подтверждения в истории."
            else if (pending.transactionId.isNullOrBlank()) "ID транзакции отсутствует; автоматическая разблокировка невозможна. Скачайте журнал «Логи и диагностика» для ручной проверки; не отправляйте повторно вслепую."
            else if (check.status == "unavailable") "Приложение повторит проверку истории. Если ожидание сохраняется, скачайте журнал «Логи и диагностика»; не отправляйте голос повторно вслепую."
            else "Повторите проверку позже; автоматическая повторная отправка останется заблокированной до подтверждения."
        return JSONObject().put("pendingOperation", pendingOperation).put("confirmation", confirmation).put("nextStep", nextStep)
    }

    private fun mergeDiagnostics(first: JSONObject?, second: JSONObject?): JSONObject? {
        if (first == null && second == null) return null
        val merged = JSONObject()
        listOf(first, second).forEach { obj ->
            if (obj != null) {
                obj.keys().forEach { key -> merged.put(key, obj.opt(key)) }
            }
        }
        return merged
    }

    private fun authorityDiagnostics(operation: VoteOperation, privateWif: String?): JSONObject? {
        if (privateWif.isNullOrBlank()) return null
        return try {
            val spec = GrapheneChainSpecs.requireVote(operation.chainId)
            val publicKey = GraphenePublicKey.fromWif(privateWif, spec.publicKeyPrefix)
            val account = rpcClient.getAccount(operation.voter) ?: return null
            GraphenePublicKey.authorityDiagnostics(publicKey, account.optJSONObject(spec.postingAuthority))
        } catch (_: Exception) {
            null
        }
    }

    private fun classifyBroadcastFailure(operation: VoteOperation, signed: VoteBroadcastResult, error: Exception): VoteBroadcastResult {
        val message = error.message.orEmpty()
        if (message.contains("You have already voted in a similar way", ignoreCase = true)) {
            return signed.copy(
                ok = true,
                status = "already_voted",
                reason = "@${operation.voter} already voted this way for @${operation.author}/${operation.permlink}; auto-upvoter skipped duplicate as success",
                rpcResponse = JSONObject().put("classified", "already_voted").put("error", PayloadSanitizer.text(message, 500))
            )
        }
        if (message.contains("missing", ignoreCase = true) && message.contains("authority", ignoreCase = true)) {
            return signed.copy(
                ok = false,
                status = "authority_broadcast_mismatch",
                reason = PayloadSanitizer.text(message.ifBlank { "${operation.chainId} node rejected signed vote authority" }, 300),
                rpcResponse = JSONObject().put("classified", "authority_broadcast_mismatch").put("error", PayloadSanitizer.text(message, 500))
            )
        }
        return signed.copy(
            ok = false,
            status = "broadcast_error",
            reason = PayloadSanitizer.text(message.ifBlank { "native vote broadcast failed" }, 300),
            rpcResponse = JSONObject().put("error", PayloadSanitizer.text(message, 500))
        )
    }

    private fun verifyPostingAuthority(operation: VoteOperation, keyRef: EncryptedKeyRef?, privateWif: String?): VoteBroadcastResult? {
        if (keyRef == null || privateWif.isNullOrBlank()) return null
        val spec = GrapheneChainSpecs.requireVote(operation.chainId)
        val publicKey = try { GraphenePublicKey.fromWif(privateWif, spec.publicKeyPrefix) } catch (e: Exception) {
            return VoteBroadcastResult(false, "invalid_wif", operation, "posting key is not a valid WIF: ${PayloadSanitizer.text(e.message, 80)}")
        }
        val account = try { rpcClient.getAccount(operation.voter) } catch (e: Exception) {
            return VoteBroadcastResult(false, "authority_check_failed", operation, "could not verify posting authority for @${operation.voter}: ${PayloadSanitizer.text(e.message, 160)}")
        } ?: return VoteBroadcastResult(false, "authority_check_failed", operation, "could not verify posting authority for @${operation.voter}: account not found")
        val authority = account.optJSONObject(spec.postingAuthority)
        val diagnostics = GraphenePublicKey.authorityDiagnostics(publicKey, authority)
        if (!GraphenePublicKey.matchesAuthority(publicKey, authority)) {
            return VoteBroadcastResult(false, "posting_key_mismatch", operation, "saved key ${publicKey} does not satisfy ${spec.postingAuthority} authority for @${operation.voter}; authority keys=${diagnostics.optJSONArray("authorityPublicKeys")}", diagnostics = diagnostics)
        }
        return null
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

private fun BigInteger.toBytes32(): ByteArray {
    val raw = toByteArray().dropWhile { it == 0.toByte() }.toByteArray()
    require(raw.size <= 32) { "integer too large" }
    return ByteArray(32 - raw.size) + raw
}

private fun ByteArray.toHex(): String = joinToString("") { "%02x".format(it) }
