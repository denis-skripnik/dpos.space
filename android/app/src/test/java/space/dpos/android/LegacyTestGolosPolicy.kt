package space.dpos.android

import space.dpos.android.upvoter.GolosProductionPolicy
import space.dpos.android.upvoter.GolosRpcClient
import space.dpos.android.notifications.GolosHistoryClient

/** Admission stub ONLY for pre-existing tests of unrelated runtime behavior.
 * ProductionContract/ProductionMigration/ContentDegraded use the REAL policy with loopback.
 * No production configuration or source path instantiates this class. */
internal class LegacyTestGolosPolicy(private val history: GolosHistoryClient) : GolosProductionPolicy(pause = {}) {
    override fun admit(rpc: GolosRpcClient, wall: () -> Long, mono: () -> Long, permit: () -> Boolean): Admitted {
        check(permit())
        val client = object : GolosRpcClient by rpc {
            override fun recoveryHistory() = history
            override fun recoveryClients() = listOf(this)
        }
        return Admitted(client, 123, "0000007b" + "a".repeat(32), wall() / 1000, 120, wall(), mono())
    }
}
