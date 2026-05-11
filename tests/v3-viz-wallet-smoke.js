const assert = require('assert');
const fs = require('fs');

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
  "'accountWitnessVote'"
]) {
  assert(bindVizForms.includes(method), `VIZ wallet prepares legacy method ${method}`);
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

assert(appSource.includes('function renderGolosWallet'), 'Golos dedicated wallet remains present');
assert(appSource.includes('renderGolosUiaDepositSection'), 'Golos UIA gateways remain present');

console.log('v3 VIZ wallet smoke passed');
