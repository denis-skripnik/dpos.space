package space.dpos.android

import android.app.Activity
import android.app.AlertDialog
import android.os.Looper
import android.util.Base64
import org.json.JSONObject
import org.junit.After
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import org.robolectric.shadows.ShadowAlertDialog
import space.dpos.android.update.NativeUpdater
import space.dpos.android.update.ReleasePolicy
import java.io.ByteArrayInputStream
import java.io.File
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.security.KeyPairGenerator
import java.security.MessageDigest
import java.security.SecureRandom
import java.security.Signature
import java.security.spec.NamedParameterSpec
import java.time.Instant
import java.util.concurrent.ExecutorService
import java.util.concurrent.TimeUnit

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class NativeUpdaterRetryTest {
    private val updaters = mutableListOf<NativeUpdater>()
    private val activity = Robolectric.buildActivity(Activity::class.java).setup().get()
    private val prefs = activity.getSharedPreferences("native_release_312", Activity.MODE_PRIVATE)
    private val payload = "synthetic APK fixture, never installed".toByteArray()
    private val commit = "c".repeat(40)
    private val pair = KeyPairGenerator.getInstance("Ed25519").apply {
        val random = SecureRandom.getInstance("SHA1PRNG")
        random.setSeed("NativeUpdaterRetryTest fixture only".toByteArray())
        initialize(NamedParameterSpec("Ed25519"), random)
    }.generateKeyPair()
    private val pin = Base64.encodeToString(pair.public.encoded.takeLast(32).toByteArray(), Base64.NO_WRAP)
    private val now = System.currentTimeMillis()
    private fun hex(bytes: ByteArray) = bytes.joinToString("") { "%02x".format(it.toInt() and 255) }
    private fun canonical(obj: JSONObject): String = obj.keys().asSequence().toList().sorted()
        .joinToString(",", "{", "}") { key -> JSONObject.quote(key) + ":" + when (val value = obj.get(key)) {
            is JSONObject -> canonical(value)
            is String -> JSONObject.quote(value).replace("\\/", "/")
            else -> value.toString()
        } }
    private val manifest = JSONObject()
        .put("apk", "/downloads/dpos-space-4.2.0.apk")
        .put("certificateSha256", BuildConfig.DPOS_HISTORIC_CERT)
        .put("notBefore", Instant.ofEpochMilli(now - 2 * ReleasePolicy.DAY).truncatedTo(java.time.temporal.ChronoUnit.SECONDS).toString())
        .put("package", "space.dpos.android.debug")
        .put("publishedAt", Instant.ofEpochMilli(now - 3 * ReleasePolicy.DAY).truncatedTo(java.time.temporal.ChronoUnit.SECONDS).toString())
        .put("sha256", hex(MessageDigest.getInstance("SHA-256").digest(payload)))
        .put("sourceCommit", commit).put("versionCode", 140).put("versionName", "4.2.0")
    private val feed = run {
        val signer = Signature.getInstance("Ed25519")
        signer.initSign(pair.private)
        signer.update(("dpos.space/release/v1\n" + canonical(manifest)).toByteArray())
        canonical(JSONObject().put("manifest", manifest).put("publicKey", pin)
            .put("signature", Base64.encodeToString(signer.sign(), Base64.NO_WRAP))).toByteArray()
    }
    private val release = ReleasePolicy.parse(feed, pin, BuildConfig.DPOS_HISTORIC_CERT, BuildConfig.VERSION_CODE)
    private var apkRequests = 0
    private var holdApk = false
    private var manifestRequests = 0
    private var holdManifestAt = -1
    private val manifestEntered = java.util.concurrent.CountDownLatch(1)
    private val manifestReleased = java.util.concurrent.CountDownLatch(1)
    private val apkEntered = java.util.concurrent.CountDownLatch(1)
    private val apkReleased = java.util.concurrent.CountDownLatch(1)
    private var provenanceValid = true
    private var successfulApk = false
    private var archivePackage = "space.dpos.android.debug"
    private var archiveCode = 140L
    private var archiveVersion = "4.2.0"
    private var badCertificate = false
    private var badInstalledCertificate = false
    private var disconnectReleases = true
    private var drip = false
    private var holdAfterChunk = false
    private val chunkEntered = java.util.concurrent.CountDownLatch(1)
    private val chunkReleased = java.util.concurrent.CountDownLatch(1)
    private var elapsed = 0L
    private val ioThreads = mutableListOf<Thread>()
    // Public DER certificate extracted from retained shipped APK; never a private key.
    private val publicCertificate = "MIIC5DCCAcwCAQEwDQYJKoZIhvcNAQELBQAwNzEWMBQGA1UEAwwNQW5kcm9pZCBEZWJ1ZzEQMA4GA1UECgwHQW5kcm9pZDELMAkGA1UEBhMCVVMwIBcNMjYwNzI2MDQyNDQ2WhgPMjA1NjA3MTgwNDI0NDZaMDcxFjAUBgNVBAMMDUFuZHJvaWQgRGVidWcxEDAOBgNVBAoMB0FuZHJvaWQxCzAJBgNVBAYTAlVTMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAquuC8zfHZhL9vHhedlObDA6UDbQ/MNt9tEnPpkzttnL3vIrMWHsfKKpTEVIG1Zn515YBduhaWL/rLXjnSCVz4531gXzsSwk/jphQFNSfoBon3XdHCJDCX6exVqVNpmLk8PqeGI6IjnhmpTGvLISzFFAT/Iubm6NtuqeHHWv7jmf81d/lcfZfwrqan6zNI05ouzE+5xYMB0Z+pdSGwLtpNECutAH1KuobaO/qRpVg+2Fh1AI9tomV4wXgj71sQG/78Zvpl/ZC9cuabm1twip9Ci70fP0UCkTL3Q4T7WMBkesjS3b+9pIyty1uhsNE+kU8OQiH4fMFI1o+iF2/6PZbCwIDAQABMA0GCSqGSIb3DQEBCwUAA4IBAQB18vOECltFSlPrMHTth53LUhw8reZVHzm3Ng1QTfd8Zdvuw/PbJgiC3wcq0vNw4PDSb8WMZdJbJeKpIoI/O95KcuhrZXN73Mu5JqBTSlsL0kCJqJrMVLC83JZJxvleebMvicBfvHMQ04AbzBdJs+z/S0g67CDQ4VkgRjeXIhjOT9+ikvhBtyUQFoahzM6lmyI9lofssZQbzgaQXlWjVNv38hvcnjdBy9lrXAxsRXM8NCmehGzc2q1D5vKajdTzg1A+z2Ffq/rBg0hZSnVJY6B3ar9s+NtJeJZUtgMLWrhm5t4cBpa4UKB3GhbajDW8BgZfNY4HHOBZRH18q4GvaeS1"
    private fun signingInfo(bad: Boolean = false): android.content.pm.SigningInfo {
        val bytes = if (bad) byteArrayOf(1, 2, 3) else Base64.decode(publicCertificate, Base64.NO_WRAP)
        if (!bad) assertEquals(BuildConfig.DPOS_HISTORIC_CERT, hex(MessageDigest.getInstance("SHA-256").digest(bytes)))
        return android.content.pm.SigningInfo().also {
            shadowOf(it).setSignatures(arrayOf(android.content.pm.Signature(bytes)))
        }
    }
    @Suppress("DEPRECATION")
    private fun setCertificate(info: android.content.pm.PackageInfo, bad: Boolean) {
        if (android.os.Build.VERSION.SDK_INT >= 28) info.signingInfo = signingInfo(bad)
        else info.signatures = arrayOf(android.content.pm.Signature(
            if (bad) byteArrayOf(1, 2, 3) else Base64.decode(publicCertificate, Base64.NO_WRAP)))
    }
    private fun archiveBoundary(owner: Activity) {
        val pm = shadowOf(owner.packageManager)
        setCertificate(pm.getInternalMutablePackageInfo(owner.packageName), badInstalledCertificate)
        File(owner.filesDir, "updates").walkTopDown().filter { it.isDirectory }.forEach { directory ->
            pm.setPackageArchiveInfo(File(directory, release.filename).absolutePath,
                android.content.pm.PackageInfo().apply {
                    packageName = archivePackage
                    versionName = archiveVersion
                    if (android.os.Build.VERSION.SDK_INT >= 28) longVersionCode = archiveCode
                    else @Suppress("DEPRECATION") versionCode = archiveCode.toInt()
                    setCertificate(this, badCertificate)
                })
        }
    }
    private fun updater(owner: Activity = activity, resume: Boolean = true): NativeUpdater = NativeUpdater(owner, { url ->
        synchronized(ioThreads) { ioThreads += Thread.currentThread() }
        val holdManifest = url.path == ReleasePolicy.MANIFEST_PATH && ++manifestRequests == holdManifestAt
        val bytes = when {
            url.path == ReleasePolicy.MANIFEST_PATH -> feed
            url.host == "api.github.com" && url.path.contains("/commits/") ->
                "{\"sha\":\"${if (provenanceValid) commit else "d".repeat(40)}\"}".toByteArray()
            url.host == "api.github.com" && url.path.contains("/contents/") ->
                JSONObject().put("path", release.repositoryPath).put("type", "file")
                    .put("sha", hex(MessageDigest.getInstance("SHA-1").digest("blob ${payload.size}\u0000".toByteArray() + payload)))
                    .put("size", payload.size).toString().toByteArray()
            url.path == release.apk -> { apkRequests++; null }
            else -> throw AssertionError("Unexpected updater URL: $url")
        }
        object : HttpURLConnection(url) {
            override fun connect() = Unit
            override fun disconnect() {
                synchronized(ioThreads) { ioThreads += Thread.currentThread() }
                if (holdManifest) manifestReleased.countDown()
                if (disconnectReleases && url.path == release.apk) {
                    apkReleased.countDown()
                    chunkReleased.countDown()
                }
            }
            override fun usingProxy() = false
            override fun getResponseCode() = 200
            override fun getContentLengthLong() = (bytes?.size ?: payload.size).toLong()
            override fun getInputStream(): java.io.InputStream {
                if (holdManifest) {
                    manifestEntered.countDown()
                    check(manifestReleased.await(10, TimeUnit.SECONDS))
                }
                if (holdApk && url.path == release.apk) {
                    apkEntered.countDown()
                    check(apkReleased.await(10, TimeUnit.SECONDS))
                }
                if (bytes != null) return ByteArrayInputStream(bytes)
                if (!successfulApk) throw IOException("Synthetic offline APK failure")
                archiveBoundary(owner)
                return object : ByteArrayInputStream(payload) {
                    override fun read(buffer: ByteArray, offset: Int, count: Int): Int {
                        if (drip) elapsed += 100_001L
                        if (holdAfterChunk && pos > 0) {
                            chunkEntered.countDown()
                            check(chunkReleased.await(10, TimeUnit.SECONDS))
                        }
                        return super.read(buffer, offset, when {
                            drip -> 1
                            holdAfterChunk -> minOf(count, payload.size / 2)
                            else -> count
                        })
                    }
                }
            }
        }
    }, pin, { elapsed }).also { updaters += it; if (resume) it.onResume() }

    private fun settle(updater: NativeUpdater) {
        // Dispatch button listeners, wait for real updater IO, then drain main callbacks.
        shadowOf(Looper.getMainLooper()).idle()
        val field = NativeUpdater::class.java.getDeclaredField("worker").apply { isAccessible = true }
        (field.get(updater) as ExecutorService).submit {}.get(10, TimeUnit.SECONDS)
        shadowOf(Looper.getMainLooper()).idle()
    }
    private fun seedObservation(first: Long = now - ReleasePolicy.DAY - 1000) {
        prefs.edit().clear().putString("id", release.id).putInt("code", release.code)
            .putLong("first", first).putLong("last", now - 1000).commit()
    }
    private fun check(updater: NativeUpdater) { updater.check(); settle(updater) }
    private fun dialog(): AlertDialog {
        val dialog = ShadowAlertDialog.getLatestAlertDialog()
        assertNotNull("Expected updater dialog after eligible foreground check", dialog)
        return dialog!!
    }
    @org.junit.Before fun resetProvider() {
        val field = androidx.core.content.FileProvider::class.java.getDeclaredField("sCache").apply { isAccessible = true }
        (field.get(null) as MutableMap<*, *>).clear()
        shadowOf(activity.packageManager).setCanRequestPackageInstalls(false)
    }
    @After fun cleanup() {
        updaters.forEach { it.close() }
        updaters.forEach {
            val field = NativeUpdater::class.java.getDeclaredField("worker").apply { isAccessible = true }
            assertTrue((field.get(it) as ExecutorService).awaitTermination(10, TimeUnit.SECONDS))
        }
        prefs.edit().clear().commit()
    }

    private fun downloadReady(updater: NativeUpdater) {
        check(updater)
        dialog().getButton(AlertDialog.BUTTON_POSITIVE).performClick()
        settle(updater)
        assertEquals("Обновление загружено", shadowOf(dialog()).title.toString())
    }
    private fun candidates() = File(activity.filesDir, "updates").walkTopDown().filter { it.isFile }.toList()

    @Test @Config(sdk = [26, 34]) fun signedDownloadIdentityAndExplicitInstallerHandoff() {
        seedObservation()
        successfulApk = true
        shadowOf(activity.packageManager).setCanRequestPackageInstalls(true)
        val updater = updater()
        downloadReady(updater)
        assertEquals(1, candidates().size)
        assertArrayEquals(payload, candidates().single().readBytes())
        assertNull(shadowOf(activity).nextStartedActivity)
        dialog().getButton(AlertDialog.BUTTON_POSITIVE).performClick()
        settle(updater)
        val intent = shadowOf(activity).nextStartedActivity
        assertEquals(android.content.Intent.ACTION_VIEW, intent.action)
        assertEquals("application/vnd.android.package-archive", intent.type)
        assertTrue(intent.flags and android.content.Intent.FLAG_GRANT_READ_URI_PERMISSION != 0)
        assertEquals(0, intent.flags and android.content.Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
        assertEquals(1, apkRequests)
        assertTrue(ioThreads.isNotEmpty())
        assertTrue("Network work must not run on UI", ioThreads.all { it != Looper.getMainLooper().thread })
        val handedOff = candidates().single()
        updater.close()
        val field = NativeUpdater::class.java.getDeclaredField("worker").apply { isAccessible = true }
        assertTrue((field.get(updater) as ExecutorService).awaitTermination(10, TimeUnit.SECONDS))
        assertTrue("Installer URI must survive Activity destruction", handedOff.exists())
    }

    @Test fun settingsDenialReturnThenGrantRevalidatesBeforeInstaller() {
        seedObservation()
        successfulApk = true
        val updater = updater()
        downloadReady(updater)
        dialog().getButton(AlertDialog.BUTTON_POSITIVE).performClick()
        shadowOf(Looper.getMainLooper()).idle()
        assertEquals(android.provider.Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
            shadowOf(activity).nextStartedActivity.action)
        updater.onPause()
        updater.onResume()
        assertEquals("Обновление загружено", shadowOf(dialog()).title.toString())
        assertNull("Returning without grant must not open installer", shadowOf(activity).nextStartedActivity)
        shadowOf(activity.packageManager).setCanRequestPackageInstalls(true)
        dialog().getButton(AlertDialog.BUTTON_POSITIVE).performClick()
        settle(updater)
        assertEquals(android.content.Intent.ACTION_VIEW, shadowOf(activity).nextStartedActivity.action)
        assertEquals(1, apkRequests)
    }

    @Test fun tamperAfterPermissionSettingsFailsRevalidation() {
        seedObservation()
        successfulApk = true
        val updater = updater()
        downloadReady(updater)
        dialog().getButton(AlertDialog.BUTTON_POSITIVE).performClick()
        shadowOf(Looper.getMainLooper()).idle()
        assertEquals(android.provider.Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
            shadowOf(activity).nextStartedActivity.action)
        updater.onPause()
        candidates().single().writeText("changed bytes")
        shadowOf(activity.packageManager).setCanRequestPackageInstalls(true)
        updater.onResume()
        dialog().getButton(AlertDialog.BUTTON_POSITIVE).performClick()
        settle(updater)
        assertEquals("Обновление недоступно", shadowOf(dialog()).title.toString())
        assertNull(shadowOf(activity).nextStartedActivity)
        assertTrue(candidates().isEmpty())
    }

    @Test fun successfulBytesWithWrongArchiveIdentityAreRejectedAndRetryWorks() {
        seedObservation()
        successfulApk = true
        badCertificate = true
        val updater = updater()
        check(updater)
        dialog().getButton(AlertDialog.BUTTON_POSITIVE).performClick()
        settle(updater)
        assertEquals("Обновление недоступно", shadowOf(dialog()).title.toString())
        assertTrue(candidates().isEmpty())
        dialog().getButton(AlertDialog.BUTTON_POSITIVE).performClick()
        shadowOf(Looper.getMainLooper()).idle()
        badCertificate = false
        downloadReady(updater)
        assertEquals(2, apkRequests)
    }

    @Test fun pausedUpdaterDoesNotCheckOrPromptUntilResume() {
        seedObservation()
        val updater = updater(resume = false)
        check(updater)
        assertTrue(ioThreads.isEmpty())
        assertNull(ShadowAlertDialog.getLatestAlertDialog())
        updater.onResume()
        settle(updater)
        assertTrue(dialog().isShowing)
        updater.onPause()
        assertFalse(dialog().isShowing)
        updater.onResume()
        assertTrue(dialog().isShowing)
        assertEquals(0, apkRequests)
    }

    @Test fun pausedDownloadCannotShowReadyOrLaunchInstaller() {
        seedObservation()
        successfulApk = true
        holdApk = true
        val updater = updater()
        check(updater)
        dialog().getButton(AlertDialog.BUTTON_POSITIVE).performClick()
        shadowOf(Looper.getMainLooper()).idle()
        assertTrue(apkEntered.await(10, TimeUnit.SECONDS))
        updater.onPause()
        settle(updater)
        assertFalse(dialog().isShowing)
        assertNull(shadowOf(activity).nextStartedActivity)
        assertTrue(candidates().isEmpty())
        holdApk = false
        updater.onResume()
        settle(updater)
        downloadReady(updater)
    }

    @Test fun pauseDuringInstallerValidationCancelsHandoffAndPreservesReadyRetry() {
        seedObservation()
        successfulApk = true
        shadowOf(activity.packageManager).setCanRequestPackageInstalls(true)
        val updater = updater()
        downloadReady(updater)
        val file = candidates().single()
        holdManifestAt = manifestRequests + 1
        dialog().getButton(AlertDialog.BUTTON_POSITIVE).performClick()
        shadowOf(Looper.getMainLooper()).idle()
        assertTrue(manifestEntered.await(10, TimeUnit.SECONDS))
        updater.onPause()
        updater.onResume() // Return before the cancelled IO callback has completed.
        settle(updater)
        assertNull(shadowOf(activity).nextStartedActivity)
        assertTrue(file.exists())
        assertEquals("Обновление загружено", shadowOf(dialog()).title.toString())
        dialog().getButton(AlertDialog.BUTTON_POSITIVE).performClick()
        settle(updater)
        assertEquals(android.content.Intent.ACTION_VIEW, shadowOf(activity).nextStartedActivity.action)
    }

    @Test fun rapidPauseResumeDuringDownloadOffersRetryAfterCancellationCompletes() {
        seedObservation()
        successfulApk = true
        holdApk = true
        val updater = updater()
        check(updater)
        dialog().getButton(AlertDialog.BUTTON_POSITIVE).performClick()
        shadowOf(Looper.getMainLooper()).idle()
        assertTrue(apkEntered.await(10, TimeUnit.SECONDS))
        updater.onPause()
        updater.onResume()
        settle(updater)
        settle(updater)
        assertTrue(candidates().isEmpty())
        assertEquals("Доступно обновление DPoS Space 4.2.0", shadowOf(dialog()).title.toString())
        assertTrue(dialog().isShowing)
    }

    @Test fun slowDripExceedsTotalDeadlineDespiteMakingProgress() {
        seedObservation()
        successfulApk = true
        drip = true
        val updater = updater()
        check(updater)
        dialog().getButton(AlertDialog.BUTTON_POSITIVE).performClick()
        settle(updater)
        assertEquals("Обновление недоступно", shadowOf(dialog()).title.toString())
        assertTrue(candidates().isEmpty())
        assertNull(shadowOf(activity).nextStartedActivity)
        dialog().getButton(AlertDialog.BUTTON_POSITIVE).performClick()
        shadowOf(Looper.getMainLooper()).idle()
        drip = false
        downloadReady(updater)
    }

    class InstallerFailureActivity : Activity() {
        var failLaunch = true
        override fun startActivity(intent: android.content.Intent) {
            if (failLaunch) throw android.content.ActivityNotFoundException("synthetic missing installer")
            super.startActivity(intent)
        }
    }

    @Test fun installerLaunchFailureKeepsVerifiedCandidateAndCanRetry() {
        seedObservation()
        successfulApk = true
        val owner = Robolectric.buildActivity(InstallerFailureActivity::class.java).setup().get()
        shadowOf(owner.packageManager).setCanRequestPackageInstalls(true)
        val updater = updater(owner)
        downloadReady(updater)
        dialog().getButton(AlertDialog.BUTTON_POSITIVE).performClick()
        settle(updater)
        assertEquals("Обновление недоступно", shadowOf(dialog()).title.toString())
        assertTrue(candidates().single().exists())
        dialog().getButton(AlertDialog.BUTTON_POSITIVE).performClick()
        shadowOf(Looper.getMainLooper()).idle()
        owner.failLaunch = false
        check(updater)
        dialog().getButton(AlertDialog.BUTTON_POSITIVE).performClick()
        settle(updater)
        assertEquals(android.content.Intent.ACTION_VIEW, shadowOf(owner).nextStartedActivity.action)
    }

    @Test fun settingsLaunchFailureIsVisibleAndCanRetry() {
        seedObservation()
        successfulApk = true
        val owner = Robolectric.buildActivity(InstallerFailureActivity::class.java).setup().get()
        val updater = updater(owner)
        downloadReady(updater)
        dialog().getButton(AlertDialog.BUTTON_POSITIVE).performClick()
        shadowOf(Looper.getMainLooper()).idle()
        assertEquals("Обновление недоступно", shadowOf(dialog()).title.toString())
        assertTrue(candidates().single().exists())
        dialog().getButton(AlertDialog.BUTTON_POSITIVE).performClick()
        shadowOf(Looper.getMainLooper()).idle()
        owner.failLaunch = false
        check(updater)
        dialog().getButton(AlertDialog.BUTTON_POSITIVE).performClick()
        shadowOf(Looper.getMainLooper()).idle()
        assertEquals(android.provider.Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
            shadowOf(owner).nextStartedActivity.action)
    }

    @Test fun recreationOldCleanupCannotDeleteNewCandidate() {
        seedObservation()
        successfulApk = true
        val first = updater()
        downloadReady(first)
        val oldFile = candidates().single()
        val owner = Robolectric.buildActivity(Activity::class.java).setup().get()
        val second = updater(owner)
        downloadReady(second)
        val newFile = candidates().single { it != oldFile }
        assertNotEquals(oldFile.parent, newFile.parent)
        first.close()
        val field = NativeUpdater::class.java.getDeclaredField("worker").apply { isAccessible = true }
        assertTrue((field.get(first) as ExecutorService).awaitTermination(10, TimeUnit.SECONDS))
        assertFalse(oldFile.exists())
        assertArrayEquals(payload, newFile.readBytes())
        shadowOf(owner.packageManager).setCanRequestPackageInstalls(true)
        dialog().getButton(AlertDialog.BUTTON_POSITIVE).performClick()
        settle(second)
        assertEquals(android.content.Intent.ACTION_VIEW, shadowOf(owner).nextStartedActivity.action)
    }


    @Test fun progressAnnouncesPercentageAndCancelDoesNotBlockMain() {
        seedObservation()
        successfulApk = true
        holdAfterChunk = true
        val updater = updater()
        check(updater)
        dialog().getButton(AlertDialog.BUTTON_POSITIVE).performClick()
        shadowOf(Looper.getMainLooper()).idle()
        assertTrue(chunkEntered.await(10, TimeUnit.SECONDS))
        shadowOf(Looper.getMainLooper()).idle()
        val status = dialog().findViewById<android.widget.TextView>(android.R.id.message)
        assertTrue(status.text.toString().contains("%"))
        assertEquals(android.view.View.ACCESSIBILITY_LIVE_REGION_POLITE, status.accessibilityLiveRegion)
        dialog().getButton(AlertDialog.BUTTON_NEGATIVE).performClick()
        settle(updater)
        assertTrue(candidates().isEmpty())
        assertTrue(ioThreads.all { it != Looper.getMainLooper().thread })
    }

    @Test fun destroyedOldTransferCompletesAfterNewDownloadWithoutDeletingIt() {
        seedObservation()
        successfulApk = true
        holdApk = true
        disconnectReleases = false
        val first = updater()
        check(first)
        dialog().getButton(AlertDialog.BUTTON_POSITIVE).performClick()
        shadowOf(Looper.getMainLooper()).idle()
        assertTrue(apkEntered.await(10, TimeUnit.SECONDS))
        first.close()
        holdApk = false
        val owner = Robolectric.buildActivity(Activity::class.java).setup().get()
        val second = updater(owner)
        downloadReady(second)
        val file = candidates().single()
        apkReleased.countDown()
        val field = NativeUpdater::class.java.getDeclaredField("worker").apply { isAccessible = true }
        assertTrue((field.get(first) as ExecutorService).awaitTermination(10, TimeUnit.SECONDS))
        shadowOf(Looper.getMainLooper()).idle()
        assertArrayEquals(payload, file.readBytes())
        assertEquals("Обновление загружено", shadowOf(dialog()).title.toString())
        assertNull(shadowOf(activity).nextStartedActivity)
    }

    @Test fun packageVersionAndInstalledCertificateMismatchAllFailClosed() {
        seedObservation()
        successfulApk = true
        val updater = updater()
        val mutations = listOf<() -> Unit>(
            { archivePackage = "attacker.app" },
            { archivePackage = activity.packageName; archiveVersion = "4.1.0" },
            { archiveVersion = release.version; archiveCode = release.code - 1L },
            { archiveCode = release.code.toLong(); badInstalledCertificate = true }
        )
        mutations.forEach { mutate ->
            mutate()
            check(updater)
            dialog().getButton(AlertDialog.BUTTON_POSITIVE).performClick()
            settle(updater)
            assertEquals("Обновление недоступно", shadowOf(dialog()).title.toString())
            assertTrue(candidates().isEmpty())
            assertNull(shadowOf(activity).nextStartedActivity)
            dialog().getButton(AlertDialog.BUTTON_POSITIVE).performClick()
            shadowOf(Looper.getMainLooper()).idle()
        }
    }

    @Test fun completionQueuedBeforePauseCannotDisplayReadyOrKeepCancelledFile() {
        seedObservation()
        successfulApk = true
        val updater = updater()
        check(updater)
        dialog().getButton(AlertDialog.BUTTON_POSITIVE).performClick()
        shadowOf(Looper.getMainLooper()).idle()
        val field = NativeUpdater::class.java.getDeclaredField("worker").apply { isAccessible = true }
        val executor = field.get(updater) as ExecutorService
        executor.submit {}.get(10, TimeUnit.SECONDS)
        updater.onPause()
        shadowOf(Looper.getMainLooper()).idle()
        executor.submit {}.get(10, TimeUnit.SECONDS)
        assertTrue(candidates().isEmpty())
        assertFalse(dialog().isShowing)
        assertNull(shadowOf(activity).nextStartedActivity)
    }

    @Test fun laterDefersThisActivityButNewActivityCheckOffersAgain() {
        seedObservation()
        val first = updater()
        check(first)
        assertTrue(dialog().isShowing)
        dialog().getButton(AlertDialog.BUTTON_NEGATIVE).performClick()
        check(first)
        assertFalse("Repeated foreground checks must not nag after Later", dialog().isShowing)
        first.close()
        activity.finish()
        val reopened = updater(Robolectric.buildActivity(Activity::class.java).setup().get())
        check(reopened)
        assertTrue("A fresh activity updater must offer the eligible release again", dialog().isShowing)
        assertEquals(0, apkRequests)
        assertEquals(now - ReleasePolicy.DAY - 1000, prefs.getLong("first", 0))
    }

    @Test fun failedDownloadAcknowledgedThenForegroundCheckAllowsRetry() {
        seedObservation()
        val updater = updater()
        check(updater)
        dialog().getButton(AlertDialog.BUTTON_POSITIVE).performClick()
        settle(updater)
        val error = dialog()
        assertTrue(error.isShowing)
        assertEquals("Обновление недоступно", shadowOf(error).title.toString())
        assertFalse(File(activity.filesDir, "updates/${release.filename}").exists())
        check(updater)
        assertSame("Do not stack a prompt on an unacknowledged failure", error, dialog())
        error.getButton(AlertDialog.BUTTON_POSITIVE).performClick()
        shadowOf(Looper.getMainLooper()).idle()
        check(updater)
        assertTrue(dialog().isShowing)
        assertEquals("Доступно обновление DPoS Space 4.2.0", shadowOf(dialog()).title.toString())
        dialog().getButton(AlertDialog.BUTTON_POSITIVE).performClick()
        settle(updater)
        assertEquals(2, apkRequests)
        assertNull(shadowOf(activity).nextStartedActivity)
    }

    @Test fun downloadImmediatelyShowsAccessibleStatusAndCanBeCancelled() {
        seedObservation()
        holdApk = true
        val updater = updater()
        check(updater)
        dialog().getButton(AlertDialog.BUTTON_POSITIVE).performClick()
        shadowOf(Looper.getMainLooper()).idle()
        assertTrue(apkEntered.await(10, TimeUnit.SECONDS))
        val progress = dialog()
        assertEquals("Загрузка обновления", shadowOf(progress).title.toString())
        assertTrue(progress.isShowing)
        assertEquals("Отмена", progress.getButton(AlertDialog.BUTTON_NEGATIVE).text.toString())
        progress.getButton(AlertDialog.BUTTON_NEGATIVE).performClick()
        settle(updater)
        assertFalse(progress.isShowing)
        assertFalse(File(activity.filesDir, "updates/${release.filename}").exists())
        assertNull(shadowOf(activity).nextStartedActivity)
        check(updater)
        assertEquals("Доступно обновление DPoS Space 4.2.0", shadowOf(dialog()).title.toString())
    }

    @Test fun appDeclaresPermissionForUserConfirmedApkInstallation() {
        val info = activity.packageManager.getPackageInfo(activity.packageName,
            android.content.pm.PackageManager.GET_PERMISSIONS)
        assertTrue(info.requestedPermissions?.contains("android.permission.REQUEST_INSTALL_PACKAGES") == true)
    }

    @Test fun oldPersistentNotificationDoesNotSuppressEligibleRelease() {
        seedObservation()
        prefs.edit().putString("notified", release.id).commit()
        val updater = updater()
        check(updater)
        assertTrue(dialog().isShowing)
        assertEquals(0, apkRequests)
    }

    @Test fun retryStillRequiresDelayProvenanceAndOpenLifecycle() {
        seedObservation(now - ReleasePolicy.DAY + 60_000)
        val updater = updater()
        check(updater)
        assertNull(ShadowAlertDialog.getLatestAlertDialog())
        seedObservation()
        provenanceValid = false
        check(updater)
        assertNull(ShadowAlertDialog.getLatestAlertDialog())
        provenanceValid = true
        updater.check()
        updater.close()
        val worker = NativeUpdater::class.java.getDeclaredField("worker").apply { isAccessible = true }
            .get(updater) as ExecutorService
        assertTrue(worker.awaitTermination(10, TimeUnit.SECONDS))
        shadowOf(Looper.getMainLooper()).idle()
        assertNull(ShadowAlertDialog.getLatestAlertDialog())
        assertEquals(0, apkRequests)
    }
}
