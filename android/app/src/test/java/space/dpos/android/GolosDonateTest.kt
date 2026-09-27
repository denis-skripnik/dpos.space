package space.dpos.android

import org.bitcoinj.core.ECKey
import org.bitcoinj.params.MainNetParams
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import space.dpos.android.notifications.GolosHistoryClient
import space.dpos.android.notifications.HistoryEvent
import space.dpos.android.runtime.AccountImportRequest
import space.dpos.android.runtime.WorkerCommandPolicy
import space.dpos.android.storage.EncryptedKeyRef
import space.dpos.android.upvoter.*
import java.math.BigDecimal
import java.math.BigInteger
import java.security.MessageDigest

class GolosDonateTest {
    @Test fun forgedHiveAndSteemPlannedDonationCannotCrossRuntimeOrBroadcastBoundary() {
        for (chain in listOf("hive", "steem")) {
            val account = account().put("posting", JSONObject().put("weight_threshold", 1)
                .put("key_auths", JSONArray().put(JSONArray().put(GraphenePublicKey.fromWif(wif, "STM")).put(1))))
            val rpc = FakeRpc(account, props().put("head_block_id", block().getString("previous")), block())
            val history = History()
            var voteSends = 0
            var donateSends = 0
            val voteBroadcaster = object : VoteBroadcaster {
                override fun broadcast(signedTransaction: JSONObject): JSONObject {
                    voteSends++
                    history.rows = history.rows + HistoryEvent(91, "vote", mapOf(
                        "voter" to "denis", "author" to "alice", "permlink" to "hello", "weight" to "10000"))
                    return JSONObject()
                }
            }
            val donationBroadcaster = object : VoteBroadcaster {
                override fun broadcast(signedTransaction: JSONObject): JSONObject { donateSends++; return JSONObject() }
            }
            val keys = object : PostingKeyProvider {
                override fun keyRef(chainId: String, account: String) = EncryptedKeyRef(chainId, account, "posting", "posting")
                override fun privateWif(chainId: String, account: String) = wif
            }
            val runtime = AutoVoteRuntime(VoteRuntime(rpc, GrapheneVoteSigner(GrapheneChainSpecs.require(chain)),
                voteBroadcaster, history, confirmationRetries = 1, confirmationDelayMs = 0), keys, chainId = chain,
                donateRuntime = GolosDonateRuntime(rpc, history, Ledger(), donationBroadcaster, confirmationRetries = 1, confirmationDelayMs = 0))
            val forged = VotePlan(listOf(PlannedVote("denis", "alice", "hello", 10000, "favorite_post", 9800,
                donatePool = pool)), emptyList())
            val report = runtime.execute(forged)
            assertEquals("$chain regular vote sent", 1, voteSends)
            assertEquals("$chain should not donate", 0, donateSends)
            assertTrue(report.donateResults.isEmpty())
        }
    }
    @Test fun connectedAutoVoteRuntimeOnlyDonatesAfterConfirmedGolosVote() {
        val rpc = FakeRpc(account(), props(), JSONObject().put("previous", "000000c5010203040000000000000000"))
        val history = History()
        val ledger = Ledger()
        var voteSends = 0
        var donateSends = 0
        val voteBroadcast = object : VoteBroadcaster {
            override fun broadcast(signedTransaction: JSONObject): JSONObject {
                voteSends++
                history.rows = history.rows + HistoryEvent(91, "vote", mapOf(
                    "voter" to "denis", "author" to "alice", "permlink" to "hello", "weight" to "10000"))
                return JSONObject().put("result", JSONObject().put("transaction_id", "b".repeat(40)))
            }
        }
        val donateBroadcast = object : VoteBroadcaster {
            override fun broadcast(signedTransaction: JSONObject): JSONObject {
                donateSends++
                assertEquals(2, signedTransaction.getJSONArray("operations").length())
                history.rows = history.rows + listOf(event(92, "alice", "1.896 GOLOS", "post_donate", ledger.pending!!.transactionId!!),
                    event(93, "denis-skripnik", "0.004 GOLOS", "fee_donate", ledger.pending!!.transactionId!!))
                return JSONObject()
            }
        }
        val keyProvider = object : PostingKeyProvider {
            override fun keyRef(chainId: String, account: String) = EncryptedKeyRef(chainId, account, "posting", "posting")
            override fun privateWif(chainId: String, account: String) = wif
        }
        val plan = AutoUpvoterPlanner().plan(listOf(AccountSettings("denis", true,
            favorites = listOf("alice"), currentEnergy = 10000, donatePool = pool, chainId = "golos")),
            listOf(VoteEvent("favorite_post", author = "alice", permlink = "hello")))
        val runtime = AutoVoteRuntime(VoteRuntime(rpc, GrapheneVoteSigner(GrapheneChainSpecs.require("golos")),
            voteBroadcast, history, confirmationRetries = 1, confirmationDelayMs = 0), keyProvider,
            donateRuntime = GolosDonateRuntime(rpc, history, ledger, donateBroadcast, confirmationRetries = 1, confirmationDelayMs = 0))
        val report = runtime.execute(plan)
        assertEquals(1, voteSends)
        assertEquals(1, donateSends)
        assertEquals("broadcast_confirmed", report.results.single().status)
        assertEquals("donate_confirmed", report.donateResults.single().status)
    }
    // Public read-only database_api.get_transaction_hex, golosapi.ecurrex.ru, 2026-09-26.
    @Test fun nativeSerializedDonateMatchesGolosNodeTransactionHex() {
        val amounts = GolosDonateAmounts(1896, 4)
        val op = VoteOperation("golos", "alice", "bob", "hello", 10000)
        val header = BlockHeaderRef(197, 67305985, 1790380860, "0000000001020304")
        val nativeHex = GolosDonateTransactionBuilder(amounts).signingBytes(op, header)
            .drop(32).joinToString("") { "%02x".format(it) }
        assertEquals("c500010203043c0bb76a023605616c69636503626f62680700000000000003474f4c4f5300000a64706f732e73706163650100030474797065050b706f73745f646f6e61746506617574686f720503626f62087065726d6c696e6b050568656c6c6f00003605616c6963650e64656e69732d736b7269706e696b040000000000000003474f4c4f5300000a64706f732e73706163650100030474797065050a6665655f646f6e61746506617574686f720503626f62087065726d6c696e6b050568656c6c6f000000", nativeHex)
    }
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
    private class FakeRpc(val account: JSONObject, val props: JSONObject, val block: JSONObject) : GolosRpcClient {
        var authority = true
        override fun getDynamicGlobalProperties() = props
        override fun getBlock(blockNumber: Long) = block
        override fun getAccount(account: String) = this.account
        override fun verifyAuthority(signedTransaction: JSONObject) = authority
        override fun verifyAuthorityDetailed(signedTransaction: JSONObject) = JSONObject().put("result", authority)
        override fun broadcastTransactionSynchronous(signedTransaction: JSONObject): JSONObject = error("not used")
    }
    private class Ledger : GolosDonateLedger {
        var pending: PendingBroadcastIntent? = null
        val receipts = mutableSetOf<String>()
        override fun readPending(kind: String, chainId: String, account: String) = pending
        override fun savePending(intent: PendingBroadcastIntent) { pending = intent }
        override fun clearPending(kind: String, chainId: String, account: String) { pending = null }
        override fun donated(account: String, fingerprint: String) = "$account:$fingerprint" in receipts
        override fun markDonated(account: String, fingerprint: String) { receipts += "$account:$fingerprint" }
    }
    private fun event(index: Long, recipient: String, amount: String, type: String, tx: String = "a".repeat(40)): HistoryEvent = HistoryEvent(index, "donate",
        mapOf("from" to "denis", "to" to recipient, "amount" to amount,
            "trx_id" to tx, "memo" to JSONObject().put("app", "dpos.space").put("version", 1)
                .put("target", JSONObject().put("type", type).put("author", "alice").put("permlink", "hello")).toString()))
    private class History : GolosHistoryClient {
        var rows: List<HistoryEvent> = listOf(HistoryEvent(90, "vote", emptyMap()))
        override fun getAccountHistory(account: String, from: Long, limit: Int) = rows
    }

