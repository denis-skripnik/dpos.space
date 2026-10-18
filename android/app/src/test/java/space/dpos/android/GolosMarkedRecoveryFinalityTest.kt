package space.dpos.android

import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import space.dpos.android.notifications.HistoryEvent
import space.dpos.android.storage.EncryptedKeyRef
import space.dpos.android.upvoter.*

/** Real marked WorkerStore, production admission/migration and generated recovery identity.
 * Only loopback RPC, synthetic signing material and injected clocks; no admitted/proof shortcuts. */
@RunWith(RobolectricTestRunner::class)
class GolosMarkedRecoveryFinalityTest {
    @Test fun markedRecoveryDelayed36SecondsCompletesAndDonatesOnce() = scenario("success")
    @Test fun postSendPersistedFenceCutoffInvalidatesGeneration() = scenario("generation")
    @Test fun postSendFenceAnchorInvalidationRetainsIdentity() = scenario("fence")
    @Test fun postSendEndpointInvalidationRetainsIdentity() = scenario("endpoint")
    @Test fun staleFreshFenceHeadRetainsIdentity() = scenario("stale")
    @Test fun failingFreshFenceRpcRetainsIdentity() = scenario("failure")
    @Test fun cancellationInsideFreshVerificationRetainsIdentity() = scenario("cancel")
    @Test fun otherwiseValidFreshVerificationReturningAfterDeadlineRetainsIdentity() = scenario("late")

