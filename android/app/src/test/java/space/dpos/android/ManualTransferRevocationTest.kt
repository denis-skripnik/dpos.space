package space.dpos.android

import android.app.Activity
import android.app.AlertDialog
import android.app.Application
import android.content.Context
import android.content.SharedPreferences
import androidx.test.core.app.ApplicationProvider
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.shadows.ShadowAlertDialog
import space.dpos.android.bridge.BridgeRequest
import space.dpos.android.bridge.DposAndroidBridge
import space.dpos.android.decimal.*
import space.dpos.android.minter.*
import space.dpos.android.storage.WorkerStore
import space.dpos.android.worker.WorkerCancellation
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicReference

@RunWith(RobolectricTestRunner::class)
@Config(application = Application::class)
class ManualTransferRevocationTest {
    // Public BIP39 vector, never an operational wallet. Only the transport is replaced.
    private val seed = List(11) { "abandon" }.joinToString(" ") + " about"
    private enum class Boundary { KEY_READ, TRANSPORT, SUBMITTED, NONE }
    private enum class Revoke { STOP, DISABLE, CLOSE, NONE }

    @Test fun minterStopDuringKeyRead() = scenario(true, Boundary.KEY_READ, Revoke.STOP)
    @Test fun minterDisableDuringKeyRead() = scenario(true, Boundary.KEY_READ, Revoke.DISABLE)
    @Test fun minterCloseDuringKeyRead() = scenario(true, Boundary.KEY_READ, Revoke.CLOSE)
    @Test fun decimalStopDuringKeyRead() = scenario(false, Boundary.KEY_READ, Revoke.STOP)
    @Test fun decimalDisableDuringKeyRead() = scenario(false, Boundary.KEY_READ, Revoke.DISABLE)
    @Test fun decimalCloseDuringKeyRead() = scenario(false, Boundary.KEY_READ, Revoke.CLOSE)
    @Test fun minterStopBeforeTransport() = scenario(true, Boundary.TRANSPORT, Revoke.STOP)
    @Test fun minterDisableBeforeTransport() = scenario(true, Boundary.TRANSPORT, Revoke.DISABLE)
    @Test fun minterCloseBeforeTransport() = scenario(true, Boundary.TRANSPORT, Revoke.CLOSE)
    @Test fun decimalStopBeforeTransport() = scenario(false, Boundary.TRANSPORT, Revoke.STOP)
    @Test fun decimalDisableBeforeTransport() = scenario(false, Boundary.TRANSPORT, Revoke.DISABLE)
    @Test fun decimalCloseBeforeTransport() = scenario(false, Boundary.TRANSPORT, Revoke.CLOSE)
    @Test fun minterApprovedTransferStillSendsOnce() = scenario(true, Boundary.NONE, Revoke.NONE)
    @Test fun decimalApprovedTransferStillSendsOnce() = scenario(false, Boundary.NONE, Revoke.NONE)
    @Test fun minterSubmittedThenClosedRemainsSubmitted() = scenario(true, Boundary.SUBMITTED, Revoke.CLOSE)
    @Test fun decimalSubmittedThenClosedRemainsSubmitted() = scenario(false, Boundary.SUBMITTED, Revoke.CLOSE)
    @Test fun minterSubmittedThenStoppedErrorRemainsError() = scenario(true, Boundary.SUBMITTED, Revoke.STOP, true)
    @Test fun decimalSubmittedThenStoppedErrorRemainsError() = scenario(false, Boundary.SUBMITTED, Revoke.STOP, true)

