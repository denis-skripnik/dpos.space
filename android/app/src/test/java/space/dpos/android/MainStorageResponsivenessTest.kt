package space.dpos.android

import android.app.Activity
import android.app.Application
import android.content.Context
import androidx.test.core.app.ApplicationProvider
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import space.dpos.android.bridge.BridgeRequest
import space.dpos.android.bridge.DposAndroidBridge
import space.dpos.android.storage.TransactionCheckpointStore
import space.dpos.android.storage.WorkerStore
import java.io.File
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean

@RunWith(RobolectricTestRunner::class)
@Config(application = Application::class)
class MainStorageResponsivenessTest {
    @org.junit.Before fun resetCancellation() {
        space.dpos.android.worker.WorkerCancellation.resetForTest()
        val context = ApplicationProvider.getApplicationContext<Context>()
        if (runCatching { androidx.work.WorkManager.getInstance(context) }.isFailure) {
            androidx.work.WorkManager.initialize(context, androidx.work.Configuration.Builder().build())
        }
    }

    @org.junit.After fun drainStorage() {
        awaitNativeStorage()
    }

    /** Release even on RED, recording the actual blocked main stack before unblocking it. */
    private fun heldCheckpoint(archiveRecords: Int = 0, action: (WorkerStore) -> Unit) {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val prefs = context.getSharedPreferences("dpos_worker", Context.MODE_PRIVATE)
        val entered = CountDownLatch(1)
        val release = CountDownLatch(1)
        val armed = AtomicBoolean(false)
        val checkpoint = TransactionCheckpointStore(File(context.filesDir, "transaction-checkpoint"), prefs) { stage, _ ->
            if (armed.get() && stage == "checkpoint:sync") {
                entered.countDown()
                check(release.await(10, TimeUnit.SECONDS))
            }
        }
        val store = WorkerStore(context, prefs, prefs, checkpoint)
        armed.set(true)
        val changes: Map<String, Any> = if (archiveRecords == 0) mapOf("voteStorageUnsafe" to false) else {
            val archive = org.json.JSONArray((0 until archiveRecords).map { index ->
                JSONObject().put("confirmed", false).put("intent", JSONObject()
                    .put("kind", "vote").put("chainId", "golos").put("account", "fixture-voter")
                    .put("fingerprint", "target|archive-$index|100").put("historyBaseline", -1L)
                    .put("state", "UNKNOWN").put("transactionId", "a".repeat(40)))
            })
            mapOf("voteArchive:golos:fixture-voter" to archive.toString())
        }
        val writer = Thread { checkpoint.put(changes) }
        writer.start()
        assertTrue(entered.await(5, TimeUnit.SECONDS))
        val main = Thread.currentThread()
        val completed = CountDownLatch(1)
        val watchdog = Thread {
            if (!completed.await(800, TimeUnit.MILLISECONDS)) {
                System.err.println("HELD CHECKPOINT MAIN STACK\n" + main.stackTrace.joinToString("\n"))
                release.countDown()
            }
        }
        watchdog.start()
        try {
            action(store)
            assertEquals("main entry point waited for checkpoint owner", 1L, release.count)
        } finally {
            completed.countDown()
            release.countDown()
            writer.join(5000)
            watchdog.join(5000)
            assertFalse(writer.isAlive)
        }
    }

    @Test fun applicationStartupDoesNotWaitForCheckpoint() {
        val app = DposApplication()
        org.robolectric.util.ReflectionHelpers.callInstanceMethod<Void>(app, "attach",
            org.robolectric.util.ReflectionHelpers.ClassParameter.from(Context::class.java, ApplicationProvider.getApplicationContext()))
        heldCheckpoint { app.onCreate() }
    }

    @Test fun activityStartupAndResumeDoNotWaitForCheckpoint() {
        // Warm Robolectric's instrumented WebView classes, not the storage boundary.
        Robolectric.buildActivity(space.dpos.android.ui.MainActivity::class.java).setup().pause().stop().destroy()
        awaitNativeStorage()
        val controller = Robolectric.buildActivity(space.dpos.android.ui.MainActivity::class.java)
        try { heldCheckpoint { controller.create().start().resume() } }
        finally { controller.pause().stop().destroy() }
    }

