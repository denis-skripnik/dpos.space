package space.dpos.android

import androidx.test.ext.junit.runners.AndroidJUnit4
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import space.dpos.android.upvoter.*
import space.dpos.android.worker.DposWorkerRunner
import space.dpos.android.runtime.*
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.Executors

/** No admission stubs: every run enters DposWorkerRunner -> policy -> HTTP -> disk -> native signer. */
@RunWith(AndroidJUnit4::class)
class GolosFullFlowRunnerAndroidTest {
    private fun event(post: String = "fresh", kind: String = "curator_vote", weight: Int = 7000) =
        VoteEvent(kind, "alice", "target", post, weight, sourceIndex = 1)

    @Test fun receiptFixtureMatchesFrozenIndependentGolosUnsignedVector() {
        val tx = JSONObject("""{"ref_block_num":12345,"ref_block_prefix":1234567890,"expiration":"2026-10-10T09:00:00","operations":[["vote",{"voter":"denis-skripnik","author":"unik09","permlink":"iz-arkhiva-dlya-ponedelnika","weight":7000}]],"extensions":[]}""")
        assertEquals("f79faf9d19eb2931979f158d4e8dafb8b2ad7df8", FullFlowReceiptOracle.id(tx))
    }

    @Test fun runnerRejectsNoncanonicalWrongIndexAndReversibleReceiptsWithoutSuccessOrDonation() {
        for (mode in listOf("wrongindex", "changedop", "reversible")) FullFlowProductionFixture().use { p ->
            p.ready()
            if (mode == "reversible") p.f.receiptBlock = p.f.lib + 10
            if (mode == "wrongindex") p.f.receiptIndexOffset = 7
            if (mode == "changedop") p.f.badCanonical = true
            val result = p.run(events = listOf(event()))
            assertEquals("$mode ${result.toJson()}", 0, result.autoUpvoterBroadcasted)
            assertEquals(1, p.f.sends.size); assertEquals(0, p.f.restart().totalAutoUpvoterBroadcasted())
            assertFalse(p.f.restart().voteArchive("golos", "fixture-voter").single { it.intent.fingerprint.contains("fresh") }.confirmed)
            p.run(events = listOf(event(weight = 9999)))
            assertEquals("receipt failure replayed $mode", 1, p.f.sends.size)
            assertNull(p.f.restart().readPending("donate", "golos", "fixture-voter"))
        }
    }

    @Test fun actualHttpDivergentPeersNeverRankByHigherHeadOrMatchingChainId() {
        FullFlowProductionFixture().use { p -> FullFlowProductionFixture().use { beta ->
            beta.f.recoveryHead += 100000; beta.f.lib += 100000
            beta.checkpoint = GolosProductionPolicy.FOREIGN_ID
            assertEquals(GOLOS_CHAIN_ID, beta.rpc.getGolosConfig()!!.getString("STEEMIT_CHAIN_ID"))
            assertTrue(beta.rpc.getDynamicGlobalProperties().getLong("head_block_number") > p.rpc.getDynamicGlobalProperties().getLong("head_block_number"))
            beta.f.requests.clear()
            val fallback = FallbackGrapheneRpcClient(listOf(beta.rpc, p.rpc))
            DposWorkerRunner(p.f.context, p.f.restart(), rpcOverride = { fallback }, productionPolicy = p.policy,
                eventsOverride = { _, _ -> emptyList() }, recoveryWall = { p.f.recoveryWall }, recoveryMonotonic = { p.f.recoveryMono }).runOnce("two-http-peers")
            assertTrue(beta.f.requests.isEmpty())
            assertEquals(p.rpc.recoveryEndpoint, p.f.restart().readGolosRecoveryFence()!!.getString("endpoint"))
            assertNotNull(p.f.restart().readGolosProductionTransition())
            assertTrue(p.f.sends.isEmpty()); assertTrue(beta.f.sends.isEmpty())
        } }
    }

