const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const appSource = fs.readFileSync(path.join(root, 'v3/js/app.js'), 'utf8');
const chainsSource = fs.readFileSync(path.join(root, 'v3/js/chains.js'), 'utf8');
const planSource = fs.readFileSync(path.join(root, 'plan.md'), 'utf8');
const legacyConfig = fs.readFileSync(path.resolve(root, '../dpos.space/blockchains/viz/apps/custom-generator/config.json'), 'utf8');
const legacyContent = fs.readFileSync(path.resolve(root, '../dpos.space/blockchains/viz/apps/custom-generator/content.php'), 'utf8');
const legacyJs = fs.readFileSync(path.resolve(root, '../dpos.space/blockchains/viz/apps/custom-generator/js/app.js'), 'utf8');
const legacyGenerated = fs.readFileSync(path.resolve(root, '../dpos.space/blockchains/viz/apps/custom-generator/generated-script-to-minify.js'), 'utf8');
const legacyJsonEncode = fs.readFileSync(path.resolve(root, '../dpos.space/blockchains/viz/apps/custom-generator/json_encode.php'), 'utf8');

assert(legacyConfig.includes('Генератор custom операций') && legacyConfig.includes('JSON-генератор'), 'legacy config inspected');
assert(legacyContent.includes('ID формы') && legacyContent.includes('Название операции') && legacyContent.includes('Получить JSON текущей формы'), 'legacy builder UI inspected');
assert(legacyJs.includes('generateResultForm') && legacyJs.includes('getExampleObj') && legacyJs.includes('viz.broadcast.custom'), 'legacy generator/broadcast JS inspected');
assert(legacyGenerated.includes("xhr.open('POST', 'json_encode.php')") && legacyGenerated.includes('viz.broadcast.custom'), 'legacy generated script PHP+broadcast dependency inspected');
assert(legacyJsonEncode.includes('json_encode($_POST)'), 'legacy PHP json_encode dependency inspected');

assert(chainsSource.includes("id: 'custom-generator'") && chainsSource.includes('JSON-генератор'), 'VIZ custom-generator route registered');
assert(appSource.includes('function normalizeVizCustomProtocol'), 'v3 validates custom protocol id');
assert(appSource.includes('function normalizeVizCustomJson'), 'v3 validates custom JSON payload locally');
assert(appSource.includes('function renderVizCustomGenerator(chain)'), 'v3 has dedicated custom-generator renderer');
assert(appSource.includes('viz-custom-protocol') && appSource.includes('viz-custom-json'), 'renderer exposes protocol/json controls');
assert(appSource.includes('viz-custom-generator-preview') && appSource.includes('role="status" aria-live="polite"'), 'renderer exposes accessible preview/status region');
assert(appSource.includes("broadcast.prepare(chain, 'regular', 'custom'") && appSource.includes('VIZ custom_json'), 'v3 prepares regular custom operation through shared confirmation flow');
assert(appSource.includes("chain.id === 'viz' && effectiveAppId === 'custom-generator'"), 'router dispatches VIZ custom-generator renderer');
const customStart = appSource.indexOf('function normalizeVizCustomProtocol');
const customEnd = appSource.indexOf('function buildVizPollCreateMemo', customStart);
const customSlice = appSource.slice(customStart, customEnd);
assert(!/178\.20\.43\.121|backend\.dpos\.space|blockchains\/viz\/apps\/custom-generator/.test(customSlice), 'VIZ custom-generator runtime does not call private backend/legacy paths');
assert(!/XMLHttpRequest|fetch\(|xhr\.open/.test(customSlice), 'VIZ custom-generator runtime performs local JSON parsing, not backend fetches');
assert(planSource.includes('### Rigorous parity: VIZ / custom-generator'), 'plan contains VIZ custom-generator parity section');
assert(planSource.includes('json_encode.php') && planSource.includes('static-only non-goal'), 'plan documents PHP json_encode as static-only non-goal');
assert(planSource.includes('generated-script-to-minify.js') && planSource.includes('broadcast.prepare'), 'plan documents generated script replacement with shared v3 broadcast flow');

console.log('v3 VIZ custom-generator smoke passed');
