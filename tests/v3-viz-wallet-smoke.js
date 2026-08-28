const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const appSource = fs.readFileSync('v3/js/app.js', 'utf8');
const planSource = fs.readFileSync('plan.md', 'utf8');

const renderVizWallet = (appSource.match(/async function renderVizWallet[\s\S]*?\n  async function renderHiveWallet/) || [''])[0];
const renderVizForms = (appSource.match(/function renderVizWalletForms[\s\S]*?\n  function renderHiveWalletForms/) || [''])[0];
const bindVizForms = (appSource.match(/function bindVizWalletForms[\s\S]*?\n  function bindHiveWalletForms/) || [''])[0];

assert(renderVizWallet.includes('loadVizWalletData'), 'VIZ wallet uses a dedicated data loader, not the generic Graphene renderer directly');
assert(!renderVizWallet.includes('return renderGrapheneWallet'), 'VIZ wallet is no longer a thin alias to generic Graphene wallet');
assert(renderVizWallet.includes('renderVizWalletBalances'), 'VIZ wallet renders dedicated VIZ balances');
assert(renderVizWallet.includes('wallet-viz'), 'VIZ wallet has a dedicated CSS/root marker');

for (const label of ['VIZ', 'SHARES', 'Energy', 'Reward SHARES', 'Итоговые SHARES для наград']) {
  assert(renderVizForms.includes(label) || appSource.includes(label), `VIZ wallet exposes native label: ${label}`);
}
assert(!renderVizForms.includes('СГ'), 'VIZ wallet forms do not use Golos СГ wording');
assert(!renderVizForms.includes('соцкапитал'), 'VIZ wallet forms avoid generic соцкапитал wording');

for (const formId of [
  'wallet-transfer-form',
  'wallet-vesting-form',
  'wallet-withdraw-vesting-form',
  'wallet-viz-cancel-withdraw-form',
  'wallet-delegation-form',
  'wallet-viz-use-invite-form',
  'wallet-viz-create-invite-form',
  'wallet-viz-witness-vote-form'
]) {
  assert(renderVizForms.includes(formId), `VIZ wallet renders ${formId}`);
  assert(bindVizForms.includes(formId), `VIZ wallet binds ${formId}`);
}

for (const method of [
  "'transfer'",
  "'transferToVesting'",
  "'withdrawVesting'",
  "'delegateVestingShares'",
  "'useInviteBalance'",
  "'claimInviteBalance'",
  "'createInvite'",
  "'accountValidatorVote'"
]) {
  assert(bindVizForms.includes(method), `VIZ wallet prepares method ${method}`);
}

