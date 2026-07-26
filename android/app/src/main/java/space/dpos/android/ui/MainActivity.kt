package space.dpos.android.ui

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.webkit.WebSettingsCompat
import androidx.webkit.WebViewFeature
import org.json.JSONObject
import space.dpos.android.BuildConfig
import space.dpos.android.bridge.DposAndroidBridge
import space.dpos.android.core.RoutePolicy
import space.dpos.android.notifications.NotificationHelper
import space.dpos.android.runtime.WorkerSettingsCodec
import space.dpos.android.storage.WorkerStore
import space.dpos.android.worker.DposForegroundService

class MainActivity : Activity() {
    private lateinit var webView: WebView
    private var fileChooserCallback: ValueCallback<Array<Uri>>? = null

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
        enableWebAuthenticationIfAvailable()
        webView.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(
                webView: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>?,
                fileChooserParams: FileChooserParams?
            ): Boolean {
                fileChooserCallback?.onReceiveValue(null)
                fileChooserCallback = filePathCallback
                val intent = try {
                    fileChooserParams?.createIntent() ?: Intent(Intent.ACTION_GET_CONTENT).apply {
                        addCategory(Intent.CATEGORY_OPENABLE)
                        type = "*/*"
                    }
                } catch (_: Exception) {
                    Intent(Intent.ACTION_GET_CONTENT).apply {
                        addCategory(Intent.CATEGORY_OPENABLE)
                        type = "*/*"
                    }
                }
                return try {
                    startActivityForResult(intent, FILE_CHOOSER_REQUEST_CODE)
                    true
                } catch (_: ActivityNotFoundException) {
                    fileChooserCallback?.onReceiveValue(null)
                    fileChooserCallback = null
                    false
                }
            }
        }
        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, url: String): Boolean {
                return !url.startsWith(BuildConfig.DPOS_WEB_URL)
            }
        }
        webView.addJavascriptInterface(DposAndroidBridge(this) { JSONObject(workerStatusString()) }, "DposAndroid")
        val route = intent.getStringExtra(NotificationHelper.EXTRA_ROUTE)
        webView.loadUrl(RoutePolicy.toLiveUrl(route))
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        val route = intent.getStringExtra(NotificationHelper.EXTRA_ROUTE)
        webView.loadUrl(RoutePolicy.toLiveUrl(route))
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        if (requestCode == FILE_CHOOSER_REQUEST_CODE) {
            val callback = fileChooserCallback
            fileChooserCallback = null
            callback?.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultCode, data))
            return
        }
        super.onActivityResult(requestCode, resultCode, data)
    }

    override fun onDestroy() {
        fileChooserCallback?.onReceiveValue(null)
        fileChooserCallback = null
        super.onDestroy()
    }

    private fun requestNotificationsIfNeeded() {
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 1001)
        }
    }

    private fun enableWebAuthenticationIfAvailable() {
        if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_AUTHENTICATION)) {
            WebSettingsCompat.setWebAuthenticationSupport(
                webView.settings,
                WebSettingsCompat.WEB_AUTHENTICATION_SUPPORT_FOR_APP
            )
        }
    }

    private fun workerStatusString(): String {
        val store = WorkerStore(this)
        val base = JSONObject(WorkerSettingsCodec.statusJson(
            running = DposForegroundService.isRunning,
            workerEnabled = store.workerEnabled(),
            activeAccounts = store.activeAccounts().size,
            lastTick = store.lastTick(),
            nextTick = store.nextTick(),
            lastError = store.lastError(),
            logs = store.exportLogs()
        ))
        return base
            .put("webUrl", BuildConfig.DPOS_WEB_URL)
            .put("permissionNotifications", NotificationHelper.canPost(this))
            .put("batteryOptimizationWarning", true)
            .toString()
    }

    companion object {
        private const val FILE_CHOOSER_REQUEST_CODE = 2001
    }
}
