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
assert(appSource.includes('<details class="operation-details"'), 'wallet operations are grouped in native details/summary spoilers');
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
assert(appSource.includes("chain.id === 'minter' && app.id === 'broadcast'"), 'Minter: отправка does not collapse to generic wallet route');
assert(appSource.includes("chain.id === 'decimal' && app.id === 'broadcast'"), 'Decimal broadcast uses Decimal wallet/SDK forms instead of Graphene wallet forms');
assert(appSource.includes('function renderMinterLong'), 'Minter LONG has a dedicated v3 renderer');
assert(appSource.includes("fetchLongJson('/bids'"), 'Minter LONG bids endpoint is wired');
assert(appSource.includes("fetchLongJson('/deferred-txs'"), 'Minter LONG deferred-txs endpoint is wired');
assert(appSource.includes("const LONG_API_BASE = '/api/smartfarm';"), 'Minter LONG uses same-origin API proxy endpoint');
assert(!appSource.includes('http://178.20.43.121:3852/smartfarm'), 'Minter LONG v3 does not use legacy mixed-content backend URL');
assert(!/LONG[\s\S]{0,400}(гарантированн(?:ый|ого) доход|обещаем доход|profit promise)/i.test(appSource), 'LONG copy does not contain income promise phrases');
