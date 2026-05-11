const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const appSource = fs.readFileSync(path.join(root, 'v3/js/app.js'), 'utf8');
const chainsSource = fs.readFileSync(path.join(root, 'v3/js/chains.js'), 'utf8');
const planSource = fs.readFileSync(path.join(root, 'plan.md'), 'utf8');

const decimalAppsSlice = (chainsSource.match(/const decimalApps = \[[\s\S]*?\n  \];/) || [''])[0];
const seedSlice = (appSource.match(/function blockRandomSeed[\s\S]*?\n  function renderInstantView/) || [''])[0];
const hashSlice = (appSource.match(/async function hashRandomBlockchainSeeds[\s\S]*?\n  function renderRandomBlockchain/) || [''])[0];
const renderSlice = (appSource.match(/function renderRandomBlockchain\(chain\)[\s\S]*?\n  function renderGolosStakebot/) || [''])[0];

assert(decimalAppsSlice.includes("id: 'randomblockchain'"), 'Decimal randomblockchain route is registered');
assert(decimalAppsSlice.includes('Случайный блокчейн'), 'Decimal randomblockchain has menu title');
assert(appSource.includes("isCosmosChain(chain) && effectiveAppId === 'randomblockchain'"), 'cosmos randomblockchain route dispatch exists');
assert(seedSlice.includes("chain.id === 'decimal'"), 'seed resolver has Decimal-specific branch');
assert(seedSlice.includes('/blocks/${encodeURIComponent(text)}'), 'Decimal randomblockchain fetches public Decimal block endpoint');
assert(seedSlice.includes('blockRandomSeed(block, text, chain)'), 'Decimal randomblockchain extracts block hash through shared seed helper');
assert(seedSlice.includes('block.hash'), 'Decimal randomblockchain uses block hash like legacy');
assert(hashSlice.includes("chain.id === 'minter' || chain.id === 'decimal'"), 'Decimal uses legacy hex modulo hash path');
assert(hashSlice.includes('Minter/Decimal block_hash_1 + block_hash_2'), 'Decimal algorithm label documents block hash concatenation');
assert(renderSlice.includes('decimal_random'), 'Decimal randomblockchain links legacy repository');
assert(renderSlice.includes('mcorp.space/post/65'), 'Decimal randomblockchain preserves principle link');
assert(renderSlice.includes('randomblockchain-list'), 'Decimal randomblockchain keeps optional participant list');
assert(renderSlice.includes('role="status" aria-live="polite"'), 'Decimal randomblockchain result is accessible live status');
assert(renderSlice.includes('Вычислить счастливое число'), 'Decimal randomblockchain preserves calculate control text');
assert(!renderSlice.includes('broadcast.prepare'), 'Decimal randomblockchain renderer does not prepare transactions');
assert(!renderSlice.includes('broadcast.broadcast'), 'Decimal randomblockchain renderer does not broadcast transactions');
assert(!renderSlice.includes('bindOperationForm'), 'Decimal randomblockchain renderer does not bind operation forms');
for (const forbidden of ['178.20.43.121', 'backend.dpos.space', 'ajax.php', 'content.php', 'index.php']) {
  assert(!seedSlice.includes(forbidden), `Decimal randomblockchain seed slice must not depend on ${forbidden}`);
  assert(!renderSlice.includes(forbidden), `Decimal randomblockchain renderer must not depend on ${forbidden}`);
}

assert(planSource.includes('### Rigorous parity: Decimal / randomblockchain'), 'plan.md contains exact Decimal / randomblockchain parity section');
assert(planSource.includes('blockchains/decimal/apps/randomblockchain/js/app.js'), 'plan records legacy Decimal randomblockchain app.js inspection');
assert(planSource.includes('decimal_random'), 'plan records Decimal random repository evidence');
assert(planSource.includes('Decimal randomblockchain is read-only'), 'plan records read-only/no-broadcast classification');

console.log('v3-decimal-randomblockchain-smoke ok');
