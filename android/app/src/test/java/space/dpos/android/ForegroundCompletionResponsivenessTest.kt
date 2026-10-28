package space.dpos.android

import android.app.Activity
import android.app.Application
import android.content.Context
import android.content.ContextWrapper
import android.content.Intent
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
import org.robolectric.util.ReflectionHelpers
import space.dpos.android.bridge.BridgeRequest
import space.dpos.android.bridge.DposAndroidBridge
import space.dpos.android.worker.DposForegroundService
import space.dpos.android.worker.WorkerCancellation
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean

@RunWith(RobolectricTestRunner::class)
@Config(application = Application::class, sdk = [34])
class ForegroundCompletionResponsivenessTest {
    @Test fun completionCommitKeepsUiResponsiveAndFeatureRevocationDoesNotStrandTheService() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        WorkerCancellation.resetForTest()
        if (runCatching { androidx.work.WorkManager.getInstance(context) }.isFailure)
            androidx.work.WorkManager.initialize(context, androidx.work.Configuration.Builder().build())
        val entered = CountDownLatch(1)
        val release = CountDownLatch(1)
        val armed = AtomicBoolean(true)
        val raw = context.getSharedPreferences("dpos_worker", Context.MODE_PRIVATE)
        val completionPrefs = object : SharedPreferences by raw {
            override fun edit(): SharedPreferences.Editor {
                val editor = raw.edit()
                var summary = false
                return object : SharedPreferences.Editor by editor {
                    override fun putString(key: String, value: String?): SharedPreferences.Editor {
                        if (key == "lastRunSummary") summary = true
                        editor.putString(key, value)
                        return this
                    }
                    override fun commit(): Boolean {
                        if (summary && armed.compareAndSet(true, false)) {
                            entered.countDown()
                            check(release.await(10, TimeUnit.SECONDS))
                        }
                        return editor.commit()
                    }
                }
            }
        }
        val controller = Robolectric.buildService(DposForegroundService::class.java)
        val service = controller.get()
        val base = service.baseContext
        ReflectionHelpers.setField(service, "mBase", object : ContextWrapper(base) {
            override fun getSharedPreferences(name: String, mode: Int): SharedPreferences =
                if (name == "dpos_worker") completionPrefs else super.getSharedPreferences(name, mode)
        })
        val activity = Robolectric.buildActivity(Activity::class.java).setup().get()
        val bridge = DposAndroidBridge(activity) { JSONObject() }
        val returned = CountDownLatch(1)
        val main = Thread.currentThread()
        val watchdog = Thread {
            if (!returned.await(1500, TimeUnit.MILLISECONDS)) {
                System.err.println("COMPLETION COMMIT MAIN STACK\n" + main.stackTrace.joinToString("\n"))
                release.countDown()
            }
        }
        try {
            controller.create()
            service.onStartCommand(Intent().setAction(DposForegroundService.ACTION_START), 0, 1)
            awaitNativeStorage()
            assertTrue("real runner did not reach completion commit", entered.await(5, TimeUnit.SECONDS))
            watchdog.start()
            val done = CountDownLatch(1)
            var replies = 0
            bridge.dispatch(BridgeRequest("disable-one", "syncVizSelfAwardSettings", JSONObject()
                .put("account", "alice").put("enabled", false))) { replies++; done.countDown() }
            val progress = AtomicBoolean(false)
            Handler(Looper.getMainLooper()).post { progress.set(true) }
            shadowOf(Looper.getMainLooper()).idle()
            assertTrue(progress.get())
            assertEquals(1L, release.count)
            returned.countDown()
            release.countDown()
            watchdog.join(5000)
            awaitNativeStorage()
            assertTrue(done.await(5, TimeUnit.SECONDS))
            assertEquals(1, replies)
            val handler = ReflectionHelpers.getField<Handler>(service, "handler")
            val tick = ReflectionHelpers.getField<Runnable>(service, "tick")
            // A feature disable cancels the old run, not the still-enabled service cadence.
            // This is the actual no-account runner: no key, fake runtime or RPC is involved.
            awaitUiCondition { handler.hasCallbacks(tick) }
            assertTrue(raw.getBoolean("worker_enabled", false))
        } finally {
            returned.countDown(); release.countDown()
            if (watchdog.state != Thread.State.NEW) watchdog.join(5000)
            controller.destroy()
            bridge.close()
            awaitNativeStorage()
            val busy = ReflectionHelpers.getField<AtomicBoolean>(service, "tickRunning")
            awaitUiCondition { !busy.get() }
        }
    }
}
