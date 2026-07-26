(function exposeNotifications(global) {
  'use strict';

  const STORAGE_KEY = 'dpos_notifications_v1';
  const MAX_PANEL_ITEMS = 10;
  const DEFAULT_LIMIT = 60;
  const CHECK_INTERVAL_MS = 120000;
  const NOTIFICATION_OPS = {
    golos: ['content_mentions', 'comment_mention', 'comment', 'custom_json', 'transfer', 'donate', 'author_reward', 'curation_reward', 'comment_benefactor_reward'],
    viz: ['comment', 'transfer', 'award', 'fixed_award', 'receive_award', 'benefactor_award'],
    hive: ['comment', 'transfer', 'transfer_to_vesting', 'withdraw_vesting', 'delegate_vesting_shares', 'return_vesting_delegation', 'author_reward', 'curation_reward', 'comment_benefactor_reward', 'account_witness_vote', 'proposal_create', 'proposal_update', 'proposal_delete'],
    steem: ['comment', 'transfer', 'transfer_to_vesting', 'withdraw_vesting', 'delegate_vesting_shares', 'return_vesting_delegation', 'author_reward', 'curation_reward', 'comment_benefactor_reward', 'account_witness_vote', 'producer_reward'],
    minter: ['send', 'multisend', 'delegate', 'unbond', 'sell', 'sell_swap_pool', 'add_liquidity', 'remove_liquidity', 'create_coin', 'mint_token', 'burn_token'],
    decimal: ['send', 'multisend', 'delegate', 'unbond', 'create_token', 'transfer_token', 'nft']
  };
  const OP_LABELS = {
    content_mentions: 'Упоминания', comment_mention: 'Упоминания', comment: 'Ответы/комментарии', custom_json: 'Репосты/custom_json',
    transfer: 'Входящие переводы', donate: 'Донаты', award: 'VIZ награды', fixed_award: 'VIZ фиксированные награды', receive_award: 'Полученные VIZ награды', benefactor_award: 'Бенефициарские VIZ награды',
    transfer_to_vesting: 'Power up / vesting', withdraw_vesting: 'Power down', delegate_vesting_shares: 'Делегирование vesting', return_vesting_delegation: 'Возврат делегирования',
    author_reward: 'Авторские награды', curation_reward: 'Кураторские награды', comment_benefactor_reward: 'Бенефициарские награды',
    account_witness_vote: 'Witness/validator votes', proposal_create: 'DAO proposals create', proposal_update: 'DAO proposals update', proposal_delete: 'DAO proposals delete', producer_reward: 'Producer rewards',
    send: 'Переводы', multisend: 'Мульти-отправка', delegate: 'Делегирование', unbond: 'Анбонд', sell: 'Продажа/обмен', sell_swap_pool: 'Swap-pool продажа', add_liquidity: 'Добавление ликвидности', remove_liquidity: 'Удаление ликвидности', create_coin: 'Создание монеты', mint_token: 'Выпуск токена', burn_token: 'Сжигание токена', create_token: 'Создание токена', transfer_token: 'Передача token/NFT', nft: 'NFT операции'
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

  function defaultOps(chain) {
    const chainId = chain && (chain.id || (chain.config && chain.config.id));
    return (NOTIFICATION_OPS[chainId] || []).slice();
  }

  function operationLabel(type) {
    return OP_LABELS[type] || type;
  }

  function settingsKey(chain, account) {
    return accountKey(chain.id || (chain.config && chain.config.id), account || '');
  }

  function getSettings(chain, account) {
    const defaults = defaultOps(chain);
    const store = readStore();
    const settings = store.settings && store.settings[settingsKey(chain, account)] || {};
    const selected = Array.isArray(settings.ops) ? settings.ops.filter((op) => defaults.includes(op)) : defaults;
    return {
      ops: selected.length ? selected : defaults,
      androidNative: settings.androidNative !== false,
      intervalMinutes: Number(settings.intervalMinutes) >= 15 ? Number(settings.intervalMinutes) : 15
    };
  }

  function saveSettings(chain, account, settings) {
    const defaults = defaultOps(chain);
    const selected = Array.isArray(settings && settings.ops) ? settings.ops.filter((op) => defaults.includes(op)) : defaults;
    const store = readStore();
    const key = settingsKey(chain, account);
    store.settings[key] = {
      ops: selected.length ? selected : defaults,
      androidNative: settings && settings.androidNative !== false,
      intervalMinutes: Number(settings && settings.intervalMinutes) >= 15 ? Number(settings.intervalMinutes) : 15
    };
    writeStore(store);
    return store.settings[key];
  }

  const loadingScripts = new Map();

  function ensureChainLibraryLoaded(chain) {
    if (!chain || !chain.libraryGlobal || global[chain.libraryGlobal]) return Promise.resolve();
    if (!chain.libraryPath) return Promise.reject(new Error(`Библиотека ${chain.libraryGlobal} не загружена.`));
    const sharedScripts = global.__dposScriptLoads || (global.__dposScriptLoads = new Map());
    if (sharedScripts.has(chain.libraryPath)) return sharedScripts.get(chain.libraryPath);
    if (loadingScripts.has(chain.libraryPath)) return loadingScripts.get(chain.libraryPath);
    const documentRef = global.document;
    if (!documentRef || typeof documentRef.createElement !== 'function') {
      return Promise.reject(new Error(`Библиотека ${chain.libraryGlobal} не загружена.`));
    }
    const existing = documentRef.querySelector && documentRef.querySelector(`script[src="${chain.libraryPath}"]`);
    if (existing && existing.dataset && existing.dataset.dposLoaded === 'true') {
      const resolved = Promise.resolve();
      sharedScripts.set(chain.libraryPath, resolved);
      return resolved;
    }
    const promise = new Promise((resolve, reject) => {
      const script = existing || documentRef.createElement('script');
      script.src = chain.libraryPath;
      script.async = true;
      script.onload = () => {
        if (script.dataset) script.dataset.dposLoaded = 'true';
        sharedScripts.set(chain.libraryPath, Promise.resolve());
        resolve();
      };
      script.onerror = () => {
        sharedScripts.delete(chain.libraryPath);
        reject(new Error(`Библиотека ${chain.libraryGlobal} не загружена.`));
      };
      const parent = documentRef.head || documentRef.body || documentRef.documentElement;
      if (!parent || typeof parent.appendChild !== 'function') {
        sharedScripts.delete(chain.libraryPath);
        reject(new Error(`Библиотека ${chain.libraryGlobal} не загружена.`));
        return;
      }
      if (!existing) parent.appendChild(script);
    }).finally(() => loadingScripts.delete(chain.libraryPath));
    loadingScripts.set(chain.libraryPath, promise);
    sharedScripts.set(chain.libraryPath, promise);
    return promise;
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


  function normalizeOperationType(chainId, type) {
    const raw = String(type || 'unknown');
    const lower = raw.toLowerCase();
    if (chainId === 'minter' && ['multisend', 'multisend_coin', 'coin_multisend', 'coin_multisend_data', '13'].includes(lower)) return 'multisend';
    if (chainId === 'decimal' && ['multisend', 'multi_send', '/decimal.coin.v1.msgmultisendcoin', 'msgmultisendcoin'].includes(lower)) return 'multisend';
    return raw;
  }

  function toNotification(chain, account, item) {
    if (!supportsChain(chain) || !item) return null;
    const target = normalizeAccount(account);
    const data = item.data || {};
    const rawType = item.type || 'unknown';
    const type = normalizeOperationType(chain.id, rawType);
    const index = historyIndex(item);
    const timestamp = item.timestamp || '';
    const base = {
      chainId: chain.id,
      chainTitle: chain.title || chain.id,
      account: target,
      sourceIndex: index,
      opType: rawType,
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

    if (type === 'award' || type === 'fixed_award') {
      const from = normalizeAccount(data.initiator);
      const to = normalizeAccount(data.receiver);
      const amount = firstNonEmpty([data.reward_amount, data.shares, data.amount]);
      if (to === target && from !== target) {
        return Object.assign(base, {
          id: notificationId(chain, target, item, type),
          type,
          direction: 'incoming',
          title: type === 'fixed_award' ? 'Новая фиксированная награда VIZ' : 'Новая награда VIZ',
          text: [`от @${from || 'неизвестно'}`, amount].filter(Boolean).join(', '),
          url: historyUrl(chain, target, type)
        });
      }
      return null;
    }

    if (type === 'receive_award' || type === 'benefactor_award') {
      const receiver = normalizeAccount(data.receiver);
      const benefactor = normalizeAccount(data.benefactor);
      if (receiver === target) {
        return Object.assign(base, {
          id: notificationId(chain, target, item, type),
          type,
          direction: 'incoming',
          title: type === 'benefactor_award' ? 'Бенефициарская награда VIZ' : 'Получена награда VIZ',
          text: [benefactor ? `бенефициар @${benefactor}` : '', firstNonEmpty([data.shares, data.reward_amount])].filter(Boolean).join(', '),
          url: historyUrl(chain, target, type)
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

    if (chain.id === 'minter' || chain.id === 'decimal') {
      const from = normalizeAccount(firstNonEmpty([data.from, data.sender, data.address, data.delegator, data.owner, data.account, data.creator, data['sender.address']]));
      const to = normalizeAccount(firstNonEmpty([data.to, data.recipient, data.receiver, data.target, data.validator, data.public_key, data.coin_to_buy, data.delegatee]));
      const listText = JSON.stringify(data.list || data.recipients || data.outputs || data.items || data.messages || data.coins || data['list.address'] || '');
      const amount = firstNonEmpty([data.amount, data.value, data.stake, data.volume, data.sell, data.min_to_receive, data.value_to_sell, data.value_to_buy, data.initial_amount, data.initSupply, data.volume0]);
      const coin = firstNonEmpty([data.coin && data.coin.symbol, data.coin, data.denom, data.symbol, data.ticker, data.amount && data.amount.coin, data.coin_to_sell && data.coin_to_sell.symbol, data.coin_to_buy && data.coin_to_buy.symbol, data.sellCoin && data.sellCoin.symbol, data.buyCoin && data.buyCoin.symbol]);
      const involvesTarget = from === target || to === target || listText.toLowerCase().includes(target) || String(data.hash || data.tx_hash || data.id || '').toLowerCase() === target;
      if (involvesTarget) {
        const incoming = to === target && from !== target;
        return Object.assign(base, {
          id: notificationId(chain, target, item, type),
          type,
          direction: 'incoming',
          title: operationLabel(type),
          text: [incoming && from ? `от ${from}` : (from ? `адрес ${from}` : ''), amount, coin, listText && (type === 'multisend') ? 'список получателей' : ''].filter(Boolean).join(', ') || `${type} #${index}`,
          url: historyUrl(chain, target, type)
        });
      }
      return null;
    }

    if (['author_reward', 'curation_reward', 'comment_benefactor_reward'].includes(type)) {
      const rewardAccount = normalizeAccount(firstNonEmpty([data.author, data.curator, data.benefactor, data.account]));
      if (rewardAccount === target) {
        return Object.assign(base, {
          id: notificationId(chain, target, item, type),
          type,
          direction: 'incoming',
          title: operationLabel(type),
          text: firstNonEmpty([data.payout, data.reward, data.vesting_payout, data.hbd_payout, data.hive_payout, data.steem_payout]) || 'новое reward-событие',
          url: historyUrl(chain, target, type)
        });
      }
      return null;
    }

    if (['transfer_to_vesting', 'withdraw_vesting', 'delegate_vesting_shares', 'return_vesting_delegation', 'account_witness_vote', 'proposal_create', 'proposal_update', 'proposal_delete', 'producer_reward'].includes(type)) {
      const actor = normalizeAccount(firstNonEmpty([data.from, data.account, data.voter, data.creator, data.owner]));
      const to = normalizeAccount(firstNonEmpty([data.to, data.delegatee, data.author, data.receiver, data.account]));
      if (actor === target || to === target) {
        return Object.assign(base, {
          id: notificationId(chain, target, item, type),
          type,
          direction: 'incoming',
          title: operationLabel(type),
          text: `${type} #${index}`,
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
    const settings = getSettings(chain, account);
    const ops = settings.ops || NOTIFICATION_OPS[chain.id] || [];
    await ensureChainLibraryLoaded(chain);
    const historyChain = global.DposProfiles && typeof global.DposProfiles.connect === 'function'
      ? await global.DposProfiles.connect(chain)
      : chain;
    try {
      return await global.DposHistory.fetchAccountHistory(historyChain, account, { limit: limit || DEFAULT_LIMIT, ops });
    } catch (error) {
      return global.DposHistory.fetchAccountHistory(historyChain, account, { limit: limit || DEFAULT_LIMIT });
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
    const errors = [];
    for (const chain of Object.values(chains || {})) {
      if (!supportsChain(chain)) continue;
      const accounts = getTrackedAccounts(chain);
      for (const account of accounts) {
        try {
          const items = await scanAccount(chain, account, options);
          found.push(...items);
        } catch (error) {
          errors.push({ chainId: chain.id, account, error });
        }
      }
    }
    if (errors.length) found.errors = errors;
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
        const failed = Array.isArray(found.errors) ? found.errors.length : 0;
        if (failed) {
          rerender(found.length ? `Найдено новых: ${found.length}. Часть аккаунтов проверить не удалось.` : 'Часть аккаунтов проверить не удалось. Текущая страница продолжает работать.');
          return;
        }
        rerender(found.length ? `Найдено новых: ${found.length}.` : 'Новых событий нет.');
        setStatus(found.length ? `Найдено новых уведомлений: ${found.length}.` : 'Уведомления проверены.', found.length ? 'ok' : 'info');
      } catch (error) {
        rerender(`Не удалось проверить уведомления: ${error.message || error}`);
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
    defaultOps,
    operationLabel,
    getSettings,
    saveSettings,
    countUnread,
    markAllRead,
    scanAccount,
    scanAll,
    renderPanel,
    init
  });
})(window);
