package space.dpos.android

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import space.dpos.android.runtime.SecureKeyImportCodec
import space.dpos.android.runtime.SecureKeyImportPolicy
import space.dpos.android.runtime.SecureKeyImportRequest
import space.dpos.android.runtime.WorkerSettingsCodec

class SecureKeyImportPolicyTest {
    private val fixtureWif = listOf("5KQw", "rPbwdL6PhX", "ujxW37FSSQ", "W42oT4YkSwPqngp5", "ZbjozA5B8ZZ").joinToString("")

    @Test fun normalSettingsImportRejectsSecretFields() {
        val result = WorkerSettingsCodec.decodeImport("""{"chainId":"golos","account":"denis","explicitConsent":true,"enableAutoUpvoter":true,"privateKey":"$fixtureWif"}""")
        assertFalse(result.accepted)
        assertTrue(result.reason.contains("secret", ignoreCase = true))
    }

    @Test fun dedicatedSecureKeyImportRequiresConsentAndValidMetadata() {
        val rejected = SecureKeyImportPolicy.validate(SecureKeyImportRequest("golos", "denis", "posting", "auto-upvoter", fixtureWif, explicitConsent = false))
        assertFalse(rejected.accepted)
        assertTrue(rejected.reason.contains("consent", ignoreCase = true))

        val accepted = SecureKeyImportPolicy.validate(SecureKeyImportRequest("golos", "@Denis", "posting", "auto-upvoter", fixtureWif, explicitConsent = true))
        assertTrue(accepted.accepted)
        assertNotNull(accepted.keyRef)
        assertEquals("golos", accepted.keyRef!!.chainId)
        assertEquals("denis", accepted.keyRef!!.account)
        assertEquals("posting", accepted.keyRef!!.authority)
        assertEquals("auto-upvoter", accepted.keyRef!!.alias)
    }

    @Test fun secureKeyResultNeverReturnsSecret() {
        val decision = SecureKeyImportCodec.decode("""{"chainId":"golos","account":"denis","authority":"posting","alias":"auto-upvoter","secret":"$fixtureWif","explicitConsent":true}""")
        val json = SecureKeyImportCodec.resultJson(decision, hasKey = true)
        assertTrue(json.contains("\"hasKey\":true"))
        assertTrue(json.contains("\"keyRef\""))
        assertFalse(json.contains(fixtureWif))
        assertFalse(json.contains("secret"))
    }

    @Test fun invalidAuthorityAliasAndChainAreRejected() {
        assertFalse(SecureKeyImportPolicy.validate(SecureKeyImportRequest("golos", "denis", "owner", "auto-upvoter", fixtureWif, true)).accepted)
        assertFalse(SecureKeyImportPolicy.validate(SecureKeyImportRequest("golos", "denis", "posting", "bad alias with spaces", fixtureWif, true)).accepted)
        assertFalse(SecureKeyImportPolicy.validate(SecureKeyImportRequest("decimal", "denis", "posting", "auto-upvoter", fixtureWif, true)).accepted)
    }
}
