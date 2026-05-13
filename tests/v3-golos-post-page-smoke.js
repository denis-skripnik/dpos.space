const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const context = { window: null, console, setTimeout, clearTimeout };
context.window = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root, 'v3/js/chains.js'), 'utf8'), context, { filename: 'v3/js/chains.js' });
vm.runInContext(fs.readFileSync(path.join(root, 'v3/js/auto-upvoter.js'), 'utf8'), context, { filename: 'v3/js/auto-upvoter.js' });

const chains = context.DposChains;
const helpers = context.DposGolosAutoUpvoter;
const appSource = fs.readFileSync(path.join(root, 'v3/js/app.js'), 'utf8');
const chainsSource = fs.readFileSync(path.join(root, 'v3/js/chains.js'), 'utf8');
const planSource = fs.readFileSync(path.join(root, 'plan.md'), 'utf8');

assert(!appSource.includes("post: 'editor'"), 'Golos post route is not shadowed by the editor alias');
assert(chains.golos.apps.some((app) => app.id === 'post' && /пост/i.test(app.title)), 'Golos post page route is registered');
assert(chainsSource.includes("id: 'post'") && chainsSource.includes('Просмотр поста'), 'chains registry exposes readable Golos post app');
assert(appSource.includes("chain.id === 'golos' && effectiveAppId === 'post'") && appSource.includes('renderGolosPostPage(chain, state)'), 'router dispatches Golos post route');

for (const marker of [
  'function golosPostPageUrl',
  'function renderGolosPostPage',
  'function renderGolosCommentsList',
  'function renderGolosCommentNode',
  'getContentReplies',
  'markdownToPreviewHtml(post.body',
  'data-golos-comment-reply',
  'data-golos-comment-edit',
  'data-golos-comment-edit-form',
  'Редактировать комментарий',
  'author === currentLogin',
  "'golos-post-page-comment-edit'",
  'data-golos-post-vote',
  'data-golos-post-donate',
  'target="_blank"',
  "'comment'",
  "'vote'",
  "'donate'"
]) {
  assert(appSource.includes(marker), `Golos post page keeps marker: ${marker}`);
}

assert(appSource.includes('author/title') || appSource.includes('autoUpvoterActionLabel'), 'auto-upvoter feed is designed around author/title labels');
assert(appSource.includes('autoUpvoterPostUrl(action)') && appSource.includes('target="_blank"'), 'auto-upvoter feed opens Dpos Space post page in a new tab');
assert(appSource.includes('autoUpvoterActionHasDonate') && appSource.includes('donations.length'), 'manual donate link is suppressed when auto-donate already happened');
assert(appSource.includes('hasGolosVoteFrom') && appSource.includes('active_votes'), 'UI has reusable active_votes duplicate-vote check');
assert(appSource.includes('getContent(author, permlink') || appSource.includes("getContent', [author, permlink]"), 'auto-upvoter adapter can fetch content before voting');
assert(appSource.includes('already-voted') || appSource.includes('уже голосовал'), 'duplicate vote is reported as skipped, not attempted');
const postActionsStart = appSource.indexOf('function bindGolosPostActions');
const postActionsEnd = appSource.indexOf('const SOCIAL_FEED_KINDS', postActionsStart);
const postActions = appSource.slice(postActionsStart, postActionsEnd);
assert(postActions.includes('await ensureBroadcastDependencies(chain);'), 'Golos post vote/comment actions load crypto and broadcast libraries before decrypting keys');

const discussionEvent = helpers.discussionRowToFavoritePostEvent({
  author: 'favorite',
  permlink: 'nice-post',
  title: 'Nice readable title',
  active_votes: [{ voter: 'alice', percent: 10000 }]
}, 'favorite');
assert.strictEqual(discussionEvent.title, 'Nice readable title', 'favorite-post event preserves title');
assert(Array.isArray(discussionEvent.activeVotes) && discussionEvent.activeVotes[0].voter === 'alice', 'favorite-post event preserves active_votes for duplicate-vote checks');

const planned = helpers.planActionsForEvents([
  { account: 'alice', enabled: true, favorites: ['favorite'], favoritesPercent: 100 },
  { account: 'bob', enabled: true, favorites: ['favorite'], favoritesPercent: 100 }
], [discussionEvent], { seen: new Set() });
assert(!planned.some((action) => action.account === 'alice'), 'already-voted account is skipped before broadcast');
assert(planned.some((action) => action.account === 'bob' && action.title === 'Nice readable title'), 'not-yet-voted account keeps planned action with title');

assert(planSource.includes('Golos auto-upvoter post links and in-app post page'), 'plan.md records the scoped post page work');

console.log('v3 Golos post page smoke passed');
