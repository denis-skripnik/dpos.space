package space.dpos.android

import org.bitcoinj.core.Base58
import org.bitcoinj.core.ECKey
import org.bitcoinj.params.MainNetParams
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import space.dpos.android.storage.EncryptedKeyRef
import space.dpos.android.notifications.GolosHistoryClient
import space.dpos.android.notifications.HistoryEvent
import space.dpos.android.upvoter.BlockHeaderRef
import space.dpos.android.upvoter.GolosTransactionBuilder
import space.dpos.android.upvoter.GolosTransactionHeaderFactory
import space.dpos.android.upvoter.GolosVoteSigner
import space.dpos.android.upvoter.VoteBroadcastResult
import space.dpos.android.upvoter.VoteBroadcaster
import space.dpos.android.upvoter.VoteOperation
import space.dpos.android.upvoter.VoteOperationFixture
import space.dpos.android.upvoter.VoteRuntime
import space.dpos.android.upvoter.GolosRpcClient
import space.dpos.android.upvoter.GraphenePublicKey
import space.dpos.android.upvoter.PendingBroadcastIntent
import space.dpos.android.upvoter.PendingBroadcastStore
import java.math.BigInteger

class VoteBroadcastPolicyTest {
    private val header = BlockHeaderRef(
        refBlockNum = 123,
        refBlockPrefix = 67305985L,
        expirationEpochSeconds = 1_700_000_000L,
        headBlockId = "0000007b01020304000000000000000000000000000000000000000000000000"
    )

    @Test fun golosVoteFixtureIsDeterministicAndJsonSerializable() {
        val op = VoteOperationFixture.golosFavoriteVote(account = "denis", author = "alice", permlink = "post", weight = 7500)
        val json = op.toJson().toString()
        assertTrue(json.contains("\"type\":\"vote\""))
        assertTrue(json.contains("\"chainId\":\"golos\""))
        assertTrue(json.contains("\"voter\":\"denis\""))
        assertTrue(json.contains("\"author\":\"alice\""))
        assertTrue(json.contains("\"permlink\":\"post\""))
        assertTrue(json.contains("\"weight\":7500"))
    }

    @Test fun signerSkipsWithoutSecureKeyMaterial() {
        val result = GolosVoteSigner().sign(VoteOperationFixture.golosFavoriteVote(), null, null, header)
        assertFalse(result.ok)
        assertEquals("missing_key_ref", result.status)
        assertTrue(result.reason.contains("no signing", ignoreCase = true))
    }

    @Test fun enabledKeyDoesNotRequireExtraDryRunOffFlag() {
        val op = VoteOperation("golos", "denis", "alice", "post", 10000)
        val ref = EncryptedKeyRef("golos", "denis", "posting", "posting")
        val result = GolosVoteSigner().sign(op, ref, deterministicNonSecretWif(), header)
        assertTrue(result.ok)
        assertEquals("signed", result.status)
        val tx = result.payload?.signedTransaction
        assertNotNull(tx)
        assertEquals(1, tx!!.getJSONArray("signatures").length())
        assertEquals(130, tx.getJSONArray("signatures").getString(0).length)
        assertTrue(isCanonicalCompactSignature(tx.getJSONArray("signatures").getString(0)))
    }

    @Test fun transactionBuilderUsesGolosVoteOperationShape() {
        val op = VoteOperation("golos", "denis", "alice", "post", 7500)
        val tx = GolosTransactionBuilder().build(op, header, "00".repeat(65))
        assertEquals(123, tx.getInt("ref_block_num"))
        val vote = tx.getJSONArray("operations").getJSONArray(0)
        assertEquals("vote", vote.getString(0))
        assertEquals("denis", vote.getJSONObject(1).getString("voter"))
        assertEquals(7500, vote.getJSONObject(1).getInt("weight"))
        assertEquals(1, tx.getJSONArray("signatures").length())
    }

    @Test fun signingBytesMatchGolosJsWithoutTrailingZeroDigestSuffix() {
        val op = VoteOperation("golos", "denis", "alice", "post", 7500)
        val bytes = GolosTransactionBuilder().signingBytes(op, header)
        assertEquals(64, bytes.size)
        assertFalse(bytes.takeLast(32).all { it == 0.toByte() })
    }

