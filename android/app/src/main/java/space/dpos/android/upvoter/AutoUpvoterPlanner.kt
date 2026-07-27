package space.dpos.android.upvoter

import space.dpos.android.core.PayloadSanitizer
import kotlin.math.abs
import kotlin.math.ceil
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

data class AccountSettings(val account: String, val enabled: Boolean, val curators: List<String> = emptyList(), val favorites: List<String> = emptyList(), val minEnergy: Int = 2500, val curatorMode: String = "repeat", val curatorCoefficient: Int = 100, val favoritesPercent: Int = 100, val currentEnergy: Int? = null, val maxActionsPerTick: Int = 5)
data class VoteEvent(val kind: String, val voter: String = "", val author: String, val permlink: String, val weight: Int = 10000, val activeVotes: List<String> = emptyList())
data class PlannedVote(val account: String, val author: String, val permlink: String, val weight: Int, val reason: String, val projectedEnergy: Int?, val maxBroadcastsPerTick: Int = Int.MAX_VALUE)
data class VotePlan(val actions: List<PlannedVote>, val skips: List<String>)

object PreviewVoteLog {
    fun render(plan: VotePlan, context: String = ""): String {
        val lines = mutableListOf<String>()
        lines += "PREVIEW auto-upvoter plan: actions=${plan.actions.size}, skips=${plan.skips.size}"
        plan.actions.forEach { action ->
            lines += "PREVIEW vote @${action.account} -> @${action.author}/${action.permlink}, weight=${action.weight}, reason=${action.reason}, projectedEnergy=${action.projectedEnergy ?: "unknown"}"
        }
        plan.skips.forEach { lines += "PREVIEW skip $it" }
        if (context.isNotBlank()) lines += PayloadSanitizer.redactLog(context)
        return lines.joinToString("\n")
    }
}

@Deprecated("Use PreviewVoteLog for explicit check/preview actions; normal worker runtime is real-capable when configured.")
object DryRunVoteLog {
    fun render(plan: VotePlan, context: String = ""): String = PreviewVoteLog.render(plan, context)
}

class AutoUpvoterPlanner {
    fun plan(settings: List<AccountSettings>, events: List<VoteEvent>, seen: Set<String> = emptySet()): VotePlan {
        val actions = mutableListOf<PlannedVote>()
        val skips = mutableListOf<String>()
        val energy = settings.associate { it.account to it.currentEnergy }.toMutableMap()
        val actionCounts = mutableMapOf<String, Int>()
        for (event in events) {
            for (account in settings.filter { it.enabled }) {
                val planLimit = (account.maxActionsPerTick + max(3, account.maxActionsPerTick * 2)).coerceAtLeast(account.maxActionsPerTick)
                if ((actionCounts[account.account] ?: 0) >= planLimit) {
                    skips += "limit:${account.account}|${event.author}|${event.permlink}"
                    continue
                }
                val matched = when (event.kind) {
                    "curator_vote" -> account.curators.any { it.equals(event.voter, true) }
                    "favorite_post" -> account.favorites.any { it.equals(event.author, true) }
                    else -> false
                }
                if (!matched) continue
                val key = "${account.account}|${event.author}|${event.permlink}"
                if (key in seen || event.activeVotes.any { it.equals(account.account, true) }) { skips += "duplicate:$key"; continue }
                val weight = if (event.kind == "curator_vote") {
                    if (account.curatorMode == "full") 10000 else (abs(event.weight) * account.curatorCoefficient / 100.0).roundToInt().coerceIn(1, 10000)
                } else {
                    (account.favoritesPercent * 100).coerceIn(1, 10000)
                }
                val current = energy[account.account]
                val projected = current?.let { estimateEnergyAfter(it, weight) }
                if (current != null && (current < account.minEnergy || (projected != null && projected < account.minEnergy))) { skips += "energy:$key"; continue }
                if (projected != null) energy[account.account] = projected
                actionCounts[account.account] = (actionCounts[account.account] ?: 0) + 1
                actions += PlannedVote(account.account, event.author, event.permlink, weight, event.kind, projected, account.maxActionsPerTick.coerceAtLeast(0))
            }
        }
        return VotePlan(actions, skips)
    }

    fun estimateEnergyAfter(currentEnergy: Int, weight: Int): Int {
        val current = currentEnergy.coerceIn(0, 10000)
        val used = ceil((current * abs(weight).coerceIn(0, 10000) / 10000.0) / 50.0).toInt()
        return max(0, min(10000, current - used))
    }
}
