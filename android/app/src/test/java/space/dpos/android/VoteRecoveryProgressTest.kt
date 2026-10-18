package space.dpos.android

import org.junit.Assert.*
import org.junit.Test
import org.json.JSONObject
import space.dpos.android.notifications.*
import space.dpos.android.upvoter.*

class VoteRecoveryProgressTest {
    private val operation = VoteOperation("golos", "denis", "unik09", "iz-arkhiva-dlya-ponedelnika", 7000)
    private class Store : PendingBroadcastStore {
        var value: PendingBroadcastIntent? = null
        override fun readPending(kind: String, chainId: String, account: String) = value
        override fun savePending(intent: PendingBroadcastIntent) { value = intent }
        override fun clearPending(kind: String, chainId: String, account: String) { value = null }
    }
    private val rpc = object : GolosRpcClient {
        override fun getDynamicGlobalProperties(): JSONObject = error("must not prepare")
        override fun getBlock(blockNumber: Long): JSONObject? = error("must not prepare")
        override fun getAccount(account: String): JSONObject? = error("must not sign")
        override fun verifyAuthority(signedTransaction: JSONObject) = error("must not sign")
        override fun verifyAuthorityDetailed(signedTransaction: JSONObject): JSONObject = error("must not sign")
        override fun broadcastTransactionSynchronous(signedTransaction: JSONObject): JSONObject = error("NO BROADCAST")
    }
    private fun pending() = PendingBroadcastIntent("vote", "golos", "denis", "unik09|iz-arkhiva-dlya-ponedelnika|7000", 84296, transactionId = "exact-id", createdAtMs = 1791265530549L)
    private fun row(index: Long, exact: Boolean = false) = HistoryEvent(index, if (exact) "vote" else "transfer", if (exact) mapOf("voter" to "denis", "author" to operation.author, "permlink" to operation.permlink, "weight" to "7000", "trx_id" to "exact-id") else emptyMap())

    @Test fun diagnosticOldPendingProgressesAcrossRuntimeRestartsBeyondTwentyPages() {
        val store = Store().apply { value = pending() }
        val requests = mutableListOf<Long>()
        val history = object : GolosHistoryClient {
            override fun irreversibleVote(event: space.dpos.android.notifications.HistoryEvent, operation: space.dpos.android.upvoter.VoteOperation, transactionId: String) = true
        override fun getAccountHistory(account: String, from: Long, limit: Int): List<HistoryEvent> {
                requests += from
                val top = if (from < 0) 1000L else from
                return (maxOf(0, top - limit + 1)..top).map { row(it, it == 100L) }
            }
        }
        repeat(3) {
            val result = VoteRuntime(rpc, historyClient = history, confirmationRetries = 1, confirmationDelayMs = 0, pendingStore = store).execute(operation, null, null)
            if (result.ok) {
                assertEquals("broadcast_confirmed", result.status)
                assertNull(store.value)
                assertTrue(requests.any { it in 1..400 })
                return
            }
        }
        fail("restarted recovery must reach old exact transaction, not restart latest forever")
    }

    @Test fun failedNodesStillRotateDurablyRatherThanStarvingLaterEndpoints() {
        val store = Store().apply { value = pending() }
        val requests = mutableListOf<String>()
        fun failed(scope: String) = object : GolosHistoryClient {
            override val historyScope = scope
            override fun irreversibleVote(event: space.dpos.android.notifications.HistoryEvent, operation: space.dpos.android.upvoter.VoteOperation, transactionId: String) = true
        override fun getAccountHistory(account: String, from: Long, limit: Int): List<HistoryEvent> {
                requests += scope
                error("node unavailable")
            }
        }
        val history = FallbackGrapheneHistoryClient(listOf(failed("a"), failed("b")))
        assertFalse(VoteRuntime(rpc, historyClient = history, pendingStore = store).execute(operation, null, null).ok)
        assertEquals(listOf("a", "b"), requests)
        assertEquals(1, store.value!!.recoveryScopeTurn)
        assertTrue(store.value!!.recoveryCursors.isEmpty())
        requests.clear()
        assertFalse(VoteRuntime(rpc, historyClient = history, pendingStore = store).execute(operation, null, null).ok)
        assertEquals(listOf("b", "a"), requests)
        assertNotNull(store.value)
    }

