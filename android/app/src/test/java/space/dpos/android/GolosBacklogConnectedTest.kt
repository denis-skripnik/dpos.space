package space.dpos.android

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import space.dpos.android.notifications.*
import space.dpos.android.runtime.*
import space.dpos.android.storage.WorkerStore
import space.dpos.android.upvoter.*
import space.dpos.android.worker.DposWorkerRunner
import org.bitcoinj.core.ECKey
import org.bitcoinj.params.MainNetParams
import java.math.BigInteger
import java.net.ServerSocket
import java.net.InetAddress
import java.util.Collections
import java.util.concurrent.Executors

@RunWith(RobolectricTestRunner::class)
class GolosBacklogConnectedTest {
    private class Fixture : AutoCloseable {
        private val base = ApplicationProvider.getApplicationContext<Context>()
        val context = object : android.content.ContextWrapper(base) {
            private val isolated = java.io.File(base.filesDir, "checkpoint-fixture-${java.util.UUID.randomUUID()}").apply { mkdirs() }
            override fun getFilesDir() = isolated
        }
        val store: WorkerStore
        val server = ServerSocket(0, 50, InetAddress.getByName("127.0.0.1"))
        val pool = Executors.newCachedThreadPool()
        val rows = Collections.synchronizedMap(mutableMapOf<String, List<HistoryEvent>>())
        var failed = ""
        var slow = ""
        var slowNames: Set<String> = emptySet()
        var energy = 100
        val requests = Collections.synchronizedList(mutableListOf<Triple<String, Long, Int>>())
        val endpoint = "http://127.0.0.1:${server.localPort}/"
        val history get() = HttpGrapheneHistoryClient(endpoint, true, "account_history")
        val settings = AccountSettings("fixture-voter", true, curators = listOf("alice", "bobby"), favorites = listOf("carol"))
        init {
            context.getSharedPreferences("dpos_worker", Context.MODE_PRIVATE).edit().clear().commit()
            context.getSharedPreferences("backlog-secure", Context.MODE_PRIVATE).edit().clear().commit()
            store = restartStore()
            store.setWorkerEnabled(true)
            store.importDecision(WorkerCommandPolicy.validateImport(AccountImportRequest("golos", "fixture-voter",
                enableNotifications = false, enableAutoUpvoter = true, explicitConsent = true,
                curators = settings.curators, favorites = settings.favorites, minEnergy = 8000)))
            store.saveEncryptedKeyRef(store.defaultPostingKeyRef("golos", "fixture-voter"), ECKey.fromPrivate(BigInteger("2"), true).getPrivateKeyAsWiF(MainNetParams.get()))
            pool.submit {
                while (!server.isClosed) {
                    val socket = try { server.accept() } catch (_: Exception) { break }
                    pool.submit {
                        socket.use {
                            try {
                                val reader = socket.getInputStream().bufferedReader()
                                reader.readLine()
                                var length = 0
                                while (true) {
                                    val line = reader.readLine() ?: break
                                    if (line.isEmpty()) break
                                    if (line.startsWith("Content-Length:", true)) length = line.substringAfter(':').trim().toInt()
                                }
                                val chars = CharArray(length)
                                var offset = 0
                                while (offset < length) { val n = reader.read(chars, offset, length - offset); if (n < 0) error("short request"); offset += n }
                                val request = JSONObject(String(chars))
                                val params = request.getJSONArray("params").getJSONArray(2)
                                val name = params.getString(0); val from = params.getLong(1); val limit = params.getInt(2)
                                requests += Triple(name, from, limit)
                                if (name == slow || name in slowNames) Thread.sleep(2000)
                                val response = if (name == failed) JSONObject().put("error", JSONObject().put("message", "fixture unavailable")) else {
                                    val all = rows[name].orEmpty()
                                    val end = if (from < 0) all.maxOfOrNull { it.index } ?: -1 else from
                                    val selected = all.filter { it.index <= end }.sortedBy { it.index }.takeLast(limit)
                                    JSONObject().put("result", JSONArray().apply { selected.forEach { row ->
                                        put(JSONArray().put(row.index).put(JSONObject().put("op", JSONArray().put(row.type).put(JSONObject(row.data))).put("trx_id", row.data["trx_id"] ?: "")))
                                    } })
                                }
                                val body = response.toString().toByteArray()
                                socket.getOutputStream().write("HTTP/1.1 200 OK\r\nContent-Length: ${body.size}\r\nConnection: close\r\n\r\n".toByteArray())
                                socket.getOutputStream().write(body)
                            } catch (_: Exception) { /* cancelled client in timeout fixture */ }
                        }
                    }
                }
            }
        }
        fun restartStore() = WorkerStore(context, context.getSharedPreferences("backlog-secure", Context.MODE_PRIVATE))
        val rpc = object : GolosRpcClient {
            override fun getDynamicGlobalProperties(): JSONObject = error("must not prepare")
            override fun getBlock(blockNumber: Long): JSONObject? = error("must not prepare")
            override fun getAccount(account: String): JSONObject = JSONObject().put("voting_power", energy)
            override fun getGolosContent(author: String, permlink: String): JSONObject = JSONObject().put("author", author).put("permlink", permlink).put("parent_author", "").put("last_payout", "1970-01-01T00:00:00").put("cashout_time", "2099-01-01T00:00:00").put("created", "2026-01-01T00:00:00").put("last_update", "2026-01-01T00:00:00").put("num_changes", 0).put("allow_votes", true).put("active", "2026-01-01T00:00:00")
            override fun getActiveVotePercent(author: String, permlink: String, voter: String): Int? = 7000
            override fun verifyAuthority(signedTransaction: JSONObject): Boolean = error("must not sign")
            override fun verifyAuthorityDetailed(signedTransaction: JSONObject): JSONObject = error("must not sign")
            override fun broadcastTransactionSynchronous(signedTransaction: JSONObject): JSONObject = error("NO BROADCAST")
        }
        fun run(store: WorkerStore = this.store) = DposWorkerRunner(context, store, historyOverride = { history }, productionPolicy = LegacyTestGolosPolicy(history), rpcOverride = { rpc }).runOnce("foreground-golos")
        override fun close() { server.close(); pool.shutdownNow(); pool.awaitTermination(2, java.util.concurrent.TimeUnit.SECONDS) }
    }
    private fun noise(index: Long) = HistoryEvent(index, "custom_json", emptyMap())
    private fun vote(index: Long, name: String, target: String = "p$index") = HistoryEvent(index, "vote", mapOf("voter" to name, "author" to "target", "permlink" to target, "weight" to "7000"))
    private fun post(index: Long, name: String) = HistoryEvent(index, "comment", mapOf("author" to name, "permlink" to "p$index", "parent_author" to ""))

