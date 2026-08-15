package space.dpos.android.storage

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import org.json.JSONArray
import org.json.JSONObject
import space.dpos.android.core.PayloadSanitizer
import space.dpos.android.runtime.ImportDecision

class WorkerStore(context: Context, private val securePrefsForTest: SharedPreferences? = null) {
    private val prefs = context.getSharedPreferences("dpos_worker", Context.MODE_PRIVATE)
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

    fun importDecision(decision: ImportDecision) {
        if (!decision.accepted) return
        val accounts = readAccounts().filterNot { it.chainId == decision.chainId && it.account == decision.account }.toMutableList()
        accounts += AccountIdentity(decision.chainId, decision.account, enabled = decision.enableNotifications || decision.enableAutoUpvoter || decision.enableVizSelfAward)
        prefs.edit()
            .putString("accounts", JSONArray(accounts.map { JSONObject().put("chainId", it.chainId).put("account", it.account).put("enabled", it.enabled) }).toString())
            .putBoolean("notify:${decision.chainId}:${decision.account}", decision.enableNotifications)
            .putString("notifyOps:${decision.chainId}:${decision.account}", JSONArray(decision.notificationOps).toString())
            .putBoolean("upvoter:${decision.chainId}:${decision.account}", decision.enableAutoUpvoter)
            .putBoolean("vizSelfAward:${decision.chainId}:${decision.account}", decision.enableVizSelfAward)
            .putInt("minEnergy:${decision.chainId}:${decision.account}", decision.minEnergy)
            .putInt("maxActions:${decision.chainId}:${decision.account}", decision.maxActionsPerTick)
            .putInt("intervalMinutes", decision.intervalMinutes)
            .putString("curators:${decision.chainId}:${decision.account}", JSONArray(decision.curators).toString())
            .putString("favorites:${decision.chainId}:${decision.account}", JSONArray(decision.favorites).toString())
            .putString("curatorMode:${decision.chainId}:${decision.account}", decision.curatorMode)
            .putInt("curatorCoefficient:${decision.chainId}:${decision.account}", decision.curatorCoefficient)
            .putInt("favoritesPercent:${decision.chainId}:${decision.account}", decision.favoritesPercent)
            .apply()
        appendLog("imported android worker settings for ${decision.chainId}:${decision.account}; notifications=${decision.enableNotifications}; realCapableUpvoter=${decision.enableAutoUpvoter}; vizSelfAward=${decision.enableVizSelfAward}")
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
    fun notificationOps(chainId: String, account: String): List<String> = readStringList("notifyOps:$chainId:$account")
    fun autoUpvoterEnabled(chainId: String, account: String): Boolean = prefs.getBoolean("upvoter:$chainId:$account", false)
    fun vizSelfAwardEnabled(chainId: String, account: String): Boolean = prefs.getBoolean("vizSelfAward:$chainId:$account", false)
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
        if (value.isNullOrBlank()) edit.remove("lastError") else edit.putString("lastError", PayloadSanitizer.redactLog(value))
        edit.apply()
    }
    fun lastError(): String? = prefs.getString("lastError", null)

    fun appendLog(message: String, level: String = "info") {
        val old = prefs.getString("logs", "").orEmpty().lines().filter { it.isNotBlank() }.takeLast(120)
        val next = (old + "${System.currentTimeMillis()} [$level] ${PayloadSanitizer.redactLog(message)}").takeLast(160).joinToString("\n")
        prefs.edit().putString("logs", next).apply()
    }
    fun exportLogs(): String = prefs.getString("logs", "").orEmpty()
    fun saveEncryptedKeyRef(ref: EncryptedKeyRef, secret: String) {
        secure.edit().putString("key:${ref.chainId}:${ref.account}:${ref.authority}:${ref.alias}", secret).apply()
    }
    fun removeEncryptedKeyRef(ref: EncryptedKeyRef) {
        secure.edit().remove("key:${ref.chainId}:${ref.account}:${ref.authority}:${ref.alias}").apply()
    }
    fun disableAutoUpvoter(chainId: String, account: String) {
        prefs.edit().putBoolean("upvoter:$chainId:$account", false).apply()
    }
    fun hasEncryptedKey(ref: EncryptedKeyRef): Boolean = secure.contains("key:${ref.chainId}:${ref.account}:${ref.authority}:${ref.alias}")
    fun readEncryptedKey(ref: EncryptedKeyRef): String? = secure.getString("key:${ref.chainId}:${ref.account}:${ref.authority}:${ref.alias}", null)
    fun defaultPostingKeyRef(chainId: String, account: String): EncryptedKeyRef = EncryptedKeyRef(chainId, account, "posting", "posting")
    fun defaultRegularKeyRef(chainId: String, account: String): EncryptedKeyRef = EncryptedKeyRef(chainId, account, "regular", "regular")
    fun hasPostingKey(chainId: String, account: String): Boolean = hasEncryptedKey(defaultPostingKeyRef(chainId, account))
    fun readPostingKey(chainId: String, account: String): String? = readEncryptedKey(defaultPostingKeyRef(chainId, account))
    fun readRegularKey(chainId: String, account: String): String? = readEncryptedKey(defaultRegularKeyRef(chainId, account))
}
