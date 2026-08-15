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
import android.widget.Toast
import androidx.webkit.WebSettingsCompat
import androidx.webkit.WebViewFeature
import org.json.JSONArray
import org.json.JSONObject
import space.dpos.android.BuildConfig
import space.dpos.android.bridge.DposAndroidBridge
import space.dpos.android.core.RoutePolicy
import space.dpos.android.notifications.NotificationHelper
import space.dpos.android.runtime.WorkerSettingsCodec
import space.dpos.android.storage.WorkerStore
import space.dpos.android.upvoter.GrapheneChainSpecs
import space.dpos.android.worker.DposForegroundService

class MainActivity : Activity() {
    private lateinit var webView: WebView
    private var fileChooserCallback: ValueCallback<Array<Uri>>? = null
    private var runtimeCacheRefreshPending = false
    private var runtimeCacheRefreshInjected = false

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        title = "DPoS Space"
        NotificationHelper.ensureChannels(this)
        requestNotificationsIfNeeded()
        webView = WebView(this)
        runtimeCacheRefreshPending = shouldRefreshRuntimeCache()
        if (runtimeCacheRefreshPending) webView.clearCache(true)
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

            override fun onPageFinished(view: WebView, url: String) {
                super.onPageFinished(view, url)
                refreshRuntimeCachesAfterAppUpdate(view, url)
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

    private fun shouldRefreshRuntimeCache(): Boolean {
        val prefs = getSharedPreferences("dpos_android_runtime", MODE_PRIVATE)
        val seenVersion = prefs.getInt("runtime_cache_version", -1)
        val currentVersion = BuildConfig.VERSION_CODE
        if (seenVersion == currentVersion) return false
        prefs.edit().putInt("runtime_cache_version", currentVersion).apply()
        return true
    }

    private fun refreshRuntimeCachesAfterAppUpdate(view: WebView, url: String) {
        if (!runtimeCacheRefreshPending || runtimeCacheRefreshInjected) return
        if (!url.startsWith(BuildConfig.DPOS_WEB_URL)) return
        runtimeCacheRefreshInjected = true
        Toast.makeText(this, "DPoS Space обновляет кэш страницы", Toast.LENGTH_SHORT).show()
        view.evaluateJavascript(
            """
            (function() {
              var done = function() {
                var target = location.pathname + '?android-cache-bust=' + Date.now() + location.hash;
                location.replace(target);
              };
              var clearCaches = (window.caches && caches.keys)
                ? caches.keys().then(function(keys) {
                    return Promise.all(keys.filter(function(key) {
                      return key.indexOf('dpos-space-v3-') === 0;
                    }).map(function(key) { return caches.delete(key); }));
                  })
                : Promise.resolve();
              var updateServiceWorkers = (navigator.serviceWorker && navigator.serviceWorker.getRegistrations)
                ? navigator.serviceWorker.getRegistrations().then(function(registrations) {
                    return Promise.all(registrations.map(function(registration) {
                      return registration.update().catch(function() {}).then(function() {
                        return registration.unregister().catch(function() {});
                      });
                    }));
                  })
                : Promise.resolve();
              Promise.all([clearCaches, updateServiceWorkers]).then(done, done);
            })();
            """.trimIndent(),
            null
        )
        runtimeCacheRefreshPending = false
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
            .put("accounts", JSONArray(store.activeAccounts().map { account ->
                JSONObject()
                    .put("chainId", account.chainId)
                    .put("account", account.account)
                    .put("notifications", store.notificationEnabled(account.chainId, account.account))
                    .put("autoUpvoter", store.autoUpvoterEnabled(account.chainId, account.account))
                    .put("vizSelfAward", store.vizSelfAwardEnabled(account.chainId, account.account))
                    .put("autoStart", store.autoStartEnabled(account.chainId, account.account))
                    .put("hasPostingKey", store.hasPostingKey(account.chainId, account.account))
                    .put("hasRegularKey", store.hasRegularKey(account.chainId, account.account))
            }))
            .put("autoUpvoterFeed", store.exportAutoUpvoterFeed())
            .put("appVersionName", BuildConfig.VERSION_NAME)
            .put("appVersionCode", BuildConfig.VERSION_CODE)
            .put("vizBroadcastMethod", if (GrapheneChainSpecs.require("viz").asyncBroadcastOnly) "broadcast_transaction" else "broadcast_transaction_synchronous")
            .put("webUrl", BuildConfig.DPOS_WEB_URL)
            .put("permissionNotifications", NotificationHelper.canPost(this))
            .put("batteryOptimizationWarning", true)
            .toString()
    }

    companion object {
        private const val FILE_CHOOSER_REQUEST_CODE = 2001
    }
}
