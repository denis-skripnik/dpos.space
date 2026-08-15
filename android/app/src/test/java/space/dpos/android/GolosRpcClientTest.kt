package space.dpos.android

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import space.dpos.android.notifications.FallbackGrapheneHistoryClient
import space.dpos.android.notifications.GolosHistoryClient
import space.dpos.android.notifications.GolosHistoryRpc
import space.dpos.android.notifications.GolosNotificationScanner
import space.dpos.android.notifications.HistoryEvent
import space.dpos.android.upvoter.FallbackGolosDiscussionClient
import space.dpos.android.upvoter.FallbackGrapheneRpcClient
import space.dpos.android.upvoter.FavoritePostRow
import space.dpos.android.upvoter.GolosDiscussionClient
import space.dpos.android.upvoter.GolosRpcClient

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

    @Test fun historyClientFallsBackAfterForbiddenRpcEndpoint() {
        val bad = object : GolosHistoryClient {
            override fun getAccountHistory(account: String, from: Long, limit: Int): List<HistoryEvent> {
                throw IllegalStateException("Graphene RPC HTTP 403")
            }
        }
        val good = object : GolosHistoryClient {
            override fun getAccountHistory(account: String, from: Long, limit: Int): List<HistoryEvent> = listOf(
                HistoryEvent(7, "transfer", mapOf("from" to "alice", "to" to account))
            )
        }
        val rows = FallbackGrapheneHistoryClient(listOf(bad, good)).getAccountHistory("denis", -1, 50)
        assertEquals(1, rows.size)
        assertEquals(7L, rows.single().index)
    }

    @Test fun discussionClientFallsBackAfterForbiddenRpcEndpoint() {
        val bad = object : GolosDiscussionClient {
            override fun getBlogPosts(account: String, limit: Int): List<FavoritePostRow> {
                throw IllegalStateException("Graphene discussion RPC HTTP 403")
            }
        }
        val good = object : GolosDiscussionClient {
            override fun getBlogPosts(account: String, limit: Int): List<FavoritePostRow> = listOf(FavoritePostRow(account, "fresh"))
        }
        val rows = FallbackGolosDiscussionClient(listOf(bad, good)).getBlogPosts("alice", 20)
        assertEquals("fresh", rows.single().permlink)
    }

    @Test fun nativeRpcClientFallsBackAfterForbiddenRpcEndpoint() {
        val bad = object : GolosRpcClient {
            override fun getDynamicGlobalProperties(): JSONObject { throw IllegalStateException("Graphene RPC HTTP 403") }
            override fun getBlock(blockNumber: Long): JSONObject? = JSONObject().put("previous", "0000007901020304000000000000000000000000000000000000000000000000")
        override fun getAccount(account: String): JSONObject? { throw IllegalStateException("Graphene RPC HTTP 403") }
            override fun broadcastTransactionSynchronous(signedTransaction: JSONObject): JSONObject { throw IllegalStateException("Graphene RPC HTTP 403") }
        }
        val good = object : GolosRpcClient {
            override fun getDynamicGlobalProperties(): JSONObject = JSONObject().put("head_block_number", 1)
            override fun getBlock(blockNumber: Long): JSONObject? = JSONObject().put("previous", "0000007901020304000000000000000000000000000000000000000000000000")
        override fun getAccount(account: String): JSONObject? = JSONObject().put("name", account)
            override fun broadcastTransactionSynchronous(signedTransaction: JSONObject): JSONObject = JSONObject().put("ok", true)
        }
        val client = FallbackGrapheneRpcClient(listOf(bad, good))
        assertEquals(1, client.getDynamicGlobalProperties().getInt("head_block_number"))
        assertEquals("denis", client.getAccount("denis")!!.getString("name"))
        assertTrue(client.broadcastTransactionSynchronous(JSONObject()).getBoolean("ok"))
    }
}
