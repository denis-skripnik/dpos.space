const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const KEY = 'dpos_notifications_v1';
function fixture(id, legacy) {
  const data = new Map();
  if (legacy) data.set(KEY, JSON.stringify(legacy));
  let rows = [], fail = false;
  const chain = { id, title: id, explorerBase: 'https://example.invalid', apiBase: 'https://example.invalid' };
  const context = { console, URLSearchParams, Set, Map, Date,
    localStorage: { getItem: k => data.get(k) || null, setItem(k, v) { if (fail) throw new Error('quota'); data.set(k, v); } },
    fetch: async () => ({ ok: true, json: async () => ({ data: rows }) }),
    DposProfiles: { connect: async config => ({ config }) }
  };
  context.window = context;
  vm.createContext(context);
  for (const file of ['history', 'notifications']) vm.runInContext(fs.readFileSync(`v3/js/${file}.js`, 'utf8'), context);
  const tx = hash => ({ hash, type: 'send', timestamp: '2026-09-19T10:00:00Z', data: { from: 'sender', to: 'target', amount: '1', coin: 'TEST' } });
  return { context, chain, tx, data, rows: value => { rows = value; }, fail: value => { fail = value; }, scan: opts => context.DposNotifications.scanAccount(chain, 'target', opts), store: () => JSON.parse(data.get(KEY)) };
}
(async () => {
  for (const id of ['minter', 'decimal']) {
    const f = fixture(id);
    f.rows([f.tx('old-b'), f.tx('old-a')]);
    assert.strictEqual((await f.scan()).length, 0, 'first scan establishes a quiet baseline');
    f.rows([f.tx('new-c'), f.tx('old-b')]);
    const first = await f.scan();
    assert.strictEqual(first.length, 1, 'new tx at position zero is detected even when page length is unchanged');
    const notificationId = first[0].id;
    f.rows([f.tx('old-b'), f.tx('new-c'), f.tx('new-c')]);
    assert.strictEqual((await f.scan()).length, 0, 'reordering/duplicate rows do not create duplicate notifications');
    f.context.DposNotifications.markAllRead();
    f.rows([f.tx('new-d'), f.tx('new-c')]);
    f.fail(true);
    await assert.rejects(f.scan(), /quota/);
    f.fail(false);
    assert.strictEqual((await f.scan()).length, 1, 'failed storage commit does not advance cursor');
    assert.strictEqual(f.store().notifications.find(n => n.id === notificationId).read, true);
    const restored = fixture(id, f.store());
    restored.rows([restored.tx('new-d'), restored.tx('new-c')]);
    assert.strictEqual((await restored.scan()).length, 0, 'seen identities survive reload');
    const legacy = fixture(id, { accounts: { [`${id}:target`]: { cursor: 59 } }, notifications: [{ id: 'old-record', read: true }], settings: {} });
    legacy.rows([legacy.tx('legacy-a'), legacy.tx('legacy-b')]);
    assert.strictEqual((await legacy.scan({ collectInitial: true })).length, 0, 'old numeric cursor migrates without a historical notification flood');
    legacy.rows([legacy.tx('fresh'), legacy.tx('legacy-a')]);
    assert.strictEqual((await legacy.scan()).length, 1);
    assert(legacy.store().notifications.some(n => n.id === 'old-record'), 'migration preserves existing notifications');
    const initial = fixture(id);
    initial.rows([initial.tx('one'), initial.tx('one')]);
    assert.strictEqual((await initial.scan({ collectInitial: true })).length, 1);
    const noId = fixture(id);
    noId.rows([{ type: 'send', data: { from: 'sender', to: 'target', amount: '1' } }]);
    assert.strictEqual((await noId.scan({ collectInitial: true })).length, 0, 'an array position is never treated as transaction identity');
    const numeric = fixture(id);
    numeric.rows([{ ...numeric.tx(undefined), id: 0 }]);
    assert.strictEqual((await numeric.scan({ collectInitial: true })).length, 1, 'stable numeric id zero is retained');
  }
  console.log('REST notification identity, migration, deduplication and atomic commit regressions passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
