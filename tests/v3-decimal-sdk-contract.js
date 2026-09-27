const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { webcrypto } = require('crypto');

const root = path.resolve(__dirname, '..');
const MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const COSMOS_TO = 'd01t76t9rzutq3pf3szczxm0jwrz88p226u3je2qd';
const EVM_TO = '0x5fb4b28c5c582214c602c08db7c9c311ce152b5c';
const TOKEN = '0x0000000000000000000000000000000000000001';

function loadBroadcast(DecimalSDK, calls) {
  const context = {
    window: null,
    console,
    DecimalSDK,
    DposAuth: {
      getCurrentUser() { return { login: 'saved-name', seed: 'encrypted' }; },
      getUserLogin(user) { return user.login; },
      getUserType() { return 'seed'; }
    },
    sjcl: { decrypt() { return MNEMONIC; } }
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(root, 'v3/js/broadcast.js'), 'utf8'), context);
  return context.DposBroadcast;
}

async function run() {
  const calls = [];
  class Wallet {
    constructor(mnemonic) { this.mnemonic = mnemonic; this.address = 'd0owner'; this.evmAddress = EVM_TO; }
    static decodeCosmosAccountAddress(address) {
      calls.push(['decodeCosmosAccountAddress', address]);
      return address === COSMOS_TO ? EVM_TO : null;
    }
  }
  class DecimalEVM {
    connect(contractName) { calls.push(['connect', contractName]); return Promise.resolve(); }
    getAddressTokenBySymbol(symbol) { calls.push(['getAddressTokenBySymbol', symbol]); return Promise.resolve(TOKEN); }
    getContract(address) {
      calls.push(['getContract', address]);
      return Promise.resolve({ contract: { decimals: async () => 6 } });
    }
    getDecimalContractAddress(name) { calls.push(['getDecimalContractAddress', name]); return Promise.resolve(name === 'delegation' ? '0x0000000000000000000000000000000000000002' : name === 'delegation-nft' ? '0x0000000000000000000000000000000000000003' : '0x0000000000000000000000000000000000000004'); }
    getSignPermitToken(...args) { calls.push(['getSignPermitToken', ...args]); return Promise.resolve('token-sign'); }
    getSignPermitDRC721(...args) { calls.push(['getSignPermitDRC721', ...args]); return Promise.resolve('721-sign'); }
    getSignPermitDRC1155(...args) { calls.push(['getSignPermitDRC1155', ...args]); return Promise.resolve('1155-sign'); }
    sendDEL(...args) { calls.push(['sendDEL', ...args]); return Promise.resolve({ hash: 'del' }); }
    transferToken(...args) { calls.push(['transferToken', ...args]); return Promise.resolve({ hash: 'token' }); }
    delegateDEL(...args) { calls.push(['delegateDEL', ...args]); return Promise.resolve({ hash: 'delegate-del' }); }
    delegateToken(...args) { calls.push(['delegateToken', ...args]); return Promise.resolve({ hash: 'delegate-token' }); }
    withdrawStakeToken(...args) { calls.push(['withdrawStakeToken', ...args]); return Promise.resolve({ hash: 'withdraw' }); }
    createTokenReserveless(...args) { calls.push(['createTokenReserveless', ...args]); return Promise.resolve({ hash: 'create' }); }
    delegateDRC721(...args) { calls.push(['delegateDRC721', ...args]); return args[2] === '8' ? Promise.reject(new Error('Only for DRC721')) : Promise.resolve({ hash: 'nft721' }); }
    delegateDRC1155(...args) { calls.push(['delegateDRC1155', ...args]); return Promise.resolve({ hash: 'nft1155' }); }
    withdrawStakeNFT(...args) { calls.push(['withdrawStakeNFT', ...args]); return Promise.resolve({ hash: 'nft-withdraw' }); }
    buyTokenForExactDEL(...args) { calls.push(['buyTokenForExactDEL', ...args]); return Promise.resolve({ hash: 'buy' }); }
    sellExactTokensForDEL(...args) { calls.push(['sellExactTokensForDEL', ...args]); return Promise.resolve({ hash: 'sell' }); }
    convertToken(...args) { calls.push(['convertToken', ...args]); return Promise.resolve({ hash: 'convert' }); }
  }
  const sdk = {
    Wallet,
    DecimalEVM,
    DecimalNetworks: { mainnet: 'mainnet' },
    verifyAddress(address, prefix) { return prefix === 'd0' && address === COSMOS_TO; }
  };
  const broadcast = loadBroadcast(sdk, calls);
  const chain = { id: 'decimal', title: 'Decimal', libraryGlobal: 'DecimalSDK' };
  assert.strictEqual(broadcast.validateAddress(chain, COSMOS_TO), COSMOS_TO, 'adapter accepts a Decimal address with a valid Bech32 checksum');
  assert.throws(() => broadcast.validateAddress(chain, 'd01t76t9rzutq3pf3szczxm0jwrz88p226u3je2qe'), /checksum/i, 'adapter rejects a corrupt Decimal Bech32 checksum before broadcast');

  const send = broadcast.prepare(chain, 'seed', 'decimalSend', [{ to: COSMOS_TO, amount: '1.25', coin: 'DEL' }]);
  const sendResult = await broadcast.broadcast(chain, send, { confirmExecute: true });
  assert(!calls.some(call => call[0] === 'connect'), 'plain DEL send must not initialize unrelated NFT/registry contracts');
  assert.deepStrictEqual(calls.find((call) => call[0] === 'sendDEL'), ['sendDEL', EVM_TO, '1250000000000000000'], 'sendDEL receives positional EVM address and 18-decimal minimal units');
  assert.strictEqual(sendResult.hash, 'del', 'SDK receipt is returned directly; no obsolete broadcast step');

  const tokenSend = broadcast.prepare(chain, 'seed', 'decimalSend', [{ to: EVM_TO, amount: '2.5', coin: TOKEN }]);
  await broadcast.broadcast(chain, tokenSend, { confirmExecute: true });
  assert.deepStrictEqual(calls.find((call) => call[0] === 'transferToken'), ['transferToken', TOKEN, EVM_TO, '2500000'], 'transferToken uses the contract precision instead of assuming 18 decimals');

  calls.length = 0;
  const tickerSend = broadcast.prepare(chain, 'seed', 'decimalSend', [{ to: EVM_TO, amount: '2.5', coin: 'some' }]);
  await broadcast.broadcast(chain, tickerSend, { confirmExecute: true });
  assert.deepStrictEqual(calls.find((call) => call[0] === 'getAddressTokenBySymbol'), ['getAddressTokenBySymbol', 'SOME'], 'ticker is resolved through the SDK token-center lookup');
  assert.deepStrictEqual(calls.find((call) => call[0] === 'transferToken'), ['transferToken', TOKEN, EVM_TO, '2500000'], 'ticker transfer preserves the existing coin-symbol UI');

  const validator = '0x0000000000000000000000000000000000000005';
  const collection = '0x0000000000000000000000000000000000000006';
  calls.length = 0;
  await broadcast.broadcast(chain, broadcast.prepare(chain, 'seed', 'decimalDelegate', [{ validator, coin: 'DEL', amount: '3' }]), { confirmExecute: true });
  assert.deepStrictEqual(calls.find((call) => call[0] === 'delegateDEL'), ['delegateDEL', validator, '3000000000000000000']);

  calls.length = 0;
  await broadcast.broadcast(chain, broadcast.prepare(chain, 'seed', 'decimalDelegate', [{ validator, coin: 'SOME', amount: '3.25' }]), { confirmExecute: true });
  assert.deepStrictEqual(calls.find((call) => call[0] === 'getSignPermitToken'), ['getSignPermitToken', TOKEN, '0x0000000000000000000000000000000000000002', '3250000']);
  assert.deepStrictEqual(calls.find((call) => call[0] === 'delegateToken'), ['delegateToken', validator, TOKEN, '3250000', 'token-sign']);

  calls.length = 0;
  await broadcast.broadcast(chain, broadcast.prepare(chain, 'seed', 'decimalUnbond', [{ validator, coin: 'SOME', amount: '1.5' }]), { confirmExecute: true });
  assert.deepStrictEqual(calls.find((call) => call[0] === 'withdrawStakeToken'), ['withdrawStakeToken', validator, TOKEN, '1500000']);

  calls.length = 0;
  await broadcast.broadcast(chain, broadcast.prepare(chain, 'seed', 'decimalCreateToken', [{ title: 'Some token', symbol: 'SOME', initSupply: '100', maxSupply: '1000' }]), { confirmExecute: true });
  assert.deepStrictEqual(calls.find((call) => call[0] === 'createTokenReserveless'), ['createTokenReserveless', 'Some token', 'SOME', true, true, '100000000000000000000', '1000000000000000000000', '']);

  calls.length = 0;
  await broadcast.broadcast(chain, broadcast.prepare(chain, 'seed', 'decimalDelegateNFT', [{ validator, collection, nftId: '7', amount: '1' }]), { confirmExecute: true });
  assert.deepStrictEqual(calls.find((call) => call[0] === 'getSignPermitDRC721'), ['getSignPermitDRC721', collection, '0x0000000000000000000000000000000000000003', '7']);
  assert.deepStrictEqual(calls.find((call) => call[0] === 'delegateDRC721'), ['delegateDRC721', validator, collection, '7', '721-sign']);

  calls.length = 0;
  await broadcast.broadcast(chain, broadcast.prepare(chain, 'seed', 'decimalDelegateNFT', [{ validator, collection, nftId: '8', amount: '2' }]), { confirmExecute: true });
  assert.deepStrictEqual(calls.find((call) => call[0] === 'getSignPermitDRC1155'), ['getSignPermitDRC1155', collection, '0x0000000000000000000000000000000000000003']);
  assert.deepStrictEqual(calls.find((call) => call[0] === 'delegateDRC1155'), ['delegateDRC1155', validator, collection, '8', 2n, '1155-sign']);

  calls.length = 0;
  await broadcast.broadcast(chain, broadcast.prepare(chain, 'seed', 'decimalUnbondNFT', [{ validator, collection, nftId: '7', amount: '2' }]), { confirmExecute: true });
  assert.deepStrictEqual(calls.find((call) => call[0] === 'withdrawStakeNFT'), ['withdrawStakeNFT', validator, collection, '7', 2n]);

  calls.length = 0;
  await broadcast.broadcast(chain, broadcast.prepare(chain, 'seed', 'decimalConvert', [{ from: 'DEL', to: 'SOME', amount: '2', minAmount: '1.25' }]), { confirmExecute: true });
  assert.deepStrictEqual(calls.find((call) => call[0] === 'buyTokenForExactDEL'), ['buyTokenForExactDEL', TOKEN, '2000000000000000000', '1250000', EVM_TO]);

  calls.length = 0;
  await broadcast.broadcast(chain, broadcast.prepare(chain, 'seed', 'decimalConvert', [{ from: 'SOME', to: 'DEL', amount: '2.5', minAmount: '1' }]), { confirmExecute: true });
  assert.deepStrictEqual(calls.find((call) => call[0] === 'sellExactTokensForDEL'), ['sellExactTokensForDEL', TOKEN, '2500000', '1000000000000000000', EVM_TO]);

  calls.length = 0;
  await broadcast.broadcast(chain, broadcast.prepare(chain, 'seed', 'decimalConvert', [{ from: TOKEN, to: 'SOME', amount: '2.5', minAmount: '1.25' }]), { confirmExecute: true });
  assert.deepStrictEqual(calls.find((call) => call[0] === 'convertToken'), ['convertToken', TOKEN, TOKEN, '2500000', '1250000', EVM_TO, 'token-sign']);

  const excessivePrecision = broadcast.prepare(chain, 'seed', 'decimalSend', [{ to: EVM_TO, amount: '0.0000001', coin: 'SOME' }]);
  await assert.rejects(() => broadcast.broadcast(chain, excessivePrecision, { confirmExecute: true }), /6.*знак|precision/i, 'amounts beyond token precision are rejected');

  const vendorContext = {
    window: null, self: null, globalThis: null, console,
    TextEncoder, TextDecoder, URL, URLSearchParams,
    crypto: webcrypto,
    setTimeout, clearTimeout,
    fetch() { return Promise.reject(new Error('network disabled in vendored SDK contract test')); },
    btoa(value) { return Buffer.from(value, 'binary').toString('base64'); },
    atob(value) { return Buffer.from(value, 'base64').toString('binary'); }
  };
  vendorContext.window = vendorContext;
  vendorContext.self = vendorContext;
  vendorContext.globalThis = vendorContext;
  vm.createContext(vendorContext);
  vm.runInContext(fs.readFileSync(path.join(root, 'v3/vendor/decimal/decimal-sdk-web.js'), 'utf8'), vendorContext, { timeout: 10000 });
  const realSdk = vendorContext.DecimalSDK;
  assert(realSdk, 'vendored browser SDK exposes DecimalSDK');
  assert.strictEqual(realSdk.DecimalEVM.prototype.sendDEL.length, 3, 'vendored SDK sendDEL contract is positional');
  assert.strictEqual(realSdk.DecimalEVM.prototype.transferToken.length, 4, 'vendored SDK transferToken contract is positional');
  const methodLengths = {
    delegateDEL: 3,
    delegateToken: 5,
    withdrawStakeToken: 4,
    createTokenReserveless: 8,
    delegateDRC721: 5,
    delegateDRC1155: 6,
    withdrawStakeNFT: 5,
    buyTokenForExactDEL: 5,
    sellExactTokensForDEL: 5,
    convertToken: 7,
    getSignPermitToken: 3,
    getSignPermitDRC721: 3,
    getSignPermitDRC1155: 2,
    getDecimalContractAddress: 1
  };
  for (const [method, length] of Object.entries(methodLengths)) {
    assert.strictEqual(typeof realSdk.DecimalEVM.prototype[method], 'function', `vendored SDK exposes ${method}`);
    assert.strictEqual(realSdk.DecimalEVM.prototype[method].length, length, `vendored SDK ${method} positional contract`);
  }
  assert.strictEqual(typeof realSdk.DecimalEVM.prototype.broadcast, 'undefined', 'vendored SDK methods broadcast internally');
  const sent = [];
  const realMethodHarness = Object.create(realSdk.DecimalEVM.prototype);
  realMethodHarness.account = {
    async sendTransaction(payload) {
      sent.push(payload);
      return { wait: async () => ({ hash: 'mocked-transport' }) };
    }
  };
  const realMethodResult = await realMethodHarness.sendDEL(EVM_TO, '1250000000000000000');
  assert.strictEqual(realMethodResult.hash, 'mocked-transport');
  assert.strictEqual(sent[0].to, EVM_TO, 'real SDK method forwards the EVM recipient to transport');
  assert.strictEqual(sent[0].value, '1250000000000000000', 'real SDK method forwards minimal units unchanged');
  const tokenCalls = [];
  const realTokenHarness = Object.create(realSdk.DecimalEVM.prototype);
  realTokenHarness.checkConnect = async (name) => tokenCalls.push(['checkConnect', name]);
  realTokenHarness.getContract = async (address) => ({ contract: { address } });
  realTokenHarness.call = {
    async transferToken(contract, to, amount, estimateGas) {
      tokenCalls.push(['transferToken', contract.address, to, amount, estimateGas]);
      return { hash: 'mocked-token-transport' };
    }
  };
  const realTokenResult = await realTokenHarness.transferToken(TOKEN, EVM_TO, '2500000');
  assert.strictEqual(realTokenResult.hash, 'mocked-token-transport');
  assert.deepStrictEqual(Array.from(tokenCalls[1]), ['transferToken', TOKEN, EVM_TO, '2500000', undefined], 'vendored SDK forwards raw token units without applying precision');
  const lookupCalls = [];
  const realLookupHarness = Object.create(realSdk.DecimalEVM.prototype);
  realLookupHarness.checkConnect = async (name) => lookupCalls.push(['checkConnect', name]);
  realLookupHarness.call = {
    async getAddressTokenBySymbol(symbol) {
      lookupCalls.push(['getAddressTokenBySymbol', symbol]);
      return TOKEN;
    }
  };
  assert.strictEqual(await realLookupHarness.getAddressTokenBySymbol('SOME'), TOKEN, 'vendored SDK resolves ticker through token-center');
  assert.deepStrictEqual(Array.from(lookupCalls[0]), ['checkConnect', 'token-center']);
  assert.deepStrictEqual(Array.from(lookupCalls[1]), ['getAddressTokenBySymbol', 'SOME']);

  function makeRealWrapperHarness(nftType = 0) {
    const wrapperCalls = [];
    const harness = Object.create(realSdk.DecimalEVM.prototype);
    harness.abis = { token: ['token-abi'] };
    harness.checkConnect = async (name) => wrapperCalls.push(['checkConnect', name]);
    harness.getContract = async (address) => ({ contract: { address } });
    harness.getNFTContract = async (address) => ({ contract: { address } });
    harness.getNftType = async () => nftType;
    harness.call = new Proxy({}, {
      get(_target, method) {
        return async (...args) => {
          wrapperCalls.push([String(method), ...args.map((arg) => arg && arg.address ? arg.address : arg)]);
          return { method: String(method) };
        };
      }
    });
    return { harness, wrapperCalls };
  }

  async function assertRealWrapper(method, args, expectedConnect, expectedForwarded, nftType = 0) {
    const { harness, wrapperCalls } = makeRealWrapperHarness(nftType);
    const result = await realSdk.DecimalEVM.prototype[method].apply(harness, args);
    assert.strictEqual(result.method, expectedForwarded[0], `real ${method} returns its Call transport result`);
    assert.deepStrictEqual(Array.from(wrapperCalls[0]), ['checkConnect', expectedConnect], `real ${method} connects the documented contract pack`);
    assert.deepStrictEqual(Array.from(wrapperCalls[1]), expectedForwarded, `real ${method} forwards documented arguments`);
  }

  await assertRealWrapper('delegateDEL', [validator, '3000000000000000000'], 'delegation', ['delegateDEL', validator, '3000000000000000000', undefined]);
  await assertRealWrapper('delegateToken', [validator, TOKEN, '3250000', 'token-sign'], 'delegation', ['delegateToken', validator, TOKEN, '3250000', 'token-sign', undefined]);
  await assertRealWrapper('withdrawStakeToken', [validator, TOKEN, '1500000'], 'delegation', ['withdrawStakeToken', validator, TOKEN, '1500000', undefined]);
  await assertRealWrapper('createTokenReserveless', ['Some token', 'SOME', true, true, '100', '1000', ''], 'token-center', ['createTokenReserveless', 'Some token', 'SOME', true, true, '100', '1000', '', undefined]);
  await assertRealWrapper('buyTokenForExactDEL', [TOKEN, '2', '1', EVM_TO], 'token-center', ['buyTokenForExactDEL', TOKEN, '2', '1', EVM_TO, undefined]);
  await assertRealWrapper('sellExactTokensForDEL', [TOKEN, '2', '1', EVM_TO], 'token-center', ['sellExactTokensForDEL', TOKEN, '2', '1', EVM_TO, undefined]);
  await assertRealWrapper('convertToken', [TOKEN, TOKEN, '2', '1', EVM_TO, 'token-sign'], 'token-center', ['convertToken', TOKEN, TOKEN, '2', '1', EVM_TO, 'token-sign', undefined]);
  await assertRealWrapper('getSignPermitToken', [TOKEN, validator, '3'], 'token-center', ['getSignPermitToken', TOKEN, validator, '3']);
  await assertRealWrapper('delegateDRC721', [validator, collection, '7', '721-sign'], 'delegation-nft', ['delegateDRC721', validator, collection, '7', '721-sign', undefined], 0);
  await assertRealWrapper('delegateDRC1155', [validator, collection, '8', 2n, '1155-sign'], 'delegation-nft', ['delegateDRC1155', validator, collection, '8', 2n, '1155-sign', undefined], 1);
  await assertRealWrapper('withdrawStakeNFT', [validator, collection, '7', 2n], 'delegation-nft', ['withdrawStakeNFT', validator, collection, '7', 2n, undefined], 0);
  await assertRealWrapper('getSignPermitDRC721', [collection, validator, '7'], 'nft-center', ['getSignPermitDRC721', collection, validator, '7'], 0);
  await assertRealWrapper('getSignPermitDRC1155', [collection, validator], 'nft-center', ['getSignPermitDRC1155', collection, validator], 1);

  const contractMarker = { contract: { address: TOKEN } };
  const cachedContractHarness = Object.create(realSdk.DecimalEVM.prototype);
  cachedContractHarness.contracts = { [TOKEN]: contractMarker };
  assert.strictEqual(await cachedContractHarness.getContract(TOKEN), contractMarker, 'real SDK getContract returns its cached verified contract wrapper without a network request');

  const contractAddressCalls = [];
  const contractAddressHarness = Object.create(realSdk.DecimalEVM.prototype);
  contractAddressHarness.checkConnect = async (name) => contractAddressCalls.push(['checkConnect', name]);
  contractAddressHarness.call = { getDecimalContract(name, addressOnly) { contractAddressCalls.push(['getDecimalContract', name, addressOnly]); return TOKEN; } };
  assert.strictEqual(await contractAddressHarness.getDecimalContractAddress('token-center'), TOKEN);
  assert.deepStrictEqual(Array.from(contractAddressCalls[0]), ['checkConnect', 'token-center']);
  assert.deepStrictEqual(Array.from(contractAddressCalls[1]), ['getDecimalContract', 'token-center', true]);

  const connectCalls = [];
  const connectHarness = Object.create(realSdk.DecimalEVM.prototype);
  connectHarness.checkConnect = async (name) => connectCalls.push(name);
  await connectHarness.connect();
  assert.deepStrictEqual(Array.from(connectCalls), ['contract-center', 'token-center', 'nft-center', 'delegation', 'delegation-nft', 'master-validator', 'multi-call', 'multi-sig', 'gas-center', 'checks'], 'real SDK connect initializes every documented contract pack in order');

  const realWallet = new realSdk.Wallet(MNEMONIC);
  assert.strictEqual(realWallet.address, 'd01npvwllfr9dqr8erajqqr6s0vxnk2ak55twavxs', 'vendored SDK preserves mnemonic → Decimal address identity');
  assert.strictEqual(realWallet.evmAddress, '0x9858effd232b4033e47d90003d41ec34ecaeda94', 'vendored SDK preserves mnemonic → EVM identity');
  assert.throws(() => new realSdk.Wallet('abandon abandon abandon'), /invalid mnemonic/i, 'vendored SDK rejects an invalid mnemonic checksum/length');
  assert.strictEqual(realSdk.verifyAddress(realWallet.address, 'd0'), true, 'vendored SDK verifies a valid Decimal Bech32 checksum');
  assert.strictEqual(realSdk.verifyAddress('d01npvwllfr9dqr8erajqqr6s0vxnk2ak55twavxt', 'd0'), false, 'vendored SDK verifier detects a corrupt Decimal checksum');
  assert.strictEqual(realSdk.Wallet.decodeCosmosAccountAddress(realWallet.address), realWallet.evmAddress, 'vendored SDK decodes a verified Decimal address');
  assert.throws(() => realSdk.Wallet.decodeCosmosAccountAddress('d01npvwllfr9dqr8erajqqr6s0vxnk2ak55twavxt'), /checksum/i, 'vendored SDK rejects a corrupt Decimal checksum');
  const realEvm = new realSdk.DecimalEVM(realWallet, realSdk.DecimalNetworks.mainnet);
  assert.strictEqual(realEvm.account.address.toLowerCase(), realWallet.evmAddress, 'real DecimalEVM constructor binds the mnemonic-derived EVM signer');
}

const deadline = setTimeout(() => {
  console.error('Decimal SDK contract test did not complete');
  process.exit(1);
}, 30000);
run().then(() => {
  console.log('Vendored Decimal SDK identity, ticker lookup, raw units and adapter contracts passed');
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => clearTimeout(deadline));
