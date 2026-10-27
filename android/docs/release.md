# Android release notes and packaging

## Local updater repair (not published)

- Download has a visible percentage dialog and Cancel; the message is a polite accessibility live region. Preparation and pre-install verification have visible checking states. The APK stays private at `filesDir/updates/<attempt UUID>/<release filename>`, not system Downloads. A completed transfer shows `Обновление загружено` with an explicit `Установить` action.
- `MainActivity.onResume/onPause` gates updater UI and installer handoff. Pausing cancels active IO, dismisses updater dialogs and prevents late installer launches. Returning during cancellation still offers a retry when it completes. Destroying/recreating the activity cancels its attempt and removes only its own unhanded-off files; a new activity has independent staging, so an old callback cannot overwrite/delete its candidate.
- Android requires `REQUEST_INSTALL_PACKAGES` and the user's per-app permission. Install opens the per-app unknown-sources settings screen when needed; on return, even if permission was denied, the verified candidate remains available. Grant permission and press `Установить` again. Settings/installer launch failures are visible and retryable; no automatic or silent installation is performed.
- Signature, immutable Git provenance, exact SHA-256/Git-blob hashes, real PackageManager APK package/version/certificate identity, observation delay, rollback clock and revocation checks remain mandatory. Installation revalidates the retained file after a settings round trip. Network, hashing, APK/provider/filesystem checks, cleanup and synchronous preference persistence run off the UI thread. Rollback-clock transactions are serialized across overlapping activity instances. Socket disconnect is off the UI thread. Preparation, metadata and streamed reads share a five-minute monotonic operation deadline, checked before/after reads; individual read timeouts shrink to the remaining deadline.
- After successful installer handoff its private file is retained even if the activity is destroyed, because Android may still read the granted URI. No cross-attempt directory sweep is performed. Process death may leave private staged files; automatic reclamation of orphaned/handed-off candidates is not part of this repair.
- Connected Robolectric tests use a synthetic Ed25519-signed feed/network/APK payload and controlled PackageManager archive metadata. They execute production parsing/provenance/hash/identity code, with the public certificate from the retained shipped APK, not a production identity bypass. Coverage includes successful explicit handoff, all archive identity fields, installed certificate, permission denial/return/grant, file tampering, launch failures/retry, accessible progress/cancel, pause and rapid resume, old/new recreation overlap and slow-drip total timeout. They do not perform a real APK install.
- These are local source changes only. JVM/Robolectric checks do not prove the reported physical-device freeze is resolved. An already installed old updater cannot acquire this fix without installing a repaired APK over the existing app; never uninstall or clear application data. Before sharing a candidate, independently build/review from the current signed release's source, preserving package/certificate and the real updater public pin; physical-device installer, data continuity and TalkBack acceptance remain separate gates.

## Secure release-signing diagnostics

- The trusted `dpos_release_sign` consumer writes `dpos-release-sign-attempt.json` inside its operator-private key directory. The atomic mode-0600 receipt contains only public release identifiers, a random attempt marker, timestamps and a fixed outcome code. It never records the submitted secret, secret characteristics, raw signer output or exception text. An unsafe receipt target prevents signing.
- Signer CLI failures return only `status: failed` and an allowlisted `code`. `key_decrypt` means that loading the encrypted signing key failed; it does not distinguish an incorrect password from damaged or incompatible key data. Other codes identify source/dependency checks, subprocess/protocol failures, output verification and receipt/manifest writes.
- The receipt is diagnostic evidence, not proof of successful publication. If an operation returns `unknown`, inspect the matching attempt and independently verify any resulting manifest before retrying. A final receipt-write failure can occur after manifest creation. A consumed operation cannot be reused; a new operation has a new attempt marker.
- Activate code changes only after reviewing both signer and consumer, updating the pinned signer dependency in the consumer, and updating the operator's trusted consumer digest. Do not derive a replacement trust pin from unreviewed adjacent code. APK bytes, existing keys, signed-feed policy and signature/provenance checks remain unchanged.

## Native Golos recovery candidate (3.1.3/code81, not published)

- Current gate status: Debug and Release each passed 331 tests /54 classes, zero failures/errors/skips; complete serialized assembly succeeded. Fresh release APK SHA-256 `02656c63c2b9aa2dde09e7b3e366d975c5a5551a9b00b9755e360a82c68e1cd6` verifies historic package/certificate, updater pins, non-debuggable manifest and HTTPS-only policy. Independent source integration review ACCEPT. On API35/KVM, both full checkpoint/runtime/Golos restart runs passed: eight phases per run with distinct process PIDs, retained fence/incompleteness and no uncertain-send replay. This is synthetic local-RPC runtime evidence, not live-chain, full UI or TalkBack acceptance.