    @Test fun nodeCursorsAreNeverTransferredAndFailedPageDoesNotAdvance() {
        val store = Store().apply { value = pending() }
        val requestsA = mutableListOf<Long>()
        val requestsB = mutableListOf<Long>()
        var failA = false
        var exactB = false
        fun source(scope: String, head: Long, requests: MutableList<Long>) = object : GolosHistoryClient {
            override val historyScope = scope
            override fun irreversibleVote(event: space.dpos.android.notifications.HistoryEvent, operation: space.dpos.android.upvoter.VoteOperation, transactionId: String) = true
        override fun getAccountHistory(account: String, from: Long, limit: Int): List<HistoryEvent> {
                requests += from
                if (scope == "node-a" && failA) error("temporarily down")
                val top = if (from < 0) head else from
                return (maxOf(0, top - limit + 1)..top).map { row(it, scope == "node-b" && exactB && it == 2L) }
            }
        }
        val a = source("node-a", 2000, requestsA)
        val b = source("node-b", 20, requestsB)
        val history = FallbackGrapheneHistoryClient(listOf(a, b))
        assertFalse(VoteRuntime(rpc, historyClient = history, pendingStore = store).execute(operation, null, null).ok)
        val aCursor = store.value!!.recoveryCursors["node-a"]
        assertTrue(aCursor!! > 1000)
        assertTrue(requestsB.filter { it >= 0 }.all { it <= 20 })
        failA = true
        assertFalse(VoteRuntime(rpc, historyClient = history, pendingStore = store).execute(operation, null, null).ok)
        assertEquals(aCursor, store.value!!.recoveryCursors["node-a"])
        exactB = true
        assertTrue(VoteRuntime(rpc, historyClient = history, pendingStore = store).execute(operation, null, null).ok)
        assertNull(store.value)
    }

    @Test fun countBasedGolosHistoryEndsAtOneAndRevisitsOlderDelayedIndexing() {
        val store = Store().apply { value = pending() }
        var indexed = false
        val history = object : GolosHistoryClient {
            override val historyScope = "count-based-node"
            override fun irreversibleVote(event: space.dpos.android.notifications.HistoryEvent, operation: space.dpos.android.upvoter.VoteOperation, transactionId: String) = true
        override fun getAccountHistory(account: String, from: Long, limit: Int): List<HistoryEvent> {
                require(from == -1L || from >= limit)
                val end = if (from < 0) 100L else from
                return (1L..100L).filter { it <= end }.takeLast(limit).map { i ->
                    if (i == 5L) row(i, indexed)
                    else HistoryEvent(i, "transfer", emptyMap())
                }
            }
        }
        assertFalse(VoteRuntime(rpc, historyClient = history, pendingStore = store).execute(operation, null, null).ok)
        assertEquals(-1L, store.value!!.recoveryCursors[history.historyScope])
        indexed = true
        assertTrue(VoteRuntime(rpc, historyClient = history, pendingStore = store).execute(operation, null, null).ok)
        assertNull(store.value)
    }

    @Test fun exhaustedHistoryIsRevisitedForDelayedIndexingWithoutBlindRetry() {
        val store = Store().apply { value = pending() }
        var indexed = false
        val history = object : GolosHistoryClient {
            override fun irreversibleVote(event: space.dpos.android.notifications.HistoryEvent, operation: space.dpos.android.upvoter.VoteOperation, transactionId: String) = true
        override fun getAccountHistory(account: String, from: Long, limit: Int) = listOf(row(0, indexed))
        }
        val first = VoteRuntime(rpc, historyClient = history, confirmationRetries = 1, pendingStore = store).execute(operation, null, null)
        assertFalse(first.ok)
        assertNotNull(store.value)
        indexed = true
        val second = VoteRuntime(rpc, historyClient = history, confirmationRetries = 1, pendingStore = store).execute(operation, null, null)
        assertTrue(second.ok) // below the old baseline: exact ID, not a foreign node's index
        assertNull(store.value)
    }
}
