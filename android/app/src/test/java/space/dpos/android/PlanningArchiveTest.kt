package space.dpos.android

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import space.dpos.android.storage.*
import space.dpos.android.upvoter.*
import java.io.File

@RunWith(RobolectricTestRunner::class)
class PlanningArchiveTest {
    @Test fun nativeQueueKeepsTaskLocalViewsAndSerialMutationOrdering() {
        HostFullFlowProductionFixture().use { p ->
            val count = java.util.concurrent.atomic.AtomicInteger()
            val checkpoint = TransactionCheckpointStore(File(p.f.context.filesDir, "transaction-checkpoint"), p.f.prefs) { stage, _ -> if (stage == "checkpoint:load") count.incrementAndGet() }
            count.set(0)
            val firstEntered = java.util.concurrent.CountDownLatch(1)
            val release = java.util.concurrent.CountDownLatch(1)
            val finished = java.util.concurrent.CountDownLatch(2)
            val error = java.util.concurrent.atomic.AtomicReference<Throwable>()
            val order = java.util.Collections.synchronizedList(mutableListOf<Int>())
            NativeStorageQueue.execute {
                try {
                    repeat(20) { checkpoint.read("golosRecoveryFence") }
                    assertEquals(1, count.get())
                    firstEntered.countDown(); release.await(10, java.util.concurrent.TimeUnit.SECONDS)
                    checkpoint.put(mapOf("lastVizSelfAwardAt:fixture" to 5L))
                    order += 1
                } catch (e: Throwable) { error.set(e) } finally { finished.countDown() }
            }
            assertTrue(firstEntered.await(15, java.util.concurrent.TimeUnit.SECONDS))
            NativeStorageQueue.execute {
                try {
                    assertEquals(listOf(1), order.toList())
                    assertEquals(5L, checkpoint.read("lastVizSelfAwardAt:fixture"))
                    val before = count.get()
                    repeat(20) { checkpoint.read("golosRecoveryFence") }
                    assertEquals(before, count.get())
                    order += 2
                } catch (e: Throwable) { error.set(e) } finally { finished.countDown() }
            }
            release.countDown()
            assertTrue(finished.await(20, java.util.concurrent.TimeUnit.SECONDS))
            error.get()?.let { throw it }
            assertEquals(listOf(1, 2), order.toList())
        }
    }
    @Test fun operationViewRejectsSameSizeAndMtimeAuthorityOrBackupTampering() {
        for (name in listOf("transactions.json", "legacy-import.json")) HostFullFlowProductionFixture().use { p ->
            val file = File(p.f.context.filesDir, "transaction-checkpoint/$name")
            TransactionCheckpointStore.readOperation {
                assertNotNull(p.f.store.readGolosRecoveryFence())
                val stamp = file.lastModified()
                val bytes = file.readBytes()
                val changed = bytes.copyOf().also { it[0] = '!'.code.toByte() }
                file.writeBytes(changed); file.setLastModified(stamp)
                assertTrue("cached authority survived $name tampering", runCatching { p.f.store.readGolosRecoveryFence() }.isFailure)
                assertTrue(runCatching { p.f.store.assertTransactionAuthority("vote", "golos", "fixture-voter") }.isFailure)
            }
        }
    }
    @Test fun largeGenerationArchiveHasConstantAuthorityReadsAndNoCrossOperationCache() {
        HostFullFlowProductionFixture().use { p ->
            p.ready()
            p.run()
            val fence = p.f.restart().readGolosRecoveryFence()!!
            val rows = JSONArray()
            repeat(300) { index ->
                val generation = JSONObject().put("id", index + 1).put("root", index + 1)
                    .put("author", "target").put("permlink", "p$index").put("created", fence.getLong("cutoff") + 1)
                    .put("revision", "a".repeat(64)).put("endpoint", fence.getString("endpoint"))
                    .put("fenceId", fence.getString("headId")).put("cutoff", fence.getLong("cutoff"))
                    .put("libHeight", fence.getLong("head") + 1).put("libTime", fence.getLong("cutoff") + 2)
                rows.put(JSONObject().put("confirmed", index % 2 == 0).put("intent", JSONObject()
                    .put("kind", "vote").put("chainId", "golos").put("account", "fixture-voter")
                    .put("fingerprint", "target|p$index|100").put("historyBaseline", -1)
                    .put("state", "UNKNOWN").put("transactionId", "%040x".format(index + 1))
                    .put("recoveryGeneration", generation.toString())))
            }
            var reads = 0
            val checkpoint = TransactionCheckpointStore(File(p.f.context.filesDir, "transaction-checkpoint"), p.f.prefs) { stage, _ -> if (stage == "checkpoint:load") reads++ }
            checkpoint.put(mapOf("voteArchive:golos:fixture-voter" to rows.toString()))
            val store = WorkerStore(p.f.context, p.f.secure, p.f.prefs, checkpoint)
            reads = 0
            val archived = store.voteArchive("golos", "fixture-voter")
            assertEquals(300, archived.size)
            assertEquals(1, reads)
            val runtime = AutoVoteRuntime(VoteRuntime(p.rpc, pendingStore = store), object : PostingKeyProvider {
                override fun keyRef(chainId: String, account: String) = store.defaultPostingKeyRef(chainId, account)
                override fun privateWif(chainId: String, account: String): String? = null
            })
            reads = 0
            val plan = runtime.plan(listOf(AccountSettings("fixture-voter", true, favorites = listOf("target"), currentEnergy = 10000)),
                (0 until 50).map { VoteEvent("favorite_post", author = "target", permlink = "p$it") })
            assertTrue(plan.actions.isEmpty())
            assertEquals(25, plan.skips.count { it.startsWith("already_voted:") })
            assertEquals(25, plan.skips.count { it.startsWith("pending_confirmation:") })
            assertTrue("50 archived candidates required $reads authority validations", reads <= 3)
            archived.forEachIndexed { i, row -> assertEquals(i % 2 == 0, row.confirmed); assertEquals("target|p$i|100", row.intent.fingerprint) }
            reads = 0
            TransactionCheckpointStore.readOperation {
                repeat(50) {
                    assertNotNull(checkpoint.read("voteArchive:golos:fixture-voter"))
                    assertNotNull(store.readGolosRecoveryFence())
                    assertTrue(store.checkpointStatus().has("generation"))
                }
                assertEquals("repeated bridge read validation count", 1, reads)
                store.assertTransactionAuthority("vote", "golos", "fixture-voter")
                store.assertTransactionAuthority("vote", "golos", "fixture-voter")
                assertEquals("pre-sign authority must be freshly validated", 3, reads)
                checkpoint.put(mapOf("lastVizSelfAwardAt:fixture" to 123L))
                val afterWrite = reads
                assertEquals(123L, checkpoint.read("lastVizSelfAwardAt:fixture"))
                assertEquals(afterWrite + 1, reads)
            }
            val beforeNextOperation = reads
            TransactionCheckpointStore.readOperation { checkpoint.read("lastVizSelfAwardAt:fixture") }
            assertEquals(beforeNextOperation + 1, reads)
            // A new operation must read new authoritative bytes, not the previous detached list.
            checkpoint.put(mapOf("voteArchive:golos:fixture-voter" to "[]"))
            assertTrue(store.voteArchive("golos", "fixture-voter").isEmpty())
            assertEquals(300, archived.size)
            rows.getJSONObject(0).getJSONObject("intent").put("recoveryGeneration", "{}")
            assertTrue(runCatching { checkpoint.put(mapOf("voteArchive:golos:fixture-voter" to rows.toString())) }.isFailure)
            assertTrue(runCatching { store.voteArchive("golos", "fixture-voter") }.isFailure)
            // Physical authority damage is not hidden by any operation-local snapshot.
            File(p.f.context.filesDir, "transaction-checkpoint/transactions.json").writeText("invalid")
            assertTrue(runCatching { store.voteArchive("golos", "fixture-voter") }.isFailure)
        }
    }
}
