package space.dpos.android

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assert.assertFalse
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
    @Test fun vizAwardNotificationsAreIncomingAndRoutedToVizHistory() {
        val scanner = GolosNotificationScanner(chainId = "viz")
        val rows = listOf(
            HistoryEvent(12, "award", mapOf("initiator" to "alice", "receiver" to "denis", "shares" to "1.000000 SHARES")),
            HistoryEvent(13, "fixed_award", mapOf("initiator" to "denis", "receiver" to "alice", "reward_amount" to "1.000 VIZ")),
            HistoryEvent(14, "benefactor_award", mapOf("benefactor" to "bob", "receiver" to "denis", "shares" to "0.100000 SHARES"))
        )
        val (_, notifications) = scanner.scan("denis", 11, rows, baselineDone = true)
        assertEquals(2, notifications.size)
        assertTrue(notifications[0].id.startsWith("viz:denis:"))
        assertTrue(notifications[0].route.contains("#chain=viz&app=history&account=denis&ops=award"))
        assertTrue(notifications.any { it.title.contains("Бенефициарская") })
        assertFalse(notifications.any { it.text.contains("@denis, 1.000 VIZ") })
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