    @Test fun destroyedActivityCannotMarkUnperformedCacheRefreshAsComplete() {
        // Warm framework/WebView instrumentation outside the held-checkpoint interval.
        Robolectric.buildActivity(space.dpos.android.ui.MainActivity::class.java).setup().pause().stop().destroy()
        awaitNativeStorage()
        val context = ApplicationProvider.getApplicationContext<Context>()
        val prefs = context.getSharedPreferences("dpos_android_runtime", Context.MODE_PRIVATE)
        prefs.edit().putInt("runtime_cache_version", -1).commit()
        val old = Robolectric.buildActivity(space.dpos.android.ui.MainActivity::class.java)
        heldCheckpoint { store ->
            space.dpos.android.storage.NativeStorageQueue.execute { store.checkpointStatus() }
            old.create().destroy()
        }
        awaitNativeStorage()
        assertEquals("a destroyed UI never cleared cache", -1, prefs.getInt("runtime_cache_version", -1))
        val replacement = Robolectric.buildActivity(space.dpos.android.ui.MainActivity::class.java).create()
        try {
            awaitNativeStorage()
            assertEquals(BuildConfig.VERSION_CODE, prefs.getInt("runtime_cache_version", -1))
        } finally { replacement.destroy() }
    }

    @Test fun applicationResumeDoesNotWaitForCheckpointEvenIfServiceAlreadyRunning() {
        space.dpos.android.worker.DposForegroundService.isRunning = true
        try {
            heldCheckpoint { DposApplication.resumeEnabledWorker(ApplicationProvider.getApplicationContext(), "fixture") }
        } finally { space.dpos.android.worker.DposForegroundService.isRunning = false }
    }

    @Test fun serviceCreateShowsNotificationWithoutWaitingForCheckpoint() {
        val controller = Robolectric.buildService(space.dpos.android.worker.DposForegroundService::class.java)
        try {
            heldCheckpoint {
                controller.create()
                assertTrue(org.robolectric.Shadows.shadowOf(controller.get()).isLastForegroundNotificationAttached)
            }
        } finally { controller.destroy() }
    }

    @Test fun serviceStartDoesNotWaitForCheckpoint() {
        val controller = Robolectric.buildService(space.dpos.android.worker.DposForegroundService::class.java).create()
        try { heldCheckpoint { controller.get().onStartCommand(null, 0, 1) } }
        finally { controller.destroy() }
    }

    @Test fun serviceStopCancelsBeforeWaitingForCheckpoint() {
        val controller = Robolectric.buildService(space.dpos.android.worker.DposForegroundService::class.java).create()
        try {
            heldCheckpoint {
                val token = space.dpos.android.worker.WorkerCancellation.token { true }
                controller.get().onStartCommand(android.content.Intent().setAction(
                    space.dpos.android.worker.DposForegroundService.ACTION_STOP), 0, 2)
                assertFalse(token.mayContinue())
                assertTrue(org.robolectric.Shadows.shadowOf(controller.get()).isStoppedBySelf)
            }
        } finally { controller.destroy() }
    }

    @Test fun serviceDestroyDoesNotWaitForCheckpoint() {
        val controller = Robolectric.buildService(space.dpos.android.worker.DposForegroundService::class.java).create()
        heldCheckpoint { controller.destroy() }
        assertFalse(space.dpos.android.worker.DposForegroundService.isRunning)
    }

