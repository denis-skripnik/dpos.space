package space.dpos.android

import org.junit.Assert.*
import org.junit.Test
import space.dpos.android.upvoter.*

class GolosProductionPolicyTest {
    @Test fun automaticGolosHasNoUnreviewedPeerFallback() {
        assertEquals(listOf("https://api-full.golos.id"), GrapheneChainSpecs.require("golos").rpcEndpoints)
    }
}
