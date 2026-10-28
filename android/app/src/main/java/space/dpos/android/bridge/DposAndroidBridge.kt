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
    store: WorkerStore? = null,
    private val diagnosticSaver: ((String, (JSONObject) -> Unit) -> Unit)? = null,
    private val minterBroadcaster: () -> space.dpos.android.minter.MinterBroadcaster = { HttpMinterBroadcaster() },
    private val decimalBroadcaster: () -> space.dpos.android.decimal.DecimalBroadcaster = { HttpDecimalBroadcaster() },
    private val statusProvider: () -> JSONObject
) {
    private val rpcExecutor = Executors.newSingleThreadExecutor()
    private val store by lazy { store ?: WorkerStore(activity.applicationContext) }

    private fun logAsync(message: String) {
        space.dpos.android.storage.NativeStorageQueue.execute { store.appendLog(message) }
    }


    fun notify(title: String?, body: String?, tag: String?, route: String?) {
        space.dpos.android.storage.NativeStorageQueue.execute {
            if (!closed.get()) NotificationHelper.showEvent(activity, title, body, tag, RoutePolicy.sanitizeRoute(route))
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

    fun importWorkerSettings(json: String?, cancelActive: Boolean = true): String {
        val decision = WorkerSettingsCodec.decodeImport(json)
        if (decision.accepted) {
            if (cancelActive && ((decision.updateNotifications && !decision.enableNotifications) ||
                (decision.updateAutoUpvoter && !decision.enableAutoUpvoter) ||
                (decision.updateVizSelfAward && !decision.enableVizSelfAward))) WorkerCancellation.cancelAll()
            store.importDecision(decision)
        }
        return WorkerSettingsCodec.decisionJson(decision)
    }

    fun migrateGolosDonateSettings(json: String?): String {
        val obj = JSONObject(json.orEmpty())
        return store.golosDonateMigrationStatus(obj.optString("account"), obj.optString("pool")).toString()
    }

    fun syncVizSelfAwardSettings(json: String?, cancelActive: Boolean = true): String {
        return try {
            val obj = JSONObject(json.orEmpty())
            if (!obj.optBoolean("explicitConsent", false)) throw IllegalArgumentException("explicit opt-in is required before Android worker syncs VIZ self-award settings")
            val account = obj.optString("account").trim().removePrefix("@").lowercase()
            if (!Regex("^[a-z0-9.-]{3,32}$").matches(account)) throw IllegalArgumentException("invalid VIZ account name")
            val enabled = obj.optBoolean("enabled", false)
            val autoStart = obj.optBoolean("autoStart", false)
            val rawMin = obj.optInt("minEnergy", 9500)
            val minEnergy = (if (rawMin in 1..100) rawMin * 100 else rawMin).coerceIn(0, 9999)
            if (cancelActive && !enabled) WorkerCancellation.cancelAll()
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

    fun syncAutoUpvoterSettings(json: String?, cancelActive: Boolean = true): String = try {
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
        if (cancelActive && states.any { !it.enabled || it.removeGrant }) WorkerCancellation.cancelAll()
        store.syncAutoUpvoterGrants(states)
        JSONObject().put("ok", true).put("status", "synced_full_state").put("accounts", states.size).toString()
    } catch (e: Exception) {
        JSONObject().put("ok", false).put("status", "sync_error").put("reason", PayloadSanitizer.text(e.message, 300)).toString()
    }

    fun startWorker(cancelActive: Boolean = true): String {
        if (cancelActive) WorkerCancellation.cancelAll()
        store.setWorkerEnabled(true)
        schedulePeriodicChecks(store.intervalMinutes())
        val intent = Intent(activity, DposForegroundService::class.java).setAction(DposForegroundService.ACTION_START)
        ContextCompat.startForegroundService(activity, intent)
        return JSONObject().put("ok", true).put("status", "starting").toString()
    }

    fun stopWorker(cancelActive: Boolean = true): String {
        if (cancelActive) WorkerCancellation.cancelAll()
        try {
            store.setWorkerEnabled(false)
        } finally {
            // Bootstrap can prohibit persistence, never cancellation. Do not create a
            // new service just to stop it, especially while its storage is unavailable.
            try {
                WorkManager.getInstance(activity.applicationContext).cancelUniqueWork(DposPeriodicWorker.UNIQUE_WORK)
            } finally {
                activity.stopService(Intent(activity, DposForegroundService::class.java))
            }
        }
        return JSONObject().put("ok", true).put("status", "stopping").toString()
    }

    fun checkNow(admission: WorkerCancellation.Token = WorkerCancellation.token { !closed.get() }): String {
        return try {
            DposWorkerRunner(activity.applicationContext).runOnce(reason = "manual", admission = admission).toJson().toString()
        } catch (e: Exception) {
            runCatching { store.setLastError(e.message) }
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

    fun executeMinterTransfer(json: String?, permit: WorkerCancellation.Token = WorkerCancellation.token { !closed.get() }): String {
        return try {
            val request = MinterTransferCodec.decode(json)
            val from = request.from ?: throw IllegalArgumentException("from must be supplied for native Minter execute so Android can select the matching secure seed ref")
            val keyRef = MinterNativeSupport.defaultSeedRef(from)
            val seed = store.readEncryptedKey(keyRef)
            check(permit.mayContinue()) { "transfer was cancelled" }
            val result = MinterNativeSupport.executeTransfer(request.copy(from = from), seed.orEmpty(), object : space.dpos.android.minter.MinterBroadcaster {
                override fun broadcast(signedTx: String): JSONObject {
                    val transport = minterBroadcaster()
                    // Signing can outlive Stop/disable/close. Fence the actual send,
                    // never reinterpret its outcome as cancellation after submission.
                    check(permit.mayContinue()) { "transfer was cancelled" }
                    return transport.broadcast(signedTx)
                }
            })
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

    fun executeDecimalTransfer(json: String?, permit: WorkerCancellation.Token = WorkerCancellation.token { !closed.get() }): String {
        return try {
            val request = DecimalTransferCodec.decode(json)
            val from = request.from ?: throw IllegalArgumentException("from must be supplied for native Decimal execute so Android can select the matching secure seed ref")
            val keyRef = DecimalNativeSupport.defaultSeedRef(from)
            val seed = store.readEncryptedKey(keyRef)
            check(permit.mayContinue()) { "transfer was cancelled" }
            val result = DecimalNativeSupport.executeTransfer(request.copy(from = from), seed.orEmpty(), object : space.dpos.android.decimal.DecimalBroadcaster {
                override fun broadcast(signedTx: String): JSONObject {
                    val transport = decimalBroadcaster()
                    // Signing can outlive Stop/disable/close. Fence the actual send,
                    // never reinterpret its outcome as cancellation after submission.
                    check(permit.mayContinue()) { "transfer was cancelled" }
                    return transport.broadcast(signedTx)
                }
            })
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
        val answered = java.util.concurrent.atomic.AtomicBoolean(false)
        val finish: (JSONObject) -> Unit = { response ->
            if (answered.compareAndSet(false, true)) {
                logAsync("bridge request completed; method=${request.method}; id=${request.id}; ok=${response.optBoolean("ok", false)}")
                respond(response)
            }
        }
        logAsync("bridge request received; method=${request.method}; id=${request.id}")
        // Capability/bootstrap metadata never waits for disk, status, or a network request.
        if (request.method == "getAppInfo") {
            finish(AndroidBridgeProtocol.success(request.id, getAppInfo()))
            return
        }
        val revoking = request.method == "stopWorker" || hasRevocation(request)
        val durableRevocation = if (revoking) WorkerCancellation.beginRevocation() else null
        if (request.method == "startWorker") WorkerCancellation.cancelAll()
        val permit = WorkerCancellation.token { !closed.get() }
        if (request.method == "stopWorker") {
            // Do not create a service or wait for any persistence/RPC lock to stop one.
            activity.stopService(Intent(activity, DposForegroundService::class.java))
        }
        space.dpos.android.storage.NativeStorageQueue.execute {
            val response = runCatching {
                // Revocations outlive this activity; an old queued enable/start must not.
                if (!revoking) check(!closed.get()) { "bridge request was cancelled" }
                when {
                    request.method == "saveDiagnosticLog" -> {
                        saveDiagnosticLog(request, finish)
                        return@execute
                    }
                    NativeBridgeInteractionPolicy.requiresNativeDialog(request.method) -> {
                        confirmManualTransfer(request, finish, permit)
                        return@execute
                    }
                    request.method in setOf("checkNow", "previewAutoVote") -> {
                        rpcExecutor.execute {
                            val result = runCatching {
                                check(permit.mayContinue()) { "bridge request was cancelled" }
                                if (request.method == "checkNow") checkNow(permit) else invoke(request.method, request.payload)
                            }.fold(
                                { AndroidBridgeProtocol.success(request.id, it) },
                                { AndroidBridgeProtocol.failure(request.id, "native_error", it.message ?: "native bridge error") }
                            )
                            finish(result)
                        }
                        return@execute
                    }
                    request.method in SETTINGS_ACTION_METHODS || request.method == "stopWorker" -> {
                        val result = synchronized(permissionLock) {
                            if (!revoking && request.method != "migrateGolosDonateSettings") check(permit.mayContinue()) { "permission change was cancelled" }
                            val payload = if (revoking && !permit.mayApplySettings()) revocationPayload(request) else request.payload
                            invoke(request.method, approvedPayload(payload), revocationAlreadyApplied = revoking)
                        }
                        // A structured sync_error is not proof that revocation was persisted.
                        if (!JSONObject(result).has("ok") || JSONObject(result).optBoolean("ok")) durableRevocation?.invoke()
                        AndroidBridgeProtocol.success(request.id, result)
                    }
                    request.method == "startWorker" -> synchronized(permissionLock) {
                        check(permit.mayContinue()) { "worker start was cancelled" }
                        AndroidBridgeProtocol.success(request.id, startWorker(cancelActive = false))
                    }
                    request.method == "openBatterySettings" -> {
                        activity.runOnUiThread {
                            val response = if (closed.get()) AndroidBridgeProtocol.failure(request.id, "cancelled", "activity closed")
                            else runCatching { openBatterySettings() }.fold(
                                { AndroidBridgeProtocol.success(request.id, it) },
                                { AndroidBridgeProtocol.failure(request.id, "native_error", it.message ?: "settings unavailable") }
                            )
                            finish(response)
                        }
                        return@execute
                    }
                    else -> AndroidBridgeProtocol.success(request.id, invoke(request.method, request.payload))
                }
            }.getOrElse { AndroidBridgeProtocol.failure(request.id, "native_error", it.message ?: "native bridge error") }
            finish(response)
        }
    }

    private fun saveDiagnosticLog(request: BridgeRequest, finish: (JSONObject) -> Unit) {
        val saver = diagnosticSaver ?: run {
            finish(AndroidBridgeProtocol.failure(request.id, "export_unavailable", "diagnostic export is unavailable"))
            return
        }
        val combined = DiagnosticReportBuilder.combine(
            DiagnosticReportBuilder.build(store, BuildConfig.VERSION_NAME, BuildConfig.VERSION_CODE),
            request.payload.optString("webReport", "")
        )
        activity.runOnUiThread {
            if (closed.get()) finish(AndroidBridgeProtocol.failure(request.id, "cancelled", "activity closed"))
            else try {
                saver(combined) { result -> finish(AndroidBridgeProtocol.success(request.id, result.toString())) }
            } catch (error: Exception) {
                finish(AndroidBridgeProtocol.failure(request.id, "native_error", error.message ?: "diagnostic export error"))
            }
        }
    }

    private val closed = java.util.concurrent.atomic.AtomicBoolean(false)
    private var transferDialog: AlertDialog? = null
    private var transferCancel: (() -> Unit)? = null

    fun close() {
        closed.set(true)
        activity.runOnUiThread {
            transferCancel?.invoke()
            transferCancel = null
            transferDialog?.dismiss()
            transferDialog = null
        }
        // Queued work observes the lifecycle fence and replies with cancellation; do not
        // discard queued callbacks or interrupt a transaction/checkpoint write halfway.
        rpcExecutor.shutdown()
    }

    private fun invoke(method: String, payload: JSONObject, revocationAlreadyApplied: Boolean = false): String = when (method) {
        "getAppInfo" -> getAppInfo()
        "getWorkerStatus" -> getWorkerStatus()
        "importWorkerSettings" -> importWorkerSettings(payload.toString(), cancelActive = !revocationAlreadyApplied)
        "migrateGolosDonateSettings" -> migrateGolosDonateSettings(payload.toString())
        "syncVizSelfAwardSettings" -> syncVizSelfAwardSettings(payload.toString(), cancelActive = !revocationAlreadyApplied)
        "syncAutoUpvoterSettings" -> syncAutoUpvoterSettings(payload.toString(), cancelActive = !revocationAlreadyApplied)
        "importSecureKey" -> importSecureKey(payload.toString())
        "startWorker" -> startWorker()
        "stopWorker" -> stopWorker(cancelActive = !revocationAlreadyApplied)
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

    private fun confirmManualTransfer(request: BridgeRequest, respond: (JSONObject) -> Unit,
                                      permit: WorkerCancellation.Token) {
        val details = runCatching {
            if (request.method == "executeMinterTransfer") MinterNativeSupport.consentDetails(MinterTransferCodec.decode(request.payload.toString()))
            else DecimalNativeSupport.consentDetails(DecimalTransferCodec.decode(request.payload.toString()))
        }.getOrElse {
            respond(AndroidBridgeProtocol.failure(request.id, "invalid_request", it.message ?: "invalid transfer"))
            return
        }
        activity.runOnUiThread {
            if (!permit.mayContinue()) {
                respond(AndroidBridgeProtocol.failure(request.id, "cancelled", "activity closed or request cancelled"))
                return@runOnUiThread
            }
            if (transferDialog != null) {
                respond(AndroidBridgeProtocol.failure(request.id, "busy", "transfer confirmation already open"))
                return@runOnUiThread
            }
            var answered = false
            fun cancelOnce() {
                if (!answered) {
                    answered = true
                    logAsync("bridge permission decision; method=${request.method}; decision=cancelled")
                    respond(AndroidBridgeProtocol.failure(request.id, "user_cancelled", "transfer was not sent"))
                }
            }
            transferCancel = { cancelOnce() }
            transferDialog = AlertDialog.Builder(activity)
                .setTitle("Подтвердите перевод")
                .setMessage("Отправитель: ${details.getString("sender")}\nСеть: ${details.getString("network")}\nПолучатель: ${details.getString("recipient")}\nСумма: ${details.getString("amount")}\nМакс. комиссия: ${details.getString("maxFee")}\n\nТолько после подтверждения транзакция будет подписана и отправлена.")
                .setNegativeButton("Отмена") { _, _ -> cancelOnce() }
                .setPositiveButton("Подписать и отправить") { _, _ ->
                    if (answered) return@setPositiveButton
                    answered = true
                    logAsync("bridge permission decision; method=${request.method}; decision=approved")
                    rpcExecutor.execute {
                        val result = runCatching {
                            check(permit.mayContinue()) { "transfer was cancelled" }
                            if (request.method == "executeMinterTransfer") executeMinterTransfer(request.payload.toString(), permit)
                            else executeDecimalTransfer(request.payload.toString(), permit)
                        }.fold(
                            onSuccess = { AndroidBridgeProtocol.success(request.id, it) },
                            onFailure = { AndroidBridgeProtocol.failure(request.id, "native_error", it.message ?: "transfer failed") }
                        )
                        respond(result)
                    }
                }
                .setOnCancelListener { cancelOnce() }
                .show()
                .also { dialog -> dialog.setOnDismissListener {
                    transferDialog = null
                    transferCancel = null
                } }
        }
    }

    private fun hasRevocation(request: BridgeRequest): Boolean {
        fun accountValid(value: String) = Regex("^[a-z0-9.-]{3,32}$").matches(value.trim().removePrefix("@").lowercase())
        return when (request.method) {
            "syncVizSelfAwardSettings" -> accountValid(request.payload.optString("account")) && !request.payload.optBoolean("enabled", false)
            "syncAutoUpvoterSettings" -> request.payload.optJSONArray("accounts")?.let { rows ->
                val states = (0 until rows.length()).map { rows.optJSONObject(it) }
                // This is a full replacement: omitted rows revoke too, even if every
                // supplied row is enabled. No checkpoint read is needed for admission.
                states.all { it != null && it.optString("chainId").trim().lowercase() in GrapheneChainSpecs.supportedNativeVoteChains && accountValid(it.optString("account")) }
            } ?: false
            "importWorkerSettings" -> WorkerSettingsCodec.decodeImport(approvedPayload(request.payload).toString()).let {
                it.accepted && ((it.updateNotifications && !it.enableNotifications) ||
                    (it.updateAutoUpvoter && !it.enableAutoUpvoter) || (it.updateVizSelfAward && !it.enableVizSelfAward))
            }
            else -> false
        }
    }

    /** A closed/superseded activity may persist a disable, never its mixed-in new enable. */
    private fun revocationPayload(request: BridgeRequest): JSONObject = JSONObject(request.payload.toString()).apply {
        put("autoStart", false)
        when (request.method) {
            "syncAutoUpvoterSettings" -> {
                val rows = getJSONArray("accounts")
                put("accounts", org.json.JSONArray((0 until rows.length()).map { index ->
                    JSONObject(rows.getJSONObject(index).toString()).apply {
                        val chain = optString("chainId").trim().lowercase()
                        val account = optString("account").trim().removePrefix("@").lowercase()
                        // Retain an already-current grant, never create one on behalf
                        // of an activity that has since closed or been superseded.
                        if (optBoolean("enabled", false)) put("enabled", store.autoUpvoterEnabled(chain, account))
                    }
                }))
            }
            "importWorkerSettings" -> {
                put("intervalMinutes", store.intervalMinutes())
                listOf("enableNotifications", "enableAutoUpvoter", "enableVizSelfAward").forEach {
                    if (optBoolean(it, false)) remove(it)
                }
            }
        }
    }

    private fun approvedPayload(payload: JSONObject): JSONObject =
        JSONObject(payload.toString()).put("explicitConsent", true)


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