    @Test fun connectedRunnerPreservesEnergyDeferredEventsAndCatchesUpAfterRestartThroughNoiseAndFavorites() {
        Fixture().use { f ->
            f.rows["alice"] = (0L..10L).map(::noise) + vote(11, "alice")
            f.rows["bobby"] = (0L..11L).map(::noise)
            f.rows["carol"] = (0L..10L).map(::noise) + post(11, "carol")
            val first = f.run()
            assertEquals(0, first.autoUpvoterBroadcasted)
            assertEquals(2, f.store.readVoteBacklog("fixture-voter").getJSONArray("inbox").length())
            f.rows["alice"] = (0L..250L).map { if (it == 20L || it == 230L) vote(it, "alice") else noise(it) }
            f.rows["carol"] = (0L..250L).map { if (it == 21L || it == 231L) post(it, "carol") else noise(it) }
            repeat(3) { f.run(f.restartStore()) }
            val state = f.restartStore().readVoteBacklog("fixture-voter")
            assertEquals(250, state.getJSONObject("sources").getJSONObject("alice").getInt("cursor"))
            val queued = state.getJSONArray("inbox")
            assertEquals(6, queued.length())
            assertTrue(f.requests.any { it.first == "alice" && it.second == 111L })
            assertTrue(f.requests.any { it.first == "carol" && it.second == 111L })
            assertEquals(0, f.run().autoUpvoterBroadcasted)
        }
    }

