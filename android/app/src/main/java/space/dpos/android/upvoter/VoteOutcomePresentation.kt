package space.dpos.android.upvoter

import space.dpos.android.diagnostics.DiagnosticSanitizer

/** Human status is separate from the stable machine-readable result code. */
object VoteOutcomePresentation {
    fun message(result: VoteBroadcastResult): String {
        val reason = DiagnosticSanitizer.sanitize(result.reason, 4_000)
        return if (result.status == "broadcast_unknown") {
            "@${result.operation.voter}: голосование приостановлено — результат прежней отправки ещё не подтверждён. $reason"
        } else {
            "@${result.operation.voter} @${result.operation.author}/${result.operation.permlink}: ${result.status}: $reason"
        }
    }
}
