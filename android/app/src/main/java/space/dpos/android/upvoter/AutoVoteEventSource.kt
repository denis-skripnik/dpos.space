package space.dpos.android.upvoter

import org.json.JSONArray
import org.json.JSONObject
import space.dpos.android.notifications.GolosHistoryClient
import space.dpos.android.notifications.HistoryEvent
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL

interface GolosDiscussionClient {
    fun getBlogPosts(account: String, limit: Int): List<FavoritePostRow>
}

data class FavoritePostRow(
    val author: String,
    val permlink: String,
    val title: String = "",
    val activeVotes: List<String> = emptyList()
)

object AutoVoteEventMapper {
    fun historyVoteToCuratorEvent(row: HistoryEvent): VoteEvent? {
        if (row.type != "vote") return null
        val voter = cleanAccount(row.data["voter"])
        val author = cleanAccount(row.data["author"])
        val permlink = row.data["permlink"].orEmpty().trim()
        val weight = row.data["weight"]?.toIntOrNull() ?: return null
        if (voter.isBlank() || author.isBlank() || permlink.isBlank() || weight <= 0) return null
        return VoteEvent(
            kind = "curator_vote",
            voter = voter,
            author = author,
            permlink = permlink,
            weight = weight,
            activeVotes = emptyList()
        )
    }

    fun blogPostToFavoriteEvent(row: FavoritePostRow): VoteEvent? {
        val author = cleanAccount(row.author)
        val permlink = row.permlink.trim()
        if (author.isBlank() || permlink.isBlank()) return null
        return VoteEvent(
            kind = "favorite_post",
            author = author,
            permlink = permlink,
            weight = 10000,
            activeVotes = row.activeVotes
        )
    }

    private fun cleanAccount(value: String?): String = value.orEmpty().trim().removePrefix("@").lowercase()
}

class AutoVoteEventCollector(
    private val historyClient: GolosHistoryClient,
    private val discussionClient: GolosDiscussionClient
) {
    fun collect(settings: List<AccountSettings>, historyLimit: Int = 30, favoriteLimit: Int = 20): List<VoteEvent> {
        val events = mutableListOf<VoteEvent>()
        val curators = settings.filter { it.enabled }.flatMap { it.curators }.map { it.trim().removePrefix("@").lowercase() }.filter { it.isNotBlank() }.distinct()
        val favorites = settings.filter { it.enabled }.flatMap { it.favorites }.map { it.trim().removePrefix("@").lowercase() }.filter { it.isNotBlank() }.distinct()
        for (curator in curators) {
            historyClient.getAccountHistory(curator, -1L, historyLimit.coerceIn(1, 100)).mapNotNullTo(events) { AutoVoteEventMapper.historyVoteToCuratorEvent(it) }
        }
        for (favorite in favorites) {
            discussionClient.getBlogPosts(favorite, favoriteLimit.coerceIn(1, 100)).mapNotNullTo(events) { AutoVoteEventMapper.blogPostToFavoriteEvent(it) }
        }
        return events
    }
}

class HttpGolosDiscussionClient(private val endpoint: String = "https://api.golos.id/ws") : GolosDiscussionClient {
    override fun getBlogPosts(account: String, limit: Int): List<FavoritePostRow> {
        val clean = account.trim().removePrefix("@").lowercase()
        val params = JSONObject().put("select_authors", JSONArray().put(clean)).put("limit", limit.coerceIn(1, 100))
        val body = JSONObject()
            .put("jsonrpc", "2.0")
            .put("id", 1)
            .put("method", "condenser_api.get_discussions_by_blog")
            .put("params", JSONArray().put(params))
            .toString()
        val response = post(body)
        return parseBlogPosts(response)
    }

    private fun post(body: String): String {
        val connection = (URL(endpoint).openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            connectTimeout = 12_000
            readTimeout = 20_000
            doOutput = true
            setRequestProperty("Content-Type", "application/json")
        }
        OutputStreamWriter(connection.outputStream).use { it.write(body) }
        val text = if (connection.responseCode in 200..299) connection.inputStream.bufferedReader().use { it.readText() } else connection.errorStream?.bufferedReader()?.use { it.readText() }.orEmpty()
        if (connection.responseCode !in 200..299) throw IllegalStateException("Golos discussion RPC HTTP ${connection.responseCode}: ${text.take(120)}")
        return text
    }

    companion object {
        fun parseBlogPosts(json: String): List<FavoritePostRow> {
            val result = JSONObject(json).optJSONArray("result") ?: return emptyList()
            val rows = mutableListOf<FavoritePostRow>()
            for (i in 0 until result.length()) {
                val post = result.optJSONObject(i) ?: continue
                val votes = post.optJSONArray("active_votes")
                val active = mutableListOf<String>()
                if (votes != null) {
                    for (j in 0 until votes.length()) {
                        val vote = votes.optJSONObject(j) ?: continue
                        val voter = vote.optString("voter").trim().removePrefix("@").lowercase()
                        if (voter.isNotBlank()) active += voter
                    }
                }
                rows += FavoritePostRow(
                    author = post.optString("author"),
                    permlink = post.optString("permlink"),
                    title = post.optString("title"),
                    activeVotes = active
                )
            }
            return rows
        }
    }
}
