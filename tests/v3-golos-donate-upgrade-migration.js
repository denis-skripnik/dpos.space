const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const source = fs.readFileSync(path.join(__dirname, '../v3/js/app.js'), 'utf8');
function element() { return { innerHTML: '', dataset: {}, style: {}, addEventListener() {}, setAttribute() {}, removeAttribute() {}, appendChild() {}, closest: () => null, querySelector: () => null, querySelectorAll: () => [], hasAttribute: () => false }; }
async function scenario(rows, users, unlocked = true, bridge = true) {
  const calls = [];
  const data = new Map([['dpos_golos_auto_upvoter_settings', JSON.stringify({ schemaVersion: 2, minEnergyUnit: 'percent', accounts: rows })]]);
  const context = {
    console, URLSearchParams, Blob, location: { hash: '', origin: 'https://dpos.test', hostname: 'dpos.test', pathname: '/' }, navigator: {},
    localStorage: { get length() { return data.size; }, key: i => Array.from(data.keys())[i], getItem: k => data.get(k) || null, setItem: (k,v) => data.set(k,String(v)), removeItem: k => data.delete(k) },
    addEventListener() {}, document: { getElementById: () => element(), querySelector: () => null, createElement: () => Object.assign(element(), { click() {}, remove() {} }), body: element(), head: element() },
    DposChains: { golos: { id: 'golos', title: 'Golos', apps: [{ id: 'profiles', title: 'Профиль' }] }, hive: { id: 'hive' } },
    DposAuth: { getUsers: chain => chain.id === 'golos' ? users.map(login => ({ login })) : [], getCurrentUser: () => null, getCurrentLogin: () => '', getUserLogin: user => user.login, getUserType: () => 'standard' },
    DposVault: { status: () => ({ state: unlocked ? 'unlocked' : 'locked' }) }, DposVaultUI: { guard: () => unlocked },
    DposNative: { available: () => bridge, needsUpdate: () => false, request: async (method, payload) => { calls.push([method, payload]); return { ok: true, migrated: true }; } },
    DposBroadcast: {}, DposProfiles: { formatError: error => error.message }, DposHistory: {}, DposNotifications: null
  };
  context.window = context; context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(source, context);
  await context.__dposGolosDonateMigration;
  return calls.map(([method, payload]) => [method, JSON.parse(JSON.stringify(payload))]);
}
(async () => {
  const rows = {
    alice: { enabled: true, autoDonate: true, autoDonateCap: '10 1.1' },
    disabled: { enabled: false, autoDonate: true, autoDonateCap: '10 1' },
    revoked: { enabled: true, autoDonate: false, autoDonateCap: '10 1' },
    invalid: { enabled: true, autoDonate: true, autoDonateCap: '101 1' },
    missing: { enabled: true, autoDonate: true },
    orphan: { enabled: true, autoDonate: true, autoDonateCap: '10 1' }
  };
  const users = ['alice', 'disabled', 'revoked', 'invalid', 'missing'];
  assert.deepStrictEqual(await scenario(rows, users), [['migrateGolosDonateSettings', { account: 'alice', pool: '10 1.1' }]]);
  assert.deepStrictEqual(await scenario(rows, users, false), []);
  assert.deepStrictEqual(await scenario(rows, users, true, false), []);
  console.log('Golos startup donation migration mock bridge selection passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
