package space.dpos.android

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.json.JSONObject
import space.dpos.android.decimal.DecimalBroadcastRequestBody
import space.dpos.android.decimal.DecimalBroadcastResponseParser
import space.dpos.android.decimal.DecimalBroadcaster
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

    @Test fun executeSignsThenUsesInjectedBroadcasterWithoutLiveMainnetCall() {
        val request = DecimalTransferRequest(
            from = fixtureAddress,
            to = "d01qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq3a0c7h",
            amount = "1",
            nonce = 0,
            gasPrice = "50000000000".toBigInteger(),
            gasLimit = 21000,
            chainId = 75
        )
        val calls = mutableListOf<String>()
        val fake = object : DecimalBroadcaster {
            override fun broadcast(signedTx: String): JSONObject {
                calls += signedTx
                return DecimalBroadcastResponseParser.parse("""{"jsonrpc":"2.0","id":1,"result":"0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}""")
            }
        }

        val result = DecimalNativeSupport.executeTransfer(request, fixtureSeed, fake)
        val json = result.toJson().toString()

        assertTrue(result.ok)
        assertEquals("broadcast_sent", result.status)
        assertEquals(1, calls.size)
        assertTrue(calls.single().startsWith("0x"))
        assertTrue(json.contains("\"broadcasted\":true"))
        assertTrue(json.contains("\"nativeSupport\":\"sendDEL\""))
        assertTrue(json.contains("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"))
        assertFalse(json.contains(fixtureSeed))
    }

    @Test fun decimalJsonRpcBroadcastBodyAndResponseParsingMatchVerifiedWeb3Endpoint() {
        val body = JSONObject(DecimalBroadcastRequestBody.fromSignedTx("0x1234"))
        assertEquals("2.0", body.getString("jsonrpc"))
        assertEquals(1, body.getInt("id"))
        assertEquals("eth_sendRawTransaction", body.getString("method"))
        assertEquals("0x1234", body.getJSONArray("params").getString(0))
        assertEquals(1, body.getJSONArray("params").length())

        val parsed = DecimalBroadcastResponseParser.parse("""{"jsonrpc":"2.0","id":1,"result":"0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd"}""")
        assertEquals("0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd", parsed.getString("hash"))
        assertEquals("eth_sendRawTransaction", parsed.getString("method"))

        val failure = runCatching { DecimalBroadcastResponseParser.parse("""{"jsonrpc":"2.0","id":4,"error":{"code":-32000,"message":"rlp: value size exceeds available input length","data":"verbose"}}""") }
        assertTrue(failure.isFailure)
        assertTrue(failure.exceptionOrNull()!!.message!!.contains("Decimal eth_sendRawTransaction error -32000"))
        assertFalse(failure.exceptionOrNull()!!.message!!.contains("verbose"))
    }

    @Test fun executeBroadcastErrorsAreSanitizedAndDoNotLeakSeed() {
        val request = DecimalTransferRequest(
            from = fixtureAddress,
            to = fixtureEvmAddress,
            amount = "1",
            nonce = 0,
            gasPrice = "50000000000".toBigInteger(),
            gasLimit = 21000,
            chainId = 75
        )
        val fake = object : DecimalBroadcaster {
            override fun broadcast(signedTx: String): JSONObject {
                throw IllegalStateException("node rejected transaction for safe fixture")
            }
        }
        val result = DecimalNativeSupport.executeTransfer(request, fixtureSeed, fake)
        val json = result.toJson().toString()
        assertFalse(result.ok)
        assertEquals("broadcast_error", result.status)
        assertTrue(json.contains("node rejected transaction"))
        assertFalse(json.contains(fixtureSeed))
        assertTrue(json.contains("\"broadcasted\":false"))
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
