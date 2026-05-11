const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const appSource = fs.readFileSync(path.join(root, 'v3/js/app.js'), 'utf8');
const planSource = fs.readFileSync(path.join(root, 'plan.md'), 'utf8');

assert(appSource.includes('function buildGenericEditorOperations'), 'Steem/Hive editor has generic payload builder');
assert(appSource.includes("if (!tags.includes('dpos-post')) tags.push('dpos-post');"), 'Steem/Hive editor appends legacy dpos-post tag');
assert(appSource.includes("const permlink = manualPermlink || golosLegacyTransform(title, '-');"), 'Steem/Hive editor can generate permlink from title like legacy post app');
assert(appSource.includes("const metadata = { tags, app: chain.id === 'steem' ? 'dpos.space/post' : 'dpos.space/v3', format: 'markdown', image: images };"), 'Steem/Hive editor includes preview image metadata and chain-specific app marker');
assert(appSource.includes("percent_steem_dollars: chain.id === 'steem' ? payoutPercent : undefined"), 'Steem editor sends user-selected percent_steem_dollars');
assert(appSource.includes("percent_hbd: chain.id === 'hive' ? payoutPercent : undefined"), 'Hive editor sends user-selected percent_hbd');
assert(appSource.includes('Сообщество / parent_permlink') && appSource.includes('hive-179017') && appSource.includes('hive-167922'), 'Hive editor exposes legacy community/parent_permlink choices');
assert(appSource.includes('editor-beneficiary-account') && appSource.includes("extensions: [[0, { beneficiaries }]]"), 'Steem/Hive editor exposes and sends beneficiaries extension');
assert(appSource.includes('100% в ${escapeHtml(chain.powerTitle || \'HP\')}'), 'Steem/Hive editor exposes 100% power payout option');
assert(planSource.includes('Steem/Hive editor/post deep pass'), 'plan documents Steem/Hive editor/post parity pass');

console.log('v3 social editor smoke passed');
