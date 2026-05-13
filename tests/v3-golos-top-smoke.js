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
assert(chains.golos.apps.some((app) => app.id === 'top'), 'Golos top app is registered again');
assert(chains.golos.apps.some((app) => app.id === 'top' && app.title === 'Топ пользователей'), 'Golos top is shown in the app selector/menu');

const golosAppsSource = chainsSource.match(/const golosApps = \[[\s\S]*?\n  \];/)?.[0] || '';
assert(golosAppsSource, 'Golos app registry slice is available');
assert(golosAppsSource.includes("id: 'top'"), 'Golos registry slice has top app entry');
assert(golosAppsSource.includes("id: 'witnesses-rewards'"), 'Neighbor Golos witnesses-rewards app remains registered');
assert(!golosAppsSource.includes("id: 'stakebot'"), 'Stakebot remains absent');

assert(/function renderGolosTop\s*\(/.test(appSource), 'Golos top renderer exists');
assert(/async function loadGolosTopRows\s*\(/.test(appSource), 'Golos top has a local RPC loader');
assert(/async function fetchGolosTopAccountNames\s*\(/.test(appSource), 'Golos top discovers accounts through lookup_accounts');
assert(/async function fetchGolosTopUiaBalances\s*\(/.test(appSource), 'Golos top loads UIA balances through public RPC');
assert(appSource.includes("chain.id === 'golos' && effectiveAppId === 'top'"), 'Golos top has dedicated route dispatch');
assert(appSource.includes('data-golos-top-load'), 'Golos top has an explicit load button');
assert(appSource.includes('golosTopState.loading'), 'Golos top guards duplicate loads at JS state level');
assert(appSource.includes('button.disabled = true'), 'Golos top disables the load button during load');
assert(appSource.includes('data-golos-top-progress'), 'Golos top exposes progress status');
assert(appSource.includes('normalizeGolosTopType'), 'Golos top normalizes URL type values');
assert(appSource.includes("state.type || state.topKind || 'GP'"), 'Golos top reads type=GP from URL and keeps topKind fallback');
assert(appSource.includes("name=\"type\""), 'Golos top select writes the type parameter');
assert(appSource.includes("type: normalizeGolosTopType(select.value)"), 'Golos top selection updates the URL type parameter');
assert(appSource.includes("type: 'GP'") && appSource.includes("type: 'EFFECTIVE_GP'"), 'Golos top has share-power URL type codes');
assert(appSource.includes('lookupAccounts') || appSource.includes('lookup_accounts'), 'Golos top uses account lookup RPC, not backend indexers');
assert(appSource.includes('getAccountsBalances') || appSource.includes('get_accounts_balances'), 'Golos top supports UIA balance scan');

const topSlice = appSource.slice(appSource.indexOf('const golosTopState'), appSource.indexOf('function renderGolosWitnessesRewards'));
assert(topSlice.length > 1000, 'Golos top runtime slice is isolated');
assert(!/178\.20\.43\.121|backend\.dpos\.space|\.php/.test(topSlice), 'Golos top runtime slice does not use private/backend/PHP endpoints');
assert(!/broadcast\.(prepare|broadcast)|bindOperationForm/.test(topSlice), 'Golos top is read-only and does not broadcast');

assert(planSource.includes('### Re-opened implementation: Golos / top local RPC loader'), 'plan.md records the reopened Golos top implementation');
assert(planSource.includes('No automatic load on route render'), 'plan.md records no auto-load requirement');
assert(planSource.includes('No IndexedDB/localStorage cache in this pass'), 'plan.md records no DB/cache decision');
assert(planSource.includes('Button is disabled and JS-guarded while loading'), 'plan.md records duplicate-click protection');
assert(planSource.includes('`#chain=golos&app=top&type=GP`'), 'plan.md records direct type=GP links');

console.log('Golos top local RPC smoke passed');
