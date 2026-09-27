package space.dpos.android.diagnostics

import space.dpos.android.storage.WorkerStore
import java.time.Instant

object DiagnosticReportBuilder {
    fun build(store: WorkerStore, versionName: String, versionCode: Int, now: Long = System.currentTimeMillis()): String {
        val accounts = store.readAccounts()
        val accountLines = if (accounts.isEmpty()) "(none)" else accounts.joinToString("\n") { identity ->
            val chain = DiagnosticSanitizer.sanitize(identity.chainId, 40)
            val account = DiagnosticSanitizer.sanitize(identity.account, 80)
            "$chain:$account active=${identity.enabled} notifications=${store.notificationEnabled(identity.chainId, identity.account)} " +
                "autoUpvoter=${store.autoUpvoterEnabled(identity.chainId, identity.account)} vizSelfAward=${store.vizSelfAwardEnabled(identity.chainId, identity.account)} " +
                "autoStart=${store.autoStartEnabled(identity.chainId, identity.account)} hasPostingKey=${store.hasPostingKey(identity.chainId, identity.account)} " +
                "hasRegularKey=${store.hasRegularKey(identity.chainId, identity.account)}" +
                (if (identity.chainId == "golos") " donateNative=${store.golosDonateState(identity.account)}" else "") +
                (if (identity.chainId == "golos" || identity.chainId == "viz") " pending=" +
                    listOfNotNull(
                        if (identity.chainId == "golos") store.pendingDiagnostics("vote", "golos", identity.account, now) else null,
                        if (identity.chainId == "golos") store.pendingDiagnostics("donate", "golos", identity.account, now) else null,
                        if (identity.chainId == "viz") store.pendingDiagnostics("self_award", "viz", identity.account, now) else null
                    ).joinToString(",") else "")
        }
        val lastRun = store.exportLastRunSummary()?.toString(2) ?: "(none)"
        val events = store.exportDiagnosticJournal().ifBlank { "(none)\n" }
        val legacy = store.exportLogs().ifBlank { "(none)" }
        return DiagnosticSanitizer.sanitize(
            """DPoS Space Android diagnostic report
Generated: ${Instant.ofEpochMilli(now)}
Version: $versionName ($versionCode)
Worker enabled: ${store.workerEnabled()}
Foreground service running: ${space.dpos.android.worker.DposForegroundService.isRunning}
Stored accounts: ${accounts.size}
Enabled accounts: ${accounts.count { it.enabled }}
Native journal retention: bounded to ${DiagnosticJournal.DEFAULT_MAX_BYTES} bytes; older events may have rotated out.
Last tick: ${store.lastTick() ?: "none"}
Next tick: ${store.nextTick() ?: "none"}

Stored accounts and flags:
$accountLines

Last run summary:
$lastRun

Persistent native journal:
$events
Legacy short worker status log:
$legacy
""", Int.MAX_VALUE)
    }

    fun combine(nativeReport: String, webReport: String?): String =
        DiagnosticSanitizer.sanitize(nativeReport, Int.MAX_VALUE) +
            "\nWeb diagnostic report (sanitized, max 80000 chars):\n" +
            DiagnosticSanitizer.sanitize(webReport, 80_000) + "\n"
}
