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


    internal class FullFlowWireFixture(private val legacyPending: String? = null, val recovery: Boolean = true, val knownOld: Boolean = true, val fixtureId: String = java.util.UUID.randomUUID().toString(), val initialize: Boolean = true, port: Int = 0) : AutoCloseable {
        private val base = ApplicationProvider.getApplicationContext<Context>()
        val context = object : android.content.ContextWrapper(base) {
            private val isolated = java.io.File(base.filesDir, "golos-fullflow-$fixtureId").apply { mkdirs() }
            override fun getFilesDir() = isolated
        }
        val prefs = context.getSharedPreferences("golos-fullflow-$fixtureId-prefs", Context.MODE_PRIVATE)
        val secure = context.getSharedPreferences("golos-fullflow-$fixtureId-secure", Context.MODE_PRIVATE)
        val wif = ECKey.fromPrivate(BigInteger.valueOf(2), true).getPrivateKeyAsWiF(MainNetParams.get())
        val server = ServerSocket().apply { reuseAddress = true; bind(java.net.InetSocketAddress(InetAddress.getByName("127.0.0.1"), port), 50) }
        val pool = Executors.newCachedThreadPool()
        val endpoint = "http://127.0.0.1:${server.localPort}/"
        val requests = Collections.synchronizedList(mutableListOf<JSONObject>())
        val sends = Collections.synchronizedList(mutableListOf<JSONObject>())
        val transactions = Collections.synchronizedMap(mutableMapOf<String, JSONObject>())
        val histories = Collections.synchronizedMap(mutableMapOf<String, List<HistoryEvent>>())
        val unknownTargets = mutableSetOf<String>()
        val missingTargets = mutableSetOf<String>()
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
        var receiptIndexOffset = 0
        var badCanonical = false
        var energy = 10000
        var contentFields = JSONObject()
        var failHistory = false
        var checkpoint: String? = GolosProductionPolicy.CHECKPOINT_ID
        var advance = true
        var stale = false
        var emptyContent = false
        var ownVote = false
        var failVotes = false
        var tipBalance = "0.000 GOLOS"
        var onMethod: ((String) -> Unit)? = null
        var restoreAnchor: JSONObject? = null
        val history get() = HttpGrapheneHistoryClient(endpoint, true, "account_history")
        val rpc get() = HttpGrapheneRpcClient(GrapheneChainSpecs.require("golos"), endpoint)
        val store: WorkerStore
        init {
            if (initialize) { prefs.edit().clear().commit(); secure.edit().clear().commit()
            legacyPending?.let { prefs.edit().putString("pendingTransaction:vote:golos:fixture-voter", it).commit() }
            if (recovery) {
                prefs.edit().putBoolean("voteStorageUnsafe", true).apply {
                    if (knownOld) putString("voteArchive:golos:fixture-voter", JSONArray().put(JSONObject().put("confirmed", false).put("intent",
                        JSONObject().put("kind", "vote").put("chainId", "golos").put("account", "fixture-voter").put("fingerprint", "target|old|100")
                            .put("historyBaseline", -1).put("state", "UNKNOWN").put("transactionId", "a".repeat(40)))).toString())
                }.commit()
                lib = 90
            }
            }
            store = restart()
            if (initialize) {
            store.setWorkerEnabled(true)
            store.importDecision(WorkerCommandPolicy.validateImport(AccountImportRequest("golos", "fixture-voter", enableNotifications = false,
                enableAutoUpvoter = true, explicitConsent = true, curators = listOf("alice"), favorites = listOf("target"),
                autoDonate = false, minEnergy = 2500)))
            store.saveEncryptedKeyRef(store.defaultPostingKeyRef("golos", "fixture-voter"), wif)
            }
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
                                val envelope = request.getJSONArray("params"); val method = envelope.getString(1); val args = envelope.getJSONArray(2); onMethod?.invoke(method)
                                val result: Any = when (method) {
                                    "get_accounts" -> JSONArray().put(JSONObject().put("voting_power", energy).put("tip_balance", tipBalance).put("vesting_shares", "100.000000 GESTS").put("emission_delegated_vesting_shares", "0.000000 GESTS").put("emission_received_vesting_shares", "0.000000 GESTS")
                                        .put("posting", JSONObject().put("weight_threshold", 1).put("key_auths", JSONArray().put(JSONArray().put(GraphenePublicKey.fromWif(wif)).put(1)))))
                                    "get_config" -> JSONObject().put("STEEMIT_CHAIN_ID", configChain).put("STEEMIT_MAX_TIME_UNTIL_EXPIRATION", 3600)
                                    "get_block_header" -> {
                                        val n = args.getLong(0)
                                        val anchor = restoreAnchor ?: restart().readGolosRecoveryFence()
                                        if (n == GolosProductionPolicy.CHECKPOINT_HEIGHT + 1) checkpoint?.let { JSONObject().put("previous", it) } ?: JSONObject()
                                        else JSONObject().put("previous", if (anchor != null && n == anchor.getLong("head") + 1) anchor.getString("headId") else recoveryId(n - 1))
                                            .put("timestamp", recoveryStamp(if (anchor != null && n == anchor.getLong("head") + 1) anchor.getLong("headTime") + 3 else recoveryTime - 3))
                                    }
                                    "get_dynamic_global_properties" -> if (recovery) JSONObject().put("head_block_number", recoveryHead).put("last_irreversible_block_num", lib)
                                        .put("time", recoveryStamp(recoveryTime - if (stale) 121 else 0)).put("head_block_id", recoveryId(recoveryHead)).put("total_vesting_shares", "1000.000000 GESTS").put("accumulative_emission_per_day", "1000.000 GOLOS")
                                        else JSONObject().put("head_block_number", 123).put("last_irreversible_block_num", lib)
                                        .put("time", "2026-10-10T08:59:00").put("head_block_id", "0000007b01020304000000000000000000000000000000000000000000000000")
                                    "get_block" -> JSONObject().put("previous", if (recovery) recoveryId(args.getLong(0) - 1) else "0000007901020304000000000000000000000000000000000000000000000000")
                                        .put("transactions", JSONArray().apply { transactions.values.filter { it.getLong("block_num") == args.getLong(0) }.sortedBy { it.getInt("transaction_num") }.forEach { original ->
                                            val tx = JSONObject(original.toString()); if (badCanonical) tx.getJSONArray("operations").getJSONArray(0).getJSONObject(1).put("weight", 1); put(tx)
                                        } })
                                    "get_content" -> if (emptyContent || args.getString(1) in missingTargets) JSONObject() else JSONObject().apply { contentReads++; onContent?.invoke() }.put("author", args.getString(0)).put("permlink", args.getString(1)).put("parent_author", "")
                                        .put("created", "2026-10-05T00:00:00").put("last_update", "2026-10-05T00:00:00").put("num_changes", 0)
                                        .put("active", "2026-10-09T00:00:00").put("allow_votes", true).put("last_payout", "1970-01-01T00:00:00")
                                        .put("cashout_time", "2026-10-12T00:00:00").apply { contentFields.keys().forEach { put(it, contentFields.get(it)) } }
                                    "get_active_votes" -> JSONArray().apply { if (failVotes) error("fixture own votes unavailable"); if (ownVote) put(JSONObject().put("voter", "fixture-voter").put("percent", 7000)); if (recovery) transactions.values.forEach { tx ->
                                        val first = tx.getJSONArray("operations").getJSONArray(0)
                                        if (first.getString(0) != "vote") return@forEach
                                        val vote = first.getJSONObject(1)
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
                                        if (row.getString(0) == "vote") {
                                            val op = row.getJSONObject(1)
                                            if (op.getString("permlink") !in unknownTargets) include(tx)
                                        } else {
                                            require(tipBalance != "0.000 GOLOS" && store.autoDonatePool("golos", "fixture-voter") != null) { "Donation requires explicit fixture consent" }
                                            require(row.getString(0) == "donate")
                                            includeDonation(tx)
                                        }
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
        fun includeDonation(tx: JSONObject) {
            val rows = tx.getJSONArray("operations")
            val old = histories["fixture-voter"].orEmpty()
            val id = FullFlowReceiptOracle.id(tx)
            histories["fixture-voter"] = old + (0 until rows.length()).map { i ->
                val op = rows.getJSONArray(i).getJSONObject(1)
                HistoryEvent((old.maxOfOrNull { it.index } ?: 0) + i + 1, "donate", mapOf("from" to op.getString("from"), "to" to op.getString("to"), "amount" to op.getString("amount"), "memo" to op.getJSONObject("memo").toString(), "trx_id" to id))
            }
        }
        fun include(tx: JSONObject): String {
            val op = tx.getJSONArray("operations").getJSONArray(0).getJSONObject(1)
            val operation = VoteOperation("golos", op.getString("voter"), op.getString("author"), op.getString("permlink"), op.getInt("weight"))
            val id = FullFlowReceiptOracle.id(tx)
            tx.put("block_num", receiptBlock).put("transaction_num", transactions.size + receiptIndexOffset)
            transactions[id] = tx
            val old = histories[operation.voter].orEmpty()
            histories[operation.voter] = old + HistoryEvent((old.maxOfOrNull { it.index } ?: 0) + 1, "vote",
                mapOf("voter" to operation.voter, "author" to operation.author, "permlink" to operation.permlink, "weight" to operation.weight.toString(),
                    "trx_id" to id, "block" to receiptBlock.toString(), "trx_in_block" to tx.getInt("transaction_num").toString()))
            return id
        }
        fun restart(prefsOverride: SharedPreferences? = null, boundary: ((String, java.io.File) -> Unit)? = null): WorkerStore {
            val journal = boundary?.let { space.dpos.android.storage.TransactionCheckpointStore(java.io.File(context.filesDir, "transaction-checkpoint"), prefsOverride ?: prefs, it) }
            return WorkerStore(context, secure, prefsOverride ?: prefs, journal)
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
        fun seedOld(permlink: String = "old", weight: Int = 7000, txId: String? = "a".repeat(40)) {
            store.savePending(PendingBroadcastIntent("vote", "golos", "fixture-voter", "target|$permlink|$weight", 9000, PendingBroadcastState.UNKNOWN, txId))
        }
        override fun close() {
            server.close(); pool.shutdownNow(); check(pool.awaitTermination(3, java.util.concurrent.TimeUnit.SECONDS))
            val runId = androidx.test.platform.app.InstrumentationRegistry.getArguments().getString("runId")
            if (runId != null) {
                require(runId.matches(Regex("[A-Za-z0-9_-]{1,60}")))
                val out = java.io.File(base.filesDir, "golos-fullflow-evidence-$runId").apply { mkdirs() }
                val checkpointFiles = java.io.File(context.filesDir, "transaction-checkpoint").walkTopDown().filter { it.isFile }.map {
                    JSONObject().put("file", it.relativeTo(context.filesDir).path).put("bytes", it.length())
                        .put("sha256", java.security.MessageDigest.getInstance("SHA-256").digest(it.readBytes()).joinToString("") { b -> "%02x".format(b) })
                }.toList()
                val row = JSONObject().put("pid", android.os.Process.myPid()).put("fixture", fixtureId)
                    .put("methods", JSONArray(requests.map { it.getJSONArray("params").getString(1) }))
                    .put("sends", JSONArray(sends.map { JSONObject().put("operation", it.getJSONArray("operations").getJSONArray(0).getString(0)).put("id", FullFlowReceiptOracle.id(it)) }))
                    .put("checkpointFiles", JSONArray(checkpointFiles)).put("checkpointStatus", restart().checkpointStatus())
                    .put("transition", restart().readGolosProductionTransition()).put("fence", restart().readGolosRecoveryFence())
                    .put("counter", restart().totalAutoUpvoterBroadcasted())
                java.io.File(out, "fixture-$fixtureId.json").writeText(row.toString(2))
            }
        }
    }

    internal class FullFlowProductionFixture(val f: FullFlowWireFixture = FullFlowWireFixture()) : AutoCloseable {
        var checkpoint: String? get() = f.checkpoint; set(value) { f.checkpoint = value }
        var advance: Boolean get() = f.advance; set(value) { f.advance = value }
        var badHistory: Boolean get() = f.failHistory; set(value) { f.failHistory = value }
        var emptyContent: Boolean get() = f.emptyContent; set(value) { f.emptyContent = value }
        var stale: Boolean get() = f.stale; set(value) { f.stale = value }
        val rpc get() = f.rpc
        val policy = GolosProductionPolicy(endpoint = f.endpoint, pause = {
            if (f.advance) { f.recoveryHead++; f.lib++; f.recoveryTime += 3; f.recoveryWall += 3000; f.recoveryMono += 3000 }
        })
        init {
            if (f.initialize) f.store.saveGolosRecoveryFence(oldFence())
            f.recoveryHead = 104760300; f.lib = 104760280
            f.contentFields.put("id", 17).put("root_comment", 17)
            f.histories[GolosProductionPolicy.SAMPLE_ACCOUNT] = listOf(HistoryEvent(1, "vote", emptyMap()))
        }
        fun admit() = policy.admit(rpc, { f.recoveryWall }, { f.recoveryMono }, { true })
        fun run(store: WorkerStore = f.restart(), events: List<VoteEvent> = emptyList()) = DposWorkerRunner(f.context, store,
            historyOverride = { f.history }, rpcOverride = { rpc }, eventsOverride = { _, _ -> events },
            recoveryWall = { f.recoveryWall }, recoveryMonotonic = { f.recoveryMono }, productionPolicy = policy).runOnce("production-loopback")
        fun ready() {
            run()
            f.recoveryWall += 3_800_000; f.recoveryMono += 3_800_000; f.recoveryTime = f.recoveryWall / 1000
            f.recoveryHead += 1300; f.lib += 1300; f.receiptBlock = f.lib
            f.contentFields.put("created", stamp(f.recoveryTime - 6)).put("last_update", stamp(f.recoveryTime - 6))
                .put("num_changes", 0).put("cashout_time", stamp(f.recoveryTime + 86400))
        }
        override fun close() = f.close()
        companion object {
            fun stamp(t: Long) = FullFlowWireFixture.recoveryStamp(t)
            fun oldFence() = JSONObject().put("schema", 1).put("chainId", GOLOS_CHAIN_ID)
                .put("endpoint", "https://apibeta.golos.today").put("head", GolosProductionPolicy.FOREIGN_HEIGHT)
                .put("headId", GolosProductionPolicy.FOREIGN_ID)
                .put("headTime", 1_792_033_410L).put("observedAtMs", 1_792_033_410_000L)
                .put("observedLib", 104806370L).put("verifiedLib", 104807631L)
                .put("verifiedLibTime", 1_792_037_148L).put("verifiedAtMs", 1_792_037_148_000L)
                .put("drain", 1_792_037_130L).put("cutoff", 1_792_037_130L).put("verified", true)
        }
    }
