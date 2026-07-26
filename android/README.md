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
- Native auto-upvoter imports curator/favorite source settings, collects curator votes from Golos account history and favorite posts from Golos blog/discussion RPC, plans eligible vote actions, signs them locally, and broadcasts them when worker/account/key/safety gates are enabled.
- Secure signing keys can be imported only through the dedicated `importSecureKey(json)` bridge and Android encrypted storage. Normal settings import rejects secret-like fields.

Release signing secrets/keystores must not be committed. Use Android Studio, local untracked Gradle properties, or CI secrets later for signed release builds.
