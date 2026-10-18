# DPoS Space Android

This folder owns every Android-native artifact for the DPoS Space native app.

Placement rule:

- Kotlin, Gradle, AndroidManifest, native workers, Android bridge code, Android tests and APK/AAB artifacts live under `android/` only.
- The static web runtime remains in the existing root/v3 files and must keep working without Android.
- Do not add PHP, hidden backend services, private indexers, or server daemons to make Android background work.
- Browser/PWA fallback behavior must remain unchanged when `window.DposAndroid` is absent.

Current build commands from this directory:

```bash
./gradlew test
./gradlew assembleDebug
```

The debug app loads live DPoS Space by default: `https://dpos.blinddev.xyz/`.

Native bridge controls exposed only inside the Android WebView:

- `window.DposAndroid.getAppInfo()` — app/web/runtime metadata.
- `window.DposAndroid.getWorkerStatus()` — foreground/runtime status, account count, last/next tick, redacted logs.
- `window.DposAndroid.importWorkerSettings(json)` — explicit opt-in import of non-secret worker settings. The JSON must include `explicitConsent: true`; secret-like fields such as private keys, WIFs, seeds, mnemonic, password, token or key are rejected. Key import is intentionally separated from normal settings import.
- `window.DposAndroid.importSecureKey(json)` — dedicated secure-key import bridge. It requires `explicitConsent: true`, validates `chainId`, `account`, `authority`, and `alias`, stores the private key only through Android encrypted storage, and returns only `keyRef` / `hasKey` metadata. The bridge does not log, export, or echo the secret. Current test-safe scope is Golos posting/active key references for native worker use.
- `window.DposAndroid.startWorker()` / `stopWorker()` — start/stop visible foreground service.
- `window.DposAndroid.checkNow()` — enqueue a one-shot WorkManager check.
- `window.DposAndroid.previewAutoVote(json)` — explicit preview/check action for a Golos vote candidate. It builds/checks the native signed transaction path and returns `broadcasted: false`; it never submits the transaction.
- `window.DposAndroid.openBatterySettings()` — open Android app settings so the user can review battery restrictions.
- `window.DposAndroid.exportWorkerLogs()` — export redacted local worker logs.

WebView/passkey backup support:

- The WebView enables AndroidX WebKit `WEB_AUTHENTICATION_SUPPORT_FOR_APP` when the installed WebView supports it.
- The site-level backup page can create/import optional WebAuthn PRF passkey backups. The passkey is used only as a system-protected PRF/unlock factor; the backup payload remains AES-GCM encrypted and password backup remains the fallback.
- The current debug APK package is `space.dpos.android.debug`; `/.well-known/assetlinks.json` must be deployed with its debug signing fingerprint for WebView passkeys on `https://dpos.blinddev.xyz/`.
- Release builds need their real release package/certificate fingerprint added to `assetlinks.json`; do not commit release keystores or private signing material.

Current worker scope:

