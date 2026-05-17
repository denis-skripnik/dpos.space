const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const html = fs.readFileSync('index.html', 'utf8');
const appSource = fs.readFileSync('v3/js/app.js', 'utf8');

assert(html.includes('href="#app=backup"'), 'footer exposes internal backup route');
assert(html.includes('Резервное копирование'), 'footer labels backup route accessibly');
assert(appSource.includes("if (state.app === 'backup' && !state.chain)"), 'site backup route is app-scoped and does not intercept chain-specific backup pages');
assert(appSource.includes('renderDposBackupPage'), 'backup page renderer exists');
assert(appSource.includes('encrypted-localstorage-backup'), 'backup file format is encrypted only');
assert(appSource.includes("warning: 'DPoS Space support will never ask"), 'backup metadata warns against support/social-engineering requests');
assert(!appSource.includes('exportLocalStorage'), 'no global plaintext localStorage export helper exists');
assert(!appSource.includes('Незашифрован'), 'UI must not offer an unencrypted backup mode');

const storage = new Map([
  ['golos_users', '[]'],
  ['golos_current_user', '{"login":"denis"}'],
  ['golos_node', 'wss://example'],
  ['viz_denis_witness_signing_keys', '["VIZ"]'],
  ['viz_transfer_templates', '[]'],
  ['dpos_notifications_v1', '{}'],
  ['GOLOS_transfer_templates', '[]'],
  ['unrelated_analytics_key', 'secret']
]);

function fakeElement(extra = {}) {
  return Object.assign({
    innerHTML: '',
    textContent: '',
    value: '',
    disabled: false,
    hidden: false,
    dataset: {},
    style: {},
    addEventListener() {},
    setAttribute() {},
    removeAttribute() {},
    appendChild() {},
    querySelector: () => null,
    closest: () => fakeElement()
  }, extra);
}

const context = {
  console,
  URLSearchParams,
  TextEncoder,
  TextDecoder,
  btoa: (value) => Buffer.from(value, 'binary').toString('base64'),
  atob: (value) => Buffer.from(value, 'base64').toString('binary'),
  location: { hash: '#app=backup', origin: 'https://dpos.blinddev.xyz', pathname: '/' },
  addEventListener() {},
  crypto: { subtle: {} },
  localStorage: {
    get length() { return storage.size; },
    key(index) { return Array.from(storage.keys())[index] || null; },
    getItem(key) { return storage.has(key) ? storage.get(key) : null; },
    setItem(key, value) { storage.set(key, String(value)); },
    removeItem(key) { storage.delete(key); }
  },
  document: {
    getElementById(id) {
      if (id === 'status') return fakeElement({ dataset: {} });
      return fakeElement();
    },
    querySelector: () => null,
    createElement: () => fakeElement({ click() {}, remove() {} }),
    body: fakeElement(),
    head: fakeElement()
  },
  DposChains: {
    golos: { id: 'golos', title: 'Golos', apps: [{ id: 'profiles', title: 'Профиль' }], defaultAccount: '' },
    viz: { id: 'viz', title: 'VIZ', apps: [{ id: 'profiles', title: 'Профиль' }], defaultAccount: '' }
  },
  DposAuth: {
    getUsers: () => [],
    getCurrentUser: () => null,
    getCurrentLogin: () => '',
    getUserLogin: (user) => user && user.login || '',
    getUserType: () => 'standard'
  },
  DposBroadcast: {},
  DposProfiles: { formatError: (error) => error.message },
  DposHistory: {},
  DposNotifications: null
};
context.globalThis = context;
context.window = context;
vm.createContext(context);
vm.runInContext(appSource, context);

const backup = context.DposV3.backup;
assert(backup.validateBackupPassword('123456789012').ok === false, 'numeric backup password is rejected');
assert(backup.validateBackupPassword('Password123!').ok === false, 'common weak backup password is rejected');
assert(backup.validateBackupPassword('тихий лес mango river 47!').ok === true, 'long passphrase-style backup password is accepted');
const keys = backup.dposBackupStorageKeys();
assert(keys.includes('golos_users'), 'backup includes legacy auth users');
assert(keys.includes('viz_denis_witness_signing_keys'), 'backup includes saved witness keys');
assert(keys.includes('dpos_notifications_v1'), 'backup includes notification settings');
assert(!keys.includes('unrelated_analytics_key'), 'backup excludes unrelated localStorage keys');

console.log('v3 backup smoke: ok');
