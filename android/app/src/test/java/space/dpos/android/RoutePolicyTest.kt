package space.dpos.android

import org.junit.Assert.assertEquals
import org.junit.Test
import space.dpos.android.core.PayloadSanitizer
import space.dpos.android.core.RoutePolicy

class RoutePolicyTest {
    @Test fun allowsInternalHashRoute() {
        assertEquals("#chain=golos&app=wallet&account=denis", RoutePolicy.sanitizeRoute("#chain=golos&app=wallet&account=denis"))
    }
    @Test fun rejectsExternalOrScriptRoutes() {
        assertEquals("#", RoutePolicy.sanitizeRoute("https://evil.example/#chain=golos"))
        assertEquals("#", RoutePolicy.sanitizeRoute("javascript:alert(1)"))
        assertEquals("#", RoutePolicy.sanitizeRoute("#chain=bad&app=wallet"))
    }
    @Test fun redactsSecretsFromText() {
        val fixtureWif = "5K" + "1".repeat(42)
        assertEquals("privateKey=[redacted]", PayloadSanitizer.redactLog("privateKey=$fixtureWif"))
    }
}