- Golos notification worker supports incoming-only history checks with first-run cursor baseline.
- Foreground service has visible persistent notification actions: open, check now, stop.
- Boot restore starts only when the user had enabled the worker.
- Native auto-upvoter has a real-capable Golos vote runtime: planned vote actions are converted to Golos vote transactions, signed locally from Android encrypted posting-key storage, and submitted through the configured Golos RPC when account, key, worker, auto-upvoter and safety gates are all enabled.
- Preview/check is separate from runtime: `previewAutoVote(json)` builds/checks the signed transaction path but never broadcasts. Automated tests use fake RPC/broadcasters and do not send mainnet transactions.
- Native Golos auto-upvoter uses a durable account-history inbox for both curator votes and favorite root-post comments. Each source cursor is scoped to endpoint/API; forward catch-up and initial backward backfill advance one bounded page per source/check. Inbox and cursors are committed together before planning. Failed/time-limited sources do not discard healthy results; energy, unavailable eligibility, cancellation and unknown outcomes retain events across restarts. The 1,000-event capacity applies to active source/role events and imposes backpressure, not truncation. Removed sources/roles move to a durable `inactiveInbox` outside active capacity; re-enabling restores the same endpoint/API-scoped event IDs as room permits, retaining overflow without displacing active deferred/unknown events. Deduplication covers both arrays. Source role changes (or legacy cursors without role evidence) start a fresh scoped backfill so newly relevant operations previously treated as noise can be found. An older page must be contiguous and reach its requested upper boundary before backward continuation advances; truncated pages retain the continuation for retry. The active pending slot and durable exact-ID vote archive are independent of the intake inbox. A contiguous retained lower page followed by a successful empty older page records that endpoint’s retained boundary without an endless warning; gaps, malformed responses and RPC failures remain deferred. Fresh forward intake continues, and the retained boundary is occasionally rechecked. At most 50 queued events are considered per check with durable round-robin fairness. Hive/Steem retain their existing collector.
- Golos unknown votes are atomically moved from the active pending slot into a durable archive before any fresh intent is prepared. An unresolved target blocks every weight/event kind and dependent donations for that same chain/account/author/permlink; unrelated eligible targets may proceed under the existing cumulative energy, consent, key and eligibility guards. Fresh unknowns append rather than overwrite old records. Invalid records and failed commits fail closed, including recreated stores after Android has changed its cached preferences map. Legacy records keep unknown expiration/head metadata rather than inventing it. New intents save actual expiration and observed chain time/head.
- Read-only archive recovery rotates one unresolved entry per tick. It first uses Golos `operation_history.get_transaction`, then bounded history fallback (20-page/15-second cooperative budget) with durable endpoint/API-scoped cursors. Confirmation requires exact unsigned transaction ID, exact vote operation, the transaction at its claimed canonical block/index, and that block at/below the same endpoint’s last irreversible block. Verified reversible inclusion is retained without clearing quarantine. Lookup absence, active vote percent, expiration, empty/pruned history, transport failure or a different endpoint’s index never proves rejection or permits replay. Late confirmation neither increments new-send counters nor catches up donations. Hive/Steem/VIZ behavior is unchanged.
- Golos foreground checks run 30 seconds after the previous check completes while Golos automation is enabled; lightweight intermediate checks do not run VIZ awards or notifications. Full checks/VIZ keep their 432-second cadence and award guards; WorkManager remains a >=15-minute OS-scheduled fallback. Network duration, throttling, battery restrictions and Android foreground-service limits mean this is not a guaranteed 3-second block stream.
- Stakebot comparison: `golos-apps/golos.js` walks persisted irreversible blocks and polls at 3/12 seconds; Android uses bounded per-account history catch-up, local encrypted keys and stronger exact-ID/no-replay recovery. Both reject non-root/paid-out targets, edited favorite posts and curator targets with any existing own vote. Favorite edits use `created`/`last_update`/`num_changes`, not reply-affected `active`; positive votes require `allow_votes` and avoid the protocol’s final 60-second cashout lockout. Android additionally treats zero configured percentages as disabled, rechecks eligibility before signing and keeps its conservative projected-energy floor and 5-second successful-vote pacing. Existing UI coefficient semantics, excluded-author/per-author-weight settings differences and native atomic donation behavior are not changed by this reliability repair.
- Diagnostics allow only exact named 40-hex public transaction-ID fields through the report sanitizer; malformed values, signed payloads and secrets stay redacted. Opaque hashed history-scope labels retain endpoint/API distinction without exporting URL credentials.
- Official protocol reference for this correction: Golos chain commit `5c2289a5ba5e460b4dd84aa611f4d9dd2aa7957b` and `golos-lib-js 0.9.83`. The independent read-only `get_transaction_hex` vector is fixed in `GolosVoteProofTest`; tests do not broadcast mainnet transactions.
- Secure signing keys can be imported only through the dedicated `importSecureKey(json)` bridge and Android encrypted storage. Normal settings import rejects secret-like fields.

Release signing secrets/keystores must not be committed. Use Android Studio, local untracked Gradle properties, or CI secrets later for signed release builds.
