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

    @Test fun buildsGolosAccountHistoryPayloadForLegacyGolosApi() {
        val payload = GolosHistoryRpc.buildAccountHistoryPayload("@denis-skripnik", from = -1, limit = 50, legacyCallRpc = true, apiName = "account_history")
        assertTrue(payload.contains("\"method\":\"call\""))
        assertTrue(payload.contains("\"account_history\""))
        assertTrue(payload.contains("\"get_account_history\""))
        assertTrue(payload.contains("\"denis-skripnik\""))
    }

    @Test fun rpcErrorIsNotSilentlyTreatedAsEmptyHistory() {
        val json = """{"jsonrpc":"2.0","error":{"code":-32601,"message":"Could not find API condenser_api"},"id":1}"""
        try {
            GolosHistoryRpc.parseAccountHistory(json)
            throw AssertionError("expected parser to reject RPC error")
        } catch (e: IllegalStateException) {
            assertTrue(e.message!!.contains("Could not find API"))
        }
    }
}
