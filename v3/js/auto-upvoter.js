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

  function cancellationRequested(options) {
    return Boolean(options && typeof options.isCancelled === 'function' && options.isCancelled());
  }

  function createCancellationController() {
    let generation = 0;
    return Object.freeze({
      snapshot() { return generation; },
      cancel() { generation += 1; return generation; },
      isCancelled(snapshot) { return snapshot !== generation; }
    });
  }

  function createNonOverlappingRunner(run) {
    let active = false;
    return async function runSingleFlight(...args) {
      if (active) return null;
      active = true;
      try {
        return await run(...args);
      } finally {
        active = false;
      }
    };
  }

  function normalizeList(value) {
    if (Array.isArray(value)) return value.map((item) => String(item || '').trim().replace(/^@/, '')).filter(Boolean);
    return String(value || '').split(/[\s,;]+/).map((item) => item.trim().replace(/^@/, '')).filter(Boolean);
  }

  function clampPercent(value, fallback) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.max(0, Math.min(100, number));
  }

  function normalizeEnergyThreshold(value, fallback) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    const normalized = number > 0 && number <= 100 ? number * 100 : number;
    return Math.max(0, Math.min(10000, Math.round(normalized)));
  }

  function estimateVoteEnergyAfter(currentEnergy, weight) {
    const energy = Number(currentEnergy);
    const voteWeight = Math.abs(Number(weight) || 0);
    if (!Number.isFinite(energy)) return null;
    const clampedEnergy = Math.max(0, Math.min(10000, energy));
    const clampedWeight = Math.max(0, Math.min(10000, voteWeight));
    const usedEnergy = Math.ceil((clampedEnergy * clampedWeight / 10000) / 50);
    return Math.max(0, Math.min(10000, Math.round(clampedEnergy - usedEnergy)));
  }

  function basisPointEnergy(raw) {
    if (raw === undefined || raw === null || typeof raw === 'boolean' || (typeof raw === 'string' && !raw.trim())) return null;
    const value = Number(raw);
    return Number.isFinite(value) ? Math.max(0, Math.min(10000, value)) : null;
  }

  function currentAccountEnergy(account, options) {
    const raw = account && (account.voting_power ?? account.votingPower ?? account.energy ?? account.charge);
    const value = basisPointEnergy(raw);
    if (value === null) return null;
    // These Graphene RPC fields are basis points, even when the battery is
    // almost empty. Display/input percentages belong at the UI boundary.
    const base = Math.max(0, Math.min(10000, value));
    const lastVoteTime = Date.parse(account && (account.last_vote_time || account.last_vote || account.last_vote_time_string || ''));
    if (!Number.isFinite(lastVoteTime)) return Math.max(0, Math.min(10000, Math.round(base)));
    const opts = options || {};
    const now = Number.isFinite(Number(opts.now)) ? Number(opts.now) : Date.now();
    const regenSeconds = Number(opts.regenSeconds) || 432000;
    const regenerated = base + Math.max(0, (now - lastVoteTime) / 1000) * (10000 / regenSeconds);
    return Math.max(0, Math.min(10000, Math.round(regenerated)));
  }

  function withCurrentAccountEnergy(settings, accountRecord) {
    const currentEnergy = currentAccountEnergy(accountRecord);
    return Object.assign({}, settings, { currentEnergy });
  }

  async function enrichSettingsWithCurrentEnergy(accountSettings, adapter, options) {
    const normalized = (Array.isArray(accountSettings) ? accountSettings : []).map(normalizeAccountSettings);
    if (!adapter || typeof adapter.getAccount !== 'function') return normalized.map((account) => Object.assign({}, account, { currentEnergy: null }));
    const enriched = [];
    for (const account of normalized) {
      if (cancellationRequested(options)) break;
      if (!account.enabled || !account.account) {
        enriched.push(account);
        continue;
      }
      try {
        const accountRecord = await adapter.getAccount(account.account);
        if (cancellationRequested(options)) break;
        enriched.push(withCurrentAccountEnergy(account, accountRecord));
      } catch (error) {
        enriched.push(Object.assign({}, account, { currentEnergy: null }));
      }
    }
    return enriched;
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
    return Object.assign({}, DEFAULTS, settings || {}, {
      account: String(settings && settings.account || '').trim().replace(/^@/, ''),
      enabled: Boolean(settings && settings.enabled),
      curators: normalizeList(settings && settings.curators),
      favorites: normalizeList(settings && settings.favorites),
      minEnergy: normalizeEnergyThreshold(settings && settings.minEnergy, DEFAULTS.minEnergy),
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

  function hasEnoughAccountEnergy(account, event, weight) {
    const energy = account && Object.prototype.hasOwnProperty.call(account, 'currentEnergy')
      ? account.currentEnergy
      : event && (event.accountEnergy ?? event.votingPower ?? event.charge);
    const normalized = basisPointEnergy(energy);
    if (normalized === null) return false;
    const projected = Number.isFinite(Number(weight)) ? estimateVoteEnergyAfter(normalized, weight) : normalized;
    return normalized >= account.minEnergy && (!Number.isFinite(Number(projected)) || projected >= account.minEnergy);
  }

  function planCuratorVote(account, event) {
    const voter = String(event && event.voter || '').trim().replace(/^@/, '');
    if (!account.curators.includes(voter)) return null;
    const key = postKey(event);
    if (!key) return null;
    const incomingWeight = Math.abs(Number(event.weight) || 0);
    const weight = account.curatorMode === 'full'
      ? 10000
      : Math.round(incomingWeight * (account.curatorCoefficient / 100));
    if (weight < 1 || !hasEnoughAccountEnergy(account, event, weight)) return null;
    const action = {
      type: 'vote',
      account: account.account,
      source: 'curator',
      matchedBy: voter,
      author: String(event.author || '').trim().replace(/^@/, ''),
      permlink: String(event.permlink || '').trim(),
      weight: Math.max(0, Math.min(10000, weight)),
      minEnergy: account.minEnergy,
      currentEnergy: Number.isFinite(Number(account.currentEnergy)) ? Number(account.currentEnergy) : null,
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
    if (weight < 1 || !hasEnoughAccountEnergy(account, event, weight)) return null;
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
      minEnergy: account.minEnergy,
      currentEnergy: Number.isFinite(Number(account.currentEnergy)) ? Number(account.currentEnergy) : null,
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
      if (cancellationRequested(options)) break;
      const rows = await adapter.getAccountHistory(curator, settings.historyLimit);
      if (cancellationRequested(options)) break;
      (Array.isArray(rows) ? rows : []).forEach((row) => {
        const event = historyRowToCuratorVoteEvent(row);
        if (event) events.push(event);
      });
    }
    for (const favorite of favorites) {
      if (cancellationRequested(options)) break;
      const rows = await adapter.getFavoritePosts(favorite, settings.favoriteLimit);
      if (cancellationRequested(options)) break;
      (Array.isArray(rows) ? rows : []).forEach((row) => {
        const event = discussionRowToFavoritePostEvent(row, favorite);
        if (event) events.push(event);
      });
    }
    return events;
  }

  function planActionsForEvents(accountSettings, events, state) {
    const seen = state && state.seen instanceof Set ? state.seen : new Set(state && state.seen || []);
    const accounts = (Array.isArray(accountSettings) ? accountSettings : []).map(normalizeAccountSettings).map((account) =>
      state && state.chainId && state.chainId !== 'golos' ? Object.assign({}, account, { autoDonate: false, autoDonateCap: '0 1' }) : account
    ).filter((account) => account.enabled && account.account);
    const energyBudget = new Map();
    accounts.forEach((account) => {
      const current = basisPointEnergy(account.currentEnergy);
      if (current !== null) energyBudget.set(account.account, current);
    });
    const rows = [];
    (Array.isArray(events) ? events : []).forEach((event) => {
      accounts.forEach((account) => {
        if (event && event.onlyAccount && event.onlyAccount !== account.account) return;
        let action = null;
        const budget = energyBudget.get(account.account);
        const planningAccount = Number.isFinite(budget) ? Object.assign({}, account, { currentEnergy: budget }) : account;
        if (event && event.kind === 'curator_vote') action = planCuratorVote(planningAccount, event);
        if (event && event.kind === 'favorite_post') action = planFavoriteVote(planningAccount, event);
        if (!action || seen.has(actionKey(action))) return;
        if (Number.isFinite(budget)) {
          const projected = estimateVoteEnergyAfter(budget, action.weight);
          if (Number.isFinite(Number(projected))) {
            if (projected < account.minEnergy) return;
            energyBudget.set(account.account, projected);
            action.currentEnergy = budget;
            action.projectedEnergy = projected;
          }
        }
        rows.push(action);
      });
    });
    return dedupePlannedActions(rows, seen);
  }

  function dedupePlannedActions(actions, seen) {
    const nextSeen = new Set(seen || []);
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
    return { app: 'dpos.space', version: 1, target: {
      type,
      author: String(action && action.author || '').trim().replace(/^@/, ''),
      permlink: String(action && action.permlink || '').trim()
    } };
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
    try { return await sendPlannedAction(chain,action,options); }
    catch (error) {
      const scope = options && options.continuityScope;
      const target = action && `${action.account}/${action.author}/${action.permlink}`;
      if (chain && chain.id === 'golos' && scope && global.DposAutomationContinuity && !global.DposAutomationContinuity.pending(scope,target)) error.automationUnsent = true;
      throw error;
    }
  }

  async function sendPlannedAction(chain, action, options) {
    if (cancellationRequested(options)) return { cancelled: true };
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
    const donationOperations = chain && chain.id === 'golos' ? buildDonateOperations(action) : [];
    if (cancellationRequested(options)) return { cancelled: true };
    const prepared = global.DposBroadcast.prepareForUser(chain, user, 'posting', 'vote', [
      action.account,
      action.author,
      action.permlink,
      action.weight
    ], { feature: 'golos-auto-upvoter', source: action.source });
    if (cancellationRequested(options)) return { cancelled: true };
    broadcastOptions.continuityTarget = `${action.account}/${action.author}/${action.permlink}`;
    const result = await global.DposBroadcast.broadcast(chain, prepared, broadcastOptions);
    if (result && result.skipped) return result;
    if (cancellationRequested(options)) return { cancelled: true, vote: result };
    const donations = [];
    const donateSkipped = [];
    if (donationOperations.length && !broadcastStatus.canDonate) {
      donateSkipped.push({ reason: 'donate_unavailable', error: broadcastStatus.warning || 'broadcast.donate is unavailable' });
      return { vote: result, donations, donateSkipped };
    }
    for (const operation of donationOperations) {
      if (cancellationRequested(options)) return { cancelled: true, vote: result, donations, donateSkipped };
      try {
        const donatePrepared = global.DposBroadcast.prepareForUser(chain, user, 'posting', operation.operationName, operation.params, {
          feature: 'golos-auto-upvoter',
          source: action.source,
          autoDonate: true
        });
        if (cancellationRequested(options)) return { cancelled: true, vote: result, donations, donateSkipped };
        donations.push(await global.DposBroadcast.broadcast(chain, donatePrepared, broadcastOptions));
        if (cancellationRequested(options)) return { cancelled: true, vote: result, donations, donateSkipped };
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
      if (cancellationRequested(settings)) break;
      markActionsSeen(state,[action]);
      try {
        const broadcasterOptions = Object.assign({}, settings.broadcastOptions || {}, { isCancelled: settings.isCancelled });
        const result = await settings.broadcaster(chain, action, broadcasterOptions);
        // This skip happens before signing/broadcast. Do not retain the provisional
        // seen reservation when the fresh content proof is unavailable.
        if (result && result.skipped && ['root-post-unknown','eligibility-unknown','battery-unavailable','low-battery'].includes(result.reason) && state && state.seen instanceof Set) {
          state.seen.delete(actionKey(action));
        }
        if (result && result.cancelled && !result.vote && state && state.seen instanceof Set) state.seen.delete(actionKey(action));
        const row = { ok: true, action, result };
        results.push(row);
        if (feed) {
          if (result && (result.skipped || result.cancelled)) continue;
          feed.push({ type: 'success', message: `OK @${action.account} voted @${action.author}/${action.permlink}`, action, result });
        }
        if (typeof settings.onResult === 'function') settings.onResult(row);
        if (result && result.cancelled) break;
        if (cancellationRequested(settings)) break;
      } catch (error) {
        if (error.automationUnsent && state && state.seen instanceof Set) state.seen.delete(actionKey(action));
        const row = { ok: false, action, error };
        results.push(row);
        if (feed) feed.push({ type: 'error', message: `ERROR @${action.account} @${action.author}/${action.permlink}: ${error && error.message ? error.message : error}`, action, error });
        if (typeof settings.onResult === 'function') settings.onResult(row);
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

  function boundedSourceRead(fn, timeout) {
    let timer;
    return Promise.race([Promise.resolve().then(fn),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Source read timed out')),timeout || 4000);})]).finally(()=>clearTimeout(timer));
  }
  function golosChainTime(properties) {
    const value = properties && properties.time;
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(value)) return NaN;
    const ms = Date.parse(value+'Z');
    return Number.isFinite(ms) && new Date(ms).toISOString().slice(0,19) === value ? ms : NaN;
  }
  function voteEligibilitySkipReason(content, target, now) {
    const root = rootPostSkipReason(content,target); if (root) return root;
    const utc = value => {
      if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(value)) return NaN;
      const ms = Date.parse(value+'Z');
      return Number.isFinite(ms) && new Date(ms).toISOString().slice(0,19) === value ? ms : NaN;
    };
    if (content.allow_votes === false) return 'votes-disabled';
    if (content.allow_votes !== true) return 'eligibility-unknown';
    const payout = utc(content.last_payout), cashout = utc(content.cashout_time);
    if (!Number.isFinite(payout) || !Number.isFinite(cashout)) return 'eligibility-unknown';
    if (payout !== 0) return 'paid-out';
    if (now !== undefined && !Number.isSafeInteger(now)) return 'eligibility-unknown';
    if (cashout <= (now === undefined ? Date.now() : now)+60000) return 'cashout-lockout';
    if (target.source === 'favorite' || target.kind === 'favorite_post') {
      const created = utc(content.created), updated = utc(content.last_update);
      if (!Number.isFinite(created) || !Number.isFinite(updated) || !Number.isSafeInteger(content.num_changes) || content.num_changes < 0) return 'eligibility-unknown';
      if (content.num_changes !== 0 || created !== updated) return 'favorite-edited';
    }
    return null;
  }

  function rootPostSkipReason(content, target) {
    if (!content || !target || typeof content.author !== 'string' || content.author !== target.author
      || typeof content.permlink !== 'string' || content.permlink !== target.permlink
      || typeof content.parent_author !== 'string') return 'root-post-unknown';
    return content.parent_author === '' ? null : 'not-root-post';
  }

  function isRootPost(content, target) {
    return rootPostSkipReason(content, target) === null;
  }

  async function filterRootPostEvents(adapter, events, options) {
    if (!adapter || typeof adapter.getContent !== 'function') return [];
    const checked = new Map();
    const result = [];
    for (const event of events) {
      if (cancellationRequested(options)) break;
      const key = postKey(event);
      if (!checked.has(key)) {
        const content = await adapter.getContent(event.author, event.permlink).catch(() => null);
        checked.set(key, isRootPost(content, event));
      }
      if (cancellationRequested(options)) break;
      if (checked.get(key)) result.push(event);
    }
    return result;
  }

  const BACKLOG_PREFIX = 'dpos_golos_event_backlog_v1_';
  function readBacklog(binding) {
    if (!/^[a-f0-9]{64}$/.test(binding || '')) throw new Error('Invalid Golos source scope');
    const text = global.localStorage.getItem(BACKLOG_PREFIX+binding);
    const data = text ? JSON.parse(text) : {version:1,sources:{},inbox:{},sourceCursor:0,eventCursor:0};
    if (!data || data.version !== 1 || !data.sources || Array.isArray(data.sources) || !data.inbox || Array.isArray(data.inbox) || !Number.isSafeInteger(data.sourceCursor) || !Number.isSafeInteger(data.eventCursor)) throw new Error('Golos backlog storage corrupt');
    for (const source of Object.values(data.sources)) {
      if (!source || !Number.isSafeInteger(source.high) || source.high < -1 || !Number.isSafeInteger(source.from) || source.from < -1 || !Number.isSafeInteger(source.headFrom) || source.headFrom < -1 || !Number.isSafeInteger(source.headStop) || source.headStop < -1 || !Number.isSafeInteger(source.headTop) || source.headTop < -1) throw new Error('Golos source progress corrupt');
    }
    for (const entry of Object.values(data.inbox)) if (!entry || typeof entry.source !== 'string' || !entry.event || typeof entry.event.onlyAccount !== 'string') throw new Error('Golos inbox corrupt');
    return data;
  }
  function writeBacklog(binding, data) {
    if (global.DposAutomationContinuity) global.DposAutomationContinuity.assertExclusive('upvoter:golos');
    const text = JSON.stringify(data), key = BACKLOG_PREFIX+binding;
    try { global.localStorage.setItem(key,text); if (global.localStorage.getItem(key) !== text) throw new Error('readback'); }
    catch (_) { if (global.DposVault) global.DposVault.lock(); throw new Error('Golos inbox storage unavailable; signing stopped'); }
  }
  function favoriteHistoryEvent(row, account) {
    const unpacked = unpackHistoryRow(row), op = unpackOperation(unpacked.entry);
    if (op.name !== 'comment' || op.data.author !== account || op.data.parent_author !== '') return null;
    return discussionRowToFavoritePostEvent(op.data,account);
  }
  async function collectDurableGolosEvents(adapter, accountSettings, options) {
    if (typeof adapter.assertSource === 'function') adapter.assertSource();
    const binding = adapter.sourceBinding, data = readBacklog(binding);
    const accounts = accountSettings.map(normalizeAccountSettings).filter(a=>a.enabled && a.account);
    const active = new Map();
    for (const kind of ['curator','favorite']) for (const account of accounts) for (const name of account[kind === 'curator' ? 'curators' : 'favorites']) {
      const id = kind+':'+name;
      if (!active.has(id)) active.set(id,{kind,name,accounts:[]});
      active.get(id).accounts.push(account.account);
    }
    for (const [id,source] of Object.entries(data.sources)) source.active=active.has(id);
    for (const id of active.keys()) {
      if (!data.sources[id]) {
        if (Object.keys(data.sources).length >= 100) {
          if (options && Array.isArray(options.feed)) options.feed.push({type:'info',message:`Golos source ${id}: source capacity reached; no unsafe eviction`});
          continue;
        }
        data.sources[id]={high:-1,from:-1,headFrom:-1,headStop:-1,headTop:-1,active:true};
      }
      const members = active.get(id).accounts.slice().sort().join(',');
      if (data.sources[id].members !== members) Object.assign(data.sources[id],{high:-1,from:-1,headFrom:-1,headStop:-1,headTop:-1,members});
    }
    const ids = Array.from(active.keys()).filter(id=>data.sources[id]);
    const offset = ids.length ? data.sourceCursor%ids.length : 0;
    const selected = Array.from({length:Math.min(8,ids.length)},(_,i)=>ids[(offset+i)%ids.length]);
    // Independent, bounded reads. Timed-out promises never mutate persistent state.
    const requests = selected.flatMap(id => [{id,role:'head',from:data.sources[id].headFrom ?? -1},...(data.sources[id].from > 0 ? [{id,role:'older',from:data.sources[id].from}] : [])]);
    const pages = await Promise.all(requests.map(async request => {
      const {id,from} = request;
      try { return {...request,rows:await boundedSourceRead(()=>adapter.getAccountHistory(active.get(id).name,from === -1 ? 30 : Math.max(1,Math.min(30,from)),from),options && options.sourceTimeoutMs)}; }
      catch (_) { return {...request,error:'source-unavailable'}; }
    }));
    if (cancellationRequested(options)) return [];
    for (const id of selected) data.sources[id].warning='';
    for (const {id,role,from,rows,error} of pages) {
      const source = data.sources[id];
      if (error || !Array.isArray(rows)) { source.warning=error || 'malformed-page';continue; }
      if (!rows.length) {
        // Empty older page is a retained-history boundary, not a transport failure.
        if (role === 'older') {source.boundary=from;source.from=-1;source.warning='retention-boundary';}
        else source.warning=from === -1 ? 'empty-head' : 'history-gap';
        continue;
      }
      if (!rows.every(r=>Array.isArray(r) && r.length === 2 && Number.isSafeInteger(r[0]) && r[0]>=0 && r[1] && Array.isArray(r[1].op))) {source.warning='malformed-page';continue;}
      const sorted = rows.slice().sort((a,b)=>a[0]-b[0]);
      const details = active.get(id);
      const malformed = sorted.some(row => {
        const op = row && row[1] && row[1].op, fields = op && op[1];
        if (!Array.isArray(op) || op.length !== 2 || typeof op[0] !== 'string' || !fields || typeof fields !== 'object') return true;
        if (details.kind === 'curator' && op[0] === 'vote') return !['voter','author','permlink'].every(k=>typeof fields[k] === 'string' && fields[k].length) || !Number.isSafeInteger(fields.weight) || fields.weight < -10000 || fields.weight > 10000;
        if (details.kind === 'favorite' && op[0] === 'comment') return !['author','permlink'].every(k=>typeof fields[k] === 'string' && fields[k].length) || typeof fields.parent_author !== 'string';
        return false;
      });
      if (malformed) { source.warning='malformed-operation';continue; }
      const valid = sorted.every((r,i)=>Array.isArray(r) && r.length === 2 && Number.isSafeInteger(r[0]) && r[0]>=0 && r[1] && Array.isArray(r[1].op) && (!i || r[0] === sorted[i-1][0]+1));
      if (!valid || (from !== -1 && sorted[sorted.length-1][0] !== from)) {source.warning='history-gap';continue;}
      const head = sorted[sorted.length-1][0], low = sorted[0][0];
      if (role === 'head' && from === -1 && head < source.high) {source.warning='history-regressed';continue;}
      const additions = {};
      for (const row of sorted) {
        if (role === 'head' && row[0] <= (from === -1 ? source.high : source.headStop)) continue;
        const event = details.kind === 'curator' ? historyRowToCuratorVoteEvent(row) : favoriteHistoryEvent(row,details.name);
        if (!event || (details.kind === 'curator' && event.voter !== details.name)) continue;
        for (const account of details.accounts) {
          const key = `${id}/${row[0]}/${account}`;
          if (!data.inbox[key]) additions[key]={source:id,event:Object.assign({},event,{onlyAccount:account,backlogId:key})};
        }
      }
      // Per-source capacity: stalled/disabled sources cannot consume healthy quotas.
      if (Object.values(data.inbox).filter(e=>e.source === id).length+Object.keys(additions).length > 1000) {source.warning='capacity-backpressure';continue;}
      Object.assign(data.inbox,additions);
      if (role === 'older') source.from=low > 1 ? low-1 : -1;
      else if (source.high < 0) {source.high=head;source.from=low > 1 ? low-1 : -1;}
      else if (from === -1) {
        if (low <= source.high+1) source.high=head;
        else {source.headStop=source.high;source.headTop=head;source.headFrom=low-1;}
      } else if (low <= source.headStop+1) {source.high=source.headTop;source.headFrom=-1;}
      else source.headFrom=low-1;
      if (role === 'head') source.ticks=(source.ticks || 0)+1;
      if (role === 'head' && source.from === -1 && source.boundary > 0 && source.ticks%32 === 0) source.from=source.boundary;
    }
    data.sourceCursor=ids.length ? (offset+selected.length)%ids.length : 0;
    const pending = Object.keys(data.inbox).filter(k=>active.has(data.inbox[k].source) && active.get(data.inbox[k].source).accounts.includes(data.inbox[k].event.onlyAccount));
    const eventOffset = pending.length ? data.eventCursor%pending.length : 0;
    const batch = Array.from({length:Math.min(64,pending.length)},(_,i)=>data.inbox[pending[(eventOffset+i)%pending.length]].event);
    data.eventCursor=pending.length ? (eventOffset+batch.length)%pending.length : 0;
    if (typeof adapter.assertSource === 'function') adapter.assertSource();
    writeBacklog(binding,data); // Atomic source progress + inbox BEFORE any planning.
    if (options && Array.isArray(options.feed)) for (const id of selected) if (data.sources[id].warning) options.feed.push({type:'info',message:`Golos source ${id}: ${data.sources[id].warning}; progress retained`});
    return batch;
  }
  function settleDurableGolosEvents(adapter, events, state) {
    const data = readBacklog(adapter.sourceBinding);
    for (const event of events) {
      const key = `${event.onlyAccount}|${event.author}|${event.permlink}`;
      // Unsent transient outcomes release seen; unknown sends remain in the
      // separate exact-target intent ledger and are never replayed from inbox.
      if (state.seen.has(key)) delete data.inbox[event.backlogId];
    }
    writeBacklog(adapter.sourceBinding,data);
  }

  async function runScannerTick(chain, accountSettings, adapter, state, options) {
    const tickState = state && typeof state === 'object' ? state : {};
    if (!(tickState.seen instanceof Set)) tickState.seen = new Set(tickState.seen || []);
    if (options && typeof options.recoverPending === 'function') await options.recoverPending();
    if (cancellationRequested(options)) return {events:[],actions:[],results:[],state:tickState,cancelled:true};
    const durable = chain && chain.id === 'golos' && adapter.sourceBinding;
    const collectedEvents = durable ? await collectDurableGolosEvents(adapter,accountSettings,options) : await collectEventsFromAdapter(adapter, accountSettings, options);
    let events;
    if (durable) {
      const headAt = global.performance.now();
      const head = await boundedSourceRead(()=>adapter.getDynamicGlobalProperties(),options && options.sourceTimeoutMs).catch(()=>null);
      const checked = await Promise.all(collectedEvents.map(async event => {
        const content = await boundedSourceRead(()=>adapter.getContent(event.author,event.permlink),options && options.sourceTimeoutMs).catch(()=>null);
        const reason = voteEligibilitySkipReason(content,event,golosChainTime(head)+Math.ceil(global.performance.now()-headAt)) || (hasVoteFrom(content && content.active_votes,event.onlyAccount) ? 'already-voted' : null);
        if (reason && !['root-post-unknown','eligibility-unknown'].includes(reason)) tickState.seen.add(`${event.onlyAccount}|${event.author}|${event.permlink}`);
        return reason ? null : event;
      }));
      events = checked.filter(Boolean);
    } else events = chain && chain.id === 'golos' ? await filterRootPostEvents(adapter,collectedEvents,options) : collectedEvents;
    if (cancellationRequested(options)) return { events, actions: [], results: [], state: tickState, cancelled: true };
    const settingsWithEnergy = await enrichSettingsWithCurrentEnergy(accountSettings, adapter, options);
    if (cancellationRequested(options)) return { events, actions: [], results: [], state: tickState, cancelled: true };
    tickState.chainId = chain && chain.id;
    const actions = planActionsForEvents(settingsWithEnergy, events, tickState);
    const results = await executePlannedActions(chain, actions, tickState, options);
    if (durable && !cancellationRequested(options)) settleDurableGolosEvents(adapter,collectedEvents,tickState);
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
    collectDurableGolosEvents,
    readBacklog,
    settleDurableGolosEvents,
    createCancellationController,
    createNonOverlappingRunner,
    currentAccountEnergy,
    dedupePlannedActions,
    discussionRowToFavoritePostEvent,
    executePlannedActions,
    estimateVoteEnergyAfter,
    enrichActionDonateFromEmission,
    findAuthorizedUser,
    hasVoteFrom,
    historyRowToCuratorVoteEvent,
    isRootPost,
    rootPostSkipReason,
    voteEligibilitySkipReason,
    golosChainTime,
    normalizeAccountSettings,
    planActionsForEvents,
    releaseRunnerLocks,
    runScannerTick,
    upsertRunnerState
  });

  if (typeof module !== 'undefined' && module.exports) module.exports = global.DposGolosAutoUpvoter;
})(typeof window !== 'undefined' ? window : globalThis);
