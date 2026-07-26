package space.dpos.android

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import space.dpos.android.storage.EncryptedKeyRef
import space.dpos.android.upvoter.DisabledVoteSigner
import space.dpos.android.upvoter.VoteOperation
import space.dpos.android.upvoter.VoteOperationFixture

class VoteBroadcastPolicyTest {
    @Test fun golosVoteFixtureIsDeterministicAndJsonSerializable() {
        val op = VoteOperationFixture.golosFavoriteVote(account = "denis", author = "alice", permlink = "post", weight = 7500)
        val json = op.toJson().toString()
        assertTrue(json.contains("\"type\":\"vote\""))
        assertTrue(json.contains("\"chainId\":\"golos\""))
        assertTrue(json.contains("\"voter\":\"denis\""))
        assertTrue(json.contains("\"author\":\"alice\""))
        assertTrue(json.contains("\"permlink\":\"post\""))
        assertTrue(json.contains("\"weight\":7500"))
    }

    @Test fun signerIsDryRunWithoutSecureKeyRef() {
        val result = DisabledVoteSigner().sign(VoteOperationFixture.golosFavoriteVote(), null, manualRuntimeConfirmation = true)
        assertFalse(result.ok)
        assertEquals("dry_run_no_key", result.status)
        assertTrue(result.reason.contains("dry-run", ignoreCase = true))
    }

    @Test fun signerRequiresManualRuntimeConfirmationEvenWithKeyRef() {
        val op = VoteOperation("golos", "denis", "alice", "post", 10000)
        val ref = EncryptedKeyRef("golos", "denis", "posting", "auto-upvoter")
        val result = DisabledVoteSigner().sign(op, ref, manualRuntimeConfirmation = false)
        assertFalse(result.ok)
        assertEquals("dry_run_confirmation_required", result.status)
        assertTrue(result.toJson().toString().contains("manual runtime confirmation"))
    }

    @Test fun liveSigningImplementationStaysDisabledInAutomatedWorkerBuild() {
        val op = VoteOperation("golos", "denis", "alice", "post", 10000)
        val ref = EncryptedKeyRef("golos", "denis", "posting", "auto-upvoter")
        val result = DisabledVoteSigner().sign(op, ref, manualRuntimeConfirmation = true)
        assertFalse(result.ok)
        assertEquals("disabled", result.status)
        assertTrue(result.toJson().toString().contains("deliberately disabled"))
    }
}
