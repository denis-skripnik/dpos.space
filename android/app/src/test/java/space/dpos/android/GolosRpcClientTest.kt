package space.dpos.android

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import space.dpos.android.notifications.GolosHistoryRpc
import space.dpos.android.notifications.GolosNotificationScanner

class GolosRpcClientTest {
    @Test fun parsesCondenserHistoryRowsIntoEvents() {
        val json = """{"result":[[12,{"op":["transfer",{"from":"alice","to":"denis","amount":"1.000 GOLOS"}],"timestamp":"2026-07-26T10:00:00"}],[13,{"op":["comment",{"author":"denis","parent_author":"","permlink":"own"}],"timestamp":"2026-07-26T10:01:00"}]]}"""
        val rows = GolosHistoryRpc.parseAccountHistory(json)
        assertEquals(2, rows.size)
        assertEquals(12L, rows[0].index)
        assertEquals("transfer", rows[0].type)
        assertEquals("alice", rows[0].data["from"])

        val (_, notifications) = GolosNotificationScanner().scan("denis", 11, rows, baselineDone = true)
        assertEquals(1, notifications.size)
        assertTrue(notifications[0].id.contains("transfer"))
    }

    @Test fun buildsBoundedAccountHistoryPayload() {
        val payload = GolosHistoryRpc.buildAccountHistoryPayload("@Denis", from = 100, limit = 50)
        assertTrue(payload.contains("condenser_api.get_account_history"))
        assertTrue(payload.contains("\"denis\""))
        assertTrue(payload.contains("100"))
        assertTrue(payload.contains("50"))
    }
}
