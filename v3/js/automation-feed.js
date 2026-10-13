(function exposeAutomationFeed(global) {
  'use strict';

  // Display-only history. Never a source of consent, eligibility or receipts.
  const MAX_ROWS = 100;
  const MAX_TEXT = 1000;
  const PREFIX = 'dpos_web_automation_feed_v1:';

  function storageKey(scope) {
    if (!/^(viz-self-award|upvoter:(golos|hive|steem|viz))$/.test(scope)) throw new Error('Некорректная область ленты.');
    return PREFIX + scope;
  }

  function text(value, max = MAX_TEXT) {
    const diagnostics = global.DposDiagnostics;
    if (!diagnostics || typeof diagnostics.sanitize !== 'function') return '[История скрыта: очистка секретов недоступна]';
    return String(diagnostics.sanitize(String(value || ''))).slice(0, max);
  }

  function project(row) {
    if (typeof row === 'string') return text(row);
    if (!row || typeof row !== 'object' || typeof row.message !== 'string') return null;
    const output = { type: ['info', 'success', 'error'].includes(row.type) ? row.type : 'info', message: text(row.message), persisted: true };
    // No broadcast result, error, key diagnostic, settings or arbitrary object.
    // Restored cards are read-only: old rows must not offer stale vote/donate actions.
    const action = row.action;
    if (action && typeof action === 'object') {
      const account = String(action.account || '');
      const author = String(action.author || '');
      const permlink = String(action.permlink || '');
      if (/^[a-z0-9.-]{3,32}$/.test(account) && /^[a-z0-9.-]{3,32}$/.test(author) && /^[a-z0-9-]{1,256}$/.test(permlink)) {
        output.action = { account, author, permlink };
      }
    }
    return output;
  }

  function read(scope) {
    try {
      const raw = global.localStorage.getItem(storageKey(scope));
      if (raw === null) return [];
      if (raw.length > 250000) throw new Error('oversize');
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.rows) || parsed.rows.length > MAX_ROWS) throw new Error('schema');
      return parsed.rows.map(project).filter(row => row !== null);
    } catch (error) {
      throw new Error('Локальная лента повреждена или недоступна; сохранённые данные не изменены.', { cause: error });
    }
  }

  const snapshots = new WeakMap();
  function save(scope, rows) {
    const key = storageKey(scope);
    const projected = rows.slice(-MAX_ROWS).map(project).filter(row=>row !== null);
    const previous = snapshots.get(rows) || new Set();
    const current = read(scope);
    const identities = new Set(current.map(row=>JSON.stringify(row)));
    projected.forEach(row=>{const id=JSON.stringify(row); if (!previous.has(id) && !identities.has(id)) { current.push(row); identities.add(id); }});
    const merged = current.slice(-MAX_ROWS);
    const value = JSON.stringify({ version:1, rows:merged });
    try {
      // A display-only timer must never overwrite a newer owner's result.
      if (global.localStorage.getItem(key) !== value) global.localStorage.setItem(key, value);
      if (global.localStorage.getItem(key) !== value) throw new Error('readback mismatch');
    } catch (error) {
      throw new Error('Не удалось сохранить локальную ленту. Новых автоматических отправок не будет.', { cause: error });
    }
    // Scanner callbacks retain this array reference across awaits.
    // Bound it in place only after the durable write succeeds.
    const live = new Map(rows.map(row=>[JSON.stringify(project(row)),row]));
    rows.splice(0,rows.length,...merged.map(row=>live.get(JSON.stringify(row)) || row));
    snapshots.set(rows,new Set(merged.map(row=>JSON.stringify(row))));
    return rows;
  }

  global.DposAutomationFeed = Object.freeze({ read, save, storageKey, maxRows: MAX_ROWS });
})(window);
