package space.dpos.android

import android.app.Activity
import android.os.Handler
import android.os.Looper
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import space.dpos.android.update.NativeUpdater
import space.dpos.android.update.UpdateStaging
import java.io.File
import java.nio.file.Files
import java.util.UUID
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [26, 34])
class UpdateStagingTest {
    private val activity = Robolectric.buildActivity(Activity::class.java).setup().get()
    private val root = File(activity.filesDir, "updates").apply { mkdirs() }
    private val now = System.currentTimeMillis()
    private val installed = UpdateStaging.Archive(BuildConfig.APPLICATION_ID, "3.1.6", 84, BuildConfig.DPOS_HISTORIC_CERT)
    private val old = installed.copy(version = "3.1.5", code = 83)
    private fun file(path: String = "dpos-space-3.1.5.apk") = File(root, path).apply {
        parentFile!!.mkdirs(); writeText("synthetic archive payload"); assertTrue(setLastModified(now - UpdateStaging.GRACE - 1000))
    }
    private fun scan(identity: (File) -> UpdateStaging.Archive? = { old }) =
        UpdateStaging.sweep(root, installed, now, { 0L }, archive = identity)

    @Test fun legacyAndCanonicalAttemptOldArchivesAreRemovedButNeverRoot() {
        val flat = file()
        val attempt = file("${UUID.randomUUID()}/dpos-space-3.1.5.apk")
        val result = scan()
        assertEquals(2, result.deleted)
        assertFalse(flat.exists()); assertFalse(attempt.exists()); assertFalse(attempt.parentFile!!.exists())
        assertTrue(root.isDirectory)
    }

    @Test fun currentFutureAndRecentArchivesAreKept() {
        val current = file("dpos-space-3.1.6.apk")
        val future = file("${UUID.randomUUID()}/dpos-space-4.2.0.apk")
        val recent = file().apply { setLastModified(now - 1000) }
        val result = scan { if (it == current) installed else installed.copy(version = "4.2.0", code = 140) }
        assertEquals(0, result.deleted)
        assertTrue(listOf(current, future, recent).all { it.exists() })
    }

    @Test fun unknownPartialsNamesFoldersAndNonUpdaterDataAreUntouched() {
        val files = listOf(file("partial.apk"), file("dpos-space-3.1.5.apk.part"), file("my.apk"),
            file("not-an-attempt/dpos-space-3.1.5.apk"), file("${UUID.randomUUID()}/settings.json"),
            file("dpos-space-3.1.5.apk"))
        val keys = File(activity.filesDir, "keys/key.txt").apply { parentFile!!.mkdirs(); writeText("fixture data") }
        assertEquals(0, scan { null }.deleted)
        assertTrue(files.all { it.exists() }); assertEquals("fixture data", keys.readText())
    }

    @Test fun ambiguousAttemptWithUnknownSiblingIsWhollyRetained() {
        val apk = file("${UUID.randomUUID()}/dpos-space-3.1.5.apk")
        val sibling = File(apk.parentFile, "unknown.part").apply { writeText("unknown") }
        assertEquals(0, scan().deleted)
        assertTrue(apk.exists()); assertEquals("unknown", sibling.readText())
    }

    @Test fun wrongPackageCertVersionCodeAndArchiveFailuresAreKept() {
        val apk = file()
        listOf(old.copy(packageName = "other.app"), old.copy(cert = "bad"), old.copy(version = "3.1.4"),
            old.copy(code = 0), old.copy(code = 84), old.copy(code = 85), null).forEach { identity ->
            assertEquals(0, scan { identity }.deleted); assertTrue(apk.exists())
        }
        assertEquals(0, scan { throw SecurityException("fixture denied archive read") }.deleted)
        assertTrue(apk.exists())
        assertEquals(0, UpdateStaging.sweep(root, installed.copy(cert = "bad"), now, { 0L }) { old }.deleted)
    }

    @Test fun symlinkLeavesDirectoriesAndHardlinksAreKeptWithoutFollowing() {
        val outside = File(activity.filesDir, "outside").apply { mkdirs() }
        val target = File(outside, "dpos-space-3.1.5.apk").apply { writeText("outside data"); setLastModified(now - UpdateStaging.GRACE - 1000) }
        val link = File(root, "dpos-space-3.1.5.apk")
        Files.createSymbolicLink(link.toPath(), target.toPath())
        val dirLink = File(root, UUID.randomUUID().toString())
        Files.createSymbolicLink(dirLink.toPath(), outside.toPath())
        val hard = File(root, "dpos-space-3.1.4.apk")
        Files.createLink(hard.toPath(), target.toPath())
        var archiveReads = 0
        assertEquals(0, scan { archiveReads++; old }.deleted)
        assertEquals(0, archiveReads)
        assertTrue(Files.isSymbolicLink(link.toPath())); assertTrue(Files.isSymbolicLink(dirLink.toPath()))
        assertTrue(hard.exists()); assertEquals("outside data", target.readText())
    }