    @Test fun incompleteVoteRetainsOnlyItsCursorWhileHealthySourceAndUnknownParentCommentSurvive() {
        Fixture().use { f ->
            f.rows["alice"] = listOf(HistoryEvent(1, "vote", mapOf("voter" to "alice", "author" to "target", "permlink" to "p1", "weight" to "malformed")))
            f.rows["bobby"] = listOf(vote(1, "bobby"))
            f.rows["carol"] = listOf(HistoryEvent(1, "comment", mapOf("author" to "carol", "permlink" to "p1")))
            val intake = GolosEventBacklog(f.history, f.store)
            assertEquals(2, intake.collect(f.settings).size)
            assertFalse(f.store.readVoteBacklog("fixture-voter").getJSONObject("sources").has("alice"))
            f.rows["alice"] = listOf(vote(1, "alice"))
            assertEquals(3, GolosEventBacklog(f.history, f.restartStore()).collect(f.settings).size)
        }
    }

    @Test fun knownOtherVoterWithBlankCandidateFieldsCannotPoisonOwnVoteAndDurableCursor() {
        Fixture().use { f ->
            val settings = f.settings.copy(curators = listOf("alice"), favorites = emptyList())
            f.rows["alice"] = listOf(vote(0, "alice"))
            GolosEventBacklog(f.history, f.store).collect(settings)
            f.rows["alice"] = listOf(vote(0, "alice"),
                HistoryEvent(1, "vote", mapOf("voter" to "someone-else", "permlink" to "")), vote(2, "alice"))
            val intake = GolosEventBacklog(f.history, f.restartStore())
            assertEquals(listOf("p0", "p2"), intake.collect(settings).map { it.permlink })
            assertTrue(intake.warnings.toString(), intake.warnings.isEmpty())
            val saved = f.restartStore().readVoteBacklog("fixture-voter")
            assertEquals(2L, saved.getJSONObject("sources").getJSONObject("alice").getLong("cursor"))
            assertEquals(2, saved.getJSONArray("inbox").length())
            assertEquals(listOf("p0", "p2"), GolosEventBacklog(f.history, f.restartStore()).collect(settings).map { it.permlink })
        }
    }

    @Test fun malformedOwnOrUnidentifiableVoteKeepsPriorCursorAndInboxAcrossRestart() {
        for (actor in listOf("alice", "", null)) Fixture().use { f ->
            val settings = f.settings.copy(curators = listOf("alice"), favorites = emptyList())
            f.rows["alice"] = listOf(vote(0, "alice"))
            GolosEventBacklog(f.history, f.store).collect(settings)
            val bad = mutableMapOf("author" to "target", "permlink" to "", "weight" to "7000")
            if (actor != null) bad["voter"] = actor
            f.rows["alice"] = listOf(vote(0, "alice"), HistoryEvent(1, "vote", bad), vote(2, "alice"))
            repeat(2) {
                val intake = GolosEventBacklog(f.history, f.restartStore())
                assertEquals(listOf("p0"), intake.collect(settings).map { it.permlink })
                assertTrue(intake.warnings.any { it.contains("incomplete vote") })
                val saved = f.restartStore().readVoteBacklog("fixture-voter")
                assertEquals(0L, saved.getJSONObject("sources").getJSONObject("alice").getLong("cursor"))
                assertEquals(1, saved.getJSONArray("inbox").length())
            }
            f.rows["alice"] = listOf(vote(0, "alice"), vote(1, "alice"), vote(2, "alice"))
            assertEquals(3, GolosEventBacklog(f.history, f.restartStore()).collect(settings).size)
        }
    }

