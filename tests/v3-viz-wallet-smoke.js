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
assert(appSource.includes('viz.memo.encode'), 'VIZ encrypted memo uses viz.memo.encode');
assert(appSource.includes('viz_transfer_templates'), 'VIZ transfer templates keep the legacy localStorage key');
assert(appSource.includes("callVizApi(api, 'getVestingDelegations', [account, '', 100, type])"), 'VIZ wallet reads legacy vesting delegation API order');
assert(appSource.includes('fetchVizDelegationsWithNodeFallback'), 'VIZ delegation loader falls back across VIZ nodes');
assert(appSource.includes('getVestingDelegations недоступен после fallback'), 'VIZ delegation errors are not rendered as empty lists');
assert(appSource.includes('0.000000 SHARES отменяет делегирование'), 'VIZ wallet explains delegation cancellation management');
assert(appSource.includes('getInviteByKey(publicKey'), 'VIZ wallet can inspect invite by public key');
assert(appSource.includes('wifToPublic'), 'VIZ create/check invite derives public invite key from secret WIF');

for (const evidence of [
  'blockchains/viz/apps/wallet/config.json',
  'blockchains/viz/apps/wallet/content.php',
  'blockchains/viz/apps/wallet/css/jquery-ui.css',
  'blockchains/viz/apps/wallet/css/style.css',
  'blockchains/viz/apps/wallet/index.php',
  'blockchains/viz/apps/wallet/js/app.js',
  'origin/master:blockchains/viz/js/blockchain.js',
  'viz.broadcast.transfer(active_key, viz_login, to, amount, memo, cb)',
  'viz.broadcast.createInvite(active_key, viz_login, balance, invite_key, cb)',
  'viz.api.getVestingDelegations(viz_login, \'\', 100, type, cb)'
]) {
  assert(planSource.includes(evidence), `plan.md records VIZ legacy evidence: ${evidence}`);
}

assert(appSource.includes('function renderGolosWallet'), 'Golos dedicated wallet remains present');
assert(appSource.includes('renderGolosUiaDepositSection'), 'Golos UIA gateways remain present');

console.log('v3 VIZ wallet smoke passed');
