const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const appSource = fs.readFileSync(path.join(root, 'v3/js/app.js'), 'utf8');
const historySource = fs.readFileSync(path.join(root, 'v3/js/history.js'), 'utf8');
const planSource = fs.readFileSync(path.join(root, 'plan.md'), 'utf8');
const legacySources = Object.fromEntries(['golos', 'viz', 'steem', 'hive'].map((chain) => [
  chain,
  fs.readFileSync(path.resolve(root, `../dpos.space/blockchains/${chain}/apps/profiles/js/app.js`), 'utf8')
]));

for (const [chain, source] of Object.entries(legacySources)) {
  assert(source.includes('const ops = {'), `legacy ${chain} history operation select map inspected`);
}
assert(legacySources.viz.includes("'award': 'Награда'") && legacySources.viz.includes("'paid_subscribe': 'Подписка'"), 'legacy VIZ readable operation names inspected');
assert(legacySources.golos.includes("delegate_vesting_shares: 'Делегирование СГ'") && legacySources.golos.includes("worker_request: 'Создание заявки воркера'"), 'legacy Golos readable operation names inspected');
assert(legacySources.steem.includes("delegate_vesting_shares: 'Делегирование SP'") && legacySources.steem.includes("convert: 'Конвертация STEEM в SBD или обратно'"), 'legacy Steem readable operation names inspected');
assert(legacySources.hive.includes("delegate_vesting_shares: 'Делегирование HP'") && legacySources.hive.includes("convert: 'Конвертация HIVE в HBD'"), 'legacy Hive readable operation names inspected');

const context = { window: {} };
vm.createContext(context);
vm.runInContext(historySource, context);

function optionMap(chain) {
  const options = context.window.DposHistory.operationOptions({ id: chain });
  return { options, byValue: new Map(options.map((option) => [option.value, option.label])) };
}

const viz = optionMap('viz');
assert.strictEqual(viz.byValue.get('award'), 'Награда', 'VIZ select shows readable award label');
assert.strictEqual(viz.byValue.get('fixed_award'), 'Фиксированная награда', 'VIZ select includes fixed awards');
assert.strictEqual(viz.byValue.get('paid_subscribe'), 'Подписка', 'VIZ select includes paid subscriptions');
assert.strictEqual(viz.byValue.get('committee_vote_request'), 'Голосование за заявку', 'VIZ select includes DAO operations');
assert(viz.options.findIndex((option) => option.value === 'award') < viz.options.findIndex((option) => option.value === 'paid_subscribe'), 'VIZ options preserve legacy order around awards/subscriptions');

const golos = optionMap('golos');
assert.strictEqual(golos.byValue.get('transfer_to_vesting'), 'Перевод в СГ', 'Golos select uses СГ-specific legacy label');
assert.strictEqual(golos.byValue.get('delegate_vesting_shares'), 'Делегирование СГ', 'Golos select uses СГ delegation label');
assert.strictEqual(golos.byValue.get('worker_request'), 'Создание заявки воркера', 'Golos select includes worker operations');
assert.strictEqual(golos.byValue.get('auction_window_reward'), 'Возврат токенов в пул вознаграждений', 'Golos select includes Golos-only rewards');

const steem = optionMap('steem');
assert.strictEqual(steem.byValue.get('transfer_to_vesting'), 'Перевод в SP', 'Steem select uses SP-specific legacy label');
assert.strictEqual(steem.byValue.get('delegate_vesting_shares'), 'Делегирование SP', 'Steem select uses SP delegation label');
assert.strictEqual(steem.byValue.get('convert'), 'Конвертация STEEM в SBD или обратно', 'Steem select uses STEEM/SBD convert label');
assert(!steem.byValue.has('worker_request'), 'Steem select does not inherit Golos worker operations');
assert.strictEqual(steem.options.length, 52, 'Steem select keeps its explicit social operation list');

const hive = optionMap('hive');
assert.strictEqual(hive.byValue.get('transfer_to_vesting'), 'Перевод в HP', 'Hive select uses HP-specific legacy label');
assert.strictEqual(hive.byValue.get('delegate_vesting_shares'), 'Делегирование HP', 'Hive select uses HP delegation label');
assert.strictEqual(hive.byValue.get('convert'), 'Конвертация HIVE в HBD', 'Hive select uses HIVE/HBD convert label');
assert(!hive.byValue.has('worker_request'), 'Hive select does not inherit Golos worker operations');
assert.deepStrictEqual(hive.options.map((option) => option.value), steem.options.map((option) => option.value), 'Hive and Steem currently have matching operation codes');
assert(!historySource.includes('socialOperations'), 'history operation lists stay explicit per chain instead of sharing one mutable base list');
assert(!historySource.includes('hive: socialOperations') && !historySource.includes('steem: socialOperations'), 'Steem/Hive operation lists are not aliases of a shared array');

assert(golos.options.length > steem.options.length, 'Golos has additional operations beyond Steem');
assert(golos.options.some((option) => option.value === 'worker_request'), 'Golos explicitly includes worker operations');
assert(viz.options.length > 0 && viz.options.length !== steem.options.length, 'VIZ keeps its own chain-specific operation list');

assert(appSource.includes('renderOperationSelectOptions(chain, selectedOps)'), 'history route renders operation select options');
assert(appSource.includes('<select id="history-ops" name="ops" multiple'), 'history route uses a multiple select instead of a free text operations input');
assert(!appSource.includes('Операции через запятую'), 'history route no longer labels operations as comma text input');
assert(appSource.includes('Array.from(document.getElementById(\'history-ops\').selectedOptions)'), 'history submit reads selected options from the select control');
assert(planSource.includes('Social-chain history operation selects') && planSource.includes('Golos/Steem/Hive'), 'plan documents chain-specific select parity');

console.log('v3 history operation select smoke passed');
