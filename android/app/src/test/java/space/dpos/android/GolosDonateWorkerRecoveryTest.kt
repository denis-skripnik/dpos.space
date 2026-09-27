package space.dpos.android

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import space.dpos.android.notifications.GolosHistoryClient
import space.dpos.android.notifications.HistoryEvent
import space.dpos.android.runtime.AccountImportRequest
import space.dpos.android.runtime.WorkerCommandPolicy
import space.dpos.android.storage.WorkerStore
import space.dpos.android.upvoter.GolosRpcClient
import space.dpos.android.upvoter.PendingBroadcastIntent
import space.dpos.android.worker.DposWorkerRunner
import java.security.MessageDigest

@RunWith(RobolectricTestRunner::class)
class GolosDonateWorkerRecoveryTest {
    private val account = "denis"
    private val fingerprint = MessageDigest.getInstance("SHA-256").digest("alice/hello".toByteArray())
        .joinToString("") { "%02x".format(it) }
    private val memo = "$fingerprint|alice|hello|1.896 GOLOS|0.004 GOLOS"
    private val context get() = ApplicationProvider.getApplicationContext<Context>()

    private fun store(): WorkerStore = WorkerStore(context, context.getSharedPreferences("donate-worker-test-secure", Context.MODE_PRIVATE))
    private fun setup(): WorkerStore {
        context.getSharedPreferences("dpos_worker", Context.MODE_PRIVATE).edit().clear().commit()
        val s = store()
        s.setWorkerEnabled(true)
        s.importDecision(WorkerCommandPolicy.validateImport(AccountImportRequest("golos", account,
            enableNotifications = false, enableAutoUpvoter = true, explicitConsent = true,
            autoDonate = true, autoDonatePool = "10 1")))
        assertNotNull(s.autoDonatePool("golos", account))
        s.savePending(PendingBroadcastIntent("donate", "golos", account, memo, 90, transactionId = "a".repeat(40)))
        s.saveEncryptedKeyRef(s.defaultPostingKeyRef("golos", account), "fixture-not-a-real-wif")
        return s
    }
    private fun event(index: Long, recipient: String, amount: String, type: String, tx: String = "a".repeat(40)) =
        HistoryEvent(index, "donate", mapOf("from" to account, "to" to recipient, "amount" to amount,
            "trx_id" to tx, "memo" to JSONObject().put("app", "dpos.space").put("version", 1)
                .put("target", JSONObject().put("type", type).put("author", "alice").put("permlink", "hello")).toString()))
    private val author get() = event(91, "alice", "1.896 GOLOS", "post_donate")
    private val fee get() = event(92, "denis-skripnik", "0.004 GOLOS", "fee_donate")
    private fun check(rows: List<HistoryEvent>?, s: WorkerStore = store()): Int {
        var broadcasts = 0
        val rpc = object : GolosRpcClient {
            override fun getDynamicGlobalProperties(): JSONObject = error("not needed without key")
            override fun getBlock(blockNumber: Long): JSONObject? = error("not needed")
            override fun getAccount(account: String): JSONObject? = JSONObject().put("voting_power", 10000)
            override fun verifyAuthority(signedTransaction: JSONObject): Boolean = error("not needed")
            override fun verifyAuthorityDetailed(signedTransaction: JSONObject): JSONObject = error("not needed")
            override fun broadcastTransactionSynchronous(signedTransaction: JSONObject): JSONObject { broadcasts++; error("broadcast forbidden") }
        }
        val history = object : GolosHistoryClient {
            override fun getAccountHistory(account: String, from: Long, limit: Int): List<HistoryEvent> =
                rows ?: error("history unavailable")
        }
        // The real runner entry point invokes reconciliation even when planning sees no events.
        val summary = DposWorkerRunner(context, store = s, historyOverride = { history }, rpcOverride = { rpc },
            eventsOverride = { _, _ -> emptyList() }).runOnce("donate-restart")
        assertEquals(if (s.workerEnabled()) 1 else 0, summary.autoUpvoterChecks)
        assertEquals(0, summary.autoUpvoterBroadcasted)
        assertEquals(0, summary.autoUpvoterCandidates)
        return broadcasts
    }
    @Test fun confirmedAtomicHistoryAfterStoreRecreationSettlesWithoutVoteCandidateOrBroadcast() {
        setup()
        val restarted = store()
        assertEquals(0, check(listOf(fee, author, HistoryEvent(90, "vote", mapOf("voter" to account, "author" to "alice", "permlink" to "hello"))), restarted))
        assertNull(restarted.readPending("donate", "golos", account))
        assertTrue(restarted.donated(account, fingerprint))
        assertEquals(0, check(listOf(fee, author), store()))
    }
    @Test fun partialDifferentTransactionsAndUnavailableHistoryKeepPending() {
        for (rows in listOf(listOf(author), listOf(author, fee.copy(data = fee.data + ("trx_id" to "b".repeat(40)))), null)) {
            setup()
            assertEquals(0, check(rows))
            assertNotNull(store().readPending("donate", "golos", account))
            assertFalse(store().donated(account, fingerprint))
        }
    }
    @Test fun stoppedWorkerOrRevokedDonationConsentNeverReconciles() {
        for (stop in listOf(true, false)) {
            val s = setup()
            if (stop) s.setWorkerEnabled(false) else s.importDecision(WorkerCommandPolicy.validateImport(AccountImportRequest(
                "golos", account, enableNotifications = false, enableAutoUpvoter = true,
                explicitConsent = true, autoDonate = false)))
            assertEquals(0, check(listOf(author, fee)))
            assertNotNull(store().readPending("donate", "golos", account))
            assertFalse(store().donated(account, fingerprint))
        }
    }
}
