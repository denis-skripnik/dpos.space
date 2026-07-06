const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const context = { window: null };
context.window = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root, 'v3/js/chains.js'), 'utf8'), context, { filename: 'v3/js/chains.js' });

const chains = context.DposChains;
const appSource = fs.readFileSync(path.join(root, 'v3/js/app.js'), 'utf8');
const loadGrapheneWalletDataSource = (appSource.match(/function loadGrapheneWalletData[\s\S]*?\n  async function renderGrapheneWallet/) || [''])[0];

assert.deepStrictEqual(Object.keys(chains).sort(), ['decimal', 'golos', 'hive', 'minter', 'steem', 'viz'], 'v3 exposes only the six requested chains');
assert.strictEqual(chains.viz.nodes[0], 'https://api.viz.world', 'VIZ uses api.viz.world as the first public node without trailing slash');
assert(!Object.prototype.hasOwnProperty.call(chains, 'cyber'), 'Cyber is not enabled in v3 chains');
assert(!Object.prototype.hasOwnProperty.call(chains, 'evm'), 'EVM is not enabled in v3 chains');

for (const chain of Object.values(chains)) {
  assert(chain.libraryPath.startsWith('v3/vendor/'), `${chain.id}: libraryPath is vendored under v3`);
  assert(chain.cryptoPath.startsWith('v3/vendor/'), `${chain.id}: cryptoPath is vendored under v3`);
  if (chain.walletPath) assert(chain.walletPath.startsWith('v3/vendor/'), `${chain.id}: walletPath is vendored under v3`);
  assert(fs.existsSync(path.join(root, chain.libraryPath)), `${chain.id}: libraryPath exists`);
  assert(fs.existsSync(path.join(root, chain.cryptoPath)), `${chain.id}: cryptoPath exists`);
  if (chain.walletPath) assert(fs.existsSync(path.join(root, chain.walletPath)), `${chain.id}: walletPath exists`);

  for (const app of chain.apps) {
    const routeMentioned = appSource.includes(`app.id === '${app.id}'`) ||
      appSource.includes(`app.id === \"${app.id}\"`) ||
      appSource.includes(`app.id === '${app.id}' ||`) ||
      appSource.includes(`|| app.id === '${app.id}'`) ||
      appSource.includes(`chain.id === '${chain.id}' && app.id === '${app.id}'`);
    const placeholderCovered = appSource.includes('renderServicePlaceholder(chain, app)');
    assert(routeMentioned || placeholderCovered, `${chain.id}/${app.id}: route has handler or explicit placeholder fallback`);
  }
}

assert(appSource.includes('function hasExplicitRouteState'), 'router detects whether hash parameters were provided');
assert(appSource.includes('function hasChainOnlyRouteState'), 'router detects chain-only hash routes');
assert(appSource.includes('function renderHome'), 'router has a dedicated home renderer for empty hash');
assert(appSource.includes('function renderChainOverview'), 'router has a dedicated blockchain overview renderer for #chain=<id> routes');
assert(appSource.includes('if (!hasExplicitRouteState(state))'), 'empty hash renders home instead of loading a default VIZ profile');
assert(appSource.includes('if (hasChainOnlyRouteState(state))'), 'chain-only hash renders blockchain information instead of loading a default profile');
assert(appSource.includes("updateAccountField({ id: 'chain-overview', accountField: false }, chain)"), 'chain overview hides account/address field instead of showing default account');
assert(appSource.includes("const navApp = baseChain.apps.find((item) => item.id === 'accounts')"), 'chain overview navigation defaults to Accounts rather than account-required Profiles');
assert(appSource.includes('Это обзор блокчейна'), 'chain overview explains that account pages need an explicit section/account');
assert(appSource.includes("Главная страница DPOS.space готова"), 'home route exposes a user-visible ready status');
assert(appSource.includes('Аккаунты по блокчейнам'), 'home route links account services by blockchain');
assert(appSource.includes("appHash({ chain: chain.id, app: 'accounts' })"), 'home account service links are generated for every chain');

