package space.dpos.android.upvoter

import org.json.JSONArray
import org.json.JSONObject
import space.dpos.android.notifications.GolosHistoryClient
import space.dpos.android.notifications.HistoryEvent
import space.dpos.android.storage.EncryptedKeyRef
import java.io.ByteArrayOutputStream
import java.math.BigDecimal
import java.math.BigInteger
import java.math.RoundingMode
import java.security.MessageDigest
import java.time.LocalDateTime
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter

/** Native donate is deliberately unavailable on every chain except Golos. */
data class GolosDonatePool(val percent: BigDecimal, val coefficient: BigDecimal) {
    init {
        require(percent > BigDecimal.ZERO && percent <= BigDecimal(100))
        require(coefficient > BigDecimal.ZERO && coefficient <= BigDecimal(10))
    }
    companion object {
        fun parse(value: String): GolosDonatePool {
            val parts = value.trim().split(Regex("\\s+")).filter { it.isNotBlank() }
            require(parts.size == 2) { "pool requires percent and coefficient" }
            return GolosDonatePool(parts[0].toBigDecimal(), parts[1].toBigDecimal())
        }
    }
}

data class GolosDonateAmounts(val authorMilli: Long, val feeMilli: Long) {
    val totalMilli: Long get() = authorMilli + feeMilli
    fun authorAsset() = "${BigDecimal.valueOf(authorMilli, 3).setScale(3).toPlainString()} GOLOS"
    fun feeAsset() = "${BigDecimal.valueOf(feeMilli, 3).setScale(3).toPlainString()} GOLOS"
}

object GolosDonateMath {
    private fun asset(raw: String?, symbol: String, precision: Int): BigDecimal {
        require(raw != null && Regex("^(0|[1-9][0-9]*)\\.[0-9]{$precision} ${Regex.escape(symbol)}$").matches(raw)) { "invalid live $symbol asset" }
        return raw.substringBefore(' ').toBigDecimal()
    }
    fun calculate(pool: GolosDonatePool, account: JSONObject, props: JSONObject, weight: Int): GolosDonateAmounts? {
        if (weight !in 1..10000) return null
        val vesting = asset(account.getString("vesting_shares"), "GESTS", 6)
            .subtract(asset(account.getString("emission_delegated_vesting_shares"), "GESTS", 6))
            .add(asset(account.getString("emission_received_vesting_shares"), "GESTS", 6))
        val total = asset(props.getString("total_vesting_shares"), "GESTS", 6)
        val emission = asset(props.getString("accumulative_emission_per_day"), "GOLOS", 3)
        if (vesting <= BigDecimal.ZERO || total <= BigDecimal.ZERO || emission <= BigDecimal.ZERO) return null
        // Non-integral exponents need floating point; use it ONLY for the dimensionless
        // attenuation. Monetary proportions, quantization and split remain decimal/integer.
        val attenuation = Math.pow(weight / 10000.0, pool.coefficient.toDouble())
        require(attenuation.isFinite() && attenuation in 0.0..1.0)
        val milli = emission.multiply(vesting).divide(total, 18, RoundingMode.DOWN)
            .multiply(pool.percent).movePointLeft(2)
            .multiply(BigDecimal.valueOf(attenuation))
            .movePointRight(3).setScale(0, RoundingMode.DOWN).longValueExact()
        if (milli < 500L) return null
        val available = asset(account.getString("tip_balance"), "GOLOS", 3).movePointRight(3).longValueExact()
        if (milli > available) return null
        // 0.2%, rounded to the nearest smallest unit; both transfers must be nonzero.
        val fee = BigDecimal.valueOf(milli).multiply(BigDecimal("0.002"))
            .setScale(0, RoundingMode.HALF_UP).longValueExact()
        if (fee < 1L || fee >= milli) return null
        return GolosDonateAmounts(milli - fee, fee)
    }
}

