(function exposeDposPwa(global) {
  'use strict';

  const SERVICE_WORKER_PATH = '/sw.js';
  const PANEL_DISMISSED_KEY = 'dpos_pwa_panel_dismissed';
  let deferredInstallPrompt = null;
  let registrationPromise = null;
  let lastVisibilityNoticeAt = 0;

  function isStandalone() {
    return Boolean(global.matchMedia && global.matchMedia('(display-mode: standalone)').matches)
      || Boolean(global.navigator && global.navigator.standalone);
  }

  function supportsInstall() {
    return 'serviceWorker' in (global.navigator || {}) && global.isSecureContext;
  }

  function notificationPermission() {
    return 'Notification' in global ? global.Notification.permission : 'unsupported';
  }

  function canNotify() {
    return 'Notification' in global && global.Notification.permission === 'granted';
  }

  function registerServiceWorker() {
    if (registrationPromise) return registrationPromise;
    if (!supportsInstall()) {
      registrationPromise = Promise.resolve({ ok: false, reason: 'Service Worker доступен только на HTTPS или localhost.' });
      return registrationPromise;
    }
    registrationPromise = global.navigator.serviceWorker.register(SERVICE_WORKER_PATH)
      .then((registration) => ({ ok: true, registration }))
      .catch((error) => ({ ok: false, reason: error && error.message ? error.message : String(error) }));
    return registrationPromise;
  }

  async function requestNotificationPermission() {
    if (!('Notification' in global)) return 'unsupported';
    if (global.Notification.permission === 'granted') return 'granted';
    if (global.Notification.permission === 'denied') return 'denied';
    return global.Notification.requestPermission();
  }

  function nativeAndroidBridge() {
    return global.DposAndroid && typeof global.DposAndroid.notify === 'function' ? global.DposAndroid : null;
  }

  function routeFromNotifyOptions(options) {
    const data = options && options.data || {};
    const url = data.url || (global.location && global.location.href) || '';
    const hashIndex = String(url).indexOf('#');
    if (hashIndex >= 0) return String(url).slice(hashIndex);
    return global.location && global.location.hash ? global.location.hash : '#';
  }

  async function notify(title, options) {
    const body = options && options.body ? String(options.body) : '';
    const tag = options && options.tag ? String(options.tag) : undefined;
    const bridge = nativeAndroidBridge();
    if (bridge) {
      bridge.notify(String(title || 'DPoS Space'), body, tag || 'dpos-space', routeFromNotifyOptions(options));
      return true;
    }
    if (!canNotify()) return false;
    const icon = options && options.icon ? options.icon : '/v3/assets/icons/dpos-space-192.png';
    const badge = options && options.badge ? options.badge : '/v3/assets/icons/dpos-space-192.png';
    const data = Object.assign({ url: global.location && global.location.href }, options && options.data || {});
    const payload = { body, tag, icon, badge, data, renotify: Boolean(options && options.renotify) };
    const result = await registerServiceWorker();
    if (result.ok && result.registration && typeof result.registration.showNotification === 'function') {
      await result.registration.showNotification(title, payload);
      return true;
    }
    // Fallback for browsers without SW notification bridge.
    // eslint-disable-next-line no-new
    new global.Notification(title, payload);
    return true;
  }

  function foregroundRuntimeMessage(activeLabel) {
    const state = global.document && global.document.visibilityState === 'hidden'
      ? 'Приложение скрыто: Android/браузер обычно продолжает живой процесс, но может приостановить его для экономии батареи.'
      : 'Приложение открыто: локальные процессы выполняются в этой вкладке/PWA.';
    return `${activeLabel || 'Фоновые функции'} — ${state}`;
  }

  function notifyVisibilityRuntime(activeLabel) {
    const now = Date.now();
    if (now - lastVisibilityNoticeAt < 60000) return;
    lastVisibilityNoticeAt = now;
    if (!global.document || global.document.visibilityState !== 'hidden') return;
    notify('DPoS Space продолжает работу', {
      body: foregroundRuntimeMessage(activeLabel),
      tag: 'dpos-space-foreground-runtime'
    });
  }

  function isPanelDismissed() {
    try {
      return Boolean(global.localStorage && global.localStorage.getItem(PANEL_DISMISSED_KEY) === '1');
    } catch (error) {
      return false;
    }
  }

  function dismissPanel(container) {
    try {
      if (global.localStorage) global.localStorage.setItem(PANEL_DISMISSED_KEY, '1');
    } catch (error) {
      // Ignore storage errors: the close button should still hide the panel in this view.
    }
    if (container) {
      container.hidden = true;
      container.innerHTML = '';
    }
  }

  function renderPanel(container) {
    if (!container) return;
    if (isPanelDismissed()) {
      container.hidden = true;
      container.innerHTML = '';
      return;
    }
    container.hidden = false;
    const swText = supportsInstall() ? 'поддерживается' : 'нужен HTTPS или localhost';
    const installText = isStandalone() ? 'установлено / standalone' : (deferredInstallPrompt ? 'можно установить' : 'если браузер предложит установку, кнопка станет активной');
    const permission = notificationPermission();
    container.innerHTML = `
      <section class="panel pwa-panel" aria-labelledby="pwa-panel-heading">
        <div class="pwa-panel-header">
          <h2 id="pwa-panel-heading">Приложение и уведомления</h2>
          <button type="button" class="secondary pwa-panel-close" data-pwa-dismiss aria-label="Скрыть блок про установку приложения и уведомления">Закрыть</button>
        </div>
        <p>DPoS Space можно установить как PWA. Локальные процессы, например автоапвоутер, работают пока приложение/вкладка живы; после полного закрытия работа не обещается.</p>
        <ul>
          <li>Service Worker: ${escapeHtml(swText)}</li>
          <li>Установка: ${escapeHtml(installText)}</li>
          <li>Уведомления: ${escapeHtml(permission)}</li>
        </ul>
        <p>
          <button type="button" data-pwa-install${deferredInstallPrompt ? '' : ' disabled'}>Установить приложение</button>
          <button type="button" data-pwa-notifications>Включить локальные уведомления</button>
        </p>
        <p class="muted">Это не Web Push и не серверный фон: уведомления приходят от открытого приложения/PWA.</p>
      </section>`;
    const dismissButton = container.querySelector('[data-pwa-dismiss]');
    if (dismissButton) {
      dismissButton.addEventListener('click', () => dismissPanel(container));
    }
    const installButton = container.querySelector('[data-pwa-install]');
    if (installButton) {
      installButton.addEventListener('click', async () => {
        if (!deferredInstallPrompt) return;
        deferredInstallPrompt.prompt();
        await deferredInstallPrompt.userChoice.catch(() => null);
        deferredInstallPrompt = null;
        renderPanel(container);
      });
    }
    const notifyButton = container.querySelector('[data-pwa-notifications]');
    if (notifyButton) {
      notifyButton.addEventListener('click', async () => {
        const result = await requestNotificationPermission();
        if (result === 'granted') {
          await notify('DPoS Space уведомления включены', {
            body: 'Локальные уведомления будут показываться, пока приложение или вкладка работает.',
            tag: 'dpos-space-notifications-enabled'
          });
        }
        renderPanel(container);
      });
    }
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function init(container) {
    registerServiceWorker().then(() => renderPanel(container));
    global.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      deferredInstallPrompt = event;
      renderPanel(container);
    });
    global.addEventListener('appinstalled', () => {
      deferredInstallPrompt = null;
      renderPanel(container);
    });
    if (global.document && typeof global.document.addEventListener === 'function') {
      global.document.addEventListener('visibilitychange', () => renderPanel(container));
    }
    renderPanel(container);
  }

  global.DposPwa = Object.freeze({
    init,
    isStandalone,
    registerServiceWorker,
    requestNotificationPermission,
    notificationPermission,
    canNotify,
    notify,
    foregroundRuntimeMessage,
    notifyVisibilityRuntime
  });
})(window);
