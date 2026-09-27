# DPoS Space Android 3.1.0

- Stable Android build, version code 78.
- Keeps the installed package ID and signing certificate of the 0.1.76 debug build so it can be installed as an update without removing local app data.
- Uses the canonical Gradle `release` build type and disables WebView debugging in release builds.
- Includes the current native worker, notification inbox, diagnostics, secure bridge, VIZ self-award, and Golos/Hive/Steem auto-upvoter work present in the Android source tree.

## Compatibility note

This transitional stable APK retains the historical `space.dpos.android.debug` application ID and Android debug signing certificate solely for upgrade compatibility. A future migration to a production application ID or signing key requires an explicit data/update migration plan.

## Release verification

- `testReleaseUnitTest assembleRelease`: 185 tests, zero failures/errors/skips.
- APK manifest: `space.dpos.android.debug`, code 78, version 3.1.0, not debuggable. Certificate matches the user-confirmed 0.1.76 APK.
- Web: 133 test files, 26 syntax checks; wallet forms across six chains, Golos swap eligibility + keyboard route + RU/EN, backup/restore tests.
- Golos DEX live quote and unsigned `makeExchangeTx` validated; no real transactions sent.
- Published eight allowlisted files with verified encrypted backup at `/www/backup/dpos-site-audit-20260923-043441`. Exact public SHA-256 matched all eight.
- Live browser checks: six-chain wallet forms, Golos swap routes/RU-EN, diagnostics/export, saved-account upvoter navigation, SW upgrade/offline diagnostics, actual APK link download. APK excluded from SW caches.
- Public APK SHA-256: `19ef09ff2cf2508071fc091d805fc97bb605c52c6026a313866b0c62a19f68b7`.
- User already confirmed Golos voting, screen-off background work, and updates on the preceding build. Installation of this exact 3.1.0 APK and the user's manual wallet transfer result remain unverified on the physical phone.
- Historical debug downloads were not overwritten. No git commit/push or mainnet test broadcast.