/** FC_REFLECT donate_operation index 54; memo is a struct, not a JSON string. */
class GolosDonateTransactionBuilder(private val amounts: GolosDonateAmounts) : TransactionBuilder {
    private fun memo(type: String, op: VoteOperation): JSONObject = JSONObject()
        .put("app", "dpos.space").put("version", 1)
        .put("target", JSONObject().put("type", type).put("author", op.author).put("permlink", op.permlink))

    override fun build(operation: VoteOperation, header: BlockHeaderRef, signature: String?): JSONObject {
        require(operation.chainId == "golos")
        val operations = JSONArray()
        listOf(Triple(operation.author, amounts.authorAsset(), "post_donate"),
            Triple("denis-skripnik", amounts.feeAsset(), "fee_donate")).forEach { (to, amount, type) ->
            operations.put(JSONArray().put("donate").put(JSONObject()
                .put("from", operation.voter).put("to", to).put("amount", amount)
                .put("memo", memo(type, operation)).put("extensions", JSONArray())))
        }
        val tx = JSONObject().put("ref_block_num", header.refBlockNum)
            .put("ref_block_prefix", header.refBlockPrefix)
            .put("expiration", DateTimeFormatter.ISO_LOCAL_DATE_TIME.format(LocalDateTime.ofEpochSecond(header.expirationEpochSeconds, 0, ZoneOffset.UTC)))
            .put("operations", operations).put("extensions", JSONArray()).put("signatures", JSONArray())
        if (!signature.isNullOrEmpty()) tx.getJSONArray("signatures").put(signature)
        return tx
    }

    override fun signingBytes(operation: VoteOperation, header: BlockHeaderRef): ByteArray {
        require(operation.chainId == "golos")
        val out = ByteArrayOutputStream()
        out.u16(header.refBlockNum); out.u32(header.refBlockPrefix); out.u32(header.expirationEpochSeconds)
        out.varint(2)
        listOf(Triple(operation.author, amounts.authorMilli, "post_donate"),
            Triple("denis-skripnik", amounts.feeMilli, "fee_donate")).forEach { (recipient, milli, type) ->
            out.varint(54)
            out.string(operation.voter); out.string(recipient)
            out.u64(milli); out.write(3); out.write(byteArrayOf(71, 79, 76, 79, 83, 0, 0)) // 3 decimals + GOLOS symbol
            out.string("dpos.space"); out.u16(1)
            out.write(3) // variant_object: type, author, permlink; string type tag = 5
            listOf("type" to type, "author" to operation.author, "permlink" to operation.permlink).forEach { (key, value) ->
                out.string(key); out.write(5); out.string(value)
            }
            out.write(0) // optional memo.comment absent
            out.varint(0) // extensions
        }
        out.varint(0) // transaction extensions
        val chain = GrapheneChainSpecs.require("golos").networkChainIdHex
        return ByteArray(chain.length / 2) { chain.substring(it * 2, it * 2 + 2).toInt(16).toByte() } + out.toByteArray()
    }

    private fun ByteArrayOutputStream.u16(n: Int) { write(n and 255); write(n ushr 8 and 255) }
    private fun ByteArrayOutputStream.u32(n: Long) { repeat(4) { write((n ushr (it * 8) and 255).toInt()) } }
    private fun ByteArrayOutputStream.u64(n: Long) { require(n >= 0); repeat(8) { write((n ushr (it * 8) and 255).toInt()) } }
    private fun ByteArrayOutputStream.varint(n: Int) {
        var remaining = n
        do { val b = remaining and 127; remaining = remaining ushr 7; write(b or if (remaining > 0) 128 else 0) } while (remaining > 0)
    }
    private fun ByteArrayOutputStream.string(s: String) { val bytes = s.toByteArray(Charsets.UTF_8); varint(bytes.size); write(bytes) }
}

interface GolosDonateLedger : PendingBroadcastStore {
    fun donated(account: String, fingerprint: String): Boolean
    fun markDonated(account: String, fingerprint: String)
}

data class GolosDonateResult(val status: String, val amount: GolosDonateAmounts? = null) {
    val confirmed get() = status == "donate_confirmed"
}

