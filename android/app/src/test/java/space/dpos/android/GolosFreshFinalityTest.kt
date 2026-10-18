package space.dpos.android

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import org.bitcoinj.core.ECKey
import org.bitcoinj.params.MainNetParams
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import space.dpos.android.notifications.GolosHistoryClient
import space.dpos.android.notifications.HistoryEvent
import space.dpos.android.storage.EncryptedKeyRef
import space.dpos.android.storage.WorkerStore
import space.dpos.android.upvoter.*
import java.math.BigInteger

@RunWith(RobolectricTestRunner::class)
class GolosFreshFinalityTest {
    private val pool = GolosDonatePool.parse("10 1")
    private val op = VoteOperation("golos", "denis", "alice", "hello", 10000)
    private val ref = EncryptedKeyRef("golos", "denis", "posting", "posting")
    private val wif = ECKey.fromPrivate(BigInteger.valueOf(97), true).getPrivateKeyAsWiF(MainNetParams.get())
    private fun account(tip: String = "4.000 GOLOS") = JSONObject()
        .put("vesting_shares", "1000.000000 GESTS")
        .put("emission_delegated_vesting_shares", "100.000000 GESTS")
        .put("emission_received_vesting_shares", "50.000000 GESTS")
        .put("tip_balance", tip)
        .put("posting", JSONObject().put("weight_threshold", 1).put("key_auths", JSONArray().put(JSONArray().put(GraphenePublicKey.fromWif(wif)).put(1))))
    private fun props() = JSONObject().put("total_vesting_shares", "10000.000000 GESTS")
        .put("accumulative_emission_per_day", "200.000 GOLOS")
        .put("head_block_number", 200).put("time", "2026-09-26T00:00:00")
    private fun block() = JSONObject().put("previous", "000000c601020304000000000000000000000000000000000000000000000000")
        .put("timestamp", "2026-09-26T00:00:00")
    private open class FakeRpc(val account: JSONObject, val props: JSONObject, val block: JSONObject) : GolosRpcClient {
        override fun getGolosContent(author: String, permlink: String): JSONObject =
            JSONObject().put("author", author).put("permlink", permlink).put("parent_author", "").put("last_payout", "1970-01-01T00:00:00").put("cashout_time", "2099-01-01T00:00:00").put("created", "2026-01-01T00:00:00").put("last_update", "2026-01-01T00:00:00").put("num_changes", 0).put("allow_votes", true).put("active", "2026-01-01T00:00:00")
        var authority = true
        override fun getDynamicGlobalProperties() = props
        override fun getBlock(blockNumber: Long) = block
        override fun getAccount(account: String) = this.account
        override fun verifyAuthority(signedTransaction: JSONObject) = authority
        override fun verifyAuthorityDetailed(signedTransaction: JSONObject) = JSONObject().put("result", authority)
        override fun broadcastTransactionSynchronous(signedTransaction: JSONObject): JSONObject = error("not used")
    }
    private fun event(index: Long, recipient: String, amount: String, type: String, tx: String = "a".repeat(40)): HistoryEvent = HistoryEvent(index, "donate",
        mapOf("from" to "denis", "to" to recipient, "amount" to amount,
            "trx_id" to tx, "memo" to JSONObject().put("app", "dpos.space").put("version", 1)
                .put("target", JSONObject().put("type", type).put("author", "alice").put("permlink", "hello")).toString()))
    private class History : GolosHistoryClient {
        var rows: List<HistoryEvent> = listOf(HistoryEvent(90, "vote", emptyMap()))
        override fun getAccountHistory(account: String, from: Long, limit: Int) = rows.filter { from < 0 || it.index <= from }
    }


