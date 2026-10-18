package space.dpos.android

import android.content.Context
import android.content.SharedPreferences
import androidx.test.core.app.ApplicationProvider
import org.bitcoinj.core.ECKey
import org.bitcoinj.params.MainNetParams
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import space.dpos.android.diagnostics.DiagnosticReportBuilder
import space.dpos.android.notifications.*
import space.dpos.android.runtime.*
import space.dpos.android.storage.WorkerStore
import space.dpos.android.upvoter.*
import space.dpos.android.worker.DposWorkerRunner
import java.math.BigInteger
import java.net.InetAddress
import java.net.ServerSocket
import java.time.LocalDateTime
import java.time.ZoneOffset
import java.util.Collections
import java.util.concurrent.Executors

/** Real worker, real signer, isolated durable preferences, local-only SDK-shaped RPC. */
@RunWith(RobolectricTestRunner::class)
class DeviceFollowupConnectedTest {
    internal class Fixture(private val legacyPending: String? = null, val recovery: Boolean = false, val knownOld: Boolean = false) : AutoCloseable {
        private val base = ApplicationProvider.getApplicationContext<Context>()
        val context = object : android.content.ContextWrapper(base) {
            private val isolated = java.io.File(base.filesDir, "connected-${java.util.UUID.randomUUID()}").apply { mkdirs() }
            override fun getFilesDir() = isolated
        }
        val prefs = context.getSharedPreferences("dpos_worker", Context.MODE_PRIVATE)
        val secure = context.getSharedPreferences("device-followup-secure", Context.MODE_PRIVATE)
        val wif = ECKey.fromPrivate(BigInteger.valueOf(2), true).getPrivateKeyAsWiF(MainNetParams.get())
        val server = ServerSocket(0, 50, InetAddress.getByName("127.0.0.1"))
        val pool = Executors.newCachedThreadPool()
        val endpoint = "http://127.0.0.1:${server.localPort}/"
        val requests = Collections.synchronizedList(mutableListOf<JSONObject>())
        val sends = Collections.synchronizedList(mutableListOf<JSONObject>())
        val transactions = Collections.synchronizedMap(mutableMapOf<String, JSONObject>())
        val histories = Collections.synchronizedMap(mutableMapOf<String, List<HistoryEvent>>())
        val unknownTargets = mutableSetOf<String>()
        var lookupEnabled = true
        var lookupOverride: JSONObject? = null
        var recoveryWall = 1_800_000_000_000L
        var recoveryMono = 1000L
        var recoveryHead = 100L
        var recoveryTime = recoveryWall / 1000
        var configChain = GrapheneChainSpecs.require("golos").networkChainIdHex
        var headerPrevious = recoveryId(100)
        var contentReads = 0
        var onContent: (() -> Unit)? = null
        var onAuthority: (() -> Unit)? = null
        var lib = 120L
        var receiptBlock = 120L
        var energy = 10000
        var contentFields = JSONObject()
        var failHistory = false
        val history get() = HttpGrapheneHistoryClient(endpoint, true, "account_history")
        val rpc get() = HttpGrapheneRpcClient(GrapheneChainSpecs.require("golos"), endpoint)
        val store: WorkerStore
        init {
            prefs.edit().clear().commit(); secure.edit().clear().commit()
            legacyPending?.let { prefs.edit().putString("pendingTransaction:vote:golos:fixture-voter", it).commit() }
            if (recovery) {
                prefs.edit().putBoolean("voteStorageUnsafe", true).apply {
                    if (knownOld) putString("voteArchive:golos:fixture-voter", JSONArray().put(JSONObject().put("confirmed", false).put("intent",
                        JSONObject().put("kind", "vote").put("chainId", "golos").put("account", "fixture-voter").put("fingerprint", "target|old|100")
                            .put("historyBaseline", -1).put("state", "UNKNOWN").put("transactionId", "a".repeat(40)))).toString())
                }.commit()
                lib = 90
            }
            store = restart()
            store.setWorkerEnabled(true)
            store.importDecision(WorkerCommandPolicy.validateImport(AccountImportRequest("golos", "fixture-voter", enableNotifications = false,
                enableAutoUpvoter = true, explicitConsent = true, curators = listOf("alice"), favorites = listOf("target"),
                autoDonate = true, autoDonatePool = "10 1", minEnergy = 2500)))
            store.saveEncryptedKeyRef(store.defaultPostingKeyRef("golos", "fixture-voter"), wif)
            pool.submit {
                while (!server.isClosed) {
                    val socket = try { server.accept() } catch (_: Exception) { break }
                    pool.submit {
                        socket.use {
                            try {
                                val reader = socket.getInputStream().bufferedReader(); reader.readLine()
                                var length = 0
                                while (true) { val line = reader.readLine() ?: break; if (line.isEmpty()) break
                                    if (line.startsWith("Content-Length:", true)) length = line.substringAfter(':').trim().toInt() }
                                val chars = CharArray(length); var offset = 0
                                while (offset < length) { val n = reader.read(chars, offset, length - offset); require(n > 0); offset += n }
                                val request = JSONObject(String(chars)); requests += request
                                val envelope = request.getJSONArray("params"); val method = envelope.getString(1); val args = envelope.getJSONArray(2)
                                val result: Any = when (method) {
                                    "get_accounts" -> JSONArray().put(JSONObject().put("voting_power", energy).put("tip_balance", "0.000 GOLOS")
                                        .put("posting", JSONObject().put("weight_threshold", 1).put("key_auths", JSONArray().put(JSONArray().put(GraphenePublicKey.fromWif(wif)).put(1)))))
                                    "get_config" -> JSONObject().put("STEEMIT_CHAIN_ID", configChain).put("STEEMIT_MAX_TIME_UNTIL_EXPIRATION", 3600)
                                    "get_block_header" -> JSONObject().put("previous", if (args.getLong(0) == 101L) headerPrevious else recoveryId(args.getLong(0) - 1))
                                        .put("timestamp", recoveryStamp(if (args.getLong(0) == 101L) 1_800_000_003L else recoveryTime - 3))
                                    "get_dynamic_global_properties" -> if (recovery) JSONObject().put("head_block_number", recoveryHead).put("last_irreversible_block_num", lib)
                                        .put("time", recoveryStamp(recoveryTime)).put("head_block_id", recoveryId(recoveryHead))
                                        else JSONObject().put("head_block_number", 123).put("last_irreversible_block_num", lib)
                                        .put("time", "2026-10-10T08:59:00").put("head_block_id", "0000007b01020304000000000000000000000000000000000000000000000000")
                                    "get_block" -> JSONObject().put("previous", if (recovery) recoveryId(args.getLong(0) - 1) else "0000007901020304000000000000000000000000000000000000000000000000")
                                        .put("transactions", JSONArray().apply { transactions.values.sortedBy { it.getInt("transaction_num") }.forEach { put(it) } })
                                    "get_content" -> JSONObject().apply { contentReads++; onContent?.invoke() }.put("author", args.getString(0)).put("permlink", args.getString(1)).put("parent_author", "")
                                        .put("created", "2026-10-05T00:00:00").put("last_update", "2026-10-05T00:00:00").put("num_changes", 0)
                                        .put("active", "2026-10-09T00:00:00").put("allow_votes", true).put("last_payout", "1970-01-01T00:00:00")
                                        .put("cashout_time", "2026-10-12T00:00:00").apply { contentFields.keys().forEach { put(it, contentFields.get(it)) } }
                                    "get_active_votes" -> JSONArray().apply { if (recovery) transactions.values.forEach { tx ->
                                        val vote = tx.getJSONArray("operations").getJSONArray(0).getJSONObject(1)
                                        if (vote.getString("author") == args.getString(0) && vote.getString("permlink") == args.getString(1))
                                            put(JSONObject().put("voter", vote.getString("voter")).put("percent", vote.getInt("weight")))
                                    } }
                                    "verify_authority" -> { onAuthority?.invoke(); true }
                                    "get_transaction" -> if (lookupEnabled) lookupOverride ?: transactions[args.getString(0)] ?: JSONObject() else JSONObject()
                                    "get_account_history" -> {
                                        if (failHistory) error("fixture history unavailable")
                                        val name = args.getString(0); val from = args.getLong(1); val limit = args.getInt(2)
                                        require(from < 0 || from >= limit)
                                        JSONArray().apply { histories[name].orEmpty().filter { from < 0 || it.index <= from }.sortedBy { it.index }.takeLast(limit).forEach { row ->
                                            put(JSONArray().put(row.index).put(JSONObject().put("op", JSONArray().put(row.type).put(JSONObject(row.data)))
                                                .put("trx_id", row.data["trx_id"] ?: "").apply { for (key in listOf("block", "trx_in_block")) row.data[key]?.let { put(key, it.toLong()) } }))
                                        } }
                                    }
                                    "broadcast_transaction" -> {
                                        val tx = JSONObject(args.getJSONObject(0).toString()); sends += tx
                                        val row = tx.getJSONArray("operations").getJSONArray(0)
                                        require(row.getString(0) == "vote") { "No dependent donation may be signed in this fixture" }
                                        val op = row.getJSONObject(1)
                                        if (op.getString("permlink") !in unknownTargets) include(tx)
                                        JSONObject()
                                    }
                                    else -> error("unexpected method $method")
                                }
                                respond(socket, JSONObject().put("result", result))
                            } catch (e: Exception) { runCatching { respond(socket, JSONObject().put("error", JSONObject().put("message", e.message))) } }
                        }
                    }
                }
            }
        }
        private fun respond(socket: java.net.Socket, body: JSONObject) {
            val bytes = body.toString().toByteArray()
            socket.getOutputStream().write("HTTP/1.1 200 OK\r\nContent-Length: ${bytes.size}\r\nConnection: close\r\n\r\n".toByteArray())
            socket.getOutputStream().write(bytes)
        }
        fun include(tx: JSONObject): String {
            val op = tx.getJSONArray("operations").getJSONArray(0).getJSONObject(1)
            val operation = VoteOperation("golos", op.getString("voter"), op.getString("author"), op.getString("permlink"), op.getInt("weight"))
            val id = GolosVoteProof.id(tx, operation)!!
            tx.put("block_num", receiptBlock).put("transaction_num", transactions.size)
            transactions[id] = tx
            val old = histories[operation.voter].orEmpty()
            histories[operation.voter] = old + HistoryEvent((old.maxOfOrNull { it.index } ?: 0) + 1, "vote",
                mapOf("voter" to operation.voter, "author" to operation.author, "permlink" to operation.permlink, "weight" to operation.weight.toString(),
                    "trx_id" to id, "block" to receiptBlock.toString(), "trx_in_block" to tx.getInt("transaction_num").toString()))
            return id
        }
        fun restart(prefsOverride: SharedPreferences? = null, boundary: ((String, java.io.File) -> Unit)? = null): WorkerStore {
            val journal = boundary?.let { space.dpos.android.storage.TransactionCheckpointStore(java.io.File(context.filesDir, "transaction-checkpoint"), prefsOverride ?: prefs, it) }
            return WorkerStore(context, secure, prefsOverride, journal)
        }
        fun recoveryReady() {
            recoveryWall += 3_800_000; recoveryMono += 3_800_000; recoveryTime = recoveryWall / 1000; recoveryHead = 123; lib = 120
            contentFields = JSONObject().put("id", 42).put("root_comment", 42).put("created", recoveryStamp(recoveryTime - 6))
                .put("last_update", recoveryStamp(recoveryTime - 6)).put("cashout_time", recoveryStamp(recoveryTime + 86400))
        }
        fun recoveryRuntime(selected: WorkerStore = restart(), rpcSelected: GolosRpcClient = rpc) = VoteRuntime(rpcSelected,
            historyClient = history, pendingStore = selected, canAct = { selected.workerEnabled() }, confirmationRetries = 1, confirmationDelayMs = 0,
            recoveryWall = { recoveryWall }, recoveryMonotonic = { recoveryMono })
        companion object {
            fun recoveryId(n: Long) = "%08x".format(n) + "a".repeat(32)
            fun recoveryStamp(n: Long) = LocalDateTime.ofEpochSecond(n, 0, ZoneOffset.UTC).format(java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss"))
        }
        fun run(events: List<VoteEvent>, selected: WorkerStore = restart()) = DposWorkerRunner(context, selected, historyOverride = { history }, productionPolicy = LegacyTestGolosPolicy(history), rpcOverride = { rpc },
            eventsOverride = { _, _ -> events }).runOnce("device-followup-local")
        fun seedOld(permlink: String = "old", weight: Int = 7000, txId: String? = "a".repeat(40)) {
            store.savePending(PendingBroadcastIntent("vote", "golos", "fixture-voter", "target|$permlink|$weight", 9000, PendingBroadcastState.UNKNOWN, txId))
        }
        override fun close() { server.close(); pool.shutdownNow(); pool.awaitTermination(2, java.util.concurrent.TimeUnit.SECONDS) }
    }
    private fun event(post: String, weight: Int = 7000, kind: String = "curator_vote") = VoteEvent(kind, "alice", "target", post, weight, sourceIndex = 1)

