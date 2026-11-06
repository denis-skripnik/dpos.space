package space.dpos.android.notifications

import org.json.JSONObject
import java.math.BigInteger

/** Display only: the original event stays parseable by the web reward-details formatter. */
object CurationRewardDisplay {
    const val FALLBACK = "Получена кураторская награда"
    private data class Spec(val raw: String, val power: String, val liquid: String, val fund: String)
    private val specs = mapOf(
        "golos" to Spec("GESTS", "СГ", "GOLOS", "total_vesting_fund_steem"),
        "steem" to Spec("VESTS", "SP", "STEEM", "total_vesting_fund_steem"),
        "hive" to Spec("VESTS", "HP", "HIVE", "total_vesting_fund_hive")
    )
    private val assetPattern = Regex("^([0-9]+)(?:\\.([0-9]+))? ([A-Z]+)$")
    private val thousand = BigInteger.valueOf(1000)
    private val two = BigInteger.valueOf(2)

    internal fun chain(route: String): String? {
        // Native scanner routes are fixed, unencoded chain/op identifiers.
        val fields = route.removePrefix("#").split('&').map { it.split('=', limit = 2) }
        val chain = fields.singleOrNull { it.first() == "chain" }?.getOrNull(1)
        val op = fields.singleOrNull { it.first() == "ops" }?.getOrNull(1)
        return chain?.takeIf { it in specs && op == "curation_reward" }
    }

    private fun asset(value: String, symbol: String, precision: Int): BigInteger? {
        val match = assetPattern.matchEntire(value) ?: return null
        val (whole, fraction, unit) = match.destructured
        if (unit != symbol || whole.length > 40 || fraction.length > precision) return null
        return BigInteger(whole + fraction.padEnd(precision, '0'))
    }

    internal fun validAmount(event: DposEventNotification): Boolean {
        val spec = specs[chain(event.route)] ?: return false
        return asset(event.text, spec.raw, 6) != null
    }

    /** null means a different event type/network: preserve its existing presentation. */
    fun text(event: DposEventNotification, properties: JSONObject?): String? {
        val spec = specs[chain(event.route)] ?: return null
        val amount = asset(event.text, spec.raw, 6) ?: return FALLBACK
        val fund = asset(properties?.optString(spec.fund).orEmpty(), spec.liquid, 3) ?: return FALLBACK
        val shares = asset(properties?.optString("total_vesting_shares").orEmpty(), spec.raw, 6) ?: return FALLBACK
        if (fund.signum() <= 0 || shares.signum() <= 0) return FALLBACK
        if (amount.signum() == 0) return "0.000 ${spec.power}"
        val numerator = amount * fund
        if (numerator < shares) return "<0.001 ${spec.power} (по текущему соотношению)"
        val scaled = (numerator + shares / two) / shares
        val value = "${scaled / thousand}.${(scaled % thousand).toString().padStart(3, '0')}"
        return "≈ +$value ${spec.power} (по текущему соотношению)"
    }
}
