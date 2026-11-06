package space.dpos.android

import android.Manifest
import android.app.Notification
import android.app.NotificationManager
import android.content.Context
import android.content.ContextWrapper
import androidx.test.core.app.ApplicationProvider
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import space.dpos.android.notifications.*
import space.dpos.android.runtime.AccountImportRequest
import space.dpos.android.runtime.WorkerCommandPolicy
import space.dpos.android.storage.NotificationCursor
import space.dpos.android.storage.WorkerStore
import space.dpos.android.upvoter.PlanningReadBudget
import space.dpos.android.worker.DposWorkerRunner
import space.dpos.android.worker.WorkerCancellation
import java.net.InetAddress
import java.net.ServerSocket
import java.net.Socket
import java.net.SocketException
import java.util.Collections
import java.util.UUID
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference

/** Connected partial-batch recovery and bounded rate-read acceptance scenarios. */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class CurationNotificationAcceptanceTest {
    private lateinit var context: Context
    private lateinit var store: WorkerStore
    private var afterPersistedPermissionRead: () -> Unit = {}
    private val manager get() = context.getSystemService(NotificationManager::class.java)

    @Before fun setup() {
        val base = ApplicationProvider.getApplicationContext<Context>()
        awaitNativeStorage()
        WorkerCancellation.resetForTest()
        context = object : ContextWrapper(base) {
            private val isolated = java.io.File(base.filesDir, "curation-acceptance-${UUID.randomUUID()}").apply { mkdirs() }
            override fun getFilesDir() = isolated
            // ContextCompat uses checkPermission on this context. This observes the real
            // helper's permission read AFTER add().commit() has returned and released its
            // inbox monitor, rather than racing an asynchronously dispatched prefs listener.
            override fun checkPermission(permission: String, pid: Int, uid: Int): Int {
                if (permission == Manifest.permission.POST_NOTIFICATIONS) afterPersistedPermissionRead()
                return super.checkPermission(permission, pid, uid)
            }
        }
        context.getSharedPreferences("dpos_worker", 0).edit().clear().commit()
        context.getSharedPreferences(NotificationInbox.PREFS_NAME, 0).edit().clear().commit()
        store = WorkerStore(context, context.getSharedPreferences("curation-acceptance-keys", 0))
        assertEquals("verified", store.checkpointStatus().optString("authority"))
        store.setWorkerEnabled(true)
        manager.cancelAll()
        shadowOf(base as android.app.Application).grantPermissions(Manifest.permission.POST_NOTIFICATIONS)
    }

    private fun reward(index: Long, raw: String = "2.123000 VESTS") =
        HistoryEvent(index, "curation_reward", mapOf("curator" to "alice", "reward" to raw))

    private fun summary() = manager.activeNotifications.single {
        it.id == NotificationHelper.EVENT_SUMMARY_NOTIFICATION_ID
    }.notification

    private fun stableId(index: Long, chain: String = "hive"): String = "event:" +
        java.security.MessageDigest.getInstance("SHA-256")
            .digest("$chain:alice:$index:curation_reward".toByteArray(Charsets.UTF_8))
            .joinToString(":") { "%02x".format(it) }

    @Test fun stopAfterFirstPersistedRewardResumesRemainingBatchWithoutDuplicateOrCursorLoss() {
        val decision = WorkerCommandPolicy.validateImport(AccountImportRequest("hive", "alice",
            enableNotifications = true, enableAutoUpvoter = false, explicitConsent = true,
            notificationOps = listOf("curation_reward")))
        assertTrue(decision.accepted)
        store.importDecision(decision)
        store.saveCursor(NotificationCursor("hive", "alice", 8, true))
        val batch = listOf(reward(9), reward(10, "4.000000 VESTS"), reward(11, "6.000000 VESTS"))
        var historyReads = 0
        var rateReads = 0
        fun run() = DposWorkerRunner(context, store, historyOverride = { _ -> object : GolosHistoryClient {
            override fun getAccountHistory(account: String, from: Long, limit: Int): List<HistoryEvent> {
                assertEquals(-1L, from)
                historyReads++
                return batch
            }
        } }, curationPropertiesOverride = { _, _ ->
            rateReads++
            JSONObject().put("total_vesting_fund_hive", "500.000 HIVE")
                .put("total_vesting_shares", "1000.000000 VESTS")
        }).runOnce("curation-acceptance")

        val oldGeneration = WorkerCancellation.token { true }
        var stops = 0
        var atStop: NotificationInbox.Snapshot? = null
        afterPersistedPermissionRead = {
            val persisted = NotificationInbox(context).snapshot()
            if (persisted.events.isNotEmpty()) {
                // Disarm before invoking real Stop primitives; no sleeps or polling race.
                afterPersistedPermissionRead = {}
                stops++
                atStop = persisted
                assertEquals(listOf(stableId(9)), persisted.events.map { it.id })
                assertEquals(8L, store.readCursor("hive", "alice").lastIndex)
                WorkerCancellation.cancelAll()
                store.setWorkerEnabled(false)
            }
        }
        val stopped = try { run() } finally { afterPersistedPermissionRead = {} }
        assertTrue(stopped.ok)
        assertEquals(1, stops)
        assertEquals(1, stopped.notificationsShown)
        assertFalse(oldGeneration.mayContinue())
        assertFalse(store.workerEnabled())
        val first = requireNotNull(atStop)
        assertEquals(1, first.unreadCount)
        assertFalse(first.events.single().read)
        assertEquals("2.123000 VESTS", first.events.single().text)
        assertEquals(first, NotificationInbox(context).snapshot())
        assertEquals(NotificationCursor("hive", "alice", 8, true), store.readCursor("hive", "alice"))
        assertTrue(summary().extras.getCharSequence(Notification.EXTRA_TEXT).toString().contains("≈ +1.062 HP"))
        assertEquals(1, rateReads)

        // A stopped invocation cannot consume or advance the unfinished batch.
        assertEquals(0, run().notificationsShown)
        assertEquals(1, historyReads)
        assertEquals(first, NotificationInbox(context).snapshot())
        val readFirst = NotificationHelper.markAllRead(context).events.single()
        assertTrue(readFirst.read)
        assertEquals(0, NotificationInbox(context).snapshot().unreadCount)
        assertTrue(manager.activeNotifications.none { it.id == NotificationHelper.EVENT_SUMMARY_NOTIFICATION_ID })

        store.setWorkerEnabled(true)
        assertTrue(WorkerCancellation.token { store.workerEnabled() }.mayContinue())
        assertFalse(oldGeneration.mayContinue()) // enabling must not resurrect the cancelled run
        val resumed = run()
        assertTrue(resumed.ok)
        assertEquals(2, historyReads)
        assertEquals(2, rateReads)
        val completed = NotificationInbox(context).snapshot()
        assertEquals(listOf(stableId(9), stableId(10), stableId(11)), completed.events.map { it.id })
        assertEquals(readFirst, completed.events.first())
        assertEquals(listOf(true, false, false), completed.events.map { it.read })
        assertEquals(listOf("2.123000 VESTS", "4.000000 VESTS", "6.000000 VESTS"), completed.events.map { it.text })
        assertEquals(2, completed.unreadCount)
        assertEquals(2, summary().number)
        assertEquals(NotificationCursor("hive", "alice", 11, true), store.readCursor("hive", "alice"))
        // notificationsShown counts helper invocations, INCLUDING dedup hits; do not use it
        // as the number of fresh persisted events when replaying the partial batch.
        assertEquals(0, run().notificationsShown)
        assertEquals(completed, NotificationInbox(context).snapshot())
        assertEquals(2, rateReads)
    }

    /** Accept/read the RPC, then withhold all response bytes until teardown. No timed sleep. */
    private class SilentNode : AutoCloseable {
        private val server = ServerSocket(0, 8, InetAddress.getByName("127.0.0.1"))
        private val executor = Executors.newSingleThreadExecutor()
        private val release = CountDownLatch(1)
        private val active = AtomicReference<Socket?>()
        val requests = Collections.synchronizedList(mutableListOf<JSONObject>())
        val endpoint = "http://127.0.0.1:${server.localPort}/"
        private val task = executor.submit {
            try {
                server.accept().use { socket ->
                    active.set(socket)
                    socket.soTimeout = 4_000
                    val reader = socket.getInputStream().bufferedReader(Charsets.UTF_8)
                    var length = 0
                    while (true) {
                        val line = reader.readLine() ?: error("unexpected request EOF")
                        if (line.isEmpty()) break
                        if (line.startsWith("Content-Length:", true)) length = line.substringAfter(':').trim().toInt()
                    }
                    require(length in 1..65536)
                    val chars = CharArray(length)
                    var offset = 0
                    while (offset < length) {
                        val count = reader.read(chars, offset, length - offset)
                        check(count > 0)
                        offset += count
                    }
                    requests += JSONObject(String(chars))
                    check(release.await(15, TimeUnit.SECONDS)) { "test did not tear down silent node" }
                }
            } catch (e: SocketException) {
                // Only teardown may close an unvisited listener/active socket.
                if (!server.isClosed) throw e
            }
        }
        override fun close() {
            server.close()
            release.countDown()
            active.get()?.close()
            executor.shutdown()
            try {
                task.get(5, TimeUnit.SECONDS) // propagate handler assertions, not just termination
            } finally {
                executor.shutdownNow()
                check(executor.awaitTermination(5, TimeUnit.SECONDS))
            }
        }
    }

    @Test fun multipleSilentEndpointsExhaustSharedBudgetButStillPostRawPreservingFallbacks() {
        SilentNode().use { first -> SilentNode().use { second ->
            SilentNode().use { third -> SilentNode().use { fourth ->
                val nodes = listOf(first, second, third, fourth)
                val endpointLookups = mutableListOf<String>()
                val pass = CurationRewardDisplayPass(totalBudgetMs = 1_200, endpoints = { chain ->
                    endpointLookups += chain
                    nodes.map { it.endpoint }
                })
                val history = object : GolosHistoryClient {
                    override fun getAccountHistory(account: String, from: Long, limit: Int) =
                        listOf(reward(9), reward(10, "4.000000 VESTS"))
                }
                // Connected scanner -> real deadline transport -> real helper/inbox/OS summary.
                // Worker endpoint injection is not available; no production hook is introduced.
                val (cursor, events) = GolosNotificationScanner(history, "hive")
                    .fetchAndScan("alice", 8, true, selectedOps = listOf("curation_reward"))
                assertEquals(10L, cursor)
                assertEquals(2, events.size)
                val start = System.nanoTime()
                events.forEach { event ->
                    val display = pass.text(event)
                    assertEquals(CurationRewardDisplay.FALLBACK, display)
                    NotificationHelper.showEvent(context, event.title, event.text, event.id, event.route, display)
                }
                val elapsedMs = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - start)
                // Local-loopback test-host allowance, NOT a DNS/TLS/platform wall-clock SLA.
                assertTrue("loopback budget path took ${elapsedMs}ms", elapsedMs < 5_000)
                assertEquals(1, first.requests.size)
                assertEquals(1, second.requests.size)
                // Millisecond truncation can leave a final sub-attempt; do not require an
                // exact two-attempt count. There must still be an unvisited slow endpoint.
                assertTrue(third.requests.size <= 1)
                assertTrue(fourth.requests.isEmpty())
                assertEquals(listOf("hive"), endpointLookups) // second event reused failed cache
                nodes.flatMap { it.requests.toList() }.forEach { request ->
                    assertEquals("database_api.get_dynamic_global_properties", request.getString("method"))
                }
                val counts = nodes.map { it.requests.size }
                val anotherChain = events.first().copy(id = "golos:alice:9:curation_reward",
                    text = "2.123000 GESTS", route = "#chain=golos&app=history&account=alice&ops=curation_reward")
                assertEquals(CurationRewardDisplay.FALLBACK, pass.text(anotherChain))
                assertEquals(counts, nodes.map { it.requests.size })
                assertNull(PlanningReadBudget.remainingMs())
                val saved = NotificationInbox(context).snapshot()
                assertEquals(events.map { stableId(it.sourceIndex) }, saved.events.map { it.id })
                assertEquals(events.map { it.text }, saved.events.map { it.text })
                assertEquals(2, saved.unreadCount)
                assertTrue(saved.events.none { it.read })
                val card = summary()
                assertEquals(2, card.number)
                assertTrue(card.extras.getCharSequence(Notification.EXTRA_TEXT).toString().endsWith(CurationRewardDisplay.FALLBACK))
                assertFalse(card.extras.toString().contains("VESTS"))
                assertFalse(card.extras.toString().contains("GESTS"))
            } }
        } }
    }
}
