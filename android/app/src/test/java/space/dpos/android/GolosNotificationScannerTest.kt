package space.dpos.android

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import space.dpos.android.notifications.GolosNotificationScanner
import space.dpos.android.notifications.HistoryEvent

class GolosNotificationScannerTest {
    @Test fun firstRunBaselinesWithoutSpam() {
        val scanner = GolosNotificationScanner()
        val (cursor, notifications) = scanner.scan("denis", null, listOf(HistoryEvent(7, "comment", mapOf("author" to "alice", "parent_author" to "denis"))), baselineDone = false)
        assertEquals(7, cursor)
        assertTrue(notifications.isEmpty())
    }
    @Test fun emitsIncomingAndIgnoresOutgoing() {
        val scanner = GolosNotificationScanner()
        val rows = listOf(
            HistoryEvent(8, "comment", mapOf("author" to "alice", "parent_author" to "denis", "permlink" to "p")),
            HistoryEvent(9, "transfer", mapOf("from" to "denis", "to" to "bob", "amount" to "1 GOLOS"))
        )
        val (_, notifications) = scanner.scan("denis", 7, rows, baselineDone = true)
        assertEquals(1, notifications.size)
        assertEquals("Новый комментарий", notifications[0].title)
    }
}
