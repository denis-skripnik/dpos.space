package space.dpos.android.bridge

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.webkit.JavascriptInterface
import androidx.core.content.ContextCompat
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import org.json.JSONObject
import space.dpos.android.BuildConfig
import space.dpos.android.core.PayloadSanitizer
import space.dpos.android.core.RoutePolicy
import space.dpos.android.decimal.DecimalNativeSupport
import space.dpos.android.decimal.HttpDecimalBroadcaster
import space.dpos.android.decimal.DecimalTransferCodec
import space.dpos.android.minter.HttpMinterBroadcaster
import space.dpos.android.minter.MinterNativeSupport
import space.dpos.android.minter.MinterTransferCodec
import space.dpos.android.notifications.NotificationHelper
import space.dpos.android.runtime.SecureKeyImportCodec
import space.dpos.android.runtime.WorkerSettingsCodec
import space.dpos.android.storage.WorkerStore
import space.dpos.android.worker.DposForegroundService
import space.dpos.android.worker.DposPeriodicWorker
import space.dpos.android.upvoter.GrapheneChainSpecs
import space.dpos.android.upvoter.GrapheneVoteSigner
import space.dpos.android.upvoter.HttpGrapheneRpcClient
import space.dpos.android.upvoter.VoteOperation
import space.dpos.android.upvoter.VoteRuntime
import java.util.concurrent.TimeUnit

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
    fun importWorkerSettings(json: String?): String {
        val decision = WorkerSettingsCodec.decodeImport(json)
        if (decision.accepted) {
            store.importDecision(decision)
            schedulePeriodicChecks(decision.intervalMinutes)
        }
        return WorkerSettingsCodec.decisionJson(decision)
    }

    @JavascriptInterface
    fun importSecureKey(json: String?): String {
        val decision = SecureKeyImportCodec.decode(json)
        val ref = decision.keyRef
        if (decision.accepted && ref != null) {
            store.saveEncryptedKeyRef(ref, decision.secret)
        }
        return SecureKeyImportCodec.resultJson(decision, hasKey = ref?.let { store.hasEncryptedKey(it) } ?: false)
    }

    @JavascriptInterface
    fun startWorker(): String {
        store.setWorkerEnabled(true)
        schedulePeriodicChecks(store.intervalMinutes())
        val intent = Intent(activity, DposForegroundService::class.java).setAction(DposForegroundService.ACTION_START)
        ContextCompat.startForegroundService(activity, intent)
        return JSONObject().put("ok", true).put("status", "starting").toString()
    }

    @JavascriptInterface
    fun stopWorker(): String {
        store.setWorkerEnabled(false)
        WorkManager.getInstance(activity.applicationContext).cancelUniqueWork(DposPeriodicWorker.UNIQUE_WORK)
        val intent = Intent(activity, DposForegroundService::class.java).setAction(DposForegroundService.ACTION_STOP)
        activity.startService(intent)
        return JSONObject().put("ok", true).put("status", "stopping").toString()
    }

    @JavascriptInterface
    fun checkNow(): String {
        WorkManager.getInstance(activity.applicationContext).enqueue(OneTimeWorkRequestBuilder<DposPeriodicWorker>().build())
        return JSONObject().put("ok", true).put("status", "queued").toString()
    }

    @JavascriptInterface
    fun previewAutoVote(json: String?): String {
        return try {
            val obj = JSONObject(json.orEmpty())
            val chain = obj.optString("chainId", "golos").trim().lowercase()
            val account = obj.optString("voter", obj.optString("account")).trim().removePrefix("@").lowercase()
            val op = VoteOperation(
                chainId = chain,
                voter = account,
                author = obj.optString("author").trim().removePrefix("@").lowercase(),
                permlink = obj.optString("permlink").trim(),
                weight = obj.optInt("weight", 10000)
            )
            val spec = GrapheneChainSpecs.requireVote(chain)
            val keyRef = store.defaultPostingKeyRef(chain, account)
            val key = store.readPostingKey(chain, account)
            val result = VoteRuntime(HttpGrapheneRpcClient(spec), signer = GrapheneVoteSigner(spec)).preview(op, keyRef, key)
            result.toJson().put("broadcasted", false).toString()
        } catch (e: Exception) {
            JSONObject().put("ok", false).put("status", "preview_error").put("reason", PayloadSanitizer.text(e.message, 300)).put("broadcasted", false).toString()
        }
    }

    @JavascriptInterface
    fun previewMinterTransfer(json: String?): String {
        return try {
            val request = MinterTransferCodec.decode(json)
            val from = request.from ?: throw IllegalArgumentException("from must be supplied for native Minter preview so Android can select the matching secure seed ref")
            val keyRef = MinterNativeSupport.defaultSeedRef(from)
            val seed = store.readEncryptedKey(keyRef)
            val result = MinterNativeSupport.signTransfer(request.copy(from = from), seed.orEmpty(), previewOnly = true)
            result.toJson().put("keyRef", JSONObject().put("chainId", keyRef.chainId).put("account", keyRef.account).put("authority", keyRef.authority).put("alias", keyRef.alias)).toString()
        } catch (e: Exception) {
            JSONObject().put("ok", false).put("status", "preview_error").put("reason", PayloadSanitizer.text(e.message, 300)).put("chainId", "minter").put("broadcasted", false).toString()
        }
    }

    @JavascriptInterface
    fun executeMinterTransfer(json: String?): String {
        return try {
            val request = MinterTransferCodec.decode(json)
            val from = request.from ?: throw IllegalArgumentException("from must be supplied for native Minter execute so Android can select the matching secure seed ref")
            val keyRef = MinterNativeSupport.defaultSeedRef(from)
            val seed = store.readEncryptedKey(keyRef)
            val result = MinterNativeSupport.executeTransfer(request.copy(from = from), seed.orEmpty(), HttpMinterBroadcaster())
            result.toJson().put("keyRef", JSONObject().put("chainId", keyRef.chainId).put("account", keyRef.account).put("authority", keyRef.authority).put("alias", keyRef.alias)).toString()
        } catch (e: Exception) {
            JSONObject().put("ok", false).put("status", "broadcast_error").put("reason", PayloadSanitizer.text(e.message, 300)).put("chainId", "minter").put("broadcasted", false).toString()
        }
    }

    @JavascriptInterface
    fun previewDecimalTransfer(json: String?): String {
        return try {
            val request = DecimalTransferCodec.decode(json)
            val from = request.from ?: throw IllegalArgumentException("from must be supplied for native Decimal preview so Android can select the matching secure seed ref")
            val keyRef = DecimalNativeSupport.defaultSeedRef(from)
            val seed = store.readEncryptedKey(keyRef)
            val result = DecimalNativeSupport.previewTransfer(request.copy(from = from), seed.orEmpty())
            result.toJson().put("keyRef", JSONObject().put("chainId", keyRef.chainId).put("account", keyRef.account).put("authority", keyRef.authority).put("alias", keyRef.alias)).toString()
        } catch (e: Exception) {
            JSONObject().put("ok", false).put("status", "preview_error").put("reason", PayloadSanitizer.text(e.message, 300)).put("chainId", "decimal").put("broadcasted", false).toString()
        }
    }

    @JavascriptInterface
    fun executeDecimalTransfer(json: String?): String {
        return try {
            val request = DecimalTransferCodec.decode(json)
            val from = request.from ?: throw IllegalArgumentException("from must be supplied for native Decimal execute so Android can select the matching secure seed ref")
            val keyRef = DecimalNativeSupport.defaultSeedRef(from)
            val seed = store.readEncryptedKey(keyRef)
            val result = DecimalNativeSupport.executeTransfer(request.copy(from = from), seed.orEmpty(), HttpDecimalBroadcaster())
            result.toJson().put("keyRef", JSONObject().put("chainId", keyRef.chainId).put("account", keyRef.account).put("authority", keyRef.authority).put("alias", keyRef.alias)).toString()
        } catch (e: Exception) {
            JSONObject().put("ok", false).put("status", "broadcast_error").put("reason", PayloadSanitizer.text(e.message, 300)).put("chainId", "decimal").put("broadcasted", false).toString()
        }
    }

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

    private fun schedulePeriodicChecks(intervalMinutes: Int) {
        val request = PeriodicWorkRequestBuilder<DposPeriodicWorker>(intervalMinutes.coerceAtLeast(15).toLong(), TimeUnit.MINUTES).build()
        WorkManager.getInstance(activity.applicationContext).enqueueUniquePeriodicWork(DposPeriodicWorker.UNIQUE_WORK, ExistingPeriodicWorkPolicy.UPDATE, request)
        store.setNextTick(System.currentTimeMillis() + intervalMinutes.coerceAtLeast(15) * 60_000L)
    }
}
