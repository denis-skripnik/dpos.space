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
assert(minterApps.includes("id: 'swap'"), 'Minter swap is registered as a dedicated Minter app');
assert(minterApps.includes("Обмен монет и операции swap-pool"), 'Minter swap keeps legacy menu meaning: coin swap and swap-pool operations');

assert(appSource.includes("chain.id === 'minter' && (effectiveAppId === 'wallet' || effectiveAppId === 'swap' || effectiveAppId === 'my-coin')"), 'Minter swap route dispatches to the Minter-specific wallet/action renderer');

const formsSlice = sliceBetween(appSource, 'function minterSwapForms() {', 'function decimalNftForms()', 'Minter swap forms slice');
for (const marker of [
  'minter-swap-form',
  'Minter: обмен / продажа',
  'Монета к продаже',
  'Монета к покупке',
  'Сумма к продаже',
  'Минимальная сумма покупки',
  'Маршрут swap pool',
  'minter-liquidity-form',
  'Minter: ликвидность / pool',
  'Добавить ликвидность',
  'Убрать ликвидность',
  'Создать swap pool',
  'operation-result',
  'role="status" aria-live="polite"'
]) {
  assert(formsSlice.includes(marker), `Minter swap UI preserves marker: ${marker}`);
}
assert(formsSlice.includes('Legacy swap auto-quote'), 'Minter swap documents the legacy quote/pool-list behavior that is not auto-recreated');
assert(formsSlice.includes('https://explorer-api.minter.network/api/v2/pools/coins'), 'Minter swap documents public explorer route endpoint as static-safe evidence');
assert(formsSlice.includes('https://explorer-api.minter.network/api/v2/pools/providers/'), 'Minter swap documents public explorer provider endpoint as static-safe evidence');

const bindSlice = sliceBetween(appSource, 'function bindMinterWalletForms(chain) {', 'function bindDecimalWalletForms(chain)', 'Minter bind forms slice');
assert(bindSlice.includes("txType = route.length ? 'SELL_SWAP_POOL' : 'SELL'"), 'Minter swap maps pool route to SELL_SWAP_POOL and plain route to SELL');
assert(bindSlice.includes('coinToSell') && bindSlice.includes('coinToBuy') && bindSlice.includes('valueToSell') && bindSlice.includes('minimumValueToBuy'), 'Minter plain swap payload preserves legacy sell/buy fields');
assert(bindSlice.includes('coins: [from].concat(route).concat([to])'), 'Minter routed swap payload includes from-route-to coin path');
assert(bindSlice.includes("mode === 'CREATE_SWAP_POOL' ? 'volume1' : 'maximumVolume1'"), 'Minter liquidity preserves create-pool/add-liquidity param names');
assert(bindSlice.includes("mode === 'REMOVE_LIQUIDITY'"), 'Minter liquidity preserves remove liquidity mode');
assert(bindSlice.includes("broadcast.prepare(chain, 'seed', 'minterTx'"), 'Minter swap/liquidity are direct client-side wallet broadcasts, not a server service');

const focusedRuntime = [minterApps, formsSlice, bindSlice].join('\n');
for (const forbidden of ['178.20.43.121', 'backend.dpos.space', 'ajax.php', 'content.php', 'index.php']) {
  assert(!focusedRuntime.includes(forbidden), `Minter swap runtime slice must not depend on forbidden legacy backend/runtime marker: ${forbidden}`);
}

assert(plan.includes('### Rigorous parity: Minter / swap'), 'plan has exact Minter / swap rigorous parity section');
for (const marker of [
  'blockchains/minter/apps/swap/config.json',
  'blockchains/minter/apps/swap/content.php',
  'blockchains/minter/apps/swap/js/app.js',
  'SELL_SWAP_POOL',
  'ADD_LIQUIDITY',
  'REMOVE_LIQUIDITY',
  'CREATE_SWAP_POOL',
  'Static-only non-goals'
]) {
  assert(plan.includes(marker), `Minter swap plan evidence includes ${marker}`);
}

console.log('v3-minter-swap-smoke: ok');
