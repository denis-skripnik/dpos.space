package space.dpos.android

import android.content.Context
import android.content.ContextWrapper
import android.os.Process
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.bitcoinj.core.ECKey
import org.bitcoinj.params.MainNetParams
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import space.dpos.android.notifications.HttpGrapheneHistoryClient
import space.dpos.android.storage.EncryptedKeyRef
import space.dpos.android.storage.TransactionCheckpointStore
import space.dpos.android.storage.WorkerStore
import space.dpos.android.upvoter.*
import java.io.File
import java.math.BigInteger
import java.net.InetAddress
import java.net.ServerSocket
import java.time.LocalDateTime
import java.time.ZoneOffset
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicInteger

/** Three actual Android processes, real signer/HTTP runtime, loopback-only chain fixture.
 * Persist only public own-vote state in the fixture chain, never keys or signed payloads.
 */
@RunWith(AndroidJUnit4::class)
class CheckpointRuntimeRestartTest {
    @Test fun repairedCompleteLedgerAllowsOneFreshSendAcrossThreeProcessesWithoutUnknownReplay() {
        val target = InstrumentationRegistry.getInstrumentation().targetContext
        val phase = InstrumentationRegistry.getArguments().getString("phase") ?: error("A/B/C required")
        val runId = (InstrumentationRegistry.getArguments().getString("runId") ?: "default").also { require(it.matches(Regex("[A-Za-z0-9_-]{1,64}"))) }
        val name = "checkpoint-runtime-restart-$runId"
        val root = File(target.filesDir, name)
        if (phase == "A") { check(!root.exists()); check(root.mkdirs()) }
        val ctx = object : ContextWrapper(target) { override fun getFilesDir() = root }
        val prefs = target.getSharedPreferences(name, Context.MODE_PRIVATE)
        var fail = false
        val journal = TransactionCheckpointStore(File(root, "transaction-checkpoint"), prefs) { stage, _ ->
            if (fail && stage == "checkpoint:sync") throw java.io.IOException("injected")
        }
        val store = WorkerStore(ctx, prefs, prefs, journal)
        ChainFixture(root).use { chain ->
            val runtime = VoteRuntime(chain.rpc, broadcaster = GolosBroadcastClient(chain.rpc),
                historyClient = HttpGrapheneHistoryClient(chain.endpoint, true, "account_history"),
                pendingStore = store, canAct = { store.workerEnabled() }, confirmationRetries = 1, confirmationDelayMs = 0)
            val fresh = VoteOperation("golos", "fixture-voter", "bob", "fresh", 7000)
            val old = fresh.copy(permlink = "old", weight = 9999)
            val key = EncryptedKeyRef("golos", "fixture-voter", "posting", "posting")
            when (phase) {
                "A" -> {
                    store.setWorkerEnabled(true)
                    store.savePending(PendingBroadcastIntent("vote", "golos", "fixture-voter", "bob|old|7000", -1,
                        PendingBroadcastState.UNKNOWN, transactionId = "a".repeat(40), createdAtMs = 1000))
                    store.archiveActiveVote("golos", "fixture-voter")
                    fail = true
                    assertTrue(runCatching { runtime.execute(fresh, key, chain.wif) }.isFailure)
                    assertEquals(0, chain.sends.get())
                    assertFalse(store.retryCheckpointStorage())
                    fail = false
                    assertTrue(store.retryCheckpointStorage())
                    assertNull(store.readPending("vote", "golos", "fixture-voter"))
                    assertEquals(1, store.voteArchive("golos", "fixture-voter").size)
                    File(root, "A.pid").writeText(Process.myPid().toString())
                }
                "B" -> {
                    assertNotEquals(File(root, "A.pid").readText().toInt(), Process.myPid())
                    val result = runtime.execute(fresh, key, chain.wif)
                    assertEquals(result.reason, "broadcast_confirmed", result.status)
                    assertEquals(1, chain.sends.get())
                    assertEquals("broadcast_unknown", runtime.execute(old, key, chain.wif).status)
                    assertEquals(1, chain.sends.get())
                    File(root, "B.pid").writeText(Process.myPid().toString())
                }
                "C" -> {
                    assertNotEquals(File(root, "B.pid").readText().toInt(), Process.myPid())
                    assertEquals("already_voted", runtime.execute(fresh, key, chain.wif).status)
                    assertEquals("broadcast_unknown", runtime.execute(old, key, chain.wif).status)
                    assertEquals(0, chain.sends.get())
                    assertFalse(store.voteArchive("golos", "fixture-voter").single().confirmed)
                    assertEquals(1, JSONObject(File(root, "transaction-checkpoint/transactions.json").readText()).getJSONObject("terminal").length())
                }
                else -> error("unknown phase")
            }
            println("CHECKPOINT_ANDROID_RUNTIME phase=$phase pid=${Process.myPid()} loopbackSends=${chain.sends.get()} oldTargetHeld=true")
        }
    }

