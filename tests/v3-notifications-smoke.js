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
assert(indexSource.includes('v3/js/notifications.js') && indexSource.indexOf('v3/js/notifications.js') < indexSource.indexOf('v3/js/app.wallet-notifications.js'), 'notifications module loads before app runtime');
assert(chainsSource.includes("id: 'notifications'") && chainsSource.includes("title: 'Уведомления'") && chainsSource.includes('Hive/Steem-событий'), 'Golos/VIZ/Hive/Steem have notifications app entries for show-all link');
assert(historySource.includes('content_mentions') && historySource.includes('comment_mention'), 'history operation labels include supported mention ops');
assert(notificationsSource.includes("content_mentions") && notificationsSource.includes("comment_mention") && notificationsSource.includes("hive: ['comment', 'transfer'") && notificationsSource.includes("steem: ['comment', 'transfer'"), 'notification scanner selects explicit ops for Golos/VIZ/Hive/Steem');
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
assert(appSource.includes("notifications && notifications.supportsChain(chain) && effectiveAppId === 'notifications'") && appSource.includes('renderNotificationsPage'), 'app routes notifications page for every supported notification chain');
assert(appSource.includes('data-android-notifications-settings') && appSource.includes('notificationOps: currentSettings.ops'), 'notifications page syncs selected filters into Android native settings without separate controls');
assert(appSource.includes("'minter', 'decimal'") && appSource.includes('публичную историю аккаунта/адреса'), 'Minter/Decimal use the same Android native notification settings UX through public wallet history');
assert(!appSource.includes('data-android-import-viz-notifications') && !appSource.includes('data-android-start-worker') && !appSource.includes('data-android-check-now'), 'notification native UI exposes no separate import/start/check controls');
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
    canonicalOperationType(chain, type) {
      const id = typeof chain === 'string' ? chain : chain.id;
      const text = String(type);
      if (id === 'minter' && ['13', 'multisend_coin', 'COIN_MULTISEND', 'coin_multisend'].includes(text)) return 'multisend';
      if (id === 'decimal' && ['/decimal.coin.v1.MsgMultiSendCoin', 'multi_send', 'MsgMultiSendCoin'].includes(text)) return 'multisend';
      return text;
    },
    operationTitle(type) { return type; },
    formatDate(value) { return value; },
    fetchAccountHistory: async (chain, account, options) => {
      assert(chain && chain.config && chain.config.id === 'golos', 'notifications scan passes connected chain to history fetcher');
      assert(account === 'denis-skripnik', 'notifications scan fetches saved account');
      assert(options && Array.isArray(options.ops) && options.ops.length === 1 && options.ops.includes('transfer'), 'notifications scan requests selected per-account notification ops');
      return [];
    }
  }
};
context.window = context;
vm.createContext(context);
vm.runInContext(notificationsSource, context);

const api = context.DposNotifications;
assert(api.supportsChain(context.DposChains.golos), 'Golos notifications are supported');
assert(api.supportsChain({ id: 'hive', title: 'Hive' }), 'Hive notifications are supported');
assert(api.supportsChain({ id: 'steem', title: 'Steem' }), 'Steem notifications are supported');
assert(api.supportsChain({ id: 'minter', title: 'Minter' }), 'Minter wallet notifications are supported through public history API');
assert(api.supportsChain({ id: 'decimal', title: 'Decimal' }), 'Decimal wallet notifications are supported through public history API');
assert(api.defaultOps({ id: 'minter' }).includes('multisend'), 'Minter notification filters include multisend');
assert(api.defaultOps({ id: 'decimal' }).includes('multisend'), 'Decimal notification filters include multisend');
api.saveSettings(context.DposChains.golos, 'denis-skripnik', { ops: ['transfer'], androidNative: true, intervalMinutes: 20 });
assert.strictEqual(Array.from(api.getSettings(context.DposChains.golos, 'denis-skripnik').ops).join(','), 'transfer', 'notification operation filters persist per chain/account');
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

const hiveReward = api.toNotification({ id: 'hive', title: 'Hive' }, 'denis', {
  index: 13,
  type: 'author_reward',
  data: { author: 'denis', hive_payout: '1.000 HIVE' }
});
assert(hiveReward && hiveReward.title === 'Авторские награды' && hiveReward.url.includes('chain=hive'), 'Hive author_reward becomes a filtered local notification');

const minterSend = api.toNotification({ id: 'minter', title: 'Minter' }, 'Mxf85ceccfe2112e88be58162c43f5ec959672ab54', {
  index: 14,
  type: 'send',
  data: { from: 'Mx1111111111111111111111111111111111111111', to: 'Mxf85ceccfe2112e88be58162c43f5ec959672ab54', value: '1000000000000000000', coin: 'BIP' }
});
assert(minterSend && minterSend.direction === 'incoming' && minterSend.url.includes('chain=minter') && minterSend.url.includes('ops=send'), 'Minter send involving the address becomes a wallet notification');

const decimalDelegate = api.toNotification({ id: 'decimal', title: 'Decimal' }, 'dx0000000000000000000000000000000000000000', {
  index: 15,
  type: 'delegate',
  data: { delegator: 'dx0000000000000000000000000000000000000000', validator: 'dx1111111111111111111111111111111111111111', stake: '5000000000000000000', denom: 'DEL' }
});
assert(decimalDelegate && decimalDelegate.title === 'Делегирование' && decimalDelegate.url.includes('chain=decimal'), 'Decimal delegate involving the address becomes a wallet notification');

const minterMultisend = api.toNotification({ id: 'minter', title: 'Minter' }, 'Mxf85ceccfe2112e88be58162c43f5ec959672ab54', {
  index: 16,
  type: 'multisend_coin',
  data: { from: 'Mx1111111111111111111111111111111111111111', list: [{ address: 'Mxf85ceccfe2112e88be58162c43f5ec959672ab54', value: '1', coin: 'BIP' }] }
});
assert(minterMultisend && minterMultisend.title === 'Мульти-отправка' && minterMultisend.url.includes('ops=multisend'), 'Minter multisend operation is normalized by the shared history operation layer');

const decimalMultisend = api.toNotification({ id: 'decimal', title: 'Decimal' }, 'dx0000000000000000000000000000000000000000', {
  index: 17,
  type: '/decimal.coin.v1.MsgMultiSendCoin',
  data: { from: 'dx1111111111111111111111111111111111111111', recipients: [{ address: 'dx0000000000000000000000000000000000000000', amount: '1', denom: 'DEL' }] }
});
assert(decimalMultisend && decimalMultisend.title === 'Мульти-отправка' && decimalMultisend.url.includes('ops=multisend'), 'Decimal multisend operation is normalized by the shared history operation layer');

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