    @Test fun runnerAdmissionFailuresAndArbitraryVerifiedAnchorNeverEnterNativeTransport() {
        for (mode in listOf("wrong", "missing", "nonadvance", "stale", "content", "history", "config", "ownvotes", "arbitrary")) {
            FullFlowProductionFixture().use { p ->
                when (mode) {
                    "wrong" -> p.checkpoint = "0".repeat(40)
                    "missing" -> p.checkpoint = null
                    "nonadvance" -> p.advance = false
                    "stale" -> p.stale = true
                    "content" -> p.emptyContent = true
                    "history" -> p.badHistory = true
                    "config" -> p.f.configChain = "0".repeat(64)
                    "ownvotes" -> p.f.failVotes = true
                    "arbitrary" -> {
                        // Only fixture setup: approved public storage API; not production user data.
                        val other = FullFlowWireFixture(knownOld = true)
                        other.use {
                            other.store.saveGolosRecoveryFence(FullFlowProductionFixture.oldFence().put("headId", "%08x".format(GolosProductionPolicy.FOREIGN_HEIGHT) + "b".repeat(32)))
                            val report = p.run(other.store, listOf(event()))
                            assertEquals(0, report.autoUpvoterBroadcasted)
                            assertNull(other.store.readGolosProductionTransition())
                        }
                    }
                }
                if (mode != "arbitrary") {
                    assertFalse(mode, p.run(events = listOf(event())).ok)
                    assertNull(mode, p.f.restart().readGolosProductionTransition())
                }
                assertTrue(mode, p.f.sends.isEmpty())
                assertFalse(mode, p.f.requests.any { it.getJSONArray("params").getString(1) == "verify_authority" })
            }
        }
    }

    @Test fun fullRunnerStrictCutoffFinalityRevisionOwnVoteAndTextualQuarantine() {
        for (mode in listOf("drain", "old", "equal", "reversible", "edited", "ownvoted", "known", "future")) {
            FullFlowProductionFixture().use { p ->
                p.run()
                if (mode != "drain") p.ready()
                val cutoff = p.f.restart().readGolosRecoveryFence()!!.getLong("cutoff")
                when (mode) {
                    "old" -> p.f.contentFields.put("created", FullFlowProductionFixture.stamp(cutoff - 1))
                    "equal" -> p.f.contentFields.put("created", FullFlowProductionFixture.stamp(cutoff))
                    "reversible" -> p.f.contentFields.put("created", FullFlowProductionFixture.stamp(p.f.recoveryTime + 3))
                    "edited" -> p.f.contentFields.put("num_changes", 1)
                    "ownvoted" -> p.f.ownVote = true
                }
                val report = p.run(events = listOf(event(if (mode == "known") "old" else "fresh", if (mode == "edited") "favorite_post" else "curator_vote")))
                if (mode == "future") {
                    assertEquals(report.toJson().toString(), 1, report.autoUpvoterBroadcasted)
                    assertEquals(1, p.f.sends.size)
                    assertTrue(p.f.restart().readGolosRecoveryFence()!!.getBoolean("verified"))
                    val tx = p.f.sends.single(); val op = tx.getJSONArray("operations").getJSONArray(0)
                    assertEquals("vote", op.getString(0)); assertEquals("target", op.getJSONObject(1).getString("author"))
                    assertEquals(1, tx.getJSONArray("signatures").length())
                    assertEquals(1, p.f.restart().totalAutoUpvoterBroadcasted())
                    assertEquals(0, p.run(events = listOf(event())).autoUpvoterBroadcasted)
                    assertEquals(1, p.f.sends.size); assertEquals(1, p.f.restart().totalAutoUpvoterBroadcasted())
                } else {
                    assertEquals("$mode ${report.toJson()}", 0, report.autoUpvoterBroadcasted)
                    assertTrue(mode, p.f.sends.isEmpty())
                }
            }
        }
    }

    @Test fun actualRunnerRequiresStrictlyLaterIrreversibleTimeThanDrain() {
        FullFlowProductionFixture().use { p ->
            p.ready()
            val drain = p.f.restart().readGolosRecoveryFence()!!.getLong("drain")
            val transition = p.f.restart().readGolosProductionTransition()!!.toString()
            p.f.recoveryTime = drain; p.f.recoveryWall = drain * 1000
            p.run()
            assertFalse(p.f.restart().readGolosRecoveryFence()!!.getBoolean("verified"))
            assertTrue(p.f.sends.isEmpty())
            p.run()
            assertTrue(p.f.restart().readGolosRecoveryFence()!!.getBoolean("verified"))
            assertEquals(transition, p.f.restart().readGolosProductionTransition()!!.toString())
        }
    }