    @Test fun incomingVotesOnCuratorPostsAreNoiseNotCuratorActionsOrInboxCapacity() {
        Fixture().use { f ->
            f.rows["alice"] = listOf(vote(0, "someone-else"), vote(1, "alice"))
            val events = GolosEventBacklog(f.history, f.store).collect(f.settings.copy(curators = listOf("alice"), favorites = emptyList()))
            assertEquals(1, events.size)
            assertEquals("alice", events.single().voter)
            assertEquals(1, f.store.readVoteBacklog("fixture-voter").getJSONArray("inbox").length())
        }
    }

    @Test fun bootstrapBackfillFindsFavoriteBelowInitialPageAcrossRestarts() {
        Fixture().use { f ->
            f.rows["carol"] = (0L..350L).map { if (it == 5L || it == 330L) post(it, "carol") else noise(it) }
            val settings = f.settings.copy(curators = emptyList())
            assertEquals(1, GolosEventBacklog(f.history, f.store).collect(settings).size)
            repeat(4) { GolosEventBacklog(f.history, f.restartStore()).collect(settings) }
            val state = f.restartStore().readVoteBacklog("fixture-voter")
            assertEquals(2, state.getJSONArray("inbox").length())
            assertEquals(-1L, state.getJSONObject("sources").getJSONObject("carol").getLong("backfillFrom"))
        }
    }

    @Test fun truncatedOlderPageCannotSkipRequestedUpperBoundaryAcrossRestart() {
        Fixture().use { f ->
            val settings = f.settings.copy(curators = listOf("alice"), favorites = emptyList())
            f.rows["alice"] = (101L..200L).map(::noise)
            GolosEventBacklog(f.history, f.store).collect(settings)
            f.rows["alice"] = (1L..50L).map(::noise) + (101L..200L).map(::noise)
            val intake = GolosEventBacklog(f.history, f.restartStore())
            assertTrue(intake.collect(settings).isEmpty())
            assertTrue(f.requests.any { it.first == "alice" && it.second == 100L })
            assertEquals(100L, f.restartStore().readVoteBacklog("fixture-voter")
                .getJSONObject("sources").getJSONObject("alice").getLong("backfillFrom"))
            assertTrue(intake.warnings.any { it.contains("backfill deferred") })
            f.rows["alice"] = (1L..200L).map { if (it == 75L) vote(it, "alice") else noise(it) }
            val restored = GolosEventBacklog(f.history, f.restartStore()).collect(settings)
            assertEquals("p75", restored.single().permlink)
            assertEquals(-1L, f.restartStore().readVoteBacklog("fixture-voter")
                .getJSONObject("sources").getJSONObject("alice").getLong("backfillFrom"))
            assertEquals(1, GolosEventBacklog(f.history, f.restartStore()).collect(settings).size)
        }
    }

