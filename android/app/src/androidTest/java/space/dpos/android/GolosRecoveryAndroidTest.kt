package space.dpos.android

import android.content.Context
import android.content.ContextWrapper
import android.os.Process
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.bitcoinj.core.ECKey
import org.bitcoinj.params.MainNetParams
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import space.dpos.android.notifications.GolosHistoryClient
import space.dpos.android.notifications.HistoryEvent
import space.dpos.android.storage.EncryptedKeyRef
import space.dpos.android.storage.WorkerStore
import space.dpos.android.upvoter.*
import java.io.File
import java.math.BigInteger
import java.time.LocalDateTime
import java.time.ZoneOffset

/** Synthetic consensus RPC + real Android checkpoint/signer. Run A/B/C in distinct PIDs.
 * Does not replace the loopback HTTP tests, real endpoint freshness or physical-device acceptance.
 */
@RunWith(AndroidJUnit4::class)
class GolosRecoveryAndroidTest {
    @Test fun futureGenerationFenceAndUnknownQuarantineSurviveDifferentProcesses() {
        val target = InstrumentationRegistry.getInstrumentation().targetContext
        val args = InstrumentationRegistry.getArguments()
        val phase = args.getString("phase") ?: error("A/B/C required")
        val runId = args.getString("runId") ?: error("unique runId required")
        require(runId.matches(Regex("[A-Za-z0-9_-]{1,64}")))
        val name = "golos-recovery-$runId"; val root = File(target.filesDir, name)
        if (phase == "A") { check(!root.exists()); check(root.mkdirs()) }
        val context = object : ContextWrapper(target) { override fun getFilesDir() = root }
        val prefs = target.getSharedPreferences(name, Context.MODE_PRIVATE)
        if (phase == "A") prefs.edit().putBoolean("voteStorageUnsafe", true).commit()
        val store = WorkerStore(context, prefs, prefs)
        if (phase == "A") store.setWorkerEnabled(true)
        val initialTime = store.readGolosRecoveryFence()?.getLong("headTime") ?: System.currentTimeMillis() / 1000
        val now = if (phase == "A") initialTime else initialTime + 3800
        val head = if (phase == "A") 100L else 1500L
        val lib = if (phase == "A") 90L else 1490L
        var sends = 0
        val wif = ECKey.fromPrivate(BigInteger.valueOf(2), true).getPrivateKeyAsWiF(MainNetParams.get())
        val history = object : GolosHistoryClient { override fun getAccountHistory(account: String, from: Long, limit: Int) = emptyList<HistoryEvent>() }
        val rpc = object : GolosRpcClient {
            override val recoveryEndpoint = "synthetic-android-boundary"
            override fun getGolosConfig() = JSONObject().put("STEEMIT_CHAIN_ID", GrapheneChainSpecs.require("golos").networkChainIdHex).put("STEEMIT_MAX_TIME_UNTIL_EXPIRATION", 3600)
            override fun getDynamicGlobalProperties() = JSONObject().put("head_block_number", head).put("head_block_id", id(head)).put("time", stamp(now)).put("last_irreversible_block_num", lib)
            override fun getBlockHeader(number: Long) = JSONObject().put("previous", id(number - 1)).put("timestamp", stamp(if (number == 101L) initialTime + 3 else now - 3))
            override fun getBlock(blockNumber: Long) = JSONObject().put("previous", id(blockNumber - 1))
            override fun getAccount(account: String) = JSONObject().put("posting", JSONObject().put("weight_threshold", 1).put("key_auths", JSONArray().put(JSONArray().put(GraphenePublicKey.fromWif(wif)).put(1))))
            override fun getGolosContent(author: String, permlink: String) = JSONObject().put("author", author).put("permlink", permlink).put("parent_author", "")
                .put("id", if (phase == "C") 900 else 42).put("root_comment", if (phase == "C") 900 else 42).put("created", stamp(now - 6))
                .put("last_update", stamp(now - 6)).put("num_changes", 0).put("allow_votes", true).put("last_payout", "1970-01-01T00:00:00").put("cashout_time", stamp(now + 86400))
            override fun verifyAuthority(signedTransaction: JSONObject) = true
            override fun verifyAuthorityDetailed(signedTransaction: JSONObject) = JSONObject().put("result", true)
            override fun broadcastTransactionSynchronous(signedTransaction: JSONObject): JSONObject { sends++; return JSONObject() }
        }
        val runtime = VoteRuntime(rpc, historyClient = history, pendingStore = store, canAct = { store.workerEnabled() }, confirmationRetries = 1,
            confirmationDelayMs = 0, recoveryWall = { now * 1000 }, recoveryMonotonic = { 1000 })
        val op = VoteOperation("golos", "fixture-voter", "target", "future", if (phase == "C") 9999 else 7000)
        val key = EncryptedKeyRef("golos", "fixture-voter", "posting", "posting")
        when (phase) {
            "A" -> { assertEquals("recovery_deferred", runtime.execute(op, key, wif).status); assertEquals(0, sends); File(root, "A.pid").writeText(Process.myPid().toString()) }
            "B" -> { assertNotEquals(File(root, "A.pid").readText().toInt(), Process.myPid()); assertEquals("broadcast_unknown", runtime.execute(op, key, wif).status); assertEquals(1, sends); File(root, "B.pid").writeText(Process.myPid().toString()) }
            "C" -> { assertNotEquals(File(root, "B.pid").readText().toInt(), Process.myPid()); assertEquals("broadcast_unknown", runtime.execute(op, key, wif).status); assertEquals(0, sends); assertFalse(store.voteArchive("golos", "fixture-voter").single().confirmed) }
            else -> error("unknown phase")
        }
        assertTrue(store.checkpointStatus().getBoolean("legacyIdentityIncomplete"))
        println("GOLOS_RECOVERY_SYNTHETIC phase=$phase pid=${Process.myPid()} sends=$sends")
    }
    private fun id(n: Long) = "%08x".format(n) + "a".repeat(32)
    private fun stamp(t: Long) = LocalDateTime.ofEpochSecond(t, 0, ZoneOffset.UTC).format(java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss"))
}
