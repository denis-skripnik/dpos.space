package space.dpos.android

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import space.dpos.android.upvoter.AccountSettings
import space.dpos.android.upvoter.AutoUpvoterPlanner
import space.dpos.android.upvoter.PreviewVoteLog
import space.dpos.android.upvoter.VoteEvent

class AutoUpvoterDryRunWorkerTest {
    @Test fun explicitPreviewLogIsVisibleRedactedAndContainsSkipReasons() {
        val plan = AutoUpvoterPlanner().plan(
            listOf(AccountSettings("denis", enabled = true, favorites = listOf("alice"), minEnergy = 9500, currentEnergy = 9600, maxActionsPerTick = 1)),
            listOf(
                VoteEvent("favorite_post", author = "alice", permlink = "p1"),
                VoteEvent("favorite_post", author = "alice", permlink = "p2")
            )
        )
        val log = PreviewVoteLog.render(plan, "privateKey=not-a-real-key-fixture")
        assertTrue(log.contains("PREVIEW"))
        assertTrue(log.contains("energy:") || log.contains("limit:"))
        assertTrue(log.contains("[redacted]"))
    }

    @Test fun disabledAccountsNeverPlanActions() {
        val plan = AutoUpvoterPlanner().plan(
            listOf(AccountSettings("denis", enabled = false, favorites = listOf("alice"), currentEnergy = 10000)),
            listOf(VoteEvent("favorite_post", author = "alice", permlink = "p"))
        )
        assertEquals(0, plan.actions.size)
    }
}
