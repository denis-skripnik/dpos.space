const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = fs.readFileSync(path.join(__dirname, '../v3/js/app.js'), 'utf8');
function functionSource(name) {
  let start = source.indexOf(`function ${name}(`);
  if (start < 0) start = source.indexOf(`async function ${name}(`);
  assert(start >= 0, `${name} must exist`);
  let depth = 0;
  let body = false;
  for (let i = start; i < source.length; i += 1) {
    if (source[i] === '{') { depth += 1; body = true; }
    if (source[i] === '}') depth -= 1;
    if (body && depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`Cannot extract ${name}`);
}

const context = {};
vm.runInNewContext(`${functionSource('walletDecimalParts')};${functionSource('walletExactAsset')};this.parts=walletDecimalParts;this.asset=walletExactAsset;`, context);
assert.deepStrictEqual(Array.from(context.parts('9007199254740993.00000001', 8)), ['9007199254740993', '00000001']);
assert.strictEqual(context.asset('9007199254740993.00000001', 8, 'TOKEN'), '9007199254740993.00000001 TOKEN');
assert.strictEqual(context.asset('1.2', 3, 'VIZ'), '1.200 VIZ');
assert.throws(() => context.asset('1.2345', 3, 'VIZ'), /не более 3/);

const enhancement = functionSource('enhanceWalletForms');
assert(enhancement.includes("button.textContent = 'Мне'"), 'recipient controls use visible Мне label');
assert(enhancement.includes('authorizedRecipient'), 'recipient fill is sourced from authorized chain identity');
assert(enhancement.includes("input.type = 'number'"), 'wallet monetary controls become native number inputs');
assert(enhancement.includes('walletMonetaryPrecision'), 'monetary input precision is assigned per field/token');

for (const renderer of ['renderGolosWallet', 'renderVizWallet', 'renderHiveWallet', 'renderSteemWallet', 'renderMinterWallet', 'renderDecimalWallet']) {
  const section = functionSource(renderer);
  assert(section.includes('enhanceWalletForms('), `${renderer} must enhance all rendered wallet modal forms`);
}
assert((source.match(/enhanceWalletForms\(chain, appEl, currentWalletRecipient\(chain\)\)/g) || []).length >= 2, 'seed wallets use the derived authorized chain address for Мне');
assert(!functionSource('normalizeGolosTokenAmount').includes('Number(text).toFixed'), 'Golos TIP/UIA amount formatting must not round through Number');
assert(!functionSource('normalizeHumanAssetInput').includes('number.toFixed'), 'VIZ human asset formatting must be exact');

console.log('v3 wallet UX 31 behavior passed');
