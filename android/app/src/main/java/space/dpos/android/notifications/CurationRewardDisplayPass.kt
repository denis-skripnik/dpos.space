package space.dpos.android.notifications

import org.json.JSONObject
import space.dpos.android.upvoter.GrapheneChainSpecs
import space.dpos.android.upvoter.HttpGrapheneRpcClient
import space.dpos.android.upvoter.PlanningReadBudget
import java.util.concurrent.TimeUnit

/** One worker pass owns both successes and failures; no persisted or process-wide rate cache. */
internal class CurationRewardDisplayPass(
    private val load: ((String, Long) -> JSONObject?)? = null,
    private val monotonicMs: () -> Long = { TimeUnit.NANOSECONDS.toMillis(System.nanoTime()) },
    totalBudgetMs: Long = 4_500,
    private val endpoints: (String) -> List<String> = { GrapheneChainSpecs.require(it).rpcEndpoints }
) {
    private val properties = mutableMapOf<String, JSONObject?>()
    private var remainingMs = totalBudgetMs.coerceAtLeast(0)

    fun text(event: DposEventNotification, canAct: () -> Boolean = { !Thread.currentThread().isInterrupted }): String? {
        val chain = CurationRewardDisplay.chain(event.route) ?: return null
        if (!CurationRewardDisplay.validAmount(event)) return CurationRewardDisplay.FALLBACK
        if (!canAct()) return CurationRewardDisplay.FALLBACK
        if (!properties.containsKey(chain)) {
            val budget = remainingMs.coerceAtMost(1_500)
            val start = monotonicMs()
            properties[chain] = try {
                if (budget <= 0) null else if (load != null) load.invoke(chain, budget)
                else readProperties(chain, budget, canAct)
            } catch (_: Exception) {
                null
            } finally {
                remainingMs = (remainingMs - (monotonicMs() - start).coerceAtLeast(0)).coerceAtLeast(0)
            }
        }
        return CurationRewardDisplay.text(event, properties[chain])
    }

    private fun readProperties(chain: String, budgetMs: Long, canAct: () -> Boolean): JSONObject? {
        val start = monotonicMs()
        val spec = GrapheneChainSpecs.require(chain)
        for (endpoint in endpoints(chain)) {
            if (!canAct() || Thread.currentThread().isInterrupted) return null
            val left = budgetMs - (monotonicMs() - start).coerceAtLeast(0)
            if (left <= 0) return null
            try {
                // Fresh per-node deadlines leave room for the next short fallback attempt.
                // Existing transport disconnects active I/O before returning; no Future survives us.
                return PlanningReadBudget.within(left.coerceAtMost(750)) {
                    HttpGrapheneRpcClient(spec, endpoint).getDynamicGlobalProperties()
                }
            } catch (_: Exception) {
                if (!canAct() || Thread.currentThread().isInterrupted) return null
            }
        }
        return null
    }
}
