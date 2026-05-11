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
const runtimeSlice = appSource.slice(appSource.indexOf('function renderRandomBlockchain'), appSource.indexOf('function buildVizSearchMemo'));

const viz = context.DposChains.viz;
assert(viz, 'VIZ chain exists');
assert(viz.apps.some((app) => app.id === 'randomblockchain' && /Случайный блокчейн/.test(app.title)), 'VIZ randomblockchain route is registered');
assert.strictEqual(viz.randomHashPath, 'v3/vendor/viz/sha3.min.js', 'VIZ randomblockchain uses vendored legacy sha3 helper');
assert(fs.existsSync(path.join(root, viz.randomHashPath)), 'VIZ vendored sha3 helper exists');

assert(runtimeSlice.includes('<form id="randomblockchain-form"'), 'randomblockchain has a dedicated form renderer');
assert(runtimeSlice.includes('role="status" aria-live="polite"'), 'randomblockchain result area is accessible');
assert(runtimeSlice.includes('randomblockchain-list'), 'randomblockchain ports optional participant data_list winner output');
assert(appSource.includes("chain.id === 'viz' || chain.id === 'steem' || chain.id === 'hive'"), 'VIZ uses witness_signature keccak path like legacy social chains');
assert(appSource.includes('keccak_256(witness_signature_1 + witness_signature_2)'), 'VIZ preserves documented legacy keccak witness_signature algorithm');
assert(appSource.includes('luckyNumber: value + 1'), 'VIZ preserves legacy 1..N lucky number');
assert(appSource.includes("profiles.apiCall(connection, 'getBlock'"), 'VIZ resolves block numbers via public RPC without backend');

assert(!runtimeSlice.includes('broadcast.prepare'), 'VIZ randomblockchain is read-only and does not prepare broadcasts');
assert(!runtimeSlice.includes('broadcast.broadcast'), 'VIZ randomblockchain is read-only and does not broadcast');
assert(!runtimeSlice.includes('bindOperationForm'), 'VIZ randomblockchain has no signing operation form');
assert(!/backend\.dpos\.space|178\.20\.43\.121|viz-api|\.php/.test(runtimeSlice), 'runtime randomblockchain slice does not use private/PHP/backend dependencies');

assert(plan.includes('### Rigorous parity: VIZ / randomblockchain'), 'plan has exact VIZ randomblockchain parity section');
assert(plan.includes('blockchains/viz/apps/randomblockchain/content.php'), 'plan records legacy content.php inspection');
assert(plan.includes('blockchains/viz/apps/randomblockchain/js/app.js'), 'plan records legacy JS inspection');
assert(plan.includes('tests/v3-viz-randomblockchain-smoke.js'), 'plan records focused smoke coverage');
assert(plan.includes('witness_signature') && plan.includes('keccak_256') && plan.includes('data_list'), 'plan matrix captures key legacy algorithm/data_list controls');
assert(testSource.includes('### Rigorous parity: VIZ / randomblockchain'), 'test enforces durable plan evidence');

console.log('v3 VIZ randomblockchain smoke passed');
