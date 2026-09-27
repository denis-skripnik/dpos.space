package space.dpos.android.storage

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import org.json.JSONArray
import org.json.JSONObject
import space.dpos.android.core.PayloadSanitizer
import space.dpos.android.diagnostics.DiagnosticJournal
import space.dpos.android.diagnostics.DiagnosticSanitizer
import space.dpos.android.runtime.ImportDecision
import space.dpos.android.upvoter.PendingBroadcastIntent
import space.dpos.android.upvoter.PendingBroadcastState
import space.dpos.android.upvoter.GolosDonateLedger
import space.dpos.android.upvoter.GolosDonatePool
import space.dpos.android.upvoter.PendingBroadcastStore
import space.dpos.android.upvoter.GrapheneChainSpecs
import space.dpos.android.notifications.RestWalletNotificationSpecs

data class AutoUpvoterGrantState(
    val chainId: String,
    val account: String,
    val enabled: Boolean,
    val removeGrant: Boolean = false
)

class WorkerStore(context: Context, private val securePrefsForTest: SharedPreferences? = null) : GolosDonateLedger {
    private val prefs = context.getSharedPreferences("dpos_worker", Context.MODE_PRIVATE)
    private val diagnosticJournal = DiagnosticJournal(context.applicationContext)
    private val secure by lazy {
        securePrefsForTest ?: run {
            val masterKey = MasterKey.Builder(context).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build()
            EncryptedSharedPreferences.create(
                context,
                "dpos_worker_secure",
                masterKey,
                EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
            )
        }
    }

    fun workerEnabled(): Boolean = prefs.getBoolean("worker_enabled", false)
    fun setWorkerEnabled(enabled: Boolean) = prefs.edit().putBoolean("worker_enabled", enabled).apply()

    /** Only transfers a previously opted-in pool into an existing active native grant. */
    fun migrateGolosDonate(account: String, poolText: String): Boolean {
        if (!Regex("^[a-z0-9.-]{3,32}$").matches(account)) return false
        val pool = runCatching { GolosDonatePool.parse(poolText) }.getOrNull() ?: return false
        if (!workerEnabled() ||
            !activeAccounts().any { it.chainId == "golos" && it.account == account } ||
            !autoUpvoterEnabled("golos", account)) return false
        val flag = "autoDonate:golos:$account"
        val value = "autoDonatePool:golos:$account"
        // Presence includes false: native revocation always wins over legacy browser state.
        if (prefs.contains(flag) || prefs.contains(value)) return false
        return prefs.edit().putBoolean(flag, true)
            .putString(value, "${pool.percent.toPlainString()} ${pool.coefficient.toPlainString()}").commit()
    }

    fun golosDonateMigrationStatus(account: String, poolText: String): JSONObject {
        val reason = when {
            !Regex("^[a-z0-9.-]{3,32}$").matches(account) -> "invalid_account"
            runCatching { GolosDonatePool.parse(poolText) }.isFailure -> "invalid_pool"
            !workerEnabled() -> "worker_disabled"
            !activeAccounts().any { it.chainId == "golos" && it.account == account } -> "account_inactive"
            !autoUpvoterEnabled("golos", account) -> "upvoter_disabled"
            prefs.contains("autoDonate:golos:$account") || prefs.contains("autoDonatePool:golos:$account") -> "native_preference_exists"
            else -> "eligible"
        }
        val migrated = reason == "eligible" && migrateGolosDonate(account, poolText)
        val finalReason = if (migrated) "transferred" else if (reason == "eligible") "commit_failed" else reason
        val state = golosDonateState(account)
        appendLog("golos:$account: donate migration; decision=${if (migrated) "accepted" else "skipped"}; reason=$finalReason; nativeFlag=${state.optString("flag")}; nativePool=${state.optString("pool")}")
        return JSONObject().put("ok", true).put("migrated", migrated).put("reason", finalReason).put("native", state)
    }

    fun golosDonateState(account: String): JSONObject {
        val key = "autoDonate:golos:$account"
        val pool = prefs.getString("autoDonatePool:golos:$account", null)
        return JSONObject().put("flag", if (!prefs.contains(key)) "absent" else if (prefs.getBoolean(key, false)) "enabled" else "disabled")
            .put("pool", if (pool == null) "absent" else runCatching {
                val parsed = GolosDonatePool.parse(pool)
                "${parsed.percent.toPlainString()} ${parsed.coefficient.toPlainString()}"
            }.getOrDefault("invalid_or_disabled"))
    }

