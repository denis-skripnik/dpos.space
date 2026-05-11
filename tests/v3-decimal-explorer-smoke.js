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

function sliceBetween(source, start, end, label, options = {}) {
  const startIndex = options.last ? source.lastIndexOf(start) : source.indexOf(start);
  assert(startIndex >= 0, `${label}: start marker missing: ${start}`);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert(endIndex > startIndex, `${label}: end marker missing after start: ${end}`);
  return source.slice(startIndex, endIndex);
}

const decimalApps = sliceBetween(chainsSource, 'const decimalApps = [', 'const chains = {', 'Decimal app registry');
assert(decimalApps.includes("id: 'explorer'"), 'Decimal explorer app is registered');
assert(decimalApps.includes('Просмотр адресов, транзакций и блоков через Decimal API'), 'Decimal explorer registry keeps legacy purpose');
assert(chainsSource.includes("apiBase: 'https://api.decimalchain.com/api/v1'"), 'Decimal public API base is configured');

assert(appSource.includes("isCosmosChain(chain) && effectiveAppId === 'explorer'"), 'Decimal explorer route uses Cosmos explorer renderer');
assert(appSource.includes('await renderCosmosExplorer(chain, account)'), 'explorer route dispatch calls renderCosmosExplorer');

const explorerSlice = sliceBetween(appSource, 'async function renderCosmosExplorer(chain, account) {', 'function renderCosmosCalculator(chain)', 'Cosmos explorer renderer', { last: true });
for (const marker of [
  'Decimal проводник',
  'Введите номер блока или хэш-сумму транзакции',
  'Последние блоки',
  'Статус',
  "`${chain.apiBase}/blocks/${state.value}`",
  "`${chain.apiBase}/txs/${state.value}`",
  "`${chain.apiBase}/addresses/${state.value}/balances`",
  'renderDecimalExplorerOverview',
  'renderExplorerResult(chain, state.kind, state.value, result)',
  'role="status" aria-live="polite"'
]) {
  assert(explorerSlice.includes(marker), `Decimal explorer renderer preserves marker: ${marker}`);
}

const overviewSlice = sliceBetween(appSource, 'async function loadDecimalExplorerOverview(chain) {', 'async function renderCosmosExplorer(chain, account)', 'Decimal explorer overview helpers');
for (const marker of [
  "fetchJsonText(`${chain.apiBase}/blocks?limit=10&offset=0`, 'Decimal blocks API')",
  "fetchJsonText(`${chain.apiBase}/rpc/node_info`, 'Decimal node info API')",
  'renderDecimalExplorerOverview',
  'last_blocks',
  'Последние блоки',
  'Статус',
  'txsCount',
  'emission',
  'formatDecimalAmount',
  'explorerLink(chain, \'block\'',
  'rawJsonDetails(\'Исходные данные проводника Decimal\''
]) {
  assert(overviewSlice.includes(marker), `Decimal explorer overview preserves marker: ${marker}`);
}

assert(!explorerSlice.includes('broadcast.prepare') && !explorerSlice.includes('bindOperationForm'), 'Decimal explorer is read-only; no direct broadcast forms');
for (const forbidden of ['178.20.43.121', 'backend.dpos.space', 'ajax.php', 'content.php', 'index.php', 'mainnet-gate.decimalchain.com', 'mainnet-explorer-api.decimalchain.ru']) {
  assert(!explorerSlice.includes(forbidden), `Decimal explorer runtime slice must not depend on forbidden/stale legacy backend marker: ${forbidden}`);
  assert(!overviewSlice.includes(forbidden), `Decimal explorer overview slice must not depend on forbidden/stale legacy backend marker: ${forbidden}`);
}
assert(!broadcastSource.includes('backend.dpos.space'), 'Decimal explorer did not add backend calls to broadcast helpers');
assert(!profilesSource.includes('backend.dpos.space'), 'Decimal explorer did not add backend calls to profile helpers');
assert(!historySource.includes('backend.dpos.space'), 'Decimal explorer did not add backend calls to history helpers');

assert(plan.includes('### Rigorous parity: Decimal / explorer'), 'plan has exact Decimal / explorer rigorous parity section');
for (const marker of [
  'blockchains/decimal/apps/explorer/config.json',
  'blockchains/decimal/apps/explorer/content.php',
  'blockchains/decimal/apps/explorer/index.php',
  'blockchains/decimal/apps/explorer/pages/block/content.php',
  'blockchains/decimal/apps/explorer/pages/tx/content.php',
  'https://mainnet-gate.decimalchain.com/api/blocks?limit=10&offset=0',
  'https://mainnet-explorer-api.decimalchain.ru/api/block/{height}',
  'https://mainnet-gate.decimalchain.com/api/tx/{hash}',
  'Static-only non-goals',
  'tests/v3-decimal-explorer-smoke.js',
  'Next app recommendation: Decimal / profiles'
]) {
  assert(plan.includes(marker), `Decimal explorer plan evidence includes ${marker}`);
}

console.log('v3-decimal-explorer-smoke: ok');