    @Test fun mathUsesDecimalUnitsAndEnforcesMinimumBalanceAndInput() {
        val amount = GolosDonateMath.calculate(pool, account(), props(), 10000)!!
        assertEquals(1896L, amount.authorMilli)
        assertEquals(4L, amount.feeMilli)
        assertEquals("1.896 GOLOS", amount.authorAsset())
        assertEquals("0.004 GOLOS", amount.feeAsset())
        assertNull(GolosDonateMath.calculate(pool, account("1.899 GOLOS"), props(), 10000))
        assertNull(GolosDonateMath.calculate(pool, account(), props(), 100))
        assertNull(GolosDonateMath.calculate(pool, account(), props(), 0))
        assertThrows(IllegalArgumentException::class.java) { GolosDonatePool.parse("101 1") }
        assertThrows(IllegalArgumentException::class.java) { GolosDonatePool.parse("10 NaN") }
        assertThrows(IllegalArgumentException::class.java) { GolosDonateMath.calculate(pool, account().put("tip_balance", "infinite GOLOS"), props(), 10000) }
    }

    @Test fun serializerIncludesBothDonateOperationsAndPostingSignature() {
        val builder = GolosDonateTransactionBuilder(GolosDonateAmounts(1497, 3))
        val header = BlockHeaderRef(321, 67305985L, 1700000000L, "0000014101020304000000000000000000000000000000000000000000000000")
        val unsigned = builder.build(op, header)
        assertEquals(2, unsigned.getJSONArray("operations").length())
        val first = unsigned.getJSONArray("operations").getJSONArray(0)
        assertEquals("donate", first.getString(0))
        assertEquals("1.497 GOLOS", first.getJSONObject(1).getString("amount"))
        assertEquals("dpos.space", first.getJSONObject(1).getJSONObject("memo").getString("app"))
        assertEquals("fee_donate", unsigned.getJSONArray("operations").getJSONArray(1).getJSONObject(1).getJSONObject("memo").getJSONObject("target").getString("type"))
        val bytes = builder.signingBytes(op, header)
        assertEquals(32, GrapheneChainSpecs.require("golos").networkChainIdHex.length / 2)
        assertEquals(2, bytes[42].toInt()) // chain id(32), ref(2), prefix(4), expiry(4)
        assertEquals(54, bytes[43].toInt()) // upstream FC_STATIC_VARIANT id
        val signed = GrapheneVoteSigner(GrapheneChainSpecs.require("golos"), builder).sign(op, ref, wif, header)
        assertTrue(signed.reason, signed.ok)
        assertEquals(130, signed.payload!!.signedTransaction.getJSONArray("signatures").getString(0).length)
        assertThrows(IllegalArgumentException::class.java) { builder.build(op.copy(chainId = "hive"), header) }
    }

