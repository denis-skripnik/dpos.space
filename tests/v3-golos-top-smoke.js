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

assert(chains.golos, 'Golos chain is registered');
assert(!chains.golos.apps.some((app) => app.id === 'top'), 'Golos top app is removed from the runtime app registry');
assert(!chains.golos.apps.some((app) => app.title === 'Топ пользователей'), 'Golos top is not shown in the app selector/menu');
assert(!/function renderGolosTop\s*\(/.test(appSource), 'Golos top renderer is removed from the runtime bundle');
assert(!/const golosTopRankingOptions\b/.test(appSource), 'Golos top ranking constants are removed from the runtime bundle');
assert(!/async function loadGolosTopUiaAssets\s*\(/.test(appSource), 'Golos top UIA loader is removed and no longer affects performance');
assert(!appSource.includes("chain.id === 'golos' && effectiveAppId === 'top'"), 'Golos top has no dedicated route dispatch');
assert(!appSource.includes('golos-top-load-uia') && !appSource.includes('golos-top-uia-assets'), 'Golos top DOM/UIA hooks are removed');

const golosAppsSource = chainsSource.match(/const golosApps = \[[\s\S]*?\n  \];/)?.[0] || '';
assert(golosAppsSource, 'Golos app registry slice is available');
assert(!golosAppsSource.includes("id: 'top'"), 'Golos registry slice has no top app entry');
assert(golosAppsSource.includes("id: 'witnesses-rewards'"), 'Neighbor Golos apps remain registered after removing top');
assert(golosAppsSource.includes("id: 'stakebot'"), 'Stakebot remains registered after removing top');

assert(planSource.includes('### Decommission: Golos / top'), 'plan.md records the deliberate Golos/top removal decision');
assert(planSource.includes('Golos top removed from v3 runtime registry'), 'plan.md records registry/runtime removal evidence');

console.log('Golos top decommission smoke passed');
