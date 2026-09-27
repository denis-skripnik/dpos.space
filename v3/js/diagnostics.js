(function exposeDiagnostics(global) {
  'use strict';
  const KEY = 'dpos_diagnostic_journal_v1';
  const VERSION = '3.1.0';
  const MAX = 48000;
  const LIMIT = 400;
  const sensitive = /private|password|passphrase|mnemonic|seed|secret|token|authorization|cookie|signed|signature|raw.?tx|transaction|payload|api.?key|access.?key|credential|wif|^(?:key|posting|active|regular|memoKey|masterKey|encryptedKey|ciphertext|ct)$/i;
  let memory = { entries: [], dropped: 0 };
  let persistent = true;
  let queue = Promise.resolve();
  function safe(value, seen = new Set()) {
    if (value == null || typeof value === 'boolean' || typeof value === 'number') return value;
    if (typeof value === 'string') {
      if (/^[\s]*[\[{]/.test(value)) {
        try { return JSON.stringify(safe(JSON.parse(value), seen)); } catch (_) { /* malformed text is sanitized below */ }
      }
      const sanitizer = global.DposBroadcast && global.DposBroadcast.sanitizeDiagnostic;
      if (!sanitizer || !global.DposBip39) return '[diagnostic sanitizer unavailable]';
      return sanitizer(value).split('\n').map(line => {
        if (/(?:private(?:.?key)?|password|passphrase|mnemonic|seed|secret|token|api.?key|access.?key|credential|authorization|cookie|signed(?:.?(?:transaction|tx))?|raw.?(?:transaction|tx)|signature|payload|operations|trx|\btx|\bkey|\bwif|\bposting|\bregular)["']?\s*[:=]/i.test(line) || /\\u[0-9a-f]{4}/i.test(line)) return '[sensitive diagnostic details omitted]';
        return line.replace(/https?:\/\/[^\s"'<>]+/g, url => {
          try { return new URL(url).origin; } catch (_) { return '[url]'; }
        }).replace(/\b(?:0x)?[a-f0-9]{64,}\b/gi, '[redacted-hex]');
      }).join('\n');
    }
    if (typeof value !== 'object' || seen.has(value)) return '[omitted]';
    seen.add(value);
    if (value instanceof Error || (typeof value.message === 'string' && typeof value.stack === 'string')) return safe({ name: value.name, message: value.message, stack: value.stack }, seen);
    if (Array.isArray(value)) return value.slice(0, 100).map(item => safe(item, seen));
    const result = Object.create(null);
    Object.keys(value).slice(0, 100).forEach(key => {
      result[safe(key)] = sensitive.test(key) || /^(?:operations|trx|tx)$/i.test(key) ? '[redacted]' : safe(value[key], seen);
    });
    return result;
  }
  function cleanEntry(row) {
    if (!row || typeof row !== 'object') return null;
    const detail = safe(String(row.detail || ''));
    const time = Number(row.time);
    const event = safe(String(row.event || 'event'));
    return { time: Number.isFinite(time) && Math.abs(time) <= 8640000000000000 ? time : Date.now(), level: ['info','warning','error'].includes(row.level) ? row.level : 'info', event: /^[a-zA-Z0-9_.:-]{1,60}$/.test(event) ? event : 'event', detail: detail.length > 8000 ? detail.slice(0, 7950) + '\n[event truncated at retention limit]' : detail };
  }
  function load() {
    if (!persistent) return memory;
    try {
      const raw = global.localStorage.getItem(KEY);
      if (!raw) return memory;
      if (raw.length > MAX * 3) return { entries: [], dropped: 1 };
      const data = JSON.parse(raw);
      return { entries: (Array.isArray(data.entries) ? data.entries : []).map(cleanEntry).filter(Boolean), dropped: Math.max(0, Number(data.dropped) || 0) };
    } catch (_) { persistent = false; return memory; }
  }
  function commit(entry) {
    const state = load();
    state.entries.push(entry);
    while (state.entries.length > LIMIT || JSON.stringify(state).length > MAX) { state.entries.shift(); state.dropped++; }
    memory = state;
    if (persistent) {
      try { global.localStorage.setItem(KEY, JSON.stringify(state)); } catch (_) { persistent = false; }
    }
  }
  function record(level, event, value) {
    try {
      const cleaned = safe(value);
      const detail = typeof cleaned === 'string' ? cleaned : JSON.stringify(cleaned);
      const entry = cleanEntry({ time: Date.now(), level, event, detail });
      queue = queue.then(() => {
        const locks = global.navigator && global.navigator.locks;
        return locks && typeof locks.request === 'function' ? locks.request(KEY, () => commit(entry)) : commit(entry);
      }).catch(() => { persistent = false; });
    } catch (_) { /* Diagnostics must never break financial actions. */ }
    return queue;
  }
  async function summary() {
    await queue; const state = load();
    return { entries: state.entries.length, dropped: state.dropped, persistent, version: VERSION };
  }
  async function exportText() {
    await queue; const state = load();
    const head = ['DPoS Space — diagnostic report', `Web build: ${VERSION}`, `Generated: ${new Date().toISOString()}`, `Storage persistent: ${persistent}; retained events: ${state.entries.length}; removed by retention: ${state.dropped}`, 'Local bounded journal. Only retained events are available. No automatic upload.', 'Public account names may occur in diagnostics.', '', '=== WEB EVENTS ==='];
    return head.concat(state.entries.map(row => `${new Date(row.time).toISOString()} [${row.level}] ${row.event}\n${row.detail}`)).join('\n');
  }
  global.DposDiagnostics = Object.freeze({ record, exportText, summary, sanitize: safe, version: VERSION });
  if (global.addEventListener) {
    global.addEventListener('error', e => { void record('error', 'javascript.error', e.message || 'Resource load failed'); });
    global.addEventListener('unhandledrejection', e => { void record('error', 'javascript.rejection', e.reason && typeof e.reason.message === 'string' ? e.reason.message : 'Non-Error rejection; details omitted'); });
    ['dpos-vault-ready','dpos-vault-lock'].forEach(name => global.addEventListener(name, () => { void record('info', name, 'vault lifecycle event'); }));
  }
  if (global.console) ['warn','error'].forEach(level => {
    const original = global.console[level];
    if (typeof original !== 'function') return;
    global.console[level] = function(...args) {
      void record(level === 'warn' ? 'warning' : 'error', `console.${level}`, args);
      return original.apply(this, args);
    };
  });
  void record('info', 'page.open', 'Web runtime initialized');
})(window);