    private fun scenario(minter: Boolean, boundary: Boundary, revoke: Revoke, transportError: Boolean = false) {
        awaitNativeStorage()
        WorkerCancellation.resetForTest()
        val context = ApplicationProvider.getApplicationContext<Context>()
        if (runCatching { androidx.work.WorkManager.getInstance(context) }.isFailure) {
            androidx.work.WorkManager.initialize(context, androidx.work.Configuration.Builder().build())
        }
        val entered = CountDownLatch(1)
        val release = CountDownLatch(1)
        fun pause(at: Boundary) {
            if (boundary == at) {
                entered.countDown()
                check(release.await(10, TimeUnit.SECONDS)) { "fixture boundary timed out" }
            }
        }
        val secure = context.getSharedPreferences("manual-transfer-fixture", Context.MODE_PRIVATE)
        secure.edit().clear().commit()
        val blockedSecure = object : SharedPreferences by secure {
            override fun getString(key: String?, defValue: String?): String? {
                val value = secure.getString(key, defValue)
                if (key?.startsWith("key:") == true) pause(Boundary.KEY_READ)
                return value
            }
        }
        val store = WorkerStore(context, blockedSecure)
        val from = if (minter) MinterNativeSupport.deriveAddress(seed) else DecimalNativeSupport.deriveWallet(seed).address
        val ref = if (minter) MinterNativeSupport.defaultSeedRef(from) else DecimalNativeSupport.defaultSeedRef(from)
        store.saveEncryptedKeyRef(ref, seed)
        val payload = JSONObject().put("from", from).put("amount", "1.000000000000000001").put("nonce", 1)
            .put("to", if (minter) "Mx0000000000000000000000000000000000000001" else "0x0000000000000000000000000000000000000001")
        // Full codec/derivation/signature path: exact signed bytes must match the real signer.
        val expected = if (minter) MinterTransferSigner.sign(MinterTransferCodec.decode(payload.toString()), seed)
        else {
            val decoded = DecimalTransferCodec.decode(payload.toString())
            DecimalTransferSigner.sign(decoded.copy(from = from), seed)
        }
        val calls = AtomicInteger()
        val signedBytes = AtomicReference<String>()
        fun transport(signed: String): JSONObject {
            calls.incrementAndGet()
            signedBytes.set(signed)
            pause(Boundary.SUBMITTED)
            if (transportError) throw IllegalStateException("fixture transport outcome unknown")
            return JSONObject().put("hash", "fixture-only-hash")
        }
        val controller = Robolectric.buildActivity(Activity::class.java).setup()
        val bridge = DposAndroidBridge(controller.get(), store,
            minterBroadcaster = {
                pause(Boundary.TRANSPORT)
                object : MinterBroadcaster { override fun broadcast(signedTx: String) = transport(signedTx) }
            },
            decimalBroadcaster = {
                pause(Boundary.TRANSPORT)
                object : DecimalBroadcaster { override fun broadcast(signedTx: String) = transport(signedTx) }
            }) { JSONObject() }
        val replies = AtomicInteger()
        val reply = AtomicReference<JSONObject>()
        val done = CountDownLatch(1)
        val revocationReplies = AtomicInteger()
        try {
            val method = if (minter) "executeMinterTransfer" else "executeDecimalTransfer"
            bridge.dispatch(BridgeRequest("transfer", method, payload)) {
                reply.set(it); replies.incrementAndGet(); done.countDown()
            }
            awaitNativeStorage()
            val dialog = ShadowAlertDialog.getLatestAlertDialog()
            assertNotNull("real native approval dialog", dialog)
            assertEquals(0, calls.get())
            dialog.getButton(AlertDialog.BUTTON_POSITIVE).performClick()
            org.robolectric.Shadows.shadowOf(android.os.Looper.getMainLooper()).idle()
            if (boundary != Boundary.NONE) assertTrue("approved execution reached $boundary", entered.await(5, TimeUnit.SECONDS))
            when (revoke) {
                Revoke.STOP -> bridge.dispatch(BridgeRequest("stop", "stopWorker", JSONObject())) { revocationReplies.incrementAndGet() }
                Revoke.DISABLE -> bridge.dispatch(BridgeRequest("disable", "importWorkerSettings", JSONObject()
                    .put("chainId", "golos").put("account", "alice").put("enableNotifications", false))) { revocationReplies.incrementAndGet() }
                Revoke.CLOSE -> { bridge.close(); controller.pause().stop().destroy() }
                Revoke.NONE -> Unit
            }
            release.countDown()
            assertTrue("exactly one internal terminal reply even after close", done.await(10, TimeUnit.SECONDS))
            bridge.close()
            // Orderly close must drain the actual executor, not just deliver an early callback.
            val executor = org.robolectric.util.ReflectionHelpers.getField<java.util.concurrent.ExecutorService>(bridge, "rpcExecutor")
            assertTrue(executor.awaitTermination(5, TimeUnit.SECONDS))
            awaitNativeStorage()
            assertEquals(1, replies.get())
            if (revoke == Revoke.STOP || revoke == Revoke.DISABLE) assertEquals(1, revocationReplies.get())
            val result = reply.get().getJSONObject("result")
            if (boundary == Boundary.KEY_READ || boundary == Boundary.TRANSPORT) {
                assertEquals("revoked approved transfer must not reach transport", 0, calls.get())
                assertFalse(result.getBoolean("ok"))
                assertFalse(result.getBoolean("broadcasted"))
                assertTrue(result.getString("reason").contains("cancelled"))
                if (boundary == Boundary.KEY_READ) assertTrue("no signing after revoked key read", result.isNull("signedTx"))
            } else {
                assertEquals(1, calls.get())
                assertEquals(expected, signedBytes.get())
                assertEquals(if (transportError) "broadcast_error" else "broadcast_sent", result.getString("status"))
                assertEquals(!transportError, result.getBoolean("ok"))
                if (transportError) assertEquals("fixture transport outcome unknown", result.getString("reason"))
            }
            assertFalse(reply.get().toString().contains(seed))
        } finally {
            release.countDown()
            bridge.close()
            val executor = org.robolectric.util.ReflectionHelpers.getField<java.util.concurrent.ExecutorService>(bridge, "rpcExecutor")
            assertTrue(executor.awaitTermination(10, TimeUnit.SECONDS))
            awaitNativeStorage()
        }
    }
}
