const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const appSource = fs.readFileSync(path.join(root, 'v3/js/app.js'), 'utf8');
const chainsSource = fs.readFileSync(path.join(root, 'v3/js/chains.js'), 'utf8');
const profilesSource = fs.readFileSync(path.join(root, 'v3/js/profiles.js'), 'utf8');
const historySource = fs.readFileSync(path.join(root, 'v3/js/history.js'), 'utf8');
const broadcastSource = fs.readFileSync(path.join(root, 'v3/js/broadcast.js'), 'utf8');
const planSource = fs.readFileSync(path.join(root, 'plan.md'), 'utf8');

const legacyRoot = path.resolve(root, '../dpos.space/blockchains/hive/apps/profiles');
const legacyConfig = fs.readFileSync(path.join(legacyRoot, 'config.json'), 'utf8');
const legacyContent = fs.readFileSync(path.join(legacyRoot, 'content.php'), 'utf8');
const legacyIndex = fs.readFileSync(path.join(legacyRoot, 'index.php'), 'utf8');
const legacyPageContent = fs.readFileSync(path.join(legacyRoot, 'page/content.php'), 'utf8');
const legacyUserinfo = fs.readFileSync(path.join(legacyRoot, 'page/userinfo.php'), 'utf8');
const legacyHistory = fs.readFileSync(path.join(legacyRoot, 'page/history.php'), 'utf8');
const legacyHistoryJs = fs.readFileSync(path.join(legacyRoot, 'js/app.js'), 'utf8');
const legacyFollowers = fs.readFileSync(path.join(legacyRoot, 'page/snippets/Get_Followers.php'), 'utf8');
const legacyDelegations = fs.readFileSync(path.join(legacyRoot, 'page/snippets/get_vesting_delegations.php'), 'utf8');
const legacyBlog = fs.readFileSync(path.join(legacyRoot, 'page/snippets/get_discussions_by_blog.php'), 'utf8');
const legacyComments = fs.readFileSync(path.join(legacyRoot, 'page/snippets/GetContentReplies.php'), 'utf8');

assert(legacyConfig.includes('Просмотр профилей') && legacyConfig.includes('Hive'), 'legacy Hive profiles config inspected');
assert(legacyContent.includes('service" value = "profiles"') && legacyContent.includes('Введите логин без @'), 'legacy Hive profiles search form inspected');
assert(legacyPageContent.includes('value="\'.$user.\'"') && legacyPageContent.includes('узнать инфу'), 'legacy selected-user search form inspected');
assert(legacyIndex.includes('/history') && legacyIndex.includes('/transfers') && legacyIndex.includes('/hp') && legacyIndex.includes('/dao'), 'legacy Hive profile subpage nav inspected');
assert(legacyIndex.includes('getLoad(`') && legacyIndex.includes('profiles/page/transfers.php') && legacyIndex.includes('profiles/page/author_rewards.php'), 'legacy Hive profiles PHP pagination dependencies inspected');
assert(legacyUserinfo.includes('get_dynamic_global_properties') && legacyUserinfo.includes('get_follow_count') && legacyUserinfo.includes('ajax_modal'), 'legacy Hive userinfo snippets/modals inspected');
assert(legacyHistory.includes('select multiple id="ops"') && legacyHistoryJs.includes('hive.api.getAccountHistoryAsync(user, from, limit)'), 'legacy Hive client-side history filter inspected');
assert(legacyFollowers.includes('GetFollowersCommand') && legacyDelegations.includes('GetVestingDelegationsCommand') && legacyBlog.includes('GetDiscussionsByBlogCommand') && legacyComments.includes('getDiscussionsByCommentsCommand'), 'legacy Hive direct profile RPC snippets inspected');

assert(chainsSource.includes('hive: {') && chainsSource.includes("id: 'profiles'"), 'Hive profiles app is registered through base apps');
assert(appSource.includes('async function renderProfileRoute(chain, account)'), 'v3 has dedicated profile route renderer');
assert(profilesSource.includes("if (chainId === 'hive') return config.HIVE_VOTING_MANA_REGENERATION_SECONDS"), 'profile normalizer handles Hive voting mana regeneration');
assert(historySource.includes('hive: new Set') && historySource.includes('comment_benefactor_reward'), 'history supports Hive profile reward filters');

assert(appSource.includes('function hiveLegacyProfileLinks(account)'), 'Hive profiles expose a legacy subpage to static history-link mapper');
assert(appSource.includes("'Hive legacy profile pages → static profile/history filters'"), 'Hive profile quick links are labeled as static replacements');
assert(appSource.includes("'Переводы средств'") && appSource.includes('transfer,transfer_to_vesting,withdraw_vesting,transfer_to_savings,transfer_from_savings,cancel_transfer_from_savings'), 'Hive transfers subpage maps to public history filters');
assert(appSource.includes("'Hive Power'") && appSource.includes('delegate_vesting_shares,transfer_to_vesting,withdraw_vesting,return_vesting_delegation,fill_vesting_withdraw,set_withdraw_vesting_route'), 'Hive HP subpage maps to history filters');
assert(appSource.includes("'ДАО / witness votes / proposals'") && appSource.includes('account_witness_vote,account_witness_proxy,proposal_create,proposal_update,proposal_delete'), 'Hive DAO subpage maps to history filters');
assert(appSource.includes("'Комментарии'") && appSource.includes('comment,delete_comment,comment_options'), 'Hive comments subpage maps to history filters');
assert(appSource.includes('fetchHiveProfileExtras(connection, account)'), 'Hive profiles load direct public RPC extras');
assert(appSource.includes("getFollowers', [account, '', 'blog', 11]"), 'followers.php maps to getFollowers static RPC');
assert(appSource.includes("getFollowing', [account, '', 'blog', 11]"), 'followers.php followings mode maps to getFollowing static RPC');
assert(appSource.includes("getVestingDelegations', [account, '', 100]"), 'delegations.php maps to Hive getVestingDelegations');
assert(appSource.includes("getWitnessByAccount', [account]"), 'witness.php maps to getWitnessByAccount');
assert(appSource.includes("getDiscussionsByBlog', [{ limit: 10, tag: account }]"), 'blog-posts.php maps to getDiscussionsByBlog tag query');
assert(appSource.includes("getDiscussionsByComments', [{ limit: 10, start_author: account }]"), 'comments.php maps to getDiscussionsByComments');
assert(appSource.includes('Hive direct profile data from public RPC'), 'Hive direct snippets render without PHP');

