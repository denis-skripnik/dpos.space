const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const context = { window: null };
context.window = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root, 'v3/js/chains.js'), 'utf8'), context, { filename: 'v3/js/chains.js' });
const appSource = fs.readFileSync(path.join(root, 'v3/js/app.js'), 'utf8');

for (const chainId of ['steem', 'hive']) {
  const chain = context.DposChains[chainId];
  assert(chain.apps.some((app) => app.id === 'randomblockchain'), `${chainId}: legacy randomblockchain route is exposed`);
  assert.strictEqual(chain.randomHashPath, 'v3/vendor/viz/sha3.min.js', `${chainId}: randomblockchain uses vendored legacy keccak helper`);
}

assert(appSource.includes("chain.id === 'viz' || chain.id === 'steem' || chain.id === 'hive'"), 'Steem/Hive randomblockchain use witness_signature keccak path like legacy');
assert(appSource.includes('keccak_256(witness_signature_1 + witness_signature_2)'), 'social randomblockchain preserves legacy keccak witness_signature algorithm');
assert(appSource.includes('luckyNumber: value + 1'), 'social randomblockchain preserves legacy 1..N numbering');

console.log('v3 social randomblockchain smoke passed');
