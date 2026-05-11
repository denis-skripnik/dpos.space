const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const appSource = fs.readFileSync(path.join(root, 'v3/js/app.js'), 'utf8');

assert(appSource.includes('async function renderGolosCalculator'), 'Golos calculator has a dedicated legacy-parity renderer');
assert(appSource.includes("if (chain.id === 'golos')"), 'generic calculator dispatches Golos to the dedicated renderer');
assert(appSource.includes('Рассчитываем стоимость апвоута'), 'Golos calculator includes legacy upvote value section');
assert(appSource.includes('Примерная награда из СГ за сутки'), 'Golos calculator includes legacy daily СГ reward section');
assert(appSource.includes('Перевод GESTS в СГ'), 'Golos calculator includes legacy GESTS to СГ section');
assert(appSource.includes("profiles.apiCall(connection, 'getChainProperties'"), 'Golos upvote calculator reads chain properties from public RPC');
assert(appSource.includes("profiles.apiCall(connection, 'getFeedHistory'"), 'Golos upvote calculator reads feed history from public RPC');
assert(appSource.includes("profiles.apiCall(connection, 'getTicker'"), 'Golos upvote calculator reads optional ticker from public RPC');
assert(appSource.includes('total_reward_fund_steem'), 'Golos upvote formula uses total reward fund');
assert(appSource.includes('total_reward_shares2'), 'Golos upvote formula uses total reward shares');
assert(appSource.includes('vote_regeneration_per_day'), 'Golos upvote formula uses legacy vote regeneration denominator');
assert(appSource.includes('current_median_history'), 'Golos upvote formula uses median feed price');
assert(appSource.includes('(sg / 10000) * 7'), 'Golos daily СГ reward formula preserves legacy calculation');
assert(appSource.includes('gests * totalFund / totalShares'), 'Golos GESTS to СГ converter preserves legacy calculation');
assert(appSource.includes('role="status" aria-live="polite"'), 'Golos calculator results are exposed through accessible live regions');
assert(appSource.includes("calc: 'calculator'"), 'legacy calc route remains aliased to calculator');
assert(appSource.includes('const requestedAppId = legacyAppTarget(chain, state.app);'), 'router canonicalizes legacy app id before app lookup');
assert(appSource.includes('chain.apps.find((item) => item.id === requestedAppId)'), 'router looks up apps by canonicalized legacy id');

console.log('v3 Golos calculator smoke passed');
