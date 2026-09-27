package space.dpos.android.bridge

import org.json.JSONObject
import space.dpos.android.core.PayloadSanitizer

data class BridgeRequest(val id: String, val method: String, val payload: JSONObject)

object BridgeTransportPolicy {
    const val BRIDGE_VERSION = 2
    const val ALLOWED_ORIGIN = "https://dpos.blinddev.xyz"
    const val JS_OBJECT_NAME = "DposAndroidTransport"

    fun accepts(sourceOrigin: String, isMainFrame: Boolean): Boolean =
        isMainFrame && sourceOrigin == ALLOWED_ORIGIN
}

object NativeBridgeInteractionPolicy {
    fun requiresNativeDialog(method: String): Boolean =
        method == "executeMinterTransfer" || method == "executeDecimalTransfer"
}

object AndroidBridgeProtocol {
    private val idPattern = Regex("^[A-Za-z0-9._:-]{1,96}$")
    private val methodPattern = Regex("^[A-Za-z][A-Za-z0-9]{0,63}$")

    fun decodeRequest(raw: String): BridgeRequest {
        require(raw.length <= 128_000) { "bridge request is too large" }
        val obj = JSONObject(raw)
        require(obj.optInt("version", -1) == BridgeTransportPolicy.BRIDGE_VERSION) { "unsupported bridge version" }
        val id = obj.optString("id").trim()
        require(idPattern.matches(id)) { "invalid bridge request id" }
        val method = obj.optString("method").trim()
        require(methodPattern.matches(method)) { "invalid bridge method" }
        val payload = obj.optJSONObject("payload") ?: throw IllegalArgumentException("bridge payload must be an object")
        return BridgeRequest(id, method, payload)
    }

    fun success(id: String, resultJson: String): JSONObject {
        val result = resultJson.trim().let { raw ->
            if (raw.startsWith("{") && raw.endsWith("}")) runCatching { JSONObject(raw) }.getOrElse { raw }
            else raw
        }
        return JSONObject()
            .put("version", BridgeTransportPolicy.BRIDGE_VERSION)
            .put("id", id)
            .put("ok", true)
            .put("result", result)
    }

    fun failure(id: String, code: String, message: String): JSONObject = JSONObject()
        .put("version", BridgeTransportPolicy.BRIDGE_VERSION)
        .put("id", id)
        .put("ok", false)
        .put("error", PayloadSanitizer.text(message, 300))
        .put("errorCode", code.take(64))
}
