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

## Secure manifest operation (existing trusted generic signer)

Use existing Secure ENV operation `dpos_release_sign` with exactly
`{"versionName":"3.1.4","versionCode":82}`. No new registration, config-pin change,
activation or key-init is required. The installed trusted handler is
`/home/assistent/ai-projects/dpos.space-release/tools/release_secure_consumer.py`,
factory `dpos_release_sign`, SHA-256
`752f987e6d6b715faf7b9ad2dadf2e88314f8b045f601545430c72dc55e72e4e`.
After approved source/APK publication, fast-forward that clean trusted checkout to
the frozen source HEAD without reset/rebase/force, then verify exact HEAD, clean
status, handler/dependency pins and committed APK bytes before binding the form.
The generic handler anchors its repository to its own location, fixes the
historical certificate, existing private key directory and SDK tools, and writes
immutable output `downloads/dpos-space-3.1.4.manifest.json`. Existing clean/public
commit, anti-replacement, exclusive-write and one-shot checks remain unchanged.
No executable path comes from operation arguments. Do not reuse the 3.1.2
operation. Password entry is exclusively through the one-shot HTTPS form, never
chat. The form is a private bearer capability, not verified submitter identity.

The signer requires the frozen APK/source commit to be publicly reachable on the
fixed GitHub origin before binding. A later manifest-publication commit may refer
to this preceding source/APK commit. `publishedAt` is computed at form binding,
and `notBefore = publishedAt +24h`, not 24h after password submission. Complete a
fresh form promptly and verify signed timestamps; native first-seen policy also
applies. Do not rewrite signed fields or remove either delay.
After signing, verify Ed25519 against the separately trusted public pin and exact
source/APK identity before publishing the versioned manifest and latest alias.

Download the actually served APK and manifest independently after publication;
verify hash, certificate, source commit, signature, visible link and CI. Local
unit/build evidence is not a physical-device, TalkBack, real-donation or installed
3.1.4 verification. User feedback on the preceding working private build is a
separate observation, not such a test.