    @Test fun oldUnknownRestartAllowsUnrelatedConfirmedWhileAllSameTargetKindsWeightsAndDonationsBlocked() {
        Fixture().use { f ->
            f.seedOld()
            val report = f.run(listOf(event("old", 3000), event("old", 10000, "favorite_post"), event("fresh")))
            assertEquals(1, report.autoUpvoterBroadcasted)
            assertEquals(1, f.sends.size)
            assertNull(f.restart().readPending("vote", "golos", "fixture-voter"))
            val ledger = f.restart().voteArchive("golos", "fixture-voter")
            assertEquals(1, ledger.size); assertFalse(ledger.single().confirmed)
            assertEquals("a".repeat(40), ledger.single().intent.transactionId)
            assertNull(ledger.single().intent.expirationEpochSeconds)
            assertEquals(0, f.run(listOf(event("old", 1000))).autoUpvoterBroadcasted)
            assertEquals(1, f.sends.size)
            val full = DiagnosticReportBuilder.combine(DiagnosticReportBuilder.build(f.restart(), "candidate", 81), "{}")
            assertTrue(full.contains("a".repeat(40))); assertFalse(full.contains(f.wif)); assertFalse(full.contains("signatures\":["))
        }
    }

    @Test fun freshUnknownCannotOverwriteArchiveAndNextUnrelatedCandidateStillConfirmsWithCumulativeEnergy() {
        Fixture().use { f ->
            f.seedOld(); f.unknownTargets += "new-unknown"
            val report = f.run(listOf(event("new-unknown"), event("other")))
            assertEquals(2, f.sends.size); assertEquals(1, report.autoUpvoterBroadcasted)
            val archive = f.restart().voteArchive("golos", "fixture-voter")
            assertEquals(setOf("target|old|7000", "target|new-unknown|7000"), archive.map { it.intent.fingerprint }.toSet())
            assertTrue(archive.all { !it.confirmed })
            val fresh = archive.single { it.intent.fingerprint.contains("new-unknown") }.intent
            assertNotNull(fresh.expirationEpochSeconds); assertEquals(123L, fresh.observedHeadBlock)
            assertEquals(LocalDateTime.parse("2026-10-10T08:59:00").toEpochSecond(ZoneOffset.UTC), fresh.observedChainTimeSeconds)
            assertEquals(0, f.run(listOf(event("new-unknown", 9999))).autoUpvoterBroadcasted)
            assertEquals(2, f.sends.size)
        }
    }

