# AGENTS.md — dpos.space

## Project goal

Branch `v3` is a static HTML+CSS+JS version of dpos.space for DPoS tools. It should run behind a simple static server without PHP/backend runtime.

## Current repository shape

Static v3 files:

- `index.html` — static SPA entry point.
- `v3/css/style.css` — v3-only styles.
- `v3/js/chains.js` — supported chains, apps, nodes, and vendored library paths.
- `v3/js/auth.js` — compatibility layer for old `localStorage` auth/account records.
- `v3/js/broadcast.js` — operation prepare/broadcast helpers.
- `v3/js/profiles.js` — read-only profile/account data loading.
- `v3/js/history.js` — read-only account history loading and normalization.
- `v3/js/app.js` — accessible router and UI wiring.
- `v3/vendor/<chain>/` — minimal required browser blockchain libraries copied for v3 runtime.
- `tests/*.js` — v3 smoke tests.
- `plan.md` — migration plan and cleanup notes.

Android app files:

- `android/app/build.gradle.kts` — Android version, SDKs, dependencies, and `DPOS_WEB_URL`.
- `android/app/src/main/java/space/dpos/android/ui/MainActivity.kt` — WebView shell and Android worker status export.
- `android/app/src/main/java/space/dpos/android/bridge/DposAndroidBridge.kt` — JavaScript bridge for worker, secure keys, manual checks, and VIZ self-award sync.
- `android/app/src/main/java/space/dpos/android/storage/WorkerStore.kt` — native worker prefs, encrypted key refs, counters, logs, and feed persistence.
- `android/app/src/main/java/space/dpos/android/worker/` — foreground service, periodic worker, and shared `DposWorkerRunner`.
- `android/app/src/main/java/space/dpos/android/upvoter/` — Golos/Hive/Steem vote planning, signing, broadcast, history confirmation, and VIZ self-award runtime.
- `android/app/src/test/java/space/dpos/android/` — targeted Android policy tests.
- `downloads/` — static APK downloads served by the public site; keep `dpos-space-latest-debug.apk` aligned with the newest debug APK.

The old PHP app tree was removed from branch `v3`. Do not add runtime dependencies on old PHP directories or old `blockchains/` paths.

## Stack and constraints for v3/web

- Prefer plain HTML, CSS, and vanilla JavaScript.
- Do not add build tooling or npm dependencies unless there is a concrete need.
- Do not require PHP, Composer, MongoDB, cron, pm2, private tokens, or bots for v3 runtime.
- Use direct public RPC/API calls from the browser where possible.
- Preserve the old account storage schema: `<chain>_current_user`, `<chain>_users`, `<chain>_node`, and existing SJCL-encrypted key payloads.
- Do not invent a new auth/key storage format unless Denis explicitly approves a migration plan.
- Keep code transparent: small functions, clear names, no speculative abstractions.
- Web/PWA runtime is static. Android reliable background work belongs to the native APK, not to PWA promises.

## Android app and native worker

- Android package: `space.dpos.android`; current debug version after the latest work is `0.1.69-debug` / `versionCode 70`.
- The APK loads the live site from `https://dpos.blinddev.xyz/`; JavaScript fixes require the public static site and service worker cache markers to be updated too.
- Android keys are stored via encrypted native storage; never log, copy, or preserve WIF/private keys in reports, tests, diagnostics, or chat.
- User-facing diagnostics must be TalkBack-friendly: text status, headings, copyable support report, no icon-only meaning.
- Foreground worker notifications must stay quiet: stable notification, low importance, no sound/vibration, and in-place status updates.
- All worker entry points (`manual`, `foreground`, `periodic`, app-open autostart) must share the global no-overlap guard; `skipped_overlap` must not overwrite the last successful counters with zeroes.

## VIZ self-award invariants

- VIZ self-award uses a VIZ `regular` key and sends `award` from the account to itself with memo `dpos.space: VIZ self-award`.
- `CHAIN_ENERGY_REGENERATION_SECONDS = 432000`: 100% restores in 5 days, and 0.1% restores in 7 minutes 12 seconds.
- One normal self-award spends at most `10` energy bp = `0.1%`; a cadence of one self-award per 7m12s should hover around `99.9–100%`.
- `minEnergy` is stored in basis points: `9500 = 95%`, `9990 = 99.9%`.
- Worker waits until current projected energy is above the account minimum; below threshold it must log `low_energy_skip` and not broadcast.
- Keep `minAwardIntervalMs = 432_000L` after successful awards so app reopen/manual checks cannot immediately repeat the same self-award.
- `broadcast_transaction` plus `{}` is not success. Success means `broadcast_confirmed` after finding the operation in account history.
- Per-account VIZ self-award execution must be bounded; current policy uses a 45 second timeout.
- UI and native state must not diverge: VIZ self-award sync must send all rows, including disabled rows, and preserve keys/notifications/auto-upvoter data.
- Generic notification imports must not silently turn off VIZ self-award or reset `minEnergy`; only `syncVizSelfAwardSettings` should intentionally change self-award flags.
- The support report should show per-account decision logs: `enabled`, `autoStart`, `regularKey`, `minEnergy`, then `recent_skip`, `low_energy_skip`, `broadcast_confirmed`, or an explicit error.
- If a VIZ account is far below the minimum, check `info.viz.world/accounts/<account>` for other awards before blaming the worker. Example: `viz-projects` dropped to ~90% because `Farming VIZCHAIN` awards spent about 9.9%, not because normal 0.1% self-awards doubled.

