const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { webcrypto } = require('crypto');
const { TextEncoder, TextDecoder } = require('util');

const root = path.resolve(__dirname, '..');
const TEST_WIF = '5HpHagT65TZzG1PH3CSu63k8DbpvD8s5ip4nEB3kEsreAvUcVfH';

function makeStorage(map) {
  return {
    get length() { return map.size; },
    key(index) { return Array.from(map.keys())[index] || null; },
    getItem(key) { return map.has(key) ? map.get(key) : null; },
    setItem(key, value) { map.set(key, String(value)); },
    removeItem(key) { map.delete(key); }
  };
}

function load(map, credentials, includeCrypto = true) {
  const context = {
    console,
    TextEncoder,
    TextDecoder,
    crypto: includeCrypto ? webcrypto : undefined,
    localStorage: makeStorage(map),
    navigator: { credentials, locks: { request: async (_name, action) => action() } },
    location: { hostname: 'dpos.test' },
    addEventListener() {}
  };
  context.window = context;
  context.globalThis = context;
  vm.createContext(context);
  for (const rel of ['v3/vendor/golos/sjcl.min.js', 'v3/js/vault.js', 'v3/js/auth.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, rel), 'utf8'), context, { filename: rel });
  }
  return context;
}

function credential(prf, idBytes) {
  return {
    rawId: Uint8Array.from(idBytes || [1, 2, 3, 4]).buffer,
    getClientExtensionResults() {
      return { prf: { enabled: true, results: { first: Uint8Array.from(prf).buffer } } };
    }
  };
}

async function run() {
  const map = new Map();
  const prf = Array.from({ length: 32 }, (_, index) => index + 1);
  const calls = [];
  const credentials = {
    async create(options) { calls.push(['create', options]); return credential(prf); },
    async get(options) { calls.push(['get', options]); return credential(prf); }
  };
  const context = load(map, credentials);
  const encrypted = context.sjcl.encrypt('dpos.space_hive_alice_postingKey', TEST_WIF);
  map.set('hive_users', JSON.stringify([{ login: 'alice', posting: encrypted }]));

  await context.DposVault.migrate({ passkey: true, rpId: 'dpos.test' });
  assert.strictEqual(context.DposVault.status().method, 'passkey-prf');
  assert.strictEqual(calls[0][0], 'create');
  assert(calls[0][1].publicKey.extensions.prf.eval.first.byteLength === 32, 'registration requests WebAuthn PRF');
  const exported = context.DposVault.export();
  assert.strictEqual(exported.hive_users[0].login, 'alice', 'legacy backup export keeps account shape');
  assert.doesNotThrow(() => context.sjcl.decrypt('dpos.space_hive_alice_postingKey', exported.hive_users[0].posting), 'export remains compatible SJCL ciphertext');

  context.DposVault.lock();
  await context.DposVault.unlock();
  assert.strictEqual(calls[1][0], 'get');
  assert.strictEqual(calls[1][1].publicKey.extensions.prf.eval.first.byteLength, 32, 'unlock requests the persisted PRF salt');
  assert.strictEqual(context.DposAuth.getCurrentLogin({ id: 'hive' }), '', 'missing current selection stays missing');

  const cancelledMap = new Map();
  const cancelled = load(cancelledMap, { async create() { throw new Error('NotAllowedError'); } });
  cancelledMap.set('viz_users', JSON.stringify([{ type: 'vizonator', last_login: 'extension-user' }]));
  await assert.rejects(() => cancelled.DposVault.migrate({ passkey: true }), /отмен|ошиб/i);
  assert(cancelledMap.has('viz_users'), 'cancelled passkey leaves legacy records intact');
  assert(!cancelledMap.has(cancelled.DposVault.storageKeys.active), 'cancelled passkey cannot activate vault');

  const noPrfMap = new Map();
  const noPrf = load(noPrfMap, { async create() { return { rawId: Uint8Array.of(9).buffer, getClientExtensionResults() { return { prf: { enabled: false } }; } }; } });
  noPrfMap.set('viz_users', JSON.stringify([{ type: 'vizonator', last_login: 'extension-user' }]));
  await assert.rejects(() => noPrf.DposVault.migrate({ passkey: true }), /PRF|пароль/i);
  assert(noPrfMap.has('viz_users'), 'unsupported PRF leaves legacy records intact');

  const noCryptoMap = new Map([['golos_users', JSON.stringify([])]]);
  const noCrypto = load(noCryptoMap, {}, false);
  await assert.rejects(() => noCrypto.DposVault.migrate({ password: 'long enough password' }), /WebCrypto/i);
  assert(noCryptoMap.has('golos_users'), 'missing WebCrypto fails closed without cleanup');

  console.log('v3 vault passkey/fail-closed behavioral tests passed');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
