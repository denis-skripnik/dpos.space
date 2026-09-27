package space.dpos.android

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import space.dpos.android.diagnostics.DiagnosticSanitizer

class DiagnosticSanitizerTest {
    @Test fun preservesJsonStructureWhenRedactingMessageValues() {
        val source = org.json.JSONObject().put("message", "password=fixture-secret").put("accountsChecked", 4)
        val result = org.json.JSONObject(DiagnosticSanitizer.sanitize(source.toString()))
        assertTrue(result.getInt("accountsChecked") == 4)
        assertFalse(result.toString().contains("fixture-secret"))
    }
    @Test fun handlesEmbeddedMnemonicsNestedPayloadsAndCredentials() {
        val phrase = List(11) { "abandon" }.plus("about").joinToString(" ")
        val nested = "RPC failed {\"signedTransaction\":{\"operations\":[[\"transfer\",{\"memo\":\"never-persist-payload\"}]],\"signatures\":[\"never-persist-signature\"]},\"safe\":\"retained\"}"
        val clean = DiagnosticSanitizer.sanitize("request failed please check $phrase now\n$nested\napiKey=never-persist-api\nAuthorization: Bearer never-persist-bearer\n" + "ab".repeat(32))
        for (secret in listOf(phrase, "never-persist-payload", "never-persist-signature", "never-persist-api", "never-persist-bearer", "ab".repeat(32))) assertFalse(secret, clean.contains(secret))
        assertTrue(clean.contains("retained"))
    }
    @Test fun redactsSecretsMnemonicsWifsAndSignedTransactionsBeforePersistence() {
        val mnemonic = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"
        val wif = "5HueCGU8rMjxEXxiPuD5BDuRaK5jNZwUqQXLhJDyKxQswN5Z8V5"
        val input = "password=hunter2 seed=$mnemonic wif=$wif {\"signedTransaction\":\"0xdeadbeef1234\",\"safe\":\"kept\"}"
        val clean = DiagnosticSanitizer.sanitize(input)
        assertFalse(clean.contains("hunter2"))
        assertFalse(clean.contains(mnemonic))
        assertFalse(clean.contains(wif))
        assertFalse(clean.contains("deadbeef1234"))
        assertTrue(clean.contains("safe"))
        assertTrue(clean.contains("[redacted]"))
    }
}
