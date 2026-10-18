package space.dpos.android

import android.content.Context
import android.content.ContextWrapper
import androidx.test.core.app.ApplicationProvider
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import space.dpos.android.storage.TransactionCheckpointStore
import space.dpos.android.storage.WorkerStore
import space.dpos.android.upvoter.PendingBroadcastIntent
import java.io.File
import java.util.UUID

@RunWith(RobolectricTestRunner::class)
class TransactionCheckpointTest {
    private fun fixture(): Pair<Context, android.content.SharedPreferences> {
        val base = ApplicationProvider.getApplicationContext<Context>()
        val name = "checkpoint-${UUID.randomUUID()}"
        val dir = File(base.filesDir, name).apply { mkdirs() }
        val context = object : ContextWrapper(base) { override fun getFilesDir() = dir }
        return context to base.getSharedPreferences(name, Context.MODE_PRIVATE)
    }
    private fun intent(kind: String = "self_award", chain: String = "viz", tx: String = "a".repeat(40)) =
        PendingBroadcastIntent(kind, chain, "alice", if (kind == "vote") "bob|post|100" else "10|memo", -1,
            transactionId = tx, createdAtMs = 1000)

    @Test fun legacyCachedFenceIsPreservedAsEvidenceButCannotBecomeRecoveryAuthority() {
        val (ctx, prefs) = fixture()
        val forged = JSONObject().put("schema", 1).put("chainId", space.dpos.android.upvoter.GrapheneChainSpecs.require("golos").networkChainIdHex)
            .put("endpoint", "retired-cache").put("head", 1).put("headId", "00000001" + "a".repeat(32)).put("headTime", 1000L)
            .put("observedAtMs", 1000000L).put("drain", 1000L).put("cutoff", 1000L).put("verified", true).toString()
        prefs.edit().putBoolean("voteStorageUnsafe", true).putString("golosRecoveryFence", forged).commit()
        val store = WorkerStore(ctx, prefs, prefs)
        assertNull(store.readGolosRecoveryFence())
        assertTrue(store.requiresGolosRecovery())
        val evidence = JSONObject(File(ctx.filesDir, "transaction-checkpoint/legacy-import.json").readText())
        assertEquals(forged, evidence.getJSONObject("entries").getJSONObject("golosRecoveryFence").getString("value"))
    }
    @Test fun confirmedVizCompletionIsAtomicAndLateUnknownCannotResurrect() {
        val (ctx, prefs) = fixture(); val store = WorkerStore(ctx, prefs, prefs)
        val prior = intent()
        store.savePending(prior)
        store.completePending(prior, space.dpos.android.upvoter.PendingCompletionReason.CONFIRMED, 5000)
        val restarted = WorkerStore(ctx, prefs, prefs)
        assertNull(restarted.readPending("self_award", "viz", "alice"))
        assertEquals(5000L, restarted.lastVizSelfAwardAt("alice"))
        assertTrue(runCatching { restarted.savePending(prior.copy(state = space.dpos.android.upvoter.PendingBroadcastState.UNKNOWN)) }.isFailure)
        restarted.completePending(prior, space.dpos.android.upvoter.PendingCompletionReason.CONFIRMED, 6000)
        assertEquals("idempotence must not postpone cooldown", 5000L, restarted.lastVizSelfAwardAt("alice"))
    }
    @Test fun confirmedDonationCommitsReceiptWithRemoval() {
        val (ctx, prefs) = fixture(); val store = WorkerStore(ctx, prefs, prefs)
        val prior = intent(kind = "donate", chain = "golos").copy(fingerprint = "${"f".repeat(64)}|bob|post|1.000 GOLOS|0.001 GOLOS")
        store.savePending(prior)
        store.completePending(prior, space.dpos.android.upvoter.PendingCompletionReason.CONFIRMED, 5000)
        assertNull(store.readPending("donate", "golos", "alice"))
        assertTrue(store.donated("alice", "f".repeat(64)))
    }
    @Test fun importedRawEvidenceIsTypedImmutableAndOrdinaryWritesAreNotAuthority() {
        val (ctx, prefs) = fixture()
        val raw = " {broken"
        prefs.edit().putString("pendingTransaction:vote:golos:alice", raw).putBoolean("voteStorageUnsafe", true)
            .putBoolean("worker_enabled", true).putString("not-a-transaction", "not copied").commit()
        val store = WorkerStore(ctx, prefs, prefs)
        assertEquals("verified", store.checkpointStatus().getString("authority"))
        val backup = File(ctx.filesDir, "transaction-checkpoint/legacy-import.json")
        val before = backup.readBytes()
        assertEquals(raw, JSONObject(String(before)).getJSONObject("entries").getJSONObject("pendingTransaction:vote:golos:alice").getString("value"))
        assertFalse(String(before).contains("not copied"))
        assertTrue(store.checkpointStatus().getBoolean("legacyIdentityIncomplete"))
        prefs.edit().remove("pendingTransaction:vote:golos:alice").putBoolean("voteStorageUnsafe", false).commit()
        store.setWorkerEnabled(false)
        val reopened = WorkerStore(ctx, prefs, prefs)
        assertFalse(reopened.workerEnabled())
        assertTrue(reopened.checkpointStatus().getBoolean("legacyIdentityIncomplete"))
        assertTrue(before.contentEquals(backup.readBytes()))
        assertTrue(runCatching { reopened.readPending("vote", "golos", "alice") }.isFailure)
        reopened.savePending(intent()) // Scoped malformed Golos must not poison VIZ.
        assertEquals(intent(), reopened.readPending("self_award", "viz", "alice"))
    }
    @Test fun missingActivatedAuthorityNeverFallsBackToLegacyOrBackup() {
        val (ctx, prefs) = fixture()
        val store = WorkerStore(ctx, prefs, prefs)
        store.savePending(intent())
        File(ctx.filesDir, "transaction-checkpoint/transactions.json").delete()
        val reopened = WorkerStore(ctx, prefs, prefs)
        assertEquals("storage_unverified", reopened.checkpointStatus().getString("authority"))
        assertFalse(reopened.retryCheckpointStorage())
        assertTrue(runCatching { reopened.readPending("self_award", "viz", "alice") }.isFailure)
        assertTrue(runCatching { reopened.setWorkerEnabled(true) }.isFailure)
    }
    @Test fun explicitPhysicalFailuresCloseAuthorityAndBoundedRepairRetainsIntent() {
        val (ctx, prefs) = fixture()
        var fail = false
        val checkpoint = TransactionCheckpointStore(File(ctx.filesDir, "authority"), prefs) { stage, _ ->
            if (fail && stage == "checkpoint:sync") throw java.io.IOException("injected sync")
        }
        val key = "pendingTransaction:self_award:viz:alice"
        val raw = JSONObject().put("kind", "self_award").put("chainId", "viz").put("account", "alice")
            .put("fingerprint", "10|memo").put("historyBaseline", -1).toString()
        checkpoint.put(mapOf(key to raw))
        fail = true
        assertTrue(runCatching { checkpoint.put(mapOf(key to null)) }.isFailure)
        assertEquals("storage_unverified", checkpoint.status().getString("authority"))
        assertFalse(checkpoint.retryStorage())
        fail = false
        assertTrue(checkpoint.retryStorage())
        assertEquals(raw, checkpoint.read(key))
    }
    @Test fun completionFaultMatrixNeverSplitsSafetyEffects() {
        for (stage in listOf("start", "write", "sync", "finish", "directory", "readback", "verified")) {
            val (ctx, prefs) = fixture()
            var fail = false
            val journal = TransactionCheckpointStore(File(ctx.filesDir, "transaction-checkpoint"), prefs) { at, _ ->
                if (fail && at == "checkpoint:$stage") throw java.io.IOException("injected")
            }
            val store = WorkerStore(ctx, prefs, prefs, journal)
            val prior = intent()
            store.savePending(prior)
            fail = true
            assertTrue(runCatching { store.completePending(prior, space.dpos.android.upvoter.PendingCompletionReason.CONFIRMED, 5000) }.isFailure)
            assertEquals("storage_unverified", journal.status().getString("authority"))
            fail = false
            assertTrue(journal.retryStorage())
            val pending = store.readPending("self_award", "viz", "alice")
            if (pending == null) assertEquals(5000L, store.lastVizSelfAwardAt("alice"))
            else assertNull(store.lastVizSelfAwardAt("alice"))
        }
    }
    @Test fun signedMetadataSurvivesJsonNumericWidthAndTransportCannotCancelAsUnsent() {
        val (ctx, prefs) = fixture(); val store = WorkerStore(ctx, prefs, prefs)
        val prior = intent().copy(expirationEpochSeconds = 100L, observedHeadBlock = 123L, observedChainTimeSeconds = 60L)
        store.savePending(prior)
        store.markTransportEntered(prior)
        assertTrue(runCatching { store.completePending(prior, space.dpos.android.upvoter.PendingCompletionReason.UNSENT_CANCELLED, 5000) }.isFailure)
        store.savePending(prior.copy(state = space.dpos.android.upvoter.PendingBroadcastState.UNKNOWN))
        assertEquals(123L, store.readPending("self_award", "viz", "alice")!!.observedHeadBlock)
    }
    @Test fun importedPreparedIsNeverCurrentExecutionProofOfUnsent() {
        val (ctx, prefs) = fixture()
        val raw = JSONObject().put("kind", "self_award").put("chainId", "viz").put("account", "alice")
            .put("fingerprint", "10|memo").put("historyBaseline", -1).put("state", "PREPARED").toString()
        prefs.edit().putString("pendingTransaction:self_award:viz:alice", raw).commit()
        val store = WorkerStore(ctx, prefs, prefs)
        val prior = store.readPending("self_award", "viz", "alice")!!
        assertTrue(runCatching { store.completePending(prior, space.dpos.android.upvoter.PendingCompletionReason.UNSENT_CANCELLED, 5000) }.isFailure)
        assertEquals(prior, store.readPending("self_award", "viz", "alice"))
    }

