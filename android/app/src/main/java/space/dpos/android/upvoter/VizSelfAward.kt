package space.dpos.android.upvoter

import org.bitcoinj.core.Base58
import org.bitcoinj.core.ECKey
import org.bitcoinj.core.Sha256Hash
import org.bouncycastle.asn1.x9.X9ECParameters
import org.bouncycastle.crypto.digests.RIPEMD160Digest
import org.bouncycastle.crypto.digests.SHA256Digest
import org.bouncycastle.crypto.macs.HMac
import org.bouncycastle.crypto.params.KeyParameter
import org.bouncycastle.crypto.ec.CustomNamedCurves
import org.json.JSONArray
import org.json.JSONObject
import space.dpos.android.core.PayloadSanitizer
import space.dpos.android.storage.EncryptedKeyRef
import space.dpos.android.notifications.GolosHistoryClient
import space.dpos.android.notifications.HistoryEvent
import java.io.ByteArrayOutputStream
import java.math.BigInteger
import java.security.MessageDigest
import java.time.LocalDateTime
import java.time.ZoneOffset
import java.util.Locale

const val VIZ_SELF_AWARD_REGENERATION_SECONDS: Long = 432000L
const val VIZ_SELF_AWARD_TICK_MS: Long = 432000L
const val VIZ_SELF_AWARD_MAX_SPEND: Int = 10
const val VIZ_SELF_AWARD_MEMO: String = "dpos.space: VIZ self-award"

data class VizSelfAwardOperation(
    val account: String,
    val energy: Int,
    val memo: String = VIZ_SELF_AWARD_MEMO
) {
    fun toJson(): JSONObject = JSONObject()
        .put("type", "award")
        .put("chainId", "viz")
        .put("initiator", account)
        .put("receiver", account)
        .put("energy", energy.coerceIn(1, 10000))
        .put("custom_sequence", 0)
        .put("memo", memo)
        .put("beneficiaries", JSONArray())
}

data class VizSelfAwardResult(
    val ok: Boolean,
    val status: String,
    val reason: String,
    val operation: VizSelfAwardOperation,
    val signedTransaction: JSONObject? = null,
    val rpcResponse: JSONObject? = null,
    val diagnostics: JSONObject? = null
) {
    fun toJson(): JSONObject = JSONObject()
        .put("ok", ok)
        .put("status", status)
        .put("reason", PayloadSanitizer.text(reason, 300))
        .put("operation", operation.toJson())
        .put("signedTransaction", if (signedTransaction == null) JSONObject.NULL else PayloadSanitizer.text(signedTransaction.toString(), 900))
        .put("rpcResponse", if (rpcResponse == null) JSONObject.NULL else PayloadSanitizer.text(rpcResponse.toString(), 900))
        .put("diagnostics", diagnostics ?: JSONObject.NULL)
}

object VizSelfAwardPolicy {
    fun normalizeMinEnergy(value: Int): Int = (if (value in 1..100) value * 100 else value).coerceIn(0, 9999)

    fun currentEnergy(account: JSONObject, nowMillis: Long = System.currentTimeMillis()): Int? {
        if (!account.has("energy")) return null
        val base = account.optDouble("energy", Double.NaN)
        if (!base.isFinite()) return null
        val time = account.optString("last_vote_time", account.optString("last_account_update", account.optString("created", "")))
        val last = runCatching { LocalDateTime.parse(time).toEpochSecond(ZoneOffset.UTC) * 1000L }.getOrNull()
            ?: return base.toInt().coerceIn(0, 10000)
        val deltaSeconds = ((nowMillis - last).coerceAtLeast(0L)) / 1000.0
        return (base + deltaSeconds * 10000.0 / VIZ_SELF_AWARD_REGENERATION_SECONDS).toInt().coerceIn(0, 10000)
    }

