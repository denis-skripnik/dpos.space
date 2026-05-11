const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const appSource = fs.readFileSync('v3/js/app.js', 'utf8');
const broadcastSource = fs.readFileSync('v3/js/broadcast.js', 'utf8');
const chainsSource = fs.readFileSync('v3/js/chains.js', 'utf8');
const planSource = fs.readFileSync('plan.md', 'utf8');

const renderVizAward = (appSource.match(/function renderVizAward[\s\S]*?\n  function golosDonateAssetOptions/) || [''])[0];
const awardHelpers = appSource.slice(appSource.indexOf('function parseVizBeneficiaries'), appSource.indexOf('function golosDonateAssetOptions'));
const routeSection = appSource.slice(appSource.indexOf('async function renderRoute'), appSource.indexOf('global.addEventListener'));

assert(chainsSource.includes("{ id: 'award', title: 'Награды'"), 'VIZ exposes canonical static award route');
assert(appSource.includes("awards: 'award'"), 'legacy awards app id aliases to the static award route');
assert(routeSection.includes("renderVizAward(chain, state)"), 'router passes hash/query state into VIZ awards for url/link/send parity');
assert(appSource.includes("'awardPage'"), 'awardPage is preserved as an app-scoped hash param');

for (const marker of [
  'viz-award-form',
  'award-target',
  'award-energy',
  'award-payout',
  'award-fixed',
  'award-custom-sequence',
  'award-beneficiaries',
  'award-memo',
  'data-operation-result role="status" aria-live="polite"'
]) {
  assert(renderVizAward.includes(marker), `VIZ awards renders legacy/static control ${marker}`);
}

for (const marker of [
  "'award'",
  "'fixedAward'",
  "broadcast.prepare(chain, 'regular', 'award'",
  "broadcast.prepare(chain, 'regular', 'fixedAward'",
  'Memo похоже на приватный WIF',
  'sanitizePrepared',
  'sanitizeResult'
]) {
  assert(appSource.includes(marker) || broadcastSource.includes(marker), `VIZ awards operation/safety evidence exists: ${marker}`);
}

for (const marker of [
  'parseVizBeneficiaries',
  'account:10, other:5',
  'JSON beneficiaries должен быть массивом',
  'Суммарный вес beneficiaries не должен превышать 100%'
]) {
  assert(awardHelpers.includes(marker), `VIZ awards beneficiaries parity exists: ${marker}`);
}

for (const marker of [
  'function renderVizAwardUrlGenerator',
  'viz-award-url-form',
  'viz-award-generated-link',
  'viz-award-qr-payload',
  'Сформировать url',
  'QR payload'
]) {
  assert(renderVizAward.includes(marker) || awardHelpers.includes(marker) || appSource.includes(marker), `VIZ awards url/QR static equivalent exists: ${marker}`);
}

for (const marker of [
  'function renderVizAwardBuilder',
  'viz-award-builder-form',
  'builder-target-enabled',
  'builder-pay-method',
  'builder-energy-view',
  'builder-note-mode',
  'builder-app-beneficiary-enabled',
  'builder-user-beneficiary-enabled',
  'builder-url-mode',
  'viz-award-builder-head-code',
  'viz-award-builder-final-code',
  'buildVizAwardBuilderSnippet',
  'checkVizAwardBuilderPercentLimit'
]) {
  assert(appSource.includes(marker), `VIZ awards builder parity/control exists: ${marker}`);
}

for (const marker of [
  'function renderVizAwardLinkPage',
  'viz-award-link-form',
  'link-target',
  'link-custom-sequence',
  'link-memo',
  'link-energy',
  'link-fixed',
  'legacy link page'
]) {
  assert(appSource.includes(marker), `VIZ awards link route equivalent exists: ${marker}`);
}

for (const marker of [
  'function renderVizAwardSendPage',
  'viz-award-send-review',
  'send page не отправляет транзакцию автоматически',
  'renderVizAwardMainForm(chain, state, { mode: \'send\''
]) {
  assert(appSource.includes(marker), `VIZ awards send route equivalent exists: ${marker}`);
}

for (const marker of [
  'calculateVizAwardPayout',
  'calculateVizEnergyForPayout',
  'vizEffectiveShares',
  'buildVizAwardLink'
]) {
  assert(appSource.includes(marker), `VIZ awards preserves calculation/helper ${marker}`);
}

for (const evidence of [
  '### Rigorous parity: VIZ / awards',
  'blockchains/viz/apps/awards/config.json',
  'blockchains/viz/apps/awards/content.php',
  'blockchains/viz/apps/awards/index.php',
  'blockchains/viz/apps/awards/js/app.js',
  'blockchains/viz/apps/awards/css/style.css',
  'blockchains/viz/apps/awards/css/jquery-ui.css',
  'blockchains/viz/apps/awards/js/qrcode.min.js',
  'blockchains/viz/apps/awards/pages/link/content.php',
  'blockchains/viz/apps/awards/pages/builder/content.php',
  'blockchains/viz/apps/awards/pages/builder/builder.js',
  'blockchains/viz/apps/awards/pages/builder/footer.js',
  'blockchains/viz/apps/awards/pages/url/content.php',
  'blockchains/viz/apps/awards/pages/send/content.php',
  'viz.broadcast.awardAsync(posting_key,viz_login,target,energy,custom_sequence,memo,benef_list',
  'viz.broadcast.fixedAwardAsync(posting_key,viz_login,target,parseFloat(payout).toFixed(3) + \' VIZ\'',
  "sendToVizonator('award'",
  "sendToVizonator('fixed_award'"
]) {
  assert(planSource.includes(evidence), `plan.md records VIZ awards evidence: ${evidence}`);
}

const awardsRuntimeSlice = renderVizAward + awardHelpers + routeSection;
assert(!awardsRuntimeSlice.includes('backend.dpos.space'), 'VIZ awards does not depend on backend.dpos.space');
assert(!awardsRuntimeSlice.includes('178.20.43.121'), 'VIZ awards does not depend on old private backend IP');
assert(!/blockchains\/viz\/apps\/awards\/pages\/builder\/builder\.js/.test(awardsRuntimeSlice), 'v3 awards runtime does not load old awards builder.js path');

const context = { window: {}, URLSearchParams, location: { origin: 'https://dpos.space', pathname: '/' } };
context.window = context;
vm.createContext(context);
vm.runInContext(chainsSource, context);
assert(context.DposChains.viz.apps.some((app) => app.id === 'award'), 'chains runtime exposes VIZ award app');

console.log('v3 VIZ awards smoke passed');
