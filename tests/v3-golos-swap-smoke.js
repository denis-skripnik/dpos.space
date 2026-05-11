const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const appSource = fs.readFileSync(path.join(root, 'v3/js/app.js'), 'utf8');
const broadcastSource = fs.readFileSync(path.join(root, 'v3/js/broadcast.js'), 'utf8');
const context = { window: null };
context.window = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root, 'v3/js/chains.js'), 'utf8'), context, { filename: 'v3/js/chains.js' });
const chains = context.DposChains;
const planSource = fs.readFileSync(path.join(root, 'plan.md'), 'utf8');

function extractFunction(name) {
  const marker = `function ${name}`;
  const start = appSource.indexOf(marker);
  assert(start >= 0, `${name} exists`);
  const next = appSource.indexOf('\n  function ', start + marker.length);
  return appSource.slice(start, next >= 0 ? next : appSource.length);
}

assert.strictEqual(chains.golos.dexPath, 'v3/vendor/golos/golos-dex.min.js', 'Golos config points at vendored DEX helper');
assert(fs.existsSync(path.join(root, chains.golos.dexPath)), 'vendored Golos DEX helper is present');

const direct = extractFunction('buildGolosDirectExchangePrepared');
assert(direct.includes("dex.getExchange({"), 'direct swap gets a Golos DEX quote before preparing operations');
assert(direct.includes("direction: 'sell'"), 'direct swap preserves legacy sell-side quote direction');
assert(direct.includes("path.res") && direct.includes('endsWith(` ${buySymbol}`)'), 'direct swap verifies the quoted output asset matches the requested buy token');
assert(direct.includes('dex.makeExchangeTx(path.steps, { owner, fill_or_kill: true })'), 'direct swap builds fill_or_kill operations from DEX steps');
assert(direct.includes("broadcast.prepare(chain, 'active', 'sendOperations'"), 'direct swap sends the prepared operation chain with active authority');
assert(direct.includes('steps: path.steps'), 'direct swap preview exposes DEX steps without private keys');

const dexBootstrap = extractFunction('ensureGolosDex');
assert(dexBootstrap.includes('new global.GolosDexApi(client'), 'GolosDexApi is instantiated when golos.libs.dex is missing');
assert(dexBootstrap.includes("host: 'https://api-dex.golos.app'"), 'DEX helper uses public Golos API host, not dpos.space backend');

const tokenLoader = extractFunction('loadGolosSwapAccountAssets');
assert(tokenLoader.includes('api.getAccountsAsync([account])'), 'swap token loader reads GOLOS/GBG balances from account RPC');
assert(tokenLoader.includes('api.getAccountsBalancesAsync([account])'), 'swap token loader reads UIA account balances from public RPC');
assert(tokenLoader.includes('fetchAllGolosAssets(api, 200)'), 'swap token loader reads UIA metadata/whitelist from public RPC');

const buySymbols = extractFunction('golosSwapBuySymbolsForSell');
assert(buySymbols.includes('symbols_whitelist'), 'buy-token choices honor legacy UIA symbols_whitelist rules');
assert(buySymbols.includes("if (sell !== 'GOLOS') symbols.add('GOLOS')") && buySymbols.includes("if (sell !== 'GBG') symbols.add('GBG')"), 'buy-token choices preserve GOLOS/GBG fallback pair selection');

assert(appSource.includes('golos-swap-load-tokens'), 'Golos swap UI has explicit token/balance loader');
assert(appSource.includes('golos-swap-max-amount'), 'Golos swap UI exposes legacy maximum amount hint');
assert(appSource.includes('list="golos-swap-sell-symbols"') && appSource.includes('list="golos-swap-buy-symbols"'), 'Golos swap token fields use accessible datalist pair selection');
assert(appSource.includes('loadGrapheneOrderBook') && appSource.includes("profiles.apiCall(connection, 'getOrderBook'"), 'swap order book uses public RPC');
assert(appSource.includes('loadGrapheneOpenOrders') && appSource.includes("profiles.apiCall(connection, 'getOpenOrders'"), 'my-orders view uses public RPC open orders');
assert(appSource.includes('swap-cancel-form') && appSource.includes("broadcast.prepare(chain, 'active', 'cancelOrder'"), 'cancel order form prepares active cancelOrder operation');
assert(appSource.includes('swap-create-form') && appSource.includes("broadcast.prepare(chain, 'active', 'createLimitOrder'"), 'limit order form prepares active createLimitOrder operation');
assert(appSource.includes('id="swap-direct-details" class="operation-details"'), 'Golos direct market exchange form is collapsed under operation details');
assert(appSource.includes('id="swap-create-details" class="operation-details"'), 'Golos limit order form is collapsed under operation details');
assert(appSource.includes('id="swap-cancel-details" class="operation-details"'), 'Golos cancel order form is collapsed under operation details');
assert(appSource.includes('data-swap-cancel-prefill'), 'Golos open-order rows expose a safe cancel prefill action');
assert(appSource.includes("openSwapCancelDetails(orderId)"), 'Golos cancel prefill opens and focuses the matching cancel form');

assert(broadcastSource.includes("if (prepared.operationName === 'sendOperations')"), 'broadcast has sendOperations execution path for DEX operation chains');
assert(broadcastSource.includes('client.broadcast.sendOperationsAsync(prepared.params[0], key)'), 'sendOperations uses operation array plus active key without exposing key in params');

const swapSection = appSource.slice(appSource.indexOf('async function loadGrapheneOrderBook'), appSource.indexOf('function renderRegister'));
assert(!swapSection.includes('backend.dpos.space'), 'v3 Golos swap implementation does not depend on backend.dpos.space');
assert(!swapSection.includes('178.20.43.121'), 'v3 Golos swap implementation does not depend on legacy private backend IP');

assert(planSource.includes('### Rigorous parity: Golos / swap'), 'plan.md contains the required Golos swap parity matrix section');
assert(planSource.includes('legacy source file: `blockchains/golos/apps/swap/js/app.js`'), 'plan matrix cites legacy swap js/app.js');
assert(planSource.includes('legacy function/handler/form/control/helper: `creationOrder`'), 'plan matrix maps legacy creationOrder direct quote flow');
assert(planSource.includes('legacy function/handler/form/control/helper: `#action_buy_token click`'), 'plan matrix maps legacy direct exchange send handler');
assert(planSource.includes('legacy function/handler/form/control/helper: `#action_create_order click`'), 'plan matrix maps legacy limit-order creation handler');
assert(planSource.includes('legacy function/handler/form/control/helper: `deleteOrder(orderid)`'), 'plan matrix maps legacy cancel handler');
assert(planSource.includes('Golos/Steem/Hive / swap / direct exchange, limit order create, order cancel'), 'UX plan records swap form matrix row');

console.log('Golos swap parity smoke checks passed');
