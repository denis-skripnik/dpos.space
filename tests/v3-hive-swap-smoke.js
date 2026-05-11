const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const context = { window: null };
context.window = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root, 'v3/js/chains.js'), 'utf8'), context, { filename: 'v3/js/chains.js' });

const chains = context.DposChains;
const appSource = fs.readFileSync(path.join(root, 'v3/js/app.js'), 'utf8');
const chainsSource = fs.readFileSync(path.join(root, 'v3/js/chains.js'), 'utf8');
const planSource = fs.readFileSync(path.join(root, 'plan.md'), 'utf8');

const hiveSwapApp = chains.hive.apps.find((app) => app.id === 'swap');
assert(hiveSwapApp, 'Hive exposes swap app route');
assert.strictEqual(hiveSwapApp.title, 'Обмен', 'Hive swap route keeps exchange title');
assert(hiveSwapApp.description.toLowerCase().includes('swap'), 'Hive swap description keeps swap meaning');

const swapSource = (appSource.match(/function renderSwap\(chain\)[\s\S]*?\n  function renderRegister/) || [''])[0];
assert(swapSource, 'test can isolate swap renderer');
assert(swapSource.includes("chain.id === 'hive'"), 'swap renderer has Hive-specific legacy parity copy');
assert(swapSource.includes('Legacy Hive swap'), 'Hive swap documents exact legacy app behavior');
assert(swapSource.includes('HIVE/HBD'), 'Hive swap preserves HIVE/HBD pair wording');
assert(swapSource.includes('История обменов'), 'Hive swap keeps a history path/link affordance');
assert(swapSource.includes('fill_or_kill=true'), 'Hive swap documents instant market fill-or-kill behavior');

for (const marker of [
  'swap-create-form',
  'swap-cancel-form',
  'swap-orderbook-load',
  'swap-open-orders-load',
  'role="status" aria-live="polite"',
  'fill or kill',
  'getOrderBook',
  'getOpenOrders',
  'createLimitOrder',
  'cancelOrder'
]) {
  assert(swapSource.includes(marker), `Hive swap renderer/binding keeps marker: ${marker}`);
}

const hiveRuntimeBundle = [chainsSource.match(/const socialApps[\s\S]*?const minterApps/)?.[0] || '', swapSource].join('\n');
assert(!hiveRuntimeBundle.includes('178.20.43.121'), 'Hive swap v3 runtime does not reference legacy private backend IP');
assert(!hiveRuntimeBundle.includes('backend.dpos.space'), 'Hive swap v3 runtime does not depend on backend.dpos.space');
assert(!/\.php\b|file_get_contents|XMLHttpRequest/.test(hiveRuntimeBundle), 'Hive swap v3 runtime has no PHP/backend dependency');

assert(planSource.includes('### Rigorous parity: Hive / swap'), 'plan.md contains required Hive/swap rigorous parity section');
for (const evidence of [
  'blockchains/hive/apps/swap/config.json',
  'blockchains/hive/apps/swap/content.php',
  'blockchains/hive/apps/swap/index.php',
  'blockchains/hive/apps/swap/js/app.js',
  'hive.api.getOrderBookAsync(100)',
  'hive.api.getOpenOrdersAsync(hive_login)',
  'hive.broadcast.limitOrderCreateAsync(active_key, hive_login, orderid, sell, buy, moment_swap, expiration)',
  'hive.broadcast.limitOrderCancelAsync(active_key, hive_login, orderid)'
]) {
  assert(planSource.includes(evidence), `plan.md records Hive swap evidence: ${evidence}`);
}

console.log('v3 Hive swap smoke passed');
