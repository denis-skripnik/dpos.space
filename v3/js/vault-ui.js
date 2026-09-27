(function exposeVaultScreen(global) {
  'use strict';
  const vault = global.DposVault;
  let busy = false;
  function announce(message) {
    const element = document.getElementById('vault-message');
    if (element) element.textContent = message;
  }
  function signalReady() {
    const root = document.getElementById('app');
    if (root) delete root.dataset.vaultScreen;
    global.dispatchEvent(new global.CustomEvent('dpos-vault-ready'));
  }
  function guard(options = {}) {
    if (!vault) throw new Error('Не загрузилась защита аккаунтов. Обновите страницу.');
    const state = vault.status();
    const navigation = document.getElementById('route-form');
    if (navigation) navigation.inert = state.state !== 'unlocked' && !(state.state === 'empty' && !options.requireSetup);
    const lockButton = document.getElementById('vault-lock');
    if (lockButton) lockButton.hidden = state.state !== 'unlocked';
    if (state.state === 'unlocked' || (state.state === 'empty' && !options.requireSetup)) return true;
    const root = document.getElementById('app');
    if (!root) return false;
    if (root.dataset.vaultScreen === state.state) return false;
    root.dataset.vaultScreen = state.state;
    const locked = state.state === 'locked';
    const broken = state.state === 'error';
    const passkeyOnly = locked && state.method === 'passkey-prf';
    const supportsPasskey = Boolean(global.PublicKeyCredential && global.navigator && global.navigator.credentials);
    root.innerHTML = `<section class="panel" aria-labelledby="vault-title">
      <h2 id="vault-title" tabindex="-1">${locked ? 'Разблокировать аккаунты' : broken ? 'Не удалось открыть хранилище' : 'Защитить сохранённые аккаунты'}</h2>
      <p>${locked ? 'Разблокировка действует до закрытия или блокировки этой вкладки. Повторно вводить ключи не нужно.' : broken ? 'Данные не удалены. Не очищайте хранилище браузера. Если у вас есть резервная копия, её можно восстановить на другом устройстве.' : 'Создайте новый пароль или выберите passkey. Существующие аккаунты и настройки сохранятся; повторно вводить ключи и seed-фразы не нужно.'}</p>
      ${broken ? '' : `<form id="vault-form" class="stacked-form">
        ${passkeyOnly ? '' : `<div class="field"><label for="vault-password">${locked ? 'Пароль аккаунтов' : 'Новый пароль аккаунтов — не менее 12 символов'}</label><input id="vault-password" type="password" autocomplete="${locked ? 'current-password' : 'new-password'}" ${locked ? '' : 'minlength="12"'}></div>
        ${locked ? '' : '<div class="field"><label for="vault-repeat">Повторите новый пароль</label><input id="vault-repeat" type="password" autocomplete="new-password"></div>'}
        <button type="submit" value="password">${locked ? 'Разблокировать' : 'Защитить и продолжить'}</button>`}
        ${passkeyOnly || (!locked && supportsPasskey) ? `<button type="submit" value="passkey" formnovalidate>${locked ? 'Разблокировать с passkey' : 'Использовать passkey'}</button>` : ''}
        ${!locked ? '<p>Сохраните пароль или доступ к passkey. После переноса создайте резервную копию в разделе «Резервное копирование». При потере единственного способа разблокировки доступ к ключам может быть утрачен.</p><p>Если passkey не поддерживает шифрование или системный диалог отменён, выберите пароль. До проверки переноса старые данные не удаляются.</p>' : ''}
      </form>`}
      <p id="vault-message" role="status" aria-live="polite"></p>
    </section>`;
    const heading = document.getElementById('vault-title');
    if (heading && typeof heading.focus === 'function') heading.focus();
    const form = document.getElementById('vault-form');
    if (!broken && form) form.addEventListener('submit', async event => {
      event.preventDefault();
      if (busy) return;
      const passkey = event.submitter && event.submitter.value === 'passkey';
      const passwordInput = document.getElementById('vault-password');
      const repeatInput = document.getElementById('vault-repeat');
      const password = passwordInput ? passwordInput.value : '';
      if (!passkey && !locked && password.length < 12) { announce('Создайте пароль длиной не менее 12 символов.'); return; }
      if (!passkey && !locked && global.DposV3 && global.DposV3.backup) {
        const validation = global.DposV3.backup.validateBackupPassword(password);
        if (!validation.ok) { announce(validation.errors.join(' ')); return; }
      }
      if (!passkey && !locked && (!repeatInput || repeatInput.value !== password)) { announce('Пароли не совпадают. Проверьте оба поля.'); return; }
      busy = true;
      const buttons = Array.from(form.querySelectorAll('button'));
      buttons.forEach(button => { button.disabled = true; });
      announce(locked ? 'Разблокирую…' : 'Защищаю аккаунты и проверяю сохранение…');
      try {
        const args = passkey ? { passkey: true } : { password };
        if (locked) await vault.unlock(args);
        else if (state.state === 'legacy') await vault.migrate(args);
        else await vault.setup(args);
        if (passwordInput) passwordInput.value = '';
        if (repeatInput) repeatInput.value = '';
        announce('Аккаунты готовы к работе.');
        signalReady();
      } catch (error) {
        // Only the vault's controlled messages; never print submitted secrets.
        announce(error && error.message || 'Не удалось открыть аккаунты. Данные не удалены.');
      } finally {
        busy = false;
        buttons.forEach(button => { button.disabled = false; });
      }
    });
    return false;
  }
  function lock() {
    if (global.DposV3 && typeof global.DposV3.cancelAllBrowserAutomation === 'function') global.DposV3.cancelAllBrowserAutomation();
    vault.lock();
    const root = document.getElementById('app');
    if (root) delete root.dataset.vaultScreen;
    guard({ requireSetup: true });
  }
  const button = document.getElementById('vault-lock');
  if (button) button.addEventListener('click', lock);
  global.addEventListener('storage', event => {
    if (event.key === vault.storageKeys?.active && vault.status().state !== 'unlocked') {
      if (global.DposV3 && typeof global.DposV3.cancelAllBrowserAutomation === 'function') global.DposV3.cancelAllBrowserAutomation();
      guard({ requireSetup: true });
    }
  });
  global.addEventListener('dpos-vault-lock', () => {
    const root = document.getElementById('app');
    if (root) delete root.dataset.vaultScreen;
    guard({ requireSetup: true });
  });
  global.DposVaultUI = Object.freeze({ guard, lock });
})(window);
