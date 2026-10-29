package space.dpos.android

import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import space.dpos.android.upvoter.*
import java.net.ServerSocket
import java.net.InetAddress
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

class PlanningTransportTest {
    @Test fun realTransportDeadlineStopsBlockedBodyAndSlowDripBodyAndHeaders() {
        for (mode in listOf("blocked", "body", "headers")) {
            val server = ServerSocket(0, 10, InetAddress.getByName("127.0.0.1"))
            val pool = Executors.newSingleThreadExecutor()
            val task = pool.submit {
                try { server.accept().use { socket ->
                    val reader = socket.getInputStream().bufferedReader()
                    var length = 0
                    reader.readLine()
                    while (true) { val line = reader.readLine() ?: break; if (line.isEmpty()) break
                        if (line.startsWith("Content-Length:", true)) length = line.substringAfter(':').trim().toInt() }
                    repeat(length) { reader.read() }
                    val output = socket.getOutputStream()
                    if (mode != "headers") {
                        output.write("HTTP/1.1 200 OK\r\nContent-Length: 10000\r\nConnection: close\r\n\r\n".toByteArray()); output.flush()
                    }
                    repeat(150) {
                        if (mode != "blocked") { output.write(if (mode == "headers") 'H'.code else ' '.code); output.flush() }
                        Thread.sleep(20)
                    }
                } } catch (_: Exception) { }
            }
            val start = System.nanoTime()
            val result = runCatching { PlanningReadBudget.within(300) {
                HttpGrapheneRpcClient(GrapheneChainSpecs.require("golos"), "http://127.0.0.1:${server.localPort}/").getGolosContent("a", "b")
            } }
            val elapsed = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - start)
            server.close(); task.cancel(true); pool.shutdownNow(); pool.awaitTermination(5, TimeUnit.SECONDS)
            assertTrue("$mode accepted partial reply", result.isFailure)
            assertTrue("$mode deadline took ${elapsed}ms", elapsed < 1300)
        }
    }
}
