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

const renderVizCalculator = extractFunction(appSource, 'renderVizCalculator');
const loadVizCalculatorContext = extractFunction(appSource, 'loadVizCalculatorContext');
const calculateVizAwardValue = extractFunction(appSource, 'calculateVizAwardValue');
const renderCalculator = extractFunction(appSource, 'renderCalculator');
const routeAlias = extractFunction(appSource, 'legacyAppTarget');

assert(chainsSource.includes("{ id: 'calculator', title: 'Калькулятор'"), 'VIZ calculator app is registered in chains.js');
assert(routeAlias.includes("calc: 'calculator'"), 'legacy calc route aliases to calculator');
assert(routeAlias.includes("chain.id === 'viz' && (appId === 'calc' || appId === 'awards')"), 'VIZ calc alias is scoped with awards alias');
assert(renderCalculator.includes("if (chain.id === 'viz')"), 'generic calculator dispatches VIZ to the dedicated renderer');
assert(renderCalculator.includes('await renderVizCalculator(chain, account)'), 'VIZ calculator route uses dedicated renderer');

for (const marker of [
  'calculator-viz',
  'viz-award-value-calculator-form',
  'viz-calc-shares',
  'viz-calc-charge',
  'viz-award-fund-calculator-form',
  'viz-calc-fund-shares',
  'viz-vesting-calculator-form',
  'viz-calc-vesting',
  'role="status" aria-live="polite"'
]) {
  assert(renderVizCalculator.includes(marker), `VIZ calc renders legacy/static control ${marker}`);
}

for (const marker of [
  'Награда даст',
  'Награждаете свой аккаунт раз в 432 секунды на 0.1%',
  'Раз в сутки необходимо из соц. капитала выводить',
  'Результат конвертации',
  'соц. капитала'
]) {
  assert(renderVizCalculator.includes(marker), `VIZ calc preserves legacy result copy/formula text: ${marker}`);
}

assert(loadVizCalculatorContext.includes("profiles.apiCall(connection, 'getDynamicGlobalProperties', [])"), 'VIZ calc reads dynamic global properties from public RPC');
assert(loadVizCalculatorContext.includes("profiles.apiCall(connection, 'getChainProperties', [])"), 'VIZ calc audits/replaces legacy get_chain_properties.php with public RPC');
assert(loadVizCalculatorContext.includes("profiles.apiCall(connection, 'getConfig', [])"), 'VIZ calc audits/replaces legacy get_config.php with public RPC');
assert(loadVizCalculatorContext.includes('VIZ_CALCULATOR_FALLBACK_PROPS'), 'VIZ calc has static-safe fallback props when public RPC is unavailable');
assert(renderVizCalculator.includes('context.source'), 'VIZ calc exposes whether values came from public RPC or static fallback');
assert(renderVizCalculator.includes('context.error'), 'VIZ calc exposes accessible loading/error state for fallback use');
assert(appSource.includes('Загрузка калькулятора VIZ'), 'VIZ calc shows an accessible loading state before network reads');

for (const marker of [
  'Number(shares) * Number(charge) / 100',
  'totalRewardShares / 1000000',
  'totalRewardFund / (totalVestingFund / totalVestingShares)',
  'Math.trunc',
  'awardValue(shares, 0.1)',
  'awardFund * 200',
  'withdrawAmount * 28',
  'value / 1000000 * steemPerVests',
  'Math.round((value / 1000000 * steemPerVests) * 1000) / 1000'
]) {
  assert(renderVizCalculator.includes(marker) || calculateVizAwardValue.includes(marker), `VIZ calc preserves legacy formula evidence: ${marker}`);
}

const calcRuntimeSlice = renderVizCalculator + loadVizCalculatorContext + calculateVizAwardValue + renderCalculator + routeAlias;
for (const forbidden of ['ajax.php', 'backend.dpos.space', '178.20.43.121', 'blockchains/viz/apps/calc']) {
  assert(!calcRuntimeSlice.includes(forbidden), `VIZ calc runtime does not depend on ${forbidden}`);
}
assert(!calcRuntimeSlice.includes('broadcast.prepare'), 'VIZ calc remains read-only and does not prepare transactions');
assert(!calcRuntimeSlice.includes('broadcast.broadcast'), 'VIZ calc remains read-only and does not broadcast transactions');
assert(broadcastSource.includes("'award'") && profilesSource.includes('apiCall'), 'shared broadcast/profile helpers remain available but calc itself is read-only');

for (const evidence of [
  '### Rigorous parity: VIZ / calc',
  'blockchains/viz/apps/calc/config.json',
  'blockchains/viz/apps/calc/content.php',
  'blockchains/viz/apps/calc/index.php',
  'blockchains/viz/apps/calc/js/app.js',
  'blockchains/viz/apps/calc/ajax.php',
  'blockchains/viz/apps/calc/snippets/get_chain_properties.php',
  'blockchains/viz/apps/calc/snippets/get_config.php',
  'blockchains/viz/apps/calc/snippets/get_dynamic_global_properties.php',
  'blockchains/viz/js/blockchain.js',
  'blockchains/viz/js/modal-accounts.js',
  'blockchains/viz/js/viz.min.js',
  'PHP/backend-only',
  'static-safe public RPC',
  'tests/v3-viz-calc-smoke.js'
]) {
  assert(planSource.includes(evidence), `plan.md records VIZ calc evidence: ${evidence}`);
}

console.log('v3 VIZ calc smoke passed');
