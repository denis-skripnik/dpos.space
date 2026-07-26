package space.dpos.android

import org.bitcoinj.core.ECKey
import org.bitcoinj.params.MainNetParams
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import space.dpos.android.storage.EncryptedKeyRef
import space.dpos.android.upvoter.BlockHeaderRef
import space.dpos.android.upvoter.GolosTransactionBuilder
import space.dpos.android.upvoter.GolosTransactionHeaderFactory
import space.dpos.android.upvoter.GolosVoteSigner
import space.dpos.android.upvoter.VoteBroadcastResult
import space.dpos.android.upvoter.VoteBroadcaster
import space.dpos.android.upvoter.VoteOperation
import space.dpos.android.upvoter.VoteOperationFixture
import space.dpos.android.upvoter.VoteRuntime
import space.dpos.android.upvoter.GolosRpcClient
import java.math.BigInteger

class VoteBroadcastPolicyTest {
    private val header = BlockHeaderRef(
        refBlockNum = 123,
        refBlockPrefix = 67305985L,
        expirationEpochSeconds = 1_700_000_000L,
        headBlockId = "0000007b01020304000000000000000000000000000000000000000000000000"
    )

    @Test fun golosVoteFixtureIsDeterministicAndJsonSerializable() {
        val op = VoteOperationFixture.golosFavoriteVote(account = "denis", author = "alice", permlink = "post", weight = 7500)
        val json = op.toJson().toString()
        assertTrue(json.contains("\"type\":\"vote\""))
        assertTrue(json.contains("\"chainId\":\"golos\""))
        assertTrue(json.contains("\"voter\":\"denis\""))
        assertTrue(json.contains("\"author\":\"alice\""))
        assertTrue(json.contains("\"permlink\":\"post\""))
        assertTrue(json.contains("\"weight\":7500"))
    }

    @Test fun signerSkipsWithoutSecureKeyMaterial() {
        val result = GolosVoteSigner().sign(VoteOperationFixture.golosFavoriteVote(), null, null, header)
        assertFalse(result.ok)
        assertEquals("missing_key_ref", result.status)
        assertTrue(result.reason.contains("no signing", ignoreCase = true))
    }

    @Test fun enabledKeyDoesNotRequireExtraDryRunOffFlag() {
        val op = VoteOperation("golos", "denis", "alice", "post", 10000)
        val ref = EncryptedKeyRef("golos", "denis", "posting", "posting")
        val result = GolosVoteSigner().sign(op, ref, deterministicNonSecretWif(), header)
        assertTrue(result.ok)
        assertEquals("signed", result.status)
        val tx = result.payload?.signedTransaction
        assertNotNull(tx)
        assertEquals(1, tx!!.getJSONArray("signatures").length())
        assertEquals(130, tx.getJSONArray("signatures").getString(0).length)
    }

    @Test fun transactionBuilderUsesGolosVoteOperationShape() {
        val op = VoteOperation("golos", "denis", "alice", "post", 7500)
        val tx = GolosTransactionBuilder().build(op, header, "00".repeat(65))
        assertEquals(123, tx.getInt("ref_block_num"))
        val vote = tx.getJSONArray("operations").getJSONArray(0)
        assertEquals("vote", vote.getString(0))
        assertEquals("denis", vote.getJSONObject(1).getString("voter"))
        assertEquals(7500, vote.getJSONObject(1).getInt("weight"))
        assertEquals(1, tx.getJSONArray("signatures").length())
    }

    @Test fun headerFactoryParsesGrapheneHeadBlockPrefix() {
        val props = JSONObject()
            .put("head_block_number", 123)
            .put("head_block_id", "0000007b01020304000000000000000000000000000000000000000000000000")
            .put("time", "2024-01-01T00:00:00")
        val parsed = GolosTransactionHeaderFactory.fromDynamicGlobalProperties(props, expireSeconds = 30)
        assertEquals(123, parsed.refBlockNum)
        assertEquals(67305985L, parsed.refBlockPrefix)
    }

    @Test fun previewCheckDoesNotBroadcast() {
        val rpc = FakeRpc()
        val broadcaster = RecordingBroadcaster()
        val runtime = VoteRuntime(rpc, broadcaster = broadcaster)
        val result = runtime.preview(VoteOperation("golos", "denis", "alice", "post", 10000), EncryptedKeyRef("golos", "denis", "posting", "posting"), deterministicNonSecretWif())
        assertEquals("preview_ready", result.status)
        assertEquals(0, broadcaster.broadcastCount)
    }

    @Test fun realRuntimeBranchBroadcastsSignedTxThroughBroadcaster() {
        val rpc = FakeRpc()
        val broadcaster = RecordingBroadcaster()
        val runtime = VoteRuntime(rpc, broadcaster = broadcaster)
        val result = runtime.execute(VoteOperation("golos", "denis", "alice", "post", 10000), EncryptedKeyRef("golos", "denis", "posting", "posting"), deterministicNonSecretWif())
        assertTrue(result.ok)
        assertEquals("broadcast_sent", result.status)
        assertEquals(1, broadcaster.broadcastCount)
        assertEquals(1, broadcaster.lastTx!!.getJSONArray("signatures").length())
    }

    private fun deterministicNonSecretWif(): String = ECKey.fromPrivate(BigInteger("2"), true).getPrivateKeyAsWiF(MainNetParams.get())

    private class FakeRpc : GolosRpcClient {
        override fun getDynamicGlobalProperties(): JSONObject = JSONObject()
            .put("head_block_number", 123)
            .put("head_block_id", "0000007b01020304000000000000000000000000000000000000000000000000")
            .put("time", "2024-01-01T00:00:00")
        override fun broadcastTransactionSynchronous(signedTransaction: JSONObject): JSONObject = JSONObject().put("ok", true)
    }

    private class RecordingBroadcaster : VoteBroadcaster {
        var broadcastCount = 0
        var lastTx: JSONObject? = null
        override fun broadcast(signedTransaction: JSONObject): JSONObject {
            broadcastCount += 1
            lastTx = signedTransaction
            return JSONObject().put("id", "fake-broadcast")
        }
    }
}
