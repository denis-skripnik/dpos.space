const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const appSource = fs.readFileSync('v3/js/app.js', 'utf8');

assert(appSource.includes('function summarizeMinterMultisend'), 'Minter multisend has a summary helper');
assert(appSource.includes('formatMinterMultisendTotals(multisend)'), 'transaction table shows a multisend total amount');
assert(appSource.includes('renderMinterMultisendDetailsHtml(chain, row)'), 'transaction details render multisend recipient list');
assert(appSource.includes('if (Array.isArray(data.list)) return renderMinterMultisendDetailsHtml'), 'Minter explorer renders multisend list as readable HTML, not raw JSON');

function fakeElement(extra = {}) {
  return Object.assign({
    innerHTML: '',
    textContent: '',
    value: '',
    disabled: false,
    hidden: false,
    dataset: {},
    style: {},
    addEventListener() {},
    setAttribute() {},
    removeAttribute() {},
    appendChild() {},
    querySelector: () => null,
    closest: () => fakeElement()
  }, extra);
}

const context = {
  console,
  URLSearchParams,
  TextEncoder,
  TextDecoder,
  location: { hash: '', origin: 'https://dpos.blinddev.xyz', pathname: '/' },
  addEventListener() {},
  localStorage: { length: 0, key: () => null, getItem: () => null, setItem() {}, removeItem() {} },
  document: {
    getElementById(id) { return id === 'status' ? fakeElement({ dataset: {} }) : fakeElement(); },
    querySelector: () => null,
    createElement: () => fakeElement({ click() {}, remove() {} }),
    body: fakeElement(),
    head: fakeElement()
  },
  DposChains: {
    golos: { id: 'golos', title: 'Golos', apps: [{ id: 'profiles', title: 'Профиль' }], defaultAccount: '' },
    minter: { id: 'minter', title: 'Minter', apps: [{ id: 'profiles', title: 'Профиль' }], defaultAccount: '' }
  },
  DposAuth: {
    getUsers: () => [],
    getCurrentUser: () => null,
    getCurrentLogin: () => '',
    getUserLogin: (user) => user && user.login || '',
    getUserType: () => 'standard'
  },
  DposBroadcast: {},
  DposProfiles: { formatError: (error) => error.message },
  DposHistory: {
    operationTitle: (type) => Number(type) === 13 ? 'Мультисенд (мульти-отправка)' : String(type),
    formatDate: (value) => value || '',
    formatChainAmount: (chain, key, value) => String(value || ''),
    formatValue: (value) => typeof value === 'object' ? JSON.stringify(value) : String(value || '')
  },
  DposNotifications: null,
  btoa: (value) => Buffer.from(value, 'binary').toString('base64'),
  atob: (value) => Buffer.from(value, 'base64').toString('binary')
};
context.window = context;
context.globalThis = context;
vm.createContext(context);
vm.runInContext(appSource, context);

const tx = {
  type: 13,
  from: 'Mx01029d73e128e2f53ff1fcc2d52a423283ad9439',
  data: {
    list: [
      { to: 'Mx5aea138bd36a4e6019472ebbbe0a88ac2e4f9969', value: '39588.962989865024000000', coin: { symbol: 'LONG' } },
      { to: 'Mxce6bdd5c7ae3d87ee38996f9a3eda5d43463e557', value: '29122.953106925590000000', coin: { symbol: 'LONG' } },
      { to: 'Mxdeddc4b90ccfb38094a6e93a6d53306630cd1ae5', value: '413.075895836052900000', coin: { symbol: 'LONG' } }
    ]
  }
};

const summary = context.DposV3.transactions.summarizeMinterMultisend(tx);
assert.strictEqual(summary.count, 3, 'multisend summary counts recipients');
assert.strictEqual(summary.totals.LONG, '69124.9919926266669', 'multisend summary totals decimal amounts precisely enough for display');
const html = context.DposV3.transactions.renderMinterMultisendDetailsHtml(context.DposChains.minter, tx);
assert(html.includes('<strong>Всего:</strong> 69124.9919926266669 LONG'), 'multisend details show total amount');
assert(html.includes('<strong>Получателей:</strong> 3'), 'multisend details show recipient count');
assert(html.includes('#chain=minter&amp;app=profiles&amp;account=Mx5aea138bd36a4e6019472ebbbe0a88ac2e4f9969'), 'recipient is rendered as a profile link');
assert(!html.includes('[object Object]'), 'coin object is never rendered as [object Object]');

console.log('v3 Minter multisend smoke passed');
