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
assert(!viz.apps.some((app) => app.id === 'top'), 'VIZ top app is removed from the runtime app registry');
assert(!viz.apps.some((app) => app.title === 'Топ пользователей'), 'VIZ top is not shown in the app selector/menu');
assert(!/function renderVizTop\s*\(/.test(appSource), 'VIZ top renderer is removed from the runtime bundle');
assert(!/const vizTopRankingOptions\b/.test(appSource), 'VIZ top ranking constants are removed from the runtime bundle');
assert(!/function renderVizTopFieldRows\s*\(/.test(appSource), 'VIZ top field documentation helper is removed');
assert(!appSource.includes("chain.id === 'viz' && effectiveAppId === 'top'"), 'VIZ top has no dedicated route dispatch');
assert(!appSource.includes('viz-top-selected-heading') && !appSource.includes('viz-top-pagination-heading'), 'VIZ top DOM hooks are removed');
assert(!appSource.includes("'topType'"), 'topType hash state is removed because no top routes remain');

const vizAppsSource = chainsSource.match(/const vizApps = \[[\s\S]*?\n  \];/)?.[0] || '';
assert(vizAppsSource, 'VIZ app registry slice is available');
assert(!vizAppsSource.includes("id: 'top'"), 'VIZ registry slice has no top app entry');
assert(vizAppsSource.includes("id: 'witnesses-rewards'"), 'VIZ witnesses-rewards remains registered after removing top');
assert(vizAppsSource.includes("id: 'search'"), 'VIZ search remains registered after removing top');

assert(plan.includes('### Decommission: VIZ / top'), 'plan records the deliberate VIZ/top removal decision');
assert(plan.includes('VIZ top removed from v3 runtime registry'), 'plan records VIZ top registry/runtime removal evidence');

console.log('v3 VIZ top decommission smoke passed');
