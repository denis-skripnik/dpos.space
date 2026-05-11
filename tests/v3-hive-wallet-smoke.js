const assert = require('assert');
const fs = require('fs');

const appSource = fs.readFileSync('v3/js/app.js', 'utf8');
const planSource = fs.readFileSync('plan.md', 'utf8');

const renderHiveWallet = (appSource.match(/async function renderHiveWallet[\s\S]*?\n  async function callSteemApi/) || [''])[0];
const renderHiveForms = (appSource.match(/function renderHiveWalletForms[\s\S]*?\n  function steemPowerRateFromProfile/) || [''])[0];
const bindHiveForms = (appSource.match(/function bindHiveWalletForms[\s\S]*?\n  function bindSteemTransferTemplates/) || [''])[0];

assert(renderHiveWallet.includes('loadHiveWalletData'), 'Hive wallet uses a dedicated data loader');
assert(!renderHiveWallet.includes('return renderGrapheneWallet'), 'Hive wallet is not a thin alias to generic Graphene wallet');
assert(renderHiveWallet.includes('renderHiveWalletBalances'), 'Hive wallet renders dedicated Hive balances');
assert(renderHiveWallet.includes('wallet-hive'), 'Hive wallet has a dedicated root marker');
assert(appSource.includes("callHiveApi(connection, 'getVestingDelegations', [account, '', 100])"), 'Hive wallet reads legacy getVestingDelegations order');

for (const label of ['HIVE', 'HBD', 'HP', 'Savings HIVE', 'Savings HBD', 'Reward HIVE', 'Reward HBD', 'Reward HP']) {
  assert(renderHiveForms.includes(label) || appSource.includes(label), `Hive wallet exposes native label: ${label}`);
}
assert(!renderHiveForms.includes('СГ'), 'Hive wallet forms do not use Golos СГ wording');
assert(!renderHiveForms.includes('SHARES'), 'Hive wallet forms do not use VIZ SHARES wording');
assert(!renderHiveForms.includes('SP'), 'Hive wallet forms do not use Steem SP wording');
assert(!renderHiveWallet.includes('Legacy wallet scope notes'), 'Hive UI does not expose developer notes');

for (const formId of [
  'wallet-transfer-form',
  'wallet-vesting-form',
  'wallet-withdraw-vesting-form',
  'wallet-hive-cancel-withdraw-form',
  'wallet-delegation-form',
  'wallet-claim-form',
  'wallet-savings-to-form',
  'wallet-savings-from-form',
  'wallet-savings-cancel-form'
]) {
  assert(renderHiveForms.includes(formId), `Hive wallet renders ${formId}`);
  assert(bindHiveForms.includes(formId) || bindHiveForms.includes('wallet-hive-cancel-delegation-'), `Hive wallet binds ${formId}`);
}

for (const method of [
  'transferToVesting',
  'withdrawVesting',
  'delegateVestingShares',
  'claimRewardBalance',
  'transferToSavings',
  'transferFromSavings',
  'cancelTransferFromSavings'
]) {
  assert(bindHiveForms.includes(method), `Hive wallet prepares legacy/shared method ${method}`);
}

assert(bindHiveForms.includes('encodeHiveMemoIfNeeded'), 'Hive wallet prepares encrypted # memo when Hive memo API is available');
assert(bindHiveForms.includes('isSteemMemoWif'), 'Hive wallet preserves legacy WIF-in-memo guard');
assert(appSource.includes('0.000000 VESTS'), 'Hive wallet can cancel withdraw/delegation with zero VESTS');
assert(appSource.includes('prefillHiveTransferFromUrl'), 'Hive wallet keeps legacy transfer URL prefill behavior');
assert(appSource.includes('bindGrapheneWalletQuickActions(appEl)'), 'Hive wallet binds shared Graphene quick-action UX helpers');
assert(renderHiveForms.includes("walletQuickActionButton('Перевести максимум HIVE', 'wallet-transfer-form'"), 'Hive wallet balance actions can open transfer details');
assert(renderHiveForms.includes("'wallet-transfer-amount': liquidMax"), 'Hive wallet balance actions prefill transfer amount');
assert(renderHiveForms.includes("walletQuickActionButton('В savings HIVE', 'wallet-savings-to-form'"), 'Hive wallet savings actions can open savings details');
assert(appSource.includes('target.focus()'), 'Hive wallet quick actions move focus to the target field');

for (const evidence of [
  'blockchains/hive/apps/wallet/config.json',
  'blockchains/hive/apps/wallet/content.php',
  'blockchains/hive/apps/wallet/css/jquery-ui.css',
  'blockchains/hive/apps/wallet/css/style.css',
  'blockchains/hive/apps/wallet/index.php',
  'blockchains/hive/apps/wallet/js/app.js',
  'hive.broadcast.transfer(active_key, hive_login, to, amount, memo, cb)',
  'transfer_to_savings(from,to,amount,memo)',
  'transfer_from_savings(from,request_id,to,amount,memo)',
  'cancel_transfer_from_savings(from,request_id)'
]) {
  assert(planSource.includes(evidence), `plan.md records Hive legacy evidence: ${evidence}`);
}

assert(appSource.includes('function renderGolosWallet'), 'Golos dedicated wallet remains present');
assert(appSource.includes('function renderVizWallet'), 'VIZ dedicated wallet remains present');
assert(appSource.includes('function renderSteemWallet'), 'Steem dedicated wallet remains present');

console.log('v3 Hive wallet smoke passed');
