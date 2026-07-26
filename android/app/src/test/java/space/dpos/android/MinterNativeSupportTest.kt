package space.dpos.android

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import space.dpos.android.minter.MinterNativeSupport
import space.dpos.android.minter.MinterBroadcastRequestBody
import space.dpos.android.minter.MinterBroadcastResponseParser
import space.dpos.android.minter.MinterBroadcaster
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
        assertFalse(SecureKeyImportPolicy.validate(SecureKeyImportRequest("decimal", "dx0000000000000000000000000000000000000000", "posting", "posting", fixtureSeed, explicitConsent = true)).accepted)
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

    @Test fun executeSignsAndBroadcastsThroughInjectedFakeBroadcasterWithoutMainnetCall() {
        val request = MinterTransferRequest(
            from = fixtureAddress,
            to = "Mx0000000000000000000000000000000000000001",
            amount = "1",
            coinId = 0,
            gasCoinId = 0,
            nonce = 1,
            memo = "native send"
        )
        val broadcaster = RecordingMinterBroadcaster()
        val result = MinterNativeSupport.executeTransfer(request, fixtureSeed, broadcaster)

        assertTrue(result.ok)
        assertEquals("broadcast_sent", result.status)
        assertFalse(result.previewOnly)
        assertEquals(1, broadcaster.broadcastCount)
        assertTrue(broadcaster.lastSignedTx!!.startsWith("0x"))
        assertEquals("fake-hash", result.broadcastResponse!!.getString("hash"))
        assertFalse(result.toJson().toString().contains(fixtureSeed))
    }

    @Test fun minterBroadcastRequestAndResponseParsingMatchesVendorSendTransactionSemantics() {
        val body = MinterBroadcastRequestBody.fromSignedTx("0xfake")
        assertEquals("0xfake", JSONObject(body).getString("tx"))

        val parsedHash = MinterBroadcastResponseParser.parse(JSONObject().put("data", JSONObject().put("hash", "Mtdead")).toString())
        assertEquals("Mtdead", parsedHash.getString("hash"))

        val parsedTx = MinterBroadcastResponseParser.parse(JSONObject().put("data", JSONObject().put("transaction", JSONObject().put("hash", "Mtok").put("code", 0))).toString())
        assertEquals("Mtok", parsedTx.getString("hash"))

        val failed = runCatching { MinterBroadcastResponseParser.parse(JSONObject().put("data", JSONObject().put("transaction", JSONObject().put("code", 42).put("log", "bad tx"))).toString()) }
        assertTrue(failed.isFailure)
        assertTrue(failed.exceptionOrNull()!!.message!!.contains("error code 42"))
    }

    private class RecordingMinterBroadcaster : MinterBroadcaster {
        var broadcastCount = 0
        var lastSignedTx: String? = null
        override fun broadcast(signedTx: String): JSONObject {
            broadcastCount += 1
            lastSignedTx = signedTx
            return JSONObject().put("hash", "fake-hash")
        }
    }
}