    @Test fun delayedCanonicalFinalityAt36SecondsEnablesExactlyOneFreshAtomicDonation() = scenario("success")
    @Test fun deadlinePreservesUnknownAndRestartCannotDonateOrReplay() = scenario("deadline")
    @Test fun stopDuringLookupCannotConfirmOrDonate() = scenario("stop_rpc")
    @Test fun stopDuringWaitCannotConfirmOrDonate() = scenario("stop_wait")
    @Test fun lateIrreversibleLookupCannotConfirmOrDonate() = scenario("late")
    @Test fun wrongTransactionIdCannotConfirmOrDonate() = scenario("wrong_id")
    @Test fun wrongCanonicalBlockCannotConfirmOrDonate() = scenario("wrong_block")
    @Test fun wrongEndpointCannotConfirmOrDonate() = scenario("wrong_endpoint")
    @Test fun replacedIntentCannotConfirmOrDonate() = scenario("intent_changed")
    @Test fun retiredIntentCannotConfirmOrDonate() = scenario("retired")
    @Test fun storageFailureCannotConfirmOrDonate() = scenario("storage_failed")
    @Test fun broadcastLatencyDoesNotConsumePostBroadcastWindow() = scenario("slow_broadcast")
    @Test fun workerBudgetIncludesFinalityAndHasFiniteCap() {
        assertEquals(855L, space.dpos.android.worker.autoVoteTimeoutSeconds("golos", 15))
        assertEquals(180L, space.dpos.android.worker.autoVoteTimeoutSeconds("hive", 15))
        assertEquals(180L, space.dpos.android.worker.autoVoteTimeoutSeconds("steem", 15))
        assertEquals(3600L, space.dpos.android.worker.autoVoteTimeoutSeconds("golos", Int.MAX_VALUE))
        assertEquals(60L, space.dpos.android.worker.autoVoteTimeoutSeconds("golos", 0))
    }

