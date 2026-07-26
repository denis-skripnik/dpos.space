const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
const { webcrypto } = require('crypto');

const appSource = fs.readFileSync('v3/js/app.js', 'utf8');
const mainActivitySource = fs.readFileSync('android/app/src/main/java/space/dpos/android/ui/MainActivity.kt', 'utf8');
const buildGradle = fs.readFileSync('android/app/build.gradle.kts', 'utf8');
const assetLinks = fs.readFileSync('.well-known/assetlinks.json', 'utf8');
const passkeySlice = appSource.slice(appSource.indexOf('function isPasskeyPrfBackupAvailable'), appSource.indexOf('function importDposBackupStorage'));
const renderSlice = appSource.slice(appSource.indexOf('function renderDposBackupPage'), appSource.indexOf('function renderHome'));

assert(passkeySlice.includes('passkey-prf-localstorage-backup'), 'backup has a dedicated passkey PRF encrypted format marker');
assert(passkeySlice.includes('extensions: { prf: { eval: { first: salt } } }'), 'passkey backup requests WebAuthn PRF output with a file salt');
assert(passkeySlice.includes('getClientExtensionResults()'), 'passkey backup reads WebAuthn extension results');
assert(passkeySlice.includes('derivePasskeyBackupKey(prfOutput, salt)'), 'passkey backup derives AES key from PRF output, not from a typed password');
assert(passkeySlice.includes("name: 'HKDF'"), 'passkey PRF output is passed through HKDF before AES-GCM use');
assert(passkeySlice.includes("userVerification: 'required'"), 'passkey backup requires device user verification');
assert(renderSlice.includes('backup-passkey-export'), 'backup UI exposes passkey export button');
assert(renderSlice.includes('backup-passkey-import'), 'backup UI exposes passkey import button');
assert(renderSlice.includes('Passkey-backup скачан как файл'), 'passkey backup downloads directly after PRF instead of attempting delayed navigator.share');
assert(renderSlice.includes('Импортировать passkey-backup'), 'passkey backup success message tells users which import button to use');
assert(!renderSlice.includes('Passkey-backup создан для') && !renderSlice.includes('Системное меню отправки открыто; ручной пароль не нужен'), 'passkey backup no longer promises delayed system share after passkey prompts');
assert(renderSlice.includes('Используйте backup с паролем'), 'passkey backup has a password-backup fallback message');
assert(!passkeySlice.includes('clipboard.writeText') && !passkeySlice.includes('navigator.clipboard'), 'passkey backup does not use clipboard transfer');

assert(buildGradle.includes('androidx.webkit:webkit:1.14.0'), 'Android app depends on modern AndroidX WebKit for WebAuthn support');
assert(buildGradle.includes('androidx.credentials:credentials:'), 'Android app includes Credential Manager dependency for passkeys');
assert(mainActivitySource.includes('WebViewFeature.WEB_AUTHENTICATION'), 'Android WebView checks WebAuthn feature support');
assert(mainActivitySource.includes('WebSettingsCompat.setWebAuthenticationSupport'), 'Android WebView enables WebAuthentication support');
assert(mainActivitySource.includes('WebSettingsCompat.WEB_AUTHENTICATION_SUPPORT_FOR_APP'), 'Android WebView uses app web-authentication support mode');
assert(assetLinks.includes('space.dpos.android.debug'), 'Digital Asset Links includes debug APK package for WebView passkeys');
assert(assetLinks.includes('delegate_permission/common.get_login_creds'), 'Digital Asset Links grants login credential delegation for passkeys');
assert(assetLinks.includes('86:B5:1E:10:C6:66:CF:9C:2C:4E:CD:EA:84:07:EC:06:83:80:FB:24:2A:DB:2F:AE:5D:23:73:51:76:8F:3B:27'), 'Digital Asset Links contains the current debug signing fingerprint');