    @Test fun allFiftyRealHttpIntakeUnknownRetainedAndForeignBacklogCannotStarve() {
        FullFlowProductionFixture().use { p ->
            val foreign = JSONObject().put("inbox", JSONArray((1..1000).map { JSONObject().put("id", "foreign-$it").put("kind", "curator_vote").put("voter", "alice").put("author", "target").put("permlink", "foreign-$it").put("weight", 7000).put("sourceIndex", it) }))
                .put("sources", JSONObject().put("alice", JSONObject().put("scope", "foreign").put("cursor", 99000)))
            p.f.store.checkpoint.put(mapOf("voteBacklog:golos:fixture-voter" to foreign.toString()))
            p.ready()
            p.f.missingTargets += (1..50).map { "missing-$it" }
            p.f.histories["alice"] = (1..50).map { space.dpos.android.notifications.HistoryEvent(it.toLong(), "vote", mapOf("voter" to "alice", "author" to "target", "permlink" to "missing-$it", "weight" to "7000")) }
            val report = DposWorkerRunner(p.f.context, p.f.restart(), rpcOverride = { p.rpc }, productionPolicy = p.policy,
                recoveryWall = { p.f.recoveryWall }, recoveryMonotonic = { p.f.recoveryMono }).runOnce("real-intake-unknown")
            assertFalse(report.ok); assertEquals(50, report.autoUpvoterSkipSummary["root_post_empty"])
            val detail = report.errors.single { it.contains("autovoter_degraded") }
            assertTrue(detail.contains("policy=${GolosProductionPolicy.ID}") && detail.contains("endpoint=") && detail.contains("epoch="))
            assertTrue(detail.length < 1500); assertTrue(p.f.sends.isEmpty())
            assertEquals(50, p.f.restart().readVoteBacklog("fixture-voter").getJSONArray("inbox").length())
            assertEquals(foreign.toString(), p.f.restart().checkpoint.read("voteBacklog:golos:fixture-voter"))
            assertEquals(50L, p.f.restart().readVoteBacklog("fixture-voter").getJSONObject("sources").getJSONObject("alice").getLong("cursor"))
        }
    }

    @Test fun realCheckpointFaultBoundariesRunThroughAdmissionBeforeStorageFailure() {
        for (boundary in listOf("start", "write", "sync", "finish", "directory", "readback", "verified")) {
            FullFlowProductionFixture().use { p ->
                var armed = false
                val broken = p.f.restart(boundary = { stage, file ->
                    assertTrue(file.canonicalPath.startsWith(p.f.context.filesDir.canonicalPath))
                    if (armed && stage == "checkpoint:$boundary") throw java.io.IOException("synthetic-$boundary")
                })
                armed = true
                p.run(broken, listOf(event()))
                assertEquals(boundary, "storage_unverified", broken.checkpointStatus().getString("authority"))
                assertTrue(p.f.sends.isEmpty())
                assertTrue(p.f.requests.any { it.getJSONArray("params").getString(1) == "get_config" })
                armed = false
                assertTrue(broken.retryCheckpointStorage())
                val before = p.f.restart().readGolosProductionTransition()?.toString()
                p.run(); val once = p.f.restart().readGolosProductionTransition()!!.toString()
                if (before != null) assertEquals(before, once)
                p.run(); assertEquals(once, p.f.restart().readGolosProductionTransition()!!.toString())
                assertTrue(p.f.sends.isEmpty())
            }
        }
    }

