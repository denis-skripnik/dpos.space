const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const appSource = fs.readFileSync(path.join(root, 'v3/js/app.js'), 'utf8');

function element() {
  return {
    innerHTML: '', textContent: '', value: '', disabled: false, hidden: false,
    dataset: {}, style: {}, options: [],
    addEventListener() {}, setAttribute() {}, removeAttribute() {}, appendChild() {},
    querySelector: () => null, querySelectorAll: () => [], closest: () => null,
    hasAttribute: () => false
  };
}
const elements = new Map();
const get = id => elements.has(id) ? elements.get(id) : (elements.set(id, element()), elements.get(id));
const context = {
  console, URLSearchParams, Blob, setTimeout, clearTimeout,
  location: { hash: '#chain=viz&app=custom-generator', origin: 'https://dpos.test', hostname: 'dpos.test', pathname: '/' },
  navigator: {}, localStorage: { getItem: () => null, setItem() {}, removeItem() {}, key: () => null, length: 0 },
  addEventListener() {},
  document: { getElementById: get, querySelector: () => null, querySelectorAll: () => [], createElement: element, body: element(), head: element() },
  DposChains: { viz: { id: 'viz', title: 'VIZ', apps: [{ id: 'custom-generator', title: 'Custom' }], defaultAccount: '' } },
  DposAuth: { getUsers: () => [], getCurrentUser: () => null, getCurrentLogin: () => '', getUserLogin: () => '', getUserType: () => 'standard' },
  DposBroadcast: {}, DposProfiles: { formatError: error => error.message }, DposHistory: {}, DposNotifications: null
};
context.window = context; context.globalThis = context;
vm.createContext(context);
vm.runInContext(appSource, context, { filename: 'v3/js/app.js' });

const validation = context.DposV3.financialValidation;
assert(validation, 'financial input validation API is exposed');
const amount = new RegExp(`^(?:${validation.monetaryPattern})$`);
for (const valid of ['0', '10', '100', '1.25', '1,25']) assert(amount.test(valid), `${valid} is accepted by monetary HTML pattern`);
for (const invalid of ['', '-1', '.5', '1.', '1 000', '10 VIZ']) assert(!amount.test(invalid), `${invalid || 'empty'} is rejected by monetary HTML pattern`);
for (const id of ['minter-swap-amount', 'minter-swap-min', 'decimal-convert-amount', 'decimal-convert-min']) {
  assert(validation.renderedFinancialInputIds.includes(id), `${id} uses the approved monetary HTML attributes, including minimum receive`);
}

assert.strictEqual(validation.normalizeVizCustomProtocol('a'), 'a');
assert.strictEqual(validation.normalizeVizCustomProtocol('my-protocol'), 'my-protocol');
assert.strictEqual(validation.normalizeVizCustomProtocol('a'.repeat(32)), 'a'.repeat(32));
for (const invalid of ['', 'a'.repeat(33), 'bad protocol', 'é']) assert.throws(() => validation.normalizeVizCustomProtocol(invalid));
const customHtml = get('app').innerHTML;
const customInput = customHtml.match(/<input\b[^>]*id="viz-custom-protocol"[^>]*>/);
assert(customInput, 'custom protocol input is rendered');
const customPattern = customInput[0].match(/\bpattern="([^"]+)"/);
assert(customPattern, 'custom protocol input has HTML validation');
// Modern browsers compile HTML patterns with Unicode Sets (v), not legacy RegExp syntax.
const htmlProtocol = new RegExp(`^(?:${customPattern[1]})$`, 'v');
for (const id of ['a', 'my-protocol', 'a'.repeat(32)]) assert(htmlProtocol.test(id), `HTML accepts ${id}`);
for (const id of ['', 'a'.repeat(33), 'bad/id', 'bad protocol', 'é']) assert(!htmlProtocol.test(id), `HTML rejects ${id}`);

console.log('v3 financial HTML and VIZ custom ID validation passed');