    fun spendFor(currentEnergy: Int?, minEnergy: Int): Int {
        val current = currentEnergy ?: return 0
        val min = normalizeMinEnergy(minEnergy)
        if (current <= min) return 0
        return (current - min).coerceAtMost(VIZ_SELF_AWARD_MAX_SPEND).coerceAtLeast(0)
    }
}

class VizSelfAwardRuntime(
    private val rpcClient: GolosRpcClient,
    private val broadcaster: VoteBroadcaster = GolosBroadcastClient(rpcClient),
    private val historyClient: GolosHistoryClient? = null,
    private val confirmationRetries: Int = 3,
    private val confirmationDelayMs: Long = 1_500L
) {
    private val spec = GrapheneChainSpecs.require("viz")
    private val builder = VizAwardTransactionBuilder(spec)
    private val signer = VizAwardSigner(spec, builder)

    fun execute(account: String, minEnergy: Int, keyRef: EncryptedKeyRef?, privateWif: String?): VizSelfAwardResult {
        val clean = account.trim().removePrefix("@").lowercase(Locale.ROOT)
        val accountJson = try { rpcClient.getAccount(clean) } catch (e: Exception) {
            return VizSelfAwardResult(false, "account_fetch_failed", "could not fetch VIZ account @${clean}: ${PayloadSanitizer.text(e.message, 160)}", VizSelfAwardOperation(clean, 1))
        } ?: return VizSelfAwardResult(false, "account_not_found", "VIZ account @${clean} not found", VizSelfAwardOperation(clean, 1))
        val current = VizSelfAwardPolicy.currentEnergy(accountJson)
        val spend = VizSelfAwardPolicy.spendFor(current, minEnergy)
        val op = VizSelfAwardOperation(clean, spend.coerceAtLeast(1))
        if (spend <= 0) {
            return VizSelfAwardResult(true, "low_energy_skip", "@${clean}: energy ${current?.let { "%.2f".format(Locale.US, it / 100.0) } ?: "unknown"}% is not above minimum ${VizSelfAwardPolicy.normalizeMinEnergy(minEnergy) / 100.0}%", op)
        }
        val authorityCheck = verifyRegularAuthority(clean, keyRef, privateWif, accountJson, op)
        if (authorityCheck != null) return authorityCheck
        val header = buildHeaderLikeGolosJs()
        val signed = signer.sign(op, keyRef, privateWif, header)
        if (!signed.ok || signed.signedTransaction == null) return signed
        return try {
            val authorityResponse = try { rpcClient.verifyAuthorityDetailed(signed.signedTransaction) } catch (e: Exception) {
                return signed.copy(ok = false, status = "signature_verification_error", reason = "VIZ verify_authority transport failed before broadcast: ${PayloadSanitizer.text(e.message, 220)}", rpcResponse = JSONObject().put("error", PayloadSanitizer.text(e.message, 500)))
            }
            val authorityError = authorityResponse.optJSONObject("error")
            if (authorityError != null) {
                val data = authorityError.optJSONObject("data")
                val codeName = data?.optString("name").orEmpty().ifBlank { authorityError.optString("message", "verify_authority_error").lineSequence().firstOrNull().orEmpty() }
                return signed.copy(ok = false, status = "signature_rejected", reason = "VIZ node rejected signed transaction before broadcast: ${PayloadSanitizer.text(codeName, 140)}", rpcResponse = authorityResponse)
            }
            if (!authorityResponse.optBoolean("result", false)) {
                return signed.copy(ok = false, status = "signature_rejected", reason = "VIZ node verify_authority returned false before broadcast; regular key/signature did not verify on-chain", rpcResponse = authorityResponse)
            }
            val response = broadcaster.broadcast(signed.signedTransaction)
            val confirmation = confirmSelfAward(clean, spend)
            if (confirmation != null) {
                signed.copy(status = "broadcast_confirmed", reason = "VIZ self-award confirmed in history: @${clean} spent ${spend} energy bp at #${confirmation.index}", rpcResponse = response, diagnostics = (signed.diagnostics ?: JSONObject()).put("confirmedHistoryIndex", confirmation.index).put("confirmedTimestamp", confirmation.timestamp))
            } else if (spec.asyncBroadcastOnly) {
                signed.copy(ok = false, status = "broadcast_unconfirmed", reason = "VIZ async broadcast returned from RPC, but self-award was not found in account history after verification; foreground worker stays non-blocking", rpcResponse = response)
            } else {
                val syncResult = response.optJSONObject("result")
                val syncId = syncResult?.optString("id").orEmpty()
                val blockNum = syncResult?.optLong("block_num", -1L) ?: -1L
                val trxNum = syncResult?.optInt("trx_num", -1) ?: -1
                val expired = syncResult?.optBoolean("expired", false) ?: false
                if (expired || trxNum < 0) {
                    signed.copy(ok = false, status = "broadcast_rejected", reason = "VIZ synchronous broadcast did not include transaction: id=${PayloadSanitizer.text(syncId, 64)}, block=$blockNum, trx_num=$trxNum, expired=$expired", rpcResponse = response)
                } else {
                    signed.copy(ok = false, status = "broadcast_unconfirmed", reason = "VIZ synchronous broadcast returned id=$syncId block=$blockNum trx_num=$trxNum, but self-award was not found in account history after verification", rpcResponse = response, diagnostics = (signed.diagnostics ?: JSONObject()).put("syncBroadcastId", syncId).put("syncBlockNum", blockNum).put("syncTrxNum", trxNum))
                }
            }
        } catch (e: Exception) {
            signed.copy(ok = false, status = "broadcast_error", reason = PayloadSanitizer.text(e.message.orEmpty().ifBlank { "native VIZ self-award broadcast failed" }, 300), rpcResponse = JSONObject().put("error", PayloadSanitizer.text(e.message.orEmpty(), 500)))
        }
    }

    private fun confirmSelfAward(account: String, energy: Int): HistoryEvent? {
        val history = historyClient ?: return null
        repeat(confirmationRetries.coerceAtLeast(1)) { attempt ->
            if (attempt > 0 && confirmationDelayMs > 0) Thread.sleep(confirmationDelayMs)
            val rows = history.getAccountHistory(account, -1, 30)
            val found = rows.asReversed().firstOrNull { event ->
                event.type == "award" &&
                    event.data["initiator"].orEmpty().trim().removePrefix("@").lowercase(Locale.ROOT) == account &&
                    event.data["receiver"].orEmpty().trim().removePrefix("@").lowercase(Locale.ROOT) == account &&
                    event.data["energy"].orEmpty().toIntOrNull() == energy
            }
            if (found != null) return found
        }
        return null
    }

    private fun buildHeaderLikeGolosJs(): BlockHeaderRef {
        val props = rpcClient.getDynamicGlobalProperties()
        val head = props.optLong("head_block_number")
        val previousBlock = rpcClient.getBlock(head - 2)
        return GolosTransactionHeaderFactory.fromGolosJsReference(props, previousBlock)
    }

    private fun verifyRegularAuthority(account: String, keyRef: EncryptedKeyRef?, privateWif: String?, accountJson: JSONObject, op: VizSelfAwardOperation): VizSelfAwardResult? {
        if (keyRef == null) return VizSelfAwardResult(false, "missing_key_ref", "regular key ref is absent; no signing attempted", op)
        if (privateWif.isNullOrBlank()) return VizSelfAwardResult(false, "missing_private_key", "regular key material is absent; no signing attempted", op)
        if (keyRef.chainId != "viz" || keyRef.account != account || keyRef.authority != "regular") {
            return VizSelfAwardResult(false, "key_scope_mismatch", "regular key ref does not match VIZ account @${account}", op)
        }
        val publicKey = try { GraphenePublicKey.fromWif(privateWif, "VIZ") } catch (e: Exception) {
            return VizSelfAwardResult(false, "invalid_wif", "regular key is not a valid WIF: ${PayloadSanitizer.text(e.message, 80)}", op)
        }
        val authority = accountJson.optJSONObject("regular_authority") ?: accountJson.optJSONObject("regular")
        val diagnostics = GraphenePublicKey.authorityDiagnostics(publicKey, authority)
        if (!GraphenePublicKey.matchesAuthority(publicKey, authority)) {
            return VizSelfAwardResult(false, "regular_key_mismatch", "saved key $publicKey does not satisfy VIZ regular authority for @${account}; authority keys=${diagnostics.optJSONArray("authorityPublicKeys")}", op, diagnostics = diagnostics)
        }
        return null
    }
}