    @Test fun completedServiceUiHandoffCannotReenterCheckpointOnMain() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val store = WorkerStore(context)
        assertTrue("no account/RPC fixture is allowed here", store.activeAccounts().isEmpty())
        store.setWorkerEnabled(true)
        val controller = Robolectric.buildService(space.dpos.android.worker.DposForegroundService::class.java).create()
        try {
            awaitNativeStorage()
            val service = controller.get()
            val tick = org.robolectric.util.ReflectionHelpers.getField<Runnable>(service, "tick")
            val busy = org.robolectric.util.ReflectionHelpers.getField<AtomicBoolean>(service, "tickRunning")
            tick.run()
            val deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(5)
            // Do not idle main yet: retain the actual completed runner's queued UI handoff.
            fun finishing() = busy.get() || Thread.getAllStackTraces().values.any { stack ->
                stack.any { it.className.startsWith("space.dpos.android.worker.DposForegroundService") }
            }
            while (finishing() && System.nanoTime() < deadline) Thread.sleep(5)
            assertFalse("foreground thread must finish before holding authority", finishing())
            assertEquals(0, store.exportLastRunSummary()!!.getInt("accountsChecked"))
            heldCheckpoint {
                org.robolectric.Shadows.shadowOf(android.os.Looper.getMainLooper()).idle()
                val progress = AtomicBoolean(false)
                android.os.Handler(android.os.Looper.getMainLooper()).post { progress.set(true) }
                org.robolectric.Shadows.shadowOf(android.os.Looper.getMainLooper()).idle()
                assertTrue(progress.get())
            }
        } finally { controller.destroy(); awaitNativeStorage() }
    }

    @Test fun serviceBusyTickDoesNotTouchCheckpointOnMain() {
        val controller = Robolectric.buildService(space.dpos.android.worker.DposForegroundService::class.java).create()
        val service = controller.get()
        (org.robolectric.util.ReflectionHelpers.getField<AtomicBoolean>(service, "tickRunning")).set(true)
        try {
            heldCheckpoint { org.robolectric.util.ReflectionHelpers.getField<Runnable>(service, "tick").run() }
        } finally { controller.destroy() }
    }

    @Test fun queuedMixedSettingsAfterClosePersistOnlyRevocationsNotNewGrants() {
        val activity = Robolectric.buildActivity(Activity::class.java).setup().get()
        var bridge: DposAndroidBridge? = null
        val done = CountDownLatch(1)
        heldCheckpoint { store ->
            bridge = DposAndroidBridge(activity, store) { JSONObject() }
            bridge!!.dispatch(BridgeRequest("mixed", "syncAutoUpvoterSettings", JSONObject().put("accounts",
                org.json.JSONArray().put(JSONObject().put("chainId", "golos").put("account", "alice").put("enabled", true))
                    .put(JSONObject().put("chainId", "golos").put("account", "bobby").put("enabled", false))))) { done.countDown() }
            bridge!!.close()
        }
        assertTrue(done.await(5, TimeUnit.SECONDS))
        val restarted = WorkerStore(activity)
        assertFalse("destroyed activity must not add a new grant", restarted.autoUpvoterEnabled("golos", "alice"))
        assertFalse(restarted.autoUpvoterEnabled("golos", "bobby"))
    }

    @Test fun archiveOnlyContentionKeepsActualActivityBridgeRepliesAndUiProgressIndependent() {
        val controller = Robolectric.buildActivity(space.dpos.android.ui.MainActivity::class.java).setup()
        val activity = controller.get()
        val bridge = org.robolectric.util.ReflectionHelpers.getField<DposAndroidBridge>(activity, "androidBridge")
        val statusDone = CountDownLatch(1)
        var statusReplies = 0
        var infoReplies = 0
        try {
            heldCheckpoint(archiveRecords = 256) {
                bridge.dispatch(BridgeRequest("archive-status", "getWorkerStatus", JSONObject())) {
                    assertTrue(it.getBoolean("ok")); statusReplies++; statusDone.countDown()
                }
                bridge.dispatch(BridgeRequest("archive-info", "getAppInfo", JSONObject())) {
                    assertTrue(it.getBoolean("ok")); infoReplies++
                }
                val progress = AtomicBoolean(false)
                android.os.Handler(android.os.Looper.getMainLooper()).post {
                    activity.title = "Fixture UI progress"
                    progress.set(true)
                }
                org.robolectric.Shadows.shadowOf(android.os.Looper.getMainLooper()).idle()
                assertTrue(progress.get())
                assertEquals(1, infoReplies)
                assertEquals(1L, statusDone.count)
            }
            assertTrue(statusDone.await(5, TimeUnit.SECONDS))
            assertEquals(1, statusReplies)
            assertEquals(256, WorkerStore(activity).voteArchive("golos", "fixture-voter").size)
        } finally { controller.pause().stop().destroy() }
    }

    @Test fun invalidDisableCannotLeaveARevocationPersistenceBarrier() {
        val activity = Robolectric.buildActivity(Activity::class.java).setup().get()
        val bridge = DposAndroidBridge(activity) { JSONObject() }
        val done = CountDownLatch(1)
        bridge.dispatch(BridgeRequest("invalid", "syncVizSelfAwardSettings", JSONObject()
            .put("account", "!").put("enabled", false))) { done.countDown() }
        try {
            assertTrue(done.await(5, TimeUnit.SECONDS))
            assertTrue(space.dpos.android.worker.WorkerCancellation.token { true }.mayContinue())
        } finally { bridge.close() }
    }

    @Test fun bootReceiverDoesNotReadCheckpointOnMain() {
        heldCheckpoint {
            space.dpos.android.worker.BootReceiver().onReceive(ApplicationProvider.getApplicationContext(),
                android.content.Intent(android.content.Intent.ACTION_BOOT_COMPLETED))
        }
    }

    @Test fun expiredBootAdmissionCannotStartServiceAfterCheckpointResumes() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        WorkerStore(context).setWorkerEnabled(true)
        heldCheckpoint {
            space.dpos.android.worker.BootReceiver().onReceive(context,
                android.content.Intent(android.content.Intent.ACTION_BOOT_COMPLETED))
            org.robolectric.Shadows.shadowOf(android.os.Looper.getMainLooper()).idleFor(java.time.Duration.ofSeconds(9))
        }
        awaitNativeStorage()
        assertNull(org.robolectric.Shadows.shadowOf(context as Application).nextStartedService)
    }

    @Test fun enabledVerifiedBootStillRequestsVisibleForegroundService() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        WorkerStore(context).setWorkerEnabled(true)
        space.dpos.android.worker.BootReceiver().onReceive(context,
            android.content.Intent(android.content.Intent.ACTION_BOOT_COMPLETED))
        awaitNativeStorage()
        val intent = org.robolectric.Shadows.shadowOf(context as Application).nextStartedService
        assertEquals(space.dpos.android.worker.DposForegroundService::class.java.name, intent.component!!.className)
    }

    @Test fun serviceIdleTickDoesNotTouchCheckpointOnMain() {
        val controller = Robolectric.buildService(space.dpos.android.worker.DposForegroundService::class.java).create()
        try { heldCheckpoint { org.robolectric.util.ReflectionHelpers.getField<Runnable>(controller.get(), "tick").run() } }
        finally { controller.destroy() }
    }

    @Test fun cancellationDuringBlockedPermissionReadCannotAuthorizeALateSend() {
        val entered = CountDownLatch(1)
        val release = CountDownLatch(1)
        val token = space.dpos.android.worker.WorkerCancellation.token {
            entered.countDown()
            check(release.await(5, TimeUnit.SECONDS))
            true
        }
        val allowed = AtomicBoolean(true)
        val child = Thread { allowed.set(token.mayContinue()) }
        child.start()
        try {
            assertTrue(entered.await(5, TimeUnit.SECONDS))
            space.dpos.android.worker.WorkerCancellation.cancelAll()
        } finally { release.countDown(); child.join(5000) }
        assertFalse("permission read completed after cancellation", allowed.get())
    }

    @Test fun heavyStatusDoesNotBlockMainAndRepliesExactlyOnceAfterStorageResumes() {
        val activity = Robolectric.buildActivity(Activity::class.java).setup().get()
        val replied = CountDownLatch(1)
        var count = 0
        var bridge: DposAndroidBridge? = null
        heldCheckpoint { store ->
            bridge = DposAndroidBridge(activity, store) { store.checkpointStatus() }
            bridge!!.dispatch(BridgeRequest("status", "getWorkerStatus", JSONObject())) {
                count++; replied.countDown()
            }
            assertEquals(1L, replied.count)
        }
        try {
            assertTrue(replied.await(5, TimeUnit.SECONDS))
            assertEquals(1, count)
        } finally { bridge?.close() }
    }

    @Test fun stopInvalidatesTokensBeforeCheckpointPersistenceCanRun() {
        val activity = Robolectric.buildActivity(Activity::class.java).setup().get()
        val replied = CountDownLatch(1)
        var bridge: DposAndroidBridge? = null
        heldCheckpoint { store ->
            bridge = DposAndroidBridge(activity, store) { JSONObject() }
            val old = space.dpos.android.worker.WorkerCancellation.token { true }
            bridge!!.dispatch(BridgeRequest("stop", "stopWorker", JSONObject())) { replied.countDown() }
            assertFalse(old.mayContinue())
        }
        try { assertTrue(replied.await(5, TimeUnit.SECONDS)) } finally { bridge?.close() }
        assertFalse(WorkerStore(activity).workerEnabled())
    }

    @Test fun defaultBridgeConstructionDoesNotBootstrapOnMain() {
        val activity = Robolectric.buildActivity(Activity::class.java).setup().get()
        heldCheckpoint {
            DposAndroidBridge(activity) { JSONObject() }.close()
        }
    }

    @Test fun bridgeEntryAndCheapAppInfoDoNotWaitForCheckpointLogging() {
        val activity = Robolectric.buildActivity(Activity::class.java).setup().get()
        heldCheckpoint { store ->
            val bridge = DposAndroidBridge(activity, store) { error("app info must not request status") }
            try {
                var replies = 0
                bridge.dispatch(BridgeRequest("info", "getAppInfo", JSONObject())) {
                    assertTrue(it.getBoolean("ok")); replies++
                }
                assertEquals(1, replies)
            } finally { bridge.close() }
        }
    }
}
