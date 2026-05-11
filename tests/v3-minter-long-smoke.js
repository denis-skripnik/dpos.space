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
for (const id of ['chain-select', 'app-select', 'route-form', 'account-input', 'status', 'app']) {
  elements.set(id, element(id));
}

const fetchCalls = [];
const smartfarm = {
  max_amount: 1000,
  max_prize: 50,
  locks: {
    Mx1111111111111111111111111111111111111111: { days: 20, count: 2, amount: 50 }
  },
  providers: [
    { address: 'Mx1111111111111111111111111111111111111111', liquidity: 100, invest_days: 49, bonus_invest_days: 0, multiply: 1.5, get_amount: 12.3456, get_counter: 2, referer: 'Mx2222222222222222222222222222222222222222' },
    { address: 'Mx3333333333333333333333333333333333333333', liquidity: 50, invest_days: 10, bonus_invest_days: 0, multiply: 1, get_amount: 0.25, get_counter: 1 }
  ]
};
const pool = {
  amount0: String(3000n * 10n ** 18n),
  amount1: String(6000n * 10n ** 18n),
  liquidity: String(150n * 10n ** 18n)
};

const context = {
  console,
  URL,
  URLSearchParams,
  Intl,
  setTimeout,
  clearTimeout,
  document: {
    getElementById: (id) => elements.get(id) || element(id),
    createElement: () => element('created'),
    head: { appendChild() {} }
  },
  location: { hash: '#chain=minter&app=long' },
  addEventListener() {},
  fetch: async (url) => {
    fetchCalls.push(String(url));
    if (String(url) === '/api/smartfarm') {
      return { ok: true, text: async () => JSON.stringify(smartfarm) };
    }
    if (String(url).includes('/swap_pool/0/2782')) {
      return { ok: true, text: async () => JSON.stringify(pool) };
    }
    throw new Error(`unexpected fetch ${url}`);
  }
};
context.window = context;

vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root, 'v3/js/chains.js'), 'utf8'), context, { filename: 'v3/js/chains.js' });
context.DposAuth = { getCurrentLogin: () => '', getCurrentUser: () => null, getUsers: () => [], getUserLogin: () => '', getUserType: () => 'standard', selectUser: () => null };
context.DposBroadcast = {};
context.DposProfiles = { formatError: (error) => error.message };
context.DposHistory = {
  formatChainAmount: (_chain, _key, value) => String(value),
  formatValue: (value) => String(value),
  formatDate: (value) => String(value || ''),
  operationTitle: (value) => String(value || '')
};

vm.runInContext(fs.readFileSync(path.join(root, 'v3/js/app.js'), 'utf8'), context, { filename: 'v3/js/app.js' });

(async () => {
  await context.DposV3.renderRoute();
  const html = elements.get('app').innerHTML;
  assert(fetchCalls.some((url) => url === '/api/smartfarm'), 'LONG main fetches active same-origin smartfarm endpoint');
  assert(fetchCalls.some((url) => url === 'https://api-minter.mnst.club/v2/swap_pool/0/2782'), 'LONG main also fetches public Minter pool API');
  assert(!fetchCalls.some((url) => url.includes('178.20.43.121') || url.includes('backend.dpos.space')), 'LONG must not call legacy private IP/backend host directly');
  assert(html.includes('Minter LONG'), 'LONG renders app title');
  assert(html.includes('Рейтинг провайдеров LONG'), 'LONG renders provider rating table as primary UI');
  assert(html.includes('BIP/LONG') && html.includes('BIP') && html.includes('LONG'), 'LONG renders BIP/LONG pool composition');
  assert(html.includes('Будущий фарминг'), 'LONG renders old farming projection column');
  assert(html.includes('Бонус 50 дней'), 'LONG renders old 50-day bonus column');
  assert(html.includes('Mx1111111111111111111111111111111111111111'), 'LONG renders provider rows returned by smartfarm');
  assert(!html.includes('Backend/indexer-only non-goals'), 'LONG main no longer marks active smartfarm data as non-goal');
  assert(!/^\s*<pre[\s>]/i.test(html), 'LONG primary output is not raw JSON');

  const parsed = context.DposV3.long.parseJsonMaybeText(JSON.stringify(JSON.stringify({ ok: true })), 'test');
  assert.strictEqual(JSON.stringify(parsed), JSON.stringify({ ok: true }), 'LONG parser accepts JSON encoded as a string response');

  const source = fs.readFileSync(path.join(root, 'v3/js/app.js'), 'utf8');
  const start = source.indexOf('function longUrl');
  const end = source.indexOf('async function renderCosmosValidators');
  assert(start > 0 && end > start, 'isolates Minter LONG runtime slice');
  const slice = source.slice(start, end);
  assert(!/178\.20\.43\.121|backend\.dpos\.space|\.php/.test(slice), 'Minter LONG runtime slice has no private/backend/PHP endpoint dependency');
  assert(slice.includes("const LONG_API_BASE = '/api/smartfarm'") || source.includes("const LONG_API_BASE = '/api/smartfarm'"), 'Minter LONG uses same-origin smartfarm API path');
  assert(!/broadcast\.broadcast|broadcast\.prepare|bindOperationForm/.test(slice), 'Minter LONG parity page does not introduce wallet broadcast behavior');

  const plan = fs.readFileSync(path.join(root, 'plan.md'), 'utf8');
  assert(plan.includes('### Rigorous parity: Minter / long'), 'plan contains exact Minter / long parity section');
  assert(plan.includes('same-origin `/api/smartfarm`'), 'plan records smartfarm backend is active and intentionally used');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
