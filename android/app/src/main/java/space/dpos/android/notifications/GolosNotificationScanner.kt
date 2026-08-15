package space.dpos.android.notifications

import org.json.JSONArray
import org.json.JSONObject
import space.dpos.android.upvoter.GrapheneChainSpecs
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL

data class HistoryEvent(val index: Long, val type: String, val data: Map<String, String>, val timestamp: String = "")
data class DposEventNotification(val id: String, val title: String, val text: String, val route: String, val sourceIndex: Long)

interface GolosHistoryClient {
    fun getAccountHistory(account: String, from: Long, limit: Int): List<HistoryEvent>
}

class HttpGrapheneHistoryClient(private val endpoint: String, private val legacyCallRpc: Boolean = false, private val apiName: String = "condenser_api") : GolosHistoryClient {
    override fun getAccountHistory(account: String, from: Long, limit: Int): List<HistoryEvent> {
        val connection = (URL(endpoint).openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            connectTimeout = 12_000
            readTimeout = 20_000
            doOutput = true
            setRequestProperty("Content-Type", "application/json")
            setRequestProperty("User-Agent", "dpos.space-android-worker/1.0")
        }
        OutputStreamWriter(connection.outputStream).use { it.write(GolosHistoryRpc.buildAccountHistoryPayload(account, from, limit, legacyCallRpc, apiName)) }
        val body = if (connection.responseCode in 200..299) connection.inputStream.bufferedReader().use { it.readText() } else connection.errorStream?.bufferedReader()?.use { it.readText() }.orEmpty()
        if (connection.responseCode !in 200..299) throw IllegalStateException("Graphene RPC HTTP ${connection.responseCode} at $endpoint: ${body.take(120)}")
        return GolosHistoryRpc.parseAccountHistory(body)
    }
}

class FallbackGrapheneHistoryClient(private val clients: List<GolosHistoryClient>) : GolosHistoryClient {
    override fun getAccountHistory(account: String, from: Long, limit: Int): List<HistoryEvent> {
        var lastError: Exception? = null
        for (client in clients) {
            try {
                return client.getAccountHistory(account, from, limit)
            } catch (e: Exception) {
                lastError = e
            }
        }
        throw IllegalStateException("all Graphene history RPC endpoints failed; last=${lastError?.message.orEmpty()}")
    }
}

class HttpGolosHistoryClient(endpoint: String = GrapheneChainSpecs.require("golos").defaultRpcEndpoint) : GolosHistoryClient by HttpGrapheneHistoryClient(endpoint, legacyCallRpc = true, apiName = "account_history")

object GolosHistoryRpc {
    fun buildAccountHistoryPayload(account: String, from: Long, limit: Int, legacyCallRpc: Boolean = false, apiName: String = "condenser_api"): String {
        val clean = account.trim().removePrefix("@").lowercase()
        val safeLimit = limit.coerceIn(1, 100)
        val safeFrom = if (from < 0) -1 else from
        val params = JSONArray().put(clean).put(safeFrom).put(safeLimit)
        if (legacyCallRpc) {
            return JSONObject()
                .put("jsonrpc", "2.0")
                .put("id", 1)
                .put("method", "call")
                .put("params", JSONArray().put(apiName).put("get_account_history").put(params))
                .toString()
        }
        return JSONObject()
            .put("jsonrpc", "2.0")
            .put("id", 1)
            .put("method", "$apiName.get_account_history")
            .put("params", params)
            .toString()
    }

    fun parseAccountHistory(json: String): List<HistoryEvent> {
        val root = JSONObject(json)
        val error = root.optJSONObject("error")
        if (error != null) throw IllegalStateException(error.optString("message", "Graphene RPC error"))
        val result = root.optJSONArray("result") ?: throw IllegalStateException("Graphene RPC response has no result array")
        val rows = mutableListOf<HistoryEvent>()
        for (i in 0 until result.length()) {
            val pair = result.optJSONArray(i) ?: continue
            val index = pair.optLong(0, -1L)
            val item = pair.optJSONObject(1) ?: continue
            val op = item.optJSONArray("op") ?: continue
            val type = op.optString(0)
            val dataObject = op.optJSONObject(1) ?: JSONObject()
            val data = mutableMapOf<String, String>()
            val keys = dataObject.keys()
            while (keys.hasNext()) {
                val key = keys.next()
                data[key] = dataObject.opt(key)?.toString().orEmpty()
            }
            if (index >= 0 && type.isNotBlank()) rows += HistoryEvent(index, type, data, item.optString("timestamp"))
        }
        return rows
    }
}

class GolosNotificationScanner(private val historyClient: GolosHistoryClient? = null, private val chainId: String = "golos") {
    fun fetchAndScan(account: String, cursor: Long?, baselineDone: Boolean, limit: Int = 50, selectedOps: List<String> = emptyList()): Pair<Long, List<DposEventNotification>> {
        val rows = historyClient?.getAccountHistory(account, cursor ?: -1L, limit).orEmpty()
        return scan(account, cursor, rows, baselineDone, selectedOps)
    }

