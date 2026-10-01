package space.dpos.android

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import org.bitcoinj.core.ECKey
import org.bitcoinj.params.MainNetParams
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import space.dpos.android.notifications.GolosHistoryClient
import space.dpos.android.notifications.HistoryEvent
import space.dpos.android.runtime.AccountImportRequest
import space.dpos.android.runtime.WorkerCommandPolicy
import space.dpos.android.storage.WorkerStore
import space.dpos.android.upvoter.*
import space.dpos.android.worker.DposWorkerRunner
import space.dpos.android.worker.WorkerRunSummary
import java.math.BigInteger
import java.net.ServerSocket
import java.net.InetAddress
import java.util.Collections
import java.security.MessageDigest

@RunWith(RobolectricTestRunner::class)
class GolosRootPostWorkerTest {
    private fun content(parent: Any = ""): JSONObject = JSONObject()
        .put("author", "fixture-author").put("permlink", "target").put("parent_author", parent)

    private class Fixture(var contentResponse: String, val chain: String = "golos", val minEnergy: Int = 2500) : AutoCloseable {
        val contentResponses = mutableMapOf<String, String>()
        val context = ApplicationProvider.getApplicationContext<Context>()
        val wif = ECKey.fromPrivate(BigInteger("2"), true).getPrivateKeyAsWiF(MainNetParams.get())
        val store: WorkerStore
        val requests = Collections.synchronizedList(mutableListOf<JSONObject>())
        var sends = 0
        var voted = false
        var energy = 10000
        var contentHttpCode = 200
        var alreadyVoted = false
        var priorHistory = emptyList<HistoryEvent>()
        val server = ServerSocket(0, 50, InetAddress.getByName("127.0.0.1"))
        val serverThread: Thread
        var afterContent: (() -> Unit)? = null
        init {
            context.getSharedPreferences("dpos_worker", Context.MODE_PRIVATE).edit().clear().commit()
            context.getSharedPreferences("root-post-fixture", Context.MODE_PRIVATE).edit().clear().commit()
            store = WorkerStore(context, context.getSharedPreferences("root-post-fixture", Context.MODE_PRIVATE))
            store.setWorkerEnabled(true)
            store.importDecision(WorkerCommandPolicy.validateImport(AccountImportRequest(chain, "fixture-voter",
                enableNotifications = false, enableAutoUpvoter = true, explicitConsent = true,
                curators = listOf("fixture-curator"), favorites = listOf("fixture-author"),
                autoDonate = chain == "golos", autoDonatePool = "10 1", minEnergy = minEnergy)))
            store.saveEncryptedKeyRef(store.defaultPostingKeyRef(chain, "fixture-voter"), wif)
            serverThread = Thread {
              while (!server.isClosed) {
                val socket = try { server.accept() } catch (_: java.net.SocketException) { break }
                socket.use {
                val reader = socket.getInputStream().bufferedReader()
                reader.readLine()
                var length = 0
                while (true) {
                    val line = reader.readLine() ?: break
                    if (line.isEmpty()) break
                    if (line.startsWith("Content-Length:", ignoreCase = true)) length = line.substringAfter(':').trim().toInt()
                }
                val body = CharArray(length)
                var read = 0
                while (read < length) { val n = reader.read(body, read, length - read); if (n < 0) error("short request"); read += n }
                val request = JSONObject(String(body))
                requests += request
                val params = request.getJSONArray("params")
                val method = if (request.getString("method") == "call") params.getString(1) else request.getString("method").substringAfter('.')
                val result: Any = when (method) {
                    "get_accounts" -> JSONArray().put(JSONObject().put("voting_power", energy)
                        .put("tip_balance", "0.000 GOLOS")
                        .put("posting", JSONObject().put("key_auths", JSONArray().put(JSONArray()
                            .put(GraphenePublicKey.fromWif(wif, GrapheneChainSpecs.require(chain).publicKeyPrefix)).put(1)))))
                    "get_dynamic_global_properties" -> JSONObject().put("head_block_number", 123)
                        .put("head_block_id", "0000007b01020304000000000000000000000000000000000000000000000000")
                        .put("time", "2026-10-01T00:00:00")
                    "get_block" -> JSONObject().put("previous", "0000007901020304000000000000000000000000000000000000000000000000")
                    "get_active_votes" -> if (alreadyVoted) JSONArray().put(JSONObject().put("voter", "fixture-voter").put("percent", 3700)) else JSONArray()
                    "verify_authority" -> true
                    "broadcast_transaction_synchronous", "broadcast_transaction" -> { sends++; voted = true; JSONObject() }
                    else -> JSONObject()
                }
                val response = if (method == "get_content") contentResponses[params.getJSONArray(2).getString(1)] ?: contentResponse
                    else JSONObject().put("result", result).toString()
                if (method == "get_content") afterContent?.invoke()
                val bytes = response.toByteArray()
                socket.getOutputStream().use { output ->
                    val code = if (method == "get_content") contentHttpCode else 200
                    output.write("HTTP/1.1 $code Fixture\r\nContent-Type: application/json\r\nContent-Length: ${bytes.size}\r\nConnection: close\r\n\r\n".toByteArray())
                    output.write(bytes)
                }
                }
              }
            }
            serverThread.start()
        }
        val history = object : GolosHistoryClient {
            override fun getAccountHistory(account: String, from: Long, limit: Int): List<HistoryEvent> {
                if (!voted) return priorHistory
                val pending = store.readPending("vote", chain, "fixture-voter") ?: return emptyList()
                return listOf(HistoryEvent(1, "vote", mapOf("voter" to "fixture-voter", "author" to "fixture-author",
                    "permlink" to "target", "weight" to "3700", "trx_id" to pending.transactionId.orEmpty())))
            }
        }
        fun run(kind: String = "curator_vote", events: List<VoteEvent> = listOf(VoteEvent(kind,
            voter = "fixture-curator", author = "fixture-author", permlink = "target", weight = 3700, sourceIndex = 12))): WorkerRunSummary {
            val http = HttpGrapheneRpcClient(GrapheneChainSpecs.require(chain), "http://127.0.0.1:${server.localPort}/")
            return DposWorkerRunner(context, store, historyOverride = { history }, rpcOverride = { http },
                eventsOverride = { _, _ -> events }).runOnce("root-post-fixture")
        }
        fun contentRequests() = requests.filter { it.optString("method") == "call" && it.getJSONArray("params").optString(1) == "get_content" }
        override fun close() { server.close(); serverThread.join(2000) }
    }