    @Test fun exactLateConfirmationRequiresCanonicalBlockAndSameEndpointLibOnceWithoutCountersOrDonateCatchup() {
        Fixture().use { f ->
            val op = VoteOperation("golos", "fixture-voter", "target", "old", 7000)
            val tx = GrapheneTransactionBuilder(GrapheneChainSpecs.require("golos")).build(op, BlockHeaderRef(12345, 1234567890, 1791622800, ""))
            val id = f.include(tx); f.seedOld(txId = id); f.lib = 119
            assertEquals(0, f.run(emptyList()).autoUpvoterBroadcasted)
            assertFalse(f.restart().voteArchive("golos", "fixture-voter").single().confirmed)
            assertEquals(120L, f.restart().voteArchive("golos", "fixture-voter").single().intent.includedBlockNumber)
            f.lib = 120
            assertEquals(0, f.run(emptyList()).autoUpvoterBroadcasted)
            assertTrue(f.restart().voteArchive("golos", "fixture-voter").single().confirmed)
            assertEquals(0, f.run(listOf(event("old", 10000, "favorite_post"))).autoUpvoterBroadcasted)
            assertTrue(f.sends.isEmpty())
            val lookups = f.requests.count { it.getJSONArray("params").getString(1) == "get_transaction" }
            f.run(emptyList())
            assertEquals(lookups, f.requests.count { it.getJSONArray("params").getString(1) == "get_transaction" })
        }
    }

