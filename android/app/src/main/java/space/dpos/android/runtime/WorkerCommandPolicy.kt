package space.dpos.android.runtime

import org.json.JSONArray
import org.json.JSONObject
import space.dpos.android.core.PayloadSanitizer
import space.dpos.android.upvoter.GrapheneChainSpecs
import space.dpos.android.notifications.RestWalletNotificationSpecs

data class AccountImportRequest(
    val chainId: String,
    val account: String,
    val enableNotifications: Boolean,
    val enableAutoUpvoter: Boolean,
    val enableVizSelfAward: Boolean = false,
    val autoStart: Boolean = false,
    val explicitConsent: Boolean,
    val notificationOps: List<String>? = null,
    val minEnergy: Int = 2500,
    val maxActionsPerTick: Int = 5,
    val intervalMinutes: Int = 15,
    val curators: List<String> = emptyList(),
    val favorites: List<String> = emptyList(),
    val curatorMode: String = "repeat",
    val curatorCoefficient: Int = 100,
    val favoritesPercent: Int = 100,
    val autoDonate: Boolean = false,
    val autoDonatePool: String = "0 1",
    val updateNotifications: Boolean = false,
    val updateAutoUpvoter: Boolean = false,
    val updateVizSelfAward: Boolean = false
)

data class ImportDecision(
    val accepted: Boolean,
    val reason: String,
    val chainId: String = "",
    val account: String = "",
    val enableNotifications: Boolean = false,
    val enableAutoUpvoter: Boolean = false,
    val enableVizSelfAward: Boolean = false,
    val autoStart: Boolean = false,
    val notificationOps: List<String> = emptyList(),
    val minEnergy: Int = 2500,
    val maxActionsPerTick: Int = 5,
    val intervalMinutes: Int = 15,
    val curators: List<String> = emptyList(),
    val favorites: List<String> = emptyList(),
    val curatorMode: String = "repeat",
    val curatorCoefficient: Int = 100,
    val favoritesPercent: Int = 100,
    val autoDonate: Boolean = false,
    val autoDonatePool: String = "0 1",
    val updateNotifications: Boolean = false,
    val updateAutoUpvoter: Boolean = false,
    val updateVizSelfAward: Boolean = false
)

object WorkerCommandPolicy {
    private val supportedNotificationChains = GrapheneChainSpecs.supportedNativeNotificationChains + RestWalletNotificationSpecs.supportedChains
    private val supportedAutoUpvoterChains = GrapheneChainSpecs.supportedNativeVoteChains
    private val accountPattern = Regex("^[a-z0-9.-]{3,32}$")
    private val walletAddressPattern = Regex("^((mx|dx|0x)[0-9a-f]{40}|d0[0-9a-z]{39})$")
    private val secretFieldPattern = Regex("(?i)(private|wif|seed|mnemonic|password|token|secret|key)")

