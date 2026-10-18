# Android 3.1.4 / code 82 release procedure

This candidate retains `space.dpos.android.debug`, the historical APK certificate
`86b51e10c666cf9c2c4ecdea8407ec068380fb242adb2fae5d237351768f3b27`, and the existing manifest public pin.
Do not uninstall the previous app or regenerate either signing identity.

## Gates

- Start from the current published `v3` base, preserving all published web fixes.
- Accepted normal Android source plus its test-only canonical-receipt fixture repair;
  no high-pool experimental build or test-account settings.
- Serial full Debug and Release unit gates through `android/scripts/run_tests.sh`,
  release assembly with the real trusted public pin, APK identity/certificate and
  final DEX pin verification, web checks, synthetic signer security tests.
- Freeze a clean local commit containing the source and exact
  `downloads/dpos-space-3.1.4.apk`; record its SHA-256 and commit out of tree.
  The manifest must bind that exact commit and binary. Do not rebuild silently.
- Parent independent review and deployment approval are required before pushing.
  The production watcher follows `v3`; a push can immediately deploy the site.
  Preserve all existing downloads and protected untracked server files; verify a
  fresh encrypted backup and exact remote/live baseline immediately beforehand.

## Secure manifest operation (not automatically registered)

The project-owned `tools/release_secure_consumer.py` exposes
`dpos_release_sign_314`. Its only accepted parameters are
`{"release":"3.1.4"}`. It fixes versionName `3.1.4`, versionCode `82`, repository
from its own location, historical certificate, existing private key directory,
SDK tools, and immutable output `downloads/dpos-space-3.1.4.manifest.json`.
The existing signer SHA-256 dependency pin and all clean/public-commit, artifact,
anti-replacement, exclusive-write and one-shot checks remain unchanged.

Register ONLY after reviewing the exact handler and dependency and pinning its
path, factory, and SHA-256 in the installed Secure ENV canonical consumer config.
No executable path comes from operation arguments. Do not reuse the 3.1.2
operation. No key-init operation is needed. Password entry is exclusively through
the one-shot HTTPS form, never chat. The form is a private bearer capability.

The signer requires the frozen APK/source commit to be publicly reachable on the
fixed GitHub origin before binding. A later manifest-publication commit may refer
to this preceding source/APK commit. Its `notBefore` is at least 24 hours after
signing; native first-seen policy also applies. Do not remove either delay.
After signing, verify Ed25519 against the separately trusted public pin and exact
source/APK identity before publishing the versioned manifest and latest alias.

Download the actually served APK and manifest independently after publication;
verify hash, certificate, source commit, signature, visible link and CI. Local
unit/build evidence is not a physical-device, TalkBack, real-donation or installed
3.1.4 verification. User feedback on the preceding working private build is a
separate observation, not such a test.
