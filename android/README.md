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
- `window.DposAndroid.importWorkerSettings(json)` — explicit opt-in import of non-secret worker settings. The JSON must include `explicitConsent: true`; secret-like fields such as private keys, WIFs, seeds, mnemonic, password, token or key are rejected. Key import is intentionally reserved for native secure-storage UI/flow.
- `window.DposAndroid.startWorker()` / `stopWorker()` — start/stop visible foreground service.
- `window.DposAndroid.checkNow()` — enqueue a one-shot WorkManager check.
- `window.DposAndroid.openBatterySettings()` — open Android app settings so the user can review battery restrictions.
- `window.DposAndroid.exportWorkerLogs()` — export redacted local worker logs.

Current worker scope:

- Golos notification worker supports incoming-only history checks with first-run cursor baseline.
- Foreground service has visible persistent notification actions: open, check now, stop.
- Boot restore starts only when the user had enabled the worker.
- Native auto-upvoter is dry-run/planning only. No mainnet vote/broadcast is performed by automated tests or background worker in this milestone.

Release signing secrets/keystores must not be committed. Use Android Studio, local untracked Gradle properties, or CI secrets later for signed release builds.
