package space.dpos.android

import org.bitcoinj.core.ECKey
import org.bitcoinj.params.MainNetParams
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
import space.dpos.android.upvoter.GraphenePublicKey
import space.dpos.android.upvoter.PostingKeyProvider
import space.dpos.android.upvoter.VoteBroadcastResult
import space.dpos.android.upvoter.VoteBroadcaster
import space.dpos.android.upvoter.VoteEvent
import space.dpos.android.upvoter.VoteOperation
import space.dpos.android.upvoter.VoteRuntime
import space.dpos.android.upvoter.VoteSigner
import java.math.BigInteger

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

    @Test fun duplicateVoteIsReportedAsAlreadyVotedWithoutErrorSkip() {
        val broadcaster = ThrowingBroadcaster("You have already voted in a similar way.")
        val report = AutoVoteRuntime(VoteRuntime(FakeRpc(), signer = FakeSigner(), broadcaster = broadcaster), FakeKeyProvider()).execute(planWithOneAction())
        assertEquals(1, report.attempted)
        assertEquals(0, report.broadcasted)
        assertEquals(1, broadcaster.broadcastCount)
        assertEquals("already_voted", report.results.single().status)
        assertEquals(0, report.skipped.size)
    }

    @Test fun alreadyVotedDoesNotConsumeBroadcastLimitAndRuntimeContinuesToNextCandidate() {
        val broadcaster = DuplicateThenSuccessBroadcaster()
        val plan = AutoUpvoterPlanner().plan(
            listOf(AccountSettings("denis", enabled = true, favorites = listOf("alice"), currentEnergy = 10000, maxActionsPerTick = 1)),
            listOf(
                VoteEvent("favorite_post", author = "alice", permlink = "already"),
                VoteEvent("favorite_post", author = "alice", permlink = "next"),
                VoteEvent("favorite_post", author = "alice", permlink = "third")
            )
        )
        assertTrue("planner keeps fallback candidates beyond the one-new-vote limit", plan.actions.size >= 2)
        val report = AutoVoteRuntime(VoteRuntime(FakeRpc(), signer = FakeSigner(), broadcaster = broadcaster), FakeKeyProvider()).execute(plan)
        assertEquals(2, report.attempted)
        assertEquals(1, report.broadcasted)
        assertEquals(2, broadcaster.broadcastCount)
        assertEquals(listOf("already_voted", "broadcast_sent"), report.results.map { it.status })
        assertTrue(report.skipped.any { it.startsWith("limit:denis|alice|third") })
    }

    @Test fun fatalBroadcastFailureIsRecordedButDoesNotStopNextCandidateLikeJsRuntime() {
        val broadcaster = FatalThenSuccessBroadcaster()
        val plan = AutoUpvoterPlanner().plan(
            listOf(AccountSettings("denis", enabled = true, favorites = listOf("alice"), currentEnergy = 10000, maxActionsPerTick = 2)),
            listOf(
                VoteEvent("favorite_post", author = "alice", permlink = "bad"),
                VoteEvent("favorite_post", author = "alice", permlink = "good")
            )
        )
        val report = AutoVoteRuntime(VoteRuntime(FakeRpc(), signer = FakeSigner(), broadcaster = broadcaster), FakeKeyProvider()).execute(plan)
        assertEquals(2, report.attempted)
        assertEquals(1, report.broadcasted)
        assertEquals(2, broadcaster.broadcastCount)
        assertEquals(listOf("broadcast_error", "broadcast_sent"), report.results.map { it.status })
        assertTrue(report.skipped.any { it.startsWith("broadcast_error:denis|alice|bad") })
    }

    @Test fun limitSkippedCandidateIsNotCountedAsAttempted() {
        val broadcaster = RecordingBroadcaster()
        val plan = AutoUpvoterPlanner().plan(
            listOf(AccountSettings("denis", enabled = true, favorites = listOf("alice"), currentEnergy = 10000, maxActionsPerTick = 1)),
            listOf(
                VoteEvent("favorite_post", author = "alice", permlink = "first"),
                VoteEvent("favorite_post", author = "alice", permlink = "second")
            )
        )
        val report = AutoVoteRuntime(VoteRuntime(FakeRpc(), signer = FakeSigner(), broadcaster = broadcaster), FakeKeyProvider()).execute(plan)
        assertEquals(1, report.attempted)
        assertEquals(1, report.broadcasted)
        assertEquals(1, broadcaster.broadcastCount)
        assertTrue(report.skipped.any { it.startsWith("limit:denis|alice|second") })
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
        override fun getBlock(blockNumber: Long): JSONObject? = JSONObject().put("previous", "0000007901020304000000000000000000000000000000000000000000000000")
        override fun getAccount(account: String): JSONObject? = JSONObject().put("posting", JSONObject().put("key_auths", org.json.JSONArray().put(org.json.JSONArray().put(GraphenePublicKey.fromWif(deterministicNonSecretWif())).put(1))))
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

    private class ThrowingBroadcaster(private val message: String) : VoteBroadcaster {
        var broadcastCount = 0
        override fun broadcast(signedTransaction: JSONObject): JSONObject {
            broadcastCount += 1
            throw IllegalStateException(message)
        }
    }

    private class DuplicateThenSuccessBroadcaster : VoteBroadcaster {
        var broadcastCount = 0
        override fun broadcast(signedTransaction: JSONObject): JSONObject {
            broadcastCount += 1
            if (broadcastCount == 1) throw IllegalStateException("You have already voted in a similar way.")
            return JSONObject().put("ok", true).put("id", "sent-$broadcastCount")
        }
    }

    private class FatalThenSuccessBroadcaster : VoteBroadcaster {
        var broadcastCount = 0
        override fun broadcast(signedTransaction: JSONObject): JSONObject {
            broadcastCount += 1
            if (broadcastCount == 1) throw IllegalStateException("temporary rpc failure")
            return JSONObject().put("ok", true).put("id", "sent-$broadcastCount")
        }
    }

    private class FakeKeyProvider : PostingKeyProvider {
        override fun keyRef(chainId: String, account: String): EncryptedKeyRef = EncryptedKeyRef(chainId, account, "posting", "posting")
        override fun privateWif(chainId: String, account: String): String = deterministicNonSecretWif()
    }

    private class MissingKeyProvider : PostingKeyProvider {
        override fun keyRef(chainId: String, account: String): EncryptedKeyRef = EncryptedKeyRef(chainId, account, "posting", "posting")
        override fun privateWif(chainId: String, account: String): String? = null
    }

    companion object {
        private fun deterministicNonSecretWif(): String = ECKey.fromPrivate(BigInteger("2"), true).getPrivateKeyAsWiF(MainNetParams.get())
    }
}
