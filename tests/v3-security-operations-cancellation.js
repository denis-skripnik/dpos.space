const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const helper = require('../v3/js/auto-upvoter.js');

function deferred() { let resolve; const promise = new Promise((done) => { resolve = done; }); return { promise, resolve }; }

(async () => {
  const voteGate = deferred();
  let cancelled = false;
  const preparedKinds = [];
  const broadcasts = [];
  global.DposAuth = { getUsers: () => [{ login: 'alice' }], getUserLogin: (user) => user.login };
  global.DposBroadcast = {
    prepareForUser(_chain, _user, _role, method) { preparedKinds.push(method); return { method }; },
    async broadcast(_chain, prepared) { broadcasts.push(prepared.method); if (prepared.method === 'vote') await voteGate.promise; return { ok: true }; }
  };
  global.golos = { broadcast: { vote() {}, donate() {} } };
  const action = { type: 'vote', account: 'alice', author: 'bob', permlink: 'post', weight: 10000, source: 'test', donate: { enabled: true, amount: 1 } };
  const running = helper.broadcastPlannedAction({ id: 'golos', libraryGlobal: 'golos' }, action, { isCancelled: () => cancelled });
  await Promise.resolve();
  cancelled = true;
  voteGate.resolve();
  const result = await running;
  assert.strictEqual(result.cancelled, true, 'cancellation after the vote await is reported');
  assert.deepStrictEqual(preparedKinds, ['vote'], 'no donation is signed after cancellation');
  assert.deepStrictEqual(broadcasts, ['vote'], 'no donation is broadcast after cancellation');

  cancelled = false;
  let calls = 0;
  const rows = await helper.executePlannedActions({}, [action, Object.assign({}, action, { permlink: 'second' })], {}, {
    isCancelled: () => cancelled,
    broadcaster: async () => { calls += 1; cancelled = true; return { ok: true }; }
  });
  assert.strictEqual(calls, 1, 'cancellation is checked between planned actions');
  assert.strictEqual(rows.length, 1, 'cancelled execution does not start later actions');

  const first = deferred();
  let runCount = 0;
  const singleFlight = helper.createNonOverlappingRunner(async () => { runCount += 1; await first.promise; return runCount; });
  const one = singleFlight();
  const two = singleFlight();
  assert.strictEqual(runCount, 1, 'periodic runner does not overlap an active scan');
  assert.strictEqual(await two, null, 'overlapping periodic invocation is skipped');
  first.resolve();
  await one;

  const token = helper.createCancellationController();
  const before = token.snapshot();
  token.cancel();
  assert.strictEqual(token.isCancelled(before), true, 'Stop-style cancellation revokes an existing run synchronously');

  const listeners = {};
  const context = {
    console, URLSearchParams, TextEncoder, TextDecoder, Blob, setTimeout, clearTimeout, setInterval, clearInterval,
    location: { hash: '#chain=golos&app=help', origin: 'https://example.test', hostname: 'example.test', pathname: '/' },
    addEventListener(name, callback) { listeners[name] = callback; }, confirm: () => true,
    localStorage: { getItem: () => null, setItem() {}, removeItem() {}, key: () => null, length: 0 }, navigator: {}, FormData: class {},
    document: { getElementById: () => ({ dataset: {}, value: '', disabled: false, addEventListener() {}, closest: () => null, querySelector: () => null, querySelectorAll: () => [], appendChild() {}, setAttribute() {}, removeAttribute() {} }), querySelector: () => null, createElement: () => ({ click() {}, remove() {}, appendChild() {}, setAttribute() {} }), body: { appendChild() {} }, head: { appendChild() {} } },
    DposChains: { golos: { id: 'golos', title: 'Golos', apps: [{ id: 'help', title: 'Help' }], defaultAccount: '' } },
    DposAuth: { getUsers: () => [], getCurrentUser: () => null, getCurrentLogin: () => '', getUserLogin: () => '', getUserType: () => 'standard' },
    DposBroadcast: {}, DposProfiles: { formatError: (error) => error.message }, DposHistory: {}, DposNotifications: null, DposGolosAutoUpvoter: helper
  };
  context.globalThis = context; context.window = context; vm.createContext(context);
  vm.runInContext(fs.readFileSync('v3/js/app.js', 'utf8'), context, { filename: 'v3/js/app.js' });
  const appOps = context.DposV3.securityOperations;
  const adapterGate = deferred();
  let afterAdapter = 0;
  const runtime = { running: true, cancelGeneration: 1, scanPromise: null, scannerInterval: null, runnerLock: null };
  context.__dposAutoUpvoterRuntimes = { golos: runtime };
  const scan = appOps.runBrowserAutomationSingleFlight(runtime, 'scanPromise', 1, () => adapterGate.promise, async () => { afterAdapter += 1; });
  const stopped = appOps.cancelAllBrowserAutomation('test Stop');
  adapterGate.resolve({ rpc: true });
  await stopped;
  assert.strictEqual(await scan, null, 'an adapter resolving after Stop does not continue the scan');
  assert.strictEqual(afterAdapter, 0, 'actual app runner checks cancellation immediately after awaiting its adapter');
  assert.strictEqual(runtime.running, false, 'app-level Stop marks browser automation stopped synchronously');
  assert.strictEqual(typeof listeners['dpos-vault-lock'], 'function', 'vault lock event hook is installed');
  runtime.running = true;
  runtime.cancelGeneration += 1;
  const restarted = await appOps.runBrowserAutomationSingleFlight(runtime, 'scanPromise', runtime.cancelGeneration, async () => ({}), async () => { afterAdapter += 1; return 'restarted'; });
  assert.strictEqual(restarted, 'restarted', 'restart begins only after the cancelled scan settles');
  listeners['dpos-vault-lock']({ type: 'dpos-vault-lock' });
  assert.strictEqual(runtime.running, false, 'vault lock event synchronously cancels restarted browser automation');
  console.log('v3 security automation cancellation passed');
})().catch((error) => { console.error(error); process.exit(1); });
