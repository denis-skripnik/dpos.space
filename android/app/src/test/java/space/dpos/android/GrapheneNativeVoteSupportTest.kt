package space.dpos.android

import org.bitcoinj.core.ECKey
import org.bitcoinj.params.MainNetParams
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import space.dpos.android.runtime.AccountImportRequest
import space.dpos.android.runtime.SecureKeyImportPolicy
import space.dpos.android.runtime.SecureKeyImportRequest
import space.dpos.android.runtime.WorkerCommandPolicy
import space.dpos.android.storage.EncryptedKeyRef
import space.dpos.android.notifications.GolosHistoryRpc
import space.dpos.android.upvoter.AutoUpvoterPlanner
import space.dpos.android.upvoter.AutoVoteRuntime
import space.dpos.android.upvoter.BlockHeaderRef
import space.dpos.android.upvoter.GrapheneChainSpecs
import space.dpos.android.upvoter.GrapheneVoteSigner
import space.dpos.android.upvoter.GrapheneTransactionBuilder
import space.dpos.android.upvoter.GolosRpcClient
import space.dpos.android.upvoter.GraphenePublicKey
import space.dpos.android.upvoter.PostingKeyProvider
import space.dpos.android.upvoter.VoteBroadcaster
import space.dpos.android.upvoter.VoteEvent
import space.dpos.android.upvoter.VoteOperation
import space.dpos.android.upvoter.VoteRuntime
import java.math.BigInteger

class GrapheneNativeVoteSupportTest {
    private val header = BlockHeaderRef(
        refBlockNum = 321,
        refBlockPrefix = 67305985L,
        expirationEpochSeconds = 1_700_000_000L,
        headBlockId = "0000014101020304000000000000000000000000000000000000000000000000"
    )

    @Test fun nativeSupportMatrixIsTruthfulAndLimitedToImplementedGrapheneVoteChains() {
        assertEquals(setOf("golos", "hive", "steem"), GrapheneChainSpecs.supportedNativeVoteChains)
        assertEquals(setOf("golos", "hive", "steem", "viz"), GrapheneChainSpecs.supportedNativeNotificationChains)
        assertTrue(GrapheneChainSpecs.require("golos").legacyCallRpc)
        assertFalse(GrapheneChainSpecs.require("hive").legacyCallRpc)
        assertFalse(GrapheneChainSpecs.require("steem").legacyCallRpc)
        assertTrue(WorkerCommandPolicy.validateImport(AccountImportRequest("hive", "denis", enableNotifications = true, enableAutoUpvoter = true, explicitConsent = true)).accepted)
        assertTrue(WorkerCommandPolicy.validateImport(AccountImportRequest("steem", "denis", enableNotifications = true, enableAutoUpvoter = true, explicitConsent = true)).accepted)
        assertFalse(WorkerCommandPolicy.validateImport(AccountImportRequest("viz", "denis", enableNotifications = true, enableAutoUpvoter = true, explicitConsent = true)).accepted)
        val vizNotifications = WorkerCommandPolicy.validateImport(AccountImportRequest("viz", "denis", enableNotifications = true, enableAutoUpvoter = false, explicitConsent = true))
        assertTrue(vizNotifications.accepted)
        assertEquals("viz", vizNotifications.chainId)
        assertFalse(WorkerCommandPolicy.validateImport(AccountImportRequest("decimal", "denis", enableNotifications = true, enableAutoUpvoter = true, explicitConsent = true)).accepted)
    }

    @Test fun accountHistoryRpcAdaptersUseLegacyCallOnlyForGolosStyleNodes() {
        val legacy = JSONObject(GolosHistoryRpc.buildAccountHistoryPayload("denis", -1, 10, legacyCallRpc = true))
        assertEquals("call", legacy.getString("method"))
        assertEquals("condenser_api", legacy.getJSONArray("params").getString(0))
        assertEquals("get_account_history", legacy.getJSONArray("params").getString(1))

        val appbase = JSONObject(GolosHistoryRpc.buildAccountHistoryPayload("denis", -1, 10, legacyCallRpc = false))
        assertEquals("condenser_api.get_account_history", appbase.getString("method"))
    }

