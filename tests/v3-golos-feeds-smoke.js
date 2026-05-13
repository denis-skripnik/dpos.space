const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const appSource = fs.readFileSync(path.join(root, 'v3/js/app.js'), 'utf8');
const chainsSource = fs.readFileSync(path.join(root, 'v3/js/chains.js'), 'utf8');
const planSource = fs.readFileSync(path.join(root, 'plan.md'), 'utf8');

assert(chainsSource.includes("id: 'feeds'") && chainsSource.includes("title: 'Ленты'"), 'Golos feeds app is registered as Ленты');
assert(appSource.includes("chain.id === 'golos' && effectiveAppId === 'feeds'") && appSource.includes('renderGolosFeedsPage(chain, state)'), 'router dispatches Golos feeds route');

[
  'function renderGolosFeedsPage',
  'function loadGolosFeedRows',
  'function renderGolosFeedCard',
  'function bindGolosFeedActions',
  'const GOLOS_FEEDS_SETTINGS_KEY',
  'function readGolosFeedsSettings',
  'function writeGolosFeedsSettings',
  'data-golos-feed-kind',
  'data-golos-feed-vote',
  'data-golos-feed-repost',
  'data-golos-feed-donate',
  'golosFeedPostUrl(row)',
  "getDiscussionsByCreated",
  "getDiscussionsByHot",
  "getDiscussionsByFeed",
  "getDiscussionsByBlog",
  "['reblog'",
  "id: 'follow'"
].forEach((marker) => {
  assert(appSource.includes(marker), `Golos feeds implementation marker missing: ${marker}`);
});

assert(appSource.includes('Новые посты') && appSource.includes('Популярное') && appSource.includes('По тегу') && appSource.includes('Донаты') && appSource.includes('Лента подписок'), 'feeds UI exposes new/popular/tag/donates/subscriptions tabs');
assert(appSource.includes('markdownToTextPreview') && appSource.includes('golosFeedActionStats'), 'feed cards render teaser and action stats');
assert(appSource.includes('function golosFeedTagUrl') && appSource.includes("app: 'feeds', feed: 'tag'") && appSource.includes('function golosFeedTagLabel') && appSource.includes("'ru--foto': 'фото'"), 'feed tags link to internal tag feeds with readable labels');
assert(!appSource.includes('https://golos.id/created/${encodeURIComponent(tag)}'), 'feed tag links stay inside dpos.space instead of opening golos.id');
assert(appSource.includes('golosDonationPageUrl({ to: row.author') && appSource.includes('target="_blank"'), 'feed cards link donate to confirmed donate flow in a new tab');
assert(appSource.includes("broadcast.prepare(chain, 'posting', 'vote'") && appSource.includes("broadcast.prepare(chain, 'posting', 'sendOperations'"), 'feed actions use confirmed posting vote/repost broadcasts');
assert(appSource.includes('hasGolosVoteFrom(content, voter)'), 'feed vote checks active_votes before broadcast');
assert(appSource.includes('const storedSettings = readGolosFeedsSettings()') && appSource.includes("writeGolosFeedsSettings({ feed: data.get('feed'), account:") && appSource.includes("form.querySelector('[name=\"feed\"]')"), 'feeds form persists feed/account settings to localStorage and restores them');
assert(planSource.includes('Scoped plan: Golos feeds page'), 'plan.md records the scoped feeds work');

console.log('v3 Golos feeds smoke: OK');