assert(appSource.includes('encodeVizMemoIfNeeded'), 'VIZ encrypted memo helper is present');
assert(appSource.includes('client.memo.encode'), 'VIZ encrypted memo uses chain memo encoder');
assert(appSource.includes('viz_transfer_templates'), 'VIZ transfer templates keep the legacy localStorage key');
assert(appSource.includes('wallet-viz-template-save'), 'VIZ wallet can save custom transfer templates');
assert(appSource.includes('wallet-viz-template-remove'), 'VIZ wallet can delete custom transfer templates');
assert(appSource.includes('prefillVizTransferFromUrl'), 'VIZ wallet has a URL transfer prefill helper');
assert(appSource.includes("params.get(name) || hashParams.get(name)"), 'VIZ transfer prefill reads query/hash params');
assert(appSource.includes("get('to')") && appSource.includes("get('amount')") && appSource.includes("get('memo')"), 'VIZ transfer prefill supports to/amount/memo params');
assert(bindVizForms.includes('prefillVizTransferFromUrl()'), 'VIZ wallet calls transfer URL prefill after rendering forms');
assert(appSource.includes('Memo похоже на приватный ключ'), 'VIZ transfer hard-stops raw WIF-like memo before preparing operation');
assert(appSource.includes('isSteemMemoWif(chain, rawMemo)'), 'VIZ transfer uses WIF memo guard on raw memo');
assert(appSource.includes("callVizApi(api, 'getVestingDelegations', [account, '', 100, type])"), 'VIZ wallet reads legacy vesting delegation API order');
assert(appSource.includes('fetchVizDelegationsWithNodeFallback'), 'VIZ delegation loader falls back across VIZ nodes');
assert(appSource.includes('getVestingDelegations недоступен после fallback'), 'VIZ delegation errors are not rendered as empty lists');
assert(appSource.includes('0.000000 SHARES отменяет делегирование'), 'VIZ wallet explains delegation cancellation management');
assert(appSource.includes('bindGrapheneWalletQuickActions(appEl)'), 'VIZ wallet binds shared Graphene quick-action UX helpers');
assert(appSource.includes("walletQuickActionButton('Перевести VIZ', 'wallet-transfer-form'"), 'VIZ wallet balance actions can open transfer details');
assert(appSource.includes("'wallet-transfer-amount': raw.balance"), 'VIZ wallet balance actions prefill transfer amount');
assert(appSource.includes("walletQuickActionButton('Делегировать SHARES', 'wallet-delegation-form'"), 'VIZ wallet delegation actions can open delegation details');
assert(appSource.includes('data-viz-cancel-amount') && appSource.includes('vizDelegationReturnAvailable'), 'VIZ delegated rows carry full amount and availability state for cancel shortcut');
assert(appSource.includes('button.disabled = button.dataset.vizCancelDisabled === \'1\'') && appSource.includes('Возврат будет доступен'), 'VIZ delegated cancel shortcut is disabled until min delegation return time');
assert(appSource.includes("amountInput.value = '0.000000 SHARES'") && appSource.includes('button.dataset.vizCancelAmount'), 'VIZ delegated cancel shortcut opens the form for full-row cancellation while preserving legacy zero-SHARES operation');
assert(appSource.includes('function normalizeHumanAssetInput'), 'VIZ wallet has a helper that accepts plain human numbers and appends the network asset symbol');
assert(bindVizForms.includes("normalizeHumanAssetInput(chain, form.get('vesting'), chain.vestingSymbol, 'Сумма SHARES'"), 'VIZ SHARES withdraw accepts plain numbers and normalizes to six-decimal SHARES');
assert(bindVizForms.includes("normalizeHumanAssetInput(chain, form.get('vesting'), chain.vestingSymbol, 'Сумма SHARES'"), 'VIZ SHARES delegation accepts plain numbers and normalizes to six-decimal SHARES');
assert(appSource.includes('Осталось до завершения вывода') && appSource.includes('vizWithdrawRemainingText'), 'VIZ wallet shows remaining time for the current SHARES withdraw process');
const helperRuntime = [
  appSource.slice(appSource.indexOf('function numericAssetValue'), appSource.indexOf('function formatUiaAmount')),
  appSource.slice(appSource.indexOf('function normalizeHumanAssetInput'), appSource.indexOf('function normalizeVizSharingRatePercent')),
  appSource.slice(appSource.indexOf('function vizAssetMicroAmount'), appSource.indexOf('function renderVizWalletBalances')),
  `this.__walletHelpers = { normalizeHumanAssetInput, vizWithdrawRemainingText };`
].join('\n');
const helperContext = { Date };
vm.createContext(helperContext);
vm.runInContext(helperRuntime, helperContext, { filename: 'v3/js/app.js#wallet-helper-slice' });
assert.strictEqual(helperContext.__walletHelpers.normalizeHumanAssetInput({ vestingSymbol: 'SHARES' }, '100000', 'SHARES', 'Сумма SHARES'), '100000.000000 SHARES', 'plain VIZ SHARES number is normalized to chain asset');
assert.strictEqual(helperContext.__walletHelpers.normalizeHumanAssetInput({ vestingSymbol: 'SHARES' }, '100000,5 SHARES', 'SHARES', 'Сумма SHARES'), '100000.500000 SHARES', 'comma and optional SHARES suffix are accepted for VIZ SHARES');
const remainingText = helperContext.__walletHelpers.vizWithdrawRemainingText({ vesting_withdraw_rate: '24130.142198 SHARES', to_withdraw: '300755293845', withdrawn: '120650710990', next_vesting_withdrawal: '2026-08-28T19:15:54' }, Date.parse('2026-08-28T11:04:41Z'));
assert(remainingText.includes('180104.582855 SHARES') && remainingText.includes('8 интервалов') && remainingText.includes('2026-09-04 19:15:54 UTC'), 'VIZ remaining withdraw helper uses to_withdraw/withdrawn/rate/next date');
assert(appSource.includes('target.focus()'), 'VIZ wallet quick actions move focus to the target field');
assert(appSource.includes('getInviteByKey(publicKey'), 'VIZ wallet can inspect invite by public key');
assert(appSource.includes('wifToPublic'), 'VIZ create/check invite derives public invite key from secret WIF');
assert(appSource.includes('crypto.getRandomValues'), 'VIZ generated invite secrets use cryptographic browser randomness');
assert(!bindVizForms.includes('Math.random'), 'VIZ wallet binding does not use Math.random for generated invite secrets');
assert(bindVizForms.includes('vizInvitePublic(form.get(\'secret\'))'), 'VIZ createInvite sends derived public invite key, not a private WIF');
assert(!bindVizForms.includes("'createInvite', [auth.getCurrentLogin(chain), amount, String(form.get('secret')"), 'VIZ createInvite operation params do not include the private invite secret');
assert(fs.readFileSync('v3/js/broadcast.js', 'utf8').includes('function executeVizonator'), 'VIZ Vizonator JS bridge adapter is present');
assert(fs.readFileSync('v3/js/broadcast.js', 'utf8').includes("transfer_to_vesting', { to, amount }"), 'VIZ Vizonator transfer_to_vesting uses legacy bridge options');
assert(appSource.includes('Для Vizonator memo с # передаётся в расширение как есть'), 'VIZ wallet warns about Vizonator #memo behavior');
assert(appSource.includes("id: 'ton_gram_gate'") && appSource.includes("to: 'gram.gate'") && appSource.includes('TON адрес в memo без префиксов'), 'VIZ transfer built-ins include the TON/Gram gateway template');
assert(!renderVizForms.includes('XCHNG.VIZ') && !renderVizForms.includes('VIZUIA на Голосе') && !renderVizForms.includes('Graphene биржа') && !renderVizForms.includes('Шлюз в Minter'), 'VIZ transfer built-ins no longer show obsolete exchange/Golos/Minter templates');

