package space.dpos.android

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import space.dpos.android.bridge.AndroidBridgeProtocol
import space.dpos.android.bridge.BridgeRequest
import space.dpos.android.bridge.BridgeTransportPolicy
import space.dpos.android.bridge.NativeBridgeInteractionPolicy
import space.dpos.android.decimal.DecimalNativeSupport
import space.dpos.android.decimal.DecimalTransferCodec
import space.dpos.android.minter.MinterNativeSupport
import space.dpos.android.minter.MinterTransferCodec

class AndroidBridgeProtocolTest {

    @Test fun acceptsOnlyVersionTwoRequestsWithStableIdsAndObjectPayloads() {
        val request = AndroidBridgeProtocol.decodeRequest("""{"version":2,"id":"req-7","method":"getAppInfo","payload":{}}""")
        assertEquals("req-7", request.id)
        assertEquals("getAppInfo", request.method)
        assertEquals(0, request.payload.length())

        assertTrue(runCatching { AndroidBridgeProtocol.decodeRequest("""{"version":1,"id":"old","method":"getAppInfo","payload":{}}""") }.isFailure)
        assertTrue(runCatching { AndroidBridgeProtocol.decodeRequest("""{"version":2,"id":"","method":"getAppInfo","payload":{}}""") }.isFailure)
        assertTrue(runCatching { AndroidBridgeProtocol.decodeRequest("""{"version":2,"id":"x","method":"getAppInfo","payload":"bad"}""") }.isFailure)
    }

    @Test fun responseEnvelopeIsVersionedCorrelatedAndNeverDoubleEncodesJsonResults() {
        val response = AndroidBridgeProtocol.success("req-7", "{\"platform\":\"android\"}")
        assertEquals(2, response.getInt("version"))
        assertEquals("req-7", response.getString("id"))
        assertTrue(response.getBoolean("ok"))
        assertEquals("android", response.getJSONObject("result").getString("platform"))
        assertFalse(response.has("error"))

        val error = AndroidBridgeProtocol.failure("req-8", "unsupported_method", "not allowed")
        assertFalse(error.getBoolean("ok"))
        assertEquals("not allowed", error.getString("error"))
        assertEquals("unsupported_method", error.getString("errorCode"))
    }

    @Test fun transportPolicyRequiresExactProductionOriginAndMainFrame() {
        assertTrue(BridgeTransportPolicy.accepts("https://dpos.blinddev.xyz", isMainFrame = true))
        assertFalse(BridgeTransportPolicy.accepts("https://dpos.blinddev.xyz/", isMainFrame = true))
        assertFalse(BridgeTransportPolicy.accepts("https://dpos.blinddev.xyz.evil.example", isMainFrame = true))
        assertFalse(BridgeTransportPolicy.accepts("http://dpos.blinddev.xyz", isMainFrame = true))
        assertFalse(BridgeTransportPolicy.accepts("https://dpos.blinddev.xyz", isMainFrame = false))
    }

    @Test fun manualTransferPreviewsAreUnsignedAndNetworksCannotBeSelectedByWebPayload() {
        val minter = MinterTransferCodec.decode("""{"from":"Mx9858effd232b4033e47d90003d41ec34ecaeda94","to":"Mx0000000000000000000000000000000000000001","amount":"1","nonce":1,"minterChainId":99}""")
        assertEquals(MinterNativeSupport.MAINNET_CHAIN_ID, minter.chainId)
        val minterPreview = MinterNativeSupport.previewUnsignedTransfer(minter)
        assertFalse(minterPreview.has("signedTx"))
        assertFalse(minterPreview.getJSONObject("request").has("signedTx"))
        assertTrue(minterPreview.has("unsignedTx"))

        val decimal = DecimalTransferCodec.decode("""{"from":"d01npvwllfr9dqr8erajqqr6s0vxnk2ak55twavxs","to":"0x0000000000000000000000000000000000000001","amount":"1","nonce":0,"evmChainId":1}""")
        assertEquals(DecimalNativeSupport.DEFAULT_EVM_CHAIN_ID, decimal.chainId)
        val decimalPreview = DecimalNativeSupport.previewUnsignedTransfer(decimal)
        assertFalse(decimalPreview.has("signedTx"))
        assertFalse(decimalPreview.getJSONObject("request").has("signedTx"))
        assertTrue(decimalPreview.has("unsignedTx"))
    }

    @Test fun nativeConsentDetailsAreCanonicalAndIncludeSenderNetworkRecipientAmountAndMaximumFee() {
        val minter = MinterTransferCodec.decode("""{"from":"Mx9858effd232b4033e47d90003d41ec34ecaeda94","to":"Mx0000000000000000000000000000000000000001","amount":"1.00","nonce":1,"gasPrice":2}""")
        val m = MinterNativeSupport.consentDetails(minter)
        assertEquals("Minter mainnet (chain ID 1)", m.getString("network"))
        assertTrue(m.getString("sender").startsWith("Mx"))
        assertEquals("1 coin #0", m.getString("amount"))
        assertTrue(m.getString("maxFee").contains("gas price 2"))

        val decimal = DecimalTransferCodec.decode("""{"from":"d01npvwllfr9dqr8erajqqr6s0vxnk2ak55twavxs","to":"0x0000000000000000000000000000000000000001","amount":"1.00","nonce":0,"gasPrice":"50000000000","gasLimit":21000}""")
        val d = DecimalNativeSupport.consentDetails(decimal)
        assertEquals("Decimal mainnet (EVM chain ID 75)", d.getString("network"))
        assertEquals("1 DEL", d.getString("amount"))
        assertEquals("0.00105 DEL (21000 gas × 50000000000 wei)", d.getString("maxFee"))
    }

    @Test fun settingsAndSecureImportsDoNotRequireAnExtraNativeDialog() {
        listOf(
            "importWorkerSettings",
            "syncAutoUpvoterSettings",
            "syncVizSelfAwardSettings",
            "importSecureKey"
        ).forEach { method -> assertFalse(method, NativeBridgeInteractionPolicy.requiresNativeDialog(method)) }
    }

    @Test fun manualTransfersStillRequireNativeConfirmation() {
        assertTrue(NativeBridgeInteractionPolicy.requiresNativeDialog("executeMinterTransfer"))
        assertTrue(NativeBridgeInteractionPolicy.requiresNativeDialog("executeDecimalTransfer"))
    }

}