    @Test fun signingBytesTransactionPartMatchesGolosRpcGetTransactionHex() {
        val op = VoteOperation("golos", "denis", "alice", "post", 7500)
        val bytes = GolosTransactionBuilder().signingBytes(op, header)
        val txHex = bytes.copyOfRange(32, bytes.size).joinToString("") { "%02x".format(it) }
        assertEquals("7b000102030400f1536501000564656e697305616c69636504706f73744c1d00", txHex)
    }

    @Test fun headerFactoryParsesGrapheneHeadBlockPrefix() {
        val props = JSONObject()
            .put("head_block_number", 123)
            .put("head_block_id", "0000007b01020304000000000000000000000000000000000000000000000000")
            .put("time", "2024-01-01T00:00:00")
        val parsed = GolosTransactionHeaderFactory.fromDynamicGlobalProperties(props, expireSeconds = 30)
        assertEquals(123, parsed.refBlockNum)
        assertEquals(67305985L, parsed.refBlockPrefix)
    }

    @Test fun headerFactoryCanMatchGolosJsBlockReference() {
        val props = JSONObject()
            .put("head_block_number", 123)
            .put("head_block_id", "0000007b99999999000000000000000000000000000000000000000000000000")
            .put("time", "2024-01-01T00:00:00")
        val previousBlock = JSONObject().put("previous", "0000007901020304000000000000000000000000000000000000000000000000")
        val parsed = GolosTransactionHeaderFactory.fromGolosJsReference(props, previousBlock, expireSeconds = 60)
        assertEquals(120, parsed.refBlockNum)
        assertEquals(67305985L, parsed.refBlockPrefix)
        assertEquals(1_704_067_260L, parsed.expirationEpochSeconds)
    }

    @Test fun previewCheckDoesNotBroadcast() {
        val rpc = FakeRpc()
        val broadcaster = RecordingBroadcaster()
        val runtime = VoteRuntime(rpc, broadcaster = broadcaster)
        val result = runtime.preview(VoteOperation("golos", "denis", "alice", "post", 10000), EncryptedKeyRef("golos", "denis", "posting", "posting"), deterministicNonSecretWif())
        assertEquals("preview_ready", result.status)
        assertEquals(0, broadcaster.broadcastCount)
    }

    @Test fun realRuntimeBranchBroadcastsSignedTxThroughBroadcaster() {
        val rpc = FakeRpc()
        val broadcaster = RecordingBroadcaster()
        val runtime = VoteRuntime(rpc, broadcaster = broadcaster)
        val result = runtime.execute(VoteOperation("golos", "denis", "alice", "post", 10000), EncryptedKeyRef("golos", "denis", "posting", "posting"), deterministicNonSecretWif())
        assertTrue(result.ok)
        assertEquals("broadcast_sent", result.status)
        assertEquals(1, broadcaster.broadcastCount)
        assertEquals(1, broadcaster.lastTx!!.getJSONArray("signatures").length())
    }

    @Test fun realWorkerRuntimeConfirmsBroadcastThroughAccountHistory() {
        val rpc = FakeRpc()
        val broadcaster = RecordingBroadcaster()
        val runtime = VoteRuntime(rpc, broadcaster = broadcaster, historyClient = ConfirmingVoteHistory("denis", "alice", "post", 10000), confirmationRetries = 1, confirmationDelayMs = 0)
        val result = runtime.execute(VoteOperation("golos", "denis", "alice", "post", 10000), EncryptedKeyRef("golos", "denis", "posting", "posting"), deterministicNonSecretWif())
        assertTrue(result.ok)
        assertEquals("broadcast_confirmed", result.status)
        assertEquals(1, broadcaster.broadcastCount)
    }

    @Test fun realWorkerRuntimeDoesNotCountUnconfirmedBroadcastAsSuccess() {
        val rpc = FakeRpc()
        val broadcaster = RecordingBroadcaster()
        val runtime = VoteRuntime(rpc, broadcaster = broadcaster, historyClient = ConfirmingVoteHistory("denis", "other", "post", 10000), confirmationRetries = 1, confirmationDelayMs = 0)
        val result = runtime.execute(VoteOperation("golos", "denis", "alice", "post", 10000), EncryptedKeyRef("golos", "denis", "posting", "posting"), deterministicNonSecretWif())
        assertFalse(result.ok)
        assertEquals("broadcast_unconfirmed", result.status)
        assertEquals(1, broadcaster.broadcastCount)
    }
    @Test fun stopDuringHistoryBaselinePreventsBroadcast() {
        var allowed = true
        val history = object : GolosHistoryClient {
            override fun getAccountHistory(account: String, from: Long, limit: Int): List<HistoryEvent> {
                allowed = false
                return emptyList()
            }
        }
        val sender = RecordingBroadcaster()
        val result = VoteRuntime(FakeRpc(), broadcaster = sender, historyClient = history, canAct = { allowed })
            .execute(VoteOperation("golos", "denis", "alice", "post", 10000), EncryptedKeyRef("golos", "denis", "posting", "posting"), deterministicNonSecretWif())
        assertEquals("cancelled", result.status)
        assertEquals(0, sender.broadcastCount)
    }

