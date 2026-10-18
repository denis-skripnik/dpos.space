package space.dpos.android

import android.content.Context
import android.content.ContextWrapper
import android.os.Process
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import space.dpos.android.storage.TransactionCheckpointStore
import space.dpos.android.storage.WorkerStore
import space.dpos.android.upvoter.PendingBroadcastIntent
import space.dpos.android.upvoter.PendingBroadcastState
import space.dpos.android.upvoter.PendingCompletionReason
import java.io.File

/** Run phases in separate `am instrument` invocations; never against a user's device.
 * All payloads are synthetic and this test never creates a broadcaster or imports keys.
 */
@RunWith(AndroidJUnit4::class)
class CheckpointAndroidRestartTest {
    private fun runId(): String = (InstrumentationRegistry.getArguments().getString("runId") ?: "default").also {
        require(it.matches(Regex("[A-Za-z0-9_-]{1,64}")))
    }
    @Test fun actualPreferencesPoisonAndAuthorityRestart() {
        val target = InstrumentationRegistry.getInstrumentation().targetContext
        val root = File(target.filesDir, "checkpoint-instrumented-${runId()}")
        val phase = InstrumentationRegistry.getArguments().getString("phase") ?: error("phase A/B required")
        val context = object : ContextWrapper(target) { override fun getFilesDir() = root }
        val preferenceName = "checkpoint-poison-${runId()}"
        val prefs = target.getSharedPreferences(preferenceName, Context.MODE_PRIVATE)
        val key = "pendingTransaction:vote:golos:alice"
        val raw = " {malformed preserved exactly"
        if (phase == "A") {
            check(!root.exists()) { "Use a fresh isolated emulator installation, not clear user data" }
            check(root.mkdirs())
            assertTrue(prefs.edit().putString(key, raw).putBoolean("worker_enabled", true).putInt("minEnergy:viz:alice", 9500).commit())
            val parent = File(target.applicationInfo.dataDir, "shared_prefs")
            val xml = File(parent, "$preferenceName.xml")
            val bak = File(parent, "$preferenceName.xml.bak")
            val saved = File(root, "original-prefs.xml")
            check(xml.renameTo(saved))
            // Real Android writeToFile fails after commitToMemory. No Editor wrapper.
            check(xml.mkdir()); File(xml, "block-delete").writeText("fixture")
            check(bak.mkdir()); File(bak, "block-delete").writeText("fixture")
            assertFalse("must be an actual disk failure", prefs.edit().remove(key).commit())
            assertFalse("Android cached map already changed", prefs.contains(key))
            check(xml.deleteRecursively()); check(bak.deleteRecursively()); check(saved.renameTo(xml))
            prefs.edit().putBoolean("voteStorageUnsafe", true).apply()
            prefs.edit().putString("logs", "unrelated flush").apply()
            assertTrue(prefs.edit().putLong("cursor:viz:alice:last", 12L).commit())
            // Bootstrap consumes the cached poisoned map, not a claimed pre-failure image.
            val store = WorkerStore(context, prefs, prefs)
            assertTrue(store.checkpointStatus().getBoolean("legacyIdentityIncomplete"))
            val award = PendingBroadcastIntent("self_award", "viz", "alice", "10|memo", -1,
                transactionId = "a".repeat(40), createdAtMs = 1000)
            store.savePending(award)
            store.completePending(award, PendingCompletionReason.CONFIRMED, 5000)
            assertEquals(5000L, store.lastVizSelfAwardAt("alice"))
            // Poison the retired cache AFTER activation; ordinary flush must not alter authority.
            prefs.edit().putString("pendingTransaction:self_award:viz:alice", "invalid retired").commit()
            store.setWorkerEnabled(false)
            File(root, "phaseA.pid").writeText(Process.myPid().toString())
        } else {
            assertEquals("B", phase)
            val priorPid = File(root, "phaseA.pid").readText().toInt()
            assertNotEquals("not a real process restart", priorPid, Process.myPid())
            assertFalse(prefs.contains(key))
            assertTrue(prefs.getBoolean("voteStorageUnsafe", false))
            val store = WorkerStore(context, prefs, prefs)
            assertTrue(store.checkpointStatus().getBoolean("legacyIdentityIncomplete"))
            assertFalse(store.workerEnabled())
            assertEquals(9500, store.minEnergy("viz", "alice"))
            assertNull(store.readPending("self_award", "viz", "alice"))
            assertEquals(5000L, store.lastVizSelfAwardAt("alice"))
            val award = PendingBroadcastIntent("self_award", "viz", "alice", "10|memo", -1,
                transactionId = "a".repeat(40), createdAtMs = 1000, state = PendingBroadcastState.UNKNOWN)
            assertTrue(runCatching { store.savePending(award) }.isFailure)
            println("CHECKPOINT_RESTART previousPid=$priorPid currentPid=${Process.myPid()} genuineFalseCommit=true cooldownRetained=true noReplay=true")
        }
    }

