package space.dpos.android

import android.app.Activity
import android.content.Context
import androidx.test.core.app.ApplicationProvider
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import space.dpos.android.bridge.DposAndroidBridge
import space.dpos.android.storage.EncryptedKeyRef
import space.dpos.android.storage.WorkerStore

@RunWith(RobolectricTestRunner::class)
class NativeSecureKeyImportEntryPointTest {
    private val validSeed = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"
    private val fixtureAddress = "Mx9858effd232b4033e47d90003d41ec34ecaeda94"

    @Test fun bridgeRejectsInvalidMnemonicBeforeWriteAndPreservesStoredRecord() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val secure = context.getSharedPreferences("native-import-entry-invalid", Context.MODE_PRIVATE)
        val store = WorkerStore(context, secure)
        val ref = EncryptedKeyRef("minter", fixtureAddress.lowercase(), "seed", "seed")
        store.saveEncryptedKeyRef(ref, "legacy-record-must-remain")
        val bridge = bridge(store)

        val response = JSONObject(bridge.importSecureKey(JSONObject()
            .put("chainId", "minter")
            .put("account", fixtureAddress)
            .put("authority", "seed")
            .put("alias", "seed")
            .put("secret", List(12) { "abandon" }.joinToString(" "))
            .put("explicitConsent", true)
            .toString()))

        assertFalse(response.getBoolean("ok"))
        assertEquals("legacy-record-must-remain", store.readEncryptedKey(ref))
    }

    @Test fun bridgeRejectsAddressMismatchBeforeWriteAndPreservesStoredRecord() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val secure = context.getSharedPreferences("native-import-entry-mismatch", Context.MODE_PRIVATE)
        val store = WorkerStore(context, secure)
        val address = "Mx0000000000000000000000000000000000000000"
        val ref = EncryptedKeyRef("minter", address.lowercase(), "seed", "seed")
        store.saveEncryptedKeyRef(ref, "another-legacy-record")
        val bridge = bridge(store)

        val response = JSONObject(bridge.importSecureKey(JSONObject()
            .put("chainId", "minter")
            .put("account", address)
            .put("authority", "seed")
            .put("alias", "seed")
            .put("secret", validSeed)
            .put("explicitConsent", true)
            .toString()))

        assertFalse(response.getBoolean("ok"))
        assertEquals("another-legacy-record", store.readEncryptedKey(ref))
    }

    private fun bridge(store: WorkerStore): DposAndroidBridge {
        val activity = Robolectric.buildActivity(Activity::class.java).setup().get()
        return DposAndroidBridge(activity, store) { JSONObject() }
    }
}
