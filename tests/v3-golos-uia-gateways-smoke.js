const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const appSource = fs.readFileSync(path.join(root, 'v3/js/app.js'), 'utf8');

assert(appSource.includes('function bindCopyButtons'), 'Golos fixed/API deposit values have copy-button binding');
assert(appSource.includes('data-copy-value'), 'Golos deposit address/memo renders copy buttons');
assert(appSource.includes('function golosGatewayHasDepositAction'), 'Golos deposit select filters out UIA without actionable deposit gateways');
assert(appSource.includes("filter(golosGatewayHasDepositAction)"), 'Golos deposit select only includes actionable deposit gateways');
assert(appSource.includes('function golosMainBalanceMap'), 'Golos withdraw select can filter by non-zero main balances');
assert(appSource.includes('mainBalances.has(gateway.symbol)'), 'Golos withdraw select only includes tokens with main balance and withdraw metadata');
assert(appSource.includes('data-fill-selected="wallet-golos-uia-withdraw-way"'), 'Golos UIA withdraw has a selected-token maximum button');
assert(appSource.includes('function buildGolosUiaGatewayFromAsset'), 'Golos UIA gateways are built from asset json_metadata');
assert(appSource.includes('function fetchAllGolosAssets'), 'Golos UIA gateways can be loaded from the full asset list, not only wallet balances');
assert(appSource.includes("getAssetsAsync('', [], from, String(pageLimit), 'by_symbol_name')"), 'Golos full UIA list uses legacy getAssetsAsync paging by_symbol_name');
assert(appSource.includes('meta.deposit && meta.deposit.unavailable !== true'), 'deposit metadata respects unavailable flag');
assert(appSource.includes('meta.withdrawal && meta.withdrawal.unavailable !== true'), 'withdrawal metadata respects unavailable flag');
assert(appSource.includes('to_fixed: deposit.to_fixed || deposit.to'), 'deposit fixed address keeps legacy to fallback');
assert(appSource.includes('account: withdrawal.account || withdrawal.to'), 'withdraw gateway account keeps legacy withdrawal.to fallback');
assert(appSource.includes("replaceAll('<account>'"), 'gateway metadata substitutes legacy <account> placeholder');
assert(appSource.includes('/golos/api/uia-deposit?asset='), 'deposit API lookup is preserved');
assert(appSource.includes('0.001 GOLOS'), 'legacy deposit address request transfer amount is preserved');
assert(appSource.includes('function buildGolosWithdrawMemo(prefix, main, postfix)'), 'withdraw memo builder exists');
assert(appSource.includes('return extra ? `${base} ${extra}` : base;'), 'withdraw memo builder preserves prefix + main + optional postfix behavior');
assert(appSource.includes("broadcast.prepare(chain, 'active', 'transfer', [\n        auth.getCurrentLogin(chain),\n        to,\n        amount,\n        memo"), 'UIA withdraw prepares active transfer to gateway with metadata memo');
assert(appSource.includes('data-fill-selected="wallet-golos-transfer-from-tip-token"'), 'Golos transfer_from_tip has a selected-token maximum button');
assert(appSource.includes('data-fill-selected="wallet-golos-token-donate-token"'), 'Golos token donate has a selected-token maximum button');
assert(appSource.includes('function golosTemplateStorageKey(kind, token)'), 'legacy template storage helper exists');
assert(appSource.includes("`${normalizeGolosTokenSymbol(token || 'GOLOS', 'Токен шаблона')}_${kind}_templates`"), 'legacy template localStorage key format is preserved');
assert(appSource.includes('На свой аккаунт в TIP-баланс'), 'built-in transfer template is preserved');
assert(appSource.includes('Перевод с TIP-баланса в ликвид через tiptok'), 'built-in donate template is preserved');
assert(!appSource.includes('UIA gateways/templates: later'), 'Golos UIA gateways/templates are no longer marked as later');

console.log('v3 Golos UIA gateways/templates smoke passed');