    fun importDecision(decision: ImportDecision) {
        if (!decision.accepted) return
        val existingNotifications = notificationEnabled(decision.chainId, decision.account)
        val existingAutoUpvoter = autoUpvoterEnabled(decision.chainId, decision.account)
        val existingVizSelfAward = vizSelfAwardEnabled(decision.chainId, decision.account)
        val existingAutoStart = autoStartEnabled(decision.chainId, decision.account)
        val finalNotifications = if (decision.updateNotifications) decision.enableNotifications else existingNotifications
        val finalAutoUpvoter = if (decision.updateAutoUpvoter) decision.enableAutoUpvoter else existingAutoUpvoter
        val finalVizSelfAward = if (decision.updateVizSelfAward) decision.enableVizSelfAward else existingVizSelfAward
        val finalAutoStart = existingAutoStart || decision.autoStart
        val shouldUpdateVoteSettings = decision.enableAutoUpvoter || decision.enableVizSelfAward
        val accounts = readAccounts().filterNot { it.chainId == decision.chainId && it.account == decision.account }.toMutableList()
        accounts += AccountIdentity(decision.chainId, decision.account, enabled = finalNotifications || finalAutoUpvoter || finalVizSelfAward)
        val edit = prefs.edit()
            .putString("accounts", JSONArray(accounts.map { JSONObject().put("chainId", it.chainId).put("account", it.account).put("enabled", it.enabled) }).toString())
            .putBoolean("notify:${decision.chainId}:${decision.account}", finalNotifications)
            .putString("notifyOps:${decision.chainId}:${decision.account}", JSONArray(if (decision.updateNotifications && decision.enableNotifications) decision.notificationOps else notificationOps(decision.chainId, decision.account)).toString())
            .putBoolean("upvoter:${decision.chainId}:${decision.account}", finalAutoUpvoter)
            .putBoolean("vizSelfAward:${decision.chainId}:${decision.account}", finalVizSelfAward)
            .putBoolean("autoStart:${decision.chainId}:${decision.account}", finalAutoStart)
            .putInt("intervalMinutes", decision.intervalMinutes)
        if (decision.chainId == "golos" && decision.updateAutoUpvoter && !finalAutoUpvoter)
            edit.putBoolean("autoDonate:golos:${decision.account}", false)
        if (shouldUpdateVoteSettings) {
            edit
                .putInt("minEnergy:${decision.chainId}:${decision.account}", decision.minEnergy)
                .putInt("maxActions:${decision.chainId}:${decision.account}", decision.maxActionsPerTick)
                .putString("curators:${decision.chainId}:${decision.account}", JSONArray(decision.curators).toString())
                .putString("favorites:${decision.chainId}:${decision.account}", JSONArray(decision.favorites).toString())
                .putString("curatorMode:${decision.chainId}:${decision.account}", decision.curatorMode)
                .putInt("curatorCoefficient:${decision.chainId}:${decision.account}", decision.curatorCoefficient)
                .putInt("favoritesPercent:${decision.chainId}:${decision.account}", decision.favoritesPercent)
            if (decision.chainId == "golos") edit.putBoolean("autoDonate:golos:${decision.account}", decision.autoDonate)
                .putString("autoDonatePool:golos:${decision.account}", if (decision.autoDonate) decision.autoDonatePool else "0 1")
        }
        check(edit.commit()) { "could not durably import worker settings" }
        appendLog("imported android worker settings for ${decision.chainId}:${decision.account}; notifications=$finalNotifications; realCapableUpvoter=$finalAutoUpvoter; vizSelfAward=$finalVizSelfAward; autoStart=$finalAutoStart; preservedExistingFlags=true")
    }

    fun syncVizSelfAward(account: String, enabled: Boolean, autoStart: Boolean, minEnergy: Int) {
        val clean = account.trim().removePrefix("@").lowercase()
        if (clean.isBlank()) return
        val chainId = "viz"
        val accounts = readAccounts().filterNot { it.chainId == chainId && it.account == clean }.toMutableList()
        val active = notificationEnabled(chainId, clean) || autoUpvoterEnabled(chainId, clean) || enabled
        accounts += AccountIdentity(chainId, clean, active)
        prefs.edit()
            .putString("accounts", JSONArray(accounts.map { JSONObject().put("chainId", it.chainId).put("account", it.account).put("enabled", it.enabled) }).toString())
            .putBoolean("vizSelfAward:$chainId:$clean", enabled)
            .putBoolean("autoStart:$chainId:$clean", autoStart)
            .putInt("minEnergy:$chainId:$clean", minEnergy.coerceIn(0, 9999))
            .putInt("intervalMinutes", 8)
            .apply()
        appendLog("synced VIZ self-award settings for $chainId:$clean; vizSelfAward=$enabled; autoStart=$autoStart; minEnergy=${minEnergy.coerceIn(0, 9999)}")
    }

