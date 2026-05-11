const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const appSource = fs.readFileSync(path.join(root, 'v3/js/app.js'), 'utf8');
const chainsSource = fs.readFileSync(path.join(root, 'v3/js/chains.js'), 'utf8');
const profilesSource = fs.readFileSync(path.join(root, 'v3/js/profiles.js'), 'utf8');
const historySource = fs.readFileSync(path.join(root, 'v3/js/history.js'), 'utf8');
const planSource = fs.readFileSync(path.join(root, 'plan.md'), 'utf8');

const renderProfileRoute = (appSource.match(/async function renderProfileRoute[\s\S]*?\n  async function renderRoute/) || [''])[0];
const renderProfile = (appSource.match(/function restProfileNonce[\s\S]*?\n  function renderUnsupported/) || [''])[0];
const decimalAppsSlice = (chainsSource.match(/const decimalApps = \[[\s\S]*?\n  \];/) || [''])[0];
const decimalFetchSlice = (profilesSource.match(/async function fetchDecimalAccount[\s\S]*?\n  async function fetchAccount/) || [''])[0];
const decimalRewardsSlice = (profilesSource.match(/async function fetchDecimalRewards[\s\S]*?\n  async function fetchAccount/) || [''])[0];
const decimalNormalizeSlice = (profilesSource.match(/function restRows\(account\)[\s\S]*?\n  function uniqueRows/) || [''])[0];

assert(chainsSource.includes("id: 'profiles'"), 'base profiles app remains registered');
assert(chainsSource.includes("accountField: true"), 'profiles keep account/address field');
assert(!decimalAppsSlice.includes("id: 'profiles'"), 'Decimal profiles is inherited from base apps instead of duplicated in decimalApps');
assert(appSource.includes("effectiveAppId === 'profiles'"), 'profiles route is dispatched explicitly');
assert(renderProfileRoute.includes('profiles.fetchAccount'), 'profiles route fetches account data through profile module');
assert(renderProfileRoute.includes('resolveSeedWalletAddress(chain, account)'), 'Decimal profiles resolve arbitrary visual login to seed-derived address before fetch');
assert(renderProfileRoute.includes('await loadScript(chain.cryptoPath);'), 'Decimal profiles load crypto before seed decrypt/address derivation');
assert(renderProfileRoute.includes('const accountLabel = chain.id === \'minter\' || chain.id === \'decimal\' ? resolvedAccount'), 'Decimal profile status reports the derived address, not the display-only login');
assert(renderProfileRoute.includes('profiles.normalizeAccount'), 'profiles route normalizes account data before render');

assert(decimalFetchSlice.includes('/addresses/${encodeURIComponent(address)}'), 'Decimal profile fetches address endpoint');
assert(decimalFetchSlice.includes('/addresses/${encodeURIComponent(address)}/balances'), 'Decimal profile fetches balances endpoint');
assert(decimalFetchSlice.includes('/txs/txs-by-address/${encodeURIComponent(address)}?limit=10&offset=0'), 'Decimal profile fetches first transaction page');
assert(decimalFetchSlice.includes('/rewards/${encodeURIComponent(address)}?limit=20&offset=0'), 'Decimal profile fetches rewards endpoint');
assert(decimalFetchSlice.includes('/address/${encodeURIComponent(address)}/nfts?limit=20&offset=0'), 'Decimal profile fetches owned NFTs through SDK gateway endpoint');
assert(decimalFetchSlice.includes('tokens ||'), 'Decimal profile unwraps SDK gateway getNfts tokens payload');
assert(profilesSource.includes('fetchDecimalRewards'), 'Decimal profile exposes client-side rewards helper');
assert(decimalRewardsSlice.includes('/rewards/${encodeURIComponent(address)}?limit=200&offset=${offset}'), 'Decimal rewards helper paginates the public rewards endpoint');
assert(decimalRewardsSlice.includes('reward.currency'), 'Decimal rewards helper groups rewards by currency like legacy');
assert(decimalRewardsSlice.includes('endTime'), 'Decimal rewards helper stops at selected day window');

assert(decimalNormalizeSlice.includes('Nonce'), 'Decimal REST details expose nonce for transaction creation');
assert(renderProfile.includes('copy-${prefix}-nonce'), 'Decimal profile renders copy nonce control');
assert(renderProfile.includes('decimal-rewards-days'), 'Decimal profile renders rewards calculator days field');
assert(renderProfile.includes('decimal-rewards-result'), 'Decimal profile renders accessible rewards calculation result');
assert(renderProfile.includes('profiles.fetchDecimalRewards'), 'Decimal rewards calculator uses profile module helper');
assert(renderProfile.includes('role="status" aria-live="polite"'), 'Decimal profile has accessible live statuses for copy/reward controls');
assert(renderProfile.includes('Последние транзакции из API'), 'Decimal profile keeps transaction/history table');
assert(renderProfile.includes('Rewards из API'), 'Decimal profile keeps rewards section');
assert(historySource.includes('/txs/txs-by-address/${encodeURIComponent(accountName)}'), 'Decimal history remains public OpenAPI based');

assert(!renderProfile.includes('broadcast.prepare'), 'Decimal profiles renderer does not prepare transactions');
assert(!renderProfile.includes('broadcast.broadcast'), 'Decimal profiles renderer does not broadcast transactions');
assert(!renderProfile.includes('bindOperationForm'), 'Decimal profiles renderer does not bind operation forms');
for (const forbidden of ['178.20.43.121', 'backend.dpos.space', '.php']) {
  assert(!decimalFetchSlice.includes(forbidden), `Decimal profile fetch slice must not depend on ${forbidden}`);
  assert(!decimalRewardsSlice.includes(forbidden), `Decimal rewards slice must not depend on ${forbidden}`);
  assert(!renderProfile.includes(forbidden), `Decimal profile render slice must not depend on ${forbidden}`);
}

assert(planSource.includes('### Rigorous parity: Decimal / profiles'), 'plan.md contains exact Decimal / profiles parity section');
assert(planSource.includes('blockchains/decimal/apps/profiles/js/app.js'), 'plan records legacy Decimal profiles app.js inspection');
assert(planSource.includes('calc_rewards'), 'plan records legacy rewards calculator control');
assert(planSource.includes('copy_nonce'), 'plan records legacy copy_nonce control');
assert(planSource.includes('Decimal profiles is read-only'), 'plan records read-only/no-broadcast classification');

console.log('v3-decimal-profiles-smoke ok');