## Golos/Hive/Steem native auto-upvoter invariants

- Golos native auto-upvoter uses a `posting` key; do not blame the key unless public authority verification proves mismatch.
- For Golos, keep chain config aligned with live network: chain id `782a3039b478c839e4cb0c941ff4eaeb7df40bdd68bd441afd444b9da763de12`, prefix `GLS`.
- Before planning votes, read/project live `voting_power`/`energy` and pass it as `currentEnergy`; if energy is below `minEnergy`, planner should produce `actions=0`.
- If live energy cannot be read and a minimum is configured, skip safely instead of voting below the user threshold.
- Treat `already voted` / `You have already voted in a similar way` as an idempotent skip, not a fatal worker error.
- Process all planned candidates with pacing; current successful-broadcast pause is 5 seconds. Do not reintroduce runtime limits that silently drop later candidates.
- Vote success must be confirmed via `account_history`, not just broadcast return.

## PWA, APK download, and production static site

- The public site root observed via aaPanel is `/www/wwwroot/dpos.blinddev.xyz`; verify live HTTPS artifacts after push because GitHub `origin/v3` alone does not prove production updated.
- The PWA panel lives in `v3/js/pwa.js`; on Android it should recommend the APK for reliable background work and keep PWA framed as a live-tab/static web option.
- Current stable download paths on the static site:
  - `/downloads/dpos-space-latest-debug.apk`
  - `/downloads/dpos-space-0.1.69-debug.apk`
- When updating PWA-visible text or APK links, bump the `v3/js/pwa.js?v=...` query in `index.html` and the `DPOS_CACHE_VERSION` / cached `pwa.js` URL in `sw.js`.
- For production static deploys, prefer scoped file sync or verified server git update; back up touched files, do not broad reset/pull a dirty production tree without explicit approval.

## Recent Android/debug version trail

- `0.1.63-debug` / code 64 — support diagnostics panel and moved logs copy out of worker cards.
- `0.1.64-debug` / code 65 — live native vote energy guard and preserved diagnostics feed.
- `0.1.65-debug` / code 66 — explicit VIZ self-award flag sync with native worker storage.
- `0.1.66-debug` / code 67 — VIZ self-award auto-sync on Android autostart/page open.
- `0.1.67-debug` / code 68 — global VIZ self-award sync on Android WebView startup.
- `0.1.68-debug` / code 69 — preserved worker feature flags across generic notification imports.
- `0.1.69-debug` / code 70 — per-account VIZ self-award decision logs and static APK download link from the PWA panel.

## Commands

There is no v3 build step.

Useful local commands from the repository root:

```bash
# show current changes
git status --short --branch

# JavaScript syntax checks
node --check v3/js/*.js
node --check tests/*.js

# smoke tests
for test in tests/*.js; do node "$test"; done

# focused web checks often used during Android/VIZ work
node tests/v3-pwa-smoke.js
node tests/v3-android-worker-real-check-smoke.js
node tests/v3-viz-self-award-smoke.js

# Android targeted policy tests
cd android
./gradlew testDebugUnitTest --tests 'space.dpos.android.WorkerRuntimePolicyTest' --tests 'space.dpos.android.AutoVoteRuntimePolicyTest' --tests 'space.dpos.android.VoteBroadcastPolicyTest' --no-daemon

# Android full debug gate
cd android
./gradlew clean test assembleDebug --no-daemon

# static smoke server
python3 -m http.server 8080
# then open http://127.0.0.1:8080/
```

## Accessibility rules

Denis uses a screen reader. Treat accessibility as a core requirement:

- Use semantic HTML: `header`, `nav`, `main`, `section`, `form`, `label`, `button`.
- All controls must work from the keyboard.
- Prefer native controls over custom widgets.
- Put dynamic status and errors in an `aria-live` region.
- Do not communicate essential state only through color or layout.
- Keep headings meaningful and ordered.
- Use text links/buttons; avoid icon-only controls.

## Do

- Work on branch `v3` for the static migration.
- Keep required browser libraries under `v3/vendor/` and reference them from `v3/js/chains.js`.
- Add one migrated feature at a time and validate it before widening scope.
- Keep auth compatibility with the legacy localStorage scheme. v3 may perform real broadcast from explicit UI submit/confirm flows when the operation is mapped; preview/dry-run is optional and must not be a permanent blocker.
- Record assumptions and known gaps in `plan.md` or the final report.
- Use SSH remotes.
- Before telling Denis an APK/web change is live, verify the actual APK hash and public HTTPS markers, not only local files.
- Copy Telegram-delivered APKs through the Hermes media cache; public web APKs belong under `downloads/`.

## Do not

- Do not push without Denis explicitly asking.
- Do not add runtime dependencies on removed legacy PHP files or `blockchains/` paths.
- Do not add backend-only features to the static runtime.
- Do not store secrets in the repository or chat.
- Do not introduce heavy frameworks for the first static version.
- Do not call direct `pytest` for Android work; use Gradle tests. Do not skip tests after version bumps.
- Do not treat debug APK as a stable release. Stable/non-debug release needs separate signing/config verification and a final gate.
