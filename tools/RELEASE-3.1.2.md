# 3.1.2 secure signer staging (not a release)

The default-profile Hermes venv has `hermes-secure-env-ingress` **0.6.2**.
Its built-in administrator config allowlist registers two project-owned top-level
factories in `tools/release_secure_consumer.py`; no extra plugin, core edit,
startup hook, or daemon is involved. Nonsecret config path:
`plugins.entries.secure-env-ingress.settings.consumers`, with names
`dpos_release_key_init` and `dpos_release_sign_312`. Each entry pins `path`
(`/home/assistent/ai-projects/dpos.space/tools/release_secure_consumer.py`),
matching `factory` name, reviewed source `sha256` and
`requires_verified_principal: false` (the transport cannot yet verify the
submitter; links are bearer capabilities). The pinned paths inside the handler
are this checkout, `/home/assistent/.hermes/keys/dpos-release-312` (mode 0700),
and `/home/assistent/android-sdk/build-tools/35.0.0`. The handler file and
its immediate directory are not group/other writable. If the handler changes,
review it and update its SHA-256 in both entries through `hermes config set`
before restarting. Never accept a path, command, or certificate from parameters.

The active gateway was **not restarted** by this staging task; config will be
loaded at the next coordinated `hermes gateway restart` by the parent/operator.
The current process can still have the old registry. An isolated 0.6.2 loader
probe confirmed both names register, key-init binds without touching a key,
and signing rejects the absent 3.1.2 APK. The config-before-change backup is
`/home/assistent/.hermes/backups/config/config.yaml.pre-dpos-secure-operation.20260927-135636`
(mode 0600, byte-identical at capture). The ordinary Hermes config-backup method
is not encrypted; keep access restricted. Changes to config do not hot-reload
consumers. The legacy `register(...)` remains for synthetic tests only.

After activation, in an authorized closed chat, the parent can request:

- `secure_operation(operation="dpos_release_key_init", parameters={"release":"3.1.2"})`
  to create a fresh encrypted **manifest** Ed25519 private key (not the Android
  APK signing keystore). A real password is entered only on the one-shot HTTPS
  form. The operator reads the public pin from the private directory's
  `dpos-release-ed25519.public`; the model never receives the password.
- After release APK and source are final, committed and visible as an exact tip
  on the GitHub origin, and the pinned public key is built into native
  verification: `secure_operation(operation="dpos_release_sign_312",
  parameters={"release":"3.1.2"})`. The HTTPS form displays SHA-256, package,
  historical cert, code, GitHub commit and notBefore. The signer independently
  rechecks these at submission; only the exact 3.1.2 manifest is signed.

The manifest operation writes `downloads/dpos-space-3.1.2.manifest.json`
exclusively; it never publishes. It uses `aapt` plus `apksigner` and a
trusted fixed historical certificate in the consumer, independently verified
against installed 3.1.1 (`86b51e10c666cf9c2c4ecdea8407ec068380fb242adb2fae5d237351768f3b27`).
The repository certificate file is **not** a trust source for the signer; a
request cannot override the fixed pin. The manifest publicKey is
informational: Android must compare it to the separately bundled owner-reviewed
pin, never trust the manifest's own publicKey. The signer protocol is
`Ed25519(UTF8("dpos.space/release/v1\\n") || canonical_json(manifest))`.

## Local 3.1.2 candidate provenance (not signed or published)