    fun readAccounts(): List<AccountIdentity> {
        val raw = prefs.getString("accounts", "[]").orEmpty()
        return try {
            val arr = JSONArray(raw)
            (0 until arr.length()).mapNotNull { i ->
                val obj = arr.optJSONObject(i) ?: return@mapNotNull null
                val chain = obj.optString("chainId")
                val account = obj.optString("account")
                if (chain.isBlank() || account.isBlank()) null else AccountIdentity(chain, account, obj.optBoolean("enabled", false))
            }
        } catch (_: Exception) { emptyList() }
    }

    fun activeAccounts(): List<AccountIdentity> = readAccounts().filter { it.enabled }
    fun notificationEnabled(chainId: String, account: String): Boolean = prefs.getBoolean("notify:$chainId:$account", false)
    fun notificationOps(chainId: String, account: String): List<String> {
        val key = "notifyOps:$chainId:$account"
        if (prefs.contains(key)) return readStringList(key)
        return GrapheneChainSpecs.find(chainId)?.notificationOps ?: RestWalletNotificationSpecs.notificationOps[chainId].orEmpty()
    }
    fun autoUpvoterEnabled(chainId: String, account: String): Boolean = prefs.getBoolean("upvoter:$chainId:$account", false)
    fun vizSelfAwardEnabled(chainId: String, account: String): Boolean = prefs.getBoolean("vizSelfAward:$chainId:$account", false)
    fun autoStartEnabled(chainId: String, account: String): Boolean = prefs.getBoolean("autoStart:$chainId:$account", false)
    fun hasAutoStartAccounts(): Boolean = activeAccounts().any { account ->
        autoStartEnabled(account.chainId, account.account) && (autoUpvoterEnabled(account.chainId, account.account) || vizSelfAwardEnabled(account.chainId, account.account) || notificationEnabled(account.chainId, account.account))
    }
    fun minEnergy(chainId: String, account: String): Int = prefs.getInt("minEnergy:$chainId:$account", 2500)
    fun maxActions(chainId: String, account: String): Int = prefs.getInt("maxActions:$chainId:$account", 5)
    fun curators(chainId: String, account: String): List<String> = readStringList("curators:$chainId:$account")
    fun favorites(chainId: String, account: String): List<String> = readStringList("favorites:$chainId:$account")
    fun curatorMode(chainId: String, account: String): String = if (prefs.getString("curatorMode:$chainId:$account", "repeat") == "full") "full" else "repeat"
    fun curatorCoefficient(chainId: String, account: String): Int = prefs.getInt("curatorCoefficient:$chainId:$account", 100).coerceIn(0, 100)
    fun favoritesPercent(chainId: String, account: String): Int = prefs.getInt("favoritesPercent:$chainId:$account", 100).coerceIn(0, 100)
    fun intervalMinutes(): Int = prefs.getInt("intervalMinutes", 15).coerceAtLeast(15)

    private fun readStringList(key: String): List<String> {
        val raw = prefs.getString(key, "[]").orEmpty()
        return try {
            val arr = JSONArray(raw)
            (0 until arr.length()).map { arr.optString(it).trim().removePrefix("@").lowercase() }.filter { it.isNotBlank() }.distinct()
        } catch (_: Exception) { emptyList() }
    }

    fun readCursor(chainId: String, account: String): NotificationCursor {
        val prefix = "cursor:$chainId:$account"
        return NotificationCursor(chainId, account, prefs.getLong("$prefix:last", -1L), prefs.getBoolean("$prefix:baseline", false))
    }

    fun saveCursor(cursor: NotificationCursor) {
        prefs.edit()
            .putLong("cursor:${cursor.chainId}:${cursor.account}:last", cursor.lastIndex)
            .putBoolean("cursor:${cursor.chainId}:${cursor.account}:baseline", cursor.baselineDone)
            .apply()
    }

    fun autoVoteSourceCursor(chainId: String, curator: String): Long =
        prefs.getLong("autoVoteSourceCursor:${chainId.lowercase()}:${curator.lowercase()}", -1L)

