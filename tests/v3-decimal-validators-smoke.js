const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const appSource = fs.readFileSync(path.join(root, 'v3/js/app.js'), 'utf8');
const chainsSource = fs.readFileSync(path.join(root, 'v3/js/chains.js'), 'utf8');
const broadcastSource = fs.readFileSync(path.join(root, 'v3/js/broadcast.js'), 'utf8');
const profilesSource = fs.readFileSync(path.join(root, 'v3/js/profiles.js'), 'utf8');
const historySource = fs.readFileSync(path.join(root, 'v3/js/history.js'), 'utf8');
const plan = fs.readFileSync(path.join(root, 'plan.md'), 'utf8');

function sliceBetween(source, start, end, label) {
  const startIndex = source.indexOf(start);
  assert(startIndex >= 0, `${label}: start marker missing: ${start}`);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert(endIndex > startIndex, `${label}: end marker missing after start: ${end}`);
  return source.slice(startIndex, endIndex);
}

const decimalApps = sliceBetween(chainsSource, 'const decimalApps = [', 'const chains = {', 'Decimal app registry');
assert(decimalApps.includes("id: 'validators'"), 'Decimal validators app is registered');
assert(decimalApps.includes('Просмотр валидаторов'), 'Decimal validators registry keeps legacy purpose');
assert(chainsSource.includes("apiBase: 'https://api.decimalchain.com/api/v1'"), 'Decimal public API base is configured');

assert(appSource.includes("isCosmosChain(chain) && effectiveAppId === 'validators'"), 'Decimal validators route uses validators renderer');
assert(appSource.includes('await renderCosmosValidators(chain)'), 'validators route dispatch calls renderCosmosValidators');

const validatorsSlice = sliceBetween(appSource, 'async function renderCosmosValidators(chain) {', 'async function renderCosmosExplorer(chain, account)', 'Cosmos validators renderer');
for (const marker of [
  "`${chain.apiBase}/validators/validators`",
  "Result",
  "kind === 'Approved'",
  "kind !== 'Approved'",
  'evmAddress',
  'skippedBlocks',
  'formatDecimalAmount',
  'DEL',
  'Активные валидаторы',
  'Кандидаты',
  'Адрес',
  'Название',
  'Stake',
  'Мин.',
  'Комиссия',
  'Пропущено блоков',
  'copy-validator-key',
  'navigator.clipboard.writeText',
  'role="status" aria-live="polite"',
  'rawJsonDetails(\'Исходные данные валидаторов\'',
  'Legacy Decimal validators читали публичный endpoint https://api.decimalchain.com/api/v1/validators/validators'
]) {
  assert(validatorsSlice.includes(marker), `Decimal validators renderer preserves marker: ${marker}`);
}
assert(validatorsSlice.includes('sortDecimalValidatorsByStake'), 'Decimal validators use string-safe stake sorting for 1e18 amounts');
assert(validatorsSlice.includes('formatDecimalPercent'), 'Decimal validators format fractional fee as percent like legacy');
assert(!validatorsSlice.includes('broadcast.prepare') && !validatorsSlice.includes('bindOperationForm'), 'validators page is read-only; delegate forms stay in wallet/send sections');

for (const forbidden of ['178.20.43.121', 'backend.dpos.space', 'ajax.php', 'content.php', 'index.php']) {
  assert(!validatorsSlice.includes(forbidden), `Decimal validators runtime slice must not depend on forbidden legacy backend/runtime marker: ${forbidden}`);
}

assert(!broadcastSource.includes('backend.dpos.space'), 'Decimal validators did not add backend calls to broadcast helpers');
assert(!profilesSource.includes('backend.dpos.space'), 'Decimal validators did not add backend calls to profile helpers');
assert(!historySource.includes('backend.dpos.space'), 'Decimal validators did not add backend calls to history helpers');

assert(plan.includes('### Rigorous parity: Decimal / validators'), 'plan has exact Decimal / validators rigorous parity section');
for (const marker of [
  'blockchains/decimal/apps/validators/config.json',
  'blockchains/decimal/apps/validators/content.php',
  'blockchains/decimal/apps/validators/index.php',
  'blockchains/decimal/js/blockchain.js',
  'https://api.decimalchain.com/api/v1/validators/validators',
  'Approved',
  'evmAddress',
  'skippedBlocks',
  'Static-only non-goals',
  'tests/v3-decimal-validators-smoke.js',
  'Next app recommendation: Decimal / explorer'
]) {
  assert(plan.includes(marker), `Decimal validators plan evidence includes ${marker}`);
}

console.log('v3-decimal-validators-smoke: ok');
