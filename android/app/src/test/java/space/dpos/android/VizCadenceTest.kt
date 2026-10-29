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
import space.dpos.android.runtime.AccountImportRequest
import space.dpos.android.runtime.WorkerCommandPolicy
import space.dpos.android.storage.EncryptedKeyRef
import space.dpos.android.storage.WorkerStore
import space.dpos.android.upvoter.*
import space.dpos.android.worker.DposWorkerRunner
import java.io.ByteArrayOutputStream
import java.math.BigInteger
import java.time.LocalDateTime
import java.time.ZoneOffset

@RunWith(RobolectricTestRunner::class)
class VizCadenceTest {
    private fun iso(t: Long) = LocalDateTime.ofEpochSecond(t, 0, ZoneOffset.UTC).toString()
    private val now = System.currentTimeMillis() / 1000
    private val wif = ECKey.fromPrivate(BigInteger("2"), true).getPrivateKeyAsWiF(MainNetParams.get())
    private val key = EncryptedKeyRef("viz", "alice", "regular", "regular")
    private val fingerprint = "v2|10|$VIZ_SELF_AWARD_MEMO|denis-skripnik|100"
    private fun newContext(): Context {
        val base = ApplicationProvider.getApplicationContext<Context>()
        return object : android.content.ContextWrapper(base) {
            private val dir = java.io.File(base.filesDir, "cadence-${java.util.UUID.randomUUID()}").apply { mkdirs() }
            override fun getFilesDir() = dir
        }
    }
    private var context: Context = newContext()
    private fun store(): WorkerStore = WorkerStore(context, context.getSharedPreferences("cadence-keys", 0))
    private fun setup(): WorkerStore {
        context = newContext()
        context.getSharedPreferences("dpos_worker", 0).edit().clear().commit()
        return store().apply {
            setWorkerEnabled(true)
            importDecision(WorkerCommandPolicy.validateImport(AccountImportRequest("viz", "alice", enableNotifications = false, enableAutoUpvoter = false, explicitConsent = true)))
            syncVizSelfAward("alice", true, true, 9500)
            saveEncryptedKeyRef(key, wif)
        }
    }
    /** Independent fixture wire encoding, not the production builder or ID function. */
    private fun id(tx: JSONObject): String {
        val bytes = ByteArrayOutputStream()
        fun le(n: Long, size: Int) { repeat(size) { bytes.write((n ushr (it * 8)).toInt() and 255) } }
        fun text(s: String) { val b=s.toByteArray(); check(b.size < 128); bytes.write(b.size); bytes.write(b) }
        le(tx.getLong("ref_block_num"), 2); le(tx.getLong("ref_block_prefix"), 4)
        le(LocalDateTime.parse(tx.getString("expiration")).toEpochSecond(ZoneOffset.UTC), 4)
        bytes.write(1); bytes.write(47)
        val op=tx.getJSONArray("operations").getJSONArray(0).getJSONObject(1)
        text(op.getString("initiator")); text(op.getString("receiver")); le(op.getLong("energy"),2)
        le(op.getLong("custom_sequence"),8); text(op.getString("memo"))
        val beneficiaries=op.getJSONArray("beneficiaries"); bytes.write(beneficiaries.length())
        if(beneficiaries.length()==1) { text("denis-skripnik"); le(100,2) }
        bytes.write(0)
        return java.security.MessageDigest.getInstance("SHA-256").digest(bytes.toByteArray()).take(20).joinToString("") { "%02x".format(it) }
    }
    private fun oldTx() = JSONObject().put("ref_block_num", 100).put("ref_block_prefix", 1234)
        .put("expiration", iso(now + 60)).put("extensions", JSONArray()).put("signatures", JSONArray().put("fixture-signature"))
        .put("operations", JSONArray().put(JSONArray().put("award").put(JSONObject()
            .put("initiator", "alice").put("receiver", "alice").put("energy", 10).put("custom_sequence", 0)
            .put("memo", VIZ_SELF_AWARD_MEMO).put("beneficiaries", JSONArray().put(JSONObject().put("account", "denis-skripnik").put("weight", 100))))))
    private inner class Rpc(val old: JSONObject, var age: Long) : GolosRpcClient {
        var mode = "valid"
        var permit = true
        var stopAt = ""
        var freshConfirmed = false
        var onProof: (() -> Unit)? = null
        var onPrepare: (() -> Unit)? = null
        val sent = mutableListOf<JSONObject>()
        override fun getAccount(account: String): JSONObject = JSONObject().put("energy", 10000).put("last_vote_time", iso(now))
            .put("regular_authority", JSONObject().put("weight_threshold",1).put("key_auths",JSONArray().put(JSONArray().put(GraphenePublicKey.fromWif(wif,"VIZ")).put(1))))
        override fun getDynamicGlobalProperties() = JSONObject().put("time", iso(if (mode == "stale") now-1000 else now))
            .put("head_block_number", 2000).put("last_irreversible_block_num", if (mode == "reversible") 899 else 1999)
        override fun getBlock(blockNumber: Long) = JSONObject().put("previous", "0000007901020304000000000000000000000000000000000000000000000000")
        override fun getVizTransaction(transactionId: String): JSONObject? {
            onProof?.invoke()
            if (stopAt == "proof") permit=false
            val tx = if (transactionId == id(old)) old else if (freshConfirmed) sent.lastOrNull() ?: return null else return null
            if (mode == "unknown") return null
            val canonical = JSONObject(tx.toString())
            if (mode == "mismatch") canonical.put("ref_block_prefix", 99)
            val proof = JSONObject(tx.toString()).put("transaction_id",transactionId).put("block_num",900).put("transaction_num",0)
                .put("_vizEndpoint", "http://fixture").put("_vizHead",getDynamicGlobalProperties())
                .put("_vizBlock",JSONObject().put("timestamp",iso(now - if (tx === old) age else 0)).put("transactions",JSONArray().put(canonical)))
            when(mode) {
                "position" -> proof.put("transaction_num",1)
                "id" -> proof.put("ref_block_prefix",99)
                "future_time" -> proof.getJSONObject("_vizBlock").put("timestamp",iso(now+100))
                "legacy" -> { proof.remove("_vizBlock"); proof.put("timestamp",iso(now-10000)) }
            }
            return proof
        }
        override fun verifyAuthority(signedTransaction: JSONObject) = true
        override fun verifyAuthorityDetailed(signedTransaction: JSONObject): JSONObject {
            onPrepare?.invoke()
            if (stopAt == "prepare") permit=false
            return JSONObject().put("result",true)
        }
        override fun broadcastTransactionSynchronous(signedTransaction: JSONObject): JSONObject {
            sent += JSONObject(signedTransaction.toString()); return JSONObject().put("result",JSONObject())
        }
    }
    private fun pending(store: WorkerStore, old: JSONObject) = PendingBroadcastIntent("self_award","viz","alice",fingerprint,-1,
        transactionId=id(old), expirationEpochSeconds=now+60, observedChainTimeSeconds=now, observedHeadBlock=1000).also { store.savePending(it) }
    private fun runtime(rpc: Rpc, store: WorkerStore) = VizSelfAwardRuntime(rpc, pendingStore=store, confirmationRetries=1, confirmationDelayMs=0,
        canAct={rpc.permit}, clockSeconds={now})
    private fun runner(rpc: Rpc, store: WorkerStore) = DposWorkerRunner(context,store=store,rpcOverride={rpc})