    @Test fun removedFullSourceIsArchivedAndRestoredWithoutBlockingNewSourceOrClearingLedger() {
        Fixture().use { f ->
            val scope = f.history.historyScope
            val inbox = JSONArray()
            repeat(1000) { inbox.put(JSONObject().put("id", "$scope|alice|$it|curator_vote")
                .put("kind", "curator_vote").put("voter", "alice").put("author", "target")
                .put("permlink", "queued-$it").put("weight", 7000).put("sourceIndex", it)) }
            val originalIds = (0 until inbox.length()).map { inbox.getJSONObject(it).getString("id") }.toSet()
            f.store.saveVoteBacklog("fixture-voter", JSONObject().put("inbox", inbox).put("sources", JSONObject()
                .put("alice", JSONObject().put("scope", scope).put("cursor", 999).put("backfillFrom", -1).put("roles", "curator"))))
            val tx = "b".repeat(40)
            f.store.savePending(PendingBroadcastIntent("vote", "golos", "fixture-voter", "target|unknown|7000", 9000, transactionId = tx))
            fun switch(curators: List<String>, favorites: List<String> = emptyList()) {
                f.restartStore().importDecision(WorkerCommandPolicy.validateImport(AccountImportRequest("golos", "fixture-voter",
                    enableNotifications = false, enableAutoUpvoter = true, explicitConsent = true, updateAutoUpvoter = true,
                    curators = curators, favorites = favorites, minEnergy = 8000)))
            }
            f.rows["bobby"] = listOf(vote(1, "bobby", "new-source"))
            switch(listOf("bobby"))
            assertEquals(0, f.run(f.restartStore()).autoUpvoterBroadcasted)
            var state = f.restartStore().readVoteBacklog("fixture-voter")
            assertEquals(1, state.getJSONArray("inbox").length())
            assertEquals("bobby", state.getJSONArray("inbox").getJSONObject(0).getString("voter"))
            assertEquals(originalIds, (0 until state.getJSONArray("inactiveInbox").length()).map {
                state.getJSONArray("inactiveInbox").getJSONObject(it).getString("id") }.toSet())
            assertEquals(tx, f.restartStore().voteArchive("golos", "fixture-voter").single().intent.transactionId)
            // A role change for the same name must re-read history: comments were noise as a curator.
            f.rows["alice"] = (900L..999L).map { if (it == 975L) post(it, "alice") else noise(it) }
            switch(emptyList(), listOf("alice"))
            assertEquals(0, f.run(f.restartStore()).autoUpvoterBroadcasted)
            state = f.restartStore().readVoteBacklog("fixture-voter")
            assertEquals("favorite_post", state.getJSONArray("inbox").getJSONObject(0).getString("kind"))
            assertEquals(1001, state.getJSONArray("inactiveInbox").length())
            // Re-enable both roles while the favorite is still active: restore only available
            // capacity, preserve the active row and leave the last curator event durable.
            switch(listOf("alice"), listOf("alice"))
            assertEquals(0, f.run(f.restartStore()).autoUpvoterBroadcasted)
            state = f.restartStore().readVoteBacklog("fixture-voter")
            assertEquals(1000, state.getJSONArray("inbox").length())
            assertEquals("favorite_post", state.getJSONArray("inbox").getJSONObject(0).getString("kind"))
            assertEquals(2, state.getJSONArray("inactiveInbox").length())
            val preservedIds = (listOf("inbox", "inactiveInbox")).flatMap { key ->
                val rows = state.getJSONArray(key)
                (0 until rows.length()).map { rows.getJSONObject(it).getString("id") }
            }
            assertEquals(1002, preservedIds.size)
            assertEquals(1002, preservedIds.toSet().size)
            assertTrue(preservedIds.containsAll(originalIds))
            switch(listOf("alice"))
            assertEquals(0, f.run(f.restartStore()).autoUpvoterBroadcasted)
            state = f.restartStore().readVoteBacklog("fixture-voter")
            val active = state.getJSONArray("inbox")
            assertEquals(originalIds, (0 until active.length()).map { active.getJSONObject(it).getString("id") }.toSet())
            assertEquals(2, state.getJSONArray("inactiveInbox").length())
            assertEquals(tx, f.restartStore().voteArchive("golos", "fixture-voter").single().intent.transactionId)
            // Repeated restarts neither duplicate archived events nor add another sender.
            assertEquals(0, f.run(f.restartStore()).autoUpvoterBroadcasted)
            assertEquals(1000, f.restartStore().readVoteBacklog("fixture-voter").getJSONArray("inbox").length())
        }
    }

    @Test fun incrementalRunnerChecksEnabledVizButDoesNotCheckNotifications() {
        Fixture().use { f ->
            f.store.importDecision(WorkerCommandPolicy.validateImport(AccountImportRequest("viz", "fixture-viz", enableNotifications = false, enableAutoUpvoter = false, enableVizSelfAward = true, explicitConsent = true)))
            val summary = f.run()
            assertEquals(2, summary.accountsChecked)
            assertEquals(1, summary.vizSelfAwardChecks)
            assertEquals(0, summary.notificationChecks)
            assertEquals(0, summary.vizSelfAwardBroadcasted) // No VIZ key was provisioned.
            assertTrue(f.store.vizSelfAwardEnabled("viz", "fixture-viz"))
            f.store.syncVizSelfAward("fixture-viz", false, false, 9500)
            val disabled = f.run(f.restartStore())
            assertEquals(1, disabled.accountsChecked)
            assertEquals(0, disabled.vizSelfAwardChecks)
            assertEquals(0, disabled.notificationChecks)
        }
    }

