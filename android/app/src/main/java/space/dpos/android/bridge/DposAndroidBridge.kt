package space.dpos.android.bridge

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.webkit.JavascriptInterface
import org.json.JSONObject
import space.dpos.android.BuildConfig
import space.dpos.android.core.PayloadSanitizer
import space.dpos.android.core.RoutePolicy
import space.dpos.android.notifications.NotificationHelper
import space.dpos.android.storage.WorkerStore

class DposAndroidBridge(private val activity: Activity, private val statusProvider: () -> JSONObject) {
    private val store = WorkerStore(activity.applicationContext)

    @JavascriptInterface
    fun notify(title: String?, body: String?, tag: String?, route: String?) {
        activity.runOnUiThread {
            NotificationHelper.showEvent(activity, title, body, tag, RoutePolicy.sanitizeRoute(route))
        }
    }

    @JavascriptInterface
    fun getAppInfo(): String = JSONObject()
        .put("platform", "android")
        .put("appId", BuildConfig.APPLICATION_ID)
        .put("versionName", BuildConfig.VERSION_NAME)
        .put("versionCode", BuildConfig.VERSION_CODE)
        .put("webUrl", BuildConfig.DPOS_WEB_URL)
        .put("androidSdk", Build.VERSION.SDK_INT)
        .toString()

    @JavascriptInterface
    fun getWorkerStatus(): String = statusProvider().toString()

    @JavascriptInterface
    fun openBatterySettings(): String {
        val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:${activity.packageName}"))
        activity.startActivity(intent)
        return JSONObject().put("ok", true).toString()
    }

    @JavascriptInterface
    fun exportWorkerLogs(): String = JSONObject()
        .put("ok", true)
        .put("logs", PayloadSanitizer.text(store.exportLogs(), 8000))
        .toString()
}
