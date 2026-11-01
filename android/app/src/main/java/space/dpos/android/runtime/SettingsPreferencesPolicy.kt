package space.dpos.android.runtime

import org.json.JSONArray
import org.json.JSONObject

/** Public preferences never contain native account imports, grants, keys or start flags. */
object SettingsPreferencesPolicy {
    private fun fields(obj: JSONObject, names: Set<String>) {
        require(obj.keys().asSequence().toSet() == names) { "invalid settings snapshot fields" }
    }
    private fun bool(obj: JSONObject, key: String): Boolean {
        require(obj.get(key) is Boolean) { "invalid boolean preference" }
        return obj.getBoolean(key)
    }
    private fun numeric(obj: JSONObject, key: String, max: Double): String {
        val value = obj.get(key)
        require(value is String && Regex("^\\d+(?:\\.\\d+)?$").matches(value)) { "invalid numeric preference" }
        require(value.toDouble() in 0.0..max) { "preference out of range" }
        return value
    }
    private fun account(obj: JSONObject): String = obj.getString("account").also {
        require(Regex("^(?:[a-z0-9][a-z0-9.-]{1,30}[a-z0-9]|(?:mx|dx|0x)[0-9a-f]{40}|d0[0-9a-z]{39})$").matches(it)) { "invalid settings binding" }
    }
    private fun rows(array: JSONArray): List<JSONObject> = (0 until array.length()).map { array.getJSONObject(it) }
    fun validate(snapshot: JSONObject) {
        fields(snapshot, setOf("format","version","notifications","autoUpvoter","vizSelfAward"))
        require(snapshot.getString("format") == "dpos.space/settings" && snapshot.getInt("version") == 1) { "unsupported settings schema" }
        require(snapshot.toString().toByteArray(Charsets.UTF_8).size <= 60 * 1024) { "settings too large" }
        val notifyKeys = mutableSetOf<String>()
        rows(snapshot.getJSONArray("notifications")).forEach { row ->
            fields(row, setOf("chain","account","ops","showAutoAwards"))
            val chain = row.getString("chain"); val name = account(row)
            require(chain in setOf("golos","viz","hive","steem","minter","decimal"))
            require(notifyKeys.add("$chain:$name")) { "duplicate settings binding" }
            bool(row,"showAutoAwards")
            val ops = row.getJSONArray("ops"); val strings = (0 until ops.length()).map { ops.getString(it) }
            require(strings.distinct().size == strings.size && WorkerCommandPolicy.normalizeOps(strings,chain) == strings) { "invalid notification operations" }
        }
        val up = snapshot.getJSONObject("autoUpvoter")
        fields(up,setOf("golos","hive","steem"))
        listOf("golos","hive","steem").forEach { chain ->
            val seen = mutableSetOf<String>()
            rows(up.getJSONArray(chain)).forEach { row ->
                fields(row,setOf("account","enabled","curators","favorites","minEnergy","curatorMode","curatorCoefficient","favoritesPercent","autoDonate","autoDonatePoolPercent","autoDonatePoolCoefficient"))
                require(seen.add(account(row)))
                bool(row,"enabled"); val donate = bool(row,"autoDonate")
                require(!donate || chain == "golos")
                listOf("curators","favorites").forEach { field ->
                    val value = row.getString(field)
                    require(value.length <= 12000 && value.split(Regex("[\\s,;]+")).filter { it.isNotBlank() }.all { Regex("^@?[a-z0-9][a-z0-9.-]{1,30}[a-z0-9]$").matches(it) })
                }
                listOf("minEnergy","curatorCoefficient","favoritesPercent","autoDonatePoolPercent").forEach { numeric(row,it,100.0) }
                numeric(row,"autoDonatePoolCoefficient",10.0)
                require(row.getString("curatorMode") in setOf("repeat","full"))
                if (donate) space.dpos.android.upvoter.GolosDonatePool.parse("${row.getString("autoDonatePoolPercent")} ${row.getString("autoDonatePoolCoefficient")}")
            }
        }
        val seen = mutableSetOf<String>()
        rows(snapshot.getJSONArray("vizSelfAward")).forEach { row ->
            fields(row,setOf("account","enabled","minEnergy")); require(seen.add(account(row))); bool(row,"enabled"); require(numeric(row,"minEnergy",9999.0).toDouble() % 1.0 == 0.0)
        }
    }
}
