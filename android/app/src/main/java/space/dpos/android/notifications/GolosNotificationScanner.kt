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

class HttpGrapheneHistoryClient(private val endpoint: String, private val legacyCallRpc: Boolean = false) : GolosHistoryClient {
    override fun getAccountHistory(account: String, from: Long, limit: Int): List<HistoryEvent> {
        val connection = (URL(endpoint).openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            connectTimeout = 12_000
            readTimeout = 20_000
            doOutput = true
            setRequestProperty("Content-Type", "application/json")
        }
        OutputStreamWriter(connection.outputStream).use { it.write(GolosHistoryRpc.buildAccountHistoryPayload(account, from, limit, legacyCallRpc)) }
        val body = if (connection.responseCode in 200..299) connection.inputStream.bufferedReader().use { it.readText() } else connection.errorStream?.bufferedReader()?.use { it.readText() }.orEmpty()
        if (connection.responseCode !in 200..299) throw IllegalStateException("Graphene RPC HTTP ${connection.responseCode}: ${body.take(120)}")
        return GolosHistoryRpc.parseAccountHistory(body)
    }
}

class HttpGolosHistoryClient(endpoint: String = GrapheneChainSpecs.require("golos").defaultRpcEndpoint) : GolosHistoryClient by HttpGrapheneHistoryClient(endpoint)

object GolosHistoryRpc {
    fun buildAccountHistoryPayload(account: String, from: Long, limit: Int, legacyCallRpc: Boolean = false): String {
        val clean = account.trim().removePrefix("@").lowercase()
        val safeLimit = limit.coerceIn(1, 100)
        val safeFrom = if (from < 0) -1 else from
        val params = JSONArray().put(clean).put(safeFrom).put(safeLimit)
        if (legacyCallRpc) {
            return JSONObject()
                .put("jsonrpc", "2.0")
                .put("id", 1)
                .put("method", "call")
                .put("params", JSONArray().put("condenser_api").put("get_account_history").put(params))
                .toString()
        }
        return JSONObject()
            .put("jsonrpc", "2.0")
            .put("id", 1)
            .put("method", "condenser_api.get_account_history")
            .put("params", params)
            .toString()
    }

    fun parseAccountHistory(json: String): List<HistoryEvent> {
        val root = JSONObject(json)
        val result = root.optJSONArray("result") ?: return emptyList()
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
    fun fetchAndScan(account: String, cursor: Long?, baselineDone: Boolean, limit: Int = 50): Pair<Long, List<DposEventNotification>> {
        val rows = historyClient?.getAccountHistory(account, cursor ?: -1L, limit).orEmpty()
        return scan(account, cursor, rows, baselineDone)
    }

    fun scan(account: String, cursor: Long?, rows: List<HistoryEvent>, baselineDone: Boolean): Pair<Long, List<DposEventNotification>> {
        val target = account.trim().removePrefix("@").lowercase()
        val sorted = rows.sortedBy { it.index }
        val newest = sorted.maxOfOrNull { it.index } ?: cursor ?: -1L
        if (!baselineDone) return newest to emptyList()
        val minIndex = cursor ?: -1L
        val notifications = sorted.filter { it.index > minIndex }.mapNotNull { toNotification(target, it) }
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
            "transfer", "donate" -> {
                val from = norm(event.data["from"])
                val to = norm(event.data["to"] ?: event.data["receiver"])
                if (to == target && from != target) DposEventNotification("$chainId:$target:${event.index}:${event.type}", if (event.type == "donate") "Новый донат" else "Входящий перевод", "от @$from, ${event.data["amount"].orEmpty()}", "#chain=$chainId&app=history&account=$target&ops=${event.type}", event.index) else null
            }
            else -> null
        }
    }
}
