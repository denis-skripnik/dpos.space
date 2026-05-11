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

const topApp = chains.golos.apps.find((app) => app.id === 'top');
assert(topApp, 'Golos exposes a top app route');
assert.strictEqual(topApp.title, 'Топ пользователей', 'Golos top keeps legacy title');
assert.strictEqual(topApp.accountField, false, 'Golos top is read-only and does not require an account field');
assert(/function renderGolosTop\(chain, state\)/.test(appSource), 'Golos top has a dedicated renderer, not a generic placeholder');
assert(appSource.includes("chain.id === 'golos' && effectiveAppId === 'top'"), 'Golos top route dispatches to the dedicated renderer');
assert(appSource.includes("'topType'"), 'top route keeps selected ranking/token in scoped hash state');

const topSource = (appSource.match(/const golosTopRankingOptions[\s\S]*?\n  const golosWitnessRewardColumns/) || [''])[0];
assert(topSource, 'Golos top smoke slices only the dedicated Golos top implementation');
assert(topSource.includes('aria-label="Варианты сортировки рейтинга Golos"'), 'ranking nav is labelled for screen readers');
assert(topSource.includes('id="golos-top-uia-assets" role="status" aria-live="polite"'), 'UIA dynamic area is announced with aria-live');
assert(topSource.includes('id="golos-top-load-uia"'), 'UIA assets are loaded by an explicit button');
assert(topSource.includes('appHash({ chain: chain.id, app: \'profiles\''), 'top page points users to v3 profile hash routes');

for (const [id, label] of [
  ['gbg', 'GBG'],
  ['golos', 'GOLOS'],
  ['tip_balance', 'TIP-баланс'],
  ['gp', 'СГ'],
  ['delegated_gp', 'Делегированная СГ'],
  ['received_gp', 'Полученная делегированием СГ'],
  ['effective_gp', 'Эффективная СГ (личная - делегированная + полученна делегированием)'],
  ['emission_received_gp', 'Полученная с эмиссией СГ'],
  ['gp_withdraw_rate', 'Выводимая СГ'],
  ['emission_delegated_gp', 'Делегированная с эмиссией СГ'],
  ['market_balance', 'Маркет-баланс'],
  ['reputation', 'Репутация']
]) {
  assert(topSource.includes(`['${id}', '${label}'`), `Golos top preserves ranking category ${id}: ${label}`);
}

for (const text of [
  'Выберите вариант сортировки рейтинга',
  'Legacy поля native top',
  'Legacy поля UIA top',
  'СГ (%)',
  'Делегировано СГ другим',
  'Получено СГ от других делегированием',
  'Эффективная СГ, учитываемая при апвоутинге',
  'Выводится СГ',
  'Баланс GOLOS (%)',
  'Баланс GBG (%)',
  'Суммарный баланс аккаунта',
  'Основной баланс (ликвид)',
  'TIP баланс (донаты)',
  'Market-баланс',
  '100-row pagination',
  'backend-рейтинг держателей'
]) {
  assert(topSource.includes(text), `Golos top preserves concrete legacy/static text: ${text}`);
}

for (const level of ['Повелители морей', 'Киты', 'Косатки', 'Акулы', 'Дельфины', 'Черепахи', 'Рыбы', 'Осьминоги', 'Крабы', 'Креветки']) {
  assert(topSource.includes(level), `Golos top preserves getLevel label ${level}`);
}

assert(/async function loadGolosTopUiaAssets\(chain\)/.test(topSource), 'Golos top has a dedicated UIA asset loader');
assert(topSource.includes('fetchAllGolosAssets(api, 200)'), 'UIA loader reuses public RPC asset pagination');
assert(topSource.includes('getAssetsAsync'), 'UIA loader depends on Golos public getAssetsAsync, matching legacy dynamic token discovery');
assert(topSource.includes('asset && asset.supply'), 'UIA loader preserves legacy asset.supply symbol fallback');
assert(topSource.includes("appHash({ chain: chain.id, app: 'top', topType: symbol })"), 'UIA token links stay inside static v3 hash routing');

const topRuntimeBundle = [chainsSource.match(/const golosApps[\s\S]*?const socialApps/)?.[0] || '', topSource].join('\n');
assert(!topRuntimeBundle.includes('178.20.43.121'), 'Golos top v3 does not reference the legacy private backend IP');
assert(!topRuntimeBundle.includes('backend.dpos.space'), 'Golos top v3 does not depend on backend.dpos.space');
assert(!/fetch\([^)]*golos-api|XMLHttpRequest[\s\S]{0,200}golos-api|file_get_contents|service=top|service=uia-top/.test(topRuntimeBundle), 'Golos top v3 has no runtime old top/uia-top backend fetch');
assert(!/private key|WIF|seed phrase|posting_key|active_key/i.test(topSource), 'Golos top read-only route does not ask for private keys or seeds');

assert(planSource.includes('### Rigorous parity: Golos / top'), 'plan.md contains required Golos/top rigorous parity section');
assert(planSource.includes('`pages/top.php` backend read `service=top&type=<type>&page=<page>`'), 'plan records exact native top backend evidence');
assert(planSource.includes('`pages/uia.php` backend read `service=uia-top&token=<token>&page=<page>`'), 'plan records exact UIA top backend evidence');
assert(planSource.includes('`js/app.js::main()`'), 'plan records app-local UIA dynamic loader evidence');

console.log('Golos top static parity smoke passed');
