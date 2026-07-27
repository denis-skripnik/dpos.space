package space.dpos.android

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import space.dpos.android.upvoter.AccountSettings
import space.dpos.android.upvoter.AutoUpvoterPlanner
import space.dpos.android.upvoter.VoteEvent

class AutoUpvoterPlannerTest {
    @Test fun plansCuratorVoteWithEnergyProjection() {
        val plan = AutoUpvoterPlanner().plan(
            listOf(AccountSettings("denis", enabled = true, curators = listOf("curator"), minEnergy = 8000, currentEnergy = 9000)),
            listOf(VoteEvent(kind = "curator_vote", voter = "curator", author = "alice", permlink = "post", weight = 10000))
        )
        assertEquals(1, plan.actions.size)
        assertEquals(8820, plan.actions[0].projectedEnergy)
    }
    @Test fun skipsDuplicateAndEnergyFloor() {
        val planner = AutoUpvoterPlanner()
        val duplicate = planner.plan(listOf(AccountSettings("denis", true, favorites = listOf("alice"), currentEnergy = 9000)), listOf(VoteEvent("favorite_post", author = "alice", permlink = "p", activeVotes = listOf("denis"))))
        assertTrue(duplicate.skips.any { it.startsWith("duplicate") })
        val lowEnergy = planner.plan(listOf(AccountSettings("denis", true, favorites = listOf("alice"), minEnergy = 9000, currentEnergy = 9001)), listOf(VoteEvent("favorite_post", author = "alice", permlink = "p")))
        assertTrue(lowEnergy.skips.any { it.startsWith("energy") })
    }

    @Test fun activeVoteDuplicateDoesNotConsumeActionLimit() {
        val plan = AutoUpvoterPlanner().plan(
            listOf(AccountSettings("denis", true, favorites = listOf("alice"), currentEnergy = 10000, maxActionsPerTick = 1)),
            listOf(
                VoteEvent("favorite_post", author = "alice", permlink = "already", activeVotes = listOf("denis")),
                VoteEvent("favorite_post", author = "alice", permlink = "fresh")
            )
        )
        assertEquals(1, plan.actions.size)
        assertEquals("fresh", plan.actions.single().permlink)
        assertTrue(plan.skips.any { it.startsWith("duplicate:denis|alice|already") })
    }

    @Test fun curatorAndFavoriteSourcesArePlannedTogetherWithConfiguredWeights() {
        val plan = AutoUpvoterPlanner().plan(
            listOf(AccountSettings("denis", true, curators = listOf("curator"), favorites = listOf("alice"), curatorCoefficient = 50, favoritesPercent = 80, currentEnergy = 10000, maxActionsPerTick = 5)),
            listOf(
                VoteEvent(kind = "curator_vote", voter = "curator", author = "bob", permlink = "curated", weight = 6000),
                VoteEvent(kind = "favorite_post", author = "alice", permlink = "favorite")
            )
        )
        assertEquals(listOf("curated", "favorite"), plan.actions.map { it.permlink })
        assertEquals(listOf(3000, 8000), plan.actions.map { it.weight })
    }
}
