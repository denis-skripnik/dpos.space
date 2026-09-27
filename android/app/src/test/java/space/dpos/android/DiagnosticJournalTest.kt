package space.dpos.android

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import space.dpos.android.diagnostics.DiagnosticJournal
import java.nio.file.Files
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

class DiagnosticJournalTest {
    @Test fun journalIsBoundedPersistentConcurrentAndSanitizesBeforeDisk() {
        val dir = Files.createTempDirectory("dpos-diagnostic-journal").toFile()
        val journal = DiagnosticJournal(dir, maxBytes = 12_000, rotatedBytes = 3_000)
        val pool = Executors.newFixedThreadPool(8)
        repeat(400) { index -> pool.submit { journal.append("event-$index password=do-not-store") } }
        pool.shutdown()
        assertTrue(pool.awaitTermination(10, TimeUnit.SECONDS))

        val reopened = DiagnosticJournal(dir, maxBytes = 12_000, rotatedBytes = 3_000)
        val report = reopened.readAll()
        assertTrue(report.contains("event-399") || report.contains("event-398"))
        assertFalse(report.contains("do-not-store"))
        dir.listFiles().orEmpty().forEach { file -> assertFalse(file.readText().contains("do-not-store")) }
        assertTrue(report.contains("[redacted]"))
        assertTrue(dir.listFiles().orEmpty().sumOf { it.length() } <= 12_000L)
    }
}