    fun scan(account: String, cursor: Long?, rows: List<HistoryEvent>, baselineDone: Boolean, selectedOps: List<String> = emptyList()): Pair<Long, List<DposEventNotification>> {
        val target = account.trim().removePrefix("@").lowercase()
        val sorted = rows.sortedBy { it.index }
        val newest = sorted.maxOfOrNull { it.index } ?: cursor ?: -1L
        if (!baselineDone) return newest to emptyList()
        val minIndex = cursor ?: -1L
        val allowed = selectedOps.map { it.trim().lowercase() }.filter { it.isNotBlank() }.toSet()
        val notifications = sorted.filter { it.index > minIndex }.filter { allowed.isEmpty() || it.type.lowercase() in allowed }.mapNotNull { toNotification(target, it) }
        return newest to notifications
    }

    fun toNotification(account: String, event: HistoryEvent): DposEventNotification? {
        val target = account.lowercase()
        fun norm(v: String?) = v.orEmpty().trim().removePrefix("@").lowercase()
        return when (event.type) {
            "comment" -> {
                val author = norm(event.data["author"])
                val parent = norm(event.data["parent_author"])
                if (parent == target && author != target) DposEventNotification("$chainId:$target:${event.index}:comment", "Новый комментарий", "@$author ответил к материалу @$target", "#chain=$chainId&app=post&author=$author&permlink=${event.data["permlink"].orEmpty()}", event.index) else null
            }
            "content_mentions", "comment_mention" -> {
                val author = norm(event.data["author"] ?: event.data["mentioned_by"])
                if (author != target) DposEventNotification("$chainId:$target:${event.index}:mention", "Новое упоминание", "@$author упомянул $target", "#chain=$chainId&app=notifications&account=$target", event.index) else null
            }
            "award", "fixed_award" -> {
                val from = norm(event.data["initiator"])
                val to = norm(event.data["receiver"])
                val amount = event.data["reward_amount"] ?: event.data["shares"] ?: event.data["amount"]
                if (to == target && from != target) DposEventNotification(
                    "$chainId:$target:${event.index}:${event.type}",
                    if (event.type == "fixed_award") "Новая фиксированная награда VIZ" else "Новая награда VIZ",
                    listOf("от @$from", amount.orEmpty()).filter { it.isNotBlank() }.joinToString(", "),
                    "#chain=$chainId&app=history&account=$target&ops=${event.type}",
                    event.index
                ) else null
            }
            "receive_award", "benefactor_award" -> {
                val receiver = norm(event.data["receiver"])
                val benefactor = norm(event.data["benefactor"])
                val amount = event.data["shares"] ?: event.data["reward_amount"]
                if (receiver == target) DposEventNotification(
                    "$chainId:$target:${event.index}:${event.type}",
                    if (event.type == "benefactor_award") "Бенефициарская награда VIZ" else "Получена награда VIZ",
                    listOf(if (benefactor.isNotBlank()) "бенефициар @$benefactor" else "", amount.orEmpty()).filter { it.isNotBlank() }.joinToString(", "),
                    "#chain=$chainId&app=history&account=$target&ops=${event.type}",
                    event.index
                ) else null
            }
            "author_reward", "curation_reward", "comment_benefactor_reward" -> {
                val rewardAccount = norm(event.data["author"] ?: event.data["curator"] ?: event.data["benefactor"])
                if (rewardAccount == target) DposEventNotification(
                    "$chainId:$target:${event.index}:${event.type}",
                    when (event.type) { "author_reward" -> "Авторская награда"; "curation_reward" -> "Кураторская награда"; else -> "Бенефициарская награда" },
                    listOf(event.data["payout"], event.data["vesting_payout"], event.data["reward"], event.data["hbd_payout"], event.data["hive_payout"], event.data["steem_payout"]).filter { !it.isNullOrBlank() }.joinToString(", ").ifBlank { "новое reward-событие" },
                    "#chain=$chainId&app=history&account=$target&ops=${event.type}",
                    event.index
                ) else null
            }
            "transfer_to_vesting", "withdraw_vesting", "delegate_vesting_shares", "return_vesting_delegation", "account_witness_vote", "proposal_create", "proposal_update", "proposal_delete", "producer_reward" -> {
                val actor = norm(event.data["from"] ?: event.data["account"] ?: event.data["voter"] ?: event.data["creator"] ?: event.data["owner"])
                val to = norm(event.data["to"] ?: event.data["delegatee"] ?: event.data["author"] ?: event.data["receiver"] ?: event.data["account"])
                if (actor == target || to == target) DposEventNotification(
                    "$chainId:$target:${event.index}:${event.type}",
                    "Новое blockchain-событие",
                    "${event.type} #${event.index}",
                    "#chain=$chainId&app=history&account=$target&ops=${event.type}",
                    event.index
                ) else null
            }
            "transfer", "donate" -> {
                val from = norm(event.data["from"])
                val to = norm(event.data["to"] ?: event.data["receiver"])
                if (to == target && from != target) DposEventNotification("$chainId:$target:${event.index}:${event.type}", if (event.type == "donate") "Новый донат" else "Входящий перевод", "от @$from, ${event.data["amount"].orEmpty()}", "#chain=$chainId&app=history&account=$target&ops=${event.type}", event.index) else null
            }
            else -> null
        }
    }
}
