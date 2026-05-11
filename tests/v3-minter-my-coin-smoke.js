const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const appSource = fs.readFileSync(path.join(root, 'v3/js/app.js'), 'utf8');
const chainsSource = fs.readFileSync(path.join(root, 'v3/js/chains.js'), 'utf8');
const planSource = fs.readFileSync(path.join(root, 'plan.md'), 'utf8');

const renderMinterForms = (appSource.match(/function renderMinterWalletForms[\s\S]*?\n  function minterTx/) || [''])[0];
const bindMinterForms = (appSource.match(/function bindMinterWalletForms[\s\S]*?\n  function bindDecimalWalletForms/) || [''])[0];
const routeDispatch = (appSource.match(/chain\.id === 'minter' && \(effectiveAppId === 'wallet'[\s\S]*?await renderMinterWallet\(chain, account\);/) || [''])[0];

assert(chainsSource.includes("{ id: 'my-coin', title: 'Мои монеты'"), 'Minter registry exposes my-coin route');
assert(routeDispatch.includes("effectiveAppId === 'my-coin'"), 'Minter my-coin route dispatches to dedicated Minter wallet/action renderer');
assert(renderMinterForms.includes('minter-coin-form'), 'Minter my-coin renders dedicated coin/token form');
assert(renderMinterForms.includes('Minter: создание, пересоздание, выпуск, сжигание и смена владельца монеты/токена'), 'Minter my-coin preserves legacy operation group');
assert(renderMinterForms.includes('CREATE_COIN') && renderMinterForms.includes('RECREATE_COIN'), 'Minter my-coin supports create/recreate coin');
assert(renderMinterForms.includes('CREATE_TOKEN') && renderMinterForms.includes('RECREATE_TOKEN'), 'Minter my-coin supports create/recreate token');
assert(renderMinterForms.includes('MINT_TOKEN') && renderMinterForms.includes('BURN_TOKEN'), 'Minter my-coin supports mint/burn token');
assert(renderMinterForms.includes('EDIT_COIN_OWNER'), 'Minter my-coin supports edit coin owner');
assert(renderMinterForms.includes('minter-coin-crr') && renderMinterForms.includes('minter-coin-reserve'), 'Minter my-coin keeps CRR/reserve fields for coins');
assert(renderMinterForms.includes('minter-coin-new-owner'), 'Minter my-coin keeps new owner field');
assert(renderMinterForms.includes('data-operation-result role="status" aria-live="polite"'), 'Minter my-coin operation result is accessible');

assert(bindMinterForms.includes("bindOperationForm(chain, 'minter-coin-form'"), 'Minter my-coin form binds to operation preview/send handler');
assert(bindMinterForms.includes("mode === 'CREATE_COIN' || mode === 'RECREATE_COIN'"), 'Minter my-coin maps coin create/recreate payload');
assert(bindMinterForms.includes("mode === 'CREATE_TOKEN' || mode === 'RECREATE_TOKEN'"), 'Minter my-coin maps token create/recreate payload');
assert(bindMinterForms.includes("mode === 'EDIT_COIN_OWNER'"), 'Minter my-coin maps edit-owner payload');
assert(bindMinterForms.includes("mode === 'MINT_TOKEN' || mode === 'BURN_TOKEN'"), 'Minter my-coin maps mint/burn payload');
assert(bindMinterForms.includes("broadcast.prepare(chain, 'seed', 'minterTx'"), 'Minter my-coin prepares direct client-side Minter transaction only');

const myCoinRuntime = renderMinterForms + bindMinterForms + routeDispatch;
assert(!/178\.20\.43\.121|backend\.dpos\.space|\.php/.test(myCoinRuntime), 'Minter my-coin runtime slice has no private/backend/PHP dependency');
assert(!/fetch\(/.test(myCoinRuntime), 'Minter my-coin action slice does not fetch hidden services');

assert(planSource.includes('### Rigorous parity: Minter / my-coin'), 'plan.md contains exact Minter / my-coin parity section');
assert(planSource.includes('blockchains/minter/apps/my-coin/content.php'), 'plan.md records inspected my-coin content.php');
assert(planSource.includes('createCoin(this.form.type.value') && planSource.includes('editCoinOwner(this.form.symbol.value') && planSource.includes('mintToken(this.form.coin.value') && planSource.includes('burnToken(this.form.token.value'), 'plan.md records legacy my-coin action evidence');

console.log('v3-minter-my-coin-smoke ok');