    fun saveAutoVoteSourceCursor(chainId: String, curator: String, index: Long) {
        val key = "autoVoteSourceCursor:${chainId.lowercase()}:${curator.lowercase()}"
        if (index >= 0 && index > prefs.getLong(key, -1L)) prefs.edit().putLong(key, index).apply()
    }

    private fun pendingKey(kind: String, chainId: String, account: String) =
        "pendingTransaction:${kind.lowercase()}:${chainId.lowercase()}:${account.lowercase()}"

    fun autoDonatePool(chainId: String, account: String): String? =
        if (chainId == "golos" && autoUpvoterEnabled(chainId, account) && prefs.getBoolean("autoDonate:golos:$account", false))
            prefs.getString("autoDonatePool:golos:$account", null) else null

    override fun donated(account: String, fingerprint: String): Boolean =
        prefs.getBoolean("donateReceipt:golos:$account:$fingerprint", false)

    override fun markDonated(account: String, fingerprint: String) {
        check(prefs.edit().putBoolean("donateReceipt:golos:$account:$fingerprint", true).commit()) {
            "could not durably save donation receipt"
        }
    }

    override fun readPending(kind: String, chainId: String, account: String): PendingBroadcastIntent? {
        val raw = prefs.getString(pendingKey(kind, chainId, account), null) ?: return null
        return runCatching {
            val json = JSONObject(raw)
            PendingBroadcastIntent(
                json.getString("kind"), json.getString("chainId"), json.getString("account"),
                json.getString("fingerprint"), json.getLong("historyBaseline"),
                PendingBroadcastState.valueOf(json.optString("state", "UNKNOWN")),
                json.optString("transactionId").takeIf { it.isNotBlank() },
                json.optLong("createdAtMs", -1).takeIf { it > 0 },
                json.optLong("expirationEpochSeconds", -1).takeIf { it > 0 },
                json.optLong("observedChainTimeSeconds", -1).takeIf { it > 0 },
                json.optLong("observedHeadBlock", -1).takeIf { it > 0 },
                json.optLong("includedBlockNumber", -1).takeIf { it > 0 }
            )
        }.getOrElse { throw IllegalStateException("pending transaction record is invalid; automatic replay is blocked") }
    }

    override fun savePending(intent: PendingBroadcastIntent) {
        val json = JSONObject().put("kind", intent.kind).put("chainId", intent.chainId)
            .put("account", intent.account).put("fingerprint", intent.fingerprint)
            .put("historyBaseline", intent.historyBaseline).put("state", intent.state.name)
        intent.transactionId?.let { json.put("transactionId", it) }
        intent.createdAtMs?.let { json.put("createdAtMs", it) }
        intent.expirationEpochSeconds?.let { json.put("expirationEpochSeconds", it) }
        intent.observedChainTimeSeconds?.let { json.put("observedChainTimeSeconds", it) }
        intent.observedHeadBlock?.let { json.put("observedHeadBlock", it) }
        intent.includedBlockNumber?.let { json.put("includedBlockNumber", it) }
        check(prefs.edit().putString(pendingKey(intent.kind, intent.chainId, intent.account), json.toString()).commit()) {
            "could not durably save pending broadcast intent"
        }
    }

    override fun clearPending(kind: String, chainId: String, account: String) {
        prefs.edit().remove(pendingKey(kind, chainId, account)).commit()
    }

