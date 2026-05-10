const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const appSource = fs.readFileSync(path.join(root, 'v3/js/app.js'), 'utf8');
const chainsSource = fs.readFileSync(path.join(root, 'v3/js/chains.js'), 'utf8');
const broadcastSource = fs.readFileSync(path.join(root, 'v3/js/broadcast.js'), 'utf8');
const planSource = fs.readFileSync(path.join(root, 'plan.md'), 'utf8');

const loadDecimalWalletData = (appSource.match(/async function loadDecimalWalletData[\s\S]*?\n  function renderDecimalWalletBalances/) || [''])[0];
const renderDecimalWallet = (appSource.match(/async function renderDecimalWallet[\s\S]*?\n  function renderCosmosWallet/) || [''])[0];
const renderDecimalForms = (appSource.match(/function renderDecimalWalletForms[\s\S]*?\n  async function renderDecimalWallet/) || [''])[0];
const bindDecimalForms = (appSource.match(/function bindDecimalWalletForms[\s\S]*?\n  function bindCosmosForms/) || [''])[0];

assert(loadDecimalWalletData.includes('/addresses/${encodeURIComponent(address)}/balances'), 'Decimal wallet fetches legacy balances endpoint');
assert(loadDecimalWalletData.includes('/validators/wallet/${encodeURIComponent(stakeAddress)}/stakes/coins'), 'Decimal wallet fetches legacy coin stakes endpoint');
assert(loadDecimalWalletData.includes('/validators/wallet/${encodeURIComponent(stakeAddress)}/stakes/nfts'), 'Decimal wallet fetches legacy NFT stakes endpoint');
assert(loadDecimalWalletData.includes('/txs/txs-by-address/${encodeURIComponent(address)}?limit=10&offset=0'), 'Decimal wallet fetches legacy txs-by-address endpoint');

assert(renderDecimalWallet.includes('loadDecimalWalletData'), 'Decimal wallet uses a dedicated data loader');
assert(renderDecimalWallet.includes('wallet-decimal'), 'Decimal wallet has a dedicated root marker');
assert(renderDecimalWallet.includes('renderDecimalWalletBalances'), 'Decimal wallet renders dedicated balances/stakes/NFT/rewards/history');
assert(renderDecimalWallet.includes('renderDecimalWalletForms'), 'Decimal wallet renders dedicated Decimal forms');
assert(renderDecimalWallet.includes('bindDecimalWalletForms'), 'Decimal wallet binds dedicated Decimal forms');
assert(renderDecimalWallet.includes('bindMaxButtons(appEl)'), 'Decimal wallet supports legacy maximum fill buttons');
assert(!renderDecimalWallet.includes('return renderCosmosWallet'), 'Decimal wallet is not a thin alias to generic Cosmos wallet');

assert(appSource.includes("chain.id === 'decimal' && (app.id === 'wallet' || app.id === 'swap' || app.id === 'my-coin')"), 'Decimal wallet/swap/my-coin route dispatches to Decimal-specific renderer before generic Cosmos');
assert(appSource.includes("chain.id === 'decimal' && app.id === 'broadcast'"), 'Decimal broadcast route stays Decimal-specific');
assert(appSource.includes('await renderDecimalWallet(chain, account);'), 'Decimal broadcast route reuses Decimal SDK wallet guard instead of generic Cosmos wallet');
assert(chainsSource.includes("apiBase: 'https://api.decimalchain.com/api/v1'"), 'Decimal API base is configured');

[
  'decimal-send-form',
  'decimal-delegate-form',
  'decimal-convert-form',
  'decimal-token-form',
  'decimal-nft-form'
].forEach((formId) => {
  assert(renderDecimalForms.includes(formId) || appSource.includes(formId), `Decimal wallet renders ${formId}`);
  assert(bindDecimalForms.includes(formId), `Decimal wallet binds ${formId}`);
});

[
  'DEL',
  'Монета/токен',
  'Адрес валидатора',
  'stake',
  'Анбонд',
  'NFT',
  'Начисления',
  'Адрес'
].forEach((label) => {
  assert(appSource.includes(label), `Decimal wallet exposes native label: ${label}`);
});

assert(bindDecimalForms.includes("broadcast.prepare(chain, 'seed', 'decimalSend'"), 'Decimal send is prepared through broadcast guard');
assert(bindDecimalForms.includes("mode === 'unbond' ? 'decimalUnbond' : 'decimalDelegate'"), 'Decimal stake form maps delegate/unbond operations');
assert(bindDecimalForms.includes("broadcast.prepare(chain, 'seed', 'decimalConvert'"), 'Decimal convert is prepared through broadcast guard');
assert(bindDecimalForms.includes("broadcast.prepare(chain, 'seed', 'decimalCreateToken'"), 'Decimal token creation is prepared through broadcast guard');
assert(bindDecimalForms.includes("form.get('mode') === 'unbond' ? 'decimalUnbondNFT' : 'decimalDelegateNFT'"), 'Decimal NFT form maps delegate/unbond operations');
assert(!bindDecimalForms.includes('decimalEVM.broadcast'), 'Decimal wallet forms do not directly broadcast outside bindOperationForm');

[
  'sendDEL',
  'transferToken',
  'delegateDEL',
  'delegateToken',
  'withdrawStakeToken',
  'buyTokenForExactDEL',
  'sellExactTokensForDEL',
  'convertToken',
  'createToken',
  'delegateNFT',
  'withdrawStakeNFT'
].forEach((method) => {
  assert(broadcastSource.includes(method) || planSource.includes(method), `Decimal SDK method recorded or wired: ${method}`);
});

assert(!renderDecimalWallet.includes('Legacy wallet scope notes'), 'Decimal UI does not expose developer notes');
assert(!renderDecimalWallet.includes('plan.md'), 'Decimal UI does not mention plan.md');
assert(!renderDecimalWallet.includes('evidence'), 'Decimal UI does not expose evidence wording');
assert(!renderDecimalWallet.includes('seed/private key'), 'Decimal UI avoids seed/private-key wording');

assert(planSource.includes('## Decimal wallet parity evidence pass'), 'plan.md contains Decimal wallet evidence section');
assert(planSource.includes('`js/app.js`: wallet behavior'), 'plan.md records legacy Decimal wallet app.js inspection');
assert(planSource.includes('`blockchain.js`: Decimal SDK'), 'plan.md records Decimal blockchain.js inspection');
assert(planSource.includes('send(to, amount, coin, memo, mode)'), 'plan.md records legacy send SDK method and params');
assert(planSource.includes('delegate(coin, address, stake, mode)'), 'plan.md records legacy delegate SDK method and params');
assert(planSource.includes('anbond(coin, address, stake, mode)'), 'plan.md records legacy unbond SDK method and params');
assert(planSource.includes('`bip.to` account type'), 'plan.md records blocked BIP wallet flow reason');

console.log('v3-decimal-wallet-smoke ok');
