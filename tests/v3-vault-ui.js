const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const elements = new Map();
function element(id) {
  if (!elements.has(id)) elements.set(id, { innerHTML: '', textContent: '', hidden: false, dataset: {}, value: '', disabled: false, addEventListener(kind, fn) { this[kind] = fn; }, focus() {}, querySelectorAll() { return []; } });
  return elements.get(id);
}
let state = 'legacy';
let options;
const c = { console, navigator: {}, document: { getElementById: element }, addEventListener() {}, dispatchEvent() {}, CustomEvent: function(name) { this.type = name; }, DposVault: { status: () => ({ state }), async migrate(value) { options = value; state = 'unlocked'; }, lock() { state = 'locked'; } } };
c.window = c;
vm.runInNewContext(fs.readFileSync('v3/js/vault-ui.js', 'utf8'), c);
(async () => {
  assert.strictEqual(c.DposVaultUI.guard(), false);
  assert(element('app').innerHTML.includes('Создайте новый пароль'));
  element('vault-password').value = 'a-new-test-password';
  element('vault-repeat').value = 'wrong';
  await element('vault-form').submit({ preventDefault() {}, submitter: { value: 'password' } });
  assert.strictEqual(options, undefined);
  assert(element('vault-message').textContent.includes('не совпадают'));
  element('vault-repeat').value = 'a-new-test-password';
  await element('vault-form').submit({ preventDefault() {}, submitter: { value: 'password' } });
  assert.strictEqual(options.password, 'a-new-test-password');
  assert.strictEqual(c.DposVaultUI.guard(), true);
  state = 'empty';
  assert.strictEqual(c.DposVaultUI.guard(), true, 'read-only first visit needs no password');
  assert.strictEqual(c.DposVaultUI.guard({ requireSetup: true }), false, 'secret saving requires protection');
  console.log('v3 vault screen behavioral tests passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
