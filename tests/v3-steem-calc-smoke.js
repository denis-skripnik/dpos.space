const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const appSource = fs.readFileSync(path.join(root, 'v3/js/app.js'), 'utf8');
const chainsSource = fs.readFileSync(path.join(root, 'v3/js/chains.js'), 'utf8');
const broadcastSource = fs.readFileSync(path.join(root, 'v3/js/broadcast.js'), 'utf8');
const profilesSource = fs.readFileSync(path.join(root, 'v3/js/profiles.js'), 'utf8');
const historySource = fs.readFileSync(path.join(root, 'v3/js/history.js'), 'utf8');
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

const routeAlias = extractFunction(appSource, 'legacyAppTarget');
const renderCalculator = extractFunction(appSource, 'renderCalculator');
const loadSteemCalculatorContext = extractFunction(appSource, 'loadSteemCalculatorContext');
const calculateSteemUpvoteValue = extractFunction(appSource, 'calculateSteemUpvoteValue');
const renderSteemCalculator = extractFunction(appSource, 'renderSteemCalculator');

assert(chainsSource.includes("steem: {") && chainsSource.includes("{ id: 'calculator', title: 'Калькулятор'"), 'Steem calculator app is registered through socialApps');
assert(routeAlias.includes("calc: 'calculator'"), 'legacy calc route aliases to calculator');
assert(routeAlias.includes("chain.id === 'golos' || chain.id === 'hive' || chain.id === 'steem'"), 'Steem legacy calc alias is covered');
assert(renderCalculator.includes("if (chain.id === 'steem')"), 'generic calculator dispatches Steem to dedicated renderer');
assert(renderCalculator.includes('await renderSteemCalculator(chain, account)'), 'Steem calculator route uses dedicated renderer');

for (const marker of [
  'calculator-steem',
  'steem-upvote-calculator-form',
  'steem-upvote-sp',
  'steem-upvote-battery',
  'steem-upvote-weight',
  'steem-vests-form',
  'steem-vests',
  'role="status" aria-live="polite"'
]) {
  assert(renderSteemCalculator.includes(marker), `Steem calc renders legacy/static control ${marker}`);
}

for (const marker of [
  'Рассчитываем стоимость апвота',
  'Введите Значение SP',
  'Введите батарейку (от 1 до 100)',
  'Процент апвота (от 1 до 100',
  'Вывести стоимость апвота',
  'Перевод VESTS в SP',
  'Рассчитать VESTS в SP',
  'Стоимость апвота',
  'Результат конвертации'
]) {
  assert(renderSteemCalculator.includes(marker), `Steem calc preserves legacy UI/result copy: ${marker}`);
}

for (const marker of [
  "profiles.apiCall(connection, 'getDynamicGlobalProperties', [])",
  "profiles.apiCall(connection, 'getChainProperties', [])",
  "profiles.apiCall(connection, 'getFeedHistory', [])",
  "profiles.apiCall(connection, 'getTicker', [])",
  "profiles.apiCall(connection, 'getConfig', [])",
  "profiles.apiCall(connection, 'getRewardFund', ['post'])"
]) {
  assert(loadSteemCalculatorContext.includes(marker), `Steem calc replaces legacy PHP snippet with public RPC: ${marker}`);
}

for (const marker of [
  '1000000 * totalVestingFund / totalVestingShares',
  'sp * 1000000 / steemPerVests',
  'const steemA = totalVestingFund / totalVestingShares',
  'const steemN = 100',
  '100 * battery * (100 * steemN) / 10000',
  '(steemM2 + 49) / 50',
  'rewardBalance / recentClaims',
  'Math.round((base / quote) * 100) / 100',
  'round3(steemR * steemM * 100 * steemI)',
  'weight / 100',
  'vests / 1000000 * steemPerVests'
]) {
  assert(calculateSteemUpvoteValue.includes(marker) || renderSteemCalculator.includes(marker), `Steem calc preserves formula evidence: ${marker}`);
}

const calcRuntimeSlice = routeAlias + renderCalculator + loadSteemCalculatorContext + calculateSteemUpvoteValue + renderSteemCalculator;
for (const forbidden of ['ajax.php', 'backend.dpos.space', '178.20.43.121', 'blockchains/steem/apps/calc']) {
  assert(!calcRuntimeSlice.includes(forbidden), `Steem calc runtime does not depend on ${forbidden}`);
}
assert(!calcRuntimeSlice.includes('broadcast.prepare'), 'Steem calc remains read-only and does not prepare transactions');
assert(!calcRuntimeSlice.includes('broadcast.broadcast'), 'Steem calc remains read-only and does not broadcast transactions');
assert(broadcastSource.includes('steem') && profilesSource.includes('apiCall') && historySource.includes('steem'), 'shared Steem helpers remain available while calc itself is read-only');

for (const evidence of [
  '### Rigorous parity: Steem / calc',
  'blockchains/steem/apps/calc/config.json',
  'blockchains/steem/apps/calc/content.php',
  'blockchains/steem/apps/calc/index.php',
  'blockchains/steem/apps/calc/js/app.js',
  'blockchains/steem/apps/calc/ajax.php',
  'blockchains/steem/apps/calc/snippets/get_dynamic_global_properties.php',
  'blockchains/steem/apps/calc/snippets/get_chain_properties.php',
  'blockchains/steem/apps/calc/snippets/get_feed_history.php',
  'blockchains/steem/apps/calc/snippets/get_ticker.php',
  'blockchains/steem/apps/calc/snippets/get_config.php',
  'blockchains/steem/apps/calc/snippets/getRewardFund.php',
  'blockchains/steem/js/blockchain.js',
  'blockchains/steem/js/modal-accounts.js',
  'blockchains/steem/js/steem.min.js',
  'PHP/backend-only',
  'static-safe public RPC',
  'tests/v3-steem-calc-smoke.js'
]) {
  assert(planSource.includes(evidence), `plan.md records Steem calc evidence: ${evidence}`);
}

console.log('v3 Steem calc smoke passed');
