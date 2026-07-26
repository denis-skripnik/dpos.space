const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const chainsSource = fs.readFileSync('v3/js/chains.js', 'utf8');
const notificationsSource = fs.readFileSync('v3/js/notifications.js', 'utf8');
const appSource = fs.readFileSync('v3/js/app.js', 'utf8');
const planSource = fs.readFileSync('plan.md', 'utf8');

assert(chainsSource.includes("{ id: 'notifications', title: 'Уведомления'") && chainsSource.includes('Локальная панель входящих VIZ-событий'), 'VIZ notifications app is registered');
assert(notificationsSource.includes("viz: ['comment', 'transfer', 'award', 'fixed_award', 'receive_award', 'benefactor_award']"), 'VIZ browser notification ops are explicit');
assert(appSource.includes("notifications && notifications.supportsChain(chain) && effectiveAppId === 'notifications'"), 'notifications route is dispatched by helper support, not VIZ-only hardcode');
const vizNotificationsSlice = appSource.slice(appSource.indexOf('function renderNotificationsPage'), appSource.indexOf('async function renderRoute'));
assert(vizNotificationsSlice.includes('data-android-notifications-settings') && vizNotificationsSlice.includes('enableAutoUpvoter: false') && vizNotificationsSlice.includes('notificationOps: currentSettings.ops'), 'Android notifications are notifications-only and receive selected op filters');
assert(vizNotificationsSlice.includes('native notifications используют эти же фильтры'), 'Android notifications auto-start from the normal notifications page with the same filters');
assert(vizNotificationsSlice.includes("callAndroidWorkerBridge('importWorkerSettings'") && vizNotificationsSlice.includes("callAndroidWorkerBridge('startWorker'") && vizNotificationsSlice.includes("callAndroidWorkerBridge('checkNow'"), 'VIZ notifications page syncs, starts native worker, and queues check-now automatically');
assert(!vizNotificationsSlice.includes('data-android-import-viz-notifications') && !vizNotificationsSlice.includes('data-android-start-worker') && !vizNotificationsSlice.includes('data-android-check-now'), 'VIZ notifications UI exposes no separate native import/start/check buttons');
assert(vizNotificationsSlice.includes('операции не отправляет'), 'notification UI avoids false native signing/broadcast claims');
assert(planSource.includes('Android native parity') || planSource.includes('native notifications'), 'plan records native notification scope');

const localStorageData = {};
const context = {
  window: {},
  localStorage: { getItem: (k) => localStorageData[k] || null, setItem: (k, v) => { localStorageData[k] = String(v); } },
  URLSearchParams,
  document: { createElement: () => ({}), head: { appendChild: () => {} } }
};
context.window = context;
vm.createContext(context);
vm.runInContext(notificationsSource, context, { filename: 'v3/js/notifications.js' });
const api = context.DposNotifications;
assert(api.supportsChain({ id: 'viz' }), 'notification helper supports VIZ');
const award = api.toNotification({ id: 'viz', title: 'VIZ' }, 'denis', { index: 7, type: 'award', timestamp: '2026-01-01T00:00:00', data: { initiator: 'alice', receiver: 'denis', shares: '1.000000 SHARES' } });
assert(award && award.id === 'viz:denis:7:award', 'VIZ incoming award becomes a local notification');
assert(award.url.includes('#chain=viz&app=history&account=denis&ops=award'), 'VIZ award notification routes to VIZ history');
const outgoing = api.toNotification({ id: 'viz', title: 'VIZ' }, 'denis', { index: 8, type: 'fixed_award', data: { initiator: 'denis', receiver: 'alice', reward_amount: '1.000 VIZ' } });
assert.strictEqual(outgoing, null, 'outgoing VIZ awards do not notify the sender');
console.log('v3 VIZ native notifications smoke passed');
