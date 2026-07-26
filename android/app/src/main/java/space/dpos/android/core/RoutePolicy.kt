package space.dpos.android.core

object RoutePolicy {
    const val LIVE_BASE_URL = "https://dpos.blinddev.xyz/"
    private const val MAX_ROUTE_LENGTH = 512
    private val allowedApps = setOf(
        "profiles", "accounts", "wallet", "history", "broadcast", "manage", "post", "notifications",
        "auto-upvoter", "backup", "editor", "donate", "award", "calculator", "explorer", "swap",
        "register", "registration", "top", "validators", "projects", "polls", "custom-generator", "voice-import"
    )
    private val allowedChains = setOf("golos", "viz", "steem", "hive", "minter", "decimal")

    fun sanitizeRoute(route: String?): String {
        val raw = route.orEmpty().trim().take(MAX_ROUTE_LENGTH)
        if (raw.isBlank()) return "#"
        if (raw.startsWith("http://") || raw.startsWith("https://") || raw.startsWith("javascript:", true)) return "#"
        val hash = if (raw.startsWith("#")) raw.drop(1) else raw
        if (hash.isBlank()) return "#"
        val params = hash.split('&')
            .mapNotNull { part ->
                val idx = part.indexOf('=')
                if (idx <= 0) null else part.substring(0, idx) to part.substring(idx + 1)
            }
            .toMutableList()
        val chain = params.firstOrNull { it.first == "chain" }?.second?.lowercase()
        val app = params.firstOrNull { it.first == "app" }?.second?.lowercase()
        if (chain != null && chain !in allowedChains) return "#"
        if (app != null && app !in allowedApps) return "#"
        val safe = params.filter { (key, value) ->
            key.matches(Regex("[a-zA-Z0-9_-]{1,32}")) && value.length <= 180 && !value.contains('<') && !value.contains('>')
        }.joinToString("&") { (key, value) -> "$key=$value" }
        return if (safe.isBlank()) "#" else "#$safe"
    }

    fun toLiveUrl(route: String?): String = LIVE_BASE_URL + sanitizeRoute(route)
}
