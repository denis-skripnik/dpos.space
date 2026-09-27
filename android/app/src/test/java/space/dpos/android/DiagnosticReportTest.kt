package space.dpos.android

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import org.json.JSONObject
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import space.dpos.android.diagnostics.DiagnosticReportBuilder
import space.dpos.android.runtime.AccountImportRequest
import space.dpos.android.runtime.WorkerCommandPolicy
import space.dpos.android.storage.WorkerStore

@RunWith(RobolectricTestRunner::class)
class DiagnosticReportTest {
    @Test fun reportIncludesStoredDisabledAndActiveAccountFlagsWithoutSecrets() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        context.getSharedPreferences("dpos_worker", Context.MODE_PRIVATE).edit().clear().commit()
        val secure = context.getSharedPreferences("diagnostic-report-secure", Context.MODE_PRIVATE)
        secure.edit().clear().commit()
        val store = WorkerStore(context, secure)
        store.importDecision(WorkerCommandPolicy.validateImport(AccountImportRequest("golos", "active", true, true, false, true, explicitConsent = true)))
        store.syncVizSelfAward("disabled", enabled = false, autoStart = false, minEnergy = 9500)
        store.savePending(space.dpos.android.upvoter.PendingBroadcastIntent("vote", "golos", "active", "alice|hello|5000", 83720,
            transactionId = "a".repeat(40), createdAtMs = 1_000L))
        store.savePending(space.dpos.android.upvoter.PendingBroadcastIntent("self_award", "viz", "disabled",
            "v2|10|dpos.space: VIZ self-award|denis-skripnik|100", 538))
        context.getSharedPreferences("dpos_worker", Context.MODE_PRIVATE).edit().putBoolean("autoDonate:golos:active", false).commit()
        store.saveLastRunSummary(JSONObject().put("status", "checked").put("signedTransaction", "raw-secret-transaction"))

        store.saveAutoUpvoterFeed(listOf(JSONObject().put("message", "password=feed-secret").put("status", "failed")))
        store.setLastError("password=last-error-secret")
        assertTrue(store.exportAutoUpvoterFeed().getJSONObject(0).getString("status") == "failed")
        val persisted = context.getSharedPreferences("dpos_worker", Context.MODE_PRIVATE).all.toString()
        assertFalse(persisted.contains("feed-secret"))
        assertFalse(persisted.contains("last-error-secret"))
        assertFalse(persisted.contains("raw-secret-transaction"))
        val report = DiagnosticReportBuilder.build(store, "0.1.70-test", 71, 1234L)
        assertTrue(report.contains("golos:active"))
        assertTrue(report.contains("active=true"))
        assertTrue(report.contains("viz:disabled"))
        assertTrue(report.contains("active=false"))
        assertTrue(report.contains("status"))
        assertTrue(report.contains("donateNative={\"flag\":\"disabled\""))
        assertTrue(report.contains("\"historyBaseline\":83720"))
        assertTrue(report.contains("\"ageSeconds\":0"))
        assertTrue(report.contains("\"identity\":\"exact_transaction\""))
        assertTrue(report.contains("\"identity\":\"operation_only\""))
        assertFalse(report.contains("alice|hello|5000"))
        assertFalse(report.contains("raw-secret-transaction"))
    }
}
