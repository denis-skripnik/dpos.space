package space.dpos.android

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Test
import space.dpos.android.storage.EncryptedKeyRef
import space.dpos.android.upvoter.AutoVoteRuntime
import space.dpos.android.upvoter.BlockHeaderRef
import space.dpos.android.upvoter.GolosRpcClient
import space.dpos.android.upvoter.PlannedVote
import space.dpos.android.upvoter.PostingKeyProvider
import space.dpos.android.upvoter.VizSelfAwardRuntime
import space.dpos.android.upvoter.VotePlan
import space.dpos.android.upvoter.VoteRuntime

class WorkerActionGuardTest {
    @Test fun revokedAutoVoteGrantIsCheckedBeforeReadingSigningKey() {
        val keys = RecordingKeys()
        val runtime = AutoVoteRuntime(VoteRuntime(NoCallRpc()), keys, canAct = { false })
        val report = runtime.execute(VotePlan(listOf(PlannedVote("denis", "alice", "post", 10000, "favorite_post", 9900)), emptyList()))
        assertEquals(0, keys.reads)
        assertEquals(0, report.attempted)
        assertEquals(0, report.broadcasted)
        assertEquals(listOf("cancelled:denis|alice|post"), report.skipped)
    }

    @Test fun revokedVizGrantIsCheckedBeforeAnyRpcOrSigning() {
        val rpc = NoCallRpc()
        val result = VizSelfAwardRuntime(rpc, canAct = { false }).execute(
            "denis", 9500, EncryptedKeyRef("viz", "denis", "regular", "regular"), "not-read"
        )
        assertEquals("cancelled", result.status)
        assertEquals(0, rpc.calls)
    }

    private class RecordingKeys : PostingKeyProvider {
        var reads = 0
        override fun keyRef(chainId: String, account: String) = EncryptedKeyRef(chainId, account, "posting", "posting")
        override fun privateWif(chainId: String, account: String): String? { reads += 1; return "unused" }
    }

    private class NoCallRpc : GolosRpcClient {
        var calls = 0
        private fun <T> fail(): T { calls += 1; throw AssertionError("RPC must not be called") }
        override fun getDynamicGlobalProperties(): JSONObject = fail()
        override fun getBlock(blockNumber: Long): JSONObject? = fail()
        override fun getAccount(account: String): JSONObject? = fail()
        override fun verifyAuthority(signedTransaction: JSONObject): Boolean = fail()
        override fun verifyAuthorityDetailed(signedTransaction: JSONObject): JSONObject = fail()
        override fun broadcastTransactionSynchronous(signedTransaction: JSONObject): JSONObject = fail()
    }
}
