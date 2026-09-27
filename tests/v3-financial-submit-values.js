const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const Module = require('module');
const parser = new Module('app-callback-parser');
parser._compile(process.binding('natives')['internal/deps/acorn/acorn/dist/acorn'], 'app-callback-parser');
const source = fs.readFileSync(path.join(__dirname, '../v3/js/app.js'), 'utf8');
const cases = new Map([
  ['minter-swap-form', ['min', p => p.params[0].data.minimumValueToBuy]],
  ['minter-liquidity-form', ['volume1', p => p.params[0].data.maximumVolume1]],
  ['minter-hub-withdraw-form', ['hubFee', p => Number(JSON.parse(p.params[0].memo).fee) / 1e18]],
  ['decimal-convert-form', ['minAmount', p => Number(p.params[0].minAmount)]],
  ['manage-create-account-form', ['amount', p => Number(p.params[0].split(' ')[0])]]
]);
const callbacks = [];
function visit(node) {
  if (!node || typeof node !== 'object') return;
  if (node.type === 'CallExpression' && node.callee.name === 'bindOperationForm') {
    const id = node.arguments[1] && node.arguments[1].value;
    if (cases.has(id)) callbacks.push({ id, code: source.slice(node.arguments[2].start, node.arguments[2].end) });
  }
  for (const v of Object.values(node)) if (Array.isArray(v)) v.forEach(visit); else if (v && typeof v === 'object') visit(v);
}
visit(parser.exports.parse(source, { ecmaVersion: 'latest' }));
(async () => {
  for (const id of cases.keys()) assert(callbacks.some(c => c.id === id), `${id} must be exercised`);
  for (const { id, code } of callbacks) {
    const [field, readValue] = cases.get(id);
    const context = {
      chain: { id: id.startsWith('minter') ? 'minter' : id.startsWith('decimal') ? 'decimal' : 'golos' },
      auth: { getCurrentLogin: () => 'creator' },
      createAccountState: { name: 'new-account', pendingKeys: { ownerPubkey: 'public-owner', activePubkey: 'public-active', postingPubkey: 'public-posting', memoPubkey: 'public-memo' }, backupConfirmed: true },
      fetchChainAccount: async () => null,
      normalizeAccountInput: (_chain, value) => value,
      normalizeAssetInput: (_chain, value, symbol) => `${value} ${symbol}`,
      normalizeCoinInput: value => String(value).toUpperCase(),
      normalizeAmountInput: value => String(value),
      minterTx: (type, data, gasCoin, memo) => ({ type, data, gasCoin, memo }),
      resolveDecimalConvertAsset: async (_chain, value) => ({ resolved: value, input: value, symbol: value, decimals: 18 }),
      broadcast: { prepare: (_chain, authority, operationName, params) => ({ authority, operationName, params }) }
    };
    const build = vm.runInNewContext(`(${code})`, context);
    const form = value => new Map(Object.entries({
      from: 'DEL', to: '0x1111111111111111111111111111111111111111', amount: '1',
      volume0: '1', volume1: '0', coin0: 'BIP', coin1: 'OTHER', coin: 'BIP', gasCoin: 'BIP',
      chainId: 'ethereum', name: 'new-account', savedBackup: 'on', type: 'fee', [field]: value
    }));
    for (const value of ['0', '10', '100', '100.25', '100,25']) {
      const prepared = await build(form(value));
      assert.strictEqual(readValue(prepared), Number(value.replace(',', '.')), `${id}/${field}: accepted amount must survive preparation`);
    }
    for (const value of ['-1', 'not-a-number', '1.2.3']) {
      await assert.rejects(async () => build(form(value)), /неотрицательн/, `${id}/${field}: invalid amount cannot be prepared`);
    }
  }
  console.log('Actual financial submit callbacks preserve multi-digit and comma amounts and reject invalid values');
})().catch(error => { console.error(error); process.exitCode = 1; });
