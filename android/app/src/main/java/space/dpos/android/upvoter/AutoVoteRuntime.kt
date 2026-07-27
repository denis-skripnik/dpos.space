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

class AutoVoteRuntime(
    private val voteRuntime: VoteRuntime,
    private val keyProvider: PostingKeyProvider,
    private val chainId: String = "golos"
) {
    fun preview(plan: VotePlan): AutoVoteRuntimeReport = run(plan, previewOnly = true)
    fun execute(plan: VotePlan): AutoVoteRuntimeReport = run(plan, previewOnly = false)

    private fun run(plan: VotePlan, previewOnly: Boolean): AutoVoteRuntimeReport {
        val skips = plan.skips.toMutableList()
        val results = mutableListOf<VoteBroadcastResult>()
        val chain = chainId.trim().lowercase()
        val sentCounts = mutableMapOf<String, Int>()
        var attempted = 0
        for (action in plan.actions) {
            if ((sentCounts[action.account] ?: 0) >= action.maxBroadcastsPerTick) {
                skips += "limit:${action.account}|${action.author}|${action.permlink}"
                continue
            }
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
            if (result.ok && result.status == "broadcast_sent") sentCounts[action.account] = (sentCounts[action.account] ?: 0) + 1
            if (!result.ok) skips += "${result.status}:${action.account}|${action.author}|${action.permlink}"
        }
        return AutoVoteRuntimeReport(
            attempted = attempted,
            broadcasted = if (previewOnly) 0 else results.count { it.status == "broadcast_sent" && it.ok },
            skipped = skips,
            results = results
        )
    }
}
