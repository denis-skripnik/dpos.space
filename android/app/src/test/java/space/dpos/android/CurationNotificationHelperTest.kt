package space.dpos.android

import android.Manifest
import android.app.Notification
import android.app.NotificationManager
import android.content.Context
import androidx.test.core.app.ApplicationProvider
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import space.dpos.android.notifications.*

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class CurationNotificationHelperTest {
    private val context get() = ApplicationProvider.getApplicationContext<Context>()
    private val manager get() = context.getSystemService(NotificationManager::class.java)
    private val route = "#chain=golos&app=history&account=alice&ops=curation_reward"
    @Before fun reset() {
        context // initialize the actual Application before draining its queued storage work
        awaitNativeStorage()
        context.getSharedPreferences(NotificationInbox.PREFS_NAME, 0).edit().clear().commit()
        manager.cancelAll()
        shadowOf(context as android.app.Application).grantPermissions(Manifest.permission.POST_NOTIFICATIONS)
    }
    private fun card() = manager.activeNotifications.single { it.id == NotificationHelper.EVENT_SUMMARY_NOTIFICATION_ID }.notification
    private fun text() = card().extras.getCharSequence(Notification.EXTRA_TEXT).toString()

    @Test fun humanSummaryPersistsOriginalRawTextAndStableInboxShape() {
        NotificationHelper.showEvent(context, "Кураторская награда", "2.123000 GESTS", "golos:alice:9:curation_reward", route,
            displayText = "≈ +1.062 СГ (по текущему соотношению)")
        val snapshot = NotificationInbox(context).snapshot()
        val saved = snapshot.events.single()
        assertEquals("2.123000 GESTS", saved.text)
        assertEquals("Кураторская награда", saved.title)
        assertEquals(route, saved.route)
        val expectedId = "event:" + java.security.MessageDigest.getInstance("SHA-256")
            .digest("golos:alice:9:curation_reward".toByteArray()).joinToString(":") { "%02x".format(it) }
        assertEquals(expectedId, saved.id)
        assertFalse(saved.read)
        assertEquals(1, snapshot.unreadCount)
        assertEquals(1, card().number)
        assertEquals("Кураторская награда — ≈ +1.062 СГ (по текущему соотношению)", text())
        assertFalse(card().extras.toString().contains("GESTS"))
        val json = snapshot.toJson().getJSONArray("events").getJSONObject(0)
        assertEquals("2.123000 GESTS", json.getString("text"))
        assertFalse(json.has("displayText"))
        assertTrue(card().extras.getCharSequence("android.bigText").toString().contains("СГ"))
    }

    @Test fun restorationAndMissingRateHideRawWithoutNetworkOrPersistedDisplayState() {
        NotificationHelper.showEvent(context, "Кураторская награда", "2.123000 GESTS", "reward", route)
        assertEquals("Кураторская награда — Получена кураторская награда", text())
        NotificationHelper.postSummary(context, NotificationInbox(context).snapshot())
        assertFalse(text().contains("GESTS"))
        assertEquals("2.123000 GESTS", NotificationInbox(context).snapshot().events.single().text)
    }

    @Test fun duplicateCannotReplaceLatestSummaryAndOtherRewardsKeepTheirText() {
        NotificationHelper.showEvent(context, "reward", "1 GESTS", "one", route, displayText = "≈ +0.500 СГ (по текущему соотношению)")
        NotificationHelper.showEvent(context, "Авторская награда", "2 GESTS", "two", route.replace("curation_reward", "author_reward"))
        NotificationHelper.showEvent(context, "reward", "changed", "one", route, displayText = "wrong")
        assertEquals("Авторская награда — 2 GESTS", text())
        assertEquals(2, card().number)
    }

    @Test fun deniedPermissionRetainsRawAndMarkReadRetainsDedup() {
        shadowOf(context as android.app.Application).denyPermissions(Manifest.permission.POST_NOTIFICATIONS)
        NotificationHelper.showEvent(context, "reward", "1 GESTS", "one", route, displayText = "human")
        assertTrue(manager.activeNotifications.isEmpty())
        assertEquals("1 GESTS", NotificationInbox(context).snapshot().events.single().text)
        NotificationHelper.markAllRead(context)
        shadowOf(context as android.app.Application).grantPermissions(Manifest.permission.POST_NOTIFICATIONS)
        NotificationHelper.showEvent(context, "reward", "1 GESTS", "one", route, displayText = "human")
        assertEquals(0, NotificationInbox(context).snapshot().unreadCount)
        assertTrue(manager.activeNotifications.isEmpty())
    }
}
