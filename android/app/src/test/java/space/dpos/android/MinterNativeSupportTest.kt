package space.dpos.android

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import space.dpos.android.minter.MinterNativeSupport
import space.dpos.android.minter.MinterTransferCodec
import space.dpos.android.minter.MinterTransferRequest
import space.dpos.android.minter.MinterTransferSigner
import space.dpos.android.runtime.SecureKeyImportPolicy
import space.dpos.android.runtime.SecureKeyImportRequest

class MinterNativeSupportTest {
    private val fixtureSeed = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"
    private val fixtureAddress = "Mx9858effd232b4033e47d90003d41ec34ecaeda94"

    @Test fun minterSeedImportIsSeparateFromWorkerSettingsAndRequiresAddressScopedSeedAuthority() {
        val accepted = SecureKeyImportPolicy.validate(SecureKeyImportRequest("minter", fixtureAddress, "seed", "seed", fixtureSeed, explicitConsent = true))
        assertTrue(accepted.accepted)
        assertEquals("minter", accepted.keyRef!!.chainId)
        assertEquals(fixtureAddress.lowercase(), accepted.keyRef!!.account)
        assertEquals("seed", accepted.keyRef!!.authority)

        assertFalse(SecureKeyImportPolicy.validate(SecureKeyImportRequest("minter", "main", "seed", "seed", fixtureSeed, explicitConsent = true)).accepted)
        assertFalse(SecureKeyImportPolicy.validate(SecureKeyImportRequest("minter", fixtureAddress, "posting", "posting", fixtureSeed, explicitConsent = true)).accepted)
        assertFalse(SecureKeyImportPolicy.validate(SecureKeyImportRequest("decimal", "dx0000000000000000000000000000000000000000", "seed", "seed", fixtureSeed, explicitConsent = true)).accepted)
    }

    @Test fun derivesMinterAddressFromDeterministicNonSecretMnemonicLikeBrowserVendorWallet() {
        assertEquals(fixtureAddress, MinterNativeSupport.deriveAddress(fixtureSeed))
    }

    @Test fun signsBipTransferWithUnsignedRlpParityToMinterVendorPrepareTxFixture() {
        val request = MinterTransferRequest(
            from = fixtureAddress,
            to = "Mx0000000000000000000000000000000000000001",
            amount = "1",
            coinId = 0,
            gasCoinId = 0,
            nonce = 1,
            memo = "",
            chainId = 1,
            gasPrice = 1
        )
        assertEquals(
            "0xea0101018001a0df80940000000000000000000000000000000000000001880de0b6b3a764000080800180",
            MinterTransferSigner.unsignedTransferForTest(request)
        )
        val signed = MinterTransferSigner.sign(request, fixtureSeed)
        assertTrue(signed.startsWith("0xf8700101018001a0df80940000000000000000000000000000000000000001880de0b6b3a7640000808001b845"))
        assertTrue(signed.length >= 220)
    }

    @Test fun previewProducesSignedPayloadButNeverBroadcastsOrPrintsSeed() {
        val request = MinterTransferRequest(
            from = fixtureAddress,
            to = "Mx0000000000000000000000000000000000000001",
            amount = "1",
            coinId = 0,
            gasCoinId = 0,
            nonce = 1
        )
        val result = MinterNativeSupport.signTransfer(request, fixtureSeed, previewOnly = true)
        val json = result.toJson().toString()
        assertTrue(result.ok)
        assertEquals("preview_ready", result.status)
        assertTrue(json.contains("\"broadcasted\":false"))
        assertTrue(json.contains("\"signedTx\""))
        assertFalse(json.contains(fixtureSeed))
    }

    @Test fun transferCodecRejectsSymbolOnlyCoinsSoNativeMilestoneDoesNotFakeCoinLookup() {
        val decoded = MinterTransferCodec.decode(JSONObject()
            .put("from", fixtureAddress)
            .put("to", "Mx0000000000000000000000000000000000000001")
            .put("amount", "1")
            .put("coinId", 0)
            .put("gasCoinId", 0)
            .put("nonce", 1)
            .toString())
        assertEquals(0, decoded.coinId)

        val rejected = runCatching { MinterTransferCodec.decode("""{"from":"$fixtureAddress","to":"Mx0000000000000000000000000000000000000001","amount":"1","coin":"BIP","nonce":1}""") }
        assertTrue(rejected.isFailure)
    }
}