    @Test fun lateConfirmationDoesNotConsumeDueSendCycleAndSurvivesRestart() {
        val store=setup(); val old=oldTx(); pending(store,old); val rpc=Rpc(old,500)
        val first=runner(rpc,store).runOnce("cadence")
        assertEquals(first.messages.toString(),1,rpc.sent.size)
        assertNotEquals(id(old),id(rpc.sent.single()))
        assertEquals(1,first.vizSelfAwardBroadcasted)
        assertEquals(1,store.totalVizSelfAwardBroadcasted())
        val fresh=store.readPending("self_award","viz","alice")!!
        assertEquals(id(rpc.sent.single()),fresh.transactionId)
        runner(rpc,store()).runOnce("cadence-restart")
        assertEquals(1,rpc.sent.size); assertEquals(1,store().totalVizSelfAwardBroadcasted())
    }
    @Test fun exactBoundaryAndBelowBoundary() {
        for(age in listOf(431L,432L)) {
            val store=setup(); val old=oldTx(); pending(store,old); val rpc=Rpc(old,age)
            runtime(rpc,store).execute("alice",9500,key,wif)
            assertEquals("age=$age",if(age==432L) 1 else 0,rpc.sent.size)
        }
    }
    @Test fun twoConfirmationsCountTwoExactIdentitiesNotOneBoolean() {
        val store=setup(); val old=oldTx(); pending(store,old); val rpc=Rpc(old,500).apply { freshConfirmed=true }
        val first=runner(rpc,store).runOnce("cadence")
        assertEquals(1,rpc.sent.size); assertEquals(2,first.vizSelfAwardBroadcasted)
        assertEquals(2,store.totalVizSelfAwardBroadcasted())
        runner(rpc,store()).runOnce("cadence-restart")
        assertEquals(1,rpc.sent.size); assertEquals(2,store().totalVizSelfAwardBroadcasted())
    }
    @Test fun unsafeProofAndStopNeverPermitFreshSend() {
        for(mode in listOf("unknown","mismatch","reversible","stale","position","id","future_time")) {
            val store=setup(); val old=oldTx(); pending(store,old); val rpc=Rpc(old,500).apply { this.mode=mode }
            runtime(rpc,store).execute("alice",9500,key,wif)
            assertEquals(mode,0,rpc.sent.size)
            assertNotNull(mode,store.readPending("self_award","viz","alice"))
        }
        for(stopAt in listOf("proof","prepare")) {
            val store=setup(); val old=oldTx(); pending(store,old); val rpc=Rpc(old,500).apply { this.stopAt=stopAt }
            runtime(rpc,store).execute("alice",9500,key,wif)
            assertEquals(stopAt,0,rpc.sent.size)
        }
    }
    @Test fun legacyReceiptTimestampNeverReleasesCadence() {
        val store=setup(); val old=oldTx(); pending(store,old)
        val rpc=Rpc(old,500).apply { mode="legacy" }
        val result=runtime(rpc,store).execute("alice",9500,key,wif)
        assertEquals("broadcast_confirmed",result.status)
        assertTrue(rpc.sent.isEmpty()); assertTrue(store.lastVizSelfAwardAt("alice")!! >= now*1000)
        runtime(rpc,store()).execute("alice",9500,key,wif)
        assertTrue(rpc.sent.isEmpty()); assertEquals(1,store().totalVizSelfAwardBroadcasted())
    }
    @Test fun retiredBeneficiaryFreeRecordCanSettleButCannotAccelerate() {
        val store=setup(); val old=oldTx()
        old.getJSONArray("operations").getJSONArray(0).getJSONObject(1).put("beneficiaries",JSONArray())
        val prior=PendingBroadcastIntent("self_award","viz","alice","10|$VIZ_SELF_AWARD_MEMO",-1,
            transactionId=id(old),expirationEpochSeconds=now+60,observedChainTimeSeconds=now,observedHeadBlock=1000)
        store.savePending(prior)
        val rpc=Rpc(old,500)
        val result=runtime(rpc,store).execute("alice",9500,key,wif)
        assertEquals(result.reason,"broadcast_confirmed",result.status)
        assertTrue(rpc.sent.isEmpty()); assertNull(store.readPending("self_award","viz","alice"))
        assertTrue(store.lastVizSelfAwardAt("alice")!! >= now*1000)
        assertEquals(1,store().totalVizSelfAwardBroadcasted())
    }
    @Test fun realRunnerStopDuringLateProofOrFreshPreparationNeverSends() {
        for(atProof in listOf(true,false)) {
            val store=setup(); val old=oldTx(); pending(store,old); val rpc=Rpc(old,500)
            if(atProof) rpc.onProof={store.setWorkerEnabled(false)}
            else rpc.onPrepare={store.setWorkerEnabled(false)}
            runner(rpc,store).runOnce("cadence-stop")
            assertTrue(rpc.sent.isEmpty())
            assertEquals(1,store().totalVizSelfAwardBroadcasted())
        }
    }
    @Test fun oldConfirmationStillCountsWhenFreshPreparationFails() {
        val store=setup(); val old=oldTx(); pending(store,old); val rpc=Rpc(old,500)
        rpc.onPrepare={throw java.io.IOException("fixture preparation failure")}
        val result=runner(rpc,store).runOnce("cadence-failure")
        assertTrue(rpc.sent.isEmpty()); assertEquals(1,result.vizSelfAwardBroadcasted)
        assertEquals(1,result.totalVizSelfAwardBroadcasted)
        assertNull(store.readPending("self_award","viz","alice"))
        assertFalse(result.ok)
    }
    @Test fun dueVizContinuesBeforeGolosPlanningInSameOwnedTick() {
        HostFullFlowProductionFixture().use { p ->
            p.ready(); val store=p.f.restart(); context=p.f.context
            store.importDecision(WorkerCommandPolicy.validateImport(AccountImportRequest("viz","alice",enableNotifications=false,enableAutoUpvoter=false,explicitConsent=true)))
            store.syncVizSelfAward("alice",true,true,9500); store.saveEncryptedKeyRef(key,wif)
            val old=oldTx(); pending(store,old); val rpc=Rpc(old,500)
            var planned=false
            val result=DposWorkerRunner(context,store,rpcOverride={if(it=="viz") rpc else p.rpc},historyOverride={p.f.history},
                eventsOverride={_,_->emptyList()},productionPolicy=p.policy,recoveryWall={p.f.recoveryWall},recoveryMonotonic={p.f.recoveryMono},
                statusSink={if(it.contains("планирую голоса")) { assertEquals(1,rpc.sent.size); planned=true }}).runOnce("cadence-both")
            assertTrue(result.messages.toString(),planned)
            assertEquals(1,rpc.sent.size); assertEquals(1,result.vizSelfAwardBroadcasted)
            assertNotNull(store.readPending("self_award","viz","alice"))
        }
    }
    @Test fun httpRunnerBindsCanonicalProofAndCapturesDistinctSignedTransaction() {
        val store=setup(); val old=oldTx(); pending(store,old); val rpc=Rpc(old,500)
        val server=java.net.ServerSocket(0,50,java.net.InetAddress.getByName("127.0.0.1"))
        val methods=java.util.Collections.synchronizedList(mutableListOf<String>())
        val serving=Thread {
            while(!server.isClosed) {
                val socket=try { server.accept() } catch(_: java.net.SocketException) { break }
                socket.use {
                val reader=socket.getInputStream().bufferedReader()
                reader.readLine()
                var length=0
                while(true) {
                    val line=reader.readLine() ?: error("short headers")
                    if(line.isEmpty()) break
                    if(line.startsWith("Content-Length:",true)) length=line.substringAfter(':').trim().toInt()
                }
                val body=CharArray(length); var offset=0
                while(offset<length) { val n=reader.read(body,offset,length-offset); check(n>0); offset+=n }
                val request=JSONObject(String(body))
                val args=request.getJSONArray("params")
                val method=args.getString(1); val params=args.getJSONArray(2); methods += method
                val result: Any = when(method) {
                    "get_accounts" -> JSONArray().put(rpc.getAccount("alice"))
                    "get_dynamic_global_properties" -> rpc.getDynamicGlobalProperties()
                    "get_transaction" -> rpc.getVizTransaction(params.getString(0))?.apply {
                        remove("_vizBlock"); remove("_vizHead"); remove("_vizEndpoint")
                    } ?: JSONObject.NULL
                    "get_block" -> if(params.getLong(0)==900L)
                        JSONObject().put("timestamp",iso(now-500)).put("transactions",JSONArray().put(old))
                        else rpc.getBlock(params.getLong(0))
                    "verify_authority" -> true
                    "broadcast_transaction" -> { rpc.broadcastTransactionSynchronous(params.getJSONObject(0)); JSONObject.NULL }
                    else -> error("unexpected fixture method $method")
                }
                val bytes=JSONObject().put("jsonrpc","2.0").put("id",request.get("id")).put("result",result).toString().toByteArray()
                socket.getOutputStream().apply {
                    write("HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: ${bytes.size}\r\nConnection: close\r\n\r\n".toByteArray())
                    write(bytes); flush()
                }
                }
            }
        }.apply { isDaemon=true; start() }
        try {
            val http=HttpGrapheneRpcClient(GrapheneChainSpecs.require("viz"),"http://127.0.0.1:${server.localPort}/")
            val summary=DposWorkerRunner(context,store=store,rpcOverride={http}).runOnce("foreground-golos")
            assertEquals(summary.messages.toString(),1,rpc.sent.size)
            val sent=rpc.sent.single()
            assertEquals(130,sent.getJSONArray("signatures").getString(0).length)
            assertNotEquals(id(old),id(sent))
            assertEquals(id(sent),store.readPending("self_award","viz","alice")!!.transactionId)
            assertTrue(methods.containsAll(listOf("get_transaction","get_block","get_dynamic_global_properties","verify_authority","broadcast_transaction")))
            assertEquals(1,summary.vizSelfAwardBroadcasted)
        } finally { server.close(); serving.join(2000); assertFalse(serving.isAlive) }
    }

    @Test fun incrementalVizDoesNotRunOtherRetainedVizWorkflowFlags() {
        val store=setup(); val old=oldTx(); pending(store,old); val rpc=Rpc(old,500)
        context.getSharedPreferences("dpos_worker",0).edit().putBoolean("upvoter:viz:alice",true).commit()
        val result=runner(rpc,store).runOnce("foreground-golos")
        assertEquals(result.messages.toString(),1,rpc.sent.size)
        assertEquals(0,result.autoUpvoterChecks)
    }
    @Test fun golosIntervalAlsoReconcilesVizWithoutWaitingForFullCycle() {
        val store=setup(); val old=oldTx(); pending(store,old); val rpc=Rpc(old,500)
        val summary=runner(rpc,store).runOnce("foreground-golos")
        assertEquals(summary.messages.toString(),1,rpc.sent.size)
    }
}
