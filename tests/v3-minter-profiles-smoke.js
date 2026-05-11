const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const appSource = fs.readFileSync(path.join(root, 'v3/js/app.js'), 'utf8');
const chainsSource = fs.readFileSync(path.join(root, 'v3/js/chains.js'), 'utf8');
const profilesSource = fs.readFileSync(path.join(root, 'v3/js/profiles.js'), 'utf8');
const planSource = fs.readFileSync(path.join(root, 'plan.md'), 'utf8');

const renderProfileRoute = (appSource.match(/async function renderProfileRoute[\s\S]*?\n  async function renderRoute/) || [''])[0];
const renderProfile = (appSource.match(/function restProfileNonce[\s\S]*?\n  function renderUnsupported/) || [''])[0];
const minterAppsSlice = (chainsSource.match(/const minterApps = \[[\s\S]*?\n  \];/) || [''])[0];
const minterFetchSlice = (profilesSource.match(/function minterAddressToEvm[\s\S]*?\n  async function fetchDecimalAccount/) || [''])[0];
const minterNormalizeSlice = (profilesSource.match(/function restRows\(account\)[\s\S]*?\n  function uniqueRows/) || [''])[0];

assert(chainsSource.includes("id: 'profiles'"), 'base profiles app remains registered');
assert(chainsSource.includes("accountField: true"), 'profiles keep account/address field');
assert(!minterAppsSlice.includes("id: 'profiles'"), 'Minter profiles is inherited from base apps instead of duplicated in minterApps');
assert(appSource.includes("effectiveAppId === 'profiles'"), 'profiles route is dispatched explicitly');
assert(renderProfileRoute.includes('profiles.fetchAccount'), 'profiles route fetches account data through profile module');
assert(renderProfileRoute.includes('resolveSeedWalletAddress(chain, account)'), 'Minter profiles resolve arbitrary visual login to seed-derived address before fetch');
assert(renderProfileRoute.includes('await loadScript(chain.cryptoPath);'), 'Minter profiles load crypto before seed decrypt/address derivation');
assert(renderProfileRoute.includes('const accountLabel = chain.id === \'minter\' || chain.id === \'decimal\' ? resolvedAccount'), 'Minter profile status reports the derived address, not the display-only login');
assert(renderProfileRoute.includes('profiles.normalizeAccount'), 'profiles route normalizes account data before render');

assert(minterFetchSlice.includes('/addresses/${encodeURIComponent(address)}'), 'Minter profile fetches address endpoint');
assert(minterFetchSlice.includes('/addresses/${encodeURIComponent(address)}/delegations'), 'Minter profile fetches delegations endpoint');
assert(minterFetchSlice.includes('/addresses/${encodeURIComponent(address)}/transactions?page=1'), 'Minter profile fetches transactions endpoint');
assert(minterFetchSlice.includes('/statistics/rewards?start_time='), 'Minter profile fetches yesterday rewards endpoint');
assert(minterFetchSlice.includes('api.etherscan.io'), 'Minter profile preserves Ethereum HUB public token balance lookup');
assert(minterFetchSlice.includes('api.bscscan.com'), 'Minter profile preserves BSC HUB public token balance lookup');
assert(minterFetchSlice.includes('module=account&action=tokenbalance'), 'Minter profile uses public tokenbalance APIs for HUB lookups');
assert(minterFetchSlice.includes('0x8e9a29e7ed21db7c5b2e1cd75e676da0236dfb45'), 'Ethereum HUB contract address is documented in runtime lookup');
assert(minterFetchSlice.includes('0x8ac0a467f878f3561d309cf9b0994b0530b0a9d2'), 'BSC HUB contract address is documented in runtime lookup');

assert(minterNormalizeSlice.includes('Nonce'), 'Minter REST details expose nonce for transaction creation');
assert(minterNormalizeSlice.includes('HUB в Ethereum'), 'Minter REST details expose Ethereum HUB balance');
assert(minterNormalizeSlice.includes('HUB в BSC'), 'Minter REST details expose BSC HUB balance');
assert(renderProfile.includes('copy-${prefix}-nonce'), 'Minter profile renders copy nonce control');
assert(renderProfile.includes('navigator.clipboard.writeText'), 'Minter profile copy nonce uses browser clipboard only');
assert(renderProfile.includes('role="status" aria-live="polite"'), 'Minter profile has accessible live status for copied nonce/errors');
assert(renderProfile.includes('Последние транзакции из API'), 'Minter profile keeps history/transactions table');
assert(renderProfile.includes('Rewards из API'), 'Minter profile keeps rewards section');

assert(!renderProfile.includes('broadcast.prepare'), 'Minter profiles renderer does not prepare transactions');
assert(!renderProfile.includes('broadcast.broadcast'), 'Minter profiles renderer does not broadcast transactions');
assert(!renderProfile.includes('bindOperationForm'), 'Minter profiles renderer does not bind operation forms');
for (const forbidden of ['178.20.43.121', 'backend.dpos.space', '.php']) {
  assert(!minterFetchSlice.includes(forbidden), `Minter profile fetch slice must not depend on ${forbidden}`);
  assert(!renderProfile.includes(forbidden), `Minter profile render slice must not depend on ${forbidden}`);
}

assert(planSource.includes('### Rigorous parity: Minter / profiles'), 'plan.md contains exact Minter / profiles parity section');
assert(planSource.includes('blockchains/minter/apps/profiles/js/app.js'), 'plan records legacy Minter profiles app.js inspection');
assert(planSource.includes('Etherscan/BscScan public tokenbalance APIs'), 'plan records HUB public API evidence');
assert(planSource.includes('copy_nonce'), 'plan records legacy copy_nonce control');
assert(planSource.includes('Minter profiles is read-only'), 'plan records read-only/no-broadcast classification');

console.log('v3-minter-profiles-smoke ok');
