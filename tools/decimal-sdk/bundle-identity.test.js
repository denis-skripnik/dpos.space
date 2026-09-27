const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { webcrypto } = require('crypto');

const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const context = {
  window: null, self: null, globalThis: null, console,
  TextEncoder, TextDecoder, URL, URLSearchParams,
  crypto: webcrypto,
  setTimeout, clearTimeout,
  fetch() { return Promise.reject(new Error('network disabled')); },
  btoa(value) { return Buffer.from(value, 'binary').toString('base64'); },
  atob(value) { return Buffer.from(value, 'base64').toString('binary'); }
};
context.window = context;
context.self = context;
context.globalThis = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../v3/vendor/decimal/decimal-sdk-web.js'), 'utf8'), context);

const sdk = context.DecimalSDK;
assert.deepStrictEqual(Object.keys(sdk).sort(), ['DecimalEVM', 'DecimalNetworks', 'Wallet', 'verifyAddress']);
assert(Object.isFrozen(sdk), 'browser namespace is frozen');
assert(Object.isFrozen(sdk.DecimalNetworks), 'network namespace is frozen');
const wallet = new sdk.Wallet(mnemonic);
assert.strictEqual(wallet.mnemonic, mnemonic);
assert.strictEqual(wallet.wallet.id, 0);
assert.strictEqual(wallet.address, 'd01npvwllfr9dqr8erajqqr6s0vxnk2ak55twavxs');
assert.strictEqual(wallet.evmAddress, '0x9858effd232b4033e47d90003d41ec34ecaeda94');
assert.strictEqual(sdk.Wallet.decodeCosmosAccountAddress(wallet.address), wallet.evmAddress);
assert.strictEqual(sdk.verifyAddress(wallet.address, 'd0'), true);
assert.strictEqual(sdk.verifyAddress(`${wallet.address.slice(0, -1)}t`, 'd0'), false);
const generated = new sdk.Wallet();
assert.strictEqual(generated.mnemonic.trim().split(/\s+/).length, 24, 'default wallet uses 256-bit entropy');
assert.strictEqual(generated.wallet.id, 0);
console.log('Decimal SDK minimal frozen namespace and ethers wallet identities passed');