class VizAwardTransactionBuilder(private val spec: GrapheneChainSpec) {
    fun build(operation: VizSelfAwardOperation, header: BlockHeaderRef, signature: String? = null): JSONObject {
        val tx = JSONObject()
            .put("ref_block_num", header.refBlockNum)
            .put("ref_block_prefix", header.refBlockPrefix)
            .put("expiration", java.time.format.DateTimeFormatter.ISO_LOCAL_DATE_TIME.format(LocalDateTime.ofEpochSecond(header.expirationEpochSeconds, 0, ZoneOffset.UTC)))
            .put("operations", JSONArray().put(JSONArray().put("award").put(operation.toJson()
                .removeKey("type").removeKey("chainId"))))
            .put("extensions", JSONArray())
            .put("signatures", JSONArray())
        if (!signature.isNullOrBlank()) tx.getJSONArray("signatures").put(signature)
        return tx
    }

    fun signingBytes(operation: VizSelfAwardOperation, header: BlockHeaderRef): ByteArray {
        val txBytes = ByteArrayOutputStream().apply {
            writeUInt16LE(header.refBlockNum)
            writeUInt32LE(header.refBlockPrefix)
            writeUInt32LE(header.expirationEpochSeconds)
            writeVarUInt(1)
            writeVarUInt(47)
            writeGrapheneString(operation.account)
            writeGrapheneString(operation.account)
            writeUInt16LE(operation.energy.coerceIn(1, 10000))
            writeUInt64LE(0)
            writeGrapheneString(operation.memo)
            writeVarUInt(0) // beneficiaries
            writeVarUInt(0) // transaction extensions
        }.toByteArray()
        return vizHexToBytes(spec.networkChainIdHex) + txBytes
    }
}

