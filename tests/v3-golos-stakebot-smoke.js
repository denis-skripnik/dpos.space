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

const stakebotApp = chains.golos.apps.find((app) => app.id === 'stakebot');
assert(stakebotApp, 'Golos exposes a stakebot app route');
assert.strictEqual(stakebotApp.accountField, false, 'stakebot does not require an account field because legacy page was informational/backend-fed');
assert(/function renderGolosStakebot\(chain, state\)/.test(appSource), 'stakebot has a dedicated renderer, not just route coverage');
assert(appSource.includes("chain.id === 'golos' && effectiveAppId === 'stakebot'"), 'Golos stakebot route dispatches to the dedicated renderer');
assert(appSource.includes('stakebotPage'), 'stakebot keeps subpage state in hash params');

for (const text of [
  'Текущие ставки в Golos Stake Bot',
  'Джекпот golos_stake_bot',
  'Лотерея golos_stake_bot',
  'Список очищался после получения джекпота победителями',
  'Фонд формировался за счёт 5% от сумм ставок участников',
  'Лотерея среди получающих CLAIM',
  '2 раза в сутки: в полночь и полдень по МСК',
  'от 50000 GESTS (18000 СГ)',
  'https://t.me/golos_stake_bot',
  'историю аккаунта golos-stake-bot в v3',
  'Legacy таблица текущих ставок — backend-only данные'
]) {
  assert(appSource.includes(text), `stakebot renderer preserves concrete legacy/static text: ${text}`);
}

const stakebotSource = (appSource.match(/function renderGolosStakebot[\s\S]*?\n  function renderServicePlaceholder/) || [''])[0];
assert(stakebotSource.includes("appHash({ chain: chain.id, app: 'history', account: 'golos-stake-bot' })"), 'stakebot links to v3 history for on-chain activity instead of legacy donates URL');
assert(stakebotSource.includes("appHash({ chain: chain.id, app: 'profiles', account: 'golos-stake-bot' })"), 'stakebot links to v3 profile for the bot account');
assert(stakebotSource.includes('aria-label="Разделы Golos Stake Bot"'), 'stakebot subpage navigation is labelled for screen readers');
assert(stakebotSource.includes('aria-current=\"page\"'), 'stakebot marks the active subpage');
assert(stakebotSource.includes('<caption>Legacy таблица текущих ставок — backend-only данные</caption>'), 'stakebot documents the legacy table fields without pretending to have live rows');

const stakebotRuntimeBundle = [chainsSource.match(/const golosApps[\s\S]*?const socialApps/)?.[0] || '', stakebotSource].join('\n');
assert(!stakebotRuntimeBundle.includes('http://178.20.43.121:3000/golos-api?service=stakebot'), 'v3 stakebot does not call the legacy backend endpoint');
assert(!stakebotRuntimeBundle.includes('backend.dpos.space'), 'stakebot v3 parity does not introduce backend.dpos.space');
assert(!/file_get_contents|fetch\([^)]*golos-api\?service=stakebot|XMLHttpRequest[\s\S]{0,200}golos-api\?service=stakebot/.test(stakebotRuntimeBundle), 'stakebot v3 parity has no PHP/backend fetch dependency');

console.log('Golos stakebot static parity smoke passed');
