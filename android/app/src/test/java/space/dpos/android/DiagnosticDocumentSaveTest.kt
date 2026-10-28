package space.dpos.android

import android.app.Activity
import android.content.Intent
import android.net.Uri
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf
import space.dpos.android.ui.MainActivity
import java.io.ByteArrayOutputStream

@RunWith(RobolectricTestRunner::class)
class DiagnosticDocumentSaveTest {
    @Test fun selectedDocumentWriteNeverBlocksMainAndDestroyedOwnerCompletesOnlyOnce() {
        val controller = Robolectric.buildActivity(MainActivity::class.java).setup()
        val activity = controller.get()
        val request = MainActivity::class.java.getDeclaredMethod("requestDiagnosticSave", String::class.java, kotlin.jvm.functions.Function1::class.java).apply { isAccessible = true }
        val complete = MainActivity::class.java.getDeclaredMethod("onActivityResult", Int::class.javaPrimitiveType, Int::class.javaPrimitiveType, Intent::class.java).apply { isAccessible = true }
        val release = java.util.concurrent.CountDownLatch(1)
        val returned = java.util.concurrent.CountDownLatch(1)
        val calls = java.util.concurrent.atomic.AtomicInteger(0)
        request.invoke(activity, "fixture report", { _: JSONObject -> calls.incrementAndGet() })
        val launched = shadowOf(activity).nextStartedActivityForResult
        val uri = Uri.parse("content://diagnostic-test/slow.log")
        shadowOf(activity.contentResolver).registerOutputStream(uri, object : java.io.OutputStream() {
            override fun write(value: Int) { check(release.await(10, java.util.concurrent.TimeUnit.SECONDS)) }
        })
        val main = Thread.currentThread()
        val watchdog = Thread {
            if (!returned.await(800, java.util.concurrent.TimeUnit.MILLISECONDS)) {
                System.err.println("DOCUMENT WRITE MAIN STACK\n" + main.stackTrace.joinToString("\n"))
                release.countDown()
            }
        }
        watchdog.start()
        try {
            complete.invoke(activity, launched.requestCode, Activity.RESULT_OK, Intent().setData(uri))
            assertEquals("selected document IO blocked main", 1L, release.count)
            controller.pause().stop().destroy()
        } finally {
            returned.countDown(); release.countDown(); watchdog.join(5000)
            val writer = org.robolectric.util.ReflectionHelpers.getField<java.util.concurrent.ExecutorService>(activity, "diagnosticWriter")
            // The fixture stream is released before waiting, never an unbounded shutdown.
            writer.shutdown()
            assertTrue(writer.awaitTermination(5, java.util.concurrent.TimeUnit.SECONDS))
            awaitNativeStorage()
        }
        assertEquals(1, calls.get())
    }

    @Test fun actualDocumentPickerWritesWholeUtf8LogAndCancellationDoesNotWrite() {
        val controller = Robolectric.buildActivity(MainActivity::class.java).setup()
        val activity = controller.get()
        val request = MainActivity::class.java.getDeclaredMethod("requestDiagnosticSave", String::class.java, kotlin.jvm.functions.Function1::class.java).apply { isAccessible = true }
        val complete = MainActivity::class.java.getDeclaredMethod("onActivityResult", Int::class.javaPrimitiveType, Int::class.javaPrimitiveType, Intent::class.java).apply { isAccessible = true }
        var response: JSONObject? = null
        val body = "Полный безопасный журнал\n".repeat(500)
        val callback: (JSONObject) -> Unit = { response = it }
        request.invoke(activity, body, callback)
        val launched = shadowOf(activity).nextStartedActivityForResult
        assertEquals(Intent.ACTION_CREATE_DOCUMENT, launched.intent.action)
        assertEquals("text/plain", launched.intent.type)
        assertTrue(launched.intent.getStringExtra(Intent.EXTRA_TITLE)!!.endsWith(".log"))
        assertNull(response)
        val uri = Uri.parse("content://diagnostic-test/report.log")
        val stream = ByteArrayOutputStream()
        shadowOf(activity.contentResolver).registerOutputStream(uri, stream)
        complete.invoke(activity, launched.requestCode, Activity.RESULT_OK, Intent().setData(uri))
        awaitUiCondition { response != null }
        assertEquals(body, stream.toString("UTF-8"))
        assertTrue(response!!.getBoolean("ok"))
        response = null
        request.invoke(activity, body, callback)
        val cancelled = shadowOf(activity).nextStartedActivityForResult
        complete.invoke(activity, cancelled.requestCode, Activity.RESULT_CANCELED, null)
        assertTrue(response!!.getBoolean("cancelled"))
        response = null
        request.invoke(activity, body, callback)
        val failed = shadowOf(activity).nextStartedActivityForResult
        shadowOf(activity.contentResolver).registerOutputStream(uri, object : java.io.OutputStream() {
            override fun write(value: Int) { throw java.io.IOException("fixture write failed") }
        })
        complete.invoke(activity, failed.requestCode, Activity.RESULT_OK, Intent().setData(uri))
        awaitUiCondition { response != null }
        assertFalse(response!!.getBoolean("ok"))
        response = null
        request.invoke(activity, body, callback)
        controller.pause().stop().destroy()
        assertTrue(response!!.getBoolean("cancelled"))
    }
}
