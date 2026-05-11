const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const context = { window: null };
context.window = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root, 'v3/js/chains.js'), 'utf8'), context, { filename: 'v3/js/chains.js' });

const appSource = fs.readFileSync(path.join(root, 'v3/js/app.js'), 'utf8');
const plan = fs.readFileSync(path.join(root, 'plan.md'), 'utf8');
const runtimeStart = appSource.indexOf('const vizVmpPoolTokens');
const runtimeEnd = appSource.indexOf('function normalizeVizCustomProtocol');
const runtimeSlice = appSource.slice(runtimeStart, runtimeEnd);

const viz = context.DposChains.viz;
assert(viz.apps.some((app) => app.id === 'vmp' && app.accountField === false), 'VIZ vmp route is registered as account-free app');
assert(appSource.includes('function renderVizVmp'), 'VIZ vmp has a dedicated renderer');
assert(appSource.includes("chain.id === 'viz' && effectiveAppId === 'vmp'"), 'VIZ vmp has route dispatch');

for (const marker of ['USDTE', 'USDCE', 'USDTBSC', 'USDCBSC', 'DAIE', 'DAIBSC', 'BTC', 'BTCBSC', 'ETH', 'MUSD', 'HUB', 'BIP', 'VIZCHAIN']) {
  assert(runtimeSlice.includes(marker), `VIZ vmp preserves pool/token marker ${marker}`);
}
for (const marker of ['chainik.io/pool', 'explorer-api.minter.network/api/v2/pools/coins', 'receive_award', 'viz-projects', 'getAccountHistory']) {
  assert(runtimeSlice.includes(marker), `VIZ vmp preserves data-flow marker ${marker}`);
}
assert(runtimeSlice.includes('farm_calc') && runtimeSlice.includes('farm_result') && runtimeSlice.includes('farmer'), 'VIZ vmp preserves legacy form ids');
assert(runtimeSlice.includes('role="status" aria-live="polite"'), 'VIZ vmp exposes accessible result/status area');
assert(runtimeSlice.includes("appHash({ chain: 'viz', app: 'profiles'"), 'VIZ vmp links to v3 VIZ profiles');
assert(runtimeSlice.includes("appHash({ chain: 'minter', app: 'profiles'"), 'VIZ vmp links to v3 Minter profiles');
assert(!runtimeSlice.includes('broadcast.prepare'), 'VIZ vmp is read-only and does not prepare broadcasts');
assert(!runtimeSlice.includes('broadcast.broadcast'), 'VIZ vmp is read-only and does not broadcast');
assert(!runtimeSlice.includes('bindOperationForm'), 'VIZ vmp has no signing operation form');
assert(!/178\.20\.43\.121|backend\.dpos\.space|file_get_contents|\.php/.test(runtimeSlice), 'VIZ vmp runtime does not use private/PHP/backend dependencies');

assert(plan.includes('### Rigorous parity: VIZ / vmp'), 'plan has exact VIZ vmp parity section');
assert(plan.includes('blockchains/viz/apps/vmp/content.php'), 'plan records legacy vmp content inspection');
assert(plan.includes('blockchains/viz/apps/vmp/js/app.js'), 'plan records legacy vmp JS inspection');
assert(plan.includes('tests/v3-viz-vmp-smoke.js'), 'plan records focused vmp smoke coverage');
assert(plan.includes('explorer-api.minter.network') && plan.includes('receive_award') && plan.includes('viz-projects'), 'plan matrix captures Minter provider API and VIZ award scan');

console.log('v3 VIZ vmp smoke passed');
