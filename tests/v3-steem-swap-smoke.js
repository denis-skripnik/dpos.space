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

const steemSwapApp = chains.steem.apps.find((app) => app.id === 'swap');
assert(steemSwapApp, 'Steem exposes swap app route');
assert.strictEqual(steemSwapApp.title, 'Обмен', 'Steem swap route keeps exchange title');
assert(steemSwapApp.description.toLowerCase().includes('swap'), 'Steem swap description keeps swap meaning');

const swapSource = (appSource.match(/function renderSwap\(chain\)[\s\S]*?\n  function renderRegister/) || [''])[0];
assert(swapSource, 'test can isolate swap renderer');
assert(swapSource.includes("chain.id === 'steem'"), 'swap renderer has Steem-specific legacy parity copy');
assert(swapSource.includes('Legacy Steem swap'), 'Steem swap documents exact legacy app behavior');
assert(swapSource.includes('STEEM/SBD'), 'Steem swap preserves STEEM/SBD pair wording');
assert(swapSource.includes('История обменов'), 'Steem swap keeps a history path/link affordance');

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
  assert(swapSource.includes(marker), `Steem swap renderer/binding keeps marker: ${marker}`);
}

const steemRuntimeBundle = [chainsSource.match(/const socialApps[\s\S]*?const minterApps/)?.[0] || '', swapSource].join('\n');
assert(!steemRuntimeBundle.includes('178.20.43.121'), 'Steem swap v3 runtime does not reference legacy private backend IP');
assert(!steemRuntimeBundle.includes('backend.dpos.space'), 'Steem swap v3 runtime does not depend on backend.dpos.space');
assert(!/\.php\b|file_get_contents|XMLHttpRequest/.test(steemRuntimeBundle), 'Steem swap v3 runtime has no PHP/backend dependency');

assert(planSource.includes('### Rigorous parity: Steem / swap'), 'plan.md contains required Steem/swap rigorous parity section');
for (const evidence of [
  'blockchains/steem/apps/swap/config.json',
  'blockchains/steem/apps/swap/content.php',
  'blockchains/steem/apps/swap/index.php',
  'blockchains/steem/apps/swap/js/app.js',
  'steem.api.getOrderBookAsync(100)',
  'steem.api.getOpenOrdersAsync(steem_login)',
  'steem.broadcast.limitOrderCreateAsync(active_key, steem_login, orderid, sell, buy, moment_swap, expiration)',
  'steem.broadcast.limitOrderCancelAsync(active_key, steem_login, orderid)'
]) {
  assert(planSource.includes(evidence), `plan.md records Steem swap evidence: ${evidence}`);
}

console.log('v3 Steem swap smoke passed');
