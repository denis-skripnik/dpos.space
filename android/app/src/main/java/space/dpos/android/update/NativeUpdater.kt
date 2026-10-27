package space.dpos.android.update

import android.app.Activity
import android.app.AlertDialog
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import androidx.core.content.FileProvider
import space.dpos.android.BuildConfig
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import java.util.UUID
import java.util.concurrent.Executors

/** Connected transfer boundary: signed-feed revocation is checked on both sides of IO. */
internal object UpdateTransfer {
    fun installIntent(activity: Activity, file: File, release: ReleasePolicy.Release): Intent {
        val root = File(activity.filesDir, "updates")
        require(file.name == release.filename &&
            (file.parentFile == root || file.parentFile?.parentFile == root) &&
            file.canonicalFile == file.absoluteFile &&
            !java.nio.file.Files.isSymbolicLink(file.toPath()))
        val uri = FileProvider.getUriForFile(activity, "${BuildConfig.APPLICATION_ID}.updates", file)
        return Intent(Intent.ACTION_VIEW).setDataAndType(uri, "application/vnd.android.package-archive")
            .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
    }

    fun transfer(release: ReleasePolicy.Release, file: File, max: Long,
                 feed: () -> ReleasePolicy.Release, eligible: () -> Boolean,
                 blob: () -> Pair<String, Long>, download: () -> java.io.InputStream,
                 identity: (File) -> Boolean) {
        require(!java.nio.file.Files.isSymbolicLink(file.parentFile!!.toPath()))
        require(file.parentFile!!.isDirectory || file.parentFile!!.mkdirs())
        require(file.parentFile!!.canonicalFile == file.parentFile!!.absoluteFile)
        file.delete()
        try {
            require(feed() == release && eligible())
            val (gitHash, length) = blob()
            require(length in 1..max)
            download().use { input -> file.outputStream().use { output ->
                ReleasePolicy.copyVerified(input, output, length, max, release.sha256, gitHash)
            } }
            require(identity(file))
            require(feed() == release && eligible())
        } catch (error: Exception) {
            file.delete()
            throw error
        }
    }
}