const profileSliceStart = appSource.indexOf('function hiveLegacyProfileLinks(account)');
const profileSliceEnd = appSource.indexOf('function renderProfile(profile)');
assert(profileSliceStart >= 0 && profileSliceEnd > profileSliceStart, 'Hive profile runtime slice is present');
const profileRuntimeSlice = appSource.slice(profileSliceStart, profileSliceEnd);
assert(!/backend\.dpos\.space|178\.20\.43\.121|blockchains\/hive\/apps\/profiles|profiles\/page\/[^'\"]+\.php|private IP/i.test(profileRuntimeSlice), 'v3 runtime does not call legacy PHP/private backend for Hive profiles');
assert(!/bindOperationForm\(chain, 'profiles/.test(appSource), 'Hive profiles route remains read-only and does not bind broadcast forms');
assert(!/prepareHive.*profiles|broadcastHive.*profiles/.test(broadcastSource), 'broadcast layer has no Hive profiles operation');

const context = { window: null, localStorage: { getItem() { return null; }, setItem() {} } };
context.window = context;
vm.createContext(context);
vm.runInContext(profilesSource, context, { filename: 'v3/js/profiles.js' });
const profile = context.DposProfiles.normalizeAccount({ config: { id: 'hive', title: 'Hive', liquidSymbol: 'HIVE', debtSymbol: 'HBD', powerTitle: 'HP' }, node: 'https://rpc.usehive.com' }, {
  name: 'denis-skripnik',
  balance: '1.000 HIVE',
  hbd_balance: '2.000 HBD',
  vesting_shares: '1000000.000000 VESTS',
  delegated_vesting_shares: '100000.000000 VESTS',
  received_vesting_shares: '50000.000000 VESTS',
  voting_power: 7500,
  last_vote_time: '2026-05-10T00:00:00',
  reputation: '1234567890123',
  posting_json_metadata: JSON.stringify({ profile: { name: 'Denis Hive', profile_image: 'https://example.com/avatar.jpg', cover_image: 'https://example.com/cover.jpg', github: 'web3blind' } }),
  hiveProfileExtras: {
    followers: [{ follower: 'alice' }],
    following: [{ following: 'bob' }],
    delegationsOut: [{ delegatee: 'carol', vesting_shares: '1.000000 VESTS' }],
    witness: { owner: 'denis-skripnik', url: 'https://example.com' },
    blogPosts: [{ author: 'denis-skripnik', permlink: 'post', title: 'Post' }],
    comments: [{ author: 'denis-skripnik', permlink: 'comment', title: '' }]
  },
  _v3ProfileContext: {
    dynamicProperties: { time: '2026-05-10T01:00:00', total_vesting_fund_hive: '1000.000 HIVE', total_vesting_shares: '1000000.000000 VESTS' },
    followCount: { follower_count: 3, following_count: 4 }
  }
});
assert.strictEqual(profile.displayName, 'Denis Hive', 'Hive display name is normalized');
assert(profile.balances.some(([label]) => label === 'HIVE'), 'Hive liquid balance is exposed');
assert(profile.balances.some(([label]) => label === 'HBD'), 'Hive HBD balance is exposed');
assert(profile.economyRows.some(([label]) => label === 'Итоговая HP'), 'Hive effective HP is computed from public dynamic properties');
assert(profile.economyRows.some(([label]) => label === 'Репутация'), 'Hive reputation is shown in the same economy block as voting power');
assert(profile.activityRows.some(([label, value]) => label === 'Подписчиков' && value === 3), 'Hive follow count is exposed');
assert(profile.socials.some(([label, value]) => label === 'github' && value === 'web3blind'), 'Hive socials are exposed');
assert.strictEqual(profile.raw.hiveProfileExtras.followers[0].follower, 'alice', 'direct Hive follow-list extras are preserved for rendering');

assert(planSource.includes('### Rigorous parity: Hive / profiles'), 'plan contains Hive profiles parity section');
assert(planSource.includes('blockchains/hive/apps/profiles/index.php') && planSource.includes('profiles/page/transfers.php'), 'plan documents inspected Hive profiles files and PHP subpages');
assert(planSource.includes('GetVestingDelegationsCommand') && planSource.includes('history filters'), 'plan documents static RPC/history replacement');
assert(planSource.includes('No backend service') || planSource.includes('no backend service'), 'plan documents no-service/non-goal stance');

console.log('v3 Hive profiles smoke passed');
