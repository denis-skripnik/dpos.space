package space.dpos.android.upvoter

import space.dpos.android.storage.EncryptedKeyRef

interface PostingKeyProvider {
    fun keyRef(chainId: String, account: String): EncryptedKeyRef
    fun privateWif(chainId: String, account: String): String?
}

data class AutoVoteRuntimeReport(
    val attempted: Int,
    val broadcasted: Int,
    val skipped: List<String>,
    val results: List<VoteBroadcastResult>,
    val candidates: Int,
    val skipSummary: Map<String, Int>
)

class AutoVoteRuntime(
    private val voteRuntime: VoteRuntime,
    private val keyProvider: PostingKeyProvider,
    private val chainId: String = "golos",
    private val pauseAfterSuccessfulBroadcastMs: Long = 0L
) {
    fun preview(plan: VotePlan): AutoVoteRuntimeReport = run(plan, previewOnly = true)
    fun execute(plan: VotePlan): AutoVoteRuntimeReport = run(plan, previewOnly = false)

    private fun run(plan: VotePlan, previewOnly: Boolean): AutoVoteRuntimeReport {
        val skips = plan.skips.toMutableList()
        val results = mutableListOf<VoteBroadcastResult>()
        val chain = chainId.trim().lowercase()
        var attempted = 0
        for ((index, action) in plan.actions.withIndex()) {
            val key = keyProvider.privateWif(chain, action.account)
            if (key.isNullOrBlank()) {
                attempted += 1
                skips += "missing-key:${action.account}|${action.author}|${action.permlink}"
                continue
            }
            attempted += 1
            val operation = VoteOperation(chain, action.account, action.author, action.permlink, action.weight)
            val result = if (previewOnly) voteRuntime.preview(operation, keyProvider.keyRef(chain, action.account), key) else voteRuntime.execute(operation, keyProvider.keyRef(chain, action.account), key)
            results += result
            val sent = result.ok && (result.status == "broadcast_confirmed" || result.status == "broadcast_sent")
            if (sent && !previewOnly && pauseAfterSuccessfulBroadcastMs > 0 && index < plan.actions.lastIndex) {
                try {
                    Thread.sleep(pauseAfterSuccessfulBroadcastMs)
                } catch (_: InterruptedException) {
                    Thread.currentThread().interrupt()
                    break
                }
            }
            if (!result.ok) {
                skips += "${result.status}:${action.account}|${action.author}|${action.permlink}"
                if (result.status == "authority_broadcast_mismatch" || result.status == "authority_verify_error" || result.status == "posting_key_mismatch") {
                    skips += "stop-plan:${result.status}:${action.account}"
                    break
                }
            }
        }
        return AutoVoteRuntimeReport(
            attempted = attempted,
            broadcasted = if (previewOnly) 0 else results.count { it.ok && (it.status == "broadcast_confirmed" || it.status == "broadcast_sent") },
            skipped = skips,
            results = results,
            candidates = plan.actions.size,
            skipSummary = skips.groupingBy { it.substringBefore(':') }.eachCount()
        )
    }
}
