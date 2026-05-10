const assert = require('assert');
const fs = require('fs');

const appSource = fs.readFileSync('v3/js/app.js', 'utf8');
const planSource = fs.readFileSync('plan.md', 'utf8');

const renderSteemWallet = (appSource.match(/async function renderSteemWallet[\s\S]*?\n  async function renderGrapheneWalletByChain/) || [''])[0];
const renderSteemForms = (appSource.match(/function renderSteemWalletForms[\s\S]*?\n  function bindGolosTemplateControls/) || [''])[0];
const bindSteemForms = (appSource.match(/function bindSteemWalletForms[\s\S]*?\n  function bindGrapheneWalletForms/) || [''])[0];

assert(renderSteemWallet.includes('loadSteemWalletData'), 'Steem wallet uses a dedicated data loader');
assert(!renderSteemWallet.includes('return renderGrapheneWallet'), 'Steem wallet is not a thin alias to generic Graphene wallet');
assert(renderSteemWallet.includes('renderSteemWalletBalances'), 'Steem wallet renders dedicated Steem balances');
assert(renderSteemWallet.includes('wallet-steem'), 'Steem wallet has a dedicated root marker');
assert(appSource.includes("callSteemApi(connection, 'getVestingDelegations', [account, '', 100])"), 'Steem wallet reads legacy getVestingDelegations order');

for (const label of ['STEEM', 'SBD', 'SP', 'Savings STEEM', 'Savings SBD', 'Reward STEEM', 'Reward SBD', 'Reward SP']) {
  assert(appSource.includes(label), `Steem wallet exposes native label: ${label}`);
}
assert(!renderSteemForms.includes('СГ'), 'Steem forms do not use Golos СГ wording');
assert(!renderSteemForms.includes('SHARES'), 'Steem forms do not use VIZ SHARES wording');
assert(!renderSteemWallet.includes('Legacy wallet scope notes'), 'Steem UI does not expose developer notes');
assert(!renderSteemForms.includes('handler not found'), 'Steem UI does not expose handler notes');

for (const formId of [
  'wallet-transfer-form',
  'wallet-vesting-form',
  'wallet-withdraw-vesting-form',
  'wallet-steem-cancel-withdraw-form',
  'wallet-delegation-form',
  'wallet-claim-form',
  'wallet-savings-to-form',
  'wallet-savings-from-form',
  'wallet-savings-cancel-form'
]) {
  assert(renderSteemForms.includes(formId), `Steem wallet renders ${formId}`);
  assert(bindSteemForms.includes(formId) || bindSteemForms.includes('wallet-steem-cancel-delegation-'), `Steem wallet binds ${formId}`);
}

for (const method of [
  "'transfer'",
  "'transferToVesting'",
  "'withdrawVesting'",
  "'delegateVestingShares'",
  "'claimRewardBalance'",
  "'transferToSavings'",
  "'transferFromSavings'",
  "'cancelTransferFromSavings'"
]) {
  assert(bindSteemForms.includes(method), `Steem wallet prepares legacy/shared method ${method}`);
}

assert(appSource.includes('encodeSteemMemoIfNeeded'), 'Steem encrypted memo helper is present');
assert(appSource.includes('client.memo.encode'), 'Steem encrypted memo uses chain memo encoder');
assert(appSource.includes('isSteemMemoWif'), 'Steem transfer blocks WIF-looking memo before preview/send');
assert(appSource.includes('0.000000 VESTS'), 'Steem wallet can cancel withdraw/delegation with zero VESTS');
assert(appSource.includes('prefillSteemTransferFromUrl'), 'Steem wallet keeps legacy transfer URL prefill behavior');

for (const evidence of [
  'blockchains/steem/apps/wallet/config.json',
  'blockchains/steem/apps/wallet/content.php',
  'blockchains/steem/apps/wallet/css/jquery-ui.css',
  'blockchains/steem/apps/wallet/css/style.css',
  'blockchains/steem/apps/wallet/index.php',
  'blockchains/steem/apps/wallet/js/app.js',
  'origin/master:blockchains/steem/js/blockchain.js',
  'origin/master:blockchains/steem/js/steem.min.js',
  'steem.broadcast.transfer(active_key, steem_login, to, amount, memo, cb)',
  'steem.broadcast.transferToVesting(active_key, steem_login, to, amount, cb)',
  'steem.broadcast.withdrawVesting(active_key, steem_login, vesting_shares, cb)',
  'steem.broadcast.delegateVestingShares(active_key, steem_login, delegatee, vesting_shares, cb)',
  'steem.broadcast.claimRewardBalance(posting_key, steem_login, reward_steem_balance, reward_sbd_balance, reward_vesting_balance, cb)',
  'transfer_to_savings(from,to,amount,memo)',
  'transfer_from_savings(from,request_id,to,amount,memo)',
  'cancel_transfer_from_savings(from,request_id)'
]) {
  assert(planSource.includes(evidence), `plan.md records Steem legacy evidence: ${evidence}`);
}

assert(appSource.includes('function renderGolosWallet'), 'Golos dedicated wallet remains present');
assert(appSource.includes('function renderVizWallet'), 'VIZ dedicated wallet remains present');

console.log('v3 Steem wallet smoke passed');