    @Test fun unsignedPreviewContainsNoSignatures() {
        val result = VoteRuntime(FakeRpc()).previewUnsigned(VoteOperation("golos", "denis", "alice", "post", 10000))
        assertTrue(result.getBoolean("ok"))
        assertEquals(0, result.getJSONObject("unsignedTx").getJSONArray("signatures").length())
    }

    @Test fun mismatchingTransactionIdCannotConfirmNewerIdenticalEvent() {
        val event = HistoryEvent(100, "vote", mapOf("transaction_id" to "different"))
        val result = space.dpos.android.upvoter.TransactionConfirmation.findCurrent(listOf(event), 99, "expected") { true }
        assertEquals(null, result)
    }

    @Test fun delayedOldIdenticalHistoryDoesNotConfirmCurrentVote() {
        val old = HistoryEvent(99, "vote", mapOf("voter" to "denis", "author" to "alice", "permlink" to "post", "weight" to "10000"))
        val history = object : GolosHistoryClient { override fun getAccountHistory(account: String, from: Long, limit: Int) = listOf(old) }
        val result = VoteRuntime(FakeRpc(), broadcaster = RecordingBroadcaster(), historyClient = history, confirmationRetries = 1, confirmationDelayMs = 0)
            .execute(VoteOperation("golos", "denis", "alice", "post", 10000), EncryptedKeyRef("golos", "denis", "posting", "posting"), deterministicNonSecretWif())
        assertFalse(result.ok)
        assertEquals("broadcast_unconfirmed", result.status)
    }

    @Test fun ambiguousBroadcastPendingSurvivesRuntimeRestartAndBlocksReplay() {
        val store = MemoryPendingStore()
        val firstBroadcaster = ThrowingBroadcaster("transport timed out after send")
        val operation = VoteOperation("golos", "denis", "alice", "post", 10000)
        val keyRef = EncryptedKeyRef("golos", "denis", "posting", "posting")
        val history = object : GolosHistoryClient { override fun getAccountHistory(account: String, from: Long, limit: Int) = emptyList<HistoryEvent>() }
        val first = VoteRuntime(FakeRpc(), broadcaster = firstBroadcaster, historyClient = history, confirmationRetries = 1, confirmationDelayMs = 0, pendingStore = store)
            .execute(operation, keyRef, deterministicNonSecretWif())
        assertEquals("broadcast_unknown", first.status)
        assertTrue(first.reason.contains("Повторная отправка заблокирована"))
        assertTrue(first.diagnostics!!.has("pendingOperation"))
        val secondBroadcaster = RecordingBroadcaster()
        val second = VoteRuntime(FakeRpc(), broadcaster = secondBroadcaster, historyClient = history, confirmationRetries = 1, confirmationDelayMs = 0, pendingStore = store)
            .execute(operation, keyRef, deterministicNonSecretWif())
        assertEquals("broadcast_unknown", second.status)
        assertEquals(1, firstBroadcaster.broadcastCount)
        assertEquals(0, secondBroadcaster.broadcastCount)
    }


    @Test fun executeStopsBeforeBroadcastWhenStoredKeyIsNotPostingAuthority() {
        val rpc = FakeRpc(postingPublicKey = "GLS1111111111111111111111111111111114T1Anm")
        val broadcaster = RecordingBroadcaster()
        val runtime = VoteRuntime(rpc, broadcaster = broadcaster)
        val result = runtime.execute(VoteOperation("golos", "denis", "alice", "post", 10000), EncryptedKeyRef("golos", "denis", "posting", "posting"), deterministicNonSecretWif())
        assertFalse(result.ok)
        assertEquals("posting_key_mismatch", result.status)
        assertEquals(0, broadcaster.broadcastCount)
    }

