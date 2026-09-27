package space.dpos.android

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import space.dpos.android.notifications.GolosHistoryClient
import space.dpos.android.notifications.HistoryEvent
import space.dpos.android.upvoter.GolosRpcClient
import space.dpos.android.upvoter.PendingBroadcastIntent
import space.dpos.android.upvoter.PendingBroadcastStore
import space.dpos.android.upvoter.VoteBroadcaster
import space.dpos.android.upvoter.VoteOperation
import space.dpos.android.upvoter.VoteRuntime

class VotePendingRecoveryTest {
    @Test fun recoveredConfirmedPendingIsClearedFromPaginatedHistory() {
        val store = MemoryPendingStore(PendingBroadcastIntent("vote", "golos", "denis", "alice|old-post|5000", 90, transactionId = "exact-tx"))
        val history = object : GolosHistoryClient {
            override fun getAccountHistory(account: String, from: Long, limit: Int): List<HistoryEvent> = when (from) {
                -1L -> (101L..130L).map { event(it, "noise", "post-$it", 1) }
                100L -> listOf(event(95, "alice", "old-post", 5000, "exact-tx"))
                else -> emptyList()
            }
        }
        val broadcaster = RecordingBroadcaster()
        val result = runtime(store, history, broadcaster).execute(VoteOperation("golos", "denis", "alice", "old-post", 5000), null, null)

        assertTrue(result.ok)
        assertEquals("broadcast_confirmed", result.status)
        assertNull(store.value)
        assertEquals(0, broadcaster.calls)
        assertEquals("confirmed", result.diagnostics!!.getJSONObject("confirmation").getString("status"))
        assertEquals(95L, result.diagnostics!!.getJSONObject("confirmation").getLong("historyIndex"))
    }

    @Test fun unavailableHistoryRetainsPendingAndExplainsSafeNextStep() {
        val pending = PendingBroadcastIntent("vote", "golos", "denis", "alice|old-post|5000", 90, transactionId = "known-tx")
        val store = MemoryPendingStore(pending)
        val history = object : GolosHistoryClient {
            override fun getAccountHistory(account: String, from: Long, limit: Int): List<HistoryEvent> = throw IllegalStateException("RPC history offline")
        }
        val broadcaster = RecordingBroadcaster()
        val result = runtime(store, history, broadcaster).execute(VoteOperation("golos", "denis", "alice", "old-post", 5000), null, null)

        assertFalse(result.ok)
        assertEquals("broadcast_unknown", result.status)
        assertEquals(pending, store.value)
        assertEquals(0, broadcaster.calls)
        assertTrue(result.reason.contains("истори", ignoreCase = true))
        assertTrue(result.reason.contains("повтор", ignoreCase = true))
        assertTrue(result.reason.contains("50%"))
        assertTrue(result.reason.contains("Логи и диагностика"))
        val pendingJson = result.diagnostics!!.getJSONObject("pendingOperation")
        assertEquals("golos", pendingJson.getString("chain"))
        assertEquals("denis", pendingJson.getString("account"))
        assertEquals("alice", pendingJson.getString("author"))
        assertEquals("old-post", pendingJson.getString("permlink"))
        assertEquals(5000, pendingJson.getInt("weight"))
        assertEquals("known-tx", pendingJson.getString("pendingTxId"))
        assertEquals(90L, pendingJson.getLong("historyBaseline"))
        assertEquals("unavailable", result.diagnostics!!.getJSONObject("confirmation").getString("status"))
        assertTrue(result.diagnostics!!.getString("nextStep").isNotBlank())
    }

    @Test fun differentCandidateIsBlockedByUnconfirmedPendingWithoutBroadcast() {
        val pending = PendingBroadcastIntent("vote", "golos", "denis", "alice|old-post|5000", 90)
        val store = MemoryPendingStore(pending)
        val history = object : GolosHistoryClient {
            override fun getAccountHistory(account: String, from: Long, limit: Int) =
                if (from == -1L) listOf(event(91, "someone", "else", 10000)) else emptyList()
        }
        val broadcaster = RecordingBroadcaster()
        val result = runtime(store, history, broadcaster).execute(VoteOperation("golos", "denis", "bob", "new-post", 10000), null, null)

        assertEquals("broadcast_unknown", result.status)
        assertEquals(pending, store.value)
        assertEquals(0, broadcaster.calls)
        val details = result.diagnostics!!.getJSONObject("pendingOperation")
        assertEquals("alice", details.getString("author"))
        assertEquals("old-post", details.getString("permlink"))
        assertEquals("identity_unavailable", result.diagnostics!!.getJSONObject("confirmation").getString("status"))
    }

