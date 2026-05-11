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

const legacyRoot = path.resolve(root, '../dpos.space/blockchains/steem/apps/profiles');
const legacyConfig = fs.readFileSync(path.join(legacyRoot, 'config.json'), 'utf8');
const legacyContent = fs.readFileSync(path.join(legacyRoot, 'content.php'), 'utf8');
const legacyIndex = fs.readFileSync(path.join(legacyRoot, 'index.php'), 'utf8');
const legacyUserinfo = fs.readFileSync(path.join(legacyRoot, 'page/userinfo.php'), 'utf8');
const legacyHistory = fs.readFileSync(path.join(legacyRoot, 'page/history.php'), 'utf8');
const legacyHistoryJs = fs.readFileSync(path.join(legacyRoot, 'js/app.js'), 'utf8');
const legacyFollowers = fs.readFileSync(path.join(legacyRoot, 'page/snippets/Get_Followers.php'), 'utf8');
const legacyDelegations = fs.readFileSync(path.join(legacyRoot, 'page/snippets/get_vesting_delegations.php'), 'utf8');
const legacyBlog = fs.readFileSync(path.join(legacyRoot, 'page/snippets/get_discussions_by_blog.php'), 'utf8');
const legacyComments = fs.readFileSync(path.join(legacyRoot, 'page/snippets/GetContentReplies.php'), 'utf8');

assert(legacyConfig.includes('Просмотр профилей'), 'legacy Steem profiles config inspected');
assert(legacyContent.includes('Введите логин без @') && legacyContent.includes('service" value = "profiles"'), 'legacy search form inspected');
assert(legacyIndex.includes('/history') && legacyIndex.includes('/transfers') && legacyIndex.includes('/sp') && legacyIndex.includes('/orders'), 'legacy profile subpage nav inspected');
assert(legacyIndex.includes('getLoad(`') && legacyIndex.includes('profiles/page/transfers.php'), 'legacy AJAX pagination PHP dependency inspected');
assert(legacyUserinfo.includes('get_dynamic_global_properties') && legacyUserinfo.includes('get_follow_count') && legacyUserinfo.includes('ajax_modal'), 'legacy userinfo snippets/modals inspected');
assert(legacyHistory.includes('select multiple id="ops"') && legacyHistoryJs.includes('getAccountHistoryAsync(user, from, limit)'), 'legacy client-side history filter inspected');
assert(legacyFollowers.includes('GetFollowersCommand') && legacyDelegations.includes('GetVestingDelegationsCommand') && legacyBlog.includes('GetDiscussionsByBlogCommand') && legacyComments.includes('getDiscussionsByCommentsCommand'), 'legacy direct profile RPC snippets inspected');

assert(chainsSource.includes("steem: {") && chainsSource.includes("id: 'profiles'"), 'Steem profiles app is registered through base apps');
assert(appSource.includes('async function renderProfileRoute(chain, account)'), 'v3 has dedicated profile route renderer');
assert(profilesSource.includes("if (chainId === 'steem') return config.STEEM_VOTING_MANA_REGENERATION_SECONDS"), 'profile normalizer handles Steem voting mana regeneration');
assert(historySource.includes("steem: new Set") && historySource.includes("comment_benefactor_reward"), 'history supports Steem profile reward filters');

assert(appSource.includes('function steemLegacyProfileLinks(account)'), 'Steem profiles expose a legacy subpage to static history-link mapper');
assert(appSource.includes("'Steem legacy profile pages → static profile/history filters'"), 'Steem profile quick links are labeled as static replacements');
assert(appSource.includes("'Переводы средств'") && appSource.includes("transfer,transfer_to_vesting,withdraw_vesting,transfer_to_savings,transfer_from_savings,cancel_transfer_from_savings"), 'Steem transfers subpage maps to public history filters');
assert(appSource.includes("'Steem Power'") && appSource.includes("delegate_vesting_shares,transfer_to_vesting,withdraw_vesting,return_vesting_delegation"), 'Steem SP subpage maps to history filters');
assert(appSource.includes("'ДАО / witness votes'") && appSource.includes("account_witness_vote,account_witness_proxy,proposal_create,proposal_update,proposal_delete"), 'Steem DAO subpage maps to history filters');
assert(appSource.includes("'Ордера внутренней биржи'") && appSource.includes("limit_order_create,limit_order_create2,limit_order_cancel,fill_order"), 'Steem orders subpage maps to history filters');
assert(appSource.includes('fetchSteemProfileExtras(connection, account)'), 'Steem profiles load direct public RPC extras');
assert(appSource.includes("getFollowers', [account, '', 'blog', 11]"), 'followers.php maps to getFollowers static RPC');
assert(appSource.includes("getFollowing', [account, '', 'blog', 11]"), 'followers.php followings mode maps to getFollowing static RPC');
assert(appSource.includes("getVestingDelegations', [account, '', 100, 'delegated']"), 'delegations.php delegated mode maps to getVestingDelegations');
assert(appSource.includes("getWitnessByAccount', [account]"), 'witness.php maps to getWitnessByAccount');
assert(appSource.includes("getDiscussionsByBlog', [{ limit: 10, tag: account }]"), 'blog-posts.php maps to getDiscussionsByBlog tag query');
assert(appSource.includes("getDiscussionsByComments', [{ limit: 10, start_author: account }]"), 'comments.php maps to getDiscussionsByComments');
assert(appSource.includes('Steem direct profile data from public RPC'), 'Steem direct snippets render without PHP');

