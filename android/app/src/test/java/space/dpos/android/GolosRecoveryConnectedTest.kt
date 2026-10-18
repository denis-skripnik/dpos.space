package space.dpos.android

import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import space.dpos.android.storage.EncryptedKeyRef
import space.dpos.android.upvoter.*

/** Actual HTTP loopback, signer, checkpoint and runtime. Not a real Android device gate. */
@RunWith(RobolectricTestRunner::class)
class GolosRecoveryConnectedTest {
    private val op = VoteOperation("golos", "fixture-voter", "target", "fresh", 7000)
    private val key = EncryptedKeyRef("golos", "fixture-voter", "posting", "posting")
    private fun ready(f: DeviceFollowupConnectedTest.Fixture) {
        assertEquals("recovery_deferred", f.recoveryRuntime().execute(op, key, f.wif).status)
        assertNotNull(f.restart().readGolosRecoveryFence()); assertTrue(f.sends.isEmpty())
        f.recoveryReady()
    }
    @Test fun markedEmptyAndNonemptyAllowOneCanonicalFutureRootWithoutErasingLegacyOrReplay() {
        for (nonempty in listOf(false, true)) DeviceFollowupConnectedTest.Fixture(recovery = true, knownOld = nonempty).use { f ->
            ready(f)
            val result = f.recoveryRuntime().execute(op, key, f.wif)
            assertEquals(result.reason, "broadcast_confirmed", result.status)
            assertEquals(1, f.sends.size)
            assertTrue(f.restart().checkpointStatus().getBoolean("legacyIdentityIncomplete"))
            assertTrue(f.restart().readGolosRecoveryFence()!!.getBoolean("verified"))
            assertEquals("already_voted", f.recoveryRuntime().execute(op.copy(weight = 9999), key, f.wif).status)
            assertEquals(1, f.sends.size)
            if (nonempty) {
                assertEquals("broadcast_unknown", f.recoveryRuntime().execute(op.copy(permlink = "old", weight = 9999), key, f.wif).status)
                assertFalse(f.restart().voteArchive("golos", "fixture-voter").first { it.intent.fingerprint.contains("|old|") }.confirmed)
            }
            assertNull(f.restart().readPending("donate", "golos", "fixture-voter"))
        }
    }
    @Test fun oldEditedEqualCutoffAndReversibleCreationCannotSend() {
        for (mode in listOf("old", "edited", "equal", "reversible")) DeviceFollowupConnectedTest.Fixture(recovery = true).use { f ->
            ready(f)
            val cutoff = f.restart().readGolosRecoveryFence()!!.getLong("cutoff")
            val created = if (mode == "reversible") f.recoveryTime else if (mode == "equal") cutoff else cutoff - 1
            f.contentFields.put("created", DeviceFollowupConnectedTest.Fixture.recoveryStamp(created))
            if (mode == "edited") f.contentFields.put("num_changes", 3).put("last_update", DeviceFollowupConnectedTest.Fixture.recoveryStamp(f.recoveryTime))
            assertEquals(if (mode == "reversible") "recovery_deferred" else "recovery_old_generation", f.recoveryRuntime().execute(op, key, f.wif).status)
            assertTrue(f.sends.isEmpty()); assertNull(f.restart().readPending("vote", "golos", "fixture-voter"))
        }
    }
    @Test fun recreatedLostNameIsPermittedButKnownUnknownAddressAcrossWeightStillBlocked() {
        DeviceFollowupConnectedTest.Fixture(recovery = true).use { f ->
            ready(f); f.contentFields.put("id", 900).put("root_comment", 900)
            val recreated = op.copy(permlink = "lost-old-address")
            assertEquals("broadcast_confirmed", f.recoveryRuntime().execute(recreated, key, f.wif).status)
            assertEquals(1, f.sends.size) // Explicit lost-name policy boundary, NOT first-ever-use proof.
        }
    }
    @Test fun completeWorkerFutureLaneConfirmsOnceAndReopensWithoutReplay() {
        for (known in listOf(false, true)) DeviceFollowupConnectedTest.Fixture(recovery = true, knownOld = known).use { f ->
            ready(f)
            fun run() = space.dpos.android.worker.DposWorkerRunner(f.context, f.restart(), historyOverride = { f.history }, productionPolicy = LegacyTestGolosPolicy(f.history), rpcOverride = { f.rpc },
                eventsOverride = { _, _ -> listOf(VoteEvent("curator_vote", "alice", "target", "fresh", 7000, sourceIndex = 1)) },
                recoveryWall = { f.recoveryWall }, recoveryMonotonic = { f.recoveryMono }).runOnce("future-worker-local")
            assertEquals(1, run().autoUpvoterBroadcasted); assertEquals(1, f.sends.size)
            assertEquals(0, run().autoUpvoterBroadcasted); assertEquals(1, f.sends.size)
            assertTrue(f.restart().requiresGolosRecovery())
            if (known) assertFalse(f.restart().voteArchive("golos", "fixture-voter").single().confirmed)
            assertNull(f.restart().readPending("donate", "golos", "fixture-voter"))
        }
    }
    @Test fun workerRejectsStaleHighEnergyPeerAndUsesPinnedFreshLowEnergyWithoutSend() {
        DeviceFollowupConnectedTest.Fixture(recovery = true).use { stale ->
            DeviceFollowupConnectedTest.Fixture(recovery = true).use { f ->
                ready(f); stale.recoveryReady(); stale.recoveryTime -= 121
                stale.energy = 10000; f.energy = 2000
                val fallback = FallbackGrapheneRpcClient(listOf(stale.rpc, f.rpc))
                val report = space.dpos.android.worker.DposWorkerRunner(f.context, f.restart(), historyOverride = { f.history }, productionPolicy = LegacyTestGolosPolicy(f.history), rpcOverride = { fallback },
                    eventsOverride = { _, _ -> listOf(VoteEvent("curator_vote", "alice", "target", "fresh", 7000, sourceIndex = 1)) },
                    recoveryWall = { f.recoveryWall }, recoveryMonotonic = { f.recoveryMono }).runOnce("future-energy-local")
                assertEquals(0, report.autoUpvoterBroadcasted); assertTrue(f.sends.isEmpty()); assertTrue(stale.sends.isEmpty())
                assertEquals(1, report.autoUpvoterSkipSummary["energy"])
                assertFalse(stale.requests.any { it.getJSONArray("params").getString(1) == "get_accounts" })
                assertEquals(f.rpc.recoveryEndpoint, f.restart().readGolosRecoveryFence()!!.getString("endpoint"))
            }
        }
    }
    @Test fun oldGenerationsAreAcknowledgedSoTheyCannotFillCapacityAndStarveFutureIntake() {
        DeviceFollowupConnectedTest.Fixture(recovery = true, knownOld = true).use { f ->
            ready(f)
            f.contentFields.put("created", DeviceFollowupConnectedTest.Fixture.recoveryStamp(f.restart().readGolosRecoveryFence()!!.getLong("cutoff")))
            val old = op.copy(permlink = "old-policy-root")
            val result = f.recoveryRuntime().execute(old, key, f.wif)
            assertEquals("recovery_old_generation", result.status); assertTrue(f.sends.isEmpty())
            val inbox = org.json.JSONArray()
            for ((post, kind) in listOf("old-policy-root" to "curator_vote", "old-policy-root" to "favorite_post", "old" to "curator_vote", "future-inbox" to "curator_vote")) {
                inbox.put(org.json.JSONObject().put("id", "fixture-" + inbox.length()).put("voter", "alice")
                    .put("weight", 7000).put("sourceIndex", inbox.length().toLong() + 1)
                    .put("author", "target").put("permlink", post).put("kind", kind))
            }
            f.store.saveVoteBacklog("fixture-voter", org.json.JSONObject().put("inbox", inbox))
            val report = AutoVoteRuntimeReport(1, 0, emptyList(), listOf(result), 1, emptyMap())
            GolosEventBacklog(f.history, f.store).acknowledge("fixture-voter", report, VotePlan(emptyList(), emptyList()))
            assertEquals(1, f.restart().readVoteBacklog("fixture-voter")!!.getJSONArray("inbox").length())
            assertEquals("future-inbox", f.restart().readVoteBacklog("fixture-voter")!!.getJSONArray("inbox").getJSONObject(0).getString("permlink"))
            assertEquals("future-inbox", GolosEventBacklog(f.history, f.restart()).collect(AccountSettings("fixture-voter", true, curators = listOf("alice"))).single().permlink)
            assertTrue(f.restart().requiresGolosRecovery())
            assertFalse(f.restart().voteArchive("golos", "fixture-voter").single().confirmed)
            assertEquals("broadcast_unknown", f.recoveryRuntime().execute(op.copy(permlink = "old", weight = 9999), key, f.wif).status)
        }
    }
    @Test fun preparedFutureCheckpointFailureStillHasZeroTransport() {
        DeviceFollowupConnectedTest.Fixture(recovery = true).use { f ->
            ready(f)
            GolosRecoveryFence(f.store::readGolosRecoveryFence, f.store::saveGolosRecoveryFence, { f.recoveryWall }, { f.recoveryMono }).verify(f.rpc)
            val failed = f.restart(boundary = { at, _ -> if (at == "checkpoint:sync") throw java.io.IOException("injected") })
            assertTrue(runCatching { f.recoveryRuntime(failed).execute(op, key, f.wif) }.isFailure)
            assertTrue(f.sends.isEmpty()); assertFalse(failed.retryCheckpointStorage())
        }
    }
    @Test fun latePreparationCancelsOnlyCurrentUnsentIntentInsteadOfSubmittingExpiredHeader() {
        DeviceFollowupConnectedTest.Fixture(recovery = true).use { f ->
            ready(f)
            f.onAuthority = {
                f.recoveryWall += 120_000; f.recoveryMono += 120_000; f.recoveryTime += 120
                f.recoveryHead += 40; f.lib += 40
            }
            val result = f.recoveryRuntime().execute(op, key, f.wif)
            assertEquals("recovery_deferred", result.status); assertTrue(result.reason.contains("recovery_header_expired"))
            assertTrue(f.sends.isEmpty()); assertNull(f.restart().readPending("vote", "golos", "fixture-voter"))
            assertTrue(f.restart().requiresGolosRecovery())
        }
    }
    @Test fun stopAndGenerationChangeAfterSigningNeverEnterTransport() {
        for (stop in listOf(false, true)) DeviceFollowupConnectedTest.Fixture(recovery = true).use { f ->
            ready(f)
            f.onAuthority = {
                if (stop) f.store.setWorkerEnabled(false)
                else f.contentFields.put("id", 100).put("root_comment", 100).put("num_changes", 1)
            }
            val result = f.recoveryRuntime().execute(op, key, f.wif)
            assertFalse(result.ok); assertTrue(f.sends.isEmpty())
            assertNull(f.restart().readPending("vote", "golos", "fixture-voter"))
        }
    }
    @Test fun stopDuringContentLookupAndPhysicalFenceFailureCannotSignOrSend() {
        DeviceFollowupConnectedTest.Fixture(recovery = true).use { f ->
            ready(f); f.onContent = { f.store.setWorkerEnabled(false) }
            assertFalse(f.recoveryRuntime().execute(op, key, f.wif).ok)
            assertTrue(f.sends.isEmpty())
            assertFalse(f.requests.any { it.getJSONArray("params").getString(1) == "verify_authority" })
        }
        DeviceFollowupConnectedTest.Fixture(recovery = true).use { f ->
            val failed = f.restart(boundary = { at, _ -> if (at == "checkpoint:sync") throw java.io.IOException("injected") })
            assertFalse(f.recoveryRuntime(failed).execute(op, key, f.wif).ok)
            assertTrue(f.sends.isEmpty()); assertFalse(failed.retryCheckpointStorage())
        }
    }
    @Test fun staleAndWrongChainAutomaticallyRetryAndFallbackPinsOneHealthyEndpoint() {
        DeviceFollowupConnectedTest.Fixture(recovery = true).use { f ->
            f.configChain = "0".repeat(64)
            assertEquals("recovery_deferred", f.recoveryRuntime().execute(op, key, f.wif).status)
            assertNull(f.restart().readGolosRecoveryFence())
            f.configChain = GrapheneChainSpecs.require("golos").networkChainIdHex
            ready(f)
            f.recoveryTime -= 121
            assertEquals("recovery_deferred", f.recoveryRuntime().execute(op, key, f.wif).status)
            f.recoveryTime += 121
            val real = f.rpc
            val dead = object : GolosRpcClient by real {
                override val recoveryEndpoint = "dead-endpoint"
                override fun getGolosConfig(): org.json.JSONObject = error("endpoint unavailable")
                override fun getGolosContent(author: String, permlink: String): org.json.JSONObject = error("must never mix")
                override fun broadcastTransactionSynchronous(signedTransaction: org.json.JSONObject): org.json.JSONObject = error("must never broadcast here")
                override fun recoveryClients() = listOf(this)
            }
            val result = f.recoveryRuntime(rpcSelected = FallbackGrapheneRpcClient(listOf(dead, real))).execute(op, key, f.wif)
            assertEquals(result.reason, "broadcast_confirmed", result.status); assertEquals(1, f.sends.size)
            assertEquals(real.recoveryEndpoint, f.restart().readGolosRecoveryFence()!!.getString("endpoint"))
        }
    }
    @Test fun uncertainFutureAttemptIsGuardedAcrossRestartAndRecreatedGeneration() {
        DeviceFollowupConnectedTest.Fixture(recovery = true).use { f ->
            ready(f); f.unknownTargets += "fresh"
            assertEquals("broadcast_unknown", f.recoveryRuntime().execute(op, key, f.wif).status)
            f.contentFields.put("id", 901).put("root_comment", 901)
            assertEquals("broadcast_unknown", f.recoveryRuntime().execute(op.copy(weight = 9999), key, f.wif).status)
            assertEquals(1, f.sends.size)
            assertFalse(f.restart().voteArchive("golos", "fixture-voter").single().confirmed)
        }
    }
}