class GolosDonateRuntime(
    private val rpc: GolosRpcClient,
    private val history: GolosHistoryClient,
    private val ledger: GolosDonateLedger,
    private val broadcaster: VoteBroadcaster = GolosBroadcastClient(rpc),
    private val signerFactory: (TransactionBuilder) -> VoteSigner = { GrapheneVoteSigner(GrapheneChainSpecs.require("golos"), it) },
    private val canAct: () -> Boolean = { true },
    private val confirmationRetries: Int = 2,
    private val confirmationDelayMs: Long = 1500L
) {
    /** Settle only an already-durable intent; never infer spending from an existing vote. */
    fun reconcilePending(account: String): GolosDonateResult {
        if (!canAct()) return GolosDonateResult("donate_cancelled")
        val pending = ledger.readPending("donate", "golos", account) ?: return GolosDonateResult("donate_no_pending")
        if (pending.kind != "donate" || pending.chainId != "golos" || pending.account != account)
            return GolosDonateResult("donate_unknown")
        if (!confirm(pending) || !canAct()) return GolosDonateResult("donate_unknown")
        ledger.markDonated(account, pending.fingerprint.substringBefore('|'))
        ledger.clearPending("donate", "golos", account)
        return GolosDonateResult("donate_confirmed")
    }

    fun execute(operation: VoteOperation, pool: GolosDonatePool, keyRef: EncryptedKeyRef, wif: String): GolosDonateResult {
        if (operation.chainId != "golos") return GolosDonateResult("unsupported_chain")
        val fingerprint = MessageDigest.getInstance("SHA-256").digest("${operation.author}/${operation.permlink}".toByteArray())
            .joinToString("") { "%02x".format(it) }
        if (ledger.donated(operation.voter, fingerprint)) return GolosDonateResult("donate_duplicate")
        val pending = ledger.readPending("donate", "golos", operation.voter)
        if (pending != null) {
            val confirmed = confirm(pending)
            if (!confirmed) return GolosDonateResult("donate_unknown")
            ledger.markDonated(operation.voter, pending.fingerprint.substringBefore('|'))
            ledger.clearPending("donate", "golos", operation.voter)
            if (pending.fingerprint.substringBefore('|') == fingerprint) return GolosDonateResult("donate_duplicate")
        }
        if (!canAct()) return GolosDonateResult("donate_cancelled")
        // Never pre-authorize funds based on the stale snapshot used by vote planning.
        val account = rpc.getAccount(operation.voter) ?: return GolosDonateResult("donate_account_unavailable")
        val props = rpc.getDynamicGlobalProperties()
        val amounts = GolosDonateMath.calculate(pool, account, props, operation.weight) ?: return GolosDonateResult("donate_below_min_or_balance")
        if (keyRef.chainId != "golos" || keyRef.account != operation.voter || keyRef.authority != "posting") return GolosDonateResult("donate_key_scope_mismatch")
        val derived = GraphenePublicKey.fromWif(wif)
        if (!GraphenePublicKey.matchesAuthority(derived, account.optJSONObject("posting"))) return GolosDonateResult("donate_posting_key_mismatch")
        val head = props.optLong("head_block_number")
        val header = GolosTransactionHeaderFactory.fromGolosJsReference(props, rpc.getBlock(head - 2))
        val signed = signerFactory(GolosDonateTransactionBuilder(amounts)).sign(operation, keyRef, wif, header)
        if (!signed.ok || signed.payload == null) return GolosDonateResult("donate_sign_error")
        val authority = rpc.verifyAuthorityDetailed(signed.payload.signedTransaction)
        if (!authority.optBoolean("result", false) || authority.has("error")) return GolosDonateResult("donate_authority_error")
        val baseline = TransactionConfirmation.baseline(history, operation.voter)
        if (!canAct()) return GolosDonateResult("donate_cancelled")
        val intent = PendingBroadcastIntent("donate", "golos", operation.voter,
            "$fingerprint|${operation.author}|${operation.permlink}|${amounts.authorAsset()}|${amounts.feeAsset()}", baseline,
            transactionId = TransactionConfirmation.transactionId(GolosDonateTransactionBuilder(amounts).signingBytes(operation, header)),
            createdAtMs = System.currentTimeMillis())
        ledger.savePending(intent) // durable before transport, fail closed on process death
        if (!canAct()) { ledger.clearPending("donate", "golos", operation.voter); return GolosDonateResult("donate_cancelled") }
        try {
            broadcaster.broadcast(signed.payload.signedTransaction)
            ledger.savePending(intent.copy(state = PendingBroadcastState.UNKNOWN))
        } catch (_: Exception) {
            // Any transport failure after send may be an accepted transaction. Never retry blindly.
            ledger.savePending(intent.copy(state = PendingBroadcastState.UNKNOWN))
        }
        if (!confirm(intent.copy(state = PendingBroadcastState.UNKNOWN,
                transactionId = ledger.readPending("donate", "golos", operation.voter)?.transactionId))) return GolosDonateResult("donate_unknown", amounts)
        ledger.markDonated(operation.voter, fingerprint)
        ledger.clearPending("donate", "golos", operation.voter)
        return GolosDonateResult("donate_confirmed", amounts)
    }

    private fun confirm(intent: PendingBroadcastIntent): Boolean {
        val parts = intent.fingerprint.split('|')
        if (parts.size != 5 || parts[0].length != 64 || intent.transactionId?.matches(Regex("[0-9a-fA-F]{40}")) != true) return false
        repeat(confirmationRetries.coerceAtLeast(1)) { retry ->
            if (retry > 0 && confirmationDelayMs > 0) Thread.sleep(confirmationDelayMs)
            var from = -1L
            var limit = 30
            val matches = mutableListOf<HistoryEvent>()
            for (page in 0 until 20) {
                if (!canAct()) return false
                val rows = try { history.getAccountHistory(intent.account, from, limit) } catch (_: Exception) { return false }
                matches += rows.filter { row ->
                    val txId = row.data["trx_id"] ?: row.data["transaction_id"]
                    (if (intent.transactionId?.matches(Regex("[0-9a-fA-F]{40}")) == true) txId == intent.transactionId else row.index > intent.historyBaseline) &&
                        row.type == "donate" && row.data["from"] == intent.account &&
                        !txId.isNullOrBlank() && txId != "0".repeat(40) &&
                        ((row.data["to"] == parts[1] && row.data["amount"] == parts[3] && memoMatches(row, "post_donate", parts)) ||
                         (row.data["to"] == "denis-skripnik" && row.data["amount"] == parts[4] && memoMatches(row, "fee_donate", parts)))
                }
                // A single transaction contains BOTH operations. Distinct broadcasts
                // with matching memo/amount cannot be mistaken for confirmation.
                if (matches.groupBy { it.data["trx_id"] ?: it.data["transaction_id"] }.values.any { group ->
                        group.any { it.data["to"] == parts[1] && memoMatches(it, "post_donate", parts) } &&
                            group.any { it.data["to"] == "denis-skripnik" && memoMatches(it, "fee_donate", parts) }
                    }) return true
                val oldest = rows.minOfOrNull { it.index } ?: break
                if (oldest <= 1 || (oldest <= intent.historyBaseline && intent.transactionId.isNullOrBlank())) break
                val next = oldest - 1
                if (next == from) break
                from = next
                limit = minOf(30L, from).toInt()
            }
        }
        return false
    }

    private fun memoMatches(row: HistoryEvent, type: String, parts: List<String>): Boolean {
        val memo = runCatching { JSONObject(row.data["memo"].orEmpty()) }.getOrNull() ?: return false
        val target = memo.optJSONObject("target") ?: return false
        return memo.optString("app") == "dpos.space" && memo.optInt("version") == 1 &&
            target.optString("type") == type && target.optString("author") == parts[1] && target.optString("permlink") == parts[2]
    }
}