/** Foreground-only updater. No bridge, worker, silent installation or automatic APK fetch. */
class NativeUpdater internal constructor(
    private val activity: Activity,
    private val connection: (URL) -> HttpURLConnection,
    private val publicKey: String,
    private val elapsed: () -> Long = { android.os.SystemClock.elapsedRealtime() }
) {
    constructor(activity: Activity) : this(activity, { it.openConnection() as HttpURLConnection },
        BuildConfig.DPOS_RELEASE_PUBLIC_KEY)
    private val worker = Executors.newSingleThreadExecutor()
    private val main = Handler(Looper.getMainLooper())
    private val prefs by lazy { activity.getSharedPreferences("native_release_312", Activity.MODE_PRIVATE) }
    @Volatile private var busy = false
    @Volatile private var closed = false
    @Volatile private var resumed = false
    @Volatile private var cancelled = false
    @Volatile private var activeConnection: HttpURLConnection? = null
    private var deadline = Long.MAX_VALUE
    private var progress: AlertDialog? = null
    private var dialog: AlertDialog? = null
    private data class Candidate(val release: ReleasePolicy.Release, val file: File)
    private var ready: Candidate? = null
    private var offered: ReleasePolicy.Release? = null
    private var errorPending = false
    private var resumePending = false
    // Deferral belongs to this activity only, not persistent preferences.
    private var notified: String? = null
    private val ownedFiles = mutableListOf<File>() // Main-thread ownership; cleanup is queued on worker.
    private val handedOff = mutableSetOf<File>() // Android installer may still read after Activity destruction.
    private val origin = "https://${ReleasePolicy.HOST}"
    private val manifestUrl = origin + ReleasePolicy.MANIFEST_PATH
    private val maxApk = 80L * 1024 * 1024

    private fun foreground() = resumed && !closed && !activity.isFinishing && !activity.isDestroyed

    fun onResume() {
        if (closed) return
        resumed = true
        if (!busy) presentOrCheck() else resumePending = true
    }

    fun onPause() {
        resumed = false
        resumePending = false
        if (busy) cancelDownload()
        progress?.dismiss()
        dialog?.dismiss()
    }

    private fun presentOrCheck() {
        if (!foreground()) return
        when {
            errorPending -> showError()
            ready != null -> showReady(ready!!)
            offered != null -> prompt(offered!!)
            else -> check()
        }
    }

    private fun begin(): Boolean {
        if (!foreground() || busy) return false
        busy = true
        cancelled = false
        deadline = elapsed() + 5 * 60_000L
        return true
    }

    private fun guard() {
        if (closed || cancelled || !resumed || elapsed() >= deadline)
            throw java.io.IOException("Update cancelled or timed out")
    }

    fun check() {
        if (publicKey.isBlank() || !foreground() || busy || errorPending) return
        ready?.let { showReady(it); return }
        offered?.let { prompt(it); return }
        if (!begin()) return
        worker.execute {
            val result = runCatching {
                val release = verifiedManifest()
                githubBlob(release)
                guard()
                synchronized(observationLock) {
                    guard()
                    val now = System.currentTimeMillis()
                    val oldId = prefs.getString("id", null)
                    val previous = oldId?.let { ReleasePolicy.Observation(it, prefs.getInt("code", 80),
                        prefs.getLong("first", Long.MAX_VALUE), prefs.getLong("last", Long.MAX_VALUE)) }
                    val observation = ReleasePolicy.observe(release, previous, now)
                    if (observation != null) {
                        val saved = prefs.edit().putString("id", observation.id).putInt("code", observation.code)
                            .putLong("first", observation.first).putLong("last", observation.last).commit()
                        guard()
                        if (saved && ReleasePolicy.eligible(release, observation.first, observation.last, now)) release else null
                    } else null
                }
            }
            main.post {
                busy = false
                if (!closed && !cancelled) {
                    result.getOrNull()?.takeIf { notified != it.id }?.let { offered = it }
                    if (foreground() && offered != null) prompt(offered!!)
                }
                resumeAfterCompletion()
            }
        }
    }

    private fun resumeAfterCompletion() {
        if (resumePending && foreground()) {
            resumePending = false
            presentOrCheck()
        }
    }

    private fun prompt(release: ReleasePolicy.Release) {
        if (!foreground() || dialog?.isShowing == true) return
        notified = release.id
        dialog = AlertDialog.Builder(activity).setTitle("Доступно обновление DPoS Space ${release.version}")
            .setMessage("Загрузить проверенный APK? Установка откроется отдельно в Android.")
            .setPositiveButton("Загрузить") { _, _ -> offered = null; download(release) }
            .setNegativeButton("Позже") { _, _ -> offered = null }.show()
    }

    private fun showProgress(title: String, message: String) {
        progress = AlertDialog.Builder(activity).setTitle(title).setMessage(message)
            .setNegativeButton("Отмена") { _, _ -> cancelDownload() }
            .setOnCancelListener { cancelDownload() }.show()
        progress?.findViewById<android.widget.TextView>(android.R.id.message)?.accessibilityLiveRegion =
            android.view.View.ACCESSIBILITY_LIVE_REGION_POLITE
    }

    private fun download(release: ReleasePolicy.Release) {
        if (!begin()) return
        // Never reuse a release filename across attempts or Activity instances.
        val file = File(activity.filesDir, "updates/${UUID.randomUUID()}/${release.filename}")
        ownedFiles += file
        showProgress("Загрузка обновления", "Подготовка загрузки. Проверяем выпуск.")
        worker.execute {
            val result = runCatching {
                var length = 0L
                UpdateTransfer.transfer(release, file, maxApk, ::verifiedManifest,
                    { guard(); eligibleNow(release) },
                    { githubBlob(release).also { length = it.second } },
                    {
                        val conn = open(origin + release.apk, setOf(ReleasePolicy.HOST))
                        try {
                            require(conn.contentLengthLong == -1L || conn.contentLengthLong == length)
                            guardedStream(conn).let { input -> object : java.io.FilterInputStream(input) {
                                private var received = 0L
                                private var lastPercent = -1L
                                override fun read(buffer: ByteArray, offset: Int, count: Int): Int {
                                    val n = super.read(buffer, offset, count)
                                    if (n > 0) {
                                        received += n
                                        val percent = (received * 100 / length).coerceAtMost(100)
                                        if (percent != lastPercent) {
                                            lastPercent = percent
                                            main.post {
                                                if (foreground() && !cancelled) progress?.setMessage(
                                                    "Загружено $percent%. После загрузки проверим APK.")
                                            }
                                        }
                                    }
                                    return n
                                }
                            } }
                        } catch (error: Exception) { conn.disconnect(); throw error }
                    }, { guard(); apkIdentity(it, release) })
                guard()
            }
            if (result.isFailure) removeCandidate(file)
            main.post {
                busy = false
                progress?.dismiss()
                progress = null
                if (!closed) {
                    if (cancelled) {
                        notified = null
                        if (result.isSuccess) worker.execute { removeCandidate(file) }
                    }
                    else if (result.isSuccess) ready = Candidate(release, file)
                    else errorPending = true
                    if (foreground() && !cancelled) presentOrCheck()
                }
                resumeAfterCompletion()
            }
        }
    }

    private fun cancelDownload() {
        cancelled = true
        disconnectActive()
    }

    private fun disconnectActive() {
        val conn = activeConnection ?: return
        // Disconnect may wait on a socket read lock; never perform it on the UI thread.
        Thread({ conn.disconnect() }, "dpos-update-cancel").apply { isDaemon = true }.start()
    }

    private fun showReady(candidate: Candidate) {
        if (!foreground() || dialog?.isShowing == true) return
        dialog = AlertDialog.Builder(activity).setTitle("Обновление загружено")
            .setMessage("APK ${candidate.release.version} проверен. Нажмите «Установить». Если Android запросит разрешение, разрешите установку для DPoS Space и вернитесь в приложение.")
            .setPositiveButton("Установить") { _, _ -> install(candidate) }
            .setNegativeButton("Позже", null).show()
    }

    private fun install(candidate: Candidate) {
        if (!foreground() || busy) return
        if (!activity.packageManager.canRequestPackageInstalls()) {
            runCatching {
                activity.startActivity(Intent(android.provider.Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                    android.net.Uri.parse("package:${activity.packageName}")))
            }.onFailure { errorPending = true; showError() }
            return
        }
        if (!begin()) return
        showProgress("Проверка обновления", "Повторно проверяем APK перед установкой.")
        val (release, file) = candidate
        worker.execute {
            val result = runCatching {
                require(verifiedManifest() == release && eligibleNow(release))
                val (hash, size) = githubBlob(release)
                file.inputStream().use { input ->
                    ReleasePolicy.copyVerified(object : java.io.FilterInputStream(input) {
                        override fun read(buffer: ByteArray, offset: Int, count: Int): Int {
                            guard()
                            return super.read(buffer, offset, count).also { guard() }
                        }
                    }, object : java.io.OutputStream() {
                        override fun write(value: Int) = Unit
                        override fun write(buffer: ByteArray, offset: Int, count: Int) = Unit
                    }, size, maxApk, release.sha256, hash)
                }
                require(apkIdentity(file, release) && verifiedManifest() == release && eligibleNow(release))
                guard()
                // All filesystem/provider resolution runs on IO, not the completion callback.
                UpdateTransfer.installIntent(activity, file, release)
            }
            if (result.isFailure && !cancelled) removeCandidate(file)
            main.post {
                busy = false
                resumePending = false
                progress?.dismiss()
                progress = null
                if (!closed) {
                    if (!cancelled && result.isFailure) { ready = null; errorPending = true }
                    if (foreground()) {
                        if (!cancelled && result.isSuccess && activity.packageManager.canRequestPackageInstalls()) {
                            runCatching { activity.startActivity(result.getOrThrow()); handedOff += file }
                                .onFailure { errorPending = true; showError() }
                        } else presentOrCheck()
                    }
                }
            }
        }
    }

    private fun eligibleNow(release: ReleasePolicy.Release): Boolean = synchronized(observationLock) {
        guard()
        val now = System.currentTimeMillis()
        prefs.getString("id", null) == release.id &&
            ReleasePolicy.eligible(release, prefs.getLong("first", Long.MAX_VALUE),
                prefs.getLong("last", Long.MAX_VALUE), now) && prefs.edit().putLong("last", now).commit()
    }

    companion object {
        // Recreation can overlap two IO executors, but not rollback-clock transactions.
        private val observationLock = Any()
    }

    private fun showError() {
        if (!foreground()) return
        dialog = AlertDialog.Builder(activity).setTitle("Обновление недоступно")
            .setMessage("Проверка выпуска, загрузка или запуск установки не удались. Попробуйте позже.")
            .setPositiveButton("OK") { _, _ -> errorPending = false; notified = null }.show()
    }

    private fun verifiedManifest(): ReleasePolicy.Release = ReleasePolicy.parse(
        readBounded(manifestUrl, setOf(ReleasePolicy.HOST), 8192), publicKey,
        BuildConfig.DPOS_HISTORIC_CERT, BuildConfig.VERSION_CODE)

    private fun githubBlob(release: ReleasePolicy.Release): Pair<String, Long> {
        val api = "https://api.github.com/repos/denis-skripnik/dpos.space"
        return ReleasePolicy.blobMetadata(release,
            String(readBounded("$api/commits/${release.commit}", setOf("api.github.com"), 300_000)),
            String(readBounded("$api/contents/${release.repositoryPath}?ref=${release.commit}",
                setOf("api.github.com"), 300_000)), maxApk)
    }

    private fun apkIdentity(file: File, release: ReleasePolicy.Release): Boolean {
        val flags = if (Build.VERSION.SDK_INT >= 28) PackageManager.GET_SIGNING_CERTIFICATES
            else @Suppress("DEPRECATION") PackageManager.GET_SIGNATURES
        val archive = activity.packageManager.getPackageArchiveInfo(file.absolutePath, flags) ?: return false
        val installed = activity.packageManager.getPackageInfo(activity.packageName, flags)
        fun certificate(info: android.content.pm.PackageInfo): String? {
            val signatures = if (Build.VERSION.SDK_INT >= 28) info.signingInfo?.apkContentsSigners
                else @Suppress("DEPRECATION") info.signatures
            if (signatures == null || signatures.size != 1) return null
            return MessageDigest.getInstance("SHA-256").digest(signatures[0].toByteArray()).hex()
        }
        val code = if (Build.VERSION.SDK_INT >= 28) archive.longVersionCode else @Suppress("DEPRECATION") archive.versionCode.toLong()
        return ReleasePolicy.identity(release, archive.packageName, archive.versionName, code,
            certificate(archive), activity.packageName, BuildConfig.VERSION_CODE, certificate(installed))
    }

    private fun guardedStream(conn: HttpURLConnection): java.io.InputStream {
        guard()
        return object : java.io.FilterInputStream(conn.inputStream) {
            override fun read(buffer: ByteArray, offset: Int, count: Int): Int {
                guard()
                conn.readTimeout = (deadline - elapsed()).coerceIn(1L, 15000L).toInt()
                return super.read(buffer, offset, count).also { guard() }
            }
            override fun read(): Int {
                guard()
                conn.readTimeout = (deadline - elapsed()).coerceIn(1L, 15000L).toInt()
                return super.read().also { guard() }
            }
            override fun close() { try { super.close() } finally { conn.disconnect() } }
        }
    }

    private fun readBounded(url: String, hosts: Set<String>, max: Int): ByteArray {
        val conn = open(url, hosts)
        try {
            return guardedStream(conn).use { input ->
                val out = java.io.ByteArrayOutputStream()
                val buffer = ByteArray(8192)
                while (true) {
                    val n = input.read(buffer)
                    if (n < 0) break
                    require(out.size() + n <= max)
                    out.write(buffer, 0, n)
                }
                out.toByteArray()
            }
        } finally { conn.disconnect() }
    }

    private fun open(address: String, hosts: Set<String>): HttpURLConnection {
        guard()
        val url = URL(address)
        require(url.protocol == "https" && url.host in hosts && url.port == -1 && url.userInfo == null && url.ref == null)
        val conn = connection(url)
        activeConnection = conn
        try {
            guard()
            conn.instanceFollowRedirects = false
            val remaining = (deadline - elapsed()).coerceIn(1L, 15000L).toInt()
            conn.connectTimeout = minOf(8000, remaining)
            conn.readTimeout = remaining
            conn.setRequestProperty("Accept", "application/json, application/octet-stream")
            require(conn.responseCode == 200 && conn.url == url)
            guard()
            return conn
        } catch (error: Exception) {
            conn.disconnect()
            throw error
        }
    }

    private fun ByteArray.hex() = joinToString("") { "%02x".format(it.toInt() and 255) }
    private fun removeCandidate(file: File) { file.delete(); file.parentFile?.delete() }

    fun close() {
        if (closed) return
        closed = true
        resumed = false
        cancelled = true
        disconnectActive()
        // Ordered after the active task: cleanup cannot race a writer, including after recreation.
        val files = ownedFiles.filterNot { it in handedOff }
        worker.execute { files.forEach(::removeCandidate) }
        worker.shutdown()
        progress?.dismiss()
        dialog?.dismiss()
    }
}
