package space.dpos.android.upvoter

import org.json.JSONObject
import space.dpos.android.core.PayloadSanitizer
import space.dpos.android.storage.EncryptedKeyRef

data class VoteOperation(
    val chainId: String,
    val voter: String,
    val author: String,
    val permlink: String,
    val weight: Int
) {
    fun toJson(): JSONObject = JSONObject()
        .put("type", "vote")
        .put("chainId", chainId)
        .put("voter", voter)
        .put("author", author)
        .put("permlink", permlink)
        .put("weight", weight.coerceIn(-10000, 10000))
}

data class SignedVotePayload(
    val operation: VoteOperation,
    val keyRef: EncryptedKeyRef,
    val signedTransaction: String,
    val dryRunOnly: Boolean = true
) {
    fun redactedJson(): JSONObject = JSONObject()
        .put("operation", operation.toJson())
        .put("keyRef", JSONObject()
            .put("chainId", keyRef.chainId)
            .put("account", keyRef.account)
            .put("authority", keyRef.authority)
            .put("alias", keyRef.alias))
        .put("signedTransaction", PayloadSanitizer.text(signedTransaction, 180))
        .put("dryRunOnly", dryRunOnly)
}

data class DryRunBroadcastResult(
    val ok: Boolean,
    val status: String,
    val operation: VoteOperation,
    val reason: String,
    val payload: SignedVotePayload? = null
) {
    fun toJson(): JSONObject = JSONObject()
        .put("ok", ok)
        .put("status", status)
        .put("reason", PayloadSanitizer.text(reason, 300))
        .put("operation", operation.toJson())
        .put("payload", payload?.redactedJson() ?: JSONObject.NULL)
}

interface VoteSigner {
    fun sign(operation: VoteOperation, keyRef: EncryptedKeyRef?, manualRuntimeConfirmation: Boolean): DryRunBroadcastResult
}

class DisabledVoteSigner : VoteSigner {
    override fun sign(operation: VoteOperation, keyRef: EncryptedKeyRef?, manualRuntimeConfirmation: Boolean): DryRunBroadcastResult {
        if (keyRef == null) {
            return DryRunBroadcastResult(false, "dry_run_no_key", operation, "secure key ref is absent; worker stays dry-run")
        }
        if (!manualRuntimeConfirmation) {
            return DryRunBroadcastResult(false, "dry_run_confirmation_required", operation, "manual runtime confirmation is disabled; no signing or broadcast attempted")
        }
        return DryRunBroadcastResult(false, "disabled", operation, "live signing implementation is deliberately disabled in automated worker builds")
    }
}

object VoteOperationFixture {
    fun golosFavoriteVote(account: String = "denis", author: String = "alice", permlink: String = "hello", weight: Int = 10000): VoteOperation =
        VoteOperation(chainId = "golos", voter = account, author = author, permlink = permlink, weight = weight)

    fun dryRunPayload(operation: VoteOperation = golosFavoriteVote()): DryRunBroadcastResult =
        DisabledVoteSigner().sign(operation, null, manualRuntimeConfirmation = false)
}