    @Test fun mixedRejectedAndRootCandidatesDoNotStarveRootAtTightEnergyFloor() {
        for (unknown in listOf(false, true)) Fixture(JSONObject().put("result", content()).toString(), minEnergy = 9800).use { f ->
            f.contentResponses["rejected"] = if (unknown) "{}" else JSONObject().put("result",
                content("parent").put("permlink", "rejected")).toString()
            val events = listOf("rejected", "target").mapIndexed { index, permlink ->
                VoteEvent("curator_vote", voter = "fixture-curator", author = "fixture-author",
                    permlink = permlink, weight = 3700, sourceIndex = 11L + index)
            }
            val summary = f.run(events = events)
            assertEquals(summary.toJson().toString(), 1, summary.autoUpvoterBroadcasted)
            assertEquals(1, f.sends)
            assertEquals(1, summary.autoUpvoterSkipSummary[if (unknown) "root_post_unknown" else "not_root_post"])
            assertNull(summary.autoUpvoterSkipSummary["energy"])
            assertEquals(listOf("rejected", "target"), f.contentRequests().map {
                it.getJSONArray("params").getJSONArray(2).getString(1)
            })
            assertEquals(if (unknown) -1L else 12L, f.store.autoVoteSourceCursor("golos", "fixture-voter:fixture-curator"))
            if (unknown) {
                // The uncertain event is retried, while the confirmed root is not sent twice.
                f.alreadyVoted = true
                f.run(events = events)
                assertEquals(1, f.sends)
                assertEquals(-1L, f.store.autoVoteSourceCursor("golos", "fixture-voter:fixture-curator"))
            }
        }
    }

    @Test fun curatorCommentsAndUnprovenContentNeverVoteOrDonate() {
        val invalid = listOf(
            content("parent"), content(" "), content(JSONObject.NULL), content(0), content(false), content(JSONObject()), content(JSONArray()),
            content().apply { remove("parent_author") }, content().put("author", "other"),
            content().put("permlink", "other"), content().put("author", 1), content().put("permlink", JSONObject.NULL)
        ).map { JSONObject().put("result", it).toString() } + listOf(
            "{}", "{\"result\":null}", "{\"result\":[]}", "not-json", "{\"error\":{\"message\":\"unavailable\"}}"
        )
        for (response in invalid) Fixture(response).use { f ->
            val summary = f.run()
            assertEquals(response, 0, f.sends)
            assertEquals(response, 0, summary.autoUpvoterBroadcasted)
            assertEquals(response, 1, f.contentRequests().size)
            assertNull(f.store.readPending("vote", "golos", "fixture-voter"))
            assertNull(f.store.readPending("donate", "golos", "fixture-voter"))
        }
    }

    @Test fun favoriteSyntheticCommentCannotBypassCheck() {
        Fixture(JSONObject().put("result", content("parent")).toString()).use { f ->
            f.run("favorite_post")
            assertEquals(0, f.sends)
            assertEquals(1, f.contentRequests().size)
        }
    }

    @Test fun provenRootPostKeepsPositiveCuratorWeightAndHistoryConfirmation() {
        Fixture(JSONObject().put("result", content()).toString()).use { f ->
            val summary = f.run()
            assertEquals(summary.toJson().toString(), 1, f.sends)
            assertEquals(summary.toJson().toString(), 1, summary.autoUpvoterBroadcasted)
            val params = f.contentRequests().single().getJSONArray("params")
            assertEquals("social_network", params.getString(0))
            assertEquals("fixture-author", params.getJSONArray(2).getString(0))
            assertEquals("target", params.getJSONArray(2).getString(1))
            assertEquals(0, params.getJSONArray(2).getInt(2))
            assertEquals(0, params.getJSONArray(2).getInt(3))
            val tx = f.requests.single { it.optString("method") == "call" && it.getJSONArray("params").optString(1) == "broadcast_transaction" }
                .getJSONArray("params").getJSONArray(2).getJSONObject(0)
            assertEquals(3700, tx.getJSONArray("operations").getJSONArray(0).getJSONObject(1).getInt("weight"))
        }
    }

