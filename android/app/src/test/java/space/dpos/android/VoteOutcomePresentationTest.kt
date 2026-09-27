package space.dpos.android

import org.junit.Assert.*
import org.junit.Test
import space.dpos.android.upvoter.VoteOperation
import space.dpos.android.upvoter.VoteBroadcastResult
import space.dpos.android.upvoter.VoteOutcomePresentation

class VoteOutcomePresentationTest {
    @Test fun pendingMessageNamesThePriorOperationRatherThanTheUnsentCandidateAndMasksSecrets() {
        val result = VoteBroadcastResult(false, "broadcast_unknown", VoteOperation("golos", "alice", "new-author", "unsent-candidate", 1000),
            "Прежний голос: @old-author/old-post. История временно недоступна. Повторная отправка заблокирована. password=fixture-never-persist")
        val message = VoteOutcomePresentation.message(result)
        assertTrue(message.contains("голосование приостановлено"))
        assertTrue(message.contains("@old-author/old-post"))
        assertFalse(message.contains("unsent-candidate"))
        assertFalse(message.contains("fixture-never-persist"))
        assertFalse(message.contains("broadcast_unknown"))
    }
}
