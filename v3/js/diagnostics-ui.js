(function exposeDiagnosticsUI(global) {
  'use strict';
  function render(container) {
    const journal = global.DposDiagnostics;
    container.innerHTML = `<section class="panel" aria-labelledby="diagnostic-heading">
      <h2 id="diagnostic-heading">Логи и диагностика</h2>
      <p>Журнал хранится только на этом устройстве. Ничего не отправляется автоматически.</p>
      <p>Файл содержит всю сохранённую историю событий. Старые события удаляются при достижении лимита размера. В отчёте могут быть публичные имена аккаунтов.</p>
      <p>Ключи, seed-фразы, пароли и подписанные транзакции не записываются в журнал.</p>
      <dl><dt>Событий интерфейса сохранено</dt><dd data-diag-count data-i18n-skip>—</dd>
      <dt>Удалено по лимиту хранения</dt><dd data-diag-dropped data-i18n-skip>—</dd></dl>
      <p data-diag-storage role="status" aria-live="polite"></p>
      <p data-diag-native role="status" aria-live="polite"></p>
      <p><button type="button" data-diag-download>Скачать .log</button> <button type="button" data-diag-refresh>Обновить сведения</button></p>
      <p data-diag-result role="status" aria-live="polite"></p>
    </section>`;
    const nodes = new Map(['result', 'download', 'refresh', 'count', 'dropped', 'storage', 'native'].map(name => [`[data-diag-${name}]`, container.querySelector(`[data-diag-${name}]`)]));
    const get = selector => nodes.get(selector);
    const result = get('[data-diag-result]');
    const button = get('[data-diag-download]');
    const native = global.DposNative && global.DposNative.available() ? global.DposNative : null;
    let supported = false;
    async function refresh() {
      if (!journal) { result.textContent = 'Журнал недоступен. Обновите страницу.'; return; }
      const state = await journal.summary();
      get('[data-diag-count]').textContent = String(state.entries);
      get('[data-diag-dropped]').textContent = String(state.dropped);
      get('[data-diag-storage]').textContent = state.persistent ? 'Журнал сохраняется между запусками.' : 'Хранилище недоступно: доступны только события текущего запуска.';
      if (!native) { get('[data-diag-native]').textContent = 'Браузер: файл содержит события веб-интерфейса.'; return; }
      get('[data-diag-native]').textContent = 'Проверяю доступность журнала Android…';
      let timer;
      try {
        const info = await Promise.race([native.request('getAppInfo'), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('timeout')), 5000); })]);
        supported = Boolean(info && info.diagnosticLogExport);
        get('[data-diag-native]').textContent = supported ? 'Android: при сохранении будут добавлены журнал фоновой службы и состояние всех настроенных аккаунтов.' : 'Для сохранения полного .log в Android установите APK с поддержкой диагностики.';
      } catch (_) { get('[data-diag-native]').textContent = 'Android не ответил. Страница диагностики остаётся доступной; можно повторить обновление сведений.'; }
      finally { clearTimeout(timer); }
    }
    button.addEventListener('click', async () => {
      if (!journal) return;
      button.disabled = true;
      result.textContent = 'Подготавливаю файл журнала…';
      try {
        await journal.record('info', 'diagnostics.export', 'User requested local .log export');
        const webReport = await journal.exportText();
        if (native) {
          if (!supported) throw new Error('Для сохранения полного .log в Android установите APK с поддержкой диагностики.');
          const saved = await native.request('saveDiagnosticLog', { webReport });
          if (saved && saved.cancelled) { result.textContent = 'Сохранение отменено. Журнал не удалён.'; return; }
          if (!saved || !saved.ok) throw new Error(saved && saved.reason || 'Не удалось сохранить файл журнала.');
          result.textContent = 'Файл журнала сохранён. Его можно отправить разработчику как документ.';
        } else {
          const blob = new Blob([webReport], { type: 'text/plain;charset=utf-8' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `dpos-diagnostics-${new Date().toISOString().replace(/[:.]/g, '-')}.log`;
          document.body.appendChild(link);
          link.click(); link.remove();
          setTimeout(() => URL.revokeObjectURL(url), 60000);
          result.textContent = 'Файл .log передан браузеру для скачивания.';
        }
      } catch (error) {
        result.textContent = journal.sanitize(error.message || 'Не удалось сохранить файл журнала.');
        void journal.record('error', 'diagnostics.export.failed', error.message);
      } finally { button.disabled = false; }
    });
    get('[data-diag-refresh]').addEventListener('click', () => { void refresh(); });
    void refresh();
  }
  global.DposDiagnosticsUI = Object.freeze({ render });
})(window);
