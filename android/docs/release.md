# Android release notes and packaging

Build debug APK:

```bash
cd android
./gradlew clean test assembleDebug
sha256sum app/build/outputs/apk/debug/app-debug.apk
```

Release signing plan:

1. Generate or use an existing Android keystore outside this repository.
2. Provide signing config through local Gradle properties or CI secrets.
3. Never commit `.jks`, `.keystore`, key passwords, Play service accounts, or upload keys.
4. Name manual artifacts as `dpos-space-android-<version>.apk` and publish checksums next to them.

Live mainnet auto-actions are not part of automated validation. They require explicit Denis approval and a controlled manual run.
