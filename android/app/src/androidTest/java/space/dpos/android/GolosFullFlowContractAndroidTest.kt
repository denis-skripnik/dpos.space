package space.dpos.android

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import androidx.test.ext.junit.runners.AndroidJUnit4
import space.dpos.android.notifications.HistoryEvent
import space.dpos.android.storage.WorkerStore
import space.dpos.android.upvoter.*
import space.dpos.android.worker.DposWorkerRunner

@RunWith(AndroidJUnit4::class)
class GolosFullFlowContractAndroidTest {
    @Test fun restartNeverExtendsCommittedDrainAndGenericVerifiedFenceReplacementStillFails() {
        FullFlowProductionFixture().use { p ->
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
        for (mode in listOf("wrong", "missing", "nonadvance", "stale", "content", "history", "chain")) FullFlowProductionFixture().use { p ->
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
        FullFlowProductionFixture().use { p ->
            val context = object : android.content.ContextWrapper(p.f.context) {
                override fun getFilesDir() = java.io.File(p.f.context.filesDir, "other").apply { mkdirs() }
            }
            val legacy = context.getSharedPreferences("other-${java.util.UUID.randomUUID()}", 0)
            legacy.edit().putBoolean("voteStorageUnsafe", true).commit()
            val other = WorkerStore(context, p.f.secure, legacy)
            val old = FullFlowProductionFixture.oldFence().put("headId", "%08x".format(GolosProductionPolicy.FOREIGN_HEIGHT) + "b".repeat(32))
            other.saveGolosRecoveryFence(old)
            assertFalse(other.migrateReviewedGolosFence(p.admit()) { true })
            assertEquals(old.toString(), other.readGolosRecoveryFence()!!.toString()); assertNull(other.readGolosProductionTransition())
        }
    }
    @Test fun storageBoundaryFailuresBlockSendsAndRestartResumesExactlyOneEpoch() {
        for (boundary in listOf("start", "write", "sync", "finish", "directory", "readback", "verified")) FullFlowProductionFixture().use { p ->
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
        FullFlowProductionFixture().use { p ->
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
        FullFlowProductionFixture().use { p ->
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
        FullFlowProductionFixture().use { p ->
            p.run()
            val record = p.f.restart().readGolosProductionTransition()!!.toString()
            val edited = JSONObject(record).put("provenance", "changed-but-schema-valid")
            assertTrue(runCatching { p.f.store.checkpoint.put(mapOf("golosProductionTransition" to edited.toString())) }.isFailure)
            assertEquals(record, p.f.restart().readGolosProductionTransition()!!.toString())
        }
    }

    @Test fun retainedForeignBacklogDoesNotStarveNewProductionIntakeOrCopyForeignCursors() {
        FullFlowProductionFixture().use { p ->
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
