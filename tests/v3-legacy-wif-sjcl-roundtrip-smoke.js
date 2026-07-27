const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { TextEncoder, TextDecoder } = require('util');

const root = path.resolve(__dirname, '..');
const TEST_ACCOUNT = 'denis-test';
// Deterministic non-secret secp256k1 private key = 2, encoded as legacy Graphene/Golos WIF without compression marker.
const LEGACY_FIVE_WIF = '5HpHagT65TZzG1PH3CSu63k8DbpvD8s5ip4nEB3kEsreAvUcVfH';

const context = {
  console,
  TextEncoder,
  TextDecoder,
  localStorage: new Map(),
  location: { hash: '', origin: 'https://dpos.blinddev.xyz', hostname: 'dpos.blinddev.xyz', pathname: '/' },
  addEventListener() {},
};
context.localStorage.getItem = context.localStorage.get.bind(context.localStorage);
context.localStorage.setItem = (key, value) => context.localStorage.set(key, String(value));
context.localStorage.removeItem = context.localStorage.delete.bind(context.localStorage);
context.localStorage.key = (index) => Array.from(context.localStorage.keys())[index] || null;
Object.defineProperty(context.localStorage, 'length', { get() { return context.localStorage.size; } });
context.globalThis = context;
context.window = context;
context.self = context;
vm.createContext(context);

for (const rel of [
  'v3/vendor/golos/sjcl.min.js',
  'v3/js/auth.js',
  'v3/js/broadcast.js'
]) {
  vm.runInContext(fs.readFileSync(path.join(root, rel), 'utf8'), context, { filename: rel });
}

const chain = { id: 'golos', title: 'Golos', libraryGlobal: 'golos' };
const user = context.DposAuth.createKeyUser(chain, TEST_ACCOUNT, { posting: LEGACY_FIVE_WIF });
assert(user.posting && user.posting !== LEGACY_FIVE_WIF, 'legacy posting WIF is encrypted in browser storage, not stored plaintext');
context.DposAuth.saveUser(chain, user);

const restoredUser = context.DposAuth.getCurrentUser(chain);
const decrypted = context.DposBroadcast.decryptLegacyKey(chain, restoredUser, 'posting');
assert.strictEqual(decrypted.privateKey, LEGACY_FIVE_WIF, 'SJCL legacy decrypt returns the exact original 5... WIF byte-for-byte');
assert.strictEqual(decrypted.authority, 'posting', 'decrypt path keeps posting authority');
assert.strictEqual(decrypted.privateKey.length, LEGACY_FIVE_WIF.length, 'decrypted WIF length is unchanged');

decrypted.privateKey = '';
console.log('v3 legacy WIF SJCL roundtrip smoke passed');
