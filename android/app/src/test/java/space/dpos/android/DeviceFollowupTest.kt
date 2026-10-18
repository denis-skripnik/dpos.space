package space.dpos.android

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import space.dpos.android.storage.WorkerStore
import space.dpos.android.upvoter.*
import space.dpos.android.diagnostics.DiagnosticSanitizer

@RunWith(RobolectricTestRunner::class)
class DeviceFollowupTest {
    @Test fun publicIdentitySurvivesWholeReportButMalformedAndSigningSecretsDoNot() {
        val id = "cc62e8712c06117ab9a7d03b2a6dd5c2a61df6ff"
        val source = JSONObject().put("pending", JSONObject().put("transactionId", id)
            .put("pendingTxId", id).put("signedTransaction", JSONObject().put("transactionId", id).put("secret", "never-export")))
            .put("bad", JSONObject().put("transactionId", "private=never-export"))
            .put("recoveryCursors", JSONObject().put("https://node.example/api|account_history", 40).put("https://node.example/other|account_history", 70))
        val report = DiagnosticSanitizer.sanitize("report\n$source")
        val result = JSONObject(report.substringAfter('\n'))
        assertEquals(id, result.getJSONObject("pending").getString("transactionId"))
        assertEquals(id, result.getJSONObject("pending").getString("pendingTxId"))
        assertFalse(report.contains("never-export"))
        assertEquals(2, result.getJSONObject("recoveryCursors").length())
    }

    @Test fun legacyUnknownAllowsUnrelatedButNeverSameTargetEvenAlternateWeight() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        context.getSharedPreferences("dpos_worker", Context.MODE_PRIVATE).edit().clear().commit()
        val store = WorkerStore(context, context.getSharedPreferences("followup-secure", Context.MODE_PRIVATE))
        store.savePending(PendingBroadcastIntent("vote", "golos", "voter", "author|oldpost|7000", 100, transactionId = "a".repeat(40)))
        var preparations = 0
        val rpc = object : GolosRpcClient {
            override fun getDynamicGlobalProperties(): JSONObject { preparations++; error("fresh preparation reached") }
            override fun getBlock(blockNumber: Long): JSONObject? = error("no send")
            override fun getAccount(account: String): JSONObject? = null
            override fun getActiveVotePercent(author: String, permlink: String, voter: String): Int? = null
            override fun verifyAuthority(signedTransaction: JSONObject) = false
            override fun verifyAuthorityDetailed(signedTransaction: JSONObject) = JSONObject()
            override fun broadcastTransactionSynchronous(signedTransaction: JSONObject): JSONObject = error("NO SEND")
        }
        val runtime = VoteRuntime(rpc, pendingStore = store)
        assertEquals("broadcast_unknown", runtime.execute(VoteOperation("golos", "voter", "author", "oldpost", 10000), null, null).status)
        assertEquals(0, preparations)
        runCatching { runtime.execute(VoteOperation("golos", "voter", "author", "newpost", 10000), null, null) }
        assertEquals(1, preparations)
    }
}
