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
import java.util.concurrent.Executors

/** Connected transfer boundary: signed-feed revocation is checked on both sides of IO. */
internal object UpdateTransfer {
    fun installIntent(activity: Activity, file: File, release: ReleasePolicy.Release): Intent {
        val expected = File(activity.filesDir, "updates/${release.filename}")
        require(file.absoluteFile == expected.absoluteFile && !java.nio.file.Files.isSymbolicLink(file.toPath()) &&
            !java.nio.file.Files.isSymbolicLink(file.parentFile!!.toPath()))
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

/** Foreground-only updater. No WebView bridge, worker, silent installation or automatic APK fetch. */
class NativeUpdater internal constructor(
    private val activity: Activity,
    private val connection: (URL) -> HttpURLConnection,
    private val publicKey: String
) {
    constructor(activity: Activity) : this(activity, { it.openConnection() as HttpURLConnection },
        BuildConfig.DPOS_RELEASE_PUBLIC_KEY)
    private val worker = Executors.newSingleThreadExecutor()
    private val main = Handler(Looper.getMainLooper())
    private val prefs = activity.getSharedPreferences("native_release_312", Activity.MODE_PRIVATE)
    @Volatile private var busy = false
    @Volatile private var closed = false
    // Later defers this activity only; foreground checks must not repeatedly nag.
    // Do not reuse the old persistent "notified" marker, which suppressed retries forever.
    @Volatile private var notified: String? = null
    private val origin = "https://${ReleasePolicy.HOST}"
    private val manifestUrl = origin + ReleasePolicy.MANIFEST_PATH
    private val maxApk = 80L * 1024 * 1024

    fun check() {
        if (publicKey.isBlank() || busy || closed) return
        busy = true
        worker.execute {
          try {
            val release = runCatching { verifiedManifest() }.getOrNull()
            if (release != null) {
                val now = System.currentTimeMillis()
                // Verify that this is a public immutable GitHub commit carrying an APK;
                // this is source/artifact linkage, NOT proof of reproducible build.
                val linked = runCatching { githubBlob(release) }.isSuccess
                val oldId = prefs.getString("id", null)
                // Keep the existing store; observations from the old fixed updater were code 80.
                val previous = oldId?.let { ReleasePolicy.Observation(it, prefs.getInt("code", 80),
                    prefs.getLong("first", Long.MAX_VALUE), prefs.getLong("last", Long.MAX_VALUE)) }
                val observation = ReleasePolicy.observe(release, previous, now)
                if (linked && observation != null && !closed) {
                    val saved = prefs.edit().putString("id", observation.id).putInt("code", observation.code)
                        .putLong("first", observation.first).putLong("last", observation.last).commit()
                    if (saved && ReleasePolicy.eligible(release, observation.first, observation.last, now) &&
                        notified != release.id) {
                        main.post {
                            if (!closed && !activity.isFinishing && !activity.isDestroyed &&
                                notified != release.id) {
                                notified = release.id
                                prompt(release)
                            }
                        }
                    }
                }
            }
          } finally { busy = false }
        }
    }

    private fun prompt(release: ReleasePolicy.Release) {
        AlertDialog.Builder(activity).setTitle("Доступно обновление DPoS Space ${release.version}")
            .setMessage("Загрузить проверенный APK? Установка откроется отдельно в Android.")
            .setPositiveButton("Загрузить") { _, _ -> download(release) }
            .setNegativeButton("Позже", null).show()
    }

    private fun download(release: ReleasePolicy.Release) {
        if (busy || closed) return
        busy = true
        worker.execute {
            val file = File(activity.filesDir, "updates/${release.filename}")
            val result = runCatching {
                var length = 0L
                UpdateTransfer.transfer(release, file, maxApk, ::verifiedManifest,
                    { eligibleNow(release) },
                    { githubBlob(release).also { length = it.second } },
                    {
                        val conn = open(origin + release.apk, setOf(ReleasePolicy.HOST))
                        try {
                            require(conn.contentLengthLong == -1L || conn.contentLengthLong == length)
                            object : java.io.FilterInputStream(conn.inputStream) {
                                override fun close() { try { super.close() } finally { conn.disconnect() } }
                            }
                        } catch (error: Exception) { conn.disconnect(); throw error }
                    }, { apkIdentity(it, release) })
                true
            }
            main.post {
                busy = false
                if (!closed && !activity.isFinishing && !activity.isDestroyed) {
                    if (result.isSuccess && eligibleNow(release)) {
                        runCatching {
                            activity.startActivity(UpdateTransfer.installIntent(activity, file, release))
                        }.onFailure { file.delete(); showError() }
                    } else { file.delete(); showError() }
                } else file.delete()
            }
        }
    }

    private fun eligibleNow(release: ReleasePolicy.Release): Boolean {
        val now = System.currentTimeMillis()
        return !closed && prefs.getString("id", null) == release.id &&
            ReleasePolicy.eligible(release, prefs.getLong("first", Long.MAX_VALUE),
                prefs.getLong("last", Long.MAX_VALUE), now) && prefs.edit().putLong("last", now).commit()
    }

    private fun showError() {
        AlertDialog.Builder(activity).setTitle("Обновление недоступно")
            .setMessage("Проверка выпуска или загрузка не удалась. Попробуйте позже.")
            .setPositiveButton("OK", null)
            // Allow a later foreground check to retry, never an automatic download/prompt loop.
            .setOnDismissListener { notified = null }.show()
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
        val flags = PackageManager.GET_SIGNING_CERTIFICATES
        val archive = activity.packageManager.getPackageArchiveInfo(file.absolutePath, flags) ?: return false
        val installed = activity.packageManager.getPackageInfo(activity.packageName, flags)
        fun certificate(info: android.content.pm.PackageInfo): String? {
            val signatures = info.signingInfo?.apkContentsSigners ?: return null
            if (signatures.size != 1) return null
            return MessageDigest.getInstance("SHA-256").digest(signatures[0].toByteArray()).hex()
        }
        val code = if (Build.VERSION.SDK_INT >= 28) archive.longVersionCode else @Suppress("DEPRECATION") archive.versionCode.toLong()
        return ReleasePolicy.identity(release, archive.packageName, archive.versionName, code,
            certificate(archive), activity.packageName, BuildConfig.VERSION_CODE, certificate(installed))
    }

    private fun readBounded(url: String, hosts: Set<String>, max: Int): ByteArray = open(url, hosts).use { conn ->
        conn.inputStream.use { input ->
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
    }

    private fun open(address: String, hosts: Set<String>): HttpURLConnection {
        val url = URL(address)
        require(url.protocol == "https" && url.host in hosts && url.port == -1 && url.userInfo == null && url.ref == null)
        val conn = connection(url)
        conn.instanceFollowRedirects = false
        conn.connectTimeout = 8000
        conn.readTimeout = 15000
        conn.setRequestProperty("Accept", "application/json, application/octet-stream")
        try {
            require(conn.responseCode == 200 && conn.url == url)
            return conn
        } catch (error: Exception) {
            conn.disconnect()
            throw error
        }
    }

    private fun ByteArray.hex() = joinToString("") { "%02x".format(it.toInt() and 255) }
    fun close() { closed = true; worker.shutdownNow() }
    private inline fun <T> HttpURLConnection.use(block: (HttpURLConnection) -> T): T =
        try { block(this) } finally { disconnect() }
}
