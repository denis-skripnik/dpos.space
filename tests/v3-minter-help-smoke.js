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
  location: { hash: '#chain=minter&app=help' },
  addEventListener() {},
  fetch: async (url) => {
    fetchCalls.push(String(url));
    throw new Error(`Minter help must remain static and read-only, unexpected fetch ${url}`);
  }
};
context.window = context;

vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root, 'v3/js/chains.js'), 'utf8'), context, { filename: 'v3/js/chains.js' });
context.DposAuth = { getCurrentLogin: () => '', getCurrentUser: () => null, getUsers: () => [], getUserLogin: () => '', getUserType: () => 'standard', selectUser: () => null };
context.DposBroadcast = { prepareOperation: () => { throw new Error('Minter help must not prepare broadcasts'); }, broadcast: () => { throw new Error('Minter help must not broadcast'); } };
context.DposProfiles = { connect: async (chain) => ({ config: chain, node: chain.apiBase, rest: true }), fetchAccount: async () => ({}), apiCall: async () => { throw new Error('Minter help must not use RPC profile calls'); }, formatError: (error) => error.message };
context.DposHistory = { formatChainAmount: (_chain, _key, value) => String(value), formatValue: (value) => String(value), formatDate: (value) => String(value || ''), operationTitle: (value) => String(value || '') };

vm.runInContext(fs.readFileSync(path.join(root, 'v3/js/app.js'), 'utf8'), context, { filename: 'v3/js/app.js' });

(async () => {
  const minterApps = context.DposChains.minter.apps.map((app) => app.id);
  assert(minterApps.includes('help'), 'Minter app registry exposes legacy help route');

  await context.DposV3.renderRoute();
  const html = elements.get('app').innerHTML;
  assert(html.includes('Minter: справка dpos.space'), 'Minter help renders a dedicated heading');
  assert(html.includes('Здесь только видео справка'), 'Minter help preserves legacy intro copy');
  assert(html.includes('https://www.youtube.com/embed/Hk0GYmc_efo'), 'Minter help preserves first legacy YouTube embed');
  assert(html.includes('https://www.youtube.com/embed/Fl2-6LXfX4k'), 'Minter help preserves LONG tutorial embed');
  assert(html.includes('Ставим на курс криптовалют и пулов в Minter'), 'Minter help preserves LONG tutorial caption');
  assert(html.includes('role="status"') && html.includes('aria-live="polite"'), 'Minter help includes accessible static-only status text');
  assert.strictEqual(fetchCalls.length, 0, 'Minter help does not fetch public or private APIs');

  const source = fs.readFileSync(path.join(root, 'v3/js/app.js'), 'utf8');
  const start = source.indexOf('function renderMinterHelp');
  const end = source.indexOf('function renderVizHelp');
  assert(start > 0 && end > start, 'isolates Minter help runtime slice');
  const slice = source.slice(start, end);
  assert(!/178\.20\.43\.121|backend\.dpos\.space|\.php/.test(slice), 'Minter help runtime slice has no private/backend/PHP dependency');
  assert(!/broadcast\.broadcast|broadcast\.prepare|bindOperationForm/.test(slice), 'Minter help remains read-only');

  const plan = fs.readFileSync(path.join(root, 'plan.md'), 'utf8');
  assert(plan.includes('### Rigorous parity: Minter / help'), 'plan contains exact Minter / help parity section');
  assert(plan.includes('blockchains/minter/apps/help/content.php') && plan.includes('Hk0GYmc_efo') && plan.includes('Fl2-6LXfX4k'), 'plan records inspected legacy help evidence');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
