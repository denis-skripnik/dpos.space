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
  assert(!fetchCalls.some((url) => url.includes('/smartfarm') || url.includes('178.20.43.121') || url.includes('backend.dpos.space')), 'LONG static page must not call legacy smartfarm/private backend endpoints');
  assert(fetchCalls.some((url) => url === 'https://api-minter.mnst.club/v2/swap_pool/0/2782'), 'LONG main may fetch public Minter pool API');
  assert(html.includes('LONG farming'), 'LONG renders legacy app title');
  assert(html.includes('BIP/LONG') && html.includes('BIP') && html.includes('LONG'), 'LONG renders BIP/LONG public pool composition');
  assert(html.includes('Backend/indexer-only non-goals'), 'LONG documents backend-only legacy data as static non-goal');
  assert(html.includes('Рейтинг провайдеров') && html.includes('недоступен без legacy backend'), 'LONG is honest that provider ranking is not rebuilt statically');
  assert(html.includes('Ставки') && html.includes('Опросы') && html.includes('Отложенные транзакции'), 'LONG documents legacy subservices');
  assert(html.includes('Кошелёк рассылки') && html.includes('Mx01029d73e128e2f53ff1fcc2d52a423283ad9439'), 'LONG renders old farming sender wallet link');
  assert(/role="status"[^>]*aria-live="polite"/.test(html), 'LONG page includes accessible live status/non-goal region');
  assert(!/^\s*<pre[\s>]/i.test(html), 'LONG primary output is not raw JSON');

  const source = fs.readFileSync(path.join(root, 'v3/js/app.js'), 'utf8');
  const start = source.indexOf('function longPageHash');
  const end = source.indexOf('async function renderCosmosValidators');
  assert(start > 0 && end > start, 'isolates Minter LONG runtime slice');
  const slice = source.slice(start, end);
  assert(!/178\.20\.43\.121|backend\.dpos\.space|\/api\/smartfarm|\.php/.test(slice), 'Minter LONG runtime slice has no private/backend/PHP endpoint dependency');
  assert(!/broadcast\.broadcast|broadcast\.prepare|bindOperationForm/.test(slice), 'Minter LONG parity page does not introduce wallet broadcast behavior');

  const plan = fs.readFileSync(path.join(root, 'plan.md'), 'utf8');
  assert(plan.includes('### Rigorous parity: Minter / long'), 'plan contains exact Minter / long parity section');
  assert(plan.includes('blockchains/minter/apps/long/content.php') && plan.includes('Backend/indexer-only non-goal'), 'plan records inspected legacy backend evidence and non-goal');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