    @Test fun stopOrRevokeAcrossAdmissionPersistenceFinalReadAndPretransportWithOverlap() {
        for (stage in listOf("admission", "persistence", "finalread", "pretransport")) for (revoke in listOf(false, true)) {
            FullFlowProductionFixture().use { p ->
                p.f.store.importDecision(WorkerCommandPolicy.validateImport(AccountImportRequest("golos", "fixture-voter", enableNotifications = false,
                    enableAutoUpvoter = true, explicitConsent = true, curators = listOf("alice"), favorites = listOf("target"), autoDonate = true, autoDonatePool = "10 1")))
                val foreignDonation = PendingBroadcastIntent("donate", "golos", "fixture-voter", "${"a".repeat(64)}|target|old|1.000 GOLOS|0.001 GOLOS", -1, PendingBroadcastState.UNKNOWN, "b".repeat(40))
                p.f.store.savePending(foreignDonation)
                if (stage != "admission" && stage != "persistence") { p.ready(); p.run() }
                val label = "$stage revoke=$revoke"
                val entered = CountDownLatch(1); val release = CountDownLatch(1)
                val once = java.util.concurrent.atomic.AtomicBoolean(false)
                val holdTimedOut = java.util.concurrent.atomic.AtomicBoolean(false)
                fun hold() {
                    if (once.compareAndSet(false, true)) {
                        entered.countDown()
                        if (!release.await(10, TimeUnit.SECONDS)) {
                            holdTimedOut.set(true)
                            error("fixture hold timed out $label")
                        }
                    }
                }
                var reads = 0
                p.f.onMethod = { method ->
                    if (stage == "admission" && method == "get_config") hold()
                    if (stage == "finalread" && method == "get_content" && ++reads == 6) hold()
                    if (stage == "pretransport" && method == "get_content" && p.f.restart().readPending("vote", "golos", "fixture-voter") != null) hold()
                }
                var armed = false
                val selected = if (stage == "persistence") p.f.restart(boundary = { at, _ -> if (armed && at == "checkpoint:write") hold() }) else p.f.restart()
                // Constructors also validate under the checkpoint lock: create both before holding it.
                val overlapReason = "overlap-$stage-$revoke-${java.util.UUID.randomUUID()}"
                val overlapRunner = DposWorkerRunner(p.f.context, p.f.restart(), historyOverride = { p.f.history },
                    rpcOverride = { p.rpc }, eventsOverride = { _, _ -> listOf(event("overlap")) }, productionPolicy = p.policy,
                    recoveryWall = { p.f.recoveryWall }, recoveryMonotonic = { p.f.recoveryMono })
                armed = true
                val executor = Executors.newFixedThreadPool(3)
                val tasks = mutableListOf<java.util.concurrent.Future<*>>()
                val failures = mutableListOf<Throwable>()
                var finishRevocation: (() -> Unit)? = null
                try {
                    val task = executor.submit<space.dpos.android.worker.WorkerRunSummary> { p.run(selected, listOf(event())) }
                    tasks += task
                    assertTrue("boundary not reached $label", entered.await(12, TimeUnit.SECONDS))
                    if (stage == "finalread") assertFalse(p.f.requests.any { it.getJSONArray("params").getString(1) == "verify_authority" })
                    if (stage == "pretransport") {
                        assertNotNull(p.f.restart().readPending("vote", "golos", "fixture-voter"))
                        assertTrue(p.f.requests.any { it.getJSONArray("params").getString(1) == "verify_authority" })
                    }
                    // Same immediate cancellation + pending-durable-IO fence as bridge Stop/revoke.
                    // Persistence may hold the lock required by BOTH disable and the busy-branch log.
                    val oldToken = space.dpos.android.worker.WorkerCancellation.token { true }
                    val complete = space.dpos.android.worker.WorkerCancellation.beginRevocation()
                    finishRevocation = complete
                    assertFalse("old send token survived $label", oldToken.mayContinue())
                    assertFalse("new admission survived pending revoke $label", space.dpos.android.worker.WorkerCancellation.token { true }.mayContinue())
                    tasks += executor.submit {
                        if (revoke) p.f.store.disableAutoUpvoter("golos", "fixture-voter")
                        else p.f.store.setWorkerEnabled(false)
                        complete()
                    }
                    // An overlapping runner would also reconcile pending donations if it acquired ownership.
                    tasks += executor.submit {
                        assertEquals(label, "skipped_overlap", overlapRunner.runOnce(overlapReason).status)
                    }
                    // This real diagnostic receipt precedes the checkpoint-dependent short-log write.
                    // Await CAS rejection, NOT completion of a log write that needs our held lock.
                    val deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(5)
                    val receipt = "worker run skipped; previous run still running; reason=$overlapReason"
                    while (!p.f.store.exportDiagnosticJournal().contains(receipt) && System.nanoTime() < deadline) Thread.yield()
                    assertTrue("overlap did not reject held owner $label", p.f.store.exportDiagnosticJournal().contains(receipt))
                    assertFalse("owner exited before release $label", task.isDone)
                } catch (error: Throwable) {
                    failures += error
                } finally {
                    release.countDown()
                    executor.shutdown()
                    // Drain and inspect EVERY future even when an earlier assertion/future failed.
                    tasks.forEach { future ->
                        try { future.get(20, TimeUnit.SECONDS) } catch (error: Throwable) { failures += error }
                    }
                    if (!executor.awaitTermination(20, TimeUnit.SECONDS)) {
                        executor.shutdownNow()
                        failures += AssertionError("fixture executor did not drain $label")
                        if (!executor.awaitTermination(20, TimeUnit.SECONDS)) failures += AssertionError("fixture executor still alive $label")
                    }
                    finishRevocation?.invoke()
                    if (holdTimedOut.get()) failures += AssertionError("fixture hold timed out $label")
                }
                if (failures.isNotEmpty()) throw failures.first().apply { failures.drop(1).forEach { addSuppressed(it) } }
                assertTrue("late send $stage revoke=$revoke", p.f.sends.isEmpty())
                assertEquals(0, p.f.restart().totalAutoUpvoterBroadcasted())
                assertEquals(foreignDonation.fingerprint, p.f.restart().readPending("donate", "golos", "fixture-voter")!!.fingerprint)
                assertFalse(p.f.restart().donated("fixture-voter", "a".repeat(64)))
                if (revoke) assertFalse(p.f.restart().autoUpvoterEnabled("golos", "fixture-voter"))
                else assertFalse(p.f.restart().workerEnabled())
                // Explicit fixture-only restart; empty intake must not replay the interrupted send or donation.
                p.f.store.importDecision(WorkerCommandPolicy.validateImport(AccountImportRequest("golos", "fixture-voter", enableNotifications = false,
                    enableAutoUpvoter = true, explicitConsent = true, curators = listOf("alice"), favorites = listOf("target"), autoDonate = true, autoDonatePool = "10 1")))
                p.f.store.setWorkerEnabled(true)
                p.f.onMethod = null
                p.run()
                assertTrue(p.f.sends.isEmpty()); assertEquals(0, p.f.restart().totalAutoUpvoterBroadcasted())
                assertNotNull(p.f.restart().readPending("donate", "golos", "fixture-voter"))
            }
        }
    }

