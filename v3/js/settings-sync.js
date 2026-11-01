(function exposeSettingsSync(global) {
  'use strict';
  const ID = 'dpos.space.settings';
  const FORMAT = 'dpos.space/settings';
  // Both protocols cap the WHOLE transaction at 64 KiB. Leave 4 KiB for one
  // custom operation's authorities, headers, signature and serializer overhead.
  const MAX_PAYLOAD_BYTES = 60 * 1024;
  const UPVOTER_CHAINS = ['golos', 'hive', 'steem'];
  const NOTIFICATIONS = 'dpos_notifications_v1';
  const VIZ = 'dpos_viz_self_award_settings';
  const upKey = id => `dpos_${id}_auto_upvoter_settings`;
  const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
  const fail = () => { throw new Error('Неподдерживаемый или повреждённый снимок настроек.'); };
  function fields(value, allowed, required = allowed) {
    if (!object(value) || Object.keys(value).some(k => !allowed.includes(k)) || required.some(k => !own(value, k))) fail();
  }
  function account(value, chain) {
    const pattern = ['minter', 'decimal'].includes(chain) ? /^(?:(?:mx|dx|0x)[0-9a-f]{40}|d0[0-9a-z]{39})$/ : /^[a-z0-9][a-z0-9.-]{1,30}[a-z0-9]$/;
    if (typeof value !== 'string' || !pattern.test(value)) fail();
    return value;
  }
  function bool(v) { if (typeof v !== 'boolean') fail(); return v; }
  function number(v, min, max) { if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) fail(); return v; }
  function text(v, max = 12000) { if (typeof v !== 'string' || v.length > max) fail(); return v; }
  function names(v) {
    text(v);
    if (v.split(/[\s,;]+/).filter(Boolean).some(n => !/^[a-z0-9][a-z0-9.-]{1,30}[a-z0-9]$/.test(n.replace(/^@/, '')))) fail();
    return v;
  }
  function numericText(v, min, max) { text(v, 24); if (!/^\d+(?:\.\d+)?$/.test(v)) fail(); number(Number(v), min, max); return v; }
  function uniqueRows(rows, binding) {
    if (!Array.isArray(rows)) fail();
    const seen = new Set();
    rows.forEach(row => { const key = binding(row); if (seen.has(key)) fail(); seen.add(key); });
  }
  function validate(snapshot) {
    fields(snapshot, ['format', 'version', 'notifications', 'autoUpvoter', 'vizSelfAward']);
    if (snapshot.format !== FORMAT || snapshot.version !== 1) fail();
    uniqueRows(snapshot.notifications, row => {
      fields(row, ['chain', 'account', 'ops', 'showAutoAwards']);
      if (!['golos','viz','hive','steem','minter','decimal'].includes(row.chain)) fail();
      account(row.account, row.chain); bool(row.showAutoAwards);
      const allowed = global.DposNotifications.defaultOps({ id: row.chain });
      if (!Array.isArray(row.ops) || new Set(row.ops).size !== row.ops.length || row.ops.some(op => !allowed.includes(op))) fail();
      return `${row.chain}:${row.account}`;
    });
    fields(snapshot.autoUpvoter, UPVOTER_CHAINS);
    UPVOTER_CHAINS.forEach(chain => uniqueRows(snapshot.autoUpvoter[chain], row => {
      fields(row, ['account','enabled','curators','favorites','minEnergy','curatorMode','curatorCoefficient','favoritesPercent','autoDonate','autoDonatePoolPercent','autoDonatePoolCoefficient']);
      account(row.account); bool(row.enabled); names(row.curators); names(row.favorites);
      numericText(row.minEnergy, 0, 100); numericText(row.curatorCoefficient, 0, 100); numericText(row.favoritesPercent, 0, 100);
      if (!['repeat','full'].includes(row.curatorMode)) fail();
      bool(row.autoDonate); if (chain !== 'golos' && row.autoDonate) fail();
      numericText(row.autoDonatePoolPercent, 0, 100); numericText(row.autoDonatePoolCoefficient, 0, 10);
      if (row.autoDonate && (Number(row.autoDonatePoolPercent) <= 0 || Number(row.autoDonatePoolCoefficient) <= 0)) fail();
      return row.account;
    }));
    uniqueRows(snapshot.vizSelfAward, row => {
      fields(row, ['account','enabled','minEnergy']); account(row.account); bool(row.enabled); numericText(row.minEnergy, 0, 9999); if (!Number.isInteger(Number(row.minEnergy))) fail(); return row.account;
    });
    if (new TextEncoder().encode(JSON.stringify(snapshot)).length > MAX_PAYLOAD_BYTES) throw new Error('Настройки превышают безопасный размер одной транзакции (60 КиБ). Сократите списки.');
    return JSON.parse(JSON.stringify(snapshot));
  }
  function read(storage, key, fallback = {}) {
    const raw = storage.getItem(key);
    if (raw === null) return fallback;
    const parsed = JSON.parse(raw); if (!object(parsed)) fail(); return parsed;
  }
  function exportSnapshot(storage = global.localStorage) {
    const settings = read(storage, NOTIFICATIONS).settings || {};
    const snapshot = { format: FORMAT, version: 1, notifications: [], autoUpvoter: {}, vizSelfAward: [] };
    Object.entries(settings).forEach(([key, row]) => {
      const at = key.indexOf(':'); const chain = key.slice(0, at); const name = key.slice(at + 1);
      if (!global.DposNotifications.supportsChain({id:chain})) return;
      snapshot.notifications.push({ chain, account: name, ops: Array.isArray(row.ops) ? row.ops.slice() : global.DposNotifications.defaultOps({id:chain}), showAutoAwards: row.showAutoAwards === true });
    });
    UPVOTER_CHAINS.forEach(chain => {
      const saved = read(storage, upKey(chain));
      snapshot.autoUpvoter[chain] = Object.entries(saved.accounts || {}).map(([name, row]) => {
        const energy = Number(row.minEnergy === undefined ? 25 : row.minEnergy);
        const pool = String(row.autoDonateCap || '0 1').split(/\s+/);
        return { account: name, enabled: row.enabled === true, curators: String(row.curators || ''), favorites: String(row.favorites || ''),
          minEnergy: String(saved.schemaVersion === 2 ? energy : energy > 100 ? energy / 100 : energy),
          curatorMode: row.curatorMode || 'repeat', curatorCoefficient: String(row.curatorCoefficient === undefined ? 100 : row.curatorCoefficient), favoritesPercent: String(row.favoritesPercent === undefined ? 100 : row.favoritesPercent),
          autoDonate: chain === 'golos' && row.autoDonate === true, autoDonatePoolPercent: String(row.autoDonatePoolPercent || pool[0] || '0'), autoDonatePoolCoefficient: String(row.autoDonatePoolCoefficient || pool[1] || '1') };
      });
    });
    snapshot.vizSelfAward = Object.entries(read(storage, VIZ).accounts || {}).map(([name, row]) => ({ account: name, enabled: row.enabled === true, minEnergy: String(row.minEnergy === undefined ? 9500 : row.minEnergy) }));
    return validate(snapshot);
  }
  function replacement(snapshot, storage) {
    const writes = new Map();
    const old = read(storage, NOTIFICATIONS); const settings = {};
    const deviceSettings = Object.assign({}, old.deviceSettings || {});
    Object.entries(old.settings || {}).forEach(([key,row]) => {
      deviceSettings[key] = {androidNative:row.androidNative === true, intervalMinutes:row.intervalMinutes || 15};
    });
    snapshot.notifications.forEach(row => {
      const key = `${row.chain}:${row.account}`; const local = deviceSettings[key] || {};
      settings[key] = { ops: row.ops, showAutoAwards: row.showAutoAwards, settingsImported:true, androidNative: local.androidNative === true, intervalMinutes: local.intervalMinutes || 15 };
    });
    writes.set(NOTIFICATIONS, JSON.stringify(Object.assign({}, old, {settings, deviceSettings, settingsReplaced:true})));
    UPVOTER_CHAINS.forEach(chain => {
      const local = read(storage, upKey(chain)); const accounts = {};
      snapshot.autoUpvoter[chain].forEach(row => {
        const {account: name, ...preferences} = row;
        accounts[name] = Object.assign(preferences, { autoDonateCap: `${row.autoDonatePoolPercent} ${row.autoDonatePoolCoefficient}` });
      });
      const settingsRevision = (Number.isSafeInteger(local.settingsRevision) ? local.settingsRevision : 0) + 1;
      writes.set(upKey(chain), JSON.stringify(Object.assign({}, local, {accounts, schemaVersion: 2, minEnergyUnit: 'percent', autoStart: local.autoStart === true, settingsImported:true, settingsRevision})));
    });
    const local = read(storage, VIZ); const accounts = {};
    snapshot.vizSelfAward.forEach(({account: name, ...row}) => { accounts[name] = row; });
    // Legacy Android auto-import is a grant operation, not a preference update.
    // Keep the local autoStart preference but fence that path after a snapshot.
    const settingsRevision = (Number.isSafeInteger(local.settingsRevision) ? local.settingsRevision : 0) + 1;
    writes.set(VIZ, JSON.stringify(Object.assign({}, local, {accounts, autoStart: local.autoStart === true, settingsImported:true, settingsRevision})));
    return writes;
  }
  function replace(snapshot, options = {}) {
    const clean = validate(snapshot); const storage = options.storage || global.localStorage;
    const writes = replacement(clean, storage); const before = new Map([...writes.keys()].map(k => [k,storage.getItem(k)]));
    if (options.isCurrent && !options.isCurrent()) throw new Error('Источник или страница изменились. Повторите синхронизацию.');
    try {
      writes.forEach((value,key) => { storage.setItem(key,value); if (storage.getItem(key) !== value) throw new Error('Не удалось сохранить настройки.'); });
    } catch (error) {
      const errors = [];
      before.forEach((value,key) => { try { if (value === null) storage.removeItem(key); else storage.setItem(key,value); } catch (rollback) { errors.push(rollback); } });
      if (errors.length) throw new Error('Ошибка хранилища и отката. Не закрывайте страницу; восстановите локальную резервную копию.');
      throw new Error('Настройки не изменены: ошибка локального хранилища.');
    }
    return clean;
  }
  function matchOperation(op, chain, author) {
    if (!Array.isArray(op) || !object(op[1])) return false;
    const data = op[1];
    const authorizes = field => Array.isArray(data[field]) && data[field].includes(author);
    return chain === 'viz' ? op[0] === 'custom' && data.id === ID && (authorizes('required_regular_auths') || authorizes('required_active_auths'))
      : op[0] === 'custom_json' && data.id === ID && (authorizes('required_posting_auths') || authorizes('required_auths'));
  }
  function payload(op, chain) {
    if (typeof op[1].json !== 'string' || new TextEncoder().encode(op[1].json).length > MAX_PAYLOAD_BYTES) fail();
    const value = JSON.parse(op[1].json);
    if (chain === 'viz') {
      fields(value, ['p','d']);
      if (!Number.isSafeInteger(value.p) || value.p < 0) fail();
      return value.d;
    }
    return value;
  }
  async function latest(chain, author, rpc, options = {}) {
    account(author);
    if (!['viz','golos'].includes(chain)) fail();
    const current = () => { if (options.isCurrent && !options.isCurrent()) throw new Error('Источник или страница изменились.'); };
    current();
    if (chain === 'viz') {
      let indexedOperation = null, indexedBlock = 0;
      try {
        const index = await rpc('custom_protocol_api','get_account',[author, ID]); current();
        const blockNum = index && index.custom_sequence_block_num;
        if (Number.isSafeInteger(blockNum) && blockNum > 0 && Number.isSafeInteger(index.custom_sequence) && index.custom_sequence > 0) {
          const block = await rpc('database_api','get_block',[blockNum]); current();
          const ops = (block?.transactions || []).flatMap(tx => tx.operations || []);
          indexedOperation = ops.reverse().find(op => matchOperation(op,chain,author));
          indexedBlock = blockNum;
        }
      } catch (error) { current(); /* Unsupported/pruned protocol index: validate history instead. */ }
      // An incompatible newest snapshot is an error, never permission to revive
      // an older compatible snapshot silently.
      if (indexedOperation) return {snapshot:validate(payload(indexedOperation,chain)), block:indexedBlock};
    }
    let from = -1;
    // Pagination is user-cancellable, not a silently truncated recent-history window.
    while (true) {
      current();
      const limit = from < 0 ? 100 : Math.min(100, from);
      const args = [author,from,limit];
      if (chain === 'golos') args.push({select_ops:['custom_json']});
      const rows = await rpc('account_history','get_account_history',args); current();
      if (!Array.isArray(rows)) throw new Error('Некорректный ответ истории аккаунта.');
      if (!rows.length) throw new Error('Сохранённые настройки этого аккаунта не найдены.');
      const ordered = rows.slice().sort((a,b) => b[0]-a[0]);
      if (ordered.some(row => !Array.isArray(row) || !Number.isSafeInteger(row[0]) || row[0] < 0 || (from >= 0 && row[0] > from))) throw new Error('Некорректный индекс истории.');
      for (const row of ordered) {
        if (matchOperation(row[1]?.op,chain,author)) return {snapshot: validate(payload(row[1].op,chain)), block: row[1].block || 0};
      }
      const minimum = Math.min(...ordered.map(row => row[0]));
      if (minimum === 0) throw new Error('Сохранённые настройки этого аккаунта не найдены.');
      const next = minimum - 1;
      if (from >= 0 && next >= from) throw new Error('История не продвигается.');
      from = next;
    }
  }
  function encoded(snapshot, previousBlock) {
    const clean = validate(snapshot);
    if (previousBlock !== undefined && (!Number.isSafeInteger(previousBlock) || previousBlock < 0)) fail();
    // The VIZ FSP p field is an envelope pointer, not merged older settings.
    const value = previousBlock === undefined ? clean : { p: previousBlock, d: clean };
    const json = JSON.stringify(value);
    if (new TextEncoder().encode(json).length > MAX_PAYLOAD_BYTES) throw new Error('Снимок слишком большой.');
    return json;
  }
  async function createRpc(chain, options) {
    await options.loadScript(chain.libraryPath);
    const connection = await options.connect(chain);
    return async (api, method, params) => {
      const controller = new global.AbortController();
      const timer = global.setTimeout(() => controller.abort(), 10000);
      try {
        const response = await global.fetch(connection.node, {method:'POST', headers:{'Content-Type':'application/json'}, signal:controller.signal,
          body:JSON.stringify({jsonrpc:'2.0', id:1, method:'call', params:[api,method,params]})});
        if (!response.ok) throw new Error('Ошибка публичной ноды.');
        const body = await response.json();
        if (body.error || !own(body,'result')) throw new Error('RPC не выполнил чтение настроек.');
        return body.result;
      } finally { global.clearTimeout(timer); }
    };
  }
  function forGrantedRows(scope, grants, storage = global.localStorage) {
    const viz = scope === 'viz-self-award';
    const chain = viz ? 'viz' : scope.split(':')[1];
    const saved = read(storage, viz ? VIZ : upKey(chain));
    return (grants || []).map(grant => {
      const row = (saved.accounts || {})[grant.account];
      if (!row) return Object.assign({},grant,{enabled:false});
      return Object.assign({},grant,row,{ account:grant.account, enabled:grant.enabled === true && row.enabled === true,
        autoDonate: grant.autoDonate === true && row.autoDonate === true });
    });
  }
  let revision = 0;
  function settingsGuard(scope) {
    const key = scope === 'viz-self-award' ? VIZ : upKey(scope.split(':')[1]);
    const pinned = global.localStorage.getItem(key), at = revision;
    return () => at === revision && pinned === global.localStorage.getItem(key);
  }
  function refreshRuntime() {
    revision += 1;
    UPVOTER_CHAINS.forEach(chain => {
      const runtime = (global.__dposAutoUpvoterRuntimes || {})[chain];
      if (runtime && runtime.running && Array.isArray(runtime.settings)) runtime.settings = forGrantedRows(`upvoter:${chain}`,global.DposAutomationContinuity.readRun(`upvoter:${chain}`).settings);
    });
    const runtime = global.__dposVizSelfAwardRuntime;
    if (runtime && runtime.running && Array.isArray(runtime.settings)) runtime.settings = forGrantedRows('viz-self-award',global.DposAutomationContinuity.readRun('viz-self-award').settings);
  }
  global.DposSettingsSync = Object.freeze({ ID, FORMAT, MAX_PAYLOAD_BYTES, validate, exportSnapshot, replace, latest, encoded, createRpc, forGrantedRows, refreshRuntime, settingsGuard });
})(window);
