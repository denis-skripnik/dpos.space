package space.dpos.android

import android.app.Activity
import android.app.Application
import android.content.Context
import android.content.SharedPreferences
import android.os.Handler
import android.os.Looper
import androidx.test.core.app.ApplicationProvider
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import space.dpos.android.bridge.BridgeRequest
import space.dpos.android.bridge.DposAndroidBridge
import space.dpos.android.storage.WorkerStore
import space.dpos.android.worker.WorkerCancellation
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger

@RunWith(RobolectricTestRunner::class)
@Config(application = Application::class)
class MainCommitResponsivenessTest {
    @Test fun ordinaryCommitCannotBlockEntryCompletionHeartbeatOrPromptStop() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        WorkerCancellation.resetForTest()
        if (runCatching { androidx.work.WorkManager.getInstance(context) }.isFailure)
            androidx.work.WorkManager.initialize(context, androidx.work.Configuration.Builder().build())
        val entered = CountDownLatch(1)
        val release = CountDownLatch(1)
        val armed = AtomicBoolean(false)
        val raw = context.getSharedPreferences("dpos_worker", Context.MODE_PRIVATE)
        val intercepted = object : SharedPreferences by raw {
            override fun edit(): SharedPreferences.Editor {
                val editor = raw.edit()
                return object : SharedPreferences.Editor by editor {
                    override fun commit(): Boolean {
                        if (armed.get() && Thread.currentThread().name == "ordinary-commit-owner") {
                            entered.countDown()
                            check(release.await(10, TimeUnit.SECONDS))
                        }
                        return editor.commit()
                    }
                }
            }
        }
        val store = WorkerStore(context, raw, intercepted)
        val activity = Robolectric.buildActivity(Activity::class.java).setup().get()
        val bridge = DposAndroidBridge(activity, store) { store.checkpointStatus() }
        armed.set(true)
        // This uses the real CheckpointPreferences.apply == commit under the authority lock.
        val writer = Thread({ store.setLastError("ordinary commit fixture") }, "ordinary-commit-owner")
        writer.start()
        assertTrue(entered.await(5, TimeUnit.SECONDS))
        val returned = CountDownLatch(1)
        val main = Thread.currentThread()
        val watchdog = Thread {
            if (!returned.await(800, TimeUnit.MILLISECONDS)) {
                System.err.println("ORDINARY COMMIT MAIN STACK\n" + main.stackTrace.joinToString("\n"))
                release.countDown()
            }
        }
        watchdog.start()
        val replies = AtomicInteger(0)
        try {
            val old = WorkerCancellation.token { true }
            bridge.dispatch(BridgeRequest("stop", "stopWorker", JSONObject())) { replies.incrementAndGet() }
            assertFalse(old.mayContinue())
            assertFalse("new runs are barred until revocation is persisted", WorkerCancellation.token { true }.mayContinue())
            bridge.dispatch(BridgeRequest("info", "getAppInfo", JSONObject())) { replies.incrementAndGet() }
            val heartbeat = AtomicBoolean(false)
            Handler(Looper.getMainLooper()).post { heartbeat.set(true) }
            shadowOf(Looper.getMainLooper()).idle()
            assertTrue(heartbeat.get())
            assertEquals(1, replies.get()) // Cheap metadata is independent of pending IO.
            assertEquals("main waited for ordinary commit", 1L, release.count)
        } finally {
            returned.countDown(); release.countDown(); writer.join(5000); watchdog.join(5000)
            awaitNativeStorage()
            bridge.close()
        }
        assertFalse(writer.isAlive)
        assertEquals(2, replies.get())
        assertFalse(WorkerStore(context).workerEnabled())
        assertTrue("durable revocation barrier clears after success", WorkerCancellation.token { true }.mayContinue())
    }
}
