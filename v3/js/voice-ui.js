(function (global) {
  'use strict';
  const doc = global.document;
  const api = () => global.DposVoice;
  const messages = new WeakMap();
  function setText(node, value) { if (messages.get(node) !== value) { messages.set(node, value); node.textContent = value; } }
  function element(tag, text, attrs) {
    const node = doc.createElement(tag);
    if (text) node.textContent = text;
    Object.entries(attrs || {}).forEach(([key, value]) => node.setAttribute(key, value));
    return node;
  }
  function button(text, handler) {
    const node = element('button', text, { type: 'button' }); node.addEventListener('click', handler); return node;
  }
  function labeled(root, text, node) {
    const label = element('label', text); label.appendChild(node); root.appendChild(label); return node;
  }
  function lifecycle(root, fn) {
    const unsubscribe = api().subscribe(value => { if (root.isConnected) fn(value); });
    let observer;
    function dispose() {
      unsubscribe(); if (observer) observer.disconnect(); global.removeEventListener('hashchange', route); global.removeEventListener('dpos-vault-lock', lock);
    }
    function route() { dispose(); }
    function lock() { root.querySelectorAll('input[type="password"]').forEach(input => { input.value = ''; }); }
    global.addEventListener('hashchange', route); global.addEventListener('dpos-vault-lock', lock);
    if (global.MutationObserver) { observer = new global.MutationObserver(() => { if (!root.isConnected) dispose(); }); observer.observe(doc.body, { childList: true, subtree: true }); }
    return dispose;
  }
  function settings(root) {
    const section = element('section', '', { class: 'stacked-form' });
    section.appendChild(element('h3', 'Настройки: Голосовой ввод и ИИ'));
    section.appendChild(element('p', 'Groq: whisper-large-v3 и openai/gpt-oss-120b. Ключ хранится зашифрованно только на этом устройстве. Запись отправляется в Groq только по кнопке «Распознать».'));
    const key = labeled(section, 'API-ключ Groq', element('input', '', { type: 'password', autocomplete: 'new-password', spellcheck: 'false', 'aria-label': 'API-ключ Groq' }));
    const stored = element('p'); section.appendChild(stored);
    const mode = labeled(section, 'Режим распознавания', element('select', '', { 'aria-label': 'Режим распознавания' }));
    mode.append(element('option', 'Исходный текст', { value: 'raw' }), element('option', 'Оформленный текст', { value: 'formatted' }));
    const status = element('p', '', { role: 'status', 'aria-live': 'polite' });
    let pending = false, ready = false;
    async function action(fn, success) {
      if (pending || !ready) return; pending = true; update(api().status());
      try { await fn(); setText(status, success); }
      catch (_) { setText(status, 'Не удалось выполнить действие. Разблокируйте хранилище, проверьте ключ и соединение. Секреты не отображаются.'); }
      finally { key.value = ''; pending = false; update(api().status()); }
    }
    const keyChanging = () => global.dispatchEvent(new global.Event('dpos-service-key-change'));
    const save = button('Сохранить настройки', () => action(async () => { const value = key.value.trim(); key.value = ''; if (value) keyChanging(); await api().saveSettings(value, mode.value); }, 'Настройки сохранены.'));
    const check = button('Проверить соединение', () => action(() => api().checkConnection(), 'Соединение с Groq проверено.'));
    const remove = button('Удалить ключ', () => action(() => { keyChanging(); return api().deleteKey(); }, 'Ключ удалён.'));
    section.append(save, check, remove, status); root.appendChild(section);
    let modeTouched = false; mode.addEventListener('change', () => { modeTouched = true; });
    function update(s) {
      setText(stored, s.hasKey ? 'Ключ сохранён. Поле оставлено пустым.' : 'Ключ не сохранён или хранилище заблокировано.');
      if (!modeTouched) mode.value = s.mode;
      [key, mode, save, check, remove].forEach(node => { node.disabled = pending || !ready || !s.supported || s.state === 'recognizing'; });
      if (!s.supported) setText(status, s.error);
    }
    lifecycle(section, update); api().init().then(() => { ready = true; update(api().status()); });
    return section;
  }
  function mountEditor(root, options) {
    if (!root || !['golos', 'steem', 'hive'].includes(options.chain.id) || root.querySelector('[data-voice-tabs]')) return;
    const existing = Array.from(root.childNodes);
    const tabs = element('div', '', { role: 'tablist', 'aria-label': 'Редактор публикации', 'data-voice-tabs': '' });
    const editor = element('div', '', { role: 'tabpanel', id: 'voice-editor-panel', 'aria-labelledby': 'voice-editor-tab' });
    const voice = element('section', '', { role: 'tabpanel', id: 'voice-input-panel', 'aria-labelledby': 'voice-input-tab', class: 'panel' });
    existing.forEach(node => editor.appendChild(node)); root.append(tabs, editor, voice);
    const first = button('Редактор', () => select(0)); const second = button('Голос в текст', () => select(1));
    [first, second].forEach((tab, i) => { tab.id = i ? 'voice-input-tab' : 'voice-editor-tab'; tab.setAttribute('role', 'tab'); tab.setAttribute('aria-controls', i ? voice.id : editor.id); tabs.appendChild(tab); });
    function select(index, focus) {
      [first, second].forEach((tab, i) => { tab.setAttribute('aria-selected', String(i === index)); tab.tabIndex = i === index ? 0 : -1; });
      editor.hidden = index !== 0; voice.hidden = index !== 1;
      if (focus) [first, second][index].focus();
    }
    tabs.addEventListener('keydown', event => {
      const current = doc.activeElement === second ? 1 : 0;
      const index = { ArrowRight: 1 - current, ArrowLeft: 1 - current, Home: 0, End: 1 }[event.key];
      if (index !== undefined) { event.preventDefault(); select(index, true); }
    });
    select(0);
    voice.appendChild(element('h3', 'Голос в текст'));
    voice.appendChild(element('p', 'Запись хранится локально до удаления. В браузере запись надёжна только пока вкладка открыта; блокировка экрана может её прервать. Переход в другой раздел останавливает и сохраняет браузерную запись. В Android записью управляет приложение.'));
    const status = element('p', 'Проверка голосового ввода…', { role: 'status', 'aria-live': 'polite' }); voice.appendChild(status);
    let ready = false, pending = false, localError = '';
    async function action(fn) {
      if (pending || !ready) return; pending = true; localError = ''; update(api().status());
      try { await fn(); } catch (error) { localError = (error.voiceSafe ? error.message : api().status().error) || 'Действие не выполнено. Проверьте состояние записи и настройки.'; }
      finally { pending = false; update(api().status()); }
    }
    const controls = element('div');
    const start = button('Начать запись', () => action(() => api().start()));
    const pause = button('Пауза', () => action(() => api().pause()));
    const resume = button('Продолжить запись', () => action(() => api().resume()));
    const stop = button('Остановить запись', () => action(() => api().stop()));
    const remove = button('Удалить', () => action(() => api().remove()));
    const recognize = button('Распознать', () => action(() => api().recognize(mode.value)));
    controls.append(start, pause, resume, stop, remove, recognize); voice.appendChild(controls);
    const mode = labeled(voice, 'Режим распознавания', element('select', '', { 'aria-label': 'Режим распознавания' }));
    mode.append(element('option', 'Исходный текст', { value: 'raw' }), element('option', 'Оформленный текст', { value: 'formatted' }));
    let modeTouched = false; mode.addEventListener('change', () => { modeTouched = true; });
    const preview = labeled(voice, 'Результат — можно исправить перед переносом', element('textarea', '', { rows: '12', 'aria-label': 'Результат — можно исправить перед переносом' }));
    const raw = labeled(voice, 'Исходная расшифровка', element('textarea', '', { rows: '6', readonly: '', 'aria-label': 'Исходная расшифровка' }));
    let renderedResult = '', transferred = false, caret = null;
    const body = root.querySelector('#editor-body');
    if (body) ['select', 'keyup', 'click', 'blur', 'input'].forEach(name => body.addEventListener(name, () => { caret = body.selectionStart; }));
    const transfer = button('Перенести в редактор', () => {
      if (transferred || !body || !preview.value.trim()) return;
      transferred = true; transfer.disabled = true;
      const position = Math.max(0, Math.min(caret === null ? body.value.length : caret, body.value.length));
      const addition = (position && !/\s$/.test(body.value.slice(0, position)) ? '\n\n' : '') + preview.value + (position < body.value.length ? '\n\n' : '');
      body.value = body.value.slice(0, position) + addition + body.value.slice(position);
      body.dispatchEvent(new global.Event('input', { bubbles: true }));
      select(0); if (options.openEditor) options.openEditor(first); body.focus();
      body.setSelectionRange(position + addition.length, position + addition.length);
    });
    preview.addEventListener('input', () => { transfer.disabled = transferred || !preview.value.trim(); });
    const restoreRaw = button('Использовать исходную расшифровку', () => { preview.value = raw.value; transfer.disabled = transferred || !preview.value.trim(); });
    voice.append(restoreRaw, transfer);
    const details = element('details', '', { class: 'subpanel' }); details.appendChild(element('summary', 'Настройки голосового ввода')); voice.appendChild(details); settings(details);
    function update(s) {
      const names = { idle: 'Готов к записи.', permission: 'Разрешите доступ к микрофону.', recording: 'Идёт запись.', paused: 'Запись на паузе.', stopping: 'Сохранение записи…', ready: 'Запись остановлена. Удалите или распознайте.', recognizing: 'Распознавание… Не повторяйте запрос.' };
      setText(status, [localError || s.error || names[s.state], s.bytes && !['recording', 'paused'].includes(s.state) ? Math.ceil(s.bytes / 1024) + ' КиБ' : '', s.storageError].filter(Boolean).join(' '));
      const active = s.state === 'recording' || s.state === 'paused';
      start.hidden = s.state !== 'idle'; pause.hidden = s.state !== 'recording'; resume.hidden = s.state !== 'paused'; stop.hidden = !active;
      remove.hidden = recognize.hidden = s.state !== 'ready';
      [start, pause, resume, stop, remove, recognize, mode].forEach(node => { node.disabled = pending || !ready || !s.supported; });
      if (!modeTouched) mode.value = s.mode;
      if (s.result !== renderedResult) { renderedResult = s.result; preview.value = s.result; transferred = false; }
      if (raw.value !== s.transcript) raw.value = s.transcript;
      preview.hidden = transfer.hidden = restoreRaw.hidden = !s.result; raw.hidden = !s.transcript;
      transfer.disabled = transferred || !preview.value.trim() || pending;
      restoreRaw.disabled = !s.transcript || pending;
    }
    lifecycle(voice, update); api().init().then(() => { ready = true; update(api().status()); });
  }
  function renderSettings(root) {
    root.replaceChildren(); const panel = element('section', '', { class: 'panel' }); root.appendChild(panel); settings(panel);
  }
  global.DposVoiceUI = Object.freeze({ mountEditor, renderSettings });
})(window);
