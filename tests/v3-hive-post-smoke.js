const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const context = { window: null };
context.window = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root, 'v3/js/chains.js'), 'utf8'), context, { filename: 'v3/js/chains.js' });

const chains = context.DposChains;
const appSource = fs.readFileSync(path.join(root, 'v3/js/app.js'), 'utf8');
const chainsSource = fs.readFileSync(path.join(root, 'v3/js/chains.js'), 'utf8');
const broadcastSource = fs.readFileSync(path.join(root, 'v3/js/broadcast.js'), 'utf8');
const planSource = fs.readFileSync(path.join(root, 'plan.md'), 'utf8');

const hive = chains.hive;
assert(hive, 'Hive chain exists');
assert(hive.apps.some((app) => app.id === 'editor' && app.title === 'Редактор'), 'Hive editor route is registered through social apps');
assert.strictEqual(hive.libraryGlobal, 'hive', 'Hive post/editor uses browser Hive library');
assert.strictEqual(hive.libraryPath, 'v3/vendor/hive/hive.min.js', 'Hive post/editor uses vendored browser library');
assert.strictEqual(hive.cryptoPath, 'v3/vendor/hive/sjcl.min.js', 'Hive post/editor keeps legacy SJCL posting key compatibility');

const editorRenderer = (appSource.match(/function renderEditor\(chain, state\)[\s\S]*?\n  function parseAssetAmount/) || [''])[0];
const editorBuilder = (appSource.match(/function buildGenericEditorOperations[\s\S]*?\n  function parseSteemPostUrl/) || [''])[0];
const editorHelpers = (appSource.match(/function parseSteemPostUrl[\s\S]*?\n  function renderEditor/) || [''])[0];
const editorMarkdown = (appSource.match(/function safeMarkdownUrl[\s\S]*?\n  function parseHash/) || [''])[0];
const hiveRuntimeSlice = [
  chainsSource.match(/hive:\s*\{[\s\S]*?\n    minter:/)?.[0] || '',
  editorMarkdown,
  editorBuilder,
  editorHelpers,
  editorRenderer
].join('\n');

assert(!appSource.includes("if ((chain.id === 'hive' || chain.id === 'steem') && appId === 'post')"), 'Hive /post no longer aliases to editor');
assert(hive.apps.some((app) => app.id === 'post' && /пост/i.test(app.title)), 'Hive post viewer route is registered');
assert(hive.apps.some((app) => app.id === 'feeds' && /лент/i.test(app.title)), 'Hive feeds route is registered');
assert(appSource.includes("isHiveOrSteem(chain) && effectiveAppId === 'post'") && appSource.includes('renderSocialPostPage(chain, state)'), 'router dispatches Hive post route to social post viewer');
assert(appSource.includes("isHiveOrSteem(chain) && effectiveAppId === 'feeds'") && appSource.includes('renderSocialFeedsPage(chain, state)'), 'router dispatches Hive feeds route');
assert(appSource.includes("effectiveAppId === 'editor'") && appSource.includes('renderEditor(chain, state)'), 'router still dispatches editor app to renderer');

for (const marker of [
  'Публикация поста',
  'Бенефициарские 1%',
  'editor-form',
  'editor-title',
  'editor-body',
  'editor-tags',
  'editor-image',
  'editor-category',
  'hive-142159',
  'hive-179017',
  'editor-beneficiary-account',
  'editor-beneficiary-weight',
  'editor-permlink',
  'role="status" aria-live="polite"'
]) {
  assert(hiveRuntimeSlice.includes(marker), `Hive post/editor keeps legacy UI/control marker: ${marker}`);
}

for (const marker of [
  'function buildGenericEditorOperations',
  "if (!tags.includes('dpos-post')) tags.push('dpos-post');",
  "const permlink = manualPermlink || golosLegacyTransform(title, '-');",
  "percent_hbd: chain.id === 'hive' ? payoutPercent : undefined",
  "extensions: [[0, { beneficiaries }]]",
  "broadcast.prepare(chain, 'posting', 'sendOperations'",
  "['comment'",
  "['comment_options'",
  "getContent",
  "app: chain.id === 'steem' ? 'dpos.space/post' : 'dpos.space/v3'"
]) {
  assert(hiveRuntimeSlice.includes(marker), `Hive post/editor keeps static-safe behavior: ${marker}`);
}

assert(broadcastSource.includes("hive: { posting: 'posting"), 'Hive broadcast authority map supports posting authority');
assert(!/backend\.dpos\.space|178\.20\.43\.121|hidden server API|new indexer|daemon|\.php\b|XMLHttpRequest/.test(hiveRuntimeSlice), 'Hive post/editor runtime slice has no private/PHP/backend dependency');
assert(hiveRuntimeSlice.includes('api.imgur.com/3/image.json') && hiveRuntimeSlice.includes('IMGUR_CLIENT_ID'), 'Hive post/editor ports legacy anonymous Imgur upload without adding a private backend');
assert(!hiveRuntimeSlice.includes('blockchains/hive/apps/post'), 'Hive post/editor runtime does not reference legacy runtime paths');

assert(planSource.includes('### Rigorous parity: Hive / post'), 'plan.md contains required Hive/post rigorous parity section');
for (const evidence of [
  'blockchains/hive/apps/post/config.json',
  'blockchains/hive/apps/post/content.php',
  'blockchains/hive/apps/post/index.php',
  'blockchains/hive/apps/post/js/_interface.js',
  'blockchains/hive/apps/post/js/simplemde.min.js',
  'blockchains/hive/apps/post/css/simplemde.min.css',
  'blockchains/hive/js/blockchain.js',
  'blockchains/hive/js/modal-accounts.js',
  'hive.broadcast.send({extensions: [], operations}, [wif], cb)',
  'hive.api.getContent(Author, Permlink, cb)',
  'hive.api.getChainProperties(cb)',
  'tests/v3-hive-post-smoke.js'
]) {
  assert(planSource.includes(evidence), `plan.md records Hive post evidence: ${evidence}`);
}

for (const marker of [
  'function renderSocialPostPage',
  'function loadSocialRepliesTree',
  'function renderSocialCommentsList',
  'function renderSocialFeedsPage',
  'function loadSocialFeedRows',
  'getDiscussionsByCreated',
  'getDiscussionsByBlog',
  'getDiscussionsByFeed',
  'getDiscussionsByHot',
  'getDiscussionsByTrending',
  'pending_payout_value',
  'total_payout_value',
  'percent_hbd',
  'https://hive.blog',
  "broadcast.prepare(chain, 'posting', 'vote'",
  "id: 'follow'"
]) {
  assert(appSource.includes(marker), `Hive social post/feeds marker missing: ${marker}`);
}

assert(planSource.includes('Scoped plan: Hive/Steem post viewers and feeds'), 'plan.md records Hive/Steem post+feeds scope');
assert(planSource.includes('Hive API probe') && planSource.includes('pending_payout_value') && planSource.includes('percent_hbd'), 'plan.md records Hive API shape evidence');

console.log('v3 Hive post smoke passed');
