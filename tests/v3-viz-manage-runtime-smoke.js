const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const appSource = fs.readFileSync(path.join(root, 'v3/js/app.js'), 'utf8');

const startMarker = '  function manageWitnessSigningKeyStorageKey(chain) {';
const endMarker = '  async function resolveManageWitnessUrl(chain, typedUrl) {';
const start = appSource.indexOf(startMarker);
const end = appSource.indexOf(endMarker, start);
assert(start !== -1 && end !== -1, 'manage signing-key helper slice is present');
const helperSlice = appSource.slice(start, end);

function createElement(initial = {}) {
  return {
    innerHTML: '',
    value: '',
    attributes: {},
    dataset: {},
    ...initial,
    setAttribute(name, value) {
      this.attributes[name] = String(value);
    },
    getAttribute(name) {
      return this.attributes[name];
    }
  };
}

const elements = {
  'manage-witness-key-history': createElement(),
  'manage-witness-saved-key-hint': createElement(),
  'manage-witness-key': createElement()
};

const storage = new Map();
const context = {
  console,
  JSON,
  String,
  Array,
  Boolean,
  localStorage: {
    getItem(key) {
      return storage.has(key) ? storage.get(key) : null;
    },
    setItem(key, value) {
      storage.set(key, String(value));
    },
    removeItem(key) {
      storage.delete(key);
    }
  },
  document: {
    getElementById(id) {
      return elements[id] || null;
    }
  },
  auth: {
    getCurrentLogin(chain) {
      assert.strictEqual(chain.id, 'viz');
      return 'denis';
    }
  },
  broadcast: {
    isLikelyWif(value) {
      return /^5[HJK]/.test(String(value || ''));
    }
  },
  manageDeactivateSigningKey(chain) {
    assert.strictEqual(chain.id, 'viz');
    return 'VIZ1111111111111111111111111111111114T1Anm';
  },
  manageNullSigningKey(chain) {
    assert.strictEqual(chain.id, 'viz');
    return 'VIZ1111111111111111111111111111111114T1Anm';
  },
  escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
};
context.global = context;
context.window = context;

vm.createContext(context);
vm.runInContext(`${helperSlice}\nthis.__test = { manageWitnessSigningKeyStorageKey, readManageWitnessSigningKeys, rememberManageWitnessSigningKey, renderManageWitnessSigningKeyHistory, rememberManageWitnessSigningKeyFromInput };`, context, { filename: 'v3/js/app.js#manage-key-slice' });

const chain = { id: 'viz' };
const publicKey = 'VIZ8ActivationPublicKey111111111111111111111111111111';

assert.strictEqual(context.__test.manageWitnessSigningKeyStorageKey(chain), 'viz_denis_witness_signing_keys');

// Directly exercise the real reader against the stored JSON array. This is the refresh path.
storage.set('viz_denis_witness_signing_keys', JSON.stringify([publicKey]));
assert.deepStrictEqual(context.__test.readManageWitnessSigningKeys(chain), [publicKey], 'stored JSON arrays are read back after refresh');
context.__test.renderManageWitnessSigningKeyHistory(chain);
assert(elements['manage-witness-saved-key-hint'].innerHTML.includes('data-witness-saved-key'), 'refresh render exposes a saved-key button');
assert(!elements['manage-witness-saved-key-hint'].innerHTML.includes('Сохранённого ключа пока нет'), 'refresh render does not show empty-history text when storage contains a key');
assert.strictEqual(elements['manage-witness-key'].value, publicKey, 'single saved key is auto-filled after refresh when the field is empty');

// Exercise the activation-click persistence path through the input helper.
storage.clear();
elements['manage-witness-key'].value = publicKey;
assert.strictEqual(context.__test.rememberManageWitnessSigningKeyFromInput(chain), true, 'activation input helper stores a reusable public key');
assert.deepStrictEqual(JSON.parse(storage.get('viz_denis_witness_signing_keys')), [publicKey], 'activation helper stores the public key as a JSON array');

// Safety: null/deactivation key and WIF-like private keys are not stored.
elements['manage-witness-key'].value = 'VIZ1111111111111111111111111111111114T1Anm';
assert.strictEqual(context.__test.rememberManageWitnessSigningKeyFromInput(chain), false, 'null/deactivation key is not stored');
elements['manage-witness-key'].value = '5HueCGU8rMjxEXxiPuD5BDuRa8TQ6J7v7x6mVTkK5hL3wK';
assert.strictEqual(context.__test.rememberManageWitnessSigningKeyFromInput(chain), false, 'WIF-like private key is not stored');
assert.deepStrictEqual(JSON.parse(storage.get('viz_denis_witness_signing_keys')), [publicKey], 'unsafe values do not replace the saved public key');

console.log('v3 VIZ manage runtime smoke passed');
