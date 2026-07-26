const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const indexSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const chainsSource = fs.readFileSync(path.join(root, 'v3/js/chains.js'), 'utf8');
const historySource = fs.readFileSync(path.join(root, 'v3/js/history.js'), 'utf8');
const notificationsSource = fs.readFileSync(path.join(root, 'v3/js/notifications.js'), 'utf8');
const appSource = fs.readFileSync(path.join(root, 'v3/js/app.js'), 'utf8');
const cssSource = fs.readFileSync(path.join(root, 'v3/css/style.css'), 'utf8');
const planSource = fs.readFileSync(path.join(root, 'plan.md'), 'utf8');

assert(indexSource.includes('id="notifications-panel"'), 'header contains notifications panel mount');
assert(indexSource.includes('v3/js/notifications.js') && indexSource.indexOf('v3/js/notifications.js') < indexSource.indexOf('v3/js/app.single-wallet-forms.js'), 'notifications module loads before app runtime');
assert(chainsSource.includes("id: 'notifications'") && chainsSource.includes("title: 'Уведомления'"), 'Golos has notifications app entry for show-all link');
assert(historySource.includes('content_mentions') && historySource.includes('comment_mention'), 'history operation labels include supported mention ops');
assert(notificationsSource.includes("content_mentions") && notificationsSource.includes("comment_mention"), 'notification scanner selects mention operations');
assert(notificationsSource.includes('dpos_notifications_v1'), 'notifications persist local unread/cursors');
assert(notificationsSource.includes('function ensureChainLibraryLoaded') && notificationsSource.includes('chain.libraryPath'), 'notifications load the chain browser library before DposProfiles.connect');
assert(notificationsSource.includes('Библиотека ${chain.libraryGlobal} не загружена'), 'notifications preserve a clear load failure message if script loading fails');
assert(notificationsSource.includes('markAllRead') && notificationsSource.includes('Показать все'), 'panel supports mark-all-read and show-all link');
assert(notificationsSource.includes('direction: \'incoming\''), 'notifications are classified as incoming events');
assert(!notificationsSource.includes('Ваш комментарий') && !notificationsSource.includes('Ваш репост') && !notificationsSource.includes('Исходящий перевод'), 'outgoing activity is not shown as notifications');
assert(!notificationsSource.includes('data-notifications-direction') && !notificationsSource.includes('Исходящие'), 'top panel has no outgoing/all direction filter');
assert(notificationsSource.includes('MAX_PANEL_ITEMS = 10'), 'top panel is capped to ten recent notifications');
assert(notificationsSource.includes('errors.push({ chainId: chain.id, account, error })'), 'notification background scan isolates per-account failures');
assert(!notificationsSource.includes('setStatus(`Не удалось проверить уведомления'), 'notification failures do not overwrite the active page status');
assert(appSource.includes("effectiveAppId === 'notifications'") && appSource.includes('renderNotificationsPage'), 'app routes notifications show-all page');
assert(cssSource.includes('.notifications-panel') && cssSource.includes('.notifications-popover'), 'notifications panel styles exist');
assert(planSource.includes('верхняя панель уведомлений'), 'plan documents notifications scope');

const storage = new Map();
const context = {
  console,
  URLSearchParams,
  setTimeout: () => 0,
  clearTimeout: () => {},
  localStorage: {
    get length() { return storage.size; },
    key(index) { return Array.from(storage.keys())[index] || null; },
    getItem(key) { return storage.has(key) ? storage.get(key) : null; },
    setItem(key, value) { storage.set(key, String(value)); },
    removeItem(key) { storage.delete(key); }
  },
  location: { hash: '' },
  document: {
    createElement() { return { addEventListener() {}, setAttribute() {}, appendChild() {}, dataset: {}, classList: { toggle() {} } }; },
    getElementById() { return null; }
  },
  DposChains: { golos: { id: 'golos', title: 'Golos' } },
  DposAuth: {
    getUsers() { return [{ login: 'denis-skripnik' }]; },
    getUserLogin(user) { return user.login; }
  },
  DposProfiles: {
    async connect(chain) {
      return { config: chain, client: { api: {} }, node: 'mock' };
    }
  },
  DposHistory: {
    operationTitle(type) { return type; },
    formatDate(value) { return value; },
    fetchAccountHistory: async (chain, account, options) => {
      assert(chain && chain.config && chain.config.id === 'golos', 'notifications scan passes connected chain to history fetcher');
      assert(account === 'denis-skripnik', 'notifications scan fetches saved account');
      assert(options && Array.isArray(options.ops) && options.ops.includes('content_mentions'), 'notifications scan requests selected notification ops');
      return [];
    }
  }
};
context.window = context;
vm.createContext(context);
vm.runInContext(notificationsSource, context);

