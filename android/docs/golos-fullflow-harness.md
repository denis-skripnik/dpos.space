# GOLOS full-flow Android acceptance harness

Status: **compiled and host-tested; NOT Android/device PASS**. This is a new test-only harness, not a replacement production patch or a new execution framework. No production seam was added. The old frozen `GolosProductionAndroidTest` remains unchanged and is deliberately not selected by the driver.

## Boundaries

- Only existing constructor injection (`DposWorkerRunner`, real `GolosProductionPolicy`, HTTP clients and `TransactionCheckpointStore` boundary callback).
- Two loopback servers, synthetic posting key (known integer 2), real native Graphene signer and real checkpoint files under unique fixture directories/preferences.
- No production endpoint requests. Production endpoint text occurs only as expected policy/retired metadata. Only `127.0.0.1` fixture HTTP is used; existing debug network-security config already permits it. Release inputs/configuration were not changed.
- `Admitted` is returned by real policy admission, never constructed by the harness. Receipt IDs use an independent fixture byte encoder, anchored to the retained official unsigned GOLOS vector, not the production proof/transaction builder as oracle.
- Synthetic wall/monotonic advancement exercises drain mathematics. It is NOT an actual elapsed-hour claim.
- Donation is disabled in default fixtures; only explicit fixture consent enables its positive/intercepted transport test. No real funds or user storage.

## Matrix and evidence

`GolosFullFlowRunnerAndroidTest` supplies full-runner gates, beyond the copied contract/runtime supplements:

- Two fresh same-chain-ID HTTP peers, divergent higher beta versus lower production scope; only the production checkpoint can admit/migrate. Wrong/missing checkpoint, nonadvance, stale, wrong config, unavailable content/history/own-votes and arbitrary verified anchor yield no transport/authority RPC.
- Strictly later LIB time than drain, immutable transition, exact migration and independent production epoch; old/equal/reversible/edited/own-voted/textually quarantined targets stay blocked. A fresh irreversible stable root signs and confirms exactly once.
- Start/write/sync/finish/directory-sync/readback/verified fault hooks operate on real isolated checkpoint files after admission, invalidate storage authority and send nothing; retry/reopen retains exactly one transition.
- Stop and grant revocation during admission, physical persistence, pre-sign final generation lookup, and post-intent final pretransport lookup. An overlapping runner with a retained foreign donation cannot acquire ownership; explicit fixture restart with empty intake sends nothing and does not settle donation.
- Actual HTTP intake with 1,000 retained foreign rows and independent foreign cursor cannot starve 50 new unknown targets. All 50 remain in active inbox and yield bounded account/endpoint/policy/epoch-scoped degraded reporting.
- Positive exact operation/native signature, canonical block/index and same-endpoint LIB. Wrong canonical index, changed canonical operation and reversible inclusion remain unknown, do not produce counters/donation and never replay at another weight.
- Fresh dependent atomic two-operation donation requires explicit synthetic consent; exact history ID/fields settle one receipt, with no replay/counter duplication.

`GolosFullFlowContractAndroidTest`, `...ExecutionAndroidTest`, `...DegradedAndroidTest` retain the source-reviewed behavioral fixtures as additional actual-Android tests: immutable retired evidence; original-fence-only generation validation; foreign archived/donation quarantine; typed unavailable versus genuinely ineligible content; settings/backlog preservation. Some of these supplements deliberately call the policy/store/runtime directly; they are not presented as full-runner proofs.

`GolosFullFlowLifecycleAndroidTest` requires six separate instrumentation processes: seed, migrated, adopted, confirmed, unknown, final. It rebinds the exact prior loopback port, restores only the synthetic RPC world, opens the actual previous checkpoint/preferences, compares immutable transition/fence/ledger/counter evidence, then runs the real runner. It does not reconstruct checkpoint files from its snapshot. Final phase changes the unknown target's weight and event kind. Both test and driver require SIX globally distinct positive real Android PIDs. Durable `pids` history rejects nonadjacent reuse (A,B,A), duplicate/corrupt prior history, and missing phases; final evidence contains all six PIDs.

