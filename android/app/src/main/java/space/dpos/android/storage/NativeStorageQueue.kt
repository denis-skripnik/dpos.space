package space.dpos.android.storage

import java.util.concurrent.Executors

/** Lifecycle/bridge persistence is ordered across activity and service recreation.
 * Never run RPC here, and never wait for this queue from the Android main thread.
 * TransactionCheckpointStore remains the sole synchronous transaction authority.
 */
internal object NativeStorageQueue {
    private val executor = Executors.newSingleThreadExecutor { task ->
        Thread(task, "dpos-native-storage").apply { isDaemon = true }
    }

    fun execute(task: () -> Unit) {
        executor.execute {
            try { TransactionCheckpointStore.readOperation { task() } } catch (error: Exception) {
                // A lifecycle failure must not kill subsequent queued revocation writes.
                android.util.Log.e("DposStorage", "Native storage task failed: ${error.javaClass.simpleName}")
            }
        }
    }
}
