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
import android.os.PowerManager
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.webkit.WebSettingsCompat
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import org.json.JSONArray
import org.json.JSONObject
import space.dpos.android.BuildConfig
import space.dpos.android.DposApplication
import space.dpos.android.bridge.DposAndroidBridge
import space.dpos.android.bridge.AndroidBridgeProtocol
import space.dpos.android.bridge.BridgeTransportPolicy
import space.dpos.android.core.PayloadSanitizer
import space.dpos.android.core.RoutePolicy
import space.dpos.android.notifications.NotificationHelper
import space.dpos.android.runtime.WorkerSettingsCodec
import space.dpos.android.storage.WorkerStore
import space.dpos.android.upvoter.GrapheneChainSpecs
import space.dpos.android.worker.DposForegroundService
import space.dpos.android.update.NativeUpdater
import java.nio.charset.StandardCharsets

class MainActivity : Activity() {
    private lateinit var webView: WebView
    private lateinit var androidBridge: DposAndroidBridge
    private var fileChooserCallback: ValueCallback<Array<Uri>>? = null
    private var diagnosticExport: PendingDiagnosticExport? = null
    private var runtimeCacheRefreshPending = false
    private var runtimeCacheRefreshInjected = false
    private lateinit var nativeUpdater: NativeUpdater

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        nativeUpdater = NativeUpdater(this)
        title = "DPoS Space"
        NotificationHelper.ensureChannels(this)
        requestNotificationsIfNeeded()
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)
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
        androidBridge = DposAndroidBridge(
            this,
            statusProvider = { JSONObject(workerStatusString()) },
            diagnosticSaver = ::requestDiagnosticSave
        )
        installOriginScopedBridge()
        val route = intent.getStringExtra(NotificationHelper.EXTRA_ROUTE)
        webView.loadUrl(RoutePolicy.toLiveUrl(route))
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        val route = intent.getStringExtra(NotificationHelper.EXTRA_ROUTE)
        webView.loadUrl(RoutePolicy.toLiveUrl(route))
    }

    override fun onStart() {
        super.onStart()
        DposApplication.resumeEnabledWorker(this, "app foregrounded")
        nativeUpdater.check()
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        if (requestCode == DIAGNOSTIC_EXPORT_REQUEST_CODE) {
            val pending = diagnosticExport
            diagnosticExport = null
            if (pending == null) return
            val uri = data?.data
            if (resultCode != RESULT_OK || uri == null) {
                pending.callback(JSONObject().put("ok", false).put("cancelled", true))
                return
            }
            val result = runCatching {
                contentResolver.openOutputStream(uri, "w")?.use { output ->
                    output.write(pending.report.toByteArray(StandardCharsets.UTF_8))
                    output.flush()
                } ?: throw IllegalStateException("selected document could not be opened")
                JSONObject().put("ok", true).put("filename", pending.filename)
            }.getOrElse { error ->
                JSONObject().put("ok", false).put("error", PayloadSanitizer.text(error.message, 240))
            }
            pending.callback(result)
            return
        }
        if (requestCode == FILE_CHOOSER_REQUEST_CODE) {
            val callback = fileChooserCallback
            fileChooserCallback = null
            callback?.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultCode, data))
            return
        }
        super.onActivityResult(requestCode, resultCode, data)
    }

    override fun onDestroy() {
        nativeUpdater.close()
        fileChooserCallback?.onReceiveValue(null)
        fileChooserCallback = null
        diagnosticExport?.callback(JSONObject().put("ok", false).put("cancelled", true))
        diagnosticExport = null
        if (::androidBridge.isInitialized) androidBridge.close()
        super.onDestroy()
    }

    private fun installOriginScopedBridge() {
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) return
        WebViewCompat.addWebMessageListener(
            webView,
            BridgeTransportPolicy.JS_OBJECT_NAME,
            setOf(BridgeTransportPolicy.ALLOWED_ORIGIN)
        ) { _, message, sourceOrigin, isMainFrame, replyProxy ->
            val origin = sourceOrigin.toString()
            if (!BridgeTransportPolicy.accepts(origin, isMainFrame)) return@addWebMessageListener
            val raw = message.data ?: return@addWebMessageListener
            val request = runCatching { AndroidBridgeProtocol.decodeRequest(raw) }.getOrElse { error ->
                val id = runCatching { JSONObject(raw).optString("id") }.getOrDefault("").takeIf { it.isNotBlank() } ?: "invalid"
                replyProxy.postMessage(AndroidBridgeProtocol.failure(id, "invalid_request", error.message ?: "invalid request").toString())
                return@addWebMessageListener
            }
            androidBridge.dispatch(request) { response ->
                runOnUiThread { replyProxy.postMessage(response.toString()) }
            }
        }
    }

    private fun requestDiagnosticSave(report: String, callback: (JSONObject) -> Unit) {
        runOnUiThread {
            if (diagnosticExport != null) {
                callback(JSONObject().put("ok", false).put("reason", "A diagnostic save is already in progress"))
                return@runOnUiThread
            }
            val filename = "dpos-space-diagnostics-${System.currentTimeMillis()}.log"
            diagnosticExport = PendingDiagnosticExport(report, filename, callback)
            val intent = Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
                addCategory(Intent.CATEGORY_OPENABLE)
                type = "text/plain"
                putExtra(Intent.EXTRA_TITLE, filename)
            }
            try {
                startActivityForResult(intent, DIAGNOSTIC_EXPORT_REQUEST_CODE)
            } catch (error: ActivityNotFoundException) {
                diagnosticExport = null
                callback(JSONObject().put("ok", false).put("error", PayloadSanitizer.text(error.message, 240)))
            }
        }
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
            .put("lastRunSummary", store.exportLastRunSummary() ?: JSONObject.NULL)
            .put("appVersionName", BuildConfig.VERSION_NAME)
            .put("appVersionCode", BuildConfig.VERSION_CODE)
            .put("bridgeVersion", BridgeTransportPolicy.BRIDGE_VERSION)
            .put("vizBroadcastMethod", if (GrapheneChainSpecs.require("viz").asyncBroadcastOnly) "broadcast_transaction" else "broadcast_transaction_synchronous")
            .put("webUrl", BuildConfig.DPOS_WEB_URL)
            .put("permissionNotifications", NotificationHelper.canPost(this))
            .put("batteryOptimizationWarning", !isIgnoringBatteryOptimizations())
            .put("batteryOptimizationHint", "Для стабильной фоновой проверки после блокировки экрана включите режим батареи: Без ограничений / Не оптимизировать / Разрешить работу в фоне.")
            .toString()
    }

    private fun isIgnoringBatteryOptimizations(): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return true
        val powerManager = getSystemService(POWER_SERVICE) as? PowerManager
        return powerManager?.isIgnoringBatteryOptimizations(packageName) == true
    }

    companion object {
        private const val FILE_CHOOSER_REQUEST_CODE = 2001
        private const val DIAGNOSTIC_EXPORT_REQUEST_CODE = 2002
    }

    private data class PendingDiagnosticExport(
        val report: String,
        val filename: String,
        val callback: (JSONObject) -> Unit
    )
}
