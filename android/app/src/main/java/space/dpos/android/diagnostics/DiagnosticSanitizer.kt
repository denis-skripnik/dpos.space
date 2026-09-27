package space.dpos.android.diagnostics

import org.bitcoinj.crypto.MnemonicCode
import org.json.JSONArray
import org.json.JSONObject
import org.json.JSONTokener
import java.net.URI

/** No diagnostic is persisted before this boundary. Never pass signing payloads to a logger. */
object DiagnosticSanitizer {
    private val field = Regex("(?i)(private|wif|seed|mnemonic|password|passphrase|token|secret|signed|signature|raw.?tx|raw.?transaction|transaction|payload|api.?key|access.?key|credential|authorization|cookie|^key$|^operations$|^trx$|^tx$|^posting$|^active$|^regular$|^ct$)")
    private val assignment = Regex("(?i)\\b(private[_-]?key|private|wif|seed|mnemonic|password|passphrase|token|secret|api[_-]?key|access[_-]?key|authorization|cookie|signed[_-]?(?:transaction|tx)|raw[_-]?(?:transaction|tx))\\s*[=:]\\s*(\"(?:\\\\.|[^\"])*\"|'[^']*'|[^\\s,;]+)")
    private val wif = Regex("(?<![1-9A-HJ-NP-Za-km-z])[5KL][1-9A-HJ-NP-Za-km-z]{40,}(?![1-9A-HJ-NP-Za-km-z])")
    private val hex = Regex("(?i)\\b(?:0x)?[0-9a-f]{64,}\\b")
    private val words = Regex("[A-Za-z]+")
    private val dictionary by lazy { MnemonicCode.INSTANCE.wordList.toHashSet() }

    fun sanitize(value: String?, maxChars: Int = 80_000): String = try {
        fragments(value.orEmpty().replace(Regex("[\\u0000-\\u0008\\u000b\\u000c\\u000e-\\u001f\\u007f]"), " "), 0).take(maxChars.coerceAtLeast(0))
    } catch (_: Exception) { "[diagnostic omitted: sanitization failed]" }

    private fun json(value: Any?, depth: Int): Any? {
        if (depth > 30) return "[nested diagnostic omitted]"
        return when (value) {
            is JSONObject -> JSONObject().also { out -> value.keys().forEach { key -> out.put(plain(key), if (field.containsMatchIn(key)) "[redacted]" else json(value.opt(key), depth + 1)) } }
            is JSONArray -> JSONArray().also { out -> for (i in 0 until value.length()) out.put(json(value.opt(i), depth + 1)) }
            is String -> fragments(value, depth + 1)
            else -> value
        }
    }

    // RPC errors often embed a JSON object after an ordinary text prefix.
    private fun fragments(text: String, depth: Int): String {
        if (depth > 30) return "[nested diagnostic omitted]"
        val out = StringBuilder(); var i = 0
        val plainText = StringBuilder()
        fun flushPlain() { if (plainText.isNotEmpty()) { out.append(plain(plainText.toString())); plainText.setLength(0) } }
        while (i < text.length) {
            if (text[i] != '{' && text[i] != '[') { plainText.append(text[i++]); continue }
            flushPlain()
            var end = i; var nesting = 0; var quoted = false; var escaped = false
            while (end < text.length) {
                val ch = text[end++]
                if (quoted) {
                    if (escaped) escaped = false else if (ch == '\\') escaped = true else if (ch == '"') quoted = false
                } else when (ch) {
                    '"' -> quoted = true
                    '{', '[' -> nesting++
                    '}', ']' -> { nesting--; if (nesting == 0) break }
                }
            }
            val part = text.substring(i, end)
            val parsed = if (nesting == 0) runCatching { JSONTokener(part).nextValue() }.getOrNull() else null
            if (parsed is JSONObject || parsed is JSONArray) out.append(json(parsed, depth + 1).toString())
            else if (Regex("(?i)(signed.?transaction|raw.?transaction|signatures|operations)\\\"?\\s*:").containsMatchIn(part)) out.append("[malformed transaction diagnostic omitted]")
            else out.append(plain(part))
            i = end
        }
        flushPlain()
        return out.toString()
    }

    private fun plain(input: String): String {
        var text = input.replace(Regex("(?s)-----BEGIN [^-]*PRIVATE KEY[^-]*-----.*?-----END [^-]*-----"), "[redacted]")
        val tokens = words.findAll(text).toList()
        val ranges = mutableListOf<IntRange>(); var skipUntil = -1
        for (start in tokens.indices) {
            if (tokens[start].range.first <= skipUntil) continue
            for (size in listOf(24, 21, 18, 15, 12)) {
                if (start + size > tokens.size) continue
                val window = tokens.subList(start, start + size)
                val phrase = window.map { it.value.lowercase() }
                if (!phrase.all(dictionary::contains)) continue
                if (window.zipWithNext().any { (a, b) -> !text.substring(a.range.last + 1, b.range.first).matches(Regex("\\s+")) }) continue
                if (runCatching { MnemonicCode.INSTANCE.check(phrase) }.isSuccess) {
                    val range = window.first().range.first..window.last().range.last
                    ranges.add(range); skipUntil = range.last; break
                }
            }
        }
        ranges.asReversed().forEach { text = text.replaceRange(it, "[redacted]") }
        text = text.replace(Regex("(?i)\\bBearer\\s+[^\\s\"',;]+"), "Bearer [redacted]")
        text = assignment.replace(text) { "${it.groupValues[1]}=[redacted]" }
        text = Regex("https?://[^\\s\"<>]+").replace(text) { match ->
            runCatching { URI(match.value).let { "${it.scheme}://${it.host ?: "[host]"}" } }.getOrDefault("[url]")
        }
        return hex.replace(wif.replace(text, "[redacted]"), "[redacted]")
    }
}