    @Test fun secureKeyImportKeepsVoteChainsPostingOnlyAndAllowsVizRegularSelfAward() {
        val wif = deterministicNonSecretWif()
        assertTrue(SecureKeyImportPolicy.validate(SecureKeyImportRequest("hive", "denis", "posting", "posting", wif, true)).accepted)
        assertTrue(SecureKeyImportPolicy.validate(SecureKeyImportRequest("steem", "denis", "posting", "posting", wif, true)).accepted)
        assertFalse(SecureKeyImportPolicy.validate(SecureKeyImportRequest("viz", "denis", "posting", "posting", wif, true)).accepted)
        assertTrue(SecureKeyImportPolicy.validate(SecureKeyImportRequest("viz", "denis", "regular", "regular", wif, true)).accepted)
        assertTrue(SecureKeyImportPolicy.validate(SecureKeyImportRequest("minter", "Mx9858effd232b4033e47d90003d41ec34ecaeda94", "seed", "seed", "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about", true)).accepted)
    }

    @Test fun vizSpecIsNotificationsAndRegularSelfAwardButNotVoteAutoUpvoter() {
        val viz = GrapheneChainSpecs.require("viz")
        assertEquals("2040effda178d4fffff5eab7a915d4019879f5205cc5392e4bcced2b6edda0cd", viz.networkChainIdHex)
        assertTrue(viz.legacyCallRpc)
        assertFalse(viz.nativeVoteSupported)
        assertTrue(viz.nativeNotificationsSupported)
        assertEquals(null, GrapheneChainSpecs.findVote("viz"))
    }

    @Test fun hiveAndSteemSignerBuildsSignedVoteTransactionsWithCorrectChainIdAndOperationShape() {
        for (chainId in listOf("hive", "steem")) {
            val spec = GrapheneChainSpecs.require(chainId)
            val op = VoteOperation(chainId, "denis", "alice", "post", 7500)
            val ref = EncryptedKeyRef(chainId, "denis", "posting", "posting")
            val result = GrapheneVoteSigner(spec).sign(op, ref, deterministicNonSecretWif(), header)
            assertTrue("$chainId should sign", result.ok)
            assertEquals("signed", result.status)
            val tx = result.payload!!.signedTransaction
            val vote = tx.getJSONArray("operations").getJSONArray(0)
            assertEquals("vote", vote.getString(0))
            assertEquals("denis", vote.getJSONObject(1).getString("voter"))
            assertEquals(7500, vote.getJSONObject(1).getInt("weight"))
            assertEquals(1, tx.getJSONArray("signatures").length())
            assertEquals(130, tx.getJSONArray("signatures").getString(0).length)
            assertTrue(GrapheneTransactionBuilder(spec).signingBytes(op, header).copyOfRange(0, 32).contentEquals(hexToBytesForTest(spec.networkChainIdHex)))
        }
    }

    @Test fun previewDoesNotBroadcastButExecuteSubmitsSignedTxToFakeBroadcasterForHiveAndSteem() {
        for (chainId in listOf("hive", "steem")) {
            val spec = GrapheneChainSpecs.require(chainId)
            val broadcaster = RecordingBroadcaster()
            val runtime = VoteRuntime(FakeRpc(), signer = GrapheneVoteSigner(spec), broadcaster = broadcaster)
            val op = VoteOperation(chainId, "denis", "alice", "post", 10000)
            val ref = EncryptedKeyRef(chainId, "denis", "posting", "posting")
            val preview = runtime.preview(op, ref, deterministicNonSecretWif())
            assertEquals("preview_ready", preview.status)
            assertEquals(0, broadcaster.broadcastCount)
            val executed = runtime.execute(op, ref, deterministicNonSecretWif())
            assertTrue(executed.ok)
            assertEquals("broadcast_sent", executed.status)
            assertEquals(1, broadcaster.broadcastCount)
            assertNotNull(broadcaster.lastTx)
        }
    }

