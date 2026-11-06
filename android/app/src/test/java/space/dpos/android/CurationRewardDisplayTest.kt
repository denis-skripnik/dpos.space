package space.dpos.android

import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import space.dpos.android.notifications.CurationRewardDisplay
import space.dpos.android.notifications.CurationRewardDisplayPass
import space.dpos.android.notifications.DposEventNotification

class CurationRewardDisplayTest {
    private fun event(chain: String, raw: String, op: String = "curation_reward") = DposEventNotification(
        "$chain:alice:9:$op", "Кураторская награда", raw,
        "#chain=$chain&app=history&account=alice&ops=$op", 9)
    private fun properties(chain: String, fund: String = "500.000", shares: String = "1000.000000") = JSONObject()
        .put(if (chain == "hive") "total_vesting_fund_hive" else "total_vesting_fund_steem", "$fund ${if (chain == "golos") "GOLOS" else if (chain == "steem") "STEEM" else "HIVE"}")
        .put("total_vesting_shares", "$shares ${if (chain == "golos") "GESTS" else "VESTS"}")

    @Test fun threeChainsUseExactCurrentRatioAndPowerSymbols() {
        for ((chain, unit) in listOf("golos" to "СГ", "steem" to "SP", "hive" to "HP")) {
            val raw = if (chain == "golos") "2.123000 GESTS" else "2.123000 VESTS"
            assertEquals("≈ +1.062 $unit (по текущему соотношению)", CurationRewardDisplay.text(event(chain, raw), properties(chain)))
        }
    }

    @Test fun zeroTinyAndHugeValuesNeverUseFloatingPoint() {
        assertEquals("0.000 HP", CurationRewardDisplay.text(event("hive", "0.000000 VESTS"), properties("hive")))
        assertEquals("<0.001 SP (по текущему соотношению)", CurationRewardDisplay.text(event("steem", "0.000001 VESTS"), properties("steem")))
        assertEquals("≈ +9007199254740993.001 СГ (по текущему соотношению)", CurationRewardDisplay.text(event("golos", "9007199254740993.001000 GESTS"), properties("golos", "1000.000")))
        assertEquals("≈ +1.001 HP (по текущему соотношению)", CurationRewardDisplay.text(event("hive", "2.001000 VESTS"), properties("hive")))
    }

    @Test fun missingMalformedWrongSymbolPrecisionAndNonpositiveRatesFallBackWithoutRawUnits() {
        val e = event("golos", "2.123000 GESTS")
        val invalid = listOf(null, JSONObject(), properties("golos", "0.000"), properties("golos", "-1.000"),
            properties("golos", shares = "0.000000"), properties("golos", "1.0001"), properties("golos", shares = "1.0000001"),
            properties("golos").put("total_vesting_shares", "1000.000000 VESTS"),
            properties("golos").put("total_vesting_fund_steem", "500.000 STEEM"))
        invalid.forEach { assertEquals(CurationRewardDisplay.FALLBACK, CurationRewardDisplay.text(e, it)) }
        for (raw in listOf("-1.000000 GESTS", "1e3 GESTS", "1.0000001 GESTS", "1.0 VESTS", "1 GESTS, 2 GESTS", "1. GESTS", " 1 GESTS", "9".repeat(41) + " GESTS")) {
            assertEquals(raw, CurationRewardDisplay.FALLBACK, CurationRewardDisplay.text(e.copy(text = raw), properties("golos")))
        }
    }

    @Test fun unrelatedTypesAndChainsAreNotReformatted() {
        for (op in listOf("author_reward", "comment_benefactor_reward", "transfer")) {
            assertNull(CurationRewardDisplay.text(event("golos", "1.000000 GESTS", op), properties("golos")))
        }
        assertNull(CurationRewardDisplay.text(event("viz", "1.000000 VESTS"), JSONObject()))
    }

    @Test fun passCachesSuccessAndFailureOnlyLocallyAndSkipsIneligibleAmounts() {
        val reads = mutableListOf<String>()
        val load: (String, Long) -> JSONObject? = { chain, _ -> reads += chain; if (chain == "steem") error("offline") else properties(chain) }
        val pass = CurationRewardDisplayPass(load)
        repeat(3) { pass.text(event("golos", "2.000000 GESTS")); pass.text(event("steem", "2.000000 VESTS")) }
        pass.text(event("hive", "invalid"))
        pass.text(event("hive", "1 VESTS", "author_reward"))
        assertEquals(listOf("golos", "steem"), reads)
        CurationRewardDisplayPass(load).text(event("golos", "2.000000 GESTS"))
        assertEquals(listOf("golos", "steem", "golos"), reads)
    }

    @Test fun monotonicReadBudgetIsSharedAcrossChainsButNotSpentWaitingBetweenAccounts() {
        var now = 0L
        val budgets = mutableListOf<Long>()
        val pass = CurationRewardDisplayPass(load = { chain, budget -> budgets += budget; now += 1_500; properties(chain) }, monotonicMs = { now }, totalBudgetMs = 2_000)
        pass.text(event("golos", "1 GESTS"))
        now += 60_000 // unrelated worker work is not an extra notification read
        pass.text(event("steem", "1 VESTS"))
        assertEquals(CurationRewardDisplay.FALLBACK, pass.text(event("hive", "1 VESTS")))
        assertEquals(listOf(1_500L, 500L), budgets)
    }
}
