package space.dpos.android

import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class GolosProductionAndroidTest {
    /** Physical durability gate only; branch admission is covered by real-policy loopback JVM tests. */
    private fun initialize(store: space.dpos.android.storage.WorkerStore, root: java.io.File) {
        val old = org.json.JSONObject().put("schema", 1)
            .put("chainId", space.dpos.android.upvoter.GrapheneChainSpecs.require("golos").networkChainIdHex)
            .put("endpoint", "https://apibeta.golos.today").put("head", 104806385L)
            .put("headId", "063f37f15c2f1a2b24484a5d45fe17b60b9032ee")
            .put("headTime", 1792033410L).put("observedAtMs", 1792033410000L).put("observedLib", 104806370L)
            .put("verifiedLib", 104807631L).put("verifiedLibTime", 1792037148L).put("verifiedAtMs", 1792037148000L)
            .put("drain", 1792037130L).put("cutoff", 1792037130L).put("verified", true)
        store.saveGolosRecoveryFence(old)
        val now = System.currentTimeMillis()
        val admitted = space.dpos.android.upvoter.GolosProductionPolicy.Admitted(rpc(), 104760300L,
            "063e83ec" + "a".repeat(32), now / 1000, 104760280L, now, 1000L)
        check(store.migrateReviewedGolosFence(admitted) { true })
        check(!store.migrateReviewedGolosFence(admitted) { true })
        java.io.File(root, "record.json").writeText(store.readGolosProductionTransition()!!.toString())
        java.io.File(root, "A.pid").writeText(android.os.Process.myPid().toString())
        org.junit.Assert.assertFalse(store.workerEnabled())
    }

    private fun rpc() = object : space.dpos.android.upvoter.GolosRpcClient {
        override val recoveryEndpoint = space.dpos.android.upvoter.HttpGrapheneRpcClient(space.dpos.android.upvoter.GrapheneChainSpecs.require("golos"), space.dpos.android.upvoter.GolosProductionPolicy.ENDPOINT).recoveryEndpoint
        override fun getDynamicGlobalProperties(): org.json.JSONObject = error("no RPC in durability gate")
        override fun getBlock(blockNumber: Long): org.json.JSONObject? = error("no RPC")
        override fun getAccount(account: String): org.json.JSONObject? = error("no RPC")
        override fun verifyAuthority(signedTransaction: org.json.JSONObject) = error("no signing")
        override fun verifyAuthorityDetailed(signedTransaction: org.json.JSONObject): org.json.JSONObject = error("no signing")
        override fun broadcastTransactionSynchronous(signedTransaction: org.json.JSONObject): org.json.JSONObject = error("NO TRANSPORT")
    }

    @Test fun migrationDurabilityAcrossProcesses() {
        val target = androidx.test.platform.app.InstrumentationRegistry.getInstrumentation().targetContext
        val args = androidx.test.platform.app.InstrumentationRegistry.getArguments()
        val phase = args.getString("phase") ?: error("A/B required")
        val id = args.getString("runId") ?: error("unique runId required")
        require(id.matches(Regex("[A-Za-z0-9_-]{1,64}")))
        val root = java.io.File(target.filesDir, "golos-production-$id")
        if (phase == "A") check(!root.exists() && root.mkdirs())
        val context = object : android.content.ContextWrapper(target) { override fun getFilesDir() = root }
        val prefs = target.getSharedPreferences("golos-production-$id", 0)
        if (phase == "A") check(prefs.edit().putBoolean("voteStorageUnsafe", true).commit())
        val store = space.dpos.android.storage.WorkerStore(context, prefs, prefs)
        if (phase == "A") initialize(store, root)
        else {
            check(phase == "B")
            org.junit.Assert.assertNotEquals(java.io.File(root, "A.pid").readText().toInt(), android.os.Process.myPid())
            val record = store.readGolosProductionTransition()!!
            org.junit.Assert.assertEquals(java.io.File(root, "record.json").readText(), record.toString())
            org.junit.Assert.assertFalse(store.readGolosRecoveryFence()!!.getBoolean("verified"))
            org.junit.Assert.assertFalse(store.workerEnabled())
            org.junit.Assert.assertTrue(store.requiresGolosRecovery())
        }
        println("GOLOS_PRODUCTION_ANDROID phase=$phase pid=${android.os.Process.myPid()} sends=0")
    }
}
