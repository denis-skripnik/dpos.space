package space.dpos.android

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import space.dpos.android.upvoter.VoteEvent
import java.io.File

/** Only the fixture's RPC world is restored from snapshot. Never edit checkpoint files. */
@RunWith(AndroidJUnit4::class)
class GolosFullFlowLifecycleAndroidTest {
    @Test fun distinctProcessPhases() {
        val args = InstrumentationRegistry.getArguments()
        val id = requireNotNull(args.getString("runId"))
        require(id.matches(Regex("[A-Za-z0-9_-]{1,60}")))
        val phase = requireNotNull(args.getString("phase"))
        val phases = listOf("seed", "migrated", "adopted", "confirmed", "unknown", "final")
        val index = phases.indexOf(phase); require(index >= 0)
        val target = InstrumentationRegistry.getInstrumentation().targetContext
        val evidence = File(target.filesDir, "golos-fullflow-evidence-$id")
        val snapshot = File(evidence, "world.json")
        if (index == 0) { check(!snapshot.exists()); check(evidence.isDirectory || evidence.mkdirs()) }
        val before = if (index == 0) null else JSONObject(snapshot.readText())
        val pid = android.os.Process.myPid()
        assertTrue("real Android PID must be positive", pid > 0)
        val priorPids = before?.getJSONArray("pids") ?: JSONArray()
        assertEquals("one durable PID per completed phase", index, priorPids.length())
        val seenPids = (0 until priorPids.length()).map { priorPids.getInt(it) }
        assertTrue("prior PIDs must be positive", seenPids.all { it > 0 })
        assertEquals("prior PIDs must be globally distinct", index, seenPids.toSet().size)
        assertFalse("nonadjacent PID reuse forbidden", pid in seenPids)
        if (before != null) {
            assertEquals(phases[index - 1], before.getString("phase"))
            assertNotEquals("driver must force-stop between phases", before.getInt("pid"), pid)
            assertEquals(before.getInt("pid"), seenPids.last())
        }
        FullFlowWireFixture(fixtureId = id, initialize = index == 0, port = before?.getInt("port") ?: 0).use { f ->
            FullFlowProductionFixture(f).use { p ->
                fun archive() = JSONArray(f.restart().voteArchive("golos", "fixture-voter").map { JSONObject().put("confirmed", it.confirmed)
                    .put("fingerprint", it.intent.fingerprint).put("transactionId", it.intent.transactionId)
                    .put("generation", it.intent.recoveryGeneration).put("state", it.intent.state.name) })
                if (before != null) {
                    f.recoveryWall = before.getLong("wall"); f.recoveryMono = before.getLong("mono")
                    f.recoveryHead = before.getLong("head"); f.lib = before.getLong("lib")
                    f.recoveryTime = before.getLong("time"); f.receiptBlock = before.getLong("receiptBlock")
                    f.contentFields = before.getJSONObject("content")
                    before.getJSONObject("transactions").let { txs -> txs.keys().forEach { f.transactions[it] = txs.getJSONObject(it) } }
                    f.histories["fixture-voter"] = before.getJSONArray("history").let { rows -> (0 until rows.length()).map {
                        val row = rows.getJSONObject(it); val data = row.getJSONObject("data")
                        space.dpos.android.notifications.HistoryEvent(row.getLong("index"), row.getString("type"), data.keys().asSequence().associateWith { data.getString(it) })
                    } }
                    assertEquals(before.optString("transition"), f.restart().readGolosProductionTransition()?.toString().orEmpty())
                    assertEquals(before.getString("fence"), f.restart().readGolosRecoveryFence()!!.toString())
                    assertEquals(before.getInt("counter"), f.restart().totalAutoUpvoterBroadcasted())
                    assertEquals(before.getJSONArray("archive").toString(), archive().toString())
                }
                fun event(name: String) = VoteEvent("curator_vote", "alice", "target", name, 7000, sourceIndex = 1)
                when (phase) {
                    "seed" -> { assertNull(f.restart().readGolosProductionTransition()); assertTrue(f.sends.isEmpty()) }
                    "migrated" -> {
                        p.run(); assertNotNull(f.restart().readGolosProductionTransition())
                        assertFalse(f.restart().readGolosRecoveryFence()!!.getBoolean("verified")); assertTrue(f.sends.isEmpty())
                    }
                    "adopted" -> {
                        p.ready(); p.run(); assertTrue(f.restart().readGolosRecoveryFence()!!.getBoolean("verified"))
                        assertTrue(f.sends.isEmpty())
                    }
                    "confirmed" -> {
                        p.run(events = listOf(event("fresh")))
                        assertEquals(1, f.sends.size); assertEquals(1, f.restart().totalAutoUpvoterBroadcasted())
                    }
                    "unknown" -> {
                        p.run(events = listOf(event("fresh"))); assertTrue("confirmed restart replay", f.sends.isEmpty())
                        f.unknownTargets += "uncertain"
                        p.run(events = listOf(event("uncertain")))
                        assertEquals(1, f.sends.size); assertEquals(1, f.restart().totalAutoUpvoterBroadcasted())
                        assertTrue(f.restart().voteArchive("golos", "fixture-voter").any { !it.confirmed && it.intent.fingerprint.contains("uncertain") })
                    }
                    "final" -> {
                        p.run(events = listOf(event("uncertain").copy(weight = 9999, kind = "favorite_post"), event("fresh")))
                        assertTrue("unknown restart replay", f.sends.isEmpty())
                        assertEquals(1, f.restart().totalAutoUpvoterBroadcasted())
                    }
                }
                val allPids = seenPids + pid
                if (phase == "final") assertEquals(6, allPids.toSet().size)
                val after = JSONObject().put("phase", phase).put("pid", pid).put("pids", JSONArray(allPids)).put("port", f.server.localPort)
                    .put("wall", f.recoveryWall).put("mono", f.recoveryMono).put("head", f.recoveryHead).put("lib", f.lib)
                    .put("time", f.recoveryTime).put("receiptBlock", f.receiptBlock).put("content", f.contentFields)
                    .put("transactions", JSONObject(f.transactions.toMap()))
                    .put("history", JSONArray(f.histories["fixture-voter"].orEmpty().map { JSONObject().put("index", it.index).put("type", it.type).put("data", JSONObject(it.data)) }))
                    .put("transition", f.restart().readGolosProductionTransition()?.toString().orEmpty())
                    .put("fence", f.restart().readGolosRecoveryFence()!!.toString()).put("counter", f.restart().totalAutoUpvoterBroadcasted())
                    .put("sends", f.sends.size).put("checkpointStatus", f.restart().checkpointStatus())
                    .put("archive", archive())
                snapshot.writeText(after.toString(2)); File(evidence, "$phase.json").writeText(after.toString(2))
                println("GOLOS_FULLFLOW phase=$phase pid=$pid sends=${f.sends.size} artifact=${File(evidence, "$phase.json").name}")
            }
        }
    }
}
