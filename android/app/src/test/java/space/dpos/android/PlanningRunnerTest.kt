package space.dpos.android

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import space.dpos.android.runtime.*
import space.dpos.android.upvoter.*
import space.dpos.android.worker.*
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

@RunWith(RobolectricTestRunner::class)
class PlanningRunnerTest {
    private fun seed(p: HostFullFlowProductionFixture) {
        val inbox = JSONArray()
        repeat(60) { i -> inbox.put(JSONObject().put("id", "fixture-$i").put("kind", "curator_vote")
            .put("voter", "alice").put("author", "target").put("permlink", "p$i").put("weight", 100).put("sourceIndex", i)) }
        p.f.restart().saveVoteBacklog("fixture-voter", JSONObject().put("inbox", inbox))
    }
    private fun runner(p: HostFullFlowProductionFixture, status: (String) -> Unit = {}) = DposWorkerRunner(p.f.context, p.f.restart(),
        rpcOverride = { p.rpc }, historyOverride = { p.f.history }, productionPolicy = p.policy,
        recoveryWall = { p.f.recoveryWall }, recoveryMonotonic = { p.f.recoveryMono }, statusSink = status)

    @Test fun fullRunnerDefersSlowPlanningRetainsEveryRowAndContinuesPastFirstCandidateOnNextTick() {
        HostFullFlowProductionFixture().use { p ->
            p.ready(); seed(p)
            var planning = false
            var progress = false
            p.f.onContent = { if (planning) Thread.sleep(17_000) }
            val pool = Executors.newSingleThreadExecutor()
            val statuses = mutableListOf<String>()
            val work = pool.submit<WorkerRunSummary> { runner(p) { text ->
                statuses += text
                if (text.contains("планирую голоса")) planning = true
                if (text.contains("планирование проверено")) progress = true
            }.runOnce("planning-slow") }
            val result = try { work.get(20, TimeUnit.SECONDS) } finally {
                if (!work.isDone) WorkerCancellation.cancelAll()
                pool.shutdown()
                assertTrue("late planning owner did not drain", pool.awaitTermination(40, TimeUnit.SECONDS))
            }
            assertTrue(result.toJson().toString(), progress)
            assertTrue(result.messages.toString(), result.messages.any { it.contains("planning_deferred") && it.contains("49") })
            assertTrue(statuses.toString(), statuses.any { it.contains("планирование отложено") && it.contains("49") })
            assertFalse(result.messages.toString(), result.messages.any { it.contains("подходящих действий нет") })
            assertFalse(statuses.toString(), statuses.any { it.contains("автоапвоутер завершён; действий нет") })
            assertEquals(0, result.autoUpvoterBroadcasted)
            val after = p.f.restart().readVoteBacklog("fixture-voter")
            assertEquals(60, after.getJSONArray("inbox").length())
            assertEquals(1, after.getInt("processOffset"))
            assertTrue(p.f.sends.isEmpty())
            p.f.onContent = null
            p.f.requests.clear()
            runner(p) { if (it.contains("планирую голоса")) p.f.contentFields.put("parent_author", "reply") }.runOnce("planning-continue")
            val reached = p.f.requests.filter { it.getJSONArray("params").getString(1) == "get_content" }
                .map { it.getJSONArray("params").getJSONArray(2).getString(1) }
            assertTrue(reached.toString(), reached.contains("p50"))
            assertEquals(10, p.f.restart().readVoteBacklog("fixture-voter").getJSONArray("inbox").length())
            assertTrue(p.f.sends.isEmpty())
            assertFalse(p.f.restart().voteArchive("golos", "fixture-voter").single().confirmed)
        }
    }

    @Test fun stopDuringPlanningKeepsOwnershipUntilLateReadExitsAndCannotSignOrAcknowledge() {
        HostFullFlowProductionFixture().use { p ->
            p.ready(); seed(p)
            val entered = CountDownLatch(1); val release = CountDownLatch(1)
            var planning = false
            p.f.onContent = { if (planning) { entered.countDown(); release.await(8, TimeUnit.SECONDS) } }
            val pool = Executors.newSingleThreadExecutor()
            try {
                val work = pool.submit<WorkerRunSummary> { runner(p) { if (it.contains("планирую голоса")) planning = true }.runOnce("planning-stop") }
                assertTrue(entered.await(15, TimeUnit.SECONDS))
                WorkerCancellation.cancelAll()
                val afterStop = p.f.restart().readVoteBacklog("fixture-voter").toString()
                assertEquals("skipped_overlap", runner(p).runOnce("planning-overlap").status)
                release.countDown()
                work.get(15, TimeUnit.SECONDS)
                assertEquals(afterStop, p.f.restart().readVoteBacklog("fixture-voter").toString())
                assertTrue(p.f.sends.isEmpty())
                assertFalse(p.f.requests.any { it.getJSONArray("params").getString(1) == "verify_authority" })
                assertNull(p.f.restart().readPending("vote", "golos", "fixture-voter"))
            } finally { release.countDown(); pool.shutdownNow(); pool.awaitTermination(20, TimeUnit.SECONDS) }
        }
    }

    @Test fun fullTickReconcilesPendingVizBeforeEnteringGolosPlanningWithoutReplay() {
        HostFullFlowProductionFixture().use { p ->
            p.ready()
            val store = p.f.restart()
            store.importDecision(WorkerCommandPolicy.validateImport(AccountImportRequest("viz", "viz-fixture", enableNotifications = false, enableAutoUpvoter = false, explicitConsent = true)))
            store.syncVizSelfAward("viz-fixture", true, true, 9500)
            store.saveEncryptedKeyRef(store.defaultRegularKeyRef("viz", "viz-fixture"), p.f.wif)
            val pending = PendingBroadcastIntent("self_award", "viz", "viz-fixture", "10|dpos.space: VIZ self-award", -1,
                transactionId = "b".repeat(40), expirationEpochSeconds = System.currentTimeMillis() / 1000 + 60)
            store.savePending(pending)
            val order = mutableListOf<String>()
            val viz = object : GolosRpcClient by p.rpc {
                override fun getVizTransaction(transactionId: String): JSONObject? { order += "viz-proof"; return null }
                override fun broadcastTransactionSynchronous(signedTransaction: JSONObject): JSONObject = error("pending VIZ must not replay")
            }
            val result = DposWorkerRunner(p.f.context, store, rpcOverride = { if (it == "viz") viz else p.rpc }, historyOverride = { p.f.history },
                eventsOverride = { _, _ -> emptyList() }, productionPolicy = p.policy, recoveryWall = { p.f.recoveryWall }, recoveryMonotonic = { p.f.recoveryMono },
                statusSink = { if (it.contains("планирую голоса")) order += "golos-planning" }).runOnce("planning-viz-first")
            assertEquals(1, result.vizSelfAwardChecks)
            assertTrue(order.toString(), order.indexOf("viz-proof") >= 0 && order.indexOf("viz-proof") < order.indexOf("golos-planning"))
            assertNotNull(store.readPending("self_award", "viz", "viz-fixture"))
            assertTrue(p.f.sends.isEmpty())
        }
    }
}