const api = context.DposNotifications;
assert(api.supportsChain(context.DposChains.golos), 'Golos notifications are supported');
const tracked = api.getTrackedAccounts(context.DposChains.golos);
assert.strictEqual(tracked.length, 1, 'one saved Golos account is tracked');
assert.strictEqual(tracked[0], 'denis-skripnik', 'saved Golos account login is normalized');

const comment = api.toNotification(context.DposChains.golos, 'denis-skripnik', {
  index: 7,
  type: 'comment',
  timestamp: '2026-05-13T01:02:03',
  data: { author: 'alice', permlink: 'reply', parent_author: 'denis-skripnik', parent_permlink: 'post', body: 'hello' }
});
assert(comment && comment.direction === 'incoming', 'comment to tracked author becomes incoming notification');
assert(comment.url.includes('app=post') && comment.url.includes('author=alice'), 'comment notification links to post route');

const ownComment = api.toNotification(context.DposChains.golos, 'denis-skripnik', {
  index: 8,
  type: 'comment',
  data: { author: 'denis-skripnik', permlink: 'reply', parent_author: 'alice', body: 'own reply' }
});
assert.strictEqual(ownComment, null, 'own outgoing comment/reply is not a notification');

const mention = api.toNotification(context.DposChains.golos, 'denis-skripnik', {
  index: 9,
  type: 'content_mentions',
  data: { author: 'bob', permlink: 'mention', account: 'denis-skripnik' }
});
assert(mention && mention.type === 'mention', 'content_mentions becomes mention notification');

const repost = api.toNotification(context.DposChains.golos, 'denis-skripnik', {
  index: 10,
  type: 'custom_json',
  data: { required_posting_auths: ['charlie'], id: 'follow', json: '["reblog",{"account":"charlie","author":"denis-skripnik","permlink":"post"}]' }
});
assert(repost && repost.type === 'repost' && repost.direction === 'incoming', 'Golos follow/reblog custom_json becomes incoming repost notification');

const ownRepost = api.toNotification(context.DposChains.golos, 'denis-skripnik', {
  index: 11,
  type: 'custom_json',
  data: { required_posting_auths: ['denis-skripnik'], id: 'follow', json: '["reblog",{"account":"denis-skripnik","author":"alice","permlink":"post"}]' }
});
assert.strictEqual(ownRepost, null, 'own outgoing repost is not a notification');

const outgoingTransfer = api.toNotification(context.DposChains.golos, 'denis-skripnik', {
  index: 12,
  type: 'transfer',
  data: { from: 'denis-skripnik', to: 'alice', amount: '1.000 GOLOS' }
});
assert.strictEqual(outgoingTransfer, null, 'own outgoing transfer is not a notification');

api.upsertNotifications([{ id: 'golos:denis-skripnik:7', account: 'denis-skripnik', chainId: 'golos', direction: 'incoming', timestamp: '2026-05-13T01:02:03' }]);
assert.strictEqual(api.countUnread({ direction: 'incoming' }), 1, 'unread count persists');
api.markAllRead();
assert.strictEqual(api.countUnread({ direction: 'incoming' }), 0, 'mark all read clears unread count');

api.scanAll({ golos: { id: 'golos', title: 'Golos', libraryGlobal: 'golos', libraryPath: 'missing-golos.js' } }, { collectInitial: true }).then((items) => {
  assert(Array.isArray(items), 'scanAll returns an array even when a notification account fails');
  assert(items.errors && items.errors.length === 1, 'scanAll reports isolated notification scan failures without throwing');
  return api.scanAccount(context.DposChains.golos, 'denis-skripnik', { limit: 5, collectInitial: true });
}).then(() => {
  console.log('v3-notifications-smoke passed');
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
