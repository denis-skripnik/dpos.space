const assert = require('assert');
const helpers = require('../v3/js/auto-upvoter.js');
for (const raw of [0, 1, 50, 99, 100, 101, 5000, 10000]) {
  assert.strictEqual(helpers.currentAccountEnergy({ voting_power: raw }), raw, `RPC voting_power ${raw} is always basis points`);
}
for (const field of ['votingPower', 'energy', 'charge']) {
  assert.strictEqual(helpers.currentAccountEnergy({ [field]: 50 }), 50, `${field} RPC unit is basis points`);
}
for (const account of [null, {}, { voting_power: null }, { voting_power: '' }, { voting_power: 'invalid' }]) {
  assert.strictEqual(helpers.currentAccountEnergy(account), null, 'missing energy is not a valid zero or full battery');
}
const time = Date.parse('2026-01-01T00:00:00Z');
assert.strictEqual(helpers.currentAccountEnergy({ voting_power: 100, last_vote_time: '2026-01-01T00:00:00Z' }, { now: time }), 100);
assert.strictEqual(helpers.currentAccountEnergy({ voting_power: 100, last_vote_time: '2026-01-01T00:00:00Z' }, { now: time + 432000 }), 110, 'regeneration uses basis points without changing initial units');
const event = { kind: 'curator_vote', voter: 'curator', author: 'author', permlink: 'post', weight: 10000, accountEnergy: 10000 };
for (const currentEnergy of [null, '', 'invalid', false]) {
  const actions = helpers.planActionsForEvents([{ account: 'alice', enabled: true, curators: ['curator'], minEnergy: 0, currentEnergy }], [event], { seen: new Set() });
  assert.strictEqual(actions.length, 0, 'unknown voter energy must not become zero and pass a zero threshold or use unrelated event energy');
}
(async () => {
  for (const outcome of ['missing-method', 'missing-account', 'rpc-error']) {
    let broadcasts = 0;
    const adapter = {
      async getAccountHistory() { return [[1, { op: ['vote', { voter: 'curator', author: 'author', permlink: 'post', weight: 10000 }] }]]; },
      async getFavoritePosts() { return []; }
    };
    if (outcome !== 'missing-method') adapter.getAccount = async () => { if (outcome === 'rpc-error') throw new Error('test RPC unavailable'); return null; };
    const tick = await helpers.runScannerTick({ id: 'golos' }, [{ account: 'alice', enabled: true, curators: ['curator'], minEnergy: 0, currentEnergy: 10000 }], adapter, { seen: new Set() }, { broadcaster: async () => { broadcasts += 1; return {}; } });
    assert.strictEqual(tick.actions.length, 0, `${outcome}: stale energy must not authorize a live vote`);
    assert.strictEqual(broadcasts, 0);
  }
  console.log('RPC energy units and missing-value regressions passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
