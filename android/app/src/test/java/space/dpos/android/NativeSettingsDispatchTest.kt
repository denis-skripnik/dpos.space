package space.dpos.android

import android.app.Activity
import android.content.Context
import androidx.test.core.app.ApplicationProvider
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.shadows.ShadowAlertDialog
import space.dpos.android.bridge.BridgeRequest
import space.dpos.android.bridge.DposAndroidBridge
import space.dpos.android.storage.WorkerStore
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

@RunWith(RobolectricTestRunner::class)
class NativeSettingsDispatchTest {
    private fun store(): WorkerStore {
        val context = ApplicationProvider.getApplicationContext<Context>()
        context.getSharedPreferences("dpos_worker", Context.MODE_PRIVATE).edit().clear().commit()
        return WorkerStore(context, context.getSharedPreferences("settings-dispatch-fixture", Context.MODE_PRIVATE))
    }
    @Test fun explicitSettingsReturnWithoutAnExtraDialogOrStartingTheWorker() {
        val store = store()
        val activity = Robolectric.buildActivity(Activity::class.java).setup().get()
        val bridge = DposAndroidBridge(activity, store) { JSONObject() }
        try {
            val actions = listOf(
                "importWorkerSettings" to JSONObject("""{"chainId":"golos","account":"alice","enableNotifications":true}"""),
                "syncAutoUpvoterSettings" to JSONObject("""{"accounts":[{"chainId":"golos","account":"alice","enabled":true}]}"""),
                "syncVizSelfAwardSettings" to JSONObject("""{"account":"alice","enabled":true,"minEnergy":9500}""")
            )
            for ((method, payload) in actions) {
                val done = CountDownLatch(1)
                var reply: JSONObject? = null
                bridge.dispatch(BridgeRequest(method, method, payload)) { reply = it; done.countDown() }
                assertTrue(method, done.await(5, TimeUnit.SECONDS))
                assertTrue(reply.toString(), reply!!.getJSONObject("result").getBoolean("ok"))
                assertNull(ShadowAlertDialog.getLatestAlertDialog())
            }
            assertFalse(store.workerEnabled())
        } finally { bridge.close() }
    }
    @Test fun checkNowReturnsRunCountersRatherThanQueuedStatus() {
        val store = store()
        val activity = Robolectric.buildActivity(Activity::class.java).setup().get()
        val bridge = DposAndroidBridge(activity, store) { JSONObject() }
        try {
            val result = JSONObject(bridge.checkNow())
            assertTrue(result.toString(), result.has("accountsChecked"))
            assertEquals(0, result.getInt("accountsChecked"))
            assertNotEquals("queued", result.optString("status"))
        } finally { bridge.close() }
    }
    @Test fun disablingNeverWaitsForTheNetworkExecutor() {
        val store = store()
        val activity = Robolectric.buildActivity(Activity::class.java).setup().get()
        val bridge = DposAndroidBridge(activity, store) { JSONObject() }
        bridge.close() // Closed executor proves revocations do not enter the RPC queue.
        for ((method, payload) in listOf(
            "syncAutoUpvoterSettings" to JSONObject("""{"accounts":[{"chainId":"golos","account":"alice","enabled":false}]}"""),
            "syncVizSelfAwardSettings" to JSONObject("""{"account":"alice","enabled":false}"""),
            "importWorkerSettings" to JSONObject("""{"chainId":"golos","account":"alice","enableNotifications":false}""")
        )) {
            var reply: JSONObject? = null
            bridge.dispatch(BridgeRequest(method, method, payload)) { reply = it }
            assertTrue(reply.toString(), reply!!.getJSONObject("result").getBoolean("ok"))
        }
        assertTrue(store.activeAccounts().isEmpty())
        assertFalse(store.workerEnabled())
    }
}
