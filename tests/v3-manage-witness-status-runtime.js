const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../v3/js/app.js'), 'utf8');
function slice(start, end) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from);
  assert(from >= 0 && to > from, 'runtime helper boundaries exist');
  return source.slice(from, to);
}
const ctx = vm.createContext({
  escapeHtml: value => String(value),
  accountLink: (chain, owner) => owner,
  explorerLink: (chain, type, owner) => owner
});
vm.runInContext(
  slice('  function manageNullSigningKey(', '  function manageWitnessSigningKeyStorageKey(') +
  slice('  function isManageWitnessActive(', '  function workerStateLabel('), ctx);
const suffix = '1111111111111111111111111111111114T1Anm';
const currentVotes = new Set(['lindsay']);
function check(chainId, owner, key, active, field = 'signing_key') {
  const witness = { owner, [field]: key };
  assert.equal(ctx.isManageWitnessActive({ id: chainId }, witness), active, `${chainId}/${owner}: key classification`);
  const html = ctx.renderWitnessChoice({ id: chainId }, witness, { currentVotes });
  const name = chainId === 'viz' ? 'валидатор' : 'делегат';
  assert(html.includes(`>${active ? 'активный' : 'неактивный'} ${name};`), `${chainId}/${owner}: rendered label`);
  assert.equal(/data-witness-vote="[^"]+" checked/.test(html), currentVotes.has(owner), 'status must not change vote selection');
}
// Exact public RPC keys observed on Golos, not fabricated responses.
check('golos', 'lindsay', `GLS${suffix}`, false);
check('golos', 'lindsay', `GOLOS${suffix}`, false);
check('golos', 'lex', 'GLS6XuUhWu1LmCbBmQX8c5861Q3L1VzKALVqy1JcYzECxQKGbR4qb', true);
check('golos', 'lindsay', `GLS${suffix}`, false, 'signingKey');
for (const [chain, prefix] of [['viz', 'VIZ'], ['hive', 'HIVE'], ['steem', 'STM']]) {
  check(chain, 'stopped', `${prefix}${suffix}`, false);
  check(chain, 'running', `${prefix}6XuUhWu1LmCbBmQX8c5861Q3L1VzKALVqy1JcYzECxQKGbR4qb`, true);
  check(chain, 'missing', undefined, false);
}
check('golos', 'missing', undefined, false);
assert.equal(ctx.manageDeactivateSigningKey({ id: 'golos' }), `GLS${suffix}`, 'broadcast deactivation key remains unchanged');
console.log('manage witness status runtime passed: GLS/GOLOS, VIZ/Hive/Steem, missing keys, rendered labels and vote preservation');
