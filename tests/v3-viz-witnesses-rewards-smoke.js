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

const witnessesApp = chains.viz.apps.find((app) => app.id === 'witnesses-rewards');
assert(witnessesApp, 'VIZ exposes witnesses-rewards app route');
assert.strictEqual(witnessesApp.title, 'Награды валидаторов', 'VIZ witnesses-rewards uses validator title');
assert.strictEqual(witnessesApp.accountField, false, 'VIZ witnesses-rewards is read-only and does not require an account field');
assert(witnessesApp.description.includes('текущий/предыдущий день и месяц'), 'route description preserves daily/monthly reward meaning');
assert(/function renderVizWitnessesRewards\(chain\)/.test(appSource), 'VIZ witnesses-rewards has a dedicated renderer');
assert(appSource.includes("chain.id === 'viz' && effectiveAppId === 'witnesses-rewards'"), 'VIZ witnesses-rewards dispatches to the dedicated renderer');

const witnessesSource = (appSource.match(/const vizWitnessRewardColumns[\s\S]*?\n  function buildVizProjectMemo/) || [''])[0];
assert(witnessesSource, 'test can isolate the VIZ witnesses-rewards runtime slice without adjacent VIZ apps');
assert(witnessesSource.includes('<h2>Награды валидаторов</h2>'), 'renderer uses validator h2/title');
assert(witnessesSource.includes('Страница со списком валидаторов VIZ и их наград за текущий день и месяц, предыдущий день и месяц.'), 'renderer uses validator description');
assert(witnessesSource.includes('Обновление происходит в полночь по GMT'), 'renderer preserves legacy GMT update notice');
assert(witnessesSource.includes('role="status" aria-live="polite"'), 'async RPC status is announced with aria-live');
assert(witnessesSource.includes('id="viz-witnesses-rewards-load"'), 'public witness loader is explicit and keyboard-accessible as a button');
assert(witnessesSource.includes('Legacy columns for VIZ validator rewards'), 'legacy reward-column table has a caption');

for (const text of [
  'Логин',
  'за вчерашний день',
  'за сегодня',
  'за прошлый месяц',
  'за текущий месяц',
  'old_daily_profit',
  'now_daily_profit',
  'old_monthly_profit',
  'now_monthly_profit',
  'backend-only non-goal',
  'не показывает вымышленные суммы'
]) {
  assert(witnessesSource.includes(text), `VIZ witnesses-rewards preserves/classifies legacy reward text: ${text}`);
}

assert(/async function loadVizWitnessesByVote\(chain\)/.test(witnessesSource), 'dedicated public RPC validator loader exists');
assert(witnessesSource.includes("profiles.apiCall(connection, 'getValidatorsByVote', ['', 50])"), 'loader first tries getValidatorsByVote with a bounded public-RPC limit');
assert(witnessesSource.includes("profiles.apiCall(connection, 'lookupValidatorAccounts', ['', 50])"), 'loader has lookupValidatorAccounts fallback');
assert(witnessesSource.includes("profiles.apiCall(connection, 'getValidatorByAccount', [name])"), 'loader resolves fallback names through getValidatorByAccount');
assert(witnessesSource.includes('profiles.connect(chain)'), 'loader uses existing public node selection');
assert(witnessesSource.includes("appHash({ chain: chain.id, app: 'profiles'"), 'validator rows link to v3 profile hash routes');
assert(witnessesSource.includes('профиль валидатора'), 'validator profile link context is preserved in text');
assert(witnessesSource.includes('validator API'), 'renderer documents VIZ validator public RPC API');

const vizRuntimeBundle = [chainsSource.match(/const vizApps[\s\S]*?const golosApps/)?.[0] || '', witnessesSource].join('\n');
assert(!vizRuntimeBundle.includes('178.20.43.121'), 'VIZ witnesses-rewards v3 runtime does not reference the legacy private backend IP');
assert(!vizRuntimeBundle.includes('backend.dpos.space'), 'VIZ witnesses-rewards v3 runtime does not depend on backend.dpos.space');
assert(!/fetch\([^)]*viz-api|XMLHttpRequest[\s\S]{0,200}viz-api|file_get_contents/.test(vizRuntimeBundle), 'VIZ witnesses-rewards v3 has no runtime old witnesses backend fetch');
assert(witnessesSource.includes('viz-api?service=witnesses'), 'old service name is present only as documented backend-only evidence');
assert(!/private_key|posting_key|active_key|seed phrase|transaction preview|send operation/i.test(witnessesSource), 'read-only VIZ witnesses-rewards route does not ask for keys or expose transaction sending');
assert(!/bindOperationForm|broadcast\.prepare|broadcast\.broadcast/.test(witnessesSource), 'read-only VIZ witnesses-rewards slice has no v3 broadcast binding');

assert(planSource.includes('### Rigorous parity: VIZ / witnesses-rewards'), 'plan.md contains required VIZ/witnesses-rewards rigorous parity section');
assert(planSource.includes("`content.php` backend read `file_get_contents('http://178.20.43.121:3100/viz-api?service=witnesses')`"), 'plan records exact old private backend evidence');
assert(planSource.includes("`content.php` table header `за вчерашний день`; row field `round($witness['old_daily_profit'], 3)`"), 'plan records old_daily_profit evidence');
assert(planSource.includes("`content.php` table header `за текущий месяц`; row field `round($witness['now_monthly_profit'], 3)`"), 'plan records now_monthly_profit evidence');
assert(planSource.includes('vendored VIZ client includes validator RPC descriptors in `validator_api`'), 'plan records public RPC validator capability evidence');

console.log('VIZ witnesses-rewards static parity smoke passed');