    private class ChainFixture(private val root: File) : AutoCloseable {
        // A deterministic, explicitly non-secret fixture key. Never log or persist it.
        val wif = ECKey.fromPrivate(BigInteger.valueOf(2), true).getPrivateKeyAsWiF(MainNetParams.get())
        private val server = ServerSocket(0, 50, InetAddress.getByName("127.0.0.1"))
        private val pool = Executors.newSingleThreadExecutor()
        val endpoint = "http://127.0.0.1:${server.localPort}/"
        val rpc = HttpGrapheneRpcClient(GrapheneChainSpecs.require("golos"), endpoint)
        val sends = AtomicInteger()
        private val transactions = linkedMapOf<String, JSONObject>()
        private val votesFile = File(root, "fixture-chain-public-votes.json")
        private val votes = if (votesFile.exists()) JSONObject(votesFile.readText()) else JSONObject().put("bob/old", 7000)
        private val now = LocalDateTime.now(ZoneOffset.UTC).withNano(0)
        private fun timestamp(value: LocalDateTime) = value.format(java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss"))
        init {
            pool.submit {
                while (!server.isClosed) {
                    val socket = try { server.accept() } catch (_: Exception) { break }
                    socket.use {
                        val reader = socket.getInputStream().bufferedReader()
                        reader.readLine()
                        var length = 0
                        while (true) {
                            val line = reader.readLine() ?: error("short HTTP headers")
                            if (line.isEmpty()) break
                            if (line.startsWith("Content-Length:", true)) length = line.substringAfter(':').trim().toInt()
                        }
                        val chars = CharArray(length); var offset = 0
                        while (offset < length) { val n = reader.read(chars, offset, length - offset); check(n > 0); offset += n }
                        val request = JSONObject(String(chars)); val params = request.getJSONArray("params")
                        val method = params.getString(1); val args = params.getJSONArray(2)
                        val result = respond(method, args)
                        val bytes = JSONObject().put("jsonrpc", "2.0").put("id", request.opt("id")).put("result", result).toString().toByteArray()
                        socket.getOutputStream().write("HTTP/1.1 200 OK\r\nContent-Length: ${bytes.size}\r\nConnection: close\r\n\r\n".toByteArray())
                        socket.getOutputStream().write(bytes)
                    }
                }
            }
        }
        private fun respond(method: String, args: JSONArray): Any = when (method) {
            "get_accounts" -> JSONArray().put(JSONObject().put("voting_power", 10000).put("posting", JSONObject()
                .put("weight_threshold", 1).put("key_auths", JSONArray().put(JSONArray().put(GraphenePublicKey.fromWif(wif)).put(1)))))
            "get_dynamic_global_properties" -> JSONObject().put("head_block_number", 123).put("last_irreversible_block_num", 120)
                .put("head_block_id", "0000007b01020304000000000000000000000000000000000000000000000000").put("time", timestamp(now))
            "get_block" -> JSONObject().put("previous", "0000007901020304000000000000000000000000000000000000000000000000")
                .put("transactions", JSONArray(transactions.values.toList()))
            "get_active_votes" -> JSONArray().apply {
                votes.opt("${args.getString(0)}/${args.getString(1)}")?.let { put(JSONObject().put("voter", "fixture-voter").put("percent", it)) }
            }
            "get_content" -> JSONObject().put("author", args.getString(0)).put("permlink", args.getString(1)).put("parent_author", "")
                .put("created", timestamp(now.minusDays(1))).put("last_update", timestamp(now.minusDays(1))).put("num_changes", 0)
                .put("allow_votes", true).put("last_payout", "1970-01-01T00:00:00").put("cashout_time", timestamp(now.plusDays(1)))
            "verify_authority" -> true
            "get_transaction" -> transactions[args.getString(0)] ?: JSONObject()
            "get_account_history" -> JSONArray().apply {
                transactions.entries.forEachIndexed { index, row ->
                    val tx = row.value
                    put(JSONArray().put(index + 1).put(JSONObject().put("op", tx.getJSONArray("operations").getJSONArray(0))
                        .put("trx_id", row.key).put("block", 120).put("trx_in_block", tx.getInt("transaction_num"))))
                }
            }
            "broadcast_transaction_synchronous", "broadcast_transaction" -> {
                sends.incrementAndGet()
                val tx = args.getJSONObject(0); val data = tx.getJSONArray("operations").getJSONArray(0).getJSONObject(1)
                val operation = VoteOperation("golos", data.getString("voter"), data.getString("author"), data.getString("permlink"), data.getInt("weight"))
                val id = GolosVoteProof.id(tx, operation)!!
                val included = JSONObject(tx.toString()).put("block_num", 120).put("transaction_num", transactions.size)
                transactions[id] = included
                votes.put("${operation.author}/${operation.permlink}", operation.weight)
                votesFile.writeText(votes.toString()) // Public chain state only; not transaction authority.
                JSONObject()
            }
            else -> error("unsupported fixture method: $method")
        }
        override fun close() { server.close(); pool.shutdownNow(); pool.awaitTermination(5, java.util.concurrent.TimeUnit.SECONDS) }
    }
}
