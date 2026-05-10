const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

function createLocalStorage() {
  const store = new Map();
  return {
    getItem(key) { return store.has(key) ? store.get(key) : null; },
    setItem(key, value) { store.set(key, String(value)); },
    removeItem(key) { store.delete(key); }
  };
}

function createContext() {
  const localStorage = createLocalStorage();
  const context = {
    window: null,
    localStorage,
    console,
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
  for (const file of ['v3/js/auth.js', 'v3/js/broadcast.js', 'v3/js/history.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
  }
  return context;
}

function seedSeedAccount(context, chainId, login, importFrom) {
  const source = importFrom || chainId;
  const user = {
    login,
    seed: context.sjcl.encrypt(`dpos.space_${source}_${login}_seed`, MNEMONIC)
  };
  if (importFrom) user.importFrom = importFrom;
  context.localStorage.setItem(`${chainId}_users`, JSON.stringify([user]));
  context.localStorage.setItem(`${chainId}_current_user`, JSON.stringify(user));
  return user;
}

async function run() {
  const context = createContext();
  const minter = { id: 'minter', title: 'Minter', libraryGlobal: 'minterSDK', apiBase: 'https://api.minter.one/v2', liquidSymbol: 'BIP' };
  const decimal = { id: 'decimal', title: 'Decimal', libraryGlobal: 'DecimalSDK', apiBase: 'https://api.decimalchain.com/api/v1', liquidSymbol: 'DEL' };

  seedSeedAccount(context, 'minter', 'minter-seed');
  const minterStatus = context.DposAuth.getKeyStatus(minter, context.DposAuth.getCurrentUser(minter));
  assert.strictEqual(minterStatus.hasActive, true, 'minter: legacy seed decrypts via old passphrase');
  assert.strictEqual(context.DposBroadcast.validateAddress(minter, 'Mx0000000000000000000000000000000000000000'), 'Mx0000000000000000000000000000000000000000');
  assert.throws(() => context.DposBroadcast.validateAddress(minter, 'dx0000000000000000000000000000000000000000'), /Minter address/);
  assert.strictEqual(context.DposBroadcast.validateCoinSymbol('LONG'), 'LONG');
  assert.strictEqual(context.DposBroadcast.validateAmount('1.000'), '1.000');
  assert.strictEqual(context.DposHistory.operationTitle(13), 'Мультисенд (мульти-отправка)', 'minter numeric type 13 is readable');
  assert.strictEqual(context.DposHistory.operationTitle('0x0D'), 'Мультисенд (мульти-отправка)', 'minter hex type 0x0D is readable');
  assert.strictEqual(context.DposHistory.operationTitle(21), 'Добавление ликвидности', 'minter pool ops are readable');

  let minterPosted;
  context.minterSDK = {
    TX_TYPE: { SEND: '0x01' },
    Minter: class {
      constructor(options) { this.options = options; }
      replaceCoinSymbol(tx) { return Promise.resolve(Object.assign({ replaced: true }, tx)); }
      postTx(tx, options) { minterPosted = { tx, options }; return Promise.resolve({ hash: 'MtHash', seed: options.seedPhrase }); }
    }
  };
  const minterPrepared = context.DposBroadcast.prepare(minter, 'seed', 'minterTx', [{ chainId: 1, type: '0x01', data: { to: 'Mx0000000000000000000000000000000000000000', value: 1, coin: 'BIP' }, gasCoin: 'BIP' }], { title: 'Minter send' });
  assert.strictEqual(minterPrepared.authority, 'seed');
  assert(!JSON.stringify(context.DposBroadcast.sanitizePrepared(minterPrepared)).includes(MNEMONIC), 'minter preview does not leak seed');
  const minterResult = await context.DposBroadcast.broadcast(minter, minterPrepared, { confirmExecute: true });
  assert.strictEqual(minterPosted.options.seedPhrase, MNEMONIC, 'minter broadcast signs with decrypted mnemonic');
  assert(!JSON.stringify(context.DposBroadcast.sanitizeResult(minterResult)).includes(MNEMONIC), 'minter result sanitizer redacts seed-like values by key');

  seedSeedAccount(context, 'decimal', 'decimal-seed');
  const decimalStatus = context.DposAuth.getKeyStatus(decimal, context.DposAuth.getCurrentUser(decimal));
  assert.strictEqual(decimalStatus.hasActive, true, 'decimal: legacy seed decrypts via old passphrase');
  assert.strictEqual(context.DposBroadcast.validateAddress(decimal, 'dx0000000000000000000000000000000000000000'), 'dx0000000000000000000000000000000000000000');
  assert.strictEqual(context.DposBroadcast.validateAddress(decimal, '0x0000000000000000000000000000000000000000'), '0x0000000000000000000000000000000000000000');
  assert.strictEqual(context.DposHistory.operationTitle('/decimal.coin.v1.MsgSendCoin'), 'Отправка', 'decimal OpenAPI message type is readable');
  assert.strictEqual(context.DposHistory.operationTitle('COIN_SEND'), 'Отправка', 'decimal legacy uppercase send type is readable');
  assert.strictEqual(context.DposHistory.operationTitle('COIN_SELL'), 'Продажа монеты', 'decimal legacy uppercase sell type is readable');
  assert.strictEqual(context.DposHistory.operationTitle('VALIDATOR_DELEGATE'), 'Делегирование', 'decimal legacy uppercase validator type is readable');
  assert.strictEqual(context.DposHistory.operationTitle('/decimal.validator.v1.MsgUndelegateCoin'), 'Анбонд', 'decimal OpenAPI validator type is readable');
  assert.strictEqual(context.DposHistory.operationTitle('delegate_nft'), 'Делегирование NFT', 'decimal NFT op is readable');
  assert.strictEqual(context.DposHistory.operationTitle('NFT_TRANSFER'), 'Передача NFT', 'decimal legacy uppercase NFT type is readable');
  assert.strictEqual(context.DposHistory.operationTitle('/decimal.nft.v1.MsgDelegateToken'), 'Делегирование NFT', 'decimal OpenAPI NFT type is readable');

  const decimalCalls = [];
  context.DecimalSDK = {
    DecimalNetworks: { mainnet: 'mainnet' },
    Wallet: class { constructor(seed) { this.seed = seed; this.address = 'dxabc'; } },
    DecimalEVM: class {
      constructor(wallet, network) { this.wallet = wallet; this.network = network; }
      connect() { decimalCalls.push(['connect']); return Promise.resolve(); }
      sendDEL(data) { decimalCalls.push(['sendDEL', data, this.wallet.seed]); return Promise.resolve({ raw: 'send' }); }
      delegateDEL(validator, amount) { decimalCalls.push(['delegateDEL', validator, amount.toString(), this.wallet.seed]); return Promise.resolve({ raw: 'delegate' }); }
      broadcast(payload) { decimalCalls.push(['broadcast', payload]); return Promise.resolve({ hash: 'DxHash', privateKey: this.wallet.seed }); }
    }
  };
  const decimalPrepared = context.DposBroadcast.prepare(decimal, 'seed', 'decimalSend', [{ to: 'dx0000000000000000000000000000000000000000', amount: '1', coin: 'DEL' }], { title: 'Decimal send' });
  assert(!JSON.stringify(context.DposBroadcast.sanitizePrepared(decimalPrepared)).includes(MNEMONIC), 'decimal preview does not leak seed');
  const decimalResult = await context.DposBroadcast.broadcast(decimal, decimalPrepared, { confirmExecute: true });
  assert.strictEqual(decimalCalls[1][0], 'sendDEL', 'decimal send dispatches SDK method');
  assert.strictEqual(decimalCalls[1][2], MNEMONIC, 'decimal SDK wallet receives decrypted mnemonic');
  assert(!JSON.stringify(context.DposBroadcast.sanitizeResult(decimalResult)).includes(MNEMONIC), 'decimal result sanitizer redacts key echoes');

  const decimalDelegation = context.DposBroadcast.prepare(decimal, 'seed', 'decimalDelegate', [{ validator: '0x0000000000000000000000000000000000000000', amount: '2', coin: 'DEL' }]);
  await context.DposBroadcast.broadcast(decimal, decimalDelegation, { confirmExecute: true });
  assert(decimalCalls.some((call) => call[0] === 'delegateDEL'), 'decimal delegate dispatches SDK method');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
