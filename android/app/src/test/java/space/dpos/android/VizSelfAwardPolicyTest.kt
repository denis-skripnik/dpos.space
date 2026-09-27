package space.dpos.android

import org.bitcoinj.core.ECKey
import org.bitcoinj.params.MainNetParams
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import space.dpos.android.storage.EncryptedKeyRef
import space.dpos.android.upvoter.BlockHeaderRef
import space.dpos.android.upvoter.GolosRpcClient
import space.dpos.android.upvoter.GraphenePublicKey
import space.dpos.android.upvoter.VIZ_SELF_AWARD_MAX_SPEND
import space.dpos.android.upvoter.VIZ_SELF_AWARD_MEMO
import space.dpos.android.upvoter.VIZ_SELF_AWARD_TICK_MS
import space.dpos.android.upvoter.VizAwardSigner
import space.dpos.android.upvoter.VizAwardTransactionBuilder
import space.dpos.android.upvoter.VizSelfAwardOperation
import space.dpos.android.upvoter.VizSelfAwardPolicy
import space.dpos.android.upvoter.VizSelfAwardRuntime
import space.dpos.android.upvoter.VoteBroadcaster
import space.dpos.android.notifications.GolosHistoryClient
import space.dpos.android.notifications.HistoryEvent
import java.math.BigInteger
import java.time.LocalDateTime
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter

class VizSelfAwardPolicyTest {
    private val header = BlockHeaderRef(
        refBlockNum = 120,
        refBlockPrefix = 67305985L,
        expirationEpochSeconds = 1_704_067_260L,
        headBlockId = "0000007901020304000000000000000000000000000000000000000000000000"
    )

    @Test fun regenerationMathUsesExactSevenMinutesTwelveSecondsForPointOnePercent() {
        assertEquals(432000L, VIZ_SELF_AWARD_TICK_MS)
        assertEquals(10, VIZ_SELF_AWARD_MAX_SPEND)
        assertEquals(9500, VizSelfAwardPolicy.normalizeMinEnergy(95))
        val account = JSONObject().put("energy", 9900).put("last_vote_time", "2024-01-01T00:00:00")
        assertEquals(9910, VizSelfAwardPolicy.currentEnergy(account, nowMillis = 1_704_067_200_000L + VIZ_SELF_AWARD_TICK_MS))
    }

    @Test fun awardTransactionUsesVizAwardOperationShapeAndMemo() {
        val spec = space.dpos.android.upvoter.GrapheneChainSpecs.require("viz")
        val tx = VizAwardTransactionBuilder(spec).build(VizSelfAwardOperation("denis", 10), header, "00".repeat(65))
        val op = tx.getJSONArray("operations").getJSONArray(0)
        assertEquals("award", op.getString(0))
        val body = op.getJSONObject(1)
        assertEquals("denis", body.getString("initiator"))
        assertEquals("denis", body.getString("receiver"))
        assertEquals(10, body.getInt("energy"))
        assertEquals(0, body.getLong("custom_sequence"))
        assertEquals(VIZ_SELF_AWARD_MEMO, body.getString("memo"))
        val beneficiaries = body.getJSONArray("beneficiaries")
        assertEquals(1, beneficiaries.length())
        assertEquals("denis-skripnik", beneficiaries.getJSONObject(0).getString("account"))
        assertEquals(100, beneficiaries.getJSONObject(0).getInt("weight"))
    }

    @Test fun beneficiaryIsKeptWhenReceiverIsTheSameAccount() {
        val body = VizSelfAwardOperation("denis-skripnik", 10).toJson()
        assertEquals("denis-skripnik", body.getString("receiver"))
        val beneficiaries = body.getJSONArray("beneficiaries")
        assertEquals(1, beneficiaries.length())
        assertEquals("denis-skripnik", beneficiaries.getJSONObject(0).getString("account"))
        assertEquals(100, beneficiaries.getJSONObject(0).getInt("weight"))
    }

