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
import space.dpos.android.runtime.AccountImportRequest
import space.dpos.android.runtime.WorkerCommandPolicy
import space.dpos.android.worker.DposWorkerRunner
import space.dpos.android.worker.foregroundCompletionStatus
import space.dpos.android.notifications.NotificationHelper
import android.app.Notification
import space.dpos.android.upvoter.*
import java.math.BigInteger
import java.time.LocalDateTime
import java.time.ZoneOffset

@RunWith(RobolectricTestRunner::class)
class VizPendingExpiryTest {
    private val wif = ECKey.fromPrivate(BigInteger("2"), true).getPrivateKeyAsWiF(MainNetParams.get())
    private val key = EncryptedKeyRef("viz", "alice", "regular", "regular")
    private val start = 1_780_000_000L
    private val fingerprint = "v2|10|$VIZ_SELF_AWARD_MEMO|denis-skripnik|100"

    private class Rpc(var time: Long, var height: Long = 1000, var stale: Boolean = false) : GolosRpcClient {
        var transaction: JSONObject? = null
        var lib: Long = 999
        var lookupUnavailable = false
        var energy: Int = 10000
        var accountErrorFor: String? = null
        override fun getVizTransaction(transactionId: String): JSONObject? {
            if (lookupUnavailable) error("lookup unavailable")
            return transaction
        }
        override fun getDynamicGlobalProperties(): JSONObject {
            if (stale) error("offline")
            return JSONObject().put("head_block_number", height).put("last_irreversible_block_num", lib)
                .put("time", LocalDateTime.ofEpochSecond(time, 0, ZoneOffset.UTC).toString())
        }
        override fun getBlock(blockNumber: Long): JSONObject = JSONObject().put("previous", "0000007901020304000000000000000000000000000000000000000000000000")
        override fun getAccount(account: String): JSONObject {
            if (account == accountErrorFor) error("RPC unavailable")
            return JSONObject().put("energy", energy).put("last_vote_time", LocalDateTime.ofEpochSecond(time, 0, ZoneOffset.UTC).toString())
                .put("regular_authority", JSONObject().put("weight_threshold", 1).put("key_auths", JSONArray().put(JSONArray().put(GraphenePublicKey.fromWif(
                    ECKey.fromPrivate(BigInteger("2"), true).getPrivateKeyAsWiF(MainNetParams.get()), "VIZ")).put(1))))
        }
        override fun verifyAuthority(signedTransaction: JSONObject) = true
        override fun verifyAuthorityDetailed(signedTransaction: JSONObject) = JSONObject().put("result", true)
        override fun broadcastTransactionSynchronous(signedTransaction: JSONObject) = JSONObject()
    }
    private class Broadcaster : VoteBroadcaster {
        val ids = mutableListOf<String>()
        override fun broadcast(signedTransaction: JSONObject): JSONObject {
            ids += signedTransaction.getString("expiration")
            return JSONObject().put("result", JSONObject())
        }
    }
    private fun store(): WorkerStore {
        val ctx = ApplicationProvider.getApplicationContext<Context>()
        ctx.getSharedPreferences("dpos_worker", Context.MODE_PRIVATE).edit().clear().commit()
        return WorkerStore(ctx, ctx.getSharedPreferences("viz_expiry_test_secure", Context.MODE_PRIVATE))
    }
    private fun runtime(rpc: Rpc, store: WorkerStore, broadcaster: Broadcaster, wall: () -> Long,
                        history: GolosHistoryClient = object : GolosHistoryClient { override fun getAccountHistory(account: String, from: Long, limit: Int): List<HistoryEvent> = emptyList() }, permit: () -> Boolean = { true }) =
        VizSelfAwardRuntime(rpc, broadcaster, history, confirmationRetries = 1, confirmationDelayMs = 0,
            canAct = permit, pendingStore = store, clockSeconds = wall)
    private fun run(runtime: VizSelfAwardRuntime, min: Int = 9500) = runtime.execute("alice", min, key, wif)

