package space.dpos.android.update

import android.content.Context
import android.content.pm.PackageInfo
import android.content.pm.PackageManager
import android.os.Build
import space.dpos.android.BuildConfig
import java.io.File
import java.nio.file.Files
import java.nio.file.LinkOption.NOFOLLOW_LINKS
import java.nio.file.StandardOpenOption
import java.nio.file.attribute.BasicFileAttributes
import java.security.MessageDigest
import java.util.UUID
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

/** Private single-process namespace. All cooperating writers claim before IO, on background threads.
 * Not an atomic inode-conditional unlink primitive against malicious same-UID/root writers.
 */
internal object UpdateStaging {
    const val GRACE = 7 * ReleasePolicy.DAY
    const val MAX_ENTRIES = 64
    const val MAX_ARCHIVES = 4
    const val BUDGET_MS = 250L
    private val lock = Any()
    private data class Lease(val root: BasicFileAttributes, val parent: BasicFileAttributes,
                             var leaf: BasicFileAttributes? = null, var installerReserved: Boolean = false)
    private val leases = mutableMapOf<File, Lease>()
    private val queued = AtomicBoolean()
    private val cleaner = Executors.newSingleThreadExecutor { task ->
        Thread(task, "dpos-update-reclaim").apply { isDaemon = true }
    }
    private val filename = Regex("dpos-space-([0-9]+\\.[0-9]+\\.[0-9]+)\\.apk")
    data class Archive(val packageName: String?, val version: String?, val code: Long, val cert: String?)
    data class Scan(val entries: Int, val archives: Int, val deleted: Int)

    private fun attributes(file: File): BasicFileAttributes =
        Files.readAttributes(file.toPath(), BasicFileAttributes::class.java, NOFOLLOW_LINKS)
    private fun same(file: File, before: BasicFileAttributes): Boolean = runCatching {
        val after = attributes(file)
        before.fileKey() != null && before.fileKey() == after.fileKey() &&
            before.isDirectory == after.isDirectory && before.isRegularFile == after.isRegularFile &&
            !after.isSymbolicLink && file.canonicalFile == file.absoluteFile
    }.getOrDefault(false)
    private fun directory(file: File): BasicFileAttributes {
        val attr = attributes(file)
        require(attr.isDirectory && !attr.isSymbolicLink && attr.fileKey() != null &&
            file.canonicalFile == file.absoluteFile)
        return attr
    }
    private fun regular(file: File): BasicFileAttributes {
        val attr = attributes(file)
        require(attr.isRegularFile && !attr.isSymbolicLink && attr.fileKey() != null &&
            file.canonicalFile == file.absoluteFile &&
            (Files.getAttribute(file.toPath(), "unix:nlink", NOFOLLOW_LINKS) as Number).toLong() == 1L)
        return attr
    }
    private fun attempt(file: File) = runCatching { UUID.fromString(file.name).toString() == file.name }.getOrDefault(false)
    private fun root(file: File): File {
        val parent = requireNotNull(file.parentFile)
        return if (parent.name == "updates") parent else {
            require(attempt(parent))
            requireNotNull(parent.parentFile).also { require(it.name == "updates") }
        }
    }

    /** CREATE_NEW never truncates an unknown leaf. Lease spans writing, ready and installer use. */
    fun claim(file: File) = synchronized(lock) {
        check(!leases.containsKey(file))
        val root = root(file)
        require(!Files.exists(file.toPath(), NOFOLLOW_LINKS))
        if (!root.exists()) require(root.mkdir())
        val rootAttr = directory(root)
        val parent = file.parentFile!!
        if (parent != root) require(parent.mkdir())
        val parentAttr = directory(parent)
        leases[file] = Lease(rootAttr, parentAttr)
    }

    fun output(file: File): java.io.OutputStream = synchronized(lock) {
        val lease = requireNotNull(leases[file])
        require(same(root(file), lease.root) && same(file.parentFile!!, lease.parent) && lease.leaf == null)
        val output = Files.newOutputStream(file.toPath(), StandardOpenOption.WRITE, StandardOpenOption.CREATE_NEW,
            NOFOLLOW_LINKS)
        try {
            lease.leaf = regular(file)
            output
        } catch (error: Exception) { output.close(); throw error }
    }

    // Reserve on IO before posting the installer intent. A cancelled/failed launch may over-retain;
    // no later validation failure or close may delete a URI potentially given to Android.
    fun reserveInstaller(file: File) = synchronized(lock) {
        val lease = requireNotNull(leases[file])
        require(same(root(file), lease.root) && same(file.parentFile!!, lease.parent) &&
            same(file, requireNotNull(lease.leaf)))
        regular(file)
        lease.installerReserved = true
    }

    /** Only a positively owned leaf can be removed without archive identity (including our partials). */
    fun remove(file: File) = synchronized(lock) {
        val lease = leases[file] ?: return@synchronized
        if (lease.installerReserved) return@synchronized
        val root = root(file)
        val parent = file.parentFile!!
        if (!same(root, lease.root) || !same(parent, lease.parent)) return@synchronized
        val leaf = lease.leaf
        if (leaf == null && Files.exists(file.toPath(), NOFOLLOW_LINKS)) return@synchronized
        if (leaf != null && !same(file, leaf)) return@synchronized
        runCatching {
            if (leaf != null) { regular(file); Files.delete(file.toPath()) }
            leases.remove(file)
            if (parent != root && same(parent, lease.parent)) {
                // deleteDirectory is not recursive; unknown siblings cause failure and are retained.
                runCatching { Files.delete(parent.toPath()) }
            }
        }
        Unit
    }

