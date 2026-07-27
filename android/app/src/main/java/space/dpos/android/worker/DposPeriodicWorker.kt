package space.dpos.android.worker

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters

class DposPeriodicWorker(appContext: Context, params: WorkerParameters) : CoroutineWorker(appContext, params) {
    override suspend fun doWork(): Result {
        val summary = DposWorkerRunner(applicationContext).runOnce(reason = "periodic")
        return if (summary.ok) Result.success() else Result.retry()
    }

    companion object {
        const val UNIQUE_WORK = "dpos-periodic-worker"
    }
}
