package space.dpos.android

import android.app.Activity
import android.content.Context
import androidx.test.core.app.ApplicationProvider
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import space.dpos.android.bridge.BridgeRequest
import space.dpos.android.bridge.DposAndroidBridge
import space.dpos.android.storage.WorkerStore
import space.dpos.android.storage.AutoUpvoterGrantState
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

@RunWith(RobolectricTestRunner::class)
class GolosDonateUpgradeMigrationTest {
    private lateinit var context: Context
    private lateinit var store: WorkerStore

    @Before fun setup() {
        context = ApplicationProvider.getApplicationContext()
        context.getSharedPreferences("dpos_worker", Context.MODE_PRIVATE).edit().clear().commit()
        store = WorkerStore(context, context.getSharedPreferences("upgrade-migration-secure", Context.MODE_PRIVATE))
    }

    private fun legacyGrant(chain: String = "golos", account: String = "alice", active: Boolean = true, upvoter: Boolean = true, worker: Boolean = true) {
        val prefs = context.getSharedPreferences("dpos_worker", Context.MODE_PRIVATE)
        prefs.edit().putString("accounts", JSONArray().put(JSONObject()
            .put("chainId", chain).put("account", account).put("enabled", active)).toString())
            .putBoolean("upvoter:$chain:$account", upvoter)
            .putBoolean("notify:$chain:$account", true)
            .putString("favorites:$chain:$account", "[\"curator\"]")
            .putBoolean("worker_enabled", worker).commit()
    }

    private fun dispatch(account: String = "alice", pool: String = "10 1.1"): JSONObject {
        val activity = Robolectric.buildActivity(Activity::class.java).setup().get()
        val bridge = DposAndroidBridge(activity, store) { JSONObject() }
        return try {
            val latch = CountDownLatch(1)
            var reply: JSONObject? = null
            bridge.dispatch(BridgeRequest("upgrade", "migrateGolosDonateSettings", JSONObject()
                .put("account", account).put("pool", pool))) { reply = it; latch.countDown() }
            assertTrue(latch.await(5, TimeUnit.SECONDS))
            assertTrue(reply.toString(), reply!!.getBoolean("ok"))
            reply!!.getJSONObject("result")
        } finally { bridge.close() }
    }

    @Test fun existingGrantMigratesExactlyOnceWithoutChangingOtherPreferences() {
        legacyGrant()
        val before = context.getSharedPreferences("dpos_worker", Context.MODE_PRIVATE).all.toMap()
        assertTrue(dispatch().getBoolean("migrated"))
        val relaunched = WorkerStore(context, context.getSharedPreferences("upgrade-migration-secure", Context.MODE_PRIVATE))
        assertEquals("10 1.1", relaunched.autoDonatePool("golos", "alice"))
        assertFalse(dispatch(pool = "40 2").getBoolean("migrated"))
        assertEquals("10 1.1", relaunched.autoDonatePool("golos", "alice"))
        val after = context.getSharedPreferences("dpos_worker", Context.MODE_PRIVATE).all
        assertEquals(before, after.filterKeys { it !in setOf("autoDonate:golos:alice", "autoDonatePool:golos:alice", "logs") })
        assertTrue(relaunched.workerEnabled())
    }

    @Test fun revocationCannotBeReplayedFromOlderBrowserOptIn() {
        legacyGrant()
        store.syncAutoUpvoterGrants(listOf(AutoUpvoterGrantState("golos", "alice", false)))
        assertFalse(dispatch().getBoolean("migrated"))
        store.syncAutoUpvoterGrants(listOf(AutoUpvoterGrantState("golos", "alice", true)))
        assertFalse(dispatch().getBoolean("migrated"))
        assertNull(store.autoDonatePool("golos", "alice"))
    }

    @Test fun migrationResponseExplainsActualNativeStateAndRevocation() {
        legacyGrant()
        val first = dispatch()
        assertEquals("transferred", first.getString("reason"))
        assertEquals("enabled", first.getJSONObject("native").getString("flag"))
        assertEquals("10 1.1", first.getJSONObject("native").getString("pool"))
        val second = dispatch(pool = "40 2")
        assertEquals("native_preference_exists", second.getString("reason"))
        assertEquals("10 1.1", second.getJSONObject("native").getString("pool"))
        val contextPrefs = context.getSharedPreferences("dpos_worker", Context.MODE_PRIVATE)
        contextPrefs.edit().putBoolean("autoDonate:golos:alice", false).commit()
        assertEquals("disabled", dispatch().getJSONObject("native").getString("flag"))
        assertNull(store.autoDonatePool("golos", "alice"))
    }

    @Test fun rejectsAbsentInvalidDisabledAndRevokedGrants() {
        assertFalse(dispatch().getBoolean("migrated"))
        for (pool in listOf("", "0 1", "101 1", "10 0", "10 NaN", "10 1 extra")) {
            legacyGrant()
            assertFalse(pool, dispatch(pool = pool).getBoolean("migrated"))
        }
        for (combination in listOf(
            listOf(false, true, true), listOf(true, false, true), listOf(true, true, false)
        )) {
            legacyGrant(active = combination[0], upvoter = combination[1], worker = combination[2])
            assertFalse(combination.toString(), dispatch().getBoolean("migrated"))
        }
        legacyGrant(chain = "hive")
        assertFalse(dispatch().getBoolean("migrated"))
        legacyGrant()
        context.getSharedPreferences("dpos_worker", Context.MODE_PRIVATE).edit()
            .putBoolean("autoDonate:golos:alice", false).commit()
        assertFalse(dispatch().getBoolean("migrated"))
        assertNull(store.autoDonatePool("golos", "alice"))
        assertNull(store.autoDonatePool("hive", "alice"))
    }
}
