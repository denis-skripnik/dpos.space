package space.dpos.android.ui

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import org.json.JSONObject
import space.dpos.android.BuildConfig
import space.dpos.android.bridge.DposAndroidBridge
import space.dpos.android.core.RoutePolicy
import space.dpos.android.notifications.NotificationHelper
import space.dpos.android.worker.DposForegroundService

class MainActivity : Activity() {
    private lateinit var webView: WebView

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        title = "DPoS Space"
        NotificationHelper.ensureChannels(this)
        requestNotificationsIfNeeded()
        webView = WebView(this)
        setContentView(webView)
        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.settings.databaseEnabled = true
        webView.settings.cacheMode = WebSettings.LOAD_DEFAULT
        webView.webChromeClient = WebChromeClient()
        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, url: String): Boolean {
                return !url.startsWith(BuildConfig.DPOS_WEB_URL)
            }
        }
        webView.addJavascriptInterface(DposAndroidBridge(this) { workerStatusJson() }, "DposAndroid")
        val route = intent.getStringExtra(NotificationHelper.EXTRA_ROUTE)
        webView.loadUrl(RoutePolicy.toLiveUrl(route))
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        val route = intent.getStringExtra(NotificationHelper.EXTRA_ROUTE)
        webView.loadUrl(RoutePolicy.toLiveUrl(route))
    }

    private fun requestNotificationsIfNeeded() {
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 1001)
        }
    }

    private fun workerStatusJson(): JSONObject = JSONObject()
        .put("running", DposForegroundService.isRunning)
        .put("webUrl", BuildConfig.DPOS_WEB_URL)
        .put("permissionNotifications", NotificationHelper.canPost(this))
        .put("status", if (DposForegroundService.isRunning) "running" else "stopped")
        .put("activeAccounts", 0)
        .put("lastTick", JSONObject.NULL)
        .put("lastError", JSONObject.NULL)
        .put("nextTick", JSONObject.NULL)
}
