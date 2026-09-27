(function exposeNotificationInbox(global) {
  'use strict';
  let capability;
  const escape = value => String(value == null ? '' : value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]));
  async function nativeAvailable() {
    const bridge = global.DposNative;
    if (!bridge || !bridge.available()) return false;
    if (!capability) capability = bridge.request('getAppInfo', {}).then(info => info.notificationInbox === true).catch(error => { capability = null; throw error; });
    return capability;
  }
  async function read() {
    if (await nativeAvailable()) {
      const result = await global.DposNative.request('getNotificationInbox', {});
      if (!result || result.ok !== true || !Number.isSafeInteger(result.unreadCount) || result.unreadCount < 0 || !Array.isArray(result.events)) throw new Error('Не удалось получить уведомления Android.');
      return { native: true, unreadCount: result.unreadCount, events: result.events.filter(row => row && !row.read).slice(0, 1000) };
    }
    const events = global.DposNotifications ? global.DposNotifications.filteredNotifications() : [];
    return { native: false, unreadCount: events.length, events };
  }
  async function markAllRead() {
    if (await nativeAvailable()) {
      const result = await global.DposNative.request('markAllNotificationsRead', {});
      if (!result || result.ok !== true) throw new Error('Не удалось отметить уведомления Android прочитанными.');
    }
    // Do not claim a successful read locally when native acknowledgement failed.
    if (global.DposNotifications) global.DposNotifications.markAllRead();
  }
  async function render(container, options = {}) {
    const current = typeof options.isCurrent === 'function' ? options.isCurrent : () => true;
    container.innerHTML = '<section class="panel"><h2>Уведомления всех блокчейнов</h2><p>Открытие страницы не отмечает уведомления прочитанными.</p><p><strong>Непрочитанных:</strong> <span data-inbox-count>…</span></p><p><button type="button" data-inbox-refresh>Обновить</button> <button type="button" data-inbox-read>Отметить всё прочитанным</button></p><p data-inbox-status role="status" aria-live="polite"></p><div data-inbox-events></div></section>';
    const count = container.querySelector('[data-inbox-count]');
    const status = container.querySelector('[data-inbox-status]');
    const list = container.querySelector('[data-inbox-events]');
    const refresh = container.querySelector('[data-inbox-refresh]');
    const acknowledge = container.querySelector('[data-inbox-read]');
    let busy = false;
    async function update(markRead) {
      if (busy || !current()) return;
      busy = true; refresh.disabled = true; acknowledge.disabled = true;
      try {
        if (markRead) await markAllRead();
        if (!current()) return;
        const snapshot = await read();
        if (!current()) return;
        count.textContent = String(snapshot.unreadCount);
        status.textContent = snapshot.unreadCount > snapshot.events.length
          ? 'Показаны последние сохранённые события. Счётчик включает все непрочитанные уведомления.'
          : markRead && snapshot.unreadCount === 0 ? 'Все уведомления отмечены прочитанными.' : '';
        list.innerHTML = snapshot.events.length ? '<ul class="notifications-list notifications-list-full">' + snapshot.events.map(event => {
          const route = String(event.route || event.url || '');
          const href = route.startsWith('#') ? route : '#app=notifications';
          return `<li><a href="${escape(href)}"><strong>${escape(event.title || 'Уведомление')}</strong><br><span data-i18n-skip>${escape(event.text || '')}</span></a></li>`;
        }).join('') + '</ul>' : '<p>Непрочитанных уведомлений нет.</p>';
      } catch (error) {
        if (current()) status.textContent = markRead ? 'Не удалось отметить уведомления прочитанными. Повторите попытку.' : 'Не удалось получить уведомления. Повторите попытку.';
      } finally {
        busy = false;
        if (current()) { refresh.disabled = false; acknowledge.disabled = false; }
      }
    }
    refresh.addEventListener('click', () => { void update(false); });
    acknowledge.addEventListener('click', () => { void update(true); });
    await update(false);
  }
  global.DposNotificationInbox = Object.freeze({ read, markAllRead, render });
})(window);
