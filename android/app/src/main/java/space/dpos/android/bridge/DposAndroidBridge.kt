package space.dpos.android.bridge

import android.app.Activity
import android.app.AlertDialog
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.content.ContextCompat
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import org.json.JSONObject
import space.dpos.android.BuildConfig
import space.dpos.android.core.PayloadSanitizer
import space.dpos.android.core.RoutePolicy
import space.dpos.android.diagnostics.DiagnosticReportBuilder
import space.dpos.android.decimal.DecimalNativeSupport
import space.dpos.android.decimal.HttpDecimalBroadcaster
import space.dpos.android.decimal.DecimalTransferCodec
import space.dpos.android.minter.HttpMinterBroadcaster
import space.dpos.android.minter.MinterNativeSupport
import space.dpos.android.minter.MinterTransferCodec
import space.dpos.android.notifications.NotificationHelper
import space.dpos.android.notifications.NotificationInbox
import space.dpos.android.runtime.SecureKeyImportCodec
import space.dpos.android.runtime.WorkerSettingsCodec
import space.dpos.android.storage.WorkerStore
import space.dpos.android.storage.AutoUpvoterGrantState
import space.dpos.android.worker.DposForegroundService
import space.dpos.android.worker.DposPeriodicWorker
import space.dpos.android.worker.DposWorkerRunner
import space.dpos.android.worker.WorkerCancellation
import space.dpos.android.upvoter.FallbackGrapheneRpcClient
import space.dpos.android.upvoter.GrapheneChainSpecs
import space.dpos.android.upvoter.GrapheneVoteSigner
import space.dpos.android.upvoter.HttpGrapheneRpcClient
import space.dpos.android.upvoter.VoteOperation
import space.dpos.android.upvoter.VoteRuntime
import java.util.concurrent.TimeUnit
import java.util.concurrent.Executors

