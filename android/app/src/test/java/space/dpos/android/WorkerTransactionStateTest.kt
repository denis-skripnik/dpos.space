package space.dpos.android

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Assert.assertFalse
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import space.dpos.android.storage.WorkerStore
import space.dpos.android.upvoter.PendingBroadcastIntent
import space.dpos.android.upvoter.PendingBroadcastState
import space.dpos.android.runtime.AccountImportRequest
import space.dpos.android.runtime.WorkerCommandPolicy

@RunWith(RobolectricTestRunner::class)
class WorkerTransactionStateTest {
    @Test fun golosDonationConsentPendingAndReceiptPersistButHiveCannotImportIt() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        context.getSharedPreferences("dpos_worker", Context.MODE_PRIVATE).edit().clear().commit()
        val secure = context.getSharedPreferences("dpos_worker_secure_donate_test", Context.MODE_PRIVATE)
        secure.edit().clear().commit()
        val first = WorkerStore(context, secure)
        assertEquals(null, first.autoDonatePool("golos", "denis"))
        first.importDecision(WorkerCommandPolicy.validateImport(AccountImportRequest("golos", "denis",
            enableNotifications = false, enableAutoUpvoter = true, autoDonate = true, autoDonatePool = "10 1.1", explicitConsent = true)))
        first.savePending(PendingBroadcastIntent("donate", "golos", "denis", "fingerprint|alice|post|1.000 GOLOS|0.002 GOLOS", 101, PendingBroadcastState.UNKNOWN))
        first.markDonated("denis", "completed-post")
        val relaunched = WorkerStore(context, secure)
        assertEquals("10 1.1", relaunched.autoDonatePool("golos", "denis"))
        assertEquals(null, relaunched.autoDonatePool("hive", "denis"))
        assertTrue(relaunched.donated("denis", "completed-post"))
        assertEquals(101L, relaunched.readPending("donate", "golos", "denis")!!.historyBaseline)
        relaunched.importDecision(WorkerCommandPolicy.validateImport(AccountImportRequest("golos", "denis",
            enableNotifications = false, enableAutoUpvoter = true, autoDonate = false, explicitConsent = true)))
        assertEquals(null, WorkerStore(context, secure).autoDonatePool("golos", "denis"))
        assertFalse(WorkerCommandPolicy.validateImport(AccountImportRequest("hive", "denis",
            enableNotifications = false, enableAutoUpvoter = true, autoDonate = true, autoDonatePool = "10 1", explicitConsent = true)).accepted)
    }
    @Test fun pendingUnknownSurvivesStoreRecreationAndCursorNeverRegresses() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        context.getSharedPreferences("dpos_worker", Context.MODE_PRIVATE).edit().clear().commit()
        val secure = context.getSharedPreferences("dpos_worker_secure_transaction_test", Context.MODE_PRIVATE)
        secure.edit().clear().commit()
        val first = WorkerStore(context, secure)
        first.savePending(PendingBroadcastIntent("self_award", "viz", "alice", "10|memo", 41, PendingBroadcastState.UNKNOWN))
        first.saveAutoVoteSourceCursor("golos", "curator", 12)
        first.saveAutoVoteSourceCursor("golos", "curator", 7)

        val relaunched = WorkerStore(context, secure)
        val pending = relaunched.readPending("self_award", "viz", "alice")
        assertNotNull(pending)
        assertEquals(PendingBroadcastState.UNKNOWN, pending!!.state)
        assertEquals(41, pending.historyBaseline)
        assertEquals(12, relaunched.autoVoteSourceCursor("golos", "curator"))
    }
}