    @Test fun forwardHistoryGapDoesNotAdvanceOverUnprovenOperationsAndCanCatchUpLater() {
        Fixture().use { f ->
            f.rows["alice"] = listOf(noise(0))
            GolosEventBacklog(f.history, f.store).collect(f.settings)
            f.rows["alice"] = (100L..350L).map(::noise) + vote(351, "alice")
            f.rows["bobby"] = listOf(vote(1, "bobby"))
            assertEquals(1, GolosEventBacklog(f.history, f.restartStore()).collect(f.settings).size)
            assertEquals(0, f.store.readVoteBacklog("fixture-voter").getJSONObject("sources").getJSONObject("alice").getInt("cursor"))
            f.rows["alice"] = (0L..350L).map(::noise) + vote(351, "alice")
            var events = emptyList<VoteEvent>()
            repeat(4) { events = GolosEventBacklog(f.history, f.restartStore()).collect(f.settings) }
            assertEquals(2, events.size)
            assertEquals(351, f.store.readVoteBacklog("fixture-voter").getJSONObject("sources").getJSONObject("alice").getInt("cursor"))
        }
    }

    @Test fun intakeFailoverRebaselinesNodeIndicesWithFullBackfillWithoutLosingOldInbox() {
        Fixture().use { f ->
            var failPrimary = false
            val standbyRequests = mutableListOf<Long>()
            val primary = object : GolosHistoryClient {
                override val historyScope = "primary"
                override fun getAccountHistory(account: String, from: Long, limit: Int): List<HistoryEvent> {
                    if (failPrimary) error("primary unavailable")
                    return f.history.getAccountHistory(account, from, limit)
                }
            }
            val standby = object : GolosHistoryClient {
                override val historyScope = "standby"
                override fun getAccountHistory(account: String, from: Long, limit: Int): List<HistoryEvent> {
                    standbyRequests += from
                    return f.history.getAccountHistory(account, from, limit)
                }
            }
            val history = FallbackGrapheneHistoryClient(listOf(primary, standby))
            val settings = f.settings.copy(curators = listOf("alice"), favorites = emptyList())
            f.rows["alice"] = listOf(vote(1000, "alice"))
            assertEquals(1, GolosEventBacklog(history, f.store).collect(settings).size)
            failPrimary = true
            f.rows["alice"] = listOf(vote(20, "alice"))
            assertEquals(2, GolosEventBacklog(history, f.restartStore()).collect(settings).size)
            val source = f.store.readVoteBacklog("fixture-voter").getJSONObject("sources").getJSONObject("alice")
            assertEquals("standby", source.getString("scope"))
            assertEquals(20, source.getInt("cursor"))
            assertEquals(listOf(-1L), standbyRequests)
        }
    }

    @Test fun sourceFailureAtFirstMiddleOrLastRetainsHealthyPartialAndFailedCursor() {
        for (failed in listOf("alice", "bobby", "carol")) Fixture().use { f ->
            f.failed = failed
            f.rows["alice"] = listOf(vote(1, "alice")); f.rows["bobby"] = listOf(vote(1, "bobby")); f.rows["carol"] = listOf(post(1, "carol"))
            val intake = GolosEventBacklog(f.history, f.store)
            assertEquals(2, intake.collect(f.settings).size)
            assertEquals(1, intake.warnings.size)
            assertFalse(f.store.readVoteBacklog("fixture-voter").getJSONObject("sources").has(failed))
            f.failed = ""
            assertEquals(3, GolosEventBacklog(f.history, f.restartStore()).collect(f.settings).size)
        }
    }

