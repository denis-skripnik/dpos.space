const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const POSTING_WIF = '5BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB';
const ACTIVE_WIF = '5AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

function createLocalStorage() {
  const store = new Map();
  return {
    get length() { return store.size; },
    key(index) { return Array.from(store.keys())[index] || null; },
    getItem(key) { return store.has(key) ? store.get(key) : null; },
    setItem(key, value) { store.set(key, String(value)); },
    removeItem(key) { store.delete(key); }
  };
}

function createContext() {
  const context = {
    window: null,
    localStorage: createLocalStorage(),
    sjcl: {
      encrypt(passphrase, value) { return JSON.stringify({ passphrase, value }); },
      decrypt(passphrase, encrypted) {
        const parsed = JSON.parse(encrypted);
        if (parsed.passphrase !== passphrase) throw new Error('wrong passphrase');
        return parsed.value;
      }
    }
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(root, 'v3/js/auth.js'), 'utf8'), context, { filename: 'v3/js/auth.js' });
  return context;
}

const context = createContext();
const golos = { id: 'golos', title: 'Golos' };
const viz = { id: 'viz', title: 'VIZ' };
const minter = { id: 'minter', title: 'Minter' };
const decimal = { id: 'decimal', title: 'Decimal' };

const golosUser = context.DposAuth.createKeyUser(golos, 'alice', { posting: POSTING_WIF, active: ACTIVE_WIF });
context.DposAuth.saveUser(golos, golosUser);
assert.strictEqual(context.DposAuth.getCurrentLogin(golos), 'alice', 'new key account is selected');
assert.strictEqual(context.sjcl.decrypt('dpos.space_golos_alice_postingKey', golosUser.posting), POSTING_WIF, 'posting key uses legacy passphrase');
assert.strictEqual(context.sjcl.decrypt('dpos.space_golos_alice_activeKey', golosUser.active), ACTIVE_WIF, 'active key uses legacy passphrase');
assert.throws(() => context.DposAuth.saveUser(golos, golosUser), /уже добавлен/, 'duplicate account is rejected');

const vizUser = context.DposAuth.createKeyUser(viz, 'bob', { regular: POSTING_WIF });
context.DposAuth.saveUser(viz, vizUser);
assert.strictEqual(context.sjcl.decrypt('dpos.space_viz_bob_regularKey', vizUser.regular), POSTING_WIF, 'viz regular key uses legacy passphrase');
assert.strictEqual(context.DposAuth.getKeyStatus(viz, vizUser).hasRegularOrPosting, true, 'viz regular key status decrypts');

const minterUser = context.DposAuth.createSeedUser(minter, 'Mx0000000000000000000000000000000000000000', MNEMONIC);
context.DposAuth.saveUser(minter, minterUser);
assert.strictEqual(context.sjcl.decrypt('dpos.space_minter_Mx0000000000000000000000000000000000000000_seed', minterUser.seed), MNEMONIC, 'minter seed uses legacy passphrase');
assert.strictEqual(context.DposAuth.getKeyStatus(minter, minterUser).hasActive, true, 'minter seed status decrypts');

const importedDecimal = Object.assign({}, minterUser, { importFrom: 'minter' });
context.DposAuth.saveUser(decimal, importedDecimal);
assert.strictEqual(context.DposAuth.getCurrentUser(decimal).importFrom, 'minter', 'imported seed preserves source chain');
assert.strictEqual(context.DposAuth.getKeyStatus(decimal, importedDecimal).hasActive, true, 'decimal imported seed decrypts using source-chain passphrase');
assert(context.DposAuth.getSeedChains().some((group) => group.chainId === 'minter'), 'seed-chain scanner finds minter users');

context.DposAuth.removeUser(golos, 'alice', 'standard');
assert.strictEqual(context.DposAuth.getUsers(golos).length, 0, 'remove user updates legacy users list');
assert.strictEqual(context.DposAuth.getCurrentUser(golos), null, 'remove current user clears current key');

console.log('v3 accounts/auth smoke passed');