    fun schedule(context: Context) {
        if (!queued.compareAndSet(false, true)) return
        val app = context.applicationContext
        cleaner.execute {
            try { runCatching { clean(app) } } finally { queued.set(false) }
        }
    }

    private fun metadata(info: PackageInfo): Archive {
        val signatures = if (Build.VERSION.SDK_INT >= 28) info.signingInfo?.apkContentsSigners
            else @Suppress("DEPRECATION") info.signatures
        val cert = signatures?.takeIf { it.size == 1 }?.single()?.let {
            MessageDigest.getInstance("SHA-256").digest(it.toByteArray()).joinToString("") { b -> "%02x".format(b.toInt() and 255) }
        }
        val code = if (Build.VERSION.SDK_INT >= 28) info.longVersionCode else @Suppress("DEPRECATION") info.versionCode.toLong()
        return Archive(info.packageName, info.versionName, code, cert)
    }
    private fun clean(context: Context) {
        val flags = if (Build.VERSION.SDK_INT >= 28) PackageManager.GET_SIGNING_CERTIFICATES
            else @Suppress("DEPRECATION") PackageManager.GET_SIGNATURES
        val pm = context.packageManager
        val installed = metadata(pm.getPackageInfo(context.packageName, flags))
        if (installed.packageName != BuildConfig.APPLICATION_ID || installed.cert != BuildConfig.DPOS_HISTORIC_CERT || installed.code <= 0) return
        sweep(File(context.filesDir, "updates"), installed) { file ->
            pm.getPackageArchiveInfo(file.absolutePath, flags)?.let(::metadata)
        }
    }

    /** Soft budget checked between filesystem/PM calls. No recursive walk or array of all entries.
     * A slow individual PM/filesystem call is not interruptible, but never holds the UI/storage queue.
     */
    fun sweep(root: File, installed: Archive, now: Long = System.currentTimeMillis(),
              elapsed: () -> Long = { android.os.SystemClock.elapsedRealtime() },
              inspectRegular: (File) -> BasicFileAttributes = ::regular,
              archive: (File) -> Archive?): Scan = synchronized(lock) {
        var entries = 0
        var archives = 0
        var deleted = 0
        val start = elapsed()
        fun timeLeft() = elapsed() - start < BUDGET_MS
        fun budget() = entries < MAX_ENTRIES && archives < MAX_ARCHIVES && timeLeft()
        try {
            require(installed.packageName == BuildConfig.APPLICATION_ID && installed.cert == BuildConfig.DPOS_HISTORIC_CERT && installed.code > 0)
            val rootAttr = directory(root)
            fun leaf(file: File, parentAttr: BasicFileAttributes) {
                if (!budget() || file in leases) return
                val version = filename.matchEntire(file.name)?.groupValues?.get(1) ?: return
                val before = inspectRegular(file)
                if (before.lastModifiedTime().toMillis() <= 0 || now - before.lastModifiedTime().toMillis() < GRACE) return
                if (!timeLeft()) return
                archives++
                val info = archive(file) ?: return
                if (info.packageName != installed.packageName || info.cert != installed.cert ||
                    info.version != version || info.code <= 0 || info.code >= installed.code) return
                if (!timeLeft() || !same(root, rootAttr) ||
                    !timeLeft() || !same(file.parentFile!!, parentAttr) ||
                    !timeLeft() || !same(file, before) || !timeLeft()) return
                val after = inspectRegular(file)
                if (after.size() != before.size() || after.lastModifiedTime() != before.lastModifiedTime()) return
                if (!timeLeft()) return
                Files.delete(file.toPath())
                deleted++
                val parent = file.parentFile!!
                if (parent != root && timeLeft() && same(root, rootAttr) &&
                    timeLeft() && same(parent, parentAttr) && timeLeft())
                    runCatching { Files.delete(parent.toPath()) }
            }
            Files.newDirectoryStream(root.toPath()).use { stream ->
                val iterator = stream.iterator()
                while (budget() && iterator.hasNext()) {
                    val file = iterator.next().toFile()
                    entries++
                    if (!same(root, rootAttr)) break
                    runCatching {
                        if (attempt(file)) {
                            val parentAttr = directory(file)
                            // Exactly one leaf: ambiguous multi-entry attempts are wholly retained.
                            Files.newDirectoryStream(file.toPath()).use { children ->
                                val child = children.iterator()
                                if (budget() && child.hasNext()) {
                                    val only = child.next().toFile()
                                    entries++
                                    if (budget() && !child.hasNext()) leaf(only, parentAttr)
                                }
                            }
                        } else leaf(file, rootAttr)
                    }
                }
            }
        } catch (_: Exception) { /* Unknown/denied namespace is not cleanup authority. */ }
        Scan(entries, archives, deleted)
    }
}
