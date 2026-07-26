package space.dpos.android.worker

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import space.dpos.android.storage.WorkerStore

class DposPeriodicWorker(appContext: Context, params: WorkerParameters) : CoroutineWorker(appContext, params) {
    override suspend fun doWork(): Result {
        WorkerStore(applicationContext).appendLog("periodic check tick")
        return Result.success()
    }
}
