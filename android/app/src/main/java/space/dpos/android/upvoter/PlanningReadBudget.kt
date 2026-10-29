package space.dpos.android.upvoter

import java.util.concurrent.TimeUnit

/** Synchronous read-only scope. No detached planner/signing job survives its owner. */
internal object PlanningReadBudget {
    private val deadline = ThreadLocal<Long>()
    fun remainingMs(): Long? = deadline.get()?.let {
        TimeUnit.NANOSECONDS.toMillis(it - System.nanoTime()).coerceAtLeast(0)
    }
    fun <T> within(milliseconds: Long, block: () -> T): T {
        val prior = deadline.get()
        deadline.set(minOf(prior ?: Long.MAX_VALUE, System.nanoTime() + TimeUnit.MILLISECONDS.toNanos(milliseconds)))
        return try { block() } finally {
            if (prior == null) deadline.remove() else deadline.set(prior)
        }
    }
}
