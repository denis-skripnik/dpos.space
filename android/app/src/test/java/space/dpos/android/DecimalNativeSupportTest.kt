package space.dpos.android

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import space.dpos.android.decimal.DecimalNativeSupport
import space.dpos.android.decimal.DecimalTransferCodec
import space.dpos.android.decimal.DecimalTransferRequest
import space.dpos.android.decimal.DecimalTransferSigner
import space.dpos.android.runtime.SecureKeyImportPolicy
import space.dpos.android.runtime.SecureKeyImportRequest

class DecimalNativeSupportTest {
    private val fixtureSeed = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"
    private val fixtureAddress = "d01npvwllfr9dqr8erajqqr6s0vxnk2ak55twavxs"
    private val fixtureEvmAddress = "0x9858effd232b4033e47d90003d41ec34ecaeda94"

    @Test fun decimalSeedImportIsDedicatedAddressScopedSeedAuthority() {
        val accepted = SecureKeyImportPolicy.validate(SecureKeyImportRequest("decimal", fixtureAddress, "seed", "seed", fixtureSeed, explicitConsent = true))
        assertTrue(accepted.accepted)
        assertEquals("decimal", accepted.keyRef!!.chainId)
        assertEquals(fixtureAddress, accepted.keyRef!!.account)
        assertEquals("seed", accepted.keyRef!!.authority)

        assertFalse(SecureKeyImportPolicy.validate(SecureKeyImportRequest("decimal", "main", "seed", "seed", fixtureSeed, explicitConsent = true)).accepted)
        assertFalse(SecureKeyImportPolicy.validate(SecureKeyImportRequest("decimal", fixtureAddress, "posting", "posting", fixtureSeed, explicitConsent = true)).accepted)
        assertFalse(SecureKeyImportPolicy.validate(SecureKeyImportRequest("decimal", fixtureAddress, "seed", "seed", "not a seed", explicitConsent = true)).accepted)
    }

    @Test fun derivesDecimalD0AndEvmAddressesFromVendorDocumentedPath() {
        val wallet = DecimalNativeSupport.deriveWallet(fixtureSeed)
        assertEquals(fixtureAddress, wallet.address)
        assertEquals(fixtureEvmAddress, wallet.evmAddress)
        assertTrue(wallet.matches(fixtureAddress))
        assertTrue(wallet.matches(fixtureEvmAddress))
        assertTrue(wallet.matches("dx9858effd232b4033e47d90003d41ec34ecaeda94"))
    }

    @Test fun signsDeterministicLegacyEvmDelTransferPreviewWithoutBroadcastOrSeedLeak() {
        val request = DecimalTransferRequest(
            from = fixtureAddress,
            to = "d01qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq3a0c7h",
            amount = "1",
            nonce = 0,
            gasPrice = "50000000000".toBigInteger(),
            gasLimit = 21000,
            chainId = 75
        )
        assertEquals(
            "0xec80850ba43b7400825208940000000000000000000000000000000000000000880de0b6b3a7640000804b8080",
            DecimalTransferSigner.unsignedTransferForTest(request)
        )
        val result = DecimalNativeSupport.previewTransfer(request, fixtureSeed)
        val json = result.toJson().toString()
        assertTrue(result.ok)
        assertEquals("preview_ready", result.status)
        assertTrue(json.contains("\"broadcasted\":false"))
        assertTrue(json.contains("\"nativeSupport\":\"sendDELPreview\""))
        assertTrue(json.contains("\"signedTx\""))
        assertFalse(json.contains(fixtureSeed))
    }

    @Test fun transferCodecRejectsUnsupportedOrUnsafeShapes() {
        val decoded = DecimalTransferCodec.decode("""{"from":"$fixtureAddress","to":"$fixtureEvmAddress","amount":"1","nonce":0,"gasPrice":"50000000000","gasLimit":21000,"evmChainId":75}""")
        assertEquals(75, decoded.chainId)
        assertEquals(0, decoded.nonce)

        assertTrue(runCatching { DecimalTransferCodec.decode("""{"from":"$fixtureAddress","to":"not-address","amount":"1","nonce":0}""") }.isFailure)
        assertTrue(runCatching { DecimalTransferCodec.decode("""{"from":"$fixtureAddress","to":"$fixtureEvmAddress","amount":"0","nonce":0}""") }.isFailure)
        assertTrue(runCatching { DecimalTransferCodec.decode("""{"from":"$fixtureAddress","to":"$fixtureEvmAddress","amount":"1","nonce":0,"gasLimit":1}""") }.isFailure)
    }
}