    @Test fun wrongChainOrAuthorityScopeFailsBeforeSigning() {
        val hive = GrapheneChainSpecs.require("hive")
        val signer = GrapheneVoteSigner(hive)
        val wrongChain = signer.sign(VoteOperation("steem", "denis", "alice", "post", 10000), EncryptedKeyRef("steem", "denis", "posting", "posting"), deterministicNonSecretWif(), header)
        assertFalse(wrongChain.ok)
        assertEquals("unsupported_chain", wrongChain.status)

        val wrongAuthority = signer.sign(VoteOperation("hive", "denis", "alice", "post", 10000), EncryptedKeyRef("hive", "denis", "active", "active"), deterministicNonSecretWif(), header)
        assertFalse(wrongAuthority.ok)
        assertEquals("key_scope_mismatch", wrongAuthority.status)
    }

    @Test fun autoVoteRuntimeUsesConfiguredChainInsteadOfHardcodedGolos() {
        val broadcaster = RecordingBroadcaster()
        val runtime = AutoVoteRuntime(VoteRuntime(FakeRpc(), signer = FakeSigner(), broadcaster = broadcaster), FakeKeyProvider(), chainId = "hive")
        val plan = AutoUpvoterPlanner().plan(
            listOf(space.dpos.android.upvoter.AccountSettings("denis", enabled = true, favorites = listOf("alice"), currentEnergy = 10000)),
            listOf(VoteEvent("favorite_post", author = "alice", permlink = "post"))
        )
        val report = runtime.execute(plan)
        assertEquals(1, report.broadcasted)
        assertEquals("hive", report.results.single().operation.chainId)
        assertEquals("hive", broadcaster.lastTx!!.getString("chainId"))
    }

    private class FakeRpc : GolosRpcClient {
        override fun getDynamicGlobalProperties(): JSONObject = JSONObject()
            .put("head_block_number", 321)
            .put("head_block_id", "0000014101020304000000000000000000000000000000000000000000000000")
            .put("time", "2024-01-01T00:00:00")
        override fun getBlock(blockNumber: Long): JSONObject? = JSONObject().put("previous", "0000007901020304000000000000000000000000000000000000000000000000")
        override fun getAccount(account: String): JSONObject? = JSONObject().put("posting", JSONObject().put("key_auths", org.json.JSONArray().put(org.json.JSONArray().put(GraphenePublicKey.fromWif(deterministicNonSecretWif(), "STM")).put(1))))
        override fun verifyAuthority(signedTransaction: JSONObject): Boolean = true
        override fun broadcastTransactionSynchronous(signedTransaction: JSONObject): JSONObject = JSONObject().put("ok", true)
    }

    private class RecordingBroadcaster : VoteBroadcaster {
        var broadcastCount = 0
        var lastTx: JSONObject? = null
        override fun broadcast(signedTransaction: JSONObject): JSONObject {
            broadcastCount += 1
            lastTx = signedTransaction
            return JSONObject().put("id", "fake-broadcast")
        }
    }

    private class FakeSigner : space.dpos.android.upvoter.VoteSigner {
        override fun sign(operation: VoteOperation, keyRef: EncryptedKeyRef?, privateWif: String?, header: BlockHeaderRef): space.dpos.android.upvoter.VoteBroadcastResult {
            if (privateWif.isNullOrBlank()) return space.dpos.android.upvoter.VoteBroadcastResult(false, "missing_private_key", operation, "missing")
            val tx = JSONObject().put("chainId", operation.chainId).put("operations", org.json.JSONArray()).put("signatures", org.json.JSONArray().put("fake-signature"))
            return space.dpos.android.upvoter.VoteBroadcastResult(true, "signed", operation, "fake signed", space.dpos.android.upvoter.SignedVotePayload(operation, keyRef!!, tx))
        }
    }

    private class FakeKeyProvider : PostingKeyProvider {
        override fun keyRef(chainId: String, account: String): EncryptedKeyRef = EncryptedKeyRef(chainId, account, "posting", "posting")
        override fun privateWif(chainId: String, account: String): String = deterministicNonSecretWif()
    }

    private fun hexToBytesForTest(hex: String): ByteArray = ByteArray(hex.length / 2) { i -> hex.substring(i * 2, i * 2 + 2).toInt(16).toByte() }

    companion object {
        private fun deterministicNonSecretWif(): String = ECKey.fromPrivate(BigInteger("2"), true).getPrivateKeyAsWiF(MainNetParams.get())
    }
}