    @Test fun historyVisibilityDelayIsRetriedWithoutRebroadcast() {
        val store = MemoryPendingStore(PendingBroadcastIntent("vote", "golos", "denis", "alice|old-post|5000", 90, transactionId = "exact-tx"))
        var calls = 0
        val history = object : GolosHistoryClient {
            override fun getAccountHistory(account: String, from: Long, limit: Int): List<HistoryEvent> {
                calls++
                return if (calls == 1) emptyList() else listOf(event(95, "alice", "old-post", 5000, "exact-tx"))
            }
        }
        val broadcaster = RecordingBroadcaster()
        val result = VoteRuntime(UnusedRpc(), broadcaster = broadcaster, historyClient = history,
            confirmationRetries = 3, confirmationDelayMs = 0, pendingStore = store)
            .execute(VoteOperation("golos", "denis", "alice", "old-post", 5000), null, null)
        assertEquals("broadcast_confirmed", result.status)
        assertEquals(2, calls)
        assertNull(store.value)
        assertEquals(0, broadcaster.calls)
    }

    @Test fun sameWeightAndOperationWithWrongTxidCannotClearPending() {
        val pending = PendingBroadcastIntent("vote", "golos", "denis", "alice|old-post|5000", 90, transactionId = "expected-tx")
        val store = MemoryPendingStore(pending)
        val rpc = object : GolosRpcClient by UnusedRpc() {
            override fun getActiveVotePercent(author: String, permlink: String, voter: String) = 5000
        }
        val history = object : GolosHistoryClient {
            override fun getAccountHistory(account: String, from: Long, limit: Int) =
                if (from == -1L) listOf(event(95, "alice", "old-post", 5000, "other-tx")) else emptyList()
        }
        val broadcaster = RecordingBroadcaster()
        val result = VoteRuntime(rpc, broadcaster = broadcaster, historyClient = history,
            confirmationRetries = 1, confirmationDelayMs = 0, pendingStore = store)
            .execute(VoteOperation("golos", "denis", "alice", "old-post", 5000), null, null)
        assertEquals("broadcast_unknown", result.status)
        assertEquals(pending, store.value)
        assertEquals(0, broadcaster.calls)
        assertEquals("checked_not_found", result.diagnostics!!.getJSONObject("confirmation").getString("status"))
    }

    @Test fun idlessMatchingPostBaselineVoteRemainsUnknownDespiteDivergentNodeIndexes() {
        val pending = PendingBroadcastIntent("vote", "golos", "denis", "alice|old-post|5000", 90)
        val store = MemoryPendingStore(pending)
        val history = object : GolosHistoryClient {
            override fun getAccountHistory(account: String, from: Long, limit: Int) = listOf(event(105, "alice", "old-post", 5000, "other-tx"))
        }
        val broadcaster = RecordingBroadcaster()
        val result = runtime(store, history, broadcaster).execute(VoteOperation("golos", "denis", "alice", "old-post", 5000), null, null)
        assertEquals("broadcast_unknown", result.status)
        assertEquals(pending, store.value)
        assertEquals(0, broadcaster.calls)
        assertTrue(result.reason.contains("индексы истории разных узлов"))
        assertEquals("identity_unavailable", result.diagnostics!!.getJSONObject("confirmation").getString("status"))
    }

    private fun runtime(store: PendingBroadcastStore, history: GolosHistoryClient, broadcaster: RecordingBroadcaster) =
        VoteRuntime(UnusedRpc(), broadcaster = broadcaster, historyClient = history, confirmationRetries = 1, confirmationDelayMs = 0, pendingStore = store)

    private fun event(index: Long, author: String, permlink: String, weight: Int, txid: String? = null) = HistoryEvent(
        index, "vote", mapOf("voter" to "denis", "author" to author, "permlink" to permlink, "weight" to weight.toString()) +
            (txid?.let { mapOf("trx_id" to it) } ?: emptyMap())
    )

    private class MemoryPendingStore(var value: PendingBroadcastIntent?) : PendingBroadcastStore {
        override fun readPending(kind: String, chainId: String, account: String) = value
        override fun savePending(intent: PendingBroadcastIntent) { value = intent }
        override fun clearPending(kind: String, chainId: String, account: String) { value = null }
    }

    private class RecordingBroadcaster : VoteBroadcaster {
        var calls = 0
        override fun broadcast(signedTransaction: JSONObject): JSONObject { calls += 1; return JSONObject() }
    }

    private class UnusedRpc : GolosRpcClient {
        override fun getDynamicGlobalProperties(): JSONObject = error("must not be called while resolving pending")
        override fun getBlock(blockNumber: Long): JSONObject? = error("must not be called")
        override fun getAccount(account: String): JSONObject? = error("must not be called")
        override fun verifyAuthority(signedTransaction: JSONObject) = error("must not be called")
        override fun verifyAuthorityDetailed(signedTransaction: JSONObject): JSONObject = error("must not be called")
        override fun broadcastTransactionSynchronous(signedTransaction: JSONObject): JSONObject = error("must not be called")
    }
}
