const assert = require('assert');
const fs = require('fs');

const appSource = fs.readFileSync('v3/js/app.js', 'utf8');
const chainsSource = fs.readFileSync('v3/js/chains.js', 'utf8');
const broadcastSource = fs.readFileSync('v3/js/broadcast.js', 'utf8');
const profilesSource = fs.readFileSync('v3/js/profiles.js', 'utf8');
const historySource = fs.readFileSync('v3/js/history.js', 'utf8');
const planSource = fs.readFileSync('plan.md', 'utf8');

assert(appSource.includes("if ((chain.id === 'hive' || chain.id === 'steem') && appId === 'post')") && appSource.includes("return 'editor'"), 'Steem legacy post route aliases to editor');
assert(chainsSource.includes("steem: {") && chainsSource.includes("const steemApps = socialApps.concat") && chainsSource.includes("apps: apps(steemApps)"), 'Steem uses social editor app set plus Steem-specific additions');
assert(appSource.includes("'editor'" ) && appSource.includes('appUsesAuthorizedAccount'), 'editor route keeps authorized-account context');
assert(appSource.includes('function buildGenericEditorOperations'), 'Steem editor has shared operation builder');
assert(appSource.includes('function bindSteemPostLegacyHelpers'), 'Steem post ports legacy static-safe helper binding');
assert(appSource.includes('editor-md-file') && appSource.includes('Первая строка - заголовок'), 'Steem editor preserves legacy .md file import affordance and format help');
assert(appSource.includes('editor-edit-url') && appSource.includes('Загрузить в редактор'), 'Steem editor preserves legacy edit-by-url control');
assert(appSource.includes('liga-avtorov') && appSource.includes('vp-liganovi4kov') && appSource.includes('dpos-post'), 'Steem editor exposes legacy popular tags and dpos-post tag');
assert(appSource.includes("app: 'dpos.space/post'") && appSource.includes("format: 'markdown'"), 'Steem post metadata keeps legacy app/markdown marker');
assert(appSource.includes("max_accepted_payout: `1000000.000 ${debt}`") && appSource.includes("percent_steem_dollars: chain.id === 'steem' ? payoutPercent : undefined"), 'Steem post keeps payout/comment_options operation');
assert(appSource.includes("extensions: [[0, { beneficiaries }]]"), 'Steem post sends beneficiaries extension through shared broadcast flow');
assert(appSource.includes("broadcast.prepare(chain, 'posting', 'sendOperations'"), 'Steem post uses existing public browser broadcast prepare flow');
assert(appSource.includes("getContentAsync") || appSource.includes("getContent,"), 'Steem post edit loader uses public RPC getContent when available');
assert(appSource.includes('role="status" aria-live="polite"'), 'editor has accessible live operation result');

const editorSlice = appSource.slice(
  appSource.indexOf('function buildGenericEditorOperations'),
  appSource.indexOf('function parseAssetAmount')
);
assert(editorSlice.length > 1000, 'test isolates Steem editor runtime slice');
const forbiddenRuntime = ['backend.dpos.space', '192.168.', 'blockchains/steem/apps/post', '<?php', 'sendAjax('];
for (const needle of forbiddenRuntime) {
  assert(!editorSlice.includes(needle), `Steem editor runtime slice must not include forbidden legacy dependency: ${needle}`);
  assert(!chainsSource.includes(needle), `v3 chains runtime must not include forbidden legacy dependency: ${needle}`);
  assert(!broadcastSource.includes(needle), `v3 broadcast runtime must not include forbidden legacy dependency: ${needle}`);
  assert(!profilesSource.includes(needle), `v3 profiles runtime must not include forbidden legacy dependency: ${needle}`);
  assert(!historySource.includes(needle), `v3 history runtime must not include forbidden legacy dependency: ${needle}`);
}
assert(!editorSlice.includes('api.imgur.com/3/image.json'), 'legacy Imgur upload endpoint is not copied into Steem editor runtime');
assert(!editorSlice.includes('new SimpleMDE'), 'legacy SimpleMDE editor constructor is not copied into Steem editor runtime');

assert(planSource.includes('### Rigorous parity: Steem / post'), 'plan contains Steem / post rigorous parity section');
assert(planSource.includes('Steem / post -> editor'), 'plan documents post to editor route mapping');
assert(planSource.includes('tests/v3-steem-post-smoke.js'), 'plan names focused Steem post smoke coverage');
assert(planSource.includes('backend-only non-goal') && planSource.includes('Imgur'), 'plan documents server/third-party upload non-goal');

console.log('v3 Steem post smoke passed');
