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
Release signing secrets/keystores must not be committed. Use Android Studio or CI secrets later for signed release builds.