    @Test fun hiveAndSteemDoNotAcquireGolosRootRestriction() {
        for (chain in listOf("hive", "steem")) Fixture("not-json", chain).use { f ->
            assertEquals(1, f.run().autoUpvoterBroadcasted)
            assertEquals(1, f.sends)
            assertTrue(f.contentRequests().isEmpty())
        }
    }

    @Test fun transientUnknownKeepsCursorAndValidCandidateCanRetry() {
        Fixture("{}").use { f ->
            assertEquals(1, f.run().autoUpvoterSkipSummary["root_post_unknown"])
            assertEquals(-1L, f.store.autoVoteSourceCursor("golos", "fixture-voter:fixture-curator"))
            f.contentResponse = JSONObject().put("result", content()).toString()
            assertEquals(1, f.run().autoUpvoterBroadcasted)
            assertEquals(12L, f.store.autoVoteSourceCursor("golos", "fixture-voter:fixture-curator"))
        }
        Fixture(JSONObject().put("result", content("parent")).toString()).use { f ->
            assertEquals(1, f.run().autoUpvoterSkipSummary["not_root_post"])
            assertEquals(12L, f.store.autoVoteSourceCursor("golos", "fixture-voter:fixture-curator"))
        }
    }

    @Test fun transportFailureFailsClosedWithoutConsumingCursor() {
        Fixture("{}").use { f ->
            f.contentHttpCode = 503
            assertEquals(1, f.run().autoUpvoterSkipSummary["root_post_unknown"])
            assertEquals(0, f.sends)
            assertEquals(-1L, f.store.autoVoteSourceCursor("golos", "fixture-voter:fixture-curator"))
        }
    }

    @Test fun stopOrRevokedConsentDuringContentLookupPreventsSigningAndSending() {
        for (stop in listOf(true, false)) Fixture(JSONObject().put("result", content()).toString()).use { f ->
            f.afterContent = {
                if (stop) f.store.setWorkerEnabled(false) else f.store.importDecision(WorkerCommandPolicy.validateImport(
                    AccountImportRequest("golos", "fixture-voter", enableNotifications = false, enableAutoUpvoter = false, explicitConsent = true,
                        updateAutoUpvoter = true)))
            }
            assertEquals(1, f.run().autoUpvoterSkipSummary["cancelled"])
            assertEquals(0, f.sends)
            assertFalse(f.requests.any { it.toString().contains("verify_authority") })
            assertNull(f.store.readPending("vote", "golos", "fixture-voter"))
        }
    }

    @Test fun energyAndAlreadyVotedGuardsRemainInForce() {
        Fixture(JSONObject().put("result", content()).toString()).use { f ->
            f.energy = 0
            assertEquals(0, f.run().autoUpvoterBroadcasted)
            assertEquals(0, f.sends)
            assertTrue(f.contentRequests().isEmpty())
        }
        Fixture(JSONObject().put("result", content()).toString()).use { f ->
            f.alreadyVoted = true
            assertEquals(0, f.run().autoUpvoterBroadcasted)
            assertEquals(0, f.sends)
            assertNull(f.store.readPending("donate", "golos", "fixture-voter"))
        }
    }

    @Test fun pendingDonationStillReconcilesBeforeCommentOrUnknownCandidateIsSkipped() {
        for (response in listOf("{}", JSONObject().put("result", content("parent")).toString())) Fixture(response).use { f ->
            val fingerprint = MessageDigest.getInstance("SHA-256").digest("fixture-author/target".toByteArray())
                .joinToString("") { "%02x".format(it) }
            val txId = "a".repeat(40)
            f.store.savePending(PendingBroadcastIntent("donate", "golos", "fixture-voter",
                "$fingerprint|fixture-author|target|1.896 GOLOS|0.004 GOLOS", 90, transactionId = txId))
            f.priorHistory = listOf("post_donate" to "fixture-author", "fee_donate" to "denis-skripnik").mapIndexed { index, (type, to) ->
                HistoryEvent(91L + index, "donate", mapOf("from" to "fixture-voter", "to" to to,
                    "amount" to if (index == 0) "1.896 GOLOS" else "0.004 GOLOS", "trx_id" to txId,
                    "memo" to JSONObject().put("app", "dpos.space").put("version", 1).put("target", JSONObject()
                        .put("type", type).put("author", "fixture-author").put("permlink", "target")).toString()))
            }
            f.run()
            assertEquals(0, f.sends)
            assertNull(f.store.readPending("donate", "golos", "fixture-voter"))
            assertTrue(f.store.donated("fixture-voter", fingerprint))
            assertEquals(1, f.contentRequests().size)
        }
    }
}
