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
    val includedBlockNumber: Long? = null,
    // Each history index belongs to one endpoint/API, never to the chain globally.
    val recoveryCursors: Map<String, Long> = emptyMap(),
    val recoveryScopeTurn: Int = 0,
    /** Current-generation evidence, never a replacement for textual target quarantine. */
    val recoveryGeneration: String? = null
)

interface GolosRecoveryStore {
    fun requiresGolosRecovery(): Boolean
    fun readGolosRecoveryFence(): org.json.JSONObject?
    fun saveGolosRecoveryFence(fence: org.json.JSONObject)
    fun golosProductionEpoch(): String? = null
    fun isGolosForeignIntent(intent: PendingBroadcastIntent): Boolean = false
    fun golosFenceForGeneration(generation: org.json.JSONObject): org.json.JSONObject? = readGolosRecoveryFence()
}

interface VoteArchiveStore : PendingBroadcastStore {
    /** Atomically move the active slot before another intent may be prepared. */
    fun archiveActiveVote(chainId: String, account: String)
    fun voteArchive(chainId: String, account: String): List<ArchivedVote>
    fun updateArchivedVote(entry: ArchivedVote)
    /** Durable fair rotation; returns at most one unresolved record per worker tick. */
    fun nextArchivedVote(chainId: String, account: String): ArchivedVote?
}

data class ArchivedVote(val intent: PendingBroadcastIntent, val confirmed: Boolean = false)

enum class PendingCompletionReason { CONFIRMED, UNKNOWN_EXPIRED, UNSENT_CANCELLED }

interface PendingBroadcastStore {
    fun readPending(kind: String, chainId: String, account: String): PendingBroadcastIntent?
    fun savePending(intent: PendingBroadcastIntent)
    fun markTransportEntered(intent: PendingBroadcastIntent, canAct: () -> Boolean = { true }): Boolean = canAct()
    fun assertTransactionAuthority(kind: String, chainId: String, account: String) {}
    fun assertFreshIntentAllowed(kind: String, chainId: String, account: String) = assertTransactionAuthority(kind, chainId, account)
    fun confirmedAt(kind: String, chainId: String, account: String): Long? = null
    /** Legacy test adapters only. Production WorkerStore rejects identity-less clearing. */
    fun clearPending(kind: String, chainId: String, account: String)
    fun completePending(intent: PendingBroadcastIntent, reason: PendingCompletionReason, atMs: Long = System.currentTimeMillis()) {
        clearPending(intent.kind, intent.chainId, intent.account)
    }
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
