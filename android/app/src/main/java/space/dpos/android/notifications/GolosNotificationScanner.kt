package space.dpos.android.notifications

data class HistoryEvent(val index: Long, val type: String, val data: Map<String, String>, val timestamp: String = "")
data class DposEventNotification(val id: String, val title: String, val text: String, val route: String, val sourceIndex: Long)

class GolosNotificationScanner {
    fun scan(account: String, cursor: Long?, rows: List<HistoryEvent>, baselineDone: Boolean): Pair<Long, List<DposEventNotification>> {
        val target = account.trim().removePrefix("@").lowercase()
        val sorted = rows.sortedBy { it.index }
        val newest = sorted.maxOfOrNull { it.index } ?: cursor ?: -1L
        if (!baselineDone) return newest to emptyList()
        val minIndex = cursor ?: -1L
        val notifications = sorted.filter { it.index > minIndex }.mapNotNull { toNotification(target, it) }
        return newest to notifications
    }

    fun toNotification(account: String, event: HistoryEvent): DposEventNotification? {
        val target = account.lowercase()
        fun norm(v: String?) = v.orEmpty().trim().removePrefix("@").lowercase()
        return when (event.type) {
            "comment" -> {
                val author = norm(event.data["author"])
                val parent = norm(event.data["parent_author"])
                if (parent == target && author != target) DposEventNotification("golos:$target:${event.index}:comment", "Новый комментарий", "@$author ответил к материалу @$target", "#chain=golos&app=post&author=$author&permlink=${event.data["permlink"].orEmpty()}", event.index) else null
            }
            "content_mentions", "comment_mention" -> {
                val author = norm(event.data["author"] ?: event.data["mentioned_by"])
                if (author != target) DposEventNotification("golos:$target:${event.index}:mention", "Новое упоминание", "@$author упомянул $target", "#chain=golos&app=notifications&account=$target", event.index) else null
            }
            "transfer", "donate" -> {
                val from = norm(event.data["from"])
                val to = norm(event.data["to"] ?: event.data["receiver"])
                if (to == target && from != target) DposEventNotification("golos:$target:${event.index}:${event.type}", if (event.type == "donate") "Новый донат" else "Входящий перевод", "от @$from, ${event.data["amount"].orEmpty()}", "#chain=golos&app=history&account=$target&ops=${event.type}", event.index) else null
            }
            else -> null
        }
    }
}
