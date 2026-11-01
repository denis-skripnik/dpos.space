(function exposeSettingsSyncUI(global) {
  'use strict';
  function render(mount, options) {
    const sync = global.DposSettingsSync;
    mount.innerHTML = `<section class="panel"><h2>Синхронизация настроек</h2>
      <p>Снимок публичен и заменяет настройки целиком, а не объединяет списки. Только фильтры уведомлений, автоапвоутер Golos/Hive/Steem и VIZ автонаграда себе. Аккаунты авторизации, ключи, история, курсоры и разрешения запуска не переносятся.</p>
      <div class="field"><label for="settings-sync-chain">Блокчейн снимка</label><select id="settings-sync-chain"><option value="viz">VIZ</option><option value="golos">Golos</option></select></div>
      <div class="field"><label for="settings-sync-source">Аккаунт-источник</label><input id="settings-sync-source" type="text" autocomplete="off" pattern="[a-z0-9.-]{3,32}" placeholder="account"></div>
      <p>Для сохранения укажите текущий авторизованный аккаунт выбранной сети. Для чтения можно указать любой аккаунт. Данные из блокчейна не включают и не запускают автоматизацию.</p>
      <p>Изменение настроек VIZ не создаёт новое разрешение Start. Для продолжения автонаграды в браузере после изменения параметров нажмите Start заново.</p>
      <div id="settings-sync-save-mount"></div><button id="settings-sync-read" type="button">Синхронизировать</button>
      <p id="settings-sync-status" role="status" aria-live="polite"></p></section>`;
    const chainEl = mount.querySelector('#settings-sync-chain');
    const sourceEl = mount.querySelector('#settings-sync-source');
    const status = mount.querySelector('#settings-sync-status');
    const readButton = mount.querySelector('#settings-sync-read');
    let generation = 0;
    const login = () => options.currentLogin(chainEl.value);
    sourceEl.value = login() || '';
    function capture() {
      const chain = chainEl.value, source = sourceEl.value.trim(), currentLogin = login(), captured = generation;
      const accountCurrent = options.currentGuard ? options.currentGuard() : () => true;
      const isCurrent = () => options.isCurrent() && accountCurrent() && captured === generation && chain === chainEl.value && source === sourceEl.value.trim() && currentLogin === login();
      return { chain, source, isCurrent };
    }
    async function rpcFor(context) {
      const rpc = await options.rpc(context.chain);
      if (!context.isCurrent()) throw new Error('Источник или текущий аккаунт изменились. Повторите действие.');
      return rpc;
    }
    function bindSave() {
      const saveMount = mount.querySelector('#settings-sync-save-mount');
      saveMount.innerHTML = `<form id="settings-sync-save-form" class="stacked-form"><p>Сохранение публикует полные списки и имена аккаунтов из настроек навсегда. Не добавляйте секреты в списки.</p><button type="submit" name="intent" value="send">Сохранить в блокчейн</button><div data-operation-result class="operation-result" role="status" aria-live="polite"></div></form>`;
      const boundChain = chainEl.value;
      options.bindSave(boundChain, 'settings-sync-save-form', async () => {
        const context = capture();
        if (context.chain !== boundChain || !context.source || context.source !== login()) throw new Error('Для сохранения выберите текущий авторизованный аккаунт этой сети.');
        const snapshot = sync.exportSnapshot();
        let previous = 0;
        if (context.chain === 'viz') {
          const rpc = await rpcFor(context);
          try { previous = (await sync.latest(context.chain, context.source, rpc, {isCurrent: context.isCurrent})).block; }
          catch (error) { if (!/не найдены/.test(error.message)) throw error; }
        }
        if (!context.isCurrent()) throw new Error('Источник изменился.');
        const prepared = options.prepare(context.chain, context.source, sync.encoded(snapshot, context.chain === 'viz' ? previous : undefined));
        prepared.beforeBroadcast = () => { if (!context.isCurrent() || context.source !== login()) throw new Error('Страница, источник или текущий аккаунт изменились. Отправка отменена.'); };
        return prepared;
      });
    }
    function invalidate() { generation++; status.textContent = ''; }
    chainEl.addEventListener('change', () => { invalidate(); sourceEl.value = login() || ''; bindSave(); });
    sourceEl.addEventListener('input', invalidate);
    bindSave();
    readButton.addEventListener('click', async () => {
      const context = capture();
      readButton.disabled = true; status.textContent = 'Читаю последний снимок…';
      try {
        const rpc = await rpcFor(context);
        const result = await sync.latest(context.chain, context.source, rpc, {isCurrent: context.isCurrent});
        if (!context.isCurrent()) return;
        if (!global.confirm('Заменить все три группы настроек последним снимком? Пустые списки удалят старые настройки. Аккаунты, ключи, история и разрешения запуска сохранятся.')) return;
        sync.replace(result.snapshot, {isCurrent: context.isCurrent});
        options.refreshRuntime(result.snapshot);
        // This bridge updates preference parameters only. It cannot add accounts,
        // import keys, grant automation or start/stop an existing worker.
        if (global.DposNative?.available()) {
          try {
            const native = await global.DposNative.request('replaceSettingsPreferences', result.snapshot);
            if (!native?.ok) throw new Error('native preferences rejected');
          } catch (error) {
            throw new Error('Локальные настройки заменены, но Android не обновил параметры. Обновите APK и повторите синхронизацию.');
          }
        }
        if (context.isCurrent()) status.textContent = 'Настройки заменены последним снимком. Автоматизация не запускалась; разрешения устройства сохранены.';
      } catch (error) { if (context.isCurrent()) status.textContent = options.formatError(error); }
      finally { if (options.isCurrent()) readButton.disabled = false; }
    });
  }
  global.DposSettingsSyncUI = Object.freeze({ render });
})(window);