    @Test fun markedEmptyAndNonemptyLegacyBothRetainAmbiguityWhileHealthyVizIsIndependent() {
        for (withIdentity in listOf(false, true)) {
            val (ctx, prefs) = fixture()
            val edit = prefs.edit().putBoolean("voteStorageUnsafe", true).putBoolean("worker_enabled", false)
            if (withIdentity) edit.putString("pendingTransaction:vote:golos:alice", JSONObject().put("kind", "vote")
                .put("chainId", "golos").put("account", "alice").put("fingerprint", "bob|post|100")
                .put("historyBaseline", -1).put("state", "UNKNOWN").toString())
            edit.commit()
            val store = WorkerStore(ctx, prefs, prefs)
            assertTrue(store.checkpointStatus().getBoolean("legacyIdentityIncomplete"))
            assertTrue(runCatching { store.assertFreshIntentAllowed("vote", "golos", "alice") }.isFailure)
            store.assertTransactionAuthority("vote", "golos", "alice")
            store.savePending(intent())
            assertEquals(intent(), store.readPending("self_award", "viz", "alice"))
            assertFalse(store.workerEnabled())
        }
    }
    @Test fun failedBackupBlocksEveryOrdinaryWriterAndRecoveryAttemptsAreBackedOff() {
        val (ctx, prefs) = fixture()
        val broken = TransactionCheckpointStore(File(ctx.filesDir, "bad"), prefs) { stage, _ ->
            if (stage == "backup:sync") throw java.io.IOException("injected")
        }
        val store = WorkerStore(ctx, prefs, prefs, broken)
        assertTrue(runCatching { store.setWorkerEnabled(true) }.isFailure)
        assertFalse(prefs.contains("worker_enabled"))
        val (ctx2, prefs2) = fixture(); var fail = false; var attempts = 0
        val journal = TransactionCheckpointStore(File(ctx2.filesDir, "journal"), prefs2) { stage, _ ->
            if (fail && stage == "checkpoint:sync") { attempts++; throw java.io.IOException("injected") }
        }
        fail = true
        assertTrue(runCatching { journal.put(mapOf("totalVizSelfAwardBroadcasted" to 1)) }.isFailure)
        assertFalse(journal.retryStorage(force = false))
        val previous = attempts
        assertFalse(journal.retryStorage(force = false))
        assertEquals(previous, attempts)
        fail = false
        assertTrue(journal.retryStorage(force = true))
    }