The driver selects individual methods from `harness-manifest.json`, not a claimed fixed 64-method total. Current inventory is 24 named methods: 23 non-lifecycle methods plus the lifecycle method executed six times = 29 instrumentation invocations. Inventory is NOT execution evidence.

- `results.jsonl`: append-after-each-invocation actual method, phase, PID, duration, outcome and exact log name.
- `containment-preinstall.json`, `containment-NN.json`: fresh sanitized topology/canary proof before install and EVERY instrumentation invocation; missing/unverified containment stops without summary PASS.
- `device/events.jsonl`: in-process listener start/failure/finish evidence with real Android PID and elapsedRealtime.
- `device/fixture-*.json`: HTTP method sequence, intercepted operation IDs, physical checkpoint file names/sizes/hashes, storage authority, fence/transition and counter.
- `device/{seed,migrated,adopted,confirmed,unknown,final}.json`: durable lifecycle evidence including ledger generations/IDs/states.
- `summary.json` is emitted only after every selected invocation reports `OK (1 test)`, matching finished listener evidence, and distinct phase PIDs. Failure/timeout stops the driver without replay.

## Build/host verification

Use `ANDROID_HOME=/home/assistent/android-sdk android/scripts/run_tests.sh` exclusively for Gradle; builds/tests are sequential. Generate/check host mirrors with:

```
python3 android/scripts/mirror_golos_fullflow.py
python3 android/scripts/mirror_golos_fullflow.py --check
python3 android/scripts/test_golos_fullflow_driver.py
```

Mirrors differ only in runner/class/fixture names; lifecycle is deliberately Android-only. They exercise the same actual runner, policy, HTTP server, signer and disk fixture under Robolectric. Host tests cannot prove Android physical durability, networking, listener/driver integration or separate-PID runtime acceptance.

The external evidence directory contains exact assembled app/test APKs, verified certificates, decoded instrumentation target, source/hash manifest, selected-test XML and build logs. `package_golos_fullflow.py` verifies all 23 frozen sources and original patch/APK hashes before packaging. It does not touch frozen evidence.

## Run only after independent harness review and authorization

Use a new clean **disposable KVM-accelerated emulator**, API 26+ (API 35 recommended), no accounts. Do not use a phone or install over any existing DPoS package. Driver refuses non-emulator serials and pre-existing app/test package storage. No paid-host creation, SSH or provider access is performed by the driver.

### Mandatory containment — future authorized execution only

Fixture injection is NOT containment. The app retains its normal Internet permission. The sole supported gate topology is a dedicated Linux **network namespace with only UP loopback, no veth/uplink**, containing the exact emulator QEMU PID, private ADB server and driver. The main HTTP fixtures remain emulator `127.0.0.1`; they do not use the host alias `10.0.2.2`. No DNS, Internet or mainnet egress is available. Local ADB works entirely inside that namespace; the host/global firewall, host routing and any user device stay untouched. No iptables/nft/global setting changes are needed or authorized here. Do not substitute an operator checkbox, fixture URL pinning, airplane mode, proxy settings or a saved proof for the live gate.

**Do not run these preparation commands now.** After independent minimal-diff review, a fresh read-only provider quote, explicit spending AND disposable-execution authorization, on that disposable host only:

