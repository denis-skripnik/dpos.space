const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.resolve(__dirname, '..');
const appSource = fs.readFileSync(path.join(root, 'v3/js/app.js'), 'utf8');
const planSource = fs.readFileSync(path.join(root, 'plan.md'), 'utf8');

assert(appSource.includes('function renderGolosDonateMemoHtml'), 'Golos donate memo has a dedicated renderer');
assert(appSource.includes("row.type === 'donate'"), 'transaction rows route donate operations through a special formatter');
assert(appSource.includes('memo.target') && appSource.includes('target.author') && appSource.includes('target.permlink'), 'donate memo target author/permlink is parsed');
assert(appSource.includes("app: 'post'"), 'donate target renderer links to the v3 post route');
assert(appSource.includes('renderTransactionDetailsHtml'), 'transaction details can render safe HTML instead of stringifying objects as [object Object]');
assert(!appSource.includes('<td class="longtext">${escapeHtml(details)}</td>'), 'history table no longer blindly escapes object details');

assert(planSource.includes('Current focused pass — Golos donate history memo'), 'plan documents the Golos donate memo pass');

console.log('v3 Golos donate history smoke passed');