    @Test fun importedNonGolosDonateIsRejectedAndPlannerErasesInjectedDonations() {
        for (chain in listOf("hive", "steem")) {
            val rejected = WorkerCommandPolicy.validateImport(AccountImportRequest(chain, "denis", true, true,
                explicitConsent = true, autoDonate = true, autoDonatePool = "10 1"))
            assertFalse(rejected.accepted)
            val imported = space.dpos.android.runtime.WorkerSettingsCodec.decodeImport(JSONObject()
                .put("chainId", chain).put("account", "denis").put("enableAutoUpvoter", true)
                .put("explicitConsent", true).put("autoDonate", true).put("autoDonatePool", "10 1").toString())
            assertFalse(imported.accepted)
            val normal = WorkerCommandPolicy.validateImport(AccountImportRequest(chain, "denis", true, true,
                explicitConsent = true))
            assertTrue(normal.accepted)
            assertFalse(normal.autoDonate)
            val plan = AutoUpvoterPlanner().plan(listOf(AccountSettings("denis", true, favorites = listOf("alice"),
                currentEnergy = 10000, chainId = chain, donatePool = pool)), listOf(VoteEvent("favorite_post", author = "alice", permlink = "hello")))
            assertEquals(1, plan.actions.size)
            assertNull(plan.actions.single().donatePool)
        }
        assertFalse(WorkerCommandPolicy.validateImport(AccountImportRequest("golos", "denis", true, true,
            explicitConsent = false, autoDonate = true, autoDonatePool = "10 1")).accepted)
        assertTrue(WorkerCommandPolicy.validateImport(AccountImportRequest("golos", "denis", true, true,
            explicitConsent = true, autoDonate = true, autoDonatePool = "10 1")).autoDonate)
    }