    @Test fun legacyObservationPersistsAcrossStoreRecreationAndNeverResendsOriginal() {
        val store = store()
        store.savePending(PendingBroadcastIntent("self_award", "viz", "alice", fingerprint, 42))
        var wall = start
        val rpc = Rpc(start)
        val broadcaster = Broadcaster()
        assertEquals("broadcast_unknown", run(runtime(rpc, store, broadcaster, { wall })).status)
        val observed = store.readPending("self_award", "viz", "alice")!!
        assertEquals(start, observed.observedChainTimeSeconds)
        assertEquals(1000L, observed.observedHeadBlock)
        val recreated = WorkerStore(ApplicationProvider.getApplicationContext(),
            ApplicationProvider.getApplicationContext<Context>().getSharedPreferences("viz_expiry_test_secure", Context.MODE_PRIVATE))
        wall += 431; rpc.time += 431; rpc.height++
        assertEquals("broadcast_unknown", run(runtime(rpc, recreated, broadcaster, { wall })).status)
        assertEquals(start, recreated.readPending("self_award", "viz", "alice")!!.observedChainTimeSeconds)
        wall++; rpc.time++; rpc.height++
        val recovered = run(runtime(rpc, recreated, broadcaster, { wall }))
        assertEquals("broadcast_unconfirmed", recovered.status)
        assertEquals("unknown_expired", recovered.diagnostics!!.getString("priorPendingOutcome"))
        val fresh = recreated.readPending("self_award", "viz", "alice")!!
        assertNotNull(fresh.transactionId)
        assertEquals(rpc.time + 60, fresh.expirationEpochSeconds)
        assertEquals(1, broadcaster.ids.size)
        // No second broadcast of either the expired or the newly pending transaction.
        assertEquals("broadcast_unknown", run(runtime(rpc, recreated, broadcaster, { wall })).status)
        assertEquals(1, broadcaster.ids.size)
    }

    @Test fun futureExpiryAndClockJumpsOrStaleRpcNeverClearPending() {
        val store = store()
        store.savePending(PendingBroadcastIntent("self_award", "viz", "alice", fingerprint, 42,
            transactionId = "a".repeat(40), expirationEpochSeconds = start + 500,
            observedChainTimeSeconds = start, observedHeadBlock = 1000))
        var wall = start + 432
        val rpc = Rpc(wall, 1001)
        val broadcaster = Broadcaster()
        assertEquals("broadcast_unknown", run(runtime(rpc, store, broadcaster, { wall })).status) // malformed future expiry (>120s) blocks
        assertNotNull(store.readPending("self_award", "viz", "alice"))
        store.savePending(store.readPending("self_award", "viz", "alice")!!.copy(expirationEpochSeconds = start + 60))
        rpc.height = 1000
        assertEquals("broadcast_unknown", run(runtime(rpc, store, broadcaster, { wall })).status)
        rpc.height++
        wall += 1000 // clock forward, node stayed at previous height/time
        assertEquals("broadcast_unknown", run(runtime(rpc, store, broadcaster, { wall })).status)
        wall = start - 1000
        assertEquals("broadcast_unknown", run(runtime(rpc, store, broadcaster, { wall })).status)
        wall = rpc.time; rpc.stale = true
        assertEquals("broadcast_unknown", run(runtime(rpc, store, broadcaster, { wall })).status)
        assertNotNull(store.readPending("self_award", "viz", "alice"))
        assertTrue(broadcaster.ids.isEmpty())
    }