The parent built `android/app/build/outputs/apk/release/app-release.apk` with
`dposReleasePublicKey` read from the private owner-key directory. The exact
build output was copied without modification to
`downloads/dpos-space-3.1.2.apk`; both local files have SHA-256
`db1e0dff0b5fb9dba95aa1036bba1916e4e1c9e6b4680f9e833a8eea6907d3fe`
and size 12,627,837 bytes. The staged binary's **candidate** Git blob SHA-1
is `78375298cea0c04425d5ad8a8e0ee6b4af3206b3`. This is not yet a
committed blob or a public GitHub provenance claim. `aapt dump badging`
identifies package `space.dpos.android.debug`, versionCode `80`, versionName
`3.1.2`, minSdk `26`, targetSdk `35`. `apksigner verify --verbose --print-certs`
passes with exactly one signer (v2 signature): certificate SHA-256
`86b51e10c666cf9c2c4ecdea8407ec068380fb242adb2fae5d237351768f3b27`,
matching the locally retained 3.1.1 APK certificate. The 3.1.2 release APK
has no debuggable attribute in the inspected manifest. The owner public pin
from `dpos-release-ed25519.public` is
`6C91EPDAC8S/rMwYjmPX0uPwXwGovc79nq5Bpnzvxzw=` (32 raw Ed25519 bytes,
base64); the same literal occurs in the release APK's `classes3.dex` and
in generated release `BuildConfig.java`. This comparison proves local build
embedding, **not** independent owner authentication of the key. The encrypted
private key stays outside the repository. No owner password was read or used.

**Signing readiness: blocked.** `collect()` currently rejects this checkout
with `ValueError: dirty source tree: exact commit provenance unavailable`.
The working tree includes many unrelated modified/untracked files, and the
3.1.2 APK itself is untracked. HEAD at the time of this candidate inspection
was `de23fa5e5640b865e7db684a419e24f7b1606e11` on `v3`, but **that commit
does not contain this release**, so do not use it as `sourceCommit`. No
3.1.2 signed manifest exists. Keep the candidate byte-identical; if source or
APK changes, rebuild and repeat all identity checks. Review the whole tree,
commit the intended final source plus this exact APK, push the exact tip to the
public GitHub origin, and re-run the signer `collect()` gate. The secure-env
operation will recheck certificate, version, file bytes, exact committed Git
blob and reachability on the public origin before signing. Do **not** bypass
the clean-tree/public-commit gate or fabricate a manifest. Signing and
publication require distinct owner approval; verify the actually served APK
SHA-256 against the signed manifest before any public release.

The first updater-bearing 3.1.2/code80 APK cannot offer itself as newer;
already-installed 3.1.1/code79 does not contain this updater. The first
updater-bearing 3.1.2 must be manually installed from an owner-verified APK
over existing app data. Physical-device installation and publication remain
unverified. Only later monotonic releases can use the updater; no older
updater version hack. GitHub APK blob linkage proves committed binary identity,
not a reproducible source-to-binary build proof.
The signer freezes a no-follow content snapshot at binding and rechecks inode,
content, package, certificate, source and Git blob before/after signing and
manifest writing. Concurrent replacement aborts; a later external mutation
cannot be prevented by local signing alone. Before owner-approved publication,
compare the *served* APK SHA-256 to the signed manifest. Android independently
rejects any downloaded APK whose SHA-256 differs, even if local publication races.

Owner bootstrap fields (do not paste the password or private key into chat):

1. The reviewed secure-env operation `dpos_release_key_init` with exact
   parameters `{"release":"3.1.2"}`; its HTTPS form receives the owner password.
2. The resulting `dpos-release-ed25519.public` is base64 of the **32-byte raw
   Ed25519 public key**. After independent out-of-band pin verification, set
   `dposReleasePublicKey=<base64>` only in a trusted local Gradle property or
   command-line `-PdposReleasePublicKey=<base64>`; avoid shell history for the
   latter. Never put synthetic test keys in a shipping build. Historical APK
   certificate is separately pinned by the trusted consumer constant (and
   checked again by the native build).
3. With final APK and tree committed/pushed to exact public origin and artifact
   independently verified, request `dpos_release_sign_312` with the same exact
   release parameter through the HTTPS form; sign only after immutable byte,
   certificate, source and version checks. Do not publish merely because signed.

Local checks (no live key): `cd android && ./gradlew :app:testDebugUnitTest
--tests space.dpos.android.ReleasePolicyTest :app:assembleRelease --offline
--no-daemon`; `python3 -m unittest discover -s tests -p test_release_secure.py -v`.

Run synthetic tests (made-up passphrase and APK only):
`python3 -m unittest discover -s tests -p test_release_secure.py -v`.
