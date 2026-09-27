const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const notificationsSource = fs.readFileSync(path.join(root, 'v3/js/notifications.js'), 'utf8');
const appSource = fs.readFileSync(path.join(root, 'v3/js/app.js'), 'utf8');

function element() {
  return {
    innerHTML: '', textContent: '', value: '', disabled: false, hidden: false,
    dataset: {}, style: {}, options: [],
    addEventListener() {}, setAttribute() {}, removeAttribute() {}, appendChild() {},
    querySelector: () => null, querySelectorAll: () => [], closest: () => null,
    hasAttribute: () => false
  };
}

const storage = new Map();
const calls = [];
const elements = new Map();
const get = id => elements.has(id) ? elements.get(id) : (elements.set(id, element()), elements.get(id));
const context = {
  console, URLSearchParams, Blob, FormData: class { get() { return null; } getAll() { return []; } }, setTimeout, clearTimeout,
  location: { hash: '#chain=golos&app=notifications&account=alice', origin: 'https://dpos.test', hostname: 'dpos.test', pathname: '/' },
  navigator: {},
  localStorage: {
    get length() { return storage.size; }, key: index => Array.from(storage.keys())[index] || null,
    getItem: key => storage.has(key) ? storage.get(key) : null,
    setItem: (key, value) => storage.set(key, String(value)), removeItem: key => storage.delete(key)
  },
  addEventListener() {},
  document: { getElementById: get, querySelector: () => null, querySelectorAll: () => [], createElement: element, body: element(), head: element() },
  DposChains: { golos: { id: 'golos', title: 'Golos', apps: [{ id: 'notifications', title: 'Notifications' }], defaultAccount: '' } },
  DposAuth: { getUsers: () => [], getCurrentUser: () => null, getCurrentLogin: () => '', getUserLogin: () => '', getUserType: () => 'standard' },
  DposBroadcast: {}, DposProfiles: { formatError: error => error.message }, DposHistory: { formatDate: value => value },
  DposNative: {
    available: () => true, needsUpdate: () => false,
    request: async (method, payload) => { calls.push({ method, payload }); return { ok: true }; }
  }
};
context.window = context; context.globalThis = context;
vm.createContext(context);
vm.runInContext(notificationsSource, context, { filename: 'v3/js/notifications.js' });
context.DposNotifications = context.DposNotifications;
vm.runInContext(appSource, context, { filename: 'v3/js/app.js' });

(async () => {
  const chain = context.DposChains.golos;
  const api = context.DposNotifications;
  const lifecycle = context.DposV3.notificationConsent;

  const fresh = api.getSettings(chain, 'alice');
  assert.strictEqual(fresh.configured, false, 'an account with no saved notification settings is unconfigured');
  assert.strictEqual(fresh.androidNative, false, 'an unconfigured account does not default to native Android consent');
  assert.strictEqual(lifecycle.shouldSyncOnVisit(fresh), false, 'merely visiting an unconfigured account cannot sync native notifications');
  const browserOnly = api.saveSettings(chain, 'browser-only', { ops: ['transfer'] });
  assert.strictEqual(browserOnly.androidNative, false, 'saving browser filters without an explicit native opt-in cannot grant native consent');

  api.saveSettings(chain, 'alice', { ops: [], androidNative: true, intervalMinutes: 20 });
  const enabled = api.getSettings(chain, 'alice');
  assert.strictEqual(enabled.configured, true);
  assert.strictEqual(enabled.ops.length, 0, 'an explicitly empty filter list is preserved');
  assert.strictEqual(lifecycle.shouldSyncOnVisit(enabled), true, 'a previously saved native opt-in may sync on visit');

  calls.length = 0;
  await lifecycle.sync(chain, 'alice', enabled, { checkNow: false, isCurrent: () => true });
  assert.deepStrictEqual(calls.map(call => call.method), ['importWorkerSettings', 'startWorker'], 'route-open sync does not force a history check');
  assert.deepStrictEqual(Array.from(calls[0].payload.notificationOps), [], 'native sync preserves an explicitly empty filter list');

  calls.length = 0;
  await lifecycle.sync(chain, 'alice', enabled, { checkNow: true, isCurrent: () => true });
  assert.deepStrictEqual(calls.map(call => call.method), ['importWorkerSettings', 'startWorker', 'checkNow'], 'one explicit checked save enables and checks once');

  const disabled = api.saveSettings(chain, 'alice', { ops: api.defaultOps(chain), androidNative: false, intervalMinutes: 15 });
  calls.length = 0;
  await lifecycle.sync(chain, 'alice', disabled, { checkNow: true, isCurrent: () => true });
  assert.deepStrictEqual(calls.map(call => call.method), ['importWorkerSettings'], 'an unchecked save sends a native disable without starting or checking the worker');
  assert.strictEqual(calls[0].payload.enableNotifications, false);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(calls[0].payload, 'enableAutoUpvoter'), false, 'notification disable does not request an auto-upvoter state change');

  calls.length = 0;
  let current = true;
  context.DposNative.request = async (method, payload) => { calls.push({ method, payload }); current = false; return { ok: true }; };
  await lifecycle.sync(chain, 'alice', enabled, { checkNow: true, isCurrent: () => current });
  assert.deepStrictEqual(calls.map(call => call.method), ['importWorkerSettings'], 'a stale route stops follow-up worker mutations');

  for (const chainId of ['golos', 'viz', 'hive', 'steem', 'minter', 'decimal']) {
    assert.strictEqual(lifecycle.supportsNativeChain(chainId), true, `${chainId} keeps native notification lifecycle support`);
  }
  console.log('v3 notification consent lifecycle behavioral tests passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
