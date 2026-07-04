const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const appSource = fs.readFileSync(path.join(root, 'v3/js/app.js'), 'utf8');
const chainsSource = fs.readFileSync(path.join(root, 'v3/js/chains.js'), 'utf8');
const plan = fs.readFileSync(path.join(root, 'plan.md'), 'utf8');

function sliceBetween(source, start, end, label) {
  const startIndex = source.indexOf(start);
  assert(startIndex >= 0, `${label}: start marker missing: ${start}`);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert(endIndex > startIndex, `${label}: end marker missing after start: ${end}`);
  return source.slice(startIndex, endIndex);
}

const baseApps = sliceBetween(chainsSource, 'const baseApps = [', 'const vizApps = [', 'base app registry');
assert(baseApps.includes("id: 'broadcast'"), 'Minter broadcast is available through shared base apps');
assert(appSource.includes("chain.id === 'minter' && effectiveAppId === 'broadcast'"), 'Minter broadcast route has dedicated dispatch');
assert(appSource.includes('renderMinterBroadcast(chain)'), 'Minter broadcast route calls dedicated renderer');

const renderSlice = sliceBetween(appSource, 'function renderMinterBroadcast(chain) {', 'function parseJsonMaybeText(text, sourceLabel)', 'Minter broadcast renderer');
for (const marker of [
  'minter-signed-tx-form',
  'minter-signed-tx-details',
  'class="operation-modal-source"',
  'Готовая signed TX',
  'Проверить signed TX перед отправкой',
  'Signed TX hex/base64',
  'minterSDK.decodeTx',
  "broadcast.prepareExternal(chain, 'minterSignedTx'",
  'Расшифрованная транзакция',
  'minter-multisig-form',
  'minter-multisig-details',
  'Multisig — проверить перед отправкой',
  'Адрес multisig',
  'JSON транзакции',
  'Подписи, по одной на строку',
  'parseJsonInput',
  "broadcast.prepareExternal(chain, 'minterMultisigSubmit'",
  'role="status" aria-live="polite"'
]) {
  assert(renderSlice.includes(marker), `Minter broadcast renderer preserves marker: ${marker}`);
}
assert(renderSlice.indexOf('name="intent" value="preview"') < renderSlice.indexOf('name="intent" value="send"'), 'Minter broadcast keeps preview/check button before send button');
assert(plan.includes('### UX polish: Minter and Decimal non-wallet forms'), 'plan has exact UX polish section for Minter and Decimal non-wallet forms');
assert(plan.includes('| Minter | broadcast |') && plan.includes('tests/v3-minter-broadcast-smoke.js'), 'UX polish matrix records Minter broadcast fix and focused test');
assert(renderSlice.includes("broadcast.validateAddress(chain, form.get('multisig'), 'Адрес multisig')"), 'Minter multisig address is validated client-side');
assert(renderSlice.includes('signatures.length'), 'Minter multisig preserves signature count/validation');
assert(!renderSlice.includes("broadcast.prepare(chain, 'seed'"), 'Minter broadcast does not require seed for signed TX or external multisig submit');

for (const forbidden of ['178.20.43.121', 'backend.dpos.space', 'ajax.php', 'content.php', 'index.php']) {
  assert(!renderSlice.includes(forbidden), `Minter broadcast runtime slice must not depend on forbidden legacy backend/runtime marker: ${forbidden}`);
}

assert(plan.includes('### Rigorous parity: Minter / broadcast'), 'plan has exact Minter / broadcast rigorous parity section');
for (const marker of [
  'blockchains/minter/apps/broadcast/config.json',
  'blockchains/minter/apps/broadcast/content.php',
  'blockchains/minter/apps/broadcast/js/app.js',
  'decodeTx',
  'postSignedTx',
  'submitMultisigTX',
  'signatureType = 2',
  'Static-only non-goals'
]) {
  assert(plan.includes(marker), `Minter broadcast plan evidence includes ${marker}`);
}

console.log('v3-minter-broadcast-smoke: ok');