    @Test fun awardTransactionBytesMatchVizRpcGetTransactionHexFixture() {
        val spec = space.dpos.android.upvoter.GrapheneChainSpecs.require("viz")
        val bytes = VizAwardTransactionBuilder(spec).signingBytes(VizSelfAwardOperation("denis", 10), header)
        val txHex = bytes.copyOfRange(32, bytes.size).joinToString("") { "%02x".format(it.toInt() and 0xff) }
        assertEquals(
            "780001020304bc009265012f0564656e69730564656e69730a0000000000000000001a64706f732e73706163653a2056495a2073656c662d6177617264010e64656e69732d736b7269706e696b640000",
            txHex
        )
    }

    @Test fun androidVizWifPublicKeyMatchesVizJsLibFixture() {
        assertEquals(
            "VIZ7PKZqo3Dio7HEsuPUcg5KCxSpLnrVgZe5ioZQzM6vrFhoSixes",
            GraphenePublicKey.fromWif("5K7LhzBPYk63kLwdWFvmPaKLM69tkEu3enui2zEpU59vKnBEU32", "VIZ")
        )
    }

    @Test fun androidVizAwardSignatureMatchesVizJsLibFixtureExactly() {
        val spec = space.dpos.android.upvoter.GrapheneChainSpecs.require("viz")
        val signer = VizAwardSigner(spec, VizAwardTransactionBuilder(spec))
        val result = signer.sign(VizSelfAwardOperation("denis", 10), EncryptedKeyRef("viz", "denis", "regular", "regular"), "5K7LhzBPYk63kLwdWFvmPaKLM69tkEu3enui2zEpU59vKnBEU32", header, includeDiagnostics = true)
        assertTrue(result.ok)
        assertEquals("9f8f6df413b28a8b75d49d75ae3c81817337e34f9fb1c4d2aecda8cac856564a", result.diagnostics!!.getString("signingDigestHex"))
        assertEquals(0, result.diagnostics!!.getInt("canonicalNonce"))
        assertEquals(
            "1f2f16aba57f16440ccf3acb4c94e1d9f4f9f73a2be38abfba3b94a67b23ca5838434ef55824bbdf7ab9a4313c2def106cb9544d390261ef87da007a26640d72c4",
            result.signedTransaction!!.getJSONArray("signatures").getString(0)
        )
    }

    @Test fun productionVizSigningDoesNotExposeInternalDiagnostics() {
        val spec = space.dpos.android.upvoter.GrapheneChainSpecs.require("viz")
        val signer = VizAwardSigner(spec, VizAwardTransactionBuilder(spec))
        val result = signer.sign(VizSelfAwardOperation("denis", 10), EncryptedKeyRef("viz", "denis", "regular", "regular"), "5K7LhzBPYk63kLwdWFvmPaKLM69tkEu3enui2zEpU59vKnBEU32", header)
        assertTrue(result.ok)
        assertNull(result.diagnostics)
        assertTrue(result.signedTransaction!!.has("signatures"))
    }

    @Test fun vizNativeSelfAwardUsesMultipleRpcEndpointsForBadGatewayFallback() {
        val spec = space.dpos.android.upvoter.GrapheneChainSpecs.require("viz")
        assertTrue(spec.rpcEndpoints.contains("https://api.viz.world"))
        assertTrue(spec.rpcEndpoints.contains("https://node.viz.cx"))
        assertTrue(spec.rpcEndpoints.size >= 2)
        assertTrue(spec.asyncBroadcastOnly)
    }

    @Test fun lowEnergySkipsWithoutBroadcast() {
        val broadcaster = RecordingBroadcaster()
        val runtime = VizSelfAwardRuntime(FakeRpc(energy = 9499), broadcaster)
        val result = runtime.execute("denis", 9500, EncryptedKeyRef("viz", "denis", "regular", "regular"), deterministicNonSecretWif())
        assertTrue(result.ok)
        assertEquals("low_energy_skip", result.status)
        assertEquals(0, broadcaster.broadcastCount)
    }