    @Test fun exactConfirmationAndStopAndZeroEnergyPreserveGuards() {
        val store = store()
        val tx = "a".repeat(40)
        store.savePending(PendingBroadcastIntent("self_award", "viz", "alice", fingerprint, 42, transactionId = tx))
        val rpc = Rpc(start)
        rpc.transaction = awardTransaction(tx)
        val broadcaster = Broadcaster()
        val confirmation = run(runtime(rpc, store, broadcaster, { start }))
        assertEquals(confirmation.reason, "broadcast_confirmed", confirmation.status)
        assertNull(store.readPending("self_award", "viz", "alice"))
        assertEquals("cancelled", run(runtime(rpc, store, broadcaster, { start }, permit = { false })).status)
        rpc.energy = 9000
        assertEquals("low_energy_skip", run(runtime(rpc, store, broadcaster, { start }), min = 10000).status)
        assertTrue(broadcaster.ids.isEmpty())
    }

    private fun awardTransaction(id: String, energy: Int = 10): JSONObject {
        val beneficiary = JSONObject().put("account", "denis-skripnik").put("weight", 100)
        val award = JSONObject().put("initiator", "alice").put("receiver", "alice")
            .put("energy", energy).put("memo", VIZ_SELF_AWARD_MEMO)
            .put("beneficiaries", JSONArray().put(beneficiary))
        return JSONObject().put("transaction_id", id).put("block_num", 900)
            .put("operations", JSONArray().put(JSONArray().put("award").put(award)))
    }

    @Test fun includedBeforeLibRemainsPendingThenExactFinalityConfirmsWithoutHistory() {
        val store = store()
        val id = "b".repeat(40)
        store.savePending(PendingBroadcastIntent("self_award", "viz", "alice", fingerprint, -1, transactionId = id))
        val rpc = Rpc(start)
        rpc.transaction = awardTransaction(id)
        rpc.lib = 899
        val broadcaster = Broadcaster()
        assertEquals("broadcast_unknown", run(runtime(rpc, store, broadcaster, { start })).status)
        assertEquals(900L, store.readPending("self_award", "viz", "alice")!!.includedBlockNumber)
        rpc.time = start + 433; rpc.height++
        assertEquals("broadcast_unknown", run(runtime(rpc, store, broadcaster, { rpc.time })).status)
        rpc.lib = 900
        assertEquals("broadcast_confirmed", run(runtime(rpc, store, broadcaster, { rpc.time })).status)
        assertNull(store.readPending("self_award", "viz", "alice"))
        assertTrue(broadcaster.ids.isEmpty())
    }

    @Test fun mismatchedIdOrOperationAndUnavailableLookupCannotConfirm() {
        val store = store()
        val id = "c".repeat(40)
        store.savePending(PendingBroadcastIntent("self_award", "viz", "alice", fingerprint, -1, transactionId = id))
        val rpc = Rpc(start)
        val broadcaster = Broadcaster()
        rpc.transaction = awardTransaction("d".repeat(40))
        assertEquals("broadcast_unknown", run(runtime(rpc, store, broadcaster, { start })).status)
        rpc.transaction = awardTransaction(id, energy = 9)
        assertEquals("broadcast_unknown", run(runtime(rpc, store, broadcaster, { start })).status)
        rpc.lookupUnavailable = true
        assertEquals("broadcast_unknown", run(runtime(rpc, store, broadcaster, { start })).status)
        assertNotNull(store.readPending("self_award", "viz", "alice"))
        assertTrue(broadcaster.ids.isEmpty())
    }

    @Test fun freshPendingExpiryYieldsDifferentNewSignedTransactionId() {
        val store = store()
        val oldId = "f".repeat(40)
        store.savePending(PendingBroadcastIntent("self_award", "viz", "alice", fingerprint, -1,
            transactionId = oldId, expirationEpochSeconds = start + 60,
            observedChainTimeSeconds = start, observedHeadBlock = 1000))
        val rpc = Rpc(start + 432, 1001)
        val broadcaster = Broadcaster()
        val recovered = run(runtime(rpc, store, broadcaster, { rpc.time }))
        assertEquals("broadcast_unconfirmed", recovered.status)
        assertEquals("unknown_expired", recovered.diagnostics!!.getString("priorPendingOutcome"))
        assertNotEquals(oldId, store.readPending("self_award", "viz", "alice")!!.transactionId)
        assertEquals(1, broadcaster.ids.size)
        assertEquals("broadcast_unknown", run(runtime(rpc, store, broadcaster, { rpc.time })).status)
        assertEquals(1, broadcaster.ids.size)
    }