const storage = new Map([
  ['golos_users', '[{"login":"denis"}]'],
  ['golos_current_user', '{"login":"denis"}'],
  ['unrelated_analytics_key', 'secret']
]);
let credentialId;
let currentSalt;
const fakePrf = new Uint8Array(32).fill(7);
function fakeElement(extra = {}) {
  return Object.assign({
    innerHTML: '', textContent: '', value: '', disabled: false, hidden: false,
    dataset: {}, style: {}, addEventListener() {}, setAttribute() {}, removeAttribute() {}, appendChild() {}, querySelector: () => null, closest: () => fakeElement()
  }, extra);
}
const context = {
  console,
  URLSearchParams,
  TextEncoder,
  TextDecoder,
  Blob,
  File: typeof File === 'function' ? File : undefined,
  crypto: webcrypto,
  PublicKeyCredential: function PublicKeyCredential() {},
  location: { hash: '#app=backup', origin: 'https://dpos.blinddev.xyz', hostname: 'dpos.blinddev.xyz', pathname: '/' },
  addEventListener() {},
  btoa: (value) => Buffer.from(value, 'binary').toString('base64'),
  atob: (value) => Buffer.from(value, 'base64').toString('binary'),
  navigator: {
    share: async () => {},
    canShare: () => true,
    credentials: {
      async create(options) {
        assert(ArrayBuffer.isView(options.publicKey.extensions.prf.eval.first), 'create receives PRF salt');
        credentialId = new Uint8Array([1, 2, 3, 4]).buffer;
        currentSalt = options.publicKey.extensions.prf.eval.first;
        return {
          rawId: credentialId,
          getClientExtensionResults() { return { prf: { results: { first: fakePrf.buffer } } }; }
        };
      },
      async get(options) {
        assert(ArrayBuffer.isView(options.publicKey.extensions.prf.eval.first), 'get receives PRF salt');
        assert.strictEqual(Buffer.from(options.publicKey.allowCredentials[0].id).toString('hex'), '01020304', 'get uses stored credential id');
        assert.strictEqual(Buffer.from(options.publicKey.extensions.prf.eval.first).toString('hex'), Buffer.from(currentSalt).toString('hex'), 'get uses backup salt');
        return { getClientExtensionResults() { return { prf: { results: { first: fakePrf.buffer } } }; } };
      }
    }
  },
  localStorage: {
    get length() { return storage.size; },
    key(index) { return Array.from(storage.keys())[index] || null; },
    getItem(key) { return storage.has(key) ? storage.get(key) : null; },
    setItem(key, value) { storage.set(key, String(value)); },
    removeItem(key) { storage.delete(key); }
  },
  document: { getElementById: () => fakeElement({ dataset: {} }), querySelector: () => null, createElement: () => fakeElement({ click() {}, remove() {} }), body: fakeElement(), head: fakeElement() },
  DposChains: { golos: { id: 'golos', title: 'Golos', apps: [{ id: 'profiles', title: 'Профиль' }], defaultAccount: '' } },
  DposAuth: { getUsers: () => [], getCurrentUser: () => null, getCurrentLogin: () => '', getUserLogin: (user) => user && user.login || '', getUserType: () => 'standard' },
  DposBroadcast: {},
  DposProfiles: { formatError: (error) => error.message },
  DposHistory: {},
  DposNotifications: null
};
context.globalThis = context;
context.window = context;
vm.createContext(context);
vm.runInContext(appSource, context);

(async () => {
  const backup = context.DposV3.backup;
  assert.strictEqual(backup.isPasskeyPrfBackupAvailable(), true, 'fake WebAuthn environment is detected');
  const encrypted = await backup.encryptDposPasskeyBackup();
  assert.strictEqual(encrypted.type, 'passkey-prf-localstorage-backup', 'encrypted backup uses passkey format');
  assert.strictEqual(encrypted.passkey.rpId, 'dpos.blinddev.xyz', 'backup binds to the current RP ID');
  assert(encrypted.passkey.credentialId, 'backup stores credential id for later allowCredentials lookup');
  const decrypted = await backup.decryptDposPasskeyBackup(JSON.stringify(encrypted));
  assert(decrypted.storage.golos_users, 'roundtrip decrypt restores allowed DPoS storage');
  assert(!decrypted.storage.unrelated_analytics_key, 'roundtrip excludes unrelated localStorage keys');
  console.log('v3 passkey backup smoke passed');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