class DposAndroidBridge(
    private val activity: Activity,
    private val store: WorkerStore = WorkerStore(activity.applicationContext),
    private val diagnosticSaver: ((String, (JSONObject) -> Unit) -> Unit)? = null,
    private val statusProvider: () -> JSONObject
) {
    private val rpcExecutor = Executors.newSingleThreadExecutor()


    fun notify(title: String?, body: String?, tag: String?, route: String?) {
        activity.runOnUiThread {
            NotificationHelper.showEvent(activity, title, body, tag, RoutePolicy.sanitizeRoute(route))
        }
    }

    fun getAppInfo(): String = JSONObject()
        .put("platform", "android")
        .put("appId", BuildConfig.APPLICATION_ID)
        .put("versionName", BuildConfig.VERSION_NAME)
        .put("versionCode", BuildConfig.VERSION_CODE)
        .put("webUrl", BuildConfig.DPOS_WEB_URL)
        .put("androidSdk", Build.VERSION.SDK_INT)
        .put("bridgeVersion", BridgeTransportPolicy.BRIDGE_VERSION)
        .put("diagnosticLogExport", true)
        .put("notificationInbox", true)
        .toString()

    fun getWorkerStatus(): String = statusProvider().toString()

    fun getNotificationInbox(): String = NotificationInbox(activity).snapshot().toJson().toString()

    fun markAllNotificationsRead(): String = NotificationHelper.markAllRead(activity).toJson().toString()

    fun importWorkerSettings(json: String?): String {
        val decision = WorkerSettingsCodec.decodeImport(json)
        if (decision.accepted) {
            if ((decision.updateNotifications && !decision.enableNotifications) ||
                (decision.updateAutoUpvoter && !decision.enableAutoUpvoter) ||
                (decision.updateVizSelfAward && !decision.enableVizSelfAward)) WorkerCancellation.cancelAll()
            store.importDecision(decision)
        }
        return WorkerSettingsCodec.decisionJson(decision)
    }

    fun migrateGolosDonateSettings(json: String?): String {
        val obj = JSONObject(json.orEmpty())
        return store.golosDonateMigrationStatus(obj.optString("account"), obj.optString("pool")).toString()
    }

    fun syncVizSelfAwardSettings(json: String?): String {
        return try {
            val obj = JSONObject(json.orEmpty())
            if (!obj.optBoolean("explicitConsent", false)) throw IllegalArgumentException("explicit opt-in is required before Android worker syncs VIZ self-award settings")
            val account = obj.optString("account").trim().removePrefix("@").lowercase()
            if (!Regex("^[a-z0-9.-]{3,32}$").matches(account)) throw IllegalArgumentException("invalid VIZ account name")
            val enabled = obj.optBoolean("enabled", false)
            val autoStart = obj.optBoolean("autoStart", false)
            val rawMin = obj.optInt("minEnergy", 9500)
            val minEnergy = (if (rawMin in 1..100) rawMin * 100 else rawMin).coerceIn(0, 9999)
            if (!enabled) WorkerCancellation.cancelAll()
            store.syncVizSelfAward(account, enabled, autoStart, minEnergy)
            JSONObject()
                .put("ok", true)
                .put("status", "synced")
                .put("chainId", "viz")
                .put("account", account)
                .put("enabled", enabled)
                .put("autoStart", autoStart)
                .put("minEnergy", minEnergy)
                .toString()
        } catch (e: Exception) {
            JSONObject().put("ok", false).put("status", "sync_error").put("reason", PayloadSanitizer.text(e.message, 300)).toString()
        }
    }

    fun importSecureKey(json: String?): String {
        val decision = SecureKeyImportCodec.decode(json)
        val ref = decision.keyRef
        if (decision.accepted && ref != null) {
            store.saveEncryptedKeyRef(ref, decision.secret)
        }
        return SecureKeyImportCodec.resultJson(decision, hasKey = ref?.let { store.hasEncryptedKey(it) } ?: false)
    }

    fun syncAutoUpvoterSettings(json: String?): String = try {
        val obj = JSONObject(json.orEmpty())
        if (!obj.optBoolean("explicitConsent", false)) throw IllegalArgumentException("explicit consent is required")
        val rows = obj.optJSONArray("accounts") ?: throw IllegalArgumentException("accounts must be an array")
        val states = (0 until rows.length()).map { index ->
            val row = rows.optJSONObject(index) ?: throw IllegalArgumentException("account row must be an object")
            val chain = row.optString("chainId").trim().lowercase()
            val account = row.optString("account").trim().removePrefix("@").lowercase()
            if (chain !in GrapheneChainSpecs.supportedNativeVoteChains) throw IllegalArgumentException("unsupported native upvoter chain")
            if (!Regex("^[a-z0-9.-]{3,32}$").matches(account)) throw IllegalArgumentException("invalid account name")
            AutoUpvoterGrantState(chain, account, row.optBoolean("enabled", false), row.optBoolean("removeGrant", false))
        }
        if (states.any { !it.enabled || it.removeGrant }) WorkerCancellation.cancelAll()
        store.syncAutoUpvoterGrants(states)
        JSONObject().put("ok", true).put("status", "synced_full_state").put("accounts", states.size).toString()
    } catch (e: Exception) {
        JSONObject().put("ok", false).put("status", "sync_error").put("reason", PayloadSanitizer.text(e.message, 300)).toString()
    }

    fun startWorker(): String {
        WorkerCancellation.cancelAll()
        store.setWorkerEnabled(true)
        schedulePeriodicChecks(store.intervalMinutes())
        val intent = Intent(activity, DposForegroundService::class.java).setAction(DposForegroundService.ACTION_START)
        ContextCompat.startForegroundService(activity, intent)
        return JSONObject().put("ok", true).put("status", "starting").toString()
    }

    fun stopWorker(): String {
        WorkerCancellation.cancelAll()
        store.setWorkerEnabled(false)
        WorkManager.getInstance(activity.applicationContext).cancelUniqueWork(DposPeriodicWorker.UNIQUE_WORK)
        val intent = Intent(activity, DposForegroundService::class.java).setAction(DposForegroundService.ACTION_STOP)
        activity.startService(intent)
        return JSONObject().put("ok", true).put("status", "stopping").toString()
    }

    fun checkNow(): String {
        return try {
            DposWorkerRunner(activity.applicationContext).runOnce(reason = "manual").toJson().toString()
        } catch (e: Exception) {
            store.setLastError(e.message)
            store.appendLog("manual check error: ${e.message}", "error")
            JSONObject()
                .put("ok", false)
                .put("status", "check_error")
                .put("reason", PayloadSanitizer.text(e.message, 300))
                .toString()
        }
    }

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
            val rpc = FallbackGrapheneRpcClient(spec.rpcEndpoints.map { endpoint -> HttpGrapheneRpcClient(spec, endpoint) })
            VoteRuntime(rpc, signer = GrapheneVoteSigner(spec)).previewUnsigned(op).toString()
        } catch (e: Exception) {
            JSONObject().put("ok", false).put("status", "preview_error").put("reason", PayloadSanitizer.text(e.message, 300)).put("broadcasted", false).toString()
        }
    }

    fun previewMinterTransfer(json: String?): String {
        return try {
            val request = MinterTransferCodec.decode(json)
            MinterNativeSupport.previewUnsignedTransfer(request).toString()
        } catch (e: Exception) {
            JSONObject().put("ok", false).put("status", "preview_error").put("reason", PayloadSanitizer.text(e.message, 300)).put("chainId", "minter").put("broadcasted", false).toString()
        }
    }

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

    fun previewDecimalTransfer(json: String?): String {
        return try {
            val request = DecimalTransferCodec.decode(json)
            DecimalNativeSupport.previewUnsignedTransfer(request).toString()
        } catch (e: Exception) {
            JSONObject().put("ok", false).put("status", "preview_error").put("reason", PayloadSanitizer.text(e.message, 300)).put("chainId", "decimal").put("broadcasted", false).toString()
        }
    }

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

    fun openBatterySettings(): String {
        val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:${activity.packageName}"))
        activity.startActivity(intent)
        return JSONObject().put("ok", true).toString()
    }

    fun exportWorkerLogs(): String = JSONObject()
        .put("ok", true)
        .put("logs", PayloadSanitizer.redactLog(store.exportLogs()).takeLast(8000))
        .toString()

    fun getDiagnosticReport(): String = JSONObject()
        .put("ok", true)
        .put("report", DiagnosticReportBuilder.build(store, BuildConfig.VERSION_NAME, BuildConfig.VERSION_CODE))
        .toString()

    fun dispatch(request: BridgeRequest, respond: (JSONObject) -> Unit) {
        store.appendLog("bridge request received; method=${request.method}; id=${request.id}")
        val finish: (JSONObject) -> Unit = { response ->
            store.appendLog("bridge request completed; method=${request.method}; id=${request.id}; ok=${response.optBoolean("ok", false)}")
            respond(response)
        }
        // Read-only report generation and the explicit save picker never queue behind network checks.
        if (request.method == "getAppInfo") {
            finish(AndroidBridgeProtocol.success(request.id, getAppInfo()))
            return
        }
        if (request.method == "getDiagnosticReport") {
            finish(AndroidBridgeProtocol.success(request.id, getDiagnosticReport()))
            return
        }
        if (request.method == "getNotificationInbox" || request.method == "markAllNotificationsRead") {
            val response = runCatching { invoke(request.method, request.payload) }.fold(
                onSuccess = { AndroidBridgeProtocol.success(request.id, it) },
                onFailure = { AndroidBridgeProtocol.failure(request.id, "native_error", it.message ?: "notification inbox error") }
            )
            finish(response)
            return
        }
        if (request.method == "saveDiagnosticLog") {
            val saver = diagnosticSaver
            if (saver == null) {
                finish(AndroidBridgeProtocol.failure(request.id, "export_unavailable", "diagnostic export is unavailable"))
                return
            }
            val webReport = request.payload.optString("webReport", "")
            val combined = DiagnosticReportBuilder.combine(
                DiagnosticReportBuilder.build(store, BuildConfig.VERSION_NAME, BuildConfig.VERSION_CODE),
                webReport
            )
            store.appendLog("bridge diagnostic save picker requested; webReportChars=${webReport.length.coerceAtMost(80_000)}")
            saver(combined) { result ->
                store.appendLog("bridge diagnostic save picker completed; ok=${result.optBoolean("ok", false)}; cancelled=${result.optBoolean("cancelled", false)}")
                finish(AndroidBridgeProtocol.success(request.id, result.toString()))
            }
            return
        }
        val startPermit = WorkerCancellation.token { true }
        if (isDisableOnly(request)) {
            // Revocation must not sit behind a network check or a queued enable action.
            val response = runCatching { synchronized(permissionLock) {
                invoke(request.method, approvedPayload(request.payload))
            } }.fold(
                onSuccess = { AndroidBridgeProtocol.success(request.id, it) },
                onFailure = { AndroidBridgeProtocol.failure(request.id, "native_error", it.message ?: "native bridge error") }
            )
            finish(response)
            return
        }
        if (request.method in SETTINGS_ACTION_METHODS) {
            // Saving/enabling these settings is the user's action and consent. Native still
            // validates every payload and supplies the internal consent bit only at this boundary.
            store.appendLog("bridge settings action; method=${request.method}; decision=validated_no_extra_dialog")
            invokeApproved(request, finish)
            return
        }
        if (request.method == "stopWorker") {
            store.appendLog("bridge permission decision; method=${request.method}; decision=stop_no_prompt")
            val response = runCatching { synchronized(permissionLock) { invoke(request.method, approvedPayload(request.payload)) } }
                .fold(
                    onSuccess = { AndroidBridgeProtocol.success(request.id, it) },
                    onFailure = { AndroidBridgeProtocol.failure(request.id, "native_error", it.message ?: "native bridge error") }
                )
            finish(response)
            return
        }
        if (NativeBridgeInteractionPolicy.requiresNativeDialog(request.method)) {
            confirmManualTransfer(request, finish)
            return
        }
        rpcExecutor.execute {
            val response = runCatching {
                if (request.method == "startWorker") synchronized(permissionLock) {
                    check(startPermit.mayContinue()) { "worker start was cancelled" }
                    invoke(request.method, request.payload)
                } else invoke(request.method, request.payload)
            }
                .fold(
                    onSuccess = { AndroidBridgeProtocol.success(request.id, it) },
                    onFailure = { AndroidBridgeProtocol.failure(request.id, "native_error", it.message ?: "native bridge error") }
                )
            finish(response)
        }
    }

    fun close() {
        rpcExecutor.shutdownNow()
    }

    private fun invoke(method: String, payload: JSONObject): String = when (method) {
        "getAppInfo" -> getAppInfo()
        "getWorkerStatus" -> getWorkerStatus()
        "importWorkerSettings" -> importWorkerSettings(payload.toString())
        "migrateGolosDonateSettings" -> migrateGolosDonateSettings(payload.toString())
        "syncVizSelfAwardSettings" -> syncVizSelfAwardSettings(payload.toString())
        "syncAutoUpvoterSettings" -> syncAutoUpvoterSettings(payload.toString())
        "importSecureKey" -> importSecureKey(payload.toString())
        "startWorker" -> startWorker()
        "stopWorker" -> stopWorker()
        "checkNow" -> checkNow()
        "previewAutoVote" -> previewAutoVote(payload.toString())
        "previewMinterTransfer" -> previewMinterTransfer(payload.toString())
        "previewDecimalTransfer" -> previewDecimalTransfer(payload.toString())
        "openBatterySettings" -> openBatterySettings()
        "exportWorkerLogs" -> exportWorkerLogs()
        "getDiagnosticReport" -> getDiagnosticReport()
        "getNotificationInbox" -> getNotificationInbox()
        "markAllNotificationsRead" -> markAllNotificationsRead()
        "notify" -> {
            notify(payload.optString("title"), payload.optString("body"), payload.optString("tag"), payload.optString("route"))
            JSONObject().put("ok", true).toString()
        }
        else -> throw IllegalArgumentException("unsupported bridge method")
    }

    private fun confirmManualTransfer(request: BridgeRequest, respond: (JSONObject) -> Unit) {
        val details = runCatching {
            if (request.method == "executeMinterTransfer") MinterNativeSupport.consentDetails(MinterTransferCodec.decode(request.payload.toString()))
            else DecimalNativeSupport.consentDetails(DecimalTransferCodec.decode(request.payload.toString()))
        }.getOrElse {
            respond(AndroidBridgeProtocol.failure(request.id, "invalid_request", it.message ?: "invalid transfer"))
            return
        }
        activity.runOnUiThread {
            var answered = false
            fun cancelOnce() {
                if (!answered) {
                    answered = true
                    store.appendLog("bridge permission decision; method=${request.method}; decision=cancelled")
                    respond(AndroidBridgeProtocol.failure(request.id, "user_cancelled", "transfer was not sent"))
                }
            }
            AlertDialog.Builder(activity)
                .setTitle("Подтвердите перевод")
                .setMessage("Отправитель: ${details.getString("sender")}\nСеть: ${details.getString("network")}\nПолучатель: ${details.getString("recipient")}\nСумма: ${details.getString("amount")}\nМакс. комиссия: ${details.getString("maxFee")}\n\nТолько после подтверждения транзакция будет подписана и отправлена.")
                .setNegativeButton("Отмена") { _, _ -> cancelOnce() }
                .setPositiveButton("Подписать и отправить") { _, _ ->
                    if (answered) return@setPositiveButton
                    answered = true
                    store.appendLog("bridge permission decision; method=${request.method}; decision=approved")
                    rpcExecutor.execute {
                        val result = runCatching {
                            if (request.method == "executeMinterTransfer") executeMinterTransfer(request.payload.toString())
                            else executeDecimalTransfer(request.payload.toString())
                        }.fold(
                            onSuccess = { AndroidBridgeProtocol.success(request.id, it) },
                            onFailure = { AndroidBridgeProtocol.failure(request.id, "native_error", it.message ?: "transfer failed") }
                        )
                        respond(result)
                    }
                }
                .setOnCancelListener { cancelOnce() }
                .show()
        }
    }

    private fun isDisableOnly(request: BridgeRequest): Boolean = when (request.method) {
        "syncVizSelfAwardSettings" -> !request.payload.optBoolean("enabled", false)
        "syncAutoUpvoterSettings" -> request.payload.optJSONArray("accounts")?.let { rows ->
            (0 until rows.length()).none { rows.optJSONObject(it)?.optBoolean("enabled", false) == true }
        } ?: false
        "importWorkerSettings" -> listOf("enableNotifications", "enableAutoUpvoter", "enableVizSelfAward").let { fields ->
            fields.any { request.payload.has(it) } && fields.none { request.payload.optBoolean(it, false) }
        }
        else -> false
    }

    private fun approvedPayload(payload: JSONObject): JSONObject =
        JSONObject(payload.toString()).put("explicitConsent", true)

    private fun applyApprovedChange(request: BridgeRequest, permit: WorkerCancellation.Token): String = synchronized(permissionLock) {
        check(permit.mayContinue()) { "permission change was cancelled" }
        invoke(request.method, approvedPayload(request.payload))
    }

    private fun invokeApproved(request: BridgeRequest, respond: (JSONObject) -> Unit) {
        val permit = WorkerCancellation.token { true }
        rpcExecutor.execute {
            val response = runCatching {
                            applyApprovedChange(request, permit)
                        }.fold(
                onSuccess = { AndroidBridgeProtocol.success(request.id, it) },
                onFailure = { AndroidBridgeProtocol.failure(request.id, "native_error", it.message ?: "native bridge error") }
            )
            respond(response)
        }
    }


    private fun schedulePeriodicChecks(intervalMinutes: Int) {
        val request = PeriodicWorkRequestBuilder<DposPeriodicWorker>(intervalMinutes.coerceAtLeast(15).toLong(), TimeUnit.MINUTES).build()
        WorkManager.getInstance(activity.applicationContext).enqueueUniquePeriodicWork(DposPeriodicWorker.UNIQUE_WORK, ExistingPeriodicWorkPolicy.UPDATE, request)
        store.setNextTick(System.currentTimeMillis() + intervalMinutes.coerceAtLeast(15) * 60_000L)
    }

    private companion object {
        val permissionLock = Any()
        val SETTINGS_ACTION_METHODS = setOf(
            "importWorkerSettings",
            "migrateGolosDonateSettings",
            "syncAutoUpvoterSettings",
            "syncVizSelfAwardSettings",
            "importSecureKey"
        )

    }
}
