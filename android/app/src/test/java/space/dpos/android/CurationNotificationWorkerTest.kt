package space.dpos.android

import android.Manifest
import android.app.Notification
import android.app.NotificationManager
import android.content.Context
import androidx.test.core.app.ApplicationProvider
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import space.dpos.android.notifications.*
import space.dpos.android.runtime.AccountImportRequest
import space.dpos.android.runtime.WorkerCommandPolicy
import space.dpos.android.storage.NotificationCursor
import space.dpos.android.storage.WorkerStore
import space.dpos.android.worker.DposWorkerRunner

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class CurationNotificationWorkerTest {
    private lateinit var context: Context
    private lateinit var store: WorkerStore
    private val rows = mutableMapOf<String, List<HistoryEvent>>()
    private val reads = mutableListOf<String>()
    private var load: (String, Long) -> JSONObject? = { chain, _ -> properties(chain) }
    private var onHistory: () -> Unit = {}
    private val manager get() = context.getSystemService(NotificationManager::class.java)
    private fun properties(chain: String) = JSONObject()
        .put(if (chain == "hive") "total_vesting_fund_hive" else "total_vesting_fund_steem", "500.000 ${if (chain == "golos") "GOLOS" else if (chain == "steem") "STEEM" else "HIVE"}")
        .put("total_vesting_shares", "1000.000000 ${if (chain == "golos") "GESTS" else "VESTS"}")
    @Before fun setup() {
        val base = ApplicationProvider.getApplicationContext<Context>()
        awaitNativeStorage()
        context = object : android.content.ContextWrapper(base) {
            private val isolated = java.io.File(base.filesDir, "curation-${java.util.UUID.randomUUID()}").apply { mkdirs() }
            override fun getFilesDir() = isolated
        }
        context.getSharedPreferences("dpos_worker", 0).edit().clear().commit()
        context.getSharedPreferences(NotificationInbox.PREFS_NAME, 0).edit().clear().commit()
        store = WorkerStore(context, context.getSharedPreferences("curation-test-keys", 0))
        assertEquals("verified", store.checkpointStatus().optString("authority"))
        store.setWorkerEnabled(true)
        manager.cancelAll()
        shadowOf(base as android.app.Application).grantPermissions(Manifest.permission.POST_NOTIFICATIONS)
    }
    private fun account(chain: String, name: String = "alice", baseline: Boolean = true) {
        val decision = WorkerCommandPolicy.validateImport(AccountImportRequest(chain, name,
            enableNotifications = true, enableAutoUpvoter = false, explicitConsent = true,
            notificationOps = listOf("curation_reward", "author_reward", "transfer")))
        assertTrue(decision.accepted)
        store.importDecision(decision)
        store.saveCursor(NotificationCursor(chain, name, if (baseline) 8 else -1, baseline))
    }
    private fun reward(name: String = "alice", raw: String = "2.123000 GESTS", index: Long = 9) =
        HistoryEvent(index, "curation_reward", mapOf("curator" to name, "reward" to raw))
    private fun run() = DposWorkerRunner(context, store, historyOverride = { chain -> object : GolosHistoryClient {
        override fun getAccountHistory(account: String, from: Long, limit: Int): List<HistoryEvent> {
            onHistory()
            return rows["$chain:$account"].orEmpty()
        }
    } }, curationPropertiesOverride = { chain, budget -> reads += chain; load(chain, budget) }).runOnce("curation-test")
    private fun summaryText() = manager.activeNotifications.single { it.id == NotificationHelper.EVENT_SUMMARY_NOTIFICATION_ID }
        .notification.extras.getCharSequence(Notification.EXTRA_TEXT).toString()

    @Test fun realScanWorkerHelperPostsPowerAndPreservesRawAcrossAllThreeChains() {
        for ((chain, unit) in listOf("golos" to "СГ", "steem" to "SP", "hive" to "HP")) {
            setup()
            reads.clear(); rows.clear()
            account(chain)
            val raw = if (chain == "golos") "2.123000 GESTS" else "2.123000 VESTS"
            rows["$chain:alice"] = listOf(reward(raw = raw))
            val result = run()
            assertTrue(result.ok)
            assertEquals(1, result.notificationChecks)
            assertEquals(1, result.notificationsShown)
            assertEquals(0, result.autoUpvoterBroadcasted)
            assertEquals(listOf(chain), reads)
            assertTrue(summaryText(), summaryText().contains("≈ +1.062 $unit (по текущему соотношению)"))
            assertFalse(summaryText().contains("VESTS")); assertFalse(summaryText().contains("GESTS"))
            val saved = NotificationInbox(context).snapshot()
            assertEquals(raw, saved.events.single().text)
            assertEquals(1, saved.unreadCount)
            assertFalse(saved.events.single().read)
            assertEquals(9L, store.readCursor(chain, "alice").lastIndex)
            assertTrue(store.readCursor(chain, "alice").baselineDone)
            assertEquals(0, run().notificationsShown)
            assertEquals(listOf(chain), reads)
        }
    }

    @Test fun multipleAccountsAndEventsShareOneRateReadButNewPassRefreshes() {
        account("golos", "alice"); account("golos", "bobby")
        rows["golos:alice"] = listOf(reward(), reward(index = 10))
        rows["golos:bobby"] = listOf(reward("bobby"))
        assertEquals(3, run().notificationsShown)
        assertEquals(listOf("golos"), reads)
        assertEquals(3, NotificationInbox(context).snapshot().unreadCount)
        rows["golos:bobby"] = listOf(reward("bobby", index = 10))
        assertEquals(1, run().notificationsShown)
        assertEquals(listOf("golos", "golos"), reads)
    }

    @Test fun failureMissingAndZeroRateNeverDropEventsOrExposeRawUnits() {
        for (mode in listOf("failure", "missing", "zero")) {
            setup(); reads.clear(); rows.clear()
            account("golos", "alice"); account("golos", "bobby")
            rows["golos:alice"] = listOf(reward())
            rows["golos:bobby"] = listOf(reward("bobby"))
            load = { _, _ -> when (mode) {
                "failure" -> error("rate offline")
                "missing" -> null
                else -> properties("golos").put("total_vesting_shares", "0.000000 GESTS")
            } }
            val result = run()
            assertEquals(2, result.notificationsShown)
            assertEquals(0, result.skipped)
            assertTrue(summaryText().endsWith("Получена кураторская награда"))
            assertEquals(listOf("golos"), reads)
            assertTrue(NotificationInbox(context).snapshot().events.all { it.text == "2.123000 GESTS" })
        }
    }

    @Test fun baselineFilteredNoCurationAndMalformedRewardDoNotFetchRate() {
        account("golos", baseline = false)
        rows["golos:alice"] = listOf(reward())
        assertEquals(0, run().notificationsShown)
        rows["golos:alice"] = listOf(HistoryEvent(10, "author_reward", mapOf("author" to "alice", "vesting_payout" to "2 GESTS")))
        assertEquals(1, run().notificationsShown)
        assertTrue(summaryText().endsWith("2 GESTS"))
        rows["golos:alice"] = listOf(reward(raw = "broken GESTS", index = 11))
        assertEquals(1, run().notificationsShown)
        assertTrue(summaryText().endsWith("Получена кураторская награда"))
        val decision = WorkerCommandPolicy.validateImport(AccountImportRequest("golos", "alice", true, false,
            explicitConsent = true, notificationOps = listOf("transfer"), updateNotifications = true))
        store.importDecision(decision)
        rows["golos:alice"] = listOf(reward(index = 12))
        assertEquals(0, run().notificationsShown)
        assertTrue(reads.isEmpty())
    }

    @Test fun validZeroRewardStillPostsExplicitZeroWithoutInventingATinyPositiveAmount() {
        account("hive")
        rows["hive:alice"] = listOf(reward(raw = "0.000000 VESTS"))
        assertEquals(1, run().notificationsShown)
        assertTrue(summaryText().endsWith("0.000 HP"))
        assertEquals("0.000000 VESTS", NotificationInbox(context).snapshot().events.single().text)
        assertEquals(listOf("hive"), reads)
    }

    @Test fun disabledWorkerOrRevokedNotificationSettingNeverStartsARateRead() {
        account("golos")
        rows["golos:alice"] = listOf(reward())
        store.setWorkerEnabled(false)
        assertEquals(0, run().notificationsShown)
        store.setWorkerEnabled(true)
        store.importDecision(WorkerCommandPolicy.validateImport(AccountImportRequest("golos", "alice", false, false,
            explicitConsent = true, updateNotifications = true)))
        assertEquals(0, run().notificationsShown)
        assertTrue(reads.isEmpty())
        assertTrue(NotificationInbox(context).snapshot().events.isEmpty())
    }

    @Test fun generationCancellationDuringHistoryPreventsRateReadsAndPosting() {
        account("golos")
        rows["golos:alice"] = listOf(reward())
        onHistory = { space.dpos.android.worker.WorkerCancellation.cancelAll(); Unit }
        assertEquals(0, run().notificationsShown)
        assertTrue(reads.isEmpty())
        assertTrue(NotificationInbox(context).snapshot().events.isEmpty())
        assertEquals(8L, store.readCursor("golos", "alice").lastIndex)
    }

    @Test fun stopOrRevocationDuringHistoryOrRatePreventsNewPosts() {
        for (duringRate in listOf(false, true)) for (stop in listOf(false, true)) {
            setup(); reads.clear(); rows.clear(); onHistory = {}
            account("golos")
            rows["golos:alice"] = listOf(reward())
            val revoke = {
                if (stop) store.setWorkerEnabled(false)
                else store.importDecision(WorkerCommandPolicy.validateImport(AccountImportRequest("golos", "alice", false, false,
                    explicitConsent = true, updateNotifications = true)))
            }
            load = { chain, _ -> if (duringRate) revoke(); properties(chain) }
            if (!duringRate) onHistory = revoke
            assertEquals(0, run().notificationsShown)
            assertTrue(manager.activeNotifications.isEmpty())
            assertTrue(NotificationInbox(context).snapshot().events.isEmpty())
            assertEquals(if (duringRate) listOf("golos") else emptyList<String>(), reads)
        }
    }
}