- Compatible candidate uses the existing `space.dpos.android.debug` package and historic certificate while remaining a non-debuggable Release build. The `.debug` package suffix is historical identity, not permission to ship debuggable networking. Build with the protected existing owner public updater pin; verify the APK itself, certificate, package, manifest and hash before delivery.
- The native `legacyIdentityIncomplete` flag is retained permanently as evidence, not as a permanent global send hold. A fresh endpoint-bound fence is checkpointed; adoption waits for height+1 <= LIB, canonical next-header.previous == saved head ID and irreversible chain time beyond the conservative observed-time+3600+120-second drain. Requests are monotonic-bounded and head age must be <=120 seconds (<=15 seconds future skew). Stale endpoints defer/retry; they do not erase the fence or declare network-wide stoppage.
- Fallback is selected before energy planning and intake as well as before the proof, and pinned across energy/account reads, history, config, head, headers, content, own vote, authority, signature, transport, immediate confirmation and fresh dependent donation. A stale high-energy peer must not supply the budget for a fresh low-energy peer's vote. Endpoint failover must independently validate the saved canonical anchor; no cutoff regression. Golos HTTP redirects are not fence proof. Android elapsedRealtime includes suspend; monotonic deadlines are never restored as permission from disk. Late preparation checks the unchanged signed header against fresh chain/local time and may cancel only a current proven-unsent intent, never an attempted/legacy unknown.
- Only exact root generations with valid consensus id/root/created strictly after cutoff and created <= canonical LIB timestamp are eligible. Content generation/revision is checked before signing and again after durable preparation just before transport. All identifiable unknown author/permlink guards remain across weights/kinds and generations. Old roots, edits of old roots, equal cutoff and reversible creation remain excluded.
- Backlog disposition is separate from intent authority: proven pre-cutoff generations are terminal policy skips, and redundant candidates for archived targets are acknowledged without deleting their intent/quarantine or inventing a receipt. Otherwise old/unknown rows could fill intake capacity and indirectly starve arbitrary future targets. Retired cached fence metadata is copied into immutable import evidence but never activated as a fresh checkpoint fence. Fence records include initial LIB and verified canonical LIB/time/adoption observations; generation records retain LIB height/time and a content revision digest, and support status retains the incomplete-identity flag alongside the canonical fence.
- Boundary: deleted/recreated UNKNOWN old textual addresses and names lost on orphan forks can pass as new canonical generations. This is not recovery of those names, first-ever permlink proof, cryptographic state proof or an atomic generation-bound vote. The protocol carries only voter/author/permlink/weight, so final-read/execution TOCTOU remains.
- Stop/consent, normal energy and cashout policy, durable PREPARED/attempted noReplay and exact-ID canonical finality remain unchanged. Recovery does not manufacture receipts, counters or donation catch-up. Donations follow only newly confirmed allowed votes through the existing durable contract.
- New JVM loopback tests exercise the real signer/HTTP/checkpoint/runtime. `GolosRecoveryAndroidTest` supplies a synthetic-RPC A/B/C distinct-PID Android boundary harness. The full `--include-golos-recovery` driver passed twice on the separately approved disposable API35/KVM host; each run includes checkpoint A/B, runtime A/B/C and Golos A/B/C. Its 14 JUnit invocations include phase-only early returns and are not 14 independent scenarios. Prior checkpoint-only evidence remains in `dpos-hostkey-20261014/FINAL-R2.md`; final lane evidence is under `dpos-hostkey-20261015/`. Real-chain availability, physical-device data continuity and TalkBack remain unverified.
- No source commit/push, signed release manifest, public APK/site release, deployment, live broadcast, device clearing or device installation is authorized by this candidate work. Parent independent final review precedes delivery.

Build debug APK:

```bash
cd android
./gradlew clean test assembleDebug
sha256sum app/build/outputs/apk/debug/app-debug.apk
```

CI:

- `.github/workflows/android-debug.yml` runs on branch `v3` for Android/workflow changes.
- The workflow runs `./gradlew test`, `./gradlew assembleDebug`, writes `app-debug.apk.sha256`, and uploads the unsigned debug APK as an artifact.
- The workflow does not use signing keys, Play service accounts, or release passwords.

Release signing plan:

1. Generate or use an existing Android keystore outside this repository.
2. Provide signing config through local untracked Gradle properties or CI secrets.
3. Never commit `.jks`, `.keystore`, key passwords, Play service accounts, or upload keys.
4. Name manual artifacts as `dpos-space-android-<version>.apk` and publish checksums next to them.

Manual smoke checklist before sharing an APK:

1. Install debug APK on Android device/emulator.
2. Launch app and verify DPoS Space WebView opens `https://dpos.blinddev.xyz/`.
3. With TalkBack, confirm main route navigation remains usable.
4. From WebView console/debug UI, call `getAppInfo()`, `getWorkerStatus()`, `importWorkerSettings()` with explicit non-secret Golos settings, `importSecureKey()` with a controlled test-only key on a non-production device, `previewAutoVote(json)` for a known harmless candidate, `startWorker()`, `checkNow()`, `stopWorker()`, `exportWorkerLogs()`.
5. Verify `importWorkerSettings()` rejects secret-like fields and `importSecureKey()` returns only `keyRef` / `hasKey` metadata without echoing the imported secret.
6. Verify `previewAutoVote(json)` returns `broadcasted: false` and never submits a transaction.
7. Verify the foreground notification is visible while running and has Open / Check now / Stop actions.
8. Verify exported logs are redacted and do not contain private keys, seeds, WIFs, passwords, tokens or raw encrypted blobs.
9. Reboot the device/emulator after enabling the worker and confirm boot restore either resumes the visible worker state or reports why Android restrictions prevented it.

Native signing/broadcast status:

- Kotlin has a real-capable Golos vote signer/broadcaster path for planned auto-upvoter actions: local WIF/secp256k1 signing via `bitcoinj-core`, Graphene vote transaction JSON construction, and JSON-RPC broadcast through configured Golos RPC.
- Android worker imports curator/favorite settings, scans curator account history plus favorite blog posts via Golos RPC, plans vote actions, then uses the real signer/broadcaster path when account/key/worker/auto-upvoter settings are enabled.
- Preview/check is explicit and separate: `previewAutoVote(json)` / `VoteRuntime.preview(...)` builds the signed transaction path but never broadcasts.
- Automated tests use fake RPC/broadcaster/signers and never perform mainnet broadcasts.
- Live mainnet validation, Google Play publishing, AAB signing, release keystore use, and Play service accounts require explicit Denis approval and local/CI secrets outside git.
