package space.dpos.android.upvoter

import org.json.JSONObject
import java.time.LocalDateTime
import java.time.ZoneOffset

/** Positive exact unsigned-ID + operation + canonical block + same-endpoint LIB evidence only. */
object GolosVoteProof {
    private fun integral(json: JSONObject, field: String): Long {
        val value = json.get(field)
        require(value is Byte || value is Short || value is Int || value is Long) { "non-integral $field" }
        return (value as Number).toLong()
    }
    fun id(tx: JSONObject, operation: VoteOperation): String? = runCatching {
        val ops = tx.getJSONArray("operations")
        require(ops.length() == 1 && tx.getJSONArray("extensions").length() == 0)
        val row = ops.getJSONArray(0)
        require(row.getString(0) == "vote")
        val op = row.getJSONObject(1)
        require(op.getString("voter") == operation.voter && op.getString("author") == operation.author &&
            op.getString("permlink") == operation.permlink && integral(op, "weight") == operation.weight.toLong() && operation.weight in -10000..10000)
        val ref = integral(tx, "ref_block_num")
        val prefix = integral(tx, "ref_block_prefix")
        require(ref in 0..65535 && prefix in 0..4294967295L)
        val expiration = tx.getString("expiration")
        require(expiration.matches(Regex("[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}")))
        val epoch = LocalDateTime.parse(expiration).toEpochSecond(ZoneOffset.UTC)
        require(epoch in 0..4294967295L)
        val header = BlockHeaderRef(ref.toInt(), prefix, epoch, "")
        TransactionConfirmation.transactionId(GrapheneTransactionBuilder(GrapheneChainSpecs.require("golos")).signingBytes(operation, header))
    }.getOrNull()

    fun inBlock(operation: VoteOperation, txId: String, number: Long, index: Int, block: JSONObject?, head: JSONObject?, requireIrreversible: Boolean = true): Boolean = runCatching {
        require(txId.matches(Regex("[0-9a-fA-F]{40}")) && number > 0 && index >= 0)
        require(head != null && integral(head, "head_block_number") >= number)
        require(!requireIrreversible || integral(head, "last_irreversible_block_num") >= number)
        val tx = block?.getJSONArray("transactions")?.getJSONObject(index) ?: return false
        id(tx, operation)?.equals(txId, true) == true
    }.getOrDefault(false)

    fun lookup(operation: VoteOperation, txId: String, tx: JSONObject, requireIrreversible: Boolean = true): Boolean = runCatching {
        id(tx, operation)?.equals(txId, true) == true &&
            (!tx.has("id") || tx.optString("id").equals(txId, true)) &&
            (!tx.has("transaction_id") || tx.optString("transaction_id").equals(txId, true)) &&
            inBlock(operation, txId, integral(tx, "block_num"), integral(tx, "transaction_num").also { require(it in 0..Int.MAX_VALUE.toLong()) }.toInt(),
                tx.optJSONObject("_golosBlock"), tx.optJSONObject("_golosHead"), requireIrreversible)
    }.getOrDefault(false)
}
