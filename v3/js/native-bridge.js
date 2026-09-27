(function exposeNativeBridge(global) {
  'use strict';
  const transport = global.DposAndroidTransport;
  const supported = Boolean(transport && typeof transport.postMessage === 'function');
  const legacyPresent = Boolean(global.DposAndroid && !supported);
  const pending = new Map();
  let sequence = 0;
  if (supported) {
    transport.onmessage = (event) => {
      let reply;
      try { reply = JSON.parse(event.data); } catch (_) { return; }
      if (!reply || reply.version !== 2 || typeof reply.id !== 'string') return;
      const call = pending.get(reply.id);
      if (!call) return;
      pending.delete(reply.id);
      global.clearTimeout(call.timer);
      if (global.DposDiagnostics) void global.DposDiagnostics.record(reply.ok ? 'info' : 'error', 'android.reply', { id: reply.id, method: call.method, elapsedMs: Date.now() - call.started, ok: reply.ok, error: reply.ok ? null : reply.error && reply.error.message });
      if (reply.ok === true) call.resolve(reply.result);
      else call.reject(new Error(reply.error && reply.error.message || 'Android не выполнил действие.'));
    };
  }
  function request(method, payload) {
    if (!supported) return Promise.reject(new Error(legacyPresent
      ? 'Обновите приложение Android для безопасной работы с ключами. Аккаунты сохранены.'
      : 'Android bridge недоступен в браузере.'));
    if (!/^[A-Za-z][A-Za-z0-9]{0,63}$/.test(method)) return Promise.reject(new Error('Неизвестное действие Android.'));
    const id = `dpos-${Date.now()}-${++sequence}`;
    return new Promise((resolve, reject) => {
      // An uncertain result is never retried automatically, especially for signing.
      const timer = global.setTimeout(() => {
        pending.delete(id);
        if (global.DposDiagnostics) void global.DposDiagnostics.record('warning', 'android.timeout', { id, method });
        reject(new Error('Android не ответил вовремя. Проверьте статус и историю перед повтором действия.'));
      }, method === 'checkNow' || method === 'saveDiagnosticLog' ? 660000 : 120000);
      pending.set(id, { resolve, reject, timer, method, started: Date.now() });
      if (global.DposDiagnostics) void global.DposDiagnostics.record('info', 'android.request', { id, method });
      try { transport.postMessage(JSON.stringify({ version: 2, id, method, payload: payload || {} })); }
      catch (_) {
        pending.delete(id);
        global.clearTimeout(timer);
        reject(new Error('Не удалось передать действие Android.'));
      }
    });
  }
  global.DposNative = Object.freeze({ request, available: () => supported, needsUpdate: () => legacyPresent, version: 2 });
})(window);
