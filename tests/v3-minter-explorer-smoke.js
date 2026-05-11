const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');

function element(id) {
  return {
    id,
    value: '',
    innerHTML: '',
    textContent: '',
    dataset: {},
    hidden: false,
    disabled: false,
    tabIndex: 0,
    closest: () => ({ hidden: false, setAttribute() {} }),
    setAttribute() {},
    addEventListener() {}
  };
}

const elements = new Map();
for (const id of ['chain-select', 'app-select', 'route-form', 'account-input', 'status', 'app', 'explorer-result']) {
  elements.set(id, element(id));
}

const fetchCalls = [];
const statusPayload = {
  network: 'minter-mainnet-1',
  latest_block_hash: 'Mtabcdef',
  latest_block_height: 123456,
  latest_block_time: '2026-05-10T10:00:00Z',
  public_key: 'Mpabcdef'
};
const statusPagePayload = { data: { bip_emission: '1000000', free_float_bip: '900000', block_speed_24h: 5.123, transaction_count_24h: 77 } };
const blockPayload = {
  height: 123456,
  time: '2026-05-10T10:00:00Z',
  proposer: 'Mpabcdef',
  transaction_count: 1,
  transactions: [
    { hash: 'Mt111', type: 1, data: { from: 'Mx1111111111111111111111111111111111111111', to: 'Mx2222222222222222222222222222222222222222', value: '1000000000000000000', coin: { symbol: 'BIP' } } }
  ]
};
const txPayload = { data: { hash: 'Mt111', height: 123456, timestamp: '2026-05-10T10:00:00Z', type: 1, from: 'Mx1111111111111111111111111111111111111111', fee: '100000000000000000', gas_coin: { symbol: 'BIP' }, data: { to: 'Mx2222222222222222222222222222222222222222', value: '1000000000000000000', coin: { symbol: 'BIP' } } } };

const context = {
  console,
  URL,
  URLSearchParams,
  Intl,
  setTimeout,
  clearTimeout,
  FormData: function FormData() { return { get: () => '' }; },
  document: {
    getElementById: (id) => elements.get(id) || element(id),
    createElement: () => element('created'),
    head: { appendChild() {} }
  },
  location: { hash: '#chain=minter&app=explorer' },
  addEventListener() {},
  fetch: async (url) => {
    const value = String(url);
    fetchCalls.push(value);
    if (value === 'https://api.minter.one/v2/status') return { ok: true, text: async () => JSON.stringify(statusPayload), json: async () => statusPayload };
    if (value === 'https://explorer-api.minter.network/api/v2/status-page') return { ok: true, text: async () => JSON.stringify(statusPagePayload), json: async () => statusPagePayload };
    if (value === 'https://api.minter.one/v2/block/123456') return { ok: true, text: async () => JSON.stringify(blockPayload), json: async () => blockPayload };
    if (value === 'https://explorer-api.minter.network/api/v2/transactions/Mt111') return { ok: true, text: async () => JSON.stringify(txPayload), json: async () => txPayload };
    throw new Error(`unexpected fetch ${value}`);
  }
};
context.window = context;

vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root, 'v3/js/chains.js'), 'utf8'), context, { filename: 'v3/js/chains.js' });
context.DposAuth = { getCurrentLogin: () => '', getCurrentUser: () => null, getUsers: () => [], getUserLogin: () => '', getUserType: () => 'standard', selectUser: () => null };
context.DposBroadcast = {};
context.DposProfiles = { connect: async (chain) => ({ config: chain, node: chain.apiBase, rest: true }), fetchAccount: async () => ({}), apiCall: async () => { throw new Error('Minter explorer must use REST fetches, not Graphene apiCall'); }, formatError: (error) => error.message };
context.DposHistory = {
  formatChainAmount: (_chain, _key, value) => String(value),
  formatValue: (value) => String(value),
  formatDate: (value) => String(value || ''),
  operationTitle: (value) => String(value || '')
};

vm.runInContext(fs.readFileSync(path.join(root, 'v3/js/app.js'), 'utf8'), context, { filename: 'v3/js/app.js' });

(async () => {
  await context.DposV3.renderRoute();
  let html = elements.get('app').innerHTML + elements.get('explorer-result').innerHTML;
  assert(fetchCalls.includes('https://api.minter.one/v2/status'), 'Minter explorer overview fetches public status endpoint');
  assert(fetchCalls.includes('https://explorer-api.minter.network/api/v2/status-page'), 'Minter explorer overview fetches public status-page endpoint');
  assert(html.includes('Введите номер блока или хэш-сумму транзакции'), 'Minter explorer preserves legacy prompt copy');
  assert(html.includes('Последние блоки') && html.includes('Статус'), 'Minter explorer renders legacy overview sections');
  assert(html.includes('123456') && html.includes('minter-mainnet-1'), 'Minter explorer renders status and latest block data');

  context.location.hash = '#chain=minter&app=explorer&kind=block&value=123456';
  await context.DposV3.renderRoute();
  html = elements.get('app').innerHTML + elements.get('explorer-result').innerHTML;
  assert(fetchCalls.includes('https://api.minter.one/v2/block/123456'), 'Minter block page fetches public block endpoint');
  assert(html.includes('Блок №123456') && html.includes('← предыдущий') && html.includes('→ следующий'), 'Minter block page preserves legacy navigation');
  assert(html.includes('Тип транзакции') && html.includes('Отправка') && html.includes('Количество'), 'Minter block page renders readable tx data');

  context.location.hash = '#chain=minter&app=explorer&kind=tx&value=Mt111';
  await context.DposV3.renderRoute();
  html = elements.get('app').innerHTML + elements.get('explorer-result').innerHTML;
  assert(fetchCalls.includes('https://explorer-api.minter.network/api/v2/transactions/Mt111'), 'Minter tx page fetches explorer transaction endpoint');
  assert(html.includes('Транзакция Mt111') && html.includes('Комиссия') && html.includes('Данные'), 'Minter tx page renders legacy tx sections');

  const source = fs.readFileSync(path.join(root, 'v3/js/app.js'), 'utf8');
  const start = source.indexOf('async function loadMinterExplorerOverview');
  const end = source.indexOf('function renderVizHelp');
  assert(start > 0 && end > start, 'isolates Minter explorer runtime slice');
  const slice = source.slice(start, end);
  assert(!/178\.20\.43\.121|backend\.dpos\.space|\.php/.test(slice), 'Minter explorer runtime slice has no private/backend/PHP dependency');
  assert(!/broadcast\.broadcast|broadcast\.prepare|bindOperationForm/.test(slice), 'Minter explorer remains read-only');

  const plan = fs.readFileSync(path.join(root, 'plan.md'), 'utf8');
  assert(plan.includes('### Rigorous parity: Minter / explorer'), 'plan contains exact Minter / explorer parity section');
  assert(plan.includes('blockchains/minter/apps/explorer/content.php') && plan.includes('https://api-minter.mnst.club/v2/'), 'plan records inspected legacy explorer evidence');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
