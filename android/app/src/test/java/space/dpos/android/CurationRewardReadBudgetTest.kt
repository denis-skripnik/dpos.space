package space.dpos.android

import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import space.dpos.android.notifications.CurationRewardDisplay
import space.dpos.android.notifications.CurationRewardDisplayPass
import space.dpos.android.notifications.DposEventNotification
import space.dpos.android.upvoter.PlanningReadBudget
import java.net.InetAddress
import java.net.ServerSocket
import java.util.Collections
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean

/** Loopback only: exercise the real disconnecting HTTP path, not a timeout around a fake Future. */
class CurationRewardReadBudgetTest {
    private val event = DposEventNotification("reward", "reward", "2 VESTS", "#chain=hive&ops=curation_reward", 9)
    private val properties = JSONObject().put("total_vesting_fund_hive", "500.000 HIVE")
        .put("total_vesting_shares", "1000.000000 VESTS")

    private class Node(private val delayMs: Long = 0, private val respond: () -> String) : AutoCloseable {
        private val server = ServerSocket(0, 8, InetAddress.getByName("127.0.0.1"))
        private val executor = Executors.newSingleThreadExecutor()
        val received = CountDownLatch(1)
        val requests = Collections.synchronizedList(mutableListOf<JSONObject>())
        val endpoint = "http://127.0.0.1:${server.localPort}/"
        init {
            executor.submit {
                try {
                    server.accept().use { socket ->
                        socket.soTimeout = 3_000
                        val reader = socket.getInputStream().bufferedReader()
                        var length = 0
                        while (true) {
                            val line = reader.readLine() ?: error("unexpected EOF")
                            if (line.isEmpty()) break
                            if (line.startsWith("Content-Length:", true)) length = line.substringAfter(':').trim().toInt()
                        }
                        val body = CharArray(length)
                        var offset = 0
                        while (offset < length) {
                            val count = reader.read(body, offset, length - offset)
                            check(count > 0); offset += count
                        }
                        requests += JSONObject(String(body))
                        received.countDown()
                        Thread.sleep(delayMs)
                        val bytes = respond().toByteArray(Charsets.UTF_8)
                        socket.getOutputStream().apply {
                            write("HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: ${bytes.size}\r\nConnection: close\r\n\r\n".toByteArray())
                            write(bytes); flush()
                        }
                    }
                } catch (_: java.io.IOException) {
                    // Expected when the transport deadline disconnects the slow node.
                } catch (_: InterruptedException) {
                    Thread.currentThread().interrupt()
                }
            }
        }
        override fun close() {
            server.close()
            executor.shutdownNow()
            check(executor.awaitTermination(4, TimeUnit.SECONDS))
        }
    }

    @Test fun slowFirstNodeDoesNotSpendOrRetainTheNextNodesDeadline() {
        Node(1_100) { "{}" }.use { slow ->
            Node { JSONObject().put("result", properties).toString() }.use { healthy ->
                val pass = CurationRewardDisplayPass(endpoints = { listOf(slow.endpoint, healthy.endpoint) })
                val start = System.nanoTime()
                assertEquals("≈ +1.000 HP (по текущему соотношению)", pass.text(event))
                assertTrue(TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - start) < 3_000)
                assertEquals(1, slow.requests.size)
                assertEquals(1, healthy.requests.size)
                assertEquals("database_api.get_dynamic_global_properties", healthy.requests.single().getString("method"))
                assertEquals("≈ +1.000 HP (по текущему соотношению)", pass.text(event.copy(id = "another")))
                assertEquals(1, healthy.requests.size)
                assertNull(PlanningReadBudget.remainingMs())
            }
        }
    }

    @Test fun revocationDuringActiveReadReturnsFallbackWithoutTryingAnotherNode() {
        val permit = AtomicBoolean(true)
        Node(1_100) { "{}" }.use { slow ->
            Node { JSONObject().put("result", properties).toString() }.use { healthy ->
                val cancellation = Executors.newSingleThreadExecutor()
                try {
                    cancellation.submit { check(slow.received.await(3, TimeUnit.SECONDS)); permit.set(false) }
                    val pass = CurationRewardDisplayPass(endpoints = { listOf(slow.endpoint, healthy.endpoint) })
                    assertEquals(CurationRewardDisplay.FALLBACK, pass.text(event) { permit.get() })
                    assertEquals(1, slow.requests.size)
                    assertTrue(healthy.requests.isEmpty())
                    assertNull(PlanningReadBudget.remainingMs())
                } finally {
                    cancellation.shutdownNow()
                    assertTrue(cancellation.awaitTermination(4, TimeUnit.SECONDS))
                }
            }
        }
    }

    @Test fun outerExpiredReadScopeCannotBeExtendedByNotificationReads() {
        Node { JSONObject().put("result", properties).toString() }.use { node ->
            val pass = CurationRewardDisplayPass(endpoints = { listOf(node.endpoint) })
            val shown = PlanningReadBudget.within(0) { pass.text(event) }
            assertEquals(CurationRewardDisplay.FALLBACK, shown)
            assertTrue(node.requests.isEmpty())
            assertNull(PlanningReadBudget.remainingMs())
        }
    }
}
