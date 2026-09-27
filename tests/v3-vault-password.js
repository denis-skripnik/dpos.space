const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { webcrypto } = require('crypto');
const { TextEncoder, TextDecoder } = require('util');

const root = path.resolve(__dirname, '..');
const PASSWORD = 'correct horse battery staple';
const TEST_WIF = '5HpHagT65TZzG1PH3CSu63k8DbpvD8s5ip4nEB3kEsreAvUcVfH';

const storageQueues = new WeakMap();
function testLocks(map) {
  return { request(_name, action) {
    const next = (storageQueues.get(map) || Promise.resolve()).then(action);
    storageQueues.set(map, next.catch(() => undefined));
    return next;
  } };
}

function storageFrom(map, hooks = {}) {
  return {
    get length() { return map.size; },
    key(index) { return Array.from(map.keys())[index] || null; },
    getItem(key) { return map.has(key) ? map.get(key) : null; },
    setItem(key, value) {
      if (hooks.failSet && hooks.failSet(key, value)) throw new Error('QuotaExceededError');
      map.set(key, String(value));
      if (hooks.afterSet) hooks.afterSet(key, String(value), map);
    },
    removeItem(key) { map.delete(key); }
  };
}

function makeContext(map = new Map(), hooks = {}) {
  const listeners = {};
  const context = {
    console,
    crypto: webcrypto,
    TextEncoder,
    TextDecoder,
    localStorage: storageFrom(map, hooks),
    location: { origin: 'https://dpos.test' },
    navigator: { locks: testLocks(map) },
    addEventListener(type, fn) { (listeners[type] ||= []).push(fn); }
  };
  context.window = context;
  context.globalThis = context;
  context.__listeners = listeners;
  vm.createContext(context);
  for (const rel of ['v3/vendor/golos/sjcl.min.js', 'v3/js/vault.js', 'v3/js/auth.js', 'v3/js/broadcast.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, rel), 'utf8'), context, { filename: rel });
  }
  return context;
}

function legacyKey(chain, login, field) {
  if (field === 'seed') return `dpos.space_${chain}_${login}_seed`;
  return `dpos.space_${chain}_${login}_${field}Key`;
}

async function run() {
  const protectedSetupMap = new Map();
  const protectedSetup = makeContext(protectedSetupMap);
  const prematureUser = protectedSetup.DposAuth.createKeyUser({ id: 'golos' }, 'premature', { posting: TEST_WIF });
  await assert.rejects(() => protectedSetup.DposAuth.saveUser({ id: 'golos' }, prematureUser), /vault|защит|заблокирован/i, 'new secret cannot be saved before vault protection is set up');
  assert.strictEqual(protectedSetupMap.has('golos_users'), false, 'pre-setup save never creates legacy secret storage');

  const map = new Map();
  const context = makeContext(map);
  const legacyCipher = context.sjcl.encrypt(legacyKey('golos', 'alice', 'posting'), TEST_WIF);
  const alice = { login: 'alice', posting: legacyCipher, active: context.sjcl.encrypt(legacyKey('golos', 'alice', 'active'), TEST_WIF), profile: { theme: 'dark' } };
  const originalGolosUsers = JSON.stringify([alice, { login: 'oauth', type: 'golos.app', posting: 'oauth-token-shape' }]);
  map.set('golos_users', originalGolosUsers);
  map.set('golos_current_user', JSON.stringify(alice));
  const vizLocal = { login: 'viz-local', regular: context.sjcl.encrypt(legacyKey('viz', 'viz-local', 'regular'), TEST_WIF), active: context.sjcl.encrypt(legacyKey('viz', 'viz-local', 'active'), TEST_WIF), memo_key: 'public-memo-key-fixture' };
  map.set('viz_users', JSON.stringify([{ type: 'vizonator', last_login: 'viz-user', isActive: true }, vizLocal]));
  map.set('viz_current_user', JSON.stringify({ type: 'vizonator', last_login: 'viz-user', isActive: true }));
  for (const chainId of ['steem', 'hive']) {
    const encrypted = context.sjcl.encrypt(legacyKey(chainId, `${chainId}-user`, 'posting'), TEST_WIF);
    map.set(`${chainId}_users`, JSON.stringify([{ login: `${chainId}-user`, posting: encrypted, active: context.sjcl.encrypt(legacyKey(chainId, `${chainId}-user`, 'active'), TEST_WIF) }]));
  }
  const minterSeed = context.sjcl.encrypt(legacyKey('minter', 'minter-user', 'seed'), 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about');
  map.set('minter_users', JSON.stringify([{ login: 'minter-user', seed: minterSeed }]));
  const seedCipher = context.sjcl.encrypt(legacyKey('minter', 'wallet-one', 'seed'), 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about');
  map.set('decimal_current_user', JSON.stringify({ login: 'wallet-one', seed: seedCipher, importFrom: 'minter', address: 'd0example' }));
  map.set('golos_node', 'https://node.example');
  map.set('dpos_notifications', JSON.stringify({ enabled: true }));

  assert.strictEqual(context.DposVault.status().state, 'legacy');
  await context.DposVault.migrate({ password: PASSWORD });
  assert.strictEqual(context.DposVault.status().state, 'unlocked');
  assert.strictEqual(map.has('golos_users'), false, 'activated migration removes legacy secret account map');
  assert.strictEqual(map.get('golos_node'), 'https://node.example', 'non-secret settings stay untouched');
  assert.strictEqual(JSON.parse(map.get('dpos_notifications')).enabled, true, 'settings survive migration');
  const activeText = map.get(context.DposVault.storageKeys.active);
  assert(activeText && !activeText.includes(TEST_WIF) && !activeText.includes('alice') && !activeText.includes(legacyCipher), 'active vault does not expose legacy or plaintext secrets');
  assert.strictEqual(context.DposAuth.getCurrentLogin({ id: 'golos' }), 'alice');
  for (const chainId of ['golos', 'viz', 'steem', 'hive', 'minter', 'decimal']) {
    assert(context.DposAuth.getUsers({ id: chainId }).length > 0, `${chainId} records migrate into the vault`);
  }
  assert.strictEqual(context.DposAuth.getUsers({ id: 'golos' })[1].type, 'golos.app', 'OAuth metadata migrates without being treated as a local secret');
  assert.strictEqual(context.DposAuth.getUsers({ id: 'decimal' })[0].importFrom, 'minter', 'current-user-only imported seed is promoted and preserves source link');
  assert.strictEqual(context.DposBroadcast.decryptLegacyKey({ id: 'golos' }, context.DposAuth.getCurrentUser({ id: 'golos' }), 'posting').privateKey, TEST_WIF, 'SJCL compatibility shape exists in memory');

  function assertMigratedSigningMaterial(restored) {
    for (const [chainId, login, roles] of [
      ['golos', 'alice', ['posting', 'active']],
      ['viz', 'viz-local', ['regular', 'active']],
      ['hive', 'hive-user', ['posting', 'active']],
      ['steem', 'steem-user', ['posting', 'active']]
    ]) {
      const user = restored.DposAuth.getUsers({ id: chainId }).find(row => row.login === login);
      assert(user, `${chainId} local key account survives`);
      for (const role of roles) assert(restored.DposBroadcast.decryptLegacyKey({ id: chainId }, user, role).privateKey === TEST_WIF, `${chainId}/${role} signing material remains exact`);
    }
    for (const [chainId, login, originalCipher] of [['minter', 'minter-user', minterSeed], ['decimal', 'wallet-one', seedCipher]]) {
      const user = restored.DposAuth.getUsers({ id: chainId }).find(row => row.login === login);
      const expectedSeed = context.sjcl.decrypt(legacyKey('minter', login, 'seed'), originalCipher);
      assert(restored.DposBroadcast.decryptLegacyKey({ id: chainId }, user, 'seed').privateKey === expectedSeed, `${chainId} seed/source-chain compatibility remains exact`);
    }
    assert.strictEqual(restored.DposAuth.getUsers({ id: 'viz' }).find(row => row.login === 'viz-local').memo_key, 'public-memo-key-fixture');
  }
  assertMigratedSigningMaterial(context);
  const allChainReload = makeContext(map);
  await allChainReload.DposVault.unlock({ password: PASSWORD });
  assertMigratedSigningMaterial(allChainReload);

  context.DposVault.lock();
  assert.throws(() => context.DposAuth.getUsers({ id: 'golos' }), /заблокирован/i, 'sync reads fail closed while active vault is locked');
  await assert.rejects(() => context.DposVault.unlock({ password: 'wrong password' }), /парол|расшифр|vault/i);
  assert.strictEqual(context.DposVault.status().state, 'locked');
  await context.DposVault.unlock({ password: PASSWORD });

  const newUser = context.DposAuth.createKeyUser({ id: 'golos' }, 'bob', { posting: TEST_WIF });
  await context.DposAuth.saveUser({ id: 'golos' }, newUser);
  assert.strictEqual(context.DposAuth.getCurrentLogin({ id: 'golos' }), 'bob');
  assert.strictEqual(map.has('golos_users'), false, 'vault mutator never rewrites legacy localStorage');

  const prepared = context.DposBroadcast.prepare({ id: 'golos' }, 'posting', 'transfer', ['bob', 'carol', '1.000 GOLOS', '']);
  await context.DposAuth.removeUser({ id: 'golos' }, 'bob', 'standard');
  assert.throws(() => prepared.getPrivateKey(), /измен|удал|заблокирован/i, 'prepared closure is revoked after account removal');

  const restartMap = new Map(map);
  restartMap.set('golos_users', originalGolosUsers);
  const restarted = makeContext(restartMap);
  assert.strictEqual(restarted.DposVault.status().state, 'locked', 'restart prefers verified active vault over interrupted cleanup remnants');
  await restarted.DposVault.unlock({ password: PASSWORD });
  assert.strictEqual(restartMap.has('golos_users'), false, 'unlock removes only an exact captured interrupted-cleanup remnant');

  const concurrentLegacyMap = new Map(map);
  concurrentLegacyMap.set('golos_users', JSON.stringify([{ login: 'new-concurrent-record', posting: legacyCipher }]));
  const concurrentLegacy = makeContext(concurrentLegacyMap);
  await concurrentLegacy.DposVault.unlock({ password: PASSWORD });
  assert.strictEqual(concurrentLegacyMap.has('golos_users'), true, 'unlock never deletes a changed/new legacy record not verified by the migration snapshot');

  const autoPrepared = restarted.DposBroadcast.prepare({ id: 'golos' }, 'posting', 'vote', [], { feature: 'golos-auto-upvoter' });
  const directPrepared = restarted.DposBroadcast.prepareWithPrivateKey({ id: 'golos' }, 'alice', 'posting', TEST_WIF, 'transfer', []);
  restarted.DposVault.lock();
  assert.throws(() => autoPrepared.getPrivateKey(), /заблокирован|отозван|измен/i, 'lock revokes auto-operation prepared keys');
  assert.throws(() => directPrepared.getPrivateKey(), /заблокирован|отозван|измен/i, 'lock revokes prepareWithPrivateKey closures too');
  assert.throws(() => restarted.DposBroadcast.prepareWithPrivateKey({ id: 'golos' }, 'alice', 'posting', TEST_WIF, 'transfer', []), /заблокирован/i, 'locked active vault rejects new direct-key preparation');

  const tabA = makeContext(map);
  const tabB = makeContext(map);
  await tabA.DposVault.unlock({ password: PASSWORD });
  await tabB.DposVault.unlock({ password: PASSWORD });
  await tabA.DposVault.mutate((records) => { records.golos_current_user = null; });
  await assert.rejects(() => tabB.DposVault.mutate((records) => { records.viz_current_user = null; }), /другой вклад|устарел/i, 'stale cross-tab write is rejected');

  const envelope = JSON.parse(map.get(context.DposVault.storageKeys.active));
  envelope.ciphertext = `${envelope.ciphertext.slice(0, -2)}AA`;
  map.set(context.DposVault.storageKeys.active, JSON.stringify(envelope));
  const tampered = makeContext(map);
  await assert.rejects(() => tampered.DposVault.unlock({ password: PASSWORD }), /поврежден|расшифр|vault/i, 'AES-GCM tamper fails closed');

  const quotaMap = new Map();
  const quotaContext = makeContext(quotaMap, { failSet: (key) => key === 'dpos_vault_v1' });
  quotaMap.set('golos_users', JSON.stringify([{ login: 'safe', posting: quotaContext.sjcl.encrypt(legacyKey('golos', 'safe', 'posting'), TEST_WIF) }]));
  await assert.rejects(() => quotaContext.DposVault.migrate({ password: PASSWORD }), /сохран|актив|quota|хранилищ/i);
  assert(quotaMap.has('golos_users'), 'quota failure leaves legacy source intact');
  assert.strictEqual(quotaMap.has(quotaContext.DposVault.storageKeys.active), false, 'quota failure does not activate partial vault');

  const racingMap = new Map();
  let injected = false;
  const racingContext = makeContext(racingMap, { afterSet(key, value, target) {
    if (key === 'dpos_vault_v1_staging' && !injected) {
      injected = true;
      target.set('golos_users', JSON.stringify([{ login: 'new-tab-user', posting: 'new-unverified-record' }]));
    }
  } });
  racingMap.set('golos_users', JSON.stringify([{ login: 'old-user', posting: racingContext.sjcl.encrypt(legacyKey('golos', 'old-user', 'posting'), TEST_WIF) }]));
  await assert.rejects(() => racingContext.DposVault.migrate({ password: PASSWORD }), /другой вклад|изменены|активация/i);
  assert.strictEqual(racingMap.has(racingContext.DposVault.storageKeys.active), false, 'concurrent legacy change aborts before active commit');
  assert.strictEqual(JSON.parse(racingMap.get('golos_users'))[0].login, 'new-tab-user', 'concurrent legacy record is never deleted');

  const inFlight = makeContext();
  await inFlight.DposVault.setup({ password: PASSWORD });
  inFlight.DposVault.lock();
  const attempt = inFlight.DposVault.unlock({ password: PASSWORD });
  inFlight.DposVault.lock();
  await assert.rejects(attempt, /отмен|измен|заблокирован/i);
  assert.strictEqual(inFlight.DposVault.status().state, 'locked');
  const shared = new Map();
  const tabs = [makeContext(shared), makeContext(shared)];
  const setupResults = await Promise.allSettled(tabs.map((tab, index) => tab.DposVault.setup({ password: PASSWORD + index })));
  assert.strictEqual(setupResults.filter(result => result.status === 'fulfilled').length, 1, 'only one tab may activate a vault');
  const winner = setupResults.findIndex(result => result.status === 'fulfilled');
  const restored = makeContext(shared);
  await restored.DposVault.unlock({ password: PASSWORD + winner });
  assert.strictEqual(restored.DposVault.status().state, 'unlocked');
  const corruptMap = new Map();
  const corruptLegacy = makeContext(corruptMap);
  const goodUser = corruptLegacy.DposAuth.createKeyUser({ id: 'golos' }, 'retain-me', { posting: TEST_WIF, active: TEST_WIF });
  corruptMap.set('golos_users', JSON.stringify([goodUser]));
  corruptMap.set('golos_current_user', JSON.stringify(goodUser));
  corruptMap.set('viz_users', JSON.stringify([{ login: 'unreadable', regular: 'invalid-sjcl-ciphertext' }]));
  const preservedSource = Array.from(corruptMap.entries());
  await assert.rejects(() => corruptLegacy.DposVault.migrate({ password: PASSWORD }), /расшифр|поврежд|legacy/i);
  assert.deepStrictEqual(Array.from(corruptMap.entries()), preservedSource, 'one corrupt record aborts migration without dropping any other chain or active selection');
  assert.strictEqual(corruptLegacy.DposVault.status().state, 'legacy');
  console.log('v3 vault password/migration behavioral tests passed');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
