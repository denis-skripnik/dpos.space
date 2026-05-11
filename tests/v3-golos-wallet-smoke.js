const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const appSource = fs.readFileSync(path.join(root, 'v3/js/app.js'), 'utf8');
const broadcastSource = fs.readFileSync(path.join(root, 'v3/js/broadcast.js'), 'utf8');
const historySource = fs.readFileSync(path.join(root, 'v3/js/history.js'), 'utf8');

function mustInclude(source, needle, message) {
  assert(source.includes(needle), message || `Expected source to include ${needle}`);
}

mustInclude(appSource, 'wallet-golos-cancel-withdraw-form', 'Golos wallet exposes legacy cancel vesting withdraw control');
mustInclude(appSource, "'0.000000 GESTS'", 'Golos cancel vesting withdraw prepares zero GESTS, matching legacy operation semantics');
mustInclude(appSource, 'wallet-golos-delegation-interest', 'Golos delegation form keeps legacy curator-interest control');
mustInclude(appSource, "method = alreadyDelegated ? 'delegateVestingShares' : 'delegateVestingSharesWithInterest'", 'Golos delegation chooses with-interest method for new delegates and plain method for existing delegates');
mustInclude(appSource, "interestPercent < 0 || interestPercent > 80", 'Golos delegation validates legacy 0-80 percent interest range');
mustInclude(appSource, 'getVestingDelegations', 'Golos wallet loads delegated/received vesting lists');
mustInclude(appSource, 'data-golos-cancel-delegation', 'Golos delegated list offers cancel/prefill control');
mustInclude(appSource, 'bindGrapheneWalletQuickActions(appEl)', 'Golos wallet binds shared Graphene quick-action UX helpers');
mustInclude(appSource, "walletQuickActionButton('Перевести GOLOS', 'wallet-transfer-form'", 'Golos wallet balance actions can open transfer details');
mustInclude(appSource, "'wallet-transfer-amount': raw.balance", 'Golos wallet balance actions prefill transfer amount');
mustInclude(appSource, "walletQuickActionButton('Делегировать СГ', 'wallet-delegation-form'", 'Golos wallet delegation actions can open delegation details');
mustInclude(appSource, "walletQuickActionButton('Донат GOLOS', 'wallet-golos-donate-form'", 'Golos TIP GOLOS balance opens donate form directly');
mustInclude(appSource, "walletQuickActionButton('Получить накопления', 'wallet-golos-claim-form'", 'Golos accumulative balance opens claim form directly');
mustInclude(appSource, "walletQuickActionButton('Перевести UIA', 'wallet-golos-uia-transfer-form'", 'Golos UIA main balances open UIA transfer form directly');
mustInclude(appSource, "walletQuickActionButton('На TIP', 'wallet-golos-transfer-to-tip-form'", 'Golos UIA main balances open transfer_to_tip form directly');
mustInclude(appSource, "walletQuickActionButton('Донат UIA', 'wallet-golos-token-donate-form'", 'Golos UIA TIP balances open token donate form directly');
mustInclude(appSource, 'target.focus()', 'Golos wallet quick actions move focus to the target field');
mustInclude(appSource, 'wallet-golos-invite-claim-form', 'Golos wallet exposes invite claim form');
mustInclude(appSource, "'inviteClaim'", 'Golos invite claim prepares inviteClaim broadcast operation');
mustInclude(appSource, 'wallet-golos-create-invite-form', 'Golos wallet exposes create invite form');
mustInclude(appSource, "'invite', [auth.getCurrentLogin(chain), amount, publicKey, []]", 'Golos create invite broadcasts public key only, not the secret WIF');
mustInclude(appSource, 'generateGolosInviteSecret', 'Golos wallet can generate invite secret using browser crypto and golos.auth.toWif');
mustInclude(appSource, 'wallet-golos-witness-vote-form', 'Golos wallet exposes legacy witness vote support control');
mustInclude(appSource, "'accountWitnessVote'", 'Golos witness vote prepares accountWitnessVote operation');
mustInclude(appSource, 'broadcast.sanitizePrepared(prepared)', 'Operation preview renders sanitized prepared data');
mustInclude(broadcastSource, "if (/private|wif|secret|seed|mnemonic/i.test(key))", 'Broadcast sanitizer redacts secret-like object keys');
mustInclude(broadcastSource, "return typeof value === 'string' && isLikelyWif(value) ? '[redacted-wif]' : value", 'Broadcast result sanitizer redacts WIF-looking strings');
mustInclude(historySource, "'delegate_vesting_shares_with_interest'", 'Golos wallet history includes interest-bearing delegation operations');

const golosWalletSource = appSource.slice(appSource.indexOf('function renderGolosWalletForms'), appSource.indexOf('function vizAsset'));
assert(!golosWalletSource.includes('backend.dpos.space'), 'Golos wallet static implementation must not depend on backend.dpos.space');
assert(!golosWalletSource.includes('178.20.43.121'), 'Golos wallet static implementation must not depend on legacy server IP');
assert(!golosWalletSource.includes('gateways/templates — later'), 'Golos wallet balance notes do not expose stale later wording');

console.log('v3 Golos wallet smoke passed');
