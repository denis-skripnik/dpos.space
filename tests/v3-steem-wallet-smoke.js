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
const chainsSource = fs.readFileSync(path.join(root, 'v3/js/chains.js'), 'utf8');
const broadcastSource = fs.readFileSync(path.join(root, 'v3/js/broadcast.js'), 'utf8');
const historySource = fs.readFileSync(path.join(root, 'v3/js/history.js'), 'utf8');
const planSource = fs.readFileSync(path.join(root, 'plan.md'), 'utf8');

const steem = chains.steem;
assert(steem, 'Steem chain exists');
assert(steem.apps.some((app) => app.id === 'wallet' && app.title === 'Кошелёк'), 'Steem wallet route is registered through base apps');
assert.strictEqual(steem.libraryGlobal, 'steem', 'Steem wallet uses the browser Steem library');
assert.strictEqual(steem.libraryPath, 'v3/vendor/steem/steem.min.js', 'Steem wallet uses vendored browser library');
assert.strictEqual(steem.cryptoPath, 'v3/vendor/steem/sjcl.min.js', 'Steem wallet keeps legacy SJCL key compatibility');

const renderSteemWallet = (appSource.match(/async function renderSteemWallet[\s\S]*?\n  async function renderGrapheneWalletByChain/) || [''])[0];
const renderSteemForms = (appSource.match(/function renderSteemWalletForms[\s\S]*?\n  function bindGolosTemplateControls/) || [''])[0];
const bindSteemForms = (appSource.match(/function bindSteemWalletForms[\s\S]*?\n  function bindGrapheneWalletForms/) || [''])[0];
const steemHelpers = appSource.slice(appSource.indexOf('function steemPowerRateFromProfile'), appSource.indexOf('function bindGrapheneWalletForms'));
const steemDataHelpers = appSource.slice(appSource.indexOf('async function callSteemApi'), appSource.indexOf('async function renderGrapheneWalletByChain'));
const steemRuntimeSlice = [
  chainsSource.match(/steem:\s*\{[\s\S]*?\n    hive:/)?.[0] || '',
  steemDataHelpers,
  renderSteemWallet,
  steemHelpers
].join('\n');

assert(renderSteemWallet.includes('loadSteemWalletData'), 'Steem wallet uses a dedicated data loader');
assert(renderSteemWallet.includes('wallet-steem'), 'Steem wallet has a dedicated root marker');
assert(renderSteemWallet.includes('renderSteemWalletBalances'), 'Steem wallet renders dedicated STEEM/SBD/SP balances');
assert(renderSteemWallet.includes('renderSteemWalletForms'), 'Steem wallet renders dedicated forms instead of a generic alias only');
assert(appSource.includes('renderGrapheneWalletByChain') && appSource.includes("if (chain.id === 'steem') return renderSteemWallet"), 'wallet dispatcher routes Steem to dedicated renderer');

for (const marker of [
  'STEEM',
  'SBD',
  'SP',
  'Перевод STEEM/SBD',
  'STEEM в SP этого аккаунта',
  'Вывод SP в STEEM',
  'Делегирование SP',
  'Получение наград',
  'Savings',
  'Последние финансовые операции Steem',
  'wallet-transfer-form',
  'wallet-vesting-form',
  'wallet-withdraw-vesting-form',
  'wallet-steem-cancel-withdraw-form',
  'wallet-delegation-form',
  'wallet-claim-form',
  'wallet-savings-to-form',
  'wallet-savings-from-form',
  'wallet-savings-cancel-form',
  'role="status" aria-live="polite"'
]) {
  assert(steemRuntimeSlice.includes(marker), `Steem wallet keeps legacy UI/control marker: ${marker}`);
}

for (const marker of [
  'getVestingDelegations',
  'steemPowerRateFromProfile',
  'normalizeSteemPowerInput',
  'steemVestsToSp',
  'prefillSteemTransferFromUrl',
  'isSteemMemoWif(chain, rawMemo)',
  'encodeSteemMemoIfNeeded',
  "'transfer'",
  "'transferToVesting'",
  "'withdrawVesting'",
  "'delegateVestingShares'",
  "'claimRewardBalance'",
  "'transferToSavings'",
  "'transferFromSavings'",
  "'cancelTransferFromSavings'",
  "'0.000000 VESTS'"
]) {
  assert(steemRuntimeSlice.includes(marker), `Steem wallet keeps static-safe operation behavior: ${marker}`);
}

assert(historySource.includes("steem: new Set"), 'Steem wallet history operation allowlist exists');
for (const op of ['transfer', 'transfer_to_vesting', 'withdraw_vesting', 'curation_reward', 'author_reward', 'comment_benefactor_reward', 'producer_reward', 'fill_order']) {
  assert(historySource.includes(`'${op}'`), `Steem wallet history includes ${op}`);
}
assert(broadcastSource.includes("steem: { posting: 'posting"), 'Steem broadcast authority map keeps posting/active authorities');
assert(broadcastSource.includes('function validateAsset'), 'Steem wallet operation amounts are validated through shared broadcast helpers');
assert(broadcastSource.includes('sanitizePrepared'), 'Steem wallet previews use sanitized prepared data before display');

assert(!/backend\.dpos\.space|178\.20\.43\.121|hidden server API|new indexer|daemon|\.php\b|XMLHttpRequest|sendAjax\(/.test(steemRuntimeSlice), 'Steem wallet v3 runtime slice has no private/PHP/backend dependency or hidden service');
assert(!steemRuntimeSlice.includes('blockchains/steem/apps/wallet'), 'Steem wallet runtime does not reference legacy runtime paths');

assert(planSource.includes('### Rigorous parity: Steem / wallet'), 'plan.md contains required Steem/wallet rigorous parity section');
for (const evidence of [
  'blockchains/steem/apps/wallet/config.json',
  'blockchains/steem/apps/wallet/content.php',
  'blockchains/steem/apps/wallet/index.php',
  'blockchains/steem/apps/wallet/js/app.js',
  'blockchains/steem/apps/wallet/css/style.css',
  'blockchains/steem/apps/wallet/css/jquery-ui.css',
  'blockchains/steem/js/blockchain.js',
  'blockchains/steem/js/modal-accounts.js',
  'steem.broadcast.transfer(active_key, steem_login, action_steem_transfer_to, action_steem_transfer_amount, action_steem_transfer_memo, cb)',
  'steem.broadcast.transferToVesting(active_key, steem_login, action_steem_transfer_to, action_steem_transfer_amount, cb)',
  'steem.broadcast.withdrawVesting(active_key, steem_login, withdraw_vests, cb)',
  'steem.broadcast.delegateVestingShares(active_key, steem_login, action_vesting_delegate_to, delegate_vests, cb)',
  'steem.broadcast.claimRewardBalance(posting_key, steem_login, acc.reward_steem_balance, acc.reward_sbd_balance, acc.reward_vesting_balance, cb)',
  'steem.api.getVestingDelegations(steem_login, \'\', 100, cb)',
  'walletData()',
  'tests/v3-steem-wallet-smoke.js'
]) {
  assert(planSource.includes(evidence), `plan.md records Steem wallet evidence: ${evidence}`);
}

console.log('v3 Steem wallet smoke passed');
