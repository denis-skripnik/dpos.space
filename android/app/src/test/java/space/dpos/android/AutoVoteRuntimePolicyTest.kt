package space.dpos.android

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import space.dpos.android.storage.EncryptedKeyRef
import space.dpos.android.upvoter.AccountSettings
import space.dpos.android.upvoter.AutoUpvoterPlanner
import space.dpos.android.upvoter.AutoVoteRuntime
import space.dpos.android.upvoter.BlockHeaderRef
import space.dpos.android.upvoter.GolosRpcClient
import space.dpos.android.upvoter.PostingKeyProvider
import space.dpos.android.upvoter.VoteBroadcastResult
import space.dpos.android.upvoter.VoteBroadcaster
import space.dpos.android.upvoter.VoteEvent
import space.dpos.android.upvoter.VoteOperation
import space.dpos.android.upvoter.VoteRuntime
import space.dpos.android.upvoter.VoteSigner

class AutoVoteRuntimePolicyTest {
    @Test fun missingKeySkipsClearlyWithoutBroadcast() {
        val broadcaster = RecordingBroadcaster()
        val report = AutoVoteRuntime(VoteRuntime(FakeRpc(), signer = FakeSigner(), broadcaster = broadcaster), MissingKeyProvider()).execute(planWithOneAction())
        assertEquals(1, report.attempted)
        assertEquals(0, report.broadcasted)
        assertEquals(0, broadcaster.broadcastCount)
        assertTrue(report.skipped.any { it.startsWith("missing-key:denis") })
    }

    @Test fun previewModeNeverBroadcastsEvenWhenKeyExists() {
        val broadcaster = RecordingBroadcaster()
        val report = AutoVoteRuntime(VoteRuntime(FakeRpc(), signer = FakeSigner(), broadcaster = broadcaster), FakeKeyProvider()).preview(planWithOneAction())
        assertEquals(1, report.attempted)
        assertEquals(0, report.broadcasted)
        assertEquals(0, broadcaster.broadcastCount)
        assertEquals("preview_ready", report.results.single().status)
    }

    @Test fun normalEnabledRuntimeUsesSignerAndBroadcasterWhenKeyExists() {
        val broadcaster = RecordingBroadcaster()
        val report = AutoVoteRuntime(VoteRuntime(FakeRpc(), signer = FakeSigner(), broadcaster = broadcaster), FakeKeyProvider()).execute(planWithOneAction())
        assertEquals(1, report.attempted)
        assertEquals(1, report.broadcasted)
        assertEquals(1, broadcaster.broadcastCount)
        assertEquals("broadcast_sent", report.results.single().status)
    }

    private fun planWithOneAction() = AutoUpvoterPlanner().plan(
        listOf(AccountSettings("denis", enabled = true, favorites = listOf("alice"), currentEnergy = 10000)),
        listOf(VoteEvent("favorite_post", author = "alice", permlink = "post"))
    )

    private class FakeRpc : GolosRpcClient {
        override fun getDynamicGlobalProperties(): JSONObject = JSONObject()
            .put("head_block_number", 123)
            .put("head_block_id", "0000007b01020304000000000000000000000000000000000000000000000000")
            .put("time", "2024-01-01T00:00:00")
        override fun broadcastTransactionSynchronous(signedTransaction: JSONObject): JSONObject = JSONObject().put("ok", true)
    }

    private class FakeSigner : VoteSigner {
        override fun sign(operation: VoteOperation, keyRef: EncryptedKeyRef?, privateWif: String?, header: BlockHeaderRef): VoteBroadcastResult {
            if (privateWif.isNullOrBlank()) return VoteBroadcastResult(false, "missing_private_key", operation, "missing")
            val tx = JSONObject().put("operations", "fake").put("signatures", org.json.JSONArray().put("fake-signature"))
            return VoteBroadcastResult(true, "signed", operation, "fake signed", space.dpos.android.upvoter.SignedVotePayload(operation, keyRef!!, tx))
        }
    }

    private class RecordingBroadcaster : VoteBroadcaster {
        var broadcastCount = 0
        override fun broadcast(signedTransaction: JSONObject): JSONObject {
            broadcastCount += 1
            return JSONObject().put("ok", true)
        }
    }

    private class FakeKeyProvider : PostingKeyProvider {
        override fun keyRef(chainId: String, account: String): EncryptedKeyRef = EncryptedKeyRef(chainId, account, "posting", "posting")
        override fun privateWif(chainId: String, account: String): String = "non-secret-placeholder-used-by-fake-signer"
    }

    private class MissingKeyProvider : PostingKeyProvider {
        override fun keyRef(chainId: String, account: String): EncryptedKeyRef = EncryptedKeyRef(chainId, account, "posting", "posting")
        override fun privateWif(chainId: String, account: String): String? = null
    }
}
