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
assert.strictEqual(witnessesApp.title, 'Делегаты', 'Golos witnesses-rewards is renamed to Delegates');
assert.strictEqual(witnessesApp.accountField, false, 'Golos delegates route is read-only and does not require an account field');
assert(witnessesApp.description.includes('Актуальный список делегатов Golos'), 'route description matches actual delegate-list behavior');
assert(!witnessesApp.description.includes('текущий/предыдущий день и месяц'), 'route description no longer promises legacy reward aggregates');
assert(/function renderGolosWitnessesRewards\(chain\)/.test(appSource), 'Golos delegates has a dedicated renderer');
assert(appSource.includes("chain.id === 'golos' && effectiveAppId === 'witnesses-rewards'"), 'Golos delegates dispatches to the dedicated renderer');

const witnessesSource = (appSource.match(/function normalizeGolosWitnessRows[\s\S]*?\n  const vizWitnessRewardColumns/) || [''])[0];
assert(witnessesSource, 'test can isolate only the Golos delegates runtime slice');
assert(witnessesSource.includes('<h2>Делегаты</h2>'), 'renderer title is Делегаты');
assert(witnessesSource.includes('Актуальный список делегатов блокчейна Golos'), 'renderer describes the actual current delegate list');
assert(witnessesSource.includes('Список делегатов Golos'), 'live section is named as a delegate list');
assert(witnessesSource.includes('role="status" aria-live="polite"'), 'async RPC status is announced with aria-live');
assert(witnessesSource.includes('id="golos-witnesses-rewards-load"'), 'public witness loader is explicit and keyboard-accessible as a button');
assert(witnessesSource.includes('Список делегатов ещё не загружен.'), 'empty state speaks about delegates, not rewards');

for (const removedText of [
  'Legacy reward columns',
  'Legacy columns for Golos witnesses rewards',
  'old_daily_profit',
  'now_daily_profit',
  'old_monthly_profit',
  'now_monthly_profit',
  'за вчерашний день',
  'за сегодня',
  'за прошлый месяц',
  'за текущий месяц',
  'Обновление происходит в полночь по GMT'
]) {
  assert(!witnessesSource.includes(removedText), `Golos delegates runtime removed legacy reward UI text: ${removedText}`);
}

assert(/async function loadGolosWitnessesByVote\(chain\)/.test(witnessesSource), 'dedicated public RPC witness loader exists');
assert(witnessesSource.includes("profiles.apiCall(connection, 'getWitnessesByVote', ['', 50])"), 'loader first tries getWitnessesByVote with a bounded public-RPC limit');
assert(witnessesSource.includes("profiles.apiCall(connection, 'lookupWitnessAccounts', ['', 50])"), 'loader has lookupWitnessAccounts fallback');
assert(witnessesSource.includes("profiles.apiCall(connection, 'getWitnessByAccount', [name])"), 'loader resolves fallback names through getWitnessByAccount');
assert(witnessesSource.includes('profiles.connect(chain)'), 'loader uses existing public node selection');
assert(witnessesSource.includes("appHash({ chain: chain.id, app: 'profiles'"), 'witness rows link to v3 profile hash routes');
assert(witnessesSource.includes('профиль witness'), 'witness profile link context is preserved in text');

const witnessesRuntimeBundle = [chainsSource.match(/const golosApps[\s\S]*?const socialApps/)?.[0] || '', witnessesSource].join('\n');
assert(!witnessesRuntimeBundle.includes('178.20.43.121'), 'delegates v3 runtime does not reference the legacy private backend IP');
assert(!witnessesRuntimeBundle.includes('backend.dpos.space'), 'delegates v3 runtime does not depend on backend.dpos.space');
assert(!/fetch\([^)]*golos-api|XMLHttpRequest[\s\S]{0,200}golos-api|file_get_contents/.test(witnessesRuntimeBundle), 'delegates v3 has no runtime old witnesses backend fetch');
assert(!/private_key|posting_key|active_key|seed phrase|broadcast|transaction preview|send operation/i.test(witnessesSource), 'read-only delegates route does not ask for keys or expose transaction sending');

assert(planSource.includes('### Rename: Golos / witnesses-rewards to Delegates'), 'plan.md records the rename/removal pass');
assert(planSource.includes('Golos delegates page now matches actual behavior'), 'plan records actual-behavior rationale');

console.log('Golos delegates static smoke passed');
