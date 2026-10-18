package space.dpos.android

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import space.dpos.android.storage.EncryptedKeyRef
import space.dpos.android.upvoter.*
import space.dpos.android.worker.DposWorkerRunner

@RunWith(RobolectricTestRunner::class)
class GolosProductionExecutionTest {
    private val op = VoteOperation("golos", "fixture-voter", "target", "fresh", 7000)
    private val key = EncryptedKeyRef("golos", "fixture-voter", "posting", "posting")
    @Test fun freshSameIdDivergentHigherBetaCannotWinAgainstLowerProduction() {
        GolosProductionContractTest.Fixture().use { p ->
            var betaReads = 0
            val beta = object : GolosRpcClient by p.rpc {
                override val recoveryEndpoint = "https://apibeta.golos.today"
                override fun getGolosConfig(): JSONObject? { betaReads++; return p.rpc.getGolosConfig() }
                override fun getDynamicGlobalProperties() = p.rpc.getDynamicGlobalProperties().put("head_block_number", 104862300L)
                    .put("head_block_id", DeviceFollowupConnectedTest.Fixture.recoveryId(104862300))
                override fun getBlockHeader(number: Long) = JSONObject().put("previous", GolosProductionPolicy.FOREIGN_ID)
            }
            assertEquals(GOLOS_CHAIN_ID, beta.getGolosConfig()!!.getString("STEEMIT_CHAIN_ID")); betaReads = 0
            val fallback = FallbackGrapheneRpcClient(listOf(beta, p.rpc))
            DposWorkerRunner(p.f.context, p.f.restart(), rpcOverride = { fallback }, productionPolicy = p.policy,
                eventsOverride = { _, _ -> emptyList() }, recoveryWall = { p.f.recoveryWall }, recoveryMonotonic = { p.f.recoveryMono }).runOnce("divergent-peers")
            assertEquals(0, betaReads)
            assertEquals(p.rpc.recoveryEndpoint, p.f.restart().readGolosRecoveryFence()!!.getString("endpoint"))
            assertTrue(p.f.sends.isEmpty())
        }
    }
    @Test fun noSignerBeforeAdoptionAndOnlyFutureIrreversibleUneditedUnknownFreeRootsReachRealSigner() {
        for (mode in listOf("drain", "old", "equal", "reversible", "edited", "known", "future")) GolosProductionContractTest.Fixture().use { p ->
            p.run()
            if (mode != "drain") p.ready()
            val cutoff = p.f.restart().readGolosRecoveryFence()!!.getLong("cutoff")
            when (mode) {
                "old" -> p.f.contentFields.put("created", GolosProductionContractTest.Fixture.stamp(cutoff - 1))
                "equal" -> p.f.contentFields.put("created", GolosProductionContractTest.Fixture.stamp(cutoff))
                "reversible" -> p.f.contentFields.put("created", GolosProductionContractTest.Fixture.stamp(p.f.recoveryTime))
                "edited" -> p.f.contentFields.put("num_changes", 1)
            }
            var signs = 0
            val real = GrapheneVoteSigner(GrapheneChainSpecs.require("golos"))
            val spy = object : VoteSigner {
                override fun sign(operation: VoteOperation, keyRef: EncryptedKeyRef?, privateWif: String?, header: BlockHeaderRef): VoteBroadcastResult {
                    signs++; return real.sign(operation, keyRef, privateWif, header)
                }
            }
            val runtime = VoteRuntime(p.rpc, signer = spy, historyClient = p.f.history, pendingStore = p.f.restart(),
                confirmationRetries = 1, confirmationDelayMs = 0, canAct = { p.f.store.workerEnabled() },
                recoveryWall = { p.f.recoveryWall }, recoveryMonotonic = { p.f.recoveryMono })
            val result = runtime.execute(if (mode == "known") op.copy(permlink = "old", weight = 9999) else op, key, p.f.wif,
                skipAnyExistingVote = true, requireGolosEligibility = true, favoritePost = mode == "edited")
            if (mode == "future") {
                assertEquals(result.reason, "broadcast_confirmed", result.status)
                assertEquals(result.reason, 1, signs); assertEquals(1, p.f.sends.size)
            } else {
                assertEquals("$mode: ${result.status}: ${result.reason}", 0, signs); assertTrue(p.f.sends.isEmpty())
            }
        }
    }
    @Test fun retiredProofUsesOriginalFenceAndCannotBecomeProductionConfirmationOrDonationCatchup() {
        GolosProductionContractTest.Fixture().use { p ->
            val old = p.f.store.readGolosRecoveryFence()!!
            val g = JSONObject().put("id", 8).put("root", 8).put("created", old.getLong("cutoff") + 3)
                .put("author", "target").put("permlink", "old").put("endpoint", old.getString("endpoint"))
                .put("fenceId", old.getString("headId")).put("cutoff", old.getLong("cutoff")).put("revision", "a".repeat(64))
                .put("libHeight", old.getLong("verifiedLib")).put("libTime", old.getLong("verifiedLibTime"))
            val archiveKey = "voteArchive:golos:fixture-voter"
            val rows = JSONArray(p.f.store.checkpoint.read(archiveKey) as String)
            rows.getJSONObject(0).getJSONObject("intent").put("recoveryGeneration", g.toString())
            p.f.store.checkpoint.put(mapOf(archiveKey to rows.toString()))
            p.run(); p.ready(); p.run()
            val store = p.f.restart()
            assertEquals(old.toString(), store.golosFenceForGeneration(g)!!.toString())
            GolosRecoveryFence.validateGeneration(g, store.golosFenceForGeneration(g)!!, "target|old|100")
            assertTrue(runCatching { GolosRecoveryFence.validateGeneration(g, store.readGolosRecoveryFence()!!, "target|old|100") }.isFailure)
            val archived = store.voteArchive("golos", "fixture-voter").single()
            assertTrue(store.isGolosForeignIntent(archived.intent))
            assertEquals("broadcast_unknown", p.f.recoveryRuntime(store, p.rpc).reconcilePending("golos", "fixture-voter")!!.status)
            assertTrue(runCatching { store.updateArchivedVote(archived.copy(confirmed = true)) }.isFailure)
            assertEquals(0, store.totalAutoUpvoterBroadcasted())
            assertTrue(p.f.sends.isEmpty()); assertNull(store.readPending("donate", "golos", "fixture-voter"))
            for (weight in listOf(1, 9999)) assertEquals("broadcast_unknown", p.f.recoveryRuntime(store, p.rpc).execute(op.copy(permlink = "old", weight = weight), key, p.f.wif).status)
        }
    }
    @Test fun foreignDonationRemainsQuarantinedAndConsentCountersAreUnchanged() {
        GolosProductionContractTest.Fixture().use { p ->
            val pending = PendingBroadcastIntent("donate", "golos", "fixture-voter", "${"a".repeat(64)}|target|old|1.000 GOLOS|0.001 GOLOS", -1,
                PendingBroadcastState.UNKNOWN, "b".repeat(40))
            p.f.store.savePending(pending)
            val consent = p.f.store.golosDonateState("fixture-voter").toString()
            p.run(); p.ready(); p.run()
            val store = p.f.restart()
            assertTrue(store.isGolosForeignIntent(pending))
            assertEquals("donate_unknown", GolosDonateRuntime(p.rpc, p.f.history, store, confirmationRetries = 1, confirmationDelayMs = 0).reconcilePending("fixture-voter").status)
            assertTrue(runCatching { store.completePending(pending, PendingCompletionReason.CONFIRMED) }.isFailure)
            assertNotNull(store.readPending("donate", "golos", "fixture-voter"))
            assertEquals(consent, store.golosDonateState("fixture-voter").toString())
            assertTrue(store.workerEnabled()); assertEquals(0, store.totalAutoUpvoterBroadcasted()); assertTrue(p.f.sends.isEmpty())
        }
    }
}
