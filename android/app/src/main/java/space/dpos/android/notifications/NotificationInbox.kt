package space.dpos.android.notifications

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import space.dpos.android.core.PayloadSanitizer
import space.dpos.android.core.RoutePolicy
import java.security.MessageDigest

/** App-private durable inbox. All persisted display text is sanitized before it reaches storage. */
class NotificationInbox(context: Context) {
    private val prefs = context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    data class Event(
        val id: String,
        val title: String,
        val text: String,
        val route: String,
        val read: Boolean
    ) {
        fun toJson(): JSONObject = JSONObject()
            .put("id", id)
            .put("title", title)
            .put("text", text)
            .put("route", route)
            .put("read", read)
    }

    data class Snapshot(val unreadCount: Int, val events: List<Event>) {
        fun toJson(): JSONObject = JSONObject()
            .put("ok", true)
            .put("unreadCount", unreadCount)
            .put("events", JSONArray().apply { events.forEach { put(it.toJson()) } })
    }

    /** Returns null for a duplicate. Newest event is last, matching publication sequence. */
    fun add(id: String?, title: String?, text: String?, route: String?): Snapshot? = synchronized(lock) {
        val safeTitle = PayloadSanitizer.text(title, 80).ifBlank { "DPoS Space" }
        val safeText = PayloadSanitizer.text(text, 600)
        val safeRoute = RoutePolicy.sanitizeRoute(route)
        val safeId = stableId(id, safeTitle, safeText, safeRoute)
        val seen = readSeen()
        if (safeId in seen) return@synchronized null

        val events = readEvents().toMutableList().apply {
            add(Event(safeId, safeTitle, safeText, safeRoute, false))
            while (size > MAX_RETAINED_EVENTS) removeAt(0)
        }
        seen.add(safeId)
        while (seen.size > MAX_DEDUP_IDS) seen.remove(seen.first())
        val unread = prefs.getInt(KEY_UNREAD_COUNT, 0).let { if (it == Int.MAX_VALUE) it else it + 1 }
        check(prefs.edit()
            .putString(KEY_EVENTS, JSONArray().apply { events.forEach { put(it.toJson()) } }.toString())
            .putString(KEY_SEEN_IDS, JSONArray(seen.toList()).toString())
            .putInt(KEY_UNREAD_COUNT, unread)
            .commit()) { "notification inbox could not be persisted" }
        Snapshot(unread, events)
    }

    fun snapshot(): Snapshot = synchronized(lock) {
        Snapshot(prefs.getInt(KEY_UNREAD_COUNT, 0).coerceAtLeast(0), readEvents())
    }

    fun markAllRead(): Snapshot = synchronized(lock) {
        val events = readEvents().map { if (it.read) it else it.copy(read = true) }
        check(prefs.edit()
            .putString(KEY_EVENTS, JSONArray().apply { events.forEach { put(it.toJson()) } }.toString())
            .putInt(KEY_UNREAD_COUNT, 0)
            .commit()) { "notification inbox could not be persisted" }
        Snapshot(0, events)
    }

    private fun readEvents(): List<Event> = runCatching {
        val rows = JSONArray(prefs.getString(KEY_EVENTS, "[]"))
        (0 until rows.length()).mapNotNull { index ->
            rows.optJSONObject(index)?.let { row ->
                Event(
                    id = PayloadSanitizer.text(row.optString("id"), 160),
                    title = PayloadSanitizer.text(row.optString("title"), 80).ifBlank { "DPoS Space" },
                    text = PayloadSanitizer.text(row.optString("text"), 600),
                    route = RoutePolicy.sanitizeRoute(row.optString("route")),
                    read = row.optBoolean("read", false)
                )
            }?.takeIf { it.id.isNotBlank() }
        }
    }.getOrDefault(emptyList())

    private fun readSeen(): LinkedHashSet<String> = runCatching {
        val rows = JSONArray(prefs.getString(KEY_SEEN_IDS, "[]"))
        LinkedHashSet<String>().apply {
            for (index in 0 until rows.length()) {
                PayloadSanitizer.text(rows.optString(index), 160).takeIf { it.isNotBlank() }?.let(::add)
            }
        }
    }.getOrDefault(linkedSetOf())

    private fun stableId(id: String?, title: String, text: String, route: String): String {
        val identity = id?.takeIf { it.isNotBlank() } ?: "$title\u0000$text\u0000$route"
        val digest = MessageDigest.getInstance("SHA-256")
            .digest(identity.toByteArray(Charsets.UTF_8))
            .joinToString(":") { "%02x".format(it) }
        return "event:$digest"
    }

    companion object {
        internal const val PREFS_NAME = "notification_inbox_v1"
        internal const val MAX_RETAINED_EVENTS = 100
        internal const val MAX_DEDUP_IDS = 1000
        private const val KEY_EVENTS = "events"
        private const val KEY_SEEN_IDS = "seen_ids"
        private const val KEY_UNREAD_COUNT = "unread_count"
        private val lock = Any()
    }
}
