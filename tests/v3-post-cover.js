'use strict';
const assert = require('node:assert/strict');
const covers = require('../v3/js/post-cover.js');
const measure = text => [...new Intl.Segmenter('ru', { granularity: 'grapheme' }).segment(text)].length * 10;
for (const title of ['Короткий заголовок', 'Один два три четыре пять шесть семь восемь девять десять '.repeat(8), 'Я'.repeat(200), '👨‍👩‍👧‍👦'.repeat(80), 'е\u0301'.repeat(100), '', '   ']) {
  const result = covers.wrapTitle(title, measure, 90, 4);
  assert(result.lines.length <= 4);
  for (const line of result.lines) assert(measure(line) <= 90, line);
  if (result.truncated) assert(result.lines.at(-1).endsWith('…'));
}
assert.deepEqual(covers.wrapTitle('один два три', measure, 90, 1), { lines: ['один два…'], truncated: true });
assert.deepEqual(covers.wrapTitle('е\u0301'.repeat(15), measure, 40, 4), { lines: ['е\u0301е\u0301е\u0301…'], truncated: true });
assert.equal(covers.wrapTitle('👨‍👩‍👧‍👦'.repeat(20), measure, 30, 4).lines[0], '👨‍👩‍👧‍👦👨‍👩‍👧‍👦…');
assert.equal(covers.wrapTitle('Привет мир', measure, 638, 4).lines.join(' '), 'Привет мир');
assert.equal(covers.wrapTitle('123456789 next', measure, 90, 1).lines[0], '12345678…', 'when no whole word plus ellipsis fits, retain safe graphemes');
console.log('post-cover measured word/grapheme wrapping passed');