for (const evidence of [
  'blockchains/viz/apps/wallet/config.json',
  'blockchains/viz/apps/wallet/content.php',
  'blockchains/viz/apps/wallet/css/jquery-ui.css',
  'blockchains/viz/apps/wallet/css/style.css',
  'blockchains/viz/apps/wallet/index.php',
  'blockchains/viz/apps/wallet/js/app.js',
  'blockchains/viz/js/blockchain.js',
  'viz.broadcast.transfer(active_key, viz_login, to, amount, memo, cb)',
  'viz.broadcast.createInvite(active_key, viz_login, balance, invite_key, cb)',
  'viz.api.getVestingDelegations(viz_login, \'\', 100, type, cb)'
]) {
  assert(planSource.includes(evidence), `plan.md records VIZ legacy evidence: ${evidence}`);
}

assert(appSource.includes('let walletHistoryError = \'\''), 'Graphene wallet data treats account history as optional state');
assert(appSource.includes('walletHistoryError = profiles.formatError(error)'), 'Graphene wallet data stores history RPC failures instead of throwing');
assert(appSource.includes('function renderWalletHistoryNotice'), 'Wallet renders an accessible notice when history is unavailable');
assert(renderVizWallet.includes('renderWalletHistoryNotice(data)'), 'VIZ wallet shows history errors without breaking balances/forms');
assert(appSource.includes('Балансы и формы кошелька загружены'), 'History failure notice tells users that wallet functions remain available');

assert(appSource.includes('function renderGolosWallet'), 'Golos dedicated wallet remains present');
assert(appSource.includes('renderGolosUiaDepositSection'), 'Golos UIA gateways remain present');

console.log('v3 VIZ wallet smoke passed');
