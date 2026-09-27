const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const appSource = fs.readFileSync(path.join(root, 'v3/js/app.js'), 'utf8');

function fakeElement() {
  return {
    innerHTML: '', textContent: '', value: '', disabled: false, hidden: false,
    dataset: {}, style: {},
    addEventListener() {}, setAttribute() {}, removeAttribute() {}, appendChild() {},
    querySelector: () => null, querySelectorAll: () => [], closest: () => null,
    hasAttribute: () => false
  };
}

function makeContext(initial = {}) {
  const values = new Map(Object.entries(initial));
  const context = {
    console, URLSearchParams, Blob,
    location: { hash: '', origin: 'https://dpos.test', hostname: 'dpos.test', pathname: '/' },
    navigator: {},
    localStorage: {
      get length() { return values.size; },
      key(index) { return Array.from(values.keys())[index] || null; },
      getItem(key) { return values.has(key) ? values.get(key) : null; },
      setItem(key, value) { values.set(key, String(value)); },
      removeItem(key) { values.delete(key); }
    },
    addEventListener() {},
    document: {
      getElementById: () => fakeElement(),
      querySelector: () => null,
      createElement: () => Object.assign(fakeElement(), { click() {}, remove() {} }),
      body: fakeElement(), head: fakeElement()
    },
    DposChains: {
      golos: { id: 'golos', title: 'Golos', apps: [{ id: 'profiles', title: 'Профиль' }], defaultAccount: '' }
    },
    DposAuth: { getUsers: () => [], getCurrentUser: () => null, getCurrentLogin: () => '', getUserLogin: user => user && user.login || '', getUserType: () => 'standard' },
    DposBroadcast: {}, DposProfiles: { formatError: error => error.message }, DposHistory: {}, DposNotifications: null
  };
  context.window = context;
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(appSource, context, { filename: 'v3/js/app.js' });
  return { context, values };
}

const key = 'dpos_golos_auto_upvoter_settings';
const legacy = {
  accounts: {
    zero: { minEnergy: '0' },
    low: { minEnergy: '0.01' },
    one: { minEnergy: '1' },
    hundred: { minEnergy: '100' },
    basisPointBoundary: { minEnergy: '101' },
    quarter: { minEnergy: '2500' },
    full: { minEnergy: '10000' }
  },
  autoStart: true
};
const { context, values } = makeContext({ [key]: JSON.stringify(legacy) });
const api = context.DposV3.autoUpvoterSettings;
assert(api, 'auto-upvoter settings behavior is exposed for regression coverage');

const migrated = api.read({ id: 'golos' });
const expected = { zero: '0', low: '0.01', one: '1', hundred: '100', basisPointBoundary: '1.01', quarter: '25', full: '100' };
for (const [account, percent] of Object.entries(expected)) {
  assert.strictEqual(migrated.accounts[account].minEnergy, percent, `${account}: legacy threshold keeps its effective meaning as percent`);
}
const persistedMigration = JSON.parse(values.get(key));
assert.strictEqual(persistedMigration.schemaVersion, 2, 'legacy settings are migrated once with a schema marker');
assert.strictEqual(persistedMigration.minEnergyUnit, 'percent', 'migrated settings declare the browser-facing unit');
assert.strictEqual(persistedMigration.accounts.quarter.minEnergy, '25', 'migration is written back in percent form');
assert.strictEqual(api.read({ id: 'golos' }).accounts.basisPointBoundary.minEnergy, '1.01', 'schema-marked values are not converted a second time');

api.write({ id: 'golos' }, [
  { account: 'zero', enabled: true, minEnergy: '0' },
  { account: 'tiny', enabled: true, minEnergy: '0.01' },
  { account: 'full', enabled: true, minEnergy: '100' }
], false);
const saved = JSON.parse(values.get(key));
assert.strictEqual(saved.accounts.zero.minEnergy, '0', 'zero does not fall back to the default threshold');
assert.strictEqual(saved.accounts.tiny.minEnergy, '0.01', 'low percent precision survives persistence');
assert.strictEqual(saved.accounts.full.minEnergy, '100', '100 percent survives persistence');
assert.strictEqual(api.percentToBasisPoints('0'), 0);
assert.strictEqual(api.percentToBasisPoints('0.01'), 1);
assert.strictEqual(api.percentToBasisPoints('1'), 100);
assert.strictEqual(api.percentToBasisPoints('100'), 10000);
assert.strictEqual(api.percentToBasisPoints('101'), 10000, 'out-of-range typed percent is clamped instead of being reinterpreted as basis points');
assert.strictEqual(api.percentToBasisPoints('-1'), 0, 'negative typed percent is clamped to zero');
assert.strictEqual(api.percentToBasisPoints(''), 2500, 'empty input retains the established 25 percent default');

assert(appSource.includes('Минимальная батарейка голоса, %'), 'browser label declares percent as the only input unit');
assert(/name="minEnergy" type="number" min="0" max="100" step="0\.01" value="25"/.test(appSource), 'browser input accepts only 0..100 percent, including low boundaries');
assert(!appSource.includes('% или шкала 0–10000'), 'ambiguous percent/basis-point UI copy is removed');
assert(appSource.includes("minEnergy: autoUpvoterEnergyPercent(card.querySelector('[name=\"minEnergy\"]').value, false)"), 'browser scanner settings are normalized strictly as percent');
assert(appSource.includes('minEnergy: autoUpvoterPercentToBasisPoints(row.minEnergy)'), 'native worker receives basis points despite the percent-only browser form');

console.log('Percent-only energy UI and persisted-threshold migration passed');
