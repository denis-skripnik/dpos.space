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

const minterApps = sliceBetween(chainsSource, 'const minterApps = [', 'const decimalApps = [', 'Minter app registry');
assert(minterApps.includes("id: 'validators'"), 'Minter validators app is registered');
assert(minterApps.includes('Просмотр списка валидаторов'), 'Minter validators registry keeps legacy purpose');

assert(appSource.includes("isCosmosChain(chain) && effectiveAppId === 'validators'"), 'Minter validators route uses validators renderer');
assert(appSource.includes('await renderCosmosValidators(chain)'), 'validators route dispatch calls renderCosmosValidators');

const validatorsSlice = sliceBetween(appSource, 'async function renderCosmosValidators(chain) {', 'async function renderCosmosExplorer(chain, account)', 'Cosmos validators renderer');
for (const marker of [
  "chain.id === 'minter' ? `${chain.explorerBase}/validators`",
  'Number(validator.status) === 2',
  'Number(validator.status) === 1',
  'Активные валидаторы',
  'Кандидаты',
  'Публичный ключ',
  'Название',
  'Stake',
  'Мин.',
  'Комиссия',
  'copy-validator-key',
  'navigator.clipboard.writeText',
  'role="status" aria-live="polite"',
  'rawJsonDetails(\'Исходные данные валидаторов\'',
  'Формы делегирования/анбонда доступны'
]) {
  assert(validatorsSlice.includes(marker), `Minter validators renderer preserves marker: ${marker}`);
}
assert(validatorsSlice.includes('.sort((a, b) => Number(b.stake || b.power || 0) - Number(a.stake || a.power || 0))'), 'validators are sorted by descending stake like legacy uasort');
assert(validatorsSlice.includes('icon_url') && validatorsSlice.includes('site_url'), 'validators renderer preserves legacy icon/site fields');
assert(!validatorsSlice.includes('broadcast.prepare') && !validatorsSlice.includes('bindOperationForm'), 'validators page is read-only; delegate forms stay in wallet/send sections');

for (const forbidden of ['178.20.43.121', 'backend.dpos.space', 'ajax.php', 'content.php', 'index.php']) {
  assert(!validatorsSlice.includes(forbidden), `Minter validators runtime slice must not depend on forbidden legacy backend/runtime marker: ${forbidden}`);
}

assert(plan.includes('### Rigorous parity: Minter / validators'), 'plan has exact Minter / validators rigorous parity section');
for (const marker of [
  'blockchains/minter/apps/validators/config.json',
  'blockchains/minter/apps/validators/content.php',
  'https://explorer-api.minter.network/api/v2/validators',
  'Активные валидаторы',
  'Кандидаты',
  'copyText',
  'Static-only non-goals'
]) {
  assert(plan.includes(marker), `Minter validators plan evidence includes ${marker}`);
}

console.log('v3-minter-validators-smoke: ok');
