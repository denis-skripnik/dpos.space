package space.dpos.android

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import space.dpos.android.notifications.HistoryEvent
import space.dpos.android.storage.WorkerStore
import space.dpos.android.upvoter.*
import space.dpos.android.worker.DposWorkerRunner

/** Actual runner/store and HTTP loopback. NOT a physical Android/device test. */
@RunWith(RobolectricTestRunner::class)
class GolosProductionContractTest {
    internal class Fixture : AutoCloseable {
        val f = DeviceFollowupConnectedTest.Fixture(recovery = true, knownOld = true)
        var checkpoint: String? = GolosProductionPolicy.CHECKPOINT_ID
        var advance = true
        var badHistory = false
        var emptyContent = false
        var stale = false
        val transport = f.rpc
        val rpc = object : GolosRpcClient by transport {
            override val recoveryEndpoint = transport.recoveryEndpoint
            override fun recoveryClients() = listOf(this)
            override fun getBlockHeader(number: Long): JSONObject? = when (number) {
                GolosProductionPolicy.CHECKPOINT_HEIGHT + 1 -> checkpoint?.let { JSONObject().put("previous", it) }
                else -> {
                    val anchor = f.restart().readGolosRecoveryFence()
                    if (anchor != null && number == anchor.getLong("head") + 1 && anchor.getLong("head") != GolosProductionPolicy.FOREIGN_HEIGHT)
                        JSONObject().put("previous", anchor.getString("headId")).put("timestamp", stamp(anchor.getLong("headTime") + 3))
                    else transport.getBlockHeader(number)
                }
            }
            override fun getDynamicGlobalProperties(): JSONObject = transport.getDynamicGlobalProperties().apply {
                if (stale) put("time", stamp(f.recoveryTime - 121))
            }
            override fun getGolosContent(author: String, permlink: String): JSONObject? = if (emptyContent) JSONObject() else transport.getGolosContent(author, permlink)
            override fun recoveryHistory() = if (badHistory) object : space.dpos.android.notifications.GolosHistoryClient {
                override fun getAccountHistory(account: String, from: Long, limit: Int): List<HistoryEvent> = error("history unavailable")
            } else f.history
        }
        val policy = GolosProductionPolicy(endpoint = f.endpoint, pause = {
            if (advance) { f.recoveryHead++; f.lib++; f.recoveryTime += 3; f.recoveryWall += 3000; f.recoveryMono += 3000 }
        })
        init {
            f.store.saveGolosRecoveryFence(oldFence())
            f.recoveryHead = 104760300; f.lib = 104760280
            f.contentFields.put("id", 17).put("root_comment", 17)
            f.histories[GolosProductionPolicy.SAMPLE_ACCOUNT] = listOf(HistoryEvent(1, "vote", emptyMap()))
        }
        fun admit() = policy.admit(rpc, { f.recoveryWall }, { f.recoveryMono }, { true })
        fun run(store: WorkerStore = f.restart(), events: List<VoteEvent> = emptyList()) = DposWorkerRunner(f.context, store,
            historyOverride = { f.history }, rpcOverride = { rpc }, eventsOverride = { _, _ -> events },
            recoveryWall = { f.recoveryWall }, recoveryMonotonic = { f.recoveryMono }, productionPolicy = policy).runOnce("production-loopback")
        fun ready() {
            run()
            f.recoveryWall += 3_800_000; f.recoveryMono += 3_800_000; f.recoveryTime = f.recoveryWall / 1000
            f.recoveryHead += 1300; f.lib += 1300; f.receiptBlock = f.lib
            f.contentFields.put("created", stamp(f.recoveryTime - 6)).put("last_update", stamp(f.recoveryTime - 6))
                .put("num_changes", 0).put("cashout_time", stamp(f.recoveryTime + 86400))
        }
        override fun close() = f.close()
        companion object {
            fun stamp(t: Long) = DeviceFollowupConnectedTest.Fixture.recoveryStamp(t)
            fun oldFence() = JSONObject().put("schema", 1).put("chainId", GOLOS_CHAIN_ID)
                .put("endpoint", "https://apibeta.golos.today").put("head", GolosProductionPolicy.FOREIGN_HEIGHT)
                .put("headId", GolosProductionPolicy.FOREIGN_ID)
                .put("headTime", 1_792_033_410L).put("observedAtMs", 1_792_033_410_000L)
                .put("observedLib", 104806370L).put("verifiedLib", 104807631L)
                .put("verifiedLibTime", 1_792_037_148L).put("verifiedAtMs", 1_792_037_148_000L)
                .put("drain", 1_792_037_130L).put("cutoff", 1_792_037_130L).put("verified", true)
        }
    }
    @Test fun restartNeverExtendsCommittedDrainAndGenericVerifiedFenceReplacementStillFails() {
        Fixture().use { p ->
            p.run(); val initial = p.f.restart().readGolosProductionTransition()!!.toString()
            val fence = p.f.restart().readGolosRecoveryFence()!!.toString()
            repeat(3) { p.run() }
            assertEquals(initial, p.f.restart().readGolosProductionTransition()!!.toString())
            assertEquals(fence, p.f.restart().readGolosRecoveryFence()!!.toString())
            p.ready(); p.run()
            val current = p.f.restart().readGolosRecoveryFence()!!
            assertTrue(current.getBoolean("verified"))
            assertTrue(runCatching { p.f.restart().saveGolosRecoveryFence(JSONObject(current.toString()).put("headId", "%08x".format(current.getLong("head")) + "b".repeat(32))) }.isFailure)
        }
    }
    @Test fun wrongMissingCheckpointNonadvanceStaleAndCapabilityFailuresNeverMigrateOrSign() {
        for (mode in listOf("wrong", "missing", "nonadvance", "stale", "content", "history", "chain")) Fixture().use { p ->
            when (mode) {
                "wrong" -> p.checkpoint = "0".repeat(40)
                "missing" -> p.checkpoint = null
                "nonadvance" -> p.advance = false
                "stale" -> p.stale = true
                "content" -> p.emptyContent = true
                "history" -> p.badHistory = true
                "chain" -> p.f.configChain = "0".repeat(64)
            }
            assertFalse(mode, p.run().ok); assertNull(mode, p.f.restart().readGolosProductionTransition())
            assertTrue(mode, p.f.sends.isEmpty())
            assertFalse(p.f.requests.any { it.getJSONArray("params").getString(1) == "verify_authority" })
        }
    }
    @Test fun arbitraryVerifiedFenceHasNoAutomaticException() {
        Fixture().use { p ->
            val context = object : android.content.ContextWrapper(p.f.context) {
                override fun getFilesDir() = java.io.File(p.f.context.filesDir, "other").apply { mkdirs() }
            }
            val legacy = context.getSharedPreferences("other-${java.util.UUID.randomUUID()}", 0)
            legacy.edit().putBoolean("voteStorageUnsafe", true).commit()
            val other = WorkerStore(context, p.f.secure, legacy)
            val old = Fixture.oldFence().put("headId", "%08x".format(GolosProductionPolicy.FOREIGN_HEIGHT) + "b".repeat(32))
            other.saveGolosRecoveryFence(old)
            assertFalse(other.migrateReviewedGolosFence(p.admit()) { true })
            assertEquals(old.toString(), other.readGolosRecoveryFence()!!.toString()); assertNull(other.readGolosProductionTransition())
        }
    }
    @Test fun storageBoundaryFailuresBlockSendsAndRestartResumesExactlyOneEpoch() {
        for (boundary in listOf("start", "write", "sync", "finish", "directory", "readback", "verified")) Fixture().use { p ->
            val admitted = p.admit()
            var armed = false
            val store = p.f.restart(boundary = { at, _ -> if (armed && at == "checkpoint:$boundary") throw java.io.IOException("injected-$boundary") })
            armed = true
            assertTrue(boundary, runCatching { store.migrateReviewedGolosFence(admitted) { true } }.isFailure)
            assertEquals("storage_unverified", store.checkpointStatus().getString("authority"))
            assertTrue(p.f.sends.isEmpty())
            armed = false
            assertTrue(store.retryCheckpointStorage())
            val restarted = p.f.restart()
            val prior = restarted.readGolosProductionTransition()?.toString()
            restarted.migrateReviewedGolosFence(p.admit()) { true }
            val once = restarted.readGolosProductionTransition()!!.toString()
            if (prior != null) assertEquals(prior, once)
            assertFalse(restarted.migrateReviewedGolosFence(p.admit()) { true })
            assertEquals(once, restarted.readGolosProductionTransition()!!.toString())
        }
    }
    @Test fun irreversibleTimeEqualToDrainCannotAdoptButStrictlyLaterCan() {
        Fixture().use { p ->
            p.run(); p.ready()
            val store = p.f.restart()
            val fence = store.readGolosRecoveryFence()!!
            p.f.recoveryTime = fence.getLong("drain") + 3
            p.f.recoveryWall = p.f.recoveryTime * 1000
            val lane = GolosRecoveryFence(store::readGolosRecoveryFence, store::saveGolosRecoveryFence,
                { p.f.recoveryWall }, { p.f.recoveryMono })
            assertTrue(runCatching { lane.verify(p.rpc) }.isFailure)
            assertFalse(store.readGolosRecoveryFence()!!.getBoolean("verified"))
            p.f.recoveryTime++; p.f.recoveryWall += 1000
            assertNotNull(lane.verify(p.rpc))
            assertTrue(store.readGolosRecoveryFence()!!.getBoolean("verified"))
        }
    }

