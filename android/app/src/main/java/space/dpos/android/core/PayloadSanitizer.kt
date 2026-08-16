package space.dpos.android.core

object PayloadSanitizer {
    private val secretPattern = Regex("(?i)(private|wif|seed|mnemonic|password|token|secret|key)")
    private val wifLike = Regex("[5KL][1-9A-HJ-NP-Za-km-z]{40,}")

    fun text(value: String?, max: Int = 180): String = value.orEmpty()
        .replace(Regex("[\u0000-\u001f\u007f]"), " ")
        .replace(wifLike, "[redacted]")
        .trim()
        .take(max)

    fun tag(value: String?): String = text(value, 48).ifBlank { "dpos-space" }

    fun redactLog(line: String): String = line
        .lines()
        .joinToString("\n") { rawLine ->
            rawLine.split(' ', '	').joinToString(" ") { token ->
                when {
                    secretPattern.containsMatchIn(token.substringBefore('=')) -> "${token.substringBefore('=')}=[redacted]"
                    wifLike.matches(token) -> "[redacted]"
                    else -> token
                }
            }
        }
        .takeLast(8000)
}
