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
import space.dpos.android.runtime.SettingsPreferencesPolicy
import space.dpos.android.storage.WorkerStore
import space.dpos.android.notifications.GolosNotificationScanner
import space.dpos.android.notifications.HistoryEvent

@RunWith(RobolectricTestRunner::class)
class SettingsPreferencesSyncTest {
    private lateinit var context: Context
    private lateinit var store: WorkerStore
    @Before fun setup() {
        context = ApplicationProvider.getApplicationContext()
        awaitNativeStorage()
        context.getSharedPreferences("dpos_worker", Context.MODE_PRIVATE).edit().clear().commit()
        store = WorkerStore(context, context.getSharedPreferences("settings-sync-secure", Context.MODE_PRIVATE))
    }
    private fun snapshot(): JSONObject = JSONObject("""{"format":"dpos.space/settings","version":1,"notifications":[],"autoUpvoter":{"golos":[],"hive":[],"steem":[]},"vizSelfAward":[]}""")
    private fun up(name: String = "alice") = JSONObject("""{"account":"$name","enabled":true,"curators":"","favorites":"new-author","minEnergy":"95","curatorMode":"repeat","curatorCoefficient":"75","favoritesPercent":"30","autoDonate":false,"autoDonatePoolPercent":"0","autoDonatePoolCoefficient":"1"}""")
    private fun seed() {
        context.getSharedPreferences("dpos_worker",Context.MODE_PRIVATE).edit()
            .putString("accounts","""[{"chainId":"golos","account":"alice","enabled":true},{"chainId":"viz","account":"alice","enabled":true},{"chainId":"golos","account":"stopped","enabled":false}]""")
            .putBoolean("upvoter:golos:alice",true).putBoolean("upvoter:golos:stopped",false).putBoolean("autoDonate:golos:alice",false)
            .putBoolean("vizSelfAward:viz:alice",true).putBoolean("notify:viz:alice",true)
            .putBoolean("autoStart:viz:alice",false).putBoolean("worker_enabled",false)
            .putString("curators:golos:alice","[\"stale\"]").putString("favorites:golos:alice","[\"old\"]")
            .putString("inbox","keep").putString("pending","keep").putLong("cursor:golos:alice",123).commit()
    }
    @Test fun bridgeReplacesExistingParametersWithoutAccountKeyOrGrantImport() {
        seed()
        val prefs=context.getSharedPreferences("dpos_worker",Context.MODE_PRIVATE)
        val protected=prefs.all.filterKeys { it in setOf("accounts","worker_enabled","upvoter:golos:alice","upvoter:golos:stopped","autoDonate:golos:alice","vizSelfAward:viz:alice","notify:viz:alice","autoStart:viz:alice","inbox","pending","cursor:golos:alice") }
        val data=snapshot()
        data.getJSONObject("autoUpvoter").put("golos",JSONArray().put(up().put("autoDonate",true).put("autoDonatePoolPercent","1")).put(up("stopped")).put(up("not-imported")))
        data.put("notifications",JSONArray().put(JSONObject("""{"chain":"viz","account":"alice","ops":[],"showAutoAwards":true}""")))
        data.put("vizSelfAward",JSONArray().put(JSONObject("""{"account":"alice","enabled":true,"minEnergy":"9900"}""")))
        val activity=Robolectric.buildActivity(Activity::class.java).setup().get()
        val bridge=DposAndroidBridge(activity,store) { JSONObject() }
        try {
            var reply:JSONObject?=null
            bridge.dispatch(BridgeRequest("sync","replaceSettingsPreferences",data)) { reply=it }
            awaitNativeStorage()
            assertTrue(reply.toString(),reply!!.getBoolean("ok"))
            assertTrue(reply!!.getJSONObject("result").getBoolean("ok"))
            assertEquals(emptyList<String>(),store.curators("golos","alice"))
            assertEquals(listOf("new-author"),store.favorites("golos","alice"))
            assertEquals(9500,store.minEnergy("golos","alice"))
            assertEquals(9900,store.minEnergy("viz","alice"))
            assertTrue(store.showAutoAwards("viz","alice"))
            assertEquals(emptyList<String>(),store.notificationOps("viz","alice"))
            assertFalse(store.autoUpvoterEnabled("golos","stopped"))
            assertFalse(store.autoUpvoterEnabled("golos","not-imported"))
            assertFalse(store.workerEnabled())
            assertNull(store.autoDonatePool("golos","alice")) // remote opt-in is not a local spending grant
            assertEquals(protected,prefs.all.filterKeys { it in protected.keys })
            store.replaceSettingsPreferences(snapshot())
            assertFalse(store.autoUpvoterEnabled("golos","alice"))
            assertFalse(store.vizSelfAwardEnabled("viz","alice"))
            assertTrue(prefs.getBoolean("upvoter:golos:alice",false)) // local grant still intact
            assertEquals(emptyList<String>(),store.favorites("golos","alice"))
        } finally {bridge.close()}
    }
    @Test fun rejectsUnknownSchemaAndSecretFieldsBeforeAnyWrite() {
        seed();val prefs=context.getSharedPreferences("dpos_worker",Context.MODE_PRIVATE);val before=prefs.all.toMap()
        val invalid=listOf(snapshot().put("version",99),snapshot().put("privateKey","fixture"),snapshot().apply {getJSONObject("autoUpvoter").put("golos",JSONArray().put(up().put("autoStart",true)))})
        invalid.forEach { data ->
            assertTrue(runCatching {store.replaceSettingsPreferences(data)}.isFailure)
            assertEquals(before,prefs.all)
        }
    }
    @Test fun enabledPreferenceReplacementCancelsDelayedNativeVoteAndNextTickUsesNewParameters() {
        HostFullFlowProductionFixture().use { p ->
            p.ready(); p.run()
            val entered=java.util.concurrent.CountDownLatch(1)
            val release=java.util.concurrent.CountDownLatch(1)
            val once=java.util.concurrent.atomic.AtomicBoolean(false)
            p.f.onMethod={ method ->
                if (method == "get_content" && once.compareAndSet(false,true)) {
                    entered.countDown(); check(release.await(15,java.util.concurrent.TimeUnit.SECONDS))
                }
            }
            val event=space.dpos.android.upvoter.VoteEvent("curator_vote","alice","target","sync-delayed",7000,sourceIndex=1)
            val executor=java.util.concurrent.Executors.newSingleThreadExecutor()
            val task=executor.submit<space.dpos.android.worker.WorkerRunSummary> {p.run(events=listOf(event))}
            val activity=Robolectric.buildActivity(Activity::class.java).setup().get()
            val bridge=DposAndroidBridge(activity,p.f.restart()) {JSONObject()}
            try {
                assertTrue(entered.await(15,java.util.concurrent.TimeUnit.SECONDS))
                val data=snapshot().apply {getJSONObject("autoUpvoter").put("golos",JSONArray().put(up("fixture-voter").put("curators","alice").put("favorites","target").put("minEnergy","0")))}
                var reply:JSONObject?=null
                bridge.dispatch(BridgeRequest("replace-delayed","replaceSettingsPreferences",data)) {reply=it}
                awaitNativeStorage()
                assertTrue(reply.toString(),reply!!.getBoolean("ok"))
                assertTrue(p.f.restart().autoUpvoterEnabled("golos","fixture-voter"))
                release.countDown();task.get(20,java.util.concurrent.TimeUnit.SECONDS)
                assertTrue("stale vote reached native transport",p.f.sends.isEmpty())
                p.f.onMethod=null
                p.run(events=listOf(event))
                assertEquals(1,p.f.sends.size)
                assertEquals(5250,p.f.sends.single().getJSONArray("operations").getJSONArray(0).getJSONObject(1).getInt("weight"))
                p.run(events=listOf(event));assertEquals(1,p.f.sends.size)
            } finally {release.countDown();executor.shutdownNow();bridge.close()}
        }
    }

