package space.dpos.android

import android.app.Activity
import android.app.Service
import android.content.Context
import android.content.ContextWrapper
import android.content.Intent
import android.content.SharedPreferences
import androidx.test.core.app.ApplicationProvider
import androidx.work.Configuration
import androidx.work.WorkManager
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import org.junit.Before
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf
import org.robolectric.shadows.ShadowLog
import org.robolectric.util.ReflectionHelpers
import space.dpos.android.bridge.BridgeRequest
import space.dpos.android.bridge.DposAndroidBridge
import space.dpos.android.storage.TransactionCheckpointStore
import space.dpos.android.storage.WorkerStore
import space.dpos.android.worker.DposForegroundService
import space.dpos.android.worker.WorkerCancellation
import java.io.File
import java.util.UUID
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

@RunWith(RobolectricTestRunner::class)
class CheckpointEntrypointTest {
    @Before fun initializeWorkManager() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        if (runCatching { WorkManager.getInstance(context) }.isFailure) {
            WorkManager.initialize(context, Configuration.Builder().build())
        }
    }
    private class CountingPrefs(private val delegate: SharedPreferences) : SharedPreferences by delegate {
        var writes = 0
        override fun edit(): SharedPreferences.Editor { writes++; return delegate.edit() }
    }
    private fun fixture(missingAuthority: Boolean): Pair<WorkerStore, CountingPrefs> {
        val base = ApplicationProvider.getApplicationContext<Context>()
        val name = "entrypoint-${UUID.randomUUID()}"
        val dir = File(base.filesDir, name).apply { mkdirs() }
        val ctx = object : ContextWrapper(base) {
            override fun getFilesDir() = dir
            override fun getApplicationContext(): Context = this
        }
        val raw = base.getSharedPreferences(name, Context.MODE_PRIVATE)
        // Deliberately poisoned legacy evidence must never be flushed by incidental logging.
        raw.edit().putString("pendingTransaction:self_award:viz:alice", "{broken").commit()
        val prefs = CountingPrefs(raw)
        val checkpoint = if (missingAuthority) {
            TransactionCheckpointStore(File(dir, "transaction-checkpoint"), prefs)
            File(dir, "transaction-checkpoint/transactions.json").delete()
            TransactionCheckpointStore(File(dir, "transaction-checkpoint"), prefs)
        } else TransactionCheckpointStore(File(dir, "transaction-checkpoint"), prefs) { stage, _ ->
            if (stage == "backup:sync") throw java.io.IOException("injected backup failure")
        }
        prefs.writes = 0
        return WorkerStore(ctx, prefs, prefs, checkpoint) to prefs
    }
    @Test fun failedBackupDispatchStillCompletesDiagnosticsStatusStopAndErrors() = dispatchScenario(false)
    @Test fun missingAuthorityDispatchStillCompletesDiagnosticsStatusStopAndErrors() = dispatchScenario(true)
    private fun dispatchScenario(missing: Boolean) {
        val (store, prefs) = fixture(missing)
        val activity = Robolectric.buildActivity(Activity::class.java).setup().get()
        var saveCallback: ((JSONObject) -> Unit)? = null
        val bridge = DposAndroidBridge(activity, store, diagnosticSaver = { _, callback ->
            saveCallback = callback
        }) { JSONObject().put("checkpoint", store.checkpointStatus()) }
        fun call(method: String): JSONObject {
            val done = CountDownLatch(1); var result: JSONObject? = null; var count = 0
            bridge.dispatch(BridgeRequest(method, method, JSONObject())) { result = it; count++; done.countDown() }
            if (method == "saveDiagnosticLog") {
                assertEquals(null, result)
                saveCallback!!(JSONObject().put("ok", false).put("cancelled", true))
            }
            assertTrue("missing callback for $method", done.await(5, TimeUnit.SECONDS))
            assertEquals(1, count)
            return result!!
        }
        try {
            assertTrue(call("getDiagnosticReport").getBoolean("ok"))
            store.appendLog("unverified entrypoint fixture")
            assertTrue(store.exportDiagnosticJournal().contains("unverified entrypoint fixture"))
            assertTrue(call("getWorkerStatus").getBoolean("ok"))
            assertTrue(call("saveDiagnosticLog").getJSONObject("result").getBoolean("cancelled"))
            val permit = WorkerCancellation.token { true }
            assertFalse(call("stopWorker").getBoolean("ok")) // Persistence refused, cancellation still mandatory.
            assertFalse(permit.mayContinue())
            assertFalse(call("startWorker").getBoolean("ok"))
            assertFalse(call("unsupported_fixture").getBoolean("ok"))
            assertEquals(0, prefs.writes)
            assertEquals("storage_unverified", store.checkpointStatus().getString("authority"))
        } finally { bridge.close() }
    }

    @Test fun missingAuthorityServiceCreateStickyRestartAndDestroyAreFailClosed() {
        serviceLifecycle(true)
    }
    @Test fun failedBackupServiceCreateStickyRestartAndDestroyAreFailClosed() {
        serviceLifecycle(false)
    }
    private fun serviceLifecycle(missingAuthority: Boolean) {
        val base = ApplicationProvider.getApplicationContext<Context>()
        val prefs = base.getSharedPreferences("dpos_worker", Context.MODE_PRIVATE)
        if (missingAuthority) {
            val store = WorkerStore(base, prefs, prefs)
            store.setWorkerEnabled(true)
            File(base.filesDir, "transaction-checkpoint/transactions.json").delete()
        } else {
            prefs.edit().putBoolean("worker_enabled", true).putString("pendingTransaction:self_award:viz:alice", "{broken").commit()
            val dir = File(base.filesDir, "transaction-checkpoint")
            dir.deleteRecursively()
            dir.writeText("backup parent is not a directory") // AtomicFile backup startWrite must fail physically.
        }
        val before = prefs.all.toMap()
        val permit = WorkerCancellation.token { true }
        val controller = Robolectric.buildService(DposForegroundService::class.java)
        val counted = CountingPrefs(prefs)
        val attached = controller.get().baseContext
        ReflectionHelpers.setField(controller.get(), "mBase", object : ContextWrapper(attached) {
            override fun getSharedPreferences(name: String, mode: Int): SharedPreferences =
                if (name == "dpos_worker") counted else super.getSharedPreferences(name, mode)
        })
        val service = controller.create().get()
        assertTrue(shadowOf(service).isLastForegroundNotificationAttached)
        assertEquals(Service.START_NOT_STICKY, service.onStartCommand(null, 0, 1))
        assertTrue(shadowOf(service).isStoppedBySelf)
        assertFalse(permit.mayContinue())
        assertEquals(Service.START_NOT_STICKY, service.onStartCommand(Intent(base, DposForegroundService::class.java)
            .setAction(DposForegroundService.ACTION_CHECK_NOW), 0, 2))
        assertEquals(Service.START_NOT_STICKY, service.onStartCommand(Intent(base, DposForegroundService::class.java)
            .setAction(DposForegroundService.ACTION_STOP), 0, 3))
        shadowOf(android.os.Looper.getMainLooper()).idle()
        assertEquals(null, WorkerStore(base).lastTick()) // No worker thread admitted, no transport.
        controller.destroy()
        assertFalse(DposForegroundService.isRunning)
        assertTrue(shadowOf(service).isForegroundStopped)
        assertEquals(before, prefs.all)
        assertEquals(0, counted.writes)
    }

    @Test fun journalFailureFallsBackToSanitizedLogcatWithoutPreferenceFlush() {
        val base = ApplicationProvider.getApplicationContext<Context>()
        val dir = File(base.filesDir, "log-failure-${UUID.randomUUID()}").apply { mkdirs() }
        val ctx = object : ContextWrapper(base) {
            override fun getFilesDir() = dir
            override fun getApplicationContext(): Context = this
        }
        val raw = base.getSharedPreferences(dir.name, Context.MODE_PRIVATE)
        val prefs = CountingPrefs(raw)
        val checkpoint = TransactionCheckpointStore(File(dir, "transaction-checkpoint"), prefs) { stage, _ ->
            if (stage == "backup:sync") throw java.io.IOException("injected")
        }
        File(dir, "diagnostics").writeText("not a directory")
        prefs.writes = 0
        val store = WorkerStore(ctx, prefs, prefs, checkpoint)
        store.appendLog("fallback password=entrypoint-secret", "error")
        val logs = ShadowLog.getLogsForTag("DposWorker").joinToString("\n") { it.msg }
        assertTrue(logs.contains("fallback"))
        assertFalse(logs.contains("entrypoint-secret"))
        assertEquals(0, prefs.writes)
    }
}