    @Test fun highEnergySignsAndBroadcastsSelfAwardAfterRegularAuthorityCheck() {
        val broadcaster = RecordingBroadcaster()
        val runtime = VizSelfAwardRuntime(FakeRpc(energy = 10000), broadcaster, historyClient = ConfirmingHistory("denis", 10), confirmationRetries = 1, confirmationDelayMs = 0)
        val result = runtime.execute("denis", 9500, EncryptedKeyRef("viz", "denis", "regular", "regular"), deterministicNonSecretWif())
        assertFalse(result.ok)
        assertEquals("broadcast_unconfirmed", result.status)
        assertEquals(1, broadcaster.broadcastCount)
        val op = broadcaster.lastTx!!.getJSONArray("operations").getJSONArray(0).getJSONObject(1)
        assertEquals("denis", op.getString("initiator"))
        assertEquals("denis", op.getString("receiver"))
        assertEquals(10, op.getInt("energy"))
    }

    @Test fun asyncVizBroadcastWithoutHistoryConfirmationIsNotCountedAsSuccess() {
        val broadcaster = RecordingBroadcaster(JSONObject().put("result", JSONObject().put("id", "abc").put("block_num", 1234).put("trx_num", 0).put("expired", false)))
        val runtime = VizSelfAwardRuntime(FakeRpc(energy = 10000), broadcaster, historyClient = ConfirmingHistory("other", 10), confirmationRetries = 1, confirmationDelayMs = 0)
        val result = runtime.execute("denis", 9500, EncryptedKeyRef("viz", "denis", "regular", "regular"), deterministicNonSecretWif())
        assertFalse(result.ok)
        assertEquals("broadcast_unconfirmed", result.status)
        assertEquals(1, broadcaster.broadcastCount)
    }

    @Test fun vizNodeAuthorityRejectionStopsBeforeBroadcast() {
        val broadcaster = RecordingBroadcaster()
        val runtime = VizSelfAwardRuntime(FakeRpc(energy = 10000, verifyAuthorityAccepted = false), broadcaster, historyClient = ConfirmingHistory("denis", 10), confirmationRetries = 1, confirmationDelayMs = 0)
        val result = runtime.execute("denis", 9500, EncryptedKeyRef("viz", "denis", "regular", "regular"), deterministicNonSecretWif())
        assertFalse(result.ok)
        assertEquals("signature_rejected", result.status)
        assertEquals("tx_missing_regular_auth", result.rpcResponse!!.getJSONObject("error").getJSONObject("data").getString("name"))
        assertEquals(0, broadcaster.broadcastCount)
    }

    @Test fun wrongRegularKeyStopsBeforeBroadcast() {
        val broadcaster = RecordingBroadcaster()
        val runtime = VizSelfAwardRuntime(FakeRpc(energy = 10000, regularPublicKey = "VIZ1111111111111111111111111111111114T1Anm"), broadcaster)
        val result = runtime.execute("denis", 9500, EncryptedKeyRef("viz", "denis", "regular", "regular"), deterministicNonSecretWif())
        assertFalse(result.ok)
        assertEquals("regular_key_mismatch", result.status)
        assertEquals(0, broadcaster.broadcastCount)
    }

    @Test fun differentAwardMemoCannotConfirmThisTransaction() {
        val broadcaster = RecordingBroadcaster()
        val runtime = VizSelfAwardRuntime(FakeRpc(energy = 10000), broadcaster,
            historyClient = ConfirmingHistory("denis", 10, "other application"), confirmationRetries = 1, confirmationDelayMs = 0)
        val result = runtime.execute("denis", 9500, EncryptedKeyRef("viz", "denis", "regular", "regular"), deterministicNonSecretWif())
        assertFalse(result.ok)
        assertEquals("broadcast_unconfirmed", result.status)
    }

