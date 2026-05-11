const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const appSource = fs.readFileSync(path.join(root, 'v3/js/app.js'), 'utf8');
const chainsSource = fs.readFileSync(path.join(root, 'v3/js/chains.js'), 'utf8');
const planSource = fs.readFileSync(path.join(root, 'plan.md'), 'utf8');

const renderMinterWallet = (appSource.match(/async function renderMinterWallet[\s\S]*?\n  function renderCosmosWallet/) || [''])[0];
const renderMinterForms = (appSource.match(/function renderMinterWalletForms[\s\S]*?\n  async function renderMinterWallet/) || [''])[0];
const bindMinterForms = (appSource.match(/function bindMinterWalletForms[\s\S]*?\n  function bindDecimalWalletForms/) || [''])[0];

assert(renderMinterWallet.includes('loadMinterWalletData'), 'Minter wallet uses a dedicated data loader');
assert(appSource.includes('function resolveSeedWalletAddress(chain, account)'), 'Minter/Decimal wallet resolves display login to derived seed address');
assert(appSource.includes('function deriveSeedWalletAddress(chain, user)'), 'seed wallet address derivation helper exists');
assert(appSource.includes('global.minterWallet.walletFromMnemonic(seed)'), 'Minter wallet derives address from saved seed mnemonic, not from display login');
assert(appSource.includes("if (value && isValidChainAddress(chain, value) && value !== login)"), 'explicit real address is still allowed, while display login can derive from seed');
assert(appSource.includes('await loadScript(chain.cryptoPath);'), 'wallet renderer loads crypto before decrypting saved seed');
assert(renderMinterWallet.includes('wallet-minter'), 'Minter wallet has a dedicated root marker');
assert(renderMinterWallet.includes('renderMinterWalletBalances'), 'Minter wallet renders dedicated balances/delegations/history');
assert(renderMinterWallet.includes('renderMinterWalletForms'), 'Minter wallet renders dedicated Minter forms');
assert(renderMinterWallet.includes('bindMinterWalletForms'), 'Minter wallet binds dedicated Minter forms');
assert(!renderMinterWallet.includes('return renderCosmosWallet'), 'Minter wallet is not a thin alias to generic Cosmos wallet');

assert(appSource.includes("chain.id === 'minter' && (effectiveAppId === 'wallet' || effectiveAppId === 'swap' || effectiveAppId === 'my-coin')"), 'Minter wallet/swap/my-coin route dispatches to Minter-specific renderer before generic Cosmos');
assert(chainsSource.includes('https://explorer-api.minter.network/api/v2'), 'Minter explorer API base is configured');
assert(appSource.includes('/addresses/${encodeURIComponent(address)}'), 'Minter wallet fetches address balances endpoint');
assert(appSource.includes('/addresses/${encodeURIComponent(address)}/delegations'), 'Minter wallet fetches delegations endpoint');
assert(appSource.includes('/addresses/${encodeURIComponent(address)}/transactions?page=1'), 'Minter wallet fetches transactions endpoint');

assert(renderMinterForms.includes('minter-send-form'), 'Minter send form is present');
assert(renderMinterForms.includes('minter-send-details'), 'Minter send operation is collapsed in details by default');
assert(renderMinterForms.includes('minter-delegate-form'), 'Minter delegate/unbond form is present');
assert(renderMinterForms.includes('minter-delegate-details'), 'Minter stake/unbond operation is collapsed in details by default');
assert(appSource.includes('minter-swap-form'), 'Minter swap form remains present');
assert(appSource.includes('minter-swap-details'), 'Minter swap operation is collapsed in details by default');
assert(appSource.includes('minter-liquidity-form'), 'Minter liquidity form remains present');
assert(appSource.includes('minter-liquidity-details'), 'Minter liquidity operation is collapsed in details by default');
assert(appSource.includes('minter-hub-withdraw-form'), 'Minter Hub withdraw form remains present');
assert(appSource.includes('minter-hub-withdraw-details'), 'Minter Hub withdraw operation is collapsed in details by default');
assert(appSource.includes('minter-coin-form'), 'Minter coin/token form remains present');
assert(appSource.includes('minter-coin-details'), 'Minter coin/token operation is collapsed in details by default');
assert(appSource.includes('data-minter-action="unbond"'), 'Minter delegation rows expose quick unbond action');
assert(appSource.includes('data-minter-amount="${escapeHtml(amount)}" data-minter-coin'), 'Minter balance action buttons preserve the selected full balance for form maximum/prefill');
assert(appSource.includes('bindMinterQuickActions(appEl)'), 'Minter wallet binds quick actions after rendering');
assert(renderMinterForms.includes('data-fill-target="minter-send-amount"'), 'Minter send form exposes an explicit maximum button when a balance-table action prefills the amount');
assert(renderMinterForms.includes('data-fill-target="minter-delegate-amount"'), 'Minter stake form exposes an explicit maximum button when a balance-table action prefills the amount');
assert(appSource.includes('setMinterField(\'minter-swap-amount\', button.dataset.minterAmount)'), 'Minter swap quick action prefills amount from the balance row, matching legacy max-token convert UX');
assert(appSource.includes('setMinterField(\'minter-liquidity-coin0\', button.dataset.minterCoin'), 'Minter balance action can prefill liquidity coin0 without manual raw retyping');
assert(renderMinterForms.includes('Публичный ключ валидатора'), 'Minter-native validator label is present');
assert(renderMinterForms.includes('Монета газа'), 'Minter gas coin label is present');
assert(renderMinterForms.includes('Checks'), 'Minter check/redeem status is user-visible without invented form');

