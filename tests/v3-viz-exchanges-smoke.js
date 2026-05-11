const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const appSource = fs.readFileSync(path.join(root, 'v3/js/app.js'), 'utf8');
const chainsSource = fs.readFileSync(path.join(root, 'v3/js/chains.js'), 'utf8');
const planSource = fs.readFileSync(path.join(root, 'plan.md'), 'utf8');
const legacyConfig = fs.readFileSync(path.resolve(root, '../dpos.space/blockchains/viz/apps/exchanges/config.json'), 'utf8');
const legacyContent = fs.readFileSync(path.resolve(root, '../dpos.space/blockchains/viz/apps/exchanges/content.php'), 'utf8');
const legacyIndex = fs.readFileSync(path.resolve(root, '../dpos.space/blockchains/viz/apps/exchanges/index.php'), 'utf8');

assert(legacyConfig.includes('Купить и продать VIZ') && legacyConfig.includes('Обмен VIZ'), 'legacy exchanges config inspected');
assert(legacyContent.includes('https://swap.viz.world/') && legacyContent.includes('рудекс') && legacyContent.includes('readdle.me'), 'legacy static exchange links inspected');
assert(legacyIndex.includes('NOTLOAD') && !legacyIndex.includes('require'), 'legacy index has no app runtime beyond guard');

assert(chainsSource.includes("id: 'exchanges'") && chainsSource.includes('Обмен VIZ'), 'VIZ exchanges app route registered');
assert(appSource.includes('function renderVizExchanges(chain)'), 'v3 has dedicated exchanges renderer');
assert(appSource.includes('https://swap.viz.world/') && appSource.includes('покупка-viz-за-usdt-на-бирже-рудекс') && appSource.includes('https://readdle.me/#viz://@denis-skripnik/60937915/publication/'), 'v3 preserves exact legacy exchange links');
assert(appSource.includes("chain.id === 'viz' && effectiveAppId === 'exchanges'"), 'router dispatches VIZ exchanges renderer');
const exchangesStart = appSource.indexOf('function renderVizExchanges');
const exchangesEnd = appSource.indexOf('function htmlToMarkdownLikeText', exchangesStart);
const exchangesSlice = appSource.slice(exchangesStart, exchangesEnd);
assert(!/backend\.dpos\.space|178\.20\.43\.121|blockchains\/viz\/apps\/exchanges|\.php/.test(exchangesSlice), 'VIZ exchanges runtime does not call legacy PHP/private backend paths');
assert(!/broadcast\.prepare|bindOperationForm|fetch\(/.test(exchangesSlice), 'VIZ exchanges remains static read-only links only');
assert(planSource.includes('### Rigorous parity: VIZ / exchanges'), 'plan contains VIZ exchanges parity section');
assert(planSource.includes('swap.viz.world') && planSource.includes('static direct links') && planSource.includes('read-only'), 'plan documents static direct links and read-only classification');

console.log('v3 VIZ exchanges smoke passed');
