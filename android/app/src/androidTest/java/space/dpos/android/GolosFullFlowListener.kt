package space.dpos.android

import androidx.test.platform.app.InstrumentationRegistry
import org.json.JSONObject
import org.junit.runner.Description
import org.junit.runner.notification.Failure
import org.junit.runner.notification.RunListener
import java.io.File

/** Per-invocation append-only evidence; result is not inferred from method inventory. */
class GolosFullFlowListener : RunListener() {
    private var failed = false
    private fun record(kind: String, description: Description, detail: String = "") {
        val args = InstrumentationRegistry.getArguments()
        val id = requireNotNull(args.getString("runId")); require(id.matches(Regex("[A-Za-z0-9_-]{1,60}")))
        val root = File(InstrumentationRegistry.getInstrumentation().targetContext.filesDir, "golos-fullflow-evidence-$id").apply { mkdirs() }
        val record = JSONObject().put("kind", kind).put("class", description.className).put("method", description.methodName)
            .put("phase", args.getString("phase", "matrix")).put("pid", android.os.Process.myPid())
            .put("elapsedMs", android.os.SystemClock.elapsedRealtime()).put("failed", failed).put("detail", detail.take(2000))
        File(root, "events.jsonl").appendText(record.toString()+"\n")
        println("GOLOS_FULLFLOW_EVENT $record")
    }
    override fun testStarted(description: Description) { failed = false; record("started", description) }
    override fun testFailure(failure: Failure) { failed = true; record("failed", failure.description, failure.message.orEmpty()) }
    override fun testFinished(description: Description) { record("finished", description) }
}
