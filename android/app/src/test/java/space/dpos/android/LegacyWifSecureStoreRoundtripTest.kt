package space.dpos.android

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import org.bitcoinj.core.ECKey
import org.bitcoinj.params.MainNetParams
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import space.dpos.android.runtime.SecureKeyImportCodec
import space.dpos.android.storage.WorkerStore
import space.dpos.android.upvoter.GraphenePublicKey
import java.math.BigInteger

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [28])
class LegacyWifSecureStoreRoundtripTest {
    private lateinit var context: Context

    @Before fun resetPrefs() {
        context = ApplicationProvider.getApplicationContext()
        context.getSharedPreferences("dpos_worker", Context.MODE_PRIVATE).edit().clear().commit()
        context.getSharedPreferences("dpos_worker_secure_test", Context.MODE_PRIVATE).edit().clear().commit()
    }

    @Test fun androidSecureStoreRoundtripsLegacyFiveWifExactlyForWorkerPostingKey() {
        assertTrue(LEGACY_FIVE_WIF.startsWith("5"))
        val payload = JSONObject()
            .put("chainId", "golos")
            .put("account", "denis-test")
            .put("authority", "posting")
            .put("alias", "posting")
            .put("secret", LEGACY_FIVE_WIF)
            .put("explicitConsent", true)
            .toString()
        val decision = SecureKeyImportCodec.decode(payload)
        assertTrue(decision.reason, decision.accepted)
        val ref = decision.keyRef!!

        val securePrefs = context.getSharedPreferences("dpos_worker_secure_test", Context.MODE_PRIVATE)
        val store = WorkerStore(context, securePrefs)
        store.saveEncryptedKeyRef(ref, decision.secret)

        assertTrue(store.hasPostingKey("golos", "denis-test"))
        assertEquals(LEGACY_FIVE_WIF, store.readPostingKey("golos", "denis-test"))
        assertEquals(LEGACY_FIVE_WIF, store.readEncryptedKey(ref))
    }

    @Test fun androidGraphenePublicKeyMatchesCompressedKeyForLegacyFiveWif() {
        val compressedWif = ECKey.fromPrivate(BigInteger("2"), true).getPrivateKeyAsWiF(MainNetParams.get())
        assertTrue(LEGACY_FIVE_WIF.startsWith("5"))
        assertTrue(compressedWif.startsWith("K") || compressedWif.startsWith("L"))
        assertEquals(GraphenePublicKey.fromWif(compressedWif), GraphenePublicKey.fromWif(LEGACY_FIVE_WIF))
    }

    companion object {
        // Deterministic non-secret secp256k1 private key = 2, encoded as legacy Graphene/Golos WIF without compression marker.
        private const val LEGACY_FIVE_WIF = "5HpHagT65TZzG1PH3CSu63k8DbpvD8s5ip4nEB3kEsreAvUcVfH"
    }
}
