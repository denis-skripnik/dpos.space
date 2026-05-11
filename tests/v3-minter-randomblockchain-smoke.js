const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const appSource = fs.readFileSync(path.join(root, 'v3/js/app.js'), 'utf8');
const chainsSource = fs.readFileSync(path.join(root, 'v3/js/chains.js'), 'utf8');
const planSource = fs.readFileSync(path.join(root, 'plan.md'), 'utf8');

const randomSeedSlice = (appSource.match(/function blockRandomSeed[\s\S]*?\n  function buildVizSearchMemo/) || [''])[0];
const randomRenderSlice = (appSource.match(/function renderRandomBlockchain\(chain\)[\s\S]*?\n  function buildVizSearchMemo/) || [''])[0];
const minterAppsSlice = (chainsSource.match(/const minterApps = \[[\s\S]*?\n  \];/) || [''])[0];

assert(minterAppsSlice.includes("id: 'randomblockchain'"), 'Minter app registry includes randomblockchain');
assert(appSource.includes("isCosmosChain(chain) && effectiveAppId === 'randomblockchain'"), 'Minter randomblockchain route dispatches through cosmos/static-safe branch');
assert(randomRenderSlice.includes('randomblockchain-form'), 'randomblockchain form is rendered');
assert(randomRenderSlice.includes('Первый блок (начальный)'), 'legacy first block label is preserved');
assert(randomRenderSlice.includes('Количество участников (максимальное число)'), 'legacy participants label is preserved');
assert(randomRenderSlice.includes('Список данных, указывайте каждый элемент с новой строки'), 'legacy data_list textarea is preserved');
assert(randomRenderSlice.includes('Вычислить счастливое число'), 'legacy calculate action label is preserved');
assert(randomRenderSlice.includes('role="status" aria-live="polite"'), 'result area is accessible');

assert(randomSeedSlice.includes("chain.id === 'minter'"), 'Minter has dedicated random seed handling');
assert(randomSeedSlice.includes('/block/${encodeURIComponent(text)}'), 'Minter randomblockchain fetches public /block/{height} endpoint');
assert(randomSeedSlice.includes('/^\\d+$/'), 'randomblockchain accepts multi-digit block numbers');
assert(randomSeedSlice.includes('block.hash'), 'Minter randomblockchain uses legacy block hash seed');
assert(randomSeedSlice.includes("algorithm: 'Minter/Decimal block_hash_1 + block_hash_2'"), 'Minter randomblockchain documents legacy hash concatenation algorithm');
assert(randomSeedSlice.includes('BigInt(`0x${hex}`) % BigInt(modulo)'), 'random result uses hex modulo participants');
assert(randomRenderSlice.includes('https://mcorp.space/post/65'), 'Minter legacy algorithm article link is preserved');
assert(randomRenderSlice.includes('https://github.com/denis-skripnik/minter_random'), 'Minter legacy repository link is preserved');

assert(!randomRenderSlice.includes('broadcast.prepare'), 'randomblockchain renderer does not prepare transactions');
assert(!randomRenderSlice.includes('broadcast.broadcast'), 'randomblockchain renderer does not broadcast transactions');
assert(!randomRenderSlice.includes('bindOperationForm'), 'randomblockchain renderer does not bind operation forms');
for (const forbidden of ['178.20.43.121', 'backend.dpos.space', '.php']) {
  assert(!randomSeedSlice.includes(forbidden), `random seed slice must not depend on ${forbidden}`);
  assert(!randomRenderSlice.includes(forbidden), `random render slice must not depend on ${forbidden}`);
}

assert(planSource.includes('### Rigorous parity: Minter / randomblockchain'), 'plan.md contains exact Minter / randomblockchain parity section');
assert(planSource.includes('blockchains/minter/apps/randomblockchain/js/app.js'), 'plan records legacy Minter randomblockchain app.js inspection');
assert(planSource.includes('https://api.minter.one/v2/block/'), 'plan records public Minter block API dependency');
assert(planSource.includes('Minter randomblockchain is read-only'), 'plan records read-only/no-broadcast classification');

console.log('v3-minter-randomblockchain-smoke ok');
