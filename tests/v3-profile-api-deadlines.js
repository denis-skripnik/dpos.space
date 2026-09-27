const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const source = fs.readFileSync('v3/js/profiles.js', 'utf8');
function fixture(fetcher) {
  const timers = new Map(); let id = 0;
  const context = { console, AbortController, fetch: fetcher,
    setTimeout(fn, ms) { timers.set(++id, { fn, ms }); return id; },
    clearTimeout(key) { timers.delete(key); }
  };
  context.window = context;
  vm.createContext(context); vm.runInContext(source, context);
  return { api: context.DposProfiles, timers, tick(ms) {
    for (const [key, timer] of [...timers]) if (timer.ms <= ms) { timers.delete(key); timer.fn(); }
  } };
}
const flush = () => new Promise(resolve => setImmediate(resolve));
const chain = { config: { id: 'minter', explorerBase: 'https://fixture.invalid' } };
const address = 'Mx' + '1'.repeat(40);
(async () => {
  const optionalSignals = [];
  const f = fixture(async (url, options) => {
    if (url === `https://fixture.invalid/addresses/${address}`) return { ok: true, json: async () => ({ data: { balance: [{ coin: 'BIP', amount: '12' }] } }) };
    optionalSignals.push(options && options.signal);
    return new Promise(() => {});
  });
  let account;
  const request = f.api.fetchAccount(chain, address).then(value => { account = value; });
  await flush();
  assert([...f.timers.values()].some(t => t.ms <= 2500), 'optional API calls have a short deadline');
  f.tick(2500); await request;
  assert.strictEqual(account.balances[0].amount, '12', 'required balance survives stalled optional services');
  assert(optionalSignals.every(signal => signal && signal.aborted), 'timed-out fetches are aborted');
  assert.strictEqual(f.timers.size, 0, 'settled requests leave no timer handles');

  const required = fixture(() => new Promise(() => {}));
  const failed = assert.rejects(required.api.fetchAccount(chain, address), /API|ожидания|timed/i);
  await flush(); required.tick(10000); await failed;
  assert.strictEqual(required.timers.size, 0);

  const rpc = fixture(() => { throw new Error('unused'); });
  const rejected = assert.rejects(rpc.api.apiCall({ client: { api: { getAccountsAsync: () => new Promise(() => {}) } } }, 'getAccounts', [[]]), /API|ожидания|timed/i);
  await flush(); assert(rpc.timers.size > 0, 'read RPC has a deadline too'); rpc.tick(10000); await rejected;
  console.log('Profile required/optional API deadlines and abort regressions passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
