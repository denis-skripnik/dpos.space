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
const planSource = fs.readFileSync(path.join(root, 'plan.md'), 'utf8');

assert(chains.steem, 'Steem chain is registered');
const autoApp = chains.steem.apps.find((app) => app.id === 'auto-upvoter');
assert(autoApp, 'Steem auto-upvoter app is registered');
assert(/авто/i.test(autoApp.title), 'Steem auto-upvoter title is Russian and descriptive');
assert(/posting/i.test(autoApp.description), 'Steem auto-upvoter description warns about posting key use');
assert(/без донат/i.test(autoApp.description), 'Steem auto-upvoter description documents no donations');
assert(appSource.includes("(chain.id === 'golos' || isHiveOrSteem(chain)) && effectiveAppId === 'auto-upvoter'"), 'router dispatches Steem auto-upvoter route');
assert(appSource.includes('dpos_${chain && chain.id || \'social\'}_auto_upvoter_settings'), 'Steem settings key is derived from chain id');
assert(appSource.includes('В ${escapeHtml(chain.title)} донатов нет') && appSource.includes('только vote-операции'), 'Steem UI explicitly states donations are unavailable and only votes are sent');
assert(appSource.includes('autoDonate: isGolos && Boolean'), 'Steem collected settings forcibly disable autoDonate');
assert(appSource.includes('const donateLink = isGolos && action && action.author'), 'manual donate links are hidden for Steem');
assert(appSource.includes('const donateAction = isGolos && action && action.donate && action.donate.enabled'), 'scanner donate enrichment is disabled for Steem');
assert(appSource.includes('socialPostPageUrl(chain, action && action.author, action && action.permlink)'), 'Steem auto-upvoter feed links to the in-app Steem post viewer');
assert(!/Steem[\s\S]{0,200}Личный пул автодоната/.test(appSource), 'Steem-specific copy does not expose Golos personal-pool auto-donate');
assert(planSource.includes('dpos_steem_auto_upvoter_settings'), 'plan records Steem settings key');
assert(planSource.includes('Hive/Steem UI and scanner create only vote actions; there are no donate controls or links.'), 'plan definition of done forbids donate controls/links');

const settings = [
  { account: 'alice', enabled: true, curators: ['curator'], favorites: ['favorite'], favoritesPercent: 50, autoDonate: false },
  { account: 'bob', enabled: true, curators: ['curator'], favorites: [], curatorMode: 'full', autoDonate: false }
];
const deduped = helpers.dedupePlannedActions(helpers.planActionsForEvents(settings, [
  { kind: 'curator_vote', voter: 'curator', author: 'target', permlink: 'same', weight: 10000, accountEnergy: 10000 },
  { kind: 'favorite_post', author: 'favorite', permlink: 'same', activeVotes: [] }
], { seen: new Set() }), new Set());
assert(deduped.some((action) => action.account === 'alice' && action.type === 'vote'), 'Steem helper path plans vote actions');
assert(deduped.every((action) => !action.donate), 'Steem planned actions have no donate payload when autoDonate is false');

console.log('v3 Steem auto-upvoter smoke passed');
