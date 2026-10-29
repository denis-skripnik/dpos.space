package space.dpos.android.upvoter

import org.json.JSONObject
import java.time.LocalDateTime
import java.time.ZoneOffset

/** Cadence time comes only from the canonical block containing the exact unsigned tx. */
internal object VizAwardProof {
    data class Proof(val executionMillis: Long?)

    fun verify(tx: JSONObject, id: String, account: String, energy: Int, wallSeconds: Long, requireDefaultBeneficiary: Boolean): Proof? = runCatching {
        require(tx.getString("_vizEndpoint").isNotBlank())
        val head = tx.getJSONObject("_vizHead")
        val fresh = VizSelfAwardPolicy.chainHead(head, wallSeconds) ?: return null
        val height = integer(tx, "block_num")
        val rawPosition = integer(tx, "transaction_num")
        require(rawPosition in 0..Int.MAX_VALUE.toLong())
        val position = rawPosition.toInt()
        require(height > 0 && height <= fresh.first && integer(head,"last_irreversible_block_num") in height..fresh.first)
        val block = tx.getJSONObject("_vizBlock")
        val canonical = block.getJSONArray("transactions").getJSONObject(position)
        fun unsigned(value: JSONObject): ByteArray {
            val ops = value.getJSONArray("operations")
            require(ops.length() == 1 && ops.getJSONArray(0).getString(0) == "award")
            val op = ops.getJSONArray(0).getJSONObject(1)
            require(op.getString("initiator") == account && op.getString("receiver") == account)
            require(integer(op,"energy") == energy.toLong() && integer(op,"custom_sequence") == 0L)
            require(op.getString("memo") == VIZ_SELF_AWARD_MEMO)
            val beneficiaries = op.getJSONArray("beneficiaries")
            require(beneficiaries.length() == 1 || !requireDefaultBeneficiary && beneficiaries.length() == 0)
            if (beneficiaries.length() == 1) {
                val beneficiary = beneficiaries.getJSONObject(0)
                require(beneficiary.getString("account") == VIZ_DEFAULT_BENEFICIARY_ACCOUNT && integer(beneficiary,"weight") == VIZ_DEFAULT_BENEFICIARY_WEIGHT.toLong())
            }
            require(value.getJSONArray("extensions").length() == 0)
            val num = integer(value,"ref_block_num"); val prefix = integer(value,"ref_block_prefix")
            val expiration = LocalDateTime.parse(value.getString("expiration")).toEpochSecond(ZoneOffset.UTC)
            require(num in 0..65535 && prefix in 0..0xffffffffL && expiration in 1..0xffffffffL)
            val builder = VizAwardTransactionBuilder(GrapheneChainSpecs.require("viz"))
            val operation = VizSelfAwardOperation(account,energy)
            val header = BlockHeaderRef(num.toInt(), prefix, expiration, "")
            return if (beneficiaries.length() == 0) builder.legacyProofBytes(operation, header) else builder.signingBytes(operation, header)
        }
        val bytes = unsigned(tx)
        require(bytes.contentEquals(unsigned(canonical)) && TransactionConfirmation.transactionId(bytes) == id)
        if (!requireDefaultBeneficiary || !block.has("timestamp")) return Proof(null)
        val time = LocalDateTime.parse(block.getString("timestamp")).toEpochSecond(ZoneOffset.UTC)
        val expiration = LocalDateTime.parse(tx.getString("expiration")).toEpochSecond(ZoneOffset.UTC)
        require(time in 1..fresh.second && time <= expiration)
        Proof(time * 1000)
    }.getOrNull()

    private fun integer(value: JSONObject, name: String): Long {
        val raw = value.get(name)
        require(raw is Number && raw.toString() == value.getLong(name).toString())
        return value.getLong(name)
    }
}