    @Test fun historyAloneCannotConfirmNewFeePending() {
        val pending = object : space.dpos.android.upvoter.PendingBroadcastStore {
            var intent: space.dpos.android.upvoter.PendingBroadcastIntent? = space.dpos.android.upvoter.PendingBroadcastIntent(
                "self_award", "viz", "denis", "v2|5|$VIZ_SELF_AWARD_MEMO|denis-skripnik|100", 0, transactionId = "a".repeat(40)
            )
            override fun readPending(kind: String, chainId: String, account: String) = intent
            override fun savePending(value: space.dpos.android.upvoter.PendingBroadcastIntent) { intent = value }
            override fun clearPending(kind: String, chainId: String, account: String) { intent = null }
        }
        val history = object : GolosHistoryClient {
            override fun getAccountHistory(account: String, from: Long, limit: Int) = listOf(
                HistoryEvent(42, "award", mapOf("initiator" to account, "receiver" to account, "energy" to "5", "memo" to VIZ_SELF_AWARD_MEMO, "trx_id" to "a".repeat(40), "beneficiaries" to "[{\"account\":\"denis-skripnik\",\"weight\":100}]"), "2026-08-15T00:00:00")
            )
        }
        val runtime = VizSelfAwardRuntime(FakeRpc(energy = 9000), RecordingBroadcaster(), historyClient = history, confirmationRetries = 1, confirmationDelayMs = 0, pendingStore = pending)
        val result = runtime.execute("denis", 9500, EncryptedKeyRef("viz", "denis", "regular", "regular"), deterministicNonSecretWif())
        assertFalse(result.ok)
        assertEquals("broadcast_unknown", result.status)
        assertNotNull(pending.intent)
    }

    @Test fun newFeePendingIsNotMisconfirmedByLegacyAwardWithoutBeneficiary() {
        val pending = object : space.dpos.android.upvoter.PendingBroadcastStore {
            var intent: space.dpos.android.upvoter.PendingBroadcastIntent? = space.dpos.android.upvoter.PendingBroadcastIntent(
                "self_award", "viz", "denis", "v2|5|$VIZ_SELF_AWARD_MEMO|denis-skripnik|100", 0, transactionId = "a".repeat(40)
            )
            override fun readPending(kind: String, chainId: String, account: String) = intent
            override fun savePending(value: space.dpos.android.upvoter.PendingBroadcastIntent) { intent = value }
            override fun clearPending(kind: String, chainId: String, account: String) { intent = null }
        }
        val history = object : GolosHistoryClient {
            override fun getAccountHistory(account: String, from: Long, limit: Int) = listOf(
                HistoryEvent(42, "award", mapOf("initiator" to account, "receiver" to account, "energy" to "5", "memo" to VIZ_SELF_AWARD_MEMO, "trx_id" to "a".repeat(40), "beneficiaries" to "[]"), "2026-08-15T00:00:00")
            )
        }
        val runtime = VizSelfAwardRuntime(FakeRpc(energy = 9000), RecordingBroadcaster(), historyClient = history, confirmationRetries = 1, confirmationDelayMs = 0, pendingStore = pending)
        val result = runtime.execute("denis", 9500, EncryptedKeyRef("viz", "denis", "regular", "regular"), deterministicNonSecretWif())
        assertFalse(result.ok)
        assertEquals("broadcast_unknown", result.status)
        assertTrue(pending.intent != null)
    }

    @Test fun oldHistoryMatchingEnergyCannotConfirmIdOnlyPending() {
        val pending = object : space.dpos.android.upvoter.PendingBroadcastStore {
            var intent: space.dpos.android.upvoter.PendingBroadcastIntent? = space.dpos.android.upvoter.PendingBroadcastIntent("self_award", "viz", "denis", "5|$VIZ_SELF_AWARD_MEMO", 0, transactionId = "a".repeat(40))
            override fun readPending(kind: String, chainId: String, account: String) = intent
            override fun savePending(value: space.dpos.android.upvoter.PendingBroadcastIntent) { intent = value }
            override fun clearPending(kind: String, chainId: String, account: String) { intent = null }
        }
        val history = object : GolosHistoryClient {
            override fun getAccountHistory(account: String, from: Long, limit: Int) = listOf(
                HistoryEvent(42, "award", mapOf("initiator" to account, "receiver" to account, "energy" to "5", "memo" to VIZ_SELF_AWARD_MEMO, "trx_id" to "a".repeat(40)), "2026-08-15T00:00:00"))
        }
        val broadcaster = RecordingBroadcaster()
        val runtime = VizSelfAwardRuntime(FakeRpc(energy = 9000), broadcaster, historyClient = history, confirmationRetries = 1, confirmationDelayMs = 0, pendingStore = pending)
        val result = runtime.execute("denis", 9500, EncryptedKeyRef("viz", "denis", "regular", "regular"), deterministicNonSecretWif())
        assertEquals("broadcast_unknown", result.status)
        assertNotNull(pending.intent)
        assertEquals(0, broadcaster.broadcastCount)
    }

