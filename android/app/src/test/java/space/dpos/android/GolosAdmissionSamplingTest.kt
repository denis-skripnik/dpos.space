package space.dpos.android

import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import space.dpos.android.upvoter.*

/** Real admission policy over the existing loopback HTTP RPC fixture, not a replica sampler. */
@RunWith(RobolectricTestRunner::class)
class GolosAdmissionSamplingTest {
    @Test fun twoLibPlateausThenAdvanceAdmitsLatestFreshProofOnSameEndpoint() {
        GolosProductionContractTest.Fixture().use { p ->
            var waits = 0
            val initialLib = p.f.lib
            val policy = GolosProductionPolicy(p.f.endpoint) {
                waits++
                p.f.recoveryWall += 3500; p.f.recoveryMono += 3500
                p.f.recoveryHead++; p.f.recoveryTime += 3
                if (waits == 3) p.f.lib++
            }
            val admitted = policy.admit(p.rpc, { p.f.recoveryWall }, { p.f.recoveryMono }, { true })
            assertEquals(3, waits)
            assertSame(p.rpc, admitted.rpc)
            assertEquals(initialLib + 1, admitted.lib)
            assertEquals(p.f.recoveryHead, admitted.head)
            assertEquals(p.f.recoveryTime, admitted.headTime)
            assertTrue(p.f.sends.isEmpty())
        }
    }

    @Test fun permanentlyFlatLibFailsWithinOriginalBudgetAndFiniteAttemptCap() {
        GolosProductionContractTest.Fixture().use { p ->
            var waits = 0
            val start = p.f.recoveryMono
            val policy = GolosProductionPolicy(p.f.endpoint) {
                waits++; p.f.recoveryWall += 3500; p.f.recoveryMono += 3500
                p.f.recoveryHead++; p.f.recoveryTime += 3
            }
            val e = runCatching { policy.admit(p.rpc, { p.f.recoveryWall }, { p.f.recoveryMono }, { true }) }.exceptionOrNull()
            assertEquals("production_not_advancing", e?.message)
            assertTrue(waits in 2..8)
            assertTrue(p.f.recoveryMono - start <= 30_000)
            assertTrue(p.f.sends.isEmpty())
        }
    }

    @Test fun frozenInjectedClockStillTerminatesWithoutAcceptingFlatLib() {
        GolosProductionContractTest.Fixture().use { p ->
            var waits = 0
            val policy = GolosProductionPolicy(p.f.endpoint) { waits++ }
            assertEquals("production_not_advancing", runCatching {
                policy.admit(p.rpc, { p.f.recoveryWall }, { p.f.recoveryMono }, { true })
            }.exceptionOrNull()?.message)
            assertTrue(waits in 2..8)
        }
    }

    @Test fun cancelledWaitCannotReturnEvenAnAdvancingProof() {
        GolosProductionContractTest.Fixture().use { p ->
            var permit = true
            var waits = 0
            val policy = GolosProductionPolicy(p.f.endpoint) {
                waits++; permit = false
                p.f.recoveryHead++; p.f.lib++; p.f.recoveryTime += 3
            }
            assertEquals("production_cancelled", runCatching {
                policy.admit(p.rpc, { p.f.recoveryWall }, { p.f.recoveryMono }, { permit })
            }.exceptionOrNull()?.message)
            assertEquals(1, waits)
        }
    }

    @Test fun wallJumpAndLateOrRegressedMonotonicNeverAdmitAdvancingProof() {
        for (mode in listOf("wall-forward", "wall-back", "late", "mono-back", "wall-budget")) {
            GolosProductionContractTest.Fixture().use { p ->
                val policy = GolosProductionPolicy(p.f.endpoint) {
                    p.f.recoveryHead++; p.f.lib++; p.f.recoveryTime += 3
                    when (mode) {
                        "wall-forward" -> { p.f.recoveryWall += 9501; p.f.recoveryMono += 3500 }
                        "wall-back" -> { p.f.recoveryWall -= 6001; p.f.recoveryMono += 3500 }
                        "late" -> { p.f.recoveryWall += 30001; p.f.recoveryMono += 30001 }
                        "mono-back" -> p.f.recoveryMono--
                        "wall-budget" -> { p.f.recoveryWall += 30001; p.f.recoveryMono += 28000 }
                    }
                }
                assertEquals(mode, "production_observation_stale", runCatching {
                    policy.admit(p.rpc, { p.f.recoveryWall }, { p.f.recoveryMono }, { true })
                }.exceptionOrNull()?.message)
            }
        }
    }

