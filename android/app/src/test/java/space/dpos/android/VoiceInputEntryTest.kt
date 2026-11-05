package space.dpos.android

import android.app.Activity
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import space.dpos.android.bridge.DposAndroidBridge

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [28])
class VoiceInputEntryTest {
    @Test fun realMainActivityRoutesMicrophoneDenialWithoutStartingService() {
        val controller = Robolectric.buildActivity(space.dpos.android.ui.MainActivity::class.java).setup()
        val activity = controller.get()
        val field = activity.javaClass.getDeclaredField("androidBridge").apply { isAccessible = true }
        val bridge = field.get(activity) as DposAndroidBridge
        var response: JSONObject? = null
        bridge.dispatch(space.dpos.android.bridge.BridgeRequest("main-denial", "voiceStart", JSONObject())) { response = it }
        org.robolectric.Shadows.shadowOf(android.os.Looper.getMainLooper()).idle()
        assertArrayEquals(arrayOf(android.Manifest.permission.RECORD_AUDIO), org.robolectric.Shadows.shadowOf(activity).lastRequestedPermission.requestedPermissions)
        activity.onRequestPermissionsResult(space.dpos.android.voice.VoicePermissionController.REQUEST, arrayOf(android.Manifest.permission.RECORD_AUDIO), intArrayOf(android.content.pm.PackageManager.PERMISSION_DENIED))
        assertEquals("microphone_permission", response!!.getString("errorCode"))
        assertNull(org.robolectric.Shadows.shadowOf(activity.application).nextStartedService)
        controller.pause().stop().destroy()
    }
    @Test fun capabilityIsAdvertisedByRealBridge() {
        val activity = Robolectric.buildActivity(Activity::class.java).setup().get()
        val bridge = DposAndroidBridge(activity, statusProvider = { JSONObject() })
        assertTrue(JSONObject(bridge.getAppInfo()).optBoolean("voiceInput"))
        assertTrue(JSONObject(bridge.getAppInfo()).optBoolean("titleSuggestions"))
        bridge.close()
        activity.finish()
    }
}