    @Test fun noBroadcastOnAuthorityFailureOrInsufficientBalanceOrWrongChain() {
        val rpc = FakeRpc(account(), props(), block())
        val ledger = Ledger()
        val history = History()
        var broadcasts = 0
        val broadcaster = object : VoteBroadcaster { override fun broadcast(signedTransaction: JSONObject): JSONObject { broadcasts++; return JSONObject().put("result", JSONObject()) } }
        val runtime = GolosDonateRuntime(rpc, history, ledger, broadcaster, confirmationRetries = 1, confirmationDelayMs = 0)
        assertEquals("unsupported_chain", runtime.execute(op.copy(chainId = "hive"), pool, ref, wif).status)
        rpc.authority = false
        assertEquals("donate_authority_error", runtime.execute(op, pool, ref, wif).status)
        assertNull(ledger.pending)
        assertEquals(0, broadcasts)
        rpc.authority = true
        assertEquals("donate_below_min_or_balance", GolosDonateRuntime(FakeRpc(account("0.001 GOLOS"), props(), block()), history, ledger, broadcaster).execute(op, pool, ref, wif).status)
        assertEquals(0, broadcasts)
    }

    @Test fun unknownTransportStaysPendingAcrossRestartAndVerifiedHistoryDoesNotReplay() {
        val rpc = FakeRpc(account(), props(), block())
        val ledger = Ledger()
        val history = History()
        var broadcasts = 0
        val broadcaster = object : VoteBroadcaster { override fun broadcast(signedTransaction: JSONObject): JSONObject { broadcasts++; throw IllegalStateException("lost ACK after send") } }
        val runtime = GolosDonateRuntime(rpc, history, ledger, broadcaster, confirmationRetries = 1, confirmationDelayMs = 0)
        assertEquals("donate_unknown", runtime.execute(op, pool, ref, wif).status)
        assertEquals(1, broadcasts)
        assertNotNull(ledger.pending)
        assertEquals("donate_unknown", runtime.execute(op, pool, ref, wif).status)
        assertEquals(1, broadcasts)
        history.rows = listOf(event(92, "denis-skripnik", "0.004 GOLOS", "fee_donate", ledger.pending!!.transactionId!!),
            event(91, "alice", "1.896 GOLOS", "post_donate", ledger.pending!!.transactionId!!), HistoryEvent(90, "vote", emptyMap()))
        assertEquals("donate_duplicate", runtime.execute(op, pool, ref, wif).status)
        assertNull(ledger.pending)
        assertEquals(1, broadcasts)
        assertEquals("donate_duplicate", runtime.execute(op, pool, ref, wif).status)
    }

    @Test fun partialHistoryNeverConfirmsAndNeverReplays() {
        val ledger = Ledger()
        val history = History()
        val rpc = FakeRpc(account(), props(), block())
        var calls = 0
        val runtime = GolosDonateRuntime(rpc, history, ledger, object : VoteBroadcaster { override fun broadcast(signedTransaction: JSONObject): JSONObject { calls++; return JSONObject().put("result", JSONObject()) } },
            confirmationRetries = 1, confirmationDelayMs = 0)
        assertEquals("donate_unknown", runtime.execute(op, pool, ref, wif).status)
        history.rows = listOf(event(91, "alice", "1.896 GOLOS", "post_donate"), HistoryEvent(90, "vote", emptyMap()))
        assertEquals("donate_unknown", runtime.execute(op, pool, ref, wif).status)
        assertEquals(1, calls)
    }
}
