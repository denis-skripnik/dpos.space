package space.dpos.android

import org.bitcoinj.core.ECKey
import org.bitcoinj.params.MainNetParams
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import space.dpos.android.storage.EncryptedKeyRef
import space.dpos.android.upvoter.BlockHeaderRef
import space.dpos.android.upvoter.GolosRpcClient
import space.dpos.android.upvoter.GraphenePublicKey
import space.dpos.android.upvoter.VIZ_SELF_AWARD_MAX_SPEND
import space.dpos.android.upvoter.VIZ_SELF_AWARD_MEMO
import space.dpos.android.upvoter.VIZ_SELF_AWARD_TICK_MS
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
        assertEquals(0, body.getJSONArray("beneficiaries").length())
    }

    @Test fun awardTransactionBytesMatchVizRpcGetTransactionHexFixture() {
        val spec = space.dpos.android.upvoter.GrapheneChainSpecs.require("viz")
        val bytes = VizAwardTransactionBuilder(spec).signingBytes(VizSelfAwardOperation("denis", 10), header)
        val txHex = bytes.copyOfRange(32, bytes.size).joinToString("") { "%02x".format(it.toInt() and 0xff) }
        assertEquals(
            "780001020304bc009265012f0564656e69730564656e69730a0000000000000000001a64706f732e73706163653a2056495a2073656c662d6177617264000000",
            txHex
        )
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
        assertTrue(result.ok)
        assertEquals("broadcast_confirmed", result.status)
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
        private class ConfirmingHistory(private val account: String, private val energy: Int) : GolosHistoryClient {
        override fun getAccountHistory(account: String, from: Long, limit: Int): List<HistoryEvent> = listOf(
            HistoryEvent(42, "award", mapOf("initiator" to this.account, "receiver" to this.account, "energy" to energy.toString()), "2026-08-15T00:00:00")
        )
    }

    private fun deterministicNonSecretWif(): String = ECKey.fromPrivate(BigInteger("2"), true).getPrivateKeyAsWiF(MainNetParams.get())
    }
}
