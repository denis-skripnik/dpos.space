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
assert(!chains.golos.apps.some((app) => app.id === 'stakebot'), 'Golos stakebot app is removed from runtime registry');
assert(!chains.golos.apps.some((app) => /stake\s*bot/i.test(app.title || '')), 'Golos stakebot is not shown in app selector/menu');
assert(!/function renderGolosStakebot\s*\(/.test(appSource), 'Golos stakebot renderer is removed from runtime bundle');
assert(!appSource.includes("chain.id === 'golos' && effectiveAppId === 'stakebot'"), 'Golos stakebot has no dedicated route dispatch');
assert(!appSource.includes('stakebotPage'), 'Golos stakebot hash subpage state is removed');
assert(!appSource.includes('golos-stake-bot') && !appSource.includes('golos_stake_bot'), 'Golos stakebot copy/account links are removed from runtime bundle');

const golosAppsSource = chainsSource.match(/const golosApps = \[[\s\S]*?\n  \];/)?.[0] || '';
assert(golosAppsSource, 'Golos app registry slice is available');
assert(!golosAppsSource.includes("id: 'stakebot'"), 'Golos registry slice has no stakebot app entry');
assert(golosAppsSource.includes("id: 'witnesses-rewards'"), 'Neighbor Golos witnesses-rewards app remains registered after removing stakebot');
assert(golosAppsSource.includes("id: 'donate'"), 'Neighbor Golos donate app remains registered after removing stakebot');

assert(planSource.includes('### Decommission: Golos / stakebot'), 'plan.md records deliberate Golos/stakebot removal decision');
assert(planSource.includes('Golos stakebot removed from v3 runtime registry'), 'plan.md records registry/runtime removal evidence');

console.log('Golos stakebot decommission smoke passed');