    @Test fun linkedRootAndSpecialLeafAreNotCleanupAuthority() {
        val outside = File(activity.filesDir, "outside").apply { mkdirs() }
        root.delete()
        Files.createSymbolicLink(root.toPath(), outside.toPath())
        val target = file()
        assertEquals(0, scan().deleted); assertTrue(target.exists())
        Files.delete(root.toPath()); root.mkdir()
        val fifo = File(root, "dpos-space-3.1.5.apk")
        val process = ProcessBuilder("mkfifo", fifo.absolutePath).start()
        assertEquals(0, process.waitFor())
        assertEquals(0, scan().deleted)
        assertTrue(Files.exists(fifo.toPath()))
    }

    @Test fun deniedDirectoryDeletionKeepsVerifiedApk() {
        val apk = file()
        val permissions = Files.getPosixFilePermissions(root.toPath())
        try {
            Files.setPosixFilePermissions(root.toPath(), java.nio.file.attribute.PosixFilePermissions.fromString("r-x------"))
            assertEquals(0, scan().deleted)
            assertTrue(apk.exists())
        } finally { Files.setPosixFilePermissions(root.toPath(), permissions) }
    }

    @Test fun replacementWithActualSymlinkDuringArchiveCheckFailsClosed() {
        val apk = file()
        val outside = File(activity.filesDir, "outside.txt").apply { writeText("not updater data") }
        val retained = File(root, "unrecognized-retained")
        assertEquals(0, scan {
            Files.move(apk.toPath(), retained.toPath())
            Files.createSymbolicLink(apk.toPath(), outside.toPath())
            old
        }.deleted)
        assertTrue(Files.isSymbolicLink(apk.toPath())); assertTrue(retained.exists())
        assertEquals("not updater data", outside.readText())
    }

    @Test fun parentReplacementDuringArchiveCheckFailsClosed() {
        val apk = file("${UUID.randomUUID()}/dpos-space-3.1.5.apk")
        val saved = File(root, "saved-parent")
        assertEquals(0, scan {
            Files.move(apk.parentFile!!.toPath(), saved.toPath())
            apk.parentFile!!.mkdir()
            File(apk.parentFile, apk.name).writeText("replacement data")
            old
        }.deleted)
        assertTrue(File(saved, apk.name).exists()); assertEquals("replacement data", apk.readText())
    }

    @Test fun largeInventoryHasFixedEntryAndArchiveBounds() {
        repeat(1000) { file("unknown-$it") }
        val result = scan()
        assertTrue(result.entries <= UpdateStaging.MAX_ENTRIES)
        assertEquals(0, result.archives); assertEquals(0, result.deleted)
        root.listFiles()!!.forEach { it.delete() }
        repeat(20) { file("${UUID.randomUUID()}/dpos-space-3.1.5.apk") }
        val archives = scan()
        assertEquals(UpdateStaging.MAX_ARCHIVES, archives.archives)
        assertEquals(UpdateStaging.MAX_ARCHIVES, archives.deleted)
    }

    @Test fun timeBudgetStopsBeforeArchiveAfterSlowFileInspection() {
        val apk = file()
        var clock = 0L
        var archiveRead = false
        val result = UpdateStaging.sweep(root, installed, now, { clock }, inspectRegular = {
            Files.readAttributes(it.toPath(), java.nio.file.attribute.BasicFileAttributes::class.java,
                java.nio.file.LinkOption.NOFOLLOW_LINKS).also { clock = UpdateStaging.BUDGET_MS }
        }) { archiveRead = true; old }
        assertFalse(archiveRead)
        assertEquals(0, result.archives); assertEquals(0, result.deleted); assertTrue(apk.exists())
    }

    @Test fun timeBudgetStopsBeforeDeleteAfterSlowFinalValidation() {
        val apk = file()
        var clock = 0L
        var archiveRead = false
        val result = UpdateStaging.sweep(root, installed, now, { clock }, inspectRegular = {
            Files.readAttributes(it.toPath(), java.nio.file.attribute.BasicFileAttributes::class.java,
                java.nio.file.LinkOption.NOFOLLOW_LINKS).also {
                if (archiveRead) clock = UpdateStaging.BUDGET_MS
            }
        }) { archiveRead = true; old }
        assertTrue(archiveRead)
        assertEquals(UpdateStaging.BUDGET_MS, clock)
        assertEquals(1, result.archives); assertEquals(0, result.deleted); assertTrue(apk.exists())
        assertEquals("synthetic archive payload", apk.readText())
    }

    @Test fun timeBudgetStopsBeforeDeleteAfterSlowArchiveBoundary() {
        val apk = file()
        var clock = 0L
        val result = UpdateStaging.sweep(root, installed, now, { clock }) {
            clock = UpdateStaging.BUDGET_MS + 1; old
        }
        assertEquals(1, result.archives); assertEquals(0, result.deleted); assertTrue(apk.exists())
    }

    @Test fun leasesProtectWriterReadyAndReservedInstallerEvenWhenOld() {
        val apk = File(root, "${UUID.randomUUID()}/dpos-space-3.1.5.apk")
        UpdateStaging.claim(apk)
        UpdateStaging.output(apk).use { it.write("owned partial".toByteArray()) }
        apk.setLastModified(now - UpdateStaging.GRACE - 1000)
        assertEquals(0, scan().deleted)
        assertEquals("owned partial", apk.readText())
        UpdateStaging.reserveInstaller(apk)
        UpdateStaging.remove(apk)
        assertEquals(0, scan().deleted)
        assertTrue(apk.exists())
    }

