package space.dpos.android

import android.os.Looper
import org.junit.Assert.assertTrue
import org.robolectric.Shadows.shadowOf
import space.dpos.android.storage.NativeStorageQueue
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/** Drain actual persistence tasks and their UI handoffs; never replace a production boundary. */
internal fun awaitNativeStorage() {
    repeat(2) {
        val done = CountDownLatch(1)
        NativeStorageQueue.execute { done.countDown() }
        assertTrue("native persistence queue did not drain", done.await(10, TimeUnit.SECONDS))
        shadowOf(Looper.getMainLooper()).idle()
    }
}

internal fun awaitUiCondition(condition: () -> Boolean) {
    val deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(5)
    while (!condition() && System.nanoTime() < deadline) {
        shadowOf(Looper.getMainLooper()).idle()
        Thread.sleep(5)
    }
    assertTrue("UI completion did not arrive", condition())
}
