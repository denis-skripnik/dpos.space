package space.dpos.android

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import space.dpos.android.notifications.GolosHistoryClient
import space.dpos.android.notifications.GolosNotificationScanner
import space.dpos.android.notifications.HistoryEvent

class GolosNotificationPaginationTest {
    private class RecordingHistoryClient(private val rows: List<HistoryEvent>) : GolosHistoryClient {
        val requests = mutableListOf<Pair<Long, Int>>()

        override fun getAccountHistory(account: String, from: Long, limit: Int): List<HistoryEvent> {
            requests += from to limit
            return rows
        }
    }

    @Test fun resumedScanReadsLatestPageInsteadOfUsingLocalCursorAsGrapheneFrom() {
        val client = RecordingHistoryClient(listOf(
            HistoryEvent(2, "transfer", mapOf("from" to "alice", "to" to "denis", "amount" to "1 GOLOS")),
            HistoryEvent(3, "transfer", mapOf("from" to "bob", "to" to "denis", "amount" to "2 GOLOS"))
        ))

        val (cursor, notifications) = GolosNotificationScanner(client).fetchAndScan(
            account = "denis",
            cursor = 2,
            baselineDone = true,
            limit = 50
        )

        assertEquals(listOf(-1L to 50), client.requests)
        assertEquals(3L, cursor)
        assertEquals(listOf(3L), notifications.map { it.sourceIndex })
    }

    @Test fun firstRunStillBaselinesLatestPageWithoutNotifications() {
        val client = RecordingHistoryClient(listOf(
            HistoryEvent(7, "transfer", mapOf("from" to "alice", "to" to "denis", "amount" to "1 GOLOS"))
        ))

        val (cursor, notifications) = GolosNotificationScanner(client).fetchAndScan(
            account = "denis",
            cursor = null,
            baselineDone = false
        )

        assertEquals(listOf(-1L to 50), client.requests)
        assertEquals(7L, cursor)
        assertTrue(notifications.isEmpty())
    }

    @Test fun explicitEmptyFilterAdvancesCursorWithoutNotifications() {
        val client = RecordingHistoryClient(listOf(
            HistoryEvent(4, "transfer", mapOf("from" to "alice", "to" to "denis", "amount" to "1 GOLOS"))
        ))

        val (cursor, notifications) = GolosNotificationScanner(client).fetchAndScan(
            account = "denis",
            cursor = 3,
            baselineDone = true,
            selectedOps = emptyList()
        )

        assertEquals(4L, cursor)
        assertTrue(notifications.isEmpty())
    }
}