    @Test fun invalidPreferencePayloadDoesNotCancelExistingPermit() {
        val activity=Robolectric.buildActivity(Activity::class.java).setup().get()
        val bridge=DposAndroidBridge(activity,store) {JSONObject()}
        val permit=space.dpos.android.worker.WorkerCancellation.token {true}
        try {
            var reply:JSONObject?=null
            bridge.dispatch(BridgeRequest("invalid","replaceSettingsPreferences",snapshot().put("version",99))) {reply=it}
            assertFalse(reply!!.getBoolean("ok"));assertTrue(permit.mayContinue())
        } finally {bridge.close()}
    }
    @Test fun preciseAutomaticAwardFilterRetainsManualIncomingAndRealBenefactor() {
        val scanner=GolosNotificationScanner(chainId="viz")
        val auto=HistoryEvent(1,"receive_award",mapOf("initiator" to "alice","receiver" to "alice","memo" to "dpos.space: VIZ self-award","shares" to "1 SHARES"))
        assertNull(scanner.toNotification("alice",auto))
        assertNotNull(scanner.toNotification("alice",auto,showAutoAwards=true))
        assertNotNull(scanner.toNotification("alice",auto.copy(data=auto.data + ("initiator" to "bob"))))
        assertNotNull(scanner.toNotification("alice",auto.copy(data=auto.data + ("memo" to "manual"))))
        val benefactor=auto.copy(type="benefactor_award",data=auto.data + ("benefactor" to "bob"))
        assertNotNull(scanner.toNotification("bob",benefactor))
        assertNull(scanner.toNotification("alice",benefactor))
        val (cursor,items)=scanner.scan("alice",0,listOf(auto),true)
        assertEquals(1L,cursor);assertTrue(items.isEmpty())
        assertEquals(1,scanner.scan("alice",0,listOf(auto),true,showAutoAwards=true).second.size)
    }
}
