package space.dpos.android.worker

import java.util.concurrent.Callable
import java.util.concurrent.Executors
import java.util.concurrent.ExecutorService
import java.util.concurrent.TimeUnit
import java.util.concurrent.TimeoutException
import java.util.concurrent.atomic.AtomicLong

/** Process-wide cancellation generation shared by every worker entry point. */
object WorkerCancellation {
    private val generation = AtomicLong(0)

    class Token internal constructor(
        private val generationAtStart: Long,
        private val guard: () -> Boolean
    ) {
        fun mayContinue(): Boolean =
            generation.get() == generationAtStart && guard() && !Thread.currentThread().isInterrupted
    }

    fun token(guard: () -> Boolean): Token = Token(generation.get(), guard)

    /** Invalidates all tokens that could already be waiting in RPC or pacing sleeps. */
    fun cancelAll(): Long = generation.incrementAndGet()

    internal fun resetForTest() {
        generation.set(1L)
    }

    fun shutdownAndAwait(executor: ExecutorService) {
        executor.shutdownNow()
        var interrupted = false
        while (!executor.isTerminated) {
            try {
                executor.awaitTermination(100, TimeUnit.MILLISECONDS)
            } catch (_: InterruptedException) {
                interrupted = true
            }
        }
        if (interrupted) Thread.currentThread().interrupt()
    }
}

/**
 * Runs a bounded child but does not return ownership to the caller until the child thread has
 * really exited. shutdownNow/cancel are requests, not proof of termination.
 */
internal fun <T> runInterruptibleChild(timeoutMillis: Long, task: () -> T): T? {
    val executor = Executors.newSingleThreadExecutor()
    val future = executor.submit(Callable { task() })
    var result: T? = null
    try {
        result = future.get(timeoutMillis.coerceAtLeast(1), TimeUnit.MILLISECONDS)
    } catch (_: TimeoutException) {
        future.cancel(true)
    } finally {
        WorkerCancellation.shutdownAndAwait(executor)
    }
    return result
}
