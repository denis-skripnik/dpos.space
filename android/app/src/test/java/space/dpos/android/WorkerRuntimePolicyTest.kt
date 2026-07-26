package space.dpos.android

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import space.dpos.android.runtime.AccountImportRequest
import space.dpos.android.runtime.WorkerCommandPolicy
import space.dpos.android.runtime.WorkerSettingsCodec

class WorkerRuntimePolicyTest {
    @Test fun importRequiresExplicitOptInAndNeverCopiesSilently() {
        val rejected = WorkerCommandPolicy.validateImport(AccountImportRequest(chainId = "golos", account = "denis", enableNotifications = false, enableAutoUpvoter = false, explicitConsent = false))
        assertFalse(rejected.accepted)
        assertTrue(rejected.reason.contains("explicit", ignoreCase = true))

        val accepted = WorkerCommandPolicy.validateImport(AccountImportRequest(chainId = "golos", account = "denis", enableNotifications = true, enableAutoUpvoter = false, explicitConsent = true))
        assertTrue(accepted.accepted)
        assertEquals("golos", accepted.chainId)
        assertEquals("denis", accepted.account)
    }

    @Test fun vizWorkerImportAllowsNotificationsOnlyAndRejectsAutoUpvoter() {
        val notifications = WorkerCommandPolicy.validateImport(AccountImportRequest(chainId = "viz", account = "denis", enableNotifications = true, enableAutoUpvoter = false, explicitConsent = true))
        assertTrue(notifications.accepted)
        val auto = WorkerCommandPolicy.validateImport(AccountImportRequest(chainId = "viz", account = "denis", enableNotifications = false, enableAutoUpvoter = true, explicitConsent = true))
        assertFalse(auto.accepted)
        assertTrue(auto.reason.contains("auto-upvoter", ignoreCase = true))
    }

    @Test fun minterDecimalWorkerImportAllowsNotificationsOnlyAndNormalizesOps() {
        val minter = WorkerCommandPolicy.validateImport(AccountImportRequest(chainId = "minter", account = "Mxf85ceccfe2112e88be58162c43f5ec959672ab54", enableNotifications = true, enableAutoUpvoter = false, explicitConsent = true, notificationOps = listOf("send", "delegate", "privateKey")))
        assertTrue(minter.accepted)
        assertEquals(listOf("send", "delegate"), minter.notificationOps)
        val minterAuto = WorkerCommandPolicy.validateImport(AccountImportRequest(chainId = "minter", account = "Mxf85ceccfe2112e88be58162c43f5ec959672ab54", enableNotifications = false, enableAutoUpvoter = true, explicitConsent = true))
        assertFalse(minterAuto.accepted)
        assertTrue(minterAuto.reason.contains("auto-upvoter", ignoreCase = true))

        val decimal = WorkerCommandPolicy.validateImport(AccountImportRequest(chainId = "decimal", account = "dx0000000000000000000000000000000000000000", enableNotifications = true, enableAutoUpvoter = false, explicitConsent = true, notificationOps = listOf("send", "delegate", "nft")))
        assertTrue(decimal.accepted)
        assertEquals(listOf("send", "delegate", "nft"), decimal.notificationOps)
    }

    @Test fun jsonImportRejectsSecretLikeFields() {
        val json = """{"chainId":"golos","account":"denis","explicitConsent":true,"enableNotifications":true,"postingKey":"not-a-real-key-fixture"}"""
        val result = WorkerSettingsCodec.decodeImport(json)
        assertFalse(result.accepted)
        assertTrue(result.reason.contains("secret", ignoreCase = true))
    }

    @Test fun statusJsonContainsControlsAndLastLogWithoutSecrets() {
        val json = WorkerSettingsCodec.statusJson(running = true, workerEnabled = true, activeAccounts = 2, lastTick = 10L, nextTick = 20L, lastError = "privateKey=not-a-real-key-fixture", logs = "seed=not-a-real-secret-fixture\nworker ok")
        assertTrue(json.contains("\"canStart\":true"))
        assertTrue(json.contains("\"canStop\":true"))
        assertTrue(json.contains("[redacted]"))
        assertFalse(json.contains("secret"))
        assertFalse(json.contains("not-a-real-secret-fixture"))
    }
}