    @Test fun realRunnerReportsExpiryAndLowEnergyInSameTickWithoutBroadcast() {
        val store = store()
        store.setWorkerEnabled(true)
        store.importDecision(WorkerCommandPolicy.validateImport(AccountImportRequest("viz", "alice",
            enableNotifications = false, enableAutoUpvoter = false, explicitConsent = true)))
        store.syncVizSelfAward("alice", enabled = true, autoStart = true, minEnergy = 9500)
        store.saveEncryptedKeyRef(key, wif)
        val now = System.currentTimeMillis() / 1000
        store.savePending(PendingBroadcastIntent("self_award", "viz", "alice", fingerprint, -1,
            transactionId = "a".repeat(40), expirationEpochSeconds = now - 433 + 60,
            observedChainTimeSeconds = now - 433, observedHeadBlock = 1000))
        val rpc = Rpc(now, 1001).apply { energy = 9000 }
        val history = object : GolosHistoryClient {
            override fun getAccountHistory(account: String, from: Long, limit: Int): List<HistoryEvent> = emptyList()
        }
        val summary = DposWorkerRunner(ApplicationProvider.getApplicationContext(), store = store,
            historyOverride = { history }, rpcOverride = { rpc }).runOnce("expiry-test")
        assertEquals(1, summary.vizSelfAwardChecks)
        assertEquals(0, summary.vizSelfAwardBroadcasted)
        assertTrue(summary.ok)
        assertTrue(summary.messages.any { it.contains("low_energy_skip") })
        assertTrue(store.exportLogs().contains("prior self-award unknown_expired"))
        assertNull(store.readPending("self_award", "viz", "alice"))
    }

    @Test fun runnerPendingThenExactConfirmationUpdatesNotificationWithoutCountingEarly() {
        val store = store()
        store.setWorkerEnabled(true)
        store.importDecision(WorkerCommandPolicy.validateImport(AccountImportRequest("viz", "alice",
            enableNotifications = false, enableAutoUpvoter = false, explicitConsent = true)))
        store.syncVizSelfAward("alice", enabled = true, autoStart = true, minEnergy = 9500)
        store.saveEncryptedKeyRef(key, wif)
        val id = "b".repeat(40)
        val now = System.currentTimeMillis() / 1000
        store.savePending(PendingBroadcastIntent("self_award", "viz", "alice", fingerprint, -1,
            transactionId = id, expirationEpochSeconds = now + 60,
            observedChainTimeSeconds = now, observedHeadBlock = 1000))
        val rpc = Rpc(System.currentTimeMillis() / 1000).apply { lib = 899; transaction = awardTransaction(id) }
        val history = object : GolosHistoryClient {
            override fun getAccountHistory(account: String, from: Long, limit: Int): List<HistoryEvent> = emptyList()
        }
        val runner = DposWorkerRunner(ApplicationProvider.getApplicationContext(), store = store,
            historyOverride = { history }, rpcOverride = { rpc })
        val pending = runner.runOnce("pending-presentation")
        assertEquals(pending.errors.toString(), "pending_confirmation", pending.status)
        assertTrue(pending.ok)
        assertTrue(pending.errors.isEmpty())
        assertEquals(0, pending.vizSelfAwardBroadcasted)
        assertEquals(0, pending.totalVizSelfAwardBroadcasted)
        assertEquals("Подтверждается", foregroundCompletionStatus(pending))
        val notification = NotificationHelper.foreground(ApplicationProvider.getApplicationContext(),
            "DPoS Space: ${foregroundCompletionStatus(pending)}")
        assertEquals("DPoS Space: Подтверждается", notification.extras.getCharSequence(Notification.EXTRA_TEXT).toString())
        assertNotNull(store.readPending("self_award", "viz", "alice"))

        rpc.lib = 900
        val confirmed = runner.runOnce("confirmed-presentation")
        assertEquals("checked", confirmed.status)
        assertTrue(confirmed.ok)
        assertEquals(1, confirmed.vizSelfAwardBroadcasted)
        assertEquals(1, confirmed.totalVizSelfAwardBroadcasted)
        assertTrue(foregroundCompletionStatus(confirmed).startsWith("проверка завершена;"))
        assertNull(store.readPending("self_award", "viz", "alice"))
    }