    @Test fun executeBroadcastsOnlyAfterPostingAuthorityPreflightMatches() {
        val rpc = FakeRpc(postingPublicKey = GraphenePublicKey.fromWif(deterministicNonSecretWif()))
        val broadcaster = RecordingBroadcaster()
        val runtime = VoteRuntime(rpc, broadcaster = broadcaster)
        val result = runtime.execute(VoteOperation("golos", "denis", "alice", "post", 10000), EncryptedKeyRef("golos", "denis", "posting", "posting"), deterministicNonSecretWif())
        assertTrue(result.ok)
        assertEquals("broadcast_sent", result.status)
        assertEquals(1, broadcaster.broadcastCount)
    }
    @Test fun executeTreatsDuplicateGolosVoteAsAlreadyVotedSkip() {
        val rpc = FakeRpc(postingPublicKey = GraphenePublicKey.fromWif(deterministicNonSecretWif()))
        val broadcaster = ThrowingBroadcaster("""{"code":-32005,"message":"invalid operation in transaction (3010000)\nInvalid operation 0 in transaction: business logic error (2030000)\nYou have already voted in a similar way."}""")
        val runtime = VoteRuntime(rpc, broadcaster = broadcaster)
        val result = runtime.execute(VoteOperation("golos", "denis", "alice", "post", 10000), EncryptedKeyRef("golos", "denis", "posting", "posting"), deterministicNonSecretWif())
        assertTrue(result.ok)
        assertEquals("already_voted", result.status)
        assertEquals(1, broadcaster.broadcastCount)
        assertTrue(result.reason.contains("skipped duplicate"))
    }

    @Test fun mixedFallbackErrorsCannotClearPendingWithoutExactHistoryMatch() {
        val operation = VoteOperation("golos", "denis", "alice", "post", 10000)
        val pending = MemoryPendingStore()
        val history = object : GolosHistoryClient {
            override fun getAccountHistory(account: String, from: Long, limit: Int): List<HistoryEvent> = emptyList()
        }
        val rpc = space.dpos.android.upvoter.FallbackGrapheneRpcClient(listOf(
            object : GolosRpcClient by FakeRpc() {
                override fun broadcastTransactionSynchronous(signedTransaction: JSONObject): JSONObject =
                    throw IllegalStateException("You have already voted in a similar way")
            },
            object : GolosRpcClient by FakeRpc() {
                override fun broadcastTransactionSynchronous(signedTransaction: JSONObject): JSONObject =
                    throw IllegalStateException("timeout after sending to node")
            }
        ))
        val result = VoteRuntime(rpc, historyClient = history, confirmationRetries = 1, confirmationDelayMs = 0, pendingStore = pending)
            .execute(operation, EncryptedKeyRef("golos", "denis", "posting", "posting"), deterministicNonSecretWif())
        assertEquals("broadcast_unknown", result.status)
        assertFalse(result.ok)
        assertNotNull(pending.readPending("vote", "golos", "denis"))
        assertTrue(result.reason.contains("Повторная отправка заблокирована"))
    }

    @Test fun executeReturnsBroadcastErrorForNonDuplicateRpcFailure() {
        val rpc = FakeRpc(postingPublicKey = GraphenePublicKey.fromWif(deterministicNonSecretWif()))
        val broadcaster = ThrowingBroadcaster("node rejected for another reason")
        val runtime = VoteRuntime(rpc, broadcaster = broadcaster)
        val result = runtime.execute(VoteOperation("golos", "denis", "alice", "post", 10000), EncryptedKeyRef("golos", "denis", "posting", "posting"), deterministicNonSecretWif())
        assertFalse(result.ok)
        assertEquals("broadcast_error", result.status)
        assertEquals(1, broadcaster.broadcastCount)
    }
    @Test fun executeStopsBeforeBroadcastWhenNodeVerifyAuthorityRejectsSignedVote() {
        val rpc = FakeRpc(verifyAuthorityResponse = JSONObject().put("error", JSONObject().put("code", -32004).put("message", "missing required posting authority")))
        val broadcaster = RecordingBroadcaster()
        val runtime = VoteRuntime(rpc, broadcaster = broadcaster)
        val result = runtime.execute(VoteOperation("golos", "denis", "alice", "post", 10000), EncryptedKeyRef("golos", "denis", "posting", "posting"), deterministicNonSecretWif())
        assertFalse(result.ok)
        assertEquals("authority_broadcast_mismatch", result.status)
        assertEquals(0, broadcaster.broadcastCount)
        assertTrue(result.reason.contains("verify_authority"))
    }

