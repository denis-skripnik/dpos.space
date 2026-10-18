package space.dpos.android.upvoter

import org.json.JSONObject
import java.time.LocalDateTime
import java.time.ZoneOffset
import kotlin.math.abs

/** Trusted endpoint state assertion. Not first-ever permlink or a cryptographic state proof. */
class GolosRecoveryFence(
    private val read: () -> JSONObject?,
    private val save: (JSONObject) -> Unit,
    private val wall: () -> Long = { System.currentTimeMillis() },
    private val monotonic: () -> Long = { android.os.SystemClock.elapsedRealtime() },
    private val canAct: () -> Boolean = { true }
) {
    data class Verified(val fence: JSONObject, val libTime: Long, val endpoint: String, val headTime: Long, val started: Long, val libHeight: Long)
    private data class Head(val number: Long, val id: String, val time: Long, val lib: Long)
    private fun permit() { check(canAct()) { "recovery_cancelled" } }
    private fun budget(started: Long) {
        permit(); check(monotonic() - started in 0..30_000) { "recovery_observation_stale" }
    }
    private fun head(rpc: GolosRpcClient): Head {
        permit()
        check(rpc.recoveryEndpoint.isNotBlank()) { "recovery_endpoint_unbound" }
        val start = monotonic(); val before = wall()
        val config = rpc.getGolosConfig() ?: error("recovery_chain_unknown")
        check(config.opt("STEEMIT_CHAIN_ID") == GOLOS_CHAIN_ID) { "recovery_wrong_chain" }
        check(integer(config, "STEEMIT_MAX_TIME_UNTIL_EXPIRATION") == 3600L) { "recovery_expiration_bound_unknown" }
        budget(start); val p = rpc.getDynamicGlobalProperties(); permit()
        val end = monotonic(); val after = wall()
        check(end - start in 0..30_000 && abs((after - before) - (end - start)) <= 5_000) { "recovery_observation_stale" }
        val n = integer(p, "head_block_number"); val lib = integer(p, "last_irreversible_block_num")
        val id = p.getString("head_block_id"); val time = timestamp(p.getString("time"))
        check(n > 0 && n <= 0xffffffffL && lib in 1..n && validId(id, n)) { "recovery_invalid_head" }
        check(after / 1000 - time in -15..120) { "recovery_stale_head" }
        return Head(n, id, time, lib)
    }
    private fun anchor(rpc: GolosRpcClient, h: Head, drain: Long, cutoff: Long): JSONObject = JSONObject()
        .put("schema", 1).put("chainId", GOLOS_CHAIN_ID).put("endpoint", rpc.recoveryEndpoint)
        .put("head", h.number).put("headId", h.id).put("headTime", h.time)
        .put("observedAtMs", wall()).put("observedLib", h.lib).put("verifiedLib", 0L).put("verifiedLibTime", 0L).put("verifiedAtMs", 0L).put("drain", drain).put("cutoff", maxOf(cutoff, h.time, drain)).put("verified", false)

    fun verify(rpc: GolosRpcClient): Verified {
        val start = monotonic(); val h = head(rpc)
        var fence = read()?.also { validateFence(it) }
        if (fence == null) {
            // Writers are quiesced by bootstrap, incomplete-identity gate and global runner ownership.
            fence = anchor(rpc, h, maxOf(h.time, wall() / 1000) + 3600 + 120, h.time)
            permit(); save(fence)
            error("recovery_drain_pending")
        }
        val height = integer(fence, "head")
        check(h.lib >= height + 1 && h.number >= height + 1) { "recovery_fence_reversible" }
        budget(start); val next = rpc.getBlockHeader(height + 1) ?: error("recovery_header_unavailable")
        permit()
        if (next.opt("previous") != fence.getString("headId")) {
            if (!fence.getBoolean("verified")) {
                save(anchor(rpc, h, integer(fence, "drain"), integer(fence, "cutoff")))
            }
            error("recovery_anchor_changed")
        }
        val nextTime = timestamp(next.getString("timestamp"))
        budget(start); val libHeader = rpc.getBlockHeader(h.lib) ?: error("recovery_lib_unavailable")
        val libTime = timestamp(libHeader.getString("timestamp"))
        check(validId(libHeader.getString("previous"), h.lib - 1)) { "recovery_invalid_lib" }
        check(nextTime > integer(fence, "headTime") && nextTime <= libTime && libTime <= h.time) { "recovery_invalid_times" }
        check(libTime > integer(fence, "drain")) { "recovery_drain_pending" }
        budget(start); val last = head(rpc)
        check(last.number >= h.number && last.lib >= h.lib && last.time >= h.time && monotonic() - start in 0..30_000) { "recovery_observation_stale" }
        permit()
        if (!fence.getBoolean("verified") || fence.getString("endpoint") != rpc.recoveryEndpoint) {
            fence = JSONObject(fence.toString()).put("verified", true).put("endpoint", rpc.recoveryEndpoint)
                .put("verifiedLib", h.lib).put("verifiedLibTime", libTime).put("verifiedAtMs", wall())
            save(fence)
        }
        return Verified(JSONObject(fence.toString()), libTime, rpc.recoveryEndpoint, last.time, start, h.lib)
    }

    fun generation(rpc: GolosRpcClient, op: VoteOperation, proof: Verified): JSONObject {
        permit(); check(op.chainId == "golos" && rpc.recoveryEndpoint == proof.endpoint) { "recovery_mixed_endpoint" }
        val c = rpc.getGolosContent(op.author, op.permlink) ?: error("recovery_content_unknown")
        permit()
        check(c.opt("author") == op.author && c.opt("permlink") == op.permlink && c.opt("parent_author") is String) { "recovery_content_unknown" }
        check(c.getString("parent_author").isEmpty()) { "not_root_post" }
        val id = integer(c, "id"); val root = integer(c, "root_comment")
        val created = timestamp(c.getString("created"))
        check(id > 0 && root == id) { "recovery_invalid_root_identity" }
        check(created > integer(proof.fence, "cutoff")) { "recovery_old_generation" }
        check(created <= proof.libTime) { "recovery_generation_reversible" }
        budget(proof.started); check(rpc.getActiveVotePercent(op.author, op.permlink, op.voter) == null) { "already_voted" }
        budget(proof.started); val finalContent = rpc.getGolosContent(op.author, op.permlink) ?: error("recovery_content_unknown")
        check(integer(finalContent, "id") == id && integer(finalContent, "root_comment") == root &&
            finalContent.opt("created") == c.opt("created") && finalContent.opt("author") == op.author &&
            finalContent.opt("permlink") == op.permlink && finalContent.opt("parent_author") == "" && revision(finalContent) == revision(c)) { "recovery_generation_changed" }
        check(monotonic() - proof.started in 0..30_000 && wall() / 1000 - proof.headTime in -15..120) { "recovery_observation_stale" }
        permit()
        return JSONObject().put("revision", revision(c)).put("id", id).put("root", root).put("created", created)
            .put("author", op.author).put("permlink", op.permlink).put("endpoint", proof.endpoint)
            .put("fenceId", proof.fence.getString("headId")).put("cutoff", integer(proof.fence, "cutoff"))
            .put("libHeight", proof.libHeight).put("libTime", proof.libTime)
    }

    fun recheck(rpc: GolosRpcClient, op: VoteOperation, generation: JSONObject): Long {
        val proof = verify(rpc)
        val current = generation(rpc, op, proof)
        val stable = current.keys().asSequence().filter { it !in setOf("libHeight", "libTime") }.toList()
        check(stable.all { current.get(it) == generation.get(it) }) { "recovery_generation_changed" }
        permit()
        return proof.headTime
    }

    private fun revision(c: JSONObject): String = org.json.JSONArray().apply {
        listOf("last_update", "num_changes", "allow_votes", "cashout_time", "last_payout", "title", "body", "json_metadata").forEach { put(c.opt(it) ?: JSONObject.NULL) }
    }.toString().let { space.dpos.android.storage.TransactionCheckpointStore.digest(it.toByteArray(Charsets.UTF_8)) }

    companion object {
        fun validateFence(f: JSONObject) {
            require(f.keys().asSequence().toSet() == setOf("schema", "chainId", "endpoint", "head", "headId", "headTime", "observedAtMs", "drain", "cutoff", "verified", "observedLib", "verifiedLib", "verifiedLibTime", "verifiedAtMs"))
            require(integer(f, "schema") == 1L && f.getString("chainId") == GOLOS_CHAIN_ID)
            require(f.getString("endpoint").isNotBlank() && f.get("verified") is Boolean)
            val n = integer(f, "head"); require(n in 1..0xfffffffeL && validId(f.getString("headId"), n))
            require(integer(f, "observedLib") in 0..n)
            if (f.getBoolean("verified")) require(integer(f, "verifiedLib") >= n + 1 && integer(f, "verifiedLibTime") > integer(f, "drain") && integer(f, "verifiedAtMs") > 0)
            else require(listOf("verifiedLib", "verifiedLibTime", "verifiedAtMs").all { integer(f, it) == 0L })
            val time = integer(f, "headTime"); val drain = integer(f, "drain"); val cutoff = integer(f, "cutoff")
            require(time > 0 && drain > 0 && cutoff >= maxOf(time, drain) && integer(f, "observedAtMs") > 0)
        }
        fun validateGeneration(g: JSONObject, fence: JSONObject, fingerprint: String) {
            validateFence(fence)
            require(g.keys().asSequence().toSet() == setOf("id", "root", "created", "author", "permlink", "endpoint", "fenceId", "cutoff", "revision", "libHeight", "libTime"))
            require(fence.getBoolean("verified") && g.getString("fenceId") == fence.getString("headId") && g.getString("endpoint") == fence.getString("endpoint"))
            val p = fingerprint.split('|'); require(p.size == 3 && g.getString("author") == p[0] && g.getString("permlink") == p[1])
            require(integer(g, "id") > 0 && integer(g, "root") == integer(g, "id"))
            require(g.getString("revision").matches(Regex("[0-9a-f]{64}")))
            require(integer(g, "libHeight") >= integer(fence, "head") + 1 && integer(g, "libTime") >= integer(g, "created"))
            require(integer(g, "cutoff") == integer(fence, "cutoff") && integer(g, "created") > integer(fence, "cutoff"))
        }
        fun integer(o: JSONObject, key: String): Long {
            val v = o.get(key); require(v is Number && v.toString() == o.getLong(key).toString())
            return o.getLong(key)
        }
        fun timestamp(s: String): Long {
            require(Regex("[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}").matches(s))
            return LocalDateTime.parse(s).toEpochSecond(ZoneOffset.UTC).also { require(it > 0) }
        }
        private fun validId(id: String, n: Long) = Regex("[0-9a-f]{40}").matches(id) && id.substring(0, 8).toLong(16) == n
    }
}