    fun validateImport(request: AccountImportRequest): ImportDecision {
        val chain = request.chainId.trim().lowercase()
        val account = request.account.trim().removePrefix("@").lowercase()
        if (!request.explicitConsent) return ImportDecision(false, "explicit opt-in is required before Android worker imports account settings")
        val isWalletNotificationChain = chain in RestWalletNotificationSpecs.supportedChains
        if (!accountPattern.matches(account) && !(isWalletNotificationChain && walletAddressPattern.matches(account))) return ImportDecision(false, "invalid account name")
        val hasFeatureUpdate = request.updateNotifications || request.updateAutoUpvoter || request.updateVizSelfAward
        if (!request.enableNotifications && !request.enableAutoUpvoter && !request.enableVizSelfAward && !hasFeatureUpdate) return ImportDecision(false, "nothing enabled or explicitly disabled")
        if (request.enableNotifications && chain !in supportedNotificationChains) return ImportDecision(false, "unsupported chain for native notifications: $chain")
        if (request.enableAutoUpvoter && chain !in supportedAutoUpvoterChains) return ImportDecision(false, "unsupported chain for native auto-upvoter: $chain")
        if (request.enableVizSelfAward && chain != "viz") return ImportDecision(false, "VIZ self-award is supported only for viz")
        if (request.autoDonate && chain != "golos") return ImportDecision(false, "auto-donate is supported only for Golos")
        if (request.autoDonate && !request.enableAutoUpvoter) return ImportDecision(false, "auto-donate requires enabled auto-upvoter")
        val pool = if (request.autoDonate) try { space.dpos.android.upvoter.GolosDonatePool.parse(request.autoDonatePool) }
            catch (_: Exception) { return ImportDecision(false, "invalid Golos auto-donate percent/coefficient") } else null
        return ImportDecision(
            accepted = true,
            reason = "accepted",
            chainId = chain,
            account = account,
            enableNotifications = request.enableNotifications,
            enableAutoUpvoter = request.enableAutoUpvoter,
            enableVizSelfAward = request.enableVizSelfAward,
            autoStart = request.autoStart,
            notificationOps = normalizeOps(request.notificationOps, chain),
            minEnergy = normalizeEnergyThreshold(request.minEnergy),
            maxActionsPerTick = request.maxActionsPerTick.coerceIn(1, 20),
            intervalMinutes = request.intervalMinutes.coerceAtLeast(15),
            curators = normalizeAccounts(request.curators),
            favorites = normalizeAccounts(request.favorites),
            curatorMode = normalizeCuratorMode(request.curatorMode),
            curatorCoefficient = request.curatorCoefficient.coerceIn(0, 100),
            favoritesPercent = request.favoritesPercent.coerceIn(0, 100),
            autoDonate = chain == "golos" && request.autoDonate,
            autoDonatePool = pool?.let { "${it.percent.toPlainString()} ${it.coefficient.toPlainString()}" } ?: "0 1",
            updateNotifications = request.updateNotifications || request.enableNotifications,
            updateAutoUpvoter = request.updateAutoUpvoter || request.enableAutoUpvoter,
            updateVizSelfAward = request.updateVizSelfAward || request.enableVizSelfAward
        )
    }

    fun normalizeAccounts(values: List<String>): List<String> = values
        .map { it.trim().removePrefix("@").lowercase() }
        .filter { accountPattern.matches(it) }
        .distinct()

    fun normalizeEnergyThreshold(value: Int): Int {
        return value.coerceIn(0, 10000)
    }

    fun normalizeCuratorMode(value: String): String = if (value.trim().lowercase() == "full") "full" else "repeat"

    fun normalizeOps(values: List<String>?, chainId: String): List<String> {
        val allowed = GrapheneChainSpecs.find(chainId)?.notificationOps ?: RestWalletNotificationSpecs.notificationOps[chainId].orEmpty()
        if (allowed.isEmpty()) return emptyList()
        if (values == null) return allowed
        return values.map { it.trim().lowercase() }.filter { it in allowed }.distinct()
    }

    fun hasSecretLikeFields(json: JSONObject): Boolean {
        val keys = json.keys()
        while (keys.hasNext()) {
            if (secretFieldPattern.containsMatchIn(keys.next())) return true
        }
        return false
    }
}