    @Test fun malformedImportAndCheckpointPhysicalFailurePreserveIdentityAndBlockTransport() {
        Fixture("{broken").use { f ->
            f.run(listOf(event("fresh"))); assertTrue(f.sends.isEmpty())
            assertEquals("{broken", f.prefs.getString("pendingTransaction:vote:golos:fixture-voter", null))
        }
        for (old in listOf(true, false)) Fixture().use { f ->
            if (old) f.seedOld()
            val failed = f.restart(boundary = { stage, _ -> if (stage == "checkpoint:sync") throw java.io.IOException("injected") })
            f.run(listOf(event("fresh")), failed)
            assertTrue(f.sends.isEmpty())
            assertEquals("storage_unverified", failed.checkpointStatus().getString("authority"))
            val recovered = f.restart()
            assertTrue(recovered.retryCheckpointStorage())
            if (old) assertEquals("a".repeat(40), recovered.readPending("vote", "golos", "fixture-voter")?.transactionId
                ?: recovered.voteArchive("golos", "fixture-voter").single().intent.transactionId)
        }
    }

    @Test fun retiredCachedPreferenceFlushCannotAlterAuthorityOrReplayUnknownTarget() {
        Fixture().use { f ->
            f.seedOld()
            f.prefs.edit().remove("pendingTransaction:vote:golos:fixture-voter").putString("voteArchive:golos:fixture-voter", "invalid retired cache").commit()
            f.store.appendLog("unrelated ordinary flush")
            f.store.setWorkerEnabled(true)
            assertEquals(1, f.run(listOf(event("old", 9999), event("fresh"))).autoUpvoterBroadcasted)
            assertEquals("fresh", f.sends.single().getJSONArray("operations").getJSONArray(0).getJSONObject(1).getString("permlink"))
            assertEquals(0, f.run(listOf(event("old", 1000))).autoUpvoterBroadcasted)
            assertEquals(1, f.sends.size)
            assertFalse(f.restart().voteArchive("golos", "fixture-voter").single().confirmed)
        }
        // Genuine false commit and different-PID restart live in CheckpointAndroidRestartTest.
    }