    private fun scenario(mode: String) = GolosProductionContractTest.Fixture().use { p ->
        val f = p.f
        p.ready(); p.run()
        val store = f.restart()
        assertTrue(store.requiresGolosRecovery())
        assertNotNull(store.readGolosProductionTransition())
        assertTrue(store.readGolosRecoveryFence()!!.getBoolean("verified"))
        val fenceBefore = store.readGolosRecoveryFence()!!.toString()
        var elapsed = 0L
        var sent = false
        var restart = false
        var verifying = false
        var verificationCalls = 0
        var donations = 0
        var lookups = 0
        var irreversibleProofs = 0
        var pendingAtSend: PendingBroadcastIntent? = null
        val op = VoteOperation("golos", "fixture-voter", "target", "fresh", 7000)
        val ref = EncryptedKeyRef("golos", "fixture-voter", "posting", "posting")
        fun advance(ms: Long) {
            elapsed += ms; f.recoveryWall += ms; f.recoveryMono += ms
            f.recoveryTime = f.recoveryWall / 1000
        }
        val receiptHeight = f.lib + 1
        f.receiptBlock = receiptHeight
        val rpc = object : GolosRpcClient by p.rpc {
            override val recoveryEndpoint: String get() = if (mode == "endpoint" && sent && !restart && lookups > 0) "changed-fixture-endpoint" else p.rpc.recoveryEndpoint
            override fun recoveryClients() = listOf(this)
            override fun getAccount(account: String) = p.rpc.getAccount(account)!!.apply {
                put("tip_balance", "4.000 GOLOS").put("vesting_shares", "1000.000000 GESTS")
                put("emission_delegated_vesting_shares", "100.000000 GESTS").put("emission_received_vesting_shares", "50.000000 GESTS")
            }
            override fun getDynamicGlobalProperties() = p.rpc.getDynamicGlobalProperties().apply {
                put("total_vesting_shares", "10000.000000 GESTS").put("accumulative_emission_per_day", "200.000 GOLOS")
                if (verifying && !restart && mode == "stale") put("time", GolosProductionContractTest.Fixture.stamp(f.recoveryTime - 121))
            }
            override fun getGolosConfig(): JSONObject? {
                if (verifying && !restart) {
                    verificationCalls++
                    // Delay the final head observation, keeping the earlier LIB proof coherent.
                    if (mode == "late" && verificationCalls == 2) advance(9_001)
                    when (mode) {
                        "failure" -> error("synthetic fresh verification unavailable")
                        "cancel" -> store.setWorkerEnabled(false)
                    }
                }
                return p.rpc.getGolosConfig()
            }
            override fun getBlockHeader(number: Long): JSONObject? {
                val header = p.rpc.getBlockHeader(number)
                if (verifying && !restart) {
                    if (mode == "fence" && number == store.readGolosRecoveryFence()!!.getLong("head") + 1)
                        return JSONObject(header.toString()).put("previous", "0".repeat(40))
                }
                return header
            }
            override fun getGolosTransaction(transactionId: String): JSONObject? {
                verifying = false
                lookups++
                val tx = p.rpc.getGolosTransaction(transactionId)
                if (!restart) {
                    assertEquals(pendingAtSend!!.transactionId, transactionId)
                    if (mode == "generation") {
                        val changed = store.readGolosRecoveryFence()!!
                        changed.put("cutoff", changed.getLong("cutoff") + 1)
                        store.saveGolosRecoveryFence(changed)
                        assertTrue(runCatching { GolosRecoveryFence.validateGeneration(
                            JSONObject(pendingAtSend!!.recoveryGeneration!!), f.restart().readGolosRecoveryFence()!!,
                            pendingAtSend!!.fingerprint) }.isFailure)
                    }
                    if (elapsed < 36_000) {
                        assertFalse(GolosVoteProof.lookup(op, transactionId, tx!!))
                        assertEquals(0, donations)
                    } else {
                        assertTrue(GolosVoteProof.lookup(op, transactionId, tx!!))
                        irreversibleProofs++
                        verifying = true
                    }
                }
                return tx
            }
        }
        val voteBroadcast = object : VoteBroadcaster {
            override fun broadcast(signedTransaction: JSONObject): JSONObject {
                pendingAtSend = store.readPending("vote", "golos", "fixture-voter")!!
                val generation = JSONObject(pendingAtSend!!.recoveryGeneration!!)
                GolosRecoveryFence.validateGeneration(generation, store.readGolosRecoveryFence()!!, pendingAtSend!!.fingerprint)
                assertEquals(rpc.recoveryEndpoint, generation.getString("endpoint"))
                assertFalse(store.isGolosForeignIntent(pendingAtSend!!))
                sent = true
                return p.rpc.broadcastTransactionSynchronous(signedTransaction)
            }
        }
        val donationBroadcast = object : VoteBroadcaster {
            override fun broadcast(signedTransaction: JSONObject): JSONObject {
                assertEquals("success", mode); assertEquals(36_000L, elapsed)
                assertNull(store.readPending("vote", "golos", "fixture-voter"))
                donations++
                val operations = signedTransaction.getJSONArray("operations")
                assertEquals(2, operations.length())
                val id = store.readPending("donate", "golos", "fixture-voter")!!.transactionId!!
                val old = f.histories["fixture-voter"].orEmpty()
                f.histories["fixture-voter"] = old + (0..1).map { i ->
                    val row = operations.getJSONArray(i)
                    assertEquals("donate", row.getString(0))
                    val data = row.getJSONObject(1)
                    HistoryEvent((old.maxOfOrNull { it.index } ?: 0) + i + 1, "donate",
                        data.keys().asSequence().associateWith { data.get(it).toString() } + ("trx_id" to id))
                }
                return JSONObject()
            }
        }
        val keys = object : PostingKeyProvider {
            override fun keyRef(chainId: String, account: String) = ref
            override fun privateWif(chainId: String, account: String) = f.wif
        }
        val plan = VotePlan(listOf(PlannedVote("fixture-voter", "target", "fresh", 7000, "favorite_post", 9800,
            donatePool = GolosDonatePool.parse("10 1"))), emptyList())
        fun runtime(selected: space.dpos.android.storage.WorkerStore): AutoVoteRuntime {
            val vote = VoteRuntime(rpc, broadcaster = voteBroadcast, historyClient = f.history, pendingStore = selected,
                confirmationRetries = 1, confirmationDelayMs = 0, canAct = { selected.workerEnabled() },
                recoveryWall = { f.recoveryWall }, recoveryMonotonic = { f.recoveryMono }, freshMonotonic = { f.recoveryMono },
                freshWait = { ms ->
                    assertFalse("restart must never fresh-poll", restart)
                    assertEquals(0, donations)
                    advance(ms)
                    if (elapsed >= 36_000) f.lib = receiptHeight
                })
            return AutoVoteRuntime(vote, keys, canAct = { selected.workerEnabled() }, donateRuntime =
                GolosDonateRuntime(rpc, f.history, selected, donationBroadcast, confirmationRetries = 1, confirmationDelayMs = 0))
        }
        val report = runtime(store).execute(plan)
        assertEquals(1, f.sends.size)
        assertNotNull(pendingAtSend!!.recoveryGeneration)
        if (mode == "success") {
            assertEquals("broadcast_confirmed", report.results.single().status)
            assertEquals(36_000L, elapsed); assertEquals(25, lookups)
            assertEquals(1, report.broadcasted); assertEquals(1, donations)
            assertEquals("donate_confirmed", report.donateResults.single().status)
            assertNull(f.restart().readPending("vote", "golos", "fixture-voter"))
            assertNull(f.restart().readPending("donate", "golos", "fixture-voter"))
        } else {
            assertEquals(mode, "broadcast_unknown", report.results.single().status)
            assertEquals(0, report.broadcasted); assertEquals(0, donations)
            assertTrue(report.donateResults.isEmpty())
            val retained = f.restart().readPending("vote", "golos", "fixture-voter")!!
            assertEquals(PendingBroadcastState.UNKNOWN, retained.state)
            assertEquals(pendingAtSend!!.transactionId, retained.transactionId)
            assertEquals(pendingAtSend!!.recoveryGeneration, retained.recoveryGeneration)
            assertFalse(f.restart().voteArchive("golos", "fixture-voter").any { it.confirmed })
            assertNull(f.restart().readPending("donate", "golos", "fixture-voter"))
        }
        if (mode !in listOf("endpoint", "generation")) {
            assertTrue("must reach extra fresh-fence verification", verificationCalls > 0)
            assertTrue(irreversibleProofs > 0)
        }
        if (mode == "late") {
            assertEquals(45_001L, elapsed)
            assertEquals("fresh verification reached its final head observation", 2, verificationCalls)
            // Independently confirm that the same RPC/fence still verifies at this clock value.
            val proof = GolosRecoveryFence(store::readGolosRecoveryFence, store::saveGolosRecoveryFence,
                { f.recoveryWall }, { f.recoveryMono }).verify(rpc)
            assertEquals(receiptHeight, proof.libHeight)
        }
        if (mode == "generation") assertEquals(JSONObject(fenceBefore).getLong("cutoff") + 1,
            f.restart().readGolosRecoveryFence()!!.getLong("cutoff"))
        else assertEquals(fenceBefore, f.restart().readGolosRecoveryFence()!!.toString())
        // Heal RPC/permission, reopen durable store and offer exact canonical finality.
        // Recovery may reconcile, but must never count a fresh send or catch up donations.
        restart = true; verifying = false; store.setWorkerEnabled(true); f.lib = receiptHeight
        repeat(2) {
            val reopened = f.restart()
            val beforeCounters = reopened.totalAutoUpvoterBroadcasted()
            if (mode == "generation") {
                // A persisted cutoff change invalidates this generation even after restart.
                // Reconciliation fails closed at the real generation validator.
                val failure = runCatching { runtime(reopened).execute(plan) }.exceptionOrNull()
                assertTrue(failure is IllegalArgumentException)
                assertTrue(failure!!.stackTrace.any { it.className.contains("GolosRecoveryFence") && it.methodName == "validateGeneration" })
                assertEquals(pendingAtSend!!.transactionId, f.restart().readPending("vote", "golos", "fixture-voter")!!.transactionId)
                assertFalse(f.restart().voteArchive("golos", "fixture-voter").any { it.confirmed })
            } else {
                val later = runtime(reopened).execute(plan)
                assertEquals(0, later.broadcasted); assertTrue(later.donateResults.isEmpty())
            }
            assertEquals(beforeCounters, f.restart().totalAutoUpvoterBroadcasted())
            assertNull(f.restart().readPending("donate", "golos", "fixture-voter"))
            assertEquals(1, f.sends.size); assertEquals(if (mode == "success") 1 else 0, donations)
        }
    }
}
