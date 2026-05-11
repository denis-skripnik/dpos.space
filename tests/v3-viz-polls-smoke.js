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

const pollsApp = chains.viz.apps.find((app) => app.id === 'polls');
assert(pollsApp, 'VIZ exposes polls app route');
assert.strictEqual(pollsApp.title, 'Опросы', 'VIZ polls keeps legacy title');
assert.strictEqual(pollsApp.accountField, false, 'VIZ polls does not require route account field');
assert(pollsApp.description.includes('viz-votes'), 'route documents viz-votes protocol');
assert(/function renderVizPolls\(chain/.test(appSource), 'VIZ polls has a dedicated renderer');
assert(appSource.includes("chain.id === 'viz' && effectiveAppId === 'polls'"), 'VIZ polls dispatches to the dedicated renderer');

const pollsSource = (appSource.match(/function buildVizPollCreateMemo[\s\S]*?\n  function renderServicePlaceholder/) || [''])[0];
assert(pollsSource, 'test can isolate the VIZ polls runtime slice');

for (const text of [
  '<h2>Опросы</h2>',
  'Создание опроса',
  'Список/просмотр опросов',
  'Голосование',
  'Результаты',
  'viz-votes',
  'createVote',
  'voteing',
  'votePermlink',
  'answerId',
  'committee',
  '1.000 VIZ',
  'role="status" aria-live="polite"',
  'operation-result',
  'data-operation-result',
  'backend-only non-goal',
  '178.20.43.121:3100/viz-api?service=votes',
  'История'
]) {
  assert(pollsSource.includes(text), `VIZ polls preserves/classifies legacy text/capability: ${text}`);
}

assert(/function buildVizPollCreateMemo\(question, answers, endDate, consider\)/.test(pollsSource), 'create poll memo builder exists');
assert(/function buildVizPollVoteMemo\(permlink, answerId\)/.test(pollsSource), 'vote memo builder exists');
assert(pollsSource.includes("contractName: 'viz-votes'"), 'memo uses viz-votes contractName');
assert(pollsSource.includes("contractAction: 'createVote'"), 'create memo uses createVote action');
assert(pollsSource.includes("contractAction: 'voteing'"), 'vote memo uses legacy voteing action spelling');
assert(pollsSource.includes("broadcast.prepare(chain, 'active', 'transfer'"), 'create poll uses existing active transfer broadcast helper');
assert(pollsSource.includes("broadcast.prepare(chain, 'regular', 'custom'"), 'vote uses existing regular custom broadcast helper');
assert(pollsSource.includes("bindOperationForm(chain, 'viz-polls-create-form'"), 'create form is bound through existing operation helper');
assert(pollsSource.includes("bindOperationForm(chain, 'viz-polls-vote-form'"), 'vote form is bound through existing operation helper');
assert(pollsSource.includes('id="viz-polls-create-details" class="operation-details"'), 'poll create operation form is separated in an accessible spoiler');
assert(pollsSource.includes('id="viz-polls-vote-details" class="operation-details"'), 'poll vote operation form is separated in an accessible spoiler');
assert(pollsSource.includes("appHash({ chain: chain.id, app: 'history'"), 'static replacement links to history RPC route');

const vizRuntimeBundle = [chainsSource.match(/const vizApps[\s\S]*?const golosApps/)?.[0] || '', pollsSource].join('\n');
assert(!/fetch\([^)]*viz-api|XMLHttpRequest[\s\S]{0,200}viz-api|file_get_contents/.test(vizRuntimeBundle), 'VIZ polls v3 does not runtime fetch old backend');
assert(vizRuntimeBundle.includes('178.20.43.121:3100/viz-api?service=votes'), 'old votes backend appears only as documented evidence');
assert(!vizRuntimeBundle.includes('blockchains/viz/apps/polls'), 'VIZ polls v3 does not reference old PHP app files at runtime');

assert(planSource.includes('### Rigorous parity: VIZ / polls'), 'plan.md contains required VIZ/polls rigorous parity section');
assert(planSource.includes('VIZ / polls / create+vote'), 'plan records polls operation form UX polish coverage');
assert(planSource.includes("`pages/list/content.php` backend read `file_get_contents('http://178.20.43.121:3100/viz-api?service=votes&type=list')`"), 'plan records exact list backend evidence');
assert(planSource.includes("`pages/create/page.js` built a paid transfer to `committee` for `1.000 VIZ` with memo `contractName: \"viz-votes\"`, `contractAction: \"createVote\"`"), 'plan records exact create operation evidence');
assert(planSource.includes("`pages/voteing/page.js` built custom operation id `viz-votes` / `contractAction: \"voteing\"`"), 'plan records exact vote operation evidence');
assert(planSource.includes('backend/indexer-only for listing, poll lookup, and weighted result aggregation'), 'plan classifies backend/indexer dependency');

console.log('VIZ polls static parity smoke passed');