    @Test fun eligibilityUsesEditMetadataNotReplyActivityAndBlocksDisabledVotesAndFinalMinute() {
        for ((fields, status) in listOf(
            JSONObject().put("allow_votes", false) to "votes_disabled",
            JSONObject().put("cashout_time", "2026-10-10T08:59:59") to "cashout_lockout",
            JSONObject().put("last_update", "2026-10-06T00:00:00").put("num_changes", 1) to "favorite_edited"
        )) Fixture().use { f ->
            f.contentFields = fields
            val result = f.run(listOf(event("fresh", 10000, "favorite_post")))
            assertEquals(1, result.autoUpvoterSkipSummary[status]); assertTrue(f.sends.isEmpty())
            assertNull(f.restart().readPending("vote", "golos", "fixture-voter"))
            assertFalse(f.requests.any { it.getJSONArray("params").getString(1) == "verify_authority" })
        }
        Fixture().use { f ->
            f.contentFields = JSONObject().put("active", "2026-10-09T00:00:00")
            assertEquals(1, f.run(listOf(event("fresh", 10000, "favorite_post"))).autoUpvoterBroadcasted)
            assertEquals(1, f.sends.size)
        }
    }

    @Test fun retainedNonzeroBoundaryStopsWarningsContinuesFreshAndOccasionallyRechecksEndpoint() {
        Fixture().use { f ->
            val settings = AccountSettings("fixture-voter", true, curators = listOf("alice"))
            fun noise(i: Long) = HistoryEvent(i, "custom_json", emptyMap())
            f.histories["alice"] = (1427L..1437L).map(::noise)
            repeat(4) { val intake = GolosEventBacklog(f.history, f.restart()); intake.collect(settings); assertTrue(intake.warnings.toString(), intake.warnings.isEmpty()) }
            var source = f.restart().readVoteBacklog("fixture-voter").getJSONObject("sources").getJSONObject("alice")
            assertEquals(-1, source.getLong("backfillFrom")); assertEquals(1426, source.getLong("retainedBoundary"))
            f.histories["alice"] = f.histories["alice"]!! + HistoryEvent(1438, "vote", mapOf("voter" to "alice", "author" to "target", "permlink" to "fresh", "weight" to "7000"))
            assertEquals("fresh", GolosEventBacklog(f.history, f.restart()).collect(settings).single().permlink)
            repeat(28) { GolosEventBacklog(f.history, f.restart()).collect(settings) }
            assertEquals(2, f.requests.count { val p = it.getJSONArray("params"); p.getString(1) == "get_account_history" && p.getJSONArray(2).getLong(1) == 1426L })
            source = f.restart().readVoteBacklog("fixture-voter").getJSONObject("sources").getJSONObject("alice")
            assertEquals(1438, source.getLong("cursor"))
        }
    }
}
