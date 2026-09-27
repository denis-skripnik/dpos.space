package space.dpos.android

import android.app.Activity
import android.content.Context
import androidx.test.core.app.ApplicationProvider
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import space.dpos.android.bridge.BridgeRequest
import space.dpos.android.bridge.DposAndroidBridge
import space.dpos.android.storage.WorkerStore

@RunWith(RobolectricTestRunner::class)
class DiagnosticBridgeExportTest {
    @Test fun saveIsDirectCapsAndSanitizesWebReportAndReturnsOnlyAfterSaverCallback() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val store = WorkerStore(context, context.getSharedPreferences("diagnostic-bridge-secure", Context.MODE_PRIVATE))
        val activity = Robolectric.buildActivity(Activity::class.java).setup().get()
        var written = ""
        var saverCallback: ((JSONObject) -> Unit)? = null
        val bridge = DposAndroidBridge(activity, store, diagnosticSaver = { report, callback ->
            written = report
            saverCallback = callback
        }) { JSONObject() }
        var response: JSONObject? = null
        bridge.dispatch(BridgeRequest("save-1", "saveDiagnosticLog", JSONObject()
            .put("filename", "../../not-accepted.log")
            .put("webReport", "password=web-secret\n" + "x".repeat(90_000)))) { response = it }

        assertEquals(null, response)
        assertFalse(written.contains("web-secret"))
        assertTrue(written.substringAfter("Web diagnostic report").length <= 80_100)
        saverCallback!!(JSONObject().put("ok", true).put("filename", "dpos-space-diagnostics.log"))
        assertTrue(response!!.getJSONObject("result").getBoolean("ok"))
        assertFalse(response.toString().contains("not-accepted"))
        bridge.close()
    }

    @Test fun saveCancellationIsReturnedAsAResultAndCapabilityIsAdvertised() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val store = WorkerStore(context, context.getSharedPreferences("diagnostic-bridge-cancel-secure", Context.MODE_PRIVATE))
        val activity = Robolectric.buildActivity(Activity::class.java).setup().get()
        val bridge = DposAndroidBridge(activity, store, diagnosticSaver = { _, callback ->
            callback(JSONObject().put("ok", false).put("cancelled", true))
        }) { JSONObject() }
        var response: JSONObject? = null
        bridge.dispatch(BridgeRequest("save-2", "saveDiagnosticLog", JSONObject().put("webReport", "safe"))) { response = it }
        val result = response!!.getJSONObject("result")
        assertFalse(result.getBoolean("ok"))
        assertTrue(result.getBoolean("cancelled"))
        assertTrue(JSONObject(bridge.getAppInfo()).getBoolean("diagnosticLogExport"))
        bridge.close()
        var info: JSONObject? = null
        bridge.dispatch(BridgeRequest("capability", "getAppInfo", JSONObject())) { info = it }
        assertTrue(info!!.getBoolean("ok"))
        assertTrue(info!!.getJSONObject("result").getBoolean("diagnosticLogExport"))
    }
}
