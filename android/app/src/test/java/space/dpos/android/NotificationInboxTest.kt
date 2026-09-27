package space.dpos.android

import android.Manifest
import android.app.Notification
import android.app.NotificationManager
import android.app.Activity
import android.content.Context
import androidx.core.app.NotificationCompat
import androidx.test.core.app.ApplicationProvider
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.Robolectric
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import space.dpos.android.notifications.NotificationHelper
import space.dpos.android.notifications.NotificationInbox
import space.dpos.android.bridge.BridgeRequest
import space.dpos.android.bridge.DposAndroidBridge

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class NotificationInboxTest {
    private lateinit var context: Context
    private lateinit var manager: NotificationManager

    @Before fun reset() {
        context = ApplicationProvider.getApplicationContext()
        context.getSharedPreferences(NotificationInbox.PREFS_NAME, Context.MODE_PRIVATE).edit().clear().commit()
        manager = context.getSystemService(NotificationManager::class.java)
        manager.cancelAll()
        shadowOf(context as android.app.Application).grantPermissions(Manifest.permission.POST_NOTIFICATIONS)
        NotificationHelper.ensureChannels(context)
    }

    @Test fun eventsAcrossChainsUseOneCardWithCountAndLatestText() {
        NotificationHelper.showEvent(context, "Golos", "Первое", "golos:1", "#chain=golos&app=notifications")
        NotificationHelper.showEvent(context, "Hive", "Последнее", "hive:2", "#chain=hive&app=notifications")

        val active = manager.activeNotifications.filter { it.notification.channelId == NotificationHelper.CHANNEL_EVENTS }
        assertEquals(1, active.size)
        assertEquals(NotificationHelper.EVENT_SUMMARY_NOTIFICATION_ID, active.single().id)
        assertEquals(2, active.single().notification.number)
        assertEquals("DPoS Space: 2 непрочитанных событий", active.single().notification.extras.getCharSequence(Notification.EXTRA_TITLE).toString())
        assertEquals("Hive — Последнее", active.single().notification.extras.getCharSequence(Notification.EXTRA_TEXT).toString())
    }

    @Test fun dedupAndPersistenceSurviveNewInboxInstances() {
        NotificationHelper.showEvent(context, "VIZ", "Награда", "viz:77", "#chain=viz&app=notifications")
        NotificationHelper.showEvent(context, "changed", "duplicate", "viz:77", "#app=notifications")

        val restored = NotificationInbox(context).snapshot()
        assertEquals(1, restored.unreadCount)
        assertEquals(1, restored.events.size)
        assertEquals("VIZ", restored.events.single().title)
    }

    @Test fun markAllReadKeepsEventsAndDedupTombstonesAndCancelsOnlySummary() {
        NotificationHelper.showEvent(context, "Hive", "Vote", "hive:9", "#app=notifications")
        val worker = NotificationHelper.foreground(context, "active")
        manager.notify(42, worker)

        val read = NotificationHelper.markAllRead(context)
        assertEquals(0, read.unreadCount)
        assertTrue(read.events.single().read)
        assertNotNull(manager.activeNotifications.firstOrNull { it.id == 42 })
        assertFalse(manager.activeNotifications.any { it.id == NotificationHelper.EVENT_SUMMARY_NOTIFICATION_ID })

        NotificationHelper.showEvent(context, "Hive", "Vote", "hive:9", "#app=notifications")
        assertEquals(0, NotificationInbox(context).snapshot().unreadCount)
    }

    @Test fun boundedRetentionDoesNotSilentlyReduceUnreadTotal() {
        val inbox = NotificationInbox(context)
        repeat(NotificationInbox.MAX_RETAINED_EVENTS + 7) { index ->
            inbox.add("id:$index", "Event $index", "safe", "#app=notifications")
        }
        val snapshot = NotificationInbox(context).snapshot()
        assertEquals(NotificationInbox.MAX_RETAINED_EVENTS + 7, snapshot.unreadCount)
        assertEquals(NotificationInbox.MAX_RETAINED_EVENTS, snapshot.events.size)
        assertEquals("Event 7", snapshot.events.first().title)
    }

    @Test fun migrationCancelsLegacyEventCardsButNeverWorkerOrSummary() {
        manager.notify("legacy", 123, NotificationCompat.Builder(context, NotificationHelper.CHANNEL_EVENTS)
            .setSmallIcon(R.mipmap.ic_launcher).setContentTitle("legacy").build())
        manager.notify(77, NotificationHelper.foreground(context, "active"))
        NotificationHelper.showEvent(context, "VIZ", "latest", "viz:migration", "#app=notifications")

        NotificationHelper.ensureChannels(context)
        val active = manager.activeNotifications
        assertFalse(active.any { it.tag == "legacy" && it.id == 123 })
        assertTrue(active.any { it.id == 77 && it.notification.channelId == NotificationHelper.CHANNEL_WORKER })
        assertTrue(active.any { it.id == NotificationHelper.EVENT_SUMMARY_NOTIFICATION_ID })
    }

    @Test fun permissionDeniedStillPersistsButDoesNotPost() {
        manager.cancelAll()
        shadowOf(context as android.app.Application).denyPermissions(Manifest.permission.POST_NOTIFICATIONS)
        NotificationHelper.showEvent(context, "Steem", "Transfer", "steem:4", "#app=notifications")

        assertEquals(1, NotificationInbox(context).snapshot().unreadCount)
        assertFalse(manager.activeNotifications.any { it.id == NotificationHelper.EVENT_SUMMARY_NOTIFICATION_ID })
    }

    @Test fun persistedStorageContainsOnlySanitizedDisplayValues() {
        val wif = "5J" + "A".repeat(48)
        NotificationInbox(context).add("safe-id", "Title\u0000", "secret $wif", "javascript:bad")
        val raw = context.getSharedPreferences(NotificationInbox.PREFS_NAME, Context.MODE_PRIVATE)
            .all.values.joinToString(" ")
        assertFalse(raw.contains(wif))
        val event = NotificationInbox(context).snapshot().events.single()
        assertEquals("Title", event.title)
        assertTrue(event.text.contains("[redacted]"))
        assertEquals("#", event.route)
    }

    @Test fun distinctLongIdsRemainDistinctAndDeduplicateAfterReload() {
        val first = "5J" + "A".repeat(48)
        val second = "5J" + "B".repeat(48)
        NotificationInbox(context).add(first, "VIZ", "one", "#app=notifications")
        NotificationInbox(context).add(second, "VIZ", "two", "#app=notifications")
        NotificationInbox(context).add(first, "VIZ", "duplicate", "#app=notifications")
        val restored = NotificationInbox(context).snapshot()
        assertEquals(2, restored.unreadCount)
        assertEquals(2, restored.events.map { it.id }.distinct().size)
        assertFalse(context.getSharedPreferences(NotificationInbox.PREFS_NAME, Context.MODE_PRIVATE).all.toString().contains(first))
    }

    @Test fun bridgeShapeIsStable() {
        NotificationInbox(context).add("event:1", "Title", "Text", "#app=notifications")
        val json = NotificationInbox(context).snapshot().toJson()
        assertTrue(json.getBoolean("ok"))
        assertEquals(1, json.getInt("unreadCount"))
        val event = json.getJSONArray("events").getJSONObject(0)
        listOf("id", "title", "text", "route", "read").forEach { assertTrue(event.has(it)) }
        assertFalse(event.getBoolean("read"))
        assertTrue(JSONObject(json.toString()).has("events"))
    }

    @Test fun bridgeInboxCommandsRespondSynchronouslyAndAdvertiseCapability() {
        NotificationInbox(context).add("event:bridge", "Title", "Text", "#app=notifications")
        val activity = Robolectric.buildActivity(Activity::class.java).setup().get()
        val bridge = DposAndroidBridge(activity, statusProvider = { JSONObject() })
        assertTrue(JSONObject(bridge.getAppInfo()).getBoolean("notificationInbox"))

        var getResponse: JSONObject? = null
        bridge.dispatch(BridgeRequest("inbox-get", "getNotificationInbox", JSONObject())) { getResponse = it }
        assertEquals(1, getResponse!!.getJSONObject("result").getInt("unreadCount"))

        var readResponse: JSONObject? = null
        bridge.dispatch(BridgeRequest("inbox-read", "markAllNotificationsRead", JSONObject())) { readResponse = it }
        assertEquals(0, readResponse!!.getJSONObject("result").getInt("unreadCount"))
        bridge.close()
    }
}
