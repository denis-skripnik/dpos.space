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
const chainsSource = fs.readFileSync(path.join(root, 'v3/js/chains.js'), 'utf8');
const plan = fs.readFileSync(path.join(root, 'plan.md'), 'utf8');
const viz = context.DposChains.viz;

assert(viz, 'VIZ chain exists');
assert(viz.apps.some((app) => app.id === 'top'), 'VIZ top app is registered again');
assert(viz.apps.some((app) => app.id === 'top' && app.title === 'Топ пользователей'), 'VIZ top is shown in the app selector/menu');

const vizAppsSource = chainsSource.match(/const vizApps = \[[\s\S]*?\n  \];/)?.[0] || '';
assert(vizAppsSource, 'VIZ app registry slice is available');
assert(vizAppsSource.includes("id: 'top'"), 'VIZ registry slice has top app entry');
assert(vizAppsSource.includes("id: 'witnesses-rewards'"), 'Neighbor VIZ witnesses-rewards app remains registered');
assert(vizAppsSource.includes("id: 'search'"), 'Neighbor VIZ search app remains registered');

assert(/function renderVizTop\s*\(/.test(appSource), 'VIZ top renderer exists');
assert(/async function loadVizTopRows\s*\(/.test(appSource), 'VIZ top has a local RPC loader');
assert(/async function fetchVizTopAccountNames\s*\(/.test(appSource), 'VIZ top discovers accounts through lookup_accounts');
assert(appSource.includes("chain.id === 'viz' && effectiveAppId === 'top'"), 'VIZ top has dedicated route dispatch');
assert(appSource.includes('data-viz-top-load'), 'VIZ top has an explicit load button');
assert(appSource.includes('vizTopState.loading'), 'VIZ top guards duplicate loads at JS state level');
assert(appSource.includes('button.disabled = true'), 'VIZ top disables the load button during load');
assert(appSource.includes('data-viz-top-progress'), 'VIZ top exposes progress status');
assert(appSource.includes('normalizeVizTopType'), 'VIZ top normalizes URL type values');
assert(appSource.includes("state.type || state.topType || 'shares'"), 'VIZ top reads type=shares from URL and keeps topType fallback');
assert(appSource.includes('name="type"'), 'VIZ top select writes the type parameter');
assert(appSource.includes("type: normalizeVizTopType(select.value)"), 'VIZ top selection updates the URL type parameter');

for (const marker of [
  "type: 'shares'",
  "type: 'VIZ'",
  "type: 'effective_shares'",
  "type: 'received_shares'",
  "type: 'delegated_shares'",
  "type: 'vesting_withdraw_rate'",
  'Соц. капитал',
  'Эффективный соц. капитал',
  'Получено делегированием',
  'Делегировано',
  'Выводится SHARES'
]) {
  assert(appSource.includes(marker), `VIZ top preserves marker: ${marker}`);
}

const topSlice = appSource.slice(appSource.indexOf('const vizTopState'), appSource.indexOf('const golosTopState'));
assert(topSlice.length > 1000, 'VIZ top runtime slice is detectable');
assert(topSlice.includes('lookupAccounts') || topSlice.includes('lookup_accounts'), 'VIZ top uses account lookup RPC');
assert(topSlice.includes('getAccounts') || topSlice.includes('get_accounts'), 'VIZ top loads account balances through public RPC');
assert(!topSlice.includes('get_accounts_balances'), 'VIZ top does not use Golos UIA balance API');
assert(!topSlice.includes('178.20.43.121'), 'VIZ top runtime avoids old private backend IP');
assert(!topSlice.includes('viz-api?service=top'), 'VIZ top runtime avoids old backend top endpoint');
assert(!/\.php\b/.test(topSlice), 'VIZ top runtime does not depend on PHP endpoints');
assert(!topSlice.includes('localStorage') && !topSlice.includes('indexedDB'), 'VIZ top does not add browser persistence/cache');

assert(plan.includes('### Re-opened implementation: VIZ / top local RPC loader'), 'plan records VIZ top local RPC implementation');
assert(plan.includes('`#chain=viz&app=top&type=shares`'), 'plan records VIZ top URL type route');

console.log('v3 VIZ top local RPC smoke passed');