    @Test fun timeoutDoesNotDiscardOtherCompletedSourcesOrAdvanceSlowCursor() {
        Fixture().use { f ->
            f.slow = "alice"
            f.rows["alice"] = listOf(vote(1, "alice")); f.rows["bobby"] = listOf(vote(1, "bobby")); f.rows["carol"] = listOf(post(1, "carol"))
            val intake = GolosEventBacklog(f.history, f.store, budgetMs = 600)
            assertEquals(2, intake.collect(f.settings).size)
            assertFalse(f.store.readVoteBacklog("fixture-voter").getJSONObject("sources").has("alice"))
        }
    }

    @Test fun queuedHealthySourceCannotBeStarvedByFourSlowSourcesAcrossRestarts() {
        Fixture().use { f ->
            f.slowNames = setOf("aaa", "bbb", "ccc", "ddd")
            f.rows["zzz"] = listOf(vote(1, "zzz"))
            val settings = f.settings.copy(curators = listOf("aaa", "bbb", "ccc", "ddd", "zzz"), favorites = emptyList())
            val first = GolosEventBacklog(f.history, f.store, budgetMs = 600).collect(settings)
            assertTrue(first.isEmpty())
            val second = GolosEventBacklog(f.history, f.restartStore(), budgetMs = 600).collect(settings)
            assertEquals("zzz", second.single().voter)
            assertFalse(f.store.readVoteBacklog("fixture-voter").getJSONObject("sources").has("aaa"))
        }
    }

    @Test fun connectedRecoveryPaginatesOldExactIdDurablyWithoutAnyBroadcast() {
        Fixture().use { f ->
            val tx = "a".repeat(40)
            f.store.savePending(PendingBroadcastIntent("vote", "golos", "fixture-voter", "target|old|7000", 9000, transactionId = tx))
            f.rows["fixture-voter"] = (0L..1200L).map { if (it == 5L) vote(it, "fixture-voter", "old").copy(data = vote(it, "fixture-voter", "old").data + ("trx_id" to tx)) else noise(it) }
            val before = f.run()
            assertFalse(f.store.voteArchive("golos", "fixture-voter").single().confirmed)
            assertEquals(0, before.autoUpvoterBroadcasted)
            repeat(3) { f.run(f.restartStore()) }
            // Exact history ID alone is not canonical/LIB evidence. Keep quarantine.
            assertFalse(f.store.voteArchive("golos", "fixture-voter").single().confirmed)
            assertNull(f.store.readPending("vote", "golos", "fixture-voter"))
            assertTrue(f.requests.any { it.first == "fixture-voter" && it.second in 1..500 })
        }
    }

    @Test fun inboxBackpressureNeverAdvancesSourceAndOldUnknownsCannotStarveLaterEvents() {
        Fixture().use { f ->
            val inbox = JSONArray()
            repeat(1000) { inbox.put(JSONObject().put("id", "existing-$it").put("kind", "curator_vote").put("voter", "alice")
                .put("author", "target").put("permlink", "queued-$it").put("weight", 7000).put("sourceIndex", it)) }
            f.store.saveVoteBacklog("fixture-voter", JSONObject().put("inbox", inbox).put("sources", JSONObject()
                .put("alice", JSONObject().put("scope", f.history.historyScope).put("cursor", 0).put("backfillFrom", -1))))
            f.rows["alice"] = listOf(noise(0), vote(1, "alice", "new"))
            val settings = f.settings.copy(curators = listOf("alice"), favorites = emptyList())
            val seen = mutableSetOf<String>()
            repeat(20) {
                val intake = GolosEventBacklog(f.history, f.restartStore())
                seen += intake.collect(settings).map { it.permlink }
                assertTrue(intake.warnings.any { it.contains("capacity") })
            }
            val state = f.restartStore().readVoteBacklog("fixture-voter")
            assertEquals(1000, state.getJSONArray("inbox").length())
            assertEquals(0, state.getJSONObject("sources").getJSONObject("alice").getInt("cursor"))
            assertEquals(1000, seen.size)
        }
    }

