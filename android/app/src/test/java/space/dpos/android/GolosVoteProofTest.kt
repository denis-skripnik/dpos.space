package space.dpos.android

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import space.dpos.android.upvoter.*

class GolosVoteProofTest {
    private val op = VoteOperation("golos", "denis-skripnik", "unik09", "iz-arkhiva-dlya-ponedelnika", 7000)
    private val expected = "f79faf9d19eb2931979f158d4e8dafb8b2ad7df8"
    // Independent official Golos database_api.get_transaction_hex unsigned oracle,
    // golos-lib-js 0.9.83 / chain 5c2289a5: not derived from this implementation.
    private fun tx() = JSONObject("""{"ref_block_num":12345,"ref_block_prefix":1234567890,"expiration":"2026-10-10T09:00:00","operations":[["vote",{"voter":"denis-skripnik","author":"unik09","permlink":"iz-arkhiva-dlya-ponedelnika","weight":7000}]],"extensions":[]}""")
    private fun proof() = tx().put("transaction_id", expected).put("block_num", 120).put("transaction_num", 0)
        .put("_golosBlock", JSONObject().put("transactions", JSONArray().put(tx())))
        .put("_golosHead", JSONObject().put("head_block_number", 123).put("last_irreversible_block_num", 120))

    @Test fun officialLiteralUnsignedOracleMatchesAndNeedsCanonicalFinality() {
        assertEquals(expected, GolosVoteProof.id(tx(), op))
        assertTrue(GolosVoteProof.lookup(op, expected, proof()))
        assertFalse(GolosVoteProof.lookup(op, "a".repeat(40), proof()))
        assertFalse(GolosVoteProof.lookup(op.copy(weight = 10000), expected, proof()))
        for (changed in listOf(
            proof().put("transaction_id", "a".repeat(40)), proof().put("transaction_num", 1),
            proof().put("transaction_num", -1), proof().put("transaction_num", "0"),
            proof().put("block_num", 120.5), proof().put("_golosBlock", JSONObject.NULL),
            proof().put("_golosBlock", JSONObject().put("transactions", JSONArray().put(tx().put("ref_block_num", 1)))),
            proof().put("_golosHead", JSONObject.NULL),
            proof().put("_golosHead", JSONObject().put("head_block_number", 123).put("last_irreversible_block_num", 119)),
            proof().put("_golosHead", JSONObject().put("head_block_number", 119).put("last_irreversible_block_num", 120))
        )) assertFalse(changed.toString(), GolosVoteProof.lookup(op, expected, changed))
    }

    @Test fun malformedNumbersAndOutOfRangeExpirationCannotAliasCanonicalUnsignedId() {
        for ((field, value) in listOf("ref_block_num" to "12345", "ref_block_num" to 12345.5,
            "ref_block_num" to -1, "ref_block_num" to 65536, "ref_block_prefix" to "1234567890",
            "ref_block_prefix" to 1234567890.5, "ref_block_prefix" to -1L, "ref_block_prefix" to 4294967296L,
            "expiration" to "1969-12-31T23:59:59", "expiration" to "2106-02-07T06:28:16",
            "expiration" to "2026-10-10T09:00:00.000", "expiration" to "2026-02-30T09:00:00")) {
            assertNull("$field=$value", GolosVoteProof.id(tx().put(field, value), op))
        }
        for (weight in listOf<Any>("7000", 7000.5, 65536)) {
            val candidate = tx(); candidate.getJSONArray("operations").getJSONArray(0).getJSONObject(1).put("weight", weight)
            assertNull(GolosVoteProof.id(candidate, op))
        }
        assertNotNull(GolosVoteProof.id(tx().put("expiration", "1970-01-01T00:00:00"), op))
        assertNotNull(GolosVoteProof.id(tx().put("expiration", "2106-02-07T06:28:15"), op))
    }
}
