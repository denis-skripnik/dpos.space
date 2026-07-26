package space.dpos.android.runtime

import org.json.JSONObject
import space.dpos.android.core.PayloadSanitizer
import space.dpos.android.minter.MinterNativeSupport
import space.dpos.android.storage.EncryptedKeyRef
import space.dpos.android.upvoter.GrapheneChainSpecs

data class SecureKeyImportRequest(
    val chainId: String,
    val account: String,
    val authority: String,
    val alias: String,
    val secret: String,
    val explicitConsent: Boolean
)

data class SecureKeyImportDecision(
    val accepted: Boolean,
    val reason: String,
    val keyRef: EncryptedKeyRef? = null,
    val secret: String = ""
)

object SecureKeyImportPolicy {
    private val supportedChains = GrapheneChainSpecs.supportedNativeVoteChains + setOf(MinterNativeSupport.CHAIN_ID)
    private val authoritiesByChain = mapOf(
        "golos" to setOf("posting", "active"),
        "hive" to setOf("posting", "active"),
        "steem" to setOf("posting", "active"),
        "minter" to setOf("seed")
    )
    private val accountPattern = Regex("^[a-z0-9.-]{3,32}$")
    private val minterAddressPattern = Regex("^Mx[0-9a-fA-F]{40}$")
    private val aliasPattern = Regex("^[a-zA-Z0-9._-]{1,40}$")
    private val wifLike = Regex("^[5KL][1-9A-HJ-NP-Za-km-z]{40,60}$")

    fun validate(request: SecureKeyImportRequest): SecureKeyImportDecision {
        val chain = request.chainId.trim().lowercase()
        val account = request.account.trim().removePrefix("@").lowercase()
        val authority = request.authority.trim().lowercase()
        val alias = request.alias.trim().ifBlank { authority }
        val secret = request.secret.trim()

        if (!request.explicitConsent) return SecureKeyImportDecision(false, "explicit consent is required before importing a signing key")
        if (chain !in supportedChains) return SecureKeyImportDecision(false, "secure key import is not enabled for chain: $chain")
        if (chain == MinterNativeSupport.CHAIN_ID) {
            if (!minterAddressPattern.matches(request.account.trim())) return SecureKeyImportDecision(false, "invalid Minter address")
        } else if (!accountPattern.matches(account)) return SecureKeyImportDecision(false, "invalid account name")
        if (authority !in authoritiesByChain.getValue(chain)) return SecureKeyImportDecision(false, "invalid authority for $chain")
        if (!aliasPattern.matches(alias)) return SecureKeyImportDecision(false, "invalid key alias")
        if (chain == MinterNativeSupport.CHAIN_ID) {
            if (!MinterNativeSupport.validateSeed(secret)) return SecureKeyImportDecision(false, "invalid Minter seed phrase format")
        } else if (!wifLike.matches(secret)) return SecureKeyImportDecision(false, "invalid private key format")

        return SecureKeyImportDecision(
            accepted = true,
            reason = "accepted",
            keyRef = EncryptedKeyRef(chain, if (chain == MinterNativeSupport.CHAIN_ID) request.account.trim().lowercase() else account, authority, alias),
            secret = secret
        )
    }
}

object SecureKeyImportCodec {
    fun decode(json: String?): SecureKeyImportDecision {
        val raw = json.orEmpty().trim()
        if (raw.isBlank()) return SecureKeyImportDecision(false, "empty secure key import payload")
        return try {
            val obj = JSONObject(raw)
            SecureKeyImportPolicy.validate(
                SecureKeyImportRequest(
                    chainId = obj.optString("chainId"),
                    account = obj.optString("account"),
                    authority = obj.optString("authority", "posting"),
                    alias = obj.optString("alias", obj.optString("authority", "posting")),
                    secret = obj.optString("secret", obj.optString("wif")),
                    explicitConsent = obj.optBoolean("explicitConsent", false)
                )
            )
        } catch (e: Exception) {
            SecureKeyImportDecision(false, "invalid secure key JSON: ${PayloadSanitizer.text(e.message, 120)}")
        }
    }

    fun resultJson(decision: SecureKeyImportDecision, hasKey: Boolean = false): String {
        val keyRef = decision.keyRef
        return JSONObject()
            .put("ok", decision.accepted)
            .put("reason", decision.reason)
            .put("keyRef", keyRef?.let {
                JSONObject()
                    .put("chainId", it.chainId)
                    .put("account", it.account)
                    .put("authority", it.authority)
                    .put("alias", it.alias)
            } ?: JSONObject.NULL)
            .put("hasKey", hasKey)
            .toString()
    }
}
