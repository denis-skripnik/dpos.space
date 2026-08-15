package space.dpos.android

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import space.dpos.android.runtime.AccountImportRequest
import space.dpos.android.runtime.WorkerCommandPolicy
import space.dpos.android.runtime.WorkerSettingsCodec
import space.dpos.android.worker.WorkerRunSummary

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

    @Test fun workerSettingsCodecPreservesAutoStartFlag() {
        val decoded = WorkerSettingsCodec.decodeImport("""{"chainId":"golos","account":"denis","enableNotifications":false,"enableAutoUpvoter":true,"autoStart":true,"explicitConsent":true}""")
        assertTrue(decoded.accepted)
        assertTrue(decoded.autoStart)
        val json = WorkerSettingsCodec.decisionJson(decoded)
        assertTrue(json.contains("\"autoStart\":true"))
    }

    @Test fun statusJsonContainsControlsAndLastLogWithoutSecrets() {
        val json = WorkerSettingsCodec.statusJson(running = true, workerEnabled = true, activeAccounts = 2, lastTick = 10L, nextTick = 20L, lastError = "privateKey=not-a-real-key-fixture", logs = "seed=not-a-real-secret-fixture\nworker ok")
        assertTrue(json.contains("\"canStart\":true"))
        assertTrue(json.contains("\"canStop\":true"))
        assertTrue(json.contains("[redacted]"))
        assertFalse(json.contains("secret"))
        assertFalse(json.contains("not-a-real-secret-fixture"))
    }

    @Test fun workerSummaryCarriesAndroidAutoUpvoterFeedForWebViewRendering() {
        val feedEntry = JSONObject()
            .put("message", "ERROR @denis @alice/post: broadcast_error: node rejected transaction")
            .put("action", JSONObject().put("account", "denis").put("author", "alice").put("permlink", "post"))
            .put("result", JSONObject().put("status", "broadcast_error").put("ok", false).put("reason", "node rejected transaction"))
        val json = WorkerRunSummary(
            ok = true,
            status = "checked",
            accountsChecked = 1,
            notificationChecks = 0,
            notificationsShown = 0,
            autoUpvoterChecks = 1,
            autoUpvoterAttempted = 1,
            autoUpvoterBroadcasted = 1,
            skipped = 0,
            errors = emptyList(),
            messages = listOf("done"),
            lastTick = 10L,
            autoUpvoterFeed = listOf(feedEntry)
        ).toJson()
        assertEquals(1, json.getJSONArray("autoUpvoterFeed").length())
        val row = json.getJSONArray("autoUpvoterFeed").getJSONObject(0)
        assertTrue(row.getString("message").contains("node rejected transaction"))
        assertEquals("node rejected transaction", row.getJSONObject("result").getString("reason"))
    }
}
