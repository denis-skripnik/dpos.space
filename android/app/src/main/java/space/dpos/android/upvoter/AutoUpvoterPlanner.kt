package space.dpos.android.upvoter

import kotlin.math.abs
import kotlin.math.ceil
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

data class AccountSettings(val account: String, val enabled: Boolean, val curators: List<String> = emptyList(), val favorites: List<String> = emptyList(), val minEnergy: Int = 2500, val curatorCoefficient: Int = 100, val favoritesPercent: Int = 100, val currentEnergy: Int? = null, val maxActionsPerTick: Int = 5)
data class VoteEvent(val kind: String, val voter: String = "", val author: String, val permlink: String, val weight: Int = 10000, val activeVotes: List<String> = emptyList())
data class PlannedVote(val account: String, val author: String, val permlink: String, val weight: Int, val reason: String, val projectedEnergy: Int?)
data class VotePlan(val actions: List<PlannedVote>, val skips: List<String>)

class AutoUpvoterPlanner {
    fun plan(settings: List<AccountSettings>, events: List<VoteEvent>, seen: Set<String> = emptySet()): VotePlan {
        val actions = mutableListOf<PlannedVote>()
        val skips = mutableListOf<String>()
        val energy = settings.associate { it.account to it.currentEnergy }.toMutableMap()
        for (event in events) {
            for (account in settings.filter { it.enabled }) {
                if (actions.count { it.account == account.account } >= account.maxActionsPerTick) continue
                val matched = when (event.kind) {
                    "curator_vote" -> account.curators.any { it.equals(event.voter, true) }
                    "favorite_post" -> account.favorites.any { it.equals(event.author, true) }
                    else -> false
                }
                if (!matched) continue
                val key = "${account.account}|${event.author}|${event.permlink}"
                if (key in seen || event.activeVotes.any { it.equals(account.account, true) }) { skips += "duplicate:$key"; continue }
                val weight = if (event.kind == "curator_vote") (abs(event.weight) * account.curatorCoefficient / 100.0).roundToInt().coerceIn(1, 10000) else (account.favoritesPercent * 100).coerceIn(1, 10000)
                val current = energy[account.account]
                val projected = current?.let { estimateEnergyAfter(it, weight) }
                if (current != null && (current < account.minEnergy || (projected != null && projected < account.minEnergy))) { skips += "energy:$key"; continue }
                if (projected != null) energy[account.account] = projected
                actions += PlannedVote(account.account, event.author, event.permlink, weight, event.kind, projected)
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
