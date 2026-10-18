package space.dpos.android

import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import space.dpos.android.upvoter.*

class GolosRecoveryFenceTest {
    private class Fixture {
        var wall = 1_800_000_000_000L
        var mono = 1000L
        var saved: JSONObject? = null
        var head = 100L
        var lib = 90L
        var time = wall / 1000
        var created = time
        var id = 1L
        var chain = GOLOS_CHAIN_ID
        var own: Int? = null
        var previous = blockId(100)
        var failSave = false
        var onContent: (() -> Unit)? = null
        var parent = ""
        var encodedId: Any? = null
        val rpc = object : GolosRpcClient {
            override val recoveryEndpoint = "fixture-A"
            override fun getGolosConfig() = JSONObject().put("STEEMIT_CHAIN_ID", chain).put("STEEMIT_MAX_TIME_UNTIL_EXPIRATION", 3600)
            override fun getDynamicGlobalProperties() = JSONObject().put("head_block_number", head).put("head_block_id", blockId(head)).put("time", stamp(time)).put("last_irreversible_block_num", lib)
            override fun getBlockHeader(number: Long) = JSONObject().put("previous", if (number == 101L) previous else blockId(number - 1)).put("timestamp", stamp(if (number == 101L) 1_800_000_003 else time - 3))
            override fun getGolosContent(author: String, permlink: String) = JSONObject().apply { onContent?.invoke() }.put("author", author).put("permlink", permlink).put("parent_author", parent).put("id", encodedId ?: id).put("root_comment", id).put("created", stamp(created))
            override fun getActiveVotePercent(author: String, permlink: String, voter: String) = own
            override fun getBlock(blockNumber: Long): JSONObject? = null
            override fun getAccount(account: String): JSONObject? = null
            override fun verifyAuthority(signedTransaction: JSONObject) = true
            override fun verifyAuthorityDetailed(signedTransaction: JSONObject) = JSONObject().put("result", true)
            override fun broadcastTransactionSynchronous(signedTransaction: JSONObject) = error("never send")
        }
        fun fence() = GolosRecoveryFence({ saved?.let { JSONObject(it.toString()) } }, { if (failSave) error("disk failed"); saved = JSONObject(it.toString()) }, { wall }, { mono })
        fun ready() {
            assertTrue(runCatching { fence().verify(rpc) }.isFailure)
            wall += 3_800_000; mono += 3_800_000; time = wall / 1000; head = 1500; lib = 1490; created = time - 6
        }
        companion object {
            fun blockId(n: Long) = "%08x".format(n) + "a".repeat(32)
            fun stamp(n: Long) = java.time.LocalDateTime.ofEpochSecond(n, 0, java.time.ZoneOffset.UTC).toString().let { if (it.length == 16) "$it:00" else it }
        }
    }
    private val operation = VoteOperation("golos", "alice", "bob", "post", 100)
    @Test fun freshFencePersistsBeforeDrainAndCanonicalFutureGenerationPasses() {
        val f = Fixture(); f.ready(); val lane = f.fence(); val verified = lane.verify(f.rpc)
        val generation = lane.generation(f.rpc, operation, verified)
        assertEquals(1L, generation.getLong("id")); assertNotNull(f.saved)
        assertEquals(generation.toString(), f.fence().generation(f.rpc, operation, f.fence().verify(f.rpc)).toString())
    }
    @Test fun oldEqualReversibleAndOwnVoteAllFailClosed() {
        val f = Fixture(); f.ready(); val lane = f.fence(); val verified = lane.verify(f.rpc)
        val future = f.created
        for (created in listOf(verified.fence.getLong("cutoff"), verified.fence.getLong("cutoff") - 1, f.time)) {
            f.created = created; assertTrue(runCatching { lane.generation(f.rpc, operation, verified) }.isFailure)
        }
        f.created = future
        for (own in listOf(0, -100, 100)) { f.own = own; assertTrue(runCatching { lane.generation(f.rpc, operation, verified) }.isFailure) }
    }
    @Test fun staleWrongChainReorgAndFailedStorageDoNotOpenLane() {
        val f = Fixture(); f.failSave = true; assertTrue(runCatching { f.fence().verify(f.rpc) }.isFailure); assertNull(f.saved)
        f.failSave = false; f.ready(); f.chain = "0".repeat(64); assertTrue(runCatching { f.fence().verify(f.rpc) }.isFailure)
        f.chain = GOLOS_CHAIN_ID; f.time -= 1000; assertTrue(runCatching { f.fence().verify(f.rpc) }.isFailure)
        f.time += 1000; assertNotNull(f.fence().verify(f.rpc))
        f.previous = Fixture.blockId(99); assertTrue(runCatching { f.fence().verify(f.rpc) }.isFailure)
        f.previous = Fixture.blockId(100); assertNotNull(f.fence().verify(f.rpc))
    }
    @Test fun malformedRootAndDelayedMonotonicObservationFailClosed() {
        val f = Fixture(); f.ready(); val lane = f.fence(); val proof = lane.verify(f.rpc)
        f.parent = "parent"; assertTrue(runCatching { lane.generation(f.rpc, operation, proof) }.isFailure)
        f.parent = ""; f.encodedId = "1"; assertTrue(runCatching { lane.generation(f.rpc, operation, proof) }.isFailure)
        f.encodedId = null; f.onContent = { f.mono += 31_000 }
        assertTrue(runCatching { lane.generation(f.rpc, operation, proof) }.isFailure)
    }
    @Test fun pendingReorgReanchorsWithoutCutoffRegressionAndStopRefusesCapture() {
        val f = Fixture(); f.ready(); val prior = f.saved!!.getLong("cutoff")
        f.previous = Fixture.blockId(99)
        assertTrue(runCatching { f.fence().verify(f.rpc) }.isFailure)
        assertTrue(f.saved!!.getLong("cutoff") >= prior); assertEquals(f.head, f.saved!!.getLong("head"))
        val stopped = GolosRecoveryFence({ null }, { error("must not save") }, { f.wall }, { f.mono }, { false })
        assertTrue(runCatching { stopped.verify(f.rpc) }.isFailure)
    }
    @Test fun endpointBindingAndMonotonicExpiryRejectMixedOrLateProof() {
        val f = Fixture(); f.ready(); val lane = f.fence(); val verified = lane.verify(f.rpc)
        val other = object : GolosRpcClient by f.rpc { override val recoveryEndpoint = "fixture-B" }
        assertTrue(runCatching { lane.generation(other, operation, verified) }.isFailure)
        f.mono += 121_000; assertTrue(runCatching { lane.generation(f.rpc, operation, verified) }.isFailure)
    }
}
