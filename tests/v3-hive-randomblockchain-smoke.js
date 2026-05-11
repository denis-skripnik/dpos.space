const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const context = { window: null };
context.window = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root, 'v3/js/chains.js'), 'utf8'), context, { filename: 'v3/js/chains.js' });

const appSource = fs.readFileSync(path.join(root, 'v3/js/app.js'), 'utf8');
const broadcastSource = fs.readFileSync(path.join(root, 'v3/js/broadcast.js'), 'utf8');
const profilesSource = fs.readFileSync(path.join(root, 'v3/js/profiles.js'), 'utf8');
const historySource = fs.readFileSync(path.join(root, 'v3/js/history.js'), 'utf8');
const plan = fs.readFileSync(path.join(root, 'plan.md'), 'utf8');
const testSource = fs.readFileSync(__filename, 'utf8');
const runtimeSlice = appSource.slice(appSource.indexOf('function renderRandomBlockchain'), appSource.indexOf('function renderGolosStakebot'));
const seedSlice = appSource.slice(appSource.indexOf('function blockRandomSeed'), appSource.indexOf('function renderInstantView'));

const hive = context.DposChains.hive;
assert(hive, 'Hive chain exists');
assert(hive.apps.some((app) => app.id === 'randomblockchain' && /Случайный блокчейн|ГСЧ/.test(app.title)), 'Hive randomblockchain route is registered');
assert.strictEqual(hive.randomHashPath, 'v3/vendor/viz/sha3.min.js', 'Hive randomblockchain uses vendored legacy sha3 helper');
assert(fs.existsSync(path.join(root, hive.randomHashPath)), 'Hive vendored sha3 helper exists');

for (const marker of [
  '<form id="randomblockchain-form"',
  'role="status" aria-live="polite"',
  'randomblockchain-first',
  'randomblockchain-second',
  'randomblockchain-participants',
  'randomblockchain-list',
  'data_list',
  'Принцип генерации случайных чисел',
  'Сигнатура первого указанного блока',
  'Сигнатура второго указанного блока',
  'Вычислить счастливое число',
  'Счастливое число'
]) {
  assert(runtimeSlice.includes(marker), `Hive randomblockchain keeps legacy/static marker: ${marker}`);
}

assert(appSource.includes("profiles.apiCall(connection, 'getBlock'"), 'Hive resolves block numbers via public RPC without backend');
assert(seedSlice.includes("['viz', 'steem', 'hive'].includes(chain.id) && block.witness_signature"), 'Hive uses exact legacy witness_signature seed when available');
assert(appSource.includes("chain.id === 'viz' || chain.id === 'steem' || chain.id === 'hive'"), 'Hive uses social-chain keccak path');
assert(appSource.includes('keccak_256(witness_signature_1 + witness_signature_2)'), 'Hive preserves documented legacy keccak witness_signature algorithm');
assert(appSource.includes('luckyNumber: value + 1'), 'Hive preserves legacy 1..N lucky number');
assert(appSource.includes('const winner = list.length ? list[random.value] : \'\''), 'Hive preserves optional data_list winner lookup');

assert(!runtimeSlice.includes('broadcast.prepare'), 'Hive randomblockchain is read-only and does not prepare broadcasts');
assert(!runtimeSlice.includes('broadcast.broadcast'), 'Hive randomblockchain is read-only and does not broadcast');
assert(!runtimeSlice.includes('bindOperationForm'), 'Hive randomblockchain has no signing operation form');
assert(!/backend\.dpos\.space|178\.20\.43\.121|hidden server API|daemon|new indexer|\.php/.test(runtimeSlice), 'runtime Hive randomblockchain slice does not use private/PHP/backend dependencies or hidden services');
assert(broadcastSource.includes('hive') && profilesSource.includes('apiCall') && historySource.includes('hive'), 'shared Hive helpers remain available while randomblockchain itself is read-only');

for (const evidence of [
  '### Rigorous parity: Hive / randomblockchain',
  'blockchains/hive/apps/randomblockchain/config.json',
  'blockchains/hive/apps/randomblockchain/content.php',
  'blockchains/hive/apps/randomblockchain/index.php',
  'blockchains/hive/apps/randomblockchain/js/app.js',
  'blockchains/hive/apps/randomblockchain/js/BigInteger.min.js',
  'blockchains/hive/apps/randomblockchain/js/sha3.min.js',
  'blockchains/hive/js/blockchain.js',
  'blockchains/hive/js/modal-accounts.js',
  'blockchains/hive/js/hive.min.js',
  'tests/v3-hive-randomblockchain-smoke.js',
  'witness_signature',
  'keccak_256',
  'data_list',
  'static-safe public RPC'
]) {
  assert(plan.includes(evidence), `plan.md records Hive randomblockchain evidence: ${evidence}`);
}
assert(testSource.includes('### Rigorous parity: Hive / randomblockchain'), 'test enforces durable plan evidence');

console.log('v3 Hive randomblockchain smoke passed');
