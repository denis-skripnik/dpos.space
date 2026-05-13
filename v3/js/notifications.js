(function exposeNotifications(global) {
  'use strict';

  const STORAGE_KEY = 'dpos_notifications_v1';
  const MAX_PANEL_ITEMS = 10;
  const DEFAULT_LIMIT = 60;
  const CHECK_INTERVAL_MS = 120000;
  const NOTIFICATION_OPS = {
    golos: ['content_mentions', 'comment_mention', 'comment', 'custom_json', 'transfer', 'donate']
  };
  const SUPPORTED_CHAINS = new Set(Object.keys(NOTIFICATION_OPS));

  function safeJsonParse(value, fallback) {
    if (!value) return fallback;
    try {
      return JSON.parse(value);
    } catch (error) {
      return fallback;
    }
  }

  function readStore() {
    const store = safeJsonParse(global.localStorage && global.localStorage.getItem(STORAGE_KEY), null);
    if (store && typeof store === 'object') {
      if (!store.accounts || typeof store.accounts !== 'object') store.accounts = {};
      if (!Array.isArray(store.notifications)) store.notifications = [];
      if (!store.settings || typeof store.settings !== 'object') store.settings = {};
      return store;
    }
    return { accounts: {}, notifications: [], settings: {} };
  }

  function writeStore(store) {
    if (!global.localStorage) return;
    global.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }

  function accountKey(chainId, account) {
    return `${chainId}:${String(account || '').toLowerCase()}`;
  }

  function normalizeAccount(value) {
    return String(value || '').trim().replace(/^@/, '').toLowerCase();
  }

  function supportsChain(chain) {
    const chainId = chain && (chain.id || (chain.config && chain.config.id));
    return SUPPORTED_CHAINS.has(chainId);
  }

  function unique(values) {
    const seen = new Set();
    const result = [];
    (values || []).forEach((value) => {
      const normalized = normalizeAccount(value);
      if (!normalized || seen.has(normalized)) return;
      seen.add(normalized);
      result.push(normalized);
    });
    return result;
  }

  function getTrackedAccounts(chain) {
    if (!supportsChain(chain) || !global.DposAuth || typeof global.DposAuth.getUsers !== 'function') return [];
    const users = global.DposAuth.getUsers(chain) || [];
    return unique(users.map((user) => {
      if (typeof global.DposAuth.getUserLogin === 'function') return global.DposAuth.getUserLogin(user);
      return user && (user.login || user.last_login || user.account || user.name);
    }));
  }

  function historyIndex(item) {
    const value = Number(item && item.index);
    return Number.isFinite(value) ? value : -1;
  }

  function postUrl(chain, author, permlink) {
    const params = new URLSearchParams({ chain: chain.id, app: 'post', author: author || '', permlink: permlink || '' });
    return `#${params.toString()}`;
  }

  function historyUrl(chain, account, type) {
    const params = new URLSearchParams({ chain: chain.id, app: 'history', account });
    if (type) params.set('ops', type);
    return `#${params.toString()}`;
  }

  function notificationsUrl(chain, account) {
    const params = new URLSearchParams({ chain: chain.id, app: 'notifications' });
    if (account) params.set('account', account);
    return `#${params.toString()}`;
  }

  function notificationId(chain, account, item, suffix) {
    return [chain.id, normalizeAccount(account), historyIndex(item), suffix || item.type || 'event'].join(':');
  }

  function firstNonEmpty(values) {
    return (values || []).find((value) => value !== undefined && value !== null && value !== '') || '';
  }

  function parseCustomJson(data) {
    const raw = data && data.json;
    if (!raw) return null;
    return safeJsonParse(raw, null);
  }

  function customJsonRepost(data) {
    if (!data || data.id !== 'follow') return null;
    const payload = parseCustomJson(data);
    if (!Array.isArray(payload) || payload[0] !== 'reblog' || !payload[1]) return null;
    return payload[1];
  }

  function toNotification(chain, account, item) {
    if (!supportsChain(chain) || !item) return null;
    const target = normalizeAccount(account);
    const data = item.data || {};
    const type = item.type || 'unknown';
    const index = historyIndex(item);
    const timestamp = item.timestamp || '';
    const base = {
      chainId: chain.id,
      chainTitle: chain.title || chain.id,
      account: target,
      sourceIndex: index,
      opType: type,
      timestamp,
      read: false
    };

    if (type === 'content_mentions' || type === 'comment_mention') {
      const author = firstNonEmpty([data.author, data.mentioned_by, data.account_from, data.from]);
      const permlink = firstNonEmpty([data.permlink, data.url, data.link]);
      return Object.assign(base, {
        id: notificationId(chain, target, item, 'mention'),
        type: 'mention',
        direction: 'incoming',
        title: 'Новое упоминание',
        text: author ? `@${author} упомянул ${target}` : `Упоминание @${target}`,
        url: author && permlink ? postUrl(chain, author, permlink) : historyUrl(chain, target, type)
      });
    }

    if (type === 'comment') {
      const author = normalizeAccount(data.author);
      const parentAuthor = normalizeAccount(data.parent_author);
      const permlink = data.permlink || '';
      const parentPermlink = data.parent_permlink || '';
      if (parentAuthor === target && author !== target) {
        return Object.assign(base, {
          id: notificationId(chain, target, item, 'comment'),
          type: 'comment',
          direction: 'incoming',
          title: 'Новый комментарий',
          text: `@${author || 'кто-то'} ответил к материалу @${target}`,
          url: author && permlink ? postUrl(chain, author, permlink) : historyUrl(chain, target, type)
        });
      }
      return null;
    }

    if (type === 'custom_json') {
      const repost = customJsonRepost(data);
      if (!repost) return null;
      const author = normalizeAccount(repost.author);
      const reposter = normalizeAccount(repost.account || (data.required_posting_auths && data.required_posting_auths[0]));
      if (author === target && reposter !== target) {
        return Object.assign(base, {
          id: notificationId(chain, target, item, 'repost'),
          type: 'repost',
          direction: 'incoming',
          title: 'Новый репост',
          text: `@${reposter || 'кто-то'} сделал репост материала @${target}`,
          url: postUrl(chain, author, repost.permlink || '')
        });
      }
      return null;
    }

    if (type === 'transfer' || type === 'donate') {
      const from = normalizeAccount(data.from);
      const to = normalizeAccount(data.to || data.receiver);
      const amount = firstNonEmpty([data.amount, data.quantity, data.value]);
      if (to === target && from !== target) {
        return Object.assign(base, {
          id: notificationId(chain, target, item, type),
          type,
          direction: 'incoming',
          title: type === 'donate' ? 'Новый донат' : 'Входящий перевод',
          text: [`от @${from || 'неизвестно'}`, amount].filter(Boolean).join(', '),
          url: historyUrl(chain, target, type)
        });
      }
      return null;
    }

    return null;
  }

  function upsertNotifications(nextNotifications) {
    const store = readStore();
    const byId = new Map((store.notifications || []).map((item) => [item.id, item]));
    (nextNotifications || []).forEach((item) => {
      if (!item || !item.id) return;
      const previous = byId.get(item.id);
      byId.set(item.id, Object.assign({}, item, { read: previous ? previous.read === true : item.read === true }));
    });
    store.notifications = Array.from(byId.values())
      .sort((a, b) => String(b.timestamp || '').localeCompare(String(a.timestamp || '')) || Number(b.sourceIndex || 0) - Number(a.sourceIndex || 0))
      .slice(0, 200);
    writeStore(store);
    return store.notifications;
  }

  function filteredNotifications() {
    return (readStore().notifications || [])
      .filter((item) => !item.read)
      .filter((item) => item.direction === 'incoming');
  }

  function countUnread() {
    return filteredNotifications().length;
  }

  function markAllRead() {
    const store = readStore();
    store.notifications = (store.notifications || []).map((item) => Object.assign({}, item, { read: true }));
    writeStore(store);
    return store;
  }

  function getCursor(chain, account) {
    const item = readStore().accounts[accountKey(chain.id, account)] || {};
    const value = Number(item.cursor);
    return Number.isFinite(value) ? value : null;
  }

  function setCursor(chain, account, cursor) {
    const store = readStore();
    const key = accountKey(chain.id, account);
    store.accounts[key] = Object.assign({}, store.accounts[key] || {}, { cursor, lastCheckedAt: new Date().toISOString() });
    writeStore(store);
  }

  async function fetchAccountRows(chain, account, limit) {
    const ops = NOTIFICATION_OPS[chain.id] || [];
    try {
      return await global.DposHistory.fetchAccountHistory(chain, account, { limit: limit || DEFAULT_LIMIT, ops });
    } catch (error) {
      return global.DposHistory.fetchAccountHistory(chain, account, { limit: limit || DEFAULT_LIMIT });
    }
  }

  async function scanAccount(chain, account, options = {}) {
    if (!supportsChain(chain) || !global.DposHistory || typeof global.DposHistory.fetchAccountHistory !== 'function') return [];
    const rows = await fetchAccountRows(chain, account, options.limit || DEFAULT_LIMIT);
    const cursor = getCursor(chain, account);
    const maxIndex = rows.reduce((max, item) => Math.max(max, historyIndex(item)), cursor || -1);
    if (cursor === null && !options.collectInitial) {
      setCursor(chain, account, maxIndex);
      return [];
    }
    const notifications = rows
      .filter((item) => cursor === null || historyIndex(item) > cursor)
      .map((item) => toNotification(chain, account, item))
      .filter(Boolean);
    setCursor(chain, account, maxIndex);
    if (notifications.length) upsertNotifications(notifications);
    return notifications;
  }

  async function scanAll(chains, options = {}) {
    const found = [];
    for (const chain of Object.values(chains || {})) {
      if (!supportsChain(chain)) continue;
      const accounts = getTrackedAccounts(chain);
      for (const account of accounts) {
        const items = await scanAccount(chain, account, options);
        found.push(...items);
      }
    }
    return found;
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function renderList(items) {
    const visible = items.slice(0, MAX_PANEL_ITEMS);
    if (!visible.length) return '<p class="muted">Непрочитанных уведомлений нет.</p>';
    return `<ul class="notifications-list">${visible.map((item) => `<li><a href="${escapeHtml(item.url || '#')}"><strong>${escapeHtml(item.title)}</strong><br><span>${escapeHtml(item.chainTitle || item.chainId)} / @${escapeHtml(item.account)}: ${escapeHtml(item.text || '')}</span></a></li>`).join('')}</ul>`;
  }

  function renderPanel(container, chains, statusMessage) {
    if (!container) return;
    const selectedChainId = String(new URLSearchParams((global.location && global.location.hash || '').replace(/^#/, '')).get('chain') || 'viz');
    const selectedChain = chains && chains[selectedChainId];
    if (!supportsChain(selectedChain)) {
      container.hidden = true;
      container.innerHTML = '';
      return;
    }
    const supportedAccounts = Object.values(chains || {}).flatMap((chain) => supportsChain(chain) ? getTrackedAccounts(chain).map((account) => ({ chain, account })) : []);
    if (!supportedAccounts.length) {
      container.hidden = true;
      container.innerHTML = '';
      return;
    }
    const unread = filteredNotifications();
    const first = supportedAccounts[0];
    container.hidden = false;
    container.innerHTML = `<details class="notifications-popover">
      <summary>Уведомления: <span data-notifications-count>${unread.length}</span></summary>
      <section aria-label="Непрочитанные уведомления">
        <div class="notifications-toolbar">
          <button type="button" class="secondary" data-notifications-refresh>Обновить</button>
          <button type="button" class="secondary" data-notifications-read>Отметить прочитанным</button>
        </div>
        ${statusMessage ? `<p class="muted">${escapeHtml(statusMessage)}</p>` : ''}
        ${renderList(unread)}
        <p><a href="${escapeHtml(notificationsUrl(first.chain, first.account))}" data-notifications-all>Показать все</a></p>
      </section>
    </details>`;
  }

  function init(container, chains, hooks = {}) {
    let running = false;
    let timer = null;
    const setStatus = typeof hooks.setStatus === 'function' ? hooks.setStatus : function noop() {};
    const rerender = (message) => renderPanel(container, chains, message);
    const refresh = async () => {
      const selectedChainId = String(new URLSearchParams((global.location && global.location.hash || '').replace(/^#/, '')).get('chain') || 'viz');
      if (!supportsChain(chains && chains[selectedChainId])) {
        rerender('');
        return;
      }
      if (running) return;
      running = true;
      rerender('Проверяю новые события…');
      try {
        const found = await scanAll(chains);
        rerender(found.length ? `Найдено новых: ${found.length}.` : 'Новых событий нет.');
        setStatus(found.length ? `Найдено новых уведомлений: ${found.length}.` : 'Уведомления проверены.', found.length ? 'ok' : 'info');
      } catch (error) {
        rerender(`Не удалось проверить уведомления: ${error.message || error}`);
        setStatus(`Не удалось проверить уведомления: ${error.message || error}`, 'error');
      } finally {
        running = false;
      }
    };
    rerender('');
    if (container) {
      container.addEventListener('click', (event) => {
        const refreshButton = event.target.closest('[data-notifications-refresh]');
        const readButton = event.target.closest('[data-notifications-read]');
        if (refreshButton) refresh();
        if (readButton) {
          markAllRead();
          rerender('Все уведомления отмечены прочитанными.');
        }
      });
    }
    refresh();
    if (typeof global.setInterval === 'function') {
      timer = global.setInterval(() => {
        if (!global.document || global.document.hidden) return;
        refresh();
      }, CHECK_INTERVAL_MS);
    }
    return { refresh, stop: () => timer && global.clearInterval(timer) };
  }

  global.DposNotifications = Object.freeze({
    STORAGE_KEY,
    MAX_PANEL_ITEMS,
    supportsChain,
    getTrackedAccounts,
    toNotification,
    upsertNotifications,
    filteredNotifications,
    countUnread,
    markAllRead,
    scanAccount,
    scanAll,
    renderPanel,
    init
  });
})(window);
