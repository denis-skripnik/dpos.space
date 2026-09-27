package space.dpos.android.upvoter

import space.dpos.android.notifications.GolosHistoryClient
import space.dpos.android.notifications.HistoryEvent
import java.security.MessageDigest

enum class PendingBroadcastState { PREPARED, UNKNOWN }

data class PendingBroadcastIntent(
    val kind: String,
    val chainId: String,
    val account: String,
    val fingerprint: String,
    val historyBaseline: Long,
    val state: PendingBroadcastState = PendingBroadcastState.PREPARED,
    val transactionId: String? = null,
    val createdAtMs: Long? = null,
    val expirationEpochSeconds: Long? = null,
    val observedChainTimeSeconds: Long? = null,
    val observedHeadBlock: Long? = null,
    val includedBlockNumber: Long? = null
)

interface PendingBroadcastStore {
    fun readPending(kind: String, chainId: String, account: String): PendingBroadcastIntent?
    fun savePending(intent: PendingBroadcastIntent)
    fun clearPending(kind: String, chainId: String, account: String)
}

object TransactionConfirmation {
    /** Graphene transaction id is the first 20 bytes of SHA-256(serialized unsigned tx). */
    fun transactionId(signingBytes: ByteArray): String {
        require(signingBytes.size > 32) { "missing Graphene transaction bytes" }
        return MessageDigest.getInstance("SHA-256").digest(signingBytes.copyOfRange(32, signingBytes.size))
            .take(20).joinToString("") { "%02x".format(it.toInt() and 255) }
    }
    fun baseline(history: GolosHistoryClient, account: String, limit: Int = 30): Long =
        history.getAccountHistory(account, -1L, limit).maxOfOrNull { it.index } ?: -1L

    fun findCurrent(
        rows: List<HistoryEvent>,
        baseline: Long,
        transactionId: String? = null,
        matches: (HistoryEvent) -> Boolean
    ): HistoryEvent? = rows.asReversed().firstOrNull { event ->
        val eventTransactionId = event.data["transaction_id"] ?: event.data["trx_id"]
        val sameTransaction = if (!transactionId.isNullOrBlank()) eventTransactionId == transactionId
            else event.index > baseline && (eventTransactionId.isNullOrBlank() || eventTransactionId != "0".repeat(40))
        sameTransaction && matches(event)
    }
}