    @Test fun executeClassifiesBroadcastMissingAuthorityAsAuthorityMismatch() {
        val rpc = FakeRpc(postingPublicKey = GraphenePublicKey.fromWif(deterministicNonSecretWif()))
        val broadcaster = ThrowingBroadcaster("""Graphene RPC error: {"code":-32004,"message":"missing required posting authority"}""")
        val runtime = VoteRuntime(rpc, broadcaster = broadcaster)
        val result = runtime.execute(VoteOperation("golos", "denis", "alice", "post", 10000), EncryptedKeyRef("golos", "denis", "posting", "posting"), deterministicNonSecretWif())
        assertFalse(result.ok)
        assertEquals("authority_broadcast_mismatch", result.status)
        assertEquals(1, broadcaster.broadcastCount)
    }
    @Test fun golosUsesAsyncBroadcastLikeGolosJsAndConfirmsThroughHistory() {
        assertTrue(space.dpos.android.upvoter.GrapheneChainSpecs.requireVote("golos").asyncBroadcastOnly)
    }


    @Test fun graphenPublicKeyUsesCompressedPubkeyForGolosJsStyleWif() {
        val golosJsStyleWif = deterministicGolosJsStyleWif()
        val expectedCompressedPublic = GraphenePublicKey.fromWif(deterministicNonSecretWif())
        assertEquals(expectedCompressedPublic, GraphenePublicKey.fromWif(golosJsStyleWif))
    }

    @Test fun androidPublicKeyMatchesGolosJsForKnownWifFixture() {
        val golosJsWif = "5K7LhzBPYk63kLwdWFvmPaKLM69tkEu3enui2zEpU59vKnBEU32"
        assertEquals("GLS7PKZqo3Dio7HEsuPUcg5KCxSpLnrVgZe5ioZQzM6vrFhoSixes", GraphenePublicKey.fromWif(golosJsWif))
    }

    @Test fun androidSignatureRecoversFixturePostingPublicKey() {
        val golosJsWif = "5K7LhzBPYk63kLwdWFvmPaKLM69tkEu3enui2zEpU59vKnBEU32"
        val ref = EncryptedKeyRef("golos", "denis", "posting", "posting")
        val signer = GolosVoteSigner(GolosTransactionBuilder())
        val signed = signer.sign(VoteOperation("golos", "denis", "alice", "post", 7500), ref, golosJsWif, header)
        assertTrue(signed.ok)
        val signature = signed.payload!!.signedTransaction.getJSONArray("signatures").getString(0)
        assertEquals(130, signature.length)
        assertTrue(signature.substring(0, 2).toInt(16) in 31..34)
        assertTrue(isCanonicalCompactSignature(signature))
    }

    @Test fun androidSignatureMatchesGolosJsKnownFixtureExactly() {
        val golosJsWif = "5K7LhzBPYk63kLwdWFvmPaKLM69tkEu3enui2zEpU59vKnBEU32"
        val ref = EncryptedKeyRef("golos", "denis", "posting", "posting")
        val signer = GolosVoteSigner(GolosTransactionBuilder())
        val jsHeader = BlockHeaderRef(
            refBlockNum = 120,
            refBlockPrefix = 67305985L,
            expirationEpochSeconds = 1_704_067_260L,
            headBlockId = "0000007901020304000000000000000000000000000000000000000000000000"
        )
        val signed = signer.sign(VoteOperation("golos", "denis", "alice", "post", 7500), ref, golosJsWif, jsHeader)
        assertTrue(signed.ok)
        assertEquals(
            "20253b251ec063eb8b7015513e1573a258037f325c420fb0ab436a1fbb012719d9585620ab63592a8f9b1ae6c8c662297d2c42d0b5a295d8a80372be9a861109c7",
            signed.payload!!.signedTransaction.getJSONArray("signatures").getString(0)
        )
    }

    private fun deterministicNonSecretWif(): String = ECKey.fromPrivate(BigInteger("2"), true).getPrivateKeyAsWiF(MainNetParams.get())
    private fun deterministicGolosJsStyleWif(): String {
        val privateBytes = ECKey.fromPrivate(BigInteger("2"), true).privKeyBytes
        return Base58.encodeChecked(0x80, privateBytes)
    }

