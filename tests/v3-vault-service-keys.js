'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');
const { TextEncoder, TextDecoder } = require('node:util');
const root = path.resolve(__dirname, '..');
const password = 'synthetic voice vault fixture password';
const key = 'gsk_synthetic_nonsecret_voice_fixture_123456789';
const queues = new WeakMap();
function context(map = new Map(), hooks = {}) {
  const c = { crypto: webcrypto, TextEncoder, TextDecoder, console,
    location: { origin: 'https://dpos.test' }, addEventListener() {},
    navigator: { locks: { request(_name, action) {
      const p = (queues.get(map) || Promise.resolve()).then(action);
      queues.set(map, p.catch(() => undefined)); return p;
    } } },
    localStorage: {
      getItem: k => map.get(k) ?? null,
      setItem(k, v) { if (hooks.fail?.(k)) throw Error('fixture quota'); map.set(k, String(v)); },
      removeItem: k => map.delete(k)
    }
  };
  c.window = c;
  vm.createContext(c);
  for (const rel of ['v3/vendor/golos/sjcl.min.js', 'v3/js/vault.js'])
    vm.runInContext(fs.readFileSync(path.join(root, rel), 'utf8'), c, { filename: rel });
  return c;
}
(async () => {
  const map = new Map(), c = context(map), v = c.DposVault;
  assert.equal(typeof v.setServiceKey, 'function');
  await assert.rejects(() => v.setServiceKey('groq', key), /заблокирован|vault/i);
  await v.setup({ password });
  assert.equal(v.getServiceKey('groq'), '');
  const accounts = JSON.stringify(v.read());
  await v.setServiceKey('groq', key);
  assert.equal(v.getServiceKey('groq'), key);
  assert.equal(JSON.stringify(v.read()), accounts, 'generic account reads exclude API credentials');
  assert.equal(JSON.stringify(v.export()), accounts, 'legacy account export cannot leak an unwrapped service key');
  assert(![...map.values()].join('').includes(key), 'only authenticated ciphertext is durable');
  assert(!JSON.stringify(v.diagnosticSnapshot()).includes(key));
  for (const provider of ['__proto__', 'other', 'Groq']) {
    await assert.rejects(() => v.setServiceKey(provider, key), /сервис|service/i);
    assert.throws(() => v.getServiceKey(provider), /сервис|service/i);
  }
  for (const bad of ['', 'not-a-groq-key', key + '\r\nHeader: injected', key + ' ', 'gsk_' + 'x'.repeat(300)])
    await assert.rejects(() => v.setServiceKey('groq', bad), /ключ|key/i);
  await v.mutate(records => { records.golos_current_user = null; });
  assert.equal(v.getServiceKey('groq'), key, 'normal account mutation retains service secret');
  v.lock();
  assert.throws(() => v.getServiceKey('groq'), /заблокирован|vault/i);
  await v.unlock({ password });
  assert.equal(v.getServiceKey('groq'), key, 'unlock materialization retains service secret');
  await v.import(v.export());
  assert.equal(v.getServiceKey('groq'), key, 'account-only backup restore preserves unrelated device API key');
  const reopened = context(map);
  await reopened.DposVault.unlock({ password });
  assert.equal(reopened.DposVault.getServiceKey('groq'), key, 'reload recovers encrypted key');
  await reopened.DposVault.deleteServiceKey('groq');
  assert.equal(reopened.DposVault.getServiceKey('groq'), '');
  assert.equal(JSON.stringify(reopened.DposVault.read()), accounts, 'delete leaves accounts unchanged');
  assert.throws(() => v.getServiceKey('groq'), /вклад|устар|измен|заблокирован/i, 'stale tab cannot return deleted secret');
  const restart = context(map);
  await restart.DposVault.unlock({ password });
  assert.equal(restart.DposVault.getServiceKey('groq'), '', 'delete persists');
  let fail = false;
  const quotaMap = new Map(), q = context(quotaMap, { fail: () => fail });
  await q.DposVault.setup({ password });
  await q.DposVault.setServiceKey('groq', key);
  fail = true;
  await assert.rejects(() => q.DposVault.setServiceKey('groq', key + '2'), /сохран|quota|хранилищ/i);
  fail = false;
  q.DposVault.lock(); await q.DposVault.unlock({ password });
  assert.equal(q.DposVault.getServiceKey('groq'), key, 'failed write preserves prior usable ciphertext');
  console.log('PASS encrypted Groq service key: save/read/lock/reload/account mutation/import/delete/stale-tab/quota/privacy');
})().catch(e => { console.error(e); process.exitCode = 1; });
