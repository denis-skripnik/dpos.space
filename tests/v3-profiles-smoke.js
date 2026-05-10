const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const context = { window: null, localStorage: { getItem() { return null; }, setItem() {} } };
context.window = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root, 'v3/js/profiles.js'), 'utf8'), context, { filename: 'v3/js/profiles.js' });

const vizChain = { config: { id: 'viz', title: 'VIZ', liquidSymbol: 'VIZ', powerTitle: 'SHARES' }, node: 'https://node.test' };
const vizAccount = {
  name: 'denis-skripnik',
  balance: '1.000 VIZ',
  vesting_shares: '1000000.000000 SHARES',
  delegated_vesting_shares: '100000.000000 SHARES',
  received_vesting_shares: '50000.000000 SHARES',
  energy: 8765,
  last_vote_time: '2026-05-10T00:00:00',
  created: '2018-01-01T00:00:00',
  custom_sequence: 42,
  custom_sequence_block_num: 123456,
  recovery_account: 'registrar',
  witnesses_voted_for: 2,
  witness_votes: ['witness-a', 'witness-b'],
  regular: { weight_threshold: 1, key_auths: [['VIZ111', 1]], account_auths: [] },
  active: { weight_threshold: 1, key_auths: [['VIZ222', 1]], account_auths: [] },
  memo_key: 'VIZ333',
  json_metadata: JSON.stringify({ profile: { nickname: 'Denis', about: 'Accessibility and web3', site: 'https://example.com', birthday: '01.01.1990', services: { telegram: 'denis' }, interests: ['a11y', 'dpos'] } }),
  _v3ProfileContext: {
    dynamicProperties: { time: '2026-05-10T01:00:00', total_vesting_fund: '1000.000 VIZ', total_vesting_shares: '1000000.000000 SHARES' },
    config: { CHAIN_ENERGY_REGENERATION_SECONDS: 432000 }
  }
};

const vizProfile = context.DposProfiles.normalizeAccount(vizChain, vizAccount);
assert.strictEqual(vizProfile.displayName, 'Denis');
assert(vizProfile.balances.some(([label]) => label === 'Energy'), 'VIZ energy is exposed');
assert(vizProfile.economyRows.some(([label]) => label === 'custom_sequence'), 'VIZ custom sequence is exposed');
assert(vizProfile.governanceRows.some(([label]) => label === 'Witness votes'), 'witness votes are exposed');
assert(vizProfile.authorityRows.some(([label]) => label === 'Regular authority'), 'VIZ regular authority is exposed');
assert(vizProfile.profileRows.some(([label]) => label === 'День рождения'), 'VIZ birthday metadata is exposed');
assert(vizProfile.socials.some(([label]) => label === 'telegram'), 'VIZ profile.services socials are exposed');

const hiveChain = { config: { id: 'hive', title: 'Hive', liquidSymbol: 'HIVE', powerTitle: 'HP' }, node: 'https://hive.test' };
const hiveProfile = context.DposProfiles.normalizeAccount(hiveChain, {
  name: 'alice',
  balance: '2.000 HIVE',
  hbd_balance: '3.000 HBD',
  vesting_shares: '5.000000 VESTS',
  savings_balance: '1.000 HIVE',
  savings_hbd_balance: '0.500 HBD',
  reward_hive_balance: '0.001 HIVE',
  posting_json_metadata: JSON.stringify({ profile: { name: 'Alice', website: 'https://alice.example' } }),
  posting: { weight_threshold: 1, key_auths: [['STM111', 1]], account_auths: [] }
});
assert.strictEqual(hiveProfile.displayName, 'Alice');
assert(hiveProfile.balances.some(([label]) => label === 'Savings HIVE'), 'Hive savings balance is exposed');
assert(hiveProfile.authorityRows.some(([label]) => label === 'Posting authority'), 'Hive posting authority is exposed');

const minterProfile = context.DposProfiles.normalizeAccount({ config: { id: 'minter', title: 'Minter' }, node: 'https://api.minter.one/v2' }, {
  name: 'Mx0000000000000000000000000000000000000000',
  address: 'Mx0000000000000000000000000000000000000000',
  nonce: 7,
  balances: [{ coin: { symbol: 'BIP' }, amount: '1.23' }],
  delegations: [{ coin: { symbol: 'BIP' }, value: '10' }],
  transactions: [{ hash: 'MtHash', type: 1 }]
});
assert(minterProfile.balances.some(([label, value]) => label === 'BIP' && value === '1.23'), 'Minter balances normalize');
assert(minterProfile.restRows.some(([label]) => label === 'Nonce'), 'Minter nonce is exposed');
assert(minterProfile.rawLists.delegations.length === 1, 'Minter delegations are exposed as raw list');
assert.strictEqual(minterProfile.rawLists.transactions[0].hash, 'MtHash', 'Minter transactions stay structured for table rendering');
