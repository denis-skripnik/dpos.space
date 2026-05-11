const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const appSource = fs.readFileSync(path.join(root, 'v3/js/app.js'), 'utf8');
const chainsSource = fs.readFileSync(path.join(root, 'v3/js/chains.js'), 'utf8');
const broadcastSource = fs.readFileSync(path.join(root, 'v3/js/broadcast.js'), 'utf8');
const profilesSource = fs.readFileSync(path.join(root, 'v3/js/profiles.js'), 'utf8');
const planSource = fs.readFileSync(path.join(root, 'plan.md'), 'utf8');

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}`);
  assert(start >= 0, `${name} exists`);
  let depth = 0;
  let seenBody = false;
  for (let i = start; i < source.length; i += 1) {
    if (source[i] === '{') {
      depth += 1;
      seenBody = true;
    } else if (source[i] === '}') {
      depth -= 1;
      if (seenBody && depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error(`Unable to extract ${name}`);
}

const renderVizAnalytics = extractFunction(appSource, 'renderVizAnalytics');
const routeRenderer = extractFunction(appSource, 'renderRoute');
const routeAlias = extractFunction(appSource, 'legacyAppTarget');

assert(chainsSource.includes("{ id: 'analytics', title: 'Аналитика'"), 'VIZ analytics app is registered in chains.js');
assert(routeAlias.includes('return appId'), 'analytics keeps canonical legacy id without remapping');
assert(routeRenderer.includes("chain.id === 'viz' && effectiveAppId === 'analytics'"), 'VIZ analytics route dispatch exists');
assert(routeRenderer.includes('renderVizAnalytics(chain)'), 'VIZ analytics route uses dedicated renderer');

for (const marker of [
  'analytics-viz',
  'VIZ: Аналитика',
  'Автор',
  'inov8',
  '2022 год',
  '2021 год',
  '2020 год',
  '2019 год',
  '2018 год',
  'datalens.yandex/c3hgr4n693ue3',
  'datalens.yandex/lcqihrxwopkwc',
  'datalens.yandex/qhaak9837szoi',
  'datalens.yandex/8zsqzsvwlvqo0',
  'datalens.yandex/ja318lzhxucub',
  'role="status" aria-live="polite"',
  'read-only',
  'static-only',
  'Публичная RPC-альтернатива'
]) {
  assert(renderVizAnalytics.includes(marker), `VIZ analytics renders parity/static evidence: ${marker}`);
}

const analyticsRuntimeSlice = renderVizAnalytics + routeRenderer + routeAlias;
for (const forbidden of ['backend.dpos.space', '178.20.43.121', 'blockchains/viz/apps/analytics', 'sendAjax(', 'ajax.php', 'api.dpos.space']) {
  assert(!analyticsRuntimeSlice.includes(forbidden), `VIZ analytics runtime does not depend on ${forbidden}`);
}
assert(!analyticsRuntimeSlice.includes('broadcast.prepare'), 'VIZ analytics is read-only and does not prepare transactions');
assert(!analyticsRuntimeSlice.includes('broadcast.broadcast'), 'VIZ analytics is read-only and does not broadcast transactions');
assert(!analyticsRuntimeSlice.includes('bindOperationForm'), 'VIZ analytics has no operation form binding');
assert(broadcastSource.includes('prepare') && profilesSource.includes('apiCall'), 'shared helpers are present but analytics itself does not use write/broadcast flows');

for (const evidence of [
  '### Rigorous parity: VIZ / analytics',
  'blockchains/viz/apps/analytics/config.json',
  'blockchains/viz/apps/analytics/content.php',
  'blockchains/viz/apps/analytics/index.php',
  'blockchains/viz/js/blockchain.js',
  'blockchains/viz/js/modal-accounts.js',
  'blockchains/viz/js/viz.min.js',
  'Yandex DataLens',
  'c3hgr4n693ue3',
  'lcqihrxwopkwc',
  'qhaak9837szoi',
  '8zsqzsvwlvqo0',
  'ja318lzhxucub',
  'static-only',
  'read-only/no broadcast',
  'tests/v3-viz-analytics-smoke.js'
]) {
  assert(planSource.includes(evidence), `plan.md records VIZ analytics evidence: ${evidence}`);
}

console.log('v3 VIZ analytics smoke passed');
