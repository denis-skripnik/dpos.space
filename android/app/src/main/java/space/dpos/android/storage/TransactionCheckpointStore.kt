package space.dpos.android.storage

import android.content.SharedPreferences
import android.system.Os
import android.system.OsConstants
import android.util.AtomicFile
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.security.MessageDigest
import java.util.concurrent.ConcurrentHashMap

/** App-private transaction authority. No keys, signed payloads, or arbitrary preferences.
 * The current production manifest is single-process. Every instance in that process uses
 * the same ownership lock, including complete read/modify/write operations, never RPC.
 */
class TransactionCheckpointStore(
    directory: File,
    private val legacy: SharedPreferences,
    private val boundary: (String, File) -> Unit = { _, _ -> }
) {
    private val dir = directory.canonicalFile
    private val owner = owners.computeIfAbsent(dir.path) { Owner() }
    val lock: Any get() = owner
    private val backup = AtomicFile(File(dir, "legacy-import.json"))
    private val authority = AtomicFile(File(dir, "transactions.json"))
    private class Owner {
        var fault: String? = null
        var activated = false
        var bootstrapVerified = false
        var retryAfterElapsed = 0L
        var recoveryFailures = 0
        val unsentThisProcess = mutableSetOf<String>()
    }

    init { synchronized(lock) { bootstrap() } }

    private fun bootstrap() {
        owner.bootstrapVerified = false
        try {
            if (!dir.exists()) {
                check(dir.mkdirs()) { "checkpoint_directory_creation_failed" }
                syncDirectory(dir.parentFile!!)
            }
            if (exists(authority)) {
                load() // Includes immutable backup digest + complete envelope validation.
                // A verified activated envelope retires legacy authority even when a fresh
                // writability probe fails. Ordinary permission revocation must remain writable.
                // Missing/corrupt authority or backup never reaches this point.
                owner.bootstrapVerified = true
                // Re-prove physical writability on a new instance, without importing prefs.
                if (!owner.activated || owner.fault != null) check(retryStorage(force = false)) { "checkpoint_recovery_backoff" }
            } else {
                check(!exists(backup)) { "authority_missing_backup_retained" }
                val entries = JSONObject()
                legacy.all.toSortedMap().forEach { (key, value) ->
                    if (isTransactionKey(key)) entries.put(key, typed(value))
                }
                val raw = JSONObject().put("schema", 1).put("entries", entries)
                val bytes = raw.toString().toByteArray(Charsets.UTF_8)
                writeVerified(backup, bytes, "backup") { verifyBackup(it) }
                // Preserve any retired-cache fence bytes in immutable evidence, never activate them.
                entries.keys().asSequence().filter { it == "golosProductionTransition" || it == "golosRecoveryFence" || it.startsWith("golosRecoveryRejectedFence:") }
                    .toList().forEach { entries.remove(it) }
                val invalid = JSONObject()
                entries.keys().forEach { key ->
                    if (runCatching { validateEntry(key, entries.getJSONObject(key)) }.isFailure)
                        invalid.put(key, "invalid_legacy_record")
                }
                val marker = entries.optJSONObject("voteStorageUnsafe")
                val incomplete = marker != null && (marker.optString("type") != "boolean" || marker.opt("value") != false)
                val checkpoint = JSONObject().put("schema", 1).put("generation", 1L)
                    .put("activation", "active").put("backupDigest", digest(bytes))
                    .put("legacyIdentityIncomplete", incomplete).put("entries", entries)
                    .put("invalid", invalid).put("terminal", JSONObject())
                writeCheckpoint(checkpoint)
            }
            owner.activated = true
            owner.bootstrapVerified = true
            owner.fault = null
        } catch (_: Exception) {
            owner.activated = false
            owner.fault = "checkpoint_bootstrap_unverified"
        }
    }

    fun status(): JSONObject = synchronized(lock) {
        val state = runCatching { checkedLoad() }.getOrNull()
        JSONObject().put("authority", if (owner.activated && owner.fault == null) "verified" else "storage_unverified")
            .put("fault", owner.fault ?: JSONObject.NULL).apply {
                state?.let {
                    put("generation", it.getLong("generation"))
                    put("legacyIdentityIncomplete", it.getBoolean("legacyIdentityIncomplete"))
                    put("invalidScopes", JSONArray(it.getJSONObject("invalid").keys().asSequence().toList()))
                    val fence = it.getJSONObject("entries").optJSONObject("golosRecoveryFence")
                    if (fence != null) put("golosRecoveryFence", JSONObject(untyped(fence) as String))
                }
            }
    }
    fun assertPreferencesWritable() = synchronized(lock) {
        check(owner.bootstrapVerified) { "checkpoint bootstrap unverified; ordinary writes paused" }
    }
    fun assertActivated() = synchronized(lock) {
        check(owner.activated && owner.fault == null) { "checkpoint storage unverified; retry storage operation; sends blocked" }
    }

    /** At most two attempts per explicit recovery operation. Never reads legacy as authority. */
    fun retryStorage(force: Boolean = true): Boolean = synchronized(lock) {
        val now = android.os.SystemClock.elapsedRealtime()
        if (!force && now < owner.retryAfterElapsed) return@synchronized false
        repeat(2) {
            if (runCatching { retryLocked() }.isSuccess) {
                owner.bootstrapVerified = true
                owner.recoveryFailures = 0
                owner.retryAfterElapsed = 0L
                return@synchronized true
            }
        }
        owner.recoveryFailures = (owner.recoveryFailures + 1).coerceAtMost(5)
        owner.retryAfterElapsed = now + (10_000L shl owner.recoveryFailures).coerceAtMost(300_000L)
        false
    }
    private fun retryLocked() {
        owner.activated = false
        owner.fault = "checkpoint_recovery_unverified"
        val current = load()
        current.put("generation", Math.addExact(current.getLong("generation"), 1L))
        writeCheckpoint(current)
        owner.activated = true
        owner.fault = null
    }

    fun registerCurrentPreparation(id: String) = synchronized(lock) { owner.unsentThisProcess.add(id) }
    fun enterTransport(id: String) = synchronized(lock) { assertActivated(); owner.unsentThisProcess.remove(id) }
    fun currentUnsent(id: String): Boolean = synchronized(lock) { id in owner.unsentThisProcess }
    fun retirePreparation(id: String) = synchronized(lock) { owner.unsentThisProcess.remove(id) }

    fun legacyIdentityIncomplete(): Boolean = synchronized(lock) { assertActivated(); load().getBoolean("legacyIdentityIncomplete") }
    fun read(key: String): Any? = synchronized(lock) {
        assertActivated()
        val state = checkedLoad()
        check(!state.getJSONObject("invalid").has(key)) { "checkpoint invalid record in scoped transaction section" }
        state.getJSONObject("entries").optJSONObject(key)?.let { untyped(it) }
    }
    fun snapshot(): Map<String, Any?> = synchronized(lock) {
        assertActivated(); val state = checkedLoad()
        state.getJSONObject("entries").let { values -> values.keys().asSequence().associateWith { untyped(values.getJSONObject(it)) } }
    }
    fun mutate(change: (JSONObject) -> Unit) = synchronized(lock) {
        assertActivated()
        val state = checkedLoad()
        val retired = state.getJSONObject("entries").optJSONObject("golosProductionTransition")?.toString()
        change(state)
        check(retired == null || state.getJSONObject("entries").optJSONObject("golosProductionTransition")?.toString() == retired) {
            "retired Golos fence, provenance and epoch are immutable"
        }
        state.put("generation", Math.addExact(state.getLong("generation"), 1L))
        try { writeCheckpoint(state) } catch (failure: Exception) {
            owner.activated = false
            owner.fault = "checkpoint_write_unverified"
            throw IllegalStateException("checkpoint physical write unverified; sends blocked", failure)
        }
    }
    fun put(changes: Map<String, Any?>) = mutate { state ->
        val values = state.getJSONObject("entries")
        changes.forEach { (key, value) ->
            require(isTransactionKey(key))
            check(!state.getJSONObject("invalid").has(key)) { "invalid legacy section retained" }
            if (value == null) values.remove(key) else values.put(key, typed(value))
        }
    }
    private fun checkedLoad(): JSONObject = try { load() } catch (failure: Exception) {
        owner.activated = false; owner.fault = "checkpoint_read_unverified"
        throw IllegalStateException("checkpoint authority unavailable; no legacy fallback", failure)
    }
    private fun load(): JSONObject {
        check(exists(authority)) { "authority_missing_backup_retained" }
        val bytes = authority.openRead().use { it.readBytes() }
        val state = JSONObject(String(bytes, Charsets.UTF_8))
        validateCheckpoint(state)
        val imported = backup.openRead().use { it.readBytes() }
        verifyBackup(imported)
        check(state.getString("backupDigest") == digest(imported)) { "backup_digest_mismatch" }
        return state
    }
    private fun exists(file: AtomicFile): Boolean = file.baseFile.exists() || File(file.baseFile.path + ".bak").exists() || File(file.baseFile.path + ".new").exists()
    private fun writeCheckpoint(state: JSONObject) {
        state.put("payloadDigest", payloadDigest(state))
        validateCheckpoint(state)
        writeVerified(authority, state.toString().toByteArray(Charsets.UTF_8), "checkpoint") {
            val reopened = JSONObject(String(it, Charsets.UTF_8)); validateCheckpoint(reopened)
            check(reopened.getLong("generation") == state.getLong("generation"))
            val original = backup.openRead().use { input -> input.readBytes() }
            verifyBackup(original)
            check(reopened.getString("backupDigest") == digest(original))
        }
    }
    private fun writeVerified(file: AtomicFile, bytes: ByteArray, purpose: String, validate: (ByteArray) -> Unit) {
        var stream: FileOutputStream? = null
        var finishEntered = false
        try {
            boundary("$purpose:start", file.baseFile)
            stream = file.startWrite()
            boundary("$purpose:write", file.baseFile)
            stream.write(bytes); stream.flush()
            boundary("$purpose:sync", file.baseFile)
            stream.fd.sync() // AtomicFile's own sync can log-and-ignore failure.
            boundary("$purpose:finish", file.baseFile)
            finishEntered = true
            file.finishWrite(stream)
            boundary("$purpose:directory", file.baseFile)
            syncDirectory(dir)
            boundary("$purpose:readback", file.baseFile)
            val actual = file.openRead().use { it.readBytes() } // Never during unfinished write.
            check(actual.contentEquals(bytes)) { "checkpoint_exact_readback_mismatch" }
            validate(actual)
            boundary("$purpose:verified", file.baseFile)
        } catch (failure: Exception) {
            if (!finishEntered) runCatching { file.failWrite(stream) }
            else runCatching { stream?.close() } // failWrite cannot undo a finished base.
            throw failure
        }
    }
    private fun syncDirectory(directory: File) {
        val fd = Os.open(directory.path, OsConstants.O_RDONLY, 0)
        try { Os.fsync(fd) } finally { Os.close(fd) }
    }
    private fun verifyBackup(bytes: ByteArray) {
        val root = JSONObject(String(bytes, Charsets.UTF_8))
        require(root.keySetCompat() == setOf("schema", "entries") && root.get("schema") == 1)
        val entries = root.getJSONObject("entries")
        entries.keys().forEach { key -> require(isTransactionKey(key)); untyped(entries.getJSONObject(key)) }
    }
    private fun validateCheckpoint(state: JSONObject) {
        require(state.keySetCompat() == setOf("schema", "generation", "activation", "backupDigest", "payloadDigest", "legacyIdentityIncomplete", "entries", "invalid", "terminal"))
        require(state.get("schema") == 1 && state.getString("activation") == "active")
        require(state.getString("payloadDigest") == payloadDigest(state))
        require(state.get("generation") is Number && state.getLong("generation") > 0 && state.get("generation").toString() == state.getLong("generation").toString())
        require(state.get("legacyIdentityIncomplete") is Boolean && state.getString("backupDigest").matches(Regex("[0-9a-f]{64}")))
        val entries = state.getJSONObject("entries"); val invalid = state.getJSONObject("invalid")
        invalid.keys().forEach { require(entries.has(it) && invalid.getString(it) == "invalid_legacy_record") }
        entries.keys().forEach { key ->
            require(isTransactionKey(key)); val row = entries.getJSONObject(key); untyped(row)
            if (!invalid.has(key)) validateEntry(key, row)
        }
        state.getJSONObject("terminal").let { terminals -> terminals.keys().forEach { id ->
            require(id.matches(Regex("[0-9a-f]{64}")))
            val row = terminals.getJSONObject(id)
            require(row.keySetCompat() == setOf("identity", "reason", "atMs"))
            require(row.getString("reason") in setOf("confirmed", "unknown_expired", "unsent_cancelled"))
            require(row.get("atMs") is Number && row.getLong("atMs") > 0 && row.get("atMs").toString() == row.getLong("atMs").toString())
            val intent = row.getJSONObject("identity")
            validatePending(intent, null)
            require(identity(intent) == id)
            if (row.getString("reason") == "confirmed") when (intent.getString("kind")) {
                "donate" -> {
                    val key = "donateReceipt:golos:${intent.getString("account")}:${intent.getString("fingerprint").substringBefore('|')}"
                    require(entries.has(key) && untyped(entries.getJSONObject(key)) == true)
                }
                "self_award" -> {
                    val key = "lastVizSelfAwardAt:viz:${intent.getString("account")}"
                    require(entries.has(key))
                    val at = untyped(entries.getJSONObject(key))
                    require(at is Long && at >= row.getLong("atMs"))
                }
            }
        } }
    }
    companion object {
        private val owners = ConcurrentHashMap<String, Owner>()
        fun isTransactionKey(key: String): Boolean = key == "golosProductionTransition" || key.startsWith("golosRecoveryRejectedFence:") || key == "golosRecoveryFence" || key == "voteStorageUnsafe" || key.startsWith("pendingTransaction:") ||
            key.startsWith("voteArchive:") || key.startsWith("donateReceipt:") || key.startsWith("lastVizSelfAwardAt:") ||
            key.startsWith("voteBacklog:") || key.startsWith("autoVoteSourceCursor:") ||
            key in setOf("totalAutoUpvoterBroadcasted", "totalVizSelfAwardBroadcasted")
        fun typed(value: Any?): JSONObject = when (value) {
            is String -> JSONObject().put("type", "string").put("value", value)
            is Boolean -> JSONObject().put("type", "boolean").put("value", value)
            is Int -> JSONObject().put("type", "int").put("value", value)
            is Long -> JSONObject().put("type", "long").put("value", value)
            is Float -> JSONObject().put("type", "float").put("value", value.toString())
            is Set<*> -> JSONObject().put("type", "strings").put("value", JSONArray(value.sortedBy { it.toString() }))
            else -> error("unsupported legacy transaction type")
        }
        fun untyped(row: JSONObject): Any {
            require(row.keySetCompat() == setOf("type", "value"))
            return when (row.getString("type")) {
                "string" -> row.get("value").also { require(it is String) }
                "boolean" -> row.get("value").also { require(it is Boolean) }
                "int" -> row.get("value").let { require(it is Number && it.toString() == row.getInt("value").toString()); row.getInt("value") }
                "long" -> row.get("value").let { require(it is Number && it.toString() == row.getLong("value").toString()); row.getLong("value") }
                "float" -> row.getString("value").toFloat()
                "strings" -> row.getJSONArray("value").let { a -> (0 until a.length()).map { require(a.get(it) is String); a.getString(it) }.toSet() }
                else -> error("unknown transaction entry type")
            }
        }
        fun validateEntry(key: String, row: JSONObject) {
            val value = untyped(row)
            when {
                key == "golosProductionTransition" -> {
                    require(value is String)
                    val r = JSONObject(value)
                    require(r.keySetCompat() == setOf("schema", "policy", "checkpointId", "oldFence", "initialFence", "provenance", "epoch", "quarantinedIdentities"))
                    require(r.getInt("schema") == 1 && r.getString("policy") == space.dpos.android.upvoter.GolosProductionPolicy.ID)
                    require(r.getString("checkpointId") == space.dpos.android.upvoter.GolosProductionPolicy.CHECKPOINT_ID)
                    require(space.dpos.android.upvoter.GolosProductionPolicy.isReviewedForeign(JSONObject(r.getString("oldFence"))))
                    val old = JSONObject(r.getString("oldFence")); val next = JSONObject(r.getString("initialFence"))
                    space.dpos.android.upvoter.GolosRecoveryFence.validateFence(next)
                    require(!next.getBoolean("verified") && next.getLong("drain") >= maxOf(old.getLong("drain"), old.getLong("cutoff")))
                    require(next.getLong("drain") >= maxOf(next.getLong("headTime"), next.getLong("observedAtMs") / 1000) + 3720)
                    require(r.getString("epoch") == r.getString("policy") + ":" + next.getString("headId") && r.getString("provenance").isNotBlank())
                    val ids = r.getJSONArray("quarantinedIdentities")
                    for (i in 0 until ids.length()) require(ids.getString(i).matches(Regex("[0-9a-f]{64}")))
                }
                key == "golosRecoveryFence" || key.startsWith("golosRecoveryRejectedFence:") -> { require(value is String); space.dpos.android.upvoter.GolosRecoveryFence.validateFence(JSONObject(value)) }
                key == "voteStorageUnsafe" || key.startsWith("donateReceipt:") -> require(value is Boolean)
                key.startsWith("pendingTransaction:") -> { require(value is String); validatePending(JSONObject(value), key) }
                key.startsWith("voteArchive:") -> {
                    require(value is String); val rows = JSONArray(value); val identities = mutableSetOf<String>()
                    for (i in 0 until rows.length()) {
                        val entry = rows.getJSONObject(i); require(entry.keySetCompat() == setOf("intent", "confirmed") && entry.get("confirmed") is Boolean)
                        val pending = entry.getJSONObject("intent")
                        val scope = key.removePrefix("voteArchive:")
                        validatePending(pending, "pendingTransaction:vote:$scope")
                        require(identities.add(identity(pending)))
                    }
                }
                key.startsWith("voteBacklog:") -> { require(value is String); JSONObject(value) }
                key.startsWith("lastVizSelfAwardAt:") || key.startsWith("autoVoteSourceCursor:") -> require(value is Long && value >= -1)
                key.startsWith("total") -> require(value is Int && value >= 0)
                else -> error("unknown checkpoint field")
            }
        }
        fun validatePending(json: JSONObject, key: String?) {
            val allowed = setOf("kind", "chainId", "account", "fingerprint", "historyBaseline", "state", "transactionId", "createdAtMs", "expirationEpochSeconds", "observedChainTimeSeconds", "observedHeadBlock", "includedBlockNumber", "recoveryCursors", "recoveryScopeTurn", "recoveryGeneration")
            require(json.keySetCompat().all { it in allowed })
            val kind = json.getString("kind"); val chain = json.getString("chainId"); val account = json.getString("account")
            require(kind in setOf("vote", "donate", "self_award") && chain in setOf("golos", "viz", "hive", "steem"))
            require(account.matches(Regex("[a-z0-9.-]{3,32}")) && json.getString("fingerprint").isNotBlank())
            require(key == null || key == "pendingTransaction:$kind:$chain:$account")
            require(json.get("historyBaseline") is Number && json.get("historyBaseline").toString() == json.getLong("historyBaseline").toString())
            require(!json.has("state") || json.getString("state") in setOf("PREPARED", "UNKNOWN"))
            if (json.has("transactionId")) require(json.getString("transactionId").matches(Regex("[0-9a-fA-F]{40}")))
            for (field in listOf("createdAtMs", "expirationEpochSeconds", "observedChainTimeSeconds", "observedHeadBlock", "includedBlockNumber"))
                if (json.has(field)) require(json.get(field) is Number && json.getLong(field) > 0 && json.get(field).toString() == json.getLong(field).toString())
            if (json.has("recoveryScopeTurn")) require(json.get("recoveryScopeTurn") is Number && json.getInt("recoveryScopeTurn") >= 0 && json.get("recoveryScopeTurn").toString() == json.getInt("recoveryScopeTurn").toString())
            if (json.has("recoveryGeneration")) {
                require(kind == "vote" && chain == "golos" && json.get("recoveryGeneration") is String)
                val g = JSONObject(json.getString("recoveryGeneration"))
                require(g.keys().asSequence().toSet() == setOf("id", "root", "created", "author", "permlink", "endpoint", "fenceId", "cutoff", "revision", "libHeight", "libTime"))
                for (f in listOf("id", "root", "created", "cutoff", "libHeight", "libTime")) require(g.get(f) is Number && g.getLong(f) > 0 && g.get(f).toString() == g.getLong(f).toString())
                require(g.getString("revision").matches(Regex("[0-9a-f]{64}")))
                require(g.getLong("id") == g.getLong("root") && g.getLong("created") > g.getLong("cutoff") && g.getLong("created") <= g.getLong("libTime"))
                require(g.getString("fenceId").matches(Regex("[0-9a-f]{40}")) && g.getString("endpoint").isNotBlank())
                val target = json.getString("fingerprint").split('|')
                require(target.size == 3 && g.getString("author") == target[0] && g.getString("permlink") == target[1])
            }
            json.optJSONObject("recoveryCursors")?.let { cursors -> cursors.keys().forEach { require(cursors.get(it) is Number && cursors.get(it).toString() == cursors.getLong(it).toString()) } }
        }
        fun identity(json: JSONObject): String = digest(JSONArray().put(json.getString("kind")).put(json.getString("chainId")).put(json.getString("account"))
            .put(json.getString("fingerprint")).put(json.opt("transactionId") ?: JSONObject.NULL).put(json.opt("createdAtMs") ?: JSONObject.NULL)
            .put(json.getLong("historyBaseline")).toString().toByteArray(Charsets.UTF_8))
        private fun payloadDigest(state: JSONObject): String = digest(canonical(state, "payloadDigest").toByteArray(Charsets.UTF_8))
        private fun canonical(value: Any?, excludedKey: String? = null): String = when (value) {
            null, JSONObject.NULL -> "null"
            is JSONObject -> value.keys().asSequence().filter { it != excludedKey }.sorted().joinToString(",", "{", "}") { key -> JSONObject.quote(key) + ":" + canonical(value.get(key)) }
            is JSONArray -> (0 until value.length()).joinToString(",", "[", "]") { canonical(value.get(it)) }
            is String -> JSONObject.quote(value)
            is Number, is Boolean -> value.toString()
            else -> error("unsupported checkpoint value")
        }
        fun digest(bytes: ByteArray): String = MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it.toInt() and 255) }
        private fun JSONObject.keySetCompat(): Set<String> = keys().asSequence().toSet()
    }
}