assert(bindMinterForms.includes("global.minterWallet.isValidMnemonic(memo)"), 'Minter send blocks seed-like memo like legacy');
assert(bindMinterForms.includes("minterTx('SEND'"), 'Minter send uses SEND tx type');
assert(bindMinterForms.includes("txType = mode === 'unbond' ? 'UNBOND' : 'DELEGATE'"), 'Minter stake form maps delegate/unbond to exact tx types');
assert(bindMinterForms.includes("txType = route.length ? 'SELL_SWAP_POOL' : 'SELL'"), 'Minter swap maps pool route to SELL_SWAP_POOL and plain route to SELL');
assert(bindMinterForms.includes("mode === 'CREATE_SWAP_POOL' ? 'volume1' : 'maximumVolume1'"), 'Minter liquidity preserves create-pool/add-liquidity param names');
assert(bindMinterForms.includes('Mx68f4839d7f32831b9234f9575f3b95e1afe21a56'), 'Minter Hub withdraw target address is present');
assert(bindMinterForms.includes("type: `send_to_${destinationChain}`"), 'Minter Hub memo type follows legacy send_to_<chain> order');
assert(bindMinterForms.includes('EDIT_COIN_OWNER'), 'Minter edit coin owner operation remains present');
assert(appSource.includes('MINT_TOKEN') && appSource.includes('BURN_TOKEN'), 'Minter token mint/burn operations remain present');

assert(!renderMinterWallet.includes('Legacy wallet scope notes'), 'Minter UI does not expose developer notes');
assert(!renderMinterWallet.includes('plan.md'), 'Minter UI does not mention plan.md');
assert(!renderMinterWallet.includes('evidence'), 'Minter UI does not expose evidence wording');
assert(!renderMinterWallet.includes('seed/private key'), 'Minter UI avoids technical seed/private-key notes');

assert(planSource.includes('### Rigorous parity: Minter / wallet'), 'plan.md contains exact Minter / wallet parity section');
assert(planSource.includes('## Minter wallet parity evidence pass'), 'plan.md contains Minter wallet evidence section');
assert(planSource.includes('`origin/master:blockchains/minter/apps/wallet/js/app.js`: wallet UI logic'), 'plan.md records legacy wallet app.js inspection');
assert(planSource.includes('`origin/master:blockchains/minter/js/blockchain.js`'), 'plan.md records shared blockchain.js inspection');
assert(planSource.includes('send(to, value, coin, memo, mode, gasCoin)'), 'plan.md records legacy send param order');
assert(planSource.includes('convert(coin, to, value, minimum_buy_amount, swap_route, mode, gasCoin)'), 'plan.md records legacy convert param order');
assert(planSource.includes('addToPool(coin, to, amount1, amount2, mode, variant, gasCoin, payload)'), 'plan.md records legacy addToPool param order');
assert(planSource.includes('anbond(coin, publicKey, stake, mode)'), 'plan.md records legacy unbond/anbond spelling and param order');
assert(planSource.includes('BIP wallet external `prepareLink` flow'), 'plan.md records blocked BIP wallet link flow reason');

console.log('v3-minter-wallet-smoke ok');
