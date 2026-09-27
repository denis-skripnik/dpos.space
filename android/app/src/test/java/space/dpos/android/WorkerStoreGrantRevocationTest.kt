package space.dpos.android

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import space.dpos.android.runtime.AccountImportRequest
import space.dpos.android.runtime.WorkerCommandPolicy
import space.dpos.android.runtime.WorkerSettingsCodec
import space.dpos.android.storage.AutoUpvoterGrantState
import space.dpos.android.storage.WorkerStore

@RunWith(RobolectricTestRunner::class)
class WorkerStoreGrantRevocationTest {
    @Test fun notificationOnlyUpdatesCanDisableNotificationsWithoutChangingOtherFunctions() {
        val store = freshStore("notification-partial")
        store.importDecision(WorkerCommandPolicy.validateImport(AccountImportRequest(
            "golos", "alice", enableNotifications = true, enableAutoUpvoter = true,
            explicitConsent = true
        )))

        val disabled = WorkerSettingsCodec.decodeImport("""{"chainId":"golos","account":"alice","enableNotifications":false,"explicitConsent":true}""")
        assertTrue(disabled.accepted)
        store.importDecision(disabled)

        assertFalse(store.notificationEnabled("golos", "alice"))
        assertTrue(store.autoUpvoterEnabled("golos", "alice"))
        assertTrue(store.activeAccounts().any { it.chainId == "golos" && it.account == "alice" })
    }

    @Test fun disabledSettingsStayDisabledAndDoNotEnableAnAccountOnPageVisitStyleSync() {
        val store = freshStore("disabled-stays-disabled")
        val disabled = WorkerSettingsCodec.decodeImport("""{"chainId":"golos","account":"visitor","enableNotifications":false,"explicitConsent":true}""")
        assertTrue(disabled.accepted)

        store.importDecision(disabled)

        assertFalse(store.notificationEnabled("golos", "visitor"))
        assertFalse(store.autoUpvoterEnabled("golos", "visitor"))
        assertFalse(store.activeAccounts().any { it.chainId == "golos" && it.account == "visitor" })
    }

    @Test fun fullStateSyncDisablesMissingUpvotersWithoutChangingOtherFeaturesOrDeletingKeys() {
        val store = freshStore("preserve")
        store.importDecision(WorkerCommandPolicy.validateImport(AccountImportRequest(
            "golos", "alice", enableNotifications = true, enableAutoUpvoter = true,
            explicitConsent = true
        )))
        store.importDecision(WorkerCommandPolicy.validateImport(AccountImportRequest(
            "viz", "alice", enableNotifications = false, enableAutoUpvoter = false,
            enableVizSelfAward = true, explicitConsent = true
        )))
        val keyRef = store.defaultPostingKeyRef("golos", "alice")
        store.saveEncryptedKeyRef(keyRef, "fixture-not-a-real-key")

        store.syncAutoUpvoterGrants(emptyList())

        assertFalse(store.autoUpvoterEnabled("golos", "alice"))
        assertTrue(store.notificationEnabled("golos", "alice"))
        assertTrue(store.vizSelfAwardEnabled("viz", "alice"))
        assertTrue(store.hasEncryptedKey(keyRef))
        assertTrue(store.activeAccounts().any { it.chainId == "viz" && it.account == "alice" })
    }

    @Test fun explicitGrantRemovalDeletesOnlyPostingKeyAndPreservesAccountServices() {
        val store = freshStore("remove")
        store.importDecision(WorkerCommandPolicy.validateImport(AccountImportRequest(
            "golos", "alice", enableNotifications = true, enableAutoUpvoter = true,
            explicitConsent = true
        )))
        val posting = store.defaultPostingKeyRef("golos", "alice")
        val regular = store.defaultRegularKeyRef("golos", "alice")
        store.saveEncryptedKeyRef(posting, "fixture-posting")
        store.saveEncryptedKeyRef(regular, "fixture-regular")

        store.syncAutoUpvoterGrants(listOf(AutoUpvoterGrantState("golos", "alice", enabled = false, removeGrant = true)))

        assertFalse(store.hasEncryptedKey(posting))
        assertTrue(store.hasEncryptedKey(regular))
        assertTrue(store.notificationEnabled("golos", "alice"))
    }

    private fun freshStore(name: String): WorkerStore {
        val context = ApplicationProvider.getApplicationContext<Context>()
        context.getSharedPreferences("dpos_worker", Context.MODE_PRIVATE).edit().clear().commit()
        val secure = context.getSharedPreferences("dpos_worker_secure_grants_$name", Context.MODE_PRIVATE)
        secure.edit().clear().commit()
        return WorkerStore(context, secure)
    }
}
