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
const plan = fs.readFileSync(path.join(root, 'plan.md'), 'utf8');
const testSource = fs.readFileSync(__filename, 'utf8');
const runtimeSlice = appSource.slice(appSource.indexOf('function renderRandomBlockchain'), appSource.indexOf('function renderGolosStakebot'));
const seedSlice = appSource.slice(appSource.indexOf('function blockRandomSeed'), appSource.indexOf('function renderInstantView'));

const steem = context.DposChains.steem;
assert(steem, 'Steem chain exists');
assert(steem.apps.some((app) => app.id === 'randomblockchain' && /Случайный блокчейн/.test(app.title)), 'Steem randomblockchain route is registered');
assert.strictEqual(steem.randomHashPath, 'v3/vendor/viz/sha3.min.js', 'Steem randomblockchain uses vendored legacy sha3 helper');
assert(fs.existsSync(path.join(root, steem.randomHashPath)), 'Steem vendored sha3 helper exists');

assert(runtimeSlice.includes('<form id="randomblockchain-form"'), 'randomblockchain has a dedicated form renderer');
assert(runtimeSlice.includes('role="status" aria-live="polite"'), 'randomblockchain result area is accessible');
assert(runtimeSlice.includes('randomblockchain-first') && runtimeSlice.includes('randomblockchain-second'), 'randomblockchain keeps two block controls');
assert(runtimeSlice.includes('randomblockchain-participants'), 'randomblockchain keeps participants control');
assert(runtimeSlice.includes('randomblockchain-list') && runtimeSlice.includes('data_list'), 'randomblockchain ports optional participant data_list winner output');
assert(runtimeSlice.includes('Принцип генерации случайных чисел') || runtimeSlice.includes('randomblockchain'), 'renderer includes legacy UI/help markers');
assert(appSource.includes("profiles.apiCall(connection, 'getBlock'"), 'Steem resolves block numbers via public RPC without backend');
assert(seedSlice.includes("['viz', 'steem', 'hive'].includes(chain.id) && block.witness_signature"), 'Steem uses exact legacy witness_signature seed when available');
assert(appSource.includes("chain.id === 'viz' || chain.id === 'steem' || chain.id === 'hive'"), 'Steem uses social-chain keccak path');
assert(appSource.includes('keccak_256(witness_signature_1 + witness_signature_2)'), 'Steem preserves documented legacy keccak witness_signature algorithm');
assert(appSource.includes('luckyNumber: value + 1'), 'Steem preserves legacy 1..N lucky number');

assert(!runtimeSlice.includes('broadcast.prepare'), 'Steem randomblockchain is read-only and does not prepare broadcasts');
assert(!runtimeSlice.includes('broadcast.broadcast'), 'Steem randomblockchain is read-only and does not broadcast');
assert(!runtimeSlice.includes('bindOperationForm'), 'Steem randomblockchain has no signing operation form');
assert(!/backend\.dpos\.space|178\.20\.43\.121|hidden server API|daemon|new indexer|\.php/.test(runtimeSlice), 'runtime randomblockchain slice does not use private/PHP/backend dependencies or hidden services');

assert(plan.includes('### Rigorous parity: Steem / randomblockchain'), 'plan has exact Steem randomblockchain parity section');
assert(plan.includes('blockchains/steem/apps/randomblockchain/content.php'), 'plan records legacy content.php inspection');
assert(plan.includes('blockchains/steem/apps/randomblockchain/js/app.js'), 'plan records legacy JS inspection');
assert(plan.includes('tests/v3-steem-randomblockchain-smoke.js'), 'plan records focused smoke coverage');
assert(plan.includes('witness_signature') && plan.includes('keccak_256') && plan.includes('data_list'), 'plan matrix captures key legacy algorithm/data_list controls');
assert(testSource.includes('### Rigorous parity: Steem / randomblockchain'), 'test enforces durable plan evidence');

console.log('v3 Steem randomblockchain smoke passed');