    fun pendingDiagnostics(kind: String, chainId: String, account: String, now: Long): JSONObject {
        val pending = runCatching { readPending(kind, chainId, account) }.getOrElse {
            return JSONObject().put("kind", kind).put("status", "invalid_record_replay_blocked")
        } ?: return JSONObject().put("kind", kind).put("status", "none")
        val txId = pending.transactionId?.takeIf { it.matches(Regex("[0-9a-fA-F]{40}")) }
        val identity = when (kind) {
            "self_award" -> pending.fingerprint.split('|').let { parts -> JSONObject()
                .put("energyBp", if (parts.firstOrNull() == "v2") parts.getOrNull(1)?.toIntOrNull() ?: JSONObject.NULL else parts.firstOrNull()?.toIntOrNull() ?: JSONObject.NULL)
                .put("feeBeneficiary", parts.firstOrNull() == "v2") }
            "vote" -> pending.fingerprint.split('|').let { parts -> JSONObject()
                .put("author", DiagnosticSanitizer.sanitize(parts.firstOrNull(), 80))
                .put("permlink", DiagnosticSanitizer.sanitize(parts.getOrNull(1), 120))
                .put("weight", parts.getOrNull(2)?.toIntOrNull() ?: JSONObject.NULL) }
            "donate" -> pending.fingerprint.split('|').let { parts -> JSONObject()
                .put("target", DiagnosticSanitizer.sanitize(parts.getOrNull(1), 80))
                .put("permlink", DiagnosticSanitizer.sanitize(parts.getOrNull(2), 120)) }
            else -> JSONObject()
        }
        return JSONObject().put("kind", kind).put("status", pending.state.name.lowercase())
            .put("operation", identity)
            .put("historyBaseline", pending.historyBaseline)
            .put("transactionId", txId ?: JSONObject.NULL)
            .put("identity", if (txId != null) "exact_transaction" else "operation_only")
            .put("ageSeconds", pending.createdAtMs?.let { ((now - it).coerceAtLeast(0L)) / 1000 } ?: JSONObject.NULL)
    }

    fun setLastTick(value: Long) = prefs.edit().putLong("lastTick", value).apply()
    fun lastTick(): Long? = prefs.getLong("lastTick", -1L).takeIf { it >= 0 }
    fun setNextTick(value: Long?) {
        val edit = prefs.edit()
        if (value == null) edit.remove("nextTick") else edit.putLong("nextTick", value)
        edit.apply()
    }
    fun nextTick(): Long? = prefs.getLong("nextTick", -1L).takeIf { it >= 0 }
    fun setLastError(value: String?) {
        val edit = prefs.edit()
        if (value.isNullOrBlank()) edit.remove("lastError") else edit.putString("lastError", DiagnosticSanitizer.sanitize(value, 16_000))
        edit.apply()
    }
    fun lastError(): String? = prefs.getString("lastError", null)

    fun appendLog(message: String, level: String = "info") {
        val sanitized = DiagnosticSanitizer.sanitize(message, 16_000)
        diagnosticJournal.append(sanitized, level)
        synchronized(shortLogLock) {
            val old = prefs.getString("logs", "").orEmpty().lines().filter { it.isNotBlank() }.takeLast(120)
            val next = (old + "${System.currentTimeMillis()} [$level] ${PayloadSanitizer.redactLog(sanitized)}").takeLast(160).joinToString("\n")
            prefs.edit().putString("logs", next).apply()
        }
    }
    fun clearLogs() = prefs.edit().remove("logs").remove("lastError").remove("lastRunSummary").apply()
    fun markAppVersion(version: String): Boolean {
        val old = prefs.getString("appVersion", "").orEmpty()
        if (old == version) return false
        prefs.edit().putString("appVersion", version).apply()
        return old.isNotBlank()
    }
    fun exportLogs(): String = prefs.getString("logs", "").orEmpty()
    fun exportDiagnosticJournal(): String = diagnosticJournal.readAll()
    fun saveLastRunSummary(summary: JSONObject) {
        prefs.edit().putString("lastRunSummary", DiagnosticSanitizer.sanitize(summary.toString(), Int.MAX_VALUE)).apply()
    }
    fun exportLastRunSummary(): JSONObject? {
        val raw = prefs.getString("lastRunSummary", "").orEmpty()
        return if (raw.isBlank()) null else try { JSONObject(raw) } catch (_: Exception) { null }
    }
    fun saveAutoUpvoterFeed(feed: List<JSONObject>) {
        if (feed.isEmpty()) return
        val existing = exportAutoUpvoterFeed()
        val merged = JSONArray()
        for (i in 0 until existing.length()) merged.put(existing.opt(i))
        feed.forEach { merged.put(it) }
        val retained = JSONArray((0 until merged.length()).map { merged.optJSONObject(it) ?: JSONObject().put("value", merged.opt(it)) }.takeLast(30))
        prefs.edit().putString("autoUpvoterFeed", DiagnosticSanitizer.sanitize(retained.toString(), Int.MAX_VALUE)).apply()
    }
    fun exportAutoUpvoterFeed(): JSONArray {
        val raw = prefs.getString("autoUpvoterFeed", "[]").orEmpty()
        return try { JSONArray(raw) } catch (_: Exception) { JSONArray() }
    }
    fun totalAutoUpvoterBroadcasted(): Int = prefs.getInt("totalAutoUpvoterBroadcasted", 0)
    fun addAutoUpvoterBroadcasted(count: Int) {
        if (count <= 0) return
        prefs.edit().putInt("totalAutoUpvoterBroadcasted", totalAutoUpvoterBroadcasted() + count).apply()
    }
    fun totalVizSelfAwardBroadcasted(): Int = prefs.getInt("totalVizSelfAwardBroadcasted", 0)
    fun addVizSelfAwardBroadcasted(count: Int) {
        if (count <= 0) return
        prefs.edit().putInt("totalVizSelfAwardBroadcasted", totalVizSelfAwardBroadcasted() + count).apply()
    }
    fun lastVizSelfAwardAt(account: String): Long? = prefs.getLong("lastVizSelfAwardAt:viz:$account", -1L).takeIf { it >= 0 }
    fun markVizSelfAward(account: String, at: Long = System.currentTimeMillis()) {
        prefs.edit().putLong("lastVizSelfAwardAt:viz:$account", at).apply()
    }
    fun saveEncryptedKeyRef(ref: EncryptedKeyRef, secret: String) {
        secure.edit().putString("key:${ref.chainId}:${ref.account}:${ref.authority}:${ref.alias}", secret).apply()
    }
    fun removeEncryptedKeyRef(ref: EncryptedKeyRef) {
        secure.edit().remove("key:${ref.chainId}:${ref.account}:${ref.authority}:${ref.alias}").apply()
    }
    fun disableAutoUpvoter(chainId: String, account: String) {
        val edit = prefs.edit().putBoolean("upvoter:$chainId:$account", false)
        if (chainId == "golos") edit.putBoolean("autoDonate:golos:$account", false)
        edit.apply()
    }