    @Test fun acknowledgementRetiresOnlyPositiveOrTerminalEvidenceNotUnknownOrEnergy() {
        Fixture().use { f ->
            f.rows["alice"] = listOf(vote(1, "alice")); f.rows["carol"] = listOf(post(1, "carol"))
            val intake = GolosEventBacklog(f.history, f.store)
            assertEquals(2, intake.collect(f.settings).size)
            val op = VoteOperation("golos", "fixture-voter", "target", "p1", 7000)
            val unknown = AutoVoteRuntimeReport(1, 0, listOf("pending_confirmation:fixture-voter|carol|p1"),
                listOf(VoteBroadcastResult(false, "broadcast_unknown", op, "fixture transport unknown")), 2, emptyMap())
            intake.acknowledge("fixture-voter", unknown, VotePlan(emptyList(), listOf("energy:fixture-voter|carol|p1")))
            assertEquals(2, f.restartStore().readVoteBacklog("fixture-voter").getJSONArray("inbox").length())
            val confirmed = unknown.copy(results = listOf(VoteBroadcastResult(true, "already_voted", op, "fresh own vote")))
            intake.acknowledge("fixture-voter", confirmed, VotePlan(listOf(PlannedVote("fixture-voter", "target", "p1", 7000, "curator_vote", 9000)), emptyList()))
            assertEquals(1, f.restartStore().readVoteBacklog("fixture-voter").getJSONArray("inbox").length())
        }
    }

    @Test fun zeroSourceDoesNotDiscardSameTargetDeferredThroughOtherSource() {
        for (zeroFavorite in listOf(true, false)) Fixture().use { f ->
            f.store.importDecision(WorkerCommandPolicy.validateImport(AccountImportRequest("golos", "fixture-voter",
                enableNotifications = false, enableAutoUpvoter = true, explicitConsent = true, updateAutoUpvoter = true,
                curators = listOf("alice"), favorites = listOf("target"), minEnergy = 8000,
                curatorCoefficient = if (zeroFavorite) 100 else 0, favoritesPercent = if (zeroFavorite) 0 else 100)))
            f.rows["alice"] = listOf(vote(1, "alice"))
            f.rows["target"] = listOf(post(1, "target"))
            assertEquals(0, f.run().autoUpvoterBroadcasted)
            val remaining = f.restartStore().readVoteBacklog("fixture-voter").getJSONArray("inbox")
            assertEquals(1, remaining.length())
            assertEquals(if (zeroFavorite) "curator_vote" else "favorite_post", remaining.getJSONObject(0).getString("kind"))
        }
    }

    @Test fun initialHistoryGapCannotAdvanceAnUnprovenBootstrapCursor() {
        Fixture().use { f ->
            f.rows["alice"] = listOf(noise(1), vote(3, "alice"))
            f.rows["bobby"] = listOf(vote(1, "bobby"))
            assertEquals(1, GolosEventBacklog(f.history, f.store).collect(f.settings).size)
            assertFalse(f.store.readVoteBacklog("fixture-voter").getJSONObject("sources").has("alice"))
            f.rows["alice"] = listOf(noise(1), noise(2), vote(3, "alice"))
            assertEquals(2, GolosEventBacklog(f.history, f.restartStore()).collect(f.settings).size)
        }
    }

    @Test fun zeroSettingsCannotTurnIntoOneBasisPoint() {
        val settings = AccountSettings("fixture-voter", true, curators = listOf("alice"), favorites = listOf("carol"), favoritesPercent = 0, curatorCoefficient = 0)
        val plan = AutoUpvoterPlanner().plan(listOf(settings), listOf(VoteEvent("curator_vote", "alice", "target", "p", 10000), VoteEvent("favorite_post", author = "carol", permlink = "p")))
        assertEquals(0, plan.actions.size)
        assertEquals(2, plan.skips.size)
        assertTrue(AutoUpvoterPlanner().plan(listOf(settings.copy(curatorMode = "full")), listOf(VoteEvent("curator_vote", "alice", "target", "p", 10000))).actions.isEmpty())
        assertTrue(AutoUpvoterPlanner().plan(listOf(settings.copy(curatorCoefficient = 1)), listOf(VoteEvent("curator_vote", "alice", "target", "p", 1))).actions.isEmpty())
    }
}
