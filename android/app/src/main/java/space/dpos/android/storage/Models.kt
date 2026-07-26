package space.dpos.android.storage

data class AccountIdentity(val chainId: String, val account: String, val enabled: Boolean = false)
data class NotificationCursor(val chainId: String, val account: String, val lastIndex: Long, val baselineDone: Boolean)
data class AutoUpvoterSettings(val chainId: String, val account: String, val enabled: Boolean, val minEnergy: Int, val maxActionsPerTick: Int = 5)
data class WorkerStatus(val running: Boolean, val activeAccounts: Int, val lastTick: Long?, val lastError: String?, val nextTick: Long?, val batteryOptimizationWarning: Boolean)
data class WorkerLogLine(val timestamp: Long, val level: String, val message: String)
data class EncryptedKeyRef(val chainId: String, val account: String, val authority: String, val alias: String)
