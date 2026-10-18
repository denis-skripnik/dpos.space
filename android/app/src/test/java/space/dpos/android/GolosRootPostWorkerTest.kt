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
        .put("last_payout", "1970-01-01T00:00:00").put("cashout_time", "2099-01-01T00:00:00")
        .put("created", "2026-01-01T00:00:00").put("last_update", "2026-01-01T00:00:00").put("num_changes", 0).put("allow_votes", true).put("active", "2026-01-01T00:00:00")

    private class Fixture(var contentResponse: String, val chain: String = "golos", val minEnergy: Int = 2500) : AutoCloseable {
        val contentResponses = mutableMapOf<String, String>()
        private val base = ApplicationProvider.getApplicationContext<Context>()
        val context = object : android.content.ContextWrapper(base) {
            private val isolated = java.io.File(base.filesDir, "checkpoint-fixture-${java.util.UUID.randomUUID()}").apply { mkdirs() }
            override fun getFilesDir() = isolated
        }
        val wif = ECKey.fromPrivate(BigInteger("2"), true).getPrivateKeyAsWiF(MainNetParams.get())
        val store: WorkerStore
        val requests = Collections.synchronizedList(mutableListOf<JSONObject>())
        var sends = 0
        var voted = false
        // Serve only the actual SDK-signed broadcast, with an independently encoded ID.
        var receiptMode = "canonical"
        private var capturedTransaction: JSONObject? = null
        private var capturedTransactionId: String? = null
        var energy = 10000
        var contentHttpCode = 200
        var alreadyVoted = false
        var ownVotePercent = 3700
        var omitOwnVotePercent = false
        var ownVoteTargets: Set<String>? = null
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
                        .put("last_irreversible_block_num", if (receiptMode == "reversible") 119 else 120)
                        .put("head_block_id", "0000007b01020304000000000000000000000000000000000000000000000000")
                        .put("time", "2026-10-01T00:00:00")
                    "get_transaction" -> if (receiptMode == "history_only" || capturedTransaction == null) JSONObject()
                        else JSONObject(capturedTransaction.toString()).put("transaction_id", capturedTransactionId)
                            .put("block_num", 120).put("transaction_num", 0)
                    "get_block" -> JSONObject().put("previous", "0000007901020304000000000000000000000000000000000000000000000000")
                        .put("transactions", JSONArray().apply {
                            if (capturedTransaction != null && params.getJSONArray(2).getLong(0) == 120L) {
                                put(JSONObject(capturedTransaction.toString()).apply {
                                    if (receiptMode == "mismatch") getJSONArray("operations").getJSONArray(0)
                                        .getJSONObject(1).put("weight", 1)
                                })
                            }
                        })
                    "get_active_votes" -> if (alreadyVoted && (ownVoteTargets == null || params.getJSONArray(2).getString(1) in ownVoteTargets!!))
                        JSONArray().put(JSONObject().put("voter", "fixture-voter").put("percent", ownVotePercent).apply { if (omitOwnVotePercent) remove("percent") }) else JSONArray()
                    "verify_authority" -> true
                    "broadcast_transaction_synchronous", "broadcast_transaction" -> {
                        sends++; voted = true
                        if (chain == "golos") {
                            capturedTransaction = JSONObject(params.getJSONArray(2).getJSONObject(0).toString())
                            capturedTransactionId = FullFlowReceiptOracle.id(capturedTransaction!!)
                        }
                        JSONObject()
                    }
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
            override fun irreversibleVote(event: space.dpos.android.notifications.HistoryEvent, operation: space.dpos.android.upvoter.VoteOperation, transactionId: String) = true
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
            return DposWorkerRunner(context, store, historyOverride = { history }, productionPolicy = LegacyTestGolosPolicy(history), rpcOverride = { http },
                eventsOverride = { _, _ -> events }).runOnce("root-post-fixture")
        }
        fun contentRequests() = requests.filter { it.optString("method") == "call" && it.getJSONArray("params").optString(1) == "get_content" }
        override fun close() { server.close(); serverThread.join(2000) }
    }

    @Test fun paidOutAndEditedFavoriteNeverCreatePendingAndUnknownDatesDefer() {
        for ((fields, kind, status) in listOf(
            Triple(JSONObject().put("last_payout", "2026-10-01T00:00:00"), "curator_vote", "payout_ended"),
            Triple(JSONObject().put("created", "2026-10-01T00:00:00").put("last_update", "2026-10-02T00:00:00").put("num_changes", 1), "favorite_post", "favorite_edited"),
            Triple(JSONObject().put("last_payout", "malformed"), "curator_vote", "root_post_malformed")
        )) Fixture(JSONObject().put("result", content().also { row -> fields.keys().forEach { row.put(it, fields.get(it)) } }).toString()).use { f ->
            val summary = f.run(kind)
            assertEquals(summary.toJson().toString(), 1, summary.autoUpvoterSkipSummary[status])
            assertEquals(0, f.sends)
            assertNull(f.store.readPending("vote", "golos", "fixture-voter"))
        }
    }

    @Test fun curatorSkipsAnyOwnVoteWeightWithoutChangingIt() {
        Fixture(JSONObject().put("result", content()).toString()).use { f ->
            f.alreadyVoted = true
            f.ownVotePercent = 100
            assertEquals(0, f.run().autoUpvoterBroadcasted)
            assertEquals(0, f.sends)
            assertNull(f.store.readPending("vote", "golos", "fixture-voter"))
        }
    }

    @Test fun unknownPayoutEditOrOwnVoteDataDefersWithoutCreatingPending() {
        for (field in listOf("last_payout", "cashout_time", "created", "last_update", "num_changes", "allow_votes"))
            Fixture(JSONObject().put("result", content().apply { remove(field) }).toString()).use { f ->
                assertEquals(1, f.run("favorite_post").autoUpvoterSkipSummary["root_post_malformed"])
                assertEquals(0, f.sends)
                assertNull(f.store.readPending("vote", "golos", "fixture-voter"))
            }
        Fixture(JSONObject().put("result", content()).toString()).use { f ->
            f.alreadyVoted = true
            f.omitOwnVotePercent = true
            assertEquals(1, f.run().autoUpvoterSkipSummary["own_vote_unavailable"])
            assertEquals(0, f.sends)
            assertNull(f.store.readPending("vote", "golos", "fixture-voter"))
        }
    }

    @Test fun cashoutUsesFreshChainTimeRatherThanDeviceWallClock() {
        for ((cashout, expected) in listOf("2026-09-30T00:00:00" to 0, "2026-10-02T00:00:00" to 1))
            Fixture(JSONObject().put("result", content().put("cashout_time", cashout)).toString()).use { f ->
                assertEquals(expected, f.run().autoUpvoterBroadcasted) // fixture chain time is Oct 1
                assertEquals(expected, f.sends)
            }
    }

    @Test fun oldDifferentOwnVoteDoesNotConsumeEnergyBudgetAndStarveFreshTarget() {
        Fixture(JSONObject().put("result", content()).toString(), minEnergy = 9900).use { f ->
            f.alreadyVoted = true
            f.ownVotePercent = 100
            f.ownVoteTargets = setOf("old")
            f.contentResponses["old"] = JSONObject().put("result", content().put("permlink", "old")).toString()
            val events = listOf("old", "target").mapIndexed { i, target -> VoteEvent("curator_vote", "fixture-curator", "fixture-author", target, 3700, sourceIndex = i.toLong()) }
            val summary = f.run(events = events)
            assertEquals(summary.toJson().toString(), 1, summary.autoUpvoterBroadcasted)
            assertEquals(1, f.sends)
            assertEquals(1, summary.autoUpvoterSkipSummary["already_voted"])
            assertNull(summary.autoUpvoterSkipSummary["energy"])
        }
    }

    @Test fun targetBecomingPaidOutAfterPlanIsRecheckedBeforeSigning() {
        Fixture(JSONObject().put("result", content()).toString()).use { f ->
            f.afterContent = { f.contentResponses["target"] = JSONObject().put("result", content().put("last_payout", "2026-10-01T00:00:00")).toString() }
            assertEquals(0, f.run().autoUpvoterBroadcasted)
            assertEquals(0, f.sends)
            assertNull(f.store.readPending("vote", "golos", "fixture-voter"))
        }
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
            assertEquals(1, summary.autoUpvoterSkipSummary[if (unknown) "root_post_empty" else "not_root_post"])
            assertNull(summary.autoUpvoterSkipSummary["energy"])
            assertEquals(listOf("rejected", "target", "target", "target"), f.contentRequests().map {
                it.getJSONArray("params").getJSONArray(2).getString(1)
            })
            assertEquals(-1L, f.store.autoVoteSourceCursor("golos", "fixture-voter:fixture-curator"))
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
            assertEquals(3, f.contentRequests().size) // planning + execution intake + final pre-sign eligibility
            val params = f.contentRequests().last().getJSONArray("params")
            assertEquals("social_network", params.getString(0))
            assertEquals("fixture-author", params.getJSONArray(2).getString(0))
            assertEquals("target", params.getJSONArray(2).getString(1))
            assertEquals(0, params.getJSONArray(2).getInt(2))
            assertEquals(0, params.getJSONArray(2).getInt(3))
            val tx = f.requests.single { it.optString("method") == "call" && it.getJSONArray("params").optString(1) == "broadcast_transaction" }
                .getJSONArray("params").getJSONArray(2).getJSONObject(0)
            assertEquals(3700, tx.getJSONArray("operations").getJSONArray(0).getJSONObject(1).getInt("weight"))
            val lookup = f.requests.first { it.getJSONArray("params").optString(1) == "get_transaction" }
            assertEquals(FullFlowReceiptOracle.id(tx), lookup.getJSONArray("params").getJSONArray(2).getString(0))
            assertNull(f.store.readPending("vote", "golos", "fixture-voter"))
            f.alreadyVoted = true
            assertEquals(0, f.run().autoUpvoterBroadcasted)
            assertEquals(1, f.sends)
        }
    }

    @Test fun historyOnlyReversibleAndMismatchedReceiptsStayUnknownWithoutDonation() {
        for (mode in listOf("history_only", "reversible", "mismatch"))
            Fixture(JSONObject().put("result", content()).toString()).use { f ->
                f.receiptMode = mode
                val summary = f.run()
                assertEquals(mode, 1, f.sends)
                assertEquals(mode, 0, summary.autoUpvoterBroadcasted)
                assertEquals(mode, 1, summary.autoUpvoterSkipSummary["broadcast_unknown"])
                val archived = f.store.voteArchive("golos", "fixture-voter").single()
                assertFalse(mode, archived.confirmed)
                assertEquals(mode, "fixture-author|target|3700", archived.intent.fingerprint)
                assertNull(mode, f.store.readPending("donate", "golos", "fixture-voter"))
                // Later evidence may reconcile the archive, never replay or catch up donations.
                f.receiptMode = "canonical"
                f.alreadyVoted = true
                assertEquals(mode, 0, f.run().autoUpvoterBroadcasted)
                assertEquals(mode, 1, f.sends)
                assertNull(mode, f.store.readPending("donate", "golos", "fixture-voter"))
            }
    }

    @Test fun hiveAndSteemDoNotAcquireGolosRootRestriction() {
        for (chain in listOf("hive", "steem")) Fixture("not-json", chain).use { f ->
            assertEquals(1, f.run().autoUpvoterBroadcasted)
            assertEquals(1, f.sends)
            assertTrue(f.contentRequests().isEmpty())
        }
    }

    @Test fun eligibilityChangedAfterOuterCheckIsReadAgainBeforeSigner() {
        for (favorite in listOf(false, true)) Fixture(JSONObject().put("result", content()).toString()).use { f ->
            f.afterContent = {
                if (f.contentRequests().size == 2) {
                    val changed = content().apply {
                        if (favorite) put("last_update", "2026-02-01T00:00:00").put("num_changes", 1)
                        else put("last_payout", "2026-10-01T00:00:00")
                    }
                    f.contentResponse = JSONObject().put("result", changed).toString()
                }
            }
            val report = f.run(if (favorite) "favorite_post" else "curator_vote")
            assertEquals(0, f.sends)
            assertEquals(1, report.autoUpvoterSkipSummary[if (favorite) "favorite_edited" else "payout_ended"])
            assertFalse(f.requests.any { it.optString("method").endsWith("verify_authority") })
            assertNull(f.store.readPending("vote", "golos", "fixture-voter"))
        }
    }

    @Test fun transientUnknownKeepsCursorAndValidCandidateCanRetry() {
        Fixture("{}").use { f ->
            assertEquals(1, f.run().autoUpvoterSkipSummary["root_post_empty"])
            assertEquals(-1L, f.store.autoVoteSourceCursor("golos", "fixture-voter:fixture-curator"))
            f.contentResponse = JSONObject().put("result", content()).toString()
            assertEquals(1, f.run().autoUpvoterBroadcasted)
            assertEquals(-1L, f.store.autoVoteSourceCursor("golos", "fixture-voter:fixture-curator"))
        }
        Fixture(JSONObject().put("result", content("parent")).toString()).use { f ->
            assertEquals(1, f.run().autoUpvoterSkipSummary["not_root_post"])
            assertEquals(-1L, f.store.autoVoteSourceCursor("golos", "fixture-voter:fixture-curator"))
        }
    }

    @Test fun transportFailureFailsClosedWithoutConsumingCursor() {
        Fixture("{}").use { f ->
            f.contentHttpCode = 503
            assertEquals(1, f.run().autoUpvoterSkipSummary["root_post_transport"])
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
