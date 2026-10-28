package space.dpos.android

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.LooperMode
import space.dpos.android.runtime.AccountImportRequest
import space.dpos.android.runtime.WorkerCommandPolicy
import space.dpos.android.storage.WorkerStore
import space.dpos.android.worker.DposForegroundService
import space.dpos.android.worker.foregroundFullTickDue
import space.dpos.android.upvoter.VIZ_SELF_AWARD_TICK_MS
import java.util.concurrent.atomic.AtomicBoolean

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [28])
@LooperMode(LooperMode.Mode.PAUSED)
class GolosForegroundCadenceTest {
    @Test fun firstFullTickIsImmediateAndVizFullCadenceUsesMonotonicElapsedTime() {
        assertTrue(foregroundFullTickDue(-1, 0))
        assertFalse(foregroundFullTickDue(100, 100 + VIZ_SELF_AWARD_TICK_MS - 1))
        assertTrue(foregroundFullTickDue(100, 100 + VIZ_SELF_AWARD_TICK_MS))
    }
    private fun store(): WorkerStore {
        val context = ApplicationProvider.getApplicationContext<Context>()
        context.getSharedPreferences("dpos_worker", Context.MODE_PRIVATE).edit().clear().commit()
        return WorkerStore(context)
    }
    @Test fun onlyEnabledGolosSelectsFastCadenceAndRevocationRestoresOriginalCadence() {
        val store = store()
        val controller = Robolectric.buildService(DposForegroundService::class.java).create()
        try {
            val service = controller.get()
            val delay = DposForegroundService::class.java.getDeclaredMethod("nextDelay", WorkerStore::class.java).apply { isAccessible = true }
            assertEquals(VIZ_SELF_AWARD_TICK_MS, delay.invoke(service, store))
            store.importDecision(WorkerCommandPolicy.validateImport(AccountImportRequest("viz", "fixture-viz", enableNotifications = false,
                enableAutoUpvoter = false, enableVizSelfAward = true, explicitConsent = true)))
            assertEquals(VIZ_SELF_AWARD_TICK_MS, delay.invoke(service, store))
            store.importDecision(WorkerCommandPolicy.validateImport(AccountImportRequest("golos", "fixture-voter", enableNotifications = false,
                enableAutoUpvoter = true, explicitConsent = true)))
            assertEquals(30_000L, delay.invoke(service, store))
            store.importDecision(WorkerCommandPolicy.validateImport(AccountImportRequest("golos", "fixture-voter", enableNotifications = false,
                enableAutoUpvoter = false, explicitConsent = true, updateAutoUpvoter = true)))
            assertEquals(VIZ_SELF_AWARD_TICK_MS, delay.invoke(service, store))
        } finally { controller.destroy() }
    }
    @Test fun destroyedServiceRejectsStaleBusyCallbackInsteadOfReschedulingAfterStop() {
        val store = store().apply { setWorkerEnabled(true) }
        val controller = Robolectric.buildService(DposForegroundService::class.java).create()
        val service = controller.get()
        controller.destroy()
        awaitNativeStorage()
        val busy = DposForegroundService::class.java.getDeclaredField("tickRunning").apply { isAccessible = true }.get(service) as AtomicBoolean
        busy.set(true) // avoid starting any worker/RPC even in the failing baseline branch
        val tick = DposForegroundService::class.java.getDeclaredField("tick").apply { isAccessible = true }.get(service) as Runnable
        val before = store.exportLogs()
        tick.run()
        assertEquals(before, store.exportLogs())
        assertFalse(DposForegroundService.isRunning)
    }
}
