package space.dpos.android

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import space.dpos.android.notifications.RestWalletHistoryClient
import space.dpos.android.notifications.RestWalletNotificationScanner

class RestWalletNotificationScannerTest {
    @Test fun minterSendFixtureBecomesWalletNotificationWithoutNetwork() {
        val client = RestWalletHistoryClient("minter")
        val rows = client.parseTransactions("""
            {"data":[{"hash":"Mt01","type":"send","timestamp":"2026-07-26T10:00:00","data":{"from":"Mx1111111111111111111111111111111111111111","to":"Mxf85ceccfe2112e88be58162c43f5ec959672ab54","value":"1000000000000000000","coin":"BIP"}}]}
        """.trimIndent())
        val scanner = RestWalletNotificationScanner("minter", client)
        val (_, notifications) = scanner.scan("Mxf85ceccfe2112e88be58162c43f5ec959672ab54", 0L, rows, baselineDone = true, selectedOps = listOf("send"))
        assertEquals(1, notifications.size)
        assertEquals("Перевод", notifications[0].title)
        assertTrue(notifications[0].route.contains("chain=minter"))
        assertTrue(notifications[0].route.contains("ops=send"))
    }

    @Test fun decimalDelegateFixtureIsFilteredBySelectedOps() {
        val client = RestWalletHistoryClient("decimal")
        val rows = client.parseTransactions("""
            {"result":{"txs":[
              {"hash":"Dx01","type":"delegate","timestamp":"2026-07-26T10:00:00Z","data":{"delegator":"dx0000000000000000000000000000000000000000","validator":"dx1111111111111111111111111111111111111111","stake":"5000000000000000000","denom":"DEL"}},
              {"hash":"Dx02","type":"send","timestamp":"2026-07-26T10:01:00Z","data":{"from":"dx2222222222222222222222222222222222222222","to":"dx3333333333333333333333333333333333333333","amount":"1","denom":"DEL"}}
            ]}}
        """.trimIndent())
        val scanner = RestWalletNotificationScanner("decimal", client)
        val (_, notifications) = scanner.scan("dx0000000000000000000000000000000000000000", 0L, rows, baselineDone = true, selectedOps = listOf("delegate"))
        assertEquals(1, notifications.size)
        assertEquals("Делегирование", notifications[0].title)
        assertTrue(notifications[0].route.contains("chain=decimal"))
        assertTrue(notifications[0].text.contains("DEL"))
    }

    @Test fun firstScanOnlySetsBaseline() {
        val client = RestWalletHistoryClient("minter")
        val rows = client.parseTransactions("""
            {"transactions":[{"hash":"Mt01","type":"send","timestamp":"2026-07-26T10:00:00Z","data":{"from":"Mx1","to":"Mx2","value":"1","coin":"BIP"}}]}
        """.trimIndent())
        val scanner = RestWalletNotificationScanner("minter", client)
        val (cursor, notifications) = scanner.scan("Mx2", null, rows, baselineDone = false, selectedOps = listOf("send"))
        assertTrue(cursor > 0L)
        assertTrue(notifications.isEmpty())
    }


    @Test fun minterAndDecimalMultisendAliasesBecomeCanonicalNotifications() {
        val minterClient = RestWalletHistoryClient("minter")
        val minterRows = minterClient.parseTransactions("""
            {"data":[{"hash":"Mt13","type":"multisend_coin","timestamp":"2026-07-26T10:02:00Z","data":{"from":"Mx1111111111111111111111111111111111111111","list":[{"address":"Mxf85ceccfe2112e88be58162c43f5ec959672ab54","value":"1","coin":"BIP"}]}}]}
        """.trimIndent())
        val (_, minterNotifications) = RestWalletNotificationScanner("minter", minterClient).scan("Mxf85ceccfe2112e88be58162c43f5ec959672ab54", 0L, minterRows, baselineDone = true, selectedOps = listOf("multisend"))
        assertEquals(1, minterNotifications.size)
        assertEquals("Мульти-отправка", minterNotifications[0].title)
        assertTrue(minterNotifications[0].route.contains("ops=multisend"))

        val decimalClient = RestWalletHistoryClient("decimal")
        val decimalRows = decimalClient.parseTransactions("""
            {"result":{"txs":[{"hash":"DxMulti","type":"/decimal.coin.v1.MsgMultiSendCoin","timestamp":"2026-07-26T10:03:00Z","data":{"from":"dx1111111111111111111111111111111111111111","recipients":[{"address":"dx0000000000000000000000000000000000000000","amount":"1","denom":"DEL"}]}}]}}
        """.trimIndent())
        val (_, decimalNotifications) = RestWalletNotificationScanner("decimal", decimalClient).scan("dx0000000000000000000000000000000000000000", 0L, decimalRows, baselineDone = true, selectedOps = listOf("multisend"))
        assertEquals(1, decimalNotifications.size)
        assertEquals("Мульти-отправка", decimalNotifications[0].title)
        assertTrue(decimalNotifications[0].route.contains("ops=multisend"))
    }
}
