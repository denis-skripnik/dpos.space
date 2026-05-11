const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const appSource = fs.readFileSync(path.join(root, 'v3/js/app.js'), 'utf8');
const chainsSource = fs.readFileSync(path.join(root, 'v3/js/chains.js'), 'utf8');
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

const renderGolosCalculator = extractFunction(appSource, 'renderGolosCalculator');
const renderSteemCalculator = extractFunction(appSource, 'renderSteemCalculator');
const renderHiveCalculator = extractFunction(appSource, 'renderHiveCalculator');
const renderVizCalculator = extractFunction(appSource, 'renderVizCalculator');
const renderCalculator = extractFunction(appSource, 'renderCalculator');

for (const marker of [
  "{ id: 'calculator', title: 'Калькулятор'",
  "{ id: 'randomblockchain', title: 'Случайный блокчейн'",
  "{ id: 'explorer', title: 'Проводник'"
]) {
  assert(chainsSource.includes(marker), `read-only/helper route inventory includes ${marker}`);
}

for (const [name, source, headingId] of [
  ['Golos calculator', renderGolosCalculator, 'golos-calculator-heading'],
  ['Steem calculator', renderSteemCalculator, 'steem-calculator-heading'],
  ['Hive calculator', renderHiveCalculator, 'hive-calculator-heading'],
  ['VIZ calculator', renderVizCalculator, 'viz-calculator-heading'],
  ['generic calculator', renderCalculator, 'generic-calculator-heading']
]) {
  assert(source.includes(`aria-labelledby="${headingId}"`), `${name} panel has an accessible heading relationship`);
  assert(source.includes(`id="${headingId}"`), `${name} h2 exposes the labelledby target`);
  assert(source.includes('role="status" aria-live="polite"'), `${name} loading/result/status text is announced`);
  assert(!source.includes('broadcast.prepare'), `${name} remains read-only and does not prepare transactions`);
  assert(!source.includes('broadcast.broadcast'), `${name} remains read-only and does not broadcast transactions`);
}

for (const marker of [
  '### UX polish: Read-only helper and calculator routes',
  'Golos / calculator',
  'Steem / calculator',
  'Hive / calculator',
  'VIZ / calculator',
  'Minter/Decimal / calculator',
  'tests/v3-read-only-helper-ux-smoke.js'
]) {
  assert(planSource.includes(marker), `plan records read-only/helper UX evidence: ${marker}`);
}

console.log('v3 read-only/helper UX smoke passed');