    @Test fun genuineFailedPreparationAndArchiveMoveSurviveDifferentPidFlush() {
        val target = InstrumentationRegistry.getInstrumentation().targetContext
        val phase = InstrumentationRegistry.getArguments().getString("phase")!!
        for (kind in listOf("prepare", "archive")) {
            val name = "poison-extra-$kind-${runId()}"
            val root = File(target.filesDir, name)
            val prefs = target.getSharedPreferences(name, 0)
            val pendingKey = "pendingTransaction:vote:golos:alice"
            val archiveKey = "voteArchive:golos:alice"
            val raw = JSONObject().put("kind", "vote").put("chainId", "golos").put("account", "alice")
                .put("fingerprint", "bob|post|100").put("historyBaseline", -1).put("state", "UNKNOWN").toString()
            val archive = org.json.JSONArray().put(JSONObject().put("intent", JSONObject(raw)).put("confirmed", false)).toString()
            if (phase == "A") {
                check(!root.exists()); check(root.mkdirs())
                val initial = prefs.edit().putBoolean("setting", true)
                if (kind == "archive") initial.putString(pendingKey, raw)
                assertTrue(initial.commit())
                val parent = File(target.applicationInfo.dataDir, "shared_prefs")
                val xml = File(parent, "$name.xml"); val bak = File(parent, "$name.xml.bak")
                val saved = File(root, "prior.xml"); check(xml.renameTo(saved))
                check(xml.mkdir()); File(xml, "block").writeText("fixture")
                check(bak.mkdir()); File(bak, "block").writeText("fixture")
                val edit = prefs.edit()
                if (kind == "archive") edit.remove(pendingKey).putString(archiveKey, archive) else edit.putString(pendingKey, raw)
                assertFalse(edit.commit())
                check(xml.deleteRecursively()); check(bak.deleteRecursively()); check(saved.renameTo(xml))
                prefs.edit().putBoolean("voteStorageUnsafe", true).apply()
                assertTrue(prefs.edit().putString("logs", "ordinary cache flush").commit())
                File(root, "pid").writeText(Process.myPid().toString())
            } else {
                assertNotEquals(File(root, "pid").readText().toInt(), Process.myPid())
                if (kind == "archive") { assertNull(prefs.getString(pendingKey, null)); assertEquals(archive, prefs.getString(archiveKey, null)) }
                else assertEquals(raw, prefs.getString(pendingKey, null))
                val ctx = object : ContextWrapper(target) { override fun getFilesDir() = root }
                val store = WorkerStore(ctx, prefs, prefs)
                assertTrue(store.checkpointStatus().getBoolean("legacyIdentityIncomplete"))
                assertTrue(runCatching { store.assertFreshIntentAllowed("vote", "golos", "alice") }.isFailure)
                val backup = JSONObject(File(root, "transaction-checkpoint/legacy-import.json").readText()).getJSONObject("entries")
                val key = if (kind == "archive") archiveKey else pendingKey
                assertEquals(if (kind == "archive") archive else raw, backup.getJSONObject(key).getString("value"))
            }
        }
        println("CHECKPOINT_ANDROID_POISON_EXTRAS phase=$phase currentPid=${Process.myPid()}")
    }