1. Prepare SDK/system image/APKs and a new account-free AVD before isolation. Confirm accelerated KVM. Use a dedicated unprivileged `android-test` user; no personal data/accounts. No emulator may be started on this Hermes host.
2. The authorized administrator opens a new scoped shell with `sudo unshare --net -- bash --noprofile --norc`, then runs `ip link set lo up` **inside that new namespace only**. Do not add a veth, uplink, NAT, forwarding, VPN, proxy or tunnel. Do not use `--pid`; the verifier compares live interface inventories with host PID 1's network namespace (ours only `lo`, host must have a non-loopback interface). This proves namespace separation without requiring ptrace access to root's `/proc/1/ns/net`. This changes only the newly created disposable namespace, not global host networking.
3. In that shell drop to `runuser -u android-test -- bash --noprofile --norc`. The driver and QEMU must have nonzero UIDs and both `CapEff: 0` and `CapPrm: 0`. Clear inherited proxy/ADB-remote environment variables; do not inherit preopened network sockets or remote emulator controls. Launch a private `adb -L tcp:127.0.0.1:5037 start-server`, then the clean AVD with `-port 5554 -no-window -no-audio -no-boot-anim -no-snapshot`. Start both as this unprivileged user, never as root. Record the actual QEMU PID (not a wrapper/launcher PID); its exact loopback console socket must own port 5554. Boot wait uses this private ADB only. If isolated boot/ADB is unsupported, STOP; do not relax containment or fall back to a phone/software emulator.
4. Run the driver below in the SAME namespace/user. It pins ADB to `127.0.0.1:5037`, verifies namespace != PID 1 namespace, matches exact QEMU namespace/PID and serial console ownership, checks no effective capabilities, only UP `lo` and only loopback routes. It then demonstrates a nonce round trip from emulator loopback through an exact temporary ADB reverse to a namespace-local loopback echo fixture, removing that exact reverse. This proves `toybox nc`, loopback and private ADB work. ONLY after structural containment passes, TCP-only negative canaries to generic IPv4/IPv6 TCP/443 (`1.1.1.1`, `2606:4700:4700::1111`) must fail; success, missing tool/receipt, broken positive control, timeout or topology change fails closed. These are NOT HTTP/TLS/DNS/mainnet requests. Topology is rechecked after probes. Each invocation gets fresh exported sanitized proof, never reused attestation. Instrumentation cannot start when verification fails.
5. Keep the namespace unchanged for the entire run. On any failure retain exact evidence, stop the exact disposable emulator/private ADB processes, exit both scoped shells (namespace disappears when its last process exits); no global firewall rollback is involved. Retrieve only synthetic evidence after stopping. No replay under the same run ID. Provider teardown remains separately authorized.

This procedure/gate is prepared and offline-tested, **not yet exercised on an Android emulator**. Offline mocks do not prove actual TCP denial, loopback/ADB integration, or Android acceptance. Actual denial and positive-control evidence are mandatory on the future authorized run before accepting its instrumentation output.

Transfer only the two harness APKs, `harness-manifest.json`, driver and `golos_fullflow_containment.py` together to the approved host. From this repository (or the copied driver directory), inside the isolated shell:

```
python3 android/scripts/run_golos_fullflow_android.py \
  --adb /path/to/android-sdk/platform-tools/adb \
  --serial emulator-5554 \
  --emulator-pid ACTUAL_QEMU_PID \
  --artifacts /path/to/harness-evidence \
  --output /path/to/new-run-directory \
  --run-id unique_review_run \
  --disposable-emulator-approved
```

Do not retry a failed lifecycle run under the same run ID. Preserve the failure, review it, then use a new clean emulator/run ID if approved. Driver never clears application data or uninstalls an existing app. It force-stops only its clean-install target/test packages between invocations. It pulls only the exact synthetic evidence directory, not preferences/key files.

Estimated **10–20 minutes after a healthy accelerated emulator is booted**, an unmeasured planning estimate, not a runtime result. Each instrumentation invocation is bounded at 120 seconds; 29 invocation budgets total 58 minutes, excluding bounded ADB/install/evidence overhead. Allow at most 70 minutes for this driver run; emulator provisioning/recovery/review/retest time is separate. Stop on timeout and preserve evidence rather than repeatedly paying for broken infrastructure. This is not a paid-host quote or spending authorization.

Local read-only preflight found `/dev/kvm` present but inaccessible and `emulator -accel-check` exit 11. No permissions, global settings, host purchase, software emulator, real device, mainnet, release deployment or delivery was attempted. Parent must review the harness before requesting a fresh quote and explicit user spending approval.

TalkBack, in-app update acceptance, live network fork-choice and real-fund transactions are outside this synthetic gate.
