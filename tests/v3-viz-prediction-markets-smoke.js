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
const indexSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const vendorSource = fs.readFileSync(path.join(root, 'v3/vendor/viz/viz.min.js'), 'utf8');

// Route registered on VIZ only.
const pmApp = chains.viz.apps.find((app) => app.id === 'prediction-markets');
assert(pmApp, 'VIZ exposes prediction-markets app route');
assert.strictEqual(pmApp.title, 'Рынки предсказаний', 'VIZ prediction markets keeps the requested title');
assert.strictEqual(pmApp.accountField, true, 'VIZ prediction markets exposes the account field for positions and signing');
assert(pmApp.description.includes('prediction_market_api'), 'route documents the prediction_market_api plugin');

for (const chain of Object.values(chains)) {
  if (chain.id === 'viz') continue;
  assert(!chain.apps.some((app) => app.id === 'prediction-markets'), `${chain.id}: prediction markets must only appear in VIZ`);
}

// Dedicated renderer + router dispatch.
assert(/function renderVizPredictionMarkets\(chain, account\)/.test(appSource), 'VIZ prediction markets has a dedicated renderer');
assert(appSource.includes("chain.id === 'viz' && effectiveAppId === 'prediction-markets'"), 'VIZ prediction markets dispatches only for the VIZ chain');
assert(!/chain\.id !== 'viz'[^\n]*prediction-markets/.test(appSource), 'no inverted non-VIZ guard for prediction markets');

// Isolate the prediction markets runtime slice for focused assertions.
const slice = (appSource.match(/\/\/ ===== VIZ prediction markets[\s\S]*?\n  const vizVmpPoolTokens = \[/) || [''])[0];
assert(slice.length > 5000, 'test can isolate the VIZ prediction markets runtime slice');

for (const text of [
  'prediction_market_api',
  'pm_place_bet',
  'pm_create_market',
  'pm_add_liquidity',
  'pm_withdraw_liquidity',
  'pm_lazy_deposit',
  'pm_lazy_withdraw',
  'pm_oracle_register',
  'pm_resolve_market',
  'pm_commit_bet',
  'pm_reveal_bet',
  'pm_dispute_vote',
  'pm_leverage_open',
  "vizPmApi(ctx, 'getMarketFull'",
  "vizPmApi(ctx, 'listMarkets'",
  "'getPmChainProperties'",
  'predictionMarketCommitment',
  'Максимум',
  'data-fill-target',
  'operation-modal-source',
  'data-operation-result',
  'role="status" aria-live="polite"',
  'Рынки предсказаний',
  'Ленивый пул',
  'Оракулы'
]) {
  assert(slice.includes(text), `VIZ prediction markets runtime preserves capability/text: ${text}`);
}

// Broadcast integration reuses the shared confirm/preview flow and the vendored library.
assert(slice.includes("vizPmPrepared(chain, 'active', 'pmPlaceBet'"), 'bets use the shared active-authority broadcast helper');
assert(slice.includes("vizPmPrepared(chain, 'regular', 'pmDisputeVote'"), 'dispute votes use the VIZ regular authority');
assert(slice.includes("'pmLazyDeposit'"), 'lazy pool deposit is wired through pm_lazy_deposit');
assert(slice.includes('bindOperationForm(chain, formId'), 'operation forms are bound through the shared operation helper');

// The vendored VIZ library build must support the prediction markets protocol and API.
assert(vendorSource.includes('pm_place_bet'), 'vendored viz.min.js supports pm_place_bet');
assert(vendorSource.includes('pm_create_market'), 'vendored viz.min.js supports pm_create_market');
assert(vendorSource.includes('prediction_market_api'), 'vendored viz.min.js ships the prediction_market_api plugin methods');
assert(vendorSource.includes('predictionMarketCommitment'), 'vendored viz.min.js ships the commit-reveal commitment helper');

// Cache markers must be refreshed so the static site serves the new runtime + library.
assert(indexSource.includes('v3/js/app.js?v=20260915-viz-prediction-markets'), 'index bumps the app.js marker for the prediction markets release');

// No runtime dependency on removed legacy backend.
assert(!/fetch\(\s*['"]?http[^)]*viz-api|178\.20\.43\.121/.test(slice), 'prediction markets runtime does not call the legacy private backend');

// plan.md must record the feature.
const planSource = fs.readFileSync(path.join(root, 'plan.md'), 'utf8');
assert(planSource.includes('### VIZ prediction markets'), 'plan.md records the prediction markets section');

console.log('VIZ prediction markets static integration smoke passed');