class VizAwardSigner(private val spec: GrapheneChainSpec, private val builder: VizAwardTransactionBuilder) {
    fun sign(operation: VizSelfAwardOperation, keyRef: EncryptedKeyRef?, privateWif: String?, header: BlockHeaderRef): VizSelfAwardResult {
        if (keyRef == null) return VizSelfAwardResult(false, "missing_key_ref", "regular key ref is absent; no signing attempted", operation)
        if (privateWif.isNullOrBlank()) return VizSelfAwardResult(false, "missing_private_key", "regular key material is absent; no signing attempted", operation)
        if (keyRef.chainId != spec.id || keyRef.account != operation.account || keyRef.authority != "regular") {
            return VizSelfAwardResult(false, "key_scope_mismatch", "regular key ref does not match ${spec.id} account", operation)
        }
        val ecKey = try { ecKeyFromWif(privateWif) } catch (e: Exception) {
            return VizSelfAwardResult(false, "invalid_wif", "regular key is not a valid WIF: ${PayloadSanitizer.text(e.message, 80)}", operation)
        }
        val publicKey = GraphenePublicKey.fromWif(privateWif, spec.publicKeyPrefix)
        val digestBytes = Sha256Hash.hash(builder.signingBytes(operation, header))
        val digest = Sha256Hash.wrap(digestBytes)
        val compactSignature = canonicalCompactSignature(ecKey, digestBytes)
            ?: return VizSelfAwardResult(false, "signature_recovery_failed", "could not produce canonical compact recoverable signature", operation)
        val compact = compactSignature.hex
        val recoveredPublicKey = recoverPublicKeyFromCompact(compact, digest, spec.publicKeyPrefix)
        if (recoveredPublicKey != publicKey) {
            return VizSelfAwardResult(false, "signature_public_key_mismatch", "Android compact signature recovers ${recoveredPublicKey ?: "no public key"}, expected $publicKey; broadcast stopped before RPC", operation, diagnostics = JSONObject().put("derivedPublicKey", publicKey).put("recoveredPublicKey", recoveredPublicKey ?: JSONObject.NULL).put("signatureHeader", compact.substring(0, 2).toInt(16)))
        }
        return VizSelfAwardResult(true, "signed", "signed VIZ self-award locally", operation, builder.build(operation, header, compact), diagnostics = JSONObject()
            .put("derivedPublicKey", publicKey)
            .put("signingDigestHex", digestBytes.toHex())
            .put("signingBytesHex", builder.signingBytes(operation, header).toHex())
            .put("canonicalNonce", compactSignature.nonce)
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

    private data class CompactSignature(val hex: String, val nonce: Int)

    private fun canonicalCompactSignature(ecKey: ECKey, digestBytes: ByteArray): CompactSignature? {
        val digest = Sha256Hash.wrap(digestBytes)
        repeat(100) { nonce ->
            val signature = deterministicEcdsaSignature(ecKey, digestBytes, nonce).toCanonicalised()
            val recId = (0..3).firstOrNull { candidate -> ECKey.recoverFromSignature(candidate, signature, digest, true)?.pubKeyPoint == ecKey.pubKeyPoint }
                ?: return@repeat
            val compact = ByteArrayOutputStream().apply {
                write(recId + 27 + 4)
                writePadded(signature.r)
                writePadded(signature.s)
            }.toByteArray()
            if (isCanonicalCompactSignature(compact)) return CompactSignature(compact.toHex(), nonce)
        }
        return null
    }

    private fun deterministicEcdsaSignature(ecKey: ECKey, message: ByteArray, nonce: Int): ECKey.ECDSASignature {
        val curve = CustomNamedCurves.getByName("secp256k1")
        val n = curve.n
        require(message.size == 32) { "message digest must be 32 bytes" }
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
        val hmac = HMac(SHA256Digest())
        hmac.init(KeyParameter(key))
        hmac.update(data, 0, data.size)
        val out = ByteArray(32)
        hmac.doFinal(out, 0)
        return out
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

private fun JSONObject.removeKey(key: String): JSONObject {
    remove(key)
    return this
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

private fun ByteArrayOutputStream.writeUInt32LE(value: Long) {
    write((value and 0xff).toInt())
    write(((value ushr 8) and 0xff).toInt())
    write(((value ushr 16) and 0xff).toInt())
    write(((value ushr 24) and 0xff).toInt())
}

private fun ByteArrayOutputStream.writeUInt64LE(value: Long) {
    var v = value
    repeat(8) {
        write((v and 0xffL).toInt())
        v = v ushr 8
    }
}

private fun ByteArrayOutputStream.writePadded(value: BigInteger) {
    val raw = value.toByteArray().dropWhile { it == 0.toByte() }.toByteArray()
    require(raw.size <= 32) { "signature integer too large" }
    write(ByteArray(32 - raw.size))
    write(raw)
}

private fun ByteArray.toHex(): String = joinToString("") { "%02x".format(it) }

private fun vizHexToBytes(hex: String): ByteArray {
    val clean = hex.trim()
    require(clean.length % 2 == 0) { "invalid hex length" }
    return ByteArray(clean.length / 2) { i -> clean.substring(i * 2, i * 2 + 2).toInt(16).toByte() }
}

private fun BigInteger.toBytes32(): ByteArray {
    val raw = toByteArray().dropWhile { it == 0.toByte() }.toByteArray()
    require(raw.size <= 32) { "integer too large" }
    return ByteArray(32 - raw.size) + raw
}