    @Test fun ownedPartialRemovalCannotDeleteReplacementOrOtherSiblings() {
        val apk = File(root, "${UUID.randomUUID()}/dpos-space-3.1.5.apk")
        UpdateStaging.claim(apk)
        val sibling = File(apk.parentFile, "userdata").apply { writeText("keep") }
        UpdateStaging.remove(apk)
        assertFalse(apk.exists()); assertEquals("keep", sibling.readText()); assertTrue(apk.parentFile!!.exists())
        val second = File(root, "${UUID.randomUUID()}/dpos-space-3.1.5.apk")
        UpdateStaging.claim(second)
        UpdateStaging.output(second).close()
        val saved = File(second.parentFile, "retained-owned")
        Files.move(second.toPath(), saved.toPath())
        Files.createSymbolicLink(second.toPath(), sibling.toPath())
        UpdateStaging.remove(second)
        assertTrue(Files.isSymbolicLink(second.toPath())); assertTrue(saved.exists()); assertEquals("keep", sibling.readText())
    }

    @Test fun unknownPreexistingLeafIsNeverClaimedOrTruncated() {
        val apk = file()
        try { UpdateStaging.claim(apk); fail("claimed unknown file") } catch (_: IllegalArgumentException) { }
        UpdateStaging.remove(apk)
        assertEquals("synthetic archive payload", apk.readText())
    }

    @Test fun writerTransitionRejectsChangedParentAndUnexpectedLeaf() {
        val apk = File(root, "${UUID.randomUUID()}/dpos-space-3.1.5.apk")
        UpdateStaging.claim(apk)
        val outside = File(activity.filesDir, "outside").apply { mkdirs() }
        val target = File(outside, apk.name).apply { writeText("outside data") }
        val retained = File(root, "retained-attempt")
        Files.move(apk.parentFile!!.toPath(), retained.toPath())
        Files.createSymbolicLink(apk.parentFile!!.toPath(), outside.toPath())
        try { UpdateStaging.output(apk).close(); fail("writer followed changed parent") }
        catch (_: IllegalArgumentException) { }
        UpdateStaging.remove(apk)
        assertEquals("outside data", target.readText())
        assertTrue(Files.isSymbolicLink(apk.parentFile!!.toPath()))
        val second = File(root, "${UUID.randomUUID()}/dpos-space-3.1.5.apk")
        UpdateStaging.claim(second)
        second.writeText("unexpected file")
        try { UpdateStaging.output(second).close(); fail("writer truncated unexpected leaf") }
        catch (_: java.nio.file.FileAlreadyExistsException) { }
        UpdateStaging.remove(second)
        assertEquals("unexpected file", second.readText())
    }

    @Test fun heldCleanupDoesNotBlockRealResumeHeartbeatOrCheckWorkerAndClaimsSerialize() {
        file()
        val entered = CountDownLatch(1)
        val release = CountDownLatch(1)
        val workers = Executors.newFixedThreadPool(2)
        val updater = NativeUpdater(activity, { throw java.io.IOException("offline fixture") }, "fixture-pin")
        val claimant = File(root, "${UUID.randomUUID()}/dpos-space-3.1.4.apk")
        try {
            val cleanup = workers.submit { scan { entered.countDown(); check(release.await(10, TimeUnit.SECONDS)); old } }
            assertTrue(entered.await(10, TimeUnit.SECONDS))
            val claimStarted = CountDownLatch(1)
            val claim = workers.submit { claimStarted.countDown(); UpdateStaging.claim(claimant) }
            assertTrue(claimStarted.await(10, TimeUnit.SECONDS))
            updater.onResume()
            var heartbeat = false
            Handler(Looper.getMainLooper()).post { heartbeat = true }
            shadowOf(Looper.getMainLooper()).idle()
            assertTrue(heartbeat)
            val worker = NativeUpdater::class.java.getDeclaredField("worker").apply { isAccessible = true }
                .get(updater) as java.util.concurrent.ExecutorService
            worker.submit {}.get(5, TimeUnit.SECONDS) // update network queue is not cleanup queue
            assertFalse(claim.isDone); assertFalse(claimant.exists())
            release.countDown(); cleanup.get(10, TimeUnit.SECONDS); claim.get(10, TimeUnit.SECONDS)
            assertTrue(claimant.parentFile!!.isDirectory)
            UpdateStaging.output(claimant).close()
            assertTrue(claimant.exists()); UpdateStaging.remove(claimant)
        } finally {
            release.countDown(); updater.close(); workers.shutdown()
            assertTrue(workers.awaitTermination(10, TimeUnit.SECONDS))
            val worker = NativeUpdater::class.java.getDeclaredField("worker").apply { isAccessible = true }
                .get(updater) as java.util.concurrent.ExecutorService
            assertTrue(worker.awaitTermination(10, TimeUnit.SECONDS))
        }
    }
}
