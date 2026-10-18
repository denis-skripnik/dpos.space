package space.dpos.android.upvoter

import org.json.JSONObject
import space.dpos.android.notifications.GolosHistoryClient
import kotlin.math.abs

/** Operational trust: deployed golos.id product config and irreversible user-bot block.
 * This checkpoint admits a branch; it is NEVER a recovery fence or permission to sign.
 * Additional endpoints require an explicitly reviewed policy revision, not peer ranking.
 */
open class GolosProductionPolicy internal constructor(
    private val endpoint: String = ENDPOINT,
    private val pause: (() -> Unit)? = null
) {
    class Admitted internal constructor(
        val rpc: GolosRpcClient, val head: Long, val headId: String, val headTime: Long,
        val lib: Long, val observedAtMs: Long, val started: Long
    )
    open fun admit(rpc: GolosRpcClient, wall: () -> Long, mono: () -> Long, permit: () -> Boolean): Admitted {
        val start = mono(); val before = wall()
        // Concrete HttpGrapheneRpcClient exposes a SHA-256 scope, never its raw URL.
        val allowedScope = space.dpos.android.storage.TransactionCheckpointStore.digest(endpoint.toByteArray(Charsets.UTF_8))
        fun budget() {
            check(permit() && !Thread.currentThread().isInterrupted) { "production_cancelled" }
            val elapsed = mono() - start; val wallElapsed = wall() - before
            check(elapsed in 0..30_000 && wallElapsed in 0..30_000 && abs(wallElapsed - elapsed) <= 5_000) { "production_observation_stale" }
            check(rpc.recoveryEndpoint == allowedScope) { "production_endpoint_not_allowed" }
        }
        budget()
        val config = rpc.getGolosConfig() ?: error("production_config_unavailable")
        check(config.opt("STEEMIT_CHAIN_ID") == GOLOS_CHAIN_ID && GolosRecoveryFence.integer(config, "STEEMIT_MAX_TIME_UNTIL_EXPIRATION") == 3600L) { "production_wrong_config" }
        fun head(): JSONObject {
            budget(); val h = rpc.getDynamicGlobalProperties(); budget()
            val n = GolosRecoveryFence.integer(h, "head_block_number")
            val lib = GolosRecoveryFence.integer(h, "last_irreversible_block_num")
            val id = h.getString("head_block_id")
            val time = GolosRecoveryFence.timestamp(h.getString("time"))
            check(n in CHECKPOINT_HEIGHT + 1..0xfffffffeL && lib in CHECKPOINT_HEIGHT + 1..n &&
                id.matches(Regex("[0-9a-f]{40}")) && id.take(8).toLong(16) == n) { "production_invalid_head" }
            check(wall() / 1000 - time in -15..120) { "production_stale_head" }
            return h
        }
        val first = head()
        val checkpoint = rpc.getBlockHeader(CHECKPOINT_HEIGHT + 1) ?: error("production_checkpoint_missing")
        check(checkpoint.opt("previous") == CHECKPOINT_ID) { "production_branch_mismatch" }
        budget()
        val c = rpc.getGolosContent(SAMPLE_AUTHOR, SAMPLE_PERMLINK) ?: error("production_content_unavailable")
        check(c.opt("author") == SAMPLE_AUTHOR && c.opt("permlink") == SAMPLE_PERMLINK && c.opt("parent_author") == "" &&
            GolosRecoveryFence.integer(c, "id") > 0 && GolosRecoveryFence.integer(c, "root_comment") == GolosRecoveryFence.integer(c, "id")) { "production_content_unavailable" }
        rpc.getActiveVotePercent(SAMPLE_AUTHOR, SAMPLE_PERMLINK, SAMPLE_ACCOUNT)
        val history = rpc.recoveryHistory() ?: error("production_history_unbound")
        check(history.getAccountHistory(SAMPLE_ACCOUNT, -1, 1).isNotEmpty()) { "production_history_unavailable" }
        // LIB can plateau for several fresh heads. Compare every new observation with
        // the original sample, on this same pinned client, within the original budget.
        // The attempt cap also bounds a frozen injected clock; flat LIB never admits.
        repeat(8) {
            budget()
            if (pause != null) pause.invoke() else {
                // Stop remains responsive during the normal 3.5-second sampling wait.
                repeat(35) {
                    budget()
                    val remaining = minOf(30_000 - (mono() - start), 30_000 - (wall() - before))
                    check(remaining > 0) { "production_observation_stale" }
                    Thread.sleep(minOf(100L, remaining))
                }
            }
            budget()
            val last = head()
            if (last.getLong("head_block_number") > first.getLong("head_block_number") &&
                last.getLong("last_irreversible_block_num") > first.getLong("last_irreversible_block_num") &&
                GolosRecoveryFence.timestamp(last.getString("time")) > GolosRecoveryFence.timestamp(first.getString("time"))) {
                budget()
                return Admitted(rpc, last.getLong("head_block_number"), last.getString("head_block_id"),
                    GolosRecoveryFence.timestamp(last.getString("time")), last.getLong("last_irreversible_block_num"), wall(), start)
            }
        }
        error("production_not_advancing")
    }
    companion object {
        const val ID = "golos-id-production-v1"
        const val ENDPOINT = "https://api-full.golos.id"
        const val CHECKPOINT_HEIGHT = 104759812L
        const val CHECKPOINT_ID = "063e8204838536706a705c60e93f31d5a641754d"
        const val FOREIGN_HEIGHT = 104806385L
        const val FOREIGN_ID = "063f37f15c2f1a2b24484a5d45fe17b60b9032ee"
        const val SAMPLE_AUTHOR = "lllll1ll"
        const val SAMPLE_PERMLINK = "dobroe-utro-golos"
        const val SAMPLE_ACCOUNT = "denis-skripnik"
        fun isReviewedForeign(f: JSONObject): Boolean {
            GolosRecoveryFence.validateFence(f)
            return f.getBoolean("verified") && f.getLong("head") == FOREIGN_HEIGHT && f.getString("headId") == FOREIGN_ID
        }
    }
}
