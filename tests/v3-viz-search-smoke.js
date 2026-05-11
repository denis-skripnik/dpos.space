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
const plan = fs.readFileSync(path.join(root, 'plan.md'), 'utf8');
const runtimeStart = appSource.indexOf('function buildVizSearchMemo');
const runtimeEnd = appSource.indexOf('const vizTopRankingOptions');
const runtimeSlice = appSource.slice(runtimeStart, runtimeEnd);

const viz = context.DposChains.viz;
assert(viz.apps.some((app) => app.id === 'search'), 'VIZ search route is registered');
assert(appSource.includes('function renderVizSearch'), 'VIZ search has a dedicated renderer');
assert(appSource.includes("chain.id === 'viz' && effectiveAppId === 'search'"), 'VIZ search has route dispatch');
assert(appSource.includes('searchPage') && appSource.includes('searchType') && appSource.includes('query'), 'VIZ search keeps page/type/query hash state');

for (const marker of ['full_search', 'unfull_search', 'add-link', 'viz://', 'ipfs://', 'https://ipfs.io/ipfs/', 'hackathon-on-internet-freedom.github.io/Free-Speech-Project/dapp.html#']) {
  assert(runtimeSlice.includes(marker), `VIZ search preserves legacy marker ${marker}`);
}
assert(runtimeSlice.includes('viz-api?service=links'), 'VIZ search documents exact backend service as evidence');
assert(runtimeSlice.includes('backend-only non-goal'), 'VIZ search classifies backend search index as backend-only non-goal');
assert(runtimeSlice.includes('viz-search-form') && runtimeSlice.includes('viz-search-add-link-form'), 'VIZ search has find and add-link forms');
assert(runtimeSlice.includes('targetAccount = \'committee\''), 'VIZ search add-link sends legacy award to committee');
assert(runtimeSlice.includes('`${keyword}~${link}~${inlink}`'), 'VIZ search add-link preserves keyword~link~inlink memo protocol');
assert(runtimeSlice.includes("broadcast.prepare(chain, 'regular', 'award'"), 'VIZ search add-link uses explicit VIZ award operation');
assert(runtimeSlice.includes('role="status" aria-live="polite"'), 'VIZ search exposes accessible status');

assert(!/178\.20\.43\.121|backend\.dpos\.space|file_get_contents|fetch\([^)]*viz-api|\.php/.test(runtimeSlice), 'VIZ search runtime does not fetch private/PHP/backend dependencies');

assert(plan.includes('### Rigorous parity: VIZ / search'), 'plan has exact VIZ search parity section');
assert(plan.includes('blockchains/viz/apps/search/content.php'), 'plan records legacy search content inspection');
assert(plan.includes('blockchains/viz/apps/search/pages/other/search.php'), 'plan records backend search results inspection');
assert(plan.includes('blockchains/viz/apps/search/pages/add/content.php'), 'plan records add-link inspection');
assert(plan.includes('tests/v3-viz-search-smoke.js'), 'plan records focused search smoke coverage');
assert(plan.includes('viz-api?service=links') && plan.includes('award') && plan.includes('keyword~link~inlink'), 'plan matrix captures backend search and add-link award protocol');

console.log('v3 VIZ search smoke passed');