    @Test fun dependentDonationRequiresExplicitSyntheticConsentAndExactAtomicReceiptOnce() {
        FullFlowProductionFixture().use { p ->
            p.f.store.importDecision(WorkerCommandPolicy.validateImport(AccountImportRequest("golos", "fixture-voter", enableNotifications = false,
                enableAutoUpvoter = true, explicitConsent = true, curators = listOf("alice"), favorites = listOf("target"),
                autoDonate = true, autoDonatePool = "10 1", minEnergy = 2500)))
            assertNotNull(p.f.store.autoDonatePool("golos", "fixture-voter"))
            p.f.tipBalance = "100.000 GOLOS"
            p.ready()
            val report = p.run(events = listOf(event()))
            assertEquals(report.toJson().toString(), 1, report.autoUpvoterBroadcasted)
            assertEquals(report.toJson().toString(), 2, p.f.sends.size)
            val donation = p.f.sends[1]
            assertEquals(2, donation.getJSONArray("operations").length())
            assertEquals("donate", donation.getJSONArray("operations").getJSONArray(0).getString(0))
            val fingerprint = java.security.MessageDigest.getInstance("SHA-256").digest("target/fresh".toByteArray()).joinToString("") { "%02x".format(it) }
            assertTrue(p.f.restart().donated("fixture-voter", fingerprint))
            assertNull(p.f.restart().readPending("donate", "golos", "fixture-voter"))
            p.run(events = listOf(event()))
            assertEquals(2, p.f.sends.size); assertEquals(1, p.f.restart().totalAutoUpvoterBroadcasted())
        }
    }
}