    @Test fun realRpcFailureWinsOverOtherAccountsPendingPresentation() {
        val store = store()
        store.setWorkerEnabled(true)
        for (account in listOf("alice", "bob")) {
            store.importDecision(WorkerCommandPolicy.validateImport(AccountImportRequest("viz", account,
                enableNotifications = false, enableAutoUpvoter = false, explicitConsent = true)))
            store.syncVizSelfAward(account, enabled = true, autoStart = true, minEnergy = 9500)
            store.saveEncryptedKeyRef(EncryptedKeyRef("viz", account, "regular", "regular"), wif)
        }
        val now = System.currentTimeMillis() / 1000
        store.savePending(PendingBroadcastIntent("self_award", "viz", "alice", fingerprint, -1,
            transactionId = "a".repeat(40), expirationEpochSeconds = now + 60,
            observedChainTimeSeconds = now, observedHeadBlock = 1000))
        val rpc = Rpc(System.currentTimeMillis() / 1000).apply { accountErrorFor = "bob" }
        val summary = DposWorkerRunner(ApplicationProvider.getApplicationContext(), store = store,
            rpcOverride = { rpc }).runOnce("mixed-presentation")
        assertFalse(summary.ok)
        assertTrue(summary.messages.any { it.contains("viz:alice: self-award broadcast_unknown") })
        assertEquals("checked_with_errors", summary.status)
        assertTrue(summary.errors.any { it.contains("account_fetch_failed") && it.contains("RPC unavailable") })
        assertTrue(foregroundCompletionStatus(summary).startsWith("проверка завершена с ошибками;"))
        assertEquals(0, summary.vizSelfAwardBroadcasted)
    }

    @Test fun malformedOrUnavailablePendingIdentityIsNotPresentedAsHealthy() {
        val result = VizSelfAwardResult(false, "broadcast_unknown", "pending account/chain/kind mismatch", VizSelfAwardOperation("alice", 10))
        assertFalse(space.dpos.android.worker.isNormalVizPending(result))
        assertFalse(space.dpos.android.worker.isNormalVizPending(result.copy(reason = "VIZ head unavailable or stale; pending retained")))
        assertFalse(space.dpos.android.worker.isNormalVizPending(result.copy(status = "broadcast_error", reason = "RPC unavailable")))
        assertFalse(space.dpos.android.worker.isNormalVizPending(result.copy(status = "broadcast_unconfirmed", reason = "VIZ synchronous broadcast returned but not found")))
        assertTrue(space.dpos.android.worker.isNormalVizPending(result.copy(status = "broadcast_unconfirmed", reason = "VIZ async broadcast returned; exact transaction is not yet irreversible; next periodic check will retry read-only confirmation")))
    }

    @Test fun readOnlyLookupFailsOverWhenPrimaryHasNoTransaction() {
        val primary = Rpc(start)
        val secondary = Rpc(start)
        val id = "a".repeat(40)
        secondary.transaction = awardTransaction(id)
        assertEquals(id, FallbackGrapheneRpcClient(listOf(primary, secondary)).getVizTransaction(id)?.getString("transaction_id"))
        primary.lookupUnavailable = true
        assertEquals(id, FallbackGrapheneRpcClient(listOf(primary, secondary)).getVizTransaction(id)?.getString("transaction_id"))
    }
}
