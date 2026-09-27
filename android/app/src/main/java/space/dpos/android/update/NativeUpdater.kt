package space.dpos.android.update

import android.app.Activity
import android.app.AlertDialog
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import androidx.core.content.FileProvider
import org.json.JSONObject
import space.dpos.android.BuildConfig
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import java.util.concurrent.Executors

/** Connected transfer boundary: signed-feed revocation is checked on both sides of IO. */
internal object UpdateTransfer {
    fun installIntent(activity: Activity, file: File): Intent {
        val expected = File(activity.filesDir, "updates/dpos-space-3.1.2.apk")
        require(file.absoluteFile == expected.absoluteFile && !java.nio.file.Files.isSymbolicLink(file.toPath()) &&
            !java.nio.file.Files.isSymbolicLink(file.parentFile.toPath()))
        val uri = FileProvider.getUriForFile(activity, "${BuildConfig.APPLICATION_ID}.updates", file)
        return Intent(Intent.ACTION_VIEW).setDataAndType(uri, "application/vnd.android.package-archive")
            .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
    }

    fun transfer(release: ReleasePolicy.Release, file: File, max: Long,
                 feed: () -> ReleasePolicy.Release, eligible: () -> Boolean,
                 blob: () -> Pair<String, Long>, download: () -> java.io.InputStream,
                 identity: (File) -> Boolean) {
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
class NativeUpdater(private val activity: Activity) {
    private val worker = Executors.newSingleThreadExecutor()
    private val main = Handler(Looper.getMainLooper())
    private val prefs = activity.getSharedPreferences("native_release_312", Activity.MODE_PRIVATE)
    @Volatile private var busy = false
    private val origin = "https://${ReleasePolicy.HOST}"
    private val manifestUrl = origin + ReleasePolicy.MANIFEST_PATH
    private val maxApk = 80L * 1024 * 1024

    fun check() {
        if (BuildConfig.DPOS_RELEASE_PUBLIC_KEY.isBlank() || busy) return
        busy = true
        worker.execute {
          try {
            val release = runCatching { verifiedManifest() }.getOrNull()
            if (release != null) {
                val now = System.currentTimeMillis()
                // Verify that this is a public immutable GitHub commit carrying an APK;
                // this is source/artifact linkage, NOT proof of reproducible build.
                val linked = runCatching { githubBlob(release.commit) }.isSuccess
                val oldId = prefs.getString("id", null)
                // A changed manifest never resets the wait window; only one immutable identity
                // is accepted for this release version. Re-signing requires a newer version.
                if (linked && now >= release.published && (oldId == null || oldId == release.id)) {
                    val first = if (oldId == null) now else prefs.getLong("first", now)
                    val last = if (oldId == null) now else prefs.getLong("last", now)
                    if (now >= last) {
                        val saved = prefs.edit().putString("id", release.id).putLong("first", first)
                            .putLong("last", now).commit()
                        if (saved && ReleasePolicy.eligible(release, first, last, now) &&
                            prefs.getString("notified", null) != release.id) {
                            main.post {
                                if (!activity.isFinishing && !activity.isDestroyed &&
                                    prefs.getString("notified", null) != release.id &&
                                    prefs.edit().putString("notified", release.id).commit()) prompt(release)
                            }
                        }
                    }
                }
            }
          } finally { busy = false }
        }
    }

    private fun prompt(release: ReleasePolicy.Release) {
        AlertDialog.Builder(activity).setTitle("Доступно обновление DPoS Space 3.1.2")
            .setMessage("Загрузить проверенный APK? Установка откроется отдельно в Android.")
            .setPositiveButton("Загрузить") { _, _ -> download(release) }
            .setNegativeButton("Позже", null).show()
    }

    private fun download(release: ReleasePolicy.Release) {
        if (busy) return
        busy = true
        worker.execute {
            val file = File(activity.filesDir, "updates/dpos-space-3.1.2.apk")
            val result = runCatching {
                var length = 0L
                UpdateTransfer.transfer(release, file, maxApk, ::verifiedManifest,
                    { ReleasePolicy.eligible(release, prefs.getLong("first", Long.MAX_VALUE),
                        prefs.getLong("last", Long.MAX_VALUE), System.currentTimeMillis()) },
                    { githubBlob(release.commit).also { length = it.second } },
                    {
                        val conn = open(origin + ReleasePolicy.APK_PATH, setOf(ReleasePolicy.HOST))
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
                if (!activity.isFinishing && !activity.isDestroyed) {
                    if (result.isSuccess) {
                        runCatching {
                            activity.startActivity(UpdateTransfer.installIntent(activity, file))
                        }.onFailure { file.delete(); showError() }
                    } else showError()
                }
            }
        }
    }

    private fun showError() {
        AlertDialog.Builder(activity).setTitle("Обновление недоступно")
            .setMessage("Проверка выпуска или загрузка не удалась. Попробуйте позже.")
            .setPositiveButton("OK", null).show()
    }

    private fun verifiedManifest(): ReleasePolicy.Release = ReleasePolicy.parse(
        readBounded(manifestUrl, setOf(ReleasePolicy.HOST), 8192), BuildConfig.DPOS_RELEASE_PUBLIC_KEY,
        BuildConfig.DPOS_HISTORIC_CERT, BuildConfig.VERSION_CODE)

    private fun githubBlob(commit: String): Pair<String, Long> {
        val api = "https://api.github.com/repos/denis-skripnik/dpos.space"
        val sha = JSONObject(String(readBounded("$api/commits/$commit", setOf("api.github.com"), 300_000)))
            .getString("sha")
        require(sha == commit)
        val content = JSONObject(String(readBounded("$api/contents/downloads/dpos-space-3.1.2.apk?ref=$commit",
            setOf("api.github.com"), 300_000)))
        require(content.getString("path") == "downloads/dpos-space-3.1.2.apk" && content.getString("type") == "file")
        val blob = content.getString("sha")
        val size = content.getLong("size")
        require(Regex("[0-9a-f]{40}").matches(blob) && size in 1..maxApk)
        return blob to size
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
        return archive.packageName == activity.packageName && archive.versionName == "3.1.2" &&
            code == release.code.toLong() && code > BuildConfig.VERSION_CODE &&
            certificate(archive) == release.certificate && certificate(installed) == release.certificate
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
        val conn = url.openConnection() as HttpURLConnection
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
    fun close() { worker.shutdownNow() }
    private inline fun <T> HttpURLConnection.use(block: (HttpURLConnection) -> T): T =
        try { block(this) } finally { disconnect() }
}
