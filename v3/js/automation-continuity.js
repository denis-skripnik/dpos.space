(function exposeAutomationContinuity(global) {
  'use strict';
  const PREFIX = 'dpos_web_automation_continuity_v1_';
  const activeLocks = new Set();
  function key(scope) {
    if (!/^(viz-self-award|upvoter:(golos|hive|steem))$/.test(scope)) throw new Error('Invalid automation scope');
    return PREFIX + scope;
  }
  function binding() {
    if (!global.DposVault || global.DposVault.status().state !== 'unlocked') throw new Error('Vault locked');
    global.DposVault.assertGuard(global.DposVault.issueGuard());
    const resume = JSON.parse(global.localStorage.getItem('dpos_vault_session_resume_v1') || 'null');
    if (!resume || typeof resume.binding !== 'string') throw new Error('Browser session resume unavailable');
    return `${resume.binding}|${resume.iv}`;
  }
  function controlKey(scope) { return key(scope) + '_control'; }
  function read(scope) {
    const stored = global.localStorage.getItem(key(scope));
    const ledger = stored ? JSON.parse(stored) : {version:1,nextAt:0,intents:{}};
    const text = global.localStorage.getItem(controlKey(scope));
    const control = text ? JSON.parse(text) : {version:1,running:false,epoch:0,settings:[]};
    if (!ledger || ledger.version !== 1 || !Number.isSafeInteger(ledger.nextAt) || !ledger.intents || typeof ledger.intents !== 'object' || Array.isArray(ledger.intents) || !control || control.version !== 1 || typeof control.running !== 'boolean' || !Number.isSafeInteger(control.epoch) || !Array.isArray(control.settings)) throw new Error('Automation continuity storage corrupt');
    return Object.assign({},ledger,control);
  }
  function persist(storageKey, item) {
    const text = JSON.stringify(item);
    try {
      global.localStorage.setItem(storageKey,text);
      if (global.localStorage.getItem(storageKey) !== text) throw new Error('readback');
    } catch (_) {
      if (global.DposVault) global.DposVault.lock();
      throw new Error('Automation storage unavailable; signing stopped');
    }
    return item;
  }
  function write(scope, item) {
    persist(key(scope),{version:1,nextAt:item.nextAt,intents:item.intents,recoveryCursor:item.recoveryCursor || 0});
    return item;
  }
  function writeControl(scope,item) {
    persist(controlKey(scope),{version:1,running:item.running,epoch:item.epoch,binding:item.binding,settings:item.settings});
    return item;
  }
  function readRun(scope) {
    const item = read(scope);
    return Object.assign({}, item, { running: item.running && item.binding === binding() && (scope !== 'viz-self-award' || global.DposVault.vizAutomationAdmitted()) });
  }
  function start(scope, settings) {
    if (scope === 'viz-self-award') return global.DposVault.startVizAutomation(settings);
    const item = read(scope);
    item.running = true; item.epoch += 1; item.binding = binding();
    // Caller supplies public settings only. Never persist account records/keys.
    item.settings = settings.map(row => Object.fromEntries(['account','enabled','minEnergy','curators','favorites','curatorMode','curatorCoefficient','favoritesPercent','autoDonate','autoDonateCap','autoDonatePoolPercent','autoDonatePoolCoefficient'].filter(k=>Object.prototype.hasOwnProperty.call(row,k)).map(k=>[k,row[k]])));
    return writeControl(scope, item);
  }
  function stop(scope) {
    try { if (scope === 'viz-self-award' && global.DposDiagnostics) void global.DposDiagnostics.record('info', 'viz.stop_before_invalidation', diagnosticSnapshot()); } catch (_) {}
    // Separate synchronous cancellation authority: late cross-tab control writes
    // cannot restore Stop, even though localStorage compare/write is not CAS.
    if (scope === 'viz-self-award') persist(controlKey(scope)+'_cancel', Array.from(global.crypto.getRandomValues(new Uint32Array(4))));
    const item = read(scope); item.running = false; item.epoch += 1;
    return writeControl(scope, item);
  }
  function guard(scope) {
    const item = readRun(scope), vaultGuard = global.DposVault.issueGuard();
    if (!item.running) throw new Error('Automation cancelled');
    return () => {
      global.DposVault.assertGuard(vaultGuard);
      const current = readRun(scope);
      if (!current.running || current.epoch !== item.epoch) throw new Error('Automation cancelled');
    };
  }
  function remaining(scope) { return Math.max(0, read(scope).nextAt - Date.now()); }
  function schedule(scope, delay) {
    const item = readRun(scope); if (!item.running) throw new Error('Automation cancelled');
    item.nextAt = Date.now() + delay; return write(scope,item);
  }
  async function exclusive(scope, action) {
    if (!global.navigator || !global.navigator.locks || typeof global.navigator.locks.request !== 'function') throw new Error('Web Locks required for browser automation');
    // Browser-managed ownership is not an expiring localStorage lease. A slow
    // sender retains exclusion until completion; page death releases ownership.
    return global.navigator.locks.request('dpos-web-automation:' + scope, { mode:'exclusive', ifAvailable:true }, async lock => {
      if (!lock) return { skipped:true, reason:'overlap' };
      activeLocks.add(scope);
      try { return await action(); } finally { activeLocks.delete(scope); }
    });
  }
  function assertExclusive(scope) { if (!activeLocks.has(scope)) throw new Error('Automation exclusion required'); }
  function pending(scope, target) { return read(scope).intents[target] || null; }
  async function send(scope, target, operation, assertActive, sender, proof, tracksAttempt) {
    if (!activeLocks.has(scope)) throw new Error('Automation exclusion required');
    const item = readRun(scope);
    if (Array.isArray(operation)) {
      const fields = operation[1] || {};
      const account = fields.voter || fields.initiator || fields.from;
      const settings = item.settings.find(row=>row.enabled && row.account === account);
      if (!settings || (operation[0] === 'donate' && !settings.autoDonate)) throw new Error('Operation not authorized by selected Start account/settings');
    }
    const existing = item.intents[target];
    if (existing && !(scope === 'viz-self-award' && existing.state === 'confirmed' && Date.now() >= existing.confirmedAt + 432000)) {
      if (existing.state === 'pending' && existing.id && existing.transaction) {
        const check = guard(scope);
        check(); assertActive();
        if (await proof(existing)) {
          check(); assertActive();
          const current = read(scope);
          current.intents[target].state = 'confirmed';
          current.intents[target].confirmedAt = Date.now();
          write(scope,current);
        }
      }
      return { skipped:true, reason:'pending-or-confirmed' };
    }
    if (Object.keys(item.intents).length >= 5000) throw new Error('Automation intent capacity reached; no unsafe eviction');
    const check = guard(scope);
    check(); assertActive();
    const intent = { state:'pending', operation, createdAt:Date.now() };
    item.intents[target] = intent;
    write(scope,item); // Durable reservation BEFORE preparation/signing/RPC.
    let attempted = !tracksAttempt, receipt;
    const markAttempted = () => {
      check(); assertActive();
      const current = read(scope); current.intents[target].attempted = true;
      write(scope,current); attempted = true;
    };
    try { check(); assertActive(); receipt = await sender(markAttempted); }
    catch (error) {
      if (!attempted) { const current = read(scope); delete current.intents[target]; write(scope,current); error.automationUnsent = true; }
      throw error;
    }
    if (!attempted && receipt && receipt.skipped) {
      const current = read(scope); delete current.intents[target]; write(scope,current); return receipt;
    }
    // Save public identity even after Stop. Never resurrect consent or replay.
    const after = read(scope);
    if (receipt && after.intents[target].id && receipt.id !== after.intents[target].id) throw new Error('Conflicting receipt identity; result pending, automatic replay forbidden');
    if (receipt && typeof receipt.id === 'string' && /^[a-f0-9]{40}$/i.test(receipt.id) && (!after.intents[target].id || after.intents[target].id === receipt.id)) Object.assign(after.intents[target], { id:receipt.id, block_num:receipt.block_num, trx_num:receipt.trx_num, expired:receipt.expired });
    write(scope, after);
    const confirmed = await proof(receipt);
    if (!confirmed) throw new Error('Result unknown/pending; automatic replay forbidden');
    const final = read(scope); final.intents[target].state = 'confirmed'; final.intents[target].confirmedAt = Date.now();
    write(scope,final);
    return receipt;
  }
  function transaction(scope, target, unsigned, nodeBinding) {
    if (!activeLocks.has(scope)) throw new Error('Automation exclusion required');
    const item = read(scope);
    if (!item.intents[target] || item.intents[target].state !== 'pending') throw new Error('Missing durable intent');
    item.intents[target].transaction = JSON.parse(JSON.stringify(unsigned));
    item.intents[target].nodeBinding = nodeBinding;
    if (nodeBinding && scope === 'upvoter:golos' && global.golos?.auth?.unsignedTransactionId) {
      item.intents[target].id = global.golos.auth.unsignedTransactionId(unsigned);
    }
    write(scope,item);
  }
  async function reconcile(scope, proof, isCancelled, limit) {
    if (!activeLocks.has(scope)) throw new Error('Automation exclusion required');
    const item = read(scope), targets = Object.keys(item.intents).filter(t=>item.intents[t].state === 'pending');
    if (!targets.length) return { checked:0,confirmed:0 };
    const start = (item.recoveryCursor || 0) % targets.length;
    const selected = Array.from({length:Math.min(limit || 8,targets.length)},(_,i)=>targets[(start+i)%targets.length]);
    const results = await Promise.all(selected.map(async target => {
      const copy = JSON.parse(JSON.stringify(item.intents[target]));
      let timer;
      const outcome = await Promise.race([Promise.resolve().then(()=>proof(copy)).then(confirmed=>({copy,confirmed}),()=>null),new Promise(resolve=>{timer=setTimeout(()=>resolve(null),9500);})]);
      clearTimeout(timer); return {target,outcome};
    }));
    if (typeof isCancelled === 'function' && isCancelled()) return { checked:selected.length,confirmed:0,cancelled:true };
    const current = read(scope); let confirmed = 0;
    for (const {target,outcome} of results) {
      if (!outcome || current.intents[target]?.state !== 'pending') continue;
      current.intents[target] = outcome.copy;
      if (outcome.confirmed) { current.intents[target].state='confirmed';current.intents[target].confirmedAt=Date.now();confirmed++; }
    }
    current.recoveryCursor = (start+selected.length)%targets.length;
    write(scope,current); return {checked:selected.length,confirmed};
  }
  // Read-only: do not call readRun/binding/issueGuard, which can invalidate vault state.
  function diagnosticSnapshot() {
    const result = { build: '20261016-viz-manual-unlock' };
    try {
      const item = read('viz-self-award');
      const vault = global.DposVault && global.DposVault.diagnosticSnapshot ? global.DposVault.diagnosticSnapshot() : null;
      const raw = JSON.parse(global.localStorage.getItem('dpos_vault_session_resume_v1') || 'null');
      result.savedStart = item.running;
      result.nextAt = item.nextAt;
      result.bindingMatches = Boolean(raw && item.binding === `${raw.binding}|${raw.iv}`);
      result.reason = !item.running ? 'missing_consent' : !vault || vault.state !== 'unlocked' ? 'vault_locked' : !raw ? 'resume_record_missing' : !result.bindingMatches ? 'start_binding_mismatch' : 'eligible';
    } catch (_) { result.reason = 'storage_unavailable_or_invalid'; }
    return result;
  }
  function stopAll() {
    ['viz-self-award','upvoter:golos','upvoter:hive','upvoter:steem'].forEach(scope => { if (global.localStorage.getItem(controlKey(scope))) stop(scope); });
  }
  global.DposAutomationContinuity = Object.freeze({ diagnosticSnapshot,assertExclusive,reconcile,start,stop,stopAll,readRun,guard,remaining,schedule,exclusive,pending,send,transaction,storageKey:key });
})(window);
