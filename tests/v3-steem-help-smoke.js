const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const appSource = fs.readFileSync(path.join(root, 'v3/js/app.js'), 'utf8');
const chainsSource = fs.readFileSync(path.join(root, 'v3/js/chains.js'), 'utf8');
const planSource = fs.readFileSync(path.join(root, 'plan.md'), 'utf8');
const legacyConfig = fs.readFileSync(path.resolve(root, '../dpos.space/blockchains/steem/apps/help/config.json'), 'utf8');
const legacyContent = fs.readFileSync(path.resolve(root, '../dpos.space/blockchains/steem/apps/help/content.php'), 'utf8');
const legacyIndex = fs.readFileSync(path.resolve(root, '../dpos.space/blockchains/steem/apps/help/index.php'), 'utf8');

const sandbox = { window: {} };
vm.runInNewContext(chainsSource, sandbox);
const steem = sandbox.window.DposChains.steem;

assert(legacyConfig.includes('Справка по dpos.space') && legacyConfig.includes('Справка'), 'legacy help config inspected');
assert(legacyContent.includes('location.replace') && legacyContent.includes('steemit.com/hive-176147/@lllll1ll/obzor-servisov-prilozheniya-dpos-space-dlya-blokcheina-steem'), 'legacy help redirect inspected');
assert(legacyIndex.includes('NOTLOAD'), 'legacy help index guard inspected');

assert(steem.apps.some((app) => app.id === 'help' && app.title === 'Справка'), 'Steem help route is registered');
assert(appSource.includes('function renderSteemHelp(chain)'), 'v3 has dedicated Steem help renderer');
assert(appSource.includes("chain.id === 'steem' && effectiveAppId === 'help'"), 'router dispatches Steem help to dedicated renderer');
assert(appSource.includes('https://steemit.com/hive-176147/@lllll1ll/obzor-servisov-prilozheniya-dpos-space-dlya-blokcheina-steem'), 'v3 preserves legacy help target as explicit link');
assert(appSource.includes('Legacy Steem help автоматически перенаправлял браузер'), 'v3 documents redirect replacement');
assert(appSource.includes('Steem справка открыта как явная статическая ссылка без auto-redirect.'), 'v3 announces static help status');
const helpStart = appSource.indexOf('function renderSteemHelp');
const helpEnd = appSource.indexOf('function renderVizExchanges', helpStart);
assert(helpStart >= 0 && helpEnd > helpStart, 'Steem help runtime slice is bounded');
const helpSlice = appSource.slice(helpStart, helpEnd);
assert(!/backend\.dpos\.space|178\.20\.43\.121|blockchains\/steem\/apps\/help|\.php/.test(helpSlice), 'Steem help runtime does not call legacy PHP/private backend paths');
assert(!/location\.replace|broadcast\.prepare|bindOperationForm/.test(helpSlice), 'Steem help is explicit static link and read-only');
assert(planSource.includes('### Rigorous parity: Steem / help'), 'plan contains Steem help parity section');
assert(planSource.includes('location.replace') && planSource.includes('explicit static link') && planSource.includes('read-only'), 'plan documents redirect replacement and read-only non-goal');

console.log('v3 Steem help smoke passed');