    private fun scenario(mode: String) {
        val base = ApplicationProvider.getApplicationContext<Context>()
        val context = object : android.content.ContextWrapper(base) {
            private val directory = java.io.File(base.filesDir, "fresh-finality-" + java.util.UUID.randomUUID()).apply { mkdirs() }
            override fun getFilesDir() = directory
        }
        val prefs = context.getSharedPreferences("dpos_worker", Context.MODE_PRIVATE)
        prefs.edit().clear().commit()
        val secure = context.getSharedPreferences("fresh-finality-secure", Context.MODE_PRIVATE)
        val store = WorkerStore(context, secure)
        var now = 0L
        var broadcastReturned = 0L
        var allowed = true
        var storageFailed = false
        var retired = false
        var recovering = false
        val lookupTimes = mutableListOf<Long>()
        val waits = mutableListOf<Long>()
        val guardedStore = object : VoteArchiveStore by store, GolosRecoveryStore by store {
            override fun isGolosForeignIntent(intent: PendingBroadcastIntent) = retired || store.isGolosForeignIntent(intent)
            override fun assertTransactionAuthority(kind: String, chainId: String, account: String) {
                check(!storageFailed) { "fixture storage failure" }
                store.assertTransactionAuthority(kind, chainId, account)
            }
        }
        var voteSends = 0
        var donateSends = 0
        var signed: JSONObject? = null
        val history = History()
        val rpc = object : FakeRpc(account(), props(), block()) {
            override val recoveryEndpoint = "fixture-pinned"
            override fun getActiveVotePercent(author: String, permlink: String, voter: String): Int? =
                if (recovering && mode == "success") 10000 else null
            override fun getGolosTransaction(transactionId: String): JSONObject? {
                lookupTimes += now
                if (!recovering) when (mode) {
                    "stop_rpc" -> allowed = false
                    "retired" -> retired = true
                    "late" -> now = broadcastReturned + 45_001
                    "intent_changed" -> store.archiveActiveVote("golos", "denis")
                    "storage_failed" -> storageFailed = true
                }
                val tx = signed ?: return null
                assertEquals(GolosVoteProof.id(tx, op), transactionId)
                val proof = JSONObject(tx.toString()).put("transaction_id", transactionId).put("block_num", 120).put("transaction_num", 0)
                    .put("_golosEndpoint", recoveryEndpoint)
                    .put("_golosBlock", JSONObject().put("transactions", JSONArray().put(tx)))
                    .put("_golosHead", JSONObject().put("head_block_number", 123)
                        .put("last_irreversible_block_num", if (recovering || (mode != "deadline" && now - broadcastReturned >= 36000)) 120 else 119))
                if (!recovering) when (mode) {
                    "wrong_id" -> proof.put("transaction_id", "0".repeat(40))
                    "wrong_block" -> proof.put("_golosBlock", JSONObject().put("transactions", JSONArray()))
                    "wrong_endpoint" -> proof.put("_golosEndpoint", "other-fixture")
                }
                return proof
            }
        }
        val voteBroadcast = object : VoteBroadcaster {
            override fun broadcast(signedTransaction: JSONObject): JSONObject {
                voteSends++
                signed = JSONObject(signedTransaction.toString())
                if (mode == "slow_broadcast") now += 120_000
                broadcastReturned = now
                return JSONObject()
            }
        }
        val donateBroadcast = object : VoteBroadcaster {
            override fun broadcast(signedTransaction: JSONObject): JSONObject {
                assertTrue("donation before finality", now - broadcastReturned >= 36000)
                donateSends++
                assertEquals(2, signedTransaction.getJSONArray("operations").length())
                val id = store.readPending("donate", "golos", "denis")!!.transactionId!!
                history.rows = listOf(event(92, "alice", "1.896 GOLOS", "post_donate", id),
                    event(93, "denis-skripnik", "0.004 GOLOS", "fee_donate", id))
                return JSONObject()
            }
        }
        val keys = object : PostingKeyProvider {
            override fun keyRef(chainId: String, account: String) = ref
            override fun privateWif(chainId: String, account: String) = wif
        }
        val vote = VoteRuntime(rpc, broadcaster = voteBroadcast, historyClient = history,
            pendingStore = guardedStore, confirmationRetries = 1, confirmationDelayMs = 0,
            canAct = { allowed }, recoveryMonotonic = { now }, freshMonotonic = { now },
            freshWait = { delay ->
                assertTrue("donation during finality wait", donateSends == 0)
                waits += delay
                now += delay
                if (mode == "stop_wait") allowed = false
            })
        val runtime = AutoVoteRuntime(vote, keys, canAct = { allowed }, donateRuntime = GolosDonateRuntime(rpc, history, store,
            donateBroadcast, confirmationRetries = 1, confirmationDelayMs = 0))
        val plan = VotePlan(listOf(PlannedVote("denis", "alice", "hello", 10000, "favorite_post", 9800,
            donatePool = pool)), emptyList())
        val report = runtime.execute(plan)
        assertEquals(1, voteSends)
        if (mode == "success" || mode == "slow_broadcast") {
            assertEquals(mode, "broadcast_confirmed", report.results.single().status)
            assertEquals(36_000L, now - broadcastReturned)
            assertEquals(25, lookupTimes.size)
            assertEquals(1, donateSends)
            assertEquals("donate_confirmed", report.donateResults.single().status)
        } else {
            assertEquals(mode, "broadcast_unknown", report.results.single().status)
            assertEquals(0, donateSends)
            assertTrue(report.donateResults.isEmpty())
            assertNull(store.readPending("donate", "golos", "denis"))
            if (mode != "intent_changed") assertNotNull(store.readPending("vote", "golos", "denis"))
            if (mode in listOf("deadline", "wrong_id", "wrong_block", "wrong_endpoint")) {
                assertEquals(45_000L, now)
                assertEquals(30, lookupTimes.size)
            }
            if (mode == "stop_wait" || mode == "stop_rpc" || mode == "late") assertEquals(1, lookupTimes.size)
        }
        assertTrue(waits.all { it == 1_500L })
        if (mode == "deadline" || mode == "success") {
            // A new runtime/store can reconcile canonical archive evidence but cannot catch up donations.
            recovering = true
            now = 60_000
            val restarted = WorkerStore(context, secure)
            val recoveredVote = VoteRuntime(rpc, broadcaster = voteBroadcast, historyClient = history,
                pendingStore = restarted, confirmationRetries = 1, confirmationDelayMs = 0,
                freshMonotonic = { now }, freshWait = { fail("archive must not enter fresh polling") })
            recoveredVote.reconcilePending("golos", "denis")
            val later = AutoVoteRuntime(recoveredVote, keys, donateRuntime = GolosDonateRuntime(rpc, history,
                restarted, donateBroadcast, confirmationRetries = 1, confirmationDelayMs = 0)).execute(plan)
            assertEquals("already_voted", later.results.single().status)
            assertTrue(later.donateResults.isEmpty())
            assertEquals(1, voteSends)
            assertEquals(if (mode == "success") 1 else 0, donateSends)
            assertEquals(0, later.broadcasted)
        }
    }
}