const profileSliceStart = appSource.indexOf('function steemLegacyProfileLinks(account)');
const profileSliceEnd = appSource.indexOf('function renderProfile(profile)');
assert(profileSliceStart >= 0 && profileSliceEnd > profileSliceStart, 'Steem profile runtime slice is present');
const profileRuntimeSlice = appSource.slice(profileSliceStart, profileSliceEnd);
assert(!/backend\.dpos\.space|blockchains\/steem\/apps\/profiles|profiles\/page\/[^'\"]+\.php|private IP/i.test(profileRuntimeSlice), 'v3 runtime does not call legacy PHP/private backend for Steem profiles');
assert(!/bindOperationForm\(chain, 'profiles/.test(appSource), 'Steem profiles route remains read-only and does not bind broadcast forms');
assert(!/prepareSteem.*profiles|broadcastSteem.*profiles/.test(broadcastSource), 'broadcast layer has no Steem profiles operation');

const context = { window: null, localStorage: { getItem() { return null; }, setItem() {} } };
context.window = context;
vm.createContext(context);
vm.runInContext(profilesSource, context, { filename: 'v3/js/profiles.js' });
const profile = context.DposProfiles.normalizeAccount({ config: { id: 'steem', title: 'Steem', liquidSymbol: 'STEEM', powerTitle: 'SP' }, node: 'https://api.steemit.com' }, {
  name: 'denis-skripnik',
  balance: '1.000 STEEM',
  sbd_balance: '2.000 SBD',
  vesting_shares: '1000000.000000 VESTS',
  delegated_vesting_shares: '100000.000000 VESTS',
  received_vesting_shares: '50000.000000 VESTS',
  voting_power: 7500,
  last_vote_time: '2026-05-10T00:00:00',
  reputation: '1234567890123',
  json_metadata: JSON.stringify({ profile: { name: 'Denis', profile_image: 'https://example.com/avatar.jpg', cover_image: 'https://example.com/cover.jpg', twitter: 'denis' } }),
  steemProfileExtras: {
    followers: [{ follower: 'alice' }],
    following: [{ following: 'bob' }],
    delegationsOut: [{ delegatee: 'carol', vesting_shares: '1.000000 VESTS' }],
    witness: { owner: 'denis-skripnik', url: 'https://example.com' },
    blogPosts: [{ author: 'denis-skripnik', permlink: 'post', title: 'Post' }],
    comments: [{ author: 'denis-skripnik', permlink: 'comment', title: '' }]
  },
  _v3ProfileContext: {
    dynamicProperties: { time: '2026-05-10T01:00:00', total_vesting_fund_steem: '1000.000 STEEM', total_vesting_shares: '1000000.000000 VESTS' },
    followCount: { follower_count: 3, following_count: 4 }
  }
});
assert.strictEqual(profile.displayName, 'Denis', 'Steem display name is normalized');
assert(profile.balances.some(([label]) => label === 'STEEM'), 'Steem liquid balance is exposed');
assert(profile.economyRows.some(([label]) => label === 'Итоговая SP'), 'Steem effective SP is computed from public dynamic properties');
assert(profile.activityRows.some(([label, value]) => label === 'Подписчиков' && value === 3), 'Steem follow count is exposed');
assert(profile.socials.some(([label, value]) => label === 'twitter' && value === 'denis'), 'Steem socials are exposed');
assert.strictEqual(profile.raw.steemProfileExtras.followers[0].follower, 'alice', 'direct Steem follow-list extras are preserved for rendering');

assert(planSource.includes('### Rigorous parity: Steem / profiles'), 'plan contains Steem profiles parity section');
assert(planSource.includes('blockchains/steem/apps/profiles/index.php') && planSource.includes('profiles/page/transfers.php'), 'plan documents inspected Steem profiles files and PHP subpages');
assert(planSource.includes('GetVestingDelegationsCommand') && planSource.includes('history filters'), 'plan documents static RPC/history replacement');
assert(planSource.includes('No backend service') || planSource.includes('no backend service'), 'plan documents no-service/non-goal stance');

console.log('v3 Steem profiles smoke passed');
