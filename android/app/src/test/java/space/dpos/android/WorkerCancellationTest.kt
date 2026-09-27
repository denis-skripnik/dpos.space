package space.dpos.android

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import space.dpos.android.worker.WorkerCancellation
import space.dpos.android.worker.runInterruptibleChild
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

class WorkerCancellationTest {
    @Test fun stopInvalidatesEveryPreviouslyIssuedToken() {
        WorkerCancellation.resetForTest()
        val first = WorkerCancellation.token { true }
        val second = WorkerCancellation.token { true }
        assertTrue(first.mayContinue())
        assertTrue(second.mayContinue())

        WorkerCancellation.cancelAll()

        assertFalse(first.mayContinue())
        assertFalse(second.mayContinue())
        assertTrue(WorkerCancellation.token { true }.mayContinue())
    }

    @Test fun tokenAlsoHonorsLiveEnabledAndGrantGuard() {
        WorkerCancellation.resetForTest()
        var enabled = true
        val token = WorkerCancellation.token { enabled }
        assertTrue(token.mayContinue())
        enabled = false
        assertFalse(token.mayContinue())
    }

    @Test fun timedOutChildKeepsOwnershipUntilItsThreadActuallyTerminates() {
        val entered = CountDownLatch(1)
        val release = CountDownLatch(1)
        val returned = CountDownLatch(1)
        val caller = Thread {
            runInterruptibleChild(timeoutMillis = 20) {
                entered.countDown()
                while (release.count > 0) {
                    try { release.await() } catch (_: InterruptedException) { /* emulate a transport that ignores interruption */ }
                }
                "finished"
            }
            returned.countDown()
        }
        caller.start()
        assertTrue(entered.await(1, TimeUnit.SECONDS))
        Thread.sleep(80)
        assertFalse("caller must still own the no-overlap section", returned.await(20, TimeUnit.MILLISECONDS))
        release.countDown()
        assertTrue(returned.await(1, TimeUnit.SECONDS))
    }
}