    @Test fun validJsonCorruptionCannotPassAuthorityDigestOrFallBackToOrdinaryPrefs() {
        val (ctx, prefs) = fixture(); val store = WorkerStore(ctx, prefs, prefs)
        store.savePending(intent())
        val file = File(ctx.filesDir, "transaction-checkpoint/transactions.json")
        val root = JSONObject(file.readText()).put("generation", 9999L)
        file.writeText(root.toString())
        val reopened = WorkerStore(ctx, prefs, prefs)
        assertEquals("storage_unverified", reopened.checkpointStatus().getString("authority"))
        assertFalse(reopened.retryCheckpointStorage())
        assertTrue(File(ctx.filesDir, "transaction-checkpoint/legacy-import.json").exists())
    }
    @Test fun lateCompletionCannotClearAnotherIdentityAndConcurrentArchivePreservesAllRows() {
        val (ctx, prefs) = fixture(); val first = WorkerStore(ctx, prefs, prefs); val second = WorkerStore(ctx, prefs, prefs)
        val cancelled = intent()
        first.savePending(cancelled)
        first.completePending(cancelled, space.dpos.android.upvoter.PendingCompletionReason.UNSENT_CANCELLED, 5000)
        val fresh = intent(tx = "b".repeat(40))
        second.savePending(fresh)
        first.completePending(cancelled, space.dpos.android.upvoter.PendingCompletionReason.UNSENT_CANCELLED, 6000)
        assertEquals(fresh, second.readPending("self_award", "viz", "alice"))
        assertTrue(runCatching { first.completePending(cancelled, space.dpos.android.upvoter.PendingCompletionReason.CONFIRMED, 6000) }.isFailure)
        val vote = intent("vote", "golos")
        first.savePending(vote)
        val pool = java.util.concurrent.Executors.newFixedThreadPool(2)
        try {
            val a = pool.submit { first.archiveActiveVote("golos", "alice") }
            val b = pool.submit { second.archiveActiveVote("golos", "alice") }
            a.get(); b.get()
            assertNull(first.readPending("vote", "golos", "alice"))
            assertEquals(listOf(vote.copy(state = space.dpos.android.upvoter.PendingBroadcastState.UNKNOWN)), second.voteArchive("golos", "alice").map { it.intent })
        } finally { pool.shutdownNow() }
    }

