package space.dpos.android.storage

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import space.dpos.android.core.PayloadSanitizer

class WorkerStore(context: Context) {
    private val prefs = context.getSharedPreferences("dpos_worker", Context.MODE_PRIVATE)
    private val secure by lazy {
        val masterKey = MasterKey.Builder(context).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build()
        EncryptedSharedPreferences.create(
            context,
            "dpos_worker_secure",
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )
    }

    fun workerEnabled(): Boolean = prefs.getBoolean("worker_enabled", false)
    fun setWorkerEnabled(enabled: Boolean) = prefs.edit().putBoolean("worker_enabled", enabled).apply()
    fun appendLog(message: String, level: String = "info") {
        val old = prefs.getString("logs", "").orEmpty().lines().takeLast(120)
        val next = (old + "${System.currentTimeMillis()} [$level] ${PayloadSanitizer.redactLog(message)}").takeLast(160).joinToString("\n")
        prefs.edit().putString("logs", next).apply()
    }
    fun exportLogs(): String = prefs.getString("logs", "").orEmpty()
    fun saveEncryptedKeyRef(ref: EncryptedKeyRef, secret: String) {
        secure.edit().putString("key:${ref.chainId}:${ref.account}:${ref.authority}:${ref.alias}", secret).apply()
    }
    fun hasEncryptedKey(ref: EncryptedKeyRef): Boolean = secure.contains("key:${ref.chainId}:${ref.account}:${ref.authority}:${ref.alias}")
}