    fun syncAutoUpvoterGrants(states: List<AutoUpvoterGrantState>) {
        val normalized = states.mapNotNull { state ->
            val chain = state.chainId.trim().lowercase()
            val account = state.account.trim().removePrefix("@").lowercase()
            if (chain.isBlank() || account.isBlank()) null else state.copy(chainId = chain, account = account)
        }.associateBy { it.chainId to it.account }
        val identities = readAccounts().associateBy { it.chainId to it.account }.toMutableMap()
        normalized.forEach { (key, state) ->
            identities.putIfAbsent(key, AccountIdentity(state.chainId, state.account, enabled = false))
        }
        val edit = prefs.edit()
        identities.forEach { (key, identity) ->
            val state = normalized[key]
            val enabled = state?.enabled ?: false
            edit.putBoolean("upvoter:${key.first}:${key.second}", enabled)
            if (key.first == "golos" && !enabled) edit.putBoolean("autoDonate:golos:${key.second}", false)
            if (state?.removeGrant == true) removeEncryptedKeyRef(defaultPostingKeyRef(key.first, key.second))
            identities[key] = identity.copy(
                enabled = notificationEnabled(key.first, key.second) || vizSelfAwardEnabled(key.first, key.second) || enabled
            )
        }
        edit.putString("accounts", JSONArray(identities.values.map {
            JSONObject().put("chainId", it.chainId).put("account", it.account).put("enabled", it.enabled)
        }).toString()).apply()
        appendLog("synchronized full native auto-upvoter grant state; accounts=${normalized.size}")
    }
    fun hasEncryptedKey(ref: EncryptedKeyRef): Boolean = secure.contains("key:${ref.chainId}:${ref.account}:${ref.authority}:${ref.alias}")
    fun readEncryptedKey(ref: EncryptedKeyRef): String? = secure.getString("key:${ref.chainId}:${ref.account}:${ref.authority}:${ref.alias}", null)
    fun defaultPostingKeyRef(chainId: String, account: String): EncryptedKeyRef = EncryptedKeyRef(chainId, account, "posting", "posting")
    fun defaultRegularKeyRef(chainId: String, account: String): EncryptedKeyRef = EncryptedKeyRef(chainId, account, "regular", "regular")
    fun hasPostingKey(chainId: String, account: String): Boolean = hasEncryptedKey(defaultPostingKeyRef(chainId, account))
    fun hasRegularKey(chainId: String, account: String): Boolean = hasEncryptedKey(defaultRegularKeyRef(chainId, account))
    fun readPostingKey(chainId: String, account: String): String? = readEncryptedKey(defaultPostingKeyRef(chainId, account))
    fun readRegularKey(chainId: String, account: String): String? = readEncryptedKey(defaultRegularKeyRef(chainId, account))

    private companion object {
        val shortLogLock = Any()
    }
}
