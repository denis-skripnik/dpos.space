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

const witnessesApp = chains.golos.apps.find((app) => app.id === 'witnesses-rewards');
assert(witnessesApp, 'Golos exposes witnesses-rewards app route');
assert.strictEqual(witnessesApp.title, 'Награды делегатов', 'Golos witnesses-rewards keeps legacy title');
assert.strictEqual(witnessesApp.accountField, false, 'Golos witnesses-rewards is read-only and does not require an account field');
assert(witnessesApp.description.includes('текущий/предыдущий день и месяц'), 'route description preserves daily/monthly reward meaning');
assert(/function renderGolosWitnessesRewards\(chain\)/.test(appSource), 'Golos witnesses-rewards has a dedicated renderer');
assert(appSource.includes("chain.id === 'golos' && effectiveAppId === 'witnesses-rewards'"), 'Golos witnesses-rewards dispatches to the dedicated renderer');

const witnessesSource = (appSource.match(/const golosWitnessRewardColumns[\s\S]*?\n  const vizWitnessRewardColumns/) || [''])[0];
assert(witnessesSource, 'test can isolate only the Golos witnesses-rewards runtime slice');
assert(witnessesSource.includes('<h2>Награды делегатов</h2>'), 'renderer preserves legacy h2/title');
assert(witnessesSource.includes('Страница со списком делегатов блокчейна Golos и их наград за текущий день и месяц, предыдущий день и месяц.'), 'renderer preserves legacy description');
assert(witnessesSource.includes('Обновление происходит в полночь по GMT'), 'renderer preserves legacy GMT update notice');
assert(witnessesSource.includes('role="status" aria-live="polite"'), 'async RPC status is announced with aria-live');
assert(witnessesSource.includes('id="golos-witnesses-rewards-load"'), 'public witness loader is explicit and keyboard-accessible as a button');
assert(witnessesSource.includes('Legacy columns for Golos witnesses rewards'), 'legacy reward-column table has a caption');

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
  assert(witnessesSource.includes(text), `Golos witnesses-rewards preserves/classifies legacy reward text: ${text}`);
}

assert(/async function loadGolosWitnessesByVote\(chain\)/.test(witnessesSource), 'dedicated public RPC witness loader exists');
assert(witnessesSource.includes("profiles.apiCall(connection, 'getWitnessesByVote', ['', 50])"), 'loader first tries getWitnessesByVote with a bounded public-RPC limit');
assert(witnessesSource.includes("profiles.apiCall(connection, 'lookupWitnessAccounts', ['', 50])"), 'loader has lookupWitnessAccounts fallback');
assert(witnessesSource.includes("profiles.apiCall(connection, 'getWitnessByAccount', [name])"), 'loader resolves fallback names through getWitnessByAccount');
assert(witnessesSource.includes('profiles.connect(chain)'), 'loader uses existing public node selection');
assert(witnessesSource.includes("appHash({ chain: chain.id, app: 'profiles'"), 'witness rows link to v3 profile hash routes');
assert(witnessesSource.includes('профиль witness'), 'witness profile link context is preserved in text');

const witnessesRuntimeBundle = [chainsSource.match(/const golosApps[\s\S]*?const socialApps/)?.[0] || '', witnessesSource].join('\n');
assert(!witnessesRuntimeBundle.includes('178.20.43.121'), 'witnesses-rewards v3 runtime does not reference the legacy private backend IP');
assert(!witnessesRuntimeBundle.includes('backend.dpos.space'), 'witnesses-rewards v3 runtime does not depend on backend.dpos.space');
assert(!/fetch\([^)]*golos-api|XMLHttpRequest[\s\S]{0,200}golos-api|file_get_contents/.test(witnessesRuntimeBundle), 'witnesses-rewards v3 has no runtime old witnesses backend fetch');
assert(witnessesSource.includes('golos-api?service=witnesses'), 'old service name is present only as documented backend-only evidence');
assert(!/private_key|posting_key|active_key|seed phrase|broadcast|transaction preview|send operation/i.test(witnessesSource), 'read-only witnesses-rewards route does not ask for keys or expose transaction sending');

assert(planSource.includes('### Rigorous parity: Golos / witnesses-rewards'), 'plan.md contains required Golos/witnesses-rewards rigorous parity section');
assert(planSource.includes("`content.php` backend read `file_get_contents('http://178.20.43.121:3000/golos-api?service=witnesses')`"), 'plan records exact old private backend evidence');
assert(planSource.includes("`content.php` table header `за вчерашний день`; row field `round($witness['old_daily_profit'], 3)`"), 'plan records old_daily_profit evidence');
assert(planSource.includes("`content.php` table header `за текущий месяц`; row field `round($witness['now_monthly_profit'], 3)`"), 'plan records now_monthly_profit evidence');
assert(planSource.includes('vendored Golos client includes witness RPC descriptors in `witness_api`'), 'plan records public RPC witness capability evidence');

console.log('Golos witnesses-rewards static parity smoke passed');