const sourceBundle = [
  'index.html',
  'v3/js/chains.js',
  'v3/js/app.js',
  'v3/js/auth.js',
  'v3/js/broadcast.js',
  'v3/js/profiles.js',
  'v3/js/history.js'
].map((file) => fs.readFileSync(path.join(root, file), 'utf8')).join('\n');

assert(!/blockchains\//i.test(sourceBundle), 'v3 source does not reference legacy blockchains paths');
assert(/confirmExecute:\s*true/.test(appSource), 'UI has confirmed real broadcast path');
assert(/dryRun:\s*true/.test(appSource), 'UI keeps preview/dry-run path');

assert(appSource.includes('manage-witness-update-form'), 'manage includes witness settings update form');
assert(appSource.includes('manage-authority-form'), 'manage includes authority/access update form');
assert(appSource.includes('accountCreateWithDelegation'), 'Golos registration includes account_create_with_delegation flow');
assert(appSource.includes("prepareWithPrivateKey(chain, account, 'owner'"), 'authority update uses explicit owner WIF in memory only');
assert(appSource.includes('Owner WIF используется только в памяти'), 'authority update warns about owner WIF handling');

assert(appSource.includes('renderTransactionsTable'), 'profiles/history use shared accessible transaction table renderer');
assert(appSource.includes('<details class="operation-modal-source"'), 'wallet operations are grouped in modal-upgraded operation sources');
assert(!appSource.includes('Особенности кошелька'), 'wallet does not show technical wallet-capabilities block');
assert(appSource.includes('<caption>'), 'transaction tables include captions');
assert(appSource.includes('scope=\"col\"'), 'transaction tables include scoped column headers');
assert(appSource.includes("explorerLink(chain, 'tx'"), 'transaction rows link tx values to explorer route');
assert(appSource.includes("explorerLink(chain, 'block'"), 'transaction rows link block values to explorer route');
assert(appSource.includes("accountLink(chain"), 'transaction rows link account-like values to profiles route');
assert(appSource.includes('renderMinterBroadcast(chain)'), 'Minter: отправка has a separate route and does not collapse to wallet');
assert(appSource.includes('function appRequiresAccount'), 'route form has contextual account-field helper');
assert(appSource.includes('APP_SCOPED_HASH_PARAMS'), 'route navigation clears app-scoped hash params such as longPage when changing app');
assert(appSource.includes('function appUsesAuthorizedAccount'), 'route form has authorized-account selector helper for wallet/manage/broadcast tools');
assert(appSource.includes('accountInput.disabled = !inputVisible'), 'hidden account field is disabled and removed from tab order');
assert(appSource.includes('selectSavedAccount(chain, accountSelect.value)'), 'route submit switches current user from the authorized-account selector');
assert(appSource.includes('function refreshRouteAfterBroadcast'), 'successful broadcast schedules a route refresh for fresh wallet balances/history');
assert(appSource.includes('Обновляю балансы и историю'), 'successful broadcast tells the user balances/history are refreshing');
assert(appSource.includes('renderGrapheneWalletByChain'), 'Graphene wallet route dispatches through chain-specific wallet renderers');
assert(appSource.includes('function renderGolosWallet'), 'Golos wallet has a dedicated renderer entry point');
assert(appSource.includes('function renderVizWallet'), 'VIZ wallet has a dedicated renderer entry point');
assert(appSource.includes('function renderHiveWallet'), 'Hive wallet has a dedicated renderer entry point');
assert(appSource.includes('function renderSteemWallet'), 'Steem wallet has a dedicated renderer entry point');
assert(appSource.includes('function buildGrapheneWalletForms'), 'Graphene wallet keeps shared form markup helper behind chain-specific renderers');
assert(appSource.includes('function bindGolosWalletForms'), 'Golos wallet has a dedicated binding entry point');
assert(appSource.includes('function renderGolosWalletBalances'), 'Golos wallet renders a dedicated balance list instead of generic Graphene rows');
assert(loadGrapheneWalletDataSource.includes('const enrichedAccount = await profiles.enrichAccount(connection, rawAccount);'), 'wallet loading enriches accounts with dynamic properties before rendering СГ/max values');
assert(loadGrapheneWalletDataSource.includes('profiles.normalizeAccount(connection, enrichedAccount)'), 'wallet rendering uses enriched account data for СГ/max values');
assert(appSource.includes('Golos показывает СГ в пользовательских единицах'), 'Golos wallet explains СГ terminology to users');
assert(appSource.includes('Claim accumulative balance'), 'Golos wallet exposes legacy claim accumulative balance wording/operation');
assert(appSource.includes('wallet-golos-transfer-to-tip-form'), 'Golos wallet exposes legacy transfer_to_tip form');
assert(appSource.includes('wallet-golos-transfer-from-tip-form'), 'Golos wallet exposes legacy transfer_from_tip form');
assert(appSource.includes('wallet-golos-token-donate-form'), 'Golos wallet exposes legacy UIA/TIP donate form');
assert(appSource.includes("broadcast.prepare(chain, 'active', 'transferToTip'"), 'Golos transfer_to_tip uses legacy broadcast method name');
assert(appSource.includes("broadcast.prepare(chain, 'active', 'transferFromTip'"), 'Golos transfer_from_tip uses legacy broadcast method name');
assert(appSource.includes("broadcast.prepare(chain, 'posting', 'donate'"), 'Golos token donate uses legacy posting donate method name');
assert(appSource.includes("broadcast.prepare(chain, 'active', 'transferToTip'"), 'Golos transfer_to_tip binding keeps expected operation');
assert(appSource.includes("broadcast.prepare(chain, 'active', 'transferFromTip'"), 'Golos transfer_from_tip binding keeps expected operation');
assert(appSource.includes("broadcast.prepare(chain, 'posting', 'donate'"), 'Golos donate binding keeps expected operation');
assert(appSource.includes('function encodeGolosMemoIfNeeded'), 'Golos wallet preserves legacy # encrypted memo preparation when memo API is available');
assert(appSource.includes("version: 1, comment"), 'Golos donate metadata keeps legacy dpos-space version 1');
assert(appSource.includes('renderGolosUiaDepositSection'), 'Golos wallet renders UIA gateway deposit metadata');
assert(appSource.includes('renderGolosUiaWithdrawSection'), 'Golos wallet renders UIA gateway withdraw metadata');
assert(appSource.includes('function golosTemplateStorageKey'), 'Golos wallet ports legacy transfer/donate templates');
assert(appSource.includes('fetchGolosUiaBalances'), 'Golos wallet fetches UIA balances');
assert(appSource.includes("{ kind: 'uia', symbol: token, balanceType: 'tip' }"), 'Golos UIA TIP balances carry metadata for dedicated rendering');
assert(appSource.includes('function parseGolosUiaBalanceRows'), 'Golos wallet has a dedicated UIA balance parser');
assert(appSource.includes('get_accounts_balances'), 'Golos wallet falls back to direct get_accounts_balances RPC when vendored helper is unavailable');
assert(appSource.includes("{ kind: 'uia-status' }"), 'Golos wallet reports UIA loading diagnostics instead of silently hiding balances');
{
  const helpersSource = ['numericAssetValue', 'formatUiaAmount', 'parseGolosUiaBalanceRows'].map((name) => {
    const match = appSource.match(new RegExp(`function ${name}\\([\\s\\S]*?\\n  }`));
    assert(match, `${name} helper is present for UIA balance smoke`);
    return match[0];
  }).join('\n');
  const parseGolosUiaBalanceRows = Function(`${helpersSource}; return parseGolosUiaBalanceRows;`)();
  const uiaRows = parseGolosUiaBalanceRows([{ TEST: { balance: '12.345', tip_balance: '0.500' }, ZERO: { balance: '0', tip_balance: '0' } }], 'alice');
  assert(uiaRows.some(([label, value, meta]) => label === 'UIA TEST' && value === '12.345 TEST' && meta.balanceType === 'main'), 'Golos UIA main balance row is parsed');
  assert(uiaRows.some(([label, value, meta]) => label === 'UIA TEST TIP' && value === '0.500 TEST' && meta.balanceType === 'tip'), 'Golos UIA TIP balance row is parsed');
  assert(!uiaRows.some(([label]) => label.includes('ZERO')), 'zero UIA balances are not rendered as balance rows');
}
assert(appSource.includes('normalizeGolosPowerInput'), 'Golos wallet accepts СГ amounts and converts them to GESTS for broadcast');
assert.strictEqual(chains.minter.apps.find((app) => app.id === 'long').accountField, undefined, 'Minter LONG does not show the global account field');
assert.strictEqual(chains.minter.apps.find((app) => app.id === 'validators').accountField, undefined, 'Minter validators do not show the global account field');
assert.strictEqual(chains.minter.apps.find((app) => app.id === 'profiles').accountField, true, 'profiles keep the global account field');
assert.strictEqual(chains.minter.apps.find((app) => app.id === 'wallet').accountField, true, 'wallet keeps the global account field');
assert.strictEqual(chains.minter.apps.find((app) => app.id === 'history').accountField, true, 'history keeps the global account field');
assert(appSource.includes('minter-liquidity-form'), 'Minter liquidity/create pool form is present');
assert(appSource.includes('minter-hub-withdraw-form'), 'Minter hub withdraw static transaction form is present');
assert(appSource.includes('EDIT_COIN_OWNER'), 'Minter edit coin owner operation is present');
assert(appSource.includes('decimal-convert-form'), 'Decimal convert/swap form is present');
assert(appSource.includes('validateDecimalValidator'), 'Decimal validators do not reuse account-address-only validation');

assert(appSource.includes('function renderMinterBroadcast'), 'Minter: отправка route has dedicated renderMinterBroadcast');
assert(appSource.includes('Готовая signed TX'), 'Minter: отправка route labels raw signed TX controls');
assert(appSource.includes('Multisig: отправка транзакции'), 'Minter: отправка route labels multisig controls');
assert(appSource.includes("chain.id === 'minter' && effectiveAppId === 'broadcast'"), 'Minter: отправка does not collapse to generic wallet route');
assert(appSource.includes("chain.id === 'decimal' && effectiveAppId === 'broadcast'"), 'Decimal broadcast uses Decimal wallet/SDK forms instead of Graphene wallet forms');
assert(appSource.includes('function renderMinterLong'), 'Minter LONG has a dedicated v3 renderer');
assert(appSource.includes('function renderLongBids'), 'Minter LONG bids subpage has a dedicated backend-data renderer');
assert(appSource.includes('function renderLongDeferredTxs'), 'Minter LONG deferred-txs subpage has a dedicated backend-data renderer');
assert(appSource.includes("const LONG_API_BASE = '/api/smartfarm';"), 'Minter LONG uses active same-origin smartfarm API path');
assert(appSource.includes('fetchLongJson'), 'Minter LONG fetches smartfarm JSON for overview/bids/deferred-txs');
assert(!appSource.includes('http://178.20.43.121:3852/smartfarm'), 'Minter LONG v3 does not use legacy mixed-content backend URL');
assert(!appSource.includes('https://backend.dpos.space/smartfarm'), 'Minter LONG v3 does not call old backend host directly');
assert(!/LONG[\s\S]{0,400}(гарантированн(?:ый|ого) доход|обещаем доход|profit promise)/i.test(appSource), 'LONG copy does not contain income promise phrases');
assert(chains.golos.apps.some((app) => app.id === 'randomblockchain'), 'Golos exposes randomblockchain route in v3');
assert(appSource.includes('resolveRandomBlockchainSeed'), 'randomblockchain resolves numeric block inputs through public RPC');
assert(appSource.includes("profiles.apiCall(connection, 'getBlock'"), 'randomblockchain fetches block data without backend');
assert(appSource.includes('buildTelegramInstantViewUrl'), 'instant-view includes Telegram IV link builder');
assert(appSource.includes('rhash: \'1d27d6e1501db6\''), 'instant-view preserves legacy Telegram IV rhash');
assert(appSource.includes('instant-view-link-form'), 'instant-view exposes URL-to-Telegram-IV form');
assert(appSource.includes('parseImportedArticleHtml'), 'import uses a dedicated local HTML parser');
assert(appSource.includes('htmlToMarkdownLikeText'), 'import converts inserted HTML to readable editor text locally');
assert(appSource.includes('DOMParser'), 'import parses Telegra.ph/Mirror-like HTML in the browser without backend');
assert(appSource.includes('вероятно CORS'), 'import documents browser CORS limitation for URL loading');
assert(appSource.includes("appHash({ chain: chain.id, app: 'editor'"), 'import gives a direct link to the editor after saving draft');
assert(appSource.includes('loadGrapheneOrderBook'), 'swap can load order book through public RPC');
assert(appSource.includes("profiles.apiCall(connection, 'getOrderBook'"), 'swap uses getOrderBook without backend');
assert(appSource.includes('loadGrapheneOpenOrders'), 'swap can load current account open orders');
assert(appSource.includes("profiles.apiCall(connection, 'getOpenOrders'"), 'swap uses getOpenOrders without backend');
assert(appSource.includes('swap-open-orders-load'), 'swap exposes a my-open-orders button');
assert(chains.golos.dexPath === 'v3/vendor/golos/golos-dex.min.js', 'Golos has vendored DEX helper path');
assert(fs.existsSync(path.join(root, chains.golos.dexPath)), 'Golos vendored DEX helper exists');
assert(appSource.includes('swap-direct-form'), 'Golos swap exposes direct market exchange form');
assert(appSource.includes('buildGolosDirectExchangePrepared'), 'Golos direct exchange prepares operation chain from DEX quote');
assert(appSource.includes('dex.getExchange'), 'Golos direct exchange calculates quote through Golos DEX');
assert(appSource.includes('dex.makeExchangeTx'), 'Golos direct exchange builds fill-or-kill operations from DEX steps');
assert(appSource.includes("broadcast.prepare(chain, 'active', 'sendOperations'"), 'Golos direct exchange sends generated operation chain via active key');

assert(appSource.includes('parseVizBeneficiaries'), 'VIZ awards parse beneficiaries account:percent and JSON');
assert(appSource.includes('fixedAward'), 'VIZ awards support fixedAward operation');
assert(appSource.includes('award-payout'), 'VIZ awards expose fixed payout field');
assert(appSource.includes('award-custom-sequence'), 'VIZ awards expose custom_sequence field');
assert(appSource.includes('buildVizAwardLink'), 'VIZ awards expose shareable award link/QR payload');
assert(appSource.includes('renderVizCalculator'), 'VIZ calculator has dedicated static renderer');
assert(appSource.includes('viz-award-value-calculator-form'), 'VIZ calculator ports result_power flow');
assert(appSource.includes('viz-award-fund-calculator-form'), 'VIZ calculator ports result_fund flow');
assert(appSource.includes('viz-vesting-calculator-form'), 'VIZ calculator ports result_vests flow');

assert(chains.viz.apps.some((app) => app.id === 'randomblockchain'), 'VIZ exposes randomblockchain route in v3');
assert(chains.viz.randomHashPath === 'v3/vendor/viz/sha3.min.js', 'VIZ randomblockchain has vendored legacy sha3 path');
assert(fs.existsSync(path.join(root, chains.viz.randomHashPath)), 'VIZ vendored sha3 helper exists');
assert(appSource.includes('keccak_256(witness_signature_1 + witness_signature_2)'), 'VIZ randomblockchain preserves legacy keccak witness_signature algorithm');
assert(appSource.includes('luckyNumber: value + 1'), 'randomblockchain returns legacy 1..N participant number');
assert(appSource.includes('randomblockchain-list'), 'randomblockchain supports participant list winner output');

assert(appSource.includes("chain.id !== 'golos' && chain.id !== 'viz'"), 'VIZ manage supports batch witness voting parity');
assert(appSource.includes('loadWitnessVoteList(chain, witnessVoteState)'), 'generic witness vote list loader is wired');