    @Test fun stoppedWorkerDoesNotMigrateOrEnableAnyConsent() {
        Fixture().use { p ->
            p.f.store.setWorkerEnabled(false)
            val old = p.f.store.readGolosRecoveryFence()!!.toString()
            val consent = p.f.store.golosDonateState("fixture-voter").toString()
            p.run()
            assertNull(p.f.restart().readGolosProductionTransition())
            assertEquals(old, p.f.restart().readGolosRecoveryFence()!!.toString())
            assertFalse(p.f.restart().workerEnabled())
            assertEquals(consent, p.f.restart().golosDonateState("fixture-voter").toString())
            assertTrue(p.f.sends.isEmpty())
        }
    }

    @Test fun committedRetiredEvidenceCannotBeChangedByOrdinaryCheckpointWrites() {
        Fixture().use { p ->
            p.run()
            val record = p.f.restart().readGolosProductionTransition()!!.toString()
            val edited = JSONObject(record).put("provenance", "changed-but-schema-valid")
            assertTrue(runCatching { p.f.store.checkpoint.put(mapOf("golosProductionTransition" to edited.toString())) }.isFailure)
            assertEquals(record, p.f.restart().readGolosProductionTransition()!!.toString())
        }
    }

    @Test fun retainedForeignBacklogDoesNotStarveNewProductionIntakeOrCopyForeignCursors() {
        Fixture().use { p ->
            val rows = JSONArray()
            repeat(1000) { rows.put(JSONObject().put("id", "foreign-$it").put("kind", "curator_vote").put("voter", "alice")
                .put("author", "target").put("permlink", "foreign-$it").put("weight", 7000).put("sourceIndex", it)) }
            val old = JSONObject().put("inbox", rows).put("sources", JSONObject().put("alice", JSONObject().put("scope", "beta:account_history").put("cursor", 99000)))
            p.f.store.checkpoint.put(mapOf("voteBacklog:golos:fixture-voter" to old.toString()))
            p.run()
            p.f.histories["alice"] = listOf(HistoryEvent(1, "vote", mapOf("voter" to "alice", "author" to "target", "permlink" to "new-source", "weight" to "7000")))
            val active = GolosEventBacklog(p.f.history, p.f.restart()).collect(AccountSettings("fixture-voter", true, curators = listOf("alice")))
            assertEquals(listOf("new-source"), active.map { it.permlink })
            assertEquals(1L, p.f.restart().readVoteBacklog("fixture-voter").getJSONObject("sources").getJSONObject("alice").getLong("cursor"))
            assertEquals(old.toString(), p.f.restart().checkpoint.read("voteBacklog:golos:fixture-voter"))
        }
    }
}
