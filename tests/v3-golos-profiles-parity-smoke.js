const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const appSource = fs.readFileSync(path.join(root, 'v3/js/app.js'), 'utf8');
const context = { window: null, localStorage: { getItem() { return null; }, setItem() {} } };
context.window = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root, 'v3/js/profiles.js'), 'utf8'), context, { filename: 'v3/js/profiles.js' });
vm.runInContext(fs.readFileSync(path.join(root, 'v3/js/history.js'), 'utf8'), context, { filename: 'v3/js/history.js' });

(async () => {
  let capturedArgs = null;
  const chain = {
    config: { id: 'golos', title: 'Golos', liquidSymbol: 'GOLOS', powerTitle: 'СГ' },
    node: 'https://golos.test',
    client: {
      api: {
        getAccountHistoryAsync(...args) {
          capturedArgs = args;
          return Promise.resolve([
            [42, { op: ['donate', { from: 'alice', to: 'denis', amount: '1.000 GOLOS' }], timestamp: '2026-05-10T00:00:00', trx_id: 'abc' }]
          ]);
        }
      }
    }
  };

  const items = await context.DposHistory.fetchAccountHistory(chain, 'denis', { limit: 10, ops: ['donate'] });
  assert.strictEqual(JSON.stringify(capturedArgs), JSON.stringify(['denis', -1, 10, { select_ops: ['donate'] }]), 'Golos legacy profile subpages map to direct get_account_history select_ops filtering');
  assert.strictEqual(items[0].type, 'donate', 'donate history row normalizes for profile parity');
  assert.strictEqual(context.DposHistory.operationTitle('comment_benefactor_reward'), 'Бенефициарская награда', 'benefactor rewards keep readable history title');

  const profile = context.DposProfiles.normalizeAccount(chain, {
    name: 'denis',
    balance: '1.000 GOLOS',
    vesting_shares: '1000000.000000 GESTS',
    golosProfileExtras: {
      followers: [{ follower: 'alice' }],
      following: [{ following: 'bob' }],
      delegationsOut: [{ delegatee: 'carol', vesting_shares: '1.000000 GESTS' }],
      witness: { owner: 'denis', url: 'https://example.com' },
      blogPosts: [{ author: 'denis', permlink: 'post', title: 'Post' }],
      comments: [{ author: 'denis', permlink: 'comment', title: '' }]
    }
  });
  assert.strictEqual(profile.raw.golosProfileExtras.followers[0].follower, 'alice', 'direct Golos follow-list extras are preserved for profile rendering');

  assert(appSource.includes('fetchGolosProfileExtras(connection, account)'), 'Golos profiles load direct public RPC extras');
  assert(appSource.includes("getFollowers', [account, '', 'blog', 11]"), 'followers.php maps to getFollowers static RPC');
  assert(appSource.includes("getFollowing', [account, '', 'blog', 11]"), 'followers.php followings mode maps to getFollowing static RPC');
  assert(appSource.includes("getVestingDelegations', [account, '', 100, 'delegated']"), 'delegations.php delegated mode maps to getVestingDelegations');
  assert(appSource.includes("getWitnessByAccount', [account]"), 'witness.php maps to getWitnessByAccount');
  assert(appSource.includes("getDiscussionsByBlog', [{ limit: 10, select_authors: [account] }]"), 'blog-posts.php maps to getDiscussionsByBlog');
  assert(appSource.includes("getDiscussionsByComments', [{ limit: 10, start_author: account }]"), 'comments.php maps to getDiscussionsByComments');
  const golosContentListSlice = (appSource.match(/function renderGolosContentList[\s\S]*?\n  function renderGolosLegacyDirectSections/) || [''])[0];
  assert(appSource.includes("appHash({ chain: 'golos', app: 'post', author, permlink })"), 'Golos profile blog/comment rows link to the internal dpos.space post viewer');
  assert(!golosContentListSlice.includes('https://golos.id'), 'Golos profile content rows do not send users to external golos.id by default');
  assert(!appSource.includes('Golos direct profile data from public RPC'), 'Golos profile hides technical RPC snippet wrapper from users');
  assert(!appSource.includes('Эти блоки заменяют старые PHP snippets'), 'Golos profile does not show implementation notes in UI');
  const golosDirectSlice = (appSource.match(/function renderGolosLegacyDirectSections[\s\S]*?\n  function renderSteemLegacyDirectSections/) || [''])[0];
  assert(golosDirectSlice.indexOf("renderGolosContentList('Последние посты'") >= 0, 'Golos profile labels latest posts plainly');
  assert(golosDirectSlice.indexOf("renderGolosContentList('Последние посты'") < golosDirectSlice.indexOf("renderGolosAccountList('Подписчики'"), 'Golos profile shows latest posts above followers');
  assert(golosDirectSlice.indexOf("renderGolosContentList('Последние комментарии'") < golosDirectSlice.indexOf("renderGolosAccountList('Подписчики'"), 'Golos profile shows latest comments above followers');
  const renderProfileSlice = (appSource.match(/function renderProfile\(profile\)[\s\S]*?\n  async function/) || [''])[0];
  assert(renderProfileSlice.indexOf("detailsSection('Балансы'") < renderProfileSlice.indexOf("detailsSection('Экономика / vesting / staking'"), 'Economy section stays after balances');
  assert(renderProfileSlice.indexOf('renderGolosUiaProfileSection(profile)') < renderProfileSlice.indexOf("detailsSection('Экономика / vesting / staking'"), 'Economy section stays after UIA assets');
  assert(renderProfileSlice.indexOf("detailsSection('Экономика / vesting / staking'") < renderProfileSlice.indexOf('renderGolosLegacyDirectSections(profile)'), 'Economy section appears before long social/content lists');
  assert(appSource.includes('comment_mention'), 'comment_mention.php is exposed through history filter links');
  assert(appSource.includes('worker_request_vote,account_witness_vote,account_witness_proxy,worker_request,worker_request_delete,worker_state'), 'dao.php is exposed through history filter links');
  assert(appSource.includes('account_create,account_create_with_invite,account_update,account_metadata'), 'accounts.php is exposed through history filter links');

  console.log('v3 Golos profiles parity smoke passed');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
