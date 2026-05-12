(function exposeGolosAutoUpvoter(global) {
  'use strict';

  const DEFAULTS = Object.freeze({
    minEnergy: 2500,
    curatorMode: 'repeat',
    curatorCoefficient: 100,
    favoritesPercent: 100,
    autoDonate: false,
    autoDonateCap: '0 1'
  });
  const AUTO_DONATE_FEE_RECIPIENT = 'denis-skripnik';
  const AUTO_DONATE_MIN_TOTAL = 0.5;
  const AUTO_DONATE_AUTHOR_SHARE = 0.998;

  function normalizeList(value) {
    if (Array.isArray(value)) return value.map((item) => String(item || '').trim().replace(/^@/, '')).filter(Boolean);
    return String(value || '').split(/[\s,;]+/).map((item) => item.trim().replace(/^@/, '')).filter(Boolean);
  }

  function clampPercent(value, fallback) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.max(0, Math.min(100, number));
  }

  function normalizeAutoDonatePool(value) {
    if (Array.isArray(value)) value = value.join(' ');
    const parts = String(value || '').trim().split(/[\s,;]+/).filter(Boolean);
    const percent = Number(parts[0]);
    const coeff = parts.length > 1 ? Number(parts[1]) : 1;
    if (!Number.isFinite(percent) || percent <= 0) return '0 1';
    if (!Number.isFinite(coeff) || coeff <= 0) return `${percent} 1`;
    return `${percent} ${coeff}`;
  }

  function parseAutoDonatePool(value) {
    const normalized = normalizeAutoDonatePool(value);
    const parts = normalized.split(' ');
    return { percent: Number(parts[0]) || 0, coeff: Number(parts[1]) || 1, normalized };
  }

  function normalizeAccountSettings(settings) {
    const minEnergy = Number(settings && settings.minEnergy);
    return Object.assign({}, DEFAULTS, settings || {}, {
      account: String(settings && settings.account || '').trim().replace(/^@/, ''),
      enabled: Boolean(settings && settings.enabled),
      curators: normalizeList(settings && settings.curators),
      favorites: normalizeList(settings && settings.favorites),
      minEnergy: Number.isFinite(minEnergy) ? Math.max(0, Math.min(10000, Math.round(minEnergy))) : DEFAULTS.minEnergy,
      curatorMode: settings && settings.curatorMode === 'full' ? 'full' : 'repeat',
      curatorCoefficient: clampPercent(settings && settings.curatorCoefficient, DEFAULTS.curatorCoefficient),
      favoritesPercent: clampPercent(settings && settings.favoritesPercent, DEFAULTS.favoritesPercent),
      autoDonate: Boolean(settings && settings.autoDonate),
      autoDonateCap: normalizeAutoDonatePool(settings && settings.autoDonateCap)
    });
  }

  function autoDonatePoolEnabled(account) {
    if (!account || !account.autoDonate) return false;
    const pool = parseAutoDonatePool(account.autoDonateCap);
    return pool.percent > 0;
  }

  function postKey(event) {
    const author = String(event && event.author || '').trim().replace(/^@/, '');
    const permlink = String(event && event.permlink || '').trim();
    return author && permlink ? `${author}/${permlink}` : '';
  }

  function actionKey(action) {
    return [action.account, action.author, action.permlink].map((item) => String(item || '')).join('|');
  }

  function hasEnoughAccountEnergy(account, event) {
    const energy = event && (event.accountEnergy ?? event.votingPower ?? event.charge);
    const normalized = Number(energy);
    if (!Number.isFinite(normalized)) return true;
    return normalized >= account.minEnergy;
  }

  function planCuratorVote(account, event) {
    const voter = String(event && event.voter || '').trim().replace(/^@/, '');
    if (!account.curators.includes(voter)) return null;
    const key = postKey(event);
    if (!key || !hasEnoughAccountEnergy(account, event)) return null;
    const incomingWeight = Math.abs(Number(event.weight) || 0);
    const weight = account.curatorMode === 'full'
      ? 10000
      : Math.round(incomingWeight * (account.curatorCoefficient / 100));
    if (weight < 1) return null;
    const action = {
      type: 'vote',
      account: account.account,
      source: 'curator',
      matchedBy: voter,
      author: String(event.author || '').trim().replace(/^@/, ''),
      permlink: String(event.permlink || '').trim(),
      weight: Math.max(0, Math.min(10000, weight)),
      eventSource: String(event.source || '')
    };
    if (autoDonatePoolEnabled(account)) {
      action.donate = { enabled: true, pool: account.autoDonateCap };
    }
    return action;
  }

  function planFavoriteVote(account, event) {
    const author = String(event && event.author || '').trim().replace(/^@/, '');
    if (!account.favorites.includes(author)) return null;
    const key = postKey(event);
    if (!key) return null;
    const weight = Math.round(account.favoritesPercent * 100);
    if (!hasEnoughAccountEnergy(account, event) || weight < 1) return null;
    const action = {
      type: 'vote',
      account: account.account,
      source: 'favorite',
      matchedBy: author,
      author,
      permlink: String(event.permlink || '').trim(),
      title: String(event.title || '').trim(),
      activeVotes: normalizeVoteRows(event.activeVotes || event.active_votes),
      weight: Math.max(0, Math.min(10000, weight)),
      eventSource: String(event.source || '')
    };
    if (hasVoteFrom(action.activeVotes, account.account)) return null;
    if (autoDonatePoolEnabled(account)) {
      action.donate = { enabled: true, pool: account.autoDonateCap };
    }
    return action;
  }

  function unpackHistoryRow(row) {
    if (Array.isArray(row)) return { id: row[0], entry: row[1] || {} };
    return { id: row && (row.id ?? row.sequence ?? row.index ?? row[0]), entry: row && (row.op || row.operation ? row : row[1] || row) || {} };
  }

  function unpackOperation(entry) {
    const op = entry && (entry.op || entry.operation || entry[1]);
    if (Array.isArray(op)) return { name: op[0], data: op[1] || {} };
    if (op && typeof op === 'object') return { name: op.type || op.name || op.operation || op.op, data: op.value || op.data || op };
    return { name: '', data: {} };
  }

  function historyRowToCuratorVoteEvent(row) {
    const unpacked = unpackHistoryRow(row);
    const operation = unpackOperation(unpacked.entry);
    if (operation.name !== 'vote') return null;
    const vote = operation.data || {};
    const voter = String(vote.voter || '').trim().replace(/^@/, '');
    const author = String(vote.author || '').trim().replace(/^@/, '');
    const permlink = String(vote.permlink || '').trim();
    const weight = Number(vote.weight);
    if (!voter || !author || !permlink || !Number.isFinite(weight) || weight <= 0) return null;
    return {
      kind: 'curator_vote',
      voter,
      author,
      permlink,
      weight,
      timestamp: unpacked.entry && (unpacked.entry.timestamp || unpacked.entry.time || unpacked.entry.created) || '',
      source: `history:${unpacked.id ?? `${voter}/${author}/${permlink}/${weight}`}`
    };
  }

  function normalizeVoteRows(value) {
    return Array.isArray(value) ? value : [];
  }

  function hasVoteFrom(votes, account) {
    const wanted = String(account || '').trim().replace(/^@/, '');
    if (!wanted) return false;
    return normalizeVoteRows(votes).some((vote) => String(vote && vote.voter || vote && vote.account || '').trim().replace(/^@/, '') === wanted && Number(vote && (vote.percent ?? vote.weight ?? vote.rshares ?? 1)) !== 0);
  }

  function discussionRowToFavoritePostEvent(row, favorite) {
    const post = row && (row.comment || row.post || row) || {};
    const author = String(post.author || post.root_author || favorite || '').trim().replace(/^@/, '');
    const permlink = String(post.permlink || post.root_permlink || '').trim();
    if (!author || !permlink) return null;
    return {
      kind: 'favorite_post',
      author,
      permlink,
      title: String(post.title || '').trim(),
      activeVotes: normalizeVoteRows(post.active_votes || post.activeVotes),
      timestamp: post.created || post.last_update || post.cashout_time || '',
      source: `favorite:${author}/${permlink}`
    };
  }

  function uniqueEnabledSources(accountSettings, field) {
    const result = new Set();
    (Array.isArray(accountSettings) ? accountSettings : []).map(normalizeAccountSettings).forEach((account) => {
      if (!account.enabled || !account.account) return;
      (account[field] || []).forEach((item) => result.add(item));
    });
    return Array.from(result).filter(Boolean);
  }

  async function collectEventsFromAdapter(adapter, accountSettings, options) {
    if (!adapter || typeof adapter !== 'object') throw new Error('Auto-upvoter RPC adapter is unavailable.');
    const settings = Object.assign({ historyLimit: 30, favoriteLimit: 20 }, options || {});
    const events = [];
    const curators = uniqueEnabledSources(accountSettings, 'curators');
    const favorites = uniqueEnabledSources(accountSettings, 'favorites');
    if (curators.length && typeof adapter.getAccountHistory !== 'function') {
      throw new Error('Golos account-history RPC method is unavailable; curator scanner cannot run.');
    }
    if (favorites.length && typeof adapter.getFavoritePosts !== 'function') {
      throw new Error('Golos discussion/blog RPC method is unavailable; favorite-post scanner cannot run.');
    }
    for (const curator of curators) {
      const rows = await adapter.getAccountHistory(curator, settings.historyLimit);
      (Array.isArray(rows) ? rows : []).forEach((row) => {
        const event = historyRowToCuratorVoteEvent(row);
        if (event) events.push(event);
      });
    }
    for (const favorite of favorites) {
      const rows = await adapter.getFavoritePosts(favorite, settings.favoriteLimit);
      (Array.isArray(rows) ? rows : []).forEach((row) => {
        const event = discussionRowToFavoritePostEvent(row, favorite);
        if (event) events.push(event);
      });
    }
    return events;
  }

  function planActionsForEvents(accountSettings, events, state) {
    const seen = state && state.seen instanceof Set ? state.seen : new Set(state && state.seen || []);
    const accounts = (Array.isArray(accountSettings) ? accountSettings : []).map(normalizeAccountSettings).filter((account) => account.enabled && account.account);
    const rows = [];
    (Array.isArray(events) ? events : []).forEach((event) => {
      accounts.forEach((account) => {
        let action = null;
        if (event && event.kind === 'curator_vote') action = planCuratorVote(account, event);
        if (event && event.kind === 'favorite_post') action = planFavoriteVote(account, event);
        if (action && !seen.has(actionKey(action))) rows.push(action);
      });
    });
    return dedupePlannedActions(rows, seen);
  }

  function dedupePlannedActions(actions, seen) {
    const nextSeen = seen instanceof Set ? seen : new Set(seen || []);
    const result = [];
    (Array.isArray(actions) ? actions : []).forEach((action) => {
      if (!action || !action.account || !action.author || !action.permlink) return;
      const key = actionKey(action);
      if (nextSeen.has(key)) return;
      nextSeen.add(key);
      result.push(action);
    });
    return result;
  }

  function runnerLockKey(chain, account) {
    const chainId = String(chain && chain.id || 'golos');
    return `dpos.space:${chainId}:auto-upvoter:runner:${String(account || '').trim().replace(/^@/, '')}`;
  }

  function readRunnerLock(storage, key) {
    if (!storage || typeof storage.getItem !== 'function') return null;
    try {
      const raw = storage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (_error) {
      return null;
    }
  }

  function claimRunnerLocks(chain, accounts, owner, storage, now, ttlMs) {
    const locker = storage || global.localStorage;
    const lockOwner = String(owner || '').trim() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const currentTime = Number(now || Date.now());
    const ttl = Number(ttlMs || 90000);
    const claimed = [];
    (Array.isArray(accounts) ? accounts : []).forEach((account) => {
      const clean = String(account || '').trim().replace(/^@/, '');
      if (!clean) return;
      const key = runnerLockKey(chain, clean);
      const lock = readRunnerLock(locker, key);
      if (lock && lock.owner && lock.owner !== lockOwner && Number(lock.expiresAt || 0) > currentTime) {
        throw new Error(`Auto-upvoter for @${clean} is already running in another tab/window.`);
      }
      claimed.push({ account: clean, key });
    });
    claimed.forEach((entry) => locker && locker.setItem && locker.setItem(entry.key, JSON.stringify({ owner: lockOwner, account: entry.account, expiresAt: currentTime + ttl })));
    return { owner: lockOwner, accounts: claimed.map((entry) => entry.account), expiresAt: currentTime + ttl };
  }

  function releaseRunnerLocks(chain, accounts, owner, storage) {
    const locker = storage || global.localStorage;
    if (!locker || typeof locker.getItem !== 'function' || typeof locker.removeItem !== 'function') return;
    (Array.isArray(accounts) ? accounts : []).forEach((account) => {
      const key = runnerLockKey(chain, account);
      const lock = readRunnerLock(locker, key);
      if (!lock || !lock.owner || lock.owner === owner) locker.removeItem(key);
    });
  }

  function upsertRunnerState(existing, accountSettings) {
    const previous = existing && typeof existing === 'object' ? existing : {};
    const next = {};
    (Array.isArray(accountSettings) ? accountSettings : []).map(normalizeAccountSettings).forEach((account) => {
      if (!account.enabled || !account.account || next[account.account]) return;
      next[account.account] = Object.assign({}, previous[account.account] || {}, {
        account: account.account,
        enabled: true,
        status: previous[account.account] && previous[account.account].status || 'idle',
        lastScanAt: previous[account.account] && previous[account.account].lastScanAt || null,
        seen: previous[account.account] && previous[account.account].seen instanceof Set ? previous[account.account].seen : new Set()
      });
    });
    return next;
  }

  function assertBroadcastAvailable(chain) {
    const client = global[chain && chain.libraryGlobal];
    if (!client) throw new Error(`Golos library ${chain && chain.libraryGlobal || 'golos'} is not loaded.`);
    if (!client.broadcast) throw new Error('Golos broadcast API is unavailable in this browser library.');
    if (typeof client.broadcast.vote !== 'function' && typeof client.broadcast.voteAsync !== 'function') {
      throw new Error('Golos broadcast.vote method is unavailable; automatic voting cannot start.');
    }
    if (typeof client.broadcast.donate !== 'function' && typeof client.broadcast.donateAsync !== 'function') {
      return { canVote: true, canDonate: false, warning: 'broadcast.donate is unavailable; auto-donate actions will be skipped.' };
    }
    return { canVote: true, canDonate: true, warning: '' };
  }

  function formatGolosAmount(value) {
    return `${(Math.round(Number(value) * 1000) / 1000).toFixed(3)} GOLOS`;
  }

  function parseGolosAsset(value) {
    return Number(String(value || '').split(' ')[0]) || 0;
  }

  function calculateDonateFromEmission(poolValue, account, props, weight) {
    const pool = parseAutoDonatePool(poolValue);
    if (!pool.percent) return 0;
    const userBalance = parseGolosAsset(account && account.vesting_shares)
      - parseGolosAsset(account && account.emission_delegated_vesting_shares)
      + parseGolosAsset(account && account.emission_received_vesting_shares);
    const totalVesting = parseGolosAsset(props && props.total_vesting_shares);
    if (!totalVesting) return 0;
    const emissionPerDay = (parseGolosAsset(props && props.accumulative_emission_per_day) * userBalance) / totalVesting;
    const partFromEmission = emissionPerDay * (pool.percent / 100);
    const normalizedPercent = Math.max(0, Math.min(1, (Number(weight) || 0) / 10000));
    const amount = partFromEmission * Math.pow(normalizedPercent, pool.coeff);
    return Number.isFinite(amount) ? amount : 0;
  }

  function enrichActionDonateFromEmission(action, account, props) {
    if (!action || !action.donate || !action.donate.enabled) return action;
    const donateAmount = calculateDonateFromEmission(action.donate.pool || action.donate.cap, account, props, action.weight);
    const tipBalance = parseGolosAsset(account && account.tip_balance);
    const next = Object.assign({}, action, { donate: Object.assign({}, action.donate, { calculated: donateAmount }) });
    if (donateAmount <= tipBalance && donateAmount >= AUTO_DONATE_MIN_TOTAL) {
      next.donate.amount = donateAmount;
    }
    return next;
  }

  function buildDonateMemo(type, action) {
    return JSON.stringify({
      app: 'dpos.space/auto-upvoter',
      type,
      author: String(action && action.author || '').trim().replace(/^@/, ''),
      permlink: String(action && action.permlink || '').trim()
    });
  }

  function buildDonateOperations(action) {
    if (!action || !action.donate || !action.donate.enabled) return [];
    const total = Math.round((Number(action.donate.amount ?? action.donate.cap) || 0) * 1000) / 1000;
    if (!Number.isFinite(total) || total <= 0) return [];
    if (total < AUTO_DONATE_MIN_TOTAL) return [];
    const from = String(action.account || '').trim().replace(/^@/, '');
    const author = String(action.author || '').trim().replace(/^@/, '');
    const permlink = String(action.permlink || '').trim();
    if (!from || !author || !permlink) throw new Error('Auto-donate requires voter account, post author, and permlink. Vote was not sent.');
    const authorAmount = Math.round(total * AUTO_DONATE_AUTHOR_SHARE * 1000) / 1000;
    const feeAmount = Math.round((total - authorAmount) * 1000) / 1000;
    if (authorAmount <= 0 || feeAmount <= 0) throw new Error('Auto-donate split produced a zero amount. Vote was not sent.');
    return [
      {
        operationName: 'donate',
        params: [from, author, formatGolosAmount(authorAmount), buildDonateMemo('post_donate', action), []]
      },
      {
        operationName: 'donate',
        params: [from, AUTO_DONATE_FEE_RECIPIENT, formatGolosAmount(feeAmount), buildDonateMemo('fee_donate', action), []]
      }
    ];
  }

  function findAuthorizedUser(chain, account) {
    if (!global.DposAuth || typeof global.DposAuth.getUsers !== 'function') return null;
    const wanted = String(account || '').trim().replace(/^@/, '');
    return (global.DposAuth.getUsers(chain) || []).find((user) => {
      const login = typeof global.DposAuth.getUserLogin === 'function' ? global.DposAuth.getUserLogin(user) : user && user.login;
      return String(login || '').trim().replace(/^@/, '') === wanted;
    }) || null;
  }

  async function broadcastPlannedAction(chain, action, options) {
    if (!global.DposBroadcast) throw new Error('DposBroadcast helper is unavailable.');
    const broadcastStatus = assertBroadcastAvailable(chain);
    if (!action || action.type !== 'vote') throw new Error('Only planned vote actions are supported in the first auto-upvoter MVP.');
    const user = findAuthorizedUser(chain, action.account);
    if (!user) throw new Error(`Authorized account @${action.account} was not found in local Golos auth storage.`);
    if (typeof global.DposBroadcast.prepareForUser !== 'function') {
      throw new Error('DposBroadcast.prepareForUser is unavailable; automatic per-account signing cannot start safely.');
    }
    const broadcastOptions = Object.assign({ confirmExecute: false, autoConsent: 'golos-auto-upvoter-start' }, options || {});
    broadcastOptions.confirmExecute = false;
    const donationOperations = buildDonateOperations(action);
    const prepared = global.DposBroadcast.prepareForUser(chain, user, 'posting', 'vote', [
      action.account,
      action.author,
      action.permlink,
      action.weight
    ], { feature: 'golos-auto-upvoter', source: action.source });
    const result = await global.DposBroadcast.broadcast(chain, prepared, broadcastOptions);
    const donations = [];
    const donateSkipped = [];
    if (donationOperations.length && !broadcastStatus.canDonate) {
      donateSkipped.push({ reason: 'donate_unavailable', error: broadcastStatus.warning || 'broadcast.donate is unavailable' });
      return { vote: result, donations, donateSkipped };
    }
    for (const operation of donationOperations) {
      try {
        const donatePrepared = global.DposBroadcast.prepareForUser(chain, user, 'posting', operation.operationName, operation.params, {
          feature: 'golos-auto-upvoter',
          source: action.source,
          autoDonate: true
        });
        donations.push(await global.DposBroadcast.broadcast(chain, donatePrepared, broadcastOptions));
      } catch (error) {
        donateSkipped.push({
          reason: 'donate_failed',
          operation,
          error: error && error.message ? error.message : String(error)
        });
        break;
      }
    }
    return donationOperations.length ? { vote: result, donations, donateSkipped } : result;
  }

  async function executePlannedActions(chain, actions, state, options) {
    const settings = Object.assign({ broadcaster: broadcastPlannedAction, feed: null }, options || {});
    const results = [];
    const feed = Array.isArray(settings.feed) ? settings.feed : null;
    for (const action of (Array.isArray(actions) ? actions : [])) {
      try {
        const result = await settings.broadcaster(chain, action, settings.broadcastOptions || {});
        const row = { ok: true, action, result };
        results.push(row);
        if (feed) {
          if (result && result.skipped) continue;
          feed.push({ type: 'success', message: `OK @${action.account} voted @${action.author}/${action.permlink}`, action, result });
        }
      } catch (error) {
        const row = { ok: false, action, error };
        results.push(row);
        if (feed) feed.push({ type: 'error', message: `ERROR @${action.account} @${action.author}/${action.permlink}: ${error && error.message ? error.message : error}`, action, error });
      }
    }
    if (state && typeof state === 'object') state.lastResults = results;
    return results;
  }

  function markActionsSeen(state, actions) {
    if (!state || typeof state !== 'object') return;
    if (!(state.seen instanceof Set)) state.seen = new Set(state.seen || []);
    (Array.isArray(actions) ? actions : []).forEach((action) => state.seen.add(actionKey(action)));
  }

  async function runScannerTick(chain, accountSettings, adapter, state, options) {
    const tickState = state && typeof state === 'object' ? state : {};
    if (!(tickState.seen instanceof Set)) tickState.seen = new Set(tickState.seen || []);
    const events = await collectEventsFromAdapter(adapter, accountSettings, options);
    const actions = planActionsForEvents(accountSettings, events, tickState);
    markActionsSeen(tickState, actions);
    const results = await executePlannedActions(chain, actions, tickState, options);
    tickState.lastScanAt = new Date().toISOString();
    return { events, actions, results, state: tickState };
  }

  global.DposGolosAutoUpvoter = Object.freeze({
    assertBroadcastAvailable,
    buildDonateOperations,
    broadcastPlannedAction,
    calculateDonateFromEmission,
    claimRunnerLocks,
    collectEventsFromAdapter,
    dedupePlannedActions,
    discussionRowToFavoritePostEvent,
    executePlannedActions,
    enrichActionDonateFromEmission,
    findAuthorizedUser,
    hasVoteFrom,
    historyRowToCuratorVoteEvent,
    normalizeAccountSettings,
    planActionsForEvents,
    releaseRunnerLocks,
    runScannerTick,
    upsertRunnerState
  });

  if (typeof module !== 'undefined' && module.exports) module.exports = global.DposGolosAutoUpvoter;
})(typeof window !== 'undefined' ? window : globalThis);
