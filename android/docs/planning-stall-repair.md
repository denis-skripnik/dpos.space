# Android Golos planning / native storage latency repair

Scope: isolated canonical shipped-source archive `8931948a5ccedc362f5dcd606a934f6d8d1cad87` (installed 3.1.7/code85). Version, signing, APK assembly and publication belong to the parent release task. No web, live chain, device data, key migration, consent or financial policy change is part of this native repair.

## Cause

`AutoVoteRuntime.plan` used `archivedTarget` for every individually eligible event. Each lookup moved/validated the active slot, read the archive again and scanned it. `WorkerStore.voteArchive` then resolved every generation using fresh checkpoint reads. Each checkpoint read physically reopened authority and immutable import backup, parsed/validated the complete envelope and recalculated digests. A generation-bearing archive therefore amplified one planning window into repeated quadratic validation under the shared checkpoint monitor. Stop was checked *after* that archive work. This also delayed the serialized native bridge storage queue. Sequential content/head/own-vote reads had no total planning deadline, allowing another independent stall. A Golos-only run held global ownership, delaying subsequent full ticks including VIZ.

## Changes and boundaries

* Validate archive rows against one coherent `readKeys` authority/fence/transition view. Every row, generation, confirmed flag and original-fence binding is still validated; invalid records still block.
* Build one detached target index per account per plan, after cancellation admission. It is not reused by execution. All fresh eligibility, authority, generation and send checks remain in the original execution path.
* Bound read-only planning to a 15-second monotonic read window; inspect/retain a prefix, preserve cumulative energy budgeting over the individually eligible prefix, and report progress at first/every tenth/final inspected row. Deferred rows receive no terminal acknowledgment.
* Carry the actual inspected count back to durable backlog rotation. The next tick starts beyond the inspected prefix instead of returning to a full-window stride indefinitely. Source cursors and intake inbox remain atomic; deferred/unavailable/unknown rows remain durable.
* Apply the planning scope's remaining deadline to actual HTTP connect/read and a disconnect watchdog, plus body-loop deadline checks. This is synchronous planning, not a `Future.get` timeout releasing ownership while a child lives. Transport fixtures exercise blocked replies, slow-drip body and slow-drip headers. The deadline applies only inside planning; it does not retry or redefine broadcast outcomes.
* Prioritize VIZ accounts in a full tick. In this baseline, a deliberately Golos-only tick remained Golos-only, but its read planning window no longer monopolized the global run indefinitely. The subsequent [VIZ cadence repair](viz-cadence-repair.md) adds incremental VIZ checks and canonical execution-time cooldown/accounting without changing this bounded Golos planner.
* On `NativeStorageQueue`, use a task-local detached validated read view. Every reuse hashes the real authority **and** immutable backup bytes; no mtime/size-only trust and no cross-task/global security cache. Changed bytes force full validation; own mutations use a fresh physical validation and invalidate the view. Pre-sign authority and pre-transport identity explicitly force real reads, even inside a read-view scope. The single-writer monitor and native queue ordering remain intact.

The network budget is not a hard deadline for arbitrary local filesystem stalls. Local authority validation remains synchronous and fail-closed; eliminating its multiplicative reads is preferable to detaching or cancelling a potentially security-sensitive storage operation.

## Deterministic evidence

New test classes: `PlanningBoundTest`, `PlanningArchiveTest`, `PlanningRunnerTest`, `PlanningTransportTest`.

* Shipped baseline RED: two policy failures show 50 per-candidate archive reads and stopped planning still entering the archive (`evidence-red/`).
* Shipped-source detached worktree RED: production-policy + real loopback HTTP + real checkpoint runner tests fail for a >20-second planning deadline and VIZ proof occurring after Golos planning; Stop/late-read ownership test already passes (`evidence-runner-red/`). Baseline tests revoke and drain their late reads before finishing.
* Large real WorkerStore fixture: 300 generation-bearing records, one full authority validation for archive reading; the same first 50 target verdicts are preserved (25 confirmed / 25 quarantined). Three or fewer authority validations for that complete plan rather than a per-candidate/per-generation reread. Repeated task-local read/status calls validate once; writes, next operations and pre-sign force refresh. Same-size/restored-mtime tampering of authority or backup fails closed.
* Real native queue test: serial task/mutation ordering and no read-view sharing across queue tasks.
* Runner slow-read fixture: preserves all 60 inbox rows after the first bounded window, persists continuation at row 1 and reaches row 50 on a later tick; no mainnet requests or broadcasts. Pending archived UNKNOWN remains quarantined. A budget-expired empty plan reports `planning_deferred` and the retained uninspected count, never “no suitable actions” or exhausted-feed completion.
* Stop during delayed read: competing runner reports overlap while ownership is held; late completion cannot sign, enter transport, change the post-Stop inbox/cursor or create a pending vote.
* Full-tick pending VIZ is read-only reconciled before Golos planning, without replay.

Commands use `ANDROID_HOME=/home/assistent/android-sdk bash android/scripts/run_tests.sh ... --max-workers=1`; all Gradle invocations are serialized. Final serialized gate: `testDebugUnitTest testReleaseUnitTest --max-workers=1` completed successfully in 21m17s. Each variant has 75 XML suites / 516 distinct test identities / 0 failures / 0 errors / 0 skipped, including all 9 new planning tests. XML copies are in `evidence-full-final/`; `native-frozen-evidence.json` enumerates identities, results and XML/source SHA-256 hashes. An earlier foreground invocation was terminated by the tool's 420-second cap (not a test failure); its partial outputs are retained separately in `evidence-full-interrupted/`. No Gradle process was left alive before the final rerun. Kotlin release compiler daemon startup retried automatically; the final build succeeded.

Robolectric/loopback tests are not physical Android/TalkBack or installed-device acceptance.
