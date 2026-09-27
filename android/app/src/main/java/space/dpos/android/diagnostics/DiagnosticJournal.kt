package space.dpos.android.diagnostics

import android.content.Context
import java.io.File
import java.nio.charset.StandardCharsets

/** App-private, process-thread-safe bounded journal. Failures are intentionally non-fatal to worker actions. */
class DiagnosticJournal(
    private val directory: File,
    private val maxBytes: Int = DEFAULT_MAX_BYTES,
    private val rotatedBytes: Int = DEFAULT_ROTATED_BYTES
) {
    constructor(context: Context) : this(File(context.filesDir, "diagnostics"))

    private val active = File(directory, "native.log")
    private val rotated = File(directory, "native.log.1")

    fun append(message: String, level: String = "info", now: Long = System.currentTimeMillis()) {
        runCatching {
            val line = "$now [${safeLevel(level)}] ${DiagnosticSanitizer.sanitize(message, MAX_EVENT_CHARS)}\n"
            val bytes = line.toByteArray(StandardCharsets.UTF_8)
            synchronized(lock) {
                directory.mkdirs()
                val activeLimit = (maxBytes - rotatedBytes).coerceAtLeast(1)
                if (active.length() + bytes.size > activeLimit) rotate(activeLimit)
                active.appendBytes(if (bytes.size <= activeLimit) bytes else bytes.copyOfRange(bytes.size - activeLimit, bytes.size))
                trimFile(active, activeLimit)
                trimFile(rotated, rotatedBytes.coerceAtMost(maxBytes))
            }
        }
    }

    fun readAll(): String = runCatching {
        synchronized(lock) {
            listOf(rotated, active).filter(File::isFile).joinToString("") { it.readText() }
        }
    }.getOrDefault("")

    private fun rotate(activeLimit: Int) {
        if (!active.isFile) return
        val keep = active.readBytes().takeLastBytes(rotatedBytes.coerceAtMost(maxBytes))
        rotated.writeBytes(keep)
        active.writeBytes(byteArrayOf())
        trimFile(active, activeLimit)
    }

    private fun trimFile(file: File, limit: Int) {
        if (!file.isFile || file.length() <= limit) return
        file.writeBytes(file.readBytes().takeLastBytes(limit))
    }

    private fun ByteArray.takeLastBytes(limit: Int): ByteArray =
        if (size <= limit) this else copyOfRange(size - limit, size)

    private fun safeLevel(level: String): String = level.lowercase().filter { it.isLetter() }.take(12).ifBlank { "info" }

    companion object {
        const val DEFAULT_MAX_BYTES = 512 * 1024
        const val DEFAULT_ROTATED_BYTES = 128 * 1024
        private const val MAX_EVENT_CHARS = 16_000
        private val lock = Any()
    }
}
