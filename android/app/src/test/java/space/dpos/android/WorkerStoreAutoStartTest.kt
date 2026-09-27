package space.dpos.android

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import space.dpos.android.runtime.AccountImportRequest
import space.dpos.android.runtime.WorkerCommandPolicy
import space.dpos.android.storage.WorkerStore

@RunWith(RobolectricTestRunner::class)
class WorkerStoreAutoStartTest {
    @Test fun notificationOpsPreserveLegacyDefaultsAndExplicitEmptySelection() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val prefs = context.getSharedPreferences("dpos_worker", Context.MODE_PRIVATE)
        prefs.edit().clear().commit()
        val store = WorkerStore(context, context.getSharedPreferences("dpos_worker_secure_ops_test", Context.MODE_PRIVATE))
        assertTrue(store.notificationOps("golos", "legacy").isNotEmpty())

        store.importDecision(WorkerCommandPolicy.validateImport(AccountImportRequest("golos", "none", enableNotifications = true, enableAutoUpvoter = false, explicitConsent = true, notificationOps = emptyList())))
        assertEquals(emptyList<String>(), store.notificationOps("golos", "none"))
    }

    @Test fun autoStartRequiresEnabledStoredServiceAccount() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        context.getSharedPreferences("dpos_worker", Context.MODE_PRIVATE).edit().clear().commit()
        val securePrefs = context.getSharedPreferences("dpos_worker_secure_autostart_test", Context.MODE_PRIVATE)
        val store = WorkerStore(context, securePrefs)
        assertFalse(store.hasAutoStartAccounts())

        val noAuto = WorkerCommandPolicy.validateImport(AccountImportRequest("golos", "denis", enableNotifications = false, enableAutoUpvoter = true, autoStart = false, explicitConsent = true))
        store.importDecision(noAuto)
        assertFalse(store.hasAutoStartAccounts())

        val yesAuto = WorkerCommandPolicy.validateImport(AccountImportRequest("viz", "denis", enableNotifications = false, enableAutoUpvoter = false, enableVizSelfAward = true, autoStart = true, explicitConsent = true))
        store.importDecision(yesAuto)
        assertTrue(store.hasAutoStartAccounts())
    }
}
