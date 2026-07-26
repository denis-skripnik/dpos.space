package space.dpos.android.notifications

import org.json.JSONArray
import org.json.JSONObject
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.time.Instant

object RestWalletNotificationSpecs {
    private const val MINTER_EXPLORER = "https://explorer-api.minter.network/api/v2"
    private const val DECIMAL_API = "https://api.decimalchain.com/api/v1"

    val supportedChains: Set<String> = setOf("minter", "decimal")
    val notificationOps: Map<String, List<String>> = mapOf(
        "minter" to listOf("send", "multisend", "delegate", "unbond", "sell", "sell_swap_pool", "add_liquidity", "remove_liquidity", "create_coin", "mint_token", "burn_token"),
        "decimal" to listOf("send", "multisend", "delegate", "unbond", "create_token", "transfer_token", "nft")
    )

    private val operationAliases: Map<String, Map<String, String>> = mapOf(
        "minter" to mapOf("13" to "multisend", "0x0d" to "multisend", "multisend_coin" to "multisend", "coin_multisend" to "multisend", "COIN_MULTISEND" to "multisend"),
        "decimal" to mapOf("multi_send" to "multisend", "/decimal.coin.v1.MsgMultiSendCoin" to "multisend", "/decimal.coin.v1.msgmultisendcoin" to "multisend", "MsgMultiSendCoin" to "multisend", "msgmultisendcoin" to "multisend")
    )

    fun canonicalType(chainId: String, type: String): String {
        val aliases = operationAliases[chainId].orEmpty()
        aliases[type]?.let { return it }
        aliases[type.lowercase()]?.let { return it }
        return type
    }

    fun urlFor(chainId: String, account: String, limit: Int): String = when (chainId) {
        "minter" -> "$MINTER_EXPLORER/addresses/${account}/transactions?page=1"
        "decimal" -> "$DECIMAL_API/txs/txs-by-address/${account}?limit=${limit.coerceIn(1, 100)}&offset=0"
        else -> throw IllegalArgumentException("unsupported REST notification chain: $chainId")
    }
}

class RestWalletHistoryClient(private val chainId: String) {
    fun getTransactions(account: String, limit: Int = 50): List<HistoryEvent> {
        val clean = account.trim()
        val connection = (URL(RestWalletNotificationSpecs.urlFor(chainId, clean, limit)).openConnection() as HttpURLConnection).apply {
            requestMethod = "GET"
            connectTimeout = 12_000
            readTimeout = 20_000
            setRequestProperty("Accept", "application/json")
        }
        val body = if (connection.responseCode in 200..299) connection.inputStream.bufferedReader().use { it.readText() } else connection.errorStream?.bufferedReader()?.use { it.readText() }.orEmpty()
        if (connection.responseCode !in 200..299) throw IllegalStateException("REST history HTTP ${connection.responseCode}: ${body.take(120)}")
        return parseTransactions(body)
    }

    fun parseTransactions(json: String): List<HistoryEvent> {
        val root = JSONObject(json.ifBlank { "{}" })
        val rows = unwrapRows(root)
        val result = mutableListOf<HistoryEvent>()
        for (i in 0 until rows.length()) {
            val obj = rows.optJSONObject(i) ?: continue
            val data = obj.optJSONObject("data") ?: obj.optJSONObject("message") ?: obj.optJSONObject("payload") ?: obj
            val type = RestWalletNotificationSpecs.canonicalType(chainId, firstNonBlank(obj.optString("type"), obj.optString("tx_type"), obj.optString("transaction_type"), obj.optString("message_type"), data.optString("type"), data.optString("@type"), data.optString("msg_type"), "transaction"))
            val index = sourceIndex(obj, data, fallback = i.toLong())
            val map = mutableMapOf<String, String>()
            flatten(data, map)
            for (key in listOf("hash", "tx_hash", "id", "timestamp", "time", "created_at", "height", "block", "block_number")) {
                val value = obj.opt(key)?.toString().orEmpty()
                if (value.isNotBlank()) map[key] = value
            }
            result += HistoryEvent(index, type, map, firstNonBlank(obj.optString("timestamp"), obj.optString("time"), obj.optString("created_at")))
        }
        return result
    }


    private fun unwrapRows(root: JSONObject): JSONArray {
        val candidates = listOf(
            root.optJSONArray("txs"), root.optJSONArray("transactions"), root.optJSONArray("data"),
            root.optJSONObject("result")?.optJSONArray("txs"), root.optJSONObject("result")?.optJSONArray("Txs"), root.optJSONObject("result")?.optJSONArray("transactions"), root.optJSONArray("result"),
            root.optJSONObject("data")?.optJSONArray("txs"), root.optJSONObject("data")?.optJSONArray("transactions")
        )
        return candidates.firstOrNull { it != null } ?: JSONArray()
    }