    @Test fun computedTransactionIdMatchesPublicVizRpcHistoryAndTransactionHex() {
        // api.viz.world read-only get_transaction_hex + get_account_history, viz-projects.
        val unsigned = "c8d6fa01fb191835b76a012f0c76697a2d70726f6a656374730c76697a2d70726f6a656374730a0000000000000000001a64706f732e73706163653a2056495a2073656c662d6177617264010e64656e69732d736b7269706e696b640000"
        val bytes = ByteArray(unsigned.length / 2) { unsigned.substring(it * 2, it * 2 + 2).toInt(16).toByte() }
        assertEquals("3041da881521594d1de9a5aec18b7a091f1e48f5",
            space.dpos.android.upvoter.TransactionConfirmation.transactionId(ByteArray(32) + bytes))
    }

    @Test fun divergentVizNodeIndicesRecoverOnlyByExactTransactionIdAcrossPages() {
        val tx = "a".repeat(40)
        val pending = object : space.dpos.android.upvoter.PendingBroadcastStore {
            var intent: space.dpos.android.upvoter.PendingBroadcastIntent? = space.dpos.android.upvoter.PendingBroadcastIntent(
                "self_award", "viz", "viz-projects", "v2|10|$VIZ_SELF_AWARD_MEMO|denis-skripnik|100", 540,
                transactionId = tx, createdAtMs = 1790399970000L)
            override fun readPending(kind: String, chainId: String, account: String) = intent
            override fun savePending(intent: space.dpos.android.upvoter.PendingBroadcastIntent) { this.intent = intent }
            override fun clearPending(kind: String, chainId: String, account: String) { intent = null }
        }
        var pages = 0
        val history = object : GolosHistoryClient {
            override fun getAccountHistory(account: String, from: Long, limit: Int): List<HistoryEvent> {
                pages++
                return if (from == -1L) (540L..570L).map { HistoryEvent(it, "validator_reward", mapOf("trx_id" to "0".repeat(40))) }
                else listOf(HistoryEvent(538, "award", mapOf("initiator" to account, "receiver" to account,
                    "energy" to "10", "memo" to VIZ_SELF_AWARD_MEMO,
                    "beneficiaries" to "[{\"account\":\"denis-skripnik\",\"weight\":100}]", "trx_id" to tx)))
            }
        }
        val broadcaster = RecordingBroadcaster()
        val result = VizSelfAwardRuntime(FakeRpc(10000), broadcaster, historyClient = history,
            confirmationRetries = 1, confirmationDelayMs = 0, pendingStore = pending)
            .execute("viz-projects", 9500, EncryptedKeyRef("viz", "viz-projects", "regular", "regular"), deterministicNonSecretWif())
        assertEquals("broadcast_unknown", result.status)
        assertNotNull(pending.intent)
        assertEquals(0, broadcaster.broadcastCount)
        assertEquals(0, pages) // VIZ never scans account-history pages.
    }

