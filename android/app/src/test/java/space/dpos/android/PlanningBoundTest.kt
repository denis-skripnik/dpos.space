package space.dpos.android

import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import space.dpos.android.storage.EncryptedKeyRef
import space.dpos.android.upvoter.*

class PlanningBoundTest {
    private class Ledger : VoteArchiveStore {
        var reads = 0
        var moves = 0
        override fun archiveActiveVote(chainId: String, account: String) { moves++ }
        override fun voteArchive(chainId: String, account: String): List<ArchivedVote> { reads++; return emptyList() }
        override fun nextArchivedVote(chainId: String, account: String): ArchivedVote? = null
        override fun updateArchivedVote(entry: ArchivedVote) {}
        override fun readPending(kind: String, chainId: String, account: String): PendingBroadcastIntent? = null
        override fun savePending(intent: PendingBroadcastIntent) {}
        override fun clearPending(kind: String, chainId: String, account: String) {}
    }
    private fun runtime(ledger: Ledger, permit: () -> Boolean = { true }): AutoVoteRuntime {
        val rpc = object : GolosRpcClient {
            override fun getBlock(blockNumber: Long): JSONObject? = null
            override fun getAccount(account: String): JSONObject? = null
            override fun verifyAuthority(signedTransaction: JSONObject) = false
            override fun verifyAuthorityDetailed(signedTransaction: JSONObject) = JSONObject()
            override fun getDynamicGlobalProperties() = JSONObject()
            override fun broadcastTransactionSynchronous(signedTransaction: JSONObject) = JSONObject()
            override fun getGolosContent(author: String, permlink: String) = JSONObject().put("author", author).put("permlink", permlink).put("parent_author", "reply")
        }
        return AutoVoteRuntime(VoteRuntime(rpc, pendingStore = ledger), object : PostingKeyProvider {
            override fun keyRef(chainId: String, account: String) = EncryptedKeyRef("golos", account, "posting", "fixture")
            override fun privateWif(chainId: String, account: String): String? = null
        }, canAct = permit)
    }
    private val settings = listOf(AccountSettings("voter", true, favorites = listOf("alice"), currentEnergy = 10000))
    private val events = (0 until 50).map { VoteEvent("favorite_post", author = "alice", permlink = "p$it") }
    @Test fun planningValidatesArchiveOncePerAccountNotPerCandidate() {
        val ledger = Ledger()
        val plan = runtime(ledger).plan(settings, events)
        assertEquals(50, plan.skips.size)
        assertEquals(1, ledger.reads)
        assertEquals(1, ledger.moves)
    }
    @Test fun stoppedPlanningDoesNotEnterArchiveOrRpc() {
        val ledger = Ledger()
        val plan = runtime(ledger) { false }.plan(settings, events)
        assertTrue(plan.actions.isEmpty())
        assertEquals(0, ledger.reads)
        assertEquals(0, ledger.moves)
    }
}
