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
    val results: List<VoteBroadcastResult>
)

class AutoVoteRuntime(private val voteRuntime: VoteRuntime, private val keyProvider: PostingKeyProvider) {
    fun preview(plan: VotePlan): AutoVoteRuntimeReport = run(plan, previewOnly = true)
    fun execute(plan: VotePlan): AutoVoteRuntimeReport = run(plan, previewOnly = false)

    private fun run(plan: VotePlan, previewOnly: Boolean): AutoVoteRuntimeReport {
        val skips = plan.skips.toMutableList()
        val results = mutableListOf<VoteBroadcastResult>()
        for (action in plan.actions) {
            val key = keyProvider.privateWif("golos", action.account)
            if (key.isNullOrBlank()) {
                skips += "missing-key:${action.account}|${action.author}|${action.permlink}"
                continue
            }
            val operation = VoteOperation("golos", action.account, action.author, action.permlink, action.weight)
            val result = if (previewOnly) voteRuntime.preview(operation, keyProvider.keyRef("golos", action.account), key) else voteRuntime.execute(operation, keyProvider.keyRef("golos", action.account), key)
            results += result
            if (!result.ok) skips += "${result.status}:${action.account}|${action.author}|${action.permlink}"
        }
        return AutoVoteRuntimeReport(
            attempted = plan.actions.size,
            broadcasted = if (previewOnly) 0 else results.count { it.status == "broadcast_sent" && it.ok },
            skipped = skips,
            results = results
        )
    }
}
