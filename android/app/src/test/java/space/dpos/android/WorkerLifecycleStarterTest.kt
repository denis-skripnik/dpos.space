package space.dpos.android

import android.content.Context
import android.content.Intent
import androidx.test.core.app.ApplicationProvider
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import space.dpos.android.storage.WorkerStore
import space.dpos.android.worker.DposForegroundService

@RunWith(RobolectricTestRunner::class)
class WorkerLifecycleStarterTest {
    private lateinit var context: Context

    @Before fun clearState() {
        context = ApplicationProvider.getApplicationContext()
        context.getSharedPreferences("dpos_worker", Context.MODE_PRIVATE).edit().clear().commit()
    }

    @Test fun coldAndWarmOpenResumeEnabledFeatureWithoutAutoStartAndAvoidDuplicates() {
        configureAccount(enabled = true, notifications = true, autoStart = false)
        WorkerStore(context).setWorkerEnabled(true)
        var now = 1_000L
        var running = false
        val starts = mutableListOf<Intent>()
        val starter = WorkerLifecycleStarter(
            elapsedRealtime = { now },
            serviceRunning = { running },
            serviceStarter = { _, intent -> starts += intent }
        )

        assertTrue(starter.resume(context, "cold app open"))
        assertTrue(WorkerStore(context).workerEnabled())
        assertEquals(DposForegroundService.ACTION_START, starts.single().action)

        assertFalse(starter.resume(context, "app foregrounded"))
        running = true
        now += 20_000L
        assertFalse(starter.resume(context, "app foregrounded"))

        running = false
        assertTrue(starter.resume(context, "app foregrounded"))
        assertEquals(2, starts.size)
    }

    @Test fun disabledRecordsAndAccountsWithoutEnabledFeaturesStayOff() {
        configureAccount(enabled = false, notifications = true, autoStart = false)
        val starts = mutableListOf<Intent>()
        val starter = WorkerLifecycleStarter(serviceRunning = { false }, serviceStarter = { _, intent -> starts += intent })

        assertFalse(starter.resume(context, "cold app open"))
        assertFalse(WorkerStore(context).workerEnabled())

        configureAccount(enabled = true, notifications = false, autoStart = true)
        assertFalse(starter.resume(context, "app foregrounded"))
        assertTrue(starts.isEmpty())
    }

    @Test fun stoppedWorkerWithSavedEnabledAccountIsNotResumed() {
        configureAccount(enabled = true, notifications = true, autoStart = false)
        val starts = mutableListOf<Intent>()
        val starter = WorkerLifecycleStarter(serviceRunning = { false }, serviceStarter = { _, intent -> starts += intent })
        assertFalse(starter.resume(context, "open after explicit stop"))
        assertFalse(WorkerStore(context).workerEnabled())
        assertTrue(starts.isEmpty())
    }

    @Test fun rejectedServiceStartPreservesSettingsAndCanRetryWithoutCrashingTheApp() {
        configureAccount(enabled = true, notifications = true, autoStart = false)
        WorkerStore(context).setWorkerEnabled(true)
        var rejected = true
        val starter = WorkerLifecycleStarter(serviceRunning = { false }, serviceStarter = { _, _ ->
            if (rejected) throw SecurityException("fixture foreground service restriction")
        })
        assertFalse(starter.resume(context, "cold app open"))
        val store = WorkerStore(context)
        assertTrue(store.workerEnabled())
        assertTrue(store.notificationEnabled("viz", "alice"))
        assertTrue(store.exportLogs().contains("worker resume failed"))
        rejected = false
        assertTrue(starter.resume(context, "app foregrounded"))
    }

    private fun configureAccount(enabled: Boolean, notifications: Boolean, autoStart: Boolean) {
        val account = "alice"
        val chain = "viz"
        val accounts = JSONArray().put(
            JSONObject().put("chainId", chain).put("account", account).put("enabled", enabled)
        )
        context.getSharedPreferences("dpos_worker", Context.MODE_PRIVATE).edit()
            .clear()
            .putString("accounts", accounts.toString())
            .putBoolean("notify:$chain:$account", notifications)
            .putBoolean("autoStart:$chain:$account", autoStart)
            .apply()
    }
}