object WorkerSettingsCodec {
    fun decodeImport(json: String?): ImportDecision {
        val raw = json.orEmpty().trim()
        if (raw.isBlank()) return ImportDecision(false, "empty import payload")
        return try {
            val obj = JSONObject(raw)
            if (WorkerCommandPolicy.hasSecretLikeFields(obj)) return ImportDecision(false, "secret-like fields are not accepted by settings import; import keys only through native secure-storage flow")
            WorkerCommandPolicy.validateImport(
                AccountImportRequest(
                    chainId = obj.optString("chainId"),
                    account = obj.optString("account"),
                    enableNotifications = obj.optBoolean("enableNotifications", false),
                    enableAutoUpvoter = obj.optBoolean("enableAutoUpvoter", false),
                    enableVizSelfAward = obj.optBoolean("enableVizSelfAward", false),
                    autoStart = obj.optBoolean("autoStart", false),
                    explicitConsent = obj.optBoolean("explicitConsent", false),
                    notificationOps = if (obj.has("notificationOps")) readStringList(obj.opt("notificationOps")) else null,
                    minEnergy = obj.optInt("minEnergy", 2500),
                    maxActionsPerTick = obj.optInt("maxActionsPerTick", 5),
                    intervalMinutes = obj.optInt("intervalMinutes", 15),
                    curators = readAccountList(obj.opt("curators")),
                    favorites = readAccountList(obj.opt("favorites")),
                    curatorMode = obj.optString("curatorMode", "repeat"),
                    curatorCoefficient = obj.optInt("curatorCoefficient", 100),
                    favoritesPercent = obj.optInt("favoritesPercent", 100),
                    autoDonate = obj.optBoolean("autoDonate", false),
                    autoDonatePool = obj.optString("autoDonatePool", "0 1"),
                    updateNotifications = obj.has("enableNotifications"),
                    updateAutoUpvoter = obj.has("enableAutoUpvoter"),
                    updateVizSelfAward = obj.has("enableVizSelfAward")
                )
            )
        } catch (e: Exception) {
            ImportDecision(false, "invalid import JSON: ${PayloadSanitizer.text(e.message, 120)}")
        }
    }

    fun decisionJson(decision: ImportDecision): String = JSONObject()
        .put("ok", decision.accepted)
        .put("reason", decision.reason)
        .put("chainId", decision.chainId)
        .put("account", decision.account)
        .put("enableNotifications", decision.enableNotifications)
        .put("enableAutoUpvoter", decision.enableAutoUpvoter)
        .put("autoDonate", decision.autoDonate)
        .put("autoDonatePool", decision.autoDonatePool)
        .put("enableVizSelfAward", decision.enableVizSelfAward)
        .put("autoStart", decision.autoStart)
        .put("notificationOps", JSONArray(decision.notificationOps))
        .put("minEnergy", decision.minEnergy)
        .put("maxActionsPerTick", decision.maxActionsPerTick)
        .put("intervalMinutes", decision.intervalMinutes)
        .put("curators", JSONArray(decision.curators))
        .put("favorites", JSONArray(decision.favorites))
        .put("curatorMode", decision.curatorMode)
        .put("curatorCoefficient", decision.curatorCoefficient)
        .put("favoritesPercent", decision.favoritesPercent)
        .toString()

    private fun readAccountList(value: Any?): List<String> = readStringList(value)

    private fun readStringList(value: Any?): List<String> {
        if (value is JSONArray) return (0 until value.length()).map { value.optString(it) }
        return value?.toString().orEmpty().split(Regex("[\\s,;]+"))
    }

    fun statusJson(
        running: Boolean,
        workerEnabled: Boolean,
        activeAccounts: Int,
        lastTick: Long?,
        nextTick: Long?,
        lastError: String?,
        logs: String
    ): String {
        val redactedLogs = PayloadSanitizer.redactLog(logs)
        val lines = redactedLogs.lines().filter { it.isNotBlank() }
        val errorTail = lines
            .filter { line -> line.contains("[error]") || line.contains("[warning]") || line.contains("ошибка", ignoreCase = true) || line.contains("error", ignoreCase = true) }
            .takeLast(20)
            .joinToString("\n")
        val golosTail = lines
            .filter { line -> line.contains("golos:", ignoreCase = true) }
            .takeLast(40)
            .joinToString("\n")
        return JSONObject()
            .put("running", running)
            .put("workerEnabled", workerEnabled)
            .put("status", if (running) "running" else "stopped")
            .put("canStart", true)
            .put("canStop", running)
            .put("canCheckNow", workerEnabled || activeAccounts > 0)
            .put("activeAccounts", activeAccounts)
            .put("lastTick", lastTick ?: JSONObject.NULL)
            .put("nextTick", nextTick ?: JSONObject.NULL)
            .put("lastError", PayloadSanitizer.redactLog(lastError.orEmpty()).ifBlank { JSONObject.NULL })
            .put("logs", redactedLogs.takeLast(8000))
            .put("errorLogTail", errorTail.takeLast(4000))
            .put("golosLogTail", golosTail.takeLast(5000))
            .toString()
    }
}