    private fun sourceIndex(obj: JSONObject, data: JSONObject, fallback: Long): Long {
        for (key in listOf("timestamp", "time", "created_at")) {
            parseTime(obj.optString(key)).takeIf { it > 0 }?.let { return it }
            parseTime(data.optString(key)).takeIf { it > 0 }?.let { return it }
        }
        for (key in listOf("height", "block", "block_number", "nonce", "id")) {
            obj.optLong(key, -1L).takeIf { it >= 0 }?.let { return it }
            data.optLong(key, -1L).takeIf { it >= 0 }?.let { return it }
        }
        return fallback
    }

    private fun parseTime(value: String): Long = try {
        if (value.isBlank()) -1L else Instant.parse(if (value.endsWith("Z")) value else "${value}Z").toEpochMilli()
    } catch (_: Exception) { -1L }

    private fun flatten(obj: JSONObject, out: MutableMap<String, String>, prefix: String = "") {
        val keys = obj.keys()
        while (keys.hasNext()) {
            val key = keys.next()
            val value = obj.opt(key)
            val full = if (prefix.isBlank()) key else "$prefix.$key"
            when (value) {
                is JSONObject -> flatten(value, out, full)
                is JSONArray -> out[full] = value.toString()
                null -> Unit
                else -> out[full] = value.toString()
            }
        }
    }

    private fun firstNonBlank(vararg values: String): String = values.firstOrNull { it.isNotBlank() }.orEmpty()
}

class RestWalletNotificationScanner(private val chainId: String, private val client: RestWalletHistoryClient = RestWalletHistoryClient(chainId)) {
    fun fetchAndScan(account: String, cursor: Long?, baselineDone: Boolean, limit: Int = 50, selectedOps: List<String> = emptyList()): Pair<Long, List<DposEventNotification>> {
        val rows = client.getTransactions(account, limit)
        return scan(account, cursor, rows, baselineDone, selectedOps)
    }

    fun scan(account: String, cursor: Long?, rows: List<HistoryEvent>, baselineDone: Boolean, selectedOps: List<String> = emptyList()): Pair<Long, List<DposEventNotification>> {
        val target = account.trim().lowercase()
        val sorted = rows.sortedBy { it.index }
        val newest = sorted.maxOfOrNull { it.index } ?: cursor ?: -1L
        if (!baselineDone) return newest to emptyList()
        val minIndex = cursor ?: -1L
        val allowed = selectedOps.map { it.trim().lowercase() }.filter { it.isNotBlank() }.toSet()
        val notifications = sorted
            .filter { it.index > minIndex }
            .filter { allowed.isEmpty() || it.type.lowercase() in allowed }
            .mapNotNull { toNotification(target, it) }
        return newest to notifications
    }

    fun toNotification(account: String, event: HistoryEvent): DposEventNotification? {
        val target = account.lowercase()
        fun norm(v: String?) = v.orEmpty().trim().lowercase()
        val data = event.data
        val from = norm(data["from"] ?: data["sender"] ?: data["address"] ?: data["delegator"] ?: data["owner"] ?: data["account"] ?: data["creator"] ?: data["sender.address"])
        val to = norm(data["to"] ?: data["recipient"] ?: data["receiver"] ?: data["target"] ?: data["validator"] ?: data["public_key"] ?: data["coin_to_buy"] ?: data["delegatee"])
        val listText = (data["list"] ?: data["recipients"] ?: data["outputs"] ?: data["items"] ?: data["messages"] ?: data["coins"] ?: data["list.address"]).orEmpty().lowercase()
        if (from != target && to != target && !listText.contains(target) && !target.equals(norm(data["hash"]), ignoreCase = true)) return null
        val amount = data["amount"] ?: data["value"] ?: data["stake"] ?: data["volume"] ?: data["sell"] ?: data["min_to_receive"] ?: data["value_to_sell"] ?: data["value_to_buy"] ?: data["initial_amount"] ?: data["initSupply"] ?: data["volume0"]
        val coin = data["coin.symbol"] ?: data["coin"] ?: data["denom"] ?: data["symbol"] ?: data["ticker"] ?: data["amount.coin"] ?: data["coin_to_sell.symbol"] ?: data["coin_to_buy.symbol"]
        val label = when (event.type) {
            "send" -> "Перевод"
            "multisend" -> "Мульти-отправка"
            "delegate" -> "Делегирование"
            "unbond" -> "Анбонд"
            "sell", "sell_swap_pool" -> "Обмен"
            "add_liquidity" -> "Добавление ликвидности"
            "remove_liquidity" -> "Удаление ликвидности"
            "create_coin", "create_token" -> "Создание токена"
            "mint_token" -> "Выпуск токена"
            "burn_token" -> "Сжигание токена"
            "transfer_token" -> "Передача token/NFT"
            "nft" -> "NFT операция"
            else -> event.type
        }
        return DposEventNotification(
            "$chainId:$target:${event.index}:${event.type}",
            label,
            listOf(if (from.isNotBlank()) "адрес $from" else "", amount.orEmpty(), coin.orEmpty()).filter { it.isNotBlank() }.joinToString(", ").ifBlank { "${event.type} #${event.index}" },
            "#chain=$chainId&app=history&account=$target&ops=${event.type}",
            event.index
        )
    }
}
