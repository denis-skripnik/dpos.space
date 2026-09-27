package space.dpos.android

import java.net.ServerSocket
import kotlin.concurrent.thread
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import space.dpos.android.notifications.GolosHistoryClient
import space.dpos.android.notifications.HistoryEvent
import space.dpos.android.upvoter.*

class GolosExistingVoteRecoveryTest {
    private val operation = VoteOperation("golos", "denis-skripnik", "nadiyamikhno", "kaliko", 7000)
    private class Store(fresh: Boolean = false) : PendingBroadcastStore {
        var value: PendingBroadcastIntent? = if (fresh) null else PendingBroadcastIntent("vote", "golos", "denis-skripnik", "nadiyamikhno|kaliko|7000", 83306)
        override fun readPending(kind: String, chainId: String, account: String) = value
        override fun savePending(intent: PendingBroadcastIntent) { value = intent }
        override fun clearPending(kind: String, chainId: String, account: String) { value = null }
    }
    private fun check(percent: Int?, voter: String = "denis-skripnik", rpcError: Boolean = false, candidate: VoteOperation = operation, fresh: Boolean = false): Pair<VoteBroadcastResult, Store> {
        val store = Store(fresh)
        val server = ServerSocket(0, 10, java.net.InetAddress.getByName("127.0.0.1"))
        val worker = thread(isDaemon = true) {
          while (!server.isClosed) {
            val socket = try { server.accept() } catch (_: java.net.SocketException) { break }
            socket.use {
            val reader = socket.getInputStream().bufferedReader()
            var length = 0
            while (true) {
                val line = reader.readLine() ?: break
                if (line.isEmpty()) break
                if (line.startsWith("Content-Length:", true)) length = line.substringAfter(':').trim().toInt()
            }
            val body = CharArray(length)
            var offset = 0
            while (offset < length) { val n = reader.read(body, offset, length - offset); if (n < 0) break; offset += n }
            val request = JSONObject(String(body))
            val params = request.getJSONArray("params")
            val method = params.getString(1)
            val response = if (method == "get_active_votes") {
                assertEquals("social_network", params.getString(0))
                assertEquals("nadiyamikhno", params.getJSONArray(2).getString(0))
                assertEquals("kaliko", params.getJSONArray(2).getString(1))
                if (rpcError) """{"error":{"message":"offline"}}"""
                else if (percent == null) """{"result":[]}"""
                else """{"result":[{"voter":"$voter","percent":$percent,"weight":0,"time":"2026-09-19T18:54:09"}]}"""
            } else if (method == "get_dynamic_global_properties") {
                """{"result":{"head_block_number":100,"head_block_id":"0000006401020304000000000000000000000000","time":"2026-09-22T10:00:00"}}"""
            } else if (method == "get_block") {
                """{"result":{"previous":"0000006101020304000000000000000000000000"}}"""
            } else error("unexpected RPC $method")
            val bytes = response.toByteArray()
            socket.getOutputStream().apply {
                write("HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: ${bytes.size}\r\nConnection: close\r\n\r\n".toByteArray())
                write(bytes); flush()
            }
            }
          }
        }
        try {
            val history = object : GolosHistoryClient {
                override fun getAccountHistory(account: String, from: Long, limit: Int): List<HistoryEvent> {
                    return listOf(
                    HistoryEvent(83294, "vote", mapOf("voter" to "denis-skripnik", "author" to "nadiyamikhno", "permlink" to "kaliko", "weight" to "7000")),
                    HistoryEvent(83307, "transfer", emptyMap())
                )
                }
            }
            val broadcaster = object : VoteBroadcaster {
                override fun broadcast(signedTransaction: JSONObject): JSONObject = error("must not broadcast")
            }
            val runtime = VoteRuntime(HttpGolosRpcClient("http://127.0.0.1:${server.localPort}"), broadcaster = broadcaster,
                historyClient = history, confirmationRetries = 1, confirmationDelayMs = 0, pendingStore = store)
            return runtime.execute(candidate, null, null) to store
        } finally { server.close(); worker.join(1000) }
    }
    @Test fun matchingCurrentPercentCannotResolveUnknownPending() {
        val (result, store) = check(7000)
        assertEquals("broadcast_unknown", result.status)
        assertFalse(result.ok)
        assertNotNull(store.value)
        assertEquals("identity_unavailable", result.diagnostics!!.getJSONObject("confirmation").getString("status"))
        assertTrue(result.reason.contains("ID транзакции"))
    }
    @Test fun freshMatchingVoteSkipsBeforeSigningOrBroadcast() {
        val (result, store) = check(7000, fresh = true)
        assertEquals("already_voted", result.status)
        assertTrue(result.ok)
        assertNull(store.value)
    }
    @Test fun oldHistoryAloneOrDifferentCurrentVoteDoesNotClearPending() {
        for (percent in listOf(null, 3333, 0)) {
            val (result, store) = check(percent)
            assertEquals("broadcast_unknown", result.status)
            assertNotNull(store.value)
        }
    }
    @Test fun wrongVoterOrUnavailableRpcDoesNotClearPending() {
        for ((voter, error) in listOf("someone" to false, "denis-skripnik" to true)) {
            val (result, store) = check(7000, voter, error)
            assertEquals("broadcast_unknown", result.status)
            assertNotNull(store.value)
        }
    }
    @Test fun differentCandidateRemainsBlockedByUnknownPending() {
        val (result, store) = check(7000, candidate = operation.copy(author = "alice", permlink = "new-post"))
        assertNotNull(store.value)
        assertFalse(result.ok)
        assertEquals("broadcast_unknown", result.status)
        assertNotEquals("already_voted", result.status)
    }
}