    @Test fun physicalRecoveryBackoffDoesNotPreventPersistingStop() {
        val (ctx, prefs) = fixture(); var fail = false
        val journal = TransactionCheckpointStore(File(ctx.filesDir, "transaction-checkpoint"), prefs) { stage, _ ->
            if (fail && stage == "checkpoint:sync") throw java.io.IOException("injected")
        }
        val store = WorkerStore(ctx, prefs, prefs, journal)
        store.setWorkerEnabled(true)
        store.savePending(intent())
        fail = true
        assertTrue(runCatching { store.savePending(intent().copy(state = space.dpos.android.upvoter.PendingBroadcastState.UNKNOWN)) }.isFailure)
        assertFalse(journal.retryStorage(force = false))
        val recreated = WorkerStore(ctx, prefs, prefs)
        assertEquals("storage_unverified", recreated.checkpointStatus().getString("authority"))
        recreated.setWorkerEnabled(false)
        assertFalse(prefs.getBoolean("worker_enabled", true))
        assertTrue(recreated.retryCheckpointStorage())
        assertFalse(WorkerStore(ctx, prefs, prefs).workerEnabled())
        assertEquals(intent(), recreated.readPending("self_award", "viz", "alice"))
    }

    @Test fun blindClearCannotDiscardUnknownIdentity() {
        val (ctx, prefs) = fixture()
        val store = WorkerStore(ctx, prefs, prefs)
        store.savePending(intent())
        assertTrue("completion needs expected identity and terminal reason", runCatching { store.clearPending("self_award", "viz", "alice") }.isFailure)
        assertEquals(intent(), store.readPending("self_award", "viz", "alice"))
    }
    @Test fun anotherStoreCannotOverwriteAnUnrelatedPendingIdentity() {
        val (ctx, prefs) = fixture()
        val first = WorkerStore(ctx, prefs, prefs)
        val second = WorkerStore(ctx, prefs, prefs)
        first.savePending(intent())
        assertTrue("VIZ unknown identity overwritten", runCatching { second.savePending(intent(tx = "b".repeat(40))) }.isFailure)
        assertEquals(intent(), first.readPending("self_award", "viz", "alice"))
    }
}
