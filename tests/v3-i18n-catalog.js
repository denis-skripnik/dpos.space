const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const { extractInventory } = require('../tools/i18n-extract.cjs');
const context = { window: {} };
vm.runInNewContext(fs.readFileSync('v3/js/i18n-en.js', 'utf8'), context);
const catalog = context.window.DposEnglish;
assert.strictEqual(catalog['Направление вывода в HP'], 'HP withdrawal route', 'withdrawal-route setting is not a power-up or transfer to HP');
const tokens = (value, regex) => (value.match(regex) || []).sort().join('|');
for (const ru of extractInventory('index.html')) assert(Object.hasOwn(catalog, ru), `Missing source UI message: ${ru}`);
for (const [ru, en] of Object.entries(catalog)) {
  assert(typeof en === 'string' && en.trim(), `Empty translation: ${ru}`);
  assert.strictEqual(tokens(ru, /⟦\d+⟧/g), tokens(en, /⟦\d+⟧/g), `Changed interpolation: ${ru}`);
  assert(!/[А-Яа-яЁё]/.test(en.replaceAll('СГ', '')), `Untranslated copy: ${ru}`);
  const withoutSlots = value => value.replace(/⟦\d+⟧/g, '');
  assert.strictEqual(tokens(withoutSlots(ru), /\d+(?:[.,]\d+)*/g), tokens(withoutSlots(en), /\d+(?:[.,]\d+)*/g), `Changed numeric constant: ${ru}`);
  for (const symbol of ['VIZ', 'GOLOS', 'STEEM', 'HIVE', 'GBG', 'HBD', 'SBD', 'BIP', 'DEL', 'СГ']) {
    assert.strictEqual(ru.split(symbol).length, en.split(symbol).length, `Changed symbol ${symbol}: ${ru}`);
  }
}
console.log('i18n source coverage, placeholders, numeric constants and symbols passed');