    @Test fun legacyOperationOnlyPendingCannotBeProvenFromDifferentNodeIndex() {
        val pending = object : space.dpos.android.upvoter.PendingBroadcastStore {
            var intent: space.dpos.android.upvoter.PendingBroadcastIntent? = space.dpos.android.upvoter.PendingBroadcastIntent(
                "self_award", "viz", "viz-projects", "v2|10|$VIZ_SELF_AWARD_MEMO|denis-skripnik|100", 535)
            override fun readPending(kind: String, chainId: String, account: String) = intent
            override fun savePending(intent: space.dpos.android.upvoter.PendingBroadcastIntent) { this.intent = intent }
            override fun clearPending(kind: String, chainId: String, account: String) { intent = null }
        }
        val history = object : GolosHistoryClient {
            override fun getAccountHistory(account: String, from: Long, limit: Int) = listOf(HistoryEvent(537, "award",
                mapOf("initiator" to account, "receiver" to account, "energy" to "10", "memo" to VIZ_SELF_AWARD_MEMO,
                    "trx_id" to "a".repeat(40), "beneficiaries" to "[{\"account\":\"denis-skripnik\",\"weight\":100}]")))
        }
        val broadcaster = RecordingBroadcaster()
        val result = VizSelfAwardRuntime(FakeRpc(10000), broadcaster, historyClient = history,
            confirmationRetries = 1, confirmationDelayMs = 0, pendingStore = pending)
            .execute("viz-projects", 9500, EncryptedKeyRef("viz", "viz-projects", "regular", "regular"), deterministicNonSecretWif())
        assertEquals("broadcast_unknown", result.status)
        assertNotNull(pending.intent)
        assertEquals(0, broadcaster.broadcastCount)
        assertTrue(result.reason.contains("stale"))
    }

    private class FakeRpc(
        private val energy: Int,
        private val regularPublicKey: String = GraphenePublicKey.fromWif(deterministicNonSecretWif(), "VIZ"),
        private val verifyAuthorityAccepted: Boolean = true
    ) : GolosRpcClient {
        override fun getDynamicGlobalProperties(): JSONObject = JSONObject()
            .put("head_block_number", 123)
            .put("head_block_id", "0000007b99999999000000000000000000000000000000000000000000000000")
            .put("time", "2024-01-01T00:00:00")
        override fun getBlock(blockNumber: Long): JSONObject? = JSONObject().put("previous", "0000007901020304000000000000000000000000000000000000000000000000")
        override fun getAccount(account: String): JSONObject? = JSONObject()
            .put("name", account)
            .put("energy", energy)
            .put("last_vote_time", DateTimeFormatter.ISO_LOCAL_DATE_TIME.format(LocalDateTime.ofEpochSecond(System.currentTimeMillis() / 1000L, 0, ZoneOffset.UTC)))
            .put("regular_authority", JSONObject().put("weight_threshold", 1).put("key_auths", JSONArray().put(JSONArray().put(regularPublicKey).put(1))))
        override fun verifyAuthority(signedTransaction: JSONObject): Boolean = verifyAuthorityAccepted
        override fun verifyAuthorityDetailed(signedTransaction: JSONObject): JSONObject = if (verifyAuthorityAccepted) JSONObject().put("result", true) else JSONObject().put("error", JSONObject().put("code", -32000).put("message", "missing required regular authority").put("data", JSONObject().put("name", "tx_missing_regular_auth")))
        override fun broadcastTransactionSynchronous(signedTransaction: JSONObject): JSONObject = JSONObject().put("ok", true)
    }

    private class RecordingBroadcaster(private val response: JSONObject = JSONObject().put("result", JSONObject().put("id", "fake-viz-self-award").put("block_num", 1).put("trx_num", 0).put("expired", false))) : VoteBroadcaster {
        var broadcastCount = 0
        var lastTx: JSONObject? = null
        override fun broadcast(signedTransaction: JSONObject): JSONObject {
            broadcastCount += 1
            lastTx = signedTransaction
            return response
        }
    }

    companion object {
        private class ConfirmingHistory(private val account: String, private val energy: Int, private val memo: String = VIZ_SELF_AWARD_MEMO) : GolosHistoryClient {
        private var calls = 0
        override fun getAccountHistory(account: String, from: Long, limit: Int): List<HistoryEvent> {
            calls += 1
            return if (calls == 1) emptyList() else listOf(
                HistoryEvent(42, "award", mapOf(
                    "initiator" to this.account,
                    "receiver" to this.account,
                    "energy" to energy.toString(),
                    "memo" to memo,
                    "beneficiaries" to "[{\"account\":\"denis-skripnik\",\"weight\":100}]"
                ), "2026-08-15T00:00:00")
            )
        }
    }

    private fun deterministicNonSecretWif(): String = ECKey.fromPrivate(BigInteger("2"), true).getPrivateKeyAsWiF(MainNetParams.get())
    }
}
