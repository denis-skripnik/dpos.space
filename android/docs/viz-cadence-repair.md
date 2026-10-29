# VIZ confirmed-award cadence

Native-only follow-up to 3.1.8/code86 (`04368742b33ef1536d4385f600f58c17a289cb2b`). No APK/version, web, deployment, chain writes or installed-device changes belong to this slice.

## Cause and correction

A delayed irreversible confirmation returned immediately from `execute`, recorded its observation time as the cooldown start, and then waited for another full 432-second tick. The runner also prefiltered recent awards before pending reconciliation. Together these imposed extra pauses unrelated to execution on chain.

* The HTTP receipt now binds transaction lookup, its canonical block/transaction position and a fresh head/LIB to one endpoint. Verification reconstructs the complete supported unsigned award, checks its exact ID against the pending identity and canonical transaction, and takes time only from that verified block. A receipt/history timestamp is not cadence authority.
* An exact confirmation atomically settles the old identity with its trusted execution time. If the time is available, the runtime re-enters ordinary preparation in the same tick. A fresh account/energy/regular-authority read, fresh block/TAPOS and chain-time cadence checks, consent/cancellation checks, durable intent and final pre-transport admission still precede a new send. At most one fresh send occurs; a newly sent transaction is never recursively replaced.
* Both device-time and fresh-chain-time gates must have passed 432 seconds. The exact boundary is eligible; 431 seconds is not. Unsupported/unavailable canonical time and retired beneficiary-free records retain an observation-based conservative cooldown. Old stored cooldowns are not rewritten or inferred from history.
* Enabled VIZ self-award accounts participate in the existing 30-second foreground checks, including the compatibility reason `foreground-golos`. Full notification checks retain their separate 432-second scheduling. Due VIZ work stays before bounded Golos planning under the existing global run/child-drain ownership.
* VIZ totals increment inside the same checkpoint transaction as the exact terminal receipt, pending removal and cooldown. Repeated/late completion cannot increment again or overwrite a newer pending identity. Per-tick counts use the durable before/after receipt tally, including old confirmation followed by fresh pending, fresh confirmation, Stop or preparation failure. Result JSON also enumerates distinct confirmed IDs rather than collapsing two confirmations into one status boolean.

The existing checkpoint schema/fields are reused; no state migration is needed. `UNKNOWN_EXPIRED` rules, pending replay policy, quarantine/fences, Golos financial policy, donation/beneficiary settings and notification toggles are unchanged. A fresh send after the existing unknown-expiry path is not evidence of reliable confirmation and is not used to implement this correction.

## Local acceptance

`VizCadenceTest` drives real runtime, runner and isolated checkpoint restart. Its loopback HTTP case uses the production HTTP RPC adapter and an independently encoded transaction-ID oracle, and captures a distinct signed fresh transaction. Other cases cover delayed confirmation plus same-tick fresh pending/two confirmations, 431/432 seconds, unknown/reversible/mismatched/stale/future proof and position/ID mismatch, legacy unbound timestamp/retired no-beneficiary records, real worker Stop after proof/during preparation, preparation failure accounting, and coexistence with production Golos planning. `TransactionCheckpointTest` checks counter/cooldown/removal atomicity across its crash fault matrix and late old completion while a fresh pending exists. Foreground scheduling tests cover enabled VIZ/Golos and revocation.

Run only serialized canonical gates:

```
ANDROID_HOME=/home/assistent/android-sdk android/scripts/run_tests.sh testDebugUnitTest testReleaseUnitTest --max-workers=1
```

Final serialized gate completed successfully in **21m46s**: **76 XML suites / 528 distinct cases per variant**, zero failures/errors/skips and identical Debug/Release identities. All 152 frozen native inputs remained byte-identical across the gate. The initial cadence regressions and retained-VIZ-upvoter incremental starvation were reproduced RED; the prior Golos-only test was updated to the approved incremental VIZ contract without weakening notification isolation.

Final XML identities, result totals and source/XML SHA-256 hashes are frozen separately under `evidence-cadence-final/`. These local tests do not establish physical Android timing, installed-device acceptance or TalkBack behavior. Packaging and independent safety review belong to the parent task.
