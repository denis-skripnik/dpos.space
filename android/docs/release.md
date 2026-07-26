# Android release notes and packaging

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
4. From WebView console/debug UI, call `getAppInfo()`, `getWorkerStatus()`, `importWorkerSettings()` with explicit non-secret Golos settings, `importSecureKey()` with a controlled test-only key on a non-production device, `startWorker()`, `checkNow()`, `stopWorker()`, `exportWorkerLogs()`.
5. Verify `importWorkerSettings()` rejects secret-like fields and `importSecureKey()` returns only `keyRef` / `hasKey` metadata without echoing the imported secret.
6. Verify the foreground notification is visible while running and has Open / Check now / Stop actions.
7. Verify exported logs are redacted and do not contain private keys, seeds, WIFs, passwords, tokens or raw encrypted blobs.
8. Reboot the device/emulator after enabling the worker and confirm boot restore either resumes the visible worker state or reports why Android restrictions prevented it.

Native signing/broadcast status:

- Kotlin now has deterministic Golos vote operation fixtures and a dry-run broadcast/signing gate.
- The automated worker remains dry-run by default and never performs mainnet broadcasts.
- Live mainnet validation, Google Play publishing, AAB signing, release keystore use, and Play service accounts require explicit Denis approval and local/CI secrets outside git.