    @Test fun repeatedSampleStillRequiresFreshHeadAndEveryProgressDimension() {
        for (mode in listOf("stale", "head-flat", "time-flat", "proof-error", "endpoint")) {
            GolosProductionContractTest.Fixture().use { p ->
                var waits = 0
                var changedEndpoint = p.rpc.recoveryEndpoint
                val rpc = object : GolosRpcClient by p.rpc {
                    override val recoveryEndpoint get() = changedEndpoint
                    override fun getDynamicGlobalProperties(): JSONObject {
                        if (mode == "proof-error" && waits > 1) error("sample_unavailable")
                        return p.rpc.getDynamicGlobalProperties()
                    }
                }
                val policy = GolosProductionPolicy(p.f.endpoint) {
                    waits++; p.f.recoveryWall += 3500; p.f.recoveryMono += 3500
                    if (mode != "head-flat") p.f.recoveryHead++
                    if (mode != "time-flat") p.f.recoveryTime += 3
                    if (waits >= 3) p.f.lib++
                    if (mode == "stale") p.stale = true
                    if (mode == "endpoint") changedEndpoint = "foreign"
                }
                val expected = when (mode) {
                    "stale" -> "production_stale_head"
                    "proof-error" -> "sample_unavailable"
                    "endpoint" -> "production_endpoint_not_allowed"
                    else -> "production_not_advancing"
                }
                assertEquals(mode, expected, runCatching {
                    policy.admit(rpc, { p.f.recoveryWall }, { p.f.recoveryMono }, { true })
                }.exceptionOrNull()?.message)
                assertTrue(waits <= 8)
                assertTrue(p.f.sends.isEmpty())
            }
        }
    }

    @Test fun defaultProductionWaitObservesStopBeforeNextSample() {
        GolosProductionContractTest.Fixture().use { p ->
            val permitted = java.util.concurrent.atomic.AtomicBoolean(true)
            val waiting = java.util.concurrent.CountDownLatch(1)
            var samples = 0
            val rpc = object : GolosRpcClient by p.rpc {
                override fun getDynamicGlobalProperties(): JSONObject {
                    samples++
                    return p.rpc.getDynamicGlobalProperties()
                }
                override fun recoveryHistory() = object : space.dpos.android.notifications.GolosHistoryClient {
                    override fun getAccountHistory(account: String, from: Long, limit: Int): List<space.dpos.android.notifications.HistoryEvent> {
                        val rows = p.f.history.getAccountHistory(account, from, limit)
                        waiting.countDown()
                        return rows
                    }
                }
            }
            val stopper = Thread {
                if (waiting.await(5, java.util.concurrent.TimeUnit.SECONDS)) {
                    Thread.sleep(200)
                    permitted.set(false)
                }
            }
            stopper.start()
            val start = System.nanoTime()
            val failure = runCatching {
                GolosProductionPolicy(p.f.endpoint).admit(rpc, { p.f.recoveryWall }, { System.nanoTime() / 1_000_000 }, permitted::get)
            }.exceptionOrNull()
            stopper.join(5000)
            assertEquals("production_cancelled", failure?.message)
            assertTrue((System.nanoTime() - start) / 1_000_000 < 3000)
            assertEquals(1, samples)
            assertTrue(p.f.sends.isEmpty())
        }
    }

    @Test fun proofReturningPastBudgetCannotAdmitEvenAfterEarlierPlateaus() {
        GolosProductionContractTest.Fixture().use { p ->
            var waits = 0
            val rpc = object : GolosRpcClient by p.rpc {
                override fun getDynamicGlobalProperties(): JSONObject {
                    val h = p.rpc.getDynamicGlobalProperties()
                    if (waits == 3) { p.f.recoveryWall += 19501; p.f.recoveryMono += 19501 }
                    return h
                }
            }
            val policy = GolosProductionPolicy(p.f.endpoint) {
                waits++; p.f.recoveryWall += 3500; p.f.recoveryMono += 3500
                p.f.recoveryHead++; p.f.recoveryTime += 3
                if (waits == 3) p.f.lib++
            }
            assertEquals("production_observation_stale", runCatching {
                policy.admit(rpc, { p.f.recoveryWall }, { p.f.recoveryMono }, { true })
            }.exceptionOrNull()?.message)
            assertEquals(3, waits)
        }
    }

    @Test fun wrongBranchConfigAndUnavailableCapabilityNeverBeginSampling() {
        for (mode in listOf("branch", "config", "content", "history")) {
            GolosProductionContractTest.Fixture().use { p ->
                when (mode) {
                    "branch" -> p.checkpoint = "0".repeat(40)
                    "config" -> p.f.configChain = "0".repeat(64)
                    "content" -> p.emptyContent = true
                    "history" -> p.badHistory = true
                }
                var waits = 0
                val policy = GolosProductionPolicy(p.f.endpoint) { waits++ }
                assertTrue(mode, runCatching {
                    policy.admit(p.rpc, { p.f.recoveryWall }, { p.f.recoveryMono }, { true })
                }.isFailure)
                assertEquals(mode, 0, waits)
                assertTrue(p.f.sends.isEmpty())
            }
        }
    }
}
