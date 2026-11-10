/* Synthetic schema fixtures only; never website archive data. */
const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { createHash, webcrypto } = require('crypto');
const root = path.resolve(__dirname, '..');
const address = 'Mx' + '1'.repeat(40);
const amount = '9007199254740993.123456789012345678';
const captured_at = '2026-11-07T00:00:00.000Z';
const cutoff_at = '2026-11-10T11:00:00.000Z';
function fixture(state = 'preview') {
  const snapshot = { schema_version: 1, state, captured_at, cutoff_at,
    params: { max_amount: '13600', max_prize: '1360', cap_effective_days: '365' },
    providers: [{ rank: 1, address, liquidity: amount, invest_days: '1', bonus_invest_days: '0', multiply: '1', get_counter: '2', get_amount: amount, burned: '0', referer: '' }],
    locks: [], backend_cursor_height: '100',
    pool: { id: '683', lp_coin_id: '2783', coin0: { id: '0', symbol: 'BIP' }, coin1: { id: '2782', symbol: 'LONG' }, amount0: '123', amount1: '456', liquidity: '789', height: '101', block_hash: 'a'.repeat(64), block_time: captured_at, captured_at }
  };
  const tx = { kind: 'compensation', hash: 'Mt' + 'a'.repeat(64), height: '99', nonce: '1', sender: address, memo: '<script>fixture</script>', gas_coin_id: '2782', gas_price: '1', fee_coin_id: '2782', fee_amount_pip: '100', outputs: [{ to: address, coin_id: '2782', coin_symbol: 'LONG', amount }] };
  const payments = { schema_version: 1, state, compensation: [tx], final: state === 'final' ? [{ ...tx, kind: 'final', hash: 'Mt' + 'b'.repeat(64) }] : [] };
  const lotteries = { schema_version: 1, items: [{ date: '2026-10-31', path: 'loto/2026-10-31.txt' }] };
  const data = { 'snapshot.json': JSON.stringify(snapshot), 'payments.json': JSON.stringify(payments), 'lotteries.json': JSON.stringify(lotteries), 'loto/2026-10-31.txt': '<img src=x onerror=alert(1)> Приз: ' + amount };
  const manifest = { schema_version: 1, state, captured_at, cutoff_at, files: {}, counts: { providers: 1, lotteries: 1, payments: 1 + payments.final.length } };
  function seal() {
    for (const [name, text] of Object.entries(data)) {
      if (name === 'manifest.json') continue;
      const b = Buffer.from(text); manifest.files[name] = { bytes: b.length, sha256: createHash('sha256').update(b).digest('hex') };
    }
    data['manifest.json'] = JSON.stringify(manifest);
  }
  seal(); return { data, manifest, snapshot, payments, seal };
}
function harness(archive = fixture()) {
  const calls = [];
  const elements = new Map();
  function element(id) { if (!elements.has(id)) elements.set(id, { id, value: '', innerHTML: '', textContent: '', dataset: {}, closest: () => ({ setAttribute() {} }), setAttribute() {}, addEventListener() {}, querySelectorAll: () => [] }); return elements.get(id); }
  const c = { console, URL, URLSearchParams, TextDecoder, TextEncoder, AbortController, Uint8Array, crypto: webcrypto, setTimeout, clearTimeout, Intl,
    location: { hash: '#chain=minter&app=long' }, addEventListener() {},
    document: { getElementById: element, createElement: () => element('new'), head: { appendChild() {} } },
    DposAuth: { getCurrentLogin: () => '', getCurrentUser: () => null, getUsers: () => [], getUserLogin: () => '', getUserType: () => 'standard', selectUser: () => null },
    DposBroadcast: {}, DposProfiles: { formatError: (e) => e.message, load: () => { throw Error('profile prefetch'); } },
    DposHistory: { formatChainAmount: (_c, _k, v) => String(v), formatValue: String, formatDate: String, operationTitle: String },
    fetch: async (url) => {
      calls.push(url);
      assert(url.startsWith('/v3/data/long/'), `No live financial API: ${url}`);
      const name = url.slice('/v3/data/long/'.length);
      if (!Object.hasOwn(archive.data, name)) return { ok: false, status: 404 };
      const b = Buffer.from(archive.data[name]);
      return { ok: true, status: 200, arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) };
    }
  };
  c.window = c; vm.createContext(c);
  const run = (file) => vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), c, { filename: file });
  run('v3/js/chains.js'); run('v3/js/long-archive.js');
  return { c, calls, elements, run, archive };
}
(async () => {
  let h = harness();
  let result = await h.c.DposLongArchive.tryRender({ page: 'main' });
  assert(result.active && !result.error);
  assert(result.html.includes(amount));
  assert(result.html.includes('предварительный снимок') && result.html.includes('не финальный архив'));
  assert(result.html.includes('Учётная сумма сервиса, LONG'));
  assert(result.html.includes('Учётные показатели сервиса — не фактически выплаченные деньги'));
  assert(!result.html.includes('Будущий фарминг') && !result.html.includes('Бонус 50 дней'));
  assert(!result.html.includes('<script>fixture'));
  assert(result.html.includes('https://explorer.minter.network/transactions/Mt'));
  const savedManifest = h.archive.data['manifest.json'];
  delete h.archive.data['manifest.json'];
  result = await h.c.DposLongArchive.tryRender();
  assert(result.active && result.error, 'activation remains fail-closed if manifest disappears');
  h.archive.data['manifest.json'] = savedManifest;
  result = await h.c.DposLongArchive.tryRender({ page: 'lotto' });
  assert(result.html.includes('&lt;img src=x') && !result.html.includes('<img src=x'));
  assert(!result.html.includes('2026-10-30'));
  const before = h.calls.length;
  result = await h.c.DposLongArchive.tryRender({ page: 'loto', date: '../../evil<script>' });
  assert(result.html.includes('отсутствует') && !result.html.includes('evil'));
  assert(!h.calls.slice(before).some((u) => u.includes('evil')));
  result = await h.c.DposLongArchive.tryRender({ page: 'bids' });
  assert(result.html.includes('Ставки закрыты') && !result.html.includes('<form'));
  result = await h.c.DposLongArchive.tryRender({ page: 'deferred-txs' });
  assert(result.html.includes('Обязательства могут оставаться в ожидании'));
  h = harness(fixture('final'));
  result = await h.c.DposLongArchive.tryRender({ page: 'deferred-txs' });
  assert(!result.error && result.html.includes('очередь обычных наград перед снимком пуста') && result.html.includes('Mt' + 'b'.repeat(64)));
  for (const modify of [
    (f) => { f.data['manifest.json'] = '<html>static fallback</html>'; },
    (f) => { f.data['snapshot.json'] += ' '; },
    (f) => { f.manifest.files['../secret'] = { bytes: 0, sha256: 'a'.repeat(64) }; f.seal(); },
    (f) => { f.manifest.counts.providers = 2; f.seal(); },
    (f) => { f.manifest.files['snapshot.json'].bytes += 1; f.data['manifest.json'] = JSON.stringify(f.manifest); },
    (f) => { delete f.data['loto/2026-10-31.txt']; },
    (f) => { f.snapshot.providers[0].get_amount = 123; f.data['snapshot.json'] = JSON.stringify(f.snapshot); f.seal(); }
  ]) {
    const f = fixture(); modify(f); h = harness(f);
    result = await h.c.DposLongArchive.tryRender({ page: 'main' });
    assert(result.active && result.error && result.html.includes('Live финансовые API не используются'));
    assert(!h.calls.includes('/v3/data/long/../secret'));
  }
  h = harness({ data: {} });
  result = await h.c.DposLongArchive.tryRender(); assert.equal(result.active, false);
  h = harness(); h.c.fetch = async () => ({ ok: false, status: 500 });
  result = await h.c.DposLongArchive.tryRender(); assert(result.active && result.error);
  // Real router integration, all historical page aliases, and route-epoch fencing.
  h = harness(); h.run('v3/js/app.js');
  await h.c.DposV3.renderRoute();
  for (const hash of ['#chain=minter&app=long&longPage=bids', '#chain=minter&app=long&long_page=deferred-txs', '#chain=minter&app=long&longPage=lotto', '#chain=minter&app=long']) {
    h.c.location.hash = hash; await h.c.DposV3.renderRoute(); assert(h.elements.get('app').innerHTML.includes('предварительный снимок'));
  }
  const fetch = h.c.fetch;
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  h.c.fetch = async (...args) => { await gate; return fetch(...args); };
  const pending = h.c.DposV3.renderRoute();
  h.c.location.hash = '#chain=viz';
  await h.c.DposV3.renderRoute();
  const next = h.elements.get('app').innerHTML;
  release(); await pending;
  assert.equal(h.elements.get('app').innerHTML, next, 'late archive cannot repaint another chain');
  // Manifest re-publication during load must not mix versions.
  h = harness(); const originalFetch = h.c.fetch; let manifests = 0;
  h.c.fetch = async (url) => { if (url.endsWith('/manifest.json') && ++manifests === 2) h.archive.data['manifest.json'] += ' '; return originalFetch(url); };
  result = await h.c.DposLongArchive.tryRender(); assert(result.error && result.html.includes('manifest изменился'));
  console.log('PASS v3-long-archive: schema/hash/count/path/precision/preview/final/aliases/route fencing/fail-closed');
})().catch((e) => { console.error(e); process.exitCode = 1; });
