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
const runtimeStart = appSource.indexOf('const vizTopRankingOptions');
const runtimeEnd = appSource.indexOf('const golosWitnessRewardColumns');
const runtimeSlice = appSource.slice(runtimeStart, runtimeEnd);

const viz = context.DposChains.viz;
assert(viz, 'VIZ chain exists');
assert(viz.apps.some((app) => app.id === 'top' && app.accountField === false), 'VIZ top route is registered as account-free read-only app');
assert(appSource.includes('function renderVizTop'), 'VIZ top has a dedicated renderer');
assert(appSource.includes("chain.id === 'viz' && effectiveAppId === 'top'"), 'VIZ top has route dispatch');

for (const marker of ['shares', 'VIZ', 'effective_shares', 'received_shares', 'delegated_shares', 'vesting_withdraw_rate']) {
  assert(runtimeSlice.includes(marker), `VIZ top preserves legacy category ${marker}`);
}
for (const marker of ['Соц. капитал', 'Баланс VIZ', '% от всего соц. капитала', '% от всех VIZ', 'Предыдущая', 'Следующая', 'Последняя', '100-row']) {
  assert(runtimeSlice.includes(marker), `VIZ top documents legacy table/pagination marker ${marker}`);
}
assert(runtimeSlice.includes('viz-api?service=top'), 'VIZ top documents exact legacy backend service as evidence');
assert(runtimeSlice.includes('backend-only non-goal'), 'VIZ top classifies server leaderboard as backend-only non-goal');
assert(runtimeSlice.includes('role="status" aria-live="polite"'), 'VIZ top exposes accessible status region');
assert(runtimeSlice.includes("appHash({ chain: chain.id, app: 'profiles'"), 'VIZ top points users to static VIZ profiles as public RPC alternative');

assert(!runtimeSlice.includes('broadcast.prepare'), 'VIZ top is read-only and does not prepare broadcasts');
assert(!runtimeSlice.includes('broadcast.broadcast'), 'VIZ top is read-only and does not broadcast');
assert(!runtimeSlice.includes('bindOperationForm'), 'VIZ top has no signing operation form');
assert(!/178\.20\.43\.121|backend\.dpos\.space|file_get_contents|fetch\([^)]*viz-api|\.php/.test(runtimeSlice), 'VIZ top runtime does not fetch private/PHP/backend dependencies');

assert(plan.includes('### Rigorous parity: VIZ / top'), 'plan has exact VIZ top parity section');
assert(plan.includes('blockchains/viz/apps/top/content.php'), 'plan records legacy top content.php inspection');
assert(plan.includes('blockchains/viz/apps/top/pages/top.php'), 'plan records legacy top page inspection');
assert(plan.includes('tests/v3-viz-top-smoke.js'), 'plan records focused top smoke coverage');
assert(plan.includes('viz-api?service=top') && plan.includes('shares_percent') && plan.includes('vesting_withdraw_rate'), 'plan matrix captures top backend and ranking fields');

console.log('v3 VIZ top smoke passed');