    @Test fun activeCheckpointOperationsRetainIdentityAtEveryBoundary() {
        if (InstrumentationRegistry.getArguments().getString("phase") != "A") return
        val target = InstrumentationRegistry.getInstrumentation().targetContext
        var cases = 0
        for (operation in listOf("unknown", "archive", "rotation", "donate", "cooldown"))
            for (stage in listOf("start", "write", "sync", "finish", "directory", "readback", "verified")) {
                val root = File(target.filesDir, "matrix-$operation-$stage-${runId()}")
                val prefs = target.getSharedPreferences("matrix-$operation-$stage-${runId()}", 0)
                val ctx = object : ContextWrapper(target) { override fun getFilesDir() = root }
                var fail = false
                val journal = TransactionCheckpointStore(File(root, "transaction-checkpoint"), prefs) { at, _ ->
                    if (fail && at == "checkpoint:$stage") throw java.io.IOException("injected")
                }
                val store = WorkerStore(ctx, prefs, prefs, journal)
                val kind = if (operation == "donate") "donate" else if (operation == "cooldown") "self_award" else "vote"
                val chain = if (kind == "self_award") "viz" else "golos"
                val fingerprint = if (kind == "donate") "${"f".repeat(64)}|bob|post|1.000 GOLOS|0.001 GOLOS" else if (kind == "vote") "bob|post|100" else "10|memo"
                val intent = PendingBroadcastIntent(kind, chain, "alice", fingerprint, -1, transactionId = "a".repeat(40), createdAtMs = 1000)
                store.savePending(intent)
                if (operation == "rotation") store.archiveActiveVote(chain, "alice")
                fail = true
                val failed = runCatching { when (operation) {
                    "unknown" -> store.savePending(intent.copy(state = PendingBroadcastState.UNKNOWN))
                    "archive" -> store.archiveActiveVote(chain, "alice")
                    "rotation" -> store.nextArchivedVote(chain, "alice")
                    else -> store.completePending(intent, PendingCompletionReason.CONFIRMED, 5000)
                } }
                assertTrue(failed.isFailure)
                assertEquals("storage_unverified", journal.status().getString("authority"))
                fail = false
                assertTrue(journal.retryStorage())
                val state = JSONObject(File(root, "transaction-checkpoint/transactions.json").readText())
                val known = state.getJSONObject("entries").keys().asSequence().any { it.startsWith("pendingTransaction:") || it.startsWith("voteArchive:") } || state.getJSONObject("terminal").length() == 1
                assertTrue("identity lost at $operation:$stage", known)
                if (operation == "cooldown" && store.readPending(kind, chain, "alice") == null) assertEquals(5000L, store.lastVizSelfAwardAt("alice"))
                if (operation == "donate" && store.readPending(kind, chain, "alice") == null) assertTrue(store.donated("alice", "f".repeat(64)))
                cases++
            }
        println("CHECKPOINT_ANDROID_ACTIVE_MATRIX cases=$cases")
    }

    @Test fun supportedAtomicFileBoundaryMatrix() {
        if (InstrumentationRegistry.getArguments().getString("phase") != "A") return
        val target = InstrumentationRegistry.getInstrumentation().targetContext
        for (purpose in listOf("backup", "checkpoint")) for (stage in listOf("start", "write", "sync", "finish", "directory", "readback", "verified")) {
            val dir = File(target.filesDir, "checkpoint-boundary-$purpose-$stage-${runId()}")
            check(!dir.exists())
            val prefs = target.getSharedPreferences("boundary-$purpose-$stage-${runId()}", Context.MODE_PRIVATE)
            val store = TransactionCheckpointStore(dir, prefs) { observed, _ ->
                if (observed == "$purpose:$stage") throw java.io.IOException("injected")
            }
            assertEquals("storage_unverified", store.status().getString("authority"))
            assertTrue(runCatching { store.put(mapOf("totalVizSelfAwardBroadcasted" to 1)) }.isFailure)
        }
        val dir = File(target.filesDir, "checkpoint-silent-rename-${runId()}")
        var sabotage = false
        val checkpoint = TransactionCheckpointStore(dir, target.getSharedPreferences("silent-rename-${runId()}", 0)) { stage, file ->
            if (sabotage && stage == "checkpoint:finish") check(File(file.path + ".new").delete())
        }
        checkpoint.put(mapOf("totalVizSelfAwardBroadcasted" to 1))
        sabotage = true
        assertTrue("AtomicFile rename can log rather than throw", runCatching { checkpoint.put(mapOf("totalVizSelfAwardBroadcasted" to 2)) }.isFailure)
        assertEquals("storage_unverified", checkpoint.status().getString("authority"))
        sabotage = false
        assertTrue(checkpoint.retryStorage())
        assertEquals(1, checkpoint.read("totalVizSelfAwardBroadcasted"))
        println("CHECKPOINT_ANDROID_ATOMIC boundaries=14 silentRenameRejected=true")
    }
}