    private fun isCanonicalCompactSignature(hex: String): Boolean {
        val signature = ByteArray(hex.length / 2) { i -> hex.substring(i * 2, i * 2 + 2).toInt(16).toByte() }
        return signature.size == 65 &&
            (signature[1].toInt() and 0x80) == 0 &&
            !(signature[1].toInt() == 0 && (signature[2].toInt() and 0x80) == 0) &&
            (signature[33].toInt() and 0x80) == 0 &&
            !(signature[33].toInt() == 0 && (signature[34].toInt() and 0x80) == 0)
    }

    private class ConfirmingVoteHistory(private val voter: String, private val author: String, private val permlink: String, private val weight: Int) : GolosHistoryClient {
        private var calls = 0
        override fun getAccountHistory(account: String, from: Long, limit: Int): List<HistoryEvent> {
            calls += 1
            return if (calls == 1) emptyList() else listOf(
                HistoryEvent(99, "vote", mapOf("voter" to voter, "author" to author, "permlink" to permlink, "weight" to weight.toString()), "2026-08-15T00:00:00")
            )
        }
    }

    @Test fun confirmedOlderPendingVoteDoesNotBlockDifferentPostForever() {
        val pending = MemoryPendingStore()
        pending.savePending(PendingBroadcastIntent("vote", "golos", "denis", "alice|old-post|5000", 0, transactionId = "old-exact-tx"))
        val broadcaster = RecordingBroadcaster()
        val history = object : GolosHistoryClient {
            override fun getAccountHistory(account: String, from: Long, limit: Int): List<HistoryEvent> {
                val old = HistoryEvent(42, "vote", mapOf("voter" to account, "author" to "alice", "permlink" to "old-post", "weight" to "5000", "trx_id" to "old-exact-tx"), "2026-08-15T00:00:00")
                val fresh = HistoryEvent(43, "vote", mapOf("voter" to account, "author" to "carol", "permlink" to "new-post", "weight" to "10000", "trx_id" to pending.readPending("vote", "golos", account)?.transactionId.orEmpty()), "2026-08-15T00:00:03")
                return if (broadcaster.broadcastCount == 0) listOf(old) else listOf(old, fresh)
            }
        }
        val runtime = VoteRuntime(FakeRpc(), broadcaster = broadcaster, historyClient = history, confirmationRetries = 1, confirmationDelayMs = 0, pendingStore = pending)
        val result = runtime.execute(VoteOperation("golos", "denis", "carol", "new-post", 10000), EncryptedKeyRef("golos", "denis", "posting", "posting"), deterministicNonSecretWif())
        assertEquals("broadcast_confirmed", result.status)
        assertEquals(1, broadcaster.broadcastCount)
        assertEquals(null, pending.readPending("vote", "golos", "denis"))
    }

    private class MemoryPendingStore : PendingBroadcastStore {
        private var value: PendingBroadcastIntent? = null
        override fun readPending(kind: String, chainId: String, account: String) = value
        override fun savePending(intent: PendingBroadcastIntent) { value = intent }
        override fun clearPending(kind: String, chainId: String, account: String) { value = null }
    }

    private class FakeRpc(
        private val postingPublicKey: String = GraphenePublicKey.fromWif(ECKey.fromPrivate(BigInteger("2"), true).getPrivateKeyAsWiF(MainNetParams.get())),
        private val verifyAuthorityResponse: JSONObject = JSONObject().put("result", true)
    ) : GolosRpcClient {
        override fun getDynamicGlobalProperties(): JSONObject = JSONObject()
            .put("head_block_number", 123)
            .put("head_block_id", "0000007b01020304000000000000000000000000000000000000000000000000")
            .put("time", "2024-01-01T00:00:00")
        override fun getBlock(blockNumber: Long): JSONObject? = JSONObject().put("previous", "0000007901020304000000000000000000000000000000000000000000000000")
        override fun getAccount(account: String): JSONObject? = JSONObject().put("posting", JSONObject().put("key_auths", org.json.JSONArray().put(org.json.JSONArray().put(postingPublicKey).put(1))))
        override fun verifyAuthority(signedTransaction: JSONObject): Boolean = verifyAuthorityResponse.optBoolean("result", false)
        override fun verifyAuthorityDetailed(signedTransaction: JSONObject): JSONObject = verifyAuthorityResponse
        override fun broadcastTransactionSynchronous(signedTransaction: JSONObject): JSONObject = JSONObject().put("ok", true)
    }

    private class ThrowingBroadcaster(private val message: String) : VoteBroadcaster {
        var broadcastCount = 0
        override fun broadcast(signedTransaction: JSONObject): JSONObject {
            broadcastCount += 1
            throw IllegalStateException(message)
        }
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
}
