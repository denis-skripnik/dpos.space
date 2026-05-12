const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const context = { window: null, console, setTimeout, clearTimeout };
context.window = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root, 'v3/js/chains.js'), 'utf8'), context, { filename: 'v3/js/chains.js' });
vm.runInContext(fs.readFileSync(path.join(root, 'v3/js/auto-upvoter.js'), 'utf8'), context, { filename: 'v3/js/auto-upvoter.js' });

const chains = context.DposChains;
const helpers = context.DposGolosAutoUpvoter;
const appSource = fs.readFileSync(path.join(root, 'v3/js/app.js'), 'utf8');
const chainsSource = fs.readFileSync(path.join(root, 'v3/js/chains.js'), 'utf8');
const planSource = fs.readFileSync(path.join(root, 'plan.md'), 'utf8');

assert(chains.hive, 'Hive chain is registered');
const autoApp = chains.hive.apps.find((app) => app.id === 'auto-upvoter');
assert(autoApp, 'Hive auto-upvoter app is registered');
assert(/авто/i.test(autoApp.title), 'Hive auto-upvoter title is Russian and descriptive');
assert(/posting/i.test(autoApp.description), 'Hive auto-upvoter description warns about posting key use');
assert(/без донат/i.test(autoApp.description), 'Hive auto-upvoter description documents no donations');
assert(chainsSource.includes("id: 'auto-upvoter'") && chainsSource.includes('Hive/Steem') && chainsSource.includes('без донатов'), 'shared social registry contains no-donate auto-upvoter app');
assert(appSource.includes("(chain.id === 'golos' || isHiveOrSteem(chain)) && effectiveAppId === 'auto-upvoter'"), 'router dispatches Hive auto-upvoter route');
assert(appSource.includes('function autoUpvoterSettingsKey(chain)') && appSource.includes('dpos_${chain && chain.id || \'social\'}_auto_upvoter_settings'), 'auto-upvoter settings are per-chain');
assert(appSource.includes("dpos_hive_auto_upvoter_settings") || appSource.includes("dpos_${chain && chain.id || 'social'}_auto_upvoter_settings"), 'Hive settings use dpos_hive_auto_upvoter_settings at runtime');
assert(appSource.includes('В ${escapeHtml(chain.title)} донатов нет') && appSource.includes('только vote-операции'), 'Hive UI explicitly states donations are unavailable and only votes are sent');
assert(appSource.includes('isGolos ? `<div class="field">') && appSource.includes('Личный пул автодоната GOLOS'), 'Golos donate controls are guarded by isGolos');
assert(appSource.includes('const donateLink = isGolos && action && action.author'), 'manual donate links are hidden for Hive');
assert(appSource.includes('const donateAction = isGolos && action && action.donate && action.donate.enabled'), 'scanner donate enrichment is disabled for Hive');
assert(appSource.includes('socialPostPageUrl(chain, action && action.author, action && action.permlink)'), 'Hive auto-upvoter feed links to the in-app Hive post viewer');
assert(appSource.includes('getDiscussionsByBlog') && appSource.includes('getDiscussionsByCreated') && appSource.includes('getAccountHistory') && appSource.includes('getContent'), 'Hive scanner adapter uses public condenser RPC methods');
assert(planSource.includes('### Scoped plan: Hive/Steem auto-upvoter without donations'), 'plan records Hive/Steem auto-upvoter scope');
assert(planSource.includes('Hard non-goal: no donations for Hive/Steem') && planSource.includes('dpos_hive_auto_upvoter_settings'), 'plan records no-donate requirement and Hive settings key');

const planned = helpers.planActionsForEvents([
  { account: 'alice', enabled: true, curators: ['curator'], favorites: ['favorite'], favoritesPercent: 42, autoDonate: false }
], [
  { kind: 'curator_vote', voter: 'curator', author: 'target', permlink: 'vote', weight: 8000, accountEnergy: 9000 },
  { kind: 'favorite_post', author: 'favorite', permlink: 'post', activeVotes: [] }
], { seen: new Set() });
assert(planned.length >= 2, 'generic helper still plans Hive vote actions');
assert(planned.every((action) => !action.donate), 'Hive planned actions have no donate payload when autoDonate is false');

console.log('v3 Hive auto-upvoter smoke passed');
