package space.dpos.android

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import space.dpos.android.notifications.GolosHistoryClient
import space.dpos.android.notifications.HistoryEvent
import space.dpos.android.runtime.WorkerSettingsCodec
import space.dpos.android.upvoter.AccountSettings
import space.dpos.android.upvoter.AutoUpvoterPlanner
import space.dpos.android.upvoter.AutoVoteEventCollector
import space.dpos.android.upvoter.FavoritePostRow
import space.dpos.android.upvoter.GolosDiscussionClient
import space.dpos.android.upvoter.HttpGolosDiscussionClient

class AutoVoteEventSourceTest {
    @Test fun settingsImportCarriesCuratorsAndFavoritesIntoDecision() {
        val decision = WorkerSettingsCodec.decodeImport("""{"chainId":"golos","account":"denis","explicitConsent":true,"enableAutoUpvoter":true,"curators":["@alice","bad account","alice","bob"],"favorites":"carol; @dan","curatorCoefficient":50,"favoritesPercent":75}""")
        assertTrue(decision.accepted)
        assertEquals(listOf("alice", "bob"), decision.curators)
        assertEquals(listOf("carol", "dan"), decision.favorites)
        assertEquals(50, decision.curatorCoefficient)
        assertEquals(75, decision.favoritesPercent)
    }

    @Test fun collectorFetchesCuratorHistoryAndFavoriteBlogPosts() {
        val collector = AutoVoteEventCollector(FakeHistory(), FakeDiscussions())
        val events = collector.collect(listOf(AccountSettings("denis", enabled = true, curators = listOf("alice"), favorites = listOf("carol"))))
        assertEquals(2, events.size)
        assertEquals("curator_vote", events[0].kind)
        assertEquals("alice", events[0].voter)
        assertEquals("favorite_post", events[1].kind)
        assertEquals("carol", events[1].author)
    }

    @Test fun collectedEventsFeedPlannerIntoRealVoteActions() {
        val settings = AccountSettings("denis", enabled = true, curators = listOf("alice"), favorites = listOf("carol"), curatorCoefficient = 50, favoritesPercent = 80, maxActionsPerTick = 5)
        val events = AutoVoteEventCollector(FakeHistory(), FakeDiscussions()).collect(listOf(settings))
        val plan = AutoUpvoterPlanner().plan(listOf(settings), events)
        assertEquals(2, plan.actions.size)
        assertEquals(5000, plan.actions[0].weight)
        assertEquals(8000, plan.actions[1].weight)
    }

    @Test fun parsesBlogPostsAndActiveVotes() {
        val json = """{"result":[{"author":"carol","permlink":"p1","title":"Hello","active_votes":[{"voter":"denis"},{"voter":"alice"}]}]}"""
        val rows = HttpGolosDiscussionClient.parseBlogPosts(json)
        assertEquals(1, rows.size)
        assertEquals("carol", rows[0].author)
        assertEquals(listOf("denis", "alice"), rows[0].activeVotes)
    }

    @Test fun discussionRpcErrorIsNotSilentlyTreatedAsEmptyFeed() {
        val json = """{"jsonrpc":"2.0","error":{"code":-32601,"message":"Could not find API condenser_api"},"id":1}"""
        try {
            HttpGolosDiscussionClient.parseBlogPosts(json)
            throw AssertionError("expected discussion parser to reject RPC error")
        } catch (e: IllegalStateException) {
            assertTrue(e.message!!.contains("Could not find API"))
        }
    }

    private class FakeHistory : GolosHistoryClient {
        override fun getAccountHistory(account: String, from: Long, limit: Int): List<HistoryEvent> = listOf(
            HistoryEvent(1, "vote", mapOf("voter" to account, "author" to "target", "permlink" to "post", "weight" to "10000"))
        )
    }

    private class FakeDiscussions : GolosDiscussionClient {
        override fun getBlogPosts(account: String, limit: Int): List<FavoritePostRow> = listOf(
            FavoritePostRow(account, "fresh-post", "Fresh", activeVotes = emptyList())
        )
    }
}
