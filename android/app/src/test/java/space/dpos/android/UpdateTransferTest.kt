package space.dpos.android

import android.app.Activity
import android.content.Intent
import androidx.core.content.FileProvider
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import space.dpos.android.update.ReleasePolicy
import space.dpos.android.update.UpdateTransfer
import java.io.ByteArrayInputStream
import java.io.File
import java.security.MessageDigest

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class UpdateTransferTest {
    private fun hex(data: ByteArray) = data.joinToString("") { "%02x".format(it.toInt() and 255) }
    private val apk = "TEST ONLY APK".toByteArray()
    private val sha = hex(MessageDigest.getInstance("SHA-256").digest(apk))
    private val blob = hex(MessageDigest.getInstance("SHA-1").digest("blob ${apk.size}\u0000".toByteArray() + apk))
    private val release = ReleasePolicy.Release(sha, "a".repeat(64), 80, "c".repeat(40), 1000L, 1000L + ReleasePolicy.DAY, "signed-feed-A")

    @Test fun restartPersistsFirstSeenAndClockRollbackDoesNotShortenWait() {
        val activity = Robolectric.buildActivity(space.dpos.android.ui.MainActivity::class.java).get()
        val first = release.published + 1_000L
        val prefs = activity.getSharedPreferences("native_release_312", Activity.MODE_PRIVATE)
        assertTrue(prefs.edit().putString("id", release.id).putLong("first", first)
            .putLong("last", first + 3_000L).commit())
        // Reopen the same persistent store as a new Activity/updater after process restart.
        val reopened = Robolectric.buildActivity(space.dpos.android.ui.MainActivity::class.java).get()
            .getSharedPreferences("native_release_312", Activity.MODE_PRIVATE)
        assertEquals(release.id, reopened.getString("id", null))
        val persistedFirst = reopened.getLong("first", Long.MAX_VALUE)
        val persistedLast = reopened.getLong("last", Long.MAX_VALUE)
        assertFalse(ReleasePolicy.eligible(release, persistedFirst, persistedLast, first + ReleasePolicy.DAY - 1))
        assertFalse(ReleasePolicy.eligible(release, persistedFirst, persistedLast, first + 2_000L))
        assertTrue(ReleasePolicy.eligible(release, persistedFirst, persistedLast, first + ReleasePolicy.DAY))
        assertNotEquals(release.id, release.copy(id = "re-signed-feed").id)
        prefs.edit().clear().commit()
    }

    @Test fun manifestRevocationBeforeAndAfterDownloadAndChangedIdentity() {
        val activity = Robolectric.buildActivity(space.dpos.android.ui.MainActivity::class.java).get()
        val file = File(activity.filesDir, "updates/dpos-space-3.1.2.apk")
        fun attempt(feeds: List<ReleasePolicy.Release>, payload: ByteArray = apk): Int {
            var reads = 0
            try {
                UpdateTransfer.transfer(release, file, 100, { feeds[reads++] }, { true },
                    { blob to apk.size.toLong() }, { ByteArrayInputStream(payload) }, { true })
                fail("accepted revoked or altered update")
            } catch (_: IllegalArgumentException) { }
            assertFalse(file.exists())
            return reads
        }
        assertEquals(1, attempt(listOf(release.copy(id = "revoked"))))
        assertEquals(2, attempt(listOf(release, release.copy(id = "changed"))))
        assertEquals(1, attempt(listOf(release), "ALTERED APK".toByteArray()))
        file.writeBytes(apk)
        assertEquals(1, attempt(listOf(release.copy(id = "revoked"))))
        var reads = 0
        UpdateTransfer.transfer(release, file, 100, { reads++; release }, { true },
            { blob to apk.size.toLong() }, { ByteArrayInputStream(apk) }, { it.readBytes().contentEquals(apk) })
        assertEquals(2, reads)
        assertArrayEquals(apk, file.readBytes())
        file.delete()
    }

    @Test fun providerRestrictsPathAndInstallIntentIsReadOnlyApk() {
        val activity = Robolectric.buildActivity(space.dpos.android.ui.MainActivity::class.java).get()
        assertEquals(BuildConfig.APPLICATION_ID, activity.packageName)
        val file = File(activity.filesDir, "updates/dpos-space-3.1.2.apk")
        file.parentFile!!.mkdirs()
        file.writeBytes(apk)
        val intent = UpdateTransfer.installIntent(activity, file)
        assertEquals(Intent.ACTION_VIEW, intent.action)
        assertEquals("application/vnd.android.package-archive", intent.type)
        assertTrue(intent.flags and Intent.FLAG_GRANT_READ_URI_PERMISSION != 0)
        assertEquals(0, intent.flags and Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
        assertEquals("${BuildConfig.APPLICATION_ID}.updates", intent.data!!.authority)
        val outside = File(activity.filesDir, "other.apk")
        outside.writeBytes(apk)
        try {
            FileProvider.getUriForFile(activity, "${BuildConfig.APPLICATION_ID}.updates", outside)
            fail("provider exposed unrelated files")
        } catch (_: IllegalArgumentException) { }
        try {
            UpdateTransfer.installIntent(activity, outside)
            fail("installer accepted unrelated path")
        } catch (_: IllegalArgumentException) { }
        file.delete()
        java.nio.file.Files.createSymbolicLink(file.toPath(), outside.toPath())
        try {
            UpdateTransfer.installIntent(activity, file)
            fail("installer accepted linked APK")
        } catch (_: IllegalArgumentException) { }
        file.delete()
        outside.delete()
    }
}
