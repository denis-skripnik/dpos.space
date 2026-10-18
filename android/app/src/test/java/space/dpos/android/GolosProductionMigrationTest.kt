package space.dpos.android

import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import space.dpos.android.upvoter.*
import space.dpos.android.worker.DposWorkerRunner

@RunWith(RobolectricTestRunner::class)
class GolosProductionMigrationTest {
    private fun oldFence() = JSONObject().put("schema", 1).put("chainId", GOLOS_CHAIN_ID)
        .put("endpoint", "https://apibeta.golos.today").put("head", 104806385L)
        .put("headId", "063f37f15c2f1a2b24484a5d45fe17b60b9032ee")
        .put("headTime", 1_792_033_410L).put("observedAtMs", 1_792_033_410_000L)
        .put("observedLib", 104806370L).put("verifiedLib", 104807631L)
        .put("verifiedLibTime", 1_792_037_148L).put("verifiedAtMs", 1_792_037_148_000L)
        .put("drain", 1_792_037_130L).put("cutoff", 1_792_037_130L).put("verified", true)
    @Test fun exactVerifiedForeignFenceIsRetainedAndNewObservedEpochRemainsUnverifiedWithoutAnySend() {
        DeviceFollowupConnectedTest.Fixture(recovery = true, knownOld = true).use { f ->
            val old = oldFence(); f.store.saveGolosRecoveryFence(old)
            f.recoveryHead = 104760300; f.lib = 104760280
            f.contentFields.put("id", 17).put("root_comment", 17)
            f.histories[GolosProductionPolicy.SAMPLE_ACCOUNT] = listOf(space.dpos.android.notifications.HistoryEvent(1, "vote", emptyMap()))
            val transport = f.rpc
            val rpc = object : GolosRpcClient by transport {
                override val recoveryEndpoint = HttpGrapheneRpcClient(GrapheneChainSpecs.require("golos"), GolosProductionPolicy.ENDPOINT).recoveryEndpoint
                override fun recoveryClients() = listOf(this)
                override fun getBlockHeader(number: Long) = if (number == GolosProductionPolicy.CHECKPOINT_HEIGHT + 1)
                    JSONObject().put("previous", GolosProductionPolicy.CHECKPOINT_ID) else transport.getBlockHeader(number)
            }
            val policy = GolosProductionPolicy(pause = {
                f.recoveryHead++; f.lib++; f.recoveryTime += 3; f.recoveryWall += 3000; f.recoveryMono += 3000
            })
            val before = f.restart().checkpointStatus().toString()
            DposWorkerRunner(f.context, f.restart(), historyOverride = { f.history }, rpcOverride = { rpc },
                eventsOverride = { _, _ -> emptyList() }, recoveryWall = { f.recoveryWall }, recoveryMonotonic = { f.recoveryMono }, productionPolicy = policy).runOnce("migration-red")
            val current = f.restart().readGolosRecoveryFence()!!
            assertNotEquals("exact legacy anchor must retire, not block healthy lower branch forever: $before", old.getString("headId"), current.getString("headId"))
            assertFalse(current.getBoolean("verified"))
            assertTrue(current.getLong("drain") >= f.recoveryWall / 1000 + 3720)
            assertTrue(f.sends.isEmpty()); assertTrue(f.restart().requiresGolosRecovery())
            assertFalse(f.requests.any { it.getJSONArray("params").getString(1) == "verify_authority" })
        }
    }
}
