(function bootstrapDposV3(global) {
  'use strict';

  const chains = global.DposChains;
  const auth = global.DposAuth;
  const broadcast = global.DposBroadcast;
  const profiles = global.DposProfiles;
  const history = global.DposHistory;
  const notifications = global.DposNotifications;
  const pwa = global.DposPwa;
  const chainSelect = document.getElementById('chain-select');
  const appSelect = document.getElementById('app-select');
  const routeForm = document.getElementById('route-form');
  const accountInput = document.getElementById('account-input');
  const accountField = accountInput ? accountInput.closest('.field') : null;
  const recentAccountList = document.getElementById('recent-account-list');
  const accountSelectField = document.getElementById('account-select-field');
  const accountSelect = document.getElementById('account-select');
  const statusEl = document.getElementById('status');
  const appEl = document.getElementById('app');
  const notificationsPanel = document.getElementById('notifications-panel');
  const pwaPanel = document.getElementById('pwa-panel');
  let notificationsController = null;
  const loadedScripts = new Set();
  const LONG_API_BASE = '/api/smartfarm';
  const LONG_FARMING_SENDER = 'Mx01029d73e128e2f53ff1fcc2d52a423283ad9439';
  const MINTER_LONG_POOL_URL = 'https://api-minter.mnst.club/v2/swap_pool/0/2782';
  const IMGUR_CLIENT_ID = '372d5f766d47d1d';
  const RECENT_ACCOUNT_LIMIT = 15;

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function setStatus(message, state) {
    statusEl.textContent = message;
    statusEl.dataset.state = state || 'info';
  }

  function safeMarkdownUrl(value) {
    const raw = String(value || '').trim();
    if (!raw) return '#';
    if (/^(https?:|mailto:)/i.test(raw)) return raw;
    if (/^[./#]/.test(raw)) return raw;
    return '#';
  }

  function normalizeAutolinkUrl(value) {
    let normalized = String(value || '');
    for (let index = 0; index < 3; index += 1) {
      const next = normalized
        .replace(/&amp;/gi, '&')
        .replace(/&#0*38;/gi, '&')
        .replace(/&#x0*26;/gi, '&');
      if (next === normalized) break;
      normalized = next;
    }
    return normalized;
  }

  function autolinkPlainText(value, chain) {
    const text = String(value || '');
    const linkedUrls = text.replace(/https:\/\/[^\s<]+/gi, (rawUrl) => {
      const suffixMatch = rawUrl.match(/[.,!?;:)\]]+$/);
      const suffix = suffixMatch ? suffixMatch[0] : '';
      const rawUrlWithoutSuffix = suffix ? rawUrl.slice(0, -suffix.length) : rawUrl;
      const url = normalizeAutolinkUrl(rawUrlWithoutSuffix);
      if (!url) return rawUrl;
      const safeUrl = escapeHtml(safeMarkdownUrl(url));
      return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${escapeHtml(url)}</a>${escapeHtml(suffix)}`;
    });
    if (!chain || !chain.id) return linkedUrls;
    return linkedUrls.replace(/(^|[^\w./:@-])@([a-z][a-z0-9.-]{1,15})(?=$|[^\w.-])/gi, (match, prefix, login) => {
      const normalized = String(login || '').toLowerCase();
      const href = escapeHtml(appHash({ chain: chain.id, app: 'profiles', account: normalized }));
      return `${prefix}<a href="${href}">@${escapeHtml(login)}</a>`;
    });
  }

  function autolinkHtmlText(html, chain) {
    const parts = String(html || '').split(/(<[^>]+>)/g);
    let skipDepth = 0;
    return parts.map((part) => {
      if (!part) return part;
      if (part.startsWith('<')) {
        if (/^<(a|code)\b/i.test(part)) skipDepth += 1;
        if (/^<\/(a|code)>/i.test(part) && skipDepth > 0) skipDepth -= 1;
        return part;
      }
      return skipDepth ? part : autolinkPlainText(part, chain);
    }).join('');
  }

  function renderInlineMarkdown(value, chain) {
    let text = escapeHtml(value);
    text = text.replace(/&lt;br\s*\/?&gt;/gi, '<br>');
    text = text.replace(/!\[([^\]]*)\]\(([^\s)]+)\)/g, (match, alt, url) => `<img src="${escapeHtml(safeMarkdownUrl(url))}" alt="${escapeHtml(alt)}" loading="lazy">`);
    text = text.replace(/\[([^\]]+)\]\(([^\s)]+)\)/g, (match, label, url) => `<a href="${escapeHtml(safeMarkdownUrl(url))}" target="_blank" rel="noopener noreferrer">${label}</a>`);
    text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
    text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/(^|\s)\*([^*]+)\*/g, '$1<em>$2</em>');
    return autolinkHtmlText(text, chain);
  }

  function markdownToTextPreview(markdown, limit = 280) {
    const text = String(markdown || '')
      .replace(/<br\s*\/?\s*>/gi, ' ')
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/[#>*_`|~-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!text) return 'Текст анонса отсутствует.';
    return text.length > limit ? `${text.slice(0, limit).trim()}…` : text;
  }

  function markdownToPreviewHtml(markdown, chain) {
    const lines = String(markdown || '').replace(/\r\n?/g, '\n').split('\n');
    const html = [];
    let listType = '';
    let inCode = false;
    const closeList = () => {
      if (listType) html.push(`</${listType}>`);
      listType = '';
    };
    const tableCells = (line) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim());
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const trimmed = line.trim();
      if (trimmed.startsWith('```')) {
        closeList();
        html.push(inCode ? '</code></pre>' : '<pre><code>');
        inCode = !inCode;
        continue;
      }
      if (inCode) {
        html.push(`${escapeHtml(line)}\n`);
        continue;
      }
      if (!trimmed) {
        closeList();
        continue;
      }
      if (/^---+$/.test(trimmed)) {
        closeList();
        html.push('<hr>');
        continue;
      }
      if (/^\|.+\|$/.test(trimmed) && /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(lines[index + 1] || '')) {
        closeList();
        const headers = tableCells(trimmed);
        const rows = [];
        index += 2;
        while (index < lines.length && /^\|.+\|$/.test(lines[index].trim())) {
          rows.push(tableCells(lines[index]));
          index += 1;
        }
        index -= 1;
        html.push(`<div class="table-wrap"><table><thead><tr>${headers.map((cell) => `<th>${renderInlineMarkdown(cell, chain)}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr>${headers.map((unused, cellIndex) => `<td>${renderInlineMarkdown(row[cellIndex] || '', chain)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
        continue;
      }
      const heading = trimmed.match(/^(#{1,6})\s+(.+)$/);
      if (heading) {
        closeList();
        const level = heading[1].length;
        html.push(`<h${level}>${renderInlineMarkdown(heading[2], chain)}</h${level}>`);
        continue;
      }
      const quote = trimmed.match(/^>\s?(.+)$/);
      if (quote) {
        closeList();
        html.push(`<blockquote>${renderInlineMarkdown(quote[1], chain)}</blockquote>`);
        continue;
      }
      const unordered = trimmed.match(/^[-*+]\s+(.+)$/);
      if (unordered) {
        if (listType !== 'ul') {
          closeList();
          listType = 'ul';
          html.push('<ul>');
        }
        html.push(`<li>${renderInlineMarkdown(unordered[1], chain)}</li>`);
        continue;
      }
      const ordered = trimmed.match(/^\d+[.)]\s+(.+)$/);
      if (ordered) {
        if (listType !== 'ol') {
          closeList();
          listType = 'ol';
          html.push('<ol>');
        }
        html.push(`<li>${renderInlineMarkdown(ordered[1], chain)}</li>`);
        continue;
      }
      closeList();
      html.push(`<p>${renderInlineMarkdown(line, chain)}</p>`);
    }
    closeList();
    if (inCode) html.push('</code></pre>');
    return html.join('\n') || '<p class="muted">Предпросмотр появится после ввода текста.</p>';
  }

  function renderMarkdownEditorField(value) {
    const body = escapeHtml(value || '');
    return `<div class="field markdown-editor" data-markdown-editor>
      <label for="editor-body">Текст поста</label>
      <div class="markdown-toolbar" role="toolbar" aria-label="Панель форматирования Markdown">
        <button type="button" class="secondary" data-md-action="bold" aria-label="Жирный текст, Ctrl+B">Жирный</button>
        <button type="button" class="secondary" data-md-action="italic" aria-label="Курсив, Ctrl+I">Курсив</button>
        <button type="button" class="secondary" data-md-action="heading" aria-label="Заголовок">Заголовок</button>
        <button type="button" class="secondary" data-md-action="quote" aria-label="Цитата">Цитата</button>
        <button type="button" class="secondary" data-md-action="ul" aria-label="Маркированный список">Список</button>
        <button type="button" class="secondary" data-md-action="ol" aria-label="Нумерованный список">1. Список</button>
        <button type="button" class="secondary" data-md-action="link" aria-label="Вставить ссылку, Ctrl+K">Ссылка</button>
        <button type="button" class="secondary" data-md-action="image" aria-label="Вставить изображение по URL">Картинка</button>
        <button type="button" class="secondary" data-md-upload-image aria-controls="editor-image-upload" aria-label="Загрузить фото в пост через Imgur">Загрузить фото</button>
        <button type="button" class="secondary" data-md-action="code" aria-label="Код">Код</button>
        <button type="button" class="secondary" data-md-action="table" aria-label="Таблица">Таблица</button>
        <button type="button" class="secondary" data-md-action="hr" aria-label="Горизонтальная линия">Линия</button>
        <button type="button" data-md-preview aria-expanded="false" aria-controls="editor-preview">Предпросмотр</button>
      </div>
      <input id="editor-image-upload" class="visually-hidden" type="file" accept="image/*" data-md-image-input>
      <textarea id="editor-body" name="body" rows="12" required aria-describedby="editor-markdown-help editor-markdown-status">${body}</textarea>
      <p id="editor-markdown-help" class="muted">Markdown-редактор: кнопки форматируют выделенный текст, поле остаётся обычным textarea. Горячие клавиши: Ctrl+B, Ctrl+I, Ctrl+K. Изображение из буфера обмена можно вставить через Ctrl+V — оно загрузится в Imgur и добавится в место курсора.</p>
      <p id="editor-markdown-status" class="muted" role="status" aria-live="polite">Редактор Markdown готов.</p>
      <div id="editor-preview" class="markdown-preview" hidden aria-live="polite"></div>
    </div>`;
  }

  function insertMarkdown(textarea, before, after, placeholder, mode) {
    const start = textarea.selectionStart || 0;
    const end = textarea.selectionEnd || 0;
    const selected = textarea.value.slice(start, end) || placeholder || '';
    let replacement = '';
    if (mode === 'line-prefix') {
      replacement = selected.split('\n').map((line) => `${before}${line || placeholder || ''}`).join('\n');
    } else if (mode === 'block') {
      replacement = `${before}${selected}${after}`;
    } else {
      replacement = `${before}${selected}${after}`;
    }
    textarea.setRangeText(replacement, start, end, 'end');
    textarea.focus();
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  }

  async function uploadEditorImageToImgur(file) {
    if (!file || !/^image\//.test(file.type || '')) throw new Error('Выберите файл изображения.');
    const formData = new FormData();
    formData.append('image', file);
    const response = await fetch('https://api.imgur.com/3/image.json', {
      method: 'POST',
      headers: { Authorization: `Client-ID ${IMGUR_CLIENT_ID}` },
      body: formData
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload || !payload.success || !payload.data || !payload.data.link) {
      const message = payload && payload.data && payload.data.error ? payload.data.error : 'Imgur не вернул ссылку на изображение.';
      throw new Error(message);
    }
    return payload.data.link;
  }

  function bindMarkdownEditor(root) {
    root.querySelectorAll('[data-markdown-editor]').forEach((editor) => {
      const textarea = editor.querySelector('#editor-body');
      const preview = editor.querySelector('#editor-preview');
      const status = editor.querySelector('#editor-markdown-status');
      const previewButton = editor.querySelector('[data-md-preview]');
      const uploadButton = editor.querySelector('[data-md-upload-image]');
      const imageInput = editor.querySelector('[data-md-image-input]');
      if (!textarea || !preview || !status) return;
      const updatePreview = () => {
        preview.innerHTML = markdownToPreviewHtml(textarea.value);
      };
      const setEditorStatus = (message) => { status.textContent = message; };
      const insertUploadedImage = async (file, source) => {
        if (!file) return;
        const fromClipboard = source === 'clipboard';
        if (uploadButton) uploadButton.disabled = true;
        setEditorStatus(fromClipboard ? 'Загружаю изображение из буфера обмена в Imgur...' : 'Загружаю фото в Imgur...');
        try {
          const link = await uploadEditorImageToImgur(file);
          insertMarkdown(textarea, `![](${link})`, '', '', 'block');
          const previewImageInput = document.getElementById('editor-image');
          if (previewImageInput && !String(previewImageInput.value || '').trim()) previewImageInput.value = link;
          setEditorStatus(fromClipboard ? `Изображение из буфера обмена загружено и вставлено в текст поста: ${link}` : `Фото загружено и вставлено в текст поста: ${link}`);
          if (!preview.hidden) updatePreview();
        } catch (error) {
          setEditorStatus(`${fromClipboard ? 'Не удалось загрузить изображение из буфера обмена' : 'Не удалось загрузить фото'}: ${profiles.formatError(error)}`);
        } finally {
          if (uploadButton) uploadButton.disabled = false;
          if (imageInput) imageInput.value = '';
        }
      };
      editor.querySelectorAll('[data-md-action]').forEach((button) => {
        button.addEventListener('click', () => {
          const action = button.dataset.mdAction;
          if (action === 'bold') insertMarkdown(textarea, '**', '**', 'жирный текст');
          if (action === 'italic') insertMarkdown(textarea, '*', '*', 'курсив');
          if (action === 'heading') insertMarkdown(textarea, '## ', '', 'Заголовок', 'line-prefix');
          if (action === 'quote') insertMarkdown(textarea, '> ', '', 'цитата', 'line-prefix');
          if (action === 'ul') insertMarkdown(textarea, '- ', '', 'пункт списка', 'line-prefix');
          if (action === 'ol') insertMarkdown(textarea, '1. ', '', 'пункт списка', 'line-prefix');
          if (action === 'link') insertMarkdown(textarea, '[', '](https://example.com)', 'текст ссылки');
          if (action === 'image') insertMarkdown(textarea, '![', '](https://example.com/image.jpg)', 'описание изображения');
          if (action === 'code') insertMarkdown(textarea, '`', '`', 'код');
          if (action === 'table') insertMarkdown(textarea, '\n| Заголовок 1 | Заголовок 2 |\n| --- | --- |\n| Текст | Текст |\n', '', '', 'block');
          if (action === 'hr') insertMarkdown(textarea, '\n\n---\n\n', '', '', 'block');
          setEditorStatus(`Вставлено форматирование: ${button.textContent.trim()}.`);
          if (!preview.hidden) updatePreview();
        });
      });
      if (previewButton) {
        previewButton.addEventListener('click', () => {
          const willShow = preview.hidden;
          if (willShow) updatePreview();
          preview.hidden = !willShow;
          previewButton.setAttribute('aria-expanded', willShow ? 'true' : 'false');
          previewButton.textContent = willShow ? 'Скрыть предпросмотр' : 'Предпросмотр';
          setEditorStatus(willShow ? 'Предпросмотр обновлён.' : 'Предпросмотр скрыт.');
        });
      }
      if (uploadButton && imageInput) {
        uploadButton.addEventListener('click', () => imageInput.click());
        imageInput.addEventListener('change', async () => {
          const file = imageInput.files && imageInput.files[0];
          await insertUploadedImage(file, 'file');
        });
      }
      textarea.addEventListener('paste', (event) => {
        const clipboardItems = event.clipboardData && event.clipboardData.items;
        const items = clipboardItems ? Array.from(clipboardItems) : [];
        const imageItem = items.find((item) => item && /^image\//.test(item.type || '') && typeof item.getAsFile === 'function');
        if (!imageItem) return;
        const file = imageItem.getAsFile();
        if (!file) return;
        event.preventDefault();
        insertUploadedImage(file, 'clipboard');
      });
      textarea.addEventListener('input', () => {
        if (!preview.hidden) updatePreview();
      });
      textarea.addEventListener('keydown', (event) => {
        if (!(event.ctrlKey || event.metaKey)) return;
        const key = event.key.toLowerCase();
        if (key === 'b') {
          event.preventDefault();
          insertMarkdown(textarea, '**', '**', 'жирный текст');
        }
        if (key === 'i') {
          event.preventDefault();
          insertMarkdown(textarea, '*', '*', 'курсив');
        }
        if (key === 'k') {
          event.preventDefault();
          insertMarkdown(textarea, '[', '](https://example.com)', 'текст ссылки');
        }
      });
    });
  }

  function parseHash() {
    const raw = global.location.hash.replace(/^#/, '');
    return Object.fromEntries(new URLSearchParams(raw));
  }

  const APP_SCOPED_HASH_PARAMS = ['longPage', 'coin', 'kind', 'value', 'ops', 'query', 'awardPage', 'searchPage', 'searchType', 'feed', 'author', 'permlink', 'parentAuthor', 'parentPermlink'];

  function navigate(nextState) {
    const current = parseHash();
    const params = new URLSearchParams(current);
    const nextChain = nextState.chain || current.chain;
    const nextApp = nextState.app || current.app;
    if ((nextState.chain && nextChain !== current.chain) || (nextState.app && nextApp !== current.app)) {
      APP_SCOPED_HASH_PARAMS.forEach((key) => params.delete(key));
    }
    Object.entries(nextState).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') params.delete(key);
      else params.set(key, value);
    });
    global.location.hash = params.toString();
  }

  function loadScript(src) {
    if (!src) return Promise.resolve();
    const sharedScripts = global.__dposScriptLoads || (global.__dposScriptLoads = new Map());
    if (sharedScripts.has(src)) return sharedScripts.get(src);
    if (loadedScripts.has(src)) return Promise.resolve();
    const existing = document.querySelector && document.querySelector(`script[src="${src}"]`);
    if (existing && existing.dataset && existing.dataset.dposLoaded === 'true') {
      loadedScripts.add(src);
      const resolved = Promise.resolve();
      sharedScripts.set(src, resolved);
      return resolved;
    }
    const promise = new Promise((resolve, reject) => {
      const script = existing || document.createElement('script');
      script.src = src;
      script.async = false;
      script.onload = () => {
        loadedScripts.add(src);
        if (script.dataset) script.dataset.dposLoaded = 'true';
        sharedScripts.set(src, Promise.resolve());
        resolve();
      };
      script.onerror = () => {
        sharedScripts.delete(src);
        reject(new Error(`Не удалось загрузить библиотеку: ${src}`));
      };
      if (!existing) document.head.appendChild(script);
    });
    sharedScripts.set(src, promise);
    return promise;
  }

  function fillChainSelect(selectedChainId) {
    chainSelect.innerHTML = Object.values(chains).map((chain) => (
      `<option value="${escapeHtml(chain.id)}" ${chain.id === selectedChainId ? 'selected' : ''}>${escapeHtml(chain.title)}</option>`
    )).join('');
  }

  function fillAppSelect(chain, selectedAppId) {
    appSelect.innerHTML = chain.apps.map((app) => (
      `<option value="${escapeHtml(app.id)}" ${app.id === selectedAppId ? 'selected' : ''}>${escapeHtml(app.title)}</option>`
    )).join('');
  }

  function getRouteAccount(state, chain) {
    return state.account || auth.getCurrentLogin(chain) || chain.defaultAccount || '';
  }

  function appRequiresAccount(app) {
    return Boolean(app && app.accountField === true);
  }

  function appUsesAuthorizedAccount(app) {
    return Boolean(app && ['wallet', 'broadcast', 'manage', 'award', 'awards', 'donate', 'editor', 'feeds', 'post', 'notifications', 'swap', 'my-coin', 'auto-upvoter'].includes(app.id));
  }

  function legacyAppTarget(chain, appId) {
    const aliases = {
      calc: 'calculator',
      backup: 'backup',
      awards: 'award',
      registration: 'register'
    };
    if (chain.id === 'viz' && (appId === 'calc' || appId === 'awards')) {
      return aliases[appId];
    }
    if ((chain.id === 'golos' || chain.id === 'hive' || chain.id === 'steem') && aliases[appId]) {
      return aliases[appId];
    }
    return appId;
  }

  function accountSelectorVisible(app, chain) {
    return Boolean(app && appUsesAuthorizedAccount(app) && auth.getUsers(chain).length);
  }

  function recentAccountsKey(chain) {
    return `${chain.id}_recent_accounts`;
  }

  function normalizeRecentAccount(chain, value) {
    const account = String(value || '').trim().replace(/^@/, '');
    if (!account) return '';
    return ['golos', 'viz', 'steem', 'hive'].includes(chain.id) ? account.toLowerCase() : account;
  }

  function getRecentAccounts(chain) {
    try {
      const parsed = JSON.parse(global.localStorage.getItem(recentAccountsKey(chain)) || '[]');
      if (!Array.isArray(parsed)) return [];
      return parsed.map((item) => normalizeRecentAccount(chain, item)).filter(Boolean).slice(0, RECENT_ACCOUNT_LIMIT);
    } catch (error) {
      return [];
    }
  }

  function rememberRecentAccount(chain, value) {
    const account = normalizeRecentAccount(chain, value);
    if (!account) return;
    const next = [account].concat(getRecentAccounts(chain).filter((item) => item !== account)).slice(0, RECENT_ACCOUNT_LIMIT);
    try {
      global.localStorage.setItem(recentAccountsKey(chain), JSON.stringify(next));
    } catch (error) {
      // localStorage can be unavailable in private/sandboxed contexts; suggestions are optional.
    }
  }

  function fillRecentAccountList(chain) {
    if (!recentAccountList) return;
    recentAccountList.innerHTML = getRecentAccounts(chain).map((account) => `<option value="${escapeHtml(account)}"></option>`).join('');
  }

  function savedAccountValue(user) {
    return `${auth.getUserType(user)}:${auth.getUserLogin(user)}`;
  }

  function fillAccountSelect(chain) {
    const users = auth.getUsers(chain);
    const current = auth.getCurrentUser(chain);
    const currentValue = current ? savedAccountValue(current) : '';
    accountSelect.innerHTML = users.map((user) => {
      const login = auth.getUserLogin(user);
      const type = auth.getUserType(user);
      const label = type && type !== 'standard' && type !== 'seed' ? `${login} (${type})` : login;
      const value = savedAccountValue(user);
      return `<option value="${escapeHtml(value)}" ${value === currentValue ? 'selected' : ''}>${escapeHtml(label)}</option>`;
    }).join('');
  }

  function selectSavedAccount(chain, value) {
    const [type, ...loginParts] = String(value || '').split(':');
    const login = loginParts.join(':');
    if (!login) return '';
    auth.selectUser(chain, login, type || 'standard');
    return login;
  }

  function updateAccountField(app, chain) {
    const selectVisible = accountSelectorVisible(app, chain);
    const inputVisible = appRequiresAccount(app) && !(selectVisible && appUsesAuthorizedAccount(app));
    if (accountSelectField && accountSelect) {
      accountSelectField.hidden = !selectVisible;
      accountSelectField.setAttribute('aria-hidden', selectVisible ? 'false' : 'true');
      accountSelect.disabled = !selectVisible;
      if (selectVisible) fillAccountSelect(chain);
    }
    if (!accountField) return;
    accountField.hidden = !inputVisible;
    accountField.setAttribute('aria-hidden', inputVisible ? 'false' : 'true');
    accountInput.disabled = !inputVisible;
    accountInput.tabIndex = inputVisible ? 0 : -1;
    if (inputVisible) fillRecentAccountList(chain);
  }

  function profileRows(rows) {
    if (!rows || !rows.length) return '<li>Нет данных.</li>';
    return rows.map(([label, value]) => {
      const rendered = Array.isArray(value)
        ? (value.length ? `<ul>${value.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : '')
        : (typeof value === 'object' && value !== null ? `<pre>${escapeHtml(JSON.stringify(value, null, 2))}</pre>` : escapeHtml(value));
      return `<li><strong>${escapeHtml(label)}:</strong> ${rendered}</li>`;
    }).join('');
  }

  function detailsSection(title, rows, emptyText) {
    const hasRows = Array.isArray(rows) && rows.length > 0;
    return `
      <details ${hasRows ? 'open' : ''}>
        <summary>${escapeHtml(title)}</summary>
        ${hasRows ? `<ul>${profileRows(rows)}</ul>` : `<p class="muted">${escapeHtml(emptyText || 'Нет данных.')}</p>`}
      </details>`;
  }

  function rawJsonDetails(title, value) {
    return `<details class="raw-json"><summary>${escapeHtml(title || 'Исходные данные')}</summary><pre>${escapeHtml(JSON.stringify(value, null, 2))}</pre></details>`;
  }

  function isAccountLikeKey(key) {
    return ['from', 'sender', 'address', 'delegator', 'owner', 'account', 'creator', 'to', 'recipient', 'receiver', 'target', 'validator', 'public_key', 'benefactor', 'new_account_name', 'witness', 'author', 'curator', 'publisher'].includes(String(key || '').toLowerCase());
  }

  function formatExplorerValue(chain, key, value) {
    if (value === undefined || value === null || value === '') return '';
    if (Array.isArray(value)) return value.length ? `<ul>${value.map((item) => `<li>${formatExplorerValue(chain, key, item)}</li>`).join('')}</ul>` : '';
    if (typeof value === 'object') return renderExplorerFields(chain, value, { compact: true });
    if (isAccountLikeKey(key)) return renderAccountCell(chain, value);
    if (String(key).toLowerCase().includes('block') || String(key).toLowerCase() === 'height') return explorerLink(chain, 'block', value, String(value));
    if (String(key).toLowerCase().includes('hash') || String(key).toLowerCase().includes('tx')) return explorerLink(chain, 'tx', value, String(value).slice(0, 16));
    return escapeHtml(history.formatChainAmount ? history.formatChainAmount(chain, key, value) : history.formatValue(value));
  }

  function renderExplorerFields(chain, data, options = {}) {
    const skip = new Set(options.skip || []);
    const entries = Object.entries(data || {}).filter(([key, value]) => !skip.has(key) && value !== undefined && value !== null && value !== '');
    if (!entries.length) return `<p class="muted">${escapeHtml(options.emptyText || 'Нет данных для отображения.')}</p>`;
    const visible = entries.slice(0, options.limit || (options.compact ? 12 : 40));
    return `<dl class="kv-list">${visible.map(([key, value]) => `<div><dt>${escapeHtml(key)}</dt><dd>${formatExplorerValue(chain, key, value)}</dd></div>`).join('')}</dl>`;
  }

  function normalizeOperation(op, index) {
    if (Array.isArray(op)) return { index, type: op[0] || `operation_${index + 1}`, data: op[1] || {} };
    if (typeof op !== 'object' || op === null) return { index, type: 'item', data: { value: op } };
    const data = op && (op.data || op.message || op.payload || op);
    return { index: op && (op.index ?? op.id ?? index), type: (op && (op.type || op.tx_type || op.message_type)) || `operation_${index + 1}`, data: data || {} };
  }

  function renderOperationsTable(ops, chain, caption) {
    const rows = Array.isArray(ops) ? ops.map(normalizeOperation) : [];
    if (!rows.length) return '<p class="muted">Операции не найдены.</p>';
    return `<div class="table-wrap"><table aria-label="${escapeHtml(caption || 'Операции')}"><caption>${escapeHtml(caption || 'Операции')}</caption><thead><tr><th scope="col">#</th><th scope="col">Операция</th><th scope="col">Данные</th></tr></thead><tbody>${rows.map((row) => `<tr><td>${escapeHtml(row.index)}</td><td><code>${escapeHtml(row.type)}</code><br><span class="muted">${escapeHtml(history.operationTitle(row.type))}</span></td><td>${renderExplorerFields(chain, row.data, { compact: true })}</td></tr>`).join('')}</tbody></table></div>`;
  }

  function renderExplorerResult(chain, kind, value, result) {
    if (!result) return '<p class="muted">Данных нет.</p>';
    if (kind === 'tx') {
      const tx = result.result || result.data || result;
      const operations = tx.operations || tx.ops || tx.messages || (tx.data && tx.data.list) || (tx.data ? [tx.data] : []);
      const rawType = tx.type || tx.tx_type || tx.transaction_type;
      const readableType = history.operationTitle(rawType);
      const summaryRows = [
        ['Tx', tx.trx_id || tx.tx_id || tx.hash || tx.transaction_hash || value],
        ['Блок', tx.block_num || tx.block || tx.blockId || tx.height],
        ['Создана', history.formatDate(tx.timestamp || tx.time || tx.created_at)],
        ['Тип', readableType && readableType !== rawType ? `${readableType} (${rawType})` : rawType],
        ['Отправитель', tx.from || tx.sender || tx.address],
        ['Комиссия', tx.fee && typeof tx.fee === 'object' ? history.formatValue(tx.fee) : tx.fee]
      ].filter(([, item]) => item !== undefined && item !== null && item !== '');
      return `<article class="card"><h3>Транзакция ${escapeHtml(value)}</h3>${profileRows(summaryRows)}</article>${renderOperationsTable(operations, chain, `Операции транзакции ${value}`)}${rawJsonDetails('Исходные данные транзакции', result)}`;
    }
    if (kind === 'block') {
      const block = result.result || result.data || result;
      const transactions = block.transactions || block.ops || block.operations || [];
      return `<article class="card"><h3>Блок ${escapeHtml(value)}</h3>${renderExplorerFields(chain, block, { skip: ['transactions', 'ops', 'operations'] })}</article>${transactions.length ? renderOperationsTable(transactions, chain, `Операции блока ${value}`) : '<p class="muted">В блоке нет операций или API не вернул их списком.</p>'}${rawJsonDetails('Исходные данные блока', result)}`;
    }
    return `<article class="card"><h3>${chain.id === 'minter' || chain.id === 'decimal' ? 'Адрес' : 'Аккаунт'} ${escapeHtml(value)}</h3>${renderExplorerFields(chain, result.result || result.data || result)}</article>${rawJsonDetails('Исходные данные аккаунта', result)}`;
  }

  function rawListSection(title, items) {
    if (!items || !items.length) return '';
    return `
      <details>
        <summary>${escapeHtml(title)} (${items.length})</summary>
        <ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
      </details>`;
  }

  function appHash(params) {
    return `#${new URLSearchParams(params).toString()}`;
  }

  function golosPostPageUrl(author, permlink) {
    return `${global.location.origin}${global.location.pathname}${appHash({ chain: 'golos', app: 'post', author: String(author || '').trim().replace(/^@/, ''), permlink: String(permlink || '').trim() })}`;
  }

  function golosPostRouteLink(author, permlink, label) {
    const cleanAuthor = String(author || '').trim().replace(/^@/, '');
    const cleanPermlink = String(permlink || '').trim();
    if (!cleanAuthor || !cleanPermlink) return '';
    return `<a href="${escapeHtml(appHash({ chain: 'golos', app: 'post', author: cleanAuthor, permlink: cleanPermlink }))}">${escapeHtml(label || `@${cleanAuthor}/${cleanPermlink}`)}</a>`;
  }

  function renderGolosDonateMemoHtml(memo) {
    if (memo === undefined || memo === null || memo === '') return '';
    if (typeof memo !== 'object') return escapeHtml(memo);
    const target = memo.target && typeof memo.target === 'object' ? memo.target : {};
    const rows = [];
    const postLink = golosPostRouteLink(target.author, target.permlink);
    if (postLink) rows.push(`<li><strong>Пост:</strong> ${postLink}</li>`);
    if (target.type) rows.push(`<li><strong>Тип:</strong> ${escapeHtml(target.type === 'fee_donate' ? 'комиссия доната' : target.type)}</li>`);
    if (memo.comment) rows.push(`<li><strong>Комментарий:</strong> ${escapeHtml(memo.comment)}</li>`);
    if (memo.app) rows.push(`<li><strong>Приложение:</strong> ${escapeHtml(memo.app)}${memo.version ? ` v${escapeHtml(memo.version)}` : ''}</li>`);
    if (!rows.length) return `<pre>${escapeHtml(JSON.stringify(memo, null, 2))}</pre>`;
    return `<ul class="compact-list">${rows.join('')}</ul>`;
  }

  function hasGolosVoteFrom(content, account) {
    const wanted = String(account || '').trim().replace(/^@/, '');
    const votes = Array.isArray(content && content.active_votes) ? content.active_votes : (Array.isArray(content && content.activeVotes) ? content.activeVotes : []);
    return Boolean(wanted) && votes.some((vote) => String(vote && vote.voter || vote && vote.account || '').trim().replace(/^@/, '') === wanted && Number(vote && (vote.percent ?? vote.weight ?? vote.rshares ?? 1)) !== 0);
  }

  function golosContentTitle(content, fallback) {
    return String(content && content.title || fallback || content && content.permlink || 'без названия').trim() || 'без названия';
  }

  function golosContentDate(content) {
    const raw = content && (content.created || content.last_update || content.cashout_time || content.updated);
    return raw ? history.formatDate(raw) : 'дата не указана';
  }

  function golosDonateLink(to, label) {
    return `<a href="${escapeHtml(golosDonationPageUrl({ to, token: 'GOLOS' }))}" target="_blank" rel="noopener" data-golos-post-donate>${escapeHtml(label || 'Донат')}</a>`;
  }

  function explorerLink(chain, kind, value, label) {
    if (!value) return '';
    const text = label || value;
    return `<a href="${escapeHtml(appHash({ chain: chain.id, app: 'explorer', kind, value }))}">${escapeHtml(text)}</a>`;
  }

  function accountLink(chain, account) {
    const value = String(account || '').trim().replace(/^@/, '');
    if (!value) return '';
    return `<a href="${escapeHtml(appHash({ chain: chain.id, app: 'profiles', account: value }))}">${chain.id === 'minter' || chain.id === 'decimal' ? escapeHtml(value) : `@${escapeHtml(value)}`}</a>`;
  }

  function getPathValue(item, paths) {
    for (const path of paths) {
      const value = path.split('.').reduce((current, key) => current && current[key], item);
      if (value !== undefined && value !== null && value !== '') return value;
    }
    return '';
  }

  function normalizeTransactionRow(raw, index) {
    const item = raw && raw.raw && raw.data ? raw : (raw || {});
    const data = item.data || item.message || item.payload || item;
    return {
      index: item.index ?? item.nonce ?? data.nonce ?? index,
      type: item.type || item.tx_type || item.transaction_type || item.message_type || data.type || 'transaction',
      timestamp: item.timestamp || item.time || item.created_at || item.createdAt || data.timestamp || '',
      trxId: item.trxId || item.trx_id || item.hash || item.tx_hash || item.id || data.hash || data.tx_hash || '',
      block: item.block || item.block_id || item.blockId || item.block_number || item.height || data.block || data.height || '',
      from: getPathValue(data, ['from', 'sender', 'address', 'delegator', 'owner', 'account', 'creator', 'sender.address']),
      to: getPathValue(data, ['to', 'recipient', 'receiver', 'target', 'validator', 'public_key', 'coin_to_buy']),
      amount: getPathValue(data, ['amount', 'value', 'stake', 'volume', 'sell', 'min_to_receive', 'value_to_sell', 'value_to_buy', 'initial_amount', 'initSupply', 'volume0']),
      coin: getPathValue(data, ['coin.symbol', 'coin', 'denom', 'symbol', 'ticker', 'amount.coin', 'coin_to_sell.symbol', 'coin_to_buy.symbol', 'sellCoin.symbol', 'buyCoin.symbol']),
      memo: getPathValue(data, ['memo', 'payload', 'comment', 'title', 'url']),
      raw: item
    };
  }

  function transactionDetails(row) {
    const raw = row.raw || {};
    const data = raw.data || raw.message || raw.payload || raw;
    const details = [];
    for (const [key, value] of Object.entries(data || {})) {
      if (['from', 'sender', 'address', 'delegator', 'owner', 'account', 'creator', 'to', 'recipient', 'receiver', 'target', 'validator', 'amount', 'value', 'stake', 'coin', 'denom', 'symbol', 'memo', 'payload', 'comment', 'title', 'url', 'list'].includes(key)) continue;
      if (value === undefined || value === null || value === '') continue;
      details.push(`${key}: ${history.formatValue(value)}`);
      if (details.length >= 4) break;
    }
    return details.join('; ');
  }

  function decimalStringAdd(a, b) {
    const left = String(a || '0').trim() || '0';
    const right = String(b || '0').trim() || '0';
    const [leftWhole, leftFraction = ''] = left.split('.');
    const [rightWhole, rightFraction = ''] = right.split('.');
    const scale = Math.max(leftFraction.length, rightFraction.length);
    const leftUnits = BigInt((leftWhole || '0') + leftFraction.padEnd(scale, '0'));
    const rightUnits = BigInt((rightWhole || '0') + rightFraction.padEnd(scale, '0'));
    const sum = String(leftUnits + rightUnits).padStart(scale + 1, '0');
    if (!scale) return sum;
    const whole = sum.slice(0, -scale) || '0';
    const fraction = sum.slice(-scale).replace(/0+$/, '');
    return fraction ? `${whole}.${fraction}` : whole;
  }

  function minterMultisendEntriesFromData(data) {
    const list = data && Array.isArray(data.list) ? data.list : [];
    return list.map((item) => {
      const coin = item && item.coin && typeof item.coin === 'object' ? item.coin.symbol : (item && item.coin || item && item.symbol || '');
      return {
        to: String(item && (item.to || item.recipient || item.receiver) || '').trim(),
        value: String(item && (item.value ?? item.amount ?? '') || '').trim(),
        coin: String(coin || '').trim()
      };
    }).filter((item) => item.to || item.value || item.coin);
  }

  function minterMultisendEntries(rowOrTx) {
    const raw = rowOrTx && rowOrTx.raw ? rowOrTx.raw : (rowOrTx || {});
    const data = raw.data || rowOrTx && rowOrTx.data || {};
    return minterMultisendEntriesFromData(data);
  }

  function summarizeMinterMultisend(rowOrTx) {
    const entries = minterMultisendEntries(rowOrTx);
    const totals = entries.reduce((acc, entry) => {
      const coin = entry.coin || 'монета не указана';
      acc[coin] = decimalStringAdd(acc[coin] || '0', entry.value || '0');
      return acc;
    }, {});
    return { entries, totals, count: entries.length };
  }

  function formatMinterMultisendTotals(summary) {
    return Object.entries(summary.totals).map(([coin, value]) => `${value} ${coin}`).join('; ');
  }

  function renderMinterMultisendDetailsHtml(chain, rowOrTx) {
    const summary = summarizeMinterMultisend(rowOrTx);
    if (!summary.count) return '';
    const totals = formatMinterMultisendTotals(summary);
    return `<p><strong>Всего:</strong> ${escapeHtml(totals)}. <strong>Получателей:</strong> ${escapeHtml(summary.count)}</p><ol>${summary.entries.map((entry) => `<li>${renderAccountCell(chain, entry.to)} — ${escapeHtml(entry.value)} ${escapeHtml(entry.coin)}</li>`).join('')}</ol>`;
  }

  function renderTransactionDetailsHtml(row, chain) {
    if (chain && chain.id === 'golos' && row.type === 'donate') return renderGolosDonateMemoHtml(row.memo);
    if (chain && chain.id === 'minter' && Number(row.type) === 13) return renderMinterMultisendDetailsHtml(chain, row);
    const details = row.memo || transactionDetails(row);
    if (details === undefined || details === null || details === '') return '';
    if (typeof details === 'object') return `<pre>${escapeHtml(JSON.stringify(details, null, 2))}</pre>`;
    return escapeHtml(details);
  }

  function renderAccountCell(chain, value) {
    const text = String(value || '').trim();
    if (!text) return '';
    if (chain.id === 'minter') return /^Mx[0-9a-fA-F]{40}$/.test(text) ? accountLink(chain, text) : escapeHtml(text);
    if (chain.id === 'decimal') return (/^(dx|0x)[0-9a-fA-F]{40}$/.test(text) || /^d0[0-9a-z]{39}$/.test(text)) ? accountLink(chain, text) : escapeHtml(text);
    return /^[a-z0-9][a-z0-9.-]*[a-z0-9]$/i.test(text) ? accountLink(chain, text) : escapeHtml(text);
  }

  function renderTransactionsTable(items, chain, options = {}) {
    const rows = Array.isArray(items) ? items.map(normalizeTransactionRow) : [];
    if (!rows.length) return `<p>${escapeHtml(options.emptyText || 'Транзакции не найдены.')}</p>`;
    const caption = options.caption || `Последние транзакции ${chain.title}`;
    const labelledBy = options.labelledBy || '';
    return `
      <div class="table-wrap">
        <table${labelledBy ? ` aria-labelledby="${escapeHtml(labelledBy)}"` : ` aria-label="${escapeHtml(caption)}"`}>
          <caption>${escapeHtml(caption)}</caption>
          <thead>
            <tr>
              <th scope="col">Дата</th>
              <th scope="col">Операция</th>
              <th scope="col">Отправитель</th>
              <th scope="col">Получатель / валидатор</th>
              <th scope="col">Сумма</th>
              <th scope="col">Memo / детали</th>
              <th scope="col">Блок</th>
              <th scope="col">Tx</th>
            </tr>
          </thead>
          <tbody>${rows.map((row) => {
            const multisend = chain.id === 'minter' && Number(row.type) === 13 ? summarizeMinterMultisend(row) : null;
            const displayAmount = multisend && multisend.count ? formatMinterMultisendTotals(multisend) : (history.formatChainAmount ? history.formatChainAmount(chain, 'amount', row.amount) : row.amount);
            const amount = multisend && multisend.count ? displayAmount : [displayAmount, row.coin].filter(Boolean).join(' ');
            const recipient = multisend && multisend.count ? `${multisend.count} получателей` : renderAccountCell(chain, row.to);
            const detailsHtml = renderTransactionDetailsHtml(row, chain);
            return `<tr>
              <td>${escapeHtml(history.formatDate(row.timestamp))}</td>
              <td><code>${escapeHtml(row.type)}</code><br><span class="muted">${escapeHtml(history.operationTitle(row.type))}</span></td>
              <td>${renderAccountCell(chain, row.from)}</td>
              <td>${multisend && multisend.count ? escapeHtml(recipient) : recipient}</td>
              <td>${escapeHtml(amount)}</td>
              <td class="longtext">${detailsHtml}</td>
              <td>${row.block ? explorerLink(chain, 'block', row.block, String(row.block)) : ''}</td>
              <td>${row.trxId ? explorerLink(chain, 'tx', row.trxId, String(row.trxId).slice(0, 12)) : ''}</td>
            </tr>`;
          }).join('')}</tbody>
        </table>
      </div>`;
  }

  function renderProfileMedia(profile) {
    const items = [];
    if (profile.profileImage) items.push(`<figure><img src="${escapeHtml(profile.profileImage)}" alt="Аватар ${escapeHtml(profile.name)}" loading="lazy"><figcaption>Аватар</figcaption></figure>`);
    if (profile.coverImage) items.push(`<figure><img src="${escapeHtml(profile.coverImage)}" alt="Обложка ${escapeHtml(profile.name)}" loading="lazy"><figcaption>Обложка профиля</figcaption></figure>`);
    return items.length ? `<div class="profile-media">${items.join('')}</div>` : '';
  }

  function renderSocialLinks(socials) {
    if (!Array.isArray(socials) || !socials.length) return '';
    const links = socials.map(([label, value]) => {
      const text = String(value || '').trim();
      let href = text;
      if (label === 'telegram' && !/^https?:\/\//i.test(text)) href = `https://t.me/${text.replace(/^@/, '')}`;
      if (label === 'twitter' && !/^https?:\/\//i.test(text)) href = `https://x.com/${text.replace(/^@/, '')}`;
      if (label === 'github' && !/^https?:\/\//i.test(text)) href = `https://github.com/${text.replace(/^@/, '')}`;
      const linked = /^https?:\/\//i.test(href) ? `<a href="${escapeHtml(href)}" target="_blank" rel="noopener">${escapeHtml(text)}</a>` : escapeHtml(text);
      return `<li><strong>${escapeHtml(label)}:</strong> ${linked}</li>`;
    }).join('');
    return `<details open><summary>Социальные ссылки из metadata</summary><ul>${links}</ul></details>`;
  }

  function golosLegacyProfileLinks(account) {
    return [
      ['Вся история', appHash({ chain: 'golos', app: 'history', account })],
      ['Переводы и TIP/invite/claim', appHash({ chain: 'golos', app: 'history', account, ops: 'transfer,transfer_to_vesting,claim,transfer_from_tip,transfer_to_tip,invite,invite_claim' })],
      ['Сила Голоса / vesting', appHash({ chain: 'golos', app: 'history', account, ops: 'delegate_vesting_shares,transfer_to_vesting,withdraw_vesting,return_vesting_delegation,transfer_from_tip' })],
      ['Донаты', appHash({ chain: 'golos', app: 'history', account, ops: 'donate' })],
      ['Авторские награды', appHash({ chain: 'golos', app: 'history', account, ops: 'author_reward' })],
      ['Кураторские награды', appHash({ chain: 'golos', app: 'history', account, ops: 'curation_reward' })],
      ['Бенефициарские награды', appHash({ chain: 'golos', app: 'history', account, ops: 'comment_benefactor_reward' })],
      ['Упоминания в комментариях', appHash({ chain: 'golos', app: 'history', account, ops: 'comment_mention' })],
      ['Апвоуты и флаги', appHash({ chain: 'golos', app: 'history', account, ops: 'vote' })],
      ['Изменения репутации', appHash({ chain: 'golos', app: 'history', account, ops: 'account_reputation' })],
      ['DAO / workers / witness votes', appHash({ chain: 'golos', app: 'history', account, ops: 'worker_request_vote,account_witness_vote,account_witness_proxy,worker_request,worker_request_delete,worker_state' })],
      ['Аккаунт: create/update/metadata', appHash({ chain: 'golos', app: 'history', account, ops: 'account_create,account_create_with_invite,account_update,account_metadata' })],
      ['Ордера внутренней биржи', appHash({ chain: 'golos', app: 'history', account, ops: 'fill_order' })]
    ];
  }

  function vizLegacyProfileLinks(account) {
    return [
      ['Основное', appHash({ chain: 'viz', app: 'profiles', account })],
      ['Вся история', appHash({ chain: 'viz', app: 'history', account })],
      ['Переводы средств', appHash({ chain: 'viz', app: 'history', account, ops: 'transfer,transfer_to_vesting,create_invite,claim_invite_balance,use_invite_balance' })],
      ['Соц. капитал', appHash({ chain: 'viz', app: 'history', account, ops: 'delegate_vesting_shares,transfer_to_vesting,withdraw_vesting,return_vesting_delegation' })],
      ['ДАО', appHash({ chain: 'viz', app: 'history', account, ops: 'committee_worker_create_request,committee_vote_request,committee_pay_request,committee_worker_cancel_request,committee_cancel_request,committee_approve_request,committee_payout_request' })],
      ['Отправленные награды', appHash({ chain: 'viz', app: 'history', account, ops: 'award,fixed_award' })],
      ['Полученные награды', appHash({ chain: 'viz', app: 'history', account, ops: 'receive_award' })],
      ['Бенефициарские', appHash({ chain: 'viz', app: 'history', account, ops: 'benefactor_award' })],
      ['Аккаунты', appHash({ chain: 'viz', app: 'history', account, ops: 'set_account_price,set_subaccount_price,buy_account,account_sale,target_account_sale,bid,outbid' })],
      ['Платные подписки', appHash({ chain: 'viz', app: 'history', account, ops: 'set_paid_subscription,paid_subscribe,paid_subscription_action,cancel_paid_subscription' })],
      ['Делегат', appHash({ chain: 'viz', app: 'witnesses-rewards', account })],
      ['Наградить пользователя', appHash({ chain: 'viz', app: 'award', account, target: account })],
      ['Изменить профиль', appHash({ chain: 'viz', app: 'manage', account, section: 'profile' })]
    ];
  }

  function steemLegacyProfileLinks(account) {
    return [
      ['Основное', appHash({ chain: 'steem', app: 'profiles', account })],
      ['Вся история', appHash({ chain: 'steem', app: 'history', account })],
      ['Переводы средств', appHash({ chain: 'steem', app: 'history', account, ops: 'transfer,transfer_to_vesting,withdraw_vesting,transfer_to_savings,transfer_from_savings,cancel_transfer_from_savings' })],
      ['Steem Power', appHash({ chain: 'steem', app: 'history', account, ops: 'delegate_vesting_shares,transfer_to_vesting,withdraw_vesting,return_vesting_delegation,fill_vesting_withdraw,set_withdraw_vesting_route' })],
      ['ДАО / witness votes', appHash({ chain: 'steem', app: 'history', account, ops: 'account_witness_vote,account_witness_proxy,proposal_create,proposal_update,proposal_delete,producer_reward' })],
      ['Авторские награды', appHash({ chain: 'steem', app: 'history', account, ops: 'author_reward' })],
      ['Кураторские награды', appHash({ chain: 'steem', app: 'history', account, ops: 'curation_reward' })],
      ['Бенефициарские награды', appHash({ chain: 'steem', app: 'history', account, ops: 'comment_benefactor_reward' })],
      ['Аккаунты: create/update/recovery', appHash({ chain: 'steem', app: 'history', account, ops: 'account_create,account_create_with_delegation,account_update,account_metadata,request_account_recovery,recover_account,change_recovery_account' })],
      ['Апвоуты и флаги', appHash({ chain: 'steem', app: 'history', account, ops: 'vote' })],
      ['Комментарии', appHash({ chain: 'steem', app: 'history', account, ops: 'comment,delete_comment,comment_options' })],
      ['Ордера внутренней биржи', appHash({ chain: 'steem', app: 'history', account, ops: 'limit_order_create,limit_order_create2,limit_order_cancel,fill_order' })]
    ];
  }

  function hiveLegacyProfileLinks(account) {
    return [
      ['Основное', appHash({ chain: 'hive', app: 'profiles', account })],
      ['Вся история', appHash({ chain: 'hive', app: 'history', account })],
      ['Переводы средств', appHash({ chain: 'hive', app: 'history', account, ops: 'transfer,transfer_to_vesting,withdraw_vesting,transfer_to_savings,transfer_from_savings,cancel_transfer_from_savings' })],
      ['Hive Power', appHash({ chain: 'hive', app: 'history', account, ops: 'delegate_vesting_shares,transfer_to_vesting,withdraw_vesting,return_vesting_delegation,fill_vesting_withdraw,set_withdraw_vesting_route' })],
      ['ДАО / witness votes / proposals', appHash({ chain: 'hive', app: 'history', account, ops: 'account_witness_vote,account_witness_proxy,proposal_create,proposal_update,proposal_delete' })],
      ['Авторские награды', appHash({ chain: 'hive', app: 'history', account, ops: 'author_reward' })],
      ['Кураторские награды', appHash({ chain: 'hive', app: 'history', account, ops: 'curation_reward' })],
      ['Бенефициарские награды', appHash({ chain: 'hive', app: 'history', account, ops: 'comment_benefactor_reward' })],
      ['Аккаунты: create/update/recovery', appHash({ chain: 'hive', app: 'history', account, ops: 'account_create,account_create_with_delegation,account_update,account_metadata,request_account_recovery,recover_account,change_recovery_account' })],
      ['Апвоуты и флаги', appHash({ chain: 'hive', app: 'history', account, ops: 'vote' })],
      ['Комментарии', appHash({ chain: 'hive', app: 'history', account, ops: 'comment,delete_comment,comment_options' })],
      ['Посты / блог через публичный RPC', appHash({ chain: 'hive', app: 'profiles', account })]
    ];
  }

  function renderHistoryQuickLinks(profile) {
    if (!profile || !['golos', 'viz', 'steem', 'hive'].includes(profile.chainId)) return '';
    const chain = chains[profile.chainId] || { id: profile.chainId };
    const account = profile.name;
    let links;
    let title = 'Быстрые переходы';
    if (profile.chainId === 'golos') {
      links = golosLegacyProfileLinks(account);
      title = 'Быстрые переходы по профилю Golos';
    } else if (profile.chainId === 'viz') {
      links = vizLegacyProfileLinks(account);
      title = 'Быстрые переходы по профилю VIZ';
    } else if (profile.chainId === 'steem') {
      links = steemLegacyProfileLinks(account);
      title = 'Быстрые переходы по профилю Steem';
    } else if (profile.chainId === 'hive') {
      links = hiveLegacyProfileLinks(account);
      title = 'Быстрые переходы по профилю Hive';
    } else {
      links = [
        ['Вся история', appHash({ chain: chain.id, app: 'history', account })],
        ['Профиль/аккаунт', appHash({ chain: chain.id, app: 'profiles', account })],
        ['Explorer аккаунта', appHash({ chain: chain.id, app: 'explorer', kind: 'account', value: account })]
      ];
    }
    return `<details open><summary>${escapeHtml(title)}</summary><ul>${links.map(([label, href]) => `<li><a href="${escapeHtml(href)}">${escapeHtml(label)}</a></li>`).join('')}</ul></details>`;
  }

  function renderGolosUiaProfileSection(profile) {
    const rows = profile.rawLists && profile.rawLists.uiaBalances;
    if (!rows || !rows.length) return '';
    return `<details open><summary>UIA активы (${rows.length})</summary><ul>${rows.map(([label, value]) => `<li><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</li>`).join('')}</ul></details>`;
  }

  function renderGolosAccountList(title, rows, key) {
    if (!Array.isArray(rows) || !rows.length) return '';
    return `<details><summary>${escapeHtml(title)} (${rows.length})</summary><ul>${rows.map((row) => `<li>${renderAccountCell(chains.golos, row && row[key])}</li>`).join('')}</ul></details>`;
  }

  function renderSteemAccountList(title, rows, key) {
    if (!Array.isArray(rows) || !rows.length) return '';
    return `<details><summary>${escapeHtml(title)} (${rows.length})</summary><ul>${rows.map((row) => `<li>${renderAccountCell(chains.steem, row && row[key])}</li>`).join('')}</ul></details>`;
  }

  function renderSteemContentList(title, rows) {
    if (!Array.isArray(rows) || !rows.length) return '';
    return `<details><summary>${escapeHtml(title)} (${rows.length})</summary><ul>${rows.map((row) => {
      const author = row.author || '';
      const permlink = row.permlink || '';
      const titleText = row.title || permlink || 'без названия';
      const href = author && permlink ? `https://steemit.com/@${author}/${permlink}` : '';
      return `<li>${href ? `<a href="${escapeHtml(href)}" target="_blank" rel="noopener">${escapeHtml(titleText)}</a>` : escapeHtml(titleText)} ${author ? `— ${renderAccountCell(chains.steem, author)}` : ''}</li>`;
    }).join('')}</ul></details>`;
  }

  function renderGolosContentList(title, rows) {
    if (!Array.isArray(rows) || !rows.length) return '';
    return `<details><summary>${escapeHtml(title)} (${rows.length})</summary><ul>${rows.map((row) => {
      const author = row.author || '';
      const permlink = row.permlink || '';
      const titleText = row.title || permlink || 'без названия';
      const href = author && permlink ? appHash({ chain: 'golos', app: 'post', author, permlink }) : '';
      return `<li>${href ? `<a href="${escapeHtml(href)}">${escapeHtml(titleText)}</a>` : escapeHtml(titleText)} ${author ? `— ${renderAccountCell(chains.golos, author)}` : ''}</li>`;
    }).join('')}</ul></details>`;
  }

  function renderGolosLegacyDirectSections(profile) {
    if (!profile || profile.chainId !== 'golos') return '';
    const extras = profile.raw && profile.raw.golosProfileExtras;
    if (!extras) return '';
    const witnessRows = extras.witness ? Object.entries(extras.witness).map(([key, value]) => [key, value]) : [];
    return `${renderGolosContentList('Последние посты', extras.blogPosts)}
      ${renderGolosContentList('Последние комментарии', extras.comments)}
      ${renderGolosAccountList('Подписчики', extras.followers, 'follower')}
      ${renderGolosAccountList('Подписки', extras.following, 'following')}
      ${renderGolosAccountList('Исходящие делегирования СГ', extras.delegationsOut, 'delegatee')}
      ${renderGolosAccountList('Входящие делегирования СГ', extras.delegationsIn, 'delegator')}
      ${witnessRows.length ? detailsSection('Данные делегата', witnessRows) : ''}`;
  }

  function renderSteemLegacyDirectSections(profile) {
    if (!profile || profile.chainId !== 'steem') return '';
    const extras = profile.raw && profile.raw.steemProfileExtras;
    if (!extras) return '';
    const witnessRows = extras.witness ? Object.entries(extras.witness).map(([key, value]) => [key, value]) : [];
    return `<details open><summary>Связи, делегирования и последние публикации Steem</summary>
      <p class="muted">Краткие списки из публичного RPC. Подробные старые таблицы доступны через быстрые фильтры истории ниже.</p>
      ${renderSteemAccountList('Подписчики', extras.followers, 'follower')}
      ${renderSteemAccountList('Подписки', extras.following, 'following')}
      ${renderSteemAccountList('Исходящие делегирования SP', extras.delegationsOut, 'delegatee')}
      ${renderSteemAccountList('Входящие делегирования SP', extras.delegationsIn, 'delegator')}
      ${witnessRows.length ? detailsSection('Данные witness', witnessRows) : ''}
      ${renderSteemContentList('Последние посты', extras.blogPosts)}
      ${renderSteemContentList('Последние комментарии', extras.comments)}
    </details>`;
  }

  function renderHiveAccountList(title, rows, key) {
    if (!Array.isArray(rows) || !rows.length) return '';
    return `<details><summary>${escapeHtml(title)} (${rows.length})</summary><ul>${rows.map((row) => `<li>${renderAccountCell(chains.hive, row && row[key])}</li>`).join('')}</ul></details>`;
  }

  function renderHiveContentList(title, rows) {
    if (!Array.isArray(rows) || !rows.length) return '';
    return `<details><summary>${escapeHtml(title)} (${rows.length})</summary><ul>${rows.map((row) => {
      const author = row.author || '';
      const permlink = row.permlink || '';
      const titleText = row.title || permlink || 'без названия';
      const href = author && permlink ? `https://peakd.com/@${author}/${permlink}` : '';
      return `<li>${href ? `<a href="${escapeHtml(href)}" target="_blank" rel="noopener">${escapeHtml(titleText)}</a>` : escapeHtml(titleText)} ${author ? `— ${renderAccountCell(chains.hive, author)}` : ''}</li>`;
    }).join('')}</ul></details>`;
  }

  function renderHiveLegacyDirectSections(profile) {
    if (!profile || profile.chainId !== 'hive') return '';
    const extras = profile.raw && profile.raw.hiveProfileExtras;
    if (!extras) return '';
    const witnessRows = extras.witness ? Object.entries(extras.witness).map(([key, value]) => [key, value]) : [];
    const incomingDelegationNote = profile.raw && profile.raw.received_vesting_shares
      ? `<details><summary>Входящие делегирования HP</summary><p>Всего получено: ${escapeHtml(profile.raw.received_vesting_shares)}. Публичный Hive RPC для профиля отдаёт сумму, но не даёт надёжный список делегаторов без индексера; список не раскрывается, чтобы не показывать неполные данные.</p></details>`
      : '';
    return `<details open><summary>Связи, делегирования и последние публикации Hive</summary>
      <p class="muted">Краткие списки из публичного RPC. Подробные старые таблицы доступны через быстрые фильтры истории ниже.</p>
      ${renderHiveAccountList('Подписчики', extras.followers, 'follower')}
      ${renderHiveAccountList('Подписки', extras.following, 'following')}
      ${renderHiveAccountList('Исходящие делегирования HP', extras.delegationsOut, 'delegatee')}
      ${incomingDelegationNote}
      ${witnessRows.length ? detailsSection('Данные witness', witnessRows) : ''}
      ${renderHiveContentList('Последние посты', extras.blogPosts)}
      ${renderHiveContentList('Последние комментарии', extras.comments)}
    </details>`;
  }

  function restProfileNonce(profile) {
    if (!profile || (profile.chainId !== 'minter' && profile.chainId !== 'decimal')) return '';
    const rows = Array.isArray(profile.restRows) ? profile.restRows : [];
    const row = rows.find(([label]) => label === 'Nonce');
    return row && row[1] !== undefined && row[1] !== null && row[1] !== '' ? String(row[1]) : '';
  }

  function renderRestNonceCopy(profile) {
    const nonce = restProfileNonce(profile);
    if (!nonce) return '';
    const prefix = profile.chainId === 'decimal' ? 'decimal' : 'minter';
    return `<section class="subpanel ${prefix}-profile-nonce" aria-labelledby="${prefix}-profile-nonce-heading">
      <h3 id="${prefix}-profile-nonce-heading">NONCE для создания транзакций</h3>
      <p><strong>Nonce:</strong> <code id="${prefix}-profile-nonce-value">${escapeHtml(nonce)}</code></p>
      <button type="button" id="copy-${prefix}-nonce">Копировать nonce</button>
      <p id="copy-${prefix}-nonce-status" role="status" aria-live="polite" class="muted"></p>
    </section>`;
  }

  function renderDecimalRewardsCalculator(profile) {
    if (!profile || profile.chainId !== 'decimal') return '';
    return `<section class="subpanel decimal-rewards-calculator" aria-labelledby="decimal-rewards-heading">
      <h3 id="decimal-rewards-heading">Калькулятор ревордов</h3>
      <form id="decimal-rewards-form">
        <label for="decimal-rewards-days">Количество дней</label>
        <input id="decimal-rewards-days" name="days_counter" type="number" min="1" value="1" inputmode="numeric">
        <button type="submit" name="calc_rewards">Подсчитать</button>
      </form>
      <ul id="decimal-rewards-result" aria-live="polite" role="status"></ul>
    </section>`;
  }

  function bindRestNonceCopy(profile) {
    const nonce = restProfileNonce(profile);
    const prefix = profile && profile.chainId === 'decimal' ? 'decimal' : 'minter';
    const button = document.getElementById(`copy-${prefix}-nonce`);
    const status = document.getElementById(`copy-${prefix}-nonce-status`);
    if (!nonce || !button || !status) return;
    button.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(nonce);
        status.textContent = 'Nonce скопирован в буфер обмена.';
      } catch (error) {
        status.textContent = `Не удалось скопировать nonce автоматически: ${error && error.message ? error.message : error}`;
      }
    });
  }

  function bindDecimalRewardsCalculator(profile) {
    if (!profile || profile.chainId !== 'decimal') return;
    const form = document.getElementById('decimal-rewards-form');
    const result = document.getElementById('decimal-rewards-result');
    if (!form || !result || !profiles.fetchDecimalRewards) return;
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const days = form.elements.days_counter ? form.elements.days_counter.value : '1';
      result.innerHTML = '<li>Загружаю rewards через публичный Decimal API...</li>';
      try {
        const chain = chains.decimal;
        const totals = await profiles.fetchDecimalRewards({ config: chain, node: chain.apiBase || chain.nodes[0], rest: true }, profile.name, days);
        const entries = Object.entries(totals);
        result.innerHTML = entries.length
          ? entries.map(([coin, amount]) => `<li>${escapeHtml(Number(amount).toFixed(5))} ${escapeHtml(coin)}</li>`).join('')
          : '<li>Rewards за выбранный период не найдены.</li>';
      } catch (error) {
        result.innerHTML = `<li>Не удалось загрузить rewards: ${escapeHtml(error && error.message ? error.message : error)}</li>`;
      }
    });
  }

  function renderProfile(profile) {
    const balanceRows = profile.balances.map(([label, value]) => [label, value]);
    const metadataHasData = Object.keys(profile.metadataJson || {}).length || Object.keys(profile.postingMetadataJson || {}).length;
    const isRestProfile = profile.chainId === 'minter' || profile.chainId === 'decimal';
    const showDisplayName = !isRestProfile || (profile.displayName && profile.displayName !== profile.name);

    appEl.innerHTML = `
      <section class="panel">
        <h2>${escapeHtml(profile.chain)}: ${profile.chainId === 'minter' || profile.chainId === 'decimal' ? escapeHtml(profile.name) : `@${escapeHtml(profile.name)}`}</h2>
        <p><strong>Нода/API:</strong> ${escapeHtml(profile.node)}</p>
        <article class="card">
          <h3>Кратко</h3>
          <ul>
            ${showDisplayName ? `<li><strong>Отображаемое имя:</strong> ${escapeHtml(profile.displayName)}</li>` : ''}
            ${profile.about ? `<li><strong>О себе:</strong> ${escapeHtml(profile.about)}</li>` : ''}
            ${profile.location ? `<li><strong>Локация:</strong> ${escapeHtml(profile.location)}</li>` : ''}
            ${profile.website ? `<li><strong>Сайт:</strong> <a href="${escapeHtml(profile.website)}" target="_blank" rel="noopener">${escapeHtml(profile.website)}</a></li>` : ''}
            ${profile.created ? `<li><strong>Создан:</strong> ${escapeHtml(profile.created)}</li>` : ''}
            ${profile.lastVoteTime ? `<li><strong>Последнее голосование/награда:</strong> ${escapeHtml(profile.lastVoteTime)}</li>` : ''}
            ${profile.proxy ? `<li><strong>Прокси:</strong> ${escapeHtml(profile.proxy)}</li>` : ''}
          </ul>
        </article>
        ${renderProfileMedia(profile)}
        ${renderHistoryQuickLinks(profile)}
        ${detailsSection('Балансы', balanceRows, 'Нет данных о балансах.')}
        ${renderGolosUiaProfileSection(profile)}
        ${detailsSection('Экономика / vesting / staking', profile.economyRows, 'Нет доступных экономических полей.')}
        ${renderGolosLegacyDirectSections(profile)}
        ${renderSteemLegacyDirectSections(profile)}
        ${renderHiveLegacyDirectSections(profile)}
        ${detailsSection('Профиль и публичная metadata', profile.profileRows, 'Профильная metadata не заполнена.')}
        ${renderSocialLinks(profile.socials)}
        ${profile.restRows && profile.restRows.length ? detailsSection('Адрес / REST-детали', profile.restRows) : ''}
        ${renderRestNonceCopy(profile)}
        ${renderDecimalRewardsCalculator(profile)}
        ${detailsSection('Governance / witness / proxy', profile.governanceRows, 'Нет governance-данных.')}
        ${detailsSection('Authorities / публичные ключи', profile.authorityRows, 'Нет данных authorities.')}
        ${detailsSection('Активность и статистика', profile.activityRows, 'Нет статистики активности.')}
        ${rawListSection('Делегирования / stakes из API', profile.rawLists && profile.rawLists.delegations)}
        ${profile.rawLists && profile.rawLists.transactions && profile.rawLists.transactions.length ? `
          <details open>
            <summary id="profile-transactions-summary">Последние транзакции из API (${profile.rawLists.transactions.length})</summary>
            ${renderTransactionsTable(profile.rawLists.transactions, chains[profile.chainId] || { id: profile.chainId, title: profile.chain }, { caption: `Последние транзакции ${profile.chain}: ${profile.name}`, labelledBy: 'profile-transactions-summary' })}
          </details>` : ''}
        ${rawListSection('Rewards из API', profile.rawLists && profile.rawLists.rewards)}
        ${rawListSection('NFT из API', profile.rawLists && profile.rawLists.nfts)}
        ${metadataHasData ? `
          <details>
            <summary>JSON-метаданные</summary>
            ${Object.keys(profile.metadataJson || {}).length ? `<h3>json_metadata</h3><pre>${escapeHtml(JSON.stringify(profile.metadataJson, null, 2))}</pre>` : ''}
            ${Object.keys(profile.postingMetadataJson || {}).length ? `<h3>posting_json_metadata</h3><pre>${escapeHtml(JSON.stringify(profile.postingMetadataJson, null, 2))}</pre>` : ''}
          </details>` : ''}
        <details>
          <summary>Сырой JSON аккаунта/API</summary>
          <pre>${escapeHtml(JSON.stringify(profile.raw, null, 2))}</pre>
        </details>
      </section>
    `;
    bindRestNonceCopy(profile);
    bindDecimalRewardsCalculator(profile);
  }

  function renderUnsupported(chain, app) {
    appEl.innerHTML = `
      <section class="panel">
        <h2>${escapeHtml(chain.title)}: ${escapeHtml(app.title)}</h2>
        <p>Этот раздел пока недоступен или требует отдельной безопасной формы подтверждения.</p>
      </section>
    `;
  }

  function renderVizAnalytics(chain) {
    const dashboards = [
      ['2022 год', 'https://datalens.yandex/c3hgr4n693ue3?'],
      ['2021 год', 'https://datalens.yandex/lcqihrxwopkwc?'],
      ['2020 год', 'https://datalens.yandex/qhaak9837szoi?'],
      ['2019 год', 'https://datalens.yandex/8zsqzsvwlvqo0?'],
      ['2018 год', 'https://datalens.yandex/ja318lzhxucub?']
    ];
    appEl.innerHTML = `
      <section class="panel analytics-viz" aria-labelledby="viz-analytics-heading">
        <h2 id="viz-analytics-heading">VIZ: Аналитика</h2>
        <p><strong>Автор: <a href="${escapeHtml(appHash({ chain: 'viz', app: 'profiles', account: 'inov8' }))}">inov8</a></strong></p>
        <p role="status" aria-live="polite">Static-only read-only перенос legacy analytics: старый раздел был набором публичных iframe Yandex DataLens без PHP-вычислений, приватного backend и операций блокчейна.</p>
        <p>Эта страница не запрашивает ключи, не готовит транзакции и не выполняет broadcast. Встроенные виджеты загружаются напрямую с публичного домена DataLens; рядом есть обычные ссылки на случай блокировки iframe браузером или политикой доступности.</p>
        <section class="subpanel" aria-labelledby="viz-analytics-rpc-heading">
          <h3 id="viz-analytics-rpc-heading">Публичная RPC-альтернатива</h3>
          <p>Legacy-аналитика — исторические агрегированные дашборды. Полного индексерного набора из публичной VIZ RPC-ноды не получить одним запросом, но для самостоятельной проверки текущего состояния доступны статические v3-разделы: профиль/кошелёк/история аккаунта через публичные RPC-ноды ${escapeHtml((chain.nodes || []).join(', '))}.</p>
        </section>
        ${dashboards.map(([year, src]) => `
          <section class="subpanel viz-analytics-dashboard" aria-labelledby="viz-analytics-${escapeHtml(year.slice(0, 4))}">
            <h3 id="viz-analytics-${escapeHtml(year.slice(0, 4))}">${escapeHtml(year)}</h3>
            <p><a href="${escapeHtml(src)}" target="_blank" rel="noopener noreferrer">Открыть DataLens dashboard за ${escapeHtml(year)} в новой вкладке</a></p>
            <iframe title="VIZ analytics ${escapeHtml(year)} by inov8" width="100%" height="400" frameborder="0" loading="lazy" src="${escapeHtml(src)}"></iframe>
          </section>`).join('')}
      </section>
    `;
    setStatus('VIZ analytics загружен: read-only static-only DataLens dashboards, без broadcast и приватного backend.', 'ok');
  }

  function renderPrepared(prepared) {
    return rawJsonDetails('Данные операции для проверки', broadcast.sanitizePrepared(prepared));
  }

  function setOperationResult(form, message, state, prepared, result) {
    const resultEl = form.querySelector('[data-operation-result]');
    resultEl.dataset.state = state || 'info';
    const warnings = prepared && prepared.meta && prepared.meta.warnings && prepared.meta.warnings.length
      ? `<ul class="warnings">${prepared.meta.warnings.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
      : '';
    const summary = prepared ? `<p><strong>Кратко перед отправкой:</strong> ${escapeHtml(operationSummary(prepared))}</p>` : '';
    const resultBlock = result ? rawJsonDetails('Ответ сети', broadcast.sanitizeResult(result)) : '';
    resultEl.innerHTML = `<p>${escapeHtml(message)}</p>${summary}${warnings}${prepared ? renderPrepared(prepared) : ''}${resultBlock}`;
    setStatus(message, state || 'info');
  }

  function operationSummary(prepared) {
    const meta = prepared.meta || {};
    const parts = [
      `${prepared.chain}: ${meta.title || prepared.operationName}`,
      `authority ${prepared.authority}`,
      `аккаунт @${prepared.from}`
    ];
    if (meta.to) parts.push(`получатель @${meta.to}`);
    if (meta.amount) parts.push(`сумма ${meta.amount}`);
    if (meta.requestId !== undefined) parts.push(`request id ${meta.requestId}`);
    if (Array.isArray(meta.warnings) && meta.warnings.length) parts.push(`warnings: ${meta.warnings.join('; ')}`);
    return parts.join(', ');
  }

  function amountFromBalance(raw) {
    const match = String(raw || '').match(/\d+(?:\.\d+)?\s+[A-Z]+/);
    return match ? match[0] : '';
  }

  function pickBalance(profile, symbol) {
    const fields = [
      'balance', 'sbd_balance', 'hbd_balance', 'vesting_shares', 'delegated_vesting_shares',
      'reward_balance', 'reward_sbd_balance', 'reward_hbd_balance', 'reward_steem_balance', 'reward_vesting_balance',
      'savings_balance', 'savings_sbd_balance', 'savings_hbd_balance'
    ];
    for (const field of fields) {
      if (profile.raw && typeof profile.raw[field] === 'string' && profile.raw[field].endsWith(` ${symbol}`)) return profile.raw[field];
    }
    return '';
  }


  function numericAssetValue(value) {
    if (value && typeof value === 'object') {
      return numericAssetValue(value.amount || value.value || value.balance);
    }
    const match = String(value || '').match(/-?\d+(?:\.\d+)?/);
    return match ? Number(match[0]) : 0;
  }

  function formatUiaAmount(value, symbol) {
    if (value && typeof value === 'object') {
      return formatUiaAmount(value.amount || value.value || value.balance, symbol);
    }
    if (typeof value === 'string' && value.trim()) {
      return value.includes(symbol) ? value.trim() : `${value.trim()} ${symbol}`;
    }
    return `${Number(value || 0)} ${symbol}`;
  }

  function parseGolosUiaBalanceRows(raw, account) {
    const unwrap = (value) => {
      if (!value) return value;
      if (value.result !== undefined) return unwrap(value.result);
      if (value.data !== undefined) return unwrap(value.data);
      return value;
    };
    const data = unwrap(raw);
    let balances = null;

    if (Array.isArray(data)) {
      balances = data[0] && (data[0].symbol || data[0].asset || data[0].name) ? data : (data[0] || {});
    } else if (data && typeof data === 'object') {
      balances = data[account] || data.balances || data.accounts_balances || data;
    }

    if (!balances || typeof balances !== 'object') return [];

    const entries = Array.isArray(balances)
      ? balances.map((item) => [item && (item.symbol || item.asset || item.name), item])
      : Object.entries(balances);

    return entries.flatMap(([symbol, value]) => {
      const token = String(symbol || '').trim();
      if (!token) return [];
      const mainValue = value && typeof value === 'object' ? (value.balance ?? value.main_balance ?? value.main ?? value.amount) : value;
      const tipValue = value && typeof value === 'object' ? (value.tip_balance ?? value.tipBalance ?? value.tip) : 0;
      const main = numericAssetValue(mainValue);
      const tip = numericAssetValue(tipValue);
      const rows = [];
      if (main > 0) rows.push([`UIA ${token}`, formatUiaAmount(mainValue, token), { kind: 'uia', symbol: token, balanceType: 'main' }]);
      if (tip > 0) rows.push([`UIA ${token} TIP`, formatUiaAmount(tipValue, token), { kind: 'uia', symbol: token, balanceType: 'tip' }]);
      return rows;
    });
  }

  async function callGolosBalancesRpc(connection, account) {
    if (!connection.node || typeof global.fetch !== 'function') {
      throw new Error('get_accounts_balances недоступен: нет fetch или URL ноды для прямого JSON-RPC fallback.');
    }

    const response = await global.fetch(connection.node, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'call', params: ['database_api', 'get_accounts_balances', [[account]]] })
    });
    if (!response.ok) throw new Error(`get_accounts_balances RPC HTTP ${response.status}`);
    const payload = await response.json();
    if (payload.error) throw new Error(payload.error.message || JSON.stringify(payload.error));
    return payload.result;
  }

  async function fetchGolosUiaBalances(connection, account) {
    const api = connection.client && connection.client.api;
    try {
      if (api && typeof api.getAccountsBalancesAsync === 'function') {
        return parseGolosUiaBalanceRows(await api.getAccountsBalancesAsync([account]), account);
      }
      if (api && typeof api.getAccountsBalances === 'function') {
        const rows = await new Promise((resolve, reject) => {
          api.getAccountsBalances([account], (error, result) => error ? reject(error) : resolve(result));
        });
        return parseGolosUiaBalanceRows(rows, account);
      }
      return parseGolosUiaBalanceRows(await callGolosBalancesRpc(connection, account), account);
    } catch (error) {
      return [['UIA балансы', `Не удалось загрузить UIA balances: ${profiles.formatError(error)}`, { kind: 'uia-status' }]];
    }
  }

  async function golosOptionalApi(connection, method, args, fallback) {
    try {
      return await profiles.apiCall(connection, method, args);
    } catch (error) {
      return fallback;
    }
  }

  async function fetchGolosProfileExtras(connection, account) {
    const [followers, following, delegationsOut, delegationsIn, witness, blogPosts, comments] = await Promise.all([
      golosOptionalApi(connection, 'getFollowers', [account, '', 'blog', 11], []),
      golosOptionalApi(connection, 'getFollowing', [account, '', 'blog', 11], []),
      golosOptionalApi(connection, 'getVestingDelegations', [account, '', 100, 'delegated'], []),
      golosOptionalApi(connection, 'getVestingDelegations', [account, '', 100, 'received'], []),
      golosOptionalApi(connection, 'getWitnessByAccount', [account], null),
      golosOptionalApi(connection, 'getDiscussionsByBlog', [{ limit: 10, select_authors: [account] }], []),
      golosOptionalApi(connection, 'getDiscussionsByComments', [{ limit: 10, start_author: account }], [])
    ]);
    return { followers, following, delegationsOut, delegationsIn, witness, blogPosts, comments };
  }

  async function fetchSteemProfileExtras(connection, account) {
    const [followers, following, delegationsOut, delegationsIn, witness, blogPosts, comments] = await Promise.all([
      golosOptionalApi(connection, 'getFollowers', [account, '', 'blog', 11], []),
      golosOptionalApi(connection, 'getFollowing', [account, '', 'blog', 11], []),
      golosOptionalApi(connection, 'getVestingDelegations', [account, '', 100, 'delegated'], []),
      golosOptionalApi(connection, 'getVestingDelegations', [account, '', 100, 'received'], []),
      golosOptionalApi(connection, 'getWitnessByAccount', [account], null),
      golosOptionalApi(connection, 'getDiscussionsByBlog', [{ limit: 10, tag: account }], []),
      golosOptionalApi(connection, 'getDiscussionsByComments', [{ limit: 10, start_author: account }], [])
    ]);
    return { followers, following, delegationsOut, delegationsIn, witness, blogPosts, comments };
  }

  async function fetchHiveProfileExtras(connection, account) {
    const [followers, following, delegationsOut, witness, blogPosts, comments] = await Promise.all([
      golosOptionalApi(connection, 'getFollowers', [account, '', 'blog', 11], []),
      golosOptionalApi(connection, 'getFollowing', [account, '', 'blog', 11], []),
      golosOptionalApi(connection, 'getVestingDelegations', [account, '', 100], []),
      golosOptionalApi(connection, 'getWitnessByAccount', [account], null),
      golosOptionalApi(connection, 'getDiscussionsByBlog', [{ limit: 10, tag: account }], []),
      golosOptionalApi(connection, 'getDiscussionsByComments', [{ limit: 10, start_author: account }], [])
    ]);
    return { followers, following, delegationsOut, witness, blogPosts, comments };
  }

  function parseGolosJsonMetadata(value) {
    try {
      return value && typeof value === 'object' ? value : JSON.parse(String(value || '{}'));
    } catch (_error) {
      return null;
    }
  }

  function golosAssetSymbolFromMaxSupply(maxSupply) {
    const parts = String(maxSupply || '').trim().split(/\s+/);
    return parts.length > 1 ? normalizeGolosTokenSymbol(parts[parts.length - 1], 'UIA symbol') : '';
  }

  function buildGolosUiaGatewayFromAsset(asset) {
    const symbol = asset && (asset.symbol || asset.asset || asset.name || golosAssetSymbolFromMaxSupply(asset.max_supply));
    if (!symbol) return null;
    const token = normalizeGolosTokenSymbol(symbol, 'UIA symbol');
    const meta = parseGolosJsonMetadata(asset.json_metadata);
    if (!meta) return null;

    const gateway = { symbol: token };
    if (meta.deposit && meta.deposit.unavailable !== true) {
      const deposit = meta.deposit;
      gateway.deposit = {
        source: 'metadata',
        details: deposit.details || '',
        to_type: deposit.to_type || '',
        to_fixed: deposit.to_fixed || deposit.to || '',
        memo_fixed: String(deposit.memo_fixed || '').replaceAll('<account>', auth.getCurrentLogin(chains.golos) || ''),
        to_transfer: deposit.to_transfer || '',
        memo_transfer: String(deposit.memo_transfer || '').replaceAll('<account>', auth.getCurrentLogin(chains.golos) || ''),
        min_amount: deposit.min_amount || '',
        fee: deposit.fee || ''
      };
    }

    if (meta.withdrawal && meta.withdrawal.unavailable !== true) {
      const withdrawal = meta.withdrawal;
      gateway.withdraw = {
        source: 'metadata',
        details: withdrawal.details || '',
        min_amount: withdrawal.min_amount || '',
        fee: withdrawal.fee || '',
        account: withdrawal.account || withdrawal.to || '',
        ways: Array.isArray(withdrawal.ways) ? withdrawal.ways.map((way) => ({
          name: way && way.name || '',
          prefix: way && way.prefix || '',
          memo: way && way.memo || '',
          postfix: way && way.postfix || '',
          postfix_title: way && way.postfix_title || ''
        })) : []
      };
    }

    return gateway.deposit || gateway.withdraw ? gateway : null;
  }

  function golosSymbolFromAssetField(value) {
    const parts = String(value || '').trim().split(/\s+/);
    return parts.length > 1 ? parts[parts.length - 1] : '';
  }

  async function fetchAllGolosAssets(api, limit) {
    const assets = [];
    let from = '';
    const pageLimit = limit || 200;
    const hardCap = 5000;
    for (let page = 0; page < 1000; page += 1) {
      const chunk = await api.getAssetsAsync('', [], from, String(pageLimit), 'by_symbol_name');
      if (!Array.isArray(chunk) || chunk.length === 0) break;
      chunk.forEach((asset) => {
        const symbol = golosSymbolFromAssetField(asset && asset.max_supply);
        if (symbol && !assets.some((item) => golosSymbolFromAssetField(item && item.max_supply) === symbol)) assets.push(asset);
      });
      if (assets.length >= hardCap || chunk.length < pageLimit) break;
      const lastSymbol = golosSymbolFromAssetField(chunk[chunk.length - 1] && chunk[chunk.length - 1].max_supply);
      if (!lastSymbol || lastSymbol === from) break;
      from = lastSymbol;
    }
    return assets;
  }

  async function fetchGolosUiaGateways(chain, balanceRows) {
    const balanceSymbols = Array.from(new Set((balanceRows || [])
      .map((row) => row && row[2])
      .filter((meta) => meta && meta.kind === 'uia')
      .map((meta) => normalizeGolosTokenSymbol(meta.symbol, 'UIA symbol'))));
    try {
      await loadScript(chain.libraryPath);
      const connection = await profiles.connect(chain);
      const api = connection.client && connection.client.api;
      if (!api || typeof api.getAssetsAsync !== 'function') return [];
      const assets = await fetchAllGolosAssets(api, 200);
      const gatewayBySymbol = new Map((assets || [])
        .map(buildGolosUiaGatewayFromAsset)
        .filter(Boolean)
        .map((gateway) => [gateway.symbol, gateway]));
      if (balanceSymbols.length) {
        const missing = balanceSymbols.filter((symbol) => !gatewayBySymbol.has(symbol));
        if (missing.length) {
          const balanceAssets = await api.getAssetsAsync('', missing);
          (balanceAssets || []).map(buildGolosUiaGatewayFromAsset).filter(Boolean).forEach((gateway) => gatewayBySymbol.set(gateway.symbol, gateway));
        }
      }
      return Array.from(gatewayBySymbol.values()).sort((a, b) => a.symbol.localeCompare(b.symbol));
    } catch (error) {
      console.warn('Golos UIA gateway metadata was not loaded:', error);
      return [];
    }
  }

  function golosPowerRateFromProfile(profile) {
    return profile && profile.raw ? profiles.golosPowerRate(profile.raw) : 0;
  }

  function formatGolosPowerMax(profile, rawVesting) {
    const rate = golosPowerRateFromProfile(profile);
    const vests = Number.parseFloat(String(rawVesting || '')) || 0;
    if (!rate || !vests) return '';
    return `${(vests / 1000000 * rate).toFixed(6)} СГ`;
  }

  function normalizeGolosPowerInput(profile, value, label) {
    const text = String(value || '').trim().replace(',', '.').replace(/\s*(СГ|SG|GP)$/i, '');
    if (!/^\d+(?:\.\d{1,6})?$/.test(text) || Number(text) < 0) {
      throw new Error(`${label || 'СГ'}: нужно неотрицательное число, например 1.000000.`);
    }
    const rate = golosPowerRateFromProfile(profile);
    if (!rate) throw new Error('Не удалось получить курс GESTS → СГ для подготовки операции. Обновите кошелёк и попробуйте ещё раз.');
    const gests = Number(text) * 1000000 / rate;
    return `${gests.toFixed(6)} GESTS`;
  }

  function bindMaxButtons(root) {
    root.querySelectorAll('[data-fill-target]').forEach((button) => {
      button.addEventListener('click', () => {
        const target = root.querySelector(`#${button.dataset.fillTarget}`);
        if (!target) return;
        if (button.dataset.fillSelected) {
          const select = root.querySelector(`#${button.dataset.fillSelected}`);
          const option = select && select.selectedOptions && select.selectedOptions[0];
          target.value = option && option.dataset.max ? amountFromBalance(option.dataset.max) : '';
          target.focus();
          return;
        }
        target.value = button.dataset.fillValue || '';
        target.focus();
      });
    });
  }

  function walletQuickActionButton(label, formId, fills) {
    const attrs = Object.entries(fills || {})
      .filter(([, value]) => value !== undefined && value !== null && value !== '')
      .map(([fieldId, value]) => `data-wallet-fill-${escapeHtml(fieldId)}="${escapeHtml(value)}"`)
      .join(' ');
    if (!attrs) return '';
    return `<button type="button" data-wallet-open-form="${escapeHtml(formId)}" ${attrs}>${escapeHtml(label)}</button>`;
  }

  function bindGrapheneWalletQuickActions(root) {
    root.querySelectorAll('[data-wallet-open-form]').forEach((button) => {
      button.addEventListener('click', () => {
        const form = root.querySelector(`#${button.dataset.walletOpenForm}`);
        if (!form) return;
        const details = form.closest('details');
        if (details) details.open = true;
        let target = null;
        Object.entries(button.dataset).forEach(([key, value]) => {
          if (!key.startsWith('walletFill')) return;
          const id = key.slice('walletFill'.length).replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`).replace(/^-/, '');
          const field = root.querySelector(`#${id}`);
          if (!field) return;
          field.value = value;
          if (!target) target = field;
        });
        if (!target) target = form.querySelector('input:not([type="hidden"]), textarea, select, button[type="submit"]');
        if (target) target.focus();
        setStatus('Форма открыта и заполнена из строки кошелька. Проверьте данные перед отправкой.', 'info');
      });
    });
  }

  function bindCopyButtons(root) {
    root.querySelectorAll('[data-copy-value]').forEach((button) => {
      button.addEventListener('click', async () => {
        const value = button.dataset.copyValue || '';
        try {
          if (global.navigator && global.navigator.clipboard && typeof global.navigator.clipboard.writeText === 'function') {
            await global.navigator.clipboard.writeText(value);
          } else {
            const area = document.createElement('textarea');
            area.value = value;
            area.setAttribute('readonly', '');
            area.style.position = 'absolute';
            area.style.left = '-9999px';
            document.body.appendChild(area);
            area.select();
            document.execCommand('copy');
            document.body.removeChild(area);
          }
          button.textContent = 'Скопировано';
          global.setTimeout(() => { button.textContent = 'Скопировать'; }, 2000);
        } catch (error) {
          button.textContent = 'Не удалось скопировать';
        }
      });
    });
  }

  function normalizeAccountInput(chain, value, label) {
    return broadcast.validateAccountName(chain, value, label);
  }

  function normalizeAssetInput(chain, value, symbols, label) {
    return broadcast.validateAsset(chain, value, symbols, label);
  }

  function normalizeGolosTokenSymbol(value, label) {
    const symbol = String(value || '').trim().toUpperCase();
    if (!/^[A-Z][A-Z0-9]{0,15}$/.test(symbol)) {
      throw new Error(`${label || 'Токен'}: нужен UIA symbol в формате A-Z/0-9.`);
    }
    return symbol;
  }

  async function fetchGolosAsset(chain, symbol) {
    const token = normalizeGolosTokenSymbol(symbol, 'Токен');
    await loadScript(chain.libraryPath);
    const connection = await profiles.connect(chain);
    const api = connection.client && connection.client.api;
    if (!api || typeof api.getAssetsAsync !== 'function') {
      throw new Error('Не удалось получить данные UIA: golos.api.getAssetsAsync недоступен. Операция не подготовлена.');
    }
    const assets = await api.getAssetsAsync('', [token]);
    const asset = assets && assets[0];
    if (!asset) {
      throw new Error(`UIA ${token} не найден через getAssetsAsync.`);
    }
    return asset;
  }

  async function fetchGolosAssetPrecision(chain, symbol) {
    const token = normalizeGolosTokenSymbol(symbol, 'Токен');
    if (token === (chain.liquidSymbol || 'GOLOS') || token === (chain.debtSymbol || 'GBG')) return 3;
    const asset = await fetchGolosAsset(chain, token);
    if (asset.precision === undefined || asset.precision === null) {
      throw new Error(`Не удалось получить precision для UIA ${token}. Операция не подготовлена.`);
    }
    const precision = Number(asset.precision);
    if (!Number.isInteger(precision) || precision < 0 || precision > 18) {
      throw new Error(`Некорректный precision для UIA ${token}: ${asset.precision}.`);
    }
    return precision;
  }

  async function assertGolosTipTransferAllowed(chain, symbol) {
    const token = normalizeGolosTokenSymbol(symbol, 'Токен');
    if (token === (chain.liquidSymbol || 'GOLOS') || token === (chain.debtSymbol || 'GBG')) return;
    const asset = await fetchGolosAsset(chain, token);
    if (asset.allow_override_transfer === true) {
      throw new Error(`UIA ${token} запрещает transfer_to_tip: allow_override_transfer=true. Используйте обычный UIA transfer с основного баланса.`);
    }
  }

  async function normalizeGolosTokenAmount(chain, amount, symbol, label) {
    const token = normalizeGolosTokenSymbol(symbol, 'Токен');
    const text = String(amount || '').trim().replace(',', '.').replace(new RegExp(`\\s${token}$`, 'i'), '');
    if (!/^\d+(?:\.\d+)?$/.test(text) || Number(text) <= 0) {
      throw new Error(`${label || 'Сумма'}: нужно положительное число.`);
    }
    const precision = await fetchGolosAssetPrecision(chain, token);
    return `${Number(text).toFixed(precision)} ${token}`;
  }

  async function encodeGolosMemoIfNeeded(chain, to, memo, privateKey) {
    const text = String(memo || '');
    if (text[0] !== '#') return text;
    await loadScript(chain.libraryPath);
    const connection = await profiles.connect(chain);
    const api = connection.client && connection.client.api;
    const client = connection.client || global[chain.libraryGlobal];
    if (!api || typeof api.getAccountsAsync !== 'function' || !client || !client.memo || typeof client.memo.encode !== 'function') {
      throw new Error('Зашифрованное memo (#...) не подготовлено: API memo недоступен.');
    }
    const accounts = await api.getAccountsAsync([to]);
    const account = accounts && accounts[0];
    if (!account || !account.memo_key) {
      throw new Error(`Зашифрованное memo (#...) не подготовлено: memo_key аккаунта @${to} не получен.`);
    }
    return client.memo.encode(privateKey, account.memo_key, text);
  }

  async function encodeVizMemoIfNeeded(chain, to, memo, privateKey) {
    const text = String(memo || '');
    if (text[0] !== '#') return text;
    await loadScript(chain.libraryPath);
    const connection = await profiles.connect(chain);
    const api = connection.client && connection.client.api;
    const client = connection.client || global[chain.libraryGlobal];
    if (!api || typeof api.getAccountsAsync !== 'function' || !client || !client.memo || typeof client.memo.encode !== 'function') {
      throw new Error('Зашифрованное memo (#...) не подготовлено: API memo недоступен.');
    }
    const accounts = await api.getAccountsAsync([to]);
    const account = accounts && accounts[0];
    if (!account || !account.memo_key) {
      throw new Error(`Зашифрованное memo (#...) не подготовлено: memo_key аккаунта @${to} не получен.`);
    }
    return client.memo.encode(privateKey, account.memo_key, text);
  }


  async function encodeSteemMemoIfNeeded(chain, to, memo, privateKey) {
    const text = String(memo || '');
    if (text[0] !== '#') return text;
    await loadScript(chain.libraryPath);
    const connection = await profiles.connect(chain);
    const api = connection.client && connection.client.api;
    const client = connection.client || global[chain.libraryGlobal];
    if (!privateKey) {
      throw new Error('Зашифрованное memo (#...) не подготовлено: active-ключ недоступен.');
    }
    if (!api || typeof api.getAccountsAsync !== 'function' || !client || !client.memo || typeof client.memo.encode !== 'function') {
      throw new Error('Зашифрованное memo (#...) не подготовлено: memo API Steem недоступен.');
    }
    const accounts = await api.getAccountsAsync([to]);
    const account = accounts && accounts[0];
    if (!account || !account.memo_key) {
      throw new Error(`Зашифрованное memo (#...) не подготовлено: memo_key аккаунта @${to} не получен.`);
    }
    return client.memo.encode(privateKey, account.memo_key, text);
  }

  async function encodeHiveMemoIfNeeded(chain, to, memo, privateKey) {
    const text = String(memo || '');
    if (text[0] !== '#') return text;
    await loadScript(chain.libraryPath);
    const connection = await profiles.connect(chain);
    const api = connection.client && connection.client.api;
    const client = connection.client || global[chain.libraryGlobal];
    if (!privateKey) {
      throw new Error('Зашифрованное memo (#...) не подготовлено: active-ключ недоступен.');
    }
    if (!api || typeof api.getAccountsAsync !== 'function' || !client || !client.memo || typeof client.memo.encode !== 'function') {
      throw new Error('Зашифрованное memo (#...) не подготовлено: memo API Hive недоступен.');
    }
    const accounts = await api.getAccountsAsync([to]);
    const account = accounts && accounts[0];
    if (!account || !account.memo_key) {
      throw new Error(`Зашифрованное memo (#...) не подготовлено: memo_key аккаунта @${to} не получен.`);
    }
    return client.memo.encode(privateKey, account.memo_key, text);
  }

  function isSteemMemoWif(chain, memo) {
    const text = String(memo || '').trim();
    if (!text) return false;
    const client = global[chain.libraryGlobal];
    if (client && client.auth && typeof client.auth.isWif === 'function') {
      try { return Boolean(client.auth.isWif(text)); } catch (_error) { /* fallback below */ }
    }
    return /^5[1-9A-HJ-NP-Za-km-z]{45,55}$/.test(text);
  }

  function randomLegacySeed(length) {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+-=_:;.,@!^&*$';
    let seed = '';
    for (let i = 0; i < (length || 100); i += 1) seed += charset.charAt(Math.floor(Math.random() * charset.length));
    return seed;
  }

  function secureRandomLegacySeed(length) {
    if (!global.crypto || typeof global.crypto.getRandomValues !== 'function') {
      throw new Error('Криптографический генератор браузера недоступен: сброс ключей остановлен.');
    }
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+-=_:;.,@!^&*$';
    const bytes = new Uint32Array(length || 100);
    global.crypto.getRandomValues(bytes);
    let seed = '';
    bytes.forEach((value) => { seed += charset.charAt(value % charset.length); });
    return seed;
  }

  function generateVizInviteSecret() {
    const client = global.viz;
    const seed = secureRandomLegacySeed(100);
    if (client && client.auth && typeof client.auth.toWif === 'function') return client.auth.toWif('', seed, '');
    throw new Error('viz.auth.toWif недоступен: invite secret можно только вставить вручную.');
  }

  function generateGolosInviteSecret() {
    const client = global.golos;
    const seed = secureRandomLegacySeed(100);
    if (client && client.auth && typeof client.auth.toWif === 'function') return client.auth.toWif('', seed, '');
    throw new Error('golos.auth.toWif недоступен: invite secret можно только вставить вручную.');
  }

  function golosInvitePublic(secret) {
    const client = global.golos;
    const value = String(secret || '').trim();
    if (!value) throw new Error('Введите invite secret WIF.');
    if (!client || !client.auth || typeof client.auth.wifToPublic !== 'function') {
      throw new Error('golos.auth.wifToPublic недоступен: публичный ключ invite нельзя вычислить.');
    }
    return client.auth.wifToPublic(value);
  }

  function generateVizRegistrationKey() {
    const client = global.viz;
    if (!client || !client.auth || typeof client.auth.toWif !== 'function' || typeof client.auth.wifToPublic !== 'function') {
      throw new Error('viz.auth.toWif/wifToPublic недоступны: ключ нового аккаунта можно только вставить публичным ключом вручную.');
    }
    const privateKey = client.auth.toWif('', secureRandomLegacySeed(100), '');
    return { privateKey, publicKey: client.auth.wifToPublic(privateKey) };
  }

  function vizInvitePublic(secret) {
    const client = global.viz;
    const value = String(secret || '').trim();
    if (!value) throw new Error('Введите invite secret WIF.');
    if (!client || !client.auth || typeof client.auth.wifToPublic !== 'function') {
      throw new Error('viz.auth.wifToPublic недоступен: публичный ключ invite нельзя вычислить.');
    }
    return client.auth.wifToPublic(value);
  }

  function generateVizResetKeys(account) {
    const client = global.viz;
    if (!client || !client.auth || typeof client.auth.getPrivateKeys !== 'function') {
      throw new Error('viz.auth.getPrivateKeys недоступен: сброс/создание ключей нельзя подготовить безопасно.');
    }
    const seed = secureRandomLegacySeed(100);
    return client.auth.getPrivateKeys(account, seed, ['master', 'active', 'regular', 'memo']);
  }

  function generateGolosResetKeys(account) {
    const client = global.golos;
    if (!client || !client.auth || typeof client.auth.getPrivateKeys !== 'function') {
      throw new Error('golos.auth.getPrivateKeys недоступен: сброс ключей нельзя подготовить безопасно.');
    }
    const seed = secureRandomLegacySeed(100);
    return client.auth.getPrivateKeys(account, seed, ['owner', 'active', 'posting', 'memo']);
  }

  function parseJsonObject(value, fallback) {
    if (!value) return fallback || {};
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : (fallback || {});
    } catch (error) {
      return fallback || {};
    }
  }

  function normalizeGolosProfileTags(value) {
    const seen = new Set();
    return String(value || '').split(',')
      .map((item) => item.trim().toLowerCase())
      .filter((item) => item && !seen.has(item) && seen.add(item));
  }

  function parseAuthorityAccountAuths(value) {
    return String(value || '').split(/\r?\n|,/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const parts = line.split(/[:=\s]+/).filter(Boolean);
        if (parts.length < 2) throw new Error(`Account auth должен быть в формате account=weight: ${line}`);
        const account = parts[0].replace(/^@/, '');
        const weight = Number.parseInt(parts[1], 10);
        if (!account || !Number.isFinite(weight) || weight <= 0) throw new Error(`Некорректный account auth: ${line}`);
        return [account, weight];
      });
  }

  function parseSignedTransactionJson(value) {
    try {
      const parsed = JSON.parse(String(value || '').trim());
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('empty');
      if (!Array.isArray(parsed.signatures) || !Array.isArray(parsed.operations)) {
        throw new Error('Signed transaction JSON должен содержать operations[] и signatures[].');
      }
      return parsed;
    } catch (error) {
      if (error && error.message && error.message.includes('operations')) throw error;
      throw new Error('Signed transaction должен быть корректным JSON объектом.');
    }
  }

  function fillFormValue(form, name, value) {
    const field = form && form.elements ? form.elements[name] : null;
    if (!field) return;
    if (field.type === 'checkbox') field.checked = Boolean(value);
    else field.value = value == null ? '' : String(value);
  }

  function witnessPropsFieldNames(chain) {
    const common = ['account_creation_fee', 'maximum_block_size'];
    if (chain.id === 'viz') return common.concat([
      'create_account_delegation_ratio', 'create_account_delegation_time', 'min_delegation',
      'bandwidth_reserve_percent', 'bandwidth_reserve_below', 'vote_accounting_min_rshares',
      'committee_request_approve_min_percent', 'inflation_witness_percent',
      'inflation_ratio_committee_vs_reward_fund', 'inflation_recalc_period',
      'data_operations_cost_additional_bandwidth', 'witness_miss_penalty_percent',
      'witness_miss_penalty_duration', 'create_invite_min_balance', 'committee_create_request_fee',
      'create_paid_subscription_fee', 'account_on_sale_fee', 'subaccount_on_sale_fee',
      'witness_declaration_fee', 'withdraw_intervals'
    ]);
    if (chain.id === 'golos') return common.concat(['create_account_delegation', 'create_account_delegation_ratio', 'create_account_delegation_time', 'min_delegation']);
    if (chain.id === 'hive') return common.concat(['hbd_interest_rate', 'account_subsidy_budget', 'account_subsidy_decay']);
    if (chain.id === 'steem') return common.concat(['sbd_interest_rate', 'account_subsidy_budget', 'account_subsidy_decay']);
    return common;
  }

  function witnessPropsFieldLabel(name) {
    return {
      account_creation_fee: 'Комиссия создания аккаунта',
      maximum_block_size: 'Максимальный размер блока',
      create_account_delegation: 'Делегирование при создании аккаунта',
      create_account_delegation_ratio: 'Коэффициент делегирования аккаунта',
      create_account_delegation_time: 'Срок делегирования аккаунта, сек.',
      min_delegation: 'Минимальное делегирование',
      bandwidth_reserve_percent: 'Резерв bandwidth, %',
      bandwidth_reserve_below: 'Порог резервного bandwidth',
      vote_accounting_min_rshares: 'Минимальный rshares для учёта голоса',
      committee_request_approve_min_percent: 'Минимальный % для заявки фонда',
      inflation_witness_percent: 'Доля эмиссии делегатам, %',
      inflation_ratio_committee_vs_reward_fund: 'Соотношение фонд DAO / фонд наград',
      inflation_recalc_period: 'Период пересчёта инфляции',
      data_operations_cost_additional_bandwidth: 'Наценка bandwidth за data-операции',
      witness_miss_penalty_percent: 'Штраф за пропуск блока, %',
      witness_miss_penalty_duration: 'Длительность штрафа за пропуск',
      create_invite_min_balance: 'Минимальный баланс инвайта',
      committee_create_request_fee: 'Комиссия заявки фонда',
      create_paid_subscription_fee: 'Комиссия платной подписки',
      account_on_sale_fee: 'Комиссия продажи аккаунта',
      subaccount_on_sale_fee: 'Комиссия продажи субаккаунта',
      witness_declaration_fee: 'Комиссия декларации делегата',
      withdraw_intervals: 'Количество интервалов вывода',
      hbd_interest_rate: 'HBD interest rate',
      sbd_interest_rate: 'SBD interest rate',
      account_subsidy_budget: 'Бюджет субсидий аккаунтов',
      account_subsidy_decay: 'Скорость убывания субсидий аккаунтов'
    }[name] || name;
  }

  function witnessPropsFieldPlaceholder(chain, name) {
    if (name.endsWith('_fee') || name === 'account_creation_fee' || name === 'create_account_delegation' || name === 'min_delegation' || name === 'create_invite_min_balance') return `0.000 ${chain.liquidSymbol}`;
    if (name === 'maximum_block_size') return '65536';
    return 'число';
  }

  function renderWitnessPropsFields(chain, formIdPrefix) {
    const rows = witnessPropsFieldNames(chain).map((name) => `<div class="field"><label for="${formIdPrefix}-${name}">${escapeHtml(witnessPropsFieldLabel(name))} <code>${escapeHtml(name)}</code></label><input id="${formIdPrefix}-${name}" name="${escapeHtml(name)}" type="text" placeholder="${escapeHtml(witnessPropsFieldPlaceholder(chain, name))}"></div>`).join('');
    return `${rows}<details><summary>Дополнительные props JSON</summary><p class="muted">Необязательный JSON для редких параметров. Значения из JSON объединяются с полями выше; поля имеют приоритет.</p><div class="field"><label for="${formIdPrefix}-extra-json">Дополнительные props JSON</label><textarea id="${formIdPrefix}-extra-json" name="extraProps" rows="4" placeholder='{"custom_prop":"value"}'></textarea></div></details>`;
  }

  function normalizeWitnessPropValue(raw) {
    const text = String(raw == null ? '' : raw).trim();
    if (!text) return undefined;
    if (/^-?\d+$/.test(text)) return Number(text);
    if (/^-?\d+\.\d+$/.test(text) && !/\s[A-Z]{2,}$/.test(text)) return Number(text);
    return text;
  }

  function collectWitnessPropsFromForm(chain, form) {
    let props = {};
    const extraRaw = String(form.get('extraProps') || '').trim();
    if (extraRaw) {
      try { props = JSON.parse(extraRaw); } catch (error) { throw new Error('Дополнительные props JSON должен быть корректным JSON.'); }
    }
    witnessPropsFieldNames(chain).forEach((name) => {
      const value = normalizeWitnessPropValue(form.get(name));
      if (typeof value !== 'undefined') props[name] = value;
    });
    if (!Object.keys(props).length) throw new Error('Заполните хотя бы одно поле witness props или дополнительный JSON.');
    return props;
  }

  function fillWitnessPropsForm(form, chain, props) {
    if (!form) return;
    const known = new Set(witnessPropsFieldNames(chain));
    const extra = {};
    Object.keys(props || {}).forEach((name) => {
      if (known.has(name)) fillFormValue(form, name, props[name]);
      else extra[name] = props[name];
    });
    fillFormValue(form, 'extraProps', Object.keys(extra).length ? JSON.stringify(extra, null, 2) : '');
  }

  async function prefillManageProfile(chain) {
    if (chain.id !== 'golos' && chain.id !== 'hive' && chain.id !== 'steem') return;
    const form = document.getElementById('manage-profile-form');
    const result = document.getElementById('manage-profile-prefill-result');
    if (!form) return;
    try {
      if (result) result.textContent = 'Загружаю текущий json_metadata профиля...';
      const account = await fetchChainAccount(chain, auth.getCurrentLogin(chain));
      const metadata = parseJsonObject(account && account.json_metadata, {});
      const profile = metadata.profile || {};
      ['name', 'about', 'profile_image', 'cover_image', 'gender', 'location', 'website', 'mail', 'facebook', 'instagram', 'twitter', 'vk', 'telegram', 'skype', 'viber', 'whatsapp'].forEach((name) => fillFormValue(form, name, profile[name] || ''));
      const rawTags = (chain.id === 'hive' || chain.id === 'steem') ? (profile.interests || profile.select_tags || '') : (profile.select_tags || '');
      const tags = Array.isArray(rawTags) ? rawTags.join(', ') : rawTags;
      fillFormValue(form, 'select_tags', tags);
      if (result) result.textContent = 'Текущий профиль загружен из json_metadata. При отправке v3 сохранит остальные поля metadata.';
    } catch (error) {
      if (result) result.textContent = profiles.formatError(error);
    }
  }

  const prefillGolosManageProfile = prefillManageProfile;

  async function loadManageWitnessSettings(chain) {
    if (chain.id !== 'golos' && chain.id !== 'viz' && chain.id !== 'hive' && chain.id !== 'steem') return;
    const result = document.getElementById('manage-witness-prefill-result');
    try {
      const connection = await getConnection(chain);
      const account = auth.getCurrentLogin(chain);
      const witness = await profiles.apiCall(connection, 'getWitnessByAccount', [account]);
      if (!witness) throw new Error('Witness для текущего аккаунта не найден.');
      const form = document.getElementById('manage-witness-update-form');
      fillFormValue(form, 'url', witness.url || '');
      fillFormValue(form, 'signingKey', witness.signing_key || witness.signingKey || '');
      fillFormValue(form, 'fee', `0.000 ${chain.liquidSymbol}`);
      let props = witness.props || {};
      if (!Object.keys(props).length) {
        props = await profiles.apiCall(connection, 'getChainProperties', []).catch(() => props);
      }
      const propsForm = document.getElementById(chain.id === 'viz' ? 'viz-witness-props-form' : 'manage-witness-props-form');
      fillWitnessPropsForm(propsForm, chain, props);
      const propsResult = document.getElementById(chain.id === 'viz' ? 'viz-witness-props-prefill-result' : 'manage-witness-props-prefill-result');
      if (propsResult) propsResult.textContent = 'Witness props загружены в поля формы.';
      if (result) result.textContent = 'Witness настройки загружены через getWitnessByAccount.';
    } catch (error) {
      if (result) result.textContent = profiles.formatError(error);
    }
  }

  async function loadGolosFollowingList(chain) {
    if (chain.id !== 'golos') return;
    const result = document.getElementById('manage-following-result');
    try {
      if (result) result.textContent = 'Загружаю подписки через getFollowing...';
      const connection = await getConnection(chain);
      const follower = auth.getCurrentLogin(chain);
      let start = '';
      const rows = [];
      for (let page = 0; page < 10; page += 1) {
        const chunk = await profiles.apiCall(connection, 'getFollowing', [follower, start, 'blog', 100]);
        if (!Array.isArray(chunk) || !chunk.length) break;
        chunk.forEach((row) => {
          const following = row.following || row[1] || '';
          if (following && following !== start) rows.push(following);
        });
        const last = rows[rows.length - 1];
        if (!last || last === start || chunk.length < 100) break;
        start = last;
      }
      if (!result) return;
      if (!rows.length) {
        result.textContent = 'Подписки не найдены или API вернул пустой список.';
        return;
      }
      result.innerHTML = `<ul>${rows.map((name) => `<li>${escapeHtml(name)} <button type="button" data-following-action="unfollow" data-following-account="${escapeHtml(name)}">отписаться</button></li>`).join('')}</ul>`;
      result.querySelectorAll('[data-following-account]').forEach((button) => {
        button.addEventListener('click', () => {
          const form = document.getElementById('manage-follow-form');
          fillFormValue(form, 'following', button.dataset.followingAccount || '');
          fillFormValue(form, 'mode', button.dataset.followingAction || 'unfollow');
          setStatus('Подписка выбрана в форме follow/unfollow. Нажмите проверку или отправку.', 'info');
        });
      });
    } catch (error) {
      if (result) result.textContent = profiles.formatError(error);
    }
  }

  async function loadGolosWorkerRequests(chain) {
    if (chain.id !== 'golos') return;
    const result = document.getElementById('manage-workers-result');
    const activeList = document.getElementById('manage-workers-active-list');
    const historyList = document.getElementById('manage-workers-history-list');
    try {
      if (result) result.textContent = 'Загружаю worker requests через getWorkerRequests...';
      const connection = await getConnection(chain);
      const states = ['created', 'payment', 'payment_complete', 'closed_by_author', 'closed_by_expiration', 'closed_by_voters'];
      const groups = [];
      for (const state of states) {
        const modernQuery = state === 'created' ? { limit: 100, select_states: [state] } : { limit: 30, select_states: [state] };
        const legacyQuery = { state, limit: state === 'created' ? 100 : 30 };
        let rows = await profiles.apiCall(connection, 'getWorkerRequests', [modernQuery, 'by_created', true]).catch(() => []);
        if (!Array.isArray(rows) || !rows.length) rows = await profiles.apiCall(connection, 'getWorkerRequests', [legacyQuery, 'by_created', true]).catch(() => []);
        groups.push([state, Array.isArray(rows) ? rows : []]);
      }
      const activeRows = groups.find(([state]) => state === 'created')?.[1] || [];
      const historyRows = groups.filter(([state]) => state !== 'created');
      if (activeList) activeList.innerHTML = activeRows.length ? activeRows.map((row) => renderGolosWorkerCard(row, true)).join('') : '<p class="muted">Активных заявок для голосования нет.</p>';
      if (historyList) historyList.innerHTML = historyRows.map(([state, rows]) => `<details><summary>${escapeHtml(workerStateLabel(state))}: ${rows.length}</summary>${rows.length ? `<div class="request-list">${rows.map((row) => renderGolosWorkerCard(row, false)).join('')}</div>` : '<p class="muted">Нет заявок.</p>'}</details>`).join('');
      const bindButtons = (root) => {
        if (!root) return;
        root.querySelectorAll('[data-worker-vote]').forEach((button) => {
          button.addEventListener('click', () => {
            const form = document.getElementById('manage-workers-vote-form');
            fillFormValue(form, 'author', button.dataset.workerVote || '');
            fillFormValue(form, 'permlink', button.dataset.workerPermlink || '');
            setStatus('Worker request выбран в форме голосования.', 'info');
          });
        });
        root.querySelectorAll('[data-worker-open]').forEach((button) => {
          button.addEventListener('click', () => loadGolosWorkerRequestDetail(chain, button.dataset.workerOpen || '', button.dataset.workerPermlink || ''));
        });
      };
      bindButtons(activeList);
      bindButtons(historyList);
      if (result) result.textContent = 'Worker requests загружены: активные заявки отдельно от истории.';
    } catch (error) {
      if (result) result.textContent = profiles.formatError(error);
    }
  }

  async function loadGolosWorkerRequestDetail(chain, author, permlink) {
    if (chain.id !== 'golos') return;
    const page = document.getElementById('manage-worker-detail-page');
    if (!page) return;
    try {
      page.hidden = false;
      page.innerHTML = '<p class="muted">Загружаю заявку и голоса...</p>';
      const connection = await getConnection(chain);
      const rows = await profiles.apiCall(connection, 'getWorkerRequests', [{ limit: 1, start_author: author, start_permlink: permlink }, 'by_created', true]);
      const row = Array.isArray(rows) ? rows[0] : rows;
      if (!row) throw new Error('Заявка не найдена.');
      const post = row.post || {};
      const reqAuthor = post.author || row.author || author;
      const reqPermlink = post.permlink || row.permlink || permlink;
      const votes = await profiles.apiCall(connection, 'getWorkerRequestVotes', [reqAuthor, reqPermlink, '', 100]).catch(() => []);
      const voteHtml = Array.isArray(votes) && votes.length ? `<ol>${votes.map((vote) => `<li>${accountLink(chain, vote.voter)} — ${escapeHtml((Number(vote.vote_percent || 0) / 100).toString())}%</li>`).join('')}</ol>` : '<p class="muted">Голоса не найдены или RPC их не вернул.</p>';
      page.innerHTML = `<article class="request-detail"><button type="button" id="manage-worker-detail-back">← Вернуться к управлению</button><h3>${escapeHtml(requestTitle(row))}</h3><dl class="kv-list"><div><dt>Статус</dt><dd>${escapeHtml(workerStateLabel(row.state))}</dd></div><div><dt>Автор</dt><dd>${accountLink(chain, reqAuthor)}</dd></div><div><dt>Воркер</dt><dd>${accountLink(chain, row.worker)}</dd></div><div><dt>Ссылка</dt><dd>${post.url ? `<a href="${escapeHtml(post.url)}" target="_blank" rel="noopener">${escapeHtml(post.url)}</a>` : `${escapeHtml(reqAuthor)}/${escapeHtml(reqPermlink)}`}</dd></div><div><dt>Мин/макс</dt><dd>${escapeHtml(row.required_amount_min || '')} — ${escapeHtml(row.required_amount_max || '')}</dd></div><div><dt>Длительность</dt><dd>${escapeHtml(row.duration ? `${Number(row.duration) / 86400} дней` : '')}</dd></div></dl><h4>Голоса за заявку</h4>${voteHtml}</article>`;
      const back = document.getElementById('manage-worker-detail-back');
      if (back) back.addEventListener('click', () => { page.hidden = true; page.innerHTML = ''; });
    } catch (error) {
      page.innerHTML = `<p class="error">${escapeHtml(profiles.formatError(error))}</p><button type="button" id="manage-worker-detail-back">← Вернуться к управлению</button>`;
      const back = document.getElementById('manage-worker-detail-back');
      if (back) back.addEventListener('click', () => { page.hidden = true; page.innerHTML = ''; });
    }
  }

  async function loadVizCommitteeRequests(chain) {
    if (chain.id !== 'viz') return;
    const result = document.getElementById('viz-committee-result');
    const activeList = document.getElementById('viz-committee-active-list');
    const historyList = document.getElementById('viz-committee-history-list');
    try {
      if (result) result.textContent = 'Загружаю заявки фонда развития через публичный RPC...';
      const connection = await getConnection(chain);
      const props = await profiles.apiCall(connection, 'getDynamicGlobalProperties', []).catch(() => ({}));
      if (result && props.committee_fund) result.textContent = `Фонд развития: ${props.committee_fund}`;
      const latestId = Number(props.committee_requests || props.committee_requests_count || props.committee_request_count || 0);
      const ids = latestId ? Array.from({ length: Math.min(latestId, 100) }, (_, index) => latestId - index).filter((id) => id > 0) : Array.from({ length: 50 }, (_, index) => index + 1);
      const rows = [];
      for (const id of ids) {
        const row = await profiles.apiCall(connection, 'getCommitteeRequest', [id, 20]).catch(() => null);
        if (row && (row.request_id !== undefined || row.id !== undefined || row.worker)) rows.push(row);
      }
      const activeRows = rows.filter((row) => Number(row.status ?? row.state) === 0);
      const historyRows = rows.filter((row) => Number(row.status ?? row.state) !== 0);
      if (activeList) activeList.innerHTML = activeRows.length ? activeRows.map((row) => renderVizCommitteeCard(row, true)).join('') : '<p class="muted">Активных заявок фонда развития нет.</p>';
      if (historyList) historyList.innerHTML = historyRows.length ? historyRows.map((row) => renderVizCommitteeCard(row, false)).join('') : '<p class="muted">История заявок не загружена или пуста.</p>';
      const bindButtons = (root) => {
        if (!root) return;
        root.querySelectorAll('[data-viz-committee-vote]').forEach((button) => {
          button.addEventListener('click', () => {
            const form = document.getElementById('viz-committee-vote-form');
            fillFormValue(form, 'requestId', button.dataset.vizCommitteeVote || '');
            setStatus('Заявка фонда развития выбрана в форме голосования.', 'info');
          });
        });
        root.querySelectorAll('[data-viz-committee-open]').forEach((button) => {
          button.addEventListener('click', () => loadVizCommitteeRequestDetail(chain, button.dataset.vizCommitteeOpen || ''));
        });
      };
      bindButtons(activeList);
      bindButtons(historyList);
    } catch (error) {
      if (result) result.textContent = profiles.formatError(error);
    }
  }

  async function loadVizCommitteeRequestDetail(chain, requestId) {
    if (chain.id !== 'viz') return;
    const page = document.getElementById('viz-committee-detail-page');
    if (!page) return;
    try {
      page.hidden = false;
      page.innerHTML = '<p class="muted">Загружаю заявку фонда развития...</p>';
      const connection = await getConnection(chain);
      const row = await profiles.apiCall(connection, 'getCommitteeRequest', [Number(requestId), 100]);
      if (!row) throw new Error('Заявка не найдена.');
      const votes = Array.isArray(row.votes) ? row.votes : [];
      const voteHtml = votes.length ? `<ol>${votes.map((vote) => `<li>${escapeHtml(vote.time ? history.formatDate(vote.time) : '')} ${accountLink(chain, vote.voter)} — ${escapeHtml((Number(vote.vote_percent || 0) / 100).toString())}%</li>`).join('')}</ol>` : '<p class="muted">Голоса не найдены или RPC их не вернул.</p>';
      page.innerHTML = `<article class="request-detail"><button type="button" id="viz-committee-detail-back">← Вернуться к управлению</button><h3>Заявка №${escapeHtml(row.request_id ?? requestId)}</h3><dl class="kv-list"><div><dt>Статус</dt><dd>${escapeHtml(workerStateLabel(row.status ?? row.state))}</dd></div><div><dt>Создатель</dt><dd>${accountLink(chain, row.creator)}</dd></div><div><dt>Воркер</dt><dd>${accountLink(chain, row.worker)}</dd></div><div><dt>URL</dt><dd>${row.url ? `<a href="${escapeHtml(row.url)}" target="_blank" rel="noopener">${escapeHtml(row.url)}</a>` : ''}</dd></div><div><dt>Мин/макс</dt><dd>${escapeHtml(row.required_amount_min || '')} — ${escapeHtml(row.required_amount_max || '')}</dd></div></dl><h4>Голоса за заявку</h4>${voteHtml}</article>`;
      const back = document.getElementById('viz-committee-detail-back');
      if (back) back.addEventListener('click', () => { page.hidden = true; page.innerHTML = ''; });
    } catch (error) {
      page.innerHTML = `<p class="error">${escapeHtml(profiles.formatError(error))}</p><button type="button" id="viz-committee-detail-back">← Вернуться к управлению</button>`;
      const back = document.getElementById('viz-committee-detail-back');
      if (back) back.addEventListener('click', () => { page.hidden = true; page.innerHTML = ''; });
    }
  }

  function parseGolosWorkerPostUrl(rawUrl) {
    const text = String(rawUrl || '').trim();
    const match = text.match(/@([a-z0-9.-]+)\/([^/?#]+)/i);
    if (!match) throw new Error('URL заявки должен содержать @author/permlink.');
    return { author: match[1], permlink: match[2] };
  }

  function manageNullSigningKey(chain) {
    if (chain.id === 'golos') return 'GOLOS1111111111111111111111111111111114T1Anm';
    if (chain.id === 'viz') return 'VIZ1111111111111111111111111111111114T1Anm';
    if (chain.id === 'hive') return 'HIVE1111111111111111111111111111111114T1Anm';
    if (chain.id === 'steem') return 'STM1111111111111111111111111111111114T1Anm';
    return '';
  }

  function manageDeactivateSigningKey(chain) {
    if (chain.id === 'golos') return 'GLS1111111111111111111111111111111114T1Anm';
    return manageNullSigningKey(chain);
  }

  function manageWitnessSigningKeyStorageKey(chain) {
    const account = auth.getCurrentLogin(chain) || 'unknown';
    return `${chain.id}_${account}_witness_signing_keys`;
  }

  function readManageWitnessSigningKeys(chain) {
    if (!global.localStorage) return [];
    const raw = global.localStorage.getItem(manageWitnessSigningKeyStorageKey(chain));
    const parsed = parseJsonObject(raw, []);
    return Array.isArray(parsed) ? parsed.filter(Boolean).slice(0, 10) : [];
  }

  function rememberManageWitnessSigningKey(chain, key) {
    const text = String(key || '').trim();
    if (!text || text === manageDeactivateSigningKey(chain) || text === manageNullSigningKey(chain) || !global.localStorage) return;
    const next = [text].concat(readManageWitnessSigningKeys(chain).filter((item) => item !== text)).slice(0, 10);
    global.localStorage.setItem(manageWitnessSigningKeyStorageKey(chain), JSON.stringify(next));
    renderManageWitnessSigningKeyHistory(chain);
  }

  function shortSigningKey(key) {
    const text = String(key || '').trim();
    return text.length > 18 ? `${text.slice(0, 7)}…${text.slice(-7)}` : text;
  }

  function renderManageWitnessSigningKeyHistory(chain) {
    const keys = readManageWitnessSigningKeys(chain);
    const list = document.getElementById('manage-witness-key-history');
    if (list) list.innerHTML = keys.map((key) => `<option value="${escapeHtml(key)}"></option>`).join('');
    const hint = document.getElementById('manage-witness-saved-key-hint');
    if (hint) {
      hint.innerHTML = keys.length
        ? `Сохранённый ключ: ${keys.map((key, index) => `<button type="button" class="link-button" data-witness-saved-key="${escapeHtml(key)}" aria-label="Использовать сохранённый ключ подписи блоков ${escapeHtml(key)}">${escapeHtml(shortSigningKey(key))}</button>${index === 0 && keys.length === 1 ? ' <span class="muted">уже подставлен, если поле пустое</span>' : ''}`).join(' ')}`
        : 'Сохранённого ключа пока нет.';
    }
    const input = document.getElementById('manage-witness-key');
    if (input && !String(input.value || '').trim() && keys.length === 1) input.value = keys[0];
  }

  async function resolveManageWitnessUrl(chain, typedUrl) {
    const url = String(typedUrl || '').trim();
    if (url) return url;
    const account = auth.getCurrentLogin(chain);
    if (!account) return '';
    const connection = await getConnection(chain);
    const witness = await profiles.apiCall(connection, 'getWitnessByAccount', [account]).catch(() => null);
    return String((witness && witness.url) || '').trim();
  }

  function isManageWitnessActive(chain, witness) {
    const key = String((witness && (witness.signing_key || witness.signingKey)) || '');
    const nullKey = manageNullSigningKey(chain);
    return Boolean(key && (!nullKey || key !== nullKey));
  }

  function witnessUrlLabel(chain, url) {
    const text = String(url || '');
    if (!text) return '';
    if (chain.id === 'golos' && /golos\.(id|in|today)/i.test(text)) return 'пост';
    if (chain.id === 'viz' && /(control\.)?viz\.world\/media/i.test(text)) return 'пост';
    return 'сайт';
  }

  function renderWitnessChoice(chain, witness, state) {
    const owner = (witness && (witness.owner || witness[0])) || '';
    if (!owner) return '';
    const url = (witness && witness.url) || '';
    const active = isManageWitnessActive(chain, witness);
    const checked = state.currentVotes.has(owner) ? 'checked' : '';
    const status = active ? 'активный делегат' : 'неактивный делегат';
    const urlHtml = url ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener">${escapeHtml(witnessUrlLabel(chain, url))}</a>` : '<span class="muted">без URL</span>';
    return `<label class="witness-choice"><input type="checkbox" data-witness-vote="${escapeHtml(owner)}" ${checked}> <span><strong>${escapeHtml(owner)}</strong><br><span class="muted">${status}; ${urlHtml}; ${accountLink(chain, owner)}; ${explorerLink(chain, 'account', owner, 'Параметры')}</span></span></label>`;
  }

  function workerStateLabel(state) {
    return {
      created: 'Голосование',
      payment: 'Выплачивается',
      payment_complete: 'Выплачено',
      closed_by_author: 'Отменено автором',
      closed_by_expiration: 'Отменена по времени',
      closed_by_voters: 'Отменена голосами',
      0: 'ожидает голосования',
      1: 'отменена заявителем',
      2: 'не набрала доли голосов',
      3: 'не набрала минимальную сумму',
      4: 'одобрена и выплачивается',
      5: 'выплаты завершены'
    }[state] || String(state || 'неизвестно');
  }

  function requestTitle(row) {
    const post = row && row.post;
    return (post && post.title) || row.title || row.url || row.permlink || (post && post.permlink) || `Заявка ${row.request_id ?? row.id ?? ''}`;
  }

  function renderGolosWorkerCard(row, active) {
    const post = row.post || {};
    const author = post.author || row.author || row.creator || '';
    const permlink = post.permlink || row.permlink || row.url || '';
    const worker = row.worker || '';
    const title = requestTitle(row);
    const end = row.created && row.duration ? history.formatDate(new Date(Date.parse(row.created) + Number(row.duration) * 1000).toISOString()) : '';
    return `<article class="request-card"><h4><button type="button" data-worker-open="${escapeHtml(author)}" data-worker-permlink="${escapeHtml(permlink)}">${escapeHtml(title)}</button></h4><p>${accountLink({ id: 'golos' }, author)} → ${accountLink({ id: 'golos' }, worker)}<br><span class="muted">${escapeHtml(workerStateLabel(row.state))}${end ? `; до ${escapeHtml(end)}` : ''}</span></p>${active ? `<button type="button" data-worker-vote="${escapeHtml(author)}" data-worker-permlink="${escapeHtml(permlink)}">Голосовать за эту заявку</button>` : ''}</article>`;
  }

  function renderVizCommitteeCard(row, active) {
    const requestId = row.request_id ?? row.id ?? row[0] ?? '';
    const title = requestTitle(row);
    return `<article class="request-card"><h4><button type="button" data-viz-committee-open="${escapeHtml(requestId)}">№${escapeHtml(requestId)} — ${escapeHtml(title)}</button></h4><p>${accountLink({ id: 'viz' }, row.creator)} → ${accountLink({ id: 'viz' }, row.worker)}<br><span class="muted">${escapeHtml(workerStateLabel(row.status ?? row.state))}</span></p>${active ? `<button type="button" data-viz-committee-vote="${escapeHtml(requestId)}">Голосовать за эту заявку</button>` : ''}</article>`;
  }

  async function loadWitnessVoteList(chain, state) {
    // Legacy inactive witness null keys: HIVE1111111111111111111111111111111114T1Anm, STM1111111111111111111111111111111114T1Anm.
    if (chain.id !== 'golos' && chain.id !== 'viz' && chain.id !== 'hive' && chain.id !== 'steem') return;
    const result = document.getElementById('manage-witnesses-result');
    try {
      if (result) result.textContent = 'Загружаю делегатов через getWitnessesByVote...';
      const connection = await getConnection(chain);
      const account = await fetchChainAccount(chain, auth.getCurrentLogin(chain));
      state.currentVotes = new Set(account && Array.isArray(account.witness_votes) ? account.witness_votes : []);
      state.proxy = account && account.proxy ? account.proxy : '';
      const witnesses = [];
      let from = '';
      for (let page = 0; page < 5; page += 1) {
        const chunk = await profiles.apiCall(connection, 'getWitnessesByVote', [from, 100]);
        if (!Array.isArray(chunk) || !chunk.length) break;
        chunk.forEach((row) => {
          const owner = row.owner || row[0] || '';
          if (owner && owner !== from) witnesses.push(row);
        });
        const lastRow = witnesses[witnesses.length - 1] || {};
        const last = lastRow.owner || lastRow[0] || '';
        if (!last || last === from || chunk.length < 100) break;
        from = last;
      }
      if (!result) return;
      const proxyNotice = state.proxy ? `<p class="notice">У аккаунта установлен proxy <strong>${escapeHtml(state.proxy)}</strong>. Ручное witness voting конфликтует с proxy; сначала снимите proxy, если нужно голосовать вручную.</p>` : '';
      result.innerHTML = `${proxyNotice}<fieldset><legend>Делегаты</legend><div class="witness-choice-grid">${witnesses.map((row) => renderWitnessChoice(chain, row, state)).join('')}</div></fieldset>`;
    } catch (error) {
      if (result) result.textContent = profiles.formatError(error);
    }
  }

  function downloadTextFile(filename, text) {
    const link = document.createElement('a');
    link.setAttribute('href', `data:text/plain;charset=utf-8,${encodeURIComponent(text)}`);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  function makeShareFile(filename, text, type = 'application/json') {
    const blob = new Blob([text], { type });
    if (typeof File === 'function') return new File([blob], filename, { type, lastModified: Date.now() });
    blob.name = filename;
    return blob;
  }

  function canShareBackupFile(file) {
    return !!(global.navigator && typeof global.navigator.share === 'function' && typeof global.navigator.canShare === 'function' && global.navigator.canShare({ files: [file] }));
  }

  async function shareBackupFile(filename, text) {
    const file = makeShareFile(filename, text, 'application/json');
    if (!canShareBackupFile(file)) throw new Error('Ваш браузер не поддерживает отправку файлов через системное меню.');
    await global.navigator.share({
      title: 'DPoS Space backup',
      text: 'Зашифрованная резервная копия DPoS Space. Пароль передавайте отдельно.',
      files: [file]
    });
  }

  function vizInvitePublic(secret) {
    const client = global.viz;
    const text = String(secret || '').trim();
    if (!text) throw new Error('Нужен invite secret WIF.');
    if (!client || !client.auth || typeof client.auth.wifToPublic !== 'function') {
      throw new Error('viz.auth.wifToPublic недоступен: create_invite не подготовлен, чтобы не отправить неверный invite_key.');
    }
    return client.auth.wifToPublic(text);
  }

  function golosAmountNumber(value) {
    const match = String(value || '').match(/-?\d+(?:\.\d+)?/);
    return match ? Number(match[0]) : 0;
  }

  function collectGolosTipActionTokens(profile, balanceRows) {
    const tokens = new Map();
    const add = (symbol, balanceType, balance) => {
      const token = normalizeGolosTokenSymbol(symbol, 'Токен');
      if (!tokens.has(token)) tokens.set(token, { symbol: token, main: '', tip: '' });
      const item = tokens.get(token);
      if (balanceType === 'tip') item.tip = balance || item.tip;
      else item.main = balance || item.main;
    };
    const raw = (profile && profile.raw) || {};
    if (golosAmountNumber(raw.balance) > 0) add('GOLOS', 'main', raw.balance);
    if (golosAmountNumber(raw.tip_balance) > 0) add('GOLOS', 'tip', raw.tip_balance);
    (balanceRows || []).forEach((row) => {
      const meta = row && row[2];
      if (!meta || meta.kind !== 'uia') return;
      if (golosAmountNumber(row[1]) <= 0) return;
      add(meta.symbol, meta.balanceType === 'tip' ? 'tip' : 'main', row[1]);
    });
    return Array.from(tokens.values()).sort((a, b) => a.symbol.localeCompare(b.symbol));
  }

  function tokenOptions(tokens, balanceType) {
    return tokens
      .filter((token) => golosAmountNumber(token[balanceType]) > 0)
      .map((token) => `<option value="${escapeHtml(token.symbol)}" data-max="${escapeHtml(token[balanceType])}">${escapeHtml(token.symbol)} — максимум ${escapeHtml(token[balanceType])}</option>`)
      .join('');
  }

  function golosTemplateStorageKey(kind, token) {
    return `${normalizeGolosTokenSymbol(token || 'GOLOS', 'Токен шаблона')}_${kind}_templates`;
  }

  function getGolosBuiltInTemplates(kind, token, login) {
    const symbol = normalizeGolosTokenSymbol(token || 'GOLOS', 'Токен шаблона');
    if (kind === 'transfer') {
      const templates = [{ id: 'me', builtin: true, name: 'На свой аккаунт в TIP-баланс', to: login || '', memo: '', in: 'to_tip' }];
      if (symbol === 'GOLOS') templates.push({ id: 'rudex', builtin: true, name: 'На Rudex (memo берите на бирже)', to: 'rudex', memo: '', in: 'to_balance' });
      return templates;
    }
    if (kind === 'donate' && symbol === 'GOLOS') {
      return [
        { id: 'tiptok', builtin: true, name: 'Перевод с TIP-баланса в ликвид через tiptok', to: 'tiptok', memo: '' },
        { id: 'ecurrex-t2g', builtin: true, name: 'Перевод с TIP-баланса в ликвид через ecurrex-t2g', to: 'ecurrex-t2g', memo: '' }
      ];
    }
    return [];
  }

  function readGolosCustomTemplates(kind, token) {
    const raw = global.localStorage && global.localStorage.getItem(golosTemplateStorageKey(kind, token));
    const parsed = raw ? parseGolosJsonMetadata(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((item) => item && item.name) : [];
  }

  function writeGolosCustomTemplates(kind, token, templates) {
    if (!global.localStorage) return;
    global.localStorage.setItem(golosTemplateStorageKey(kind, token), JSON.stringify(Array.isArray(templates) ? templates : []));
  }

  function upsertGolosCustomTemplate(kind, token, template) {
    const templates = readGolosCustomTemplates(kind, token);
    const index = templates.findIndex((item) => item.name === template.name);
    if (index >= 0) templates[index] = Object.assign({}, templates[index], template);
    else templates.push(template);
    writeGolosCustomTemplates(kind, token, templates);
    return templates;
  }

  function removeGolosCustomTemplate(kind, token, indexOneBased) {
    const templates = readGolosCustomTemplates(kind, token);
    const index = Number(indexOneBased) - 1;
    if (index >= 0 && index < templates.length) templates.splice(index, 1);
    writeGolosCustomTemplates(kind, token, templates);
    return templates;
  }

  function buildGolosWithdrawMemo(prefix, main, postfix) {
    const base = `${String(prefix || '')}${String(main || '').trim()}`;
    const extra = String(postfix || '').trim();
    return extra ? `${base} ${extra}` : base;
  }

  function getGolosGatewayOptions(gateways, type) {
    return (gateways || []).filter((gateway) => gateway && gateway[type]);
  }

  function golosGatewayHasDepositAction(gateway) {
    const deposit = gateway && gateway.deposit;
    if (!deposit) return false;
    const type = String(deposit.to_type || '').toLowerCase();
    return (type === 'fixed' && Boolean(deposit.to_fixed))
      || type === 'api'
      || Boolean(deposit.to_transfer && deposit.memo_transfer);
  }

  function golosMainBalanceMap(balanceRows) {
    const map = new Map();
    (balanceRows || []).forEach((row) => {
      const meta = row && row[2];
      if (meta && meta.kind === 'uia' && meta.balanceType === 'main' && golosAmountNumber(row[1]) > 0) {
        map.set(normalizeGolosTokenSymbol(meta.symbol, 'UIA symbol'), row[1]);
      }
    });
    return map;
  }


  function refreshRouteAfterBroadcast(hashAtSend) {
    if (typeof global.setTimeout !== 'function') return;
    global.setTimeout(() => {
      if (global.location.hash === hashAtSend) {
        renderRoute();
      }
    }, 2500);
  }

  function bindOperationForm(chain, formId, buildPrepared) {
    const form = document.getElementById(formId);
    if (!form) return;

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      try {
        await loadScript(chain.cryptoPath);
        await loadScript(chain.walletPath);
        await loadScript(chain.libraryPath);
        const submitter = event.submitter;
        const intent = submitter && submitter.value === 'send' ? 'send' : 'preview';
        const prepared = await buildPrepared(new FormData(form), { intent, submitter, form });

        if (intent === 'preview') {
          const result = await broadcast.broadcast(chain, prepared, { dryRun: true });
          setOperationResult(form, result.message, 'ok', prepared);
          return;
        }

        const confirmed = global.confirm(`Отправить реальную транзакцию?\n${operationSummary(prepared)}\nПроверьте получателя, сумму и memo перед отправкой.`);
        if (!confirmed) {
          setOperationResult(form, 'Отправка отменена пользователем. Данные операции показаны ниже.', 'info', prepared);
          return;
        }

        if (submitter) submitter.disabled = true;
        setOperationResult(form, 'Подключаю публичную ноду для broadcast...', 'loading', prepared);
        await profiles.connect(chain);
        setOperationResult(form, 'Отправляю транзакцию в сеть...', 'loading', prepared);
        const hashAtSend = global.location.hash;
        const result = await broadcast.broadcast(chain, prepared, { dryRun: false, confirmExecute: true });
        setOperationResult(form, 'Транзакция отправлена. Обновляю балансы и историю...', 'ok', prepared, result);
        refreshRouteAfterBroadcast(hashAtSend);
      } catch (error) {
        setOperationResult(form, profiles.formatError(error), 'error');
      } finally {
        const buttons = form.querySelectorAll('button[type="submit"]');
        buttons.forEach((button) => { button.disabled = false; });
      }
    });
  }

  function keyStatusText(status) {
    const regularOrPosting = status.hasRegularOrPosting ? 'есть' : 'нет или не расшифрован';
    const active = status.hasActive ? 'есть' : 'нет или не расшифрован';
    return `${status.regularOrPostingLabel}: ${regularOrPosting}; active: ${active}; источник: ${status.source}`;
  }

  function authorityObjectFor(chain, account, authority) {
    if (!account) return null;
    if (chain.id === 'viz') {
      if (authority === 'regular') return account.regular_authority || account.regular || null;
      if (authority === 'active') return account.active_authority || account.active || null;
    }
    return account[authority] || null;
  }

  function keyMatchesAuthority(client, privateKey, authority) {
    if (!privateKey || !authority) return false;
    if (!client || !client.auth || typeof client.auth.wifToPublic !== 'function') {
      throw new Error('Библиотека сети не умеет проверить WIF → public key. Ключ не сохранён.');
    }
    const publicKey = client.auth.wifToPublic(privateKey);
    return Array.isArray(authority.key_auths) && authority.key_auths.some((item) => Array.isArray(item) && item[0] === publicKey && Number(item[1]) > 0);
  }

  async function fetchChainAccount(chain, login) {
    await loadScript(chain.libraryPath);
    const connection = await profiles.connect(chain);
    return profiles.fetchAccount(connection, login);
  }

  function seedMnemonicIsValid(chain, seed) {
    if (!seed) return false;
    if (chain.id === 'minter' && global.minterWallet && typeof global.minterWallet.isValidMnemonic === 'function') {
      return global.minterWallet.isValidMnemonic(seed);
    }
    if (chain.id === 'decimal' && global.DecimalSDK && typeof global.DecimalSDK.Wallet === 'function') {
      try {
        new global.DecimalSDK.Wallet(seed);
        return true;
      } catch (error) {
        return false;
      }
    }
    return seed.trim().split(/\s+/).filter(Boolean).length >= 12;
  }

  function canGenerateSeed(chain) {
    return (chain.id === 'minter' && global.minterWallet && typeof global.minterWallet.generateWallet === 'function') ||
      (chain.id === 'decimal' && global.DecimalSDK && typeof global.DecimalSDK.Wallet === 'function');
  }

  function generateSeedFor(chain) {
    if (chain.id === 'minter' && global.minterWallet && typeof global.minterWallet.generateWallet === 'function') {
      const wallet = global.minterWallet.generateWallet();
      return {
        seed: wallet._mnemonic || '',
        login: wallet.getAddressString ? wallet.getAddressString() : '',
        extra: 'Адрес сгенерирован локально. Приватный ключ не показывается; сохраните seed-фразу отдельно.'
      };
    }
    if (chain.id === 'decimal' && global.DecimalSDK && typeof global.DecimalSDK.Wallet === 'function') {
      const wallet = new global.DecimalSDK.Wallet();
      return {
        seed: wallet.mnemonic || '',
        login: wallet.address || '',
        extra: [wallet.address ? `Адрес: ${wallet.address}` : '', 'Приватный ключ не показывается; сохраните seed-фразу отдельно.'].filter(Boolean).join('\n')
      };
    }
    throw new Error('Генерация seed недоступна: библиотека кошелька не загружена.');
  }

  function renderSeedImportOptions(chain) {
    const groups = auth.getSeedChains().filter((group) => group.chainId !== chain.id);
    const options = [];
    groups.forEach((group) => {
      group.users.forEach((user, index) => {
        options.push(`<option value="${escapeHtml(`${group.chainId}:${index}`)}">${escapeHtml(group.chainId.toUpperCase())}: ${escapeHtml(auth.getUserLogin(user))}</option>`);
      });
    });
    if (!options.length) return '<p class="muted">Seed-аккаунты в других сетях не найдены.</p>';
    return `
      <form id="seed-import-form" class="stacked-form">
        <div class="field"><label for="seed-import-account">Импортировать seed из другой сети</label><select id="seed-import-account" name="account"><option value="">Выберите аккаунт</option>${options.join('')}</select></div>
        <button type="submit">Импортировать выбранный seed</button>
      </form>`;
  }

  async function renderAccounts(chain) {
    await loadScript(chain.cryptoPath);
    if (chain.walletPath) await loadScript(chain.walletPath);
    if (chain.id === 'minter' || chain.id === 'decimal') await loadScript(chain.libraryPath);
    const users = auth.getUsers(chain);
    const current = auth.getCurrentUser(chain);
    const currentLogin = auth.getUserLogin(current);
    const isSeedChain = chain.id === 'minter' || chain.id === 'decimal';
    const regularOrPosting = chain.id === 'viz' ? 'regular' : 'posting';
    const rows = users.map((user, index) => {
      const login = auth.getUserLogin(user);
      const type = auth.getUserType(user);
      const checked = auth.isSameUser(user, current) ? 'checked' : '';
      const status = auth.getKeyStatus(chain, user);
      return `
        <li>
          <label class="inline-choice">
            <input type="radio" name="legacy-account" value="${index}" ${checked}>
            @${escapeHtml(login)}${type !== 'standard' ? ` (${escapeHtml(type)})` : ''}
          </label>
          <br><span class="muted">${escapeHtml(keyStatusText(status))}</span>
          <br><button type="button" class="secondary" data-delete-account="${index}">Удалить</button>
        </li>`;
    }).join('');

    appEl.innerHTML = `
      <section class="panel">
        <h2>${escapeHtml(chain.title)}: сохранённые аккаунты</h2>
        <p>Используются сохранённые в браузере аккаунты для этой сети. Ключи шифруются старой схемой localStorage и не показываются после сохранения.</p>
        ${currentLogin ? `<p><strong>Текущий аккаунт:</strong> @${escapeHtml(currentLogin)}. ${escapeHtml(keyStatusText(auth.getKeyStatus(chain, current)))}</p>` : '<p><strong>Текущий аккаунт не выбран.</strong></p>'}
        ${users.length ? `
          <form id="legacy-account-form">
            <fieldset>
              <legend>Сохранённые аккаунты</legend>
              <ul>${rows}</ul>
            </fieldset>
            <button type="submit">Выбрать аккаунт</button>
          </form>` : '<p>Сохранённые аккаунты для этой сети не найдены.</p>'}
        <div id="accounts-message" class="operation-result" role="status" aria-live="polite"></div>
      </section>
      <section class="panel">
        <h2>Добавить аккаунт</h2>
        ${isSeedChain ? `
          <form id="seed-account-form" class="stacked-form">
            <div class="field"><label for="seed-login">Имя/адрес аккаунта</label><input id="seed-login" name="login" type="text" autocomplete="username" placeholder="${escapeHtml(chain.defaultAccount || '')}"></div>
            <div class="field"><label for="seed-value">Seed-фраза</label><textarea id="seed-value" name="seed" rows="4" autocomplete="off"></textarea></div>
            <button type="submit">Сохранить seed-аккаунт</button>
            ${canGenerateSeed(chain) ? '<button type="button" id="generate-seed-account" class="secondary">Сгенерировать новый seed</button>' : ''}
          </form>
          <pre id="generated-seed-extra" class="muted" aria-live="polite"></pre>
          ${renderSeedImportOptions(chain)}
        ` : `
          <form id="key-account-form" class="stacked-form">
            <div class="field"><label for="key-login">Логин аккаунта</label><input id="key-login" name="login" type="text" autocomplete="username"></div>
            <div class="field"><label for="key-main">${escapeHtml(regularOrPosting)} WIF</label><input id="key-main" name="main" type="password" autocomplete="off"></div>
            <div class="field"><label for="key-active">active WIF (опционально)</label><input id="key-active" name="active" type="password" autocomplete="off"></div>
            <button type="submit">Проверить и сохранить</button>
          </form>
        `}
        <p class="notice">Ключи/seed сохраняются локально в браузере, не отправляются на сервер и не показываются после сохранения. Перед сохранением v3 проверяет authority аккаунта, где это применимо, и пишет те же ключи localStorage, что старая версия.</p>
      </section>
    `;

    const messageEl = document.getElementById('accounts-message');
    const showAccountMessage = (message, state) => {
      if (!messageEl) return;
      messageEl.textContent = message;
      messageEl.dataset.state = state || 'info';
      setStatus(message, state || 'info');
    };

    const form = document.getElementById('legacy-account-form');
    if (form) {
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        const selected = form.querySelector('input[name="legacy-account"]:checked');
        if (!selected) {
          setStatus('Выберите аккаунт.', 'error');
          return;
        }
        const user = users[Number(selected.value)];
        auth.selectUser(chain, auth.getUserLogin(user), auth.getUserType(user));
        accountInput.value = auth.getUserLogin(user);
        navigate({ chain: chain.id, app: 'accounts', account: auth.getUserLogin(user) });
        showAccountMessage(`Аккаунт @${auth.getUserLogin(user)} выбран.`, 'ok');
      });

      form.addEventListener('click', (event) => {
        const button = event.target.closest('[data-delete-account]');
        if (!button) return;
        const user = users[Number(button.dataset.deleteAccount)];
        if (!user) return;
        const login = auth.getUserLogin(user);
        const confirmed = global.confirm(`Удалить аккаунт ${login} из списка ${chain.title}? Ключи в localStorage для этой записи будут удалены из списка.`);
        if (!confirmed) return;
        auth.removeUser(chain, login, auth.getUserType(user));
        showAccountMessage(`Аккаунт @${login} удалён из списка.`, 'ok');
        renderAccounts(chain);
      });
    }

    const keyForm = document.getElementById('key-account-form');
    if (keyForm) {
      keyForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const submitter = event.submitter || keyForm.querySelector('button[type="submit"]');
        if (submitter) submitter.disabled = true;
        try {
          const data = new FormData(keyForm);
          const login = String(data.get('login') || '').trim().replace(/^@/, '');
          const mainKey = String(data.get('main') || '').trim();
          const activeKey = String(data.get('active') || '').trim();
          showAccountMessage(`Проверяю аккаунт @${login} и ключи...`, 'loading');
          const account = await fetchChainAccount(chain, login);
          const client = global[chain.libraryGlobal];
          const mainAuthority = authorityObjectFor(chain, account, regularOrPosting);
          if (!keyMatchesAuthority(client, mainKey, mainAuthority)) throw new Error(`${regularOrPosting}-ключ не найден в authority @${login}.`);
          if (activeKey && !keyMatchesAuthority(client, activeKey, authorityObjectFor(chain, account, 'active'))) throw new Error('active-ключ не найден в active authority аккаунта.');
          const keys = { active: activeKey };
          keys[regularOrPosting] = mainKey;
          auth.saveUser(chain, auth.createKeyUser(chain, login, keys));
          keyForm.reset();
          accountInput.value = login;
          showAccountMessage(`Аккаунт @${login} добавлен и выбран.`, 'ok');
          navigate({ chain: chain.id, app: 'accounts', account: login });
        } catch (error) {
          showAccountMessage(profiles.formatError(error), 'error');
        } finally {
          if (submitter) submitter.disabled = false;
        }
      });
    }

    const seedForm = document.getElementById('seed-account-form');
    if (seedForm) {
      seedForm.addEventListener('submit', (event) => {
        event.preventDefault();
        try {
          const data = new FormData(seedForm);
          const login = String(data.get('login') || '').trim();
          const seed = String(data.get('seed') || '').trim();
          if (!seedMnemonicIsValid(chain, seed)) throw new Error('Seed-фраза невалидна. Проверьте её, пожалуйста.');
          auth.saveUser(chain, auth.createSeedUser(chain, login, seed));
          seedForm.reset();
          accountInput.value = login;
          showAccountMessage(`Seed-аккаунт ${login} добавлен и выбран.`, 'ok');
          navigate({ chain: chain.id, app: 'accounts', account: login });
        } catch (error) {
          showAccountMessage(profiles.formatError(error), 'error');
        }
      });
    }

    const generateButton = document.getElementById('generate-seed-account');
    if (generateButton && seedForm) {
      generateButton.addEventListener('click', () => {
        try {
          const generated = generateSeedFor(chain);
          seedForm.elements.login.value = generated.login || '';
          seedForm.elements.seed.value = generated.seed || '';
          document.getElementById('generated-seed-extra').textContent = generated.extra || '';
          showAccountMessage('Новый seed сгенерирован локально. Сохраните seed отдельно до использования.', 'info');
        } catch (error) {
          showAccountMessage(profiles.formatError(error), 'error');
        }
      });
    }

    const importForm = document.getElementById('seed-import-form');
    if (importForm) {
      importForm.addEventListener('submit', (event) => {
        event.preventDefault();
        try {
          const selected = String(new FormData(importForm).get('account') || '');
          if (!selected) throw new Error('Выберите аккаунт для импорта.');
          const [sourceChain, indexText] = selected.split(':');
          const sourceUsers = auth.getSeedChains().find((group) => group.chainId === sourceChain);
          const sourceUser = sourceUsers && sourceUsers.users[Number(indexText)];
          if (!sourceUser) throw new Error('Исходный seed-аккаунт не найден.');
          const imported = Object.assign({}, sourceUser, { importFrom: sourceChain });
          auth.saveUser(chain, imported);
          accountInput.value = auth.getUserLogin(imported);
          showAccountMessage(`Seed-аккаунт ${auth.getUserLogin(imported)} импортирован из ${sourceChain.toUpperCase()} и выбран.`, 'ok');
          navigate({ chain: chain.id, app: 'accounts', account: auth.getUserLogin(imported) });
        } catch (error) {
          showAccountMessage(profiles.formatError(error), 'error');
        }
      });
    }

    setStatus(users.length ? 'Список сохранённых аккаунтов загружен.' : 'Сохранённые аккаунты не найдены.', users.length ? 'ok' : 'info');
  }

  function renderHistoryTable(items, chain, emptyText) {
    return renderTransactionsTable(items, chain, {
      caption: `История операций ${chain.title}`,
      emptyText: emptyText || 'Операции не найдены.'
    });
  }

  function renderOperationSelectOptions(chain, selectedOps) {
    const selected = new Set(selectedOps || []);
    return history.operationOptions(chain).map((option) => {
      const isSelected = selected.has(option.value) ? ' selected' : '';
      return `<option value="${escapeHtml(option.value)}"${isSelected}>${escapeHtml(option.label)} (${escapeHtml(option.value)})</option>`;
    }).join('');
  }

  async function getConnection(chain) {
    await loadScript(chain.libraryPath);
    return profiles.connect(chain);
  }

  async function ensureBroadcastDependencies(chain) {
    await loadScript(chain.cryptoPath);
    await loadScript(chain.libraryPath);
  }

  async function loadGrapheneWalletData(chain, account, options) {
    await loadScript(chain.cryptoPath);
    const current = auth.getCurrentUser(chain);
    const connection = await getConnection(chain);
    const rawAccount = await profiles.fetchAccount(connection, account);
    const enrichedAccount = await profiles.enrichAccount(connection, rawAccount);
    const profile = profiles.normalizeAccount(connection, enrichedAccount);
    const extraBalances = options && typeof options.loadExtraBalances === 'function'
      ? await options.loadExtraBalances(connection, account)
      : [];
    const balanceRows = profile.balances.concat(extraBalances || []);
    const items = await history.fetchAccountHistory(connection, account, { limit: 100 });
    const walletItems = history.getWalletOperations(chain, items).slice(0, 50);
    return { current, profile, balanceRows, walletItems };
  }

  function callVizApi(api, method, args) {
    const asyncName = `${method}Async`;
    if (typeof api[asyncName] === 'function') return api[asyncName](...args);
    if (typeof api[method] === 'function') {
      return new Promise((resolve, reject) => {
        api[method](...args, (error, result) => error ? reject(error) : resolve(result));
      });
    }
    return Promise.reject(new Error(`viz.api.${method} недоступен в загруженной библиотеке.`));
  }

  function setVizApiNode(client, nodeUrl) {
    const api = client && client.api;
    if (api && typeof api.stop === 'function') {
      try { api.stop(); } catch (_error) { /* optional */ }
    }
    if (client && client.config && typeof client.config.set === 'function') {
      client.config.set('websocket', nodeUrl);
    } else if (api && typeof api.setOptions === 'function') {
      api.setOptions({ url: nodeUrl });
    }
  }

  async function fetchVizVestingDelegations(connection, account, type) {
    const api = connection.client && connection.client.api;
    if (!api) throw new Error('viz.api недоступен для getVestingDelegations.');
    return callVizApi(api, 'getVestingDelegations', [account, '', 100, type]);
  }

  async function fetchVizDelegationsWithNodeFallback(chain, baseConnection, account) {
    const client = baseConnection.client;
    const api = client && client.api;
    if (!api) throw new Error('viz.api недоступен для getVestingDelegations.');
    const nodes = [baseConnection.node].concat((chain.nodes || []).filter((nodeUrl) => nodeUrl && nodeUrl !== baseConnection.node));
    let lastError = null;
    for (const nodeUrl of nodes) {
      try {
        setVizApiNode(client, nodeUrl);
        await callVizApi(api, 'getDynamicGlobalProperties', []);
        const [received, delegated] = await Promise.all([
          fetchVizVestingDelegations({ client }, account, 'received'),
          fetchVizVestingDelegations({ client }, account, 'delegated')
        ]);
        global.localStorage.setItem(`${chain.id}_node`, nodeUrl);
        return {
          received: Array.isArray(received) ? received : [],
          delegated: Array.isArray(delegated) ? delegated : [],
          node: nodeUrl,
          error: ''
        };
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError || new Error('VIZ delegation API недоступен на всех нодах.');
  }

  async function loadVizWalletData(chain, account) {
    const data = await loadGrapheneWalletData(chain, account);
    data.delegations = { received: [], delegated: [], error: '', unavailable: false, node: data.profile.node };
    try {
      data.delegations = await fetchVizDelegationsWithNodeFallback(chain, { client: global[chain.libraryGlobal], node: data.profile.node }, account);
    } catch (error) {
      data.delegations.error = profiles.formatError(error);
      data.delegations.unavailable = true;
    }
    return data;
  }

  async function renderGrapheneWallet(chain, account, options) {
    appEl.innerHTML = '<section class="panel"><h2>Загрузка кошелька</h2><p>Подключаю публичную ноду...</p></section>';
    setStatus(`Загружаю кошелёк ${chain.title}: @${account}...`, 'loading');

    const data = await loadGrapheneWalletData(chain, account, options);
    const formsHtml = options.renderForms(chain, data.profile);

    appEl.innerHTML = `
      <section class="panel">
        <h2>${escapeHtml(chain.title)}: кошелёк @${escapeHtml(account)}</h2>
        <p><strong>Нода:</strong> ${escapeHtml(data.profile.node)}</p>
        <p><strong>Доступ к аккаунту:</strong> ${escapeHtml(keyStatusText(auth.getKeyStatus(chain, data.current)))}</p>
        <p class="notice">Перед отправкой можно проверить операцию. Реальная отправка запускается отдельной кнопкой и подтверждается в браузере.</p>
        <h3>Балансы</h3>
        <ul>${data.balanceRows.map(([label, value]) => `<li><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</li>`).join('') || '<li>Нет данных о балансах.</li>'}</ul>
        ${formsHtml}
        <h3>Последние финансовые операции</h3>
        ${renderHistoryTable(data.walletItems, chain, 'Финансовые операции не найдены в последней выборке.')}
      </section>
    `;

    options.bindForms(chain, data.profile);
    bindMaxButtons(appEl);
    setStatus(`Кошелёк @${account} загружен: доступны проверка операций, кнопки «Максимум» и отправка в сеть.`, 'ok');
  }

  async function renderGolosWallet(chain, account) {
    appEl.innerHTML = '<section class="panel"><h2>Загрузка кошелька Golos</h2><p>Подключаю публичную ноду...</p></section>';
    setStatus(`Загружаю Golos-кошелёк @${account}...`, 'loading');

    const data = await loadGrapheneWalletData(chain, account, { loadExtraBalances: fetchGolosUiaBalances });
    const uiaGateways = await fetchGolosUiaGateways(chain, data.balanceRows);
    try {
      data.delegations = await fetchGolosDelegations({ client: global[chain.libraryGlobal] }, account);
      data.delegationsError = '';
    } catch (error) {
      data.delegations = { delegated: [], received: [], error: profiles.formatError(error) };
      data.delegationsError = profiles.formatError(error);
    }
    const formsHtml = renderGolosWalletForms(chain, data.profile, data.balanceRows, uiaGateways, data.delegations);

    appEl.innerHTML = `
      <section class="panel wallet-golos">
        <h2>Golos: кошелёк @${escapeHtml(account)}</h2>
        <p><strong>Нода:</strong> ${escapeHtml(data.profile.node)}</p>
        <p><strong>Доступ к аккаунту:</strong> ${escapeHtml(keyStatusText(auth.getKeyStatus(chain, data.current)))}</p>
        <p class="notice">Golos показывает СГ в пользовательских единицах. Перед отправкой можно проверить операцию; реальная отправка запускается отдельной кнопкой и подтверждается в браузере.</p>
        <h3>Балансы Golos</h3>
        ${renderGolosWalletBalances(data.profile, data.balanceRows)}
        ${formsHtml}
        <h3>Последние финансовые операции</h3>
        ${renderHistoryTable(data.walletItems, chain, 'Финансовые операции не найдены в последней выборке.')}
      </section>
    `;

    bindGolosWalletForms(chain, data.profile, uiaGateways, data.delegations);
    bindMaxButtons(appEl);
    bindGrapheneWalletQuickActions(appEl);
    bindCopyButtons(appEl);
    setStatus(`Golos-кошелёк @${account} загружен: СГ и UIA/TIP-балансы отображены, операции доступны только через проверку и подтверждение.`, 'ok');
  }

  async function renderVizWallet(chain, account) {
    appEl.innerHTML = '<section class="panel"><h2>Загрузка кошелька VIZ</h2><p>Подключаю публичную ноду...</p></section>';
    setStatus(`Загружаю VIZ-кошелёк @${account}...`, 'loading');

    const data = await loadVizWalletData(chain, account);
    const formsHtml = renderVizWalletForms(chain, data.profile, data.delegations);

    appEl.innerHTML = `
      <section class="panel wallet-viz">
        <h2>VIZ: кошелёк @${escapeHtml(account)}</h2>
        <p><strong>Нода:</strong> ${escapeHtml(data.profile.node)}</p>
        <p><strong>Доступ к аккаунту:</strong> ${escapeHtml(keyStatusText(auth.getKeyStatus(chain, data.current)))}</p>
        <p class="notice">VIZ использует VIZ, SHARES и energy. Все активные операции доступны только через проверку и отдельное подтверждение отправки.</p>
        <h3>Балансы VIZ</h3>
        ${renderVizWalletBalances(data.profile, data.delegations)}
        ${formsHtml}
        <h3>Последние финансовые операции VIZ</h3>
        ${renderHistoryTable(data.walletItems, chain, 'Transfer/award/reward операции не найдены в последней выборке.')}
      </section>
    `;

    bindVizWalletForms(chain, data.profile);
    bindMaxButtons(appEl);
    bindGrapheneWalletQuickActions(appEl);
    bindCopyButtons(appEl);
    setStatus(`VIZ-кошелёк @${account} загружен: VIZ/SHARES, делегирования, invite и transfer templates доступны через проверку и подтверждение.`, 'ok');
  }

  async function renderHiveWallet(chain, account) {
    appEl.innerHTML = '<section class="panel"><h2>Загрузка кошелька Hive</h2><p>Подключаю публичную ноду...</p></section>';
    setStatus(`Загружаю Hive-кошелёк @${account}...`, 'loading');

    const data = await loadHiveWalletData(chain, account);
    const formsHtml = renderHiveWalletForms(chain, data.profile, data.delegations);

    appEl.innerHTML = `
      <section class="panel wallet-hive">
        <h2>Hive: кошелёк @${escapeHtml(account)}</h2>
        <p><strong>Нода:</strong> ${escapeHtml(data.profile.node)}</p>
        <p><strong>Доступ к аккаунту:</strong> ${escapeHtml(keyStatusText(auth.getKeyStatus(chain, data.current)))}</p>
        <p class="notice">Hive использует HIVE, HBD и HP. Все операции сначала проверяются, а реальная отправка требует отдельного подтверждения в браузере.</p>
        <h3>Балансы Hive</h3>
        ${renderHiveWalletBalances(data.profile, data.delegations, data.delegationsError)}
        ${formsHtml}
        <h3>Последние финансовые операции Hive</h3>
        ${renderHistoryTable(data.walletItems, chain, 'Transfer/reward операции не найдены в последней выборке.')}
      </section>
    `;

    bindHiveWalletForms(chain, data.profile, data.delegations);
    bindMaxButtons(appEl);
    bindGrapheneWalletQuickActions(appEl);
    bindCopyButtons(appEl);
    setStatus(`Hive-кошелёк @${account} загружен: HIVE/HBD/HP, делегирования, rewards и savings доступны через проверку и подтверждение.`, 'ok');
  }

  async function callHiveApi(connection, method, args) {
    const api = connection.client && connection.client.api;
    const asyncName = `${method}Async`;
    if (!api) throw new Error('Hive API недоступен.');
    if (typeof api[asyncName] === 'function') return api[asyncName](...args);
    if (typeof api[method] === 'function') {
      return new Promise((resolve, reject) => {
        api[method](...args, (error, result) => error ? reject(error) : resolve(result));
      });
    }
    throw new Error(`Метод Hive API ${method} недоступен.`);
  }

  async function fetchHiveDelegations(connection, account) {
    const rows = await callHiveApi(connection, 'getVestingDelegations', [account, '', 100]);
    return Array.isArray(rows) ? rows : [];
  }

  async function loadHiveWalletData(chain, account) {
    const data = await loadGrapheneWalletData(chain, account);
    try {
      data.delegations = await fetchHiveDelegations({ client: global[chain.libraryGlobal] }, account);
      data.delegationsError = '';
    } catch (error) {
      data.delegations = [];
      data.delegationsError = profiles.formatError(error);
    }
    return data;
  }

  async function callSteemApi(connection, method, args) {
    const api = connection.client && connection.client.api;
    const asyncName = `${method}Async`;
    if (!api) throw new Error('Steem API недоступен.');
    if (typeof api[asyncName] === 'function') return api[asyncName](...args);
    if (typeof api[method] === 'function') {
      return new Promise((resolve, reject) => {
        api[method](...args, (error, result) => error ? reject(error) : resolve(result));
      });
    }
    throw new Error(`Метод Steem API ${method} недоступен.`);
  }

  async function fetchSteemDelegations(connection, account) {
    const rows = await callSteemApi(connection, 'getVestingDelegations', [account, '', 100]);
    return Array.isArray(rows) ? rows : [];
  }

  async function loadSteemWalletData(chain, account) {
    const data = await loadGrapheneWalletData(chain, account);
    try {
      data.delegations = await fetchSteemDelegations({ client: global[chain.libraryGlobal] }, account);
      data.delegationsError = '';
    } catch (error) {
      data.delegations = [];
      data.delegationsError = profiles.formatError(error);
    }
    return data;
  }

  async function renderSteemWallet(chain, account) {
    appEl.innerHTML = '<section class="panel"><h2>Загрузка кошелька Steem</h2><p>Подключаю публичную ноду...</p></section>';
    setStatus(`Загружаю Steem-кошелёк @${account}...`, 'loading');

    const data = await loadSteemWalletData(chain, account);
    const formsHtml = renderSteemWalletForms(chain, data.profile, data.delegations);

    appEl.innerHTML = `
      <section class="panel wallet-steem">
        <h2>Steem: кошелёк @${escapeHtml(account)}</h2>
        <p><strong>Нода:</strong> ${escapeHtml(data.profile.node)}</p>
        <p><strong>Доступ к аккаунту:</strong> ${escapeHtml(keyStatusText(auth.getKeyStatus(chain, data.current)))}</p>
        <p class="notice">Steem использует STEEM, SBD и SP. Все операции сначала проверяются, а реальная отправка требует отдельного подтверждения в браузере.</p>
        <h3>Балансы Steem</h3>
        ${renderSteemWalletBalances(data.profile, data.delegations, data.delegationsError)}
        ${formsHtml}
        <h3>Последние финансовые операции Steem</h3>
        ${renderHistoryTable(data.walletItems, chain, 'Transfer/reward операции не найдены в последней выборке.')}
      </section>
    `;

    bindSteemWalletForms(chain, data.profile, data.delegations);
    bindMaxButtons(appEl);
    bindGrapheneWalletQuickActions(appEl);
    bindCopyButtons(appEl);
    setStatus(`Steem-кошелёк @${account} загружен: STEEM/SBD/SP, делегирования, rewards и savings доступны через проверку и подтверждение.`, 'ok');
  }

  async function renderGrapheneWalletByChain(chain, account) {
    if (chain.id === 'golos') return renderGolosWallet(chain, account);
    if (chain.id === 'viz') return renderVizWallet(chain, account);
    if (chain.id === 'hive') return renderHiveWallet(chain, account);
    if (chain.id === 'steem') return renderSteemWallet(chain, account);
    throw new Error(`Кошелёк ${chain.title} не поддерживается этим маршрутом.`);
  }

  function operationDetails(title, body, open) {
    return `
      <details class="operation-details" ${open ? 'open' : ''}>
        <summary>${escapeHtml(title)}</summary>
        ${body}
      </details>`;
  }

  function copyButton(value, label) {
    return `<button type="button" data-copy-value="${escapeHtml(value || '')}">Скопировать ${escapeHtml(label || 'значение')}</button>`;
  }

  function buildGrapheneWalletForms(chain, profile) {
    const liquid = chain.liquidSymbol || 'TOKEN';
    const debt = chain.debtSymbol || 'TOKEN';
    const vesting = chain.vestingSymbol || 'VESTS';
    const supportsClaim = chain.id === 'golos' || chain.id === 'hive' || chain.id === 'steem';
    const supportsSavings = chain.id !== 'viz';
    const liquidMax = profile ? pickBalance(profile, liquid) : '';
    const vestingMax = chain.id === 'golos' ? formatGolosPowerMax(profile, profile && profile.raw && profile.raw.vesting_shares) : (profile ? pickBalance(profile, vesting) : '');
    const operations = [
      operationDetails(`Перевод (${liquid})`, `
        <form id="wallet-transfer-form" class="stacked-form">
          <fieldset>
            <legend>Перевод (${escapeHtml(liquid)})</legend>
            <div class="field"><label for="wallet-transfer-to">Получатель</label><input id="wallet-transfer-to" name="to" type="text" required autocomplete="off"></div>
            <div class="field"><label for="wallet-transfer-amount">Сумма с символом</label><input id="wallet-transfer-amount" name="amount" type="text" required placeholder="1.000 ${escapeHtml(liquid)}">${liquidMax ? ` <button type="button" data-fill-target="wallet-transfer-amount" data-fill-value="${escapeHtml(liquidMax)}">Максимум ${escapeHtml(liquidMax)}</button>` : ''}</div>
            <div class="field"><label for="wallet-transfer-memo">Memo</label><input id="wallet-transfer-memo" name="memo" type="text"></div>
            <button type="submit" name="intent" value="preview">Проверить перевод</button>
            <button type="submit" name="intent" value="send">Отправить перевод в сеть</button>
            <button type="button" data-template-save="transfer" data-template-token="GOLOS">Создать шаблон перевода</button>
            <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
          </fieldset>
        </form>`),
      operationDetails('Перевод в соцкапитал / power up', `
        <form id="wallet-vesting-form" class="stacked-form">
          <fieldset>
            <legend>Перевод в соцкапитал / power up</legend>
            <div class="field"><label for="wallet-vesting-to">Получатель power up</label><input id="wallet-vesting-to" name="to" type="text" autocomplete="off" placeholder="пусто = текущий аккаунт"></div>
            <div class="field"><label for="wallet-vesting-amount">Сумма с символом</label><input id="wallet-vesting-amount" name="amount" type="text" required placeholder="1.000 ${escapeHtml(liquid)}">${liquidMax ? ` <button type="button" data-fill-target="wallet-vesting-amount" data-fill-value="${escapeHtml(liquidMax)}">Максимум ${escapeHtml(liquidMax)}</button>` : ''}</div>
            <button type="submit" name="intent" value="preview">Проверить перевод в соцкапитал</button>
            <button type="submit" name="intent" value="send">Отправить power up в сеть</button>
            <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
          </fieldset>
        </form>`),
      operationDetails('Вывод vesting / power down', `
        <form id="wallet-withdraw-vesting-form" class="stacked-form">
          <fieldset>
            <legend>Вывод vesting / power down</legend>
            <div class="field"><label for="wallet-withdraw-vesting-amount">Сумма СГ</label><input id="wallet-withdraw-vesting-amount" name="vesting" type="text" required placeholder="1.000000 СГ">${vestingMax ? ` <button type="button" data-fill-target="wallet-withdraw-vesting-amount" data-fill-value="${escapeHtml(vestingMax)}">Максимум ${escapeHtml(vestingMax)}</button>` : ''}</div>
            <button type="submit" name="intent" value="preview">Проверить вывод vesting</button>
            <button type="submit" name="intent" value="send">Отправить power down в сеть</button>
            <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
          </fieldset>
        </form>`),
      operationDetails('Делегирование', `
        <form id="wallet-delegation-form" class="stacked-form">
          <fieldset>
            <legend>Делегирование</legend>
            <div class="field"><label for="wallet-delegation-to">Кому делегировать</label><input id="wallet-delegation-to" name="delegatee" type="text" required autocomplete="off"></div>
            <div class="field"><label for="wallet-delegation-vesting">Сумма СГ</label><input id="wallet-delegation-vesting" name="vesting" type="text" required placeholder="1.000000 СГ">${vestingMax ? ` <button type="button" data-fill-target="wallet-delegation-vesting" data-fill-value="${escapeHtml(vestingMax)}">Максимум ${escapeHtml(vestingMax)}</button>` : ''}</div>
            <button type="submit" name="intent" value="preview">Проверить делегирование</button>
            <button type="submit" name="intent" value="send">Отправить делегирование в сеть</button>
            <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
          </fieldset>
        </form>`)
    ];

    if (supportsClaim) {
      operations.push(operationDetails('Получение наград', `
        <form id="wallet-claim-form" class="stacked-form">
          <fieldset>
            <legend>Получение наград</legend>
            <p class="muted">Введите балансы наград ровно в формате сети. Для Golos: liquid/vesting/to; для Hive/Steem: liquid, debt и vesting-награды.</p>
            <div class="field"><label for="wallet-claim-liquid">Ликвидная награда</label><input id="wallet-claim-liquid" name="liquid" type="text" required placeholder="0.000 ${escapeHtml(liquid)}"></div>
            <div class="field"><label for="wallet-claim-debt">Долговая награда</label><input id="wallet-claim-debt" name="debt" type="text" placeholder="0.000 ${escapeHtml(debt)}"></div>
            <div class="field"><label for="wallet-claim-vesting">Награда в соцкапитале</label><input id="wallet-claim-vesting" name="vesting" type="text" required placeholder="0.000000 ${escapeHtml(vesting)}"></div>
            ${chain.id === 'golos' ? '<div class="field"><label for="wallet-claim-to">Получатель награды</label><input id="wallet-claim-to" name="to" type="text" placeholder="пусто = текущий аккаунт"></div>' : ''}
            <button type="submit" name="intent" value="preview">Проверить получение награды</button>
            <button type="submit" name="intent" value="send">Получить награды в сети</button>
            <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
          </fieldset>
        </form>`));
    }

    if (supportsSavings) {
      operations.push(
        operationDetails('Перевод в savings', `
          <form id="wallet-savings-to-form" class="stacked-form">
            <fieldset>
              <legend>Перевод в savings</legend>
              <div class="field"><label for="wallet-savings-to">Получатель savings</label><input id="wallet-savings-to" name="to" type="text" autocomplete="off" placeholder="пусто = текущий аккаунт"></div>
              <div class="field"><label for="wallet-savings-amount">Сумма с символом</label><input id="wallet-savings-amount" name="amount" type="text" required placeholder="1.000 ${escapeHtml(liquid)}"></div>
              <div class="field"><label for="wallet-savings-memo">Memo</label><input id="wallet-savings-memo" name="memo" type="text"></div>
              <button type="submit" name="intent" value="preview">Проверить перевод в savings</button>
              <button type="submit" name="intent" value="send">Отправить в savings в сеть</button>
              <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
            </fieldset>
          </form>`),
        operationDetails('Вывод из savings', `
          <form id="wallet-savings-from-form" class="stacked-form">
            <fieldset>
              <legend>Вывод из savings</legend>
              <div class="field"><label for="wallet-savings-request-id">ID запроса</label><input id="wallet-savings-request-id" name="requestId" type="number" min="0" step="1" required value="0"></div>
              <div class="field"><label for="wallet-savings-from-to">Получатель</label><input id="wallet-savings-from-to" name="to" type="text" autocomplete="off" placeholder="пусто = текущий аккаунт"></div>
              <div class="field"><label for="wallet-savings-from-amount">Сумма с символом</label><input id="wallet-savings-from-amount" name="amount" type="text" required placeholder="1.000 ${escapeHtml(liquid)}"></div>
              <div class="field"><label for="wallet-savings-from-memo">Memo</label><input id="wallet-savings-from-memo" name="memo" type="text"></div>
              <button type="submit" name="intent" value="preview">Проверить вывод из savings</button>
              <button type="submit" name="intent" value="send">Вывести из savings в сеть</button>
              <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
            </fieldset>
          </form>`),
        operationDetails('Отмена вывода из savings', `
          <form id="wallet-savings-cancel-form" class="stacked-form">
            <fieldset>
              <legend>Отмена вывода из savings</legend>
              <div class="field"><label for="wallet-savings-cancel-request-id">ID запроса</label><input id="wallet-savings-cancel-request-id" name="requestId" type="number" min="0" step="1" required value="0"></div>
              <button type="submit" name="intent" value="preview">Проверить отмену вывода из savings</button>
              <button type="submit" name="intent" value="send">Отменить вывод в сети</button>
              <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
            </fieldset>
          </form>`)
      );
    }

    return `
      <h3>Операции кошелька</h3>
      <p class="muted">Операции свернуты, чтобы страница кошелька не была громоздкой. Откройте нужный пункт и сначала проверьте операцию перед отправкой.</p>
      ${operations.join('')}`;
  }

  async function callGolosApi(connection, method, args) {
    const api = connection.client && connection.client.api;
    const asyncName = `${method}Async`;
    if (!api) throw new Error('Golos API недоступен.');
    if (typeof api[asyncName] === 'function') return api[asyncName](...args);
    if (typeof api[method] === 'function') {
      return new Promise((resolve, reject) => {
        api[method](...args, (error, result) => error ? reject(error) : resolve(result));
      });
    }
    throw new Error(`Метод Golos API ${method} недоступен.`);
  }

  async function fetchGolosDelegations(connection, account) {
    const [delegated, received] = await Promise.all([
      callGolosApi(connection, 'getVestingDelegations', [account, '', 100, 'delegated']),
      callGolosApi(connection, 'getVestingDelegations', [account, '', 100, 'received'])
    ]);
    return {
      delegated: Array.isArray(delegated) ? delegated : [],
      received: Array.isArray(received) ? received : []
    };
  }

  function renderGolosDelegations(profile, delegations) {
    const gpRate = golosPowerRateFromProfile(profile);
    const formatGp = (vestingShares) => {
      const value = Number.parseFloat(vestingShares) || 0;
      return gpRate ? `${(value / 1000000 * gpRate).toFixed(6)} СГ` : String(vestingShares || '');
    };
    const renderRows = (rows, direction) => {
      if (!rows || !rows.length) return '<p class="muted">Список пуст.</p>';
      return `<div class="table-wrap"><table><thead><tr><th scope="col">Аккаунт</th><th scope="col">Сумма</th><th scope="col">Процент возврата кураторских</th><th scope="col">Мин. время возврата</th>${direction === 'delegated' ? '<th scope="col">Действия</th>' : ''}</tr></thead><tbody>${rows.map((item) => {
        const peer = direction === 'received' ? item.delegator : item.delegatee;
        const interest = item.interest_rate !== undefined ? `${Number(item.interest_rate) / 100}%` : '';
        const cancel = direction === 'delegated' ? ` <button type="button" data-golos-cancel-delegation="${escapeHtml(peer || '')}">Отменить делегирование</button>` : '';
        return `<tr><td>@${escapeHtml(peer || '')}</td><td>${escapeHtml(formatGp(item.vesting_shares))}</td><td>${escapeHtml(interest)}</td><td>${escapeHtml(item.min_delegation_time || '')}</td>${direction === 'delegated' ? `<td>${cancel}</td>` : ''}</tr>`;
      }).join('')}</tbody></table></div>`;
    };
    const error = delegations && delegations.error ? `<p class="muted">Списки делегирований не загрузились: ${escapeHtml(delegations.error)}. Формы делегирования и отмены ниже всё равно доступны.</p>` : '';
    return `${error}${operationDetails('Полученная делегированием СГ', renderRows(delegations && delegations.received, 'received'))}${operationDetails('Делегированная другим СГ', renderRows(delegations && delegations.delegated, 'delegated'))}`;
  }

  function renderGolosWalletBalances(profile, balanceRows) {
    const raw = (profile && profile.raw) || {};
    const rows = [];
    const add = (label, value, note) => {
      if (value === undefined || value === null || value === '') return;
      rows.push([label, value, note || '']);
    };
    const actions = (items) => items.filter(Boolean).join(' ');

    add('GOLOS', raw.balance, walletQuickActionButton('Перевести GOLOS', 'wallet-transfer-form', { 'wallet-transfer-amount': raw.balance }) + ' ' + walletQuickActionButton('В СГ', 'wallet-vesting-form', { 'wallet-vesting-amount': raw.balance }));
    add('GBG', raw.sbd_balance || raw.gbg_balance, walletQuickActionButton('Перевести GBG', 'wallet-transfer-form', { 'wallet-transfer-amount': raw.sbd_balance || raw.gbg_balance }));
    add('СГ', formatGolosPowerMax(profile, raw.vesting_shares), walletQuickActionButton('Вывести СГ', 'wallet-withdraw-vesting-form', { 'wallet-withdraw-vesting-amount': formatGolosPowerMax(profile, raw.vesting_shares) }) + ' ' + walletQuickActionButton('Делегировать СГ', 'wallet-delegation-form', { 'wallet-delegation-vesting': formatGolosPowerMax(profile, raw.vesting_shares) }));
    add('Делегировано СГ', formatGolosPowerMax(profile, raw.delegated_vesting_shares));
    add('Получено делегированием СГ', formatGolosPowerMax(profile, raw.received_vesting_shares));
    add('TIP GOLOS', raw.tip_balance, actions([
      walletQuickActionButton('Донат GOLOS', 'wallet-golos-donate-form', { 'wallet-golos-donate-amount': raw.tip_balance }),
      walletQuickActionButton('Вывести из TIP', 'wallet-golos-transfer-from-tip-form', { 'wallet-golos-transfer-from-tip-token': 'GOLOS', 'wallet-golos-transfer-from-tip-amount': raw.tip_balance })
    ]));
    add('Накопления GOLOS', raw.accumulative_balance, walletQuickActionButton('Получить накопления', 'wallet-golos-claim-form', { 'wallet-golos-claim-amount': raw.accumulative_balance }));

    (balanceRows || []).forEach((row) => {
      const meta = row && row[2];
      if (meta && meta.kind === 'uia') {
        const suffix = meta.balanceType === 'tip' ? 'TIP' : 'основной';
        const note = meta.balanceType === 'tip'
          ? actions([
            walletQuickActionButton('Вывести из TIP', 'wallet-golos-transfer-from-tip-form', { 'wallet-golos-transfer-from-tip-token': meta.symbol, 'wallet-golos-transfer-from-tip-amount': row[1] }),
            walletQuickActionButton('Донат UIA', 'wallet-golos-token-donate-form', { 'wallet-golos-token-donate-token': meta.symbol, 'wallet-golos-token-donate-amount': row[1] })
          ])
          : actions([
            walletQuickActionButton('Перевести UIA', 'wallet-golos-uia-transfer-form', { 'wallet-golos-uia-transfer-token': meta.symbol, 'wallet-golos-uia-transfer-amount': row[1] }),
            walletQuickActionButton('На TIP', 'wallet-golos-transfer-to-tip-form', { 'wallet-golos-transfer-to-tip-token': meta.symbol, 'wallet-golos-transfer-to-tip-amount': row[1] })
          ]);
        add(`UIA ${meta.symbol} (${suffix})`, row[1], note);
      } else if (meta && meta.kind === 'uia-status') {
        add(row[0], row[1], 'UIA balances diagnostic');
      }
    });

    return `<ul class="wallet-golos-balances">${rows.map(([label, value, note]) => `<li><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}${note ? ` <span class="muted">— ${String(note).includes('<button') ? note : escapeHtml(note)}</span>` : ''}</li>`).join('') || '<li>Нет данных о балансах.</li>'}</ul>`;
  }

  function renderTemplateSelect(kind, token, login, selectId) {
    const builtIns = getGolosBuiltInTemplates(kind, token, login);
    const custom = readGolosCustomTemplates(kind, token);
    const builtInOptions = builtIns.map((item) => `<option value="${escapeHtml(item.id)}" data-builtin="1" data-to="${escapeHtml(item.to)}" data-memo="${escapeHtml(item.memo)}" data-in="${escapeHtml(item.in || '')}">${escapeHtml(item.name)}</option>`).join('');
    const customOptions = custom.map((item, index) => `<option value="${index + 1}" data-to="${escapeHtml(item.to || '')}" data-memo="${escapeHtml(item.memo || '')}" data-in="${escapeHtml(item.in || '')}">${escapeHtml(item.name)}</option>`).join('');
    return `<div class="field"><label for="${selectId}">Шаблон ${kind === 'transfer' ? 'перевода' : 'доната'} (${escapeHtml(token)})</label><select id="${selectId}" data-template-select="${kind}" data-template-token="${escapeHtml(token)}"><option value="">Выберите шаблон</option>${builtInOptions}${customOptions}</select> <button type="button" data-template-remove="${kind}" data-template-token="${escapeHtml(token)}" data-template-select-id="${selectId}" hidden>Удалить текущий шаблон</button></div>`;
  }

  function renderGolosUiaDepositSection(gateways) {
    const depositGateways = getGolosGatewayOptions(gateways, 'deposit').filter(golosGatewayHasDepositAction);
    if (!depositGateways.length) return '';
    const options = depositGateways.map((gateway) => `<option value="${escapeHtml(gateway.symbol)}">${escapeHtml(gateway.symbol)}</option>`).join('');
    const panels = depositGateways.map((gateway, index) => {
      const deposit = gateway.deposit;
      const extras = [deposit.min_amount && `Минимальная сумма: ${deposit.min_amount}`, deposit.fee && `Комиссия: ${deposit.fee}`].filter(Boolean);
      let body = deposit.details ? `<p>${escapeHtml(deposit.details)}</p>` : '';
      if (extras.length) body += `<ul>${extras.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
      if (String(deposit.to_type || '').toLowerCase() === 'fixed') {
        body = '<p>Данные для пополнения:</p><ul>';
        if (deposit.to_fixed) body += `<li>Адрес/получатель: <code>${escapeHtml(deposit.to_fixed)}</code> ${copyButton(deposit.to_fixed, 'адрес')}</li>`;
        if (deposit.memo_fixed) body += `<li>Memo: <code>${escapeHtml(deposit.memo_fixed)}</code> ${copyButton(deposit.memo_fixed, 'memo')}</li>`;
        body += '</ul>';
      } else if (String(deposit.to_type || '').toLowerCase() === 'api') {
        body += '<p class="muted">В старой версии адрес пополнения запрашивался через backend API. В static v3 этот серверный запрос отключён: используйте fixed-данные из metadata или вариант запроса адреса через перевод, если он указан ниже.</p>';
      } else {
        body += '<p class="muted">Тип пополнения из metadata не поддержан автоматически.</p>';
      }
      if (deposit.to_transfer && deposit.memo_transfer) {
        body += `<form id="wallet-golos-uia-deposit-transfer-${escapeHtml(gateway.symbol)}" class="stacked-form"><input type="hidden" name="to" value="${escapeHtml(deposit.to_transfer)}"><input type="hidden" name="memo" value="${escapeHtml(deposit.memo_transfer)}"><fieldset><legend>Запрос адреса через перевод 0.001 GOLOS</legend><p class="muted">Это реальная active-операция transfer на шлюз. Сначала нажмите «Проверить», затем отдельной кнопкой подтвердите отправку.</p><button type="submit" name="intent" value="preview">Проверить запрос адреса</button> <button type="submit" name="intent" value="send">Отправить 0.001 GOLOS</button><div class="operation-result" data-operation-result role="status" aria-live="polite"></div></fieldset></form>`;
      }
      return `<div data-uia-deposit-panel="${escapeHtml(gateway.symbol)}" ${index ? 'hidden' : ''}>${body}</div>`;
    }).join('');
    return operationDetails('UIA deposit / пополнение через gateways', `<div class="field"><label for="wallet-golos-uia-deposit-token">Токен/gateway</label><select id="wallet-golos-uia-deposit-token">${options}</select></div>${panels}`);
  }

  function renderGolosUiaWithdrawSection(gateways, balanceRows) {
    const mainBalances = golosMainBalanceMap(balanceRows);
    const withdrawGateways = getGolosGatewayOptions(gateways, 'withdraw')
      .filter((gateway) => gateway.withdraw.account && gateway.withdraw.ways.length && mainBalances.has(gateway.symbol));
    if (!withdrawGateways.length) return '';
    const options = withdrawGateways.flatMap((gateway) => gateway.withdraw.ways.map((way, index) => `<option value="${escapeHtml(gateway.symbol)}:${index}" data-token="${escapeHtml(gateway.symbol)}" data-max="${escapeHtml(mainBalances.get(gateway.symbol) || '')}" data-account="${escapeHtml(gateway.withdraw.account)}" data-prefix="${escapeHtml(way.prefix || '')}" data-memo-label="${escapeHtml(way.memo || 'Данные для вывода')}" data-postfix-label="${escapeHtml(way.postfix_title || '')}" data-postfix-placeholder="${escapeHtml(way.postfix || '')}">${escapeHtml(gateway.symbol)} — ${escapeHtml(way.name || `Способ ${index + 1}`)} — максимум ${escapeHtml(mainBalances.get(gateway.symbol) || '')}</option>`)).join('');
    const descriptions = withdrawGateways.map((gateway) => {
      const w = gateway.withdraw;
      const extras = [w.details, w.min_amount && `Минимальная сумма: ${w.min_amount}`, w.fee && `Комиссия: ${w.fee}`, `Аккаунт шлюза: ${w.account}`].filter(Boolean);
      return `<li><strong>${escapeHtml(gateway.symbol)}:</strong> ${extras.map((item) => escapeHtml(item)).join('; ')}</li>`;
    }).join('');
    return operationDetails('UIA withdraw / вывод через gateways', `
      <form id="wallet-golos-uia-withdraw-form" class="stacked-form">
        <fieldset>
          <legend>Вывод UIA через шлюз</legend>
          <p class="muted">Выберите токен, способ вывода и заполните данные получателя. Memo для шлюза будет подготовлен автоматически.</p>
          <ul>${descriptions}</ul>
          <div class="field"><label for="wallet-golos-uia-withdraw-way">Токен и способ</label><select id="wallet-golos-uia-withdraw-way" name="way" required>${options}</select></div>
          <div class="field"><label for="wallet-golos-uia-withdraw-amount">Сумма UIA</label><input id="wallet-golos-uia-withdraw-amount" name="amount" type="text" required placeholder="1.000"> <button type="button" data-fill-selected="wallet-golos-uia-withdraw-way" data-fill-target="wallet-golos-uia-withdraw-amount">Максимум</button></div>
          <div class="field"><label for="wallet-golos-uia-withdraw-main" data-withdraw-main-label>Данные для вывода</label><input id="wallet-golos-uia-withdraw-main" name="main" type="text" required autocomplete="off"></div>
          <div class="field" data-withdraw-postfix-field hidden><label for="wallet-golos-uia-withdraw-postfix" data-withdraw-postfix-label>Дополнительно</label><input id="wallet-golos-uia-withdraw-postfix" name="postfix" type="text"></div>
          <button type="submit" name="intent" value="preview">Проверить вывод</button>
          <button type="submit" name="intent" value="send">Отправить вывод</button>
          <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
        </fieldset>
      </form>`);
  }

  function renderGolosWalletForms(chain, profile, balanceRows, uiaGateways, delegations) {
    const liquid = chain.liquidSymbol || 'GOLOS';
    const debt = chain.debtSymbol || 'GBG';
    const liquidMax = profile ? pickBalance(profile, liquid) : '';
    const tipMax = profile && profile.raw ? profile.raw.tip_balance : '';
    const vestingMax = formatGolosPowerMax(profile, profile && profile.raw && profile.raw.vesting_shares);
    const claimMax = profile && profile.raw ? profile.raw.accumulative_balance : '';
    const tipActionTokens = collectGolosTipActionTokens(profile, balanceRows);
    const mainTokenOptions = tokenOptions(tipActionTokens, 'main');
    const tipTokenOptions = tokenOptions(tipActionTokens, 'tip');
    const transferTemplateSelect = renderTemplateSelect('transfer', 'GOLOS', auth.getCurrentLogin(chain), 'wallet-transfer-template');
    const donateTemplateSelect = renderTemplateSelect('donate', 'GOLOS', auth.getCurrentLogin(chain), 'wallet-golos-donate-template');
    const operations = [
      operationDetails(`Перевод GOLOS/GBG`, `
        <form id="wallet-transfer-form" class="stacked-form">
          <fieldset>
            <legend>Перевод GOLOS/GBG</legend>
            ${transferTemplateSelect}
            <div class="field"><label for="wallet-transfer-to">Кому</label><input id="wallet-transfer-to" name="to" type="text" required autocomplete="off"></div>
            <div class="field"><label for="wallet-transfer-amount">Сумма с символом</label><input id="wallet-transfer-amount" name="amount" type="text" required placeholder="1.000 ${escapeHtml(liquid)}">${liquidMax ? ` <button type="button" data-fill-target="wallet-transfer-amount" data-fill-value="${escapeHtml(liquidMax)}">Максимум ${escapeHtml(liquidMax)}</button>` : ''}</div>
            <div class="field"><label for="wallet-transfer-in">Куда перевести</label><select id="wallet-transfer-in" name="in"><option value="to_balance">Основной баланс получателя</option><option value="to_tip">TIP-баланс получателя</option><option value="to_vesting">СГ получателя (только GOLOS)</option></select></div>
            <div class="field"><label for="wallet-transfer-memo">Memo</label><input id="wallet-transfer-memo" name="memo" type="text"></div>
            <button type="submit" name="intent" value="preview">Проверить перевод</button>
            <button type="submit" name="intent" value="send">Отправить перевод в сеть</button>
            <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
          </fieldset>
        </form>`),
      operationDetails('GOLOS в СГ', `
        <form id="wallet-vesting-form" class="stacked-form">
          <fieldset>
            <legend>Перевод GOLOS в СГ</legend>
            <div class="field"><label for="wallet-vesting-to">Получатель СГ</label><input id="wallet-vesting-to" name="to" type="text" autocomplete="off" placeholder="пусто = текущий аккаунт"></div>
            <div class="field"><label for="wallet-vesting-amount">Сумма GOLOS</label><input id="wallet-vesting-amount" name="amount" type="text" required placeholder="1.000 ${escapeHtml(liquid)}">${liquidMax ? ` <button type="button" data-fill-target="wallet-vesting-amount" data-fill-value="${escapeHtml(liquidMax)}">Максимум ${escapeHtml(liquidMax)}</button>` : ''}</div>
            <button type="submit" name="intent" value="preview">Проверить перевод в СГ</button>
            <button type="submit" name="intent" value="send">Отправить перевод в СГ</button>
            <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
          </fieldset>
        </form>`),
      operationDetails('Вывод СГ', `
        <form id="wallet-withdraw-vesting-form" class="stacked-form">
          <fieldset>
            <legend>Вывод СГ в GOLOS</legend>
            <p class="muted">Если вывод уже запущен, новая операция изменит сумму вывода.</p>
            <div class="field"><label for="wallet-withdraw-vesting-amount">Сумма СГ</label><input id="wallet-withdraw-vesting-amount" name="vesting" type="text" required placeholder="1.000000 СГ">${vestingMax ? ` <button type="button" data-fill-target="wallet-withdraw-vesting-amount" data-fill-value="${escapeHtml(vestingMax)}">Максимум ${escapeHtml(vestingMax)}</button>` : ''}</div>
            <button type="submit" name="intent" value="preview">Проверить вывод СГ</button>
            <button type="submit" name="intent" value="send">Отправить вывод СГ</button>
            <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
          </fieldset>
        </form>
        <form id="wallet-golos-cancel-withdraw-form" class="stacked-form">
          <fieldset>
            <legend>Отмена вывода СГ</legend>
            <p class="muted">Legacy cancel_vesting_withdraw отправлял withdrawVesting с 0.000000 GESTS.</p>
            <button type="submit" name="intent" value="preview">Проверить отмену вывода</button>
            <button type="submit" name="intent" value="send">Отменить вывод СГ</button>
            <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
          </fieldset>
        </form>`),
      operationDetails('Делегирование СГ', `
        <form id="wallet-delegation-form" class="stacked-form">
          <fieldset>
            <legend>Делегирование СГ</legend>
            <div class="field"><label for="wallet-delegation-to">Кому делегировать</label><input id="wallet-delegation-to" name="delegatee" type="text" required autocomplete="off"></div>
            <div class="field"><label for="wallet-delegation-vesting">Сумма СГ</label><input id="wallet-delegation-vesting" name="vesting" type="text" required placeholder="1.000000 СГ">${vestingMax ? ` <button type="button" data-fill-target="wallet-delegation-vesting" data-fill-value="${escapeHtml(vestingMax)}">Максимум ${escapeHtml(vestingMax)}</button>` : ''}</div>
            <div class="field"><label for="wallet-golos-delegation-interest">Процент с кураторских</label><input id="wallet-golos-delegation-interest" name="interest" type="number" min="0" max="80" step="1" value="80"><p class="muted">Как в legacy: новый получатель использует delegate_vesting_shares_with_interest; для изменения/отмены существующей делегации можно поставить 0.000000 СГ.</p></div>
            <button type="submit" name="intent" value="preview">Проверить делегирование СГ</button>
            <button type="submit" name="intent" value="send">Отправить делегирование СГ</button>
            <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
          </fieldset>
        </form>`),
      operationDetails('Получить накопления GOLOS', `
        <form id="wallet-golos-claim-form" class="stacked-form">
          <fieldset>
            <legend>Claim accumulative balance</legend>
            <div class="field"><label for="wallet-golos-claim-to">Кому</label><input id="wallet-golos-claim-to" name="to" type="text" placeholder="пусто = текущий аккаунт"></div>
            <div class="field"><label for="wallet-golos-claim-amount">Сумма GOLOS</label><input id="wallet-golos-claim-amount" name="amount" type="text" required placeholder="0.000 ${escapeHtml(liquid)}">${claimMax ? ` <button type="button" data-fill-target="wallet-golos-claim-amount" data-fill-value="${escapeHtml(claimMax)}">Максимум ${escapeHtml(claimMax)}</button>` : ''}</div>
            <div class="field"><label><input name="toVesting" type="checkbox"> Получить в СГ</label></div>
            <button type="submit" name="intent" value="preview">Проверить получение</button>
            <button type="submit" name="intent" value="send">Получить в сети</button>
            <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
          </fieldset>
        </form>`),
      operationDetails('Донат из TIP-баланса GOLOS', `
        <form id="wallet-golos-donate-form" class="stacked-form">
          <fieldset>
            <legend>Донат GOLOS из TIP-баланса</legend>
            ${donateTemplateSelect}
            <div class="field"><label for="wallet-golos-donate-to">Кому</label><input id="wallet-golos-donate-to" name="to" type="text" required autocomplete="off"></div>
            <div class="field"><label for="wallet-golos-donate-amount">Сумма GOLOS</label><input id="wallet-golos-donate-amount" name="amount" type="text" required placeholder="1.000 ${escapeHtml(liquid)}">${tipMax ? ` <button type="button" data-fill-target="wallet-golos-donate-amount" data-fill-value="${escapeHtml(tipMax)}">Максимум ${escapeHtml(tipMax)}</button>` : ''}</div>
            <div class="field"><label for="wallet-golos-donate-memo">Комментарий</label><textarea id="wallet-golos-donate-memo" name="memo" rows="3"></textarea></div>
            <button type="submit" name="intent" value="preview">Проверить донат</button>
            <button type="submit" name="intent" value="send">Отправить донат</button>
            <button type="button" data-template-save="donate" data-template-token="GOLOS">Создать шаблон доната</button>
            <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
          </fieldset>
        </form>`),
      operationDetails('Перевод UIA с основного баланса', `
        <form id="wallet-golos-uia-transfer-form" class="stacked-form">
          <fieldset>
            <legend>UIA: основной баланс → основной баланс</legend>
            <p class="muted">Обычный transfer UIA-токена другому аккаунту, как в старом кошельке.</p>
            <div class="field"><label for="wallet-golos-uia-transfer-token">Токен</label><select id="wallet-golos-uia-transfer-token" name="token" required>${mainTokenOptions || '<option value="">Нет доступных main-балансов</option>'}</select></div>
            <div class="field"><label for="wallet-golos-uia-transfer-to">Кому</label><input id="wallet-golos-uia-transfer-to" name="to" type="text" required autocomplete="off"></div>
            <div class="field"><label for="wallet-golos-uia-transfer-amount">Сумма</label><input id="wallet-golos-uia-transfer-amount" name="amount" type="text" required placeholder="1.000"> <button type="button" data-fill-selected="wallet-golos-uia-transfer-token" data-fill-target="wallet-golos-uia-transfer-amount">Максимум</button></div>
            <div class="field"><label for="wallet-golos-uia-transfer-memo">Memo</label><input id="wallet-golos-uia-transfer-memo" name="memo" type="text"></div>
            <button type="submit" name="intent" value="preview">Проверить UIA transfer</button>
            <button type="submit" name="intent" value="send">Отправить UIA transfer</button>
            <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
          </fieldset>
        </form>`, Boolean(mainTokenOptions)),
      operationDetails('Перевод токена на TIP-баланс', `
        <form id="wallet-golos-transfer-to-tip-form" class="stacked-form">
          <fieldset>
            <legend>Основной баланс → TIP-баланс</legend>
            <p class="muted">Переводит выбранный токен с основного баланса на TIP-баланс получателя.</p>
            <div class="field"><label for="wallet-golos-transfer-to-tip-token">Токен</label><select id="wallet-golos-transfer-to-tip-token" name="token" required>${mainTokenOptions || '<option value="">Нет доступных main-балансов</option>'}</select></div>
            <div class="field"><label for="wallet-golos-transfer-to-tip-to">Кому</label><input id="wallet-golos-transfer-to-tip-to" name="to" type="text" required autocomplete="off"></div>
            <div class="field"><label for="wallet-golos-transfer-to-tip-amount">Сумма</label><input id="wallet-golos-transfer-to-tip-amount" name="amount" type="text" required placeholder="1.000"> <button type="button" data-fill-selected="wallet-golos-transfer-to-tip-token" data-fill-target="wallet-golos-transfer-to-tip-amount">Максимум</button></div>
            <div class="field"><label for="wallet-golos-transfer-to-tip-memo">Memo</label><input id="wallet-golos-transfer-to-tip-memo" name="memo" type="text"></div>
            <button type="submit" name="intent" value="preview">Проверить перевод на TIP</button>
            <button type="submit" name="intent" value="send">Отправить на TIP</button>
            <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
          </fieldset>
        </form>`, Boolean(mainTokenOptions)),
      operationDetails('Перевод из TIP-баланса', `
        <form id="wallet-golos-transfer-from-tip-form" class="stacked-form">
          <fieldset>
            <legend>TIP-баланс → основной баланс / СГ</legend>
            <p class="muted">Переводит выбранный токен из TIP-баланса. Для GOLOS вывод идёт в СГ, для UIA — на основной баланс.</p>
            <div class="field"><label for="wallet-golos-transfer-from-tip-token">Токен</label><select id="wallet-golos-transfer-from-tip-token" name="token" required>${tipTokenOptions || '<option value="">Нет доступных TIP-балансов</option>'}</select></div>
            <div class="field"><label for="wallet-golos-transfer-from-tip-to">Кому</label><input id="wallet-golos-transfer-from-tip-to" name="to" type="text" required autocomplete="off"></div>
            <div class="field"><label for="wallet-golos-transfer-from-tip-amount">Сумма</label><input id="wallet-golos-transfer-from-tip-amount" name="amount" type="text" required placeholder="1.000"> <button type="button" data-fill-selected="wallet-golos-transfer-from-tip-token" data-fill-target="wallet-golos-transfer-from-tip-amount">Максимум</button></div>
            <div class="field"><label for="wallet-golos-transfer-from-tip-memo">Memo</label><input id="wallet-golos-transfer-from-tip-memo" name="memo" type="text"></div>
            <button type="submit" name="intent" value="preview">Проверить вывод из TIP</button>
            <button type="submit" name="intent" value="send">Вывести из TIP</button>
            <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
          </fieldset>
        </form>`, Boolean(tipTokenOptions)),
      operationDetails('Донат из TIP-баланса токена', `
        <form id="wallet-golos-token-donate-form" class="stacked-form">
          <fieldset>
            <legend>Донат GOLOS/UIA из TIP-баланса</legend>
            <p class="muted">Отправляет донат выбранным токеном из TIP-баланса.</p>
            <div class="field"><label for="wallet-golos-token-donate-token">Токен</label><select id="wallet-golos-token-donate-token" name="token" required>${tipTokenOptions || '<option value="">Нет доступных TIP-балансов</option>'}</select></div>
            <div class="field"><label for="wallet-golos-token-donate-to">Кому</label><input id="wallet-golos-token-donate-to" name="to" type="text" required autocomplete="off"></div>
            <div class="field"><label for="wallet-golos-token-donate-amount">Сумма</label><input id="wallet-golos-token-donate-amount" name="amount" type="text" required placeholder="1.000"> <button type="button" data-fill-selected="wallet-golos-token-donate-token" data-fill-target="wallet-golos-token-donate-amount">Максимум</button></div>
            <div class="field"><label for="wallet-golos-token-donate-memo">Комментарий</label><textarea id="wallet-golos-token-donate-memo" name="memo" rows="3"></textarea></div>
            <button type="submit" name="intent" value="preview">Проверить донат</button>
            <button type="submit" name="intent" value="send">Отправить донат</button>
            <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
          </fieldset>
        </form>`, Boolean(tipTokenOptions)),
      operationDetails('Инвайт-коды GOLOS', `
        <form id="wallet-golos-invite-claim-form" class="stacked-form">
          <fieldset>
            <legend>Пополнить баланс invite-кодом</legend>
            <p class="muted">Секрет invite используется только для операции invite_claim и не сохраняется.</p>
            <div class="field"><label for="wallet-golos-invite-secret">Инвайт-код / secret WIF</label><input id="wallet-golos-invite-secret" name="secret" type="password" required autocomplete="off" placeholder="5K..."></div>
            <button type="submit" name="intent" value="preview">Проверить invite claim</button>
            <button type="submit" name="intent" value="send">Пополнить invite-кодом</button>
            <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
          </fieldset>
        </form>
        <form id="wallet-golos-create-invite-form" class="stacked-form">
          <fieldset>
            <legend>Создать invite</legend>
            <div class="field"><label for="wallet-golos-create-invite-amount">Баланс invite</label><input id="wallet-golos-create-invite-amount" name="amount" type="text" required placeholder="1.000 GOLOS">${liquidMax ? ` <button type="button" data-fill-target="wallet-golos-create-invite-amount" data-fill-value="${escapeHtml(liquidMax)}">Максимум ${escapeHtml(liquidMax)}</button>` : ''}</div>
            <div class="field"><label for="wallet-golos-create-invite-secret">Secret WIF invite</label><input id="wallet-golos-create-invite-secret" name="secret" type="password" required autocomplete="off" placeholder="Сгенерируйте или вставьте 5K..."></div>
            <button type="button" id="wallet-golos-generate-invite">Генерировать secret</button>
            <button type="submit" name="intent" value="preview">Проверить создание invite</button>
            <button type="submit" name="intent" value="send">Создать invite</button>
            <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
          </fieldset>
        </form>`),
      operationDetails('Голос за witness dpos.space', `
        <form id="wallet-golos-witness-vote-form" class="stacked-form">
          <fieldset>
            <legend>Проголосовать за denis-skripnik</legend>
            <p class="muted">Legacy показывал кнопку поддержки witness проекта. В v3 операция также требует preview и отдельного подтверждения.</p>
            <button type="submit" name="intent" value="preview">Проверить голос</button>
            <button type="submit" name="intent" value="send">Проголосовать</button>
            <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
          </fieldset>
        </form>`),
      renderGolosDelegations(profile, delegations),
      renderGolosUiaDepositSection(uiaGateways),
      renderGolosUiaWithdrawSection(uiaGateways, balanceRows)
    ];

    return `
      <h3>Операции Golos</h3>
      <p class="muted">Операции доступны через проверку и отдельное подтверждение отправки.</p>
      ${operations.join('')}`;
  }

  function vizAsset(raw, field) {
    return raw && raw[field] ? raw[field] : '';
  }

  function vizSharesMax(profile, field) {
    const value = vizAsset(profile && profile.raw, field || 'vesting_shares');
    return value ? `${(Number.parseFloat(value) || 0).toFixed(6)} SHARES` : '';
  }

  function vizEffectiveShares(profile) {
    const raw = (profile && profile.raw) || {};
    const own = Number.parseFloat(raw.vesting_shares) || 0;
    const delegated = Number.parseFloat(raw.delegated_vesting_shares) || 0;
    const received = Number.parseFloat(raw.received_vesting_shares) || 0;
    return `${(own - delegated + received).toFixed(6)} SHARES`;
  }

  function vizCurrentEnergy(profile) {
    const raw = (profile && profile.raw) || {};
    const base = Number(raw.energy);
    if (!Number.isFinite(base)) return '';
    const lastVoteTime = Date.parse(raw.last_vote_time || raw.last_account_update || raw.created || '');
    if (!Number.isFinite(lastVoteTime)) return `${(base / 100).toFixed(2)}%`;
    const deltaSeconds = Math.max(0, (Date.now() - lastVoteTime) / 1000);
    const regenerated = Math.min(10000, Math.trunc(base + (deltaSeconds * 10000 / 432000)));
    return `${(regenerated / 100).toFixed(2)}%`;
  }

  function renderVizDelegations(title, rows, direction, unavailable) {
    if (unavailable) return `<p class="muted">${escapeHtml(title)}: не удалось загрузить список с доступных VIZ-нод. Управление всё равно доступно через форму «Делегирование SHARES»: для отмены укажите аккаунт и сумму 0.000000 SHARES.</p>`;
    if (!rows || !rows.length) return `<p class="muted">${escapeHtml(title)}: список пуст. Если нужно отменить делегирование, используйте форму «Делегирование SHARES» с суммой 0.000000 SHARES.</p>`;
    const body = rows.map((item) => {
      const peer = direction === 'received' ? item.delegator : item.delegatee;
      const cancel = direction === 'delegated'
        ? ` <button type="button" data-viz-cancel-delegation="${escapeHtml(peer || '')}">Отменить делегирование</button>`
        : '';
      return `<tr><td>@${escapeHtml(peer || '')}</td><td>${escapeHtml(item.vesting_shares || '')}</td><td>${escapeHtml(item.min_delegation_time || '')}${cancel}</td></tr>`;
    }).join('');
    return `<div class="table-wrap"><table><caption>${escapeHtml(title)}</caption><thead><tr><th scope="col">Аккаунт</th><th scope="col">SHARES</th><th scope="col">Мин. время возврата</th></tr></thead><tbody>${body}</tbody></table></div>`;
  }

  function renderVizWalletBalances(profile, delegations) {
    const raw = (profile && profile.raw) || {};
    const rows = [];
    const add = (label, value, note) => {
      if (value === undefined || value === null || value === '') return;
      rows.push([label, value, note || '']);
    };
    const withdrawRate = Number.parseFloat(raw.vesting_withdraw_rate) || 0;
    const fullWithdraw = withdrawRate ? `${(withdrawRate * 28).toFixed(6)} SHARES` : '';

    add('VIZ', raw.balance, walletQuickActionButton('Перевести VIZ', 'wallet-transfer-form', { 'wallet-transfer-amount': raw.balance }) + ' ' + walletQuickActionButton('В SHARES', 'wallet-vesting-form', { 'wallet-vesting-amount': raw.balance }));
    add('SHARES', raw.vesting_shares, walletQuickActionButton('Вывести SHARES', 'wallet-withdraw-vesting-form', { 'wallet-withdraw-vesting-amount': vizSharesMax(profile, 'vesting_shares') }) + ' ' + walletQuickActionButton('Делегировать SHARES', 'wallet-delegation-form', { 'wallet-delegation-vesting': vizSharesMax(profile, 'vesting_shares') }));
    add('Делегировано SHARES', raw.delegated_vesting_shares);
    add('Получено делегированием SHARES', raw.received_vesting_shares);
    add('Итоговые SHARES для наград', vizEffectiveShares(profile));
    add('Energy', vizCurrentEnergy(profile) || (raw.energy !== undefined ? `${Number(raw.energy) / 100}%` : ''));
    add('Reward SHARES', raw.reward_vesting_balance);
    add('Выводится по', raw.vesting_withdraw_rate, fullWithdraw ? `итого за 28 интервалов: ${fullWithdraw}` : '');
    add('Следующий вывод', raw.next_vesting_withdrawal);

    const list = `<ul class="wallet-viz-balances">${rows.map(([label, value, note]) => `<li><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}${note ? ` <span class="muted">— ${String(note).includes('<button') ? note : escapeHtml(note)}</span>` : ''}</li>`).join('') || '<li>Нет данных о балансах.</li>'}</ul>`;
    const delegationError = delegations && delegations.error ? `<p class="muted">getVestingDelegations недоступен после fallback по VIZ-нодам: ${escapeHtml(delegations.error)}</p>` : '';
    const delegationNote = '<p class="muted">Управление делегированием SHARES находится ниже: форма «Делегирование SHARES» создаёт/изменяет делегирование, а сумма 0.000000 SHARES отменяет делегирование выбранному аккаунту.</p>';
    return `${list}${delegationNote}${delegationError}${renderVizDelegations('Кто делегировал вам SHARES', delegations && delegations.received, 'received', delegations && delegations.unavailable)}${renderVizDelegations('Кому вы делегировали SHARES', delegations && delegations.delegated, 'delegated', delegations && delegations.unavailable)}`;
  }

  function readVizTransferTemplates() {
    const raw = global.localStorage && global.localStorage.getItem('viz_transfer_templates');
    const parsed = raw ? parseGolosJsonMetadata(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((item) => item && item.name) : [];
  }

  function writeVizTransferTemplates(templates) {
    if (global.localStorage) global.localStorage.setItem('viz_transfer_templates', JSON.stringify(Array.isArray(templates) ? templates : []));
  }

  function renderVizTransferTemplateSelect(login) {
    const builtIns = [
      { id: 'xchng_market', name: 'Биржа, XCHNG.VIZ (memo: log:)', to: 'xchng', memo: 'log:' },
      { id: 'golos_xchng_market', name: 'VIZUIA на Голосе (memo: log:)', to: 'gls.xchng', memo: 'log:' },
      { id: 'gph_xchng_market', name: 'Graphene биржа, XCHNG.VIZ (memo: log:)', to: 'gph.xchng', memo: 'log:' },
      { id: 'vmp_market', name: 'Шлюз в Minter (memo начинается с Mx)', to: 'vmp', memo: 'Mx' },
      { id: 'self_shares', name: 'На свой аккаунт в SHARES', to: login || '', memo: '', toVesting: true }
    ];
    const builtInOptions = builtIns.map((item) => `<option value="${escapeHtml(item.id)}" data-builtin="1" data-to="${escapeHtml(item.to)}" data-memo="${escapeHtml(item.memo)}" data-to-vesting="${item.toVesting ? '1' : ''}">${escapeHtml(item.name)}</option>`).join('');
    const customOptions = readVizTransferTemplates().map((item, index) => `<option value="${index + 1}" data-to="${escapeHtml(item.to || '')}" data-memo="${escapeHtml(item.memo || '')}" data-to-vesting="${item.transfer_to_vesting ? '1' : ''}">${escapeHtml(item.name)}</option>`).join('');
    return `<div class="field"><label for="wallet-viz-transfer-template">Шаблон перевода VIZ</label><select id="wallet-viz-transfer-template"><option value="">Выберите шаблон</option>${builtInOptions}${customOptions}</select> <button type="button" id="wallet-viz-template-remove" hidden>Удалить текущий шаблон</button></div>`;
  }

  function renderVizWalletForms(chain, profile) {
    const liquidMax = profile ? pickBalance(profile, chain.liquidSymbol) : '';
    const sharesMax = vizSharesMax(profile, 'vesting_shares');
    const delegatedMax = (() => {
      const raw = (profile && profile.raw) || {};
      const value = (Number.parseFloat(raw.vesting_shares) || 0) - (Number.parseFloat(raw.delegated_vesting_shares) || 0);
      return value > 0 ? `${value.toFixed(6)} SHARES` : '';
    })();
    const withdrawMax = (() => {
      const raw = (profile && profile.raw) || {};
      const pending = (Number.parseFloat(raw.vesting_withdraw_rate) || 0) * 28;
      const value = (Number.parseFloat(raw.vesting_shares) || 0) - (Number.parseFloat(raw.delegated_vesting_shares) || 0) - pending;
      return value > 0 ? `${value.toFixed(6)} SHARES` : '';
    })();
    const login = auth.getCurrentLogin(chain);
    const operations = [
      operationDetails('Перевод VIZ / VIZ в SHARES', `
        <form id="wallet-transfer-form" class="stacked-form">
          <fieldset>
            <legend>Перевод VIZ</legend>
            ${renderVizTransferTemplateSelect(login)}
            <div class="field"><label for="wallet-transfer-to">Кому</label><input id="wallet-transfer-to" name="to" type="text" required autocomplete="off"></div>
            <div class="field"><label for="wallet-transfer-amount">Сумма VIZ</label><input id="wallet-transfer-amount" name="amount" type="text" required placeholder="1.000 VIZ">${liquidMax ? ` <button type="button" data-fill-target="wallet-transfer-amount" data-fill-value="${escapeHtml(liquidMax)}">Максимум ${escapeHtml(liquidMax)}</button>` : ''}</div>
            <div class="field"><label for="wallet-transfer-memo">Memo / заметка</label><input id="wallet-transfer-memo" name="memo" type="text" placeholder="#... для encrypted memo"></div>
            <label class="inline-choice"><input id="wallet-viz-transfer-to-vesting" name="toVesting" type="checkbox"> Перевести в SHARES получателя</label>
            <button type="submit" name="intent" value="preview">Проверить перевод</button>
            <button type="submit" name="intent" value="send">Отправить перевод</button>
            <button type="button" id="wallet-viz-template-save">Создать шаблон перевода</button>
            <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
          </fieldset>
        </form>`, true),
      operationDetails('VIZ в SHARES этого аккаунта', `
        <form id="wallet-vesting-form" class="stacked-form">
          <fieldset>
            <legend>Перевод VIZ в SHARES</legend>
            <div class="field"><label for="wallet-vesting-amount">Количество VIZ</label><input id="wallet-vesting-amount" name="amount" type="text" required placeholder="1.000 VIZ">${liquidMax ? ` <button type="button" data-fill-target="wallet-vesting-amount" data-fill-value="${escapeHtml(liquidMax)}">Максимум ${escapeHtml(liquidMax)}</button>` : ''}</div>
            <button type="submit" name="intent" value="preview">Проверить перевод в SHARES</button>
            <button type="submit" name="intent" value="send">Отправить в SHARES</button>
            <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
          </fieldset>
        </form>`),
      operationDetails('Вывод SHARES в VIZ', `
        <form id="wallet-withdraw-vesting-form" class="stacked-form">
          <fieldset>
            <legend>Вывод SHARES</legend>
            <p class="muted">Если вывод уже запущен, новая операция изменит сумму вывода.</p>
            <div class="field"><label for="wallet-withdraw-vesting-amount">Сумма SHARES</label><input id="wallet-withdraw-vesting-amount" name="vesting" type="text" required placeholder="1.000000 SHARES">${withdrawMax ? ` <button type="button" data-fill-target="wallet-withdraw-vesting-amount" data-fill-value="${escapeHtml(withdrawMax)}">Максимум ${escapeHtml(withdrawMax)}</button>` : ''}</div>
            <button type="submit" name="intent" value="preview">Проверить вывод SHARES</button>
            <button type="submit" name="intent" value="send">Начать вывод</button>
            <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
          </fieldset>
        </form>
        <form id="wallet-viz-cancel-withdraw-form" class="stacked-form">
          <fieldset>
            <legend>Отмена вывода SHARES</legend>
            <button type="submit" name="intent" value="preview">Проверить отмену вывода</button>
            <button type="submit" name="intent" value="send">Отменить вывод</button>
            <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
          </fieldset>
        </form>`),
      operationDetails('Делегирование SHARES', `
        <form id="wallet-delegation-form" class="stacked-form">
          <fieldset>
            <legend>Делегирование SHARES</legend>
            <div class="field"><label for="wallet-delegation-to">Кому</label><input id="wallet-delegation-to" name="delegatee" type="text" required autocomplete="off"></div>
            <div class="field"><label for="wallet-delegation-vesting">Сумма SHARES</label><input id="wallet-delegation-vesting" name="vesting" type="text" required placeholder="1.000000 SHARES">${delegatedMax ? ` <button type="button" data-fill-target="wallet-delegation-vesting" data-fill-value="${escapeHtml(delegatedMax)}">Максимум ${escapeHtml(delegatedMax)}</button>` : ''}</div>
            <button type="submit" name="intent" value="preview">Проверить делегирование</button>
            <button type="submit" name="intent" value="send">Делегировать</button>
            <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
          </fieldset>
        </form>`),
      operationDetails('Инвайт-коды / пополнение VIZ', `
        <form id="wallet-viz-use-invite-form" class="stacked-form">
          <fieldset>
            <legend>Использовать invite code</legend>
            <p class="muted">Секрет invite используется только для этой операции. Не публикуйте его и не пересылайте другим людям.</p>
            <div class="field"><label for="wallet-viz-invite-secret">Инвайт-код / secret WIF</label><input id="wallet-viz-invite-secret" name="secret" type="password" required autocomplete="off" placeholder="5K..."></div>
            <div class="field"><label for="wallet-viz-invite-receiver">Получатель</label><input id="wallet-viz-invite-receiver" name="receiver" type="text" placeholder="пусто = текущий аккаунт"></div>
            <label class="inline-choice"><input name="toVesting" type="checkbox"> Перевести в SHARES; иначе в баланс VIZ</label>
            <button type="button" id="wallet-viz-invite-check">Проверить invite на ноде</button>
            <div id="wallet-viz-invite-check-result" class="operation-result" role="status" aria-live="polite"></div>
            <button type="submit" name="intent" value="preview">Проверить use/claim invite</button>
            <button type="submit" name="intent" value="send">Использовать invite</button>
            <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
          </fieldset>
        </form>
        <form id="wallet-viz-create-invite-form" class="stacked-form">
          <fieldset>
            <legend>Создать invite</legend>
            <div class="field"><label for="wallet-viz-create-invite-amount">Баланс invite</label><input id="wallet-viz-create-invite-amount" name="amount" type="text" required placeholder="1.000 VIZ">${liquidMax ? ` <button type="button" data-fill-target="wallet-viz-create-invite-amount" data-fill-value="${escapeHtml(liquidMax)}">Максимум ${escapeHtml(liquidMax)}</button>` : ''}</div>
            <div class="field"><label for="wallet-viz-create-invite-secret">Invite secret WIF</label><input id="wallet-viz-create-invite-secret" name="secret" type="text" required autocomplete="off" placeholder="нажмите Генерировать или вставьте WIF"></div>
            <button type="button" id="wallet-viz-generate-invite">Генерировать invite secret</button>
            <button type="button" data-copy-from="wallet-viz-create-invite-secret">Скопировать secret</button>
            <button type="submit" name="intent" value="preview">Проверить создание invite</button>
            <button type="submit" name="intent" value="send">Создать invite</button>
            <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
          </fieldset>
        </form>`),
      operationDetails('Голос за witness denis-skripnik', `
        <form id="wallet-viz-witness-vote-form" class="stacked-form">
          <fieldset>
            <legend>Witness vote</legend>
            <p class="muted">Голос за witness можно проверить перед отправкой.</p>
            <button type="submit" name="intent" value="preview">Проверить голос</button>
            <button type="submit" name="intent" value="send">Проголосовать</button>
            <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
          </fieldset>
        </form>`),

    ];

    return `
      <h3>Операции VIZ</h3>
      <p class="muted">Операции доступны через проверку и отдельное подтверждение отправки.</p>
      ${operations.join('')}`;
  }

  function renderHiveWalletForms(chain, profile) {
    const raw = profile && profile.raw || {};
    const liquidMax = pickBalance(profile, chain.liquidSymbol || 'HIVE');
    const hbdMax = pickBalance(profile, chain.debtSymbol || 'HBD');
    const ownHp = hiveHpAmount(profile, raw.vesting_shares);
    const delegatedHp = hiveHpAmount(profile, raw.delegated_vesting_shares);
    const withdrawRateHp = hiveHpAmount(profile, raw.vesting_withdraw_rate);
    const withdrawMax = ownHp ? `${Math.max(ownHp - delegatedHp - (withdrawRateHp * 13), 0).toFixed(6)} HP` : '';
    const delegationMax = ownHp ? `${Math.max(ownHp - delegatedHp, 0).toFixed(6)} HP` : '';
    const rewardHive = raw.reward_hive_balance || '0.000 HIVE';
    const rewardHbd = raw.reward_hbd_balance || '0.000 HBD';
    const rewardVests = raw.reward_vesting_balance || '0.000000 VESTS';
    const quickActions = [
      walletQuickActionButton('Перевести максимум HIVE', 'wallet-transfer-form', { 'wallet-transfer-amount': liquidMax }),
      walletQuickActionButton('Перевести максимум HBD', 'wallet-transfer-form', { 'wallet-transfer-amount': hbdMax }),
      walletQuickActionButton('В HP', 'wallet-vesting-form', { 'wallet-vesting-amount': liquidMax }),
      walletQuickActionButton('Вывести HP', 'wallet-withdraw-vesting-form', { 'wallet-withdraw-vesting-amount': withdrawMax }),
      walletQuickActionButton('Делегировать HP', 'wallet-delegation-form', { 'wallet-delegation-vesting': delegationMax }),
      walletQuickActionButton('В savings HIVE', 'wallet-savings-to-form', { 'wallet-savings-amount': liquidMax })
    ].join(' ');

    const operations = [
      operationDetails('Перевод HIVE/HBD', `
        <form id="wallet-transfer-form" class="stacked-form">
          <fieldset>
            <legend>Перевод HIVE/HBD</legend>
            ${renderHiveTransferTemplates(chain, profile)}
            <div class="field"><label for="wallet-transfer-to">Кому</label><input id="wallet-transfer-to" name="to" type="text" required autocomplete="off"></div>
            <div class="field"><label for="wallet-transfer-amount">Сумма</label><input id="wallet-transfer-amount" name="amount" type="text" required placeholder="1.000 HIVE">${liquidMax ? ` <button type="button" data-fill-target="wallet-transfer-amount" data-fill-value="${escapeHtml(liquidMax)}">Максимум ${escapeHtml(liquidMax)}</button>` : ''}${hbdMax ? ` <button type="button" data-fill-target="wallet-transfer-amount" data-fill-value="${escapeHtml(hbdMax)}">Максимум ${escapeHtml(hbdMax)}</button>` : ''}</div>
            <div class="field"><label for="wallet-transfer-memo">Memo</label><input id="wallet-transfer-memo" name="memo" type="text" placeholder="#... для encrypted memo"></div>
            <label class="inline-choice"><input id="wallet-hive-transfer-to-vesting" name="toVesting" type="checkbox"> Перевести HIVE в HP получателя</label>
            <button type="submit" name="intent" value="preview">Проверить перевод</button>
            <button type="submit" name="intent" value="send">Отправить перевод</button>
            <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
          </fieldset>
        </form>`, true),
      operationDetails('HIVE в HP этого аккаунта', `
        <form id="wallet-vesting-form" class="stacked-form">
          <fieldset>
            <legend>Перевод HIVE в HP</legend>
            <div class="field"><label for="wallet-vesting-amount">Количество HIVE</label><input id="wallet-vesting-amount" name="amount" type="text" required placeholder="1.000 HIVE">${liquidMax ? ` <button type="button" data-fill-target="wallet-vesting-amount" data-fill-value="${escapeHtml(liquidMax)}">Максимум ${escapeHtml(liquidMax)}</button>` : ''}</div>
            <button type="submit" name="intent" value="preview">Проверить перевод в HP</button>
            <button type="submit" name="intent" value="send">Отправить в HP</button>
            <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
          </fieldset>
        </form>`),
      operationDetails('Вывод HP в HIVE', `
        <form id="wallet-withdraw-vesting-form" class="stacked-form">
          <fieldset>
            <legend>Вывод HP</legend>
            <p class="muted">Если вывод уже запущен, новая операция изменит сумму вывода.</p>
            <div class="field"><label for="wallet-withdraw-vesting-amount">Сумма HP</label><input id="wallet-withdraw-vesting-amount" name="vesting" type="text" required placeholder="1.000000 HP">${withdrawMax ? ` <button type="button" data-fill-target="wallet-withdraw-vesting-amount" data-fill-value="${escapeHtml(withdrawMax)}">Максимум ${escapeHtml(withdrawMax)}</button>` : ''}</div>
            <button type="submit" name="intent" value="preview">Проверить вывод HP</button>
            <button type="submit" name="intent" value="send">Начать вывод</button>
            <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
          </fieldset>
        </form>
        <form id="wallet-hive-cancel-withdraw-form" class="stacked-form">
          <fieldset>
            <legend>Отмена вывода HP</legend>
            <button type="submit" name="intent" value="preview">Проверить отмену вывода</button>
            <button type="submit" name="intent" value="send">Отменить вывод</button>
            <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
          </fieldset>
        </form>`),
      operationDetails('Делегирование HP', `
        <form id="wallet-delegation-form" class="stacked-form">
          <fieldset>
            <legend>Делегирование HP</legend>
            <div class="field"><label for="wallet-delegation-to">Кому</label><input id="wallet-delegation-to" name="delegatee" type="text" required autocomplete="off"></div>
            <div class="field"><label for="wallet-delegation-vesting">Сумма HP</label><input id="wallet-delegation-vesting" name="vesting" type="text" required placeholder="1.000000 HP">${delegationMax ? ` <button type="button" data-fill-target="wallet-delegation-vesting" data-fill-value="${escapeHtml(delegationMax)}">Максимум ${escapeHtml(delegationMax)}</button>` : ''}</div>
            <button type="submit" name="intent" value="preview">Проверить делегирование</button>
            <button type="submit" name="intent" value="send">Делегировать</button>
            <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
          </fieldset>
        </form>`),
      operationDetails('Получение наград', `
        <form id="wallet-claim-form" class="stacked-form">
          <fieldset>
            <legend>Получение наград</legend>
            <p class="muted">Текущие награды: ${escapeHtml([rewardHive, rewardHbd, hiveVestsToHp(profile, rewardVests) || rewardVests].filter(Boolean).join(', '))}.</p>
            <input name="liquid" type="hidden" value="${escapeHtml(rewardHive)}">
            <input name="debt" type="hidden" value="${escapeHtml(rewardHbd)}">
            <input name="vesting" type="hidden" value="${escapeHtml(rewardVests)}">
            <button type="submit" name="intent" value="preview">Проверить получение наград</button>
            <button type="submit" name="intent" value="send">Получить награды</button>
            <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
          </fieldset>
        </form>`),
      operationDetails('Savings', `
        <form id="wallet-savings-to-form" class="stacked-form">
          <fieldset>
            <legend>Перевод в savings</legend>
            <div class="field"><label for="wallet-savings-to">Получатель savings</label><input id="wallet-savings-to" name="to" type="text" autocomplete="off" placeholder="пусто = текущий аккаунт"></div>
            <div class="field"><label for="wallet-savings-amount">Сумма HIVE/HBD</label><input id="wallet-savings-amount" name="amount" type="text" required placeholder="1.000 HIVE"></div>
            <div class="field"><label for="wallet-savings-memo">Memo</label><input id="wallet-savings-memo" name="memo" type="text"></div>
            <button type="submit" name="intent" value="preview">Проверить перевод в savings</button>
            <button type="submit" name="intent" value="send">Отправить в savings</button>
            <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
          </fieldset>
        </form>
        <form id="wallet-savings-from-form" class="stacked-form">
          <fieldset>
            <legend>Вывод из savings</legend>
            <div class="field"><label for="wallet-savings-request-id">ID запроса</label><input id="wallet-savings-request-id" name="requestId" type="number" min="0" step="1" required value="0"></div>
            <div class="field"><label for="wallet-savings-from-to">Получатель</label><input id="wallet-savings-from-to" name="to" type="text" autocomplete="off" placeholder="пусто = текущий аккаунт"></div>
            <div class="field"><label for="wallet-savings-from-amount">Сумма HIVE/HBD</label><input id="wallet-savings-from-amount" name="amount" type="text" required placeholder="1.000 HIVE"></div>
            <div class="field"><label for="wallet-savings-from-memo">Memo</label><input id="wallet-savings-from-memo" name="memo" type="text"></div>
            <button type="submit" name="intent" value="preview">Проверить вывод из savings</button>
            <button type="submit" name="intent" value="send">Вывести из savings</button>
            <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
          </fieldset>
        </form>
        <form id="wallet-savings-cancel-form" class="stacked-form">
          <fieldset>
            <legend>Отмена вывода из savings</legend>
            <div class="field"><label for="wallet-savings-cancel-request-id">ID запроса</label><input id="wallet-savings-cancel-request-id" name="requestId" type="number" min="0" step="1" required value="0"></div>
            <button type="submit" name="intent" value="preview">Проверить отмену вывода</button>
            <button type="submit" name="intent" value="send">Отменить вывод</button>
            <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
          </fieldset>
        </form>`)
    ];

    return `
      <h3>Операции Hive</h3>
      <p class="muted">Откройте нужный пункт, проверьте операцию, затем подтвердите отправку отдельной кнопкой.</p>
      <p class="quick-actions">${quickActions}</p>
      ${operations.join('')}`;
  }

  function hivePowerRateFromProfile(profile) {
    const raw = profile && profile.raw || {};
    const context = raw._v3ProfileContext || {};
    const props = context.dynamicProperties || {};
    const fund = Number.parseFloat(props.total_vesting_fund_hive) || 0;
    const totalVests = Number.parseFloat(props.total_vesting_shares) || 0;
    return fund && totalVests ? (1000000 * fund / totalVests) : 0;
  }

  function hiveVestsToHp(profile, value, digits) {
    const rate = hivePowerRateFromProfile(profile);
    const vests = Number.parseFloat(String(value || '')) || 0;
    if (!rate || !vests) return '';
    return `${(vests / 1000000 * rate).toFixed(digits === undefined ? 6 : digits)} HP`;
  }

  function hiveHpAmount(profile, value) {
    const rate = hivePowerRateFromProfile(profile);
    const vests = Number.parseFloat(String(value || '')) || 0;
    return rate && vests ? (vests / 1000000 * rate) : 0;
  }

  function normalizeHivePowerInput(profile, value, label) {
    const text = String(value || '').trim().replace(',', '.').replace(/\s*HP$/i, '');
    if (!/^\d+(?:\.\d{1,6})?$/.test(text) || Number(text) < 0) {
      throw new Error(`${label || 'HP'}: нужно неотрицательное число, например 1.000000.`);
    }
    const rate = hivePowerRateFromProfile(profile);
    if (!rate) throw new Error('Не удалось получить курс VESTS → HP для подготовки операции. Обновите кошелёк и попробуйте ещё раз.');
    const vests = Number(text) * 1000000 / rate;
    return `${vests.toFixed(6)} VESTS`;
  }

  function hiveDelegationRows(profile, delegations) {
    if (!Array.isArray(delegations) || delegations.length === 0) {
      return '<p class="muted">Активные исходящие делегирования HP не найдены.</p>';
    }
    const rows = delegations.map((item, index) => {
      const delegatee = item.delegatee || '';
      const amount = hiveVestsToHp(profile, item.vesting_shares) || item.vesting_shares || '';
      const minTime = item.min_delegation_time || '';
      return `<tr><td>@${escapeHtml(delegatee)}</td><td>${escapeHtml(amount)}</td><td>${escapeHtml(minTime)}</td><td><form id="wallet-hive-cancel-delegation-${index}" class="inline-form"><input type="hidden" name="delegatee" value="${escapeHtml(delegatee)}"><button type="submit" name="intent" value="preview">Проверить отмену</button> <button type="submit" name="intent" value="send">Отменить</button><div class="operation-result" data-operation-result role="status" aria-live="polite"></div></form></td></tr>`;
    }).join('');
    return `<div class="table-wrap"><table><thead><tr><th>Кому</th><th>Сумма</th><th>Мин. время возврата</th><th>Действие</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  function renderHiveWalletBalances(profile, delegations, delegationsError) {
    const raw = (profile && profile.raw) || {};
    const rows = [];
    const add = (label, value, note) => {
      if (value === undefined || value === null || value === '') return;
      rows.push([label, value, note || '']);
    };
    const ownHp = hiveHpAmount(profile, raw.vesting_shares);
    const delegatedHp = hiveHpAmount(profile, raw.delegated_vesting_shares);
    const receivedHp = hiveHpAmount(profile, raw.received_vesting_shares);
    const withdrawRateHp = hiveHpAmount(profile, raw.vesting_withdraw_rate);
    const effectiveHp = ownHp || delegatedHp || receivedHp ? `${(ownHp - delegatedHp + receivedHp).toFixed(6)} HP` : '';
    const fullWithdraw = withdrawRateHp ? `${(withdrawRateHp * 13).toFixed(6)} HP` : '';
    const rewardHp = raw.reward_vesting_hive ? `${Number.parseFloat(raw.reward_vesting_hive).toFixed(6)} HP` : hiveVestsToHp(profile, raw.reward_vesting_balance);

    add('HIVE', raw.balance);
    add('HBD', raw.hbd_balance);
    add('HP', hiveVestsToHp(profile, raw.vesting_shares) || raw.vesting_shares);
    add('Savings HIVE', raw.savings_balance);
    add('Savings HBD', raw.savings_hbd_balance);
    add('Делегировано HP', hiveVestsToHp(profile, raw.delegated_vesting_shares) || raw.delegated_vesting_shares);
    add('Получено делегированием HP', hiveVestsToHp(profile, raw.received_vesting_shares) || raw.received_vesting_shares);
    add('Эффективная доля HP', effectiveHp);
    add('Reward HIVE', raw.reward_hive_balance);
    add('Reward HBD', raw.reward_hbd_balance);
    add('Reward HP', rewardHp);
    add('Выводится по', withdrawRateHp ? `${withdrawRateHp.toFixed(6)} HP` : '', fullWithdraw ? `итого примерно: ${fullWithdraw}` : '');
    add('Следующий вывод', raw.next_vesting_withdrawal);

    return `
      <ul>${rows.map(([label, value, note]) => `<li><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}${note ? ` <span class="muted">${escapeHtml(note)}</span>` : ''}</li>`).join('') || '<li>Нет данных о балансах.</li>'}</ul>
      ${delegationsError ? `<p class="warning">Исходящие делегирования сейчас не загрузились: ${escapeHtml(delegationsError)}</p>` : ''}
      <h4>Исходящие делегирования HP</h4>
      ${hiveDelegationRows(profile, delegations)}`;
  }

  function renderHiveTransferTemplates(chain) {
    const login = auth.getCurrentLogin(chain);
    const builtIns = [{ id: 'self-hp', name: 'На свой аккаунт в HP', to: login || '', memo: '', toVesting: true }];
    const options = builtIns.map((item) => `<option value="${escapeHtml(item.id)}" data-builtin="1" data-to="${escapeHtml(item.to)}" data-memo="${escapeHtml(item.memo)}" data-to-vesting="${item.toVesting ? '1' : ''}">${escapeHtml(item.name)}</option>`).join('');
    return `<div class="field"><label for="wallet-hive-template-select">Шаблон</label><select id="wallet-hive-template-select" name="template"><option value="">Без шаблона</option>${options}</select></div>`;
  }

  function steemPowerRateFromProfile(profile) {
    const raw = profile && profile.raw || {};
    const context = raw._v3ProfileContext || {};
    const props = context.dynamicProperties || {};
    const fund = Number.parseFloat(props.total_vesting_fund_steem) || 0;
    const totalVests = Number.parseFloat(props.total_vesting_shares) || 0;
    return fund && totalVests ? (1000000 * fund / totalVests) : 0;
  }

  function steemVestsToSp(profile, value, digits) {
    const rate = steemPowerRateFromProfile(profile);
    const vests = Number.parseFloat(String(value || '')) || 0;
    if (!rate || !vests) return '';
    return `${(vests / 1000000 * rate).toFixed(digits === undefined ? 6 : digits)} SP`;
  }

  function steemSpAmount(profile, value) {
    const rate = steemPowerRateFromProfile(profile);
    const vests = Number.parseFloat(String(value || '')) || 0;
    return rate && vests ? (vests / 1000000 * rate) : 0;
  }

  function normalizeSteemPowerInput(profile, value, label) {
    const text = String(value || '').trim().replace(',', '.').replace(/\s*SP$/i, '');
    if (!/^\d+(?:\.\d{1,6})?$/.test(text) || Number(text) < 0) {
      throw new Error(`${label || 'SP'}: нужно неотрицательное число, например 1.000000.`);
    }
    const rate = steemPowerRateFromProfile(profile);
    if (!rate) throw new Error('Не удалось получить курс VESTS → SP для подготовки операции. Обновите кошелёк и попробуйте ещё раз.');
    const vests = Number(text) * 1000000 / rate;
    return `${vests.toFixed(6)} VESTS`;
  }


  function steemDelegationRows(profile, delegations) {
    if (!Array.isArray(delegations) || delegations.length === 0) {
      return '<p class="muted">Активные исходящие делегирования SP не найдены.</p>';
    }
    const rows = delegations.map((item, index) => {
      const delegatee = item.delegatee || '';
      const amount = steemVestsToSp(profile, item.vesting_shares) || item.vesting_shares || '';
      const minTime = item.min_delegation_time || '';
      return `<tr><td>@${escapeHtml(delegatee)}</td><td>${escapeHtml(amount)}</td><td>${escapeHtml(minTime)}</td><td><form id="wallet-steem-cancel-delegation-${index}" class="inline-form"><input type="hidden" name="delegatee" value="${escapeHtml(delegatee)}"><button type="submit" name="intent" value="preview">Проверить отмену</button> <button type="submit" name="intent" value="send">Отменить</button><div class="operation-result" data-operation-result role="status" aria-live="polite"></div></form></td></tr>`;
    }).join('');
    return `<div class="table-wrap"><table><thead><tr><th>Кому</th><th>Сумма</th><th>Мин. время возврата</th><th>Действие</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  function renderSteemWalletBalances(profile, delegations, delegationsError) {
    const raw = (profile && profile.raw) || {};
    const rows = [];
    const add = (label, value, note) => {
      if (value === undefined || value === null || value === '') return;
      rows.push([label, value, note || '']);
    };
    const ownSp = steemSpAmount(profile, raw.vesting_shares);
    const delegatedSp = steemSpAmount(profile, raw.delegated_vesting_shares);
    const receivedSp = steemSpAmount(profile, raw.received_vesting_shares);
    const withdrawRateSp = steemSpAmount(profile, raw.vesting_withdraw_rate);
    const effectiveSp = ownSp || delegatedSp || receivedSp ? `${(ownSp - delegatedSp + receivedSp).toFixed(6)} SP` : '';
    const fullWithdraw = withdrawRateSp ? `${(withdrawRateSp * 4).toFixed(6)} SP` : '';
    const rewardSp = raw.reward_vesting_steem ? `${Number.parseFloat(raw.reward_vesting_steem).toFixed(6)} SP` : steemVestsToSp(profile, raw.reward_vesting_balance);

    add('STEEM', raw.balance);
    add('SBD', raw.sbd_balance);
    add('SP', steemVestsToSp(profile, raw.vesting_shares) || raw.vesting_shares);
    add('Savings STEEM', raw.savings_balance);
    add('Savings SBD', raw.savings_sbd_balance);
    add('Делегировано SP', steemVestsToSp(profile, raw.delegated_vesting_shares) || raw.delegated_vesting_shares);
    add('Получено делегированием SP', steemVestsToSp(profile, raw.received_vesting_shares) || raw.received_vesting_shares);
    add('Эффективная доля SP', effectiveSp);
    add('Reward STEEM', raw.reward_steem_balance);
    add('Reward SBD', raw.reward_sbd_balance);
    add('Reward SP', rewardSp);
    add('Выводится по', withdrawRateSp ? `${withdrawRateSp.toFixed(6)} SP` : '', fullWithdraw ? `итого примерно: ${fullWithdraw}` : '');
    add('Следующий вывод', raw.next_vesting_withdrawal);

    return `
      <ul>${rows.map(([label, value, note]) => `<li><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}${note ? ` <span class="muted">${escapeHtml(note)}</span>` : ''}</li>`).join('') || '<li>Нет данных о балансах.</li>'}</ul>
      ${delegationsError ? `<p class="warning">Исходящие делегирования сейчас не загрузились: ${escapeHtml(delegationsError)}</p>` : ''}
      <h4>Исходящие делегирования SP</h4>
      ${steemDelegationRows(profile, delegations)}`;
  }

  function renderSteemTransferTemplates(chain, profile) {
    const login = auth.getCurrentLogin(chain);
    const builtIns = [{ id: 'self-sp', name: 'На свой аккаунт в SP', to: login || '', memo: '', toVesting: true }];
    const options = builtIns.map((item) => `<option value="${escapeHtml(item.id)}" data-builtin="1" data-to="${escapeHtml(item.to)}" data-memo="${escapeHtml(item.memo)}" data-to-vesting="${item.toVesting ? '1' : ''}">${escapeHtml(item.name)}</option>`).join('');
    return `<div class="field"><label for="wallet-steem-template-select">Шаблон</label><select id="wallet-steem-template-select" name="template"><option value="">Без шаблона</option>${options}</select></div>`;
  }

  function renderSteemWalletForms(chain, profile) {
    const raw = profile && profile.raw || {};
    const liquidMax = pickBalance(profile, chain.liquidSymbol || 'STEEM');
    const sbdMax = pickBalance(profile, chain.debtSymbol || 'SBD');
    const ownSp = steemSpAmount(profile, raw.vesting_shares);
    const delegatedSp = steemSpAmount(profile, raw.delegated_vesting_shares);
    const withdrawRateSp = steemSpAmount(profile, raw.vesting_withdraw_rate);
    const withdrawMax = ownSp ? `${Math.max(ownSp - delegatedSp - (withdrawRateSp * 4), 0).toFixed(6)} SP` : '';
    const delegationMax = ownSp ? `${Math.max(ownSp - delegatedSp, 0).toFixed(6)} SP` : '';
    const rewardSteem = raw.reward_steem_balance || '0.000 STEEM';
    const rewardSbd = raw.reward_sbd_balance || '0.000 SBD';
    const rewardVests = raw.reward_vesting_balance || '0.000000 VESTS';
    const quickActions = [
      walletQuickActionButton('Перевести максимум STEEM', 'wallet-transfer-form', { 'wallet-transfer-amount': liquidMax }),
      walletQuickActionButton('Перевести максимум SBD', 'wallet-transfer-form', { 'wallet-transfer-amount': sbdMax }),
      walletQuickActionButton('В SP', 'wallet-vesting-form', { 'wallet-vesting-amount': liquidMax }),
      walletQuickActionButton('Вывести SP', 'wallet-withdraw-vesting-form', { 'wallet-withdraw-vesting-amount': withdrawMax }),
      walletQuickActionButton('Делегировать SP', 'wallet-delegation-form', { 'wallet-delegation-vesting': delegationMax }),
      walletQuickActionButton('В savings STEEM', 'wallet-savings-to-form', { 'wallet-savings-amount': liquidMax })
    ].join(' ');

    const operations = [
      operationDetails('Перевод STEEM/SBD', `
        <form id="wallet-transfer-form" class="stacked-form">
          <fieldset>
            <legend>Перевод STEEM/SBD</legend>
            ${renderSteemTransferTemplates(chain, profile)}
            <div class="field"><label for="wallet-transfer-to">Кому</label><input id="wallet-transfer-to" name="to" type="text" required autocomplete="off"></div>
            <div class="field"><label for="wallet-transfer-amount">Сумма</label><input id="wallet-transfer-amount" name="amount" type="text" required placeholder="1.000 STEEM">${liquidMax ? ` <button type="button" data-fill-target="wallet-transfer-amount" data-fill-value="${escapeHtml(liquidMax)}">Максимум ${escapeHtml(liquidMax)}</button>` : ''}${sbdMax ? ` <button type="button" data-fill-target="wallet-transfer-amount" data-fill-value="${escapeHtml(sbdMax)}">Максимум ${escapeHtml(sbdMax)}</button>` : ''}</div>
            <div class="field"><label for="wallet-transfer-memo">Memo</label><input id="wallet-transfer-memo" name="memo" type="text" placeholder="#... для encrypted memo"></div>
            <label class="inline-choice"><input id="wallet-steem-transfer-to-vesting" name="toVesting" type="checkbox"> Перевести STEEM в SP получателя</label>
            <button type="submit" name="intent" value="preview">Проверить перевод</button>
            <button type="submit" name="intent" value="send">Отправить перевод</button>
            <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
          </fieldset>
        </form>`, true),
      operationDetails('STEEM в SP этого аккаунта', `
        <form id="wallet-vesting-form" class="stacked-form">
          <fieldset>
            <legend>Перевод STEEM в SP</legend>
            <div class="field"><label for="wallet-vesting-amount">Количество STEEM</label><input id="wallet-vesting-amount" name="amount" type="text" required placeholder="1.000 STEEM">${liquidMax ? ` <button type="button" data-fill-target="wallet-vesting-amount" data-fill-value="${escapeHtml(liquidMax)}">Максимум ${escapeHtml(liquidMax)}</button>` : ''}</div>
            <button type="submit" name="intent" value="preview">Проверить перевод в SP</button>
            <button type="submit" name="intent" value="send">Отправить в SP</button>
            <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
          </fieldset>
        </form>`),
      operationDetails('Вывод SP в STEEM', `
        <form id="wallet-withdraw-vesting-form" class="stacked-form">
          <fieldset>
            <legend>Вывод SP</legend>
            <p class="muted">Если вывод уже запущен, новая операция изменит сумму вывода.</p>
            <div class="field"><label for="wallet-withdraw-vesting-amount">Сумма SP</label><input id="wallet-withdraw-vesting-amount" name="vesting" type="text" required placeholder="1.000000 SP">${withdrawMax ? ` <button type="button" data-fill-target="wallet-withdraw-vesting-amount" data-fill-value="${escapeHtml(withdrawMax)}">Максимум ${escapeHtml(withdrawMax)}</button>` : ''}</div>
            <button type="submit" name="intent" value="preview">Проверить вывод SP</button>
            <button type="submit" name="intent" value="send">Начать вывод</button>
            <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
          </fieldset>
        </form>
        <form id="wallet-steem-cancel-withdraw-form" class="stacked-form">
          <fieldset>
            <legend>Отмена вывода SP</legend>
            <button type="submit" name="intent" value="preview">Проверить отмену вывода</button>
            <button type="submit" name="intent" value="send">Отменить вывод</button>
            <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
          </fieldset>
        </form>`),
      operationDetails('Делегирование SP', `
        <form id="wallet-delegation-form" class="stacked-form">
          <fieldset>
            <legend>Делегирование SP</legend>
            <div class="field"><label for="wallet-delegation-to">Кому</label><input id="wallet-delegation-to" name="delegatee" type="text" required autocomplete="off"></div>
            <div class="field"><label for="wallet-delegation-vesting">Сумма SP</label><input id="wallet-delegation-vesting" name="vesting" type="text" required placeholder="1.000000 SP">${delegationMax ? ` <button type="button" data-fill-target="wallet-delegation-vesting" data-fill-value="${escapeHtml(delegationMax)}">Максимум ${escapeHtml(delegationMax)}</button>` : ''}</div>
            <button type="submit" name="intent" value="preview">Проверить делегирование</button>
            <button type="submit" name="intent" value="send">Делегировать</button>
            <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
          </fieldset>
        </form>`),
      operationDetails('Получение наград', `
        <form id="wallet-claim-form" class="stacked-form">
          <fieldset>
            <legend>Получение наград</legend>
            <p class="muted">Текущие награды: ${escapeHtml([rewardSteem, rewardSbd, steemVestsToSp(profile, rewardVests) || rewardVests].filter(Boolean).join(', '))}.</p>
            <input name="liquid" type="hidden" value="${escapeHtml(rewardSteem)}">
            <input name="debt" type="hidden" value="${escapeHtml(rewardSbd)}">
            <input name="vesting" type="hidden" value="${escapeHtml(rewardVests)}">
            <button type="submit" name="intent" value="preview">Проверить получение наград</button>
            <button type="submit" name="intent" value="send">Получить награды</button>
            <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
          </fieldset>
        </form>`),
      operationDetails('Savings', `
        <form id="wallet-savings-to-form" class="stacked-form">
          <fieldset>
            <legend>Перевод в savings</legend>
            <div class="field"><label for="wallet-savings-to">Получатель savings</label><input id="wallet-savings-to" name="to" type="text" autocomplete="off" placeholder="пусто = текущий аккаунт"></div>
            <div class="field"><label for="wallet-savings-amount">Сумма STEEM/SBD</label><input id="wallet-savings-amount" name="amount" type="text" required placeholder="1.000 STEEM"></div>
            <div class="field"><label for="wallet-savings-memo">Memo</label><input id="wallet-savings-memo" name="memo" type="text"></div>
            <button type="submit" name="intent" value="preview">Проверить перевод в savings</button>
            <button type="submit" name="intent" value="send">Отправить в savings</button>
            <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
          </fieldset>
        </form>
        <form id="wallet-savings-from-form" class="stacked-form">
          <fieldset>
            <legend>Вывод из savings</legend>
            <div class="field"><label for="wallet-savings-request-id">ID запроса</label><input id="wallet-savings-request-id" name="requestId" type="number" min="0" step="1" required value="0"></div>
            <div class="field"><label for="wallet-savings-from-to">Получатель</label><input id="wallet-savings-from-to" name="to" type="text" autocomplete="off" placeholder="пусто = текущий аккаунт"></div>
            <div class="field"><label for="wallet-savings-from-amount">Сумма STEEM/SBD</label><input id="wallet-savings-from-amount" name="amount" type="text" required placeholder="1.000 STEEM"></div>
            <div class="field"><label for="wallet-savings-from-memo">Memo</label><input id="wallet-savings-from-memo" name="memo" type="text"></div>
            <button type="submit" name="intent" value="preview">Проверить вывод из savings</button>
            <button type="submit" name="intent" value="send">Вывести из savings</button>
            <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
          </fieldset>
        </form>
        <form id="wallet-savings-cancel-form" class="stacked-form">
          <fieldset>
            <legend>Отмена вывода из savings</legend>
            <div class="field"><label for="wallet-savings-cancel-request-id">ID запроса</label><input id="wallet-savings-cancel-request-id" name="requestId" type="number" min="0" step="1" required value="0"></div>
            <button type="submit" name="intent" value="preview">Проверить отмену вывода</button>
            <button type="submit" name="intent" value="send">Отменить вывод</button>
            <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
          </fieldset>
        </form>`)
    ];

    return `
      <h3>Операции Steem</h3>
      <p class="muted">Откройте нужный пункт, проверьте операцию, затем подтвердите отправку отдельной кнопкой.</p>
      <p class="quick-actions">${quickActions}</p>
      ${operations.join('')}`;
  }

  function bindGolosTemplateControls(chain) {
    document.querySelectorAll('[data-template-select]').forEach((select) => {
      const removeButton = document.querySelector(`[data-template-remove="${select.dataset.templateSelect}"][data-template-select-id="${select.id}"]`);
      select.addEventListener('change', () => {
        const option = select.selectedOptions && select.selectedOptions[0];
        if (!option || !option.value) {
          if (removeButton) removeButton.hidden = true;
          return;
        }
        const form = select.closest('form');
        if (!form) return;
        const to = form.querySelector('[name="to"]');
        const memo = form.querySelector('[name="memo"]');
        if (to) to.value = option.dataset.to || '';
        if (memo) memo.value = option.dataset.memo || '';
        const inSelect = form.querySelector('[name="in"]');
        if (inSelect && option.dataset.in) inSelect.value = option.dataset.in;
        if (removeButton) removeButton.hidden = option.dataset.builtin === '1';
      });
    });

    document.querySelectorAll('[data-template-save]').forEach((button) => {
      button.addEventListener('click', () => {
        const form = button.closest('form');
        if (!form) return;
        const kind = button.dataset.templateSave;
        const token = button.dataset.templateToken || 'GOLOS';
        const name = global.prompt ? global.prompt('Введите название шаблона') : '';
        if (!name) return;
        upsertGolosCustomTemplate(kind, token, {
          name: String(name).trim(),
          to: String((form.querySelector('[name="to"]') || {}).value || '').trim(),
          memo: String((form.querySelector('[name="memo"]') || {}).value || ''),
          in: String((form.querySelector('[name="in"]') || {}).value || '')
        });
        renderRoute();
      });
    });

    document.querySelectorAll('[data-template-remove]').forEach((button) => {
      button.addEventListener('click', () => {
        const select = document.getElementById(button.dataset.templateSelectId);
        const option = select && select.selectedOptions && select.selectedOptions[0];
        if (!option || option.dataset.builtin === '1') return;
        removeGolosCustomTemplate(button.dataset.templateRemove, button.dataset.templateToken || 'GOLOS', option.value);
        renderRoute();
      });
    });
  }

  function bindGolosGatewayControls(chain, uiaGateways) {
    const depositToken = document.getElementById('wallet-golos-uia-deposit-token');
    if (depositToken) {
      depositToken.addEventListener('change', () => {
        document.querySelectorAll('[data-uia-deposit-panel]').forEach((panel) => {
          panel.hidden = panel.dataset.uiaDepositPanel !== depositToken.value;
        });
      });
    }

    (uiaGateways || []).forEach((gateway) => {
      const deposit = gateway.deposit;
      if (!deposit || !deposit.to_transfer || !deposit.memo_transfer) return;
      bindOperationForm(chain, `wallet-golos-uia-deposit-transfer-${gateway.symbol}`, (form) => {
        const amount = '0.001 GOLOS';
        return broadcast.prepare(chain, 'active', 'transfer', [
          auth.getCurrentLogin(chain),
          normalizeAccountInput(chain, form.get('to'), 'Gateway account'),
          amount,
          String(form.get('memo') || '')
        ], { title: `Запрос deposit address ${gateway.symbol}`, to: form.get('to'), amount });
      });
    });

    const withdrawWay = document.getElementById('wallet-golos-uia-withdraw-way');
    const syncWithdrawFields = () => {
      if (!withdrawWay) return;
      const option = withdrawWay.selectedOptions && withdrawWay.selectedOptions[0];
      if (!option) return;
      const mainLabel = document.querySelector('[data-withdraw-main-label]');
      if (mainLabel) mainLabel.textContent = option.dataset.memoLabel || 'Данные для вывода';
      const postfixField = document.querySelector('[data-withdraw-postfix-field]');
      const postfixLabel = document.querySelector('[data-withdraw-postfix-label]');
      const postfixInput = document.getElementById('wallet-golos-uia-withdraw-postfix');
      const hasPostfix = Boolean(option.dataset.postfixLabel || option.dataset.postfixPlaceholder);
      if (postfixField) postfixField.hidden = !hasPostfix;
      if (postfixLabel) postfixLabel.textContent = option.dataset.postfixLabel || 'Дополнительно';
      if (postfixInput) postfixInput.placeholder = option.dataset.postfixPlaceholder || '';
    };
    if (withdrawWay) {
      withdrawWay.addEventListener('change', syncWithdrawFields);
      syncWithdrawFields();
    }

    bindOperationForm(chain, 'wallet-golos-uia-withdraw-form', async (form) => {
      const option = withdrawWay && withdrawWay.selectedOptions && withdrawWay.selectedOptions[0];
      if (!option) throw new Error('Выберите способ вывода UIA.');
      const token = normalizeGolosTokenSymbol(option.dataset.token, 'UIA withdraw token');
      const to = normalizeAccountInput(chain, option.dataset.account, 'Gateway account');
      const amount = await normalizeGolosTokenAmount(chain, form.get('amount'), token, 'Сумма UIA withdraw');
      const memo = buildGolosWithdrawMemo(option.dataset.prefix, form.get('main'), form.get('postfix'));
      return broadcast.prepare(chain, 'active', 'transfer', [
        auth.getCurrentLogin(chain),
        to,
        amount,
        memo
      ], { title: `UIA withdraw ${token}`, to, amount, memo });
    });
  }

  function bindGolosWalletForms(chain, profile, uiaGateways, delegations) {
    bindGolosTemplateControls(chain);
    bindGolosGatewayControls(chain, uiaGateways);

    const generateInvite = document.getElementById('wallet-golos-generate-invite');
    if (generateInvite) {
      generateInvite.addEventListener('click', async () => {
        try {
          await loadScript(chain.libraryPath);
          const input = document.getElementById('wallet-golos-create-invite-secret');
          if (input) input.value = generateGolosInviteSecret();
        } catch (error) {
          setStatus(profiles.formatError(error), 'error');
        }
      });
    }

    document.querySelectorAll('[data-golos-cancel-delegation]').forEach((button) => {
      button.addEventListener('click', () => {
        const delegatee = button.dataset.golosCancelDelegation || '';
        const toInput = document.getElementById('wallet-delegation-to');
        const amountInput = document.getElementById('wallet-delegation-vesting');
        const interestInput = document.getElementById('wallet-golos-delegation-interest');
        const details = amountInput && amountInput.closest('details');
        if (details) details.open = true;
        if (toInput) toInput.value = delegatee;
        if (amountInput) amountInput.value = '0.000000 СГ';
        if (interestInput) interestInput.value = '0';
        if (toInput) toInput.focus();
        setStatus(`Для отмены делегирования @${delegatee} проверьте и отправьте форму «Делегирование СГ» с 0.000000 СГ.`, 'info');
      });
    });

    bindOperationForm(chain, 'wallet-transfer-form', async (form) => {
      const from = auth.getCurrentLogin(chain);
      const to = normalizeAccountInput(chain, form.get('to'), 'Кому');
      const amount = normalizeAssetInput(chain, form.get('amount'), [chain.liquidSymbol, chain.debtSymbol].filter(Boolean), 'Сумма перевода');
      const memo = String(form.get('memo') || '');
      const destination = String(form.get('in') || 'to_balance');
      if (destination === 'to_tip') {
        const prepared = broadcast.prepare(chain, 'active', 'transferToTip', [from, to, amount, memo, []], { title: 'Golos transfer_to_tip', to, amount });
        prepared.params[3] = await encodeGolosMemoIfNeeded(chain, to, memo, prepared.getPrivateKey());
        return prepared;
      }
      if (destination === 'to_vesting') {
        const vestingAmount = normalizeAssetInput(chain, form.get('amount'), chain.liquidSymbol, 'Сумма GOLOS в СГ');
        return broadcast.prepare(chain, 'active', 'transferToVesting', [from, to, vestingAmount], { title: 'GOLOS в СГ', to, amount: vestingAmount });
      }
      return broadcast.prepare(chain, 'active', 'transfer', [from, to, amount, memo], { title: 'Golos transfer', to, amount });
    });

    bindOperationForm(chain, 'wallet-vesting-form', (form) => {
      const from = auth.getCurrentLogin(chain);
      const rawTo = String(form.get('to') || '').trim().replace(/^@/, '');
      const to = rawTo ? normalizeAccountInput(chain, rawTo, 'Получатель СГ') : from;
      const amount = normalizeAssetInput(chain, form.get('amount'), chain.liquidSymbol, 'Сумма GOLOS в СГ');
      return broadcast.prepare(chain, 'active', 'transferToVesting', [from, to, amount], { title: 'GOLOS в СГ', to, amount });
    });

    bindOperationForm(chain, 'wallet-withdraw-vesting-form', (form) => {
      const amount = normalizeGolosPowerInput(profile, form.get('vesting'), 'Сумма СГ');
      return broadcast.prepare(chain, 'active', 'withdrawVesting', [
        auth.getCurrentLogin(chain),
        amount
      ], { title: 'Вывод СГ', amount });
    });

    bindOperationForm(chain, 'wallet-golos-cancel-withdraw-form', () => broadcast.prepare(chain, 'active', 'withdrawVesting', [
      auth.getCurrentLogin(chain),
      '0.000000 GESTS'
    ], { title: 'Отмена вывода СГ', amount: '0.000000 GESTS' }));

    bindOperationForm(chain, 'wallet-delegation-form', (form) => {
      const to = normalizeAccountInput(chain, form.get('delegatee'), 'Кому делегировать');
      const amount = normalizeGolosPowerInput(profile, form.get('vesting'), 'Сумма СГ');
      const interestPercent = Number(form.get('interest'));
      if (!Number.isFinite(interestPercent) || interestPercent < 0 || interestPercent > 80) {
        throw new Error('Процент с кураторских должен быть от 0 до 80.');
      }
      const interestRate = Math.trunc(interestPercent * 100);
      const alreadyDelegated = Boolean(delegations && Array.isArray(delegations.delegated) && delegations.delegated.some((item) => item && item.delegatee === to));
      const method = alreadyDelegated ? 'delegateVestingShares' : 'delegateVestingSharesWithInterest';
      const params = method === 'delegateVestingShares'
        ? [auth.getCurrentLogin(chain), to, amount]
        : [auth.getCurrentLogin(chain), to, amount, interestRate, []];
      return broadcast.prepare(chain, 'active', method, params, { title: method === 'delegateVestingShares' ? 'Делегирование СГ' : 'Делегирование СГ с процентом', to, amount });
    });

    bindOperationForm(chain, 'wallet-golos-claim-form', (form) => {
      const account = auth.getCurrentLogin(chain);
      const rawTo = String(form.get('to') || '').trim().replace(/^@/, '');
      const to = rawTo ? normalizeAccountInput(chain, rawTo, 'Кому получить начисления') : account;
      const amount = normalizeAssetInput(chain, form.get('amount'), chain.liquidSymbol, 'Сумма claim');
      const toVesting = form.get('toVesting') === 'on';
      return broadcast.prepare(chain, 'posting', 'claim', [account, to, amount, toVesting, []], {
        title: 'Claim accumulative balance',
        to,
        amount,
        warnings: toVesting ? ['Начисления будут получены в СГ.'] : []
      });
    });

    bindOperationForm(chain, 'wallet-golos-donate-form', async (form) => {
      const to = normalizeAccountInput(chain, form.get('to'), 'Кому донат');
      const amount = normalizeAssetInput(chain, form.get('amount'), chain.liquidSymbol, 'Сумма доната');
      let memo = String(form.get('memo') || '');
      if (memo[0] === '#') {
        memo = await encodeGolosMemoIfNeeded(chain, to, memo, broadcast.prepare(chain, 'active', 'transfer', [auth.getCurrentLogin(chain), to, amount, ''], {}).getPrivateKey());
      }
      return broadcast.prepare(chain, 'posting', 'donate', [
        auth.getCurrentLogin(chain),
        to,
        amount,
        { app: 'dpos-space', version: 1, comment: memo, target: { type: 'personal_donate' } },
        []
      ], { title: 'Golos donate', to, amount });
    });

    bindOperationForm(chain, 'wallet-golos-uia-transfer-form', async (form) => {
      const token = normalizeGolosTokenSymbol(form.get('token'), 'Токен UIA transfer');
      const to = normalizeAccountInput(chain, form.get('to'), 'Кому UIA transfer');
      const amount = await normalizeGolosTokenAmount(chain, form.get('amount'), token, 'Сумма UIA transfer');
      return broadcast.prepare(chain, 'active', 'transfer', [
        auth.getCurrentLogin(chain),
        to,
        amount,
        String(form.get('memo') || '')
      ], { title: 'Golos UIA transfer', to, amount });
    });

    bindOperationForm(chain, 'wallet-golos-transfer-to-tip-form', async (form) => {
      const token = normalizeGolosTokenSymbol(form.get('token'), 'Токен transfer_to_tip');
      await assertGolosTipTransferAllowed(chain, token);
      const to = normalizeAccountInput(chain, form.get('to'), 'Кому transfer_to_tip');
      const amount = await normalizeGolosTokenAmount(chain, form.get('amount'), token, 'Сумма transfer_to_tip');
      const prepared = broadcast.prepare(chain, 'active', 'transferToTip', [
        auth.getCurrentLogin(chain),
        to,
        amount,
        String(form.get('memo') || ''),
        []
      ], { title: 'Golos transfer_to_tip', to, amount });
      prepared.params[3] = await encodeGolosMemoIfNeeded(chain, to, form.get('memo'), prepared.getPrivateKey());
      return prepared;
    });

    bindOperationForm(chain, 'wallet-golos-transfer-from-tip-form', async (form) => {
      const token = normalizeGolosTokenSymbol(form.get('token'), 'Токен transfer_from_tip');
      const to = normalizeAccountInput(chain, form.get('to'), 'Кому transfer_from_tip');
      const amount = await normalizeGolosTokenAmount(chain, form.get('amount'), token, 'Сумма transfer_from_tip');
      return broadcast.prepare(chain, 'active', 'transferFromTip', [
        auth.getCurrentLogin(chain),
        to,
        amount,
        String(form.get('memo') || ''),
        []
      ], { title: 'Golos transfer_from_tip', to, amount });
    });

    bindOperationForm(chain, 'wallet-golos-token-donate-form', async (form) => {
      const token = normalizeGolosTokenSymbol(form.get('token'), 'Токен donate');
      const to = normalizeAccountInput(chain, form.get('to'), 'Кому donate');
      const amount = await normalizeGolosTokenAmount(chain, form.get('amount'), token, 'Сумма donate');
      let memo = String(form.get('memo') || '');
      if (memo[0] === '#') {
        memo = await encodeGolosMemoIfNeeded(chain, to, memo, broadcast.prepare(chain, 'active', 'transfer', [auth.getCurrentLogin(chain), to, amount, ''], {}).getPrivateKey());
      }
      return broadcast.prepare(chain, 'posting', 'donate', [
        auth.getCurrentLogin(chain),
        to,
        amount,
        { app: 'dpos-space', version: 1, comment: memo, target: { type: 'personal_donate' } },
        []
      ], { title: 'Golos UIA/TIP donate', to, amount });
    });

    bindOperationForm(chain, 'wallet-golos-invite-claim-form', (form) => broadcast.prepare(chain, 'active', 'inviteClaim', [
      auth.getCurrentLogin(chain),
      auth.getCurrentLogin(chain),
      String(form.get('secret') || '').trim(),
      []
    ], { title: 'Golos invite claim', warnings: ['Invite secret нужен в параметрах операции, но preview/result маскирует secret/WIF. Не публикуйте данные операции.'] }));

    bindOperationForm(chain, 'wallet-golos-create-invite-form', async (form) => {
      await loadScript(chain.libraryPath);
      const amount = normalizeAssetInput(chain, form.get('amount'), chain.liquidSymbol, 'Баланс invite');
      const publicKey = golosInvitePublic(form.get('secret'));
      return broadcast.prepare(chain, 'active', 'invite', [auth.getCurrentLogin(chain), amount, publicKey, []], {
        title: 'Golos invite create',
        amount,
        warnings: ['Secret invite не входит в транзакцию и не сохраняется; сохраните его отдельно, иначе invite будет невозможно использовать.']
      });
    });

    bindOperationForm(chain, 'wallet-golos-witness-vote-form', () => broadcast.prepare(chain, 'active', 'accountWitnessVote', [
      auth.getCurrentLogin(chain),
      'denis-skripnik',
      true
    ], { title: 'Witness vote denis-skripnik', to: 'denis-skripnik' }));
  }

  function bindVizWalletForms(chain, profile) {
    const bindVizTemplateControls = () => {
      const select = document.getElementById('wallet-viz-transfer-template');
      const remove = document.getElementById('wallet-viz-template-remove');
      if (select) {
        select.addEventListener('change', () => {
          const option = select.selectedOptions && select.selectedOptions[0];
          const form = select.closest('form');
          if (!option || !option.value || !form) {
            if (remove) remove.hidden = true;
            return;
          }
          const to = form.querySelector('[name="to"]');
          const memo = form.querySelector('[name="memo"]');
          const toVesting = form.querySelector('[name="toVesting"]');
          if (to) to.value = option.dataset.to || '';
          if (memo) memo.value = option.dataset.memo || '';
          if (toVesting) toVesting.checked = option.dataset.toVesting === '1';
          if (remove) remove.hidden = option.dataset.builtin === '1';
        });
      }
      const save = document.getElementById('wallet-viz-template-save');
      if (save) {
        save.addEventListener('click', () => {
          const form = save.closest('form');
          const name = global.prompt ? global.prompt('Введите название шаблона') : '';
          if (!form || !name) return;
          const templates = readVizTransferTemplates();
          const item = {
            name: String(name).trim(),
            to: String((form.querySelector('[name="to"]') || {}).value || '').trim(),
            memo: String((form.querySelector('[name="memo"]') || {}).value || ''),
            transfer_to_vesting: Boolean((form.querySelector('[name="toVesting"]') || {}).checked)
          };
          const index = templates.findIndex((template) => template.name === item.name);
          if (index >= 0) templates[index] = item;
          else templates.push(item);
          writeVizTransferTemplates(templates);
          renderRoute();
        });
      }
      if (remove) {
        remove.addEventListener('click', () => {
          if (!select) return;
          const option = select.selectedOptions && select.selectedOptions[0];
          if (!option || option.dataset.builtin === '1') return;
          const templates = readVizTransferTemplates();
          const index = Number(option.value) - 1;
          if (index >= 0 && index < templates.length) templates.splice(index, 1);
          writeVizTransferTemplates(templates);
          renderRoute();
        });
      }
    };

    bindVizTemplateControls();
    prefillVizTransferFromUrl();

    document.querySelectorAll('[data-copy-from]').forEach((button) => {
      button.addEventListener('click', async () => {
        const input = document.getElementById(button.dataset.copyFrom);
        const value = input && input.value ? input.value : '';
        if (!value) return;
        try {
          if (global.navigator && global.navigator.clipboard) await global.navigator.clipboard.writeText(value);
          button.textContent = 'Скопировано';
          global.setTimeout(() => { button.textContent = 'Скопировать secret'; }, 2000);
        } catch (_error) {
          button.textContent = 'Не удалось скопировать';
        }
      });
    });

    const generateInvite = document.getElementById('wallet-viz-generate-invite');
    if (generateInvite) {
      generateInvite.addEventListener('click', async () => {
        try {
          await loadScript(chain.libraryPath);
          const input = document.getElementById('wallet-viz-create-invite-secret');
          if (input) input.value = generateVizInviteSecret();
        } catch (error) {
          setStatus(profiles.formatError(error), 'error');
        }
      });
    }

    const inviteCheck = document.getElementById('wallet-viz-invite-check');
    if (inviteCheck) {
      inviteCheck.addEventListener('click', async () => {
        const result = document.getElementById('wallet-viz-invite-check-result');
        if (result) result.textContent = 'Проверяю invite...';
        try {
          await loadScript(chain.libraryPath);
          const secret = document.getElementById('wallet-viz-invite-secret');
          const publicKey = vizInvitePublic(secret && secret.value);
          const connection = await profiles.connect(chain);
          const api = connection.client && connection.client.api;
          if (!api || typeof api.getInviteByKey !== 'function') throw new Error('viz.api.getInviteByKey недоступен.');
          const info = await new Promise((resolve, reject) => api.getInviteByKey(publicKey, (error, data) => error ? reject(error) : resolve(data)));
          if (result) result.textContent = info && info.receiver ? `Invite уже получил @${info.receiver}. Баланс: ${info.balance || 'n/a'}.` : `Invite доступен. Баланс: ${(info && info.balance) || 'n/a'}, creator: ${(info && info.creator) || 'n/a'}.`;
        } catch (error) {
          if (result) result.textContent = `Не удалось проверить invite: ${profiles.formatError(error)}`;
        }
      });
    }

    document.querySelectorAll('[data-viz-cancel-delegation]').forEach((button) => {
      button.addEventListener('click', () => {
        const delegatee = button.dataset.vizCancelDelegation || '';
        const toInput = document.getElementById('wallet-delegation-to');
        const amountInput = document.getElementById('wallet-delegation-vesting');
        const details = amountInput && amountInput.closest('details');
        if (details) details.open = true;
        if (toInput) toInput.value = delegatee;
        if (amountInput) amountInput.value = '0.000000 SHARES';
        if (toInput) toInput.focus();
        setStatus(`Для отмены делегирования @${delegatee} проверьте и отправьте форму «Делегирование SHARES» с 0.000000 SHARES.`, 'info');
      });
    });

    bindOperationForm(chain, 'wallet-transfer-form', async (form) => {
      const from = auth.getCurrentLogin(chain);
      const to = normalizeAccountInput(chain, form.get('to'), 'Кому');
      const amount = normalizeAssetInput(chain, form.get('amount'), chain.liquidSymbol, 'Сумма VIZ');
      if (form.get('toVesting') === 'on') {
        return broadcast.prepare(chain, 'active', 'transferToVesting', [from, to, amount], { title: 'VIZ в SHARES получателя', to, amount });
      }
      const rawMemo = String(form.get('memo') || '');
      if (isSteemMemoWif(chain, rawMemo)) {
        throw new Error('Memo похоже на приватный ключ. Проверьте поле memo: приватные ключи нельзя отправлять в блокчейн.');
      }
      const prepared = broadcast.prepare(chain, 'active', 'transfer', [from, to, amount, rawMemo], { title: 'VIZ transfer', to, amount });
      if (!(prepared.meta && prepared.meta.signerType === 'vizonator')) {
        prepared.params[3] = await encodeVizMemoIfNeeded(chain, to, rawMemo, prepared.getPrivateKey());
      } else if (rawMemo.startsWith('#')) {
        prepared.meta.warnings.push('Для Vizonator memo с # передаётся в расширение как есть. Если нужно шифрование, проверьте поведение расширения перед отправкой.');
      }
      return prepared;
    });

    bindOperationForm(chain, 'wallet-vesting-form', (form) => {
      const from = auth.getCurrentLogin(chain);
      const amount = normalizeAssetInput(chain, form.get('amount'), chain.liquidSymbol, 'Количество VIZ');
      return broadcast.prepare(chain, 'active', 'transferToVesting', [from, from, amount], { title: 'VIZ в SHARES своего аккаунта', to: from, amount });
    });

    bindOperationForm(chain, 'wallet-withdraw-vesting-form', (form) => {
      const amount = normalizeAssetInput(chain, form.get('vesting'), chain.vestingSymbol, 'Сумма SHARES');
      return broadcast.prepare(chain, 'active', 'withdrawVesting', [auth.getCurrentLogin(chain), amount], { title: 'Вывод SHARES', amount });
    });

    bindOperationForm(chain, 'wallet-viz-cancel-withdraw-form', () => broadcast.prepare(chain, 'active', 'withdrawVesting', [
      auth.getCurrentLogin(chain),
      '0.000000 SHARES'
    ], { title: 'Отмена вывода SHARES', amount: '0.000000 SHARES' }));

    bindOperationForm(chain, 'wallet-delegation-form', (form) => {
      const to = normalizeAccountInput(chain, form.get('delegatee'), 'Кому делегировать');
      const amount = normalizeAssetInput(chain, form.get('vesting'), chain.vestingSymbol, 'Сумма SHARES');
      return broadcast.prepare(chain, 'active', 'delegateVestingShares', [auth.getCurrentLogin(chain), to, amount], { title: 'Делегирование SHARES', to, amount });
    });

    bindOperationForm(chain, 'wallet-viz-use-invite-form', (form) => {
      const account = auth.getCurrentLogin(chain);
      const rawReceiver = String(form.get('receiver') || '').trim().replace(/^@/, '');
      const receiver = rawReceiver ? normalizeAccountInput(chain, rawReceiver, 'Получатель invite') : account;
      const method = form.get('toVesting') === 'on' ? 'useInviteBalance' : 'claimInviteBalance';
      return broadcast.prepare(chain, 'active', method, [account, receiver, String(form.get('secret') || '').trim()], {
        title: method,
        to: receiver,
        warnings: ['Invite secret нужен в параметрах операции, но не сохраняется в localStorage. Не публикуйте preview/result.']
      });
    });

    bindOperationForm(chain, 'wallet-viz-create-invite-form', async (form) => {
      await loadScript(chain.libraryPath);
      const amount = normalizeAssetInput(chain, form.get('amount'), chain.liquidSymbol, 'Баланс invite');
      const inviteKey = vizInvitePublic(form.get('secret'));
      return broadcast.prepare(chain, 'active', 'createInvite', [auth.getCurrentLogin(chain), amount, inviteKey], { title: 'Создание invite', amount });
    });

    bindOperationForm(chain, 'wallet-viz-witness-vote-form', () => broadcast.prepare(chain, 'active', 'accountWitnessVote', [
      auth.getCurrentLogin(chain),
      'denis-skripnik',
      true
    ], { title: 'Witness vote denis-skripnik', to: 'denis-skripnik' }));
  }

  function prefillVizTransferFromUrl() {
    const form = document.getElementById('wallet-transfer-form');
    if (!form) return;
    const params = new URLSearchParams(global.location && global.location.search || '');
    const hashParams = new URLSearchParams(global.location && global.location.hash && global.location.hash.includes('?') ? global.location.hash.split('?').slice(1).join('?') : '');
    const get = (name) => params.get(name) || hashParams.get(name) || '';
    const to = get('to');
    const amount = get('amount');
    const memo = get('memo');
    if (to) {
      const input = form.querySelector('[name="to"]');
      if (input) input.value = to.replace(/^@/, '');
    }
    if (amount) {
      const input = form.querySelector('[name="amount"]');
      if (input) input.value = amount;
    }
    if (memo) {
      const input = form.querySelector('[name="memo"]');
      if (input) input.value = decodeURIComponent(memo);
    }
  }

  function bindHiveWalletForms(chain, profile) {
    bindHiveTransferTemplates();
    prefillHiveTransferFromUrl();

    bindOperationForm(chain, 'wallet-transfer-form', async (form) => {
      const from = auth.getCurrentLogin(chain);
      const to = normalizeAccountInput(chain, form.get('to'), 'Кому');
      const amount = normalizeAssetInput(chain, form.get('amount'), [chain.liquidSymbol, chain.debtSymbol].filter(Boolean), 'Сумма перевода');
      if (form.get('toVesting')) {
        const hiveAmount = normalizeAssetInput(chain, form.get('amount'), chain.liquidSymbol, 'Сумма перевода в HP');
        return broadcast.prepare(chain, 'active', 'transferToVesting', [from, to, hiveAmount], { title: 'HIVE в HP получателя', to, amount: hiveAmount });
      }
      const rawMemo = String(form.get('memo') || '');
      if (isSteemMemoWif(chain, rawMemo)) {
        throw new Error('Memo похоже на приватный ключ. Проверьте поле memo: приватные ключи нельзя отправлять в блокчейн.');
      }
      const prepared = broadcast.prepare(chain, 'active', 'transfer', [from, to, amount, rawMemo], { title: 'Hive transfer', to, amount });
      prepared.params[3] = await encodeHiveMemoIfNeeded(chain, to, rawMemo, prepared.getPrivateKey());
      return prepared;
    });

    bindOperationForm(chain, 'wallet-vesting-form', (form) => {
      const from = auth.getCurrentLogin(chain);
      const amount = normalizeAssetInput(chain, form.get('amount'), chain.liquidSymbol, 'Количество HIVE');
      return broadcast.prepare(chain, 'active', 'transferToVesting', [from, from, amount], { title: 'HIVE в HP своего аккаунта', to: from, amount });
    });

    bindOperationForm(chain, 'wallet-withdraw-vesting-form', (form) => {
      const amount = normalizeHivePowerInput(profile, form.get('vesting'), 'Сумма HP');
      return broadcast.prepare(chain, 'active', 'withdrawVesting', [auth.getCurrentLogin(chain), amount], { title: 'Вывод HP', amount });
    });

    bindOperationForm(chain, 'wallet-hive-cancel-withdraw-form', () => broadcast.prepare(chain, 'active', 'withdrawVesting', [
      auth.getCurrentLogin(chain),
      '0.000000 VESTS'
    ], { title: 'Отмена вывода HP', amount: '0.000000 VESTS' }));

    bindOperationForm(chain, 'wallet-delegation-form', (form) => {
      const to = normalizeAccountInput(chain, form.get('delegatee'), 'Кому');
      const amount = normalizeHivePowerInput(profile, form.get('vesting'), 'Сумма HP');
      return broadcast.prepare(chain, 'active', 'delegateVestingShares', [auth.getCurrentLogin(chain), to, amount], { title: 'Делегирование HP', to, amount });
    });

    document.querySelectorAll('form[id^="wallet-hive-cancel-delegation-"]').forEach((formEl) => {
      bindOperationForm(chain, formEl.id, (form) => {
        const to = normalizeAccountInput(chain, form.get('delegatee'), 'Кому');
        return broadcast.prepare(chain, 'active', 'delegateVestingShares', [auth.getCurrentLogin(chain), to, '0.000000 VESTS'], { title: 'Отмена делегирования HP', to, amount: '0.000000 VESTS' });
      });
    });

    bindOperationForm(chain, 'wallet-claim-form', (form) => broadcast.prepare(chain, 'posting', 'claimRewardBalance', [
      auth.getCurrentLogin(chain),
      normalizeAssetInput(chain, form.get('liquid'), chain.liquidSymbol, 'Reward HIVE'),
      normalizeAssetInput(chain, form.get('debt'), chain.debtSymbol, 'Reward HBD'),
      normalizeAssetInput(chain, form.get('vesting'), chain.vestingSymbol, 'Reward VESTS')
    ], { title: 'Получение наград Hive' }));

    bindOperationForm(chain, 'wallet-savings-to-form', (form) => {
      const from = auth.getCurrentLogin(chain);
      const rawTo = String(form.get('to') || '').trim().replace(/^@/, '');
      const to = rawTo ? normalizeAccountInput(chain, rawTo, 'Получатель savings') : from;
      const amount = normalizeAssetInput(chain, form.get('amount'), [chain.liquidSymbol, chain.debtSymbol].filter(Boolean), 'Сумма savings');
      return broadcast.prepare(chain, 'active', 'transferToSavings', [from, to, amount, String(form.get('memo') || '')], { title: 'Transfer to savings', to, amount });
    });

    bindOperationForm(chain, 'wallet-savings-from-form', (form) => {
      const from = auth.getCurrentLogin(chain);
      const rawTo = String(form.get('to') || '').trim().replace(/^@/, '');
      const to = rawTo ? normalizeAccountInput(chain, rawTo, 'Получатель savings') : from;
      const requestId = broadcast.validateRequestId(form.get('requestId'));
      const amount = normalizeAssetInput(chain, form.get('amount'), [chain.liquidSymbol, chain.debtSymbol].filter(Boolean), 'Сумма savings');
      return broadcast.prepare(chain, 'active', 'transferFromSavings', [from, requestId, to, amount, String(form.get('memo') || '')], { title: 'Transfer from savings', to, amount, requestId });
    });

    bindOperationForm(chain, 'wallet-savings-cancel-form', (form) => broadcast.prepare(chain, 'active', 'cancelTransferFromSavings', [
      auth.getCurrentLogin(chain),
      broadcast.validateRequestId(form.get('requestId'))
    ], { title: 'Cancel transfer from savings', requestId: broadcast.validateRequestId(form.get('requestId')) }));
  }

  function bindHiveTransferTemplates() {
    const select = document.getElementById('wallet-hive-template-select');
    if (!select) return;
    select.addEventListener('change', () => {
      const option = select.selectedOptions && select.selectedOptions[0];
      if (!option || !option.value) return;
      const form = select.closest('form');
      if (!form) return;
      const to = form.querySelector('[name="to"]');
      const memo = form.querySelector('[name="memo"]');
      const toVesting = form.querySelector('[name="toVesting"]');
      if (to) to.value = option.dataset.to || '';
      if (memo) memo.value = option.dataset.memo || '';
      if (toVesting) toVesting.checked = option.dataset.toVesting === '1';
    });
  }

  function prefillHiveTransferFromUrl() {
    const form = document.getElementById('wallet-transfer-form');
    if (!form) return;
    const params = new URLSearchParams(global.location && global.location.search || '');
    const hashParams = new URLSearchParams(global.location && global.location.hash && global.location.hash.includes('?') ? global.location.hash.split('?').slice(1).join('?') : '');
    const get = (name) => params.get(name) || hashParams.get(name) || '';
    const to = get('to');
    const amount = get('amount');
    const memo = get('memo');
    if (to) {
      const input = form.querySelector('[name="to"]');
      if (input) input.value = to.replace(/^@/, '');
    }
    if (amount) {
      const input = form.querySelector('[name="amount"]');
      if (input) input.value = amount;
    }
    if (memo) {
      const input = form.querySelector('[name="memo"]');
      if (input) input.value = decodeURIComponent(memo);
    }
  }

  function bindSteemTransferTemplates() {
    const select = document.getElementById('wallet-steem-template-select');
    if (!select) return;
    select.addEventListener('change', () => {
      const option = select.selectedOptions && select.selectedOptions[0];
      if (!option || !option.value) return;
      const form = select.closest('form');
      if (!form) return;
      const to = form.querySelector('[name="to"]');
      const memo = form.querySelector('[name="memo"]');
      const toVesting = form.querySelector('[name="toVesting"]');
      if (to) to.value = option.dataset.to || '';
      if (memo) memo.value = option.dataset.memo || '';
      if (toVesting) toVesting.checked = option.dataset.toVesting === '1';
    });
  }

  function prefillSteemTransferFromUrl() {
    const form = document.getElementById('wallet-transfer-form');
    if (!form) return;
    const params = new URLSearchParams(global.location && global.location.search || '');
    const hashParams = new URLSearchParams(global.location && global.location.hash && global.location.hash.includes('?') ? global.location.hash.split('?').slice(1).join('?') : '');
    const get = (name) => params.get(name) || hashParams.get(name) || '';
    const to = get('to');
    const amount = get('amount');
    const memo = get('memo');
    if (to) {
      const input = form.querySelector('[name="to"]');
      if (input) input.value = to.replace(/^@/, '');
    }
    if (amount) {
      const input = form.querySelector('[name="amount"]');
      if (input) input.value = amount;
    }
    if (memo) {
      const input = form.querySelector('[name="memo"]');
      if (input) input.value = decodeURIComponent(memo);
    }
  }

  function bindSteemWalletForms(chain, profile) {
    bindSteemTransferTemplates();
    prefillSteemTransferFromUrl();

    bindOperationForm(chain, 'wallet-transfer-form', async (form) => {
      const from = auth.getCurrentLogin(chain);
      const to = normalizeAccountInput(chain, form.get('to'), 'Кому');
      const amount = normalizeAssetInput(chain, form.get('amount'), [chain.liquidSymbol, chain.debtSymbol].filter(Boolean), 'Сумма перевода');
      if (form.get('toVesting')) {
        const steemAmount = normalizeAssetInput(chain, form.get('amount'), chain.liquidSymbol, 'Сумма перевода в SP');
        return broadcast.prepare(chain, 'active', 'transferToVesting', [from, to, steemAmount], { title: 'STEEM в SP получателя', to, amount: steemAmount });
      }
      const rawMemo = String(form.get('memo') || '');
      if (isSteemMemoWif(chain, rawMemo)) {
        throw new Error('Memo похоже на приватный ключ. Проверьте поле memo: приватные ключи нельзя отправлять в блокчейн.');
      }
      const prepared = broadcast.prepare(chain, 'active', 'transfer', [from, to, amount, rawMemo], { title: 'Steem transfer', to, amount });
      prepared.params[3] = await encodeSteemMemoIfNeeded(chain, to, rawMemo, prepared.getPrivateKey());
      return prepared;
    });

    bindOperationForm(chain, 'wallet-vesting-form', (form) => {
      const from = auth.getCurrentLogin(chain);
      const amount = normalizeAssetInput(chain, form.get('amount'), chain.liquidSymbol, 'Количество STEEM');
      return broadcast.prepare(chain, 'active', 'transferToVesting', [from, from, amount], { title: 'STEEM в SP своего аккаунта', to: from, amount });
    });

    bindOperationForm(chain, 'wallet-withdraw-vesting-form', (form) => {
      const amount = normalizeSteemPowerInput(profile, form.get('vesting'), 'Сумма SP');
      return broadcast.prepare(chain, 'active', 'withdrawVesting', [auth.getCurrentLogin(chain), amount], { title: 'Вывод SP', amount });
    });

    bindOperationForm(chain, 'wallet-steem-cancel-withdraw-form', () => broadcast.prepare(chain, 'active', 'withdrawVesting', [
      auth.getCurrentLogin(chain),
      '0.000000 VESTS'
    ], { title: 'Отмена вывода SP', amount: '0.000000 VESTS' }));

    bindOperationForm(chain, 'wallet-delegation-form', (form) => {
      const to = normalizeAccountInput(chain, form.get('delegatee'), 'Кому');
      const amount = normalizeSteemPowerInput(profile, form.get('vesting'), 'Сумма SP');
      return broadcast.prepare(chain, 'active', 'delegateVestingShares', [auth.getCurrentLogin(chain), to, amount], { title: 'Делегирование SP', to, amount });
    });

    document.querySelectorAll('form[id^="wallet-steem-cancel-delegation-"]').forEach((formEl) => {
      bindOperationForm(chain, formEl.id, (form) => {
        const to = normalizeAccountInput(chain, form.get('delegatee'), 'Кому');
        return broadcast.prepare(chain, 'active', 'delegateVestingShares', [auth.getCurrentLogin(chain), to, '0.000000 VESTS'], { title: 'Отмена делегирования SP', to, amount: '0.000000 VESTS' });
      });
    });

    bindOperationForm(chain, 'wallet-claim-form', (form) => broadcast.prepare(chain, 'posting', 'claimRewardBalance', [
      auth.getCurrentLogin(chain),
      normalizeAssetInput(chain, form.get('liquid'), chain.liquidSymbol, 'Reward STEEM'),
      normalizeAssetInput(chain, form.get('debt'), chain.debtSymbol, 'Reward SBD'),
      normalizeAssetInput(chain, form.get('vesting'), chain.vestingSymbol, 'Reward VESTS')
    ], { title: 'Получение наград Steem' }));

    bindOperationForm(chain, 'wallet-savings-to-form', (form) => {
      const from = auth.getCurrentLogin(chain);
      const rawTo = String(form.get('to') || '').trim().replace(/^@/, '');
      const to = rawTo ? normalizeAccountInput(chain, rawTo, 'Получатель savings') : from;
      const amount = normalizeAssetInput(chain, form.get('amount'), [chain.liquidSymbol, chain.debtSymbol].filter(Boolean), 'Сумма savings');
      return broadcast.prepare(chain, 'active', 'transferToSavings', [from, to, amount, String(form.get('memo') || '')], { title: 'Transfer to savings', to, amount });
    });

    bindOperationForm(chain, 'wallet-savings-from-form', (form) => {
      const from = auth.getCurrentLogin(chain);
      const rawTo = String(form.get('to') || '').trim().replace(/^@/, '');
      const to = rawTo ? normalizeAccountInput(chain, rawTo, 'Получатель savings') : from;
      const requestId = broadcast.validateRequestId(form.get('requestId'));
      const amount = normalizeAssetInput(chain, form.get('amount'), [chain.liquidSymbol, chain.debtSymbol].filter(Boolean), 'Сумма savings');
      return broadcast.prepare(chain, 'active', 'transferFromSavings', [from, requestId, to, amount, String(form.get('memo') || '')], { title: 'Transfer from savings', to, amount, requestId });
    });

    bindOperationForm(chain, 'wallet-savings-cancel-form', (form) => broadcast.prepare(chain, 'active', 'cancelTransferFromSavings', [
      auth.getCurrentLogin(chain),
      broadcast.validateRequestId(form.get('requestId'))
    ], { title: 'Cancel transfer from savings', requestId: broadcast.validateRequestId(form.get('requestId')) }));
  }

  function bindGrapheneWalletForms(chain, profile) {
    bindOperationForm(chain, 'wallet-transfer-form', (form) => broadcast.prepare(chain, 'active', 'transfer', [
      auth.getCurrentLogin(chain),
      normalizeAccountInput(chain, form.get('to'), 'Получатель'),
      normalizeAssetInput(chain, form.get('amount'), [chain.liquidSymbol, chain.debtSymbol].filter(Boolean), 'Сумма transfer'),
      String(form.get('memo') || '')
    ], { title: 'Transfer', to: normalizeAccountInput(chain, form.get('to'), 'Получатель'), amount: normalizeAssetInput(chain, form.get('amount'), [chain.liquidSymbol, chain.debtSymbol].filter(Boolean), 'Сумма transfer') }));

    bindOperationForm(chain, 'wallet-vesting-form', (form) => {
      const from = auth.getCurrentLogin(chain);
      const rawTo = String(form.get('to') || '').trim().replace(/^@/, '');
      const to = rawTo ? normalizeAccountInput(chain, rawTo, 'Получатель power up') : from;
      const amount = normalizeAssetInput(chain, form.get('amount'), chain.liquidSymbol, 'Сумма power up');
      return broadcast.prepare(chain, 'active', 'transferToVesting', [from, to, amount], { title: 'Power up', to, amount });
    });

    bindOperationForm(chain, 'wallet-withdraw-vesting-form', (form) => {
      const amount = chain.id === 'golos'
        ? normalizeGolosPowerInput(profile, form.get('vesting'), 'Сумма СГ')
        : normalizeAssetInput(chain, form.get('vesting'), chain.vestingSymbol, 'Сумма vesting');
      return broadcast.prepare(chain, 'active', 'withdrawVesting', [
        auth.getCurrentLogin(chain),
        amount
      ], { title: 'Withdraw vesting', amount });
    });

    bindOperationForm(chain, 'wallet-delegation-form', (form) => broadcast.prepare(chain, 'active', 'delegateVestingShares', [
      auth.getCurrentLogin(chain),
      normalizeAccountInput(chain, form.get('delegatee'), 'Delegatee'),
      chain.id === 'golos' ? normalizeGolosPowerInput(profile, form.get('vesting'), 'Сумма СГ') : normalizeAssetInput(chain, form.get('vesting'), chain.vestingSymbol, 'Сумма delegation')
    ], { title: 'Delegation', to: normalizeAccountInput(chain, form.get('delegatee'), 'Delegatee'), amount: chain.id === 'golos' ? normalizeGolosPowerInput(profile, form.get('vesting'), 'Сумма СГ') : normalizeAssetInput(chain, form.get('vesting'), chain.vestingSymbol, 'Сумма delegation') }));

    bindOperationForm(chain, 'wallet-claim-form', (form) => {
      const account = auth.getCurrentLogin(chain);
      if (chain.id === 'golos') {
        return broadcast.prepare(chain, 'posting', 'claim', [
          account,
          String(form.get('to') || '').trim().replace(/^@/, '') || account,
          normalizeAssetInput(chain, form.get('liquid'), chain.liquidSymbol, 'Ликвидная награда'),
          normalizeAssetInput(chain, form.get('vesting'), chain.vestingSymbol, 'Награда в соцкапитале'),
          []
        ]);
      }

      return broadcast.prepare(chain, 'posting', 'claimRewardBalance', [
        account,
        normalizeAssetInput(chain, form.get('liquid'), chain.liquidSymbol, 'Ликвидная награда'),
        normalizeAssetInput(chain, form.get('debt'), chain.debtSymbol, 'Долговая награда'),
        normalizeAssetInput(chain, form.get('vesting'), chain.vestingSymbol, 'Награда в соцкапитале')
      ]);
    });

    bindOperationForm(chain, 'wallet-savings-to-form', (form) => {
      const from = auth.getCurrentLogin(chain);
      const rawTo = String(form.get('to') || '').trim().replace(/^@/, '');
      const to = rawTo ? normalizeAccountInput(chain, rawTo, 'Получатель savings') : from;
      const amount = normalizeAssetInput(chain, form.get('amount'), [chain.liquidSymbol, chain.debtSymbol].filter(Boolean), 'Сумма savings');
      return broadcast.prepare(chain, 'active', 'transferToSavings', [from, to, amount, String(form.get('memo') || '')], { title: 'Transfer to savings', to, amount });
    });

    bindOperationForm(chain, 'wallet-savings-from-form', (form) => {
      const from = auth.getCurrentLogin(chain);
      const rawTo = String(form.get('to') || '').trim().replace(/^@/, '');
      const to = rawTo ? normalizeAccountInput(chain, rawTo, 'Получатель savings') : from;
      const requestId = broadcast.validateRequestId(form.get('requestId'));
      const amount = normalizeAssetInput(chain, form.get('amount'), [chain.liquidSymbol, chain.debtSymbol].filter(Boolean), 'Сумма savings');
      return broadcast.prepare(chain, 'active', 'transferFromSavings', [from, requestId, to, amount, String(form.get('memo') || '')], { title: 'Transfer from savings', to, amount, requestId });
    });

    bindOperationForm(chain, 'wallet-savings-cancel-form', (form) => broadcast.prepare(chain, 'active', 'cancelTransferFromSavings', [
      auth.getCurrentLogin(chain),
      broadcast.validateRequestId(form.get('requestId'))
    ], { title: 'Cancel transfer from savings', requestId: broadcast.validateRequestId(form.get('requestId')) }));
  }

  async function renderBroadcast(chain) {
    await loadScript(chain.cryptoPath);
    const current = auth.getCurrentUser(chain);
    const keys = broadcast.getAvailableKeys(chain, current);
    appEl.innerHTML = `
      <section class="panel">
        <h2>${escapeHtml(chain.title)}: отправка операций</h2>
        <p>Используются сохранённые в браузере аккаунты и ключи. Новая схема хранения не создаётся.</p>
        <ul>
          <li><strong>Аккаунт:</strong> ${keys.login ? `@${escapeHtml(keys.login)}` : 'не выбран'}</li>
          <li><strong>${escapeHtml(keys.regularOrPostingLabel)}:</strong> ${keys.regularOrPosting ? 'доступен' : 'нет или не расшифрован'}</li>
          <li><strong>active:</strong> ${keys.active ? 'доступен' : 'нет или не расшифрован'}</li>
          <li><strong>Источник:</strong> ${escapeHtml(keys.source)}</li>
        </ul>
        <p class="notice">Приватные ключи не показываются в интерфейсе, проверке операции и ответах сети.</p>
        ${buildGrapheneWalletForms(chain, null)}
      </section>`;
    bindGrapheneWalletForms(chain, null);
    bindMaxButtons(appEl);
    setStatus('Отправка операций готова: доступны проверка и отправка в сеть.', 'ok');
  }

  function parseVizBeneficiaries(value) {
    const text = String(value || '').trim();
    if (!text) return [];
    let rows;
    if (text.startsWith('[')) {
      rows = JSON.parse(text);
      if (!Array.isArray(rows)) throw new Error('JSON beneficiaries должен быть массивом.');
      rows = rows.map((item) => ({ account: normalizeAccountInput(chains.viz, item.account, 'Бенефициар'), weight: Number(item.weight) }));
    } else {
      rows = text.split(',').map((chunk) => {
        const [account, percent] = chunk.split(':').map((part) => String(part || '').trim());
        return { account: normalizeAccountInput(chains.viz, account, 'Бенефициар'), weight: Math.trunc(Number(percent) * 100) };
      });
    }
    const total = rows.reduce((sum, item) => sum + Number(item.weight || 0), 0);
    if (rows.some((item) => !Number.isInteger(item.weight) || item.weight <= 0)) {
      throw new Error('Каждый beneficiary должен иметь положительный weight: проценты в формате account:10 или weight в сотых процента.');
    }
    if (total > 10000) throw new Error('Суммарный вес beneficiaries не должен превышать 100%.');
    return rows;
  }

  function normalizeVizEnergy(value) {
    const percent = Number(String(value || '').replace(',', '.'));
    if (!Number.isFinite(percent) || percent <= 0 || percent > 100) {
      throw new Error('Энергия VIZ-награды должна быть > 0 и <= 100%.');
    }
    return Math.trunc(percent * 100);
  }

  function normalizeVizCustomSequence(value) {
    const id = Number(value || 0);
    if (!Number.isSafeInteger(id) || id < 0) throw new Error('custom_sequence должен быть целым неотрицательным числом.');
    return id;
  }

  function normalizeVizPayout(value) {
    const amount = Number(String(value || '').replace(',', '.'));
    if (!Number.isFinite(amount) || amount <= 0) throw new Error('Fixed payout должен быть положительным числом VIZ.');
    return `${amount.toFixed(3)} VIZ`;
  }

  function calculateVizAwardPayout(effectiveShares, props, energy) {
    const totalVestingFund = parseFloat(props.total_vesting_fund || 0);
    const totalVestingShares = parseFloat(props.total_vesting_shares || 0);
    const totalRewardFund = parseFloat(props.total_reward_fund || 0);
    const totalRewardShares = parseInt(props.total_reward_shares || 0, 10);
    if (!effectiveShares || !totalVestingFund || !totalVestingShares || !totalRewardFund || !totalRewardShares) return 0;
    const vizPrice = (totalVestingShares * 1000000) / (totalVestingFund * 1000000);
    const rshares = parseInt(effectiveShares * 1000000 * energy / 10000, 10);
    return parseInt(rshares / (totalRewardShares + rshares) * (totalRewardFund * 1000000) * vizPrice, 10) / 1000000;
  }

  function calculateVizEnergyForPayout(effectiveShares, props, payout) {
    const totalVestingFund = parseFloat(props.total_vesting_fund || 0);
    const totalVestingShares = parseFloat(props.total_vesting_shares || 0);
    const totalRewardFund = parseFloat(props.total_reward_fund || 0);
    const totalRewardShares = parseInt(props.total_reward_shares || 0, 10);
    if (!effectiveShares || !totalVestingFund || !totalVestingShares || !totalRewardFund || !totalRewardShares) return 1;
    return Math.max(1, parseInt(Number(payout) * (totalVestingFund / totalVestingShares) / totalRewardFund * (totalRewardShares / 1000000) / effectiveShares * 10000, 10));
  }

  function vizEffectiveShares(account) {
    return parseFloat(account && account.vesting_shares || 0) + parseFloat(account && account.received_vesting_shares || 0) - parseFloat(account && account.delegated_vesting_shares || 0);
  }

  function buildVizAwardLink(state) {
    const params = new URLSearchParams();
    params.set('chain', 'viz');
    params.set('app', 'awards');
    ['awardPage', 'target', 'energy', 'custom_sequence', 'memo', 'beneficiaries', 'payout', 'isFixed'].forEach((key) => {
      if (state[key]) params.set(key, state[key]);
    });
    return `${global.location.origin}${global.location.pathname}#${params.toString()}`;
  }

  function vizAwardNav(activePage) {
    const pages = [
      ['form', 'Форма награждения'],
      ['url', 'Генератор url/QR'],
      ['builder', 'Конструктор форм'],
      ['link', 'Legacy link page'],
      ['send', 'Legacy send page']
    ];
    return `<nav class="subnav" aria-label="Страницы сервиса VIZ awards">${pages.map(([page, label]) => {
      const href = page === 'form' ? appHash({ chain: 'viz', app: 'awards' }) : appHash({ chain: 'viz', app: 'awards', awardPage: page });
      return `<a href="${escapeHtml(href)}" ${activePage === page ? 'aria-current="page"' : ''}>${escapeHtml(label)}</a>`;
    }).join(' ')}</nav>`;
  }

  function renderVizAwardMainForm(chain, state = {}, options = {}) {
    const mode = options.mode || 'form';
    const target = state.target || '';
    const energy = state.energy || '1';
    const customSequence = state.custom_sequence || '0';
    const memo = state.memo || '';
    const beneficiaries = state.beneficiaries || '';
    const payout = state.payout || '';
    const isFixed = state.isFixed === 'on' || state.isFixed === '1' || state.isFixed === 'true';
    const awardLink = buildVizAwardLink({ target, energy, custom_sequence: customSequence, memo, beneficiaries, payout, isFixed: isFixed ? 'on' : '' });
    const intro = mode === 'send'
      ? '<p id="viz-award-send-review" class="notice">Static parity: legacy send page не отправляет транзакцию автоматически. Проверьте параметры, затем используйте preview/send с явным подтверждением.</p>'
      : '<p>Legacy parity для awards: обычная award, fixedAward с payout, custom_sequence, beneficiaries и ссылка на предзаполненную форму.</p>';
    return `
      ${intro}
      <form id="viz-award-form" class="stacked-form">
        <fieldset>
          <legend>Награда</legend>
          <div class="field"><label for="award-target">Кого наградить</label><input id="award-target" name="target" type="text" required autocomplete="off" value="${escapeHtml(target)}"></div>
          <div class="field"><label for="award-energy">Энергия, %</label><input id="award-energy" name="energy" type="number" min="0.01" max="100" step="0.01" required value="${escapeHtml(energy)}"></div>
          <div class="field"><label for="award-payout">Fixed payout, VIZ</label><input id="award-payout" name="payout" type="number" min="0.001" step="0.001" value="${escapeHtml(payout)}"><small>Заполняется только для fixedAward.</small></div>
          <label class="inline-choice"><input id="award-fixed" name="isFixed" type="checkbox" ${isFixed ? 'checked' : ''}> Отправить fixedAward с указанным payout</label>
          <div class="field"><label for="award-custom-sequence">custom_sequence</label><input id="award-custom-sequence" name="custom_sequence" type="number" min="0" step="1" value="${escapeHtml(customSequence)}"></div>
          <div class="field"><label for="award-beneficiaries">Бенефициары</label><textarea id="award-beneficiaries" name="beneficiaries" rows="3" placeholder="account:10, other:5 или JSON [{&quot;account&quot;:&quot;...&quot;,&quot;weight&quot;:1000}]">${escapeHtml(beneficiaries)}</textarea><small>Legacy percentages are stored as hundredths of a percent in operation weights.</small></div>
          <div class="field"><label for="award-memo">Memo</label><textarea id="award-memo" name="memo" rows="4">${escapeHtml(memo)}</textarea></div>
          <button type="submit" name="intent" value="preview">Проверить награду</button>
          <button type="submit" name="intent" value="send">Отправить награду в сеть</button>
          <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
        </fieldset>
      </form>
      <section class="subpanel" aria-labelledby="viz-award-link-heading">
        <h3 id="viz-award-link-heading">Ссылка / QR payload</h3>
        <p><a href="${escapeHtml(awardLink)}">Открыть предзаполненную форму</a></p>
        <p><button type="button" data-copy-value="${escapeHtml(awardLink)}">Скопировать ссылку</button></p>
        <details><summary>JSON payload для QR/шаринга</summary><pre><code>${escapeHtml(JSON.stringify({ target, energy, custom_sequence: customSequence, memo, beneficiaries, payout, isFixed }, null, 2))}</code></pre></details>
      </section>`;
  }

  function bindVizAwardOperationForm(chain) {
    bindOperationForm(chain, 'viz-award-form', async (form) => {
      const from = auth.getCurrentLogin(chain);
      const targetAccount = normalizeAccountInput(chain, form.get('target'), 'Кого наградить');
      const memoValue = String(form.get('memo') || '');
      if (broadcast.isLikelyWif(memoValue)) throw new Error('Memo похоже на приватный WIF. Отправка остановлена.');
      const beneficiariesList = parseVizBeneficiaries(form.get('beneficiaries'));
      const custom = normalizeVizCustomSequence(form.get('custom_sequence'));
      const fixed = form.get('isFixed') === 'on';
      const energyValue = normalizeVizEnergy(form.get('energy'));
      if (fixed) {
        const rewardAmount = normalizeVizPayout(form.get('payout'));
        return broadcast.prepare(chain, 'regular', 'fixedAward', [from, targetAccount, rewardAmount, energyValue, custom, memoValue, beneficiariesList], {
          title: 'VIZ fixedAward', to: targetAccount, amount: rewardAmount, customSequence: custom,
          warnings: ['fixedAward тратит указанную сумму VIZ и энергию. Проверьте payout, energy и beneficiaries перед отправкой.']
        });
      }
      return broadcast.prepare(chain, 'regular', 'award', [from, targetAccount, energyValue, custom, memoValue, beneficiariesList], {
        title: 'VIZ award', to: targetAccount, customSequence: custom
      });
    });
  }

  function bindVizAwardUrlForm() {
    const form = document.getElementById('viz-award-url-form');
    if (!form) return;
    const output = document.getElementById('viz-award-generated-link');
    const qrPayload = document.getElementById('viz-award-qr-payload');
    const update = () => {
      const data = new FormData(form);
      const state = {
        target: data.get('target'),
        energy: data.get('energy'),
        custom_sequence: data.get('custom_sequence') || '0',
        memo: data.get('memo'),
        beneficiaries: data.get('beneficiaries'),
        payout: data.get('payout'),
        isFixed: data.get('isFixed') === 'on' ? 'on' : ''
      };
      const link = buildVizAwardLink(state);
      if (output) output.value = link;
      if (qrPayload) qrPayload.value = JSON.stringify(state, null, 2);
    };
    form.addEventListener('submit', (event) => { event.preventDefault(); update(); });
    form.addEventListener('input', update);
    update();
  }

  function renderVizAwardUrlGenerator(state = {}) {
    const link = buildVizAwardLink(state);
    return `
      <p>Сформировать url и QR payload для статической hash-ссылки v3. Legacy QR canvas заменён копируемым payload без зависимости от старого qrcode.min.js.</p>
      <form id="viz-award-url-form" class="stacked-form">
        <div class="field"><label for="url-target">target</label><input id="url-target" name="target" type="text" value="${escapeHtml(state.target || '')}"></div>
        <label class="inline-choice"><input id="url-fixed" name="isFixed" type="checkbox" ${state.isFixed ? 'checked' : ''}> Фиксированная в VIZ награда</label>
        <div class="field"><label for="url-energy">Energy</label><input id="url-energy" name="energy" type="text" value="${escapeHtml(state.energy || '')}"></div>
        <div class="field"><label for="url-payout">payout</label><input id="url-payout" name="payout" type="text" value="${escapeHtml(state.payout || '')}"></div>
        <div class="field"><label for="url-custom-sequence">custom_sequence</label><input id="url-custom-sequence" name="custom_sequence" type="number" min="0" value="${escapeHtml(state.custom_sequence || '0')}"></div>
        <div class="field"><label for="url-memo">Memo</label><input id="url-memo" name="memo" type="text" value="${escapeHtml(state.memo || '')}"></div>
        <div class="field"><label for="url-beneficiaries">beneficiaries</label><textarea id="url-beneficiaries" name="beneficiaries" rows="3">${escapeHtml(state.beneficiaries || '')}</textarea></div>
        <button type="submit">Сформировать url</button>
      </form>
      <div class="field"><label for="viz-award-generated-link">Сформированный url награды</label><textarea id="viz-award-generated-link" rows="3" readonly>${escapeHtml(link)}</textarea></div>
      <div class="field"><label for="viz-award-qr-payload">QR payload</label><textarea id="viz-award-qr-payload" rows="6" readonly>${escapeHtml(JSON.stringify(state, null, 2))}</textarea></div>`;
  }

  function checkVizAwardBuilderPercentLimit(appPercent, userPercent) {
    const total = Number(appPercent || 0) + Number(userPercent || 0);
    if (total > 100) throw new Error('Сумма процентов отчисления не может превышать 100%!');
    return total;
  }

  function buildVizAwardBuilderSnippet(form) {
    const target = String(form.get('target') || form.get('target_value') || 'target_user');
    const payMethod = String(form.get('pay_method') || 'amount');
    const energyView = String(form.get('energy_view') || 'field');
    const noteMode = String(form.get('note_mode') || 'one');
    const customSequence = String(form.get('custom_sequence_value') || '0');
    const memo = String(form.get('memo') || 'Заметка');
    const payout = String(form.get('payout') || '1.000');
    const energy = String(form.get('energy') || '2');
    const beneficiaries = [];
    if (form.get('app_beneficiary_enabled') === 'on') beneficiaries.push(`${form.get('app_beneficiary') || 'denis-skripnik'}:${form.get('app_beneficiary_percent') || '1'}`);
    if (form.get('user_beneficiary_enabled') === 'on') beneficiaries.push(`user_login:${form.get('user_beneficiary_percent') || '1'}`);
    checkVizAwardBuilderPercentLimit(form.get('app_beneficiary_percent'), form.get('user_beneficiary_percent'));
    const actionState = { chain: 'viz', app: 'awards', awardPage: 'send', target, custom_sequence: customSequence, memo, beneficiaries: beneficiaries.join(',') };
    if (payMethod === 'amount') {
      actionState.payout = payout;
      actionState.isFixed = 'on';
    } else {
      actionState.energy = energy;
    }
    const head = `<script>var target_user = "${escapeHtml(target)}"<\/script>`;
    const final = `<form id="send_awards_form" action="${escapeHtml(appHash(actionState))}" method="GET">
  <input type="hidden" name="target" value="${escapeHtml(target)}">
  ${payMethod === 'amount' ? `<input type="text" name="payout" value="${escapeHtml(payout)}">` : `<input type="${energyView === 'slider' ? 'range' : 'text'}" name="energy" value="${escapeHtml(energy)}">`}
  <input type="hidden" name="custom_sequence" value="${escapeHtml(customSequence)}">
  ${noteMode === 'many' ? `<textarea name="memo">${escapeHtml(memo)}</textarea>` : `<input type="text" name="memo" value="${escapeHtml(memo)}">`}
  <input type="hidden" name="beneficiaries" value="${escapeHtml(beneficiaries.join(','))}">
  <button type="submit">Отправить</button>
</form>`;
    return { head, final, actionState };
  }

  function bindVizAwardBuilderForm() {
    const form = document.getElementById('viz-award-builder-form');
    if (!form) return;
    const headCode = document.getElementById('viz-award-builder-head-code');
    const finalCode = document.getElementById('viz-award-builder-final-code');
    const result = document.getElementById('viz-award-builder-result');
    const update = () => {
      try {
        const snippet = buildVizAwardBuilderSnippet(new FormData(form));
        if (headCode) headCode.value = snippet.head;
        if (finalCode) finalCode.value = snippet.final;
        if (result) result.textContent = 'Код формы обновлён.';
      } catch (error) {
        if (result) result.textContent = profiles.formatError(error);
      }
    };
    form.addEventListener('input', update);
    form.addEventListener('change', update);
    form.addEventListener('submit', (event) => { event.preventDefault(); update(); });
    update();
  }

  function renderVizAwardBuilder() {
    return `
      <p>Конструктор форм наград: статический v3-эквивалент legacy builder/footer.js без jQuery UI и без загрузки старого builder.js.</p>
      <form id="viz-award-builder-form" class="stacked-form">
        <fieldset><legend>Настройка будущей формы</legend>
          <label class="inline-choice"><input id="builder-target-enabled" name="target_enabled" type="checkbox" checked> Кого наградить</label>
          <div class="field"><label for="builder-target-value">Значение target по умолчанию</label><input id="builder-target-value" name="target" type="text" value="target_user"></div>
          <div class="field"><label for="builder-pay-method">Способ награды</label><select id="builder-pay-method" name="pay_method"><option value="amount">Сумма награды</option><option value="procent">Процент энергии</option></select></div>
          <div class="field"><label for="builder-energy-view">Внешний вид поля энергии</label><select id="builder-energy-view" name="energy_view"><option value="field">Поле для ввода</option><option value="slider">Ползунок</option></select></div>
          <div class="field"><label for="builder-energy">Процент энергии по умолчанию</label><input id="builder-energy" name="energy" type="text" value="2"></div>
          <div class="field"><label for="builder-payout">Сумма награды по умолчанию</label><input id="builder-payout" name="payout" type="text" value="1.000"></div>
          <div class="field"><label for="builder-custom-sequence">Номер Custom операции</label><input id="builder-custom-sequence" name="custom_sequence_value" type="number" min="0" value="0"></div>
          <div class="field"><label for="builder-note-mode">Memo field mode</label><select id="builder-note-mode" name="note_mode"><option value="one">Однострочное поле</option><option value="many">Многострочное поле</option></select></div>
          <div class="field"><label for="builder-memo">Memo по умолчанию</label><input id="builder-memo" name="memo" type="text" value="Заметка"></div>
          <label class="inline-choice"><input id="builder-app-beneficiary-enabled" name="app_beneficiary_enabled" type="checkbox"> Бенефициарские отчисления приложению</label>
          <div class="field"><label for="builder-app-beneficiary">Логин приложения бенефициара</label><input id="builder-app-beneficiary" name="app_beneficiary" type="text" value="denis-skripnik"></div>
          <div class="field"><label for="builder-app-beneficiary-percent">Процент приложения бенефициара</label><input id="builder-app-beneficiary-percent" name="app_beneficiary_percent" type="number" min="0" max="100" value="1"></div>
          <label class="inline-choice"><input id="builder-user-beneficiary-enabled" name="user_beneficiary_enabled" type="checkbox"> Возврат прибыли пользователю</label>
          <div class="field"><label for="builder-user-beneficiary-percent">Процент возврата пользователю</label><input id="builder-user-beneficiary-percent" name="user_beneficiary_percent" type="number" min="0" max="100" value="1"></div>
          <div class="field"><label for="builder-url-mode">Получать данные по URL</label><select id="builder-url-mode" name="url_mode"><option value="ajax">Получать результат из скрипта формы</option><option value="redirect">Редирект</option></select></div>
          <button type="submit">Получить код</button>
        </fieldset>
      </form>
      <div id="viz-award-builder-result" role="status" aria-live="polite"></div>
      <div class="field"><label for="viz-award-builder-head-code">head_code</label><textarea id="viz-award-builder-head-code" rows="3" readonly></textarea></div>
      <div class="field"><label for="viz-award-builder-final-code">final_code</label><textarea id="viz-award-builder-final-code" rows="10" readonly></textarea></div>`;
  }

  function renderVizAwardLinkPage(state = {}) {
    return `
      <p>Static legacy link page equivalent: route parameters from old /viz/awards/link/{target}/{custom_sequence}/{memo}/{energy}/{fixed} are represented as hash fields.</p>
      <form id="viz-award-link-form" class="stacked-form">
        <div class="field"><label for="link-target">target</label><input id="link-target" name="target" type="text" value="${escapeHtml(state.target || '')}"></div>
        <div class="field"><label for="link-custom-sequence">custom_sequence</label><input id="link-custom-sequence" name="custom_sequence" type="number" min="0" value="${escapeHtml(state.custom_sequence || '0')}"></div>
        <div class="field"><label for="link-memo">memo</label><input id="link-memo" name="memo" type="text" value="${escapeHtml(state.memo || '')}"></div>
        <div class="field"><label for="link-energy">energy</label><input id="link-energy" name="energy" type="text" value="${escapeHtml(state.energy || '')}"></div>
        <label class="inline-choice"><input id="link-fixed" name="isFixed" type="checkbox" ${state.isFixed ? 'checked' : ''}> fixedAward</label>
      </form>
      ${renderVizAwardMainForm(chains.viz, state, { mode: 'link' })}`;
  }

  function renderVizAwardSendPage(chain, state = {}) {
    return renderVizAwardMainForm(chain, state, { mode: 'send' });
  }

  function renderVizAward(chain, state = {}) {
    const page = state.awardPage || 'form';
    let body;
    if (page === 'url') body = renderVizAwardUrlGenerator(state);
    else if (page === 'builder') body = renderVizAwardBuilder(state);
    else if (page === 'link') body = renderVizAwardLinkPage(state);
    else if (page === 'send') body = renderVizAwardSendPage(chain, state);
    else body = renderVizAwardMainForm(chain, state);
    appEl.innerHTML = `
      <section class="panel">
        <h2>VIZ: награды</h2>
        ${vizAwardNav(page)}
        ${body}
      </section>`;
    bindVizAwardOperationForm(chain);
    bindVizAwardUrlForm();
    bindVizAwardBuilderForm();
    bindCopyButtons(appEl);
    setStatus('VIZ awards готовы: award/fixedAward, custom_sequence, beneficiaries, link/url/builder/send и QR payload.', 'ok');
  }

  function golosDonateAssetOptions(assets, selectedToken) {
    const symbols = new Set(['GOLOS', 'GBG']);
    (assets || []).forEach((asset) => {
      const symbol = golosSymbolFromAssetField(asset && asset.max_supply);
      const max = parseAssetAmount(asset && asset.max_supply);
      if (symbol && max > 0) symbols.add(symbol);
    });
    const selected = normalizeGolosTokenSymbol(selectedToken || 'GOLOS', 'Токен доната');
    symbols.add(selected);
    return Array.from(symbols).sort((a, b) => a.localeCompare(b)).map((symbol) => (
      `<option value="${escapeHtml(symbol)}" ${symbol === selected ? 'selected' : ''}>${escapeHtml(symbol)}</option>`
    )).join('');
  }

  function golosDonationPageUrl(state) {
    const params = new URLSearchParams();
    params.set('chain', 'golos');
    params.set('app', 'donate');
    if (state.to) params.set('to', state.to);
    if (state.token) params.set('token', state.token);
    if (state.amount) params.set('amount', state.amount);
    return `${global.location.origin}${global.location.pathname}#${params.toString()}`;
  }

  const GOLOS_AUTO_UPVOTER_SETTINGS_KEY = 'dpos_golos_auto_upvoter_settings';

  function autoUpvoterSettingsKey(chain) {
    return chain && chain.id === 'golos' ? GOLOS_AUTO_UPVOTER_SETTINGS_KEY : `dpos_${chain && chain.id || 'social'}_auto_upvoter_settings`;
  }

  function readGolosAutoUpvoterSettings(chain) {
    if (!global.localStorage) return {};
    try {
      const parsed = JSON.parse(global.localStorage.getItem(autoUpvoterSettingsKey(chain)) || '{}');
      if (!parsed || typeof parsed !== 'object') return {};
      const accounts = parsed.accounts && typeof parsed.accounts === 'object' ? parsed.accounts : {};
      return { accounts };
    } catch (error) {
      return {};
    }
  }

  function splitAutoDonatePoolSettings(value, fallbackPercent, fallbackCoefficient) {
    const parts = String(value || '').trim().split(/\s+/).filter(Boolean);
    return {
      percent: String(fallbackPercent || parts[0] || '0'),
      coefficient: String(fallbackCoefficient || parts[1] || '1')
    };
  }

  function joinAutoDonatePoolSettings(percent, coefficient) {
    return `${String(percent || '0').trim() || '0'} ${String(coefficient || '1').trim() || '1'}`;
  }

  function writeGolosAutoUpvoterSettings(chain, settings) {
    if (!global.localStorage) return;
    const rows = Array.isArray(settings) ? settings : [];
    const accounts = {};
    rows.forEach((row) => {
      const account = String(row && row.account || '').trim().replace(/^@/, '');
      if (!account) return;
      const pool = splitAutoDonatePoolSettings(row && row.autoDonateCap, row && row.autoDonatePoolPercent, row && row.autoDonatePoolCoefficient);
      accounts[account] = {
        enabled: Boolean(row.enabled),
        curators: String(row.curators || ''),
        favorites: String(row.favorites || ''),
        minEnergy: String(row.minEnergy || '2500'),
        curatorMode: String(row.curatorMode || 'repeat'),
        curatorCoefficient: String(row.curatorCoefficient || '100'),
        favoritesPercent: String(row.favoritesPercent || '100'),
        autoDonate: Boolean(row.autoDonate),
        autoDonatePoolPercent: pool.percent,
        autoDonatePoolCoefficient: pool.coefficient,
        autoDonateCap: joinAutoDonatePoolSettings(pool.percent, pool.coefficient)
      };
    });
    global.localStorage.setItem(autoUpvoterSettingsKey(chain), JSON.stringify({ accounts }));
  }

  function getAutoUpvoterRuntime(chain) {
    const chainId = String(chain && chain.id || 'golos');
    if (!global.__dposAutoUpvoterRuntimes || typeof global.__dposAutoUpvoterRuntimes !== 'object') {
      global.__dposAutoUpvoterRuntimes = {};
    }
    if (!global.__dposAutoUpvoterRuntimes[chainId]) {
      global.__dposAutoUpvoterRuntimes[chainId] = {
        runners: {},
        scannerInterval: null,
        runnerLock: null,
        batterySummary: '',
        scannerState: { seen: new Set(), feed: [] },
        manualVoteState: new Map(),
        running: false,
        settings: null
      };
    }
    const runtime = global.__dposAutoUpvoterRuntimes[chainId];
    if (!runtime.scannerState || typeof runtime.scannerState !== 'object') runtime.scannerState = { seen: new Set(), feed: [] };
    if (!(runtime.scannerState.seen instanceof Set)) runtime.scannerState.seen = new Set(runtime.scannerState.seen || []);
    if (!Array.isArray(runtime.scannerState.feed)) runtime.scannerState.feed = [];
    if (!(runtime.manualVoteState instanceof Map)) runtime.manualVoteState = new Map();
    return runtime;
  }

  function applyAutoUpvoterStoredSettings(storedSettings) {
    const accounts = storedSettings && storedSettings.accounts && typeof storedSettings.accounts === 'object' ? storedSettings.accounts : {};
    Object.entries(accounts).forEach(([account, settings]) => {
      const safeAccount = String(account || '').trim().replace(/^@/, '');
      const card = appEl.querySelector(`[data-auto-upvoter-account="${safeAccount.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"]`);
      if (!card || !settings) return;
      const setChecked = (name, value) => {
        const node = card.querySelector(`[name="${name}"]`);
        if (node) node.checked = Boolean(value);
      };
      const setValue = (name, value) => {
        const node = card.querySelector(`[name="${name}"]`);
        if (node && value !== undefined && value !== null) node.value = String(value);
      };
      setChecked('enabled', settings.enabled);
      setValue('curators', settings.curators);
      setValue('favorites', settings.favorites);
      setValue('minEnergy', settings.minEnergy);
      setValue('curatorMode', settings.curatorMode);
      setValue('curatorCoefficient', settings.curatorCoefficient);
      setValue('favoritesPercent', settings.favoritesPercent);
      setChecked('autoDonate', settings.autoDonate);
      const pool = splitAutoDonatePoolSettings(settings.autoDonateCap, settings.autoDonatePoolPercent, settings.autoDonatePoolCoefficient);
      setValue('autoDonatePoolPercent', pool.percent);
      setValue('autoDonatePoolCoefficient', pool.coefficient);
      const legacyNode = card.querySelector('[name="autoDonateCap"]');
      if (legacyNode) legacyNode.value = joinAutoDonatePoolSettings(pool.percent, pool.coefficient);
    });
  }

  async function renderGolosAutoUpvoter(chain) {
    await loadScript(chain.cryptoPath);
    const isGolos = chain.id === 'golos';
    const users = DposAuth.getUsers(chain);
    const helper = global.DposGolosAutoUpvoter;
    const storedSettings = readGolosAutoUpvoterSettings(chain);
    const accountCards = users.map((user, index) => {
      const login = auth.getUserLogin(user);
      const type = auth.getUserType(user);
      const keyStatus = broadcast && typeof broadcast.getAvailableKeys === 'function' ? broadcast.getAvailableKeys(chain, user) : null;
      const safeLogin = escapeHtml(login);
      const checkboxId = `auto-upvoter-enabled-${index}`;
      return `<fieldset class="card auto-upvoter-account" data-auto-upvoter-account="${safeLogin}">
        <legend>@${safeLogin}${type && type !== 'standard' ? ` (${escapeHtml(type)})` : ''}</legend>
        <label><input id="${checkboxId}" type="checkbox" name="enabled" value="1"> Включить этот аккаунт</label>
        <p class="muted">Posting-ключ: ${keyStatus && keyStatus.regularOrPosting ? 'сохранён' : 'не найден или недоступен'}.</p>
        <div class="field">
          <label for="auto-upvoter-curators-${index}">Кураторы для повтора голосов</label>
          <textarea id="auto-upvoter-curators-${index}" name="curators" rows="2" placeholder="curator1, curator2"></textarea>
        </div>
        <div class="field">
          <label for="auto-upvoter-favorites-${index}">Любимые авторы для автоголоса за новые посты</label>
          <textarea id="auto-upvoter-favorites-${index}" name="favorites" rows="2" placeholder="author1, author2"></textarea>
        </div>
        <div class="field-grid">
          <div class="field">
            <label for="auto-upvoter-min-energy-${index}">Минимальная батарейка голоса: % или шкала 0–10000 (80 = 80%, 8000 = 80%)</label>
            <input id="auto-upvoter-min-energy-${index}" name="minEnergy" type="number" min="0" max="10000" step="1" value="2500">
          </div>
          <div class="field">
            <label for="auto-upvoter-curator-mode-${index}">Режим куратора</label>
            <select id="auto-upvoter-curator-mode-${index}" name="curatorMode">
              <option value="repeat">Повторить процент куратора</option>
              <option value="full">Полный голос</option>
            </select>
          </div>
          <div class="field">
            <label for="auto-upvoter-curator-coefficient-${index}">Коэффициент куратора, %</label>
            <input id="auto-upvoter-curator-coefficient-${index}" name="curatorCoefficient" type="number" min="0" max="100" step="1" value="100">
          </div>
          <div class="field">
            <label for="auto-upvoter-favorites-percent-${index}">Голос за любимых, %</label>
            <input id="auto-upvoter-favorites-percent-${index}" name="favoritesPercent" type="number" min="0" max="100" step="1" value="100">
          </div>
          ${isGolos ? `<div class="field">
            <label><input name="autoDonate" type="checkbox" value="1"> Личный пул автодоната GOLOS</label>
          </div>
          <div class="field-grid" data-auto-donate-settings hidden>
            <div class="field">
              <label for="auto-upvoter-auto-donate-percent-${index}">Личный пул, % дневной эмиссии</label>
              <input id="auto-upvoter-auto-donate-percent-${index}" name="autoDonatePoolPercent" type="number" min="0" step="0.1" value="0" placeholder="10">
            </div>
            <div class="field">
              <label for="auto-upvoter-auto-donate-coefficient-${index}">Коэффициент уменьшения доната</label>
              <input id="auto-upvoter-auto-donate-coefficient-${index}" name="autoDonatePoolCoefficient" type="number" min="0" step="0.1" value="1" placeholder="1.1">
            </div>
            <input name="autoDonateCap" type="hidden" value="0 1">
            <p class="muted">Как в старом боте, но разделено на два поля: при 100% апвоте тратится заданный процент дневной эмиссии, коэффициент нелинейно уменьшает донат при меньшем проценте голоса. 0% или пустой процент = донат не отправляется. Минимальная отправка — 0.5 GOLOS; 99.8% автору, 0.2% комиссия — @denis-skripnik.</p>
          </div>` : `<input name="autoDonate" type="hidden" value=""><input name="autoDonatePoolPercent" type="hidden" value="0"><input name="autoDonatePoolCoefficient" type="hidden" value="1"><input name="autoDonateCap" type="hidden" value="0 1"><p class="muted">В ${escapeHtml(chain.title)} донатов нет: автоапвоутер отправляет только vote-операции.</p>`}
        </div>
      </fieldset>`;
    }).join('');

    appEl.innerHTML = `<section class="panel auto-upvoter" aria-labelledby="auto-upvoter-heading">
      <h2 id="auto-upvoter-heading">${escapeHtml(chain.title)} автоапвоутер</h2>
      <p>Настройки нескольких аккаунтов, планирование действий и безопасный запуск scanner-loop без backend.</p>
        <p class="warning"><strong>Важно:</strong> кнопка Start — явное согласие на реальные автоматические vote${isGolos ? '/donate' : ''} без подтверждения каждого действия. Сохранённые posting-ключи будут расшифрованы локально в браузере, пока сайт открыт. Не запускайте на чужом устройстве.</p>
      ${isGolos ? '<p class="muted">Автодонат использует старую схему личного пула: % дневной эмиссии при 100% апвоте и коэффициент нелинейного уменьшения по фактическому весу голоса. Сначала vote, затем донат автору поста (99.8%) и комиссия 0.2% на @denis-skripnik с memo fee_donate. Минимум для отправки — 0.5 GOLOS.</p>' : `<p class="muted">В ${escapeHtml(chain.title)} донатов нет: Start отправляет только автоматические vote-операции за любимых авторов и повтор голосов кураторов.</p>`}
      ${users.length ? `<form id="auto-upvoter-form">${accountCards}
        <p id="auto-upvoter-battery-controls" class="muted">Перед запуском/остановкой: батарейка появится после выбора аккаунтов и нажатия Start.</p>
        <div class="actions">
          <button type="button" id="auto-upvoter-start">Запустить Start</button>
          <button type="button" id="auto-upvoter-stop" class="secondary" disabled>Остановить Stop</button>
        </div>
      </form>` : `<p class="muted">Нет сохранённых ${escapeHtml(chain.title)}-аккаунтов. Откройте раздел «Аккаунты» и добавьте аккаунт с posting-ключом.</p>`}
      <section class="card" aria-labelledby="auto-upvoter-status-heading">
        <h3 id="auto-upvoter-status-heading">Статус и лента</h3>
        <div id="auto-upvoter-feed" role="status" aria-live="polite">Остановлен. Реальных отправок без кнопки Start нет.</div>
      </section>
    </section>`;

    const form = document.getElementById('auto-upvoter-form');
    if (form) {
      applyAutoUpvoterStoredSettings(storedSettings);
      syncAutoDonatePoolVisibility(form);
    }
    const startButton = document.getElementById('auto-upvoter-start');
    const stopButton = document.getElementById('auto-upvoter-stop');
    const feed = document.getElementById('auto-upvoter-feed');
    const runtime = getAutoUpvoterRuntime(chain);

    function autoUpvoterManualDonateUrl(action) {
      return isGolos ? golosDonationPageUrl({ to: action && action.author, token: 'GOLOS' }) : '';
    }

    function autoUpvoterPostUrl(action) {
      return isGolos ? golosPostPageUrl(action && action.author, action && action.permlink) : socialPostPageUrl(chain, action && action.author, action && action.permlink);
    }

    function autoUpvoterActionLabel(action) {
      const author = String(action && action.author || '').trim().replace(/^@/, '');
      const title = String(action && action.title || '').trim();
      const permlink = String(action && action.permlink || '').trim();
      return `${author || 'unknown'}/${title || permlink || 'post'}`;
    }

    function autoUpvoterActionHasDonate(entry) {
      const result = entry && entry.result;
      return Boolean(result && Array.isArray(result.donations) && result.donations.length);
    }

    function autoUpvoterActionKey(action) {
      return [action && action.account, action && action.author, action && action.permlink].map((item) => String(item || '').trim().replace(/^@/, '')).join('|');
    }

    function autoUpvoterPercentOptions(selected) {
      const current = Number.isFinite(Number(selected)) ? Number(selected) : 100;
      const options = [];
      for (let percent = -100; percent <= 100; percent += 10) {
        options.push(`<option value="${percent}" ${percent === current ? 'selected' : ''}>${percent}%</option>`);
      }
      if (!options.some((option) => option.includes(`value="${current}"`))) {
        options.push(`<option value="${current}" selected>${current}%</option>`);
      }
      return options.join('');
    }

    function renderAutoUpvoterBatterySummary(prefix) {
      const label = prefix || 'Перед списком постов';
      return `<p id="auto-upvoter-battery" class="muted">${escapeHtml(label)}: ${escapeHtml(runtime.batterySummary || 'батарейка ещё не загружена.')}</p>`;
    }

    function updateAutoUpvoterBatteryControls() {
      const block = document.getElementById('auto-upvoter-battery-controls');
      if (block) block.textContent = `Перед запуском/остановкой: ${runtime.batterySummary || 'батарейка ещё не загружена.'}`;
    }

    function renderAutoUpvoterManualAction(action) {
      if (!action || !action.account || !action.author || !action.permlink) return '';
      const key = autoUpvoterActionKey(action);
      const state = runtime.manualVoteState.get(autoUpvoterActionKey(action));
      const safeAccount = escapeHtml(action.account);
      const safeAuthor = escapeHtml(action.author);
      const safePermlink = escapeHtml(action.permlink);
      if (state === 'needs-vote') {
        const selectId = `auto-upvoter-vote-percent-${escapeHtml(key).replace(/[^a-zA-Z0-9_-]+/g, '-')}`;
        return ` <label for="${selectId}">Процент голоса</label> <select id="${selectId}" data-auto-upvoter-percent="1">${autoUpvoterPercentOptions(100)}</select> <button type="button" data-auto-upvoter-vote="1" data-account="${safeAccount}" data-author="${safeAuthor}" data-permlink="${safePermlink}">Голосовать с подтверждением</button>`;
      }
      return ` <button type="button" class="secondary" data-auto-upvoter-unvote="1" data-account="${safeAccount}" data-author="${safeAuthor}" data-permlink="${safePermlink}">Отменить апвот с подтверждением</button>`;
    }

    function renderScannerFeed(prefix) {
      const rows = [];
      if (prefix) rows.push(`<p>${escapeHtml(prefix)}</p>`);
      rows.push(renderAutoUpvoterBatterySummary('Перед списком постов'));
      runtime.scannerState.feed.slice(-30).reverse().forEach((entry) => {
        const message = entry && entry.message ? entry.message : String(entry || '');
        const action = entry && entry.action;
        const postLink = action && action.author && action.permlink
          ? ` <a href="${escapeHtml(autoUpvoterPostUrl(action))}" target="_blank" rel="noopener">${escapeHtml(autoUpvoterActionLabel(action))}</a>`
          : '';
        const donateLink = isGolos && action && action.author && !autoUpvoterActionHasDonate(entry)
          ? ` <a href="${escapeHtml(autoUpvoterManualDonateUrl(action))}" target="_blank" rel="noopener">Ручной донат автору @${escapeHtml(action.author)} с подтверждением</a>`
          : '';
        rows.push(`<div>${escapeHtml(message)}${postLink}${donateLink}${renderAutoUpvoterManualAction(action)}</div>`);
      });
      feed.innerHTML = rows.length > 1 ? rows.join('') : `${rows.join('')}<p>Сканер запущен, событий пока нет.</p>`;
    }

    function appendScannerFeed(message) {
      runtime.scannerState.feed.push({ type: 'info', message: `${new Date().toLocaleTimeString()}: ${message}` });
      renderScannerFeed();
    }

    async function createAutoUpvoterAdapter() {
      const connection = await getConnection(chain);
      return {
        async getAccountHistory(account, limit) {
          return profiles.apiCall(connection, 'getAccountHistory', [account, -1, limit || 30]);
        },
        async getFavoritePosts(account, limit) {
          const query = { tag: account, limit: limit || 20 };
          try {
            return await profiles.apiCall(connection, 'getDiscussionsByBlog', [query]);
          } catch (blogError) {
            try {
              return await profiles.apiCall(connection, 'getDiscussionsByCreated', [query]);
            } catch (createdError) {
              throw new Error(`${chain.title} discussion RPC methods getDiscussionsByBlog/getDiscussionsByCreated are unavailable for @${account}: ${profiles.formatError(createdError || blogError)}`);
            }
          }
        },
        async getContent(author, permlink) {
          return profiles.apiCall(connection, 'getContent', [author, permlink]);
        },
        async getAccount(account) {
          const rows = await profiles.apiCall(connection, 'getAccounts', [[String(account || '').trim().replace(/^@/, '')]]);
          return Array.isArray(rows) ? rows[0] : null;
        },
        async getDynamicGlobalProperties() {
          return profiles.apiCall(connection, 'getDynamicGlobalProperties', []);
        }
      };
    }

    function formatAutoUpvoterBattery(account) {
      const energy = helper && typeof helper.currentAccountEnergy === 'function' ? helper.currentAccountEnergy(account) : null;
      return Number.isFinite(energy) ? `${(energy / 100).toFixed(2)}%` : 'н/д';
    }

    async function loadAutoUpvoterBatterySummary(settings) {
      const enabledAccounts = (Array.isArray(settings) ? settings : collectSettings()).filter((row) => row && row.enabled && row.account).map((row) => String(row.account).trim().replace(/^@/, ''));
      if (!enabledAccounts.length) {
        runtime.batterySummary = 'выберите аккаунты, чтобы показать батарейку.';
        updateAutoUpvoterBatteryControls();
        return runtime.batterySummary;
      }
      try {
        const connection = await getConnection(chain);
        const accounts = await profiles.apiCall(connection, 'getAccounts', [enabledAccounts]);
        const byName = new Map((Array.isArray(accounts) ? accounts : []).map((account) => [String(account && account.name || account && account.account || '').trim().replace(/^@/, ''), account]));
        runtime.batterySummary = enabledAccounts.map((name) => `@${name}: ${formatAutoUpvoterBattery(byName.get(name))}`).join('; ');
      } catch (error) {
        runtime.batterySummary = `не удалось загрузить: ${profiles.formatError(error)}`;
      }
      updateAutoUpvoterBatteryControls();
      return runtime.batterySummary;
    }

    async function runAutoUpvoterScan(settings) {
      const adapter = await createAutoUpvoterAdapter();
      const tick = await helper.runScannerTick(chain, settings, adapter, runtime.scannerState, {
        feed: runtime.scannerState.feed,
        broadcaster: async (scanChain, action) => {
          const content = await adapter.getContent(action.author, action.permlink).catch(() => null);
          if (hasGolosVoteFrom(content || action, action.account)) {
            return { skipped: true, reason: 'already-voted' };
          }
          const liveAccount = await adapter.getAccount(action.account).catch(() => null);
          const liveEnergy = helper && typeof helper.currentAccountEnergy === 'function' ? helper.currentAccountEnergy(liveAccount) : null;
          const minEnergy = Number(action.minEnergy);
          if (Number.isFinite(minEnergy) && minEnergy > 0 && !Number.isFinite(liveEnergy)) {
            return { skipped: true, reason: 'battery-unavailable', minEnergy };
          }
          if (Number.isFinite(liveEnergy) && Number.isFinite(minEnergy)) {
            const projectedEnergy = helper.estimateVoteEnergyAfter(liveEnergy, action.weight);
            if (liveEnergy < minEnergy || (Number.isFinite(projectedEnergy) && projectedEnergy < minEnergy)) {
              return { skipped: true, reason: 'low-battery', currentEnergy: liveEnergy, projectedEnergy, minEnergy };
            }
          }
          const donateAction = isGolos && action && action.donate && action.donate.enabled
            ? helper.enrichActionDonateFromEmission(
              action,
              liveAccount || await adapter.getAccount(action.account),
              await adapter.getDynamicGlobalProperties()
            )
            : action;
          return helper.broadcastPlannedAction(scanChain, donateAction, { confirmExecute: false, autoConsent: 'golos-auto-upvoter-start' });
        }
      });
      await loadAutoUpvoterBatterySummary(settings);
      renderScannerFeed(`Последний scan: ${tick.events.length} событий, ${tick.actions.length} новых действий. Seen: ${runtime.scannerState.seen.size}.`);
    }

    async function sendManualVoteFromFeed(button, percent) {
      const account = String(button.dataset.account || '').trim().replace(/^@/, '');
      const author = String(button.dataset.author || '').trim().replace(/^@/, '');
      const permlink = String(button.dataset.permlink || '').trim();
      const votePercent = Math.max(-100, Math.min(100, Math.round(Number(percent) || 0)));
      const weight = votePercent * 100;
      if (!account || !author || !permlink) throw new Error('Не хватает данных для ручного голосования.');
      const connection = await getConnection(chain);
      const content = await profiles.apiCall(connection, 'getContent', [author, permlink]).catch(() => null);
      if (hasGolosVoteFrom(content, account)) {
        runtime.manualVoteState.set(autoUpvoterActionKey({ account, author, permlink }), 'voted');
        appendScannerFeed(`SKIP @${account} уже голосовал за @${author}/${permlink}.`);
        renderScannerFeed();
        setStatus(`@${account} уже голосовал за @${author}/${permlink}.`, 'info');
        return;
      }
      const confirmed = global.confirm(`Голосовать @${account} за @${author}/${permlink} с весом ${votePercent}%?`);
      if (!confirmed) {
        appendScannerFeed(`Голосование @${account} за @${author}/${permlink} на ${votePercent}% отменено пользователем.`);
        return;
      }
      await loadScript(chain.libraryPath);
      await loadScript(chain.cryptoPath);
      const user = helper.findAuthorizedUser(chain, account);
      if (!user) throw new Error(`Аккаунт @${account} не найден в локальном хранилище авторизации.`);
      const prepared = broadcast.prepareForUser(chain, user, 'posting', 'vote', [account, author, permlink, weight], {
        title: `${chain.title} manual vote from auto-upvoter feed`,
        feature: `${chain.id}-auto-upvoter-manual-vote`,
        source: 'manual-feed'
      });
      button.disabled = true;
      await profiles.connect(chain);
      await broadcast.broadcast(chain, prepared, { dryRun: false, confirmExecute: true });
      await loadAutoUpvoterBatterySummary(collectSettings());
      runtime.manualVoteState.set(autoUpvoterActionKey({ account, author, permlink }), 'voted');
      appendScannerFeed(`Голос отправлен: @${account} → @${author}/${permlink}, ${votePercent}%.`);
      renderScannerFeed();
      setStatus('Ручной голос отправлен в сеть.', 'ok');
    }

    async function sendManualUnvoteFromFeed(button) {
      const account = String(button.dataset.account || '').trim().replace(/^@/, '');
      const author = String(button.dataset.author || '').trim().replace(/^@/, '');
      const permlink = String(button.dataset.permlink || '').trim();
      if (!account || !author || !permlink) throw new Error('Не хватает данных для отмены апвота.');
      const confirmed = global.confirm(`Отменить апвот @${account} за @${author}/${permlink}?\nБудет отправлен vote с weight=0.`);
      if (!confirmed) {
        appendScannerFeed(`Отмена апвота @${account} за @${author}/${permlink} отменена пользователем.`);
        return;
      }
      await loadScript(chain.libraryPath);
      await loadScript(chain.cryptoPath);
      const user = helper.findAuthorizedUser(chain, account);
      if (!user) throw new Error(`Аккаунт @${account} не найден в локальном хранилище авторизации.`);
      const prepared = broadcast.prepareForUser(chain, user, 'posting', 'vote', [account, author, permlink, 0], {
        title: `${chain.title} unvote from auto-upvoter feed`,
        feature: `${chain.id}-auto-upvoter-manual-unvote`,
        source: 'manual-feed'
      });
      button.disabled = true;
      await profiles.connect(chain);
      await broadcast.broadcast(chain, prepared, { dryRun: false, confirmExecute: true });
      await loadAutoUpvoterBatterySummary(collectSettings());
      runtime.manualVoteState.set(autoUpvoterActionKey({ account, author, permlink }), 'needs-vote');
      appendScannerFeed(`Отмена апвота отправлена: @${account} → @${author}/${permlink}.`);
      renderScannerFeed();
      setStatus('Отмена апвота отправлена в сеть.', 'ok');
    }

    if (feed) {
      feed.addEventListener('click', (event) => {
        const unvoteButton = event.target && event.target.closest ? event.target.closest('[data-auto-upvoter-unvote]') : null;
        const voteButton = event.target && event.target.closest ? event.target.closest('[data-auto-upvoter-vote]') : null;
        if (unvoteButton) {
          sendManualUnvoteFromFeed(unvoteButton).catch((error) => {
            unvoteButton.disabled = false;
            appendScannerFeed(`Ошибка отмены апвота: ${profiles.formatError(error)}`);
            setStatus(`Ошибка отмены апвота: ${profiles.formatError(error)}`, 'error');
          });
          return;
        }
        if (voteButton) {
          const wrapper = voteButton.parentElement;
          const select = wrapper && wrapper.querySelector ? wrapper.querySelector('[data-auto-upvoter-percent]') : null;
          sendManualVoteFromFeed(voteButton, select && select.value).catch((error) => {
            voteButton.disabled = false;
            appendScannerFeed(`Ошибка ручного голоса: ${profiles.formatError(error)}`);
            setStatus(`Ошибка ручного голоса: ${profiles.formatError(error)}`, 'error');
          });
        }
      });
    }

    function stopAutoUpvoter(message) {
      if (runtime.scannerInterval) {
        clearInterval(runtime.scannerInterval);
        runtime.scannerInterval = null;
      }
      if (runtime.runnerLock && helper && typeof helper.releaseRunnerLocks === 'function') {
        helper.releaseRunnerLocks(chain, runtime.runnerLock.accounts, runtime.runnerLock.owner);
        runtime.runnerLock = null;
      }
      runtime.runners = {};
      runtime.running = false;
      runtime.settings = null;
      runtime.hiddenNoticeSent = false;
      startButton.disabled = false;
      stopButton.disabled = true;
      renderScannerFeed(message || 'Остановлен. Активных runner-состояний нет.');
      setStatus(`${chain.title} автоапвоутер остановлен.`, 'info');
      if (pwa && typeof pwa.notify === 'function') {
        pwa.notify('Автоапвоутер остановлен', {
          body: `${chain.title}: local scanner остановлен; новых отправок не будет.`,
          tag: `${chain.id}-auto-upvoter-stop`
        });
      }
    }

    function syncAutoDonatePoolVisibility(card) {
      const scope = card || form;
      if (!scope || !scope.querySelectorAll) return;
      const cards = scope.matches && scope.matches('[data-auto-upvoter-account]') ? [scope] : Array.from(scope.querySelectorAll('[data-auto-upvoter-account]'));
      cards.forEach((accountCard) => {
        const checkbox = accountCard.querySelector('[name="autoDonate"]');
        const settingsBlock = accountCard.querySelector('[data-auto-donate-settings]');
        if (settingsBlock) settingsBlock.hidden = !(checkbox && checkbox.checked);
      });
    }

    function syncAutoDonatePoolValue(card) {
      if (!card) return;
      const percent = card.querySelector('[name="autoDonatePoolPercent"]');
      const coefficient = card.querySelector('[name="autoDonatePoolCoefficient"]');
      const legacy = card.querySelector('[name="autoDonateCap"]');
      if (legacy) legacy.value = joinAutoDonatePoolSettings(percent && percent.value, coefficient && coefficient.value);
    }


    function collectSettings() {
      const settings = Array.from(form.querySelectorAll('[data-auto-upvoter-account]')).map((card) => {
        syncAutoDonatePoolValue(card);
        return {
          account: card.dataset.autoUpvoterAccount,
          enabled: Boolean(card.querySelector('[name="enabled"]').checked),
          curators: card.querySelector('[name="curators"]').value,
          favorites: card.querySelector('[name="favorites"]').value,
          minEnergy: card.querySelector('[name="minEnergy"]').value,
          curatorMode: card.querySelector('[name="curatorMode"]').value,
          curatorCoefficient: card.querySelector('[name="curatorCoefficient"]').value,
          favoritesPercent: card.querySelector('[name="favoritesPercent"]').value,
          autoDonate: isGolos && Boolean(card.querySelector('[name="autoDonate"]').checked),
          autoDonatePoolPercent: card.querySelector('[name="autoDonatePoolPercent"]').value,
          autoDonatePoolCoefficient: card.querySelector('[name="autoDonatePoolCoefficient"]').value,
          autoDonateCap: card.querySelector('[name="autoDonateCap"]').value
        };
      });
      writeGolosAutoUpvoterSettings(chain, settings);
      return settings;
    }

    function persistAutoUpvoterSettings() {
      if (form) collectSettings();
    }

    if (form) {
      form.addEventListener('input', persistAutoUpvoterSettings);
      form.addEventListener('change', (event) => {
        if (event && event.target && event.target.name === 'autoDonate') {
          syncAutoDonatePoolVisibility(event.target.closest('[data-auto-upvoter-account]'));
        }
        persistAutoUpvoterSettings();
      });
    }

    if (!runtime.visibilityListenerAttached && global.document && typeof global.document.addEventListener === 'function') {
      runtime.visibilityListenerAttached = true;
      global.document.addEventListener('visibilitychange', () => {
        if (!runtime.running || runtime.hiddenNoticeSent || !pwa || typeof pwa.notifyVisibilityRuntime !== 'function') return;
        if (global.document.visibilityState === 'hidden') {
          runtime.hiddenNoticeSent = true;
          pwa.notifyVisibilityRuntime(`${chain.title} автоапвоутер`);
        }
      });
    }

    if (startButton && form && helper) {
      startButton.addEventListener('click', async () => {
        try {
          await loadScript(chain.libraryPath);
          await loadScript(chain.cryptoPath);
          const availability = helper.assertBroadcastAvailable(chain);
          const settings = collectSettings();
          await loadAutoUpvoterBatterySummary(settings);
          renderScannerFeed('Перед запуском: текущая батарейка загружена.');
          runtime.runners = helper.upsertRunnerState(runtime.runners, settings);
          const accounts = Object.keys(runtime.runners);
          if (!accounts.length) throw new Error('Выберите хотя бы один аккаунт галочкой «Включить этот аккаунт».');
          runtime.runnerLock = helper.claimRunnerLocks(chain, accounts, runtime.runnerLock && runtime.runnerLock.owner);
          if (runtime.scannerInterval) clearInterval(runtime.scannerInterval);
          runtime.running = true;
          runtime.settings = settings;
          runtime.hiddenNoticeSent = false;
          startButton.disabled = true;
          stopButton.disabled = false;
          appendScannerFeed(`Запуск local active-tab scanner для: ${accounts.map((account) => `@${account}`).join(', ')}. ${availability.warning || ''}`);
          await runAutoUpvoterScan(settings);
          runtime.scannerInterval = setInterval(() => {
            if (runtime.runnerLock) runtime.runnerLock = helper.claimRunnerLocks(chain, runtime.runnerLock.accounts, runtime.runnerLock.owner);
            runAutoUpvoterScan(settings).catch((error) => {
              appendScannerFeed(`Ошибка scan: ${profiles.formatError(error)}`);
              setStatus(`Ошибка автоапвоутера: ${profiles.formatError(error)}`, 'error');
              if (pwa && typeof pwa.notify === 'function') {
                pwa.notify('Ошибка автоапвоутера', {
                  body: `${chain.title}: ${profiles.formatError(error)}`,
                  tag: `${chain.id}-auto-upvoter-error`,
                  renotify: true
                });
              }
            });
          }, 60000);
          if (pwa && typeof pwa.notify === 'function') {
            pwa.notify('Автоапвоутер запущен', {
              body: `${chain.title}: local scanner работает для ${accounts.map((account) => `@${account}`).join(', ')}. Можно переключиться на другое приложение, пока PWA/вкладка остаётся живой.`,
              tag: `${chain.id}-auto-upvoter-running`
            });
          }
          if (pwa && typeof pwa.notifyVisibilityRuntime === 'function') {
            pwa.notifyVisibilityRuntime(`${chain.title} автоапвоутер`);
          }
          setStatus(`${chain.title} автоапвоутер запущен локально во вкладке.`, 'ok');
        } catch (error) {
          if (runtime.runnerLock && helper && typeof helper.releaseRunnerLocks === 'function') {
            helper.releaseRunnerLocks(chain, runtime.runnerLock.accounts, runtime.runnerLock.owner);
            runtime.runnerLock = null;
          }
          runtime.running = false;
          runtime.settings = null;
          feed.textContent = `Ошибка запуска: ${profiles.formatError(error)}`;
          setStatus(`Ошибка автоапвоутера: ${profiles.formatError(error)}`, 'error');
          if (pwa && typeof pwa.notify === 'function') {
            pwa.notify('Ошибка запуска автоапвоутера', {
              body: `${chain.title}: ${profiles.formatError(error)}`,
              tag: `${chain.id}-auto-upvoter-start-error`,
              renotify: true
            });
          }
        }
      });
      stopButton.addEventListener('click', async () => {
        await loadAutoUpvoterBatterySummary(collectSettings());
        stopAutoUpvoter('Перед остановкой: текущая батарейка загружена. Остановлен. Local active-tab scanner очищен; новых отправок не будет.');
      });
    } else if (feed) {
      feed.textContent = 'Ошибка: модуль DposGolosAutoUpvoter не загружен.';
    }

    if (runtime.running && startButton && stopButton && feed) {
      startButton.disabled = true;
      stopButton.disabled = false;
      renderScannerFeed('Автоапвоутер уже запущен в этой вкладке; состояние восстановлено после перехода по сайту.');
      if (pwa && typeof pwa.notifyVisibilityRuntime === 'function') {
        pwa.notifyVisibilityRuntime(`${chain.title} автоапвоутер`);
      }
      setStatus(`${chain.title} автоапвоутер уже запущен локально во вкладке.`, 'ok');
    } else {
      setStatus(`${chain.title} автоапвоутер готов к настройке.`, 'info');
    }
  }

  const GOLOS_FEEDS_SETTINGS_KEY = 'dpos_golos_feeds_settings';
  const GOLOS_FEED_KINDS = [
    ['new', 'Новые посты'],
    ['popular', 'Популярное'],
    ['tag', 'По тегу'],
    ['donates', 'Донаты'],
    ['subscriptions', 'Лента подписок']
  ];

  function readGolosFeedsSettings() {
    if (!global.localStorage) return {};
    try {
      const parsed = JSON.parse(global.localStorage.getItem(GOLOS_FEEDS_SETTINGS_KEY) || '{}');
      if (!parsed || typeof parsed !== 'object') return {};
      return {
        feed: normalizeGolosFeedKind(parsed.feed),
        tag: normalizeGolosFeedTag(parsed.tag)
      };
    } catch (error) {
      return {};
    }
  }

  function writeGolosFeedsSettings(settings) {
    if (!global.localStorage) return;
    const next = {
      feed: normalizeGolosFeedKind(settings && settings.feed),
      tag: normalizeGolosFeedTag(settings && settings.tag)
    };
    global.localStorage.setItem(GOLOS_FEEDS_SETTINGS_KEY, JSON.stringify(next));
  }

  function normalizeGolosFeedKind(value) {
    const raw = String(value || '').trim();
    return GOLOS_FEED_KINDS.some(([id]) => id === raw) ? raw : 'new';
  }

  function normalizeGolosFeedTag(value) {
    return String(value || '').trim().replace(/^#/, '').replace(/\s+/g, '-').toLowerCase();
  }

  function golosFeedTagUrl(tag) {
    return appHash({ chain: 'golos', app: 'feeds', feed: 'tag', tag: normalizeGolosFeedTag(tag) });
  }

  function golosFeedTagLabel(tag) {
    const normalized = normalizeGolosFeedTag(tag);
    const extraLabels = { 'ru--foto': 'фото' };
    if (extraLabels[normalized]) return extraLabels[normalized];
    const category = typeof GOLOS_EDITOR_CATEGORIES !== 'undefined' && GOLOS_EDITOR_CATEGORIES.find(([value]) => value === normalized);
    if (category) return category[1];
    if (normalized.startsWith('ru--')) return normalized.slice(4).replace(/-/g, ' ');
    return normalized;
  }

  function golosFeedPostUrl(row) {
    return golosPostPageUrl(row && row.author, row && row.permlink);
  }

  function golosFeedRowTags(row) {
    const raw = row && (row.json_metadata || row.jsonMetadata || row.metadata);
    if (!raw) return [];
    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      return Array.isArray(parsed && parsed.tags) ? parsed.tags.slice(0, 6).filter(Boolean) : [];
    } catch (error) {
      return [];
    }
  }

  function golosFeedActionStats(row) {
    const votes = Array.isArray(row && row.active_votes) ? row.active_votes : (Array.isArray(row && row.activeVotes) ? row.activeVotes : []);
    const netVotes = Number(row && (row.net_votes ?? row.netVotes));
    const replies = Number(row && (row.children ?? row.replies));
    const donates = row && (row.donates || row.donates_uia || row.total_payout_value || row.author_payout_value || row.promoted);
    return [
      `лайков: ${Number.isFinite(netVotes) ? netVotes : votes.length}`,
      Number.isFinite(replies) ? `комментариев: ${replies}` : '',
      donates ? `донаты/выплаты: ${history.formatValue(donates)}` : ''
    ].filter(Boolean).join(' · ');
  }

  function renderGolosFeedKindOptions(selected) {
    return GOLOS_FEED_KINDS.map(([id, label]) => `<option value="${escapeHtml(id)}" ${id === selected ? 'selected' : ''}>${escapeHtml(label)}</option>`).join('');
  }

  async function loadGolosFeedRows(chain, state, connection) {
    const kind = normalizeGolosFeedKind(state.feed);
    const account = String(state.account || auth.getCurrentLogin(chain) || chain.defaultAccount || '').trim().replace(/^@/, '');
    const limit = 20;
    const baseQuery = { tag: '', limit };
    if (kind === 'new') {
      return profiles.apiCall(connection, 'getDiscussionsByCreated', [baseQuery]);
    }
    if (kind === 'popular') {
      try {
        return await profiles.apiCall(connection, 'getDiscussionsByHot', [baseQuery]);
      } catch (error) {
        return profiles.apiCall(connection, 'getDiscussionsByTrending', [baseQuery]);
      }
    }
    if (kind === 'tag') {
      const tag = normalizeGolosFeedTag(state.tag);
      return profiles.apiCall(connection, 'getDiscussionsByCreated', [{ tag, limit }]);
    }
    if (kind === 'subscriptions') {
      if (!account) throw new Error('Для ленты подписок нужен аккаунт.');
      return profiles.apiCall(connection, 'getDiscussionsByFeed', [{ tag: account, limit }]);
    }
    if (!account) throw new Error('Для ленты донатов нужен аккаунт.');
    const rows = await profiles.apiCall(connection, 'getDiscussionsByBlog', [{ tag: account, limit }]);
    return (Array.isArray(rows) ? rows : []).slice().sort((a, b) => {
      const score = (row) => Number(row && (row.donates || row.author_payout_in_golos || row.author_payout_value || row.total_payout_value || row.promoted) || 0);
      return score(b) - score(a);
    });
  }

  function renderGolosFeedCard(chain, row) {
    const author = String(row && row.author || '').trim().replace(/^@/, '');
    const permlink = String(row && row.permlink || '').trim();
    if (!author || !permlink) return '';
    const title = golosContentTitle(row, permlink);
    const tags = golosFeedRowTags(row);
    const teaser = markdownToTextPreview(row && row.body, 320);
    const voted = hasGolosVoteFrom(row, auth.getCurrentLogin(chain));
    return `<article class="card golos-feed-card" data-golos-feed-card data-author="${escapeHtml(author)}" data-permlink="${escapeHtml(permlink)}">
      <h3><a href="${escapeHtml(golosFeedPostUrl(row))}">${escapeHtml(title)}</a></h3>
      <p class="muted">${accountLink(chain, author)} · ${escapeHtml(golosContentDate(row))} · ${escapeHtml(golosFeedActionStats(row))}</p>
      <p>${escapeHtml(teaser)}</p>
      ${tags.length ? `<p class="muted">Теги: ${tags.map((tag) => `<a href="${escapeHtml(golosFeedTagUrl(tag))}">${escapeHtml(golosFeedTagLabel(tag))}</a>`).join(', ')}</p>` : ''}
      <p class="actions">
        <button type="button" data-golos-feed-vote data-author="${escapeHtml(author)}" data-permlink="${escapeHtml(permlink)}" ${voted ? 'disabled' : ''}>${voted ? 'Вы уже лайкали' : 'Лайк 100%'}</button>
        <button type="button" class="secondary" data-golos-feed-repost data-author="${escapeHtml(author)}" data-permlink="${escapeHtml(permlink)}">Репост с подтверждением</button>
        <a href="${escapeHtml(golosDonationPageUrl({ to: row.author, token: 'GOLOS' }))}" target="_blank" rel="noopener" data-golos-feed-donate>Донат автору</a>
      </p>
    </article>`;
  }

  async function renderGolosFeedsPage(chain, state = {}) {
    const storedSettings = readGolosFeedsSettings();
    const hasFeedParam = Object.prototype.hasOwnProperty.call(state, 'feed') && state.feed;
    const hasAccountParam = Object.prototype.hasOwnProperty.call(state, 'account') && state.account;
    const hasTagParam = Object.prototype.hasOwnProperty.call(state, 'tag') && state.tag;
    const feedKind = normalizeGolosFeedKind(hasFeedParam ? state.feed : storedSettings.feed);
    const account = String(hasAccountParam ? state.account : (auth.getCurrentLogin(chain) || chain.defaultAccount || '')).trim().replace(/^@/, '');
    const tag = normalizeGolosFeedTag(hasTagParam ? state.tag : (storedSettings.tag || ''));
    writeGolosFeedsSettings({ feed: feedKind, tag });
    appEl.innerHTML = `<section class="panel golos-feeds-page" data-golos-feeds-page>
      <h2>Golos: Ленты</h2>
      <p class="muted">Новые посты, популярное, ленты по тегам, донаты и лента подписок пользователя через публичный RPC. Действия выполняются только после подтверждения.</p>
      <form id="golos-feeds-form" class="stacked-form">
        <div class="field-grid">
          <div class="field"><label for="golos-feeds-kind">Тип ленты</label><select id="golos-feeds-kind" name="feed" data-golos-feed-kind>${renderGolosFeedKindOptions(feedKind)}</select></div>
          <div class="field"><label for="golos-feeds-tag">Тег для ленты</label><input id="golos-feeds-tag" name="tag" type="text" value="${escapeHtml(tag)}" placeholder="Оставьте пустым для общей ленты" list="golos-feed-tag-suggestions" autocomplete="off"><datalist id="golos-feed-tag-suggestions">${GOLOS_EDITOR_CATEGORIES.map(([value, label]) => `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`).join('')}</datalist></div>
        </div>
        <button type="submit">Показать ленту</button>
      </form>
      <div id="golos-feeds-result" role="status" aria-live="polite"><p>Загружаю ленту...</p></div>
    </section>`;
    const form = document.getElementById('golos-feeds-form');
    if (form) {
      const persistFormSettings = () => {
        const data = new FormData(form);
        writeGolosFeedsSettings({ feed: data.get('feed'), tag: data.get('tag') });
      };
      const feedSelect = form.querySelector('[name="feed"]');
      const tagInput = form.querySelector('[name="tag"]');
      if (feedSelect) feedSelect.addEventListener('change', persistFormSettings);
      if (tagInput) tagInput.addEventListener('input', persistFormSettings);
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        const data = new FormData(form);
        writeGolosFeedsSettings({ feed: data.get('feed'), tag: data.get('tag') });
        navigate({ chain: 'golos', app: 'feeds', feed: data.get('feed'), account: auth.getCurrentLogin(chain) || null, tag: normalizeGolosFeedTag(data.get('tag')) });
      });
    }
    const result = document.getElementById('golos-feeds-result');
    try {
      setStatus('Загружаю Golos ленту...', 'loading');
      const connection = await getConnection(chain);
      const rows = await loadGolosFeedRows(chain, { ...state, feed: feedKind, account, tag }, connection);
      const cards = (Array.isArray(rows) ? rows : []).map((row) => renderGolosFeedCard(chain, row)).filter(Boolean);
      const selectedBaseLabel = (GOLOS_FEED_KINDS.find(([id]) => id === feedKind) || GOLOS_FEED_KINDS[0])[1];
      const selectedLabel = feedKind === 'tag' ? `${selectedBaseLabel}: ${tag ? golosFeedTagLabel(tag) : 'без тега (все посты)'}` : selectedBaseLabel;
      result.innerHTML = cards.length ? `<h3>${escapeHtml(selectedLabel)}</h3>${cards.join('')}` : `<p class="muted">В этой ленте сейчас нет постов.</p>`;
      bindGolosFeedActions(chain);
      setStatus(`Golos лента «${selectedLabel}» загружена.`, 'ok');
    } catch (error) {
      if (result) result.innerHTML = `<p class="warning">${escapeHtml(profiles.formatError(error))}</p>`;
      setStatus(`Ошибка загрузки ленты Golos: ${profiles.formatError(error)}`, 'error');
    }
  }

  function bindGolosFeedActions(chain) {
    appEl.querySelectorAll('[data-golos-feed-vote]').forEach((button) => {
      button.addEventListener('click', async () => {
        try {
          const voter = auth.getCurrentLogin(chain);
          const author = String(button.dataset.author || '').trim().replace(/^@/, '');
          const permlink = String(button.dataset.permlink || '').trim();
          const connection = await getConnection(chain);
          const content = await profiles.apiCall(connection, 'getContent', [author, permlink]).catch(() => null);
          if (hasGolosVoteFrom(content, voter)) {
            button.disabled = true;
            button.textContent = 'Вы уже лайкали';
            setStatus(`@${voter} уже голосовал за @${author}/${permlink}.`, 'info');
            return;
          }
          const prepared = broadcast.prepare(chain, 'posting', 'vote', [voter, author, permlink, 10000], { title: 'Golos feed vote', feature: 'golos-feeds' });
          await profiles.connect(chain);
          await broadcast.broadcast(chain, prepared, { dryRun: false, confirmExecute: true });
          button.disabled = true;
          button.textContent = 'Лайк отправлен';
          setStatus('Лайк отправлен в сеть.', 'ok');
        } catch (error) {
          setStatus(`Ошибка лайка: ${profiles.formatError(error)}`, 'error');
        }
      });
    });
    appEl.querySelectorAll('[data-golos-feed-repost]').forEach((button) => {
      button.addEventListener('click', async () => {
        try {
          const account = auth.getCurrentLogin(chain);
          const author = String(button.dataset.author || '').trim().replace(/^@/, '');
          const permlink = String(button.dataset.permlink || '').trim();
          if (!account) throw new Error('Для репоста нужен выбранный сохранённый Golos-аккаунт.');
          const payload = ['reblog', { account, author, permlink }];
          const prepared = broadcast.prepare(chain, 'posting', 'sendOperations', [[
            ['custom_json', {
              required_auths: [],
              required_posting_auths: [account],
              id: 'follow',
              json: JSON.stringify(payload)
            }]
          ]], { title: 'Golos feed repost', to: author, feature: 'golos-feeds-repost' });
          await profiles.connect(chain);
          await broadcast.broadcast(chain, prepared, { dryRun: false, confirmExecute: true });
          button.disabled = true;
          button.textContent = 'Репост отправлен';
          setStatus('Репост отправлен в сеть.', 'ok');
        } catch (error) {
          setStatus(`Ошибка репоста: ${profiles.formatError(error)}`, 'error');
        }
      });
    });
  }

  function clampVotePercent(value) {
    const parsed = Number.parseInt(String(value || '0'), 10);
    if (Number.isNaN(parsed)) return 0;
    return Math.max(-100, Math.min(100, parsed));
  }

  function renderPostVoteForm(prefix, author, permlink, voted) {
    if (voted) return '<span class="muted">Вы уже голосовали</span>';
    const safePrefix = String(prefix || 'post').replace(/[^a-zA-Z0-9_-]/g, '-');
    const safeAuthor = String(author || '').replace(/[^a-zA-Z0-9_-]/g, '-');
    const safePermlink = String(permlink || '').replace(/[^a-zA-Z0-9_-]/g, '-');
    const inputId = `${safePrefix}-vote-percent-${safeAuthor}-${safePermlink}`.slice(0, 120);
    return `<details class="vote-details" data-vote-details>
      <summary>Голос</summary>
      <form class="inline-form vote-form" data-${escapeHtml(safePrefix)}-vote-form data-author="${escapeHtml(author)}" data-permlink="${escapeHtml(permlink)}">
        <label for="${escapeHtml(inputId)}">Вес голоса: <output data-vote-output for="${escapeHtml(inputId)}">100%</output></label>
        <input id="${escapeHtml(inputId)}" name="percent" data-vote-percent type="range" min="-100" max="100" step="1" value="100">
        <button type="submit">Голосовать</button>
      </form>
    </details>`;
  }

  function postPromotionDebtSymbol(chain) {
    return chain.debtSymbol || (chain.id === 'hive' ? 'HBD' : (chain.id === 'steem' ? 'SBD' : 'GBG'));
  }

  function postPromotionAssetNumber(value, symbol) {
    const text = String(value || '').trim();
    if (symbol && !new RegExp(`\\b${symbol}\\b`, 'i').test(text)) return 0;
    return numericAssetValue(text);
  }

  function formatPostPromotionAsset(value, symbol) {
    const amount = Number(value) || 0;
    return `${amount.toFixed(3)} ${symbol}`;
  }

  async function callPostPromotionRpc(connection, payload) {
    if (!connection.node || typeof global.fetch !== 'function') throw new Error('Нет прямого JSON-RPC доступа к ноде.');
    const response = await global.fetch(connection.node, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(Object.assign({ jsonrpc: '2.0', id: 1 }, payload))
    });
    if (!response.ok) throw new Error(`promoted RPC HTTP ${response.status}`);
    const data = await response.json();
    if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
    return data.result;
  }

  function normalizePromotedDiscussionsResult(result) {
    if (Array.isArray(result)) return result;
    if (result && Array.isArray(result.discussions)) return result.discussions;
    if (result && Array.isArray(result.posts)) return result.posts;
    return [];
  }

  async function fetchPromotedDiscussions(connection, query) {
    try {
      return normalizePromotedDiscussionsResult(await profiles.apiCall(connection, 'getDiscussionsByPromoted', [query]));
    } catch (error) {
      const attempts = [
        { method: 'call', params: ['tags', 'get_discussions_by_promoted', [query]] },
        { method: 'condenser_api.get_discussions_by_promoted', params: [query] },
        { method: 'call', params: ['condenser_api', 'get_discussions_by_promoted', [query]] }
      ];
      let lastError = error;
      for (const payload of attempts) {
        try {
          return normalizePromotedDiscussionsResult(await callPostPromotionRpc(connection, payload));
        } catch (rpcError) {
          lastError = rpcError;
        }
      }
      throw lastError;
    }
  }

  function currentTopPromotionBid(promotedRows, symbol) {
    const amounts = (promotedRows || []).map((row) => postPromotionAssetNumber(row && row.promoted, symbol));
    return amounts.length ? Math.max(0, ...amounts) : 0;
  }

  function currentPostPromotionKeyStatus(chain) {
    return auth && typeof auth.getKeyStatus === 'function'
      ? auth.getKeyStatus(chain, auth.getCurrentUser(chain))
      : { hasActive: false };
  }

  async function fetchPostPromotionInfo(chain, connection, login) {
    const symbol = postPromotionDebtSymbol(chain);
    const info = { symbol, currentTop: '', maxAmount: '', maxNumber: 0, error: '' };
    const keyStatus = currentPostPromotionKeyStatus(chain);
    if (!login || !keyStatus.hasActive) return info;
    try {
      const [promotedRows, accounts] = await Promise.all([
        fetchPromotedDiscussions(connection, { tag: '', limit: 20 }).catch((error) => {
          info.error = `Не удалось загрузить текущую промо-очередь: ${profiles.formatError(error)}`;
          return [];
        }),
        profiles.apiCall(connection, 'getAccounts', [[login]]).catch(() => [])
      ]);
      const topBid = currentTopPromotionBid(promotedRows, symbol);
      const account = accounts && accounts[0];
      const balance = account ? pickBalance(account, symbol) : '';
      info.currentTop = formatPostPromotionAsset(topBid, symbol);
      info.maxAmount = balance || formatPostPromotionAsset(0, symbol);
      info.maxNumber = postPromotionAssetNumber(info.maxAmount, symbol);
    } catch (error) {
      info.error = profiles.formatError(error);
    }
    return info;
  }

  function renderPostPromotionForm(chain, author, permlink, info = {}) {
    const keyStatus = currentPostPromotionKeyStatus(chain);
    if (!keyStatus.hasActive) return '';
    const symbol = info.symbol || postPromotionDebtSymbol(chain);
    const safeAuthor = String(author || '').replace(/[^a-zA-Z0-9_-]/g, '-');
    const safePermlink = String(permlink || '').replace(/[^a-zA-Z0-9_-]/g, '-');
    const inputId = `post-promotion-amount-${safeAuthor}-${safePermlink}`.slice(0, 120);
    const maxText = info.maxAmount || `0.000 ${symbol}`;
    const maxNumber = Number(info.maxNumber) > 0 ? Number(info.maxNumber).toFixed(3) : '';
    const currentTop = info.currentTop || `0.000 ${symbol}`;
    const memo = `@${author}/${permlink}`;
    return `<details class="promotion-details" data-post-promotion-details>
      <summary>Продвигать</summary>
      <form class="stacked-form" data-post-promotion-form data-author="${escapeHtml(author)}" data-permlink="${escapeHtml(permlink)}" data-symbol="${escapeHtml(symbol)}">
        <p class="muted">Перевод ${escapeHtml(symbol)} на <code>null</code> с memo <code>${escapeHtml(memo)}</code> сжигает средства и поднимает пост в промо-очереди.</p>
        <p>Текущая максимальная ставка: <strong data-post-promotion-current-top>${escapeHtml(currentTop)}</strong></p>
        <p>Максимум выбранного аккаунта: <strong>${escapeHtml(maxText)}</strong>${maxNumber ? ` <button type="button" data-post-promotion-max value="${escapeHtml(maxNumber)}">Вставить максимум</button>` : ''}</p>
        <div class="field"><label for="${escapeHtml(inputId)}">Сумма ${escapeHtml(symbol)}</label><input id="${escapeHtml(inputId)}" name="amount" type="text" inputmode="decimal" autocomplete="off" required placeholder="1.000"></div>
        ${info.error ? `<p class="muted">${escapeHtml(info.error)}</p>` : ''}
        <button type="submit">Продвинуть вверх</button>
        <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
      </form>
    </details>`;
  }

  async function renderGolosPostPage(chain, state = {}) {
    const author = String(state.author || '').trim().replace(/^@/, '');
    const permlink = String(state.permlink || '').trim();
    if (!author || !permlink) throw new Error('Для страницы поста нужны author и permlink в hash-параметрах.');
    appEl.innerHTML = '<section class="panel"><h2>Загрузка поста Golos</h2><p>Подключаю публичную ноду...</p></section>';
    setStatus(`Загружаю пост @${author}/${permlink}...`, 'loading');
    const connection = await getConnection(chain);
    const post = await profiles.apiCall(connection, 'getContent', [author, permlink]);
    if (!post || !post.author) throw new Error(`Пост @${author}/${permlink} не найден.`);
    const replies = await loadGolosRepliesTree(connection, author, permlink, 0, 4);
    const currentLogin = auth.getCurrentLogin(chain);
    await loadScript(chain.cryptoPath);
    const promotionInfo = await fetchPostPromotionInfo(chain, connection, currentLogin);
    const voted = hasGolosVoteFrom(post, currentLogin);
    const canEditPost = currentLogin && String(post.author || author).toLowerCase() === String(currentLogin).toLowerCase();
    const editPostLink = canEditPost ? appHash({ chain: chain.id, app: 'editor', author: post.author || author, permlink: post.permlink || permlink }) : '';
    appEl.innerHTML = `<section class="panel golos-post-page" data-golos-post-page>
      <article class="card">
        <h2>${escapeHtml(golosContentTitle(post, permlink))}</h2>
        <p class="muted">${accountLink(chain, post.author || author)} · ${escapeHtml(golosContentDate(post))} · <code>${escapeHtml(post.permlink || permlink)}</code></p>
        <div class="markdown-preview post-body">${markdownToPreviewHtml(post.body || '', chain)}</div>
        <div class="actions">
          ${renderPostVoteForm('golos-post', author, permlink, voted)}
          ${renderPostPromotionForm(chain, author, permlink, promotionInfo)}
          ${editPostLink ? `<a href="${escapeHtml(editPostLink)}">Редактировать</a>` : ''}
          ${golosDonateLink(author, 'Донат автору')}
          <a href="https://golos.id/@${escapeHtml(author)}/${escapeHtml(permlink)}" target="_blank" rel="noopener">Открыть на golos.id</a>
        </div>
      </article>
      <section class="card" aria-labelledby="golos-post-comment-heading">
        <h3 id="golos-post-comment-heading">Добавить комментарий</h3>
        ${renderGolosCommentForm('golos-comment-form', author, permlink)}
      </section>
      <section class="card" aria-labelledby="golos-post-comments-heading">
        <h3 id="golos-post-comments-heading">Комментарии</h3>
        ${renderGolosCommentsList(chain, replies)}
      </section>
    </section>`;
    bindGolosPostActions(chain);
    setStatus(`Пост @${author}/${permlink} загружен.`, 'ok');
  }

  async function loadGolosRepliesTree(connection, author, permlink, depth, maxDepth) {
    if (depth >= maxDepth) return [];
    const rows = await profiles.apiCall(connection, 'getContentReplies', [author, permlink]).catch(() => []);
    const replies = Array.isArray(rows) ? rows : [];
    for (const reply of replies) {
      reply.children = await loadGolosRepliesTree(connection, reply.author, reply.permlink, depth + 1, maxDepth);
    }
    return replies;
  }

  function renderGolosCommentsList(chain, comments) {
    if (!Array.isArray(comments) || !comments.length) return '<p class="muted">Комментариев пока нет.</p>';
    return `<ul class="comment-tree">${comments.map((comment) => renderGolosCommentNode(chain, comment)).join('')}</ul>`;
  }

  function renderGolosCommentNode(chain, comment) {
    const author = String(comment && comment.author || '').trim().replace(/^@/, '');
    const permlink = String(comment && comment.permlink || '').trim();
    const parentAuthor = String(comment && comment.parent_author || '').trim().replace(/^@/, '');
    const parentPermlink = String(comment && comment.parent_permlink || '').trim();
    const title = golosContentTitle(comment, permlink);
    const currentLogin = auth.getCurrentLogin(chain);
    const canEdit = Boolean(author && permlink && author === currentLogin);
    const voted = hasGolosVoteFrom(comment, currentLogin);
    const children = Array.isArray(comment && comment.children) && comment.children.length ? renderGolosCommentsList(chain, comment.children) : '';
    const editButton = canEdit ? `<button type="button" data-golos-comment-edit data-author="${escapeHtml(author)}" data-permlink="${escapeHtml(permlink)}">Редактировать комментарий</button>` : '';
    const editForm = canEdit ? `<div class="reply-slot" hidden data-golos-comment-edit-slot>${renderGolosCommentForm(`golos-edit-form-${escapeHtml(author)}-${escapeHtml(permlink)}`.replace(/[^a-zA-Z0-9_-]/g, '-'), parentAuthor, parentPermlink, { mode: 'edit', author, permlink, body: comment.body || '' })}</div>` : '';
    return `<li class="comment-node" data-comment-author="${escapeHtml(author)}" data-comment-permlink="${escapeHtml(permlink)}">
      <article>
        <p><strong>${accountLink(chain, author)}</strong> · <span class="muted">${escapeHtml(golosContentDate(comment))}</span> · <a href="${escapeHtml(golosPostPageUrl(author, permlink))}" target="_blank" rel="noopener">${escapeHtml(author)}/${escapeHtml(title)}</a></p>
        <div class="markdown-preview comment-body">${markdownToPreviewHtml(comment.body || '', chain)}</div>
        <div class="actions">
          ${renderPostVoteForm('golos-post', author, permlink, voted)}
          ${golosDonateLink(author, 'Донат коммента')}
          <button type="button" data-golos-comment-reply data-author="${escapeHtml(author)}" data-permlink="${escapeHtml(permlink)}">Ответить</button>
          ${editButton}
        </div>
        <div class="reply-slot" hidden>${renderGolosCommentForm(`golos-reply-form-${escapeHtml(author)}-${escapeHtml(permlink)}`.replace(/[^a-zA-Z0-9_-]/g, '-'), author, permlink)}</div>
        ${editForm}
      </article>
      ${children}
    </li>`;
  }

  function renderGolosCommentForm(formId, parentAuthor, parentPermlink, options = {}) {
    const mode = options.mode === 'edit' ? 'edit' : 'create';
    const buttonText = mode === 'edit' ? 'Сохранить правку комментария с подтверждением' : 'Отправить комментарий с подтверждением';
    const labelText = mode === 'edit' ? 'Текст Markdown для правки' : 'Текст Markdown';
    return `<form id="${escapeHtml(formId)}" class="stacked-form" data-golos-comment-form ${mode === 'edit' ? 'data-golos-comment-edit-form' : ''} data-parent-author="${escapeHtml(parentAuthor)}" data-parent-permlink="${escapeHtml(parentPermlink)}" data-comment-mode="${escapeHtml(mode)}" data-comment-author="${escapeHtml(options.author || '')}" data-comment-permlink="${escapeHtml(options.permlink || '')}">
      <div class="field"><label for="${escapeHtml(formId)}-body">${escapeHtml(labelText)}</label><textarea id="${escapeHtml(formId)}-body" name="body" rows="5" required>${escapeHtml(options.body || '')}</textarea></div>
      <button type="submit">${escapeHtml(buttonText)}</button>
      <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
    </form>`;
  }

  function golosCommentPermlink(parentAuthor, parentPermlink) {
    const stamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
    return `re-${String(parentAuthor || '').replace(/[^a-z0-9-]/gi, '').toLowerCase()}-${String(parentPermlink || '').replace(/[^a-z0-9-]/gi, '').toLowerCase().slice(0, 32)}-${stamp}`.slice(0, 255);
  }

  function bindVotePercentOutputs(root) {
    root.querySelectorAll('[data-vote-percent]').forEach((input) => {
      const form = input.closest('form');
      const output = form && form.querySelector('[data-vote-output]');
      const update = () => { if (output) output.textContent = `${clampVotePercent(input.value)}%`; };
      input.addEventListener('input', update);
      update();
    });
  }

  function closeVoteDetails(form) {
    const details = form && form.closest('[data-vote-details]');
    if (details) details.open = false;
  }

  async function submitPostVote(chain, form, options = {}) {
    const voter = auth.getCurrentLogin(chain);
    const author = String(form.dataset.author || '').trim().replace(/^@/, '');
    const permlink = String(form.dataset.permlink || '').trim();
    const percent = clampVotePercent(new FormData(form).get('percent'));
    const connection = await getConnection(chain);
    const content = await profiles.apiCall(connection, 'getContent', [author, permlink]).catch(() => null);
    const submit = form.querySelector('button[type="submit"]');
    if (hasGolosVoteFrom(content, voter)) {
      if (submit) {
        submit.disabled = true;
        submit.textContent = 'Вы уже голосовали';
      }
      closeVoteDetails(form);
      setStatus(`@${voter} уже голосовал за @${author}/${permlink}.`, 'info');
      return;
    }
    if (options.ensureDependencies) await ensureBroadcastDependencies(chain);
    const prepared = broadcast.prepare(chain, 'posting', 'vote', [voter, author, permlink, percent * 100], { title: options.title || `${chain.id} post/comment vote`, feature: options.feature || `${chain.id}-post-page` });
    await profiles.connect(chain);
    await broadcast.broadcast(chain, prepared, { dryRun: false, confirmExecute: true });
    if (submit) {
      submit.disabled = true;
      submit.textContent = 'Голос отправлен';
    }
    closeVoteDetails(form);
    setStatus(`Голос ${percent}% отправлен в сеть.`, 'ok');
  }

  async function submitPostPromotion(chain, form) {
    const from = auth.getCurrentLogin(chain);
    const author = String(form.dataset.author || '').trim().replace(/^@/, '');
    const permlink = String(form.dataset.permlink || '').trim();
    const symbol = String(form.dataset.symbol || postPromotionDebtSymbol(chain)).trim().toUpperCase();
    const amount = String(new FormData(form).get('amount') || '').trim();
    if (!from) throw new Error('Для продвижения нужен выбранный сохранённый аккаунт.');
    if (!author || !permlink) throw new Error('Не удалось определить пост для продвижения.');
    await ensureBroadcastDependencies(chain);
    const amountValue = await normalizeGolosTokenAmount(chain, amount, symbol, `Сумма ${symbol}`);
    const memo = `@${author}/${permlink}`;
    const prepared = broadcast.prepare(chain, 'active', 'transfer', [from, 'null', amountValue, memo], { title: `${chain.id} post promotion`, feature: `${chain.id}-post-promotion`, to: 'null' });
    const confirmed = global.confirm(`Продвинуть пост ${memo}?\nБудет отправлено ${amountValue} на @null. Средства будут сожжены.`);
    if (!confirmed) {
      setOperationResult(form, 'Продвижение отменено пользователем.', 'info', prepared);
      return;
    }
    setOperationResult(form, 'Отправляю перевод для продвижения...', 'loading', prepared);
    await profiles.connect(chain);
    const result = await broadcast.broadcast(chain, prepared, { dryRun: false, confirmExecute: true });
    setOperationResult(form, 'Перевод для продвижения отправлен. Обновите пост после индексации RPC.', 'ok', prepared, result);
    setStatus(`Продвижение ${memo} на ${amountValue} отправлено в сеть.`, 'ok');
  }

  function bindPostPromotionActions(chain) {
    appEl.querySelectorAll('[data-post-promotion-max]').forEach((button) => {
      button.addEventListener('click', () => {
        const form = button.closest('[data-post-promotion-form]');
        const input = form && form.querySelector('input[name="amount"]');
        if (input) {
          input.value = button.value || '';
          input.focus();
        }
      });
    });
    appEl.querySelectorAll('[data-post-promotion-form]').forEach((form) => {
      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const submit = event.submitter || form.querySelector('button[type="submit"]');
        try {
          if (submit) submit.disabled = true;
          await submitPostPromotion(chain, form);
        } catch (error) {
          setOperationResult(form, profiles.formatError(error), 'error');
          setStatus(`Ошибка продвижения: ${profiles.formatError(error)}`, 'error');
        } finally {
          if (submit) submit.disabled = false;
        }
      });
    });
  }

  function bindGolosPostActions(chain) {
    bindVotePercentOutputs(appEl);
    bindPostPromotionActions(chain);
    appEl.querySelectorAll('[data-golos-comment-reply]').forEach((button) => {
      button.addEventListener('click', () => {
        const slot = button.closest('article') && button.closest('article').querySelector('.reply-slot');
        if (slot) slot.hidden = !slot.hidden;
      });
    });
    appEl.querySelectorAll('[data-golos-comment-edit]').forEach((button) => {
      button.addEventListener('click', () => {
        const slot = button.closest('article') && button.closest('article').querySelector('[data-golos-comment-edit-slot]');
        if (slot) slot.hidden = !slot.hidden;
      });
    });
    appEl.querySelectorAll('[data-golos-post-vote-form]').forEach((form) => {
      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        try {
          await submitPostVote(chain, form, { ensureDependencies: true, title: 'Golos post/comment vote', feature: 'golos-post-page' });
        } catch (error) {
          setStatus(`Ошибка голоса: ${profiles.formatError(error)}`, 'error');
        }
      });
    });
    appEl.querySelectorAll('[data-golos-comment-form]').forEach((form) => {
      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const result = form.querySelector('[data-operation-result]');
        try {
          const author = auth.getCurrentLogin(chain);
          const mode = form.dataset.commentMode === 'edit' ? 'edit' : 'create';
          const parentAuthor = String(form.dataset.parentAuthor || '').trim().replace(/^@/, '');
          const parentPermlink = String(form.dataset.parentPermlink || '').trim();
          const body = String(new FormData(form).get('body') || '').trim();
          if (!body) throw new Error(mode === 'edit' ? 'Текст правки обязателен.' : 'Текст комментария обязателен.');
          const commentAuthor = String(form.dataset.commentAuthor || '').trim().replace(/^@/, '');
          const commentPermlink = String(form.dataset.commentPermlink || '').trim();
          if (mode === 'edit' && commentAuthor !== author) throw new Error('Редактировать можно только комментарии авторизованного аккаунта.');
          const permlink = mode === 'edit' ? commentPermlink : golosCommentPermlink(parentAuthor, parentPermlink);
          if (!permlink) throw new Error('Не удалось определить permlink комментария.');
          const metadata = JSON.stringify({ app: 'dpos.space/v3', format: 'markdown' });
          await ensureBroadcastDependencies(chain);
          const prepared = broadcast.prepare(chain, 'posting', 'comment', [parentAuthor, parentPermlink, author, permlink, '', body, metadata], { title: mode === 'edit' ? 'Golos post page comment edit' : 'Golos post page comment', feature: mode === 'edit' ? 'golos-post-page-comment-edit' : 'golos-post-page-comment' });
          await profiles.connect(chain);
          await broadcast.broadcast(chain, prepared, { dryRun: false, confirmExecute: true });
          if (result) result.textContent = mode === 'edit' ? 'Правка комментария отправлена. Обновите страницу поста после индексации RPC.' : 'Комментарий отправлен. Обновите страницу поста, чтобы увидеть его после индексации RPC.';
          setStatus(mode === 'edit' ? 'Правка комментария отправлена в сеть.' : 'Комментарий отправлен в сеть.', 'ok');
        } catch (error) {
          if (result) result.textContent = profiles.formatError(error);
          setStatus(`Ошибка комментария: ${profiles.formatError(error)}`, 'error');
        }
      });
    });
  }

  const SOCIAL_FEED_KINDS = [
    ['new', 'Новые посты'],
    ['popular', 'Популярное'],
    ['blog', 'Блог аккаунта'],
    ['subscriptions', 'Лента подписок']
  ];

  function isHiveOrSteem(chain) {
    return chain && (chain.id === 'hive' || chain.id === 'steem');
  }

  function socialFeedsSettingsKey(chain) {
    return `dpos_${chain.id}_feeds_settings`;
  }

  function normalizeSocialFeedKind(value) {
    const raw = String(value || '').trim();
    return SOCIAL_FEED_KINDS.some(([id]) => id === raw) ? raw : 'new';
  }

  function readSocialFeedsSettings(chain) {
    if (!global.localStorage) return {};
    try {
      const parsed = JSON.parse(global.localStorage.getItem(socialFeedsSettingsKey(chain)) || '{}');
      if (!parsed || typeof parsed !== 'object') return {};
      return {
        feed: normalizeSocialFeedKind(parsed.feed),
        account: String(parsed.account || '').trim().replace(/^@/, '')
      };
    } catch (error) {
      return {};
    }
  }

  function writeSocialFeedsSettings(chain, settings) {
    if (!global.localStorage) return;
    global.localStorage.setItem(socialFeedsSettingsKey(chain), JSON.stringify({
      feed: normalizeSocialFeedKind(settings && settings.feed),
      account: String(settings && settings.account || '').trim().replace(/^@/, '')
    }));
  }

  function socialPostPageUrl(chain, author, permlink) {
    return `${global.location.origin}${global.location.pathname}${appHash({ chain: chain.id, app: 'post', author: String(author || '').trim().replace(/^@/, ''), permlink: String(permlink || '').trim() })}`;
  }

  function socialExternalPostUrl(chain, author, permlink) {
    const host = chain.id === 'hive' ? 'https://hive.blog' : 'https://steemit.com';
    return `${host}/@${encodeURIComponent(String(author || '').trim().replace(/^@/, ''))}/${encodeURIComponent(String(permlink || '').trim())}`;
  }

  function socialFeedRowTags(row) {
    return golosFeedRowTags(row);
  }

  function socialFeedActionStats(row) {
    const votes = Array.isArray(row && row.active_votes) ? row.active_votes : (Array.isArray(row && row.activeVotes) ? row.activeVotes : []);
    const netVotes = Number(row && (row.net_votes ?? row.netVotes));
    const replies = Number(row && (row.children ?? row.replies));
    const payout = row && (row.pending_payout_value || row.total_payout_value || row.author_payout_value || row.curator_payout_value || row.promoted);
    return [
      `лайков: ${Number.isFinite(netVotes) ? netVotes : votes.length}`,
      Number.isFinite(replies) ? `комментариев: ${replies}` : '',
      payout ? `выплаты: ${history.formatValue(payout)}` : ''
    ].filter(Boolean).join(' · ');
  }

  function renderSocialFeedKindOptions(selected) {
    return SOCIAL_FEED_KINDS.map(([id, label]) => `<option value="${escapeHtml(id)}" ${id === selected ? 'selected' : ''}>${escapeHtml(label)}</option>`).join('');
  }

  async function loadSocialFeedRows(chain, state, connection) {
    const kind = normalizeSocialFeedKind(state.feed);
    const account = String(state.account || auth.getCurrentLogin(chain) || chain.defaultAccount || '').trim().replace(/^@/, '');
    const limit = 20;
    if (kind === 'new') {
      return profiles.apiCall(connection, 'getDiscussionsByCreated', [{ tag: '', limit }]);
    }
    if (kind === 'popular') {
      try {
        return await profiles.apiCall(connection, 'getDiscussionsByHot', [{ tag: '', limit }]);
      } catch (error) {
        return profiles.apiCall(connection, 'getDiscussionsByTrending', [{ tag: '', limit }]);
      }
    }
    if (kind === 'subscriptions') {
      if (!account) throw new Error('Для ленты подписок нужен аккаунт.');
      return profiles.apiCall(connection, 'getDiscussionsByFeed', [{ tag: account, limit }]);
    }
    if (!account) throw new Error('Для блога нужен аккаунт.');
    return profiles.apiCall(connection, 'getDiscussionsByBlog', [{ tag: account, limit }]);
  }

  function renderSocialFeedCard(chain, row) {
    const author = String(row && row.author || '').trim().replace(/^@/, '');
    const permlink = String(row && row.permlink || '').trim();
    if (!author || !permlink) return '';
    const title = golosContentTitle(row, permlink);
    const tags = socialFeedRowTags(row);
    const teaser = markdownToTextPreview(row && row.body, 320);
    const voted = hasGolosVoteFrom(row, auth.getCurrentLogin(chain));
    return `<article class="card social-feed-card" data-social-feed-card data-author="${escapeHtml(author)}" data-permlink="${escapeHtml(permlink)}">
      <h3><a href="${escapeHtml(socialPostPageUrl(chain, author, permlink))}">${escapeHtml(title)}</a></h3>
      <p class="muted">${accountLink(chain, author)} · ${escapeHtml(golosContentDate(row))} · ${escapeHtml(socialFeedActionStats(row))}</p>
      <p>${escapeHtml(teaser)}</p>
      ${tags.length ? `<p class="muted">Теги: ${tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join(', ')}</p>` : ''}
      <p class="actions">
        <button type="button" data-social-feed-vote data-author="${escapeHtml(author)}" data-permlink="${escapeHtml(permlink)}" ${voted ? 'disabled' : ''}>${voted ? 'Вы уже лайкали' : 'Лайк 100%'}</button>
        <button type="button" class="secondary" data-social-feed-repost data-author="${escapeHtml(author)}" data-permlink="${escapeHtml(permlink)}">Репост с подтверждением</button>
        <a href="${escapeHtml(socialExternalPostUrl(chain, author, permlink))}" target="_blank" rel="noopener">Открыть снаружи</a>
      </p>
    </article>`;
  }

  async function renderSocialFeedsPage(chain, state = {}) {
    const storedSettings = readSocialFeedsSettings(chain);
    const hasFeedParam = Object.prototype.hasOwnProperty.call(state, 'feed') && state.feed;
    const hasAccountParam = Object.prototype.hasOwnProperty.call(state, 'account') && state.account;
    const feedKind = normalizeSocialFeedKind(hasFeedParam ? state.feed : storedSettings.feed);
    const account = String(hasAccountParam ? state.account : (storedSettings.account || auth.getCurrentLogin(chain) || chain.defaultAccount || '')).trim().replace(/^@/, '');
    writeSocialFeedsSettings(chain, { feed: feedKind, account });
    const chainTitle = chain.title || chain.id;
    appEl.innerHTML = `<section class="panel social-feeds-page" data-social-feeds-page>
      <h2>${escapeHtml(chainTitle)}: Ленты</h2>
      <p class="muted">Новые посты, популярное, блог аккаунта и лента подписок через публичный ${escapeHtml(chainTitle)} RPC. Действия выполняются только после подтверждения.</p>
      <form id="social-feeds-form" class="stacked-form">
        <div class="field-grid">
          <div class="field"><label for="social-feeds-kind">Тип ленты</label><select id="social-feeds-kind" name="feed" data-social-feed-kind>${renderSocialFeedKindOptions(feedKind)}</select></div>
          <div class="field"><label for="social-feeds-account">Аккаунт для блога/подписок</label><input id="social-feeds-account" name="account" type="text" value="${escapeHtml(account)}" autocomplete="off"></div>
        </div>
        <button type="submit">Показать ленту</button>
      </form>
      <div id="social-feeds-result" role="status" aria-live="polite"><p>Загружаю ленту...</p></div>
    </section>`;
    const form = document.getElementById('social-feeds-form');
    if (form) {
      const persistFormSettings = () => {
        const data = new FormData(form);
        writeSocialFeedsSettings(chain, { feed: data.get('feed'), account: String(data.get('account') || '').trim().replace(/^@/, '') });
      };
      const feedSelect = form.querySelector('[name="feed"]');
      const accountInput = form.querySelector('[name="account"]');
      if (feedSelect) feedSelect.addEventListener('change', persistFormSettings);
      if (accountInput) accountInput.addEventListener('input', persistFormSettings);
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        const data = new FormData(form);
        const selectedAccount = String(data.get('account') || '').trim().replace(/^@/, '');
        writeSocialFeedsSettings(chain, { feed: data.get('feed'), account: selectedAccount });
        navigate({ chain: chain.id, app: 'feeds', feed: data.get('feed'), account: selectedAccount });
      });
    }
    const result = document.getElementById('social-feeds-result');
    try {
      setStatus(`Загружаю ${chainTitle} ленту...`, 'loading');
      const connection = await getConnection(chain);
      const rows = await loadSocialFeedRows(chain, { ...state, feed: feedKind, account }, connection);
      const cards = (Array.isArray(rows) ? rows : []).map((row) => renderSocialFeedCard(chain, row)).filter(Boolean);
      const selectedLabel = (SOCIAL_FEED_KINDS.find(([id]) => id === feedKind) || SOCIAL_FEED_KINDS[0])[1];
      result.innerHTML = cards.length ? `<h3>${escapeHtml(selectedLabel)}</h3>${cards.join('')}` : `<p class="muted">В этой ленте сейчас нет постов.</p>`;
      bindSocialFeedActions(chain);
      setStatus(`${chainTitle} лента «${selectedLabel}» загружена.`, 'ok');
    } catch (error) {
      if (result) result.innerHTML = `<p class="warning">${escapeHtml(profiles.formatError(error))}</p>`;
      setStatus(`Ошибка загрузки ленты ${chainTitle}: ${profiles.formatError(error)}`, 'error');
    }
  }

  function bindSocialFeedActions(chain) {
    appEl.querySelectorAll('[data-social-feed-vote]').forEach((button) => {
      button.addEventListener('click', async () => {
        try {
          const voter = auth.getCurrentLogin(chain);
          const author = String(button.dataset.author || '').trim().replace(/^@/, '');
          const permlink = String(button.dataset.permlink || '').trim();
          const connection = await getConnection(chain);
          const content = await profiles.apiCall(connection, 'getContent', [author, permlink]).catch(() => null);
          if (hasGolosVoteFrom(content, voter)) {
            button.disabled = true;
            button.textContent = 'Вы уже лайкали';
            setStatus(`@${voter} уже голосовал за @${author}/${permlink}.`, 'info');
            return;
          }
          const prepared = broadcast.prepare(chain, 'posting', 'vote', [voter, author, permlink, 10000], { title: `${chain.id} feed vote`, feature: `${chain.id}-feeds` });
          await profiles.connect(chain);
          await broadcast.broadcast(chain, prepared, { dryRun: false, confirmExecute: true });
          button.disabled = true;
          button.textContent = 'Лайк отправлен';
          setStatus('Лайк отправлен в сеть.', 'ok');
        } catch (error) {
          setStatus(`Ошибка лайка: ${profiles.formatError(error)}`, 'error');
        }
      });
    });
    appEl.querySelectorAll('[data-social-feed-repost]').forEach((button) => {
      button.addEventListener('click', async () => {
        try {
          const account = auth.getCurrentLogin(chain);
          const author = String(button.dataset.author || '').trim().replace(/^@/, '');
          const permlink = String(button.dataset.permlink || '').trim();
          if (!account) throw new Error(`Для репоста нужен выбранный сохранённый ${chain.title || chain.id}-аккаунт.`);
          const payload = ['reblog', { account, author, permlink }];
          const prepared = broadcast.prepare(chain, 'posting', 'sendOperations', [[
            ['custom_json', {
              required_auths: [],
              required_posting_auths: [account],
              id: 'follow',
              json: JSON.stringify(payload)
            }]
          ]], { title: `${chain.id} feed repost`, to: author, feature: `${chain.id}-feeds-repost` });
          await profiles.connect(chain);
          await broadcast.broadcast(chain, prepared, { dryRun: false, confirmExecute: true });
          button.disabled = true;
          button.textContent = 'Репост отправлен';
          setStatus('Репост отправлен в сеть.', 'ok');
        } catch (error) {
          setStatus(`Ошибка репоста: ${profiles.formatError(error)}`, 'error');
        }
      });
    });
  }

  async function renderSocialPostPage(chain, state = {}) {
    const author = String(state.author || '').trim().replace(/^@/, '');
    const permlink = String(state.permlink || '').trim();
    if (!author || !permlink) throw new Error('Для страницы поста нужны author и permlink в hash-параметрах.');
    const chainTitle = chain.title || chain.id;
    appEl.innerHTML = `<section class="panel"><h2>Загрузка поста ${escapeHtml(chainTitle)}</h2><p>Подключаю публичную ноду...</p></section>`;
    setStatus(`Загружаю пост @${author}/${permlink}...`, 'loading');
    const connection = await getConnection(chain);
    const post = await profiles.apiCall(connection, 'getContent', [author, permlink]);
    if (!post || !post.author) throw new Error(`Пост @${author}/${permlink} не найден.`);
    const replies = await loadSocialRepliesTree(connection, author, permlink, 0, 4);
    const currentLogin = auth.getCurrentLogin(chain);
    await loadScript(chain.cryptoPath);
    const promotionInfo = await fetchPostPromotionInfo(chain, connection, currentLogin);
    const voted = hasGolosVoteFrom(post, currentLogin);
    const canEditPost = (chain.id === 'golos' || isHiveOrSteem(chain)) && currentLogin && String(post.author || author).toLowerCase() === String(currentLogin).toLowerCase();
    const editPostLink = canEditPost ? appHash({ chain: chain.id, app: 'editor', author: post.author || author, permlink: post.permlink || permlink }) : '';
    appEl.innerHTML = `<section class="panel social-post-page" data-social-post-page>
      <article class="card">
        <h2>${escapeHtml(golosContentTitle(post, permlink))}</h2>
        <p class="muted">${accountLink(chain, post.author || author)} · ${escapeHtml(golosContentDate(post))} · <code>${escapeHtml(post.permlink || permlink)}</code> · ${escapeHtml(socialFeedActionStats(post))}</p>
        <div class="markdown-preview post-body">${markdownToPreviewHtml(post.body || '', chain)}</div>
        <div class="actions">
          ${renderPostVoteForm('social-post', author, permlink, voted)}
          ${renderPostPromotionForm(chain, author, permlink, promotionInfo)}
          ${editPostLink ? `<a href="${escapeHtml(editPostLink)}">Редактировать</a>` : ''}
          <a href="${escapeHtml(socialExternalPostUrl(chain, author, permlink))}" target="_blank" rel="noopener">Открыть снаружи</a>
        </div>
      </article>
      <section class="card" aria-labelledby="social-post-comment-heading">
        <h3 id="social-post-comment-heading">Добавить комментарий</h3>
        ${renderSocialCommentForm('social-comment-form', author, permlink)}
      </section>
      <section class="card" aria-labelledby="social-post-comments-heading">
        <h3 id="social-post-comments-heading">Комментарии</h3>
        ${renderSocialCommentsList(chain, replies)}
      </section>
    </section>`;
    bindSocialPostActions(chain);
    setStatus(`Пост @${author}/${permlink} загружен.`, 'ok');
  }

  async function loadSocialRepliesTree(connection, author, permlink, depth, maxDepth) {
    if (depth >= maxDepth) return [];
    const rows = await profiles.apiCall(connection, 'getContentReplies', [author, permlink]).catch(() => []);
    const replies = Array.isArray(rows) ? rows : [];
    for (const reply of replies) {
      reply.children = await loadSocialRepliesTree(connection, reply.author, reply.permlink, depth + 1, maxDepth);
    }
    return replies;
  }

  function renderSocialCommentsList(chain, comments) {
    if (!Array.isArray(comments) || !comments.length) return '<p class="muted">Комментариев пока нет.</p>';
    return `<ul class="comment-tree">${comments.map((comment) => renderSocialCommentNode(chain, comment)).join('')}</ul>`;
  }

  function renderSocialCommentNode(chain, comment) {
    const author = String(comment && comment.author || '').trim().replace(/^@/, '');
    const permlink = String(comment && comment.permlink || '').trim();
    const parentAuthor = String(comment && comment.parent_author || '').trim().replace(/^@/, '');
    const parentPermlink = String(comment && comment.parent_permlink || '').trim();
    const title = golosContentTitle(comment, permlink);
    const currentLogin = auth.getCurrentLogin(chain);
    const canEdit = Boolean(author && permlink && String(author).toLowerCase() === String(currentLogin || '').toLowerCase());
    const voted = hasGolosVoteFrom(comment, currentLogin);
    const children = Array.isArray(comment && comment.children) && comment.children.length ? renderSocialCommentsList(chain, comment.children) : '';
    const editButton = canEdit ? `<button type="button" data-social-comment-edit data-author="${escapeHtml(author)}" data-permlink="${escapeHtml(permlink)}">Редактировать комментарий</button>` : '';
    const editForm = canEdit ? `<div class="reply-slot" hidden data-social-comment-edit-slot>${renderSocialCommentForm(`social-edit-form-${escapeHtml(author)}-${escapeHtml(permlink)}`.replace(/[^a-zA-Z0-9_-]/g, '-'), parentAuthor, parentPermlink, { mode: 'edit', author, permlink, body: comment.body || '' })}</div>` : '';
    return `<li class="comment-node" data-comment-author="${escapeHtml(author)}" data-comment-permlink="${escapeHtml(permlink)}">
      <article>
        <p><strong>${accountLink(chain, author)}</strong> · <span class="muted">${escapeHtml(golosContentDate(comment))}</span> · <a href="${escapeHtml(socialPostPageUrl(chain, author, permlink))}" target="_blank" rel="noopener">${escapeHtml(author)}/${escapeHtml(title)}</a></p>
        <div class="markdown-preview comment-body">${markdownToPreviewHtml(comment.body || '', chain)}</div>
        <div class="actions">
          ${renderPostVoteForm('social-post', author, permlink, voted)}
          <button type="button" data-social-comment-reply data-author="${escapeHtml(author)}" data-permlink="${escapeHtml(permlink)}">Ответить</button>
          ${editButton}
        </div>
        <div class="reply-slot" hidden>${renderSocialCommentForm(`social-reply-form-${escapeHtml(author)}-${escapeHtml(permlink)}`.replace(/[^a-zA-Z0-9_-]/g, '-'), author, permlink)}</div>
        ${editForm}
      </article>
      ${children}
    </li>`;
  }

  function renderSocialCommentForm(formId, parentAuthor, parentPermlink, options = {}) {
    const mode = options.mode === 'edit' ? 'edit' : 'create';
    const buttonText = mode === 'edit' ? 'Сохранить правку комментария с подтверждением' : 'Отправить комментарий с подтверждением';
    const labelText = mode === 'edit' ? 'Текст Markdown для правки' : 'Текст Markdown';
    return `<form id="${escapeHtml(formId)}" class="stacked-form" data-social-comment-form ${mode === 'edit' ? 'data-social-comment-edit-form' : ''} data-parent-author="${escapeHtml(parentAuthor)}" data-parent-permlink="${escapeHtml(parentPermlink)}" data-comment-mode="${escapeHtml(mode)}" data-comment-author="${escapeHtml(options.author || '')}" data-comment-permlink="${escapeHtml(options.permlink || '')}">
      <div class="field"><label for="${escapeHtml(formId)}-body">${escapeHtml(labelText)}</label><textarea id="${escapeHtml(formId)}-body" name="body" rows="5" required>${escapeHtml(options.body || '')}</textarea></div>
      <button type="submit">${escapeHtml(buttonText)}</button>
      <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
    </form>`;
  }

  function socialCommentPermlink(parentAuthor, parentPermlink) {
    const stamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
    return `re-${String(parentAuthor || '').replace(/[^a-z0-9-]/gi, '').toLowerCase()}-${String(parentPermlink || '').replace(/[^a-z0-9-]/gi, '').toLowerCase().slice(0, 32)}-${stamp}`.slice(0, 255);
  }

  function bindSocialPostActions(chain) {
    bindVotePercentOutputs(appEl);
    bindPostPromotionActions(chain);
    appEl.querySelectorAll('[data-social-comment-reply]').forEach((button) => {
      button.addEventListener('click', () => {
        const slot = button.closest('article') && button.closest('article').querySelector('.reply-slot');
        if (slot) slot.hidden = !slot.hidden;
      });
    });
    appEl.querySelectorAll('[data-social-comment-edit]').forEach((button) => {
      button.addEventListener('click', () => {
        const slot = button.closest('article') && button.closest('article').querySelector('[data-social-comment-edit-slot]');
        if (slot) slot.hidden = !slot.hidden;
      });
    });
    appEl.querySelectorAll('[data-social-post-vote-form]').forEach((form) => {
      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        try {
          await submitPostVote(chain, form, { title: `${chain.id} post/comment vote`, feature: `${chain.id}-post-page` });
        } catch (error) {
          setStatus(`Ошибка голоса: ${profiles.formatError(error)}`, 'error');
        }
      });
    });
    appEl.querySelectorAll('[data-social-comment-form]').forEach((form) => {
      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const result = form.querySelector('[data-operation-result]');
        try {
          const author = auth.getCurrentLogin(chain);
          const mode = form.dataset.commentMode === 'edit' ? 'edit' : 'create';
          const parentAuthor = String(form.dataset.parentAuthor || '').trim().replace(/^@/, '');
          const parentPermlink = String(form.dataset.parentPermlink || '').trim();
          const body = String(new FormData(form).get('body') || '').trim();
          if (!body) throw new Error(mode === 'edit' ? 'Текст правки обязателен.' : 'Текст комментария обязателен.');
          const commentAuthor = String(form.dataset.commentAuthor || '').trim().replace(/^@/, '');
          const commentPermlink = String(form.dataset.commentPermlink || '').trim();
          if (mode === 'edit' && String(commentAuthor).toLowerCase() !== String(author || '').toLowerCase()) throw new Error('Редактировать можно только комментарии авторизованного аккаунта.');
          const permlink = mode === 'edit' ? commentPermlink : socialCommentPermlink(parentAuthor, parentPermlink);
          if (!permlink) throw new Error('Не удалось определить permlink комментария.');
          const metadata = JSON.stringify({ app: 'dpos.space/v3', format: 'markdown' });
          const prepared = broadcast.prepare(chain, 'posting', 'comment', [parentAuthor, parentPermlink, author, permlink, '', body, metadata], { title: mode === 'edit' ? `${chain.id} post page comment edit` : `${chain.id} post page comment`, feature: mode === 'edit' ? `${chain.id}-post-page-comment-edit` : `${chain.id}-post-page-comment` });
          await profiles.connect(chain);
          await broadcast.broadcast(chain, prepared, { dryRun: false, confirmExecute: true });
          if (result) result.textContent = mode === 'edit' ? 'Правка комментария отправлена. Обновите страницу поста после индексации RPC.' : 'Комментарий отправлен. Обновите страницу поста, чтобы увидеть его после индексации RPC.';
          setStatus(mode === 'edit' ? 'Правка комментария отправлена в сеть.' : 'Комментарий отправлен в сеть.', 'ok');
        } catch (error) {
          if (result) result.textContent = profiles.formatError(error);
          setStatus(`Ошибка комментария: ${profiles.formatError(error)}`, 'error');
        }
      });
    });
  }

  async function renderGolosDonate(chain, state = {}) {
    let assets = [];
    try {
      const connection = await getConnection(chain);
      const api = connection.client && connection.client.api;
      assets = api && typeof api.getAssetsAsync === 'function' ? await fetchAllGolosAssets(api, 200) : [];
    } catch (error) {
      console.warn('Golos donate token list was not loaded:', error);
    }
    const selectedToken = state.token || chain.liquidSymbol || 'GOLOS';
    const to = state.to || '';
    const amount = state.amount || '';
    const link = golosDonationPageUrl({ to, token: selectedToken, amount });
    appEl.innerHTML = `
      <section class="panel">
        <h2>Golos: донат</h2>
        <p>Донат GOLOS/GBG/UIA через posting authority: сначала проверка операции, затем отправка по подтверждению.</p>
        <form id="golos-donate-form" class="stacked-form">
          <fieldset>
            <legend>Донат</legend>
            <div class="field"><label for="donate-to">Получатель</label><input id="donate-to" name="to" type="text" required autocomplete="off" value="${escapeHtml(to)}"></div>
            <div class="field"><label for="donate-token">Токен</label><select id="donate-token" name="token">${golosDonateAssetOptions(assets, selectedToken)}</select></div>
            <div class="field"><label for="donate-amount">Сумма</label><input id="donate-amount" name="amount" type="text" required placeholder="1.000" value="${escapeHtml(amount)}"></div>
            <div class="field"><label for="donate-memo">Комментарий</label><textarea id="donate-memo" name="memo" rows="4">${escapeHtml(link ? `Донат со страницы ${link}` : '')}</textarea></div>
            <button type="submit" name="intent" value="preview">Проверить донат</button>
            <button type="submit" name="intent" value="send">Отправить донат в сеть</button>
            <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
          </fieldset>
        </form>
        <section class="subpanel" aria-labelledby="donate-link-heading">
          <h3 id="donate-link-heading">Ссылка для доната</h3>
          <p class="muted">Как в legacy donate, ссылку можно дать получателю/донатору; v3 использует hash-параметры и не требует серверного маршрута.</p>
          <div class="field"><label for="donate-link">Готовая ссылка</label><textarea id="donate-link" rows="2" readonly>${escapeHtml(link)}</textarea></div>
          <button type="button" data-copy-value="${escapeHtml(link)}">Скопировать</button>
        </section>
      </section>`;
    bindCopyButtons(appEl);
    bindOperationForm(chain, 'golos-donate-form', async (form) => {
      const toAccount = normalizeAccountInput(chain, form.get('to'), 'Получатель доната');
      const token = normalizeGolosTokenSymbol(form.get('token'), 'Токен доната');
      const amountValue = await normalizeGolosTokenAmount(chain, form.get('amount'), token, 'Сумма доната');
      let memo = String(form.get('memo') || '');
      if (memo[0] === '#') {
        memo = await encodeGolosMemoIfNeeded(chain, toAccount, memo, broadcast.prepare(chain, 'active', 'transfer', [auth.getCurrentLogin(chain), toAccount, amountValue, ''], {}).getPrivateKey());
      }
      return broadcast.prepare(chain, 'posting', 'donate', [
        auth.getCurrentLogin(chain),
        toAccount,
        amountValue,
        { app: 'dpos-space', version: 1, comment: memo, target: { type: 'personal_donate' } },
        []
      ]);
    });
    setStatus('Golos-донат готов: проверка или отправка по подтверждению.', 'ok');
  }

  const GOLOS_EDITOR_CATEGORIES = [
    ['ru--avto', 'авто'], ['ru--biznes', 'бизнес'], ['ru--blokcheijn', 'блокчейн'], ['ru--golos', 'голос'],
    ['ru--dom', 'дом'], ['ru--eda', 'еда'], ['ru--zhiznx', 'жизнь'], ['ru--zdorovxe', 'здоровье'],
    ['ru--igry', 'игры'], ['ru--iskusstvo', 'искусство'], ['ru--istoriya', 'история'], ['ru--kino', 'кино'],
    ['ru--kompxyutery', 'компьютеры'], ['ru--konkursy', 'конкурсы'], ['ru--kriptovalyuty', 'криптовалюты'],
    ['ru--kulxtura', 'культура'], ['ru--literatura', 'литература'], ['ru--mediczina', 'медицина'],
    ['ru--muzyka', 'музыка'], ['ru--nauka', 'наука'], ['ru--nepoznannoe', 'непознанное'], ['ru--obrazovanie', 'образование'],
    ['ru--politika', 'политика'], ['ru--pravo', 'право'], ['ru--priroda', 'природа'], ['ru--psikhologiya', 'психология'],
    ['ru--puteshestviya', 'путешествия'], ['ru--rabota', 'работа'], ['ru--religiya', 'религия'], ['ru--semxya', 'семья'],
    ['ru--sport', 'спорт'], ['ru--tvorchestvo', 'творчество'], ['ru--tekhnologii', 'технологии'], ['ru--treijding', 'трейдинг'],
    ['ru--fotografiya', 'фотография'], ['ru--khobbi', 'хобби'], ['ru--yekonomika', 'экономика'], ['ru--yumor', 'юмор'],
    ['ru--prochee', 'прочее'], ['en', 'en'], ['nsfw', 'nsfw']
  ];

  const GOLOS_TRANSLIT = {
    а: 'a', б: 'b', в: 'v', ґ: 'g', г: 'g', д: 'd', е: 'e', ё: 'yo', є: 'ye', ж: 'zh', з: 'z',
    и: 'i', і: 'i', ї: 'yi', й: 'ij', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
    с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'cz', ч: 'ch', ш: 'sh', щ: 'shch', ъ: 'xx',
    ы: 'y', ь: 'x', э: 'ye', ю: 'yu', я: 'ya'
  };

  function golosLegacyTransform(value, spaceReplacement) {
    let result = '';
    let hasCyrillic = false;
    String(value || '').split('').forEach((char) => {
      const lower = char.toLowerCase();
      if (lower === ' ' && spaceReplacement) {
        result += spaceReplacement;
      } else if (GOLOS_TRANSLIT[lower]) {
        result += GOLOS_TRANSLIT[lower];
        hasCyrillic = true;
      } else {
        result += lower;
      }
    });
    result = result.replace(/[^a-z0-9-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    return `${hasCyrillic ? 'ru--' : ''}${result}`;
  }

  function normalizeGolosEditorTags(rawTags) {
    const tags = String(rawTags || '').split(/\s+/)
      .map((tag) => golosLegacyTransform(tag, '-'))
      .filter(Boolean);
    if (!tags.includes('dpos-post')) tags.push('dpos-post');
    return tags;
  }

  function golosEditorCategoryOptions(selected) {
    const current = selected || 'ru--golos';
    return GOLOS_EDITOR_CATEGORIES.map(([value, label]) => (
      `<option value="${escapeHtml(value)}" ${value === current ? 'selected' : ''}>${escapeHtml(label)}</option>`
    )).join('');
  }

  function normalizeEditorBeneficiaries(extraAccount, extraWeight) {
    const beneficiaries = [{ account: 'denis-skripnik', weight: 100 }];
    const account = String(extraAccount || '').trim().replace(/^@/, '');
    const weightPercent = Number(extraWeight || 0);
    if (account && Number.isFinite(weightPercent) && weightPercent > 0) {
      const weight = Math.min(9900, Math.round(weightPercent * 100));
      if (account !== 'denis-skripnik') beneficiaries.push({ account, weight });
    }
    return beneficiaries.sort((a, b) => a.account.localeCompare(b.account));
  }

  function buildGolosEditorOperations(chain, form, formElement) {
    const title = String(form.get('title') || '').trim();
    const tags = normalizeGolosEditorTags(form.get('tags'));
    const manualPermlink = String(form.get('permlink') || '').trim();
    const permlink = manualPermlink ? manualPermlink : golosLegacyTransform(title, '-');
    const category = String(form.get('category') || 'ru--golos').trim() || 'ru--golos';
    const image = String(form.get('image') || '').trim();
    const images = image ? [image] : [];
    const payoutPercent = Number(form.get('payouts') || 10000);
    const curationPercent = Math.max(0, Math.min(10000, Math.round(Number(form.get('curation_percent') || 50) * 100)));
    const beneficiaries = normalizeEditorBeneficiaries(form.get('beneficiary_account'), form.get('beneficiary_weight'));
    const author = auth.getCurrentLogin(chain);
    const editStateForm = formElement || (form && form.dataset ? form : null);
    const isEdit = editStateForm && editStateForm.dataset && editStateForm.dataset.golosEditMode === 'true';
    const editAuthor = String(editStateForm && editStateForm.dataset && editStateForm.dataset.golosEditAuthor || '').trim().replace(/^@/, '');
    if (isEdit && editAuthor && editAuthor !== author) {
      throw new Error('Редактировать можно только пост текущего авторизованного аккаунта.');
    }
    const commentOperation = ['comment', {
      parent_author: '',
      parent_permlink: category,
      author,
      permlink,
      title,
      body: String(form.get('body') || ''),
      json_metadata: JSON.stringify({ app: 'dpos.space/post', format: 'markdown', tags, image: images })
    }];
    if (isEdit) return [commentOperation];
    return [
      commentOperation,
      ['comment_options', {
        author,
        permlink,
        max_accepted_payout: '1000000.000 GBG',
        percent_steem_dollars: payoutPercent,
        allow_votes: true,
        allow_curation_rewards: true,
        extensions: [[0, { beneficiaries }], [2, { percent: curationPercent }]]
      }]
    ];
  }

  function buildGenericEditorOperations(chain, form, formElement) {
    const debt = chain.debtSymbol || 'HBD';
    const author = auth.getCurrentLogin(chain);
    const tags = String(form.get('tags') || '').split(/\s+/).filter(Boolean);
    if (!tags.includes('dpos-post')) tags.push('dpos-post');
    const manualPermlink = String(form.get('permlink') || '').trim();
    const title = String(form.get('title') || '').trim();
    const permlink = manualPermlink || golosLegacyTransform(title, '-');
    const category = String(form.get('category') || tags[0] || 'dpos-post').trim() || 'dpos-post';
    const image = String(form.get('image') || '').trim().replace(/\s/g, '');
    const images = image ? image.split(',').map((item) => item.trim()).filter(Boolean) : [];
    const payoutPercent = Math.max(0, Math.min(10000, Math.round(Number(form.get('payouts') || 10000))));
    const beneficiaries = normalizeEditorBeneficiaries(form.get('beneficiary_account'), form.get('beneficiary_weight'));
    const metadata = { tags, app: chain.id === 'steem' ? 'dpos.space/post' : 'dpos.space/v3', format: 'markdown', image: images };
    const editStateForm = formElement || (form && form.dataset ? form : null);
    const isEdit = editStateForm && editStateForm.dataset && editStateForm.dataset.golosEditMode === 'true';
    const editAuthor = String(editStateForm && editStateForm.dataset && editStateForm.dataset.golosEditAuthor || '').trim().replace(/^@/, '');
    if (isEdit && editAuthor && editAuthor !== author) {
      throw new Error('Редактировать можно только пост текущего авторизованного аккаунта.');
    }
    const commentOperation = ['comment', {
      parent_author: '',
      parent_permlink: category,
      author,
      permlink,
      title,
      body: String(form.get('body') || ''),
      json_metadata: JSON.stringify(metadata)
    }];
    if (isEdit) return [commentOperation];
    const operations = [
      commentOperation,
      ['comment_options', {
        author,
        permlink,
        max_accepted_payout: `1000000.000 ${debt}`,
        percent_steem_dollars: chain.id === 'steem' ? payoutPercent : undefined,
        percent_hbd: chain.id === 'hive' ? payoutPercent : undefined,
        allow_votes: true,
        allow_curation_rewards: true,
        extensions: [[0, { beneficiaries }]]
      }]
    ];
    return operations.map(([name, payload]) => [name, Object.fromEntries(Object.entries(payload).filter(([, value]) => typeof value !== 'undefined'))]);
  }

  function parseSocialPostUrl(value) {
    const text = String(value || '').trim();
    const match = text.match(/@([^/\s]+)\/([^/?#\s]+)/);
    if (!match) throw new Error('Ссылка должна содержать @author/permlink.');
    return { author: match[1].replace(/^@/, ''), permlink: match[2].replace(/\/$/, '') };
  }

  function editorInitialEditUrl(chain, state = {}) {
    if (chain.id !== 'golos' && !isHiveOrSteem(chain)) return '';
    const explicit = String(state.edit || state.url || '').trim();
    if (explicit) return explicit;
    const author = String(state.author || '').trim().replace(/^@/, '');
    const permlink = String(state.permlink || '').trim();
    const host = chain.id === 'hive' ? 'hive.blog' : chain.id === 'steem' ? 'steemit.com' : 'golos.id';
    return author && permlink ? `https://${host}/@${author}/${permlink}` : '';
  }

  function editorAutoLoadEdit(input, button) {
    if (!input || !button || !input.value) return;
    setTimeout(() => button.click(), 0);
  }

  async function updateGolosEditorPostQuota(chain) {
    if (chain.id !== 'golos') return;
    const quotaEl = document.getElementById('editor-post-quota');
    if (!quotaEl) return;
    const login = auth.getCurrentLogin(chain);
    if (!login) {
      quotaEl.textContent = 'Выберите Golos-аккаунт, чтобы увидеть лимит постов без штрафа.';
      return;
    }

    quotaEl.textContent = `Проверяю лимит постов без штрафа для @${login}...`;
    try {
      const connection = await getConnection(chain);
      const rawAccount = await profiles.fetchAccount(connection, login);
      const enrichedAccount = await profiles.enrichAccount(connection, rawAccount);
      const quota = profiles.computeGolosPostQuota(enrichedAccount);
      quotaEl.textContent = quota
        ? `Можно опубликовать без штрафа: ${quota.text}`
        : 'Не удалось рассчитать лимит постов без штрафа: в ответе аккаунта нет post_bandwidth/last_post.';
    } catch (error) {
      quotaEl.textContent = `Не удалось рассчитать лимит постов без штрафа: ${profiles.formatError(error)}`;
    }
  }

  function editorPostQuotaNotice(chain) {
    if (chain.id !== 'golos') return '';
    return '<p id="editor-post-quota" class="notice" role="status" aria-live="polite">Проверяю лимит постов без штрафа...</p>';
  }

  function parseSteemPostUrl(value) {
    return parseSocialPostUrl(value);
  }

  function applyEditorDraftToForm(form, draft) {
    if (!form || !draft) return;
    const set = (name, value) => {
      const field = form.elements.namedItem(name);
      if (field && typeof field.value !== 'undefined') field.value = value || '';
    };
    set('title', draft.title);
    set('tags', draft.tags);
    set('image', draft.image);
    set('permlink', draft.permlink);
    set('body', draft.body);
    if (draft.category) set('category', draft.category);
    if (Object.prototype.hasOwnProperty.call(draft, 'payouts')) set('payouts', draft.payouts);
  }

  function setEditorEditOnlyVisibility(form, isEdit) {
    if (!form) return;
    form.querySelectorAll('[data-editor-edit-hidden]').forEach((element) => {
      element.hidden = Boolean(isEdit);
      element.setAttribute('aria-hidden', isEdit ? 'true' : 'false');
      element.querySelectorAll('input, select, textarea, button').forEach((control) => {
        control.disabled = Boolean(isEdit);
      });
    });
  }

  function bindSteemPostLegacyHelpers(chain) {
    if (chain.id !== 'steem' && chain.id !== 'hive') return;
    const form = document.getElementById('editor-form');
    const fileInput = document.getElementById('editor-md-file');
    const loadButton = document.getElementById('editor-load-edit');
    const editUrl = document.getElementById('editor-edit-url');
    const status = document.getElementById('editor-helper-status');
    const report = (message) => { if (status) status.textContent = message; };

    if (form) {
      form.addEventListener('reset', () => {
        form.dataset.golosEditMode = 'false';
        form.dataset.golosEditAuthor = '';
        setEditorEditOnlyVisibility(form, false);
        report('Форма очищена, режим редактирования выключен.');
      });
    }

    if (fileInput && form) {
      fileInput.addEventListener('change', () => {
        const file = fileInput.files && fileInput.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          const lines = String(reader.result || '').split(/\r?\n/);
          applyEditorDraftToForm(form, {
            title: lines[0] || '',
            tags: lines[1] || '',
            body: lines.slice(2).join('\n')
          });
          report('Markdown файл загружен в редактор локально.');
        };
        reader.onerror = () => report('Не удалось прочитать markdown файл.');
        reader.readAsText(file);
      });
    }

    if (loadButton && editUrl && form) {
      loadButton.addEventListener('click', async () => {
        try {
          const target = parseSocialPostUrl(editUrl.value);
          const current = auth.getCurrentLogin(chain);
          if (target.author !== current) throw new Error('Редактировать можно только пост текущего авторизованного аккаунта.');
          const connection = await getConnection(chain);
          const api = connection.client && connection.client.api;
          let post;
          if (api && typeof api.getContentAsync === 'function') {
            post = await api.getContentAsync(target.author, target.permlink);
          } else if (api && typeof api.getContent === 'function') {
            post = await new Promise((resolve, reject) => api.getContent(target.author, target.permlink, (err, result) => err ? reject(err) : resolve(result)));
          } else {
            throw new Error(`Public RPC getContent недоступен в браузерной библиотеке ${chain.title}.`);
          }
          if (!post || !post.author) throw new Error('Пост не найден через публичный RPC.');
          let metadata = {};
          try { metadata = JSON.parse(post.json_metadata || '{}'); } catch (error) { metadata = {}; }
          applyEditorDraftToForm(form, {
            title: post.title,
            tags: Array.isArray(metadata.tags) ? metadata.tags.join(' ') : '',
            image: Array.isArray(metadata.image) ? metadata.image.join(',') : '',
            permlink: post.permlink,
            body: post.body,
            category: metadata.tags && metadata.tags[0] || post.parent_permlink,
            payouts: chain.id === 'hive' ? post.percent_hbd : post.percent_steem_dollars
          });
          form.dataset.golosEditMode = 'true';
          form.dataset.golosEditAuthor = target.author;
          setEditorEditOnlyVisibility(form, true);
          report(`Пост @${target.author}/${target.permlink} загружен через публичный RPC. При отправке будет broadcast comment без comment_options.`);
        } catch (error) {
          report(profiles.formatError(error));
        }
      });
    }
  }

  function bindGolosPostLegacyHelpers(chain) {
    if (chain.id !== 'golos') return;
    const form = document.getElementById('editor-form');
    const loadButton = document.getElementById('editor-load-edit');
    const editUrl = document.getElementById('editor-edit-url');
    const status = document.getElementById('editor-helper-status');
    const report = (message) => { if (status) status.textContent = message; };
    if (!form) return;
    form.addEventListener('reset', () => {
      delete form.dataset.golosEditMode;
      delete form.dataset.golosEditAuthor;
      setEditorEditOnlyVisibility(form, false);
      report('Форма очищена, режим редактирования выключен.');
    });
    if (!loadButton || !editUrl) return;
    loadButton.addEventListener('click', async () => {
      try {
        const target = parseSocialPostUrl(editUrl.value);
        const current = auth.getCurrentLogin(chain);
        if (target.author !== current) throw new Error('Редактировать можно только пост текущего авторизованного аккаунта.');
        const connection = await getConnection(chain);
        const post = await profiles.apiCall(connection, 'getContent', [target.author, target.permlink]);
        if (!post || !post.author) throw new Error('Пост не найден через публичный RPC.');
        let metadata = {};
        try { metadata = JSON.parse(post.json_metadata || '{}'); } catch (error) { metadata = {}; }
        applyEditorDraftToForm(form, {
          title: post.title,
          tags: Array.isArray(metadata.tags) ? metadata.tags.join(' ') : '',
          image: Array.isArray(metadata.image) ? metadata.image.join(',') : '',
          permlink: post.permlink,
          body: post.body,
          category: post.parent_permlink || metadata.tags && metadata.tags[0],
          payouts: post.percent_steem_dollars
        });
        form.dataset.golosEditMode = 'true';
        form.dataset.golosEditAuthor = target.author;
        setEditorEditOnlyVisibility(form, true);
        report(`Пост загружен для редактирования: @${target.author}/${target.permlink}. При отправке будет broadcast comment без comment_options.`);
      } catch (error) {
        report(profiles.formatError(error));
      }
    });
  }

  function renderEditor(chain, state) {
    let draft = null;
    try { draft = JSON.parse(localStorage.getItem(`${chain.id}_v3_import_draft`) || 'null'); } catch (error) { draft = null; }
    const isGolos = chain.id === 'golos';
    const initialEditUrl = editorInitialEditUrl(chain, state || {});
    appEl.innerHTML = `
      <section class="panel">
        <h2>${escapeHtml(chain.title)}: редактор</h2>
        <p>Редактор публикаций: подготовка поста, проверка операции и отправка по подтверждению.</p>
        ${editorPostQuotaNotice(chain)}
        <details id="editor-operation-details" class="operation-details"><summary>Публикация поста — preview перед отправкой</summary><form id="editor-form" class="stacked-form" data-golos-edit-mode="false" data-golos-edit-author="">
          <fieldset>
            <legend>Публикация поста</legend>
            <div class="field"><label for="editor-title">Заголовок</label><input id="editor-title" name="title" type="text" required value="${escapeHtml(draft && draft.title ? draft.title : '')}"></div>
            ${isGolos ? `<div class="field"><label for="editor-category">Категория</label><select id="editor-category" name="category">${golosEditorCategoryOptions(draft && draft.category)}</select></div>` : ''}
            <div class="field"><label for="editor-permlink">Permlink</label><input id="editor-permlink" name="permlink" type="text" ${isGolos ? 'placeholder="пусто = сгенерировать из заголовка"' : 'placeholder="пусто = сгенерировать из заголовка"'}></div>
            ${chain.id === 'hive' ? `<div class="field"><label for="editor-category">Сообщество / parent_permlink</label><select id="editor-category" name="category"><option value="hive-142159">Black And White</option><option value="hive-194913">Photography Lovers</option><option value="hive-158694">Alien Art Hive</option><option value="hive-155530">Wednesday Walk</option><option value="hive-117778">CCH</option><option value="hive-119845">Photography</option><option value="hive-127788">Amazing Nature</option><option value="hive-106444">PhotoFeed</option><option value="hive-151327">FungiFriday</option><option value="hive-179017">Shadow Hunters</option><option value="hive-142821">Photographic Society</option><option value="hive-167922">LeoFinance</option><option value="hive-120078">Natural Medicine</option><option value="dpos-post" selected>dpos-post / без сообщества</option></select></div>` : ''}
            ${isGolos ? `<details class="subpanel" ${initialEditUrl ? 'open' : ''}><summary>Редактировать существующий Golos пост</summary><div class="field"><label for="editor-edit-url">Ссылка на пост</label><input id="editor-edit-url" type="url" placeholder="https://golos.id/tag/@user/permlink" value="${escapeHtml(initialEditUrl)}"></div><button id="editor-load-edit" type="button">Загрузить в редактор</button><p id="editor-helper-status" role="status" aria-live="polite">${initialEditUrl ? 'Загружаю пост из URL редактора...' : ''}</p><p class="muted">Можно открыть редактор напрямую: #chain=golos&amp;app=editor&amp;author=user&amp;permlink=post. Загрузится только пост текущего выбранного аккаунта. При отправке редактирования будет создана только операция comment, без повторного comment_options.</p></details>` : ''}
            ${(chain.id === 'steem' || chain.id === 'hive') ? `<details class="subpanel" ${initialEditUrl ? 'open' : ''}><summary>Загрузить legacy markdown или редактировать пост</summary><div class="field"><label for="editor-md-file">Загрузить файл *.md</label><input id="editor-md-file" type="file" accept=".md,text/markdown,text/plain"></div><p class="muted">Формат: Первая строка - заголовок; вторая - теги через пробел; третья и последующие - текст поста.</p><div class="field"><label for="editor-edit-url">Редактировать пост (введите ссылку)</label><input id="editor-edit-url" type="url" placeholder="https://${chain.id === 'hive' ? 'hive.blog' : 'steemit.com'}/tag/@user/permlink" value="${escapeHtml(initialEditUrl)}"></div><button id="editor-load-edit" type="button">Загрузить в редактор</button><p id="editor-helper-status" role="status" aria-live="polite">${initialEditUrl ? 'Загружаю пост из URL редактора...' : ''}</p><p class="muted">Static-safe: legacy SimpleMDE/Garlic не копируются; фото можно загрузить кнопкой «Загрузить фото» в Markdown-панели. При отправке редактирования будет создана только операция comment, без повторного comment_options.</p></details>` : ''}
            <div class="field"><label for="editor-tags">Теги через пробел</label><input id="editor-tags" name="tags" type="text" placeholder="dpos space" value="${escapeHtml(draft && draft.tags ? draft.tags : '')}"></div>
            ${chain.id === 'steem' ? `<details class="subpanel"><summary>Популярные legacy теги</summary><p><button type="button" data-copy-value="liga-avtorov">Лига авторов</button> <button type="button" data-copy-value="vp-liganovi4kov">Лига новичков</button> <button type="button" data-copy-value="ladyzarulem">ladyzarulem</button> <button type="button" data-copy-value="psk">psk</button> <button type="button" data-copy-value="chaos-legion">Легион хаоса</button> <button type="button" data-copy-value="ru--megagalxyan">Мегагальян</button> <button type="button" data-copy-value="botbod">Проект БОД</button> <button type="button" data-copy-value="boonmood">boonmood</button> <button type="button" data-copy-value="steem">Steem</button> <button type="button" data-copy-value="blockchain">Блокчейн</button> <button type="button" data-copy-value="vox-populi">vox-populi</button> <button type="button" data-copy-value="earth-citizens">Граждане Земли</button></p><p class="muted">Нажатие копирует тег; вставьте нужные теги в поле выше. dpos-post добавляется автоматически.</p></details>` : ''}
            ${!isGolos ? `<div class="field"><label for="editor-image">Изображение превью</label><input id="editor-image" name="image" type="url" placeholder="https://..."></div>` : ''}
            ${isGolos ? `<div class="field"><label for="editor-image">Изображение превью</label><input id="editor-image" name="image" type="url" placeholder="https://..."></div>` : ''}
            ${renderMarkdownEditorField(draft && draft.body ? draft.body : '')}
            ${!isGolos ? `<div class="field" data-editor-edit-hidden><label for="editor-payouts">Режим выплаты</label><select id="editor-payouts" name="payouts"><option value="10000" selected>50% в ${escapeHtml(chain.debtSymbol || 'HBD')} и ${escapeHtml(chain.liquidSymbol || 'HIVE')}, 50% в ${escapeHtml(chain.powerTitle || 'HP')}</option><option value="0">100% в ${escapeHtml(chain.powerTitle || 'HP')}</option></select></div>
              <fieldset data-editor-edit-hidden><legend>Бенефициарские</legend><p class="muted">Бенефициарские 1%: по legacy умолчанию сохраняется 1% для denis-skripnik; можно добавить ещё одного бенефициара.</p><div class="field"><label for="editor-beneficiary-account">Дополнительный бенефициар</label><input id="editor-beneficiary-account" name="beneficiary_account" type="text" autocomplete="off"></div><div class="field"><label for="editor-beneficiary-weight">Процент дополнительного бенефициара</label><input id="editor-beneficiary-weight" name="beneficiary_weight" type="number" min="0" max="99" step="0.01"></div></fieldset>` : ''}
            ${isGolos ? `
              <div class="field" data-editor-edit-hidden><label for="editor-payouts">Режим выплаты</label><select id="editor-payouts" name="payouts"><option value="10000" selected>50% в GBG/GOLOS, 50% в СГ</option><option value="0">100% в СГ</option></select></div>
              <div class="field" data-editor-edit-hidden><label for="editor-curation-percent">Процент кураторам</label><input id="editor-curation-percent" name="curation_percent" type="number" min="0" max="100" step="1" value="50"></div>
              <fieldset data-editor-edit-hidden><legend>Бенефициарские</legend><p class="muted">По legacy умолчанию сохраняется 1% для denis-skripnik.</p><div class="field"><label for="editor-beneficiary-account">Дополнительный бенефициар</label><input id="editor-beneficiary-account" name="beneficiary_account" type="text" autocomplete="off"></div><div class="field"><label for="editor-beneficiary-weight">Процент дополнительного бенефициара</label><input id="editor-beneficiary-weight" name="beneficiary_weight" type="number" min="0" max="99" step="0.01"></div></fieldset>` : ''}
            <button type="submit" name="intent" value="preview">Проверить публикацию</button>
            <button type="submit" name="intent" value="send">Опубликовать в сеть</button>
            <button type="reset">Очистка форм поста</button>
            <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
          </fieldset>
        </form></details>
        ${draft ? `<p class="notice">Загружен черновик из импорта: ${escapeHtml(draft.sourceUrl || draft.importedAt || '')}</p>` : ''}
        <p class="muted">${isGolos ? 'Golos payload сохраняет legacy category, payout, beneficiaries и curator rewards; preview/JSON перед отправкой обязателен.' : 'Параметры выплат выставлены по умолчанию. Перед отправкой проверьте итоговые данные операции.'}</p>
      </section>`;
    bindOperationForm(chain, 'editor-form', (form, context) => {
      const operations = chain.id === 'golos'
        ? buildGolosEditorOperations(chain, form, context && context.form)
        : buildGenericEditorOperations(chain, form, context && context.form);
      return broadcast.prepare(chain, 'posting', 'sendOperations', [operations]);
    });
    bindSteemPostLegacyHelpers(chain);
    bindGolosPostLegacyHelpers(chain);
    updateGolosEditorPostQuota(chain);
    if ((isGolos || isHiveOrSteem(chain)) && initialEditUrl) editorAutoLoadEdit(document.getElementById('editor-edit-url'), document.getElementById('editor-load-edit'));
    bindMarkdownEditor(appEl);
    bindCopyButtons(appEl);
    setStatus(`${chain.title} редактор готов: проверка или отправка по подтверждению.`, 'ok');
  }

  function parseAssetAmount(value) {
    if (typeof value === 'number') return value;
    return Number.parseFloat(String(value || '0').replace(',', '.')) || 0;
  }

  function round3(value) {
    return Math.round(Number(value || 0) * 1000) / 1000;
  }

  const VIZ_CALCULATOR_FALLBACK_PROPS = Object.freeze({
    total_vesting_fund: '1000000.000 VIZ',
    total_vesting_shares: '1000000000000.000000 SHARES',
    total_reward_fund: '1000.000 VIZ',
    total_reward_shares: '1000000000000'
  });

  async function loadVizCalculatorContext(connection) {
    try {
      const [props, chainProps, config] = await Promise.all([
        profiles.apiCall(connection, 'getDynamicGlobalProperties', []),
        profiles.apiCall(connection, 'getChainProperties', []).catch(() => null),
        profiles.apiCall(connection, 'getConfig', []).catch(() => null)
      ]);
      return { props, chainProps, config, source: 'public RPC', error: '' };
    } catch (error) {
      return {
        props: VIZ_CALCULATOR_FALLBACK_PROPS,
        chainProps: null,
        config: null,
        source: 'static fallback',
        error: profiles.formatError(error)
      };
    }
  }

  function calculateVizAwardValue(input) {
    const shares = Number(input.shares || 0);
    const charge = Number(input.charge || 0);
    const totalVestingFund = parseAssetAmount(input.totalVestingFund);
    const totalVestingShares = parseAssetAmount(input.totalVestingShares);
    const totalRewardFund = parseAssetAmount(input.totalRewardFund);
    const totalRewardShares = Number.parseInt(input.totalRewardShares || '0', 10) || 0;
    if (!totalVestingFund || !totalVestingShares || !totalRewardFund || !totalRewardShares) return 0;
    return Math.trunc((Number(shares) * Number(charge) / 100 / (totalRewardShares / 1000000) * totalRewardFund / (totalVestingFund / totalVestingShares) * 1000000) || 0) / 1000000;
  }

  async function loadGolosCalculatorContext(connection) {
    const [props, chainProps, feed, ticker] = await Promise.all([
      profiles.apiCall(connection, 'getDynamicGlobalProperties', []),
      profiles.apiCall(connection, 'getChainProperties', []),
      profiles.apiCall(connection, 'getFeedHistory', []),
      profiles.apiCall(connection, 'getTicker', []).catch(() => null)
    ]);
    return { props, chainProps, feed, ticker };
  }

  async function loadSteemCalculatorContext(connection) {
    const [props, chainProps, feed, ticker, config, rewardFund] = await Promise.all([
      profiles.apiCall(connection, 'getDynamicGlobalProperties', []),
      profiles.apiCall(connection, 'getChainProperties', []).catch(() => null),
      profiles.apiCall(connection, 'getFeedHistory', []),
      profiles.apiCall(connection, 'getTicker', []).catch(() => null),
      profiles.apiCall(connection, 'getConfig', []).catch(() => null),
      profiles.apiCall(connection, 'getRewardFund', ['post'])
    ]);
    return { props, chainProps, feed, ticker, config, rewardFund };
  }

  function calculateSteemUpvoteValue(input) {
    const sp = Number(input.sp || 0);
    const battery = Number(input.battery || 0);
    const weight = Number(input.weight || 0);
    const props = input.props || {};
    const feed = input.feed || {};
    const rewardFund = input.rewardFund || {};
    const totalVestingFund = parseAssetAmount(props.total_vesting_fund_steem);
    const totalVestingShares = parseAssetAmount(props.total_vesting_shares);
    const steemPerVests = totalVestingShares ? 1000000 * totalVestingFund / totalVestingShares : 0;
    const vestingShares = steemPerVests ? sp * 1000000 / steemPerVests : 0;
    const steemA = totalVestingFund / totalVestingShares;
    const steemN = 100;
    const steemR = steemA ? sp / steemA : 0;
    const steemM2 = 100 * battery * (100 * steemN) / 10000;
    const steemM = (steemM2 + 49) / 50;
    const rewardBalance = parseAssetAmount(rewardFund.reward_balance);
    const recentClaims = Number.parseFloat(rewardFund.recent_claims || '0') || 0;
    const steemI = recentClaims ? rewardBalance / recentClaims : 0;
    const median = feed.current_median_history || {};
    const base = parseAssetAmount(median.base);
    const quote = parseAssetAmount(median.quote);
    const medianPrice = quote ? Math.round((base / quote) * 100) / 100 : 0;
    const steemValue = round3(steemR * steemM * 100 * steemI) * (weight / 100);
    return {
      steem: round3(steemValue),
      sbd: round3(round3(steemR * steemM * 100 * steemI) * medianPrice * (weight / 100)),
      medianPrice,
      vestingShares
    };
  }

  async function loadHiveCalculatorContext(connection) {
    const [props, chainProps, feed, ticker, config, rewardFund] = await Promise.all([
      profiles.apiCall(connection, 'getDynamicGlobalProperties', []),
      profiles.apiCall(connection, 'getChainProperties', []).catch(() => null),
      profiles.apiCall(connection, 'getFeedHistory', []),
      profiles.apiCall(connection, 'getTicker', []).catch(() => null),
      profiles.apiCall(connection, 'getConfig', []).catch(() => null),
      profiles.apiCall(connection, 'getRewardFund', ['post'])
    ]);
    return { props, chainProps, feed, ticker, config, rewardFund };
  }

  function calculateHiveUpvoteValue(input) {
    const hp = Number(input.hp || 0);
    const battery = Number(input.battery || 0);
    const weight = Number(input.weight || 0);
    const props = input.props || {};
    const feed = input.feed || {};
    const rewardFund = input.rewardFund || {};
    const totalVestingFund = parseAssetAmount(props.total_vesting_fund_hive);
    const totalVestingShares = parseAssetAmount(props.total_vesting_shares);
    const hivePerVests = totalVestingShares ? 1000000 * totalVestingFund / totalVestingShares : 0;
    const vestingShares = hivePerVests ? hp * 1000000 / hivePerVests : 0;
    const hiveA = totalVestingFund / totalVestingShares;
    const hiveN = 100;
    const hiveR = hiveA ? hp / hiveA : 0;
    const hiveM2 = 100 * battery * (100 * hiveN) / 10000;
    const hiveM = (hiveM2 + 49) / 50;
    const rewardBalance = parseAssetAmount(rewardFund.reward_balance);
    const recentClaims = Number.parseFloat(rewardFund.recent_claims || '0') || 0;
    const hiveI = recentClaims ? rewardBalance / recentClaims : 0;
    const median = feed.current_median_history || {};
    const base = parseAssetAmount(median.base);
    const quote = parseAssetAmount(median.quote);
    const medianPrice = quote ? Math.round((base / quote) * 100) / 100 : 0;
    const hiveValue = round3(hiveR * hiveM * 100 * hiveI) * (weight / 100);
    return {
      hive: round3(hiveValue),
      hbd: round3(round3(hiveR * hiveM * 100 * hiveI) * medianPrice * (weight / 100)),
      medianPrice,
      vestingShares
    };
  }

  function calculateGolosUpvoteValue(input) {
    const sg = Number(input.sg || 0);
    const battery = Number(input.battery || 0);
    const weight = Number(input.weight || 0);
    const props = input.props || {};
    const chainProps = input.chainProps || {};
    const feed = input.feed || {};
    const ticker = input.ticker || null;
    const totalFund = parseAssetAmount(props.total_vesting_fund_steem);
    const totalShares = parseAssetAmount(props.total_vesting_shares);
    const totalRewardFund = parseAssetAmount(props.total_reward_fund_steem);
    const totalRewardShares2 = Number.parseFloat(props.total_reward_shares2 || '0') || 0;
    const steemPerVests = totalShares ? 1000000 * totalFund / totalShares : 0;
    const vestingShares = steemPerVests ? sg * 1000000 / steemPerVests : 0;
    const median = feed.current_median_history || {};
    const base = parseAssetAmount(median.base);
    const quote = parseAssetAmount(median.quote);
    const medianPrice = quote ? round3(base / quote) : 0;
    const tickerPrice = ticker ? Number.parseFloat(ticker.latest || '0') || 0 : 0;
    const golosPerVests = totalShares ? totalFund / totalShares : 0;
    const golosPower = round3(vestingShares * golosPerVests);
    const vestShares = golosPerVests ? 1000000 * golosPower / golosPerVests : 0;
    const maxVoteDenom = Number(chainProps.vote_regeneration_per_day || 0) * 5;
    const usedPower = maxVoteDenom ? Math.trunc(battery * 100 + maxVoteDenom - 1) / maxVoteDenom : 0;
    const rshares = Math.round((vestShares * usedPower) / 10000);
    const valueGolos = totalRewardShares2 ? round3(rshares * totalRewardFund / totalRewardShares2) : 0;
    return {
      golos: round3(valueGolos * (weight / 100)),
      medianGbg: medianPrice ? round3(valueGolos * medianPrice * (weight / 100)) : 0,
      marketGbg: tickerPrice ? round3(valueGolos * tickerPrice * (weight / 100)) : null,
      medianPrice,
      tickerPrice
    };
  }

  async function renderGolosCalculator(chain, account) {
    appEl.innerHTML = '<section class="panel calculator-golos" aria-labelledby="golos-calculator-loading-heading"><h2 id="golos-calculator-loading-heading">Загрузка калькулятора Golos</h2><p role="status" aria-live="polite">Читаю параметры сети через публичную Golos RPC-ноду...</p></section>';
    const connection = await getConnection(chain);
    const context = await loadGolosCalculatorContext(connection);
    const props = context.props || {};
    const totalFund = parseAssetAmount(props.total_vesting_fund_steem);
    const totalShares = parseAssetAmount(props.total_vesting_shares);
    const perMillion = totalFund && totalShares ? (1000000 * totalFund / totalShares) : 0;

    appEl.innerHTML = `
      <section class="panel calculator-golos" aria-labelledby="golos-calculator-heading">
        <h2 id="golos-calculator-heading">Golos: калькулятор GOLOS/GBG/СГ</h2>
        <p>Статический перенос legacy-калькулятора: расчёт стоимости апвоута, примерной награды из СГ за сутки и перевод GESTS в СГ по публичной ноде.</p>
        <ul>
          <li><strong>1 000 000 GESTS ≈</strong> ${escapeHtml(perMillion.toFixed(3))} СГ</li>
          <li><strong>total_vesting_fund_steem:</strong> ${escapeHtml(props.total_vesting_fund_steem || '')}</li>
          <li><strong>total_vesting_shares:</strong> ${escapeHtml(props.total_vesting_shares || '')}</li>
        </ul>
        <form id="golos-upvote-calculator-form" class="stacked-form">
          <fieldset>
            <legend>Рассчитываем стоимость апвоута в зависимости от введённой СГ</legend>
            <div class="field"><label for="golos-upvote-sg">Введите Значение СГ</label><input id="golos-upvote-sg" name="sg" type="number" min="0" step="0.001" required value="1000"></div>
            <div class="field"><label for="golos-upvote-battery">Введите батарейку (от 1 до 100)</label><input id="golos-upvote-battery" name="battery" type="number" min="1" max="100" step="0.01" required value="100"></div>
            <div class="field"><label for="golos-upvote-weight">Процент апвоута (от 1 до 100)</label><input id="golos-upvote-weight" name="weight" type="number" min="1" max="100" step="0.01" required value="100"></div>
            <button type="submit">Вывести стоимость апвоута</button>
            <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
          </fieldset>
        </form>
        <form id="golos-daily-sg-form" class="stacked-form">
          <fieldset>
            <legend>Примерная награда из СГ за сутки</legend>
            <div class="field"><label for="golos-daily-sg">Количество СГ</label><input id="golos-daily-sg" name="sg" type="number" min="0" step="0.001" required value="10000"></div>
            <button type="submit">Рассчитать награду с СГ</button>
            <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
          </fieldset>
        </form>
        <form id="golos-gests-form" class="stacked-form">
          <fieldset>
            <legend>Перевод GESTS в СГ</legend>
            <div class="field"><label for="golos-gests">Количество GESTS</label><input id="golos-gests" name="gests" type="number" min="0" step="0.000001" required value="1000000"></div>
            <button type="submit">Рассчитать GESTS в СГ</button>
            <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
          </fieldset>
        </form>
        ${context.ticker ? '' : '<p class="notice">Курс продажи GBG недоступен с текущей ноды; для стоимости апвоута будет показана медиана без рыночного GBG.</p>'}
      </section>`;

    document.getElementById('golos-upvote-calculator-form').addEventListener('submit', (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const result = calculateGolosUpvoteValue({
        sg: form.get('sg'),
        battery: form.get('battery'),
        weight: form.get('weight'),
        props: context.props,
        chainProps: context.chainProps,
        feed: context.feed,
        ticker: context.ticker
      });
      const market = result.marketGbg === null ? 'недоступно' : `${result.marketGbg.toFixed(3)} GBG по курсу продажи`;
      setOperationResult(event.currentTarget, `Стоимость апвоута: ${result.golos.toFixed(3)} GOLOS, ${market}, ${result.medianGbg.toFixed(3)} GBG по медиане.`, 'ok');
    });

    document.getElementById('golos-daily-sg-form').addEventListener('submit', (event) => {
      event.preventDefault();
      const sg = Number(new FormData(event.currentTarget).get('sg') || 0);
      const dailyReward = round3((sg / 10000) * 7);
      setOperationResult(event.currentTarget, `Результат конвертации: ${dailyReward.toFixed(3)} СГ`, 'ok');
    });

    document.getElementById('golos-gests-form').addEventListener('submit', (event) => {
      event.preventDefault();
      const gests = Number(new FormData(event.currentTarget).get('gests') || 0);
      const sg = totalShares ? round3(gests * totalFund / totalShares) : 0;
      setOperationResult(event.currentTarget, `Результат конвертации: ${sg.toFixed(3)} СГ`, 'ok');
    });

    setStatus(`Golos калькулятор загружен${account ? ` для @${account}` : ''}.`, 'ok');
  }

  async function renderSteemCalculator(chain, account) {
    appEl.innerHTML = '<section class="panel calculator-steem" aria-labelledby="steem-calculator-loading-heading"><h2 id="steem-calculator-loading-heading">Загрузка калькулятора Steem</h2><p role="status" aria-live="polite">Читаю dynamic global properties, chain properties, feed history и reward fund через публичную Steem RPC-ноду...</p></section>';
    let connection;
    let context;
    try {
      connection = await getConnection(chain);
      context = await loadSteemCalculatorContext(connection);
    } catch (error) {
      appEl.innerHTML = `<section class="panel calculator-steem" aria-labelledby="steem-calculator-heading"><h2 id="steem-calculator-heading">Steem: калькулятор SP/VESTS</h2><p class="error" role="status" aria-live="polite">Публичная Steem RPC-нода недоступна: ${escapeHtml(profiles.formatError(error))}. PHP/backend fallback не используется.</p></section>`;
      setStatus('Steem калькулятор не смог получить публичные RPC-параметры.', 'error');
      return;
    }
    const props = context.props || {};
    const totalFund = parseAssetAmount(props.total_vesting_fund_steem);
    const totalShares = parseAssetAmount(props.total_vesting_shares);
    const steemPerVests = totalShares ? 1000000 * totalFund / totalShares : 0;

    appEl.innerHTML = `
      <section class="panel calculator-steem" aria-labelledby="steem-calculator-heading">
        <h2 id="steem-calculator-heading">Steem: Блокчейн-калькулятор</h2>
        <p>Статический перенос legacy-калькулятора: рассчёт стоимости апвота по SP, батарейке и весу голоса, а также перевод VESTS в SP. Все параметры читаются из публичной Steem RPC; PHP endpoint и серверные snippets не используются.</p>
        <ul>
          <li><strong>1 000 000 VESTS ≈</strong> ${escapeHtml(steemPerVests.toFixed(3))} SP</li>
          <li><strong>total_vesting_fund_steem:</strong> ${escapeHtml(props.total_vesting_fund_steem || '')}</li>
          <li><strong>total_vesting_shares:</strong> ${escapeHtml(props.total_vesting_shares || '')}</li>
          <li><strong>reward_balance:</strong> ${escapeHtml((context.rewardFund && context.rewardFund.reward_balance) || '')}</li>
          <li><strong>recent_claims:</strong> ${escapeHtml((context.rewardFund && context.rewardFund.recent_claims) || '')}</li>
          <li><strong>feed median:</strong> ${escapeHtml(((context.feed || {}).current_median_history || {}).base || '')} / ${escapeHtml(((context.feed || {}).current_median_history || {}).quote || '')}</li>
          <li><strong>get_chain_properties.php / get_config.php:</strong> заменены public RPC getChainProperties/getConfig${context.chainProps || context.config ? '' : ' (не требуются формулами, но опрошены как legacy evidence)'}</li>
        </ul>
        <form id="steem-upvote-calculator-form" class="stacked-form"><fieldset>
          <legend>Рассчитываем стоимость апвота в зависимости от введённой Steem power</legend>
          <div class="field"><label for="steem-upvote-sp">Введите Значение SP</label><input id="steem-upvote-sp" name="sp" type="number" min="0" step="0.001" required value="1000"></div>
          <div class="field"><label for="steem-upvote-battery">Введите батарейку (от 1 до 100)</label><input id="steem-upvote-battery" name="battery" type="number" min="1" max="100" step="0.01" required value="100"></div>
          <div class="field"><label for="steem-upvote-weight">Процент апвота (от 1 до 100, устанавливается под постом, если Силы Голоса достаточно для этого)</label><input id="steem-upvote-weight" name="weight" type="number" min="1" max="100" step="0.01" required value="100"></div>
          <button type="submit">Вывести стоимость апвота</button><div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
        </fieldset></form>
        <form id="steem-vests-form" class="stacked-form"><fieldset>
          <legend>Перевод VESTS в SP</legend>
          <div class="field"><label for="steem-vests">Количество VESTS</label><input id="steem-vests" name="vests" type="number" min="0" step="0.000001" required value="1000000"></div>
          <button type="submit">Рассчитать VESTS в SP</button><div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
        </fieldset></form>
      </section>`;

    document.getElementById('steem-upvote-calculator-form').addEventListener('submit', (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const result = calculateSteemUpvoteValue({
        sp: form.get('sp'),
        battery: form.get('battery'),
        weight: form.get('weight'),
        props: context.props,
        feed: context.feed,
        rewardFund: context.rewardFund
      });
      setOperationResult(event.currentTarget, `Стоимость апвота: ${result.steem.toFixed(3)} STEEM, ${result.sbd.toFixed(3)} SBD.`, 'ok');
    });

    document.getElementById('steem-vests-form').addEventListener('submit', (event) => {
      event.preventDefault();
      const vests = Number(new FormData(event.currentTarget).get('vests') || 0);
      const sp = round3(vests / 1000000 * steemPerVests);
      setOperationResult(event.currentTarget, `Результат конвертации: ${sp.toFixed(3)} SP`, 'ok');
    });

    setStatus(`Steem калькулятор загружен${account ? ` для @${account}` : ''}.`, 'ok');
  }

  async function renderHiveCalculator(chain, account) {
    appEl.innerHTML = '<section class="panel calculator-hive" aria-labelledby="hive-calculator-loading-heading"><h2 id="hive-calculator-loading-heading">Загрузка калькулятора Hive</h2><p role="status" aria-live="polite">Читаю dynamic global properties, chain properties, feed history и reward fund через публичную Hive RPC-ноду...</p></section>';
    let connection;
    let context;
    try {
      connection = await getConnection(chain);
      context = await loadHiveCalculatorContext(connection);
    } catch (error) {
      appEl.innerHTML = `<section class="panel calculator-hive" aria-labelledby="hive-calculator-heading"><h2 id="hive-calculator-heading">Hive: калькулятор HP/VESTS</h2><p class="error" role="status" aria-live="polite">Публичная Hive RPC-нода недоступна: ${escapeHtml(profiles.formatError(error))}. PHP/backend fallback не используется.</p></section>`;
      setStatus('Hive калькулятор не смог получить публичные RPC-параметры.', 'error');
      return;
    }
    const props = context.props || {};
    const totalFund = parseAssetAmount(props.total_vesting_fund_hive);
    const totalShares = parseAssetAmount(props.total_vesting_shares);
    const hivePerVests = totalShares ? 1000000 * totalFund / totalShares : 0;

    appEl.innerHTML = `
      <section class="panel calculator-hive" aria-labelledby="hive-calculator-heading">
        <h2 id="hive-calculator-heading">Hive: Блокчейн-калькулятор</h2>
        <p>Статический перенос legacy-калькулятора: рассчёт стоимости апвота по HP, батарейке и весу голоса, а также перевод VESTS в HP. Все параметры читаются из публичной Hive RPC; PHP endpoint и серверные snippets не используются.</p>
        <ul>
          <li><strong>1 000 000 VESTS ≈</strong> ${escapeHtml(hivePerVests.toFixed(3))} HP</li>
          <li><strong>total_vesting_fund_hive:</strong> ${escapeHtml(props.total_vesting_fund_hive || '')}</li>
          <li><strong>total_vesting_shares:</strong> ${escapeHtml(props.total_vesting_shares || '')}</li>
          <li><strong>reward_balance:</strong> ${escapeHtml((context.rewardFund && context.rewardFund.reward_balance) || '')}</li>
          <li><strong>recent_claims:</strong> ${escapeHtml((context.rewardFund && context.rewardFund.recent_claims) || '')}</li>
          <li><strong>feed median:</strong> ${escapeHtml(((context.feed || {}).current_median_history || {}).base || '')} / ${escapeHtml(((context.feed || {}).current_median_history || {}).quote || '')}</li>
          <li><strong>get_chain_properties.php / get_config.php:</strong> заменены public RPC getChainProperties/getConfig${context.chainProps || context.config ? '' : ' (не требуются формулами, но опрошены как legacy evidence)'}</li>
        </ul>
        <form id="hive-upvote-calculator-form" class="stacked-form"><fieldset>
          <legend>Рассчитываем стоимость апвота в зависимости от введённой Hive power</legend>
          <div class="field"><label for="hive-upvote-hp">Введите Значение HP</label><input id="hive-upvote-hp" name="hp" type="number" min="0" step="0.001" required value="1000"></div>
          <div class="field"><label for="hive-upvote-battery">Введите батарейку (от 1 до 100)</label><input id="hive-upvote-battery" name="battery" type="number" min="1" max="100" step="0.01" required value="100"></div>
          <div class="field"><label for="hive-upvote-weight">Процент апвота (от 1 до 100, устанавливается под постом, если Силы Голоса достаточно для этого)</label><input id="hive-upvote-weight" name="weight" type="number" min="1" max="100" step="0.01" required value="100"></div>
          <button type="submit">Вывести стоимость апвота</button><div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
        </fieldset></form>
        <form id="hive-vests-form" class="stacked-form"><fieldset>
          <legend>Перевод VESTS в HP</legend>
          <div class="field"><label for="hive-vests">Количество VESTS</label><input id="hive-vests" name="vests" type="number" min="0" step="0.000001" required value="1000000"></div>
          <button type="submit">Рассчитать VESTS в HP</button><div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
        </fieldset></form>
      </section>`;

    document.getElementById('hive-upvote-calculator-form').addEventListener('submit', (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const result = calculateHiveUpvoteValue({
        hp: form.get('hp'),
        battery: form.get('battery'),
        weight: form.get('weight'),
        props: context.props,
        feed: context.feed,
        rewardFund: context.rewardFund
      });
      setOperationResult(event.currentTarget, `Стоимость апвота: ${result.hive.toFixed(3)} HIVE, ${result.hbd.toFixed(3)} HBD.`, 'ok');
    });

    document.getElementById('hive-vests-form').addEventListener('submit', (event) => {
      event.preventDefault();
      const vests = Number(new FormData(event.currentTarget).get('vests') || 0);
      const hp = round3(vests / 1000000 * hivePerVests);
      setOperationResult(event.currentTarget, `Результат конвертации: ${hp.toFixed(3)} HP`, 'ok');
    });

    setStatus(`Hive калькулятор загружен${account ? ` для @${account}` : ''}.`, 'ok');
  }

  async function renderVizCalculator(chain, account) {
    appEl.innerHTML = '<section class="panel calculator-viz" aria-labelledby="viz-calculator-loading-heading"><h2 id="viz-calculator-loading-heading">Загрузка калькулятора VIZ</h2><p role="status" aria-live="polite">Читаю dynamic global properties, chain properties и config через публичную VIZ RPC-ноду...</p></section>';
    let connection = null;
    let context = null;
    try {
      connection = await getConnection(chain);
      context = await loadVizCalculatorContext(connection);
    } catch (error) {
      context = {
        props: VIZ_CALCULATOR_FALLBACK_PROPS,
        chainProps: null,
        config: null,
        source: 'static fallback',
        error: profiles.formatError(error)
      };
    }
    const props = context.props || VIZ_CALCULATOR_FALLBACK_PROPS;
    appEl.innerHTML = `
      <section class="panel calculator-viz" aria-labelledby="viz-calculator-heading">
        <h2 id="viz-calculator-heading">VIZ: калькулятор SHARES/энергии</h2>
        <p>Статический перенос legacy calc без PHP/backend-runtime: стоимость награды по SHARES и charge, фонд приложения при награждении 0.1%, конвертация vesting shares → соц. капитал.</p>
        <p class="notice" role="status" aria-live="polite">Источник параметров: ${escapeHtml(context.source)}${context.error ? `. Публичная RPC-нода недоступна или вернула ошибку, используются статические fallback-значения: ${escapeHtml(context.error)}` : ''}</p>
        <ul>
          <li><strong>total_vesting_fund:</strong> ${escapeHtml(props.total_vesting_fund || '')}</li>
          <li><strong>total_vesting_shares:</strong> ${escapeHtml(props.total_vesting_shares || '')}</li>
          <li><strong>total_reward_fund:</strong> ${escapeHtml(props.total_reward_fund || '')}</li>
          <li><strong>total_reward_shares:</strong> ${escapeHtml(props.total_reward_shares || '')}</li>
          <li><strong>get_chain_properties.php:</strong> заменён public RPC getChainProperties${context.chainProps ? '' : ' (не требуется формулами legacy calculator)'}</li>
          <li><strong>get_config.php:</strong> заменён public RPC getConfig${context.config ? '' : ' (не требуется формулами legacy calculator)'}</li>
        </ul>
        <form id="viz-award-value-calculator-form" class="stacked-form"><fieldset>
          <legend>Рассчитываем сумму награждения других аккаунтов в зависимости от социального капитала</legend>
          <div class="field"><label for="viz-calc-shares">Введите Значение Соц. капитал (SHARES)</label><input id="viz-calc-shares" name="shares" type="number" min="0" step="0.001" required value="1000"></div>
          <div class="field"><label for="viz-calc-charge">Введите процент энергии</label><input id="viz-calc-charge" name="charge" type="number" min="0.01" max="100" step="0.01" required value="1"></div>
          <button type="submit">Вывести</button><div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
        </fieldset></form>
        <form id="viz-award-fund-calculator-form" class="stacked-form"><fieldset>
          <legend>Для разработчиков: формирование наградного фонда</legend>
          <div class="field"><label for="viz-calc-fund-shares">Введите Значение Соц. капитал (SHARES)</label><input id="viz-calc-fund-shares" name="shares" type="number" min="0" step="0.001" required value="1000"></div>
          <button type="submit">Вывести</button><div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
        </fieldset></form>
        <form id="viz-vesting-calculator-form" class="stacked-form"><fieldset>
          <legend>Перевод VIZ в SHARES</legend>
          <div class="field"><label for="viz-calc-vesting">Количество VIZ</label><input id="viz-calc-vesting" name="vesting" type="number" min="0" step="0.000001" value="1000000"></div>
          <button type="submit">Рассчитать</button><div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
        </fieldset></form>
      </section>`;
    const totalVestingFund = parseAssetAmount(props.total_vesting_fund);
    const totalVestingShares = parseAssetAmount(props.total_vesting_shares);
    const totalRewardFund = parseAssetAmount(props.total_reward_fund);
    const totalRewardShares = Number.parseInt(props.total_reward_shares || '0', 10) || 0;
    const awardValue = (shares, charge) => calculateVizAwardValue({ shares, charge, totalVestingFund, totalVestingShares, totalRewardFund, totalRewardShares });
    document.getElementById('viz-award-value-calculator-form').addEventListener('submit', (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const payout = awardValue(form.get('shares'), form.get('charge'));
      setOperationResult(event.currentTarget, `Награда даст примерно ${payout} SHARES.`, 'ok');
    });
    document.getElementById('viz-award-fund-calculator-form').addEventListener('submit', (event) => {
      event.preventDefault();
      const shares = Number(new FormData(event.currentTarget).get('shares') || 0);
      const awardFund = awardValue(shares, 0.1);
      const withdrawAmount = awardFund * 200;
      const allSharesForWithdrawal = withdrawAmount * 28;
      setOperationResult(event.currentTarget, `Если у вас есть приложение, можете создать наградной фонд. Как? Награждаете свой аккаунт раз в 432 секунды на 0.1%. Вы будете получать ${awardFund} SHARES. Раз в сутки необходимо из соц. капитала выводить ${withdrawAmount} SHARES, а для этого доступно к выводу в соц. капитале должно быть не менее ${allSharesForWithdrawal} SHARES.`, 'ok');
    });
    document.getElementById('viz-vesting-calculator-form').addEventListener('submit', (event) => {
      event.preventDefault();
      const value = Number(new FormData(event.currentTarget).get('vesting') || 0);
      const steemPerVests = totalVestingShares ? (1000000 * totalVestingFund / totalVestingShares) : 0;
      const result = Math.round((value / 1000000 * steemPerVests) * 1000) / 1000;
      setOperationResult(event.currentTarget, `Результат конвертации: ${result} соц. капитала.`, 'ok');
    });
    setStatus(`VIZ калькулятор загружен${account ? ` для @${account}` : ''}.`, 'ok');
  }

  async function renderCalculator(chain, account) {
    if (chain.id === 'golos') {
      await renderGolosCalculator(chain, account);
      return;
    }
    if (chain.id === 'viz') {
      await renderVizCalculator(chain, account);
      return;
    }
    if (chain.id === 'steem') {
      await renderSteemCalculator(chain, account);
      return;
    }
    if (chain.id === 'hive') {
      await renderHiveCalculator(chain, account);
      return;
    }
    appEl.innerHTML = '<section class="panel" aria-labelledby="generic-calculator-loading-heading"><h2 id="generic-calculator-loading-heading">Загрузка калькулятора</h2><p role="status" aria-live="polite">Читаю параметры сети через публичную RPC/API-ноду...</p></section>';
    const connection = await getConnection(chain);
    const props = await profiles.apiCall(connection, 'getDynamicGlobalProperties', []);
    const totalFund = parseFloat(props.total_vesting_fund_steem || props.total_vesting_fund_hive || props.total_vesting_fund || '0');
    const totalShares = parseFloat(props.total_vesting_shares || '0');
    const perMillion = totalFund && totalShares ? (1000000 * totalFund / totalShares) : 0;

    appEl.innerHTML = `
      <section class="panel" aria-labelledby="generic-calculator-heading">
        <h2 id="generic-calculator-heading">${escapeHtml(chain.title)}: калькулятор ${escapeHtml(chain.powerTitle || chain.vestingSymbol)}</h2>
        <p>Калькулятор показывает примерную конвертацию vesting в power по текущим параметрам сети.</p>
        <ul>
          <li><strong>1 000 000 ${escapeHtml(chain.vestingSymbol || 'VESTS')} ≈</strong> ${escapeHtml(perMillion.toFixed(6))} ${escapeHtml(chain.powerTitle || chain.liquidSymbol || 'POWER')}</li>
          <li><strong>total_vesting_fund:</strong> ${escapeHtml(totalFund)}</li>
          <li><strong>total_vesting_shares:</strong> ${escapeHtml(totalShares)}</li>
        </ul>
        <form id="calculator-form" class="stacked-form">
          <fieldset>
            <legend>Конвертация vesting → power</legend>
            <div class="field"><label for="calculator-vesting">Количество ${escapeHtml(chain.vestingSymbol || 'VESTS')}</label><input id="calculator-vesting" name="vesting" type="number" min="0" step="0.000001" value="1000000"></div>
            <button type="submit">Рассчитать</button>
            <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
          </fieldset>
        </form>
      </section>`;

    document.getElementById('calculator-form').addEventListener('submit', (event) => {
      event.preventDefault();
      const value = Number(new FormData(event.currentTarget).get('vesting') || 0);
      const power = totalShares ? (value * totalFund / totalShares) : 0;
      setOperationResult(event.currentTarget, `${value} ${chain.vestingSymbol || 'VESTS'} ≈ ${power.toFixed(6)} ${chain.powerTitle || chain.liquidSymbol || 'POWER'}`, 'ok');
    });
    setStatus(`${chain.title} калькулятор загружен для @${account}.`, 'ok');
  }

  function renderManage(chain) {
    appEl.innerHTML = `
      <section class="panel">
        <h2>${escapeHtml(chain.title)}: управление</h2>
        <p>Управление блокчейном и профилем: proxy, голосование за witness, настройки witness, профиль и права доступа. Для VIZ доступны invite и committee операции.</p>
        ${chain.id === 'viz' ? `<nav id="viz-manage-nav" aria-label="Страницы VIZ manage">
          <a href="#viz-manage-profile">Профиль</a>
          <a href="#viz-manage-witnesses">Делегаты</a>
          <a href="#viz-manage-witness">Управление делегатом</a>
          <a href="#viz-manage-workers">Заявки воркеров</a>
          <a href="#viz-manage-create-account">Создать аккаунт/субаккаунт</a>
          <a href="#viz-manage-access">Доступы аккаунта</a>
          <a href="#viz-manage-reset-keys">Сброс ключей</a>
          <a href="#viz-manage-many-invites">Множество инвайтов (чеков)</a>
          <a href="#viz-manage-multisig">Мультисиг</a>
        </nav>` : ''}
        <section id="viz-manage-witnesses" aria-labelledby="viz-manage-witnesses-title"><h3 id="viz-manage-witnesses-title">Делегаты / witness votes</h3></section>
        <details id="manage-proxy-details" class="operation-details"><summary>Witness proxy — preview перед отправкой</summary><form id="manage-proxy-form" class="stacked-form">
          <fieldset>
            <legend>Witness proxy</legend>
            <div class="field"><label for="manage-proxy-login">Прокси-аккаунт</label><input id="manage-proxy-login" name="proxy" type="text" autocomplete="off" placeholder="пусто = снять proxy"></div>
            <button type="submit" name="intent" value="preview">Проверить proxy</button>
            <button type="submit" name="intent" value="send">Установить proxy в сети</button>
            <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
          </fieldset>
        </form></details>
        <details id="manage-witness-details" class="operation-details"><summary>Голосование за witness — preview перед отправкой</summary><form id="manage-witness-form" class="stacked-form">
          <fieldset>
            <legend>Голосование за witness</legend>
            <div class="field"><label for="manage-witness-login">Witness</label><input id="manage-witness-login" name="witness" type="text" required autocomplete="off"></div>
            <label class="inline-choice"><input name="approve" type="checkbox" checked> подтвердить голос</label>
            <button type="submit" name="intent" value="preview">Проверить голос</button>
            <button type="submit" name="intent" value="send">Отправить голос в сеть</button>
            <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
          </fieldset>
        </form></details>
        ${(chain.id === 'golos' || chain.id === 'viz' || chain.id === 'hive' || chain.id === 'steem') ? `<details id="manage-witnesses-batch-details" class="operation-details"><summary>Batch witness vote — загрузить и проверить изменения</summary><form id="manage-witnesses-batch-form" class="stacked-form">
          <fieldset>
            <legend>Список делегатов / batch witness vote</legend>
            <p class="muted">Загружает текущие witness_votes и список делегатов через публичный RPC. Отправляет только изменения.</p>
            <button type="button" id="manage-witnesses-load">Загрузить список делегатов</button>
            <button type="submit" name="intent" value="preview">Проверить изменения голосов</button>
            <button type="submit" name="intent" value="send">Отправить изменения голосов</button>
            <div id="manage-witnesses-result" class="operation-result" role="status" aria-live="polite"></div>
            <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
          </fieldset>
        </form></details>` : ''}
        <details id="manage-witness-update-details" class="operation-details"><summary>Активация / деактивация witness — простые действия</summary><form id="manage-witness-update-form" class="stacked-form">
          <fieldset>
            <legend><span id="viz-manage-witness">Активация или деактивация witness</span></legend>
            <p class="muted">Если нужно изменить ключ активации, вставьте новый ключ подписи блоков в поле и нажмите «Активировать делегата». Сохранённый ключ показан под полем сокращённо и доступен кнопкой.</p>
            <div class="field"><label for="manage-witness-url">URL witness / пост делегата</label><input id="manage-witness-url" name="url" type="url" placeholder="если пусто — попробуем взять текущий URL witness"></div>
            <div class="field"><label for="manage-witness-key">Публичный ключ подписи блоков делегата</label><input id="manage-witness-key" name="signingKey" type="text" list="manage-witness-key-history" autocomplete="off" placeholder="${escapeHtml(manageNullSigningKey(chain) || `${chain.id.toUpperCase()}...`)}"><datalist id="manage-witness-key-history"></datalist><p id="manage-witness-saved-key-hint" class="muted">Сохранённого ключа пока нет.</p></div>
            <div class="field"><label for="manage-witness-fee">Комиссия</label><input id="manage-witness-fee" name="fee" type="text" required value="0.000 ${escapeHtml(chain.liquidSymbol)}" placeholder="0.000 ${escapeHtml(chain.liquidSymbol)}"></div>
            <div class="witness-action-buttons" aria-label="Быстрые действия witness">
              <button type="submit" name="intent" value="send" data-witness-action="activate">Активировать делегата</button>
              <button type="submit" name="intent" value="send" data-witness-action="deactivate" class="danger-button">Остановить делегата</button>
            </div>
            ${(chain.id === 'golos' || chain.id === 'viz' || chain.id === 'hive' || chain.id === 'steem') ? '<button type="button" id="manage-witness-load">Загрузить текущие witness настройки</button><div id="manage-witness-prefill-result" class="operation-result" role="status" aria-live="polite"></div>' : ''}
            <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
          </fieldset>
        </form></details>
        ${chain.id === 'viz' ? `<details id="viz-witness-props-details" class="operation-details"><summary>Настройки witness / параметры сети — поля и подгрузка</summary><form id="viz-witness-props-form" class="stacked-form"><fieldset>
          <legend>VIZ witness props / versionedChainPropertiesUpdate</legend>
          <p class="notice">Опасная операция witness: меняет chain properties VIZ. Заполните поля вручную или подгрузите текущие значения, затем проверьте preview перед отправкой.</p>
          <button type="button" id="viz-witness-props-load">Загрузить текущие witness props</button>
          <div id="viz-witness-props-prefill-result" class="operation-result" role="status" aria-live="polite"></div>
          ${renderWitnessPropsFields(chain, 'viz-witness-props')}
          <button type="submit" name="intent" value="preview">Проверить versionedChainPropertiesUpdate</button><button type="submit" name="intent" value="send">Отправить versionedChainPropertiesUpdate</button>
          <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
        </fieldset></form></details>` : ''}
        ${(chain.id === 'hive' || chain.id === 'steem') ? `<details id="manage-witness-props-details" class="operation-details"><summary>Настройки witness / параметры сети — поля и подгрузка</summary><form id="manage-witness-props-form" class="stacked-form"><fieldset>
          <legend>${escapeHtml(chain.title)} witness props / chain_properties_update</legend>
          <p class="notice">Опасная witness операция: меняет chain properties. Подгрузите текущие параметры, измените нужные поля и обязательно проверьте preview.</p>
          <button type="button" id="manage-witness-props-load">Загрузить текущие witness props</button>
          <div id="manage-witness-props-prefill-result" class="operation-result" role="status" aria-live="polite"></div>
          ${renderWitnessPropsFields(chain, 'manage-witness-props')}
          <button type="submit" name="intent" value="preview">Проверить chain_properties_update</button><button type="submit" name="intent" value="send">Отправить chain_properties_update</button>
          <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
        </fieldset></form></details>` : ''}
        <details id="manage-authority-details" class="operation-details"><summary>Authority / доступы — owner WIF только в памяти</summary><form id="manage-authority-form" class="stacked-form">
          <fieldset>
            <legend><span id="viz-manage-access">Обновление authority / доступа</span></legend>
            <p class="muted">Обновление прав доступа: введите готовые публичные ключи/account auths. Owner WIF используется только для подписи и не сохраняется.</p>
            <div class="field"><label for="manage-authority-owner-wif">Приватный WIF owner текущего аккаунта</label><input id="manage-authority-owner-wif" name="ownerWif" type="password" autocomplete="off" required></div>
            <div class="field"><label for="manage-authority-memo">Публичный memo-ключ</label><input id="manage-authority-memo" name="memoKey" type="text" required></div>
            <div class="field"><label for="manage-authority-owner-key">Публичный ключ owner</label><input id="manage-authority-owner-key" name="ownerKey" type="text" required></div>
            <div class="field"><label for="manage-authority-active-key">Публичный ключ active</label><input id="manage-authority-active-key" name="activeKey" type="text" required></div>
            <div class="field"><label for="manage-authority-posting-key">Публичный ключ posting/regular</label><input id="manage-authority-posting-key" name="postingKey" type="text" required></div>
            <div class="field"><label for="manage-authority-json">json_metadata</label><textarea id="manage-authority-json" name="jsonMetadata" rows="3" placeholder="{}"></textarea></div>
            <button type="submit" name="intent" value="preview">Проверить обновление authority</button>
            <button type="submit" name="intent" value="send">Обновить authority в сети</button>
            <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
          </fieldset>
        </form></details>
        <details id="manage-profile-details" class="operation-details"><summary>Метаданные профиля — preview перед обновлением</summary><form id="manage-profile-form" class="stacked-form">
          <fieldset>
            <legend><span id="viz-manage-profile">Метаданные профиля</span></legend>
            ${(chain.id === 'golos' || chain.id === 'hive' || chain.id === 'steem') ? '<p id="manage-profile-prefill-result" class="muted" role="status" aria-live="polite">Текущий профиль будет загружен из json_metadata.</p>' : ''}
            <div class="field"><label for="manage-profile-name">Отображаемое имя</label><input id="manage-profile-name" name="name" type="text"></div>
            <div class="field"><label for="manage-profile-about">О себе</label><textarea id="manage-profile-about" name="about" rows="3"></textarea></div>
            <div class="field"><label for="manage-profile-image">Аватар / profile_image URL</label><input id="manage-profile-image" name="profile_image" type="url"></div>
            <div class="field"><label for="manage-profile-cover-image">Обложка / cover_image URL</label><input id="manage-profile-cover-image" name="cover_image" type="url"></div>
            <div class="field"><label for="manage-profile-gender">Пол / gender</label><input id="manage-profile-gender" name="gender" type="text"></div>
            <div class="field"><label for="manage-profile-location">Локация</label><input id="manage-profile-location" name="location" type="text"></div>
            <div class="field"><label for="manage-profile-website">Сайт</label><input id="manage-profile-website" name="website" type="url"></div>
            <div class="field"><label for="manage-profile-select-tags">Интересы / select_tags</label><input id="manage-profile-select-tags" name="select_tags" type="text" placeholder="блокчейн, dpos"></div>
            <div class="field"><label for="manage-profile-mail">Email / mail</label><input id="manage-profile-mail" name="mail" type="email"></div>
            <div class="field"><label for="manage-profile-facebook">Facebook</label><input id="manage-profile-facebook" name="facebook" type="text"></div>
            <div class="field"><label for="manage-profile-instagram">Instagram</label><input id="manage-profile-instagram" name="instagram" type="text"></div>
            <div class="field"><label for="manage-profile-twitter">Twitter/X</label><input id="manage-profile-twitter" name="twitter" type="text"></div>
            <div class="field"><label for="manage-profile-vk">VK</label><input id="manage-profile-vk" name="vk" type="text"></div>
            <div class="field"><label for="manage-profile-telegram">Telegram</label><input id="manage-profile-telegram" name="telegram" type="text"></div>
            <div class="field"><label for="manage-profile-skype">Skype</label><input id="manage-profile-skype" name="skype" type="text"></div>
            <div class="field"><label for="manage-profile-viber">Viber</label><input id="manage-profile-viber" name="viber" type="text"></div>
            <div class="field"><label for="manage-profile-whatsapp">WhatsApp</label><input id="manage-profile-whatsapp" name="whatsapp" type="text"></div>
            <button type="submit" name="intent" value="preview">Проверить обновление профиля</button>
            <button type="submit" name="intent" value="send">Обновить профиль в сети</button>
            <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
          </fieldset>
        </form></details>
        ${chain.id === 'golos' ? `<details id="manage-create-account-details" class="operation-details"><summary>Создание аккаунта Golos — ключи и preview</summary><form id="manage-create-account-form" class="stacked-form">
          <fieldset>
            <legend>Создание аккаунта Golos</legend>
            <p class="notice">Новые ключи генерируются локально. Перед отправкой скачайте backup нового аккаунта.</p>
            <div class="field"><label for="manage-create-name">Новый логин</label><input id="manage-create-name" name="name" type="text" required autocomplete="off"></div>
            <div class="field"><label for="manage-create-type">Тип оплаты</label><select id="manage-create-type" name="type"><option value="delegation">делегирование СГ из суммы GOLOS</option><option value="fee">fee GOLOS без делегирования</option></select></div>
            <div class="field"><label for="manage-create-amount">Сумма GOLOS</label><input id="manage-create-amount" name="amount" type="text" required placeholder="3.000"></div>
            <button type="button" id="manage-create-generate">Сгенерировать ключи нового аккаунта</button>
            <button type="button" id="manage-create-download" disabled>Скачать backup нового аккаунта</button>
            <label class="inline-choice"><input id="manage-create-saved" name="savedBackup" type="checkbox"> я сохранил приватные ключи нового аккаунта</label>
            <button type="submit" name="intent" value="preview">Проверить создание аккаунта</button>
            <button type="submit" name="intent" value="send">Создать аккаунт в сети</button>
            <div id="manage-create-generated" class="operation-result" role="status" aria-live="polite">Ключи нового аккаунта ещё не сгенерированы.</div>
            <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
          </fieldset>
        </form></details>
        <details id="manage-reset-keys-details" class="operation-details"><summary>Сброс ключей Golos — опасная операция</summary><form id="manage-reset-keys-form" class="stacked-form">
          <fieldset>
            <legend>Сброс ключей Golos</legend>
            <p class="notice">Опасная операция: старые owner/active/posting/memo ключи и account auths будут заменены одиночными новыми ключами. Сначала нажмите «Сгенерировать ключи» и сохраните backup.</p>
            <div class="field"><label for="manage-reset-owner-wif">Приватный WIF owner текущего аккаунта</label><input id="manage-reset-owner-wif" name="ownerWif" type="password" autocomplete="off" required></div>
            <button type="button" id="manage-reset-generate">Сгенерировать ключи</button>
            <button type="button" id="manage-reset-download" disabled>Скачать backup ключей</button>
            <label class="inline-choice"><input id="manage-reset-saved" name="savedBackup" type="checkbox"> я сохранил новые приватные ключи из backup</label>
            <button type="submit" name="intent" value="preview">Проверить сброс ключей</button>
            <button type="submit" name="intent" value="send">Сбросить ключи в сети</button>
            <div id="manage-reset-generated" class="operation-result" role="status" aria-live="polite">Ключи ещё не сгенерированы.</div>
            <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
          </fieldset>
        </form></details>
        <details id="manage-follow-details" class="operation-details"><summary>Golos follow/unfollow — posting preview</summary><form id="manage-follow-form" class="stacked-form">
          <fieldset>
            <legend>Подписки / follow</legend>
            <p class="muted">Static-safe перенос legacy subscribes: custom_json follow через posting key.</p>
            <div class="field"><label for="manage-follow-account">Аккаунт</label><input id="manage-follow-account" name="following" type="text" required autocomplete="off"></div>
            <div class="field"><label for="manage-follow-mode">Действие</label><select id="manage-follow-mode" name="mode"><option value="follow">подписаться</option><option value="unfollow">отписаться</option></select></div>
            <button type="submit" name="intent" value="preview">Проверить follow</button>
            <button type="submit" name="intent" value="send">Отправить follow в сеть</button>
            <button type="button" id="manage-following-load">Показать текущие подписки</button>
            <div id="manage-following-result" class="operation-result" role="status" aria-live="polite"></div>
            <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
          </fieldset>
        </form></details>
        <details id="manage-workers-details" class="operation-details"><summary>Golos workers — заявки, голосование и создание</summary>
          <section id="manage-workers-vote-section" aria-labelledby="manage-workers-vote-title">
            <h3 id="manage-workers-vote-title">Голосовать за воркеров</h3>
            <p class="muted">Активные заявки подгружаются через публичный RPC. Откройте заявку без модального окна, чтобы увидеть детали и голоса.</p>
            <button type="button" id="manage-workers-load">Показать worker requests</button>
            <div id="manage-workers-result" class="operation-result" role="status" aria-live="polite"></div>
            <div id="manage-workers-active-list" class="request-list" aria-live="polite"></div>
            <div id="manage-worker-detail-page" class="request-detail-page" hidden></div>
            <form id="manage-workers-vote-form" class="stacked-form"><fieldset>
              <legend>Голосование за заявку</legend>
              <div class="field"><label for="manage-workers-author">Автор заявки</label><input id="manage-workers-author" name="author" type="text" autocomplete="off" required></div>
              <div class="field"><label for="manage-workers-permlink">Permlink заявки</label><input id="manage-workers-permlink" name="permlink" type="text" required></div>
              <div class="field"><label for="manage-workers-percent">Процент голоса</label><input id="manage-workers-percent" name="percent" type="number" min="-100" max="100" step="1" value="100"></div>
              <button type="submit" name="intent" value="preview">Проверить worker vote</button>
              <button type="submit" name="intent" value="send">Отправить worker vote</button>
              <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
            </fieldset></form>
          </section>
          <section id="manage-workers-history-section" aria-labelledby="manage-workers-history-title">
            <h3 id="manage-workers-history-title">История заявок</h3>
            <div id="manage-workers-history-list" class="request-list"></div>
          </section>
          <section id="manage-workers-create-section" aria-labelledby="manage-workers-create-title">
            <h3 id="manage-workers-create-title">Создать заявку</h3>
            <form id="manage-workers-create-form" class="stacked-form"><fieldset>
              <legend>Новая worker request</legend>
              <p class="muted">Static-safe перенос legacy workers: создание worker_request через posting key.</p>
              <div class="field"><label for="manage-workers-url">URL поста заявки</label><input id="manage-workers-url" name="request_url" type="url" placeholder="https://.../@author/permlink" required></div>
              <div class="field"><label for="manage-workers-worker">Аккаунт воркера</label><input id="manage-workers-worker" name="worker" type="text" autocomplete="off" required></div>
              <div class="field"><label for="manage-workers-min">Минимальная сумма</label><input id="manage-workers-min" name="min" type="text" placeholder="1.000 GOLOS" required></div>
              <div class="field"><label for="manage-workers-max">Максимальная сумма</label><input id="manage-workers-max" name="max" type="text" placeholder="2.000 GOLOS" required></div>
              <div class="field"><label for="manage-workers-token">Токен</label><select id="manage-workers-token" name="token"><option value="GOLOS">GOLOS</option><option value="GBG">GBG</option></select></div>
              <div class="field"><label for="manage-workers-days">Длительность, дней</label><input id="manage-workers-days" name="days" type="number" min="5" max="30" step="1" value="5"></div>
              <label class="inline-choice"><input id="manage-workers-vest-reward" name="vest_reward" type="checkbox"> награда в СГ / vest_reward</label>
              <button type="submit" name="intent" value="preview">Проверить создание worker request</button>
              <button type="submit" name="intent" value="send">Создать worker request</button>
              <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
            </fieldset></form>
          </section>
        </details>
        <details id="manage-witness-props-details" class="operation-details"><summary>Настройки witness / параметры сети — поля и подгрузка</summary><form id="manage-witness-props-form" class="stacked-form">
          <fieldset>
            <legend>Golos witness props / chain_properties_update</legend>
            <p class="notice">Опасная операция witness: меняет chain properties. Подгрузите текущие значения, измените поля и проверьте preview перед отправкой.</p>
            <button type="button" id="manage-witness-props-load">Загрузить текущие witness props</button>
            <div id="manage-witness-props-prefill-result" class="operation-result" role="status" aria-live="polite"></div>
            ${renderWitnessPropsFields(chain, 'manage-witness-props')}
            <button type="submit" name="intent" value="preview">Проверить chain_properties_update</button>
            <button type="submit" name="intent" value="send">Отправить chain_properties_update</button>
            <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
          </fieldset>
        </form></details>` : ''}
        ${chain.id === 'viz' ? `<details id="viz-create-account-details" class="operation-details"><summary>VIZ: создать аккаунт/субаккаунт — ключи и preview</summary><form id="viz-create-account-form" class="stacked-form"><fieldset>
          <legend><span id="viz-manage-create-account">VIZ: создать аккаунт/субаккаунт</span></legend>
          <p class="notice">Новые master/active/regular/memo ключи генерируются локально через crypto.getRandomValues. Preview операции показывает только публичные ключи; приватные ключи доступны только в backup-файле.</p>
          <div class="field"><label for="viz-create-name">Новый логин или имя субаккаунта</label><input id="viz-create-name" name="name" type="text" required autocomplete="off"></div>
          <div class="field"><label for="viz-create-type">Тип регистрации</label><select id="viz-create-type" name="registrationType"><option value="account">аккаунт</option><option value="subaccount">субаккаунт .${escapeHtml(auth.getCurrentLogin(chain) || 'account')}</option></select></div>
          <div class="field"><label for="viz-create-payment">Способ оплаты</label><select id="viz-create-payment" name="paymentType"><option value="delegation">делегирование SHARES</option><option value="fee">оплата VIZ с баланса</option></select></div>
          <div class="field"><label for="viz-create-amount">Сумма</label><input id="viz-create-amount" name="amount" type="text" required placeholder="10"></div>
          <button type="button" id="viz-create-generate">Сгенерировать ключи нового аккаунта</button>
          <button type="button" id="viz-create-download" disabled>Скачать backup нового аккаунта</button>
          <label class="inline-choice"><input id="viz-create-saved" name="savedBackup" type="checkbox"> я сохранил приватные ключи нового аккаунта</label>
          <button type="submit" name="intent" value="preview">Проверить accountCreate</button><button type="submit" name="intent" value="send">Создать аккаунт в сети</button>
          <div id="viz-create-generated" class="operation-result" role="status" aria-live="polite">Ключи нового аккаунта ещё не сгенерированы.</div>
          <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
        </fieldset></form></details>
        <details id="viz-reset-keys-details" class="operation-details"><summary>VIZ: сброс ключей — опасная операция</summary><form id="viz-reset-keys-form" class="stacked-form"><fieldset>
          <legend><span id="viz-manage-reset-keys">VIZ: сброс ключей</span></legend>
          <p class="notice">Опасная операция: заменяет master/active/regular/memo authority одним новым ключом каждого типа. Owner/master WIF используется только в памяти; private WIF не попадает в preview/result.</p>
          <div class="field"><label for="viz-reset-account">Аккаунт для сброса</label><input id="viz-reset-account" name="account" type="text" value="${escapeHtml(auth.getCurrentLogin(chain) || '')}" required></div>
          <div class="field"><label for="viz-reset-master-wif">Текущий master WIF</label><input id="viz-reset-master-wif" name="ownerWif" type="password" autocomplete="off" required></div>
          <button type="button" id="viz-reset-generate">Сгенерировать новые ключи</button>
          <button type="button" id="viz-reset-download" disabled>Скачать backup новых ключей</button>
          <label class="inline-choice"><input id="viz-reset-saved" name="savedBackup" type="checkbox"> я сохранил новые приватные ключи</label>
          <button type="submit" name="intent" value="preview">Проверить сброс ключей</button><button type="submit" name="intent" value="send">Сбросить ключи в сети</button>
          <div id="viz-reset-generated" class="operation-result" role="status" aria-live="polite">Ключи ещё не сгенерированы.</div>
          <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
        </fieldset></form></details>
        <section id="viz-manage-many-invites" aria-labelledby="viz-many-invites-title"><h3 id="viz-many-invites-title">Множество инвайтов (чеков)</h3></section>
        <details id="viz-many-invites-details" class="operation-details"><summary>VIZ: множество инвайтов — secrets и preview</summary><form id="viz-many-invites-form" class="stacked-form"><fieldset>
          <legend>VIZ: batch create/use/claim invites</legend>
          <p class="notice">Генерация invite secret выполняется локально через crypto.getRandomValues. Preview create_invite содержит только публичные invite_key; секреты скачиваются отдельным backup.</p>
          <div class="field"><label for="viz-many-invites-mode">Режим</label><select id="viz-many-invites-mode" name="mode"><option value="create">создать много чеков</option><option value="use">использовать в SHARES</option><option value="claim">получить на баланс VIZ</option></select></div>
          <div class="field"><label for="viz-many-invites-count">Количество чеков</label><input id="viz-many-invites-count" name="count" type="number" min="1" max="50" step="1" value="1"></div>
          <div class="field"><label for="viz-many-invites-amount">Сумма каждого чека</label><input id="viz-many-invites-amount" name="amount" type="text" placeholder="1.000 VIZ"></div>
          <div class="field"><label for="viz-many-invites-secrets">Секреты чеков для use/claim, по одному на строку</label><textarea id="viz-many-invites-secrets" name="secrets" rows="5"></textarea></div>
          <button type="button" id="viz-many-invites-generate">Сгенерировать secrets и публичные ключи</button>
          <button type="button" id="viz-many-invites-download" disabled>Скачать backup secrets</button>
          <button type="submit" name="intent" value="preview">Проверить batch invite</button><button type="submit" name="intent" value="send">Отправить batch invite</button>
          <div id="viz-many-invites-result" class="operation-result" role="status" aria-live="polite">Secrets не отображаются в preview; скачайте backup после генерации.</div>
          <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
        </fieldset></form></details>
        <details id="viz-create-invite-details" class="operation-details"><summary>VIZ: создать один invite — preview</summary><form id="viz-create-invite-form" class="stacked-form"><fieldset>
          <legend>VIZ: создание одного invite</legend>
          <div class="field"><label for="viz-invite-balance">Баланс инвайта</label><input id="viz-invite-balance" name="balance" type="text" required placeholder="1.000 VIZ"></div>
          <div class="field"><label for="viz-invite-public">Публичный ключ invite</label><input id="viz-invite-public" name="publicKey" type="text" required></div>
          <button type="submit" name="intent" value="preview">Проверить create_invite</button><button type="submit" name="intent" value="send">Создать invite в сети</button>
          <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
        </fieldset></form></details>
        <details id="viz-use-invite-details" class="operation-details"><summary>VIZ: use/claim invite balance — secret only in form</summary><form id="viz-use-invite-form" class="stacked-form"><fieldset>
          <legend>VIZ: использование/получение invite balance</legend>
          <div class="field"><label for="viz-use-invite-secret">Секрет invite</label><input id="viz-use-invite-secret" name="secret" type="text" required></div>
          <div class="field"><label for="viz-use-invite-receiver">Получатель</label><input id="viz-use-invite-receiver" name="receiver" type="text" placeholder="пусто = текущий аккаунт"></div>
          <label class="inline-choice"><input name="toVesting" type="checkbox" checked> use_invite_balance в SHARES; иначе claim_invite_balance в VIZ</label>
          <button type="submit" name="intent" value="preview">Проверить invite use/claim</button><button type="submit" name="intent" value="send">Использовать invite в сети</button>
          <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
        </fieldset></form></details>
        <details id="viz-committee-details" class="operation-details"><summary>VIZ committee / фонд развития — заявки, голосование и создание</summary>
          <section id="viz-committee-vote-section" aria-labelledby="viz-committee-vote-title">
            <h3 id="viz-committee-vote-title"><span id="viz-manage-workers">Голосовать за заявки фонда развития</span></h3>
            <button type="button" id="viz-committee-load">Показать заявки фонда развития</button>
            <div id="viz-committee-result" class="operation-result" role="status" aria-live="polite"></div>
            <div id="viz-committee-active-list" class="request-list" aria-live="polite"></div>
            <div id="viz-committee-detail-page" class="request-detail-page" hidden></div>
            <form id="viz-committee-vote-form" class="stacked-form"><fieldset>
              <legend>Голосование за заявку</legend>
              <div class="field"><label for="viz-committee-id">ID запроса для голоса</label><input id="viz-committee-id" name="requestId" type="number" min="0" step="1" value="0"></div>
              <div class="field"><label for="viz-committee-vote">Процент голоса</label><input id="viz-committee-vote" name="vote" type="number" min="-100" max="100" step="1" value="100"></div>
              <button type="submit" name="intent" value="preview">Проверить committee vote</button><button type="submit" name="intent" value="send">Отправить committee vote</button>
              <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
            </fieldset></form>
          </section>
          <section id="viz-committee-history-section" aria-labelledby="viz-committee-history-title">
            <h3 id="viz-committee-history-title">История заявок</h3>
            <div id="viz-committee-history-list" class="request-list"></div>
          </section>
          <section id="viz-committee-create-section" aria-labelledby="viz-committee-create-title">
            <h3 id="viz-committee-create-title">Создать заявку</h3>
            <form id="viz-committee-create-form" class="stacked-form"><fieldset>
              <legend>Новая заявка фонда развития</legend>
              <div class="field"><label for="viz-committee-url">URL</label><input id="viz-committee-url" name="url" type="url"></div>
              <div class="field"><label for="viz-committee-worker">Воркер</label><input id="viz-committee-worker" name="worker" type="text"></div>
              <div class="field"><label for="viz-committee-min">Минимальная награда</label><input id="viz-committee-min" name="min" type="text" placeholder="1.000 VIZ"></div>
              <div class="field"><label for="viz-committee-max">Максимальная награда</label><input id="viz-committee-max" name="max" type="text" placeholder="2.000 VIZ"></div>
              <div class="field"><label for="viz-committee-days">Длительность, дней</label><input id="viz-committee-days" name="days" type="number" min="1" step="1" value="5"></div>
              <button type="submit" name="intent" value="preview">Проверить создание committee request</button><button type="submit" name="intent" value="send">Создать committee request</button>
              <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
            </fieldset></form>
          </section>
        </details>
        <section id="viz-manage-multisig" aria-labelledby="viz-multisig-title"><h3 id="viz-multisig-title">Мультисиг</h3><p class="notice">Legacy multisig подписывал JSON-транзакции client-side и отправлял signed transaction через публичную ноду. В v3 доступны static-safe helpers: настройка account auths через accountUpdate и отправка заранее подписанной transaction JSON без хранения WIF.</p></section>
        <details id="viz-multisig-authority-details" class="operation-details"><summary>VIZ multisig authority — проверить accountUpdate</summary><form id="viz-multisig-authority-form" class="stacked-form"><fieldset>
          <legend>VIZ multisig authority</legend>
          <div class="field"><label for="viz-multisig-owner-wif">Active WIF текущего аккаунта</label><input id="viz-multisig-owner-wif" name="activeWif" type="password" autocomplete="off" required></div>
          <div class="field"><label for="viz-multisig-kind">Authority</label><select id="viz-multisig-kind" name="kind"><option value="regular">regular</option><option value="active">active</option></select></div>
          <div class="field"><label for="viz-multisig-threshold">Weight threshold</label><input id="viz-multisig-threshold" name="threshold" type="number" min="1" step="1" value="1"></div>
          <div class="field"><label for="viz-multisig-auths">Account auths account=weight, по одному на строку</label><textarea id="viz-multisig-auths" name="accountAuths" rows="4" placeholder="alice=1&#10;bob=1"></textarea></div>
          <button type="submit" name="intent" value="preview">Проверить multisig accountUpdate</button><button type="submit" name="intent" value="send">Отправить multisig accountUpdate</button>
          <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
        </fieldset></form></details>
        <details id="viz-multisig-signed-tx-details" class="operation-details"><summary>VIZ signed transaction — проверить JSON перед broadcast</summary><form id="viz-multisig-signed-tx-form" class="stacked-form"><fieldset>
          <legend>VIZ signed transaction submit</legend>
          <div class="field"><label for="viz-multisig-signed-json">Signed transaction JSON</label><textarea id="viz-multisig-signed-json" name="signedTx" rows="6" required></textarea></div>
          <button type="submit" name="intent" value="preview">Проверить signed TX</button><button type="submit" name="intent" value="send">Отправить signed TX</button>
          <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
        </fieldset></form></details>` : ''}
      </section>`;

    bindOperationForm(chain, 'manage-proxy-form', (form) => broadcast.prepare(chain, 'active', 'accountWitnessProxy', [
      auth.getCurrentLogin(chain),
      String(form.get('proxy') || '').trim().replace(/^@/, '')
    ]));
    bindOperationForm(chain, 'manage-witness-form', (form) => broadcast.prepare(chain, 'active', 'accountWitnessVote', [
      auth.getCurrentLogin(chain),
      normalizeAccountInput(chain, form.get('witness'), 'Witness'),
      form.get('approve') === 'on'
    ], { title: 'Голосование за witness', to: normalizeAccountInput(chain, form.get('witness'), 'Witness') }));

    bindOperationForm(chain, 'manage-witness-update-form', async (form, options = {}) => {
      const account = auth.getCurrentLogin(chain);
      const action = options.submitter && options.submitter.dataset ? (options.submitter.dataset.witnessAction || 'custom') : 'custom';
      const url = await resolveManageWitnessUrl(chain, form.get('url'));
      let signingKey = '';
      if (action === 'deactivate') {
        signingKey = manageDeactivateSigningKey(chain);
      } else {
        signingKey = String(form.get('signingKey') || '').trim();
        if (!signingKey) throw new Error('Для активации нужен публичный block signing key делегата. Приватный ключ сюда вводить нельзя.');
      }
      const fee = normalizeAssetInput(chain, form.get('fee'), chain.liquidSymbol, 'Witness fee');
      let props = {};
      const rawProps = String(form.get('props') || '').trim();
      if (rawProps) {
        try { props = JSON.parse(rawProps); } catch (error) { throw new Error('Props JSON должен быть корректным JSON.'); }
      }
      if (!signingKey || broadcast.isLikelyWif(signingKey)) throw new Error('Signing key должен быть публичным ключом, а не приватным WIF.');
      if (action !== 'deactivate') rememberManageWitnessSigningKey(chain, signingKey);
      const actionTitle = action === 'activate' ? 'Активация witness' : (action === 'deactivate' ? 'Остановка witness' : 'Witness update');
      const actionWarnings = action === 'activate'
        ? ['Будет установлен введённый ключ подписи блоков.']
        : (action === 'deactivate' ? ['Делегат будет остановлен через null-key сети.'] : ['Проверьте введённый ключ подписи блоков.']);
      if (chain.id === 'viz') {
        return broadcast.prepare(chain, 'active', 'witnessUpdate', [account, url, signingKey], { title: `VIZ ${actionTitle}`, warnings: ['Legacy VIZ witnessUpdate меняет url/signing_key; chain props отправляются отдельной versionedChainPropertiesUpdate формой.'].concat(actionWarnings) });
      }
      return broadcast.prepare(chain, 'active', 'witnessUpdate', [account, url, signingKey, props, fee], { title: actionTitle, amount: fee, warnings: ['Внимательно проверьте witness props: неверные параметры сети могут сделать настройки witness некорректными.'].concat(actionWarnings) });
    });

    bindOperationForm(chain, 'manage-authority-form', (form) => {
      const account = auth.getCurrentLogin(chain);
      const ownerWif = String(form.get('ownerWif') || '').trim();
      const memoKey = String(form.get('memoKey') || '').trim();
      const ownerKey = String(form.get('ownerKey') || '').trim();
      const activeKey = String(form.get('activeKey') || '').trim();
      const postingKey = String(form.get('postingKey') || '').trim();
      const jsonMetadata = String(form.get('jsonMetadata') || '{}').trim() || '{}';
      [memoKey, ownerKey, activeKey, postingKey].forEach((value) => {
        if (!value || broadcast.isLikelyWif(value)) throw new Error('Поля authority принимают только публичные ключи; введён приватный ключ, похожий на WIF.');
      });
      try { JSON.parse(jsonMetadata); } catch (error) { throw new Error('json_metadata должен быть корректным JSON.'); }
      const owner = { weight_threshold: 1, account_auths: [], key_auths: [[ownerKey, 1]] };
      const active = { weight_threshold: 1, account_auths: [], key_auths: [[activeKey, 1]] };
      const posting = { weight_threshold: 1, account_auths: [], key_auths: [[postingKey, 1]] };
      return broadcast.prepareWithPrivateKey(chain, account, 'owner', ownerWif, 'accountUpdate', [account, owner, active, posting, memoKey, jsonMetadata], { title: 'Authority update', warnings: ['Owner WIF используется только в памяти и не показывается в проверке/ответе. Храните приватные ключи отдельно.'] });
    });

    bindOperationForm(chain, 'manage-profile-form', async (form) => {
      const account = auth.getCurrentLogin(chain);
      let metadata = {};
      if (chain.id === 'golos' || chain.id === 'hive' || chain.id === 'steem') {
        const current = await fetchChainAccount(chain, account);
        if (!current || typeof current.json_metadata === 'undefined') throw new Error('Не удалось получить текущий json_metadata аккаунта; обновление профиля остановлено, чтобы не стереть metadata.');
        metadata = parseJsonObject(current.json_metadata, {});
      }
      metadata.profile = Object.assign({}, metadata.profile || {}, {
        name: String(form.get('name') || '').trim(),
        about: String(form.get('about') || '').trim(),
        profile_image: String(form.get('profile_image') || '').trim(),
        cover_image: String(form.get('cover_image') || '').trim(),
        gender: String(form.get('gender') || '').trim(),
        location: String(form.get('location') || '').trim(),
        website: String(form.get('website') || '').trim(),
        select_tags: chain.id === 'golos' ? normalizeGolosProfileTags(form.get('select_tags')) : String(form.get('select_tags') || '').trim(),
        interests: (chain.id === 'hive' || chain.id === 'steem') ? normalizeGolosProfileTags(form.get('select_tags')) : undefined,
        mail: String(form.get('mail') || '').trim(),
        facebook: String(form.get('facebook') || '').trim(),
        instagram: String(form.get('instagram') || '').trim(),
        twitter: String(form.get('twitter') || '').trim(),
        vk: String(form.get('vk') || '').trim(),
        telegram: String(form.get('telegram') || '').trim(),
        skype: String(form.get('skype') || '').trim(),
        viber: String(form.get('viber') || '').trim(),
        whatsapp: String(form.get('whatsapp') || '').trim()
      });
      const json = JSON.stringify(metadata);
      if (chain.id === 'hive' || chain.id === 'steem') {
        return broadcast.prepare(chain, 'active', 'accountUpdate', [account, undefined, undefined, undefined, undefined, json], { title: 'Profile update', warnings: ['Обновляет json_metadata через account_update; posting_json_metadata зависит от версии библиотеки и здесь не используется.'] });
      }
      return broadcast.prepare(chain, 'posting', 'accountMetadata', [account, json], { title: 'Profile metadata update' });
    });

    const witnessVoteState = { currentVotes: new Set(), proxy: '' };
    const createAccountState = { name: '', pendingKeys: null, backupConfirmed: false };
    const resetKeys = { pendingKeys: null, backupConfirmed: false };
    const manyInvitesState = { invites: [] };
    if (chain.id === 'golos') {
      const createGeneratedEl = document.getElementById('manage-create-generated');
      const createDownloadBtn = document.getElementById('manage-create-download');
      const createSavedBox = document.getElementById('manage-create-saved');
      const createNameEl = document.getElementById('manage-create-name');
      const generatedEl = document.getElementById('manage-reset-generated');
      const downloadBtn = document.getElementById('manage-reset-download');
      const savedBox = document.getElementById('manage-reset-saved');
      const renderCreateKeys = () => {
        if (!createAccountState.pendingKeys) {
          if (createGeneratedEl) createGeneratedEl.textContent = 'Ключи нового аккаунта ещё не сгенерированы.';
          if (createDownloadBtn) createDownloadBtn.disabled = true;
          return;
        }
        const keys = createAccountState.pendingKeys;
        if (createDownloadBtn) createDownloadBtn.disabled = false;
        if (createGeneratedEl) {
          createGeneratedEl.innerHTML = `<p><strong>Ключи нового аккаунта @${escapeHtml(createAccountState.name)} готовы.</strong> Скачайте backup перед отправкой.</p>
            <ul>
              <li>owner pub: <code>${escapeHtml(keys.ownerPubkey || '')}</code></li>
              <li>active pub: <code>${escapeHtml(keys.activePubkey || '')}</code></li>
              <li>posting pub: <code>${escapeHtml(keys.postingPubkey || '')}</code></li>
              <li>memo pub: <code>${escapeHtml(keys.memoPubkey || '')}</code></li>
            </ul>`;
        }
      };
      const createGenerateBtn = document.getElementById('manage-create-generate');
      if (createGenerateBtn) {
        createGenerateBtn.addEventListener('click', () => {
          try {
            const name = normalizeAccountInput(chain, createNameEl && createNameEl.value, 'Новый аккаунт');
            createAccountState.name = name;
            createAccountState.pendingKeys = generateGolosResetKeys(name);
            createAccountState.backupConfirmed = false;
            if (createSavedBox) createSavedBox.checked = false;
            renderCreateKeys();
            setStatus('Ключи нового аккаунта Golos сгенерированы локально. Скачайте backup перед отправкой.', 'ok');
          } catch (error) {
            if (createGeneratedEl) createGeneratedEl.textContent = profiles.formatError(error);
            setStatus(profiles.formatError(error), 'error');
          }
        });
      }
      if (createDownloadBtn) {
        createDownloadBtn.addEventListener('click', () => {
          if (!createAccountState.pendingKeys) return;
          const keys = createAccountState.pendingKeys;
          const name = createAccountState.name;
          downloadTextFile(`golos-account-${name}.txt`, `dpos.space/golos

Account login: ${name}
owner key: ${keys.owner}
Active key: ${keys.active}
posting key: ${keys.posting}
Memo key: ${keys.memo}`);
          createAccountState.backupConfirmed = true;
          if (createSavedBox) createSavedBox.checked = true;
        });
      }
      if (createSavedBox) createSavedBox.addEventListener('change', () => { createAccountState.backupConfirmed = createSavedBox.checked; });

      const renderResetKeys = () => {
        if (!resetKeys.pendingKeys) {
          if (generatedEl) generatedEl.textContent = 'Ключи ещё не сгенерированы.';
          if (downloadBtn) downloadBtn.disabled = true;
          return;
        }
        const keys = resetKeys.pendingKeys;
        if (downloadBtn) downloadBtn.disabled = false;
        if (generatedEl) {
          generatedEl.innerHTML = `<p><strong>Новые публичные ключи готовы.</strong> Приватные ключи показаны только здесь и в backup-файле. Сохраните их перед отправкой операции.</p>
            <ul>
              <li>owner pub: <code>${escapeHtml(keys.ownerPubkey || '')}</code></li>
              <li>active pub: <code>${escapeHtml(keys.activePubkey || '')}</code></li>
              <li>posting pub: <code>${escapeHtml(keys.postingPubkey || '')}</code></li>
              <li>memo pub: <code>${escapeHtml(keys.memoPubkey || '')}</code></li>
            </ul>`;
        }
      };
      const generateBtn = document.getElementById('manage-reset-generate');
      if (generateBtn) {
        generateBtn.addEventListener('click', () => {
          try {
            resetKeys.pendingKeys = generateGolosResetKeys(auth.getCurrentLogin(chain));
            resetKeys.backupConfirmed = false;
            if (savedBox) savedBox.checked = false;
            renderResetKeys();
            setStatus('Новые ключи Golos сгенерированы локально. Скачайте backup перед отправкой account_update.', 'ok');
          } catch (error) {
            if (generatedEl) generatedEl.textContent = profiles.formatError(error);
            setStatus(profiles.formatError(error), 'error');
          }
        });
      }
      if (downloadBtn) {
        downloadBtn.addEventListener('click', () => {
          if (!resetKeys.pendingKeys) return;
          const account = auth.getCurrentLogin(chain);
          const keys = resetKeys.pendingKeys;
          downloadTextFile(`golos-account-${account}.txt`, `dpos.space/golos\r\n\r\nAccount login: ${account}\r\nowner key: ${keys.owner}\r\nActive key: ${keys.active}\r\nposting key: ${keys.posting}\r\nMemo key: ${keys.memo}`);
          resetKeys.backupConfirmed = true;
          if (savedBox) savedBox.checked = true;
        });
      }
      if (savedBox) {
        savedBox.addEventListener('change', () => { resetKeys.backupConfirmed = savedBox.checked; });
      }
      prefillManageProfile(chain);
      renderManageWitnessSigningKeyHistory(chain);
      const witnessSavedKeyHint = document.getElementById('manage-witness-saved-key-hint');
      if (witnessSavedKeyHint) {
        witnessSavedKeyHint.addEventListener('click', (event) => {
          const button = event.target && event.target.closest ? event.target.closest('[data-witness-saved-key]') : null;
          if (!button) return;
          const input = document.getElementById('manage-witness-key');
          if (input) {
            input.value = button.dataset.witnessSavedKey || '';
            input.focus();
          }
        });
      }
      const witnessLoad = document.getElementById('manage-witness-load');
      if (witnessLoad) witnessLoad.addEventListener('click', () => loadManageWitnessSettings(chain));
      const witnessPropsLoad = document.getElementById('manage-witness-props-load');
      if (witnessPropsLoad) witnessPropsLoad.addEventListener('click', () => loadManageWitnessSettings(chain));
      const witnessesLoad = document.getElementById('manage-witnesses-load');
      if (witnessesLoad) witnessesLoad.addEventListener('click', () => loadWitnessVoteList(chain, witnessVoteState));
      const followingLoad = document.getElementById('manage-following-load');
      if (followingLoad) followingLoad.addEventListener('click', () => loadGolosFollowingList(chain));
      const workersLoad = document.getElementById('manage-workers-load');
      if (workersLoad) workersLoad.addEventListener('click', () => loadGolosWorkerRequests(chain));
    }

    if (chain.id === 'viz') {
      const vizCreateGeneratedEl = document.getElementById('viz-create-generated');
      const vizCreateDownloadBtn = document.getElementById('viz-create-download');
      const vizCreateSavedBox = document.getElementById('viz-create-saved');
      const vizCreateNameEl = document.getElementById('viz-create-name');
      const vizResetGeneratedEl = document.getElementById('viz-reset-generated');
      const vizResetDownloadBtn = document.getElementById('viz-reset-download');
      const vizResetSavedBox = document.getElementById('viz-reset-saved');
      const manyInvitesResult = document.getElementById('viz-many-invites-result');
      const manyInvitesDownloadBtn = document.getElementById('viz-many-invites-download');

      const renderVizCreateKeys = () => {
        if (!createAccountState.pendingKeys) {
          if (vizCreateGeneratedEl) vizCreateGeneratedEl.textContent = 'Ключи нового аккаунта ещё не сгенерированы.';
          if (vizCreateDownloadBtn) vizCreateDownloadBtn.disabled = true;
          return;
        }
        const keys = createAccountState.pendingKeys;
        if (vizCreateDownloadBtn) vizCreateDownloadBtn.disabled = false;
        if (vizCreateGeneratedEl) {
          vizCreateGeneratedEl.innerHTML = `<p><strong>Ключи нового VIZ аккаунта @${escapeHtml(createAccountState.name)} готовы.</strong> Скачайте backup перед отправкой.</p>
            <ul><li>master pub: <code>${escapeHtml(keys.masterPubkey || '')}</code></li><li>active pub: <code>${escapeHtml(keys.activePubkey || '')}</code></li><li>regular pub: <code>${escapeHtml(keys.regularPubkey || '')}</code></li><li>memo pub: <code>${escapeHtml(keys.memoPubkey || '')}</code></li></ul>`;
        }
      };
      const vizCreateGenerateBtn = document.getElementById('viz-create-generate');
      if (vizCreateGenerateBtn) {
        vizCreateGenerateBtn.addEventListener('click', () => {
          try {
            let name = normalizeAccountInput(chain, vizCreateNameEl && vizCreateNameEl.value, 'Новый VIZ аккаунт');
            const typeEl = document.getElementById('viz-create-type');
            if (typeEl && typeEl.value === 'subaccount' && !name.includes('.')) name = `${name}.${auth.getCurrentLogin(chain)}`;
            createAccountState.name = name;
            createAccountState.pendingKeys = generateVizResetKeys(name);
            createAccountState.backupConfirmed = false;
            if (vizCreateSavedBox) vizCreateSavedBox.checked = false;
            renderVizCreateKeys();
            setStatus('Ключи нового VIZ аккаунта сгенерированы локально через crypto.getRandomValues. Скачайте backup перед отправкой.', 'ok');
          } catch (error) {
            if (vizCreateGeneratedEl) vizCreateGeneratedEl.textContent = profiles.formatError(error);
            setStatus(profiles.formatError(error), 'error');
          }
        });
      }
      if (vizCreateDownloadBtn) {
        vizCreateDownloadBtn.addEventListener('click', () => {
          if (!createAccountState.pendingKeys) return;
          const keys = createAccountState.pendingKeys;
          const name = createAccountState.name;
          downloadTextFile(`viz-account-${name}.txt`, `dpos.space/viz\r\n\r\nAccount login: ${name}\r\nMaster key: ${keys.master}\r\nActive key: ${keys.active}\r\nRegular key: ${keys.regular}\r\nMemo key: ${keys.memo}`);
          createAccountState.backupConfirmed = true;
          if (vizCreateSavedBox) vizCreateSavedBox.checked = true;
        });
      }
      if (vizCreateSavedBox) vizCreateSavedBox.addEventListener('change', () => { createAccountState.backupConfirmed = vizCreateSavedBox.checked; });

      const renderVizResetKeys = () => {
        if (!resetKeys.pendingKeys) {
          if (vizResetGeneratedEl) vizResetGeneratedEl.textContent = 'Ключи ещё не сгенерированы.';
          if (vizResetDownloadBtn) vizResetDownloadBtn.disabled = true;
          return;
        }
        const keys = resetKeys.pendingKeys;
        if (vizResetDownloadBtn) vizResetDownloadBtn.disabled = false;
        if (vizResetGeneratedEl) {
          vizResetGeneratedEl.innerHTML = `<p><strong>Новые публичные ключи VIZ готовы.</strong> Приватные WIF доступны только в backup.</p>
            <ul><li>master pub: <code>${escapeHtml(keys.masterPubkey || '')}</code></li><li>active pub: <code>${escapeHtml(keys.activePubkey || '')}</code></li><li>regular pub: <code>${escapeHtml(keys.regularPubkey || '')}</code></li><li>memo pub: <code>${escapeHtml(keys.memoPubkey || '')}</code></li></ul>`;
        }
      };
      const vizResetGenerateBtn = document.getElementById('viz-reset-generate');
      if (vizResetGenerateBtn) {
        vizResetGenerateBtn.addEventListener('click', () => {
          try {
            const accountEl = document.getElementById('viz-reset-account');
            const accountName = normalizeAccountInput(chain, accountEl && accountEl.value, 'Аккаунт для сброса');
            resetKeys.account = accountName;
            resetKeys.pendingKeys = generateVizResetKeys(accountName);
            resetKeys.backupConfirmed = false;
            if (vizResetSavedBox) vizResetSavedBox.checked = false;
            renderVizResetKeys();
            setStatus('Новые VIZ ключи сгенерированы локально. Скачайте backup перед отправкой accountUpdate.', 'ok');
          } catch (error) {
            if (vizResetGeneratedEl) vizResetGeneratedEl.textContent = profiles.formatError(error);
            setStatus(profiles.formatError(error), 'error');
          }
        });
      }
      if (vizResetDownloadBtn) {
        vizResetDownloadBtn.addEventListener('click', () => {
          if (!resetKeys.pendingKeys) return;
          const accountName = resetKeys.account || auth.getCurrentLogin(chain);
          const keys = resetKeys.pendingKeys;
          downloadTextFile(`viz-account-${accountName}.txt`, `dpos.space/viz\r\n\r\nAccount login: ${accountName}\r\nMaster key: ${keys.master}\r\nActive key: ${keys.active}\r\nRegular key: ${keys.regular}\r\nMemo key: ${keys.memo}`);
          resetKeys.backupConfirmed = true;
          if (vizResetSavedBox) vizResetSavedBox.checked = true;
        });
      }
      if (vizResetSavedBox) vizResetSavedBox.addEventListener('change', () => { resetKeys.backupConfirmed = vizResetSavedBox.checked; });

      const manyInvitesGenerateBtn = document.getElementById('viz-many-invites-generate');
      if (manyInvitesGenerateBtn) {
        manyInvitesGenerateBtn.addEventListener('click', () => {
          try {
            const count = Math.max(1, Math.min(50, Math.trunc(Number(document.getElementById('viz-many-invites-count').value || 1))));
            manyInvitesState.invites = Array.from({ length: count }, () => {
              const secret = generateVizInviteSecret();
              return { secret, publicKey: vizInvitePublic(secret) };
            });
            if (manyInvitesDownloadBtn) manyInvitesDownloadBtn.disabled = false;
            if (manyInvitesResult) manyInvitesResult.innerHTML = `<p>${count} invite secrets сгенерированы. Preview будет содержать только публичные invite_key.</p><ul>${manyInvitesState.invites.map((item) => `<li><code>${escapeHtml(item.publicKey)}</code></li>`).join('')}</ul>`;
            setStatus('Invite secrets сгенерированы локально через crypto.getRandomValues; скачайте backup secrets.', 'ok');
          } catch (error) {
            if (manyInvitesResult) manyInvitesResult.textContent = profiles.formatError(error);
            setStatus(profiles.formatError(error), 'error');
          }
        });
      }
      if (manyInvitesDownloadBtn) {
        manyInvitesDownloadBtn.addEventListener('click', () => {
          if (!manyInvitesState.invites.length) return;
          downloadTextFile(`viz-invites-${Date.now()}.txt`, manyInvitesState.invites.map((item) => item.secret).join('\r\n'));
        });
      }
      const witnessLoad = document.getElementById('manage-witness-load');
      if (witnessLoad) witnessLoad.addEventListener('click', () => loadManageWitnessSettings(chain));
      const witnessPropsLoad = document.getElementById('viz-witness-props-load');
      if (witnessPropsLoad) witnessPropsLoad.addEventListener('click', () => loadManageWitnessSettings(chain));
      const witnessesLoad = document.getElementById('manage-witnesses-load');
      if (witnessesLoad) witnessesLoad.addEventListener('click', () => loadWitnessVoteList(chain, witnessVoteState));
      const vizCommitteeLoad = document.getElementById('viz-committee-load');
      if (vizCommitteeLoad) vizCommitteeLoad.addEventListener('click', () => loadVizCommitteeRequests(chain));
    }
    if (chain.id === 'hive' || chain.id === 'steem') {
      prefillManageProfile(chain);
      const witnessLoad = document.getElementById('manage-witness-load');
      if (witnessLoad) witnessLoad.addEventListener('click', () => loadManageWitnessSettings(chain));
      const witnessPropsLoad = document.getElementById('manage-witness-props-load');
      if (witnessPropsLoad) witnessPropsLoad.addEventListener('click', () => loadManageWitnessSettings(chain));
      const witnessesLoad = document.getElementById('manage-witnesses-load');
      if (witnessesLoad) witnessesLoad.addEventListener('click', () => loadWitnessVoteList(chain, witnessVoteState));
    }

    bindOperationForm(chain, 'manage-witnesses-batch-form', (form) => {
      if (chain.id !== 'golos' && chain.id !== 'viz' && chain.id !== 'hive' && chain.id !== 'steem') throw new Error('Batch witness voting здесь доступен только для Golos/VIZ/Hive/Steem.');
      const account = auth.getCurrentLogin(chain);
      const checked = new Set(Array.from(document.querySelectorAll('[data-witness-vote]')).filter((item) => item.checked).map((item) => item.dataset.witnessVote));
      const ops = [];
      witnessVoteState.currentVotes.forEach((witness) => { if (!checked.has(witness)) ops.push(['account_witness_vote', { account, witness, approve: false }]); });
      checked.forEach((witness) => { if (!witnessVoteState.currentVotes.has(witness)) ops.push(['account_witness_vote', { account, witness, approve: true }]); });
      if (!ops.length) throw new Error('Нет изменений witness_votes. Сначала загрузите список и отметьте изменения.');
      const warnings = witnessVoteState.proxy ? [`У аккаунта установлен proxy ${witnessVoteState.proxy}; ручное голосование может конфликтовать с proxy.`] : [];
      return broadcast.prepare(chain, 'active', 'sendOperations', [ops], { title: `${chain.title} batch witness votes`, warnings });
    });

    bindOperationForm(chain, 'manage-create-account-form', async (form) => {
      if (chain.id !== 'golos') throw new Error('Создание аккаунта здесь доступно только для Golos.');
      const creator = auth.getCurrentLogin(chain);
      const name = normalizeAccountInput(chain, form.get('name'), 'Новый аккаунт');
      if (!createAccountState.pendingKeys || createAccountState.name !== name) throw new Error('Сначала сгенерируйте ключи именно для этого нового аккаунта.');
      createAccountState.backupConfirmed = createAccountState.backupConfirmed || form.get('savedBackup') === 'on';
      if (!createAccountState.backupConfirmed) throw new Error('Перед созданием аккаунта подтвердите, что backup приватных ключей нового аккаунта сохранён.');
      const existing = await fetchChainAccount(chain, name).catch(() => null);
      if (existing && existing.name === name) throw new Error(`Аккаунт @${name} уже существует.`);
      const keys = createAccountState.pendingKeys;
      const authObject = { weight_threshold: 1, account_auths: [], key_auths: [[keys.ownerPubkey, 1]] };
      const activeObject = { weight_threshold: 1, account_auths: [], key_auths: [[keys.activePubkey, 1]] };
      const postingObject = { weight_threshold: 1, account_auths: [], key_auths: [[keys.postingPubkey, 1]] };
      const amountText = String(form.get('amount') || '').trim().replace(',', '.').replace(/\s*GOLOS$/i, '');
      if (!/^\d(?:\.\d{1,3})?$/.test(amountText) || Number(amountText) < 0) throw new Error('Сумма GOLOS должна быть неотрицательным числом, например 3.000.');
      let fee = '0.000 GOLOS';
      let delegation = '0.000000 GESTS';
      if (String(form.get('type') || 'delegation') === 'fee') {
        fee = normalizeAssetInput(chain, amountText, 'GOLOS', 'Account creation fee');
      } else {
        const data = await loadGrapheneWalletData(chain, creator, { loadExtraBalances: () => [] });
        delegation = normalizeGolosPowerInput(data.profile, amountText, 'Делегирование СГ из суммы GOLOS');
      }
      return broadcast.prepare(chain, 'active', 'accountCreateWithDelegation', [fee, delegation, creator, name, authObject, activeObject, postingObject, keys.memoPubkey, '', []], {
        title: 'Golos accountCreateWithDelegation',
        to: name,
        amount: `${fee}; ${delegation}`,
        warnings: ['Приватные ключи нового аккаунта не включаются в operation preview. Убедитесь, что backup скачан.']
      });
    });

    bindOperationForm(chain, 'manage-reset-keys-form', async (form) => {
      if (chain.id !== 'golos') throw new Error('Сброс ключей здесь доступен только для Golos.');
      if (!resetKeys.pendingKeys) throw new Error('Сначала сгенерируйте новые ключи и скачайте backup.');
      resetKeys.backupConfirmed = resetKeys.backupConfirmed || form.get('savedBackup') === 'on';
      if (!resetKeys.backupConfirmed) throw new Error('Перед сбросом подтвердите, что новые приватные ключи сохранены в backup.');
      const account = auth.getCurrentLogin(chain);
      const ownerWif = String(form.get('ownerWif') || '').trim();
      const keys = resetKeys.pendingKeys;
      const current = await fetchChainAccount(chain, account);
      if (!current || typeof current.json_metadata === 'undefined') throw new Error('Не удалось получить текущий json_metadata аккаунта; сброс ключей остановлен, чтобы не стереть metadata.');
      const jsonMetadata = current.json_metadata || '{}';
      const owner = { weight_threshold: 1, account_auths: [], key_auths: [[keys.ownerPubkey, 1]] };
      const active = { weight_threshold: 1, account_auths: [], key_auths: [[keys.activePubkey, 1]] };
      const posting = { weight_threshold: 1, account_auths: [], key_auths: [[keys.postingPubkey, 1]] };
      return broadcast.prepareWithPrivateKey(chain, account, 'owner', ownerWif, 'accountUpdate', [account, owner, active, posting, keys.memoPubkey, jsonMetadata], {
        title: 'Golos reset keys',
        warnings: ['Сброс ключей удалит старые key/account auths. Убедитесь, что backup приватных ключей скачан и сохранён.']
      });
    });

    bindOperationForm(chain, 'manage-follow-form', (form) => {
      if (chain.id !== 'golos') throw new Error('Follow/unfollow здесь доступен только для Golos.');
      const follower = auth.getCurrentLogin(chain);
      const following = normalizeAccountInput(chain, form.get('following'), 'Аккаунт подписки');
      const followMode = String(form.get('mode') || 'follow');
      const payload = ['follow', { follower, following, what: followMode === 'follow' ? ['blog'] : [] }];
      return broadcast.prepare(chain, 'posting', 'sendOperations', [[
        ['custom_json', {
          required_auths: [],
          required_posting_auths: [follower],
          id: 'follow',
          json: JSON.stringify(payload)
        }]
      ]], { title: followMode === 'follow' ? 'Подписка' : 'Отписка', to: following });
    });

    bindOperationForm(chain, 'manage-workers-vote-form', (form) => {
      if (chain.id !== 'golos') throw new Error('Workers здесь доступны только для Golos.');
      const voter = auth.getCurrentLogin(chain);
      const author = normalizeAccountInput(chain, form.get('author'), 'Автор заявки');
      const permlink = String(form.get('permlink') || '').trim();
      if (!permlink) throw new Error('Permlink заявки обязателен для голоса worker_request_vote.');
      const votePercent = Math.max(-10000, Math.min(10000, Math.round(Number(form.get('percent') || 0) * 100)));
      return broadcast.prepare(chain, 'posting', 'sendOperations', [[
        ['worker_request_vote', { voter, author, permlink, vote_percent: votePercent, extensions: [] }]
      ]], { title: 'Golos worker_request_vote', to: author, amount: `${votePercent / 100}%` });
    });

    bindOperationForm(chain, 'manage-workers-create-form', (form) => {
      if (chain.id !== 'golos') throw new Error('Workers здесь доступны только для Golos.');
      const post = parseGolosWorkerPostUrl(form.get('request_url'));
      const worker = normalizeAccountInput(chain, form.get('worker'), 'Аккаунт воркера');
      const token = normalizeGolosTokenSymbol(form.get('token') || 'GOLOS', 'Токен worker request');
      const min = normalizeAssetInput(chain, form.get('min'), token, 'Минимальная сумма worker request');
      const max = normalizeAssetInput(chain, form.get('max'), token, 'Максимальная сумма worker request');
      const days = Math.max(5, Math.min(30, Math.trunc(Number(form.get('days') || 5))));
      return broadcast.prepare(chain, 'posting', 'sendOperations', [[
        ['worker_request', {
          author: post.author,
          permlink: post.permlink,
          worker,
          required_amount_min: min,
          required_amount_max: max,
          vest_reward: form.get('vest_reward') === 'on',
          duration: days * 86400,
          extensions: []
        }]
      ]], { title: 'Golos worker_request', to: worker, amount: `${min}..${max}` });
    });

    bindOperationForm(chain, 'manage-witness-props-form', (form) => {
      if (chain.id !== 'golos' && chain.id !== 'hive' && chain.id !== 'steem') throw new Error('chain_properties_update здесь доступен только для Golos/Hive/Steem.');
      const props = collectWitnessPropsFromForm(chain, form);
      return broadcast.prepare(chain, 'active', 'sendOperations', [[
        ['chain_properties_update', { owner: auth.getCurrentLogin(chain), props: chain.id === 'golos' ? [9, props] : props }]
      ]], { title: `${chain.title} chain_properties_update`, warnings: ['Опасная witness операция: проверьте chain properties перед отправкой.'] });
    });

    bindOperationForm(chain, 'viz-create-account-form', async (form) => {
      if (chain.id !== 'viz') throw new Error('Создание VIZ аккаунта доступно только для VIZ.');
      const creator = auth.getCurrentLogin(chain);
      let name = normalizeAccountInput(chain, form.get('name'), 'Новый VIZ аккаунт');
      if (String(form.get('registrationType') || 'account') === 'subaccount' && !name.includes('.')) name = `${name}.${creator}`;
      if (!createAccountState.pendingKeys || createAccountState.name !== name) throw new Error('Сначала сгенерируйте ключи именно для этого VIZ аккаунта.');
      createAccountState.backupConfirmed = createAccountState.backupConfirmed || form.get('savedBackup') === 'on';
      if (!createAccountState.backupConfirmed) throw new Error('Перед созданием аккаунта подтвердите, что backup приватных ключей нового аккаунта сохранён.');
      const existing = await fetchChainAccount(chain, name).catch(() => null);
      if (existing && existing.name === name) throw new Error(`Аккаунт @${name} уже существует.`);
      const keys = createAccountState.pendingKeys;
      const master = { weight_threshold: 1, account_auths: [], key_auths: [[keys.masterPubkey, 1]] };
      const active = { weight_threshold: 1, account_auths: [], key_auths: [[keys.activePubkey, 1]] };
      const regular = { weight_threshold: 1, account_auths: [], key_auths: [[keys.regularPubkey, 1]] };
      const amountText = String(form.get('amount') || '').trim().replace(',', '.').replace(/\s*(VIZ|SHARES)$/i, '');
      if (!/^\d+(?:\.\d{1,6})?$/.test(amountText) || Number(amountText) < 0) throw new Error('Сумма должна быть неотрицательным числом.');
      const tokenAmount = String(form.get('paymentType') || 'delegation') === 'fee' ? normalizeAssetInput(chain, amountText, chain.liquidSymbol, 'Account creation VIZ fee') : `0.000 ${chain.liquidSymbol}`;
      const sharesAmount = String(form.get('paymentType') || 'delegation') === 'fee' ? `0.000000 ${chain.vestingSymbol}` : normalizeAssetInput(chain, amountText, chain.vestingSymbol, 'Account creation delegated SHARES');
      return broadcast.prepare(chain, 'active', 'accountCreate', [tokenAmount, sharesAmount, creator, name, master, active, regular, keys.memoPubkey, '', '', []], {
        title: 'VIZ accountCreate', to: name, amount: `${tokenAmount}; ${sharesAmount}`, warnings: ['Приватные ключи нового аккаунта не включаются в operation preview. Убедитесь, что backup скачан.']
      });
    });

    bindOperationForm(chain, 'viz-reset-keys-form', async (form) => {
      if (chain.id !== 'viz') throw new Error('Сброс VIZ ключей доступен только для VIZ.');
      const account = normalizeAccountInput(chain, form.get('account'), 'Аккаунт для сброса');
      if (!resetKeys.pendingKeys || resetKeys.account !== account) throw new Error('Сначала сгенерируйте новые ключи именно для этого аккаунта и скачайте backup.');
      resetKeys.backupConfirmed = resetKeys.backupConfirmed || form.get('savedBackup') === 'on';
      if (!resetKeys.backupConfirmed) throw new Error('Перед сбросом подтвердите, что новые приватные ключи сохранены в backup.');
      const ownerWif = String(form.get('ownerWif') || '').trim();
      const current = await fetchChainAccount(chain, account);
      if (!current || typeof current.json_metadata === 'undefined') throw new Error('Не удалось получить текущий json_metadata аккаунта; сброс ключей остановлен, чтобы не стереть metadata.');
      const keys = resetKeys.pendingKeys;
      const master = { weight_threshold: 1, account_auths: [], key_auths: [[keys.masterPubkey, 1]] };
      const active = { weight_threshold: 1, account_auths: [], key_auths: [[keys.activePubkey, 1]] };
      const regular = { weight_threshold: 1, account_auths: [], key_auths: [[keys.regularPubkey, 1]] };
      return broadcast.prepareWithPrivateKey(chain, account, 'master', ownerWif, 'accountUpdate', [account, master, active, regular, keys.memoPubkey, current.json_metadata || '{}'], {
        title: 'VIZ reset keys', warnings: ['Сброс ключей удалит старые key/account auths. Owner/master WIF используется только в памяти и не показывается в preview/result.']
      });
    });

    bindOperationForm(chain, 'viz-many-invites-form', (form) => {
      if (chain.id !== 'viz') throw new Error('Batch invites доступны только для VIZ.');
      const mode = String(form.get('mode') || 'create');
      const account = auth.getCurrentLogin(chain);
      let ops = [];
      if (mode === 'create') {
        const count = Math.max(1, Math.min(50, Math.trunc(Number(form.get('count') || 1))));
        const amount = normalizeAssetInput(chain, form.get('amount'), chain.liquidSymbol, 'Баланс invite');
        let preparedInvites = Array.isArray(manyInvitesState.invites) ? manyInvitesState.invites.slice(0, count) : [];
        while (preparedInvites.length < count) {
          const secret = generateVizInviteSecret();
          preparedInvites.push({ secret, publicKey: vizInvitePublic(secret) });
        }
        manyInvitesState.invites = preparedInvites;
        ops = preparedInvites.map((item) => ['create_invite', { creator: account, balance: amount, invite_key: item.publicKey }]);
      } else {
        const secrets = String(form.get('secrets') || '').split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
        if (!secrets.length) throw new Error('Вставьте invite secrets для use/claim.');
        const opName = mode === 'claim' ? 'claim_invite_balance' : 'use_invite_balance';
        ops = secrets.map((secret) => [opName, { initiator: account, receiver: account, invite_secret: secret }]);
      }
      return broadcast.prepare(chain, 'active', 'sendOperations', [ops], { title: `VIZ ${mode} many invites`, warnings: ['Batch invite preview/result sanitizes invite_secret; create mode показывает только публичные invite_key.'] });
    });

    bindOperationForm(chain, 'viz-witness-props-form', (form) => {
      if (chain.id !== 'viz') throw new Error('versionedChainPropertiesUpdate доступен только для VIZ.');
      const props = collectWitnessPropsFromForm(chain, form);
      return broadcast.prepare(chain, 'active', 'versionedChainPropertiesUpdate', [auth.getCurrentLogin(chain), [3, props]], { title: 'VIZ versionedChainPropertiesUpdate', warnings: ['Опасная witness операция: меняет chain properties; проверьте поля перед отправкой.'] });
    });

    bindOperationForm(chain, 'viz-multisig-authority-form', (form) => {
      if (chain.id !== 'viz') throw new Error('VIZ multisig authority доступен только для VIZ.');
      const account = auth.getCurrentLogin(chain);
      const activeWif = String(form.get('activeWif') || '').trim();
      const kind = String(form.get('kind') || 'regular') === 'active' ? 'active' : 'regular';
      const threshold = Math.max(1, Number.parseInt(String(form.get('threshold') || '1'), 10));
      const accountAuths = parseAuthorityAccountAuths(form.get('accountAuths'));
      if (!accountAuths.length) throw new Error('Добавьте хотя бы один account auth для multisig.');
      const current = { weight_threshold: threshold, account_auths: accountAuths, key_auths: [] };
      const empty = { weight_threshold: 1, account_auths: [], key_auths: [] };
      const active = kind === 'active' ? current : empty;
      const regular = kind === 'regular' ? current : empty;
      return broadcast.prepareWithPrivateKey(chain, account, 'active', activeWif, 'accountUpdate', [account, undefined, active, regular, undefined, undefined], { title: 'VIZ multisig accountUpdate', warnings: ['Multisig update может заменить текущие key_auths выбранного authority. Проверьте account_auths и threshold.'] });
    });

    bindOperationForm(chain, 'viz-multisig-signed-tx-form', (form) => {
      if (chain.id !== 'viz') throw new Error('VIZ signed transaction submit доступен только для VIZ.');
      const signedTx = parseSignedTransactionJson(form.get('signedTx'));
      return broadcast.prepareExternal(chain, 'broadcastTransactionSynchronous', [signedTx], { title: 'VIZ signed transaction submit', warnings: ['Отправляется уже подписанная transaction JSON; локальные WIF не используются.'] });
    });

    bindOperationForm(chain, 'viz-create-invite-form', (form) => broadcast.prepare(chain, 'active', 'createInvite', [
      auth.getCurrentLogin(chain),
      normalizeAssetInput(chain, form.get('balance'), chain.liquidSymbol, 'Invite balance'),
      String(form.get('publicKey') || '').trim()
    ], { title: 'VIZ: создание invite', amount: normalizeAssetInput(chain, form.get('balance'), chain.liquidSymbol, 'Invite balance'), warnings: ['Используйте только публичный invite key. Приватный invite secret храните отдельно.'] }));

    bindOperationForm(chain, 'viz-use-invite-form', (form) => {
      const receiver = String(form.get('receiver') || '').trim().replace(/^@/, '') || auth.getCurrentLogin(chain);
      const method = form.get('toVesting') === 'on' ? 'useInviteBalance' : 'claimInviteBalance';
      return broadcast.prepare(chain, 'active', method, [auth.getCurrentLogin(chain), normalizeAccountInput(chain, receiver, 'Получатель'), String(form.get('secret') || '').trim()], { title: method, to: receiver, warnings: ['Секрет invite нужен для подписи операции. Не публикуйте данные проверки операции.'] });
    });

    bindOperationForm(chain, 'viz-committee-vote-form', (form) => {
      const requestId = broadcast.validateRequestId(form.get('requestId'));
      const vote = Math.round(Number(form.get('vote') || 0) * 100);
      return broadcast.prepare(chain, 'regular', 'committeeVoteRequest', [auth.getCurrentLogin(chain), requestId, vote], { title: 'VIZ committee vote', requestId });
    });

    bindOperationForm(chain, 'viz-committee-create-form', (form) => {
      const worker = normalizeAccountInput(chain, form.get('worker'), 'Воркер');
      const min = normalizeAssetInput(chain, form.get('min'), chain.liquidSymbol, 'Минимальная награда');
      const max = normalizeAssetInput(chain, form.get('max'), chain.liquidSymbol, 'Максимальная награда');
      const duration = Number(form.get('days') || 1) * 86400;
      return broadcast.prepare(chain, 'regular', 'committeeWorkerCreateRequest', [auth.getCurrentLogin(chain), String(form.get('url') || '').trim(), worker, min, max, duration], { title: 'VIZ committee создать заявку', to: worker, amount: `${min}..${max}` });
    });
    setStatus(`${chain.title} управление готово: proxy/witness/настройки/authority/профиль${chain.id === 'golos' ? '/follow/workers/witness-list/create-account' : ''}${chain.id === 'viz' ? '/witness-list/invite/committee' : ''}.`, 'ok');
  }

  function vizExplorerBlockLinks(chain, title, startBlock) {
    var start = Number(startBlock);
    if (!Number.isFinite(start) || start <= 0) return '';
    var links = [];
    for (var index = 0; index < 10 && start - index > 0; index += 1) {
      var blockNum = start - index;
      links.push(`<li><a href="${escapeHtml(appHash({ chain: chain.id, app: 'explorer', kind: 'block', value: blockNum }))}">${escapeHtml(blockNum)}</a></li>`);
    }
    return `<section class="subpanel"><h3>${escapeHtml(title)}</h3><ul>${links.join('')}</ul></section>`;
  }

  async function loadVizExplorerOverview(chain, connection) {
    const [dynamicProperties, chainProperties] = await Promise.all([
      profiles.apiCall(connection, 'getDynamicGlobalProperties', []),
      profiles.apiCall(connection, 'getChainProperties', []).catch((error) => ({ _error: profiles.formatError(error) }))
    ]);
    return { chain, dynamicProperties: dynamicProperties || {}, chainProperties: chainProperties || {} };
  }

  function renderVizExplorerOverview(data) {
    var chain = data.chain;
    var props = data.dynamicProperties || {};
    var chainProps = data.chainProperties || {};
    var chainPropRows = Object.assign({}, chainProps);
    var chainPropDescriptions = {
      account_creation_fee: 'Передаваемая комиссия при создании аккаунта',
      create_account_delegation_ratio: 'Коэффициент наценки делегирования при создании аккаунта',
      create_account_delegation_time: 'Срок делегирования при создании аккаунта (секунды)',
      maximum_block_size: 'Максимальный размер блока в сети (байты)',
      min_delegation: 'Минимальное количество токенов при делегировании',
      bandwidth_reserve_percent: 'Доля сети для резервной пропускной способности',
      bandwidth_reserve_below: 'Порог резервной пропускной способности',
      vote_accounting_min_rshares: 'Минимальный вес голоса для учёта при награждении',
      committee_request_approve_min_percent: 'Минимальная доля соц. капитала для решения Фонда ДАО',
      inflation_witness_percent: 'Доля эмиссии на вознаграждение делегатов',
      inflation_ratio_committee_vs_reward_fund: 'Доля эмиссии в Фонд ДАО относительно Фонда наград',
      inflation_recalc_period: 'Количество блоков между пересчётом инфляции',
      data_operations_cost_additional_bandwidth: 'Наценка bandwidth за data-операции',
      witness_miss_penalty_percent: 'Штраф делегату за пропуск блока',
      witness_miss_penalty_duration: 'Длительность штрафа делегату за пропуск блока',
      create_invite_min_balance: 'Минимальный баланс для создания инвайта',
      committee_create_request_fee: 'Комиссия за заявку в комитет',
      create_paid_subscription_fee: 'Комиссия за платную подписку',
      account_on_sale_fee: 'Комиссия за продажу аккаунта',
      subaccount_on_sale_fee: 'Комиссия за продажу субаккаунтов',
      witness_declaration_fee: 'Комиссия за декларирование делегатом',
      withdraw_intervals: 'Количество интервалов уменьшения капитала'
    };
    var chainPropsHtml = chainProps._error ? `<p class="notice">Основные параметры не загрузились: ${escapeHtml(chainProps._error)}</p>` : `<dl class="kv-list">${Object.keys(chainPropRows).filter(function (key) { return !['min_curation_percent', 'max_curation_percent', 'flag_energy_additional_cost'].includes(key); }).map(function (key) { return `<div><dt>${escapeHtml(chainPropDescriptions[key] || key)}</dt><dd><code>${escapeHtml(key)}</code>: ${formatExplorerValue(chain, key, chainPropRows[key])}</dd></div>`; }).join('')}</dl>`;
    return `
      <nav aria-label="Оглавление VIZ explorer"><ul><li><a href="#viz-explorer-stable-blocks">Последние блоки с необратимого</a></li><li><a href="#viz-explorer-head-blocks">Последние блоки с последнего</a></li><li><a href="#viz-explorer-chain-props">Основные параметры</a></li></ul></nav>
      <section id="viz-explorer-stable-blocks" aria-labelledby="viz-explorer-stable-blocks-heading">${vizExplorerBlockLinks(chain, 'Последние блоки с необратимого', props.last_irreversible_block_num).replace('<h3>', '<h3 id="viz-explorer-stable-blocks-heading">')}</section>
      <section id="viz-explorer-head-blocks" aria-labelledby="viz-explorer-head-blocks-heading">${vizExplorerBlockLinks(chain, 'Последние блоки с последнего (обратимого)', props.head_block_number).replace('<h3>', '<h3 id="viz-explorer-head-blocks-heading">')}</section>
      <section id="viz-explorer-chain-props" aria-labelledby="viz-explorer-chain-props-heading"><h3 id="viz-explorer-chain-props-heading">Основные параметры</h3>${chainPropsHtml}</section>
      ${rawJsonDetails('Dynamic global properties', props)}${rawJsonDetails('Chain properties', chainProps)}`;
  }

  async function loadVizExplorerBlock(connection, blockNum) {
    const [header, ops] = await Promise.all([
      profiles.apiCall(connection, 'getBlockHeader', [Number(blockNum)]),
      profiles.apiCall(connection, 'getOpsInBlock', [Number(blockNum), false]).catch(() => [])
    ]);
    var operations = Array.isArray(ops) ? ops.map(function (item, index) {
      if (item && Array.isArray(item.op)) {
        return { index: item.virtual_op || item.trx_in_block || index, type: item.op[0], data: item.op[1], timestamp: item.timestamp, trx_id: item.trx_id };
      }
      return item;
    }) : [];
    return Object.assign({ block_num: Number(blockNum), operations: operations }, header || {});
  }

  async function loadSteemExplorerOverview(chain, connection) {
    const [dynamicProperties, chainProperties] = await Promise.all([
      profiles.apiCall(connection, 'getDynamicGlobalProperties', []),
      profiles.apiCall(connection, 'getChainProperties', []).catch((error) => ({ _error: profiles.formatError(error) }))
    ]);
    return { chain, dynamicProperties: dynamicProperties || {}, chainProperties: chainProperties || {} };
  }

  function renderSteemExplorerOverview(data) {
    var chain = data.chain;
    var props = data.dynamicProperties || {};
    var chainProps = data.chainProperties || {};
    var chainPropRows = Object.assign({}, chainProps);
    var chainPropDescriptions = {
      account_creation_fee: 'Размер комиссии за создание аккаунта без делегирования (STEEM)',
      maximum_block_size: 'Максимальный размер блока в сети (байты)',
      sbd_interest_rate: '% начисляемый на SBD',
      account_subsidy_budget: 'Субсидии аккаунта, которые будут добавлены к субсидии аккаунта за блок',
      account_subsidy_decay: 'Сокращение субсидий аккаунта'
    };
    var chainPropsHtml = chainProps._error ? `<p class="notice">Основные параметры не загрузились: ${escapeHtml(chainProps._error)}</p>` : `<dl class="kv-list">${Object.keys(chainPropRows).map(function (key) { return `<div><dt>${escapeHtml(chainPropDescriptions[key] || key)}</dt><dd><code>${escapeHtml(key)}</code>: ${formatExplorerValue(chain, key, chainPropRows[key])}</dd></div>`; }).join('')}</dl>`;
    return `
      <nav aria-label="Оглавление Steem explorer"><ul><li><a href="#steem-explorer-stable-blocks">Последние блоки с необратимого</a></li><li><a href="#steem-explorer-head-blocks">Последние блоки с последнего</a></li><li><a href="#steem-explorer-chain-props">Основные параметры</a></li></ul></nav>
      <section id="steem-explorer-stable-blocks" aria-labelledby="steem-explorer-stable-blocks-heading">${vizExplorerBlockLinks(chain, 'Последние блоки с необратимого', props.last_irreversible_block_num).replace('<h3>', '<h3 id="steem-explorer-stable-blocks-heading">')}</section>
      <section id="steem-explorer-head-blocks" aria-labelledby="steem-explorer-head-blocks-heading">${vizExplorerBlockLinks(chain, 'Последние блоки с последнего (обратимого)', props.head_block_number).replace('<h3>', '<h3 id="steem-explorer-head-blocks-heading">')}</section>
      <section id="steem-explorer-chain-props" aria-labelledby="steem-explorer-chain-props-heading"><h3 id="steem-explorer-chain-props-heading">Основные параметры</h3>${chainPropsHtml}</section>
      ${rawJsonDetails('Dynamic global properties', props)}${rawJsonDetails('Chain properties', chainProps)}`;
  }

  async function loadSteemExplorerBlock(connection, blockNum) {
    const [header, ops] = await Promise.all([
      profiles.apiCall(connection, 'getBlockHeader', [Number(blockNum)]),
      profiles.apiCall(connection, 'getOpsInBlock', [Number(blockNum), false]).catch(() => [])
    ]);
    var operations = Array.isArray(ops) ? ops.map(function (item, index) {
      if (item && Array.isArray(item.op)) {
        return { index: item.virtual_op || item.trx_in_block || index, type: item.op[0], data: item.op[1], timestamp: item.timestamp, trx_id: item.trx_id };
      }
      return item;
    }) : [];
    return Object.assign({ block_num: Number(blockNum), operations: operations }, header || {});
  }

  function minterTxTypeLabel(type) {
    const labels = {
      1: 'Отправка', 2: 'Продажа монеты', 3: 'Продажа всех монет', 4: 'Покупка монет', 5: 'Создание монеты', 6: 'Объявление кандидата в валидаторы', 7: 'Делегирование', 8: 'Анбонд', 9: 'Получение чека', 10: 'Установка кандидата в статусе онлайн', 11: 'Установка кандидата в статусе оффлайн', 12: 'Создание мультисига', 13: 'Мультисенд (мульти-отправка)', 14: 'Редактирование кандидата', 15: 'Установка блока остановки', 16: 'Пересоздание монеты', 17: 'Изменение владельца монеты', 18: 'Редактирование мультисига', 19: 'Голосование за цену', 20: 'Изменение публичного ключа кандидата', 21: 'Добавление ликвидности', 22: 'Удаление ликвидности', 23: 'Продажа через пул', 24: 'Покупка через пул', 25: 'Продажа всех монет через пул', 26: 'Изменение комиссии кандидата', 27: 'Перемещение стейка', 28: 'Эмиссия токена', 29: 'Сжигание токена', 30: 'Создание токена', 31: 'Пересоздание токена', 32: 'Голосование за комиссию', 33: 'Голосование за обновление', 34: 'Создание пула ликвидности', 35: 'Создание ордера', 36: 'Отмена лимитного ордера', 37: 'Блокировка стейка', 38: 'Блокировка токенов', 39: 'Перенос стейка'
    };
    return labels[Number(type)] || `Тип ${escapeHtml(type)}`;
  }

  async function loadMinterExplorerOverview(chain) {
    const [status, statusPage] = await Promise.all([
      fetchJsonText(`${chain.apiBase}/status`, 'Minter status API'),
      fetchJsonText(`${chain.explorerBase}/status-page`, 'Minter explorer status-page').catch(() => null)
    ]);
    return { status, statusPage: statusPage && (statusPage.data || statusPage.result || statusPage) };
  }

  function renderMinterExplorerOverview(chain, overview) {
    const status = overview.status || {};
    const page = overview.statusPage || {};
    const latest = Number(status.latest_block_height || 0);
    const blocks = latest ? Array.from({ length: 10 }, (_, index) => latest - index).filter((value) => value > 0) : [];
    return `<h2>Введите номер блока или хэш-сумму транзакции блокчейна Minter:</h2>
      <nav aria-label="Оглавление Minter explorer"><ul><li><a href="#minter-explorer-last-blocks">Последние блоки</a></li><li><a href="#minter-explorer-status">Статус</a></li></ul></nav>
      <section id="minter-explorer-last-blocks" aria-labelledby="minter-explorer-last-blocks-heading"><h3 id="minter-explorer-last-blocks-heading">Последние блоки</h3><ul>${blocks.map((height) => `<li>${explorerLink(chain, 'block', height, String(height))}</li>`).join('') || '<li>Публичный API не вернул номер последнего блока.</li>'}</ul></section>
      <section id="minter-explorer-status" aria-labelledby="minter-explorer-status-heading"><h3 id="minter-explorer-status-heading">Статус</h3><ul>
        <li>Сеть: ${escapeHtml(status.network || '')}</li>
        <li>Хеш последнего блока: ${escapeHtml(status.latest_block_hash || '')}</li>
        <li>Номер последнего блока: ${escapeHtml(status.latest_block_height || '')}</li>
        <li>Дата и время последнего блока: ${escapeHtml(status.latest_block_time || '')}</li>
        <li>Публичный ключ валидатора: ${escapeHtml(status.public_key || '')}</li>
        ${page.bip_emission ? `<li>Эмиссия BIP: ${escapeHtml(page.bip_emission)}</li>` : ''}
        ${page.free_float_bip ? `<li>На руках (в ликвиде) ${escapeHtml(page.free_float_bip)} BIP</li>` : ''}
        ${page.block_speed_24h ? `<li>Средняя скорость выпуска блоков за 24 часа: ${escapeHtml(formatLongNumber(page.block_speed_24h, 2))} с</li>` : ''}
        ${page.transaction_count_24h ? `<li>Кол-во транзакций за 24 часа: ${escapeHtml(page.transaction_count_24h)}</li>` : ''}
      </ul></section>${rawJsonDetails('Minter status API', status)}${page ? rawJsonDetails('Minter status-page API', page) : ''}`;
  }

  async function loadMinterExplorerBlock(chain, height) {
    return fetchJsonText(`${chain.apiBase}/block/${encodeURIComponent(height)}`, 'Minter block API');
  }

  function renderMinterExplorerData(chain, data) {
    if (!data || typeof data !== 'object') return escapeHtml(data);
    if (Array.isArray(data.list)) return renderMinterMultisendDetailsHtml(chain, { data });
    const entries = Object.entries(data);
    return `<dl class="kv-list">${entries.map(([key, value]) => {
      let rendered;
      if (isAccountLikeKey(key)) rendered = renderAccountCell(chain, value);
      else if (key === 'value') rendered = `${escapeHtml(history.formatChainAmount ? history.formatChainAmount(chain, key, value) : String(value))}`;
      else if (key === 'coin' && value && typeof value === 'object') rendered = escapeHtml(value.symbol || JSON.stringify(value));
      else rendered = Array.isArray(value) || (value && typeof value === 'object') ? `<code>${escapeHtml(JSON.stringify(value))}</code>` : escapeHtml(value);
      return `<div><dt>${escapeHtml(key === 'value' ? 'Количество' : key === 'coin' ? 'Монета' : key)}</dt><dd>${rendered}</dd></div>`;
    }).join('')}</dl>`;
  }

  function renderMinterExplorerBlock(chain, block, height) {
    const txs = Array.isArray(block.transactions) ? block.transactions : [];
    const current = Number(height || block.height || 0);
    return `<h2>Блок №${escapeHtml(height || block.height || '')} (${explorerLink(chain, 'block', current - 1, '← предыдущий')}, ${explorerLink(chain, 'block', current + 1, '→ следующий')})</h2>
      <h3>Транзакции: ${escapeHtml(block.transaction_count || txs.length || 0)}</h3>
      ${txs.length ? `<ol>${txs.map((tx) => `<li><h3>Хеш: ${explorerLink(chain, 'tx', tx.hash, tx.hash)}</h3><div class="table-wrap"><table aria-label="Транзакция Minter в блоке"><caption>Транзакция ${escapeHtml(tx.hash || '')}</caption><thead><tr><th scope="col">Тип транзакции</th><th scope="col">JSON</th></tr></thead><tbody><tr><td>${escapeHtml(minterTxTypeLabel(tx.type))}</td><td>${renderMinterExplorerData(chain, tx.data)}</td></tr></tbody></table></div></li>`).join('')}</ol>` : '<p class="muted">Транзакций в блоке нет.</p>'}
      <h2>Информация о блоке</h2><ul><li>Сформирован ${escapeHtml(block.time || '')} GMT</li><li>Предложил блок: ${escapeHtml(block.proposer || '')}</li></ul>${rawJsonDetails('Minter block API', block)}`;
  }

  async function loadMinterExplorerTx(chain, hash) {
    const payload = await fetchJsonText(`${chain.explorerBase}/transactions/${encodeURIComponent(hash)}`, 'Minter transaction API');
    return payload && (payload.data || payload.result || payload);
  }

  function renderMinterExplorerTx(chain, tx, hash) {
    if (!tx || !Object.keys(tx).length) return '<p>Такой транзакции нет.</p>';
    return `<h2>Транзакция ${escapeHtml(hash)}</h2><ul>
      <li>Блок: ${explorerLink(chain, 'block', tx.height, String(tx.height || ''))}</li>
      <li>Создана: ${escapeHtml(tx.timestamp || tx.time || '')}</li>
      <li>Тип: ${escapeHtml(minterTxTypeLabel(tx.type))}</li>
      <li>Отправитель: ${renderAccountCell(chain, tx.from)}</li>
      <li>Комиссия: ${escapeHtml(tx.gas_coin && tx.gas_coin.symbol ? tx.gas_coin.symbol : '')} (BIP ${escapeHtml(history.formatChainAmount ? history.formatChainAmount(chain, 'fee', tx.fee) : tx.fee || '')})</li>
    </ul><hr><h3>Данные</h3>${renderMinterExplorerData(chain, tx.data)}${rawJsonDetails('Minter transaction API', tx)}`;
  }

  async function renderExplorer(chain, account) {
    const state = parseHash();
    appEl.innerHTML = `
      <section class="panel">
        <h2>${escapeHtml(chain.title)}: проводник</h2>
        <form id="explorer-form" class="route-form">
          <div class="field"><label for="explorer-kind">Что открыть</label><select id="explorer-kind" name="kind"><option value="account" ${state.kind === 'account' ? 'selected' : ''}>Аккаунт</option><option value="block" ${state.kind === 'block' ? 'selected' : ''}>Блок</option><option value="tx" ${state.kind === 'tx' ? 'selected' : ''}>Транзакция</option></select></div>
          <div class="field field-grow"><label for="explorer-value">Аккаунт, номер блока или tx id</label><input id="explorer-value" name="value" type="text" value="${escapeHtml(state.value || account)}"></div>
          <button type="submit">Открыть</button>
        </form>
        <div id="explorer-result" class="operation-result" role="status" aria-live="polite">Выберите, что открыть, и введите аккаунт, номер блока или tx id.</div>
      </section>`;

    document.getElementById('explorer-form').addEventListener('submit', (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      navigate({ chain: chain.id, app: 'explorer', account, kind: form.get('kind'), value: String(form.get('value') || '').trim().replace(/^@/, '') });
    });

    const connection = await getConnection(chain);

    if (!state.kind || !state.value) {
      if (chain.id === 'viz') {
        const overview = await loadVizExplorerOverview(chain, connection);
        document.getElementById('explorer-result').innerHTML = renderVizExplorerOverview(overview);
        setStatus('VIZ проводник: последние блоки и параметры загружены через публичную ноду.', 'ok');
        return;
      }
      if (chain.id === 'steem') {
        const overview = await loadSteemExplorerOverview(chain, connection);
        document.getElementById('explorer-result').innerHTML = renderSteemExplorerOverview(overview);
        setStatus('Steem проводник: последние блоки и параметры загружены через публичную ноду.', 'ok');
        return;
      }
      if (chain.id === 'minter') {
        const overview = await loadMinterExplorerOverview(chain);
        document.getElementById('explorer-result').innerHTML = renderMinterExplorerOverview(chain, overview);
        setStatus('Minter проводник: последние блоки и статус загружены через публичные API.', 'ok');
        return;
      }
      setStatus(`${chain.title} проводник готов.`, 'info');
      return;
    }

    let result;
    if (state.kind === 'block') {
      if (chain.id === 'minter') {
        result = await loadMinterExplorerBlock(chain, state.value);
        document.getElementById('explorer-result').innerHTML = renderMinterExplorerBlock(chain, result, state.value);
        setStatus('Minter проводник: блок загружен через публичный API.', 'ok');
        return;
      }
      if (chain.id === 'viz' && state.kind === 'block') {
        result = await loadVizExplorerBlock(connection, Number(state.value));
      } else if (chain.id === 'steem' && state.kind === 'block') {
        result = await loadSteemExplorerBlock(connection, Number(state.value));
      } else {
        result = await profiles.apiCall(connection, 'getBlock', [Number(state.value)]);
      }
    } else if (state.kind === 'tx') {
      if (chain.id === 'minter') {
        result = await loadMinterExplorerTx(chain, String(state.value).trim());
        document.getElementById('explorer-result').innerHTML = renderMinterExplorerTx(chain, result, state.value);
        setStatus('Minter проводник: транзакция загружена через публичный explorer API.', 'ok');
        return;
      }
      result = await profiles.apiCall(connection, 'getTransaction', [String(state.value).trim()]);
    } else {
      result = await profiles.fetchAccount(connection, String(state.value).trim().replace(/^@/, ''));
    }
    document.getElementById('explorer-result').innerHTML = renderExplorerResult(chain, state.kind, state.value, result);
    setStatus(`${chain.title} проводник: ${state.kind} загружен.`, 'ok');
  }
  function renderMinterHelp(chain) {
    appEl.innerHTML = `
      <section class="panel minter-help" aria-labelledby="minter-help-heading">
        <h2 id="minter-help-heading">${escapeHtml(chain.title)}: справка dpos.space</h2>
        <p>Здесь только видео справка.</p>
        <section aria-labelledby="minter-help-services-heading">
          <h3 id="minter-help-services-heading">Сервисы Minter</h3>
          <iframe width="560" height="315" src="https://www.youtube.com/embed/Hk0GYmc_efo" title="Видео-справка по сервисам Minter на dpos.space" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
        </section>
        <section aria-labelledby="minter-help-long-heading">
          <h4 id="minter-help-long-heading">Ставим на курс криптовалют и пулов в Minter при помощи сервиса экосистемы LONG</h4>
          <iframe width="560" height="315" src="https://www.youtube.com/embed/Fl2-6LXfX4k" title="Видео-справка по LONG ставкам на курс криптовалют и пулов Minter" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
        </section>
        <p class="notice" role="status" aria-live="polite">Статическая read-only страница: видео открываются напрямую с YouTube, без PHP, приватного backend и отправки операций.</p>
      </section>`;
    setStatus('Minter справка открыта как статическая видео-страница без backend.', 'ok');
  }

  function renderVizHelp(chain) {
    appEl.innerHTML = `
      <section class="panel">
        <h2>${escapeHtml(chain.title)}: справка dpos.space</h2>
        <p>Legacy VIZ help автоматически перенаправлял браузер через <code>location.replace</code> на обзор сервисов dpos.space. В static v3 авто-редирект заменён явной доступной ссылкой, чтобы пользователь и screen reader не теряли контекст.</p>
        <p><a href="https://viz.media/obzor-servisov-dpos-space-viz/" target="_blank" rel="noopener">Обзор сервисов dpos.space на viz.media</a></p>
        <p class="notice">Раздел read-only: он не отправляет операции, не вызывает PHP и не использует скрытые backend API.</p>
      </section>`;
    setStatus('VIZ справка открыта как явная статическая ссылка без auto-redirect.', 'ok');
  }

  function renderSteemHelp(chain) {
    appEl.innerHTML = `
      <section class="panel">
        <h2>${escapeHtml(chain.title)}: справка dpos.space</h2>
        <p>Legacy Steem help автоматически перенаправлял браузер на обзор сервисов dpos.space для Steem. В static v3 auto-redirect заменён явной доступной ссылкой, чтобы пользователь и screen reader не теряли контекст.</p>
        <p><a href="https://steemit.com/hive-176147/@lllll1ll/obzor-servisov-prilozheniya-dpos-space-dlya-blokcheina-steem" target="_blank" rel="noopener">Обзор сервисов приложения dpos.space для блокчейна Steem</a></p>
        <p class="notice">Раздел read-only: он не отправляет операции, не вызывает PHP и не использует скрытые backend API.</p>
      </section>`;
    setStatus('Steem справка открыта как явная статическая ссылка без auto-redirect.', 'ok');
  }

  function renderVizExchanges(chain) {
    appEl.innerHTML = `
      <section class="panel">
        <h2>${escapeHtml(chain.title)}: обмен VIZ</h2>
        <p>Информационная страница со ссылками для покупки и продажи VIZ.</p>
        <ol>
          <li><a href="https://swap.viz.world/" target="_blank" rel="noopener">swap.viz.world — покупка VIZ</a></li>
          <li><a href="https://control.viz.world/media/@urri77/покупка-viz-за-usdt-на-бирже-рудекс/" target="_blank" rel="noopener">Инструкция по покупке VIZ за USDT на RuDEX</a></li>
          <li><a href="https://readdle.me/#viz://@denis-skripnik/60937915/publication/" target="_blank" rel="noopener">Материал о шлюзе через Minter</a></li>
        </ol>
      </section>`;
    setStatus('Страница обмена VIZ загружена.', 'ok');
  }

  function htmlToMarkdownLikeText(root) {
    if (!root) return '';
    const parts = [];
    const walk = (node) => {
      if (!node) return;
      if (node.nodeType === 3) {
        const text = String(node.textContent || '').replace(/\s/g, ' ').trim();
        if (text) parts.push(text);
        return;
      }
      if (node.nodeType !== 1) return;
      const tag = String(node.tagName || '').toLowerCase();
      if (tag === 'script' || tag === 'style' || tag === 'noscript') return;
      if (/^h[1-6]$/.test(tag)) parts.push(`\n# ${String(node.textContent || '').trim()}\n`);
      else if (tag === 'p' || tag === 'blockquote' || tag === 'li') parts.push(`\n${String(node.textContent || '').trim()}\n`);
      else if (tag === 'br') parts.push('\n');
      else Array.from(node.childNodes || []).forEach(walk);
    };
    walk(root);
    return parts.join(' ').replace(/[ \t]\n/g, '\n').replace(/\n[ \t]/g, '\n').replace(/\n{3,}/g, '\n\n').replace(/[ \t]{2,}/g, ' ').trim();
  }

  function parseImportedArticleHtml(source, sourceUrl) {
    const html = String(source || '');
    if (!/<[a-z][\s\S]*>/i.test(html) || !global.DOMParser) {
      const lines = html.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
      const heading = lines.find((line) => /^#\s/.test(line));
      return { title: heading ? heading.replace(/^#\s/, '') : (lines[0] || ''), body: html.trim(), sourceUrl };
    }
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const telegraph = doc.querySelector('.tl_article, article, main') || doc.body;
    const mirror = doc.querySelector('[data-post-content], .post-content, .mirror-post') || telegraph;
    const titleNode = doc.querySelector('h1, .tl_article_header, [data-testid="publication-title"], title');
    const title = titleNode ? String(titleNode.textContent || '').trim() : '';
    const body = htmlToMarkdownLikeText(mirror);
    return { title, body, sourceUrl };
  }

  function buildVizVoicePostPayload(account, title, content) {
    var postTitle = String(title || '').trim();
    var postContent = String(content || '').trim();
    if (!postTitle) throw new Error('Введите заголовок публикации Voice.');
    if (!postContent) throw new Error('Введите текст публикации Voice.');
    return JSON.stringify({
      p: account && account.custom_sequence_block_num ? account.custom_sequence_block_num : 0,
      t: 'p',
      d: {
        t: postTitle,
        m: postContent,
        d: postContent.replace(/<[^>]>/g, ' ').replace(/\s/g, ' ').trim().slice(0, 140)
      }
    });
  }

  function buildVizVoiceFooter(sourceUrl) {
    var url = String(sourceUrl || '').trim();
    var sourceLink = url ? `<br><b><a href="${escapeHtml(url)}" target="_blank" rel="noopener">источник</a></b>` : '';
    return `<p>Пост импортирован при помощи <a href="https://dpos.space/viz/voice-import" target="_blank" rel="noopener">voice-import</a>.${sourceLink}</p>`;
  }

  function renderVizVoiceImport(chain) {
    appEl.innerHTML = `
      <section class="panel viz-voice-import">
        <h2>VIZ: Импорт в Voice / readdle.me</h2>
        <p id="posting_auth_msg">Для публикации нужен выбранный VIZ-аккаунт с regular key или Vizonator. Legacy форма показывала это сообщение как <code>posting_auth_msg</code>.</p>
        <p>Legacy импортировал статьи из <code>telegra.ph</code> и <code>mirror.xyz</code>, очищал HTML, загружал картинки на Imgur и публиковал custom protocol <code>V</code> в Voice (<code>readdle.me</code>).</p>
        <p class="notice"><strong>Backend yes:</strong> старый импорт использовал CORS proxy endpoint и внешний Imgur Client-ID для переноса изображений. Это backend-only non-goal в static v3: скрытый proxy, image rehosting и серверная загрузка URL не восстанавливаются; URL пробуется напрямую из браузера, а надёжный путь — вставить HTML/текст вручную.</p>
        <form id="viz-voice-import-parser-form" class="stacked-form"><fieldset>
          <legend>Подготовить черновик из URL или HTML</legend>
          <div class="field"><label for="url-input">Url статьи в telegra.ph или mirror.xyz</label><input type="url" id="url-input" name="url" placeholder="https://telegra.ph/... или https://mirror.xyz/..."></div>
          <div class="field"><label for="viz-voice-source-html">Или HTML/текст статьи</label><textarea id="viz-voice-source-html" name="source" rows="8"></textarea></div>
          <button type="submit" id="import-button">Импортировать локально</button>
          <div id="results" class="operation-result" role="status" aria-live="polite"></div>
        </fieldset></form>
        <details id="viz-voice-publish-details" class="operation-details"><summary>Опубликовать в Voice — preview перед отправкой</summary><form id="viz-voice-publish-form" class="stacked-form"><fieldset>
          <legend>Опубликовать в Voice</legend>
          <div class="field"><label for="viz-voice-title">Заголовок</label><input id="viz-voice-title" name="title" type="text" required></div>
          <div class="field"><label for="viz-voice-content">HTML/текст публикации</label><textarea id="viz-voice-content" name="content" rows="12" required></textarea></div>
          <div class="field"><label for="viz-voice-source-url">Ссылка на источник для подписи</label><input id="viz-voice-source-url" name="source_url" type="url"></div>
          <button type="submit" name="intent" value="preview">Проверить Voice custom</button><button type="submit" name="intent" value="send">Опубликовать в Voice</button>
          <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
        </fieldset></form></details>
      </section>`;

    document.getElementById('viz-voice-import-parser-form').addEventListener('submit', async function (event) {
      event.preventDefault();
      var form = event.currentTarget;
      var data = new FormData(form);
      var url = String(data.get('url') || '').trim();
      var source = String(data.get('source') || '');
      try {
        if (!source && url) {
          var response = await fetch(url);
          source = await response.text();
        }
        if (!source) throw new Error('Укажите URL или вставьте HTML/текст статьи.');
        var parsed = parseImportedArticleHtml(source, url);
        document.getElementById('viz-voice-title').value = parsed.title || '';
        document.getElementById('viz-voice-content').value = (parsed.body || source.trim()) + '\n\n' + buildVizVoiceFooter(url);
        document.getElementById('viz-voice-source-url').value = url;
        setOperationResult(form, 'Черновик Voice подготовлен локально. Проверьте заголовок, текст и изображения перед публикацией.', 'ok');
      } catch (error) {
        setOperationResult(form, profiles.formatError(error) + ' Если браузер заблокировал URL из-за CORS, вставьте HTML/текст вручную.', 'error');
      }
    });

    bindOperationForm(chain, 'viz-voice-publish-form', async function (form) {
      var from = normalizeAccountInput(chain, auth.getCurrentLogin(chain), 'Автор Voice публикации');
      var sourceUrl = String(form.get('source_url') || '').trim();
      var content = String(form.get('content') || '').trim();
      if (sourceUrl && content.indexOf('источник') === -1) content += '\n\n' + buildVizVoiceFooter(sourceUrl);
      var account = await fetchChainAccount(chain, from);
      var payload = buildVizVoicePostPayload(account, form.get('title'), content);
      return broadcast.prepare(chain, 'regular', 'custom', [from, 'V', payload], { title: 'Voice publication custom', protocol: 'V', to: 'readdle.me', warnings: ['Проверьте текст публикации: static v3 не переносит изображения через Imgur и не использует legacy CORS proxy.'] });
    });
    setStatus('VIZ voice-import открыт: импорт выполняется локально, публикация — через подтверждаемый custom protocol V.', 'info');
  }

  function renderImport(chain) {
    const draftKey = `${chain.id}_v3_import_draft`;
    appEl.innerHTML = `
      <section class="panel">
        <h2>${escapeHtml(chain.title)}: импорт статьи</h2>
        <p>Вставьте URL или HTML/текст статьи. v3 разбирает Telegra.ph/Mirror-like HTML локально через DOMParser; произвольные URL могут не загрузиться из-за CORS, тогда вставьте HTML вручную.</p>
        <form id="import-form" class="stacked-form">
          <fieldset>
            <legend>Источник</legend>
            <div class="field"><label for="import-url">URL статьи</label><input id="import-url" name="url" type="url" placeholder="https://example.com/post"></div>
            <div class="field"><label for="import-text">Или вставьте текст/HTML</label><textarea id="import-text" name="text" rows="10"></textarea></div>
            <button type="submit">Подготовить черновик</button>
            <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
          </fieldset>
        </form>
      </section>`;

    document.getElementById('import-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const data = new FormData(form);
      let source = String(data.get('text') || '');
      const url = String(data.get('url') || '').trim();
      const warnings = [];
      if (!source && url) {
        try {
          const response = await fetch(url);
          source = await response.text();
        } catch (error) {
          warnings.push('URL не загрузился из браузера — вероятно CORS. Вставьте HTML/текст статьи вручную.');
          setOperationResult(form, profiles.formatError(error), 'error');
          return;
        }
      }
      const parsed = parseImportedArticleHtml(source, url);
      const draft = { title: parsed.title, body: parsed.body, sourceUrl: url, importedAt: new Date().toISOString() };
      localStorage.setItem(draftKey, JSON.stringify(draft));
      const editorUrl = appHash({ chain: chain.id, app: 'editor', account: auth.getCurrentLogin(chain) });
      setOperationResult(form, `<p>Черновик сохранён. <a href="${escapeHtml(editorUrl)}">Открыть редактор ${escapeHtml(chain.title)}</a>.</p>`, 'ok', { chain: chain.id, from: auth.getCurrentLogin(chain), authority: 'posting', operationName: 'importDraft', params: [{ title: parsed.title, body: parsed.body.slice(0, 1000), sourceUrl: url }], meta: { title: 'Импорт черновика', warnings } });
    });
    setStatus(`${chain.title} импорт готов: URL/text → черновик.`, 'ok');
  }

  function buildTelegramInstantViewUrl(url) {
    const source = String(url || '').trim();
    if (!/^https?:\/\//i.test(source)) throw new Error('Для Telegram Instant View нужен полный http/https URL.');
    const params = new URLSearchParams({ url: source, rhash: '1d27d6e1501db6' });
    return `https://t.me/iv?${params.toString()}`;
  }

  function blockRandomSeed(block, fallback, chain) {
    if (!block || typeof block !== 'object') return String(fallback || '');
    if (chain && (chain.id === 'minter' || chain.id === 'decimal') && block.hash) return String(block.hash);
    if (chain && ['viz', 'steem', 'hive'].includes(chain.id) && block.witness_signature) return String(block.witness_signature);
    return [
      block.hash,
      block.block_id,
      block.previous,
      block.transaction_merkle_root,
      block.witness,
      block.timestamp,
      block.witness_signature,
      JSON.stringify(block.transactions || [])
    ].filter(Boolean).join('|') || String(fallback || '');
  }

  async function fetchMinterRandomBlock(chain, text) {
    const response = await fetch(`${(chain.apiBase || 'https://api.minter.one/v2').replace(/\/$/, '')}/block/${encodeURIComponent(text)}`);
    if (!response.ok) throw new Error(`Minter block ${text}: HTTP ${response.status}`);
    const data = await response.json();
    return data.result || data.data || data;
  }

  async function fetchDecimalRandomBlock(chain, text) {
    const response = await fetch(`${(chain.apiBase || 'https://api.decimalchain.com/api/v1').replace(/\/$/, '')}/blocks/${encodeURIComponent(text)}`);
    if (!response.ok) throw new Error(`Decimal block ${text}: HTTP ${response.status}`);
    const data = await response.json();
    const block = data.Result || data.result || data.data || data;
    return block.block || block;
  }

  async function resolveRandomBlockchainSeed(chain, connection, value) {
    const text = String(value || '').trim();
    if (/^\d+$/.test(text)) {
      const blockNum = Number(text);
      if (chain.id === 'minter') {
        const block = await fetchMinterRandomBlock(chain, text);
        return { input: text, type: 'block', blockNum, seed: blockRandomSeed(block, text, chain), hash: block && block.hash, block };
      }
      if (chain.id === 'decimal') {
        const block = await fetchDecimalRandomBlock(chain, text);
        return { input: text, type: 'block', blockNum, seed: blockRandomSeed(block, text, chain), hash: block && block.hash, block };
      }
      const block = await profiles.apiCall(connection, 'getBlock', [blockNum]);
      return { input: text, type: 'block', blockNum, seed: blockRandomSeed(block, text, chain), witnessSignature: block && block.witness_signature, block };
    }
    return { input: text, type: 'literal', seed: text };
  }

  function renderInstantView(chain) {
    appEl.innerHTML = `
      <section class="panel">
        <h2>${escapeHtml(chain.title)}: Instant View</h2>
        <p>Локальный предпросмотр HTML/Markdown и legacy-ссылка Telegram Instant View без backend.</p>
        <form id="instant-view-link-form" class="stacked-form">
          <fieldset>
            <legend>Telegram Instant View link</legend>
            <div class="field"><label for="instant-view-url">URL статьи</label><input id="instant-view-url" name="url" type="url" placeholder="https://example.com/post" required></div>
            <button type="submit">Сгенерировать ссылку Telegram IV</button>
            <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
          </fieldset>
        </form>
        <form id="instant-view-form" class="stacked-form">
          <fieldset>
            <legend>Локальный предпросмотр</legend>
            <div class="field"><label for="instant-view-source">HTML/Markdown</label><textarea id="instant-view-source" name="source" rows="12" required></textarea></div>
            <button type="submit">Показать очищенный предпросмотр</button>
            <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
          </fieldset>
        </form>
      </section>`;
    document.getElementById('instant-view-link-form').addEventListener('submit', (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      try {
        const url = String(new FormData(form).get('url') || '').trim();
        const ivUrl = buildTelegramInstantViewUrl(url);
        setOperationResult(form, `<p>Telegram Instant View: <a href="${escapeHtml(ivUrl)}" target="_blank" rel="noopener">открыть</a></p><p><button type="button" data-copy-value="${escapeHtml(ivUrl)}">Скопировать ссылку</button></p>`, 'ok', { chain: chain.id, from: auth.getCurrentLogin(chain), authority: 'none', operationName: 'telegramInstantViewLink', params: [{ url, rhash: '1d27d6e1501db6', ivUrl }], meta: { title: 'Telegram Instant View link', warnings: [] } });
        bindCopyButtons(form);
      } catch (error) {
        setOperationResult(form, profiles.formatError(error), 'error');
      }
    });
    document.getElementById('instant-view-form').addEventListener('submit', (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const source = String(new FormData(form).get('source') || '');
      const text = source.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]>/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
      setOperationResult(form, 'Instant View готов.', 'ok', { chain: chain.id, from: auth.getCurrentLogin(chain), authority: 'posting', operationName: 'instantView', params: [{ text }], meta: { title: 'Instant View', warnings: [] } });
    });
    setStatus(`${chain.title} Instant View готов.`, 'ok');
  }

  function renderOrderRows(rows, emptyText) {
    if (!Array.isArray(rows) || !rows.length) return `<p class="muted">${escapeHtml(emptyText || 'Нет данных.')}</p>`;
    return `<div class="table-scroll"><table><caption>Market data</caption><thead><tr><th scope="col">Цена</th><th scope="col">База</th><th scope="col">Котировка</th><th scope="col">Действие</th><th scope="col">Данные</th></tr></thead><tbody>${rows.map((row) => {
      const price = row.real_price || row.price || row.order_price || '';
      const base = row.steem || row.base || row.sell_price && row.sell_price.base || row.for_sale || '';
      const quote = row.sbd || row.quote || row.sell_price && row.sell_price.quote || '';
      const orderId = row.orderid || row.order_id || row.id || row.orderId || '';
      const action = orderId !== '' ? `<button type="button" data-swap-cancel-prefill="${escapeHtml(orderId)}">Отменить этот ордер</button>` : '<span class="muted">Нет действия</span>';
      return `<tr><td>${escapeHtml(price)}</td><td>${escapeHtml(base)}</td><td>${escapeHtml(quote)}</td><td>${action}</td><td><code>${escapeHtml(JSON.stringify(row).slice(0, 240))}</code></td></tr>`;
    }).join('')}</tbody></table></div>`;
  }

  function openSwapCancelDetails(orderId) {
    const details = document.getElementById('swap-cancel-details');
    if (details) details.open = true;
    const input = document.getElementById('swap-cancel-id');
    if (input && orderId !== undefined && orderId !== null) {
      input.value = String(orderId);
      input.focus();
    }
    if (details) details.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function loadGrapheneOrderBook(chain, limit) {
    const connection = await getConnection(chain);
    const count = Math.max(1, Math.min(100, Math.trunc(Number(limit || 20))));
    return profiles.apiCall(connection, 'getOrderBook', [count]);
  }

  async function loadGrapheneOpenOrders(chain, account) {
    const connection = await getConnection(chain);
    return profiles.apiCall(connection, 'getOpenOrders', [account]);
  }

  async function loadGolosSwapAccountAssets(chain, account) {
    if (chain.id !== 'golos') return { balances: {}, assets: [] };
    const connection = await getConnection(chain);
    const api = connection.client && connection.client.api;
    if (!api) throw new Error('Golos API недоступен для загрузки токенов swap.');
    const [accounts, uiaBalances, assets] = await Promise.all([
      typeof api.getAccountsAsync === 'function' ? api.getAccountsAsync([account]) : [],
      typeof api.getAccountsBalancesAsync === 'function' ? api.getAccountsBalancesAsync([account]) : [],
      typeof api.getAssetsAsync === 'function' ? fetchAllGolosAssets(api, 200) : []
    ]);
    const balances = {};
    const profile = accounts && accounts[0];
    if (profile && profile.balance) balances.GOLOS = String(profile.balance).split(' ')[0];
    if (profile && profile.sbd_balance) balances.GBG = String(profile.sbd_balance).split(' ')[0];
    const firstBalances = uiaBalances && uiaBalances[0] ? uiaBalances[0] : {};
    Object.entries(firstBalances).forEach(([symbol, info]) => {
      const balance = info && (info.balance || info.amount || info);
      balances[normalizeSwapTokenSymbol(symbol, 'UIA')] = String(balance).split(' ')[0];
    });
    return { balances, assets: Array.isArray(assets) ? assets : [] };
  }

  function golosSwapBuySymbolsForSell(sellSymbol, assets) {
    const sell = normalizeSwapTokenSymbol(sellSymbol || 'GOLOS', 'Токен продажи');
    const symbols = new Set();
    if (sell !== 'GOLOS') symbols.add('GOLOS');
    if (sell !== 'GBG') symbols.add('GBG');
    (assets || []).forEach((asset) => {
      const symbol = golosSymbolFromAssetField(asset && asset.max_supply);
      if (!symbol || symbol === sell) return;
      const whitelist = Array.isArray(asset.symbols_whitelist) ? asset.symbols_whitelist : [];
      if (whitelist.length === 0 || whitelist.includes(sell)) symbols.add(symbol);
    });
    const sellAsset = (assets || []).find((asset) => golosSymbolFromAssetField(asset && asset.max_supply) === sell);
    const sellWhitelist = sellAsset && Array.isArray(sellAsset.symbols_whitelist) ? sellAsset.symbols_whitelist : [];
    sellWhitelist.forEach((symbol) => {
      if (symbol && symbol !== sell) symbols.add(symbol);
    });
    return Array.from(symbols).sort();
  }

  function renderGolosSwapTokenHints(state) {
    const balances = state && state.balances ? state.balances : {};
    const assets = state && state.assets ? state.assets : [];
    const sellSymbols = Object.keys(balances).filter((symbol) => Number(balances[symbol]) > 0).sort();
    const allSymbols = new Set(['GOLOS', 'GBG']);
    assets.forEach((asset) => {
      const symbol = golosSymbolFromAssetField(asset && asset.max_supply);
      if (symbol) allSymbols.add(symbol);
    });
    const sellList = document.getElementById('golos-swap-sell-symbols');
    const buyList = document.getElementById('golos-swap-buy-symbols');
    const maxInfo = document.getElementById('golos-swap-max-amount');
    const sellInput = document.getElementById('swap-direct-sell-symbol');
    const sell = sellInput ? normalizeSwapTokenSymbol(sellInput.value || 'GOLOS', 'Токен продажи') : 'GOLOS';
    if (sellList) sellList.innerHTML = sellSymbols.map((symbol) => `<option value="${escapeHtml(symbol)}">${escapeHtml(symbol)} — максимум ${escapeHtml(balances[symbol])}</option>`).join('');
    const buySymbols = golosSwapBuySymbolsForSell(sell, assets).filter((symbol) => allSymbols.has(symbol) || symbol === 'GOLOS' || symbol === 'GBG');
    if (buyList) buyList.innerHTML = buySymbols.map((symbol) => `<option value="${escapeHtml(symbol)}"></option>`).join('');
    if (maxInfo) maxInfo.textContent = balances[sell] ? `Максимум для ${sell}: ${balances[sell]}` : `Баланс ${sell} не найден или равен 0`;
  }

  async function bindGolosSwapTokenLoader(chain) {
    if (chain.id !== 'golos') return;
    const button = document.getElementById('golos-swap-load-tokens');
    const status = document.getElementById('golos-swap-token-status');
    const sellInput = document.getElementById('swap-direct-sell-symbol');
    const state = { balances: {}, assets: [] };
    if (sellInput) sellInput.addEventListener('change', () => renderGolosSwapTokenHints(state));
    if (!button) return;
    button.addEventListener('click', async () => {
      try {
        status.textContent = 'Загружаю балансы и UIA whitelist через публичный Golos RPC...';
        Object.assign(state, await loadGolosSwapAccountAssets(chain, auth.getCurrentLogin(chain)));
        renderGolosSwapTokenHints(state);
        status.textContent = 'Токены загружены. Поля продажи/покупки можно выбрать из подсказок; максимум показан рядом.';
      } catch (error) {
        status.textContent = profiles.formatError(error);
      }
    });
  }

  async function ensureGolosDex(chain) {
    if (chain.id !== 'golos') throw new Error('Прямой DEX exchange доступен только для Golos.');
    await loadScript(chain.libraryPath);
    await loadScript(chain.dexPath);
    const client = global[chain.libraryGlobal];
    if (!client) throw new Error('Библиотека Golos недоступна.');
    if (global.GolosDexApi && (!client.libs || !client.libs.dex)) {
      new global.GolosDexApi(client, { host: 'https://api-dex.golos.app' });
    }
    const dex = client.libs && client.libs.dex;
    if (!dex || typeof dex.getExchange !== 'function' || typeof dex.makeExchangeTx !== 'function') {
      throw new Error('Golos DEX API недоступен: нужен vendored golos-dex.min.js.');
    }
    return dex;
  }

  function normalizeSwapTokenSymbol(value, label) {
    const symbol = String(value || '').trim().toUpperCase();
    if (!/^[A-Z][A-Z0-9]{1,15}$/.test(symbol)) {
      throw new Error(`${label || 'Токен'} должен быть символом A-Z/0-9 длиной 2-16.`);
    }
    return symbol;
  }

  async function getGolosTokenPrecision(chain, symbol) {
    const token = normalizeSwapTokenSymbol(symbol, 'Токен');
    if (token === chain.liquidSymbol || token === chain.debtSymbol) return 3;
    const asset = await fetchGolosAsset(chain, token);
    const precision = Number(asset && asset.precision);
    if (!Number.isInteger(precision) || precision < 0 || precision > 12) {
      throw new Error(`Не удалось определить precision для UIA ${token}.`);
    }
    return precision;
  }

  function formatFixedNoRounding(value, precision, label) {
    const text = String(value || '').trim().replace(',', '.');
    if (!/^\d+(?:\.\d+)?$/.test(text) || Number(text) <= 0) {
      throw new Error(`${label || 'Сумма'} должна быть положительным числом.`);
    }
    const [whole, rawFraction = ''] = text.split('.');
    return `${whole}.${rawFraction.slice(0, precision).padEnd(precision, '0')}`;
  }

  function bestGolosRpcNode(chain) {
    const preferred = (chain.nodes || []).find((node) => /api-full\.golos\.id/.test(node));
    if (preferred) return preferred.replace(/^http/, 'ws').replace(/\/$/, '') + '/ws';
    return 'wss://api-full.golos.id/ws';
  }

  async function buildGolosDirectExchangePrepared(chain, form) {
    const owner = auth.getCurrentLogin(chain);
    const sellSymbol = normalizeSwapTokenSymbol(form.get('sellSymbol'), 'Токен продажи');
    const buySymbol = normalizeSwapTokenSymbol(form.get('buySymbol'), 'Токен покупки');
    if (sellSymbol === buySymbol) throw new Error('Токены продажи и покупки должны отличаться.');
    const precision = await getGolosTokenPrecision(chain, sellSymbol);
    const amount = `${formatFixedNoRounding(form.get('sellAmount'), precision, 'Сумма продажи')} ${sellSymbol}`;
    const dex = await ensureGolosDex(chain);
    const quote = await dex.getExchange({
      node: bestGolosRpcNode(chain),
      amount,
      symbol: buySymbol,
      direction: 'sell'
    });
    const path = quote && (quote.direct || quote.best || quote);
    if (!path || !Array.isArray(path.steps) || !path.steps.length) {
      throw new Error(`Не удалось найти подходящие ордера для обмена ${sellSymbol} → ${buySymbol}.`);
    }
    const resultAsset = String(path.res || '');
    if (!resultAsset.endsWith(` ${buySymbol}`)) {
      throw new Error('DEX вернул некорректный результат обмена. Проверьте токены и сумму.');
    }
    const operations = await dex.makeExchangeTx(path.steps, { owner, fill_or_kill: true });
    if (!Array.isArray(operations) || !operations.length) {
      throw new Error('DEX не сформировал операции обмена.');
    }
    const bestPrice = path.best_price || path.price || '';
    return broadcast.prepare(chain, 'active', 'sendOperations', [operations], {
      title: 'Golos direct market exchange',
      amount: `${amount} → ${resultAsset}`,
      warnings: ['Операции сформированы через Golos DEX по текущему стакану с fill_or_kill=true. Перед отправкой проверьте JSON и результат обмена.'],
      quote: { input: amount, output: resultAsset, best_price: bestPrice, steps: path.steps }
    });
  }

  function renderSwap(chain) {
    if (chain.id === 'viz') {
      renderServicePlaceholder(chain, { id: 'swap', title: 'Swap', description: 'У VIZ в старом коде нет ясного DEX/swap flow.' });
      return;
    }
    const hiveSwapNotice = chain.id === 'hive' ? `<p class="notice">Legacy Hive swap менял только пару HIVE/HBD: выбиралась сумма продажи, показывался расчёт покупки по стакану, режим переключался между моментальным обменом fill_or_kill=true и произвольным ордером, открытые ордера удалялись через cancel. В v3 это сохранено как static-safe формы limit order create/cancel и read-only getOrderBook/getOpenOrders через публичную ноду, без backend/service.</p><p><a href="${escapeHtml(appHash({ chain: 'hive', app: 'history', account: auth.getCurrentLogin(chain), ops: 'limit_order_create,limit_order_cancel,fill_order' }))}">История обменов</a></p>` : '';
    const steemSwapNotice = chain.id === 'steem' ? `<p class="notice">Legacy Steem swap менял только пару STEEM/SBD: выбиралась сумма продажи, показывался расчёт покупки по стакану, режим переключался между моментальным обменом и произвольным ордером, открытые ордера удалялись через cancel. В v3 это сохранено как static-safe формы limit order create/cancel и read-only getOrderBook/getOpenOrders через публичную ноду, без backend/service.</p><p><a href="${escapeHtml(appHash({ chain: 'steem', app: 'history', account: auth.getCurrentLogin(chain), ops: 'limit_order_create,limit_order_cancel,fill_order' }))}">История обменов</a></p>` : '';
    appEl.innerHTML = `
      <section class="panel">
        <h2>${escapeHtml(chain.title)}: маркет / обмен</h2>
        <p>Создание/отмена ордеров и прямой обмен по текущему стакану с подтверждением операции.</p>
        ${hiveSwapNotice}
        ${steemSwapNotice}
        ${chain.id === 'golos' ? `<details id="swap-direct-details" class="operation-details"><summary>Прямой обмен — рассчитать и preview перед отправкой</summary><form id="swap-direct-form" class="stacked-form"><fieldset>
          <legend>Прямой обмен по рынку</legend>
          <p class="muted">Legacy flow из dpos.space/golos/swap: расчёт через Golos DEX, затем отправка цепочки limit_order_create с fill_or_kill=true.</p>
          <button type="button" id="golos-swap-load-tokens">Загрузить мои токены и доступные пары</button>
          <div id="golos-swap-token-status" class="muted" role="status" aria-live="polite"></div>
          <datalist id="golos-swap-sell-symbols"></datalist><datalist id="golos-swap-buy-symbols"></datalist>
          <div class="field"><label for="swap-direct-sell-amount">Сумма продажи <span id="golos-swap-max-amount" class="muted">максимум загрузится по кнопке</span></label><input id="swap-direct-sell-amount" name="sellAmount" type="text" required placeholder="1.000"></div>
          <div class="field"><label for="swap-direct-sell-symbol">Токен продажи</label><input id="swap-direct-sell-symbol" name="sellSymbol" type="text" list="golos-swap-sell-symbols" required value="${escapeHtml(chain.liquidSymbol)}"></div>
          <div class="field"><label for="swap-direct-buy-symbol">Токен покупки</label><input id="swap-direct-buy-symbol" name="buySymbol" type="text" list="golos-swap-buy-symbols" required value="${escapeHtml(chain.debtSymbol || chain.liquidSymbol)}"></div>
          <button type="submit" name="intent" value="preview">Рассчитать и проверить обмен</button><button type="submit" name="intent" value="send">Совершить обмен в сети</button>
          <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
        </fieldset></form></details>` : ''}
        <details id="swap-create-details" class="operation-details"><summary>Создать лимитный ордер — preview перед отправкой</summary><form id="swap-create-form" class="stacked-form"><fieldset>
          <legend>Создание лимитного ордера</legend>
          <div class="field"><label for="swap-order-id">ID ордера</label><input id="swap-order-id" name="orderId" type="number" min="0" step="1" required value="0"></div>
          <div class="field"><label for="swap-sell">Сумма продажи</label><input id="swap-sell" name="sell" type="text" required placeholder="1.000 ${escapeHtml(chain.liquidSymbol)}"></div>
          <div class="field"><label for="swap-buy">Минимум к получению</label><input id="swap-buy" name="buy" type="text" required placeholder="1.000 ${escapeHtml(chain.debtSymbol || chain.liquidSymbol)}"></div>
          <label class="inline-choice"><input name="fillOrKill" type="checkbox"> fill or kill</label>
          <div class="field"><label for="swap-expiration">Срок действия UTC</label><input id="swap-expiration" name="expiration" type="datetime-local" required></div>
          <button type="submit" name="intent" value="preview">Проверить ордер</button><button type="submit" name="intent" value="send">Создать ордер в сети</button>
          <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
        </fieldset></form></details>
        <details id="swap-cancel-details" class="operation-details"><summary>Отменить ордер — preview перед отправкой</summary><form id="swap-cancel-form" class="stacked-form"><fieldset>
          <legend>Отмена ордера</legend>
          <div class="field"><label for="swap-cancel-id">ID ордера</label><input id="swap-cancel-id" name="orderId" type="number" min="0" step="1" required></div>
          <button type="submit" name="intent" value="preview">Проверить отмену</button><button type="submit" name="intent" value="send">Отменить ордер в сети</button>
          <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
        </fieldset></form></details>
        <section class="subpanel" aria-labelledby="swap-readonly-heading">
          <h3 id="swap-readonly-heading">Стакан и мои ордера</h3>
          <p class="muted">Read-only legacy parity для market/my-orders через публичный RPC, без backend.</p>
          <div class="field"><label for="swap-orderbook-limit">Лимит строк стакана</label><input id="swap-orderbook-limit" type="number" min="1" max="100" value="20"></div>
          <button type="button" id="swap-orderbook-load">Показать стакан</button>
          <button type="button" id="swap-open-orders-load">Показать мои открытые ордера</button>
          <div id="swap-readonly-result" class="operation-result" role="status" aria-live="polite"></div>
        </section>
      </section>`;
    if (chain.id === 'golos') {
      bindGolosSwapTokenLoader(chain);
      bindOperationForm(chain, 'swap-direct-form', (form) => buildGolosDirectExchangePrepared(chain, form));
    }
    bindOperationForm(chain, 'swap-create-form', (form) => {
      const owner = auth.getCurrentLogin(chain);
      const orderId = broadcast.validateRequestId(form.get('orderId'));
      const sell = normalizeAssetInput(chain, form.get('sell'), [chain.liquidSymbol, chain.debtSymbol].filter(Boolean), 'Сумма продажи');
      const buy = normalizeAssetInput(chain, form.get('buy'), [chain.liquidSymbol, chain.debtSymbol].filter(Boolean), 'Минимум к получению');
      const expiration = `${String(form.get('expiration') || '').replace('T', ' ')}:00`;
      return broadcast.prepare(chain, 'active', 'createLimitOrder', [owner, orderId, sell, buy, form.get('fillOrKill') === 'on', expiration], { title: 'Создание лимитного ордера', amount: `${sell} → ${buy}`, requestId: orderId });
    });
    bindOperationForm(chain, 'swap-cancel-form', (form) => {
      const orderId = broadcast.validateRequestId(form.get('orderId'));
      return broadcast.prepare(chain, 'active', 'cancelOrder', [auth.getCurrentLogin(chain), orderId], { title: 'Cancel limit order', requestId: orderId });
    });
    const readonlyResult = document.getElementById('swap-readonly-result');
    if (readonlyResult) readonlyResult.addEventListener('click', (event) => {
      const button = event.target && event.target.closest ? event.target.closest('[data-swap-cancel-prefill]') : null;
      if (!button) return;
      openSwapCancelDetails(button.dataset.swapCancelPrefill);
      setStatus('ID ордера перенесён в форму отмены. Проверьте preview перед отправкой.', 'ok');
    });
    const orderbookBtn = document.getElementById('swap-orderbook-load');
    if (orderbookBtn) orderbookBtn.addEventListener('click', async () => {
      try {
        readonlyResult.textContent = 'Загружаю стакан через getOrderBook...';
        const data = await loadGrapheneOrderBook(chain, document.getElementById('swap-orderbook-limit').value);
        readonlyResult.innerHTML = renderOrderRows((data && (data.bids || data.asks)) ? [].concat(data.bids || [], data.asks || []) : data, 'Стакан пуст или API вернул пустой ответ.') + rawJsonDetails('Raw order book', data);
      } catch (error) {
        readonlyResult.textContent = profiles.formatError(error);
      }
    });
    const openOrdersBtn = document.getElementById('swap-open-orders-load');
    if (openOrdersBtn) openOrdersBtn.addEventListener('click', async () => {
      try {
        readonlyResult.textContent = 'Загружаю открытые ордера через getOpenOrders...';
        const data = await loadGrapheneOpenOrders(chain, auth.getCurrentLogin(chain));
        readonlyResult.innerHTML = renderOrderRows(data, 'Открытых ордеров нет.') + rawJsonDetails('Raw open orders', data);
      } catch (error) {
        readonlyResult.textContent = profiles.formatError(error);
      }
    });
    setStatus(`${chain.title} swap/market готов: прямой обмен, создание/отмена ордера и read-only стакан/ордера.`, 'ok');
  }

  function renderRegister(chain) {
    const isGolos = chain.id === 'golos';
    const isViz = chain.id === 'viz';
    appEl.innerHTML = `
      <section class="panel">
        <h2>${escapeHtml(chain.title)}: регистрация</h2>
        ${isGolos || isViz ? `<p>Регистрация по invite: WIF подписанта используется только в памяти для отправки и не сохраняется. Для ${escapeHtml(chain.title)} нужен приватный WIF service/invite аккаунта с правом регистрации.</p>` : '<p>Для Hive/Steem укажите fee/delegation и публичные ключи нового аккаунта. Операция отправляется только после подтверждения текущим active key.</p>'}
        ${isGolos ? '<p class="notice">Для Golos также доступно создание аккаунта с делегированием. Вводится только публичный ключ нового аккаунта; приватные ключи не генерируются и не показываются.</p>' : ''}
        ${isViz ? '<p class="notice">Legacy VIZ registration восстановлен безопаснее: приватный WIF нового аккаунта генерируется локально, хранится только в памяти страницы, показывается для копии/backup и не попадает в preview JSON.</p>' : ''}
        <details id="register-form-details" class="operation-details"><summary>Создание аккаунта — проверить перед отправкой</summary><form id="register-form" class="stacked-form"><fieldset>
          <legend>Создание аккаунта</legend>
          <div class="field"><label for="register-name">Новый аккаунт</label><input id="register-name" name="name" type="text" required></div>
          ${isViz ? '<button type="button" id="viz-register-check-name">Проверить доступность имени</button><div id="viz-register-name-status" class="muted" role="status" aria-live="polite"></div>' : ''}
          ${isGolos || isViz ? '<div class="field"><label for="register-invite">Секрет/код invite</label><input id="register-invite" name="invite" type="text" required></div>' : `<div class="field"><label for="register-fee">Комиссия</label><input id="register-fee" name="fee" type="text" required placeholder="3.000 ${escapeHtml(chain.liquidSymbol)}"></div>`}
          ${isGolos ? '<div class="field"><label for="register-signer">Аккаунт service-подписанта</label><input id="register-signer" name="signer" type="text" required value="dpos.space-reg"></div>' : ''}
          ${isViz ? '<div class="field"><label for="register-signer">Аккаунт invite-подписанта</label><input id="register-signer" name="signer" type="text" required value="invite"></div>' : ''}
          ${isGolos || isViz ? '<div class="field"><label for="register-signer-wif">Приватный WIF service/invite подписанта</label><input id="register-signer-wif" name="signerWif" type="password" autocomplete="off" required><small>Используется только в памяти для подписи. Не вставляйте сюда ключ нового аккаунта.</small></div>' : ''}
          ${isViz ? `<fieldset class="subtle-panel">
            <legend>Ключ нового VIZ-аккаунта</legend>
            <p>Можно оставить ручной путь и вставить public key ниже. Для legacy UX нажмите генерацию: private WIF появится только здесь, public key заполнится автоматически.</p>
            <button type="button" id="viz-register-generate-private-key">Генерировать private WIF нового аккаунта</button>
            <div class="field"><label for="viz-register-generated-private-key">Private WIF нового аккаунта — сохраните до отправки</label><textarea id="viz-register-generated-private-key" rows="3" readonly aria-describedby="viz-register-backup-warning"></textarea><small id="viz-register-backup-warning">Этот ключ нельзя восстановить после потери. Он не сохраняется в localStorage/sessionStorage и не включается в preview операции.</small></div>
            <button type="button" id="viz-register-copy-private-key" data-copy-value="">Скопировать</button>
            <button type="button" id="viz-register-download-backup">Скачать backup</button>
            <label class="inline-choice"><input type="checkbox" id="viz-register-private-key-saved" name="privateKeySaved" value="yes"> Я сохранил private key нового аккаунта в надёжном месте</label>
            <div id="viz-register-key-status" class="muted" role="status" aria-live="polite"></div>
          </fieldset>` : ''}
          <div class="field"><label for="register-public-key">Публичный ключ для authority нового аккаунта</label><input id="register-public-key" name="publicKey" type="text" required></div>
          <button type="submit" name="intent" value="preview">Проверить регистрацию</button>
          <button type="submit" name="intent" value="send">Создать аккаунт в сети</button>
          <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
        </fieldset></form></details>
        ${isGolos ? `<details id="golos-register-delegation-details" class="operation-details"><summary>Golos: создание с делегированием — preview перед отправкой</summary><form id="golos-register-delegation-form" class="stacked-form"><fieldset>
          <legend>Golos: создание аккаунта с делегированием</legend>
          <div class="field"><label for="golos-register-delegation-name">Новый аккаунт</label><input id="golos-register-delegation-name" name="name" type="text" required></div>
          <div class="field"><label for="golos-register-delegation-fee">Комиссия</label><input id="golos-register-delegation-fee" name="fee" type="text" required value="1.000 GOLOS"></div>
          <div class="field"><label for="golos-register-delegation-vesting">Делегирование</label><input id="golos-register-delegation-vesting" name="delegation" type="text" required placeholder="0.000000 GESTS"></div>
          <div class="field"><label for="golos-register-delegation-public-key">Публичный ключ для authority нового аккаунта</label><input id="golos-register-delegation-public-key" name="publicKey" type="text" required></div>
          <button type="submit" name="intent" value="preview">Проверить создание с делегированием</button>
          <button type="submit" name="intent" value="send">Создать с делегированием в сети</button>
          <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
        </fieldset></form></details>` : ''}
      </section>`;

    let vizRegistrationKey = null;
    if (isViz) {
      const generateButton = document.getElementById('viz-register-generate-private-key');
      const checkNameButton = document.getElementById('viz-register-check-name');
      const nameStatus = document.getElementById('viz-register-name-status');
      const privateKeyField = document.getElementById('viz-register-generated-private-key');
      const publicKeyField = document.getElementById('register-public-key');
      const copyButton = document.getElementById('viz-register-copy-private-key');
      const downloadButton = document.getElementById('viz-register-download-backup');
      const savedCheckbox = document.getElementById('viz-register-private-key-saved');
      const keyStatus = document.getElementById('viz-register-key-status');

      if (checkNameButton) {
        checkNameButton.addEventListener('click', async () => {
          try {
            const name = normalizeAccountInput(chain, document.getElementById('register-name').value, 'Новый аккаунт');
            if (nameStatus) nameStatus.textContent = 'Проверяю аккаунт через публичную VIZ-ноду...';
            const connection = await getConnection(chain);
            const accounts = await profiles.apiCall(connection, 'getAccounts', [[name]]);
            const exists = Array.isArray(accounts) && accounts.length > 0;
            if (nameStatus) nameStatus.textContent = exists ? 'Аккаунт уже существует. Введите другой логин.' : 'Аккаунт свободен.';
            setStatus(exists ? 'VIZ registration: аккаунт уже существует.' : 'VIZ registration: аккаунт свободен.', exists ? 'error' : 'ok');
          } catch (error) {
            if (nameStatus) nameStatus.textContent = profiles.formatError(error);
            setStatus(profiles.formatError(error), 'error');
          }
        });
      }

      if (generateButton) {
        generateButton.addEventListener('click', async () => {
          try {
            await loadScript(chain.cryptoPath);
            await loadScript(chain.walletPath);
            await loadScript(chain.libraryPath);
            vizRegistrationKey = generateVizRegistrationKey();
            if (privateKeyField) privateKeyField.value = vizRegistrationKey.privateKey;
            if (publicKeyField) publicKeyField.value = vizRegistrationKey.publicKey;
            if (copyButton) copyButton.dataset.copyValue = vizRegistrationKey.privateKey;
            if (savedCheckbox) savedCheckbox.checked = false;
            if (keyStatus) keyStatus.textContent = `Сгенерирован private WIF и public key ${vizRegistrationKey.publicKey}. Сохраните private WIF перед отправкой.`;
            setStatus('VIZ private WIF нового аккаунта сгенерирован локально. Сохраните backup перед отправкой.', 'ok');
          } catch (error) {
            vizRegistrationKey = null;
            if (keyStatus) keyStatus.textContent = profiles.formatError(error);
            setStatus(profiles.formatError(error), 'error');
          }
        });
      }

      if (copyButton) bindCopyButtons(document.getElementById('register-form'));
      if (downloadButton) {
        downloadButton.addEventListener('click', () => {
          if (!vizRegistrationKey || !vizRegistrationKey.privateKey) {
            setStatus('Сначала сгенерируйте private WIF нового VIZ-аккаунта.', 'error');
            return;
          }
          const name = String(document.getElementById('register-name').value || '').trim() || 'new-viz-account';
          downloadTextFile(`viz-account-${name}.txt`, `dpos.space VIZ registration backup\r\n\r\nAccount login: ${name}\r\nPublic key: ${vizRegistrationKey.publicKey}\r\nPrivate WIF: ${vizRegistrationKey.privateKey}\r\n\r\nСохраните private WIF: он не хранится в dpos.space v3 и не может быть восстановлен.`);
          if (savedCheckbox) savedCheckbox.checked = true;
          if (keyStatus) keyStatus.textContent = 'Backup скачан. Проверьте файл и оставьте подтверждение перед отправкой.';
        });
      }
    }

    bindOperationForm(chain, 'register-form', (form, context) => {
      const name = normalizeAccountInput(chain, form.get('name'), 'Новый аккаунт');
      const key = String(form.get('publicKey') || '').trim();
      const publicKeyWarning = 'Use a public key for the new account only; never paste the new account private WIF into public-key fields.';

      if (isGolos || isViz) {
        const signer = String(form.get('signer') || '').trim();
        const signerWif = String(form.get('signerWif') || '').trim();
        const inviteSecret = String(form.get('invite') || '').trim();
        if (!inviteSecret) throw new Error('Нужен секрет/код invite.');
        if (broadcast.isLikelyWif(key)) throw new Error('Поле публичного ключа содержит приватный ключ, похожий на WIF. Вставьте публичный ключ.');

        if (isViz) {
          const usingGeneratedKey = Boolean(vizRegistrationKey && vizRegistrationKey.publicKey === key);
          if (context && context.intent === 'send' && usingGeneratedKey && form.get('privateKeySaved') !== 'yes') {
            throw new Error('Перед отправкой подтвердите, что private key нового VIZ-аккаунта сохранён. Он не хранится в dpos.space v3 и не попадёт в preview JSON.');
          }
          return broadcast.prepareWithPrivateKey(chain, signer, 'active', signerWif, 'inviteRegistration', [signer, name, inviteSecret, key], {
            title: 'VIZ invite registration',
            to: name,
            keySource: 'explicit service/invite signer WIF input, used only in memory',
            warnings: [publicKeyWarning, 'Private signer WIF не показывается в проверке/ответе и не сохраняется.']
          });
        }

        const authObject = { weight_threshold: 1, account_auths: [], key_auths: [[key, 1]] };
        return broadcast.prepareWithPrivateKey(chain, signer, 'active', signerWif, 'accountCreateWithInvite', [inviteSecret, signer, name, authObject, authObject, authObject, key, '', []], {
          title: 'Golos account_create_with_invite',
          to: name,
          keySource: 'explicit service signer WIF input, used only in memory',
          warnings: [publicKeyWarning, 'Private signer WIF не показывается в проверке/ответе и не сохраняется.']
        });
      }

      const creator = auth.getCurrentLogin(chain);
      const authObject = { weight_threshold: 1, account_auths: [], key_auths: [[key, 1]] };
      const fee = normalizeAssetInput(chain, form.get('fee'), chain.liquidSymbol, 'Account creation fee');
      return broadcast.prepare(chain, 'active', 'createAccount', [fee, creator, name, authObject, authObject, authObject, key, ''], { title: 'Создание аккаунта', to: name, amount: fee, warnings: [publicKeyWarning] });
    });

    bindOperationForm(chain, 'golos-register-delegation-form', (form) => {
      const name = normalizeAccountInput(chain, form.get('name'), 'Новый аккаунт');
      const key = String(form.get('publicKey') || '').trim();
      if (broadcast.isLikelyWif(key)) throw new Error('Поле публичного ключа содержит приватный ключ, похожий на WIF. Вставьте публичный ключ.');
      const authObject = { weight_threshold: 1, account_auths: [], key_auths: [[key, 1]] };
      const fee = normalizeAssetInput(chain, form.get('fee'), chain.liquidSymbol, 'Account creation fee');
      const delegation = normalizeAssetInput(chain, form.get('delegation'), chain.vestingSymbol, 'Account delegation');
      return broadcast.prepare(chain, 'active', 'accountCreateWithDelegation', [fee, delegation, auth.getCurrentLogin(chain), name, authObject, authObject, authObject, key, '', []], { title: 'Golos: создание аккаунта с делегированием', to: name, amount: `${fee}; ${delegation}`, warnings: ['Для нового аккаунта вводится только публичный ключ; приватные ключи не генерируются и не показываются.'] });
    });

    setStatus(`${chain.title}: регистрация готова. Доступны проверка и отправка по подтверждению.`, 'ok');
  }

  async function hashRandomBlockchainSeeds(chain, firstSeed, secondSeed, modulo) {
    if (chain.id === 'minter' || chain.id === 'decimal') {
      const hex = `${firstSeed.seed}${secondSeed.seed}`.replace(/^0x/i, '').replace(/[^0-9a-f]/gi, '');
      if (!hex) throw new Error(`${chain.title} block hashes are empty; cannot calculate lucky number.`);
      const value = Number(BigInt(`0x${hex}`) % BigInt(modulo));
      return { algorithm: 'Minter/Decimal block_hash_1 + block_hash_2', hash: hex, value, luckyNumber: value + 1 };
    }
    if (chain.id === 'viz' || chain.id === 'steem' || chain.id === 'hive') {
      await loadScript(chain.randomHashPath || 'v3/vendor/viz/sha3.min.js');
      if (typeof global.keccak_256 !== 'function') throw new Error('keccak_256 недоступен: не загружен legacy sha3.min.js.');
      const hex = global.keccak_256.update(`${firstSeed.seed}${secondSeed.seed}`).toString();
      const value = Number(BigInt(`0x${hex}`) % BigInt(modulo));
      return { algorithm: 'keccak_256(witness_signature_1 + witness_signature_2)', hash: hex, value, luckyNumber: value + 1 };
    }
    const bytes = new TextEncoder().encode(`${chain.id}:${firstSeed.seed}:${secondSeed.seed}:${modulo}`);
    const digest = await global.crypto.subtle.digest('SHA-256', bytes);
    const hex = Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
    const value = Number(BigInt(`0x${hex}`) % BigInt(modulo));
    return { algorithm: 'SHA-256(chain:first:second:participants)', hash: hex, value, luckyNumber: value + 1 };
  }

  function renderRandomBlockchain(chain) {
    appEl.innerHTML = `
      <section class="panel">
        <h2>${escapeHtml(chain.title)}: случайный блокчейн</h2>
        <p>Статический перенос legacy randomblockchain: если введены номера блоков, v3 получает их через публичную ноду/API. Для Minter и Decimal сохранён legacy-алгоритм: hash двух блоков → hex modulo → номер участника 1..N. Для VIZ/Steem/Hive сохранён legacy-алгоритм: witness_signature двух блоков → keccak_256 → номер участника 1..N.</p>
        ${chain.id === 'minter' || chain.id === 'decimal' ? `<p><a href="https://mcorp.space/post/65" target="_blank" rel="noopener">Принцип генерации случайных чисел в этом посте</a>. Репозиторий: <a href="${chain.id === 'decimal' ? 'https://github.com/denis-skripnik/decimal_random' : 'https://github.com/denis-skripnik/minter_random'}" target="_blank" rel="noopener">${chain.id === 'decimal' ? 'https://github.com/denis-skripnik/decimal_random' : 'https://github.com/denis-skripnik/minter_random'}</a></p>` : '<p><a href="https://golos.id/ru/@denis-skripnik/ru-generator-sluchaijnykh-chisel-na-baze-dannykh-iz-bch" target="_blank" rel="noopener">Принцип генерации случайных чисел</a>. Репозиторий: <a href="https://github.com/gropox/randomblockchain" target="_blank" rel="noopener">https://github.com/gropox/randomblockchain</a></p>'}
        <form id="randomblockchain-form" class="stacked-form">
          <fieldset>
            <legend>Генератор случайного числа</legend>
            <div class="field"><label for="randomblockchain-first">Первый блок (начальный) / Сигнатура первого указанного блока</label><input id="randomblockchain-first" name="first" type="text" required inputmode="numeric" placeholder="Введите стартовый блок"></div>
            <div class="field"><label for="randomblockchain-second">Второй блок, на основе которого будет производиться генерация / Сигнатура второго указанного блока</label><input id="randomblockchain-second" name="second" type="text" required inputmode="numeric" placeholder="Введите второй блок"></div>
            <div class="field"><label for="randomblockchain-participants">Количество участников (максимальное число)</label><input id="randomblockchain-participants" name="participants" type="number" min="2" value="100" placeholder="Введите число участников"></div>
            <div class="field"><label for="randomblockchain-list">Список данных, указывайте каждый элемент с новой строки</label><textarea id="randomblockchain-list" name="data_list" rows="6" placeholder="Если заполнено, N берётся из количества строк, а победитель будет показан текстом."></textarea></div>
            <button type="submit">Вычислить счастливое число</button>
            <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
          </fieldset>
        </form>
      </section>`;
    const form = document.getElementById('randomblockchain-form');
    const resultEl = form.querySelector('[data-operation-result]');
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const first = String(data.get('first') || '').trim();
      const second = String(data.get('second') || '').trim();
      const list = String(data.get('data_list') || '').split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
      const participants = list.length || (Number.parseInt(String(data.get('participants') || '100'), 10) || 100);
      const modulo = Math.max(2, participants);
      try {
        resultEl.textContent = 'Получаю блоки и считаю random локально...';
        const connection = await getConnection(chain);
        const [firstSeed, secondSeed] = await Promise.all([
          resolveRandomBlockchainSeed(chain, connection, first),
          resolveRandomBlockchainSeed(chain, connection, second)
        ]);
        const random = await hashRandomBlockchainSeeds(chain, firstSeed, secondSeed, modulo);
        const winner = list.length ? list[random.value] : '';
        resultEl.innerHTML = `<p><strong>Счастливое число:</strong> ${escapeHtml(random.luckyNumber)}</p>${winner ? `<p><strong>Победитель:</strong> ${escapeHtml(winner)}</p>` : ''}<p class="muted">Алгоритм: ${escapeHtml(random.algorithm)}. Legacy VIZ возвращает остаток + 1, поэтому диапазон результата — 1..N.</p>${rawJsonDetails('Данные расчёта', { chain: chain.id, participants: modulo, hash: random.hash, resultIndexZeroBased: random.value, luckyNumber: random.luckyNumber, winner, first: firstSeed, second: secondSeed })}`;
        setStatus(`${chain.title}: randomblockchain посчитан по публичным данным.`, 'ok');
      } catch (error) {
        resultEl.textContent = profiles.formatError(error);
        setStatus(profiles.formatError(error), 'error');
      }
    });
    setStatus(`${chain.title}: randomblockchain готов.`, 'ok');
  }

  function buildVizSearchMemo(keyword, link, inlink) {
    return `${keyword}~${link}~${inlink}`;
  }

  function normalizeVizLinkValue(value) {
    const text = String(value || '').trim();
    if (!text) throw new Error('Ссылка обязательна.');
    if (/^viz:\/\//i.test(text)) return `https://hackathon-on-internet-freedom.github.io/Free-Speech-Project/dapp.html#${text}`;
    if (/^ipfs:\/\//i.test(text)) return `https://ipfs.io/ipfs/${text.slice(7)}`;
    return text;
  }

  function renderVizSearch(chain, state) {
    const page = String((state && state.searchPage) || 'find');
    const type = String((state && state.searchType) || 'full_search');
    const query = String((state && state.query) || '');
    const addLinkUrl = appHash({ chain: chain.id, app: 'search', searchPage: 'add-link' });
    const findUrl = appHash({ chain: chain.id, app: 'search' });
    const searchAction = appHash({ chain: chain.id, app: 'search', searchType: type, query });
    const searchPanel = `
      <section class="subpanel" aria-labelledby="viz-search-find-heading">
        <h3 id="viz-search-find-heading">Найти viz-links</h3>
        <p>Legacy поиск вызывал <code>viz-api?service=links</code> с типами <code>full_search</code> и <code>unfull_search</code>. Static v3 не восстанавливает backend index; search results остаются backend-only non-goal.</p>
        <form id="viz-search-form" class="stacked-form" action="${escapeHtml(searchAction)}">
          <fieldset><legend>Тип поиска</legend>
            <label class="inline-choice"><input type="radio" name="searchType" value="full_search" ${type === 'full_search' ? 'checked' : ''}> С точным совпадением</label>
            <label class="inline-choice"><input type="radio" name="searchType" value="unfull_search" ${type === 'unfull_search' ? 'checked' : ''}> С поиском запроса в анкорах ссылок</label>
          </fieldset>
          <div class="field"><label for="viz-search-query">Поисковый запрос</label><input id="viz-search-query" name="query" type="search" value="${escapeHtml(query)}" placeholder="Введите поисковый запрос"></div>
          <button type="submit">Найти</button>
        </form>
        ${query ? `<p class="notice">Запрос <strong>${escapeHtml(query)}</strong> (${escapeHtml(type)}): live список результатов, inlinks и пагинация «Предыдущая/Следующая» требовали удалённый backend. Для ручной проверки ссылок v3 сохраняет правила преобразования <code>viz://</code> и <code>ipfs://</code>: ${escapeHtml(normalizeVizLinkValue(query))}</p>` : '<p class="muted">Введите запрос или откройте форму добавления ссылки.</p>'}
      </section>`;
    const addPanel = `
      <section class="subpanel" aria-labelledby="viz-search-add-heading">
        <h3 id="viz-search-add-heading">Добавить ссылку</h3>
        <p>Legacy add-link отправлял VIZ award на <code>committee</code> с memo <code>keyword~link~inlink</code>, где custom_sequence задавал протокол: <code>viz://</code>, <code>https://</code>, <code>ipfs://</code>, <code>magnet</code>.</p>
        <form id="viz-search-add-link-form" class="stacked-form">
          <input type="hidden" name="target" value="committee">
          <div class="field"><label for="viz-search-energy">Процент энергии</label><input id="viz-search-energy" name="energy" type="number" min="0.01" max="100" step="0.01" value="1" required></div>
          <div class="field"><label for="viz-search-custom-sequence">Протокол</label><select id="viz-search-custom-sequence" name="custom_sequence"><option value="0">viz://</option><option value="1">https://</option><option value="2">ipfs://</option><option value="3">magnet</option></select></div>
          <div class="field"><label for="viz-search-keyword">Анкор ссылки</label><input id="viz-search-keyword" name="keyword" type="text" required></div>
          <div class="field"><label for="viz-search-link">Адрес ссылки без протокола</label><input id="viz-search-link" name="link" type="text" required></div>
          <div class="field"><label for="viz-search-inlink">Адрес родительской ссылки без протокола</label><input id="viz-search-inlink" name="inlink" type="text"></div>
          <button type="submit">Проверить award для viz-links</button>
          <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
        </form>
      </section>`;
    appEl.innerHTML = `<section class="panel viz-search"><h2>Viz-links</h2><p><a href="${escapeHtml(findUrl)}">Найти</a> · <a href="${escapeHtml(addLinkUrl)}">добавить ссылку</a></p>${page === 'add-link' ? addPanel + searchPanel : searchPanel + addPanel}</section>`;
    const form = document.getElementById('viz-search-form');
    if (form) form.addEventListener('submit', (event) => {
      event.preventDefault();
      const data = new FormData(form);
      navigate({ chain: chain.id, app: 'search', searchType: data.get('searchType') || 'full_search', query: data.get('query') || '' });
    });
    bindOperationForm(chain, 'viz-search-add-link-form', (formData) => {
      const from = auth.getCurrentLogin(chain);
      const targetAccount = 'committee';
      const keyword = String(formData.get('keyword') || '').trim();
      const link = String(formData.get('link') || '').replace(/^https?:\/\//i, '').trim();
      const inlink = String(formData.get('inlink') || '').replace(/^https?:\/\//i, '').trim();
      const memo = buildVizSearchMemo(keyword, link, inlink);
      if (broadcast.isLikelyWif(memo)) throw new Error('Memo похоже на приватный WIF. Отправка остановлена.');
      return broadcast.prepare(chain, 'regular', 'award', [from, targetAccount, normalizeVizEnergy(formData.get('energy')), normalizeVizCustomSequence(formData.get('custom_sequence')), memo, []], { title: 'VIZ viz-links award', to: targetAccount, customSequence: normalizeVizCustomSequence(formData.get('custom_sequence')), warnings: ['Операция отправит award на committee для добавления ссылки в viz-links.'] });
    });
    setStatus(`${chain.title}: Viz-links открыт в static-only режиме.`, 'info');
  }

  function normalizeGolosWitnessRows(result) {
    const rows = Array.isArray(result) ? result : [];
    return rows.map((item) => {
      const owner = item && (item.owner || item.account || item.name || item.witness || item.id || item[0]);
      if (!owner) return null;
      return {
        owner: String(owner),
        url: item.url || item.signing_key || '',
        votes: item.votes || item.virtual_scheduled_time || item.total_missed || '',
        produced: item.produced || item.signing_key || '',
        raw: item
      };
    }).filter(Boolean);
  }

  async function loadGolosWitnessesByVote(chain) {
    const status = document.getElementById('golos-witnesses-rewards-status');
    const target = document.getElementById('golos-witnesses-rewards-list');
    if (!status || !target) return;
    status.textContent = 'Загружаю список делегатов Golos через публичный RPC...';
    try {
      await loadScript(chain.libraryPath);
      const connection = await profiles.connect(chain);
      let witnesses = normalizeGolosWitnessRows(await profiles.apiCall(connection, 'getWitnessesByVote', ['', 50]));
      if (!witnesses.length) {
        const names = await profiles.apiCall(connection, 'lookupWitnessAccounts', ['', 50]);
        const witnessResults = await Promise.all((Array.isArray(names) ? names : []).slice(0, 50).map((name) => profiles.apiCall(connection, 'getWitnessByAccount', [name]).catch(() => null)));
        witnesses = normalizeGolosWitnessRows(witnessResults.filter(Boolean));
      }
      if (!witnesses.length) {
        target.innerHTML = '<p class="muted">Публичная нода не вернула witness-список.</p>';
        status.textContent = 'Witness-список не найден в ответе публичной ноды.';
        return;
      }
      const rows = witnesses.map((witness) => `<tr><td><a href="${escapeHtml(appHash({ chain: chain.id, app: 'profiles', account: witness.owner }))}">${escapeHtml(witness.owner)}</a> <span class="muted">профиль witness</span></td><td><code>${escapeHtml(String(witness.url || ''))}</code></td><td>${escapeHtml(String(witness.votes || ''))}</td><td>${escapeHtml(String(witness.produced || ''))}</td></tr>`).join('');
      target.innerHTML = `<div class="table-wrap"><table aria-label="Публичный список делегатов Golos"><caption>Публичный список делегатов Golos из witness_api</caption><thead><tr><th scope="col">Делегат</th><th scope="col">URL/signing key</th><th scope="col">Votes / service field</th><th scope="col">Produced/signing data</th></tr></thead><tbody>${rows}</tbody></table></div>`;
      status.textContent = `Загружено делегатов Golos через public RPC: ${witnesses.length}. Reward-агрегаты ниже не вычисляются.`;
      setStatus(`Golos witnesses-rewards: загружено witness records: ${witnesses.length}.`, 'ok');
    } catch (error) {
      target.innerHTML = `<p class="muted">Не удалось загрузить публичный witness-список: ${escapeHtml(profiles.formatError(error))}</p>`;
      status.textContent = `Ошибка загрузки witness-списка: ${profiles.formatError(error)}`;
      setStatus(`Golos witnesses-rewards: ${profiles.formatError(error)}`, 'error');
    }
  }


  const vizTopState = {
    loading: false,
    loadedAt: null,
    rows: [],
    error: ''
  };

  const vizTopRankingOptions = [
    { type: 'shares', aliases: ['SHARES', 'social_capital'], label: 'Соц. капитал (SHARES)', description: 'Собственный социальный капитал аккаунта.' },
    { type: 'VIZ', aliases: ['viz'], label: 'VIZ', description: 'Ликвидный баланс VIZ.' },
    { type: 'effective_shares', aliases: ['EFFECTIVE_SHARES', 'effective'], label: 'Эффективный соц. капитал', description: 'SHARES с учётом полученных и отданных делегаций.' },
    { type: 'received_shares', aliases: ['RECEIVED_SHARES'], label: 'Получено делегированием', description: 'SHARES, полученные от других аккаунтов.' },
    { type: 'delegated_shares', aliases: ['DELEGATED_SHARES'], label: 'Делегировано', description: 'SHARES, делегированные другим аккаунтам.' },
    { type: 'vesting_withdraw_rate', aliases: ['WITHDRAW', 'withdraw'], label: 'Выводится SHARES', description: 'Текущая скорость вывода соц. капитала.' }
  ];

  function normalizeVizTopType(value) {
    const raw = String(value || 'shares').trim();
    if (!raw) return 'shares';
    const lower = raw.toLowerCase();
    const upper = raw.toUpperCase();
    const option = vizTopRankingOptions.find((item) => item.type === raw || item.type.toLowerCase() === lower || (item.aliases || []).some((alias) => String(alias).toUpperCase() === upper));
    return option ? option.type : 'shares';
  }

  function vizTopOptionLabel(type) {
    const normalized = normalizeVizTopType(type);
    const option = vizTopRankingOptions.find((item) => item.type === normalized);
    return option ? option.label : 'Соц. капитал (SHARES)';
  }

  function vizTopTypeOptions(selectedType) {
    const normalized = normalizeVizTopType(selectedType);
    return vizTopRankingOptions.map((option) => `<option value="${escapeHtml(option.type)}"${normalized === option.type ? ' selected' : ''}>${escapeHtml(option.label)}</option>`).join('');
  }

  function vizTopMetric(row, type) {
    if (!row) return 0;
    const normalized = normalizeVizTopType(type);
    if (normalized === 'VIZ') return row.viz || 0;
    if (normalized === 'effective_shares') return row.effectiveShares || 0;
    if (normalized === 'received_shares') return row.receivedShares || 0;
    if (normalized === 'delegated_shares') return row.delegatedShares || 0;
    if (normalized === 'vesting_withdraw_rate') return row.vestingWithdrawRate || 0;
    return row.shares || 0;
  }

  function formatVizTopNumber(value, digits = 3) {
    const number = Number(value || 0);
    if (!Number.isFinite(number)) return '0';
    return number.toLocaleString('ru-RU', { maximumFractionDigits: digits, minimumFractionDigits: Math.min(digits, 3) });
  }

  function renderVizTopResults(kind) {
    if (!vizTopState.rows.length) {
      return '<p class="muted">Топ ещё не загружен. Нажмите кнопку загрузки — при входе на страницу запросы к ноде не запускаются.</p>';
    }
    const sorted = vizTopState.rows
      .filter((row) => vizTopMetric(row, kind) > 0)
      .sort((a, b) => vizTopMetric(b, kind) - vizTopMetric(a, kind))
      .slice(0, 100);
    if (!sorted.length) return `<p class="muted">Для ${escapeHtml(vizTopOptionLabel(kind))} ненулевые значения не найдены.</p>`;
    const rows = sorted.map((row, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${renderAccountCell(chains.viz, row.name)}</td>
        <td>${escapeHtml(formatVizTopNumber(vizTopMetric(row, kind), 6))}</td>
        <td>${escapeHtml(formatVizTopNumber(row.shares, 6))}</td>
        <td>${escapeHtml(formatVizTopNumber(row.effectiveShares, 6))}</td>
        <td>${escapeHtml(formatVizTopNumber(row.viz, 3))}</td>
        <td>${escapeHtml(formatVizTopNumber(row.sharesPercent, 6))}%</td>
        <td>${escapeHtml(formatVizTopNumber(row.vizPercent, 6))}%</td>
      </tr>`).join('');
    return `<div class="table-wrap"><table><caption>Топ-100 VIZ: ${escapeHtml(vizTopOptionLabel(kind))}</caption><thead><tr><th scope="col">#</th><th scope="col">Аккаунт</th><th scope="col">Значение</th><th scope="col">SHARES</th><th scope="col">Эффективные SHARES</th><th scope="col">VIZ</th><th scope="col">% SHARES</th><th scope="col">% VIZ</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  function setVizTopProgress(message, percent) {
    const progress = document.querySelector('[data-viz-top-progress]');
    if (progress) {
      progress.textContent = message;
      progress.dataset.state = vizTopState.loading ? 'loading' : 'info';
    }
    const bar = document.querySelector('[data-viz-top-progress-bar]');
    if (bar && Number.isFinite(percent)) {
      bar.max = 100;
      bar.value = Math.max(0, Math.min(100, percent));
    }
    setStatus(message, vizTopState.loading ? 'loading' : 'info');
  }

  async function fetchVizTopAccountNames(connection, onProgress) {
    const names = [];
    let from = '';
    const limit = 1000;
    const seen = new Set();
    while (true) {
      const chunk = await profiles.apiCall(connection, 'lookupAccounts', [from, limit]);
      const fresh = (Array.isArray(chunk) ? chunk : []).filter((name) => name && !seen.has(name));
      fresh.forEach((name) => { seen.add(name); names.push(name); });
      if (onProgress) onProgress(`Найдено аккаунтов VIZ: ${names.length}`, Math.min(35, names.length ? 10 + names.length / 300 : 5));
      if (!Array.isArray(chunk) || chunk.length < limit || !fresh.length) break;
      from = chunk[chunk.length - 1];
    }
    return names;
  }

  function normalizeVizTopAccount(account, totals) {
    const shares = numericAssetValue(account && account.vesting_shares);
    const delegatedShares = numericAssetValue(account && account.delegated_vesting_shares);
    const receivedShares = numericAssetValue(account && account.received_vesting_shares);
    const viz = numericAssetValue(account && account.balance);
    return {
      name: account.name,
      shares,
      effectiveShares: shares - delegatedShares + receivedShares,
      receivedShares,
      delegatedShares,
      vestingWithdrawRate: numericAssetValue(account && account.vesting_withdraw_rate),
      viz,
      sharesPercent: totals.totalShares ? shares / totals.totalShares * 100 : 0,
      vizPercent: totals.totalViz ? viz / totals.totalViz * 100 : 0
    };
  }

  function vizTopTotals(props) {
    return {
      totalShares: numericAssetValue(props && props.total_vesting_shares),
      totalViz: numericAssetValue(props && props.current_supply)
    };
  }

  async function loadVizTopRows(connection, onProgress) {
    const names = await fetchVizTopAccountNames(connection, onProgress);
    const props = await profiles.apiCall(connection, 'getDynamicGlobalProperties', []).catch(() => ({}));
    const totals = vizTopTotals(props);
    const accounts = await mapGolosTopChunks(names, 1000, 2, (chunk) => profiles.apiCall(connection, 'getAccounts', [chunk]), (done, total) => {
      if (onProgress) onProgress(`Загрузка аккаунтов VIZ: ${done}/${total}`, 35 + Math.round((done / Math.max(total, 1)) * 60));
    });
    return accounts.filter((account) => account && account.name).map((account) => normalizeVizTopAccount(account, totals));
  }

  function renderVizTop(chain) {
    const state = parseHash();
    const selectedKind = normalizeVizTopType(state.type || state.topType || 'shares');
    appEl.innerHTML = `
      <section class="panel viz-top">
        <h2>VIZ: топ пользователей</h2>
        <p>Топ загружается только по кнопке. При открытии страницы v3 не сканирует ноду автоматически, чтобы не создавать ожидание и лишнюю нагрузку.</p>
        <p class="notice">Источник: публичные RPC-ноды VIZ (${escapeHtml((chain.nodes || []).join(', '))}). Backend/indexer, PHP и приватные IP не используются. Данные хранятся только в памяти текущей вкладки.</p>
        <form id="viz-top-controls" class="route-form">
          <div class="field field-grow">
            <label for="viz-top-kind">Сортировать по</label>
            <select id="viz-top-kind" name="type">${vizTopTypeOptions(selectedKind)}</select>
            <small class="muted">Выбранный тип сохраняется в URL как <code>type</code>, например <code>#chain=viz&amp;app=top&amp;type=shares</code>.</small>
          </div>
          <button type="button" data-viz-top-load${vizTopState.loading ? ' disabled aria-disabled="true"' : ''}>${vizTopState.loading ? 'Загрузка...' : (vizTopState.rows.length ? 'Обновить топ' : 'Загрузить топ')}</button>
        </form>
        <div data-viz-top-progress role="status" aria-live="polite">${vizTopState.loadedAt ? `Последняя загрузка: ${escapeHtml(vizTopState.loadedAt)}` : 'Ожидаю запуска загрузки.'}</div>
        <progress data-viz-top-progress-bar max="100" value="0">0%</progress>
        ${vizTopState.error ? `<p class="warning">${escapeHtml(vizTopState.error)}</p>` : ''}
        <div data-viz-top-results>${renderVizTopResults(selectedKind)}</div>
      </section>`;

    const select = document.getElementById('viz-top-kind');
    select.addEventListener('change', () => {
      const result = document.querySelector('[data-viz-top-results]');
      if (result) result.innerHTML = renderVizTopResults(select.value);
      navigate({ chain: chain.id, app: 'top', type: normalizeVizTopType(select.value) });
    });

    const button = document.querySelector('[data-viz-top-load]');
    button.addEventListener('click', async () => {
      if (vizTopState.loading) return;
      vizTopState.loading = true;
      vizTopState.error = '';
      button.disabled = true;
      button.setAttribute('aria-disabled', 'true');
      button.textContent = 'Загрузка...';
      try {
        setVizTopProgress('Подключаю VIZ RPC...', 3);
        await loadScript(chain.libraryPath);
        const connection = await getConnection(chain);
        const rows = await loadVizTopRows(connection, setVizTopProgress);
        vizTopState.rows = rows;
        vizTopState.loadedAt = new Date().toLocaleString('ru-RU');
        vizTopState.loading = false;
        setStatus(`VIZ top загружен: ${rows.length} аккаунтов.`, 'ok');
        renderVizTop(chain);
      } catch (error) {
        vizTopState.loading = false;
        vizTopState.error = profiles.formatError(error);
        setStatus(`Ошибка загрузки VIZ top: ${profiles.formatError(error)}`, 'error');
        renderVizTop(chain);
      }
    });
  }

  const golosTopState = {
    loading: false,
    loadedAt: null,
    rows: [],
    uiaSymbols: [],
    error: ''
  };

  const golosTopRankingOptions = [
    { type: 'GP', aliases: ['sg', 'СГ'], label: 'Сила Голоса (СГ)', description: 'Собственная СГ, рассчитанная из vesting_shares по текущему курсу сети.' },
    { type: 'EFFECTIVE_GP', aliases: ['effective_sg', 'EGP'], label: 'Эффективная СГ', description: 'СГ с учётом полученных и отданных делегаций.' },
    { type: 'GOLOS', aliases: ['golos'], label: 'GOLOS', description: 'Ликвидный баланс GOLOS.' },
    { type: 'GBG', aliases: ['gbg'], label: 'GBG', description: 'Ликвидный баланс GBG.' },
    { type: 'TIP', aliases: ['tip'], label: 'TIP GOLOS', description: 'TIP-баланс GOLOS.' },
    { type: 'ACCUMULATIVE', aliases: ['accumulative', 'CLAIM'], label: 'Накопления GOLOS', description: 'accumulative_balance / доступные накопления.' },
    { type: 'REPUTATION', aliases: ['reputation', 'rating', 'рейтинг', 'репутация'], label: 'Рейтинг / репутация', description: 'Человекочитаемая репутация аккаунта, рассчитанная локально из raw reputation.' }
  ];

  function normalizeGolosTopType(value) {
    const raw = String(value || 'GP').trim();
    if (!raw) return 'GP';
    const upper = raw.toUpperCase();
    if (upper.startsWith('UIA:')) return `UIA:${raw.slice(4).trim().toUpperCase()}`;
    const option = golosTopRankingOptions.find((item) => item.type === upper || (item.aliases || []).some((alias) => String(alias).toUpperCase() === upper));
    return option ? option.type : 'GP';
  }

  function golosTopOptionLabel(type) {
    const normalized = normalizeGolosTopType(type);
    const option = golosTopRankingOptions.find((item) => item.type === normalized);
    if (option) return option.label;
    if (normalized.startsWith('UIA:')) return `UIA ${normalized.slice(4)}`;
    return 'Сила Голоса (СГ)';
  }

  function golosTopKindOptions(selectedType) {
    const normalized = normalizeGolosTopType(selectedType);
    const base = golosTopRankingOptions.map((option) => `<option value="${escapeHtml(option.type)}"${normalized === option.type ? ' selected' : ''}>${escapeHtml(option.label)}</option>`).join('');
    const uia = (golosTopState.uiaSymbols || []).map((symbol) => {
      const value = `UIA:${symbol}`;
      return `<option value="${escapeHtml(value)}"${normalized === value ? ' selected' : ''}>UIA ${escapeHtml(symbol)}</option>`;
    }).join('');
    return base + uia;
  }

  function golosTopMetric(row, type) {
    if (!row) return 0;
    const normalized = normalizeGolosTopType(type);
    if (normalized.startsWith('UIA:')) return Number(row.uia && row.uia[normalized.slice(4)] || 0);
    if (normalized === 'EFFECTIVE_GP') return row.effectiveSg || 0;
    if (normalized === 'GOLOS') return row.golos || 0;
    if (normalized === 'GBG') return row.gbg || 0;
    if (normalized === 'TIP') return row.tip || 0;
    if (normalized === 'ACCUMULATIVE') return row.accumulative || 0;
    if (normalized === 'REPUTATION') return row.reputation || 0;
    return row.sg || 0;
  }

  function formatGolosTopNumber(value, digits = 3) {
    const number = Number(value || 0);
    if (!Number.isFinite(number)) return '0';
    return number.toLocaleString('ru-RU', { maximumFractionDigits: digits, minimumFractionDigits: Math.min(digits, 3) });
  }

  function golosTopValueDigits(kind) {
    const normalized = normalizeGolosTopType(kind);
    if (normalized.startsWith('UIA:')) return 6;
    if (normalized === 'REPUTATION') return 2;
    return 3;
  }

  function renderGolosTopResults(kind) {
    if (!golosTopState.rows.length) {
      return '<p class="muted">Топ ещё не загружен. Нажмите кнопку загрузки — при входе на страницу запросы к ноде не запускаются.</p>';
    }
    const sorted = golosTopState.rows
      .filter((row) => golosTopMetric(row, kind) > 0)
      .sort((a, b) => golosTopMetric(b, kind) - golosTopMetric(a, kind))
      .slice(0, 100);
    if (!sorted.length) return `<p class="muted">Для ${escapeHtml(golosTopOptionLabel(kind))} ненулевые балансы не найдены.</p>`;
    const rows = sorted.map((row, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${renderAccountCell(chains.golos, row.name)}</td>
        <td>${escapeHtml(formatGolosTopNumber(golosTopMetric(row, kind), golosTopValueDigits(kind)))}</td>
        <td>${escapeHtml(formatGolosTopNumber(row.sg, 3))}</td>
        <td>${escapeHtml(formatGolosTopNumber(row.golos, 3))}</td>
        <td>${escapeHtml(formatGolosTopNumber(row.gbg, 3))}</td>
      </tr>`).join('');
    return `<div class="table-wrap"><table><caption>Топ-100: ${escapeHtml(golosTopOptionLabel(kind))}</caption><thead><tr><th scope="col">#</th><th scope="col">Аккаунт</th><th scope="col">Значение</th><th scope="col">СГ</th><th scope="col">GOLOS</th><th scope="col">GBG</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  function setGolosTopProgress(message, percent) {
    const progress = document.querySelector('[data-golos-top-progress]');
    if (progress) {
      progress.textContent = message;
      progress.dataset.state = golosTopState.loading ? 'loading' : 'info';
    }
    const bar = document.querySelector('[data-golos-top-progress-bar]');
    if (bar && Number.isFinite(percent)) {
      bar.max = 100;
      bar.value = Math.max(0, Math.min(100, percent));
    }
    setStatus(message, golosTopState.loading ? 'loading' : 'info');
  }

  async function fetchGolosTopAccountNames(connection, onProgress) {
    const names = [];
    let from = '';
    const limit = 1000;
    const seen = new Set();
    while (true) {
      const chunk = await profiles.apiCall(connection, 'lookupAccounts', [from, limit]);
      const fresh = (Array.isArray(chunk) ? chunk : []).filter((name) => name && !seen.has(name));
      fresh.forEach((name) => { seen.add(name); names.push(name); });
      if (onProgress) onProgress(`Найдено аккаунтов: ${names.length}`, Math.min(35, names.length ? 10 + names.length / 300 : 5));
      if (!Array.isArray(chunk) || chunk.length < limit || !fresh.length) break;
      from = chunk[chunk.length - 1];
    }
    return names;
  }

  async function mapGolosTopChunks(items, chunkSize, concurrency, worker, onProgress) {
    const chunks = [];
    for (let i = 0; i < items.length; i += chunkSize) chunks.push(items.slice(i, i + chunkSize));
    let cursor = 0;
    let done = 0;
    const results = [];
    async function run() {
      while (cursor < chunks.length) {
        const index = cursor++;
        const value = await worker(chunks[index], index);
        if (Array.isArray(value)) results.push(...value);
        done += chunks[index].length;
        if (onProgress) onProgress(done, items.length);
      }
    }
    await Promise.all(Array.from({ length: Math.min(concurrency, chunks.length) }, run));
    return results;
  }

  function normalizeGolosTopAccount(account, rate) {
    const ownVests = numericAssetValue(account && account.vesting_shares);
    const receivedVests = numericAssetValue(account && account.received_vesting_shares);
    const delegatedVests = numericAssetValue(account && account.delegated_vesting_shares);
    const toSg = (vests) => rate ? vests / 1000000 * rate : 0;
    const reputation = Number(profiles.calculateReputation(account && account.reputation));
    return {
      name: account.name,
      sg: toSg(ownVests),
      effectiveSg: toSg(ownVests + receivedVests - delegatedVests),
      golos: numericAssetValue(account.balance),
      gbg: numericAssetValue(account.sbd_balance || account.gbg_balance),
      tip: numericAssetValue(account.tip_balance),
      accumulative: numericAssetValue(account.accumulative_balance),
      reputation: Number.isFinite(reputation) ? reputation : 0,
      reputationRaw: account.reputation,
      uia: {}
    };
  }

  function mergeGolosTopUiaRows(row, parsedRows) {
    (parsedRows || []).forEach((item) => {
      const meta = item && item[2];
      if (!row || !meta || meta.kind !== 'uia' || meta.balanceType !== 'main') return;
      row.uia[meta.symbol] = (row.uia[meta.symbol] || 0) + numericAssetValue(item[1]);
    });
  }

  function mergeGolosTopUiaResult(rowsByName, result, chunkNames) {
    const data = result && result.result !== undefined ? result.result : result;
    if (!data) return;
    if (typeof data === 'object' && !Array.isArray(data)) {
      (chunkNames || Object.keys(data)).forEach((name) => {
        mergeGolosTopUiaRows(rowsByName[name], parseGolosUiaBalanceRows(data, name));
      });
      return;
    }
    if (Array.isArray(data) && Array.isArray(chunkNames) && data.length === chunkNames.length) {
      data.forEach((balances, index) => {
        const name = chunkNames[index];
        mergeGolosTopUiaRows(rowsByName[name], parseGolosUiaBalanceRows({ [name]: balances }, name));
      });
    }
  }

  async function fetchGolosTopUiaBalances(connection, names, rowsByName, onProgress) {
    const api = connection.client && connection.client.api;
    const fetchChunk = async (chunk) => {
      if (api && typeof api.getAccountsBalancesAsync === 'function') return api.getAccountsBalancesAsync(chunk);
      if (api && typeof api.getAccountsBalances === 'function') {
        return new Promise((resolve, reject) => api.getAccountsBalances(chunk, (error, result) => error ? reject(error) : resolve(result)));
      }
      if (!connection.node || typeof global.fetch !== 'function') return null;
      const response = await global.fetch(connection.node, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method: 'call', params: ['database_api', 'get_accounts_balances', [chunk]] })
      });
      if (!response.ok) throw new Error(`get_accounts_balances RPC HTTP ${response.status}`);
      const payload = await response.json();
      if (payload.error) throw new Error(payload.error.message || JSON.stringify(payload.error));
      return payload.result;
    };

    await mapGolosTopChunks(names, 1000, 2, async (chunk) => {
      const result = await fetchChunk(chunk);
      mergeGolosTopUiaResult(rowsByName, result, chunk);
      return [];
    }, (done, total) => {
      if (onProgress) onProgress(`Загрузка UIA-балансов: ${done}/${total}`, 75 + Math.round((done / Math.max(total, 1)) * 20));
    });
  }

  async function loadGolosTopRows(connection, onProgress) {
    const names = await fetchGolosTopAccountNames(connection, onProgress);
    const props = await profiles.apiCall(connection, 'getDynamicGlobalProperties', []);
    const rateAccount = { _v3ProfileContext: { dynamicProperties: props } };
    const rate = profiles.golosPowerRate(rateAccount);
    const accounts = await mapGolosTopChunks(names, 1000, 2, (chunk) => profiles.apiCall(connection, 'getAccounts', [chunk]), (done, total) => {
      if (onProgress) onProgress(`Загрузка аккаунтов: ${done}/${total}`, 35 + Math.round((done / Math.max(total, 1)) * 40));
    });
    const rows = accounts.filter((account) => account && account.name).map((account) => normalizeGolosTopAccount(account, rate));
    const rowsByName = Object.fromEntries(rows.map((row) => [row.name, row]));
    try {
      await fetchGolosTopUiaBalances(connection, names, rowsByName, onProgress);
    } catch (error) {
      console.warn('Golos top UIA balances were not fully loaded:', error);
      golosTopState.error = `UIA балансы загружены не полностью: ${profiles.formatError(error)}`;
    }
    golosTopState.uiaSymbols = Array.from(new Set(rows.flatMap((row) => Object.keys(row.uia || {})))).sort((a, b) => a.localeCompare(b));
    return rows;
  }

  function renderGolosTop(chain) {
    const state = parseHash();
    const selectedKind = normalizeGolosTopType(state.type || state.topKind || 'GP');
    appEl.innerHTML = `
      <section class="panel golos-top">
        <h2>Golos: топ пользователей</h2>
        <p>Топ загружается только по кнопке. При открытии страницы v3 не сканирует ноду автоматически, чтобы не создавать ожидание и лишнюю нагрузку.</p>
        <p class="notice">Источник: публичные RPC-ноды Golos (${escapeHtml((chain.nodes || []).join(', '))}). Backend/indexer, PHP и приватные IP не используются. В этом проходе кэш/БД не добавлены: скорость живой загрузки достаточная, а пользователь явно запускает сканирование.</p>
        <form id="golos-top-controls" class="route-form">
          <div class="field field-grow">
            <label for="golos-top-kind">Сортировать по</label>
            <select id="golos-top-kind" name="type">${golosTopKindOptions(selectedKind)}</select>
            <small class="muted">Выбранный тип сохраняется в URL как <code>type</code>, например <code>#chain=golos&amp;app=top&amp;type=GP</code>.</small>
          </div>
          <button type="button" data-golos-top-load${golosTopState.loading ? ' disabled aria-disabled="true"' : ''}>${golosTopState.loading ? 'Загрузка...' : (golosTopState.rows.length ? 'Обновить топ' : 'Загрузить топ')}</button>
        </form>
        <div data-golos-top-progress role="status" aria-live="polite">${golosTopState.loadedAt ? `Последняя загрузка: ${escapeHtml(golosTopState.loadedAt)}` : 'Ожидаю запуска загрузки.'}</div>
        <progress data-golos-top-progress-bar max="100" value="0">0%</progress>
        ${golosTopState.error ? `<p class="warning">${escapeHtml(golosTopState.error)}</p>` : ''}
        <div data-golos-top-results>${renderGolosTopResults(selectedKind)}</div>
      </section>`;

    const select = document.getElementById('golos-top-kind');
    select.addEventListener('change', () => {
      const result = document.querySelector('[data-golos-top-results]');
      if (result) result.innerHTML = renderGolosTopResults(select.value);
      navigate({ chain: chain.id, app: 'top', type: normalizeGolosTopType(select.value) });
    });

    const button = document.querySelector('[data-golos-top-load]');
    button.addEventListener('click', async () => {
      if (golosTopState.loading) return;
      golosTopState.loading = true;
      golosTopState.error = '';
      button.disabled = true;
      button.setAttribute('aria-disabled', 'true');
      button.textContent = 'Загрузка...';
      try {
        setGolosTopProgress('Подключаю Golos RPC...', 3);
        await loadScript(chain.libraryPath);
        const connection = await getConnection(chain);
        const rows = await loadGolosTopRows(connection, setGolosTopProgress);
        golosTopState.rows = rows;
        golosTopState.loadedAt = new Date().toLocaleString('ru-RU');
        golosTopState.loading = false;
        setStatus(`Golos top загружен: ${rows.length} аккаунтов.`, 'ok');
        renderGolosTop(chain);
      } catch (error) {
        golosTopState.loading = false;
        golosTopState.error = profiles.formatError(error);
        setStatus(`Ошибка загрузки Golos top: ${profiles.formatError(error)}`, 'error');
        renderGolosTop(chain);
      }
    });
  }

  function renderGolosWitnessesRewards(chain) {
    appEl.innerHTML = `
      <section class="panel golos-witnesses-rewards">
        <h2>Делегаты</h2>
        <p>Актуальный список делегатов блокчейна Golos через публичный RPC без приватных ключей, backend-сервисов и вымышленных reward-агрегатов.</p>
        <section class="subpanel" aria-labelledby="golos-witnesses-live-heading">
          <h3 id="golos-witnesses-live-heading">Список делегатов Golos</h3>
          <p>Публичный RPC показывает текущие witness records. Исторические суммы наград из legacy backend здесь намеренно не отображаются, потому что browser-only v3 не имеет серверного индекса для таких агрегатов.</p>
          <button type="button" id="golos-witnesses-rewards-load">Загрузить делегатов через public RPC</button>
          <p id="golos-witnesses-rewards-status" role="status" aria-live="polite">Список делегатов ещё не загружен.</p>
          <div id="golos-witnesses-rewards-list"><p class="muted">Нажмите кнопку, чтобы запросить <code>getWitnessesByVote</code> / <code>lookupWitnessAccounts</code> через публичную ноду.</p></div>
        </section>
      </section>`;
    const loadButton = document.getElementById('golos-witnesses-rewards-load');
    if (loadButton) loadButton.addEventListener('click', () => loadGolosWitnessesByVote(chain));
    setStatus('Golos: делегаты открыты в статическом режиме.', 'info');
  }

  const vizWitnessRewardColumns = [
    ['Логин', 'login', 'Имя делегата/witness и ссылка на профиль witness.'],
    ['за вчерашний день', 'old_daily_profit', 'Предыдущий UTC-day reward aggregate из старого backend, округлялся до 3 знаков.'],
    ['за сегодня', 'now_daily_profit', 'Текущий UTC-day reward aggregate из старого backend, округлялся до 3 знаков.'],
    ['за прошлый месяц', 'old_monthly_profit', 'Предыдущий UTC-month reward aggregate из старого backend, округлялся до 3 знаков.'],
    ['за текущий месяц', 'now_monthly_profit', 'Текущий UTC-month reward aggregate из старого backend, округлялся до 3 знаков.']
  ];

  function renderVizWitnessRewardColumnRows() {
    return vizWitnessRewardColumns.map(([label, field, meaning]) => `<tr><td>${escapeHtml(label)}</td><td><code>${escapeHtml(field)}</code></td><td>${escapeHtml(meaning)}</td><td>${field === 'login' ? 'заменено v3 profile/witness hash-ссылкой и public RPC witness list' : 'backend-only non-goal: public witness RPC does not expose historical daily/monthly reward sums'}</td></tr>`).join('');
  }

  function normalizeVizWitnessRows(result) {
    const rows = Array.isArray(result) ? result : [];
    return rows.map((item) => {
      const owner = item && (item.owner || item.account || item.name || item.witness || item.id || item[0]);
      if (!owner) return null;
      return {
        owner: String(owner),
        url: item.url || item.signing_key || '',
        votes: item.votes || item.virtual_scheduled_time || item.total_missed || '',
        produced: item.produced || item.signing_key || '',
        raw: item
      };
    }).filter(Boolean);
  }

  async function loadVizWitnessesByVote(chain) {
    const status = document.getElementById('viz-witnesses-rewards-status');
    const target = document.getElementById('viz-witnesses-rewards-list');
    if (!status || !target) return;
    status.textContent = 'Загружаю список делегатов VIZ через публичный RPC...';
    try {
      await loadScript(chain.libraryPath);
      const connection = await profiles.connect(chain);
      let witnesses = normalizeVizWitnessRows(await profiles.apiCall(connection, 'getWitnessesByVote', ['', 50]));
      if (!witnesses.length) {
        const names = await profiles.apiCall(connection, 'lookupWitnessAccounts', ['', 50]);
        const witnessResults = await Promise.all((Array.isArray(names) ? names : []).slice(0, 50).map((name) => profiles.apiCall(connection, 'getWitnessByAccount', [name]).catch(() => null)));
        witnesses = normalizeVizWitnessRows(witnessResults.filter(Boolean));
      }
      if (!witnesses.length) {
        target.innerHTML = '<p class="muted">Публичная нода не вернула witness-список.</p>';
        status.textContent = 'Witness-список не найден в ответе публичной ноды.';
        return;
      }
      const rows = witnesses.map((witness) => `<tr><td><a href="${escapeHtml(appHash({ chain: chain.id, app: 'profiles', account: witness.owner }))}">${escapeHtml(witness.owner)}</a> <span class="muted">профиль witness</span></td><td><code>${escapeHtml(String(witness.url || ''))}</code></td><td>${escapeHtml(String(witness.votes || ''))}</td><td>${escapeHtml(String(witness.produced || ''))}</td></tr>`).join('');
      target.innerHTML = `<div class="table-wrap"><table aria-label="Публичный список делегатов VIZ"><caption>Публичный список делегатов VIZ из witness_api</caption><thead><tr><th scope="col">Делегат</th><th scope="col">URL/signing key</th><th scope="col">Votes / service field</th><th scope="col">Produced/signing data</th></tr></thead><tbody>${rows}</tbody></table></div>`;
      status.textContent = `Загружено делегатов VIZ через public RPC: ${witnesses.length}. Reward-агрегаты ниже не вычисляются.`;
      setStatus(`VIZ witnesses-rewards: загружено witness records: ${witnesses.length}.`, 'ok');
    } catch (error) {
      target.innerHTML = `<p class="muted">Не удалось загрузить публичный witness-список: ${escapeHtml(profiles.formatError(error))}</p>`;
      status.textContent = `Ошибка загрузки witness-списка: ${profiles.formatError(error)}`;
      setStatus(`VIZ witnesses-rewards: ${profiles.formatError(error)}`, 'error');
    }
  }

  function renderVizWitnessesRewards(chain) {
    appEl.innerHTML = `
      <section class="panel viz-witnesses-rewards">
        <h2>Награды делегатов</h2>
        <p>Страница со списком делегатов Viz и их наград за текущий день и месяц, предыдущий день и месяц.</p>
        <p><strong>Обновление происходит в полночь по GMT, но не все сразу делегаты обновляются, а те, которые подписывают блоки.</strong></p>
        <section class="subpanel" aria-labelledby="viz-witnesses-live-heading">
          <h3 id="viz-witnesses-live-heading">Public RPC witness list</h3>
          <p>Публичный RPC может показать текущих делегатов/witness records без приватных ключей и без старого backend. В vendored VIZ client найдены descriptors <code>witness_api</code>: <code>get_witnesses_by_vote</code>, <code>lookup_witness_accounts</code>, <code>get_witness_by_account</code>, <code>get_active_witnesses</code>. Это отдельный статический слой: он не заменяет исторические reward-агрегаты.</p>
          <button type="button" id="viz-witnesses-rewards-load">Загрузить делегатов через public RPC</button>
          <p id="viz-witnesses-rewards-status" role="status" aria-live="polite">Witness-список ещё не загружен.</p>
          <div id="viz-witnesses-rewards-list"><p class="muted">Нажмите кнопку, чтобы запросить <code>getWitnessesByVote</code> / <code>lookupWitnessAccounts</code> через публичную ноду.</p></div>
        </section>
        <section class="subpanel" aria-labelledby="viz-witnesses-columns-heading">
          <h3 id="viz-witnesses-columns-heading">Legacy reward columns</h3>
          <p class="notice">Старые поля <code>old_daily_profit</code>, <code>now_daily_profit</code>, <code>old_monthly_profit</code>, <code>now_monthly_profit</code> приходили из <code>viz-api?service=witnesses</code> на приватном backend/IP. Static v3 не восстанавливает этот backend и не показывает вымышленные суммы.</p>
          <div class="table-wrap"><table aria-label="Legacy columns for VIZ witnesses rewards"><caption>Legacy columns for VIZ witnesses rewards</caption><thead><tr><th scope="col">Колонка</th><th scope="col">Legacy field</th><th scope="col">Meaning</th><th scope="col">v3 status</th></tr></thead><tbody>${renderVizWitnessRewardColumnRows()}</tbody></table></div>
        </section>
      </section>`;
    const loadButton = document.getElementById('viz-witnesses-rewards-load');
    if (loadButton) loadButton.addEventListener('click', () => loadVizWitnessesByVote(chain));
    setStatus('VIZ: witnesses-rewards открыт в статическом режиме.', 'info');
  }

  function buildVizProjectMemo(type, data) {
    var kind = String(type || '').trim();
    var payload = data || {};
    if (kind !== 'project' && kind !== 'task') throw new Error('Неизвестный тип viz-projects memo.');
    if (!String(payload.name || '').trim()) throw new Error('Укажите название.');
    if (!String(payload.description || '').trim()) throw new Error('Укажите описание.');
    return JSON.stringify([kind, payload]);
  }

  function vizProjectsHistoryHash(chain, account) {
    return appHash({ chain: chain.id, app: 'history', account: account || chain.defaultAccount || '', ops: 'transfer,custom', query: 'viz-projects' });
  }

  function renderVizProjects(chain) {
    var login = auth.getCurrentLogin(chain) || '';
    var historyUrl = vizProjectsHistoryHash(chain, login);
    appEl.innerHTML = `
      <section class="panel viz-projects">
        <h2>VIZ: Проекты</h2>
        <p>Legacy <code>projects</code> был каталогом проектов, задач, новостей и рабочих отчётов протокола <code>viz-projects</code>.</p>
        <p class="notice"><strong>Backend yes:</strong> каталог, задачи, новости, типы/категории и рабочие отчёты читались из <code>viz-api?service=viz-projects</code> на приватном IP. Static v3 не восстанавливает backend/indexer-only списки и не вызывает PHP endpoints.</p>
        <nav aria-label="Разделы projects"><ul><li><a href="#viz-projects-catalog">Каталог проектов</a></li><li><a href="#viz-projects-tasks">Список задач</a></li><li><a href="#viz-projects-add-project">Добавить проект</a></li><li><a href="#viz-projects-add-task">Добавить задачу</a></li></ul></nav>
        <section class="subpanel" id="viz-projects-catalog" aria-labelledby="viz-projects-catalog-heading">
          <h3 id="viz-projects-catalog-heading">Каталог проектов</h3>
          <p>Legacy catalog filters (<code>types</code>, <code>categories</code>, <code>projects</code>) были backend/indexer-only. В v3 используйте <a href="${escapeHtml(historyUrl)}">историю аккаунта с query: 'viz-projects'</a> или публичный RPC для сырых transfer/custom операций.</p>
        </section>
        <section class="subpanel" id="viz-projects-tasks" aria-labelledby="viz-projects-tasks-heading">
          <h3 id="viz-projects-tasks-heading">Список задач</h3>
          <p>Legacy tasks/working-tasks/news pages также читали приватный индекс <code>service=viz-projects</code>. Static v3 не показывает непроверенные списки, но сохраняет безопасные формы создания project/task через блокчейн.</p>
        </section>
        <section class="subpanel" id="viz-projects-add-project" aria-labelledby="viz-projects-add-project-heading">
          <h3 id="viz-projects-add-project-heading">Добавить проект</h3>
          <p><strong>Стоимость добавления проекта: 1.000 VIZ</strong> переводом аккаунту <code>viz-projects</code> с memo JSON <code>['project', data]</code>.</p>
          <details id="viz-projects-add-project-details" class="operation-details"><summary>Добавить проект — paid transfer preview</summary><form id="viz-projects-add-project-form" class="stacked-form"><fieldset>
            <legend>Новый проект</legend>
            <div class="field"><label for="viz-project-name">Название</label><input id="viz-project-name" name="name" type="text" required></div>
            <div class="field"><label for="viz-project-description">Описание</label><textarea id="viz-project-description" name="description" rows="3" required></textarea></div>
            <div class="field"><label for="viz-project-image">Изображение</label><input id="viz-project-image" name="image_link" type="url"></div>
            <div class="field"><label for="viz-project-type">Тип</label><input id="viz-project-type" name="type" type="text" placeholder="app, service, library"></div>
            <div class="field"><label for="viz-project-category">Категория</label><input id="viz-project-category" name="category" type="text"></div>
            <div class="field"><label for="viz-project-dev-status">Статус разработки</label><select id="viz-project-dev-status" name="dev_status"><option value="test">Тестовая версия</option><option value="stable">Стабильная версия</option></select></div>
            <div class="field"><label for="viz-project-command">Команда, логины через запятую</label><input id="viz-project-command" name="command" type="text"></div>
            <div class="field"><label for="viz-project-site">Сайт</label><input id="viz-project-site" name="site" type="url"></div>
            <div class="field"><label for="viz-project-github">Github</label><input id="viz-project-github" name="github" type="url"></div>
            <button type="submit" name="intent" value="preview">Проверить проект</button><button type="submit" name="intent" value="send">Отправить проект</button>
            <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
          </fieldset></form></details>
        </section>
        <section class="subpanel" id="viz-projects-add-task" aria-labelledby="viz-projects-add-task-heading">
          <h3 id="viz-projects-add-task-heading">Добавить задачу</h3>
          <p><strong>Стоимость добавления задачи: 1.000 VIZ</strong> переводом аккаунту <code>viz-projects</code> с memo JSON <code>['task', data]</code>.</p>
          <details id="viz-projects-add-task-details" class="operation-details"><summary>Добавить задачу — paid transfer preview</summary><form id="viz-projects-add-task-form" class="stacked-form"><fieldset>
            <legend>Новая задача</legend>
            <div class="field"><label for="viz-task-name">Название</label><input id="viz-task-name" name="name" type="text" required></div>
            <div class="field"><label for="viz-task-description">Описание</label><textarea id="viz-task-description" name="description" rows="3" required></textarea></div>
            <button type="submit" name="intent" value="preview">Проверить задачу</button><button type="submit" name="intent" value="send">Отправить задачу</button>
            <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
          </fieldset></form></details>
        </section>
      </section>`;
    bindOperationForm(chain, 'viz-projects-add-project-form', function (form) {
      var from = normalizeAccountInput(chain, auth.getCurrentLogin(chain), 'Создатель проекта');
      var data = {
        name: String(form.get('name') || '').trim(),
        description: String(form.get('description') || '').trim(),
        image_link: String(form.get('image_link') || '').trim(),
        type: String(form.get('type') || '').trim(),
        category: String(form.get('category') || '').trim(),
        dev_status: String(form.get('dev_status') || 'test'),
        command: String(form.get('command') || '').split(',').map(function (item) { return item.trim(); }).filter(Boolean),
        site: String(form.get('site') || '').trim(),
        github: String(form.get('github') || '').trim()
      };
      var memo = buildVizProjectMemo('project', data);
      return broadcast.prepare(chain, 'active', 'transfer', [from, 'viz-projects', '1.000 VIZ', memo], { title: 'VIZ projects add project', to: 'viz-projects', amount: '1.000 VIZ' });
    });
    bindOperationForm(chain, 'viz-projects-add-task-form', function (form) {
      var from = normalizeAccountInput(chain, auth.getCurrentLogin(chain), 'Создатель задачи');
      var data = { name: String(form.get('name') || '').trim(), description: String(form.get('description') || '').trim(), mambers: [], status: 'open' };
      var memo = buildVizProjectMemo('task', data);
      return broadcast.prepare(chain, 'active', 'transfer', [from, 'viz-projects', '1.000 VIZ', memo], { title: 'VIZ projects add task', to: 'viz-projects', amount: '1.000 VIZ' });
    });
    setStatus('VIZ: projects открыт в static-safe режиме. Backend catalog/tasks/news не восстанавливаются.', 'info');
  }

  const vizVmpPoolTokens = ['USDTE', 'USDCE', 'USDTBSC', 'USDCBSC', 'DAIE', 'DAIBSC', 'BTC', 'BTCBSC', 'ETH', 'MUSD', 'HUB', 'METAGARDEN', 'BIP'];
  const vizVmpCalcPairs = ['BIP/VIZCHAIN', 'USDTE/VIZCHAIN', 'USDTBSC/VIZCHAIN', 'USDCE/VIZCHAIN', 'USDCBSC/VIZCHAIN', 'DAIE/VIZCHAIN', 'DAIBSC/VIZCHAIN', 'BTC/VIZCHAIN', 'BTCBSC/VIZCHAIN', 'ETH/VIZCHAIN', 'MUSD/VIZCHAIN', 'HUB/VIZCHAIN'];

  function renderVizVmpPoolLinks() {
    return vizVmpPoolTokens.map(function (token) {
      var pair = token + '/VIZCHAIN';
      var href = 'https://chainik.io/pool/' + encodeURIComponent(token) + '/VIZCHAIN';
      return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener">${escapeHtml(pair)}</a>`;
    }).join(' ');
  }

  function parseVizVmpAddressFromMemo(memo) {
    var text = String(memo || '');
    var match = text.match(/for\s([^:\s])\s*:/i);
    return match ? match[1] : '';
  }

  async function loadVizVmpAwardData(chain, login) {
    var account = normalizeAccountInput(chain, login, 'VIZ farmer');
    var connection = await getConnection(chain);
    var history = await profiles.apiCall(connection, 'getAccountHistory', [account, -1, 1000]);
    var sharesCounter = 0;
    var awardsCounter = 0;
    var memo = '';
    (Array.isArray(history) ? history : []).forEach(function (entry) {
      if (awardsCounter >= 7) return;
      var op = entry && entry[1] && entry[1].op;
      var opType = op && op[0];
      var opData = op && op[1] || {};
      if (opType === 'receive_award' && opData.initiator === 'viz-projects') {
        sharesCounter = parseFloat(opData.shares || 0);
        awardsCounter = 1;
        memo = opData.memo || memo;
      }
    });
    if (!awardsCounter) return { account: account, shares: 0, awards: 0, address: '' };
    return { account: account, shares: Math.round(sharesCounter / awardsCounter * 365), awards: awardsCounter, address: parseVizVmpAddressFromMemo(memo), memo: memo };
  }

  async function loadVizVmpPairLiquidity(pair, address) {
    var page = 1;
    var liquidity = 0;
    while (page <= 20 && liquidity === 0) {
      var url = 'https://explorer-api.minter.network/api/v2/pools/coins/' + encodeURIComponent(pair) + '/providers?page=' + page;
      var payload = await fetchJsonText(url, 'Minter VMP providers ' + pair);
      var providers = payload && payload.data || [];
      providers.forEach(function (provider) {
        if (provider && provider.address === address) liquidity += parseFloat(provider.amount1 || 0) * 2;
      });
      if (!payload || !payload.links || !payload.links.next) break;
      page += 1;
    }
    return liquidity;
  }

  async function loadVizVmpLiquidity(address) {
    var total = 0;
    for (var index = 0; index < vizVmpCalcPairs.length; index += 1) {
      total += await loadVizVmpPairLiquidity(vizVmpCalcPairs[index], address);
    }
    return total;
  }

  function renderVizVmpResult(data) {
    var vizProfile = appHash({ chain: 'viz', app: 'profiles', account: data.account });
    var minterProfile = appHash({ chain: 'minter', app: 'profiles', account: data.address });
    if (!data.awards) return `<p class="notice">Не найдены последние <code>receive_award</code> от <code>viz-projects</code> в истории @${escapeHtml(data.account)}. Проверьте логин или историю аккаунта.</p>`;
    if (!data.address) return `<p class="notice">В последних наградах VMP найдено ${escapeHtml(String(data.awards))} выплат, но Minter address не распознан из memo формата <code>for Mx...:</code>.</p>`;
    if (!data.liquidity) return `<p class="notice">Адрес <a href="${escapeHtml(minterProfile)}">${escapeHtml(data.address)}</a> не найден в публичных provider списках VIZCHAIN пулов или API сейчас недоступен.</p>`;
    return `<p>Доходность для <a href="${escapeHtml(vizProfile)}">${escapeHtml(data.account)}</a> (<a href="${escapeHtml(minterProfile)}">${escapeHtml(data.address)}</a>) примерно <strong>${escapeHtml(data.profitPercent.toFixed(2))}%</strong>.</p><dl class="kv-list"><div><dt>Годовая награда по последним выплатам</dt><dd>${escapeHtml(String(data.shares))} SHARES</dd></div><div><dt>Ликвидность в VIZCHAIN пулах</dt><dd>${escapeHtml(data.liquidity.toFixed(6))}</dd></div></dl>`;
  }

  function renderVizVmp(chain) {
    appEl.innerHTML = `
      <section class="panel viz-vmp">
        <h2>VIZ: Шлюз в Minter / VMP</h2>
        <section class="subpanel" aria-labelledby="viz-vmp-pools-heading">
          <h3 id="viz-vmp-pools-heading">Поддерживаемые токены Minter, в пулах с которыми идёт фарминг</h3>
          <p><strong>${renderVizVmpPoolLinks()}</strong></p>
        </section>
        <section class="subpanel" aria-labelledby="viz-vmp-details-heading">
          <h3 id="viz-vmp-details-heading">Подробности про работу со шлюзом</h3>
          <p><strong><a href="https://viz.media/zapusk-shlyuza-viz-v-minter/" target="_blank" rel="noopener">Читать</a></strong></p>
        </section>
        <section class="subpanel" aria-labelledby="viz-vmp-farm-heading">
          <h3 id="viz-vmp-farm-heading">Ваша доходность с фарминга</h3>
          <p>Расчёт повторяет legacy data flow: последние <code>receive_award</code> от <code>viz-projects</code> в истории VIZ аккаунта  публичный <code>explorer-api.minter.network/api/v2/pools/coins</code> provider list для пар <code>VIZCHAIN</code>. Это read-only раздел: операций и подписей нет.</p>
          <form id="viz-vmp-farm-form" class="stacked-form"><fieldset>
            <legend>Рассчитать доходность VMP</legend>
            <div class="field"><label for="farmer">Логин в Viz без @</label><input type="text" name="farmer" id="farmer" required autocomplete="off"></div>
            <button type="submit" id="farm_calc">Рассчитать</button>
            <div id="farm_result" class="operation-result" role="status" aria-live="polite">Введите VIZ логин и запустите расчёт.</div>
          </fieldset></form>
        </section>
      </section>`;
    document.getElementById('viz-vmp-farm-form').addEventListener('submit', async function (event) {
      event.preventDefault();
      var result = document.getElementById('farm_result');
      var farmer = String(new FormData(event.currentTarget).get('farmer') || '').trim();
      try {
        result.innerHTML = 'Ожидайте... Сканируем историю VIZ и вычисляем ликвидность пользователя...';
        var awards = await loadVizVmpAwardData(chain, farmer);
        var liquidity = awards.address ? await loadVizVmpLiquidity(awards.address) : 0;
        var profitPercent = liquidity > 0 ? awards.shares / liquidity * 100 : 0;
        result.innerHTML = renderVizVmpResult(Object.assign({}, awards, { liquidity: liquidity, profitPercent: profitPercent }));
      } catch (error) {
        result.innerHTML = escapeHtml(profiles.formatError(error));
      }
    });
    setStatus('VIZ VMP открыт: ссылки на пулы и read-only расчёт фарминга используют публичные API без backend dpos.space.', 'info');
  }

  function normalizeVizCustomProtocol(value) {
    var protocol = String(value || '').trim();
    if (!protocol) throw new Error('Укажите ID/protocol custom_json.');
    if (protocol.length > 32) throw new Error('ID/protocol custom_json должен быть не длиннее 32 символов.');
    if (!/^[a-z0-9_.-]$/i.test(protocol)) throw new Error('ID/protocol может содержать только латиницу, цифры, точку, подчёркивание и дефис.');
    return protocol;
  }

  function normalizeVizCustomJson(value) {
    var raw = String(value || '').trim();
    if (!raw) throw new Error('Вставьте JSON payload для custom_json.');
    var parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      throw new Error('JSON payload невалиден: ' + error.message);
    }
    return JSON.stringify(parsed);
  }

  function renderVizCustomGenerator(chain) {
    appEl.innerHTML = `
      <section class="panel viz-custom-generator">
        <h2>VIZ: JSON-генератор custom_json</h2>
        <p>Legacy <code>custom-generator</code> собирал произвольную форму, генерировал HTML/JS и отправлял <code>viz.broadcast.custom</code> после POST в <code>json_encode.php</code>.</p>
        <p class="notice"><strong>Backend yes:</strong> старый сгенерированный скрипт зависел от PHP <code>json_encode.php</code>, который преобразовывал form-urlencoded поля в JSON. Static v3 не восстанавливает PHP endpoint, jQuery UI drag/drop builder и вставляемый внешний скрипт; JSON проверяется локально в браузере.</p>
        <details id="viz-custom-generator-details" class="operation-details"><summary>Отправить custom_json — preview перед broadcast</summary><form id="viz-custom-generator-form" class="stacked-form"><fieldset>
          <legend>Подготовить VIZ custom_json</legend>
          <div class="field"><label for="viz-custom-protocol">ID/protocol custom_json</label><input id="viz-custom-protocol" name="protocol" type="text" maxlength="32" pattern="[A-Za-z0-9_.-]" placeholder="my-protocol" required></div>
          <div class="field"><label for="viz-custom-json">JSON payload</label><textarea id="viz-custom-json" name="json" rows="10" spellcheck="false" required>{"example":true}</textarea></div>
          <p class="muted">Заменяет legacy действия «Получить JSON текущей формы» и «Открыть получившуюся форму»: вставьте уже готовый JSON, проверьте preview, затем отправляйте только после явного подтверждения.</p>
          <button type="submit" name="intent" value="preview">Проверить JSON и операцию</button><button type="submit" name="intent" value="send">Отправить custom_json в сеть</button>
          <div id="viz-custom-generator-preview" class="operation-result" data-operation-result role="status" aria-live="polite"></div>
        </fieldset></form></details>
      </section>`;
    bindOperationForm(chain, 'viz-custom-generator-form', function (form) {
      var from = normalizeAccountInput(chain, auth.getCurrentLogin(chain), 'Отправитель custom_json');
      var protocol = normalizeVizCustomProtocol(form.get('protocol'));
      var json = normalizeVizCustomJson(form.get('json'));
      return broadcast.prepare(chain, 'regular', 'custom', [from, protocol, json], { title: 'VIZ custom_json', protocol: protocol });
    });
    setStatus('VIZ: JSON-генератор открыт. PHP json_encode и drag/drop builder не восстанавливаются; отправка идёт через общий подтверждаемый broadcast flow.', 'info');
  }

  function buildVizPollCreateMemo(question, answers, endDate, consider) {
    var text = String(question || '').trim();
    var parsedAnswers = Array.isArray(answers) ? answers : [];
    var filteredAnswers = parsedAnswers.map(function (item) { return String(item || '').trim(); }).filter(Boolean);
    var timestamp = Math.floor(new Date(endDate).getTime() / 1000);
    var considerValue = Number(consider);
    if (!text) throw new Error('Введите вопрос опроса.');
    if (filteredAnswers.length < 2) throw new Error('Нужно минимум два варианта ответа, каждый с новой строки.');
    if (!isFinite(timestamp) || timestamp <= Math.floor(Date.now() / 1000)) throw new Error('Дата окончания опроса должна быть в будущем.');
    if (considerValue !== 0 && considerValue !== 1 && considerValue !== 2) throw new Error('Выберите режим учёта соц. капитала.');
    return JSON.stringify({
      contractName: 'viz-votes',
      contractAction: 'createVote',
      contractPayload: {
        question: text,
        answers: filteredAnswers,
        end_date: timestamp,
        consider: considerValue
      }
    });
  }

  function buildVizPollVoteMemo(permlink, answerId) {
    var slug = String(permlink || '').trim();
    var numericAnswer = Number(answerId);
    if (!slug) throw new Error('Укажите permlink опроса.');
    if (numericAnswer !== Math.floor(numericAnswer) || numericAnswer < 0) throw new Error('Укажите номер варианта ответа, начиная с 0.');
    return JSON.stringify({
      contractName: 'viz-votes',
      contractAction: 'voteing',
      contractPayload: {
        votePermlink: slug,
        answerId: numericAnswer
      }
    });
  }

  function vizPollsHistoryHash(chain, account, query) {
    return appHash({ chain: chain.id, app: 'history', account: account || chain.defaultAccount || '', ops: 'transfer,custom', query: query || 'viz-votes' });
  }

  function renderVizPolls(chain) {
    var login = auth.getCurrentLogin(chain) || '';
    var historyUrl = vizPollsHistoryHash(chain, login, 'viz-votes');
    appEl.innerHTML = `
      <section class="panel viz-polls">
        <h2>Опросы</h2>
        <p>Legacy VIZ polls использовали протокол <code>viz-votes</code>: создание платным переводом <code>1.000 VIZ</code> на <code>committee</code> с memo <code>createVote</code>, голосование через <code>custom</code>/<code>custom_json</code> с <code>contractAction: voteing</code>.</p>
        <p class="notice"><strong>Backend yes:</strong> список, lookup poll по permlink, страница голосования и взвешенные результаты читались из <code>http://178.20.43.121:3100/viz-api?service=votes</code>. Это backend/indexer-only non-goal для статической v3: здесь нет скрытого сервера, не показываются вымышленные списки/проценты.</p>
        <nav aria-label="Разделы опросов"><ul><li><a href="#viz-polls-create-heading">Создание опроса</a></li><li><a href="#viz-polls-list-heading">Список/просмотр опросов</a></li><li><a href="#viz-polls-vote-heading">Голосование</a></li><li><a href="#viz-polls-results-heading">Результаты</a></li></ul></nav>
        <section class="subpanel" aria-labelledby="viz-polls-create-heading">
          <h3 id="viz-polls-create-heading">Создание опроса</h3>
          <p>Форма повторяет static-safe часть legacy <code>pages/create</code>: готовит memo <code>contractName: viz-votes</code>, <code>contractAction: createVote</code> и отправляет перевод на <code>committee</code>. Нужен выбранный VIZ-аккаунт с active key или Vizonator.</p>
          <details id="viz-polls-create-details" class="operation-details"><summary>Создать опрос — paid transfer preview</summary><form id="viz-polls-create-form" class="stacked-form"><fieldset>
            <legend>Создать опрос через перевод 1.000 VIZ</legend>
            <div class="field"><label for="viz-polls-question">Вопрос</label><input id="viz-polls-question" name="question" type="text" required></div>
            <div class="field"><label for="viz-polls-answers">Варианты ответа, каждый с новой строки</label><textarea id="viz-polls-answers" name="answers" rows="5" required></textarea></div>
            <div class="field"><label for="viz-polls-end-date">Дата и время окончания опроса</label><input id="viz-polls-end-date" name="end_date" type="datetime-local" required></div>
            <div class="field"><label for="viz-polls-consider">Учитывать при расчёте результатов соц. капитал</label><select id="viz-polls-consider" name="consider"><option value="0">Личный</option><option value="1">Личный  прокси</option><option value="2">Как при награждении</option></select></div>
            <button type="submit" name="intent" value="preview">Проверить создание опроса</button><button type="submit" name="intent" value="send">Отправить создание опроса в сеть</button>
            <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
          </fieldset></form></details>
        </section>
        <section class="subpanel" aria-labelledby="viz-polls-list-heading">
          <h3 id="viz-polls-list-heading">Список/просмотр опросов</h3>
          <p>Legacy <code>pages/list/content.php</code> вызывал backend list endpoint. Public RPC не имеет готового индекса всех <code>viz-votes</code> poll records, поэтому статическая замена безопасно ведёт в <a href="${escapeHtml(historyUrl)}">История</a> выбранного аккаунта с фильтром <code>transfer,custom</code> / <code>viz-votes</code>. Для известного permlink используйте форму голосования ниже.</p>
        </section>
        <section class="subpanel" aria-labelledby="viz-polls-vote-heading">
          <h3 id="viz-polls-vote-heading">Голосование</h3>
          <p>Так как ответы и активность опроса legacy получал из backend/indexer, v3 не угадывает список вариантов. Введите известный <code>votePermlink</code> и номер <code>answerId</code> из источника опроса; отправка использует существующий <code>broadcast.prepare</code> для <code>custom</code> с regular authority.</p>
          <details id="viz-polls-vote-details" class="operation-details"><summary>Проголосовать — custom_json preview</summary><form id="viz-polls-vote-form" class="stacked-form"><fieldset>
            <legend>Проголосовать через custom_json viz-votes</legend>
            <div class="field"><label for="viz-polls-permlink">Permlink опроса</label><input id="viz-polls-permlink" name="permlink" type="text" required></div>
            <div class="field"><label for="viz-polls-answer-id">answerId (0, 1, 2... как в legacy форме)</label><input id="viz-polls-answer-id" name="answer_id" type="number" min="0" step="1" required></div>
            <button type="submit" name="intent" value="preview">Проверить голос</button><button type="submit" name="intent" value="send">Отправить голос в сеть</button>
            <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
          </fieldset></form></details>
        </section>
        <section class="subpanel" aria-labelledby="viz-polls-results-heading">
          <h3 id="viz-polls-results-heading">Результаты</h3>
          <p>Legacy <code>pages/results/content.php</code> складывал голоса, SHARES/proxy-веса, top voters и проценты через backend endpoint <code>type=vote</code> плюс global properties. Static v3 оставляет это как backend-only non-goal; безопасная замена — проверять сырые операции в истории/RPC и не публиковать неподтверждённые агрегаты.</p>
        </section>
      </section>`;
    bindOperationForm(chain, 'viz-polls-create-form', function (form) {
      var from = auth.getCurrentLogin(chain);
      var answers = String(form.get('answers') || '').split(/\r?\n/);
      var memo = buildVizPollCreateMemo(form.get('question'), answers, form.get('end_date'), form.get('consider'));
      var creator = normalizeAccountInput(chain, from, 'Создатель опроса');
      return broadcast.prepare(chain, 'active', 'transfer', [creator, 'committee', '1.000 VIZ', memo], { title: 'VIZ polls createVote', to: 'committee', amount: '1.000 VIZ' });
    });
    bindOperationForm(chain, 'viz-polls-vote-form', function (form) {
      var from = normalizeAccountInput(chain, auth.getCurrentLogin(chain), 'Голосующий');
      var permlink = String(form.get('permlink') || '').trim();
      var memo = buildVizPollVoteMemo(permlink, form.get('answer_id'));
      return broadcast.prepare(chain, 'regular', 'custom', [from, 'viz-votes', memo], { title: 'VIZ polls voteing', protocol: 'viz-votes', permlink: permlink });
    });
    setStatus('VIZ: polls открыт в static-safe режиме. Backend list/results не восстанавливаются.', 'info');
  }

  const STEEM_BACKUP_LIMIT = 100;
  const STEEM_BACKUP_MAX_PAGES = 5;

  function safeSteemBackupFilenamePart(value) {
    return String(value || '').toLowerCase().replace(/[^a-z0-9_.-]+/g, '-').replace(/^-+|-+$/g, '') || 'account';
  }

  function parseSteemBackupTags(post) {
    try {
      const metadata = JSON.parse(post.json_metadata || '{}');
      return Array.isArray(metadata.tags) ? metadata.tags.filter(Boolean).join(' ') : '';
    } catch (error) {
      return '';
    }
  }

  function filterSteemBackupPosts(posts, account, includeReblogs) {
    const list = Array.isArray(posts) ? posts : [];
    if (includeReblogs === 'yes3') return list;
    return list.filter((post) => post && post.author === account);
  }

  function formatSteemBackupPost(post, format) {
    const title = post.title || `${post.author || ''}/${post.permlink || ''}`;
    const tags = parseSteemBackupTags(post);
    if (format === 'HTML') {
      return `<article>\n<h2>${escapeHtml(title)}</h2>\n<p><strong>Автор:</strong> ${escapeHtml(post.author || '')}</p>\n<p><strong>Permlink:</strong> ${escapeHtml(post.permlink || '')}</p>\n<p><strong>Дата:</strong> ${escapeHtml(post.created || '')}</p>\n<div>${escapeHtml(post.body || '').replace(/\n/g, '<br>')}</div>\n<p><strong>Теги:</strong> ${escapeHtml(tags)}</p>\n</article>`;
    }
    return `Заголовок: ${title}\nАвтор: ${post.author || ''}\nPermlink: ${post.permlink || ''}\nДата: ${post.created || ''}\nТекст:\n${post.body || ''}\nТеги:\n${tags}\n`;
  }

  async function loadSteemBackupPosts(chain, account) {
    const connection = await getConnection(chain);
    const posts = [];
    let startAuthor = '';
    let startPermlink = '';
    for (let page = 0; page < STEEM_BACKUP_MAX_PAGES; page += 1) {
      const query = { tag: account, limit: STEEM_BACKUP_LIMIT };
      if (startAuthor && startPermlink) {
        query.start_author = startAuthor;
        query.start_permlink = startPermlink;
      }
      const chunk = await profiles.apiCall(connection, 'getDiscussionsByBlog', [query]);
      if (!Array.isArray(chunk) || !chunk.length) break;
      const next = startAuthor && startPermlink ? chunk.slice(1) : chunk;
      posts.push(...next);
      const last = chunk[chunk.length - 1];
      if (chunk.length < STEEM_BACKUP_LIMIT || !last || !last.author || !last.permlink) break;
      startAuthor = last.author;
      startPermlink = last.permlink;
    }
    return posts;
  }

  async function bindSteemBackupForm(chain) {
    const form = document.getElementById('steem-backup-form');
    if (!form) return;
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const account = normalizeAccountInput(chain, data.get('user'), 'Steem login');
      const includeReblogs = String(data.get('reblogs') || 'yes2');
      const format = String(data.get('contentformat') || 'Markdown') === 'HTML' ? 'HTML' : 'Markdown';
      setOperationResult(form, `Загружаю публичные посты @${account} через Steem RPC...`, 'info');
      try {
        const allPosts = await loadSteemBackupPosts(chain, account);
        const posts = filterSteemBackupPosts(allPosts, account, includeReblogs);
        if (!posts.length) throw new Error('Публичные посты для выбранного режима не найдены.');
        const body = posts.map((post) => formatSteemBackupPost(post, format)).join(format === 'HTML' ? '\n<hr>\n' : '\n---\n');
        const text = format === 'HTML' ? `<!doctype html>\n<html lang="ru"><meta charset="utf-8"><title>Steem backup ${escapeHtml(account)}</title><body>\n${body}\n</body></html>` : body;
        const safeAccount = safeSteemBackupFilenamePart(account);
        const extension = format === 'HTML' ? 'html' : 'md';
        downloadTextFile(`steem-posts-${safeAccount}.${extension}`, text);
        setOperationResult(form, `Готово: подготовлено ${posts.length} записей. Файл скачан локально в браузере; данные и ключи не отправлялись на сервер.`, 'ok');
      } catch (error) {
        setOperationResult(form, profiles.formatError(error), 'error');
      }
    });
  }

  async function renderSteemBackup(chain, account) {
    const current = account || auth.getCurrentLogin(chain) || chain.defaultAccount || '';
    appEl.innerHTML = `
      <section class="panel steem-backup-panel">
        <h2>Бекап постов</h2>
        <p>Static v3 сохраняет резервную копию публичных постов локально в браузере. Старый платный PHP-сервис создавал server-side archive после проверки платежа; здесь backend-архив, оплата и серверное хранение не восстанавливаются.</p>
        <p class="notice">Можно скачать только записи, доступные публичной Steem RPC-ноде. Приватные ключи, SJCL/localStorage и аккаунтные секреты не читаются и не экспортируются.</p>
        <form id="steem-backup-form" class="stacked-form">
          <fieldset>
            <legend>Список действий</legend>
            <ol>
              <li>Введите логин Steem без символа @.</li>
              <li>Выберите, включать ли репосты.</li>
              <li>Выберите формат сохранения материалов.</li>
              <li>Нажмите «Запуск» — файл будет создан только в вашем браузере.</li>
            </ol>
            <div class="field"><label for="steem-backup-user">Имя пользователя (логин) на Steem (Без @):</label><input id="steem-backup-user" name="user" type="text" value="${escapeHtml(current)}" required></div>
            <fieldset id="steem-backup-reblogs"><legend>Скачивать ли репосты?</legend>
              <label><input type="radio" name="reblogs" value="yes2" checked> Нет: только посты моего аккаунта</label>
              <label><input type="radio" name="reblogs" value="yes3"> Да: все репосты</label>
            </fieldset>
            <div class="field"><label for="steem-backup-format">Выберите формат сохранения материалов:</label><select id="steem-backup-format" name="contentformat"><option value="Markdown">Markdown</option><option value="HTML">HTML</option></select></div>
            <button type="submit">Запуск</button>
            <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
          </fieldset>
        </form>
      </section>`;
    await bindSteemBackupForm(chain);
    setStatus('Steem backup готов: экспорт выполняется локально через public RPC без backend.', 'ok');
  }

  async function bindHiveBackupForm(chain) {
    const form = document.getElementById('hive-backup-form');
    if (!form) return;
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const account = normalizeAccountInput(chain, data.get('user'), 'Hive login');
      const includeReblogs = String(data.get('reblogs') || 'yes2');
      const format = String(data.get('contentformat') || 'Markdown') === 'HTML' ? 'HTML' : 'Markdown';
      setOperationResult(form, `Загружаю публичные посты @${account} через Hive RPC...`, 'info');
      try {
        const allPosts = await loadSteemBackupPosts(chain, account);
        const posts = filterSteemBackupPosts(allPosts, account, includeReblogs);
        if (!posts.length) throw new Error('Публичные посты для выбранного режима не найдены.');
        const body = posts.map((post) => formatSteemBackupPost(post, format)).join(format === 'HTML' ? '\n<hr>\n' : '\n---\n');
        const text = format === 'HTML' ? `<!doctype html>\n<html lang="ru"><meta charset="utf-8"><title>Hive backup ${escapeHtml(account)}</title><body>\n${body}\n</body></html>` : body;
        const safeAccount = safeSteemBackupFilenamePart(account);
        const extension = format === 'HTML' ? 'html' : 'md';
        downloadTextFile(`hive-posts-${safeAccount}.${extension}`, text);
        setOperationResult(form, `Готово: подготовлено ${posts.length} записей. Файл скачан локально в браузере; данные и ключи не отправлялись на сервер.`, 'ok');
      } catch (error) {
        setOperationResult(form, profiles.formatError(error), 'error');
      }
    });
  }

  async function renderHiveBackup(chain, account) {
    const current = account || auth.getCurrentLogin(chain) || chain.defaultAccount || '';
    appEl.innerHTML = `
      <section class="panel hive-backup-panel">
        <h2>Бекап постов</h2>
        <p>Static v3 сохраняет резервную копию публичных постов локально в браузере. Старый платный PHP-сервис просил отправить 0.5 HBD или 1 HIVE с memo posts и создавал server-side archive после проверки платежа; здесь backend-архив, оплата и серверное хранение не восстанавливаются.</p>
        <p class="notice">Можно скачать только записи, доступные публичной Hive RPC-ноде. Приватные ключи, SJCL/localStorage и аккаунтные секреты не читаются и не экспортируются.</p>
        <form id="hive-backup-form" class="stacked-form">
          <fieldset>
            <legend>Список действий</legend>
            <ol>
              <li>Введите логин Hive без символа @.</li>
              <li>Выберите, включать ли репосты.</li>
              <li>Выберите формат сохранения материалов.</li>
              <li>Нажмите «Запуск» — файл будет создан только в вашем браузере.</li>
            </ol>
            <div class="field"><label for="hive-backup-user">Имя пользователя (логин) на Hive (Без @):</label><input id="hive-backup-user" name="user" type="text" value="${escapeHtml(current)}" required></div>
            <fieldset id="hive-backup-reblogs"><legend>Скачивать ли репосты?</legend>
              <label><input type="radio" name="reblogs" value="yes2" checked> Нет: только посты моего аккаунта</label>
              <label><input type="radio" name="reblogs" value="yes3"> Да: все репосты</label>
            </fieldset>
            <div class="field"><label for="hive-backup-format">Выберите формат сохранения материалов:</label><select id="hive-backup-format" name="contentformat"><option value="Markdown">Markdown</option><option value="HTML">HTML</option></select></div>
            <button type="submit">Запуск</button>
            <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
          </fieldset>
        </form>
      </section>`;
    await bindHiveBackupForm(chain);
    setStatus('Hive backup готов: экспорт выполняется локально через public RPC без backend.', 'ok');
  }

  function renderServicePlaceholder(chain, app) {
    const details = {
      registration: 'Регистрация VIZ пока требует отдельной безопасной формы и проверки ключей.',
      calculator: `${chain.title}: калькулятор пока недоступен для этой сети.`,
      manage: `${chain.title}: управление аккаунтом пока недоступно для этой сети.`,
      проводник: `${chain.title}: просмотр блоков и транзакций пока недоступен для этой сети.`,
      import: 'Импорт статьи пока недоступен. Вставьте текст вручную в редактор.',
      escrow: 'Escrow пока недоступен.',
      'instant-view': 'Instant View пока недоступен.',
      swap: `${chain.title}: обмен пока недоступен для этой сети.`,
      register: `${chain.title}: регистрация аккаунта пока недоступна для этой сети.`,
      activities: 'Активности в старой версии собирались backend-агрегацией. В v3 используйте историю аккаунта и фильтр операций; серверная агрегация намеренно удалена.',
      api: 'Старые PHP API-страницы заменены прямыми публичными RPC-запросами браузера. Сырые JSON-данные доступны в предпросмотрах операций и проводнике.',
      backup: 'Backup в v3 выполняется через раздел История: загрузите аккаунт, отфильтруйте операции и скопируйте JSON/табличные данные без backend.',
      help: 'v3 — статическая локальная версия: выберите блокчейн, аккаунт и приложение. Операции сначала показывают preview и JSON, затем требуют явного подтверждения отправки.',
      polls: 'Legacy polls завязаны на custom_json/публичные операции. В v3 они показаны как безопасный статический раздел; отправка без отдельной формы не выполняется.',
      referrers: 'Реферальные рейтинги старой версии зависели от backend. В v3 они оставлены как non-goal, чтобы не возвращать серверную зависимость.',
      top: 'Топы старой версии строились сервером. В v3 используйте профили, историю и публичные проводники без backend.dpos.space.',
      'witnesses-rewards': 'Расчёты witness rewards были backend-only. В v3 оставлен справочный раздел без скрытых серверных запросов.',
      analytics: 'Аналитика старой версии зависела от backend/API агрегации. v3 сохраняет только локальные и публичные RPC-сценарии.',
      'custom-generator': 'Генератор custom_json требует отдельной точной схемы операции. v3 не отправляет произвольный JSON без безопасной формы подтверждения.',
      projects: 'Проектные каталоги/рейтинги старой версии зависели от backend. В v3 этот раздел справочный.',
      search: 'Для поиска используйте поля аккаунта, проводник блока/транзакции и прямые hash-маршруты v3.',
      vmp: 'VMP оставлен как справочный статический раздел: серверные расчёты и backend-интеграции удалены.',
      'voice-import': 'Voice import в старой версии зависел от внешнего импорта. В v3 подготовьте текст локально и перенесите его в редактор.'
    };

    if (chain.id === 'hive' || chain.id === 'steem') {
      details.import = `${chain.title}: импорт URL/текста в черновик редактора.`;
      details['instant-view'] = `${chain.title}: предпросмотр очищенного HTML/Markdown.`;
    }

    appEl.innerHTML = `
      <section class="panel">
        <h2>${escapeHtml(chain.title)}: ${escapeHtml(app.title)}</h2>
        <p>${escapeHtml(details[app.id] || app.description || 'Раздел требует отдельного подтверждённого сценария.')}</p>
        <p class="notice">Раздел не отправляет операции без отдельной формы и подтверждения.</p>
      </section>`;
    setStatus(`${chain.title}: ${app.title} пока недоступен.`, 'info');
  }

  function isCosmosChain(chain) {
    return chain.id === 'minter' || chain.id === 'decimal';
  }

  function normalizeCoinInput(value, label) {
    return broadcast.validateCoinSymbol(value, label);
  }

  function normalizeAmountInput(value, label) {
    return broadcast.validateAmount(value, label);
  }


  function unwrapMinterData(value) {
    if (!value || typeof value !== 'object') return value;
    if (Object.prototype.hasOwnProperty.call(value, 'data')) return unwrapMinterData(value.data);
    return value;
  }

  function formatMinterAmount(value, digits = 3) {
    const num = Number(value);
    if (!Number.isFinite(num)) return String(value || '0');
    return num < 0.001 && num > 0 ? num.toFixed(8) : num.toFixed(digits);
  }

  function isValidChainAddress(chain, value) {
    try {
      broadcast.validateAddress(chain, value, `${chain.title} address`);
      return true;
    } catch (_error) {
      return false;
    }
  }

  function decryptCurrentSeed(chain, user) {
    if (!user || !user.seed || !global.sjcl || typeof global.sjcl.decrypt !== 'function') return '';
    const login = auth.getUserLogin(user);
    const sourceChain = user.importFrom || chain.id;
    if (!login) return '';
    try {
      return global.sjcl.decrypt(`dpos.space_${sourceChain}_${login}_seed`, user.seed);
    } catch (_error) {
      return '';
    }
  }

  function deriveSeedWalletAddress(chain, user) {
    const type = auth.getUserType(user);
    if (type === 'bip.to' && user && user.address) return broadcast.validateAddress(chain, user.address, `${chain.title} address`);
    const seed = decryptCurrentSeed(chain, user);
    if (!seed) return '';
    if (chain.id === 'minter') {
      if (!global.minterWallet || typeof global.minterWallet.walletFromMnemonic !== 'function') return '';
      const wallet = global.minterWallet.walletFromMnemonic(seed);
      if (wallet && typeof wallet.getAddressString === 'function') return broadcast.validateAddress(chain, wallet.getAddressString(), 'Minter address');
    }
    if (chain.id === 'decimal') {
      if (!global.DecimalSDK || typeof global.DecimalSDK.Wallet !== 'function') return '';
      const wallet = new global.DecimalSDK.Wallet(seed);
      if (wallet && wallet.address) return broadcast.validateAddress(chain, wallet.address, 'Decimal address');
    }
    return '';
  }

  function resolveSeedWalletAddress(chain, account) {
    const current = auth.getCurrentUser(chain);
    const login = auth.getUserLogin(current);
    const value = String(account || '').trim();
    if (value && isValidChainAddress(chain, value) && value !== login) return broadcast.validateAddress(chain, value, `${chain.title} address`);
    const derived = deriveSeedWalletAddress(chain, current);
    if (derived) return derived;
    return broadcast.validateAddress(chain, value, `${chain.title} address`);
  }

  async function loadMinterWalletData(chain, account) {
    const address = resolveSeedWalletAddress(chain, account);
    const [addressData, delegationsData, transactionsData] = await Promise.all([
      fetchJsonText(`${chain.explorerBase}/addresses/${encodeURIComponent(address)}`, 'Minter address API'),
      fetchJsonText(`${chain.explorerBase}/addresses/${encodeURIComponent(address)}/delegations`, 'Minter delegations API').catch((error) => ({ _error: error.message, data: [] })),
      fetchJsonText(`${chain.explorerBase}/addresses/${encodeURIComponent(address)}/transactions?page=1`, 'Minter transactions API').catch((error) => ({ _error: error.message, data: [] }))
    ]);
    const addressPayload = unwrapMinterData(addressData) || {};
    const delegationsPayload = unwrapMinterData(delegationsData) || [];
    const transactionsPayload = unwrapMinterData(transactionsData) || [];
    return {
      address,
      balances: addressPayload.balances || [],
      delegations: Array.isArray(delegationsPayload) ? delegationsPayload : [],
      transactions: Array.isArray(transactionsPayload) ? transactionsPayload.slice(0, 20) : [],
      delegationsError: delegationsData && delegationsData._error,
      transactionsError: transactionsData && transactionsData._error
    };
  }

  function renderMinterWalletBalances(data) {
    const balances = Array.isArray(data.balances) ? data.balances : [];
    const balanceRows = balances.map((item) => {
      const coin = item.coin || {};
      const symbol = coin.symbol || item.symbol || item.coin || '';
      const type = coin.type || item.type || '';
      const rawAmount = item.amount || item.value || 0;
      const amount = formatMinterAmount(rawAmount, Number(rawAmount) < 0.001 ? 8 : 3);
      const actions = `<button type="button" data-minter-action="send" data-minter-amount="${escapeHtml(amount)}" data-minter-coin="${escapeHtml(symbol || 'BIP')}">Перевод</button> <button type="button" data-minter-action="swap" data-minter-amount="${escapeHtml(amount)}" data-minter-coin="${escapeHtml(symbol || 'BIP')}">Обмен</button> <button type="button" data-minter-action="liquidity" data-minter-amount="${escapeHtml(amount)}" data-minter-coin="${escapeHtml(symbol || 'BIP')}">Pool</button>${type === 'coin' ? ` <button type="button" data-minter-action="delegate" data-minter-amount="${escapeHtml(amount)}" data-minter-coin="${escapeHtml(symbol || 'BIP')}">Stake</button>` : ''}`;
      return `<tr><td>${escapeHtml(symbol)}</td><td>${escapeHtml(amount)}</td><td>${escapeHtml(type || 'coin/token')}</td><td>${actions}</td></tr>`;
    }).join('');

    const delegations = data.delegations.map((item) => {
      const coin = item.coin || {};
      const validator = item.validator || {};
      const statusMap = { 0: 'Отключён', 1: 'Кандидат', 2: 'Валидатор' };
      const validatorKey = validator.public_key || item.public_key || '';
      const coinSymbol = coin.symbol || item.symbol || '';
      const stakeAmount = formatMinterAmount(item.value || item.stake || 0);
      const quickUnbond = `<button type="button" data-minter-action="unbond" data-minter-validator="${escapeHtml(validatorKey)}" data-minter-amount="${escapeHtml(stakeAmount)}" data-minter-coin="${escapeHtml(coinSymbol || 'BIP')}">Анбонд</button>`;
      return `<tr><td><code>${escapeHtml(validatorKey)}</code><br>${escapeHtml(validator.name || '')}</td><td>${escapeHtml(statusMap[validator.status] || '')}</td><td>${escapeHtml(stakeAmount)} ${escapeHtml(coinSymbol)}</td><td>${escapeHtml(formatMinterAmount(item.bip_value || 0))} BIP</td><td>${item.is_waitlisted ? 'Да' : 'Нет'}</td><td>${quickUnbond}</td></tr>`;
    }).join('');

    return `<article class="card"><h3>Адрес</h3><p>${accountLink(chains.minter, data.address)}</p><p><button type="button" id="minter-copy-address">Копировать адрес</button></p></article>
      <article class="card"><h3>Балансы</h3>${balanceRows ? `<div class="table-wrap"><table aria-label="Балансы Minter"><caption>Балансы Minter</caption><thead><tr><th scope="col">Монета</th><th scope="col">Сумма</th><th scope="col">Тип</th><th scope="col">Доступные действия</th></tr></thead><tbody>${balanceRows}</tbody></table></div>` : '<p class="muted">Балансы не найдены.</p>'}</article>
      <article class="card"><h3>Делегированные монеты</h3>${data.delegationsError ? `<p class="muted">Делегирования сейчас не загрузились: ${escapeHtml(data.delegationsError)}</p>` : ''}${delegations ? `<div class="table-wrap"><table aria-label="Делегированные монеты Minter"><caption>Делегированные монеты</caption><thead><tr><th scope="col">Валидатор</th><th scope="col">Статус</th><th scope="col">Stake</th><th scope="col">В BIP</th><th scope="col">В ожидании</th><th scope="col">Действие</th></tr></thead><tbody>${delegations}</tbody></table></div>` : '<p class="muted">Делегированных монет нет.</p>'}</article>
      <article class="card"><h3>Последние транзакции</h3>${data.transactionsError ? `<p class="muted">История сейчас не загрузилась: ${escapeHtml(data.transactionsError)}</p>` : renderTransactionsTable(data.transactions, chains.minter, { caption: 'Последние транзакции Minter', emptyText: 'Транзакции не найдены.' })}</article>`;
  }

  function renderMinterWalletForms(chain) {
    return `<details id="minter-send-details" class="operation-details"><summary>Перевод</summary><form id="minter-send-form" class="stacked-form"><fieldset>
      <legend>Minter: перевод</legend>
      <div class="field"><label for="minter-send-to">Адрес получателя</label><input id="minter-send-to" name="to" type="text" required placeholder="Mx..."></div>
      <div class="field"><label for="minter-send-amount">Сумма</label><input id="minter-send-amount" name="amount" type="text" required placeholder="1.000"> <button type="button" id="minter-send-max-button" data-fill-target="minter-send-amount" data-fill-value="" hidden>Максимум</button></div>
      <div class="field"><label for="minter-send-coin">Монета</label><input id="minter-send-coin" name="coin" type="text" required value="BIP"></div>
      <div class="field"><label for="minter-send-memo">Memo</label><input id="minter-send-memo" name="memo" type="text"></div>
      <div class="field"><label for="minter-send-gas">Монета газа</label><input id="minter-send-gas" name="gasCoin" type="text" value="BIP"></div>
      <button type="submit" name="intent" value="preview">Проверить перевод</button><button type="submit" name="intent" value="send">Отправить перевод в сеть</button>
      <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
    </fieldset></form></details>
    <details id="minter-delegate-details" class="operation-details"><summary>Stake / unbond</summary><form id="minter-delegate-form" class="stacked-form"><fieldset>
      <legend>Minter: stake</legend>
      <div class="field"><label for="minter-validator">Публичный ключ валидатора</label><input id="minter-validator" name="validator" type="text" required placeholder="Mp..."></div>
      <div class="field"><label for="minter-delegate-amount">Сумма</label><input id="minter-delegate-amount" name="amount" type="text" required placeholder="1.000"> <button type="button" id="minter-delegate-max-button" data-fill-target="minter-delegate-amount" data-fill-value="" hidden>Максимум</button></div>
      <div class="field"><label for="minter-delegate-coin">Монета</label><input id="minter-delegate-coin" name="coin" type="text" required value="BIP"></div>
      <div class="field"><label for="minter-delegate-mode">Операция</label><select id="minter-delegate-mode" name="mode"><option value="delegate">Делегировать</option><option value="unbond">Unbond</option></select></div>
      <button type="submit" name="intent" value="preview">Проверить stake</button><button type="submit" name="intent" value="send">Отправить stake в сеть</button>
      <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
    </fieldset></form></details>
    <article class="card"><h3>Checks</h3><p class="muted">В этом кошельке доступны формы, подтверждённые старым интерфейсом. Для checks используйте готовую транзакцию в разделе «Отправка», если она уже подписана внешним кошельком.</p></article>
    ${minterSwapForms()}`;
  }

  async function renderMinterWallet(chain, account) {
    appEl.innerHTML = '<section class="panel wallet-minter"><h2>Minter: кошелёк</h2><p>Загружаю балансы, делегирования и последние транзакции...</p></section>';
    setStatus(`Загружаю Minter кошелёк: ${account}...`, 'loading');
    await loadScript(chain.cryptoPath);
    if (chain.walletPath) await loadScript(chain.walletPath);
    if (chain.libraryPath) await loadScript(chain.libraryPath);
    const data = await loadMinterWalletData(chain, account);
    appEl.innerHTML = `<section class="panel wallet-minter">
      <h2>Minter: кошелёк ${escapeHtml(data.address)}</h2>
      <p><strong>Доступ к отправке:</strong> ${escapeHtml(keyStatusText(auth.getKeyStatus(chain, auth.getCurrentUser(chain))))}</p>
      ${renderMinterWalletBalances(data)}
      <h3>Операции</h3>
      ${renderMinterWalletForms(chain)}
    </section>`;
    const copyButton = document.getElementById('minter-copy-address');
    if (copyButton) {
      copyButton.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(data.address);
          setStatus('Minter address copied.', 'ok');
        } catch (error) {
          setStatus('Не удалось скопировать адрес автоматически.', 'error');
        }
      });
    }
    bindMinterWalletForms(chain);
    bindMinterQuickActions(appEl);
    bindMaxButtons(appEl);
    setStatus(`Minter кошелёк ${data.address} загружен.`, 'ok');
  }


  function unwrapDecimalData(value) {
    if (!value || typeof value !== 'object') return value;
    if (Object.prototype.hasOwnProperty.call(value, 'Result')) return unwrapDecimalData(value.Result);
    if (Object.prototype.hasOwnProperty.call(value, 'result')) return unwrapDecimalData(value.result);
    if (Object.prototype.hasOwnProperty.call(value, 'data')) return unwrapDecimalData(value.data);
    return value;
  }

  function formatDecimalAmount(value, digits = 3) {
    if (value === undefined || value === null || value === '') return '0';
    const raw = String(value).trim();
    if (/^\d+$/.test(raw) && raw.length > 12) {
      try {
        const bi = BigInt(raw);
        const base = 10n ** 18n;
        const intPart = bi / base;
        const fracPart = bi % base;
        const frac = fracPart.toString().padStart(18, '0').slice(0, digits === 8 ? 8 : 6).replace(/0$/, '');
        return frac ? `${intPart}.${frac}` : intPart.toString();
      } catch (error) { /* fall back below */ }
    }
    const num = Number(raw);
    if (!Number.isFinite(num)) return raw || '0';
    return num < 0.001 && num > 0 ? num.toFixed(8) : num.toFixed(digits);
  }

  function decimalPayloadList(payload, keys) {
    const value = unwrapDecimalData(payload);
    if (Array.isArray(value)) return value;
    for (const key of keys) {
      if (value && Array.isArray(value[key])) return value[key];
    }
    if (value && Array.isArray(value.items)) return value.items;
    return [];
  }

  function getDecimalStakeAddress(chain, address) {
    try {
      const user = auth.getCurrentUser(chain);
      if (!user || !user.seed || auth.getUserType(user) === 'bip.to' || !global.DecimalSDK || typeof global.DecimalSDK.Wallet !== 'function') return address;
      const seed = decryptCurrentSeed(chain, user);
      if (!seed) return address;
      const wallet = new global.DecimalSDK.Wallet(seed);
      if (wallet.address && String(wallet.address).toLowerCase() !== String(address).toLowerCase()) return address;
      return wallet.evmAddress || address;
    } catch (error) {
      return address;
    }
  }

  async function loadDecimalWalletData(chain, account) {
    const address = resolveSeedWalletAddress(chain, account);
    const stakeAddress = getDecimalStakeAddress(chain, address);
    const api = chain.apiBase || 'https://api.decimalchain.com/api/v1';
    const gate = chain.gateUrl || 'https://mainnet-gate.decimalchain.com/api/';
    const [balancesData, stakesCoinsData, stakesNftsData, transactionsData, rewardsData, nftsData] = await Promise.all([
      fetchJsonText(`${api}/addresses/${encodeURIComponent(address)}/balances`, 'Decimal balances API').catch((error) => ({ _error: error.message })),
      fetchJsonText(`${api}/validators/wallet/${encodeURIComponent(stakeAddress)}/stakes/coins`, 'Decimal stakes coins API').catch((error) => ({ _error: error.message })),
      fetchJsonText(`${api}/validators/wallet/${encodeURIComponent(stakeAddress)}/stakes/nfts`, 'Decimal stakes NFTs API').catch((error) => ({ _error: error.message })),
      fetchJsonText(`${api}/txs/txs-by-address/${encodeURIComponent(address)}?limit=10&offset=0`, 'Decimal history API').catch((error) => ({ _error: error.message })),
      fetchJsonText(`${api}/rewards/${encodeURIComponent(address)}?limit=20&offset=0`, 'Decimal rewards API').catch((error) => ({ _error: error.message })),
      fetchJsonText(`${gate.replace(/\/$/, '')}/address/${encodeURIComponent(address)}/nfts?limit=20&offset=0`, 'Decimal SDK gateway NFTs API').catch((error) => ({ _error: error.message }))
    ]);
    return {
      address,
      balances: decimalPayloadList(balancesData, ['balances', 'balance']),
      coinStakes: decimalPayloadList(stakesCoinsData, ['items', 'stakes']),
      nftStakes: decimalPayloadList(stakesNftsData, ['items', 'stakes', 'nfts']),
      transactions: decimalPayloadList(transactionsData, ['txs', 'Txs']).slice(0, 20),
      rewards: decimalPayloadList(rewardsData, ['rewards', 'items']).slice(0, 20),
      nfts: decimalPayloadList(nftsData, ['tokens', 'nfts', 'items']).slice(0, 20),
      errors: {
        balances: balancesData && balancesData._error,
        coinStakes: stakesCoinsData && stakesCoinsData._error,
        nftStakes: stakesNftsData && stakesNftsData._error,
        transactions: transactionsData && transactionsData._error,
        rewards: rewardsData && rewardsData._error,
        nfts: nftsData && nftsData._error
      }
    };
  }

  function decimalNftId(item) {
    const nested = item.nft && typeof item.nft === 'object' ? item.nft : null;
    const raw = item.tokenId || item.token_id || item.nftTokenId || item.nft_token_id || item.nftId || item.nft_id || (nested && (nested.tokenId || nested.token_id || nested.nftId || nested.nft_id)) || '';
    const tokenId = String(raw).trim();
    if (/^\d+$/.test(tokenId)) return tokenId;
    const genericId = String(item.id || (nested && nested.id) || '').trim();
    if (/^\d+$/.test(genericId)) return genericId;
    if (decimalKnownNftCollectionAddress(item.collection || item.nftCollection || item.collectionName || item.collection_name) && (!tokenId || /^[0-9a-fA-F]{32,}$/.test(tokenId) || /^[0-9a-fA-F]{32,}$/.test(genericId))) return '1';
    return tokenId;
  }

  function decimalNftCollection(item) {
    const collectionObject = item.collection && typeof item.collection === 'object' ? item.collection : null;
    const directAddress = item.collectionAddress || item.collection_address || item.contractAddress || item.contract_address || item.contract || item.nftCollectionAddress || item.nft_collection_address || (collectionObject && (collectionObject.address || collectionObject.id || collectionObject.contractAddress || collectionObject.contract)) || '';
    if (directAddress) return String(directAddress).trim();
    const genericAddress = String(item.address || '').trim();
    if (isDecimalContractAddress(genericAddress)) return genericAddress;
    const collection = item.collection || item.nftCollection || item.collectionId || item.collection_id || '';
    return decimalNftCollectionInputAddress(collection) || String(collection).trim();
  }

  function decimalNftCollectionName(item) {
    const collectionObject = item.collection && typeof item.collection === 'object' ? item.collection : null;
    return String(item.collectionName || item.collection_name || item.collectionTitle || item.collection_title || (collectionObject && (collectionObject.name || collectionObject.symbol)) || (/^0x[0-9a-fA-F]{40}$/.test(String(item.collection || '').trim()) ? '' : item.collection) || item.nftCollection || '').trim();
  }

  function isDecimalContractAddress(value) {
    return /^0x[0-9a-fA-F]{40}$/.test(String(value || '').trim());
  }

  function decimalKnownNftCollectionAddress(name) {
    return ({
      Space_Warriors_Happy_New_Year: '0x97ef3fdb3f47a6114429e2f95481b3f926d67c6d'
    })[String(name || '').trim()] || '';
  }

  function decimalNftCollectionInputAddress(value) {
    const input = String(value || '').trim();
    return isDecimalContractAddress(input) ? input : decimalKnownNftCollectionAddress(input);
  }

  function decimalNftSubgraphUrl(chain) {
    return chain.subgraphUrl || 'https://mainnet-thegraph.decimalchain.com/subgraphs/name/contract-center-2';
  }

  async function resolveDecimalNftCollectionAddress(chain, collection, nftId) {
    const input = String(collection || '').trim();
    if (isDecimalContractAddress(input)) return input;
    if (!input) throw new Error('Нужна коллекция/contract address NFT. Выберите NFT из списка или строки таблицы.');
    const tokenId = String(nftId || '').trim();
    const escaped = input.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const tokenFilter = tokenId && /^\d+$/.test(tokenId) ? `, tokenId: "${tokenId.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"` : '';
    const query = `{
      nfttokens(where:{collection_: {name: "${escaped}"}${tokenFilter}}, first: 1) { collection { address name tokenType } tokenId }
      nftcollections(where:{name: "${escaped}"}, first: 1) { address name tokenType }
    }`;
    const known = decimalKnownNftCollectionAddress(input);
    try {
      const response = await fetchJsonText(decimalNftSubgraphUrl(chain), 'Decimal NFT subgraph', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      });
      const data = response && response.data ? response.data : {};
      const tokenCollection = data.nfttokens && data.nfttokens[0] && data.nfttokens[0].collection;
      const directCollection = data.nftcollections && data.nftcollections[0];
      const resolved = (tokenCollection && tokenCollection.address) || (directCollection && directCollection.address) || '';
      if (isDecimalContractAddress(resolved)) return resolved;
    } catch (error) {
      if (known) return known;
      throw error;
    }
    if (known) return known;
    throw new Error(`Коллекция NFT "${input}" не является contract address 0x и не найдена в публичном Decimal subgraph. Откройте NFT в explorer и вставьте адрес контракта коллекции вручную.`);
  }

  function decimalNftTitle(item) {
    return String(item.title || item.name || item.creator || item.description || '').trim();
  }

  function decimalNftLabel(item) {
    const collection = decimalNftCollection(item);
    const id = decimalNftId(item);
    const title = decimalNftTitle(item);
    const collectionLabel = isDecimalContractAddress(collection) ? collection : (decimalNftCollectionName(item) || collection);
    const identity = [collectionLabel, id].filter(Boolean).join('/');
    return identity || title || 'NFT';
  }

  function decimalNftOptions(data) {
    const nfts = Array.isArray(data && data.nfts) ? data.nfts : [];
    return nfts.map((item) => {
      const id = decimalNftId(item) || decimalNftLabel(item);
      const collection = decimalNftCollection(item);
      if (!id) return '';
      const label = decimalNftLabel(item);
      const title = decimalNftTitle(item);
      const optionText = title && title !== label ? `${label} — ${title}` : label;
      return `<option value="${escapeHtml(id)}" data-decimal-nft-collection="${escapeHtml(collection)}">${escapeHtml(optionText)}</option>`;
    }).filter(Boolean).join('');
  }

  function renderDecimalWalletBalances(data) {
    const balances = Array.isArray(data.balances) ? data.balances : [];
    const balanceRows = balances.map((item) => {
      const symbol = String(item.denom || item.symbol || item.ticker || item.coin || item.currency || '').toUpperCase();
      const amount = formatDecimalAmount(item.amount ?? item.value ?? 0, Number(item.amount || item.value || 0) < 0.001 ? 8 : 3);
      const type = item.type || (item.coin && item.coin.type) || 'coin/token';
      const actions = `<button type="button" data-decimal-action="send" data-decimal-amount="${escapeHtml(amount)}" data-decimal-coin="${escapeHtml(symbol || 'DEL')}">Перевод</button> <button type="button" data-decimal-action="delegate" data-decimal-coin="${escapeHtml(symbol || 'DEL')}">Stake</button> <button type="button" data-decimal-action="convert" data-decimal-coin="${escapeHtml(symbol || 'DEL')}">Convert</button>`;
      return `<tr><td>${escapeHtml(symbol)}</td><td>${escapeHtml(amount)}</td><td>${escapeHtml(type)}</td><td>${actions}</td></tr>`;
    }).join('');

    const coinStakeRows = [];
    (data.coinStakes || []).forEach((group) => {
      const validator = group.validator || {};
      const validatorAddress = validator.address || group.validatorId || group.validator_id || group.address || '';
      const validatorName = validator.name || validator.details || group.name || '';
      const stakes = Array.isArray(group.items) ? group.items : (Array.isArray(group.stakes) ? group.stakes : [group]);
      stakes.forEach((stake) => {
        const coinInfo = stake.coin || stake.token || {};
        const symbol = String(stake.symbol || stake.coin_symbol || stake.denom || coinInfo.symbol || coinInfo.ticker || stake.currency || '').toUpperCase();
        const tokenAddress = stake.address || stake.tokenAddress || coinInfo.address || '';
        const tokenTicker = symbol || (tokenAddress ? `${String(tokenAddress).slice(0, 10)}…` : 'DEL');
        const amount = formatDecimalAmount(stake.delegatedCoins || stake.amount || stake.value || 0);
        if (!symbol && !amount && !tokenAddress) return;
        const quickUnbond = `<button type="button" data-decimal-action="unbond" data-decimal-validator="${escapeHtml(validatorAddress)}" data-decimal-amount="${escapeHtml(amount)}" data-decimal-coin="${escapeHtml(tokenTicker)}">Анбонд</button>`;
        coinStakeRows.push(`<tr><td><code>${escapeHtml(validatorAddress)}</code><br>${escapeHtml(validatorName)}</td><td>${escapeHtml(amount)} ${escapeHtml(tokenTicker)}</td><td>${escapeHtml(tokenTicker)}</td><td>${quickUnbond}</td></tr>`);
      });
    });

    const nftStakeRows = (data.nftStakes || []).map((stake) => {
      const validator = stake.validator || {};
      const validatorAddress = stake.validatorId || validator.address || stake.address || '';
      const validatorName = validator.details || validator.name || '';
      const nftLabel = decimalNftLabel(stake);
      const nftId = decimalNftId(stake) || nftLabel;
      const nftCollection = decimalNftCollection(stake);
      const nftAmount = stake.amount || stake.quantity || stake.value || 1;
      const quickUnbond = `<button type="button" data-decimal-nft-action="unbond" data-decimal-nft-id="${escapeHtml(nftId)}" data-decimal-nft-collection="${escapeHtml(nftCollection)}" data-decimal-nft-amount="${escapeHtml(String(nftAmount))}" data-decimal-validator="${escapeHtml(validatorAddress)}">Анбонд NFT</button>`;
      return `<tr><td>${escapeHtml(nftLabel || 'NFT')}</td><td><code>${escapeHtml(validatorAddress)}</code><br>${escapeHtml(validatorName)}</td><td>${escapeHtml(validator.status || stake.status || '')}</td><td>${quickUnbond}</td></tr>`;
    }).join('');

    const rewardRows = (data.rewards || []).map((item) => {
      const amount = formatDecimalAmount(item.amount || item.value || item.reward || 0);
      const coin = String(item.coin || item.denom || item.symbol || 'DEL').toUpperCase();
      const validator = item.validator || item.validatorId || item.address || '';
      return `<tr><td>${escapeHtml(amount)} ${escapeHtml(coin)}</td><td>${escapeHtml(validator)}</td><td>${escapeHtml(history.formatDate(item.timestamp || item.time || item.created_at || ''))}</td></tr>`;
    }).join('');

    const nftRows = (data.nfts || []).map((item) => {
      const nftId = decimalNftId(item) || decimalNftLabel(item);
      const nftCollection = decimalNftCollection(item);
      const nftAmount = item.amount || item.quantity || item.value || 1;
      const title = decimalNftTitle(item);
      const quickDelegate = `<button type="button" data-decimal-nft-action="delegate" data-decimal-nft-id="${escapeHtml(nftId)}" data-decimal-nft-collection="${escapeHtml(nftCollection)}" data-decimal-nft-amount="${escapeHtml(String(nftAmount))}" data-decimal-nft-title="${escapeHtml(title)}">Stake NFT</button>`;
      return `<tr><td>${escapeHtml(decimalNftCollection(item))}</td><td>${escapeHtml(nftId)}</td><td>${escapeHtml(title)}</td><td>${quickDelegate}</td></tr>`;
    }).join('');

    return `<article class="card"><h3>Адрес</h3><p>${accountLink(chains.decimal, data.address)}</p><p><button type="button" id="decimal-copy-address">Копировать адрес</button></p></article>
      <article class="card"><h3>Балансы</h3>${data.errors.balances ? `<p class="muted">Балансы сейчас не загрузились: ${escapeHtml(data.errors.balances)}</p>` : ''}${balanceRows ? `<div class="table-wrap"><table aria-label="Балансы Decimal"><caption>Балансы Decimal</caption><thead><tr><th scope="col">Монета/токен</th><th scope="col">Сумма</th><th scope="col">Тип</th><th scope="col">Доступные действия</th></tr></thead><tbody>${balanceRows}</tbody></table></div>` : '<p class="muted">Балансы не найдены.</p>'}</article>
      <article class="card"><h3>Stake монет</h3>${data.errors.coinStakes ? `<p class="muted">Stake монет сейчас не загрузился: ${escapeHtml(data.errors.coinStakes)}</p>` : ''}${coinStakeRows.length ? `<div class="table-wrap"><table aria-label="Stake монет Decimal"><caption>Stake монет Decimal</caption><thead><tr><th scope="col">Валидатор</th><th scope="col">Stake</th><th scope="col">Тикер токена</th><th scope="col">Действие</th></tr></thead><tbody>${coinStakeRows.join('')}</tbody></table></div>` : '<p class="muted">Делегированных монет нет.</p>'}</article>
      <article class="card"><h3>NFT stake</h3>${data.errors.nftStakes ? `<p class="muted">NFT stake сейчас не загрузился: ${escapeHtml(data.errors.nftStakes)}</p>` : ''}${nftStakeRows ? `<div class="table-wrap"><table aria-label="NFT stake Decimal"><caption>NFT stake Decimal</caption><thead><tr><th scope="col">NFT</th><th scope="col">Валидатор</th><th scope="col">Статус</th><th scope="col">Действие</th></tr></thead><tbody>${nftStakeRows}</tbody></table></div>` : '<p class="muted">NFT stake не найден.</p>'}</article>
      <article class="card"><h3>Начисления</h3>${data.errors.rewards ? `<p class="muted">Начисления сейчас не загрузились: ${escapeHtml(data.errors.rewards)}</p>` : ''}${rewardRows ? `<div class="table-wrap"><table aria-label="Начисления Decimal"><caption>Начисления Decimal</caption><thead><tr><th scope="col">Сумма</th><th scope="col">Валидатор</th><th scope="col">Дата</th></tr></thead><tbody>${rewardRows}</tbody></table></div>` : '<p class="muted">Начисления не найдены.</p>'}</article>
      <article class="card"><h3>NFT</h3>${data.errors.nfts ? `<p class="muted">NFT сейчас не загрузились: ${escapeHtml(data.errors.nfts)}</p>` : ''}${nftRows ? `<div class="table-wrap"><table aria-label="NFT Decimal"><caption>NFT Decimal</caption><thead><tr><th scope="col">Коллекция</th><th scope="col">ID</th><th scope="col">Описание</th><th scope="col">Доступные действия</th></tr></thead><tbody>${nftRows}</tbody></table></div>` : '<p class="muted">NFT не найдены.</p>'}</article>
      <article class="card"><h3>Последние транзакции</h3>${data.errors.transactions ? `<p class="muted">История сейчас не загрузилась: ${escapeHtml(data.errors.transactions)}</p>` : renderTransactionsTable(data.transactions, chains.decimal, { caption: 'Последние транзакции Decimal', emptyText: 'Транзакции не найдены.' })}</article>`;
  }

  function decimalBalanceMaximum(data, symbolOrAddress) {
    const target = String(symbolOrAddress || 'DEL').trim().toUpperCase();
    const targetLower = String(symbolOrAddress || 'DEL').trim().toLowerCase();
    const balances = Array.isArray(data && data.balances) ? data.balances : [];
    for (const item of balances) {
      const coin = item.coin || item.token || {};
      const itemSymbol = String(item.denom || item.denomRaw || item.symbol || item.ticker || item.coin || item.currency || coin.symbol || coin.ticker || '').toUpperCase();
      const itemAddress = String(item.address || item.tokenAddress || item.contract || coin.address || '').toLowerCase();
      if (itemSymbol === target || (itemAddress && itemAddress === targetLower)) return formatDecimalAmount(item.amount ?? item.value ?? 0, 8);
    }
    return '';
  }

  function decimalTokenCacheKey(chain) {
    return `dpos_v3_${chain.id}_coins_index_v1`;
  }

  function decimalTokenIndexFromPayload(payload) {
    const direct = payload || {};
    const directResult = direct.Result || direct.result || (direct.data && (direct.data.Result || direct.data.result));
    if (Array.isArray(directResult)) {
      const first = directResult[0];
      if (first && Array.isArray(first.coins)) return first.coins;
      return directResult;
    }
    const root = unwrapDecimalData(payload);
    if (Array.isArray(root)) return root;
    if (root && Array.isArray(root.coins)) return root.coins;
    if (root && Array.isArray(root.items)) return root.items;
    return [];
  }

  async function loadDecimalTokenIndex(chain) {
    const key = decimalTokenCacheKey(chain);
    const ttl = 24 * 60 * 60 * 1000;
    try {
      const cached = JSON.parse(localStorage.getItem(key) || 'null');
      if (cached && Array.isArray(cached.tokens) && Date.now() - Number(cached.ts || 0) < ttl) return cached.tokens;
    } catch (error) { /* ignore broken cache */ }
    const api = chain.apiBase || 'https://api.decimalchain.com/api/v1';
    const tokens = [];
    const seen = new Set();
    let offset = 0;
    const limit = 1000;
    while (offset < 10000) {
      const payload = await fetchJsonText(`${api}/coins/coins?limit=${limit}&offset=${offset}`, 'Decimal coins search API');
      const coins = decimalTokenIndexFromPayload(payload);
      for (const coin of coins) {
        const symbol = String(coin.symbol || coin.ticker || coin.denom || '').trim().toUpperCase();
        const address = String(coin.address || coin.tokenAddress || coin.contract || '').trim();
        if (!symbol) continue;
        const cacheKey = `${symbol}:${address}`;
        if (seen.has(cacheKey)) continue;
        seen.add(cacheKey);
        tokens.push({ symbol, address, title: String(coin.title || coin.name || '').trim(), decimals: Number(coin.decimals || 18) || 18 });
      }
      if (coins.length < limit) break;
      offset += limit;
    }
    tokens.sort((a, b) => a.symbol.localeCompare(b.symbol));
    try { localStorage.setItem(key, JSON.stringify({ ts: Date.now(), tokens })); } catch (error) { /* cache best-effort */ }
    return tokens;
  }

  async function resolveDecimalConvertAsset(chain, value, label) {
    const raw = String(value || '').trim();
    if (!raw) throw new Error(`${label}: укажите DEL, тикер токена или адрес 0x.`);
    if (raw.toUpperCase() === 'DEL') return { input: raw, resolved: 'DEL', decimals: 18, symbol: 'DEL' };
    if (/^0x[0-9a-fA-F]{40}$/.test(raw)) return { input: raw, resolved: raw, decimals: 18, symbol: raw };
    const tokens = await loadDecimalTokenIndex(chain);
    const hit = tokens.find((item) => item.symbol.toUpperCase() === raw.toUpperCase());
    if (!hit || !/^0x[0-9a-fA-F]{40}$/.test(hit.address)) throw new Error(`${label}: токен ${raw} не найден. Используйте поиск токенов или вставьте адрес 0x.`);
    return { input: raw, resolved: hit.address, decimals: hit.decimals || 18, symbol: hit.symbol };
  }

  function renderDecimalWalletForms(chain, data) {
    const delMax = decimalBalanceMaximum(data, 'DEL');
    const delMaxButton = delMax ? ` <button type="button" data-fill-target="decimal-send-amount" data-fill-value="${escapeHtml(delMax)}">Максимум ${escapeHtml(delMax)} DEL</button>` : '';
    const delStakeMaxButton = delMax ? ` <button type="button" data-fill-target="decimal-delegate-amount" data-fill-value="${escapeHtml(delMax)}">Максимум ${escapeHtml(delMax)} DEL</button>` : '';
    return `<details id="decimal-send-details" class="operation-details"><summary>Перевод DEL / coin / token</summary><form id="decimal-send-form" class="stacked-form"><fieldset>
      <legend>Decimal: перевод DEL / coin / token</legend>
      <div class="field"><label for="decimal-send-to">Адрес получателя</label><input id="decimal-send-to" name="to" type="text" required placeholder="d0..., dx... или 0x..."></div>
      <div class="field"><label for="decimal-send-amount">Сумма</label><input id="decimal-send-amount" name="amount" type="text" required placeholder="1.000">${delMaxButton}</div>
      <div class="field"><label for="decimal-send-coin">Монета/токен</label><input id="decimal-send-coin" name="coin" type="text" required value="DEL"></div>
      <button type="submit" name="intent" value="preview">Проверить перевод</button><button type="submit" name="intent" value="send">Отправить перевод в сеть</button>
      <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
    </fieldset></form></details>
    <details id="decimal-delegate-details" class="operation-details"><summary>Stake / unbond</summary><form id="decimal-delegate-form" class="stacked-form"><fieldset>
      <legend>Decimal: stake / unbond</legend>
      <div class="field"><label for="decimal-validator">Адрес валидатора</label><input id="decimal-validator" name="validator" type="text" required placeholder="0x... или d0valoper..."></div>
      <div class="field"><label for="decimal-delegate-amount">Сумма stake</label><input id="decimal-delegate-amount" name="amount" type="text" required placeholder="1.000">${delStakeMaxButton}</div>
      <div class="field"><label for="decimal-delegate-coin">Монета/токен</label><input id="decimal-delegate-coin" name="coin" type="text" required value="DEL"></div>
      <div class="field"><label for="decimal-delegate-mode">Операция</label><select id="decimal-delegate-mode" name="mode"><option value="delegate">Делегировать</option><option value="unbond">Анбонд</option></select></div>
      <button type="submit" name="intent" value="preview">Проверить stake</button><button type="submit" name="intent" value="send">Отправить stake в сеть</button>
      <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
    </fieldset></form></details>
    ${decimalNftForms(data)}`;
  }

  async function renderDecimalWallet(chain, account) {
    appEl.innerHTML = '<section class="panel wallet-decimal"><h2>Decimal: кошелёк</h2><p>Загружаю балансы, stake, NFT и последние транзакции...</p></section>';
    setStatus(`Загружаю Decimal кошелёк: ${account}...`, 'loading');
    await loadScript(chain.cryptoPath);
    if (chain.walletPath) await loadScript(chain.walletPath);
    if (chain.libraryPath) await loadScript(chain.libraryPath);
    const data = await loadDecimalWalletData(chain, account);
    appEl.innerHTML = `<section class="panel wallet-decimal">
      <h2>Decimal: кошелёк ${escapeHtml(data.address)}</h2>
      <p><strong>Доступ к отправке:</strong> ${escapeHtml(keyStatusText(auth.getKeyStatus(chain, auth.getCurrentUser(chain))))}</p>
      ${renderDecimalWalletBalances(data)}
      <h3>Операции</h3>
      ${renderDecimalWalletForms(chain, data)}
    </section>`;
    const copyButton = document.getElementById('decimal-copy-address');
    if (copyButton) {
      copyButton.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(data.address);
          setStatus('Decimal address copied.', 'ok');
        } catch (error) {
          setStatus('Не удалось скопировать адрес автоматически.', 'error');
        }
      });
    }
    bindDecimalWalletForms(chain);
    bindDecimalQuickActions(appEl, data);
    bindDecimalConvertHelpers(appEl, chain, data);
    bindMaxButtons(appEl);
    setStatus(`Decimal кошелёк ${data.address} загружен.`, 'ok');
  }

  function renderCosmosWallet(chain, account) {
    const isMinter = chain.id === 'minter';
    const liquid = chain.liquidSymbol;
    appEl.innerHTML = `
      <section class="panel">
        <h2>${escapeHtml(chain.title)}: кошелёк ${escapeHtml(account)}</h2>
        <p><strong>Доступ к аккаунту:</strong> ${escapeHtml(keyStatusText(auth.getKeyStatus(chain, auth.getCurrentUser(chain))))}</p>
        <p class="notice">Seed используется только из сохранённого аккаунта браузера. В проверке операции и ответе сети seed/private key не показывается.</p>
        <form id="cosmos-send-form" class="stacked-form"><fieldset>
          <legend>Перевод</legend>
          <div class="field"><label for="cosmos-send-to">Адрес получателя</label><input id="cosmos-send-to" name="to" type="text" required></div>
          <div class="field"><label for="cosmos-send-amount">Сумма</label><input id="cosmos-send-amount" name="amount" type="text" required placeholder="1.000"></div>
          <div class="field"><label for="cosmos-send-coin">Монета</label><input id="cosmos-send-coin" name="coin" type="text" required value="${escapeHtml(liquid)}"></div>
          ${isMinter ? '<div class="field"><label for="cosmos-send-memo">Memo</label><input id="cosmos-send-memo" name="memo" type="text"></div><div class="field"><label for="cosmos-send-gas">Монета газа</label><input id="cosmos-send-gas" name="gasCoin" type="text" value="BIP"></div>' : ''}
          <button type="submit" name="intent" value="preview">Проверить перевод</button><button type="submit" name="intent" value="send">Отправить перевод в сеть</button>
          <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
        </fieldset></form>
        <form id="cosmos-delegate-form" class="stacked-form"><fieldset>
          <legend>Делегирование / анбонд</legend>
          <div class="field"><label for="cosmos-validator">Валидатор ${isMinter ? 'публичный ключ MP...' : 'operator id/address'}</label><input id="cosmos-validator" name="validator" type="text" required></div>
          <div class="field"><label for="cosmos-delegate-amount">Сумма</label><input id="cosmos-delegate-amount" name="amount" type="text" required placeholder="1.000"></div>
          <div class="field"><label for="cosmos-delegate-coin">Монета</label><input id="cosmos-delegate-coin" name="coin" type="text" required value="${escapeHtml(liquid)}"></div>
          <div class="field"><label for="cosmos-delegate-mode">Операция</label><select id="cosmos-delegate-mode" name="mode"><option value="delegate">Делегировать</option><option value="unbond">Анбонд</option></select></div>
          <button type="submit" name="intent" value="preview">Проверить stake</button><button type="submit" name="intent" value="send">Отправить stake в сеть</button>
          <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
        </fieldset></form>
        ${isMinter ? minterSwapForms() : decimalNftForms()}
      </section>`;
    bindCosmosForms(chain);
    setStatus(`${chain.title} формы кошелька/сервисов готовы: transfer/delegate/unbond${isMinter ? '/swap/coin' : '/NFT/token'}.`, 'ok');
  }

  function minterSwapForms() {
    return `<article class="card"><h3>Minter swap: static parity notes</h3>
      <p class="notice">Legacy swap auto-quote used public explorer endpoints <code>https://explorer-api.minter.network/api/v2/pools/coins/{from}/{to}/route</code> and <code>https://explorer-api.minter.network/api/v2/pools/providers/{address}</code>. v3 keeps the direct browser wallet operations and asks you to enter minimum buy amount and optional route explicitly; it does not add a proxy, PHP endpoint, indexer, daemon, private API, or hidden service.</p>
    </article>
    <details id="minter-swap-details" class="operation-details"><summary>Обмен / продажа</summary><form id="minter-swap-form" class="stacked-form"><fieldset>
      <legend>Minter: обмен / продажа</legend>
      <div class="field"><label for="minter-swap-from">Монета к продаже</label><input id="minter-swap-from" name="from" type="text" required value="BIP"></div>
      <div class="field"><label for="minter-swap-to">Монета к покупке</label><input id="minter-swap-to" name="to" type="text" required></div>
      <div class="field"><label for="minter-swap-amount">Сумма к продаже</label><input id="minter-swap-amount" name="amount" type="text" required></div>
      <div class="field"><label for="minter-swap-min">Минимальная сумма покупки</label><input id="minter-swap-min" name="min" type="text" value="0"></div>
      <div class="field"><label for="minter-swap-route">Маршрут swap pool (опционально, через запятую)</label><input id="minter-swap-route" name="route" type="text"></div>
      <button type="submit" name="intent" value="preview">Проверить swap</button><button type="submit" name="intent" value="send">Отправить swap в сеть</button>
      <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
    </fieldset></form></details>
    <details id="minter-liquidity-details" class="operation-details"><summary>Ликвидность / pool</summary><form id="minter-liquidity-form" class="stacked-form"><fieldset>
      <legend>Minter: ликвидность / pool</legend>
      <div class="field"><label for="minter-liquidity-mode">Операция</label><select id="minter-liquidity-mode" name="mode"><option value="ADD_LIQUIDITY">Добавить ликвидность</option><option value="REMOVE_LIQUIDITY">Убрать ликвидность</option><option value="CREATE_SWAP_POOL">Создать swap pool</option></select></div>
      <div class="field"><label for="minter-liquidity-coin0">Монета 0</label><input id="minter-liquidity-coin0" name="coin0" type="text" required value="BIP"></div>
      <div class="field"><label for="minter-liquidity-coin1">Монета 1</label><input id="minter-liquidity-coin1" name="coin1" type="text" required></div>
      <div class="field"><label for="minter-liquidity-volume0">Объём 0 / ликвидность</label><input id="minter-liquidity-volume0" name="volume0" type="text" required></div>
      <div class="field"><label for="minter-liquidity-volume1">Максимальный/начальный объём 1</label><input id="minter-liquidity-volume1" name="volume1" type="text" value="0"></div>
      <div class="field"><label for="minter-liquidity-gas">Монета газа</label><input id="minter-liquidity-gas" name="gasCoin" type="text" value="BIP"></div>
      <button type="submit" name="intent" value="preview">Проверить ликвидность</button><button type="submit" name="intent" value="send">Отправить liquidity в сеть</button>
      <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
    </fieldset></form></details>
    <details id="minter-hub-withdraw-details" class="operation-details"><summary>Minter Hub: вывод</summary><form id="minter-hub-withdraw-form" class="stacked-form"><fieldset>
      <legend>Minter Hub: вывод</legend>
      <p class="notice">Вывод через Minter Hub отправляет токены на адрес Hub с memo. Проверьте сеть назначения, адрес, сумму и комиссию перед отправкой.</p>
      <div class="field"><label for="minter-hub-chain">ID сети назначения</label><input id="minter-hub-chain" name="chainId" type="text" required placeholder="ethereum или bsc"></div>
      <div class="field"><label for="minter-hub-to">Адрес назначения во внешней сети</label><input id="minter-hub-to" name="to" type="text" required></div>
      <div class="field"><label for="minter-hub-coin">Монета/токен</label><input id="minter-hub-coin" name="coin" type="text" required></div>
      <div class="field"><label for="minter-hub-amount">Сумма с учётом комиссии hub</label><input id="minter-hub-amount" name="amount" type="text" required></div>
      <div class="field"><label for="minter-hub-fee">Комиссия hub в единицах токена</label><input id="minter-hub-fee" name="hubFee" type="text" value="0"></div>
      <div class="field"><label for="minter-hub-gas">Монета газа</label><input id="minter-hub-gas" name="gasCoin" type="text" value="BIP"></div>
      <button type="submit" name="intent" value="preview">Проверить вывод через Hub</button><button type="submit" name="intent" value="send">Отправить вывод через Hub в сеть</button>
      <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
    </fieldset></form></details>
    <details id="minter-coin-details" class="operation-details"><summary>Монета/токен</summary><form id="minter-coin-form" class="stacked-form"><fieldset>
      <legend>Minter: создание, пересоздание, выпуск, сжигание и смена владельца монеты/токена</legend>
      <div class="field"><label for="minter-coin-mode">Операция</label><select id="minter-coin-mode" name="mode"><option value="CREATE_COIN">Создать монету</option><option value="RECREATE_COIN">Пересоздать монету</option><option value="CREATE_TOKEN">Создать токен</option><option value="RECREATE_TOKEN">Пересоздать токен</option><option value="MINT_TOKEN">Выпустить токен</option><option value="BURN_TOKEN">Сжечь токен</option><option value="EDIT_COIN_OWNER">Сменить владельца</option></select></div>
      <div class="field"><label for="minter-coin-symbol">Символ</label><input id="minter-coin-symbol" name="symbol" type="text" required></div>
      <div class="field"><label for="minter-coin-name">Название</label><input id="minter-coin-name" name="name" type="text"></div>
      <div class="field"><label for="minter-coin-amount">Начальная сумма / выпуск / сжигание</label><input id="minter-coin-amount" name="amount" type="text" required></div>
      <div class="field"><label for="minter-coin-max">Максимальная эмиссия</label><input id="minter-coin-max" name="max" type="text" value="1000000"></div>
      <div class="field"><label for="minter-coin-reserve">Начальный резерв (CREATE_COIN/RECREATE_COIN)</label><input id="minter-coin-reserve" name="reserve" type="text" value="10000"></div>
      <div class="field"><label for="minter-coin-crr">Процент CRR (CREATE_COIN/RECREATE_COIN)</label><input id="minter-coin-crr" name="crr" type="number" min="10" max="100" step="1" value="10"></div>
      <div class="field"><label for="minter-coin-new-owner">Адрес нового владельца (EDIT_COIN_OWNER)</label><input id="minter-coin-new-owner" name="newOwner" type="text"></div>
      <button type="submit" name="intent" value="preview">Проверить операцию с монетой</button><button type="submit" name="intent" value="send">Отправить операцию с монетой в сеть</button>
      <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
    </fieldset></form></details>`;
  }

  function decimalNftForms(data) {
    const nftOptions = decimalNftOptions(data);
    const nftPicker = nftOptions ? `<div class="field"><label for="decimal-nft-pick">NFT из кошелька</label><select id="decimal-nft-pick"><option value="">Выберите NFT из списка</option>${nftOptions}</select></div>` : '<p class="muted">Если NFT есть в таблице выше, нажмите «Stake NFT» в строке NFT, чтобы заполнить форму.</p>';
    return `<details id="decimal-convert-details" class="operation-details"><summary>Convert / swap</summary><form id="decimal-convert-form" class="stacked-form"><fieldset>
      <legend>Decimal: convert / swap</legend>
      <p class="notice">Можно вводить DEL, тикер токена или адрес 0x. Поиск использует публичный Decimal coins API без backend-сервиса.</p>
      <datalist id="decimal-token-suggestions"></datalist>
      <div class="field"><label for="decimal-convert-from">Из: DEL, тикер или адрес токена</label><input id="decimal-convert-from" name="from" type="text" required value="DEL" list="decimal-token-suggestions"></div>
      <div class="field"><label for="decimal-convert-to">В: DEL, тикер или адрес токена</label><input id="decimal-convert-to" name="to" type="text" required list="decimal-token-suggestions"> <button type="button" id="decimal-token-search-button">Найти токены</button></div>
      <div id="decimal-token-search-results" class="operation-result" role="status" aria-live="polite"></div>
      <div class="field"><label for="decimal-convert-amount">Сумма для конвертации (<span id="decimal-convert-max-status">выберите исходный токен для максимума</span>)</label><input id="decimal-convert-amount" name="amount" type="text" required> <button type="button" id="decimal-convert-max-button" disabled>Максимум</button></div>
      <div class="field"><label for="decimal-convert-min">Минимальная сумма получения</label><input id="decimal-convert-min" name="minAmount" type="text" value="0"></div>
      <div class="field"><label for="decimal-convert-from-decimals">Знаков после запятой у исходного токена</label><input id="decimal-convert-from-decimals" name="fromDecimals" type="number" min="0" max="36" value="18"></div>
      <div class="field"><label for="decimal-convert-to-decimals">Знаков после запятой у целевого токена</label><input id="decimal-convert-to-decimals" name="toDecimals" type="number" min="0" max="36" value="18"></div>
      <button type="submit" name="intent" value="preview">Проверить конвертацию</button><button type="submit" name="intent" value="send">Отправить convert в сеть</button>
      <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
    </fieldset></form></details>
    <details id="decimal-token-details" class="operation-details"><summary>Создание токена</summary><form id="decimal-token-form" class="stacked-form"><fieldset>
      <legend>Decimal: создание токена</legend>
      <div class="field"><label for="decimal-token-title">Название</label><input id="decimal-token-title" name="title" type="text" required></div>
      <div class="field"><label for="decimal-token-symbol">Символ</label><input id="decimal-token-symbol" name="symbol" type="text" required></div>
      <div class="field"><label for="decimal-token-init">Начальная эмиссия</label><input id="decimal-token-init" name="initSupply" type="text" required></div>
      <div class="field"><label for="decimal-token-max">Максимальная эмиссия</label><input id="decimal-token-max" name="maxSupply" type="text" required></div>
      <button type="submit" name="intent" value="preview">Проверить token</button><button type="submit" name="intent" value="send">Создать token в сети</button>
      <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
    </fieldset></form></details>
    <details id="decimal-nft-details" class="operation-details"><summary>NFT stake</summary><form id="decimal-nft-form" class="stacked-form"><fieldset>
      <legend>Decimal: NFT stake</legend>
      <div class="field"><label for="decimal-nft-mode">Операция</label><select id="decimal-nft-mode" name="mode"><option value="delegate">Делегировать NFT</option><option value="unbond">Анбонд NFT</option></select></div>
      ${nftPicker}
      <div class="field"><label for="decimal-nft-collection">Коллекция / contract address NFT</label><input id="decimal-nft-collection" name="collection" type="text" required placeholder="0x... или значение из списка NFT"></div>
      <div class="field"><label for="decimal-nft-id">NFT ID</label><input id="decimal-nft-id" name="nftId" type="text" required></div>
      <div class="field"><label for="decimal-nft-amount">Количество (для DRC1155; для DRC721 оставьте 1)</label><input id="decimal-nft-amount" name="amount" type="text" value="1"></div>
      <div class="field"><label for="decimal-nft-validator">ID/адрес валидатора</label><input id="decimal-nft-validator" name="validator" type="text" required></div>
      <button type="submit" name="intent" value="preview">Проверить NFT</button><button type="submit" name="intent" value="send">Отправить NFT-операцию в сеть</button>
      <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
    </fieldset></form></details>`;
  }

  function minterTx(typeName, data, gasCoin, memo) {
    const txType = global.minterSDK && global.minterSDK.TX_TYPE;
    return { chainId: 1, type: txType ? txType[typeName] : typeName, data, gasCoin: gasCoin || 'BIP', payload: memo || '' };
  }


  function openMinterOperationDetails(id) {
    const details = document.getElementById(id);
    if (!details) return null;
    details.open = true;
    details.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return details;
  }

  function setMinterField(id, value) {
    const field = document.getElementById(id);
    if (field && value !== undefined && value !== null && String(value) !== '') field.value = String(value);
  }

  function setMinterMaxButton(id, amount, coin) {
    const button = document.getElementById(id);
    if (!button || amount === undefined || amount === null || String(amount) === '') return;
    button.dataset.fillValue = String(amount);
    button.textContent = `Максимум ${amount}${coin ? ` ${coin}` : ''}`;
    button.hidden = false;
  }

  function bindMinterQuickActions(root) {
    (root || document).querySelectorAll('[data-minter-action]').forEach((button) => {
      button.addEventListener('click', () => {
        const action = button.dataset.minterAction;
        if (action === 'send') {
          openMinterOperationDetails('minter-send-details');
          setMinterField('minter-send-amount', button.dataset.minterAmount);
          setMinterField('minter-send-coin', button.dataset.minterCoin);
          setMinterMaxButton('minter-send-max-button', button.dataset.minterAmount, button.dataset.minterCoin);
          const target = document.getElementById('minter-send-to');
          if (target) target.focus();
          return;
        }
        if (action === 'delegate' || action === 'unbond') {
          openMinterOperationDetails('minter-delegate-details');
          setMinterField('minter-validator', button.dataset.minterValidator);
          setMinterField('minter-delegate-amount', button.dataset.minterAmount);
          setMinterField('minter-delegate-coin', button.dataset.minterCoin || 'BIP');
          setMinterField('minter-delegate-mode', action === 'unbond' ? 'unbond' : 'delegate');
          setMinterMaxButton('minter-delegate-max-button', button.dataset.minterAmount, button.dataset.minterCoin || 'BIP');
          const focusTarget = document.getElementById(action === 'unbond' ? 'minter-delegate-amount' : 'minter-validator');
          if (focusTarget) focusTarget.focus();
          return;
        }
        if (action === 'swap') {
          openMinterOperationDetails('minter-swap-details');
          setMinterField('minter-swap-from', button.dataset.minterCoin || 'BIP');
          setMinterField('minter-swap-amount', button.dataset.minterAmount);
          const target = document.getElementById('minter-swap-to');
          if (target) target.focus();
          return;
        }
        if (action === 'liquidity') {
          openMinterOperationDetails('minter-liquidity-details');
          setMinterField('minter-liquidity-coin0', button.dataset.minterCoin || 'BIP');
          setMinterField('minter-liquidity-volume0', button.dataset.minterAmount);
          const target = document.getElementById('minter-liquidity-coin1');
          if (target) target.focus();
        }
      });
    });
  }

  function bindMinterWalletForms(chain) {
    bindOperationForm(chain, 'minter-send-form', (form) => {
      const to = broadcast.validateAddress(chain, form.get('to'), 'Получатель');
      const amount = normalizeAmountInput(form.get('amount'), 'Сумма');
      const coin = normalizeCoinInput(form.get('coin'), 'Монета');
      const memo = String(form.get('memo') || '');
      if (global.minterWallet && typeof global.minterWallet.isValidMnemonic === 'function' && global.minterWallet.isValidMnemonic(memo)) {
        throw new Error('Memo похоже на seed-фразу. Исправьте memo перед отправкой.');
      }
      const tx = minterTx('SEND', { to, value: Number(amount), coin }, normalizeCoinInput(form.get('gasCoin') || coin, 'Монета газа'), memo);
      return broadcast.prepare(chain, 'seed', 'minterTx', [tx], { title: 'Minter send', to, amount: `${amount} ${coin}`, txType: 'SEND', coin, gasCoin: tx.gasCoin });
    });

    bindOperationForm(chain, 'minter-delegate-form', (form) => {
      const mode = String(form.get('mode') || 'delegate');
      const amount = normalizeAmountInput(form.get('amount'), 'Stake');
      const coin = normalizeCoinInput(form.get('coin'), 'Монета');
      const validator = String(form.get('validator') || '').trim();
      if (!/^Mp[0-9a-fA-F]{64}$/.test(validator)) throw new Error('Minter validator public key должен быть MP  64 hex chars.');
      const txType = mode === 'unbond' ? 'UNBOND' : 'DELEGATE';
      const tx = minterTx(txType, { publicKey: validator, coin, stake: Number(amount) }, coin, '');
      return broadcast.prepare(chain, 'seed', 'minterTx', [tx], { title: `Minter ${txType}`, amount: `${amount} ${coin}`, txType, coin, validator });
    });

    bindOperationForm(chain, 'minter-swap-form', (form) => {
      const from = normalizeCoinInput(form.get('from'), 'Монета к продаже');
      const to = normalizeCoinInput(form.get('to'), 'Монета к покупке');
      const amount = normalizeAmountInput(form.get('amount'), 'Сумма к продаже');
      const min = String(form.get('min') || '0').trim().replace(',', '.');
      if (!/^\d(?:\.\d{1,18})?$/.test(min)) throw new Error('Минимальная сумма покупки должен быть неотрицательным числом.');
      const route = String(form.get('route') || '').split(',').map((item) => item.trim()).filter(Boolean);
      const txType = route.length ? 'SELL_SWAP_POOL' : 'SELL';
      const data = route.length ? { coins: [from].concat(route).concat([to]), valueToSell: Number(amount), minimumValueToBuy: Number(min) } : { coinToSell: from, coinToBuy: to, valueToSell: Number(amount), minimumValueToBuy: Number(min) };
      return broadcast.prepare(chain, 'seed', 'minterTx', [minterTx(txType, data, from, '')], { title: 'Minter swap', amount: `${amount} ${from} → ${to}`, txType, coin: from, warnings: route.length ? [`Маршрут: ${[from].concat(route).concat([to]).join(' → ')}`] : [] });
    });

    bindOperationForm(chain, 'minter-liquidity-form', (form) => {
      const mode = String(form.get('mode') || 'ADD_LIQUIDITY');
      const coin0 = normalizeCoinInput(form.get('coin0'), 'Монета 0');
      const coin1 = normalizeCoinInput(form.get('coin1'), 'Монета 1');
      const volume0 = normalizeAmountInput(form.get('volume0'), mode === 'REMOVE_LIQUIDITY' ? 'Ликвидность' : 'Объём 0');
      const volume1 = String(form.get('volume1') || '0').trim().replace(',', '.');
      if (!/^\d(?:\.\d{1,18})?$/.test(volume1)) throw new Error('Объём 1 должен быть неотрицательным числом.');
      const gasCoin = normalizeCoinInput(form.get('gasCoin') || 'BIP', 'Монета газа');
      const data = mode === 'REMOVE_LIQUIDITY'
        ? { coin0, coin1, liquidity: Number(volume0) }
        : { coin0, coin1, volume0: Number(volume0), [mode === 'CREATE_SWAP_POOL' ? 'volume1' : 'maximumVolume1']: Number(volume1) };
      return broadcast.prepare(chain, 'seed', 'minterTx', [minterTx(mode, data, gasCoin, '')], { title: `Minter ${mode}`, amount: `${volume0} ${coin0} / ${volume1} ${coin1}`, txType: mode, coin: gasCoin });
    });

    bindOperationForm(chain, 'minter-hub-withdraw-form', (form) => {
      const destinationChain = String(form.get('chainId') || '').trim().toLowerCase();
      if (!/^[a-z0-9_-]{2,32}$/.test(destinationChain)) throw new Error('ID сети назначения is required, for example ethereum или bsc.');
      const to = String(form.get('to') || '').trim();
      if (!to) throw new Error('Нужен адрес назначения.');
      const coin = normalizeCoinInput(form.get('coin'), 'Монета');
      const amount = normalizeAmountInput(form.get('amount'), 'Сумма вывода');
      const hubFee = String(form.get('hubFee') || '0').trim().replace(',', '.');
      if (!/^\d(?:\.\d{1,18})?$/.test(hubFee)) throw new Error('Комиссия hub должна быть неотрицательным числом.');
      const gasCoin = normalizeCoinInput(form.get('gasCoin') || 'BIP', 'Монета газа');
      const [feeWhole, feeFrac = ''] = hubFee.split('.');
      const feeMinimal = `${feeWhole}${feeFrac.padEnd(18, '0')}`.replace(/^0(?=\d)/, '') || '0';
      const memo = JSON.stringify({ recipient: to, type: `send_to_${destinationChain}`, fee: feeMinimal });
      const tx = minterTx('SEND', { to: 'Mx68f4839d7f32831b9234f9575f3b95e1afe21a56', value: Number(amount), coin }, gasCoin, memo);
      return broadcast.prepare(chain, 'seed', 'minterTx', [tx], { title: 'Minter Hub: вывод', to, amount: `${amount} ${coin}`, txType: 'SEND', coin, gasCoin, warnings: ['Адрес Minter Hub: Mx68f4839d7f32831b9234f9575f3b95e1afe21a56.', `Memo: ${memo}`] });
    });

    bindOperationForm(chain, 'minter-coin-form', (form) => {
      const mode = String(form.get('mode') || 'CREATE_TOKEN');
      const symbol = normalizeCoinInput(form.get('symbol'), 'Symbol');
      const amount = normalizeAmountInput(form.get('amount'), 'Сумма');
      let data;
      if (mode === 'EDIT_COIN_OWNER') {
        data = { symbol, newOwner: broadcast.validateAddress(chain, form.get('newOwner'), 'Новый владелец') };
      } else if (mode === 'CREATE_COIN' || mode === 'RECREATE_COIN') {
        data = { name: String(form.get('name') || symbol).trim(), symbol, initialAmount: Number(amount), maxSupply: Number(normalizeAmountInput(form.get('max'), 'Максимальная эмиссия')), constantReserveRatio: Number(form.get('crr') || 10), initialReserve: Number(normalizeAmountInput(form.get('reserve'), 'Начальный резерв')) };
      } else if (mode === 'CREATE_TOKEN' || mode === 'RECREATE_TOKEN') {
        data = { name: String(form.get('name') || symbol).trim(), symbol, initialAmount: Number(amount), maxSupply: Number(normalizeAmountInput(form.get('max'), 'Максимальная эмиссия')), mintable: true, burnable: true };
      } else if (mode === 'MINT_TOKEN' || mode === 'BURN_TOKEN') {
        data = { coin: symbol, value: Number(amount) };
      } else {
        throw new Error('Неподдерживаемая операция Minter coin/token.');
      }
      return broadcast.prepare(chain, 'seed', 'minterTx', [minterTx(mode, data, 'BIP', '')], { title: `Minter ${mode}`, amount: `${amount} ${symbol}`, txType: mode, coin: symbol });
    });
  }


  function openDecimalOperationDetails(id) {
    const details = document.getElementById(id);
    if (!details) return null;
    details.open = true;
    details.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return details;
  }

  function setDecimalField(id, value) {
    const field = document.getElementById(id);
    if (field && value !== undefined && value !== null && String(value) !== '') field.value = String(value);
  }

  function bindDecimalQuickActions(root, data) {
    (root || document).querySelectorAll('[data-decimal-action]').forEach((button) => {
      button.addEventListener('click', () => {
        const action = button.dataset.decimalAction;
        if (action === 'send') {
          openDecimalOperationDetails('decimal-send-details');
          setDecimalField('decimal-send-amount', button.dataset.decimalAmount);
          setDecimalField('decimal-send-coin', button.dataset.decimalCoin);
          const target = document.getElementById('decimal-send-to');
          if (target) target.focus();
          return;
        }
        if (action === 'delegate' || action === 'unbond') {
          openDecimalOperationDetails('decimal-delegate-details');
          setDecimalField('decimal-validator', button.dataset.decimalValidator);
          setDecimalField('decimal-delegate-amount', button.dataset.decimalAmount);
          setDecimalField('decimal-delegate-coin', button.dataset.decimalCoin || 'DEL');
          setDecimalField('decimal-delegate-mode', action === 'unbond' ? 'unbond' : 'delegate');
          const focusTarget = document.getElementById(action === 'unbond' ? 'decimal-delegate-amount' : 'decimal-validator');
          if (focusTarget) focusTarget.focus();
          return;
        }
        if (action === 'convert') {
          openDecimalOperationDetails('decimal-convert-details');
          setDecimalField('decimal-convert-from', button.dataset.decimalCoin || 'DEL');
          updateDecimalConvertMaximum(data);
          const target = document.getElementById('decimal-convert-to');
          if (target) target.focus();
        }
      });
    });
    (root || document).querySelectorAll('[data-decimal-nft-action]').forEach((button) => {
      button.addEventListener('click', () => {
        openDecimalOperationDetails('decimal-nft-details');
        setDecimalField('decimal-nft-mode', button.dataset.decimalNftAction || 'unbond');
        setDecimalField('decimal-nft-collection', button.dataset.decimalNftCollection);
        setDecimalField('decimal-nft-id', button.dataset.decimalNftId);
        setDecimalField('decimal-nft-amount', button.dataset.decimalNftAmount || '1');
        setDecimalField('decimal-nft-validator', button.dataset.decimalValidator);
        const target = document.getElementById('decimal-nft-validator');
        if (target) target.focus();
      });
    });
    bindDecimalNftPicker(root);
  }


  function bindDecimalNftPicker(root) {
    const nftPick = (root || document).querySelector('#decimal-nft-pick');
    if (!nftPick) return;
    nftPick.addEventListener('change', () => {
      if (!nftPick.value) return;
      setDecimalField('decimal-nft-id', nftPick.value);
      const option = nftPick.selectedOptions && nftPick.selectedOptions[0];
      setDecimalField('decimal-nft-collection', option && option.dataset ? option.dataset.decimalNftCollection : '');
      const target = document.getElementById('decimal-nft-validator');
      if (target) target.focus();
    });
  }

  function updateDecimalConvertMaximum(data) {
    const fromField = document.getElementById('decimal-convert-from');
    const amountField = document.getElementById('decimal-convert-amount');
    const button = document.getElementById('decimal-convert-max-button');
    const status = document.getElementById('decimal-convert-max-status');
    if (!fromField || !button || !status) return;
    const asset = String(fromField.value || 'DEL').trim() || 'DEL';
    const max = decimalBalanceMaximum(data, asset);
    if (max) {
      button.disabled = false;
      button.dataset.fillValue = max;
      button.dataset.fillTarget = 'decimal-convert-amount';
      button.textContent = `Максимум ${max} ${asset.toUpperCase()}`;
      status.textContent = `доступно ${max} ${asset.toUpperCase()}`;
      if (amountField && amountField.value === '') amountField.placeholder = max;
    } else {
      button.disabled = true;
      delete button.dataset.fillValue;
      status.textContent = `нет найденного баланса для ${asset.toUpperCase()}`;
      button.textContent = 'Максимум';
    }
  }

  function renderDecimalTokenSearchResults(tokens, targetId) {
    const results = document.getElementById('decimal-token-search-results');
    const suggestions = document.getElementById('decimal-token-suggestions');
    if (suggestions) {
      suggestions.innerHTML = tokens.slice(0, 50).map((token) => `<option value="${escapeHtml(token.symbol)}">${escapeHtml(token.title || token.address || '')}</option>`).join('');
    }
    if (!results) return;
    if (!tokens.length) {
      results.innerHTML = '<p class="muted">Токены не найдены.</p>';
      return;
    }
    results.innerHTML = `<p>Найдено токенов: ${tokens.length}. Выберите для поля ${targetId === 'decimal-convert-from' ? 'Из' : 'В'}:</p><div class="button-row">${tokens.slice(0, 20).map((token) => `<button type="button" data-decimal-token-pick="${targetId}" data-decimal-token-symbol="${escapeHtml(token.symbol)}" data-decimal-token-address="${escapeHtml(token.address || '')}" data-decimal-token-decimals="${escapeHtml(String(token.decimals || 18))}">${escapeHtml(token.symbol)}${token.title ? ` — ${escapeHtml(token.title)}` : ''}</button>`).join(' ')}</div>`;
    results.querySelectorAll('[data-decimal-token-pick]').forEach((button) => {
      button.addEventListener('click', () => {
        const fieldId = button.dataset.decimalTokenPick;
        setDecimalField(fieldId, button.dataset.decimalTokenSymbol);
        setDecimalField(fieldId === 'decimal-convert-from' ? 'decimal-convert-from-decimals' : 'decimal-convert-to-decimals', button.dataset.decimalTokenDecimals || '18');
        if (fieldId === 'decimal-convert-from') updateDecimalConvertMaximum(window.__decimalWalletData || {});
      });
    });
  }

  function bindDecimalConvertHelpers(root, chain, data) {
    window.__decimalWalletData = data || {};
    const fromField = document.getElementById('decimal-convert-from');
    const toField = document.getElementById('decimal-convert-to');
    const maxButton = document.getElementById('decimal-convert-max-button');
    const searchButton = document.getElementById('decimal-token-search-button');
    if (fromField) {
      fromField.addEventListener('input', () => updateDecimalConvertMaximum(data));
      fromField.addEventListener('change', () => updateDecimalConvertMaximum(data));
    }
    if (maxButton) {
      maxButton.addEventListener('click', () => {
        const value = maxButton.dataset.fillValue;
        if (value) setDecimalField('decimal-convert-amount', value);
      });
    }
    const hydrateDecimals = async (field, decimalsFieldId) => {
      if (!field) return;
      try {
        const asset = await resolveDecimalConvertAsset(chain, field.value, 'Decimal token');
        setDecimalField(decimalsFieldId, String(asset.decimals || 18));
      } catch (error) { /* keep user-editable defaults */ }
    };
    if (fromField) fromField.addEventListener('change', () => hydrateDecimals(fromField, 'decimal-convert-from-decimals'));
    if (toField) toField.addEventListener('change', () => hydrateDecimals(toField, 'decimal-convert-to-decimals'));
    if (searchButton) {
      searchButton.addEventListener('click', async () => {
        const active = document.activeElement && (document.activeElement.id === 'decimal-convert-from' || document.activeElement.id === 'decimal-convert-to') ? document.activeElement : toField;
        const query = String((active && active.value) || (toField && toField.value) || '').trim().toUpperCase();
        const results = document.getElementById('decimal-token-search-results');
        if (results) results.textContent = 'Ищу токены через публичный Decimal API...';
        try {
          const tokens = await loadDecimalTokenIndex(chain);
          const filtered = query ? tokens.filter((token) => token.symbol.includes(query) || String(token.title || '').toUpperCase().includes(query) || String(token.address || '').toUpperCase().includes(query)).slice(0, 50) : tokens.slice(0, 50);
          renderDecimalTokenSearchResults(filtered, active && active.id ? active.id : 'decimal-convert-to');
        } catch (error) {
          if (results) results.innerHTML = `<p class="muted">Поиск токенов сейчас недоступен: ${escapeHtml(profiles.formatError(error))}</p>`;
        }
      });
    }
    updateDecimalConvertMaximum(data);
  }

  function bindDecimalWalletForms(chain) {
    bindOperationForm(chain, 'decimal-send-form', (form) => {
      const to = broadcast.validateAddress(chain, form.get('to'), 'Получатель');
      const amount = normalizeAmountInput(form.get('amount'), 'Сумма');
      const coin = normalizeCoinInput(form.get('coin'), 'Монета/токен');
      return broadcast.prepare(chain, 'seed', 'decimalSend', [{ to, amount, coin }], { title: 'Decimal send', to, amount: `${amount} ${coin}` });
    });

    bindOperationForm(chain, 'decimal-delegate-form', (form) => {
      const mode = String(form.get('mode') || 'delegate');
      const amount = normalizeAmountInput(form.get('amount'), 'Stake');
      const coin = normalizeCoinInput(form.get('coin'), 'Монета/токен');
      const validator = broadcast.validateDecimalValidator(form.get('validator'), 'Валидатор');
      return broadcast.prepare(chain, 'seed', mode === 'unbond' ? 'decimalUnbond' : 'decimalDelegate', [{ validator, amount, coin }], { title: `Decimal ${mode}`, amount: `${amount} ${coin}`, validator });
    });

    bindOperationForm(chain, 'decimal-convert-form', async (form) => {
      const fromAsset = await resolveDecimalConvertAsset(chain, form.get('from'), 'Исходный актив');
      const toAsset = await resolveDecimalConvertAsset(chain, form.get('to'), 'Целевой актив');
      if (fromAsset.resolved.toUpperCase() === 'DEL' && toAsset.resolved.toUpperCase() === 'DEL') throw new Error('Decimal convert DEL → DEL is not valid.');
      const amount = normalizeAmountInput(form.get('amount'), 'Сумма конвертации');
      const minAmount = String(form.get('minAmount') || '0').trim().replace(',', '.');
      if (!/^\d(?:\.\d{1,18})?$/.test(minAmount)) throw new Error('Минимальная сумма получения должна быть неотрицательным числом.');
      return broadcast.prepare(chain, 'seed', 'decimalConvert', [{ from: fromAsset.resolved, to: toAsset.resolved, amount, minAmount, fromDecimals: Number(form.get('fromDecimals') || fromAsset.decimals || 18), toDecimals: Number(form.get('toDecimals') || toAsset.decimals || 18) }], { title: 'Decimal convert', amount: `${amount} ${fromAsset.symbol || fromAsset.input} → ${toAsset.symbol || toAsset.input}`, warnings: [fromAsset.resolved !== fromAsset.input ? `Исходный токен ${fromAsset.input} → ${fromAsset.resolved}` : '', toAsset.resolved !== toAsset.input ? `Целевой токен ${toAsset.input} → ${toAsset.resolved}` : ''].filter(Boolean) });
    });

    bindOperationForm(chain, 'decimal-token-form', (form) => broadcast.prepare(chain, 'seed', 'decimalCreateToken', [{
      title: String(form.get('title') || '').trim(),
      symbol: normalizeCoinInput(form.get('symbol'), 'Symbol'),
      initSupply: normalizeAmountInput(form.get('initSupply'), 'Начальная эмиссия'),
      maxSupply: normalizeAmountInput(form.get('maxSupply'), 'Максимальная эмиссия'),
      reserve: '0',
      crr: 0
    }], { title: 'Decimal: создание токена' }));

    bindOperationForm(chain, 'decimal-nft-form', async (form) => {
      const validator = broadcast.validateDecimalValidator(form.get('validator'), 'Валидатор');
      const nftId = String(form.get('nftId') || '').trim();
      const collection = await resolveDecimalNftCollectionAddress(chain, form.get('collection'), nftId);
      const amount = String(form.get('amount') || '1').trim().replace(',', '.');
      if (!/^\d+$/.test(amount) || Number(amount) <= 0) throw new Error('Количество NFT должно быть положительным целым числом.');
      if (!nftId) throw new Error('Нужен NFT ID.');
      const op = form.get('mode') === 'unbond' ? 'decimalUnbondNFT' : 'decimalDelegateNFT';
      return broadcast.prepare(chain, 'seed', op, [{ collection, nftId, amount, validator }], { title: op, validator, nft: `${collection}/${nftId}` });
    });
  }

  function bindCosmosForms(chain) {
    bindOperationForm(chain, 'cosmos-send-form', (form) => {
      const to = broadcast.validateAddress(chain, form.get('to'), 'Получатель');
      const amount = normalizeAmountInput(form.get('amount'), 'Сумма');
      const coin = normalizeCoinInput(form.get('coin'), 'Монета');
      if (chain.id === 'minter') {
        const tx = minterTx('SEND', { to, value: Number(amount), coin }, normalizeCoinInput(form.get('gasCoin') || coin, 'Монета газа'), String(form.get('memo') || ''));
        return broadcast.prepare(chain, 'seed', 'minterTx', [tx], { title: 'Minter send', to, amount: `${amount} ${coin}`, txType: 'SEND', coin, gasCoin: tx.gasCoin });
      }
      return broadcast.prepare(chain, 'seed', 'decimalSend', [{ to, amount, coin }], { title: 'Decimal send', to, amount: `${amount} ${coin}` });
    });

    bindOperationForm(chain, 'cosmos-delegate-form', (form) => {
      const mode = String(form.get('mode') || 'delegate');
      const amount = normalizeAmountInput(form.get('amount'), 'Stake');
      const coin = normalizeCoinInput(form.get('coin'), 'Монета');
      const validator = String(form.get('validator') || '').trim();
      if (chain.id === 'minter') {
        if (!/^Mp[0-9a-fA-F]{64}$/.test(validator)) throw new Error('Minter validator key должен быть MP  64 hex chars.');
        const txType = mode === 'unbond' ? 'UNBOND' : 'DELEGATE';
        const tx = minterTx(txType, { publicKey: validator, coin, stake: Number(amount) }, coin, '');
        return broadcast.prepare(chain, 'seed', 'minterTx', [tx], { title: `Minter ${mode}`, amount: `${amount} ${coin}`, txType, coin, validator });
      }
      const validated = broadcast.validateDecimalValidator(validator, 'Валидатор');
      return broadcast.prepare(chain, 'seed', mode === 'unbond' ? 'decimalUnbond' : 'decimalDelegate', [{ validator: validated, amount, coin }], { title: `Decimal ${mode}`, amount: `${amount} ${coin}`, validator: validated, warnings: ['Decimal validator принимает operator id из API или адрес валидатора; для переводов по-прежнему проверяется адрес аккаунта.'] });
    });

    bindOperationForm(chain, 'minter-swap-form', (form) => {
      const from = normalizeCoinInput(form.get('from'), 'Монета к продаже');
      const to = normalizeCoinInput(form.get('to'), 'Монета к покупке');
      const amount = normalizeAmountInput(form.get('amount'), 'Сумма к продаже');
      const min = String(form.get('min') || '0').trim().replace(',', '.');
      if (!/^\d(?:\.\d{1,18})?$/.test(min)) throw new Error('Минимальная сумма покупки должен быть неотрицательным числом.');
      const route = String(form.get('route') || '').split(',').map((item) => item.trim()).filter(Boolean);
      const txType = route.length ? 'SELL_SWAP_POOL' : 'SELL';
      const data = route.length ? { coins: [from].concat(route).concat([to]), valueToSell: Number(amount), minimumValueToBuy: Number(min) } : { coinToSell: from, coinToBuy: to, valueToSell: Number(amount), minimumValueToBuy: Number(min) };
      return broadcast.prepare(chain, 'seed', 'minterTx', [minterTx(txType, data, from, '')], { title: 'Minter swap', amount: `${amount} ${from} → ${to}`, txType, coin: from, warnings: route.length ? [`Маршрут: ${[from].concat(route).concat([to]).join(' → ')}`] : [] });
    });

    bindOperationForm(chain, 'minter-liquidity-form', (form) => {
      const mode = String(form.get('mode') || 'ADD_LIQUIDITY');
      const coin0 = normalizeCoinInput(form.get('coin0'), 'Монета 0');
      const coin1 = normalizeCoinInput(form.get('coin1'), 'Монета 1');
      const volume0 = normalizeAmountInput(form.get('volume0'), mode === 'REMOVE_LIQUIDITY' ? 'Ликвидность' : 'Объём 0');
      const volume1 = String(form.get('volume1') || '0').trim().replace(',', '.');
      if (!/^\d(?:\.\d{1,18})?$/.test(volume1)) throw new Error('Объём 1 должен быть неотрицательным числом.');
      const gasCoin = normalizeCoinInput(form.get('gasCoin') || 'BIP', 'Монета газа');
      const data = mode === 'REMOVE_LIQUIDITY'
        ? { coin0, coin1, liquidity: Number(volume0) }
        : { coin0, coin1, volume0: Number(volume0), [mode === 'CREATE_SWAP_POOL' ? 'volume1' : 'maximumVolume1']: Number(volume1) };
      return broadcast.prepare(chain, 'seed', 'minterTx', [minterTx(mode, data, gasCoin, '')], { title: `Minter ${mode}`, amount: `${volume0} ${coin0} / ${volume1} ${coin1}`, txType: mode, coin: gasCoin });
    });

    bindOperationForm(chain, 'minter-hub-withdraw-form', (form) => {
      const destinationChain = String(form.get('chainId') || '').trim().toLowerCase();
      if (!/^[a-z0-9_-]{2,32}$/.test(destinationChain)) throw new Error('ID сети назначения is required, for example ethereum или bsc.');
      const to = String(form.get('to') || '').trim();
      if (!to) throw new Error('Нужен адрес назначения.');
      const coin = normalizeCoinInput(form.get('coin'), 'Монета');
      const amount = normalizeAmountInput(form.get('amount'), 'Сумма вывода');
      const hubFee = String(form.get('hubFee') || '0').trim().replace(',', '.');
      if (!/^\d(?:\.\d{1,18})?$/.test(hubFee)) throw new Error('Комиссия hub должна быть неотрицательным числом.');
      const gasCoin = normalizeCoinInput(form.get('gasCoin') || 'BIP', 'Монета газа');
      const [feeWhole, feeFrac = ''] = hubFee.split('.');
      const feeMinimal = `${feeWhole}${feeFrac.padEnd(18, '0')}`.replace(/^0(?=\d)/, '') || '0';
      const memo = JSON.stringify({ recipient: to, type: `send_to_${destinationChain}`, fee: feeMinimal });
      const tx = minterTx('SEND', { to: 'Mx68f4839d7f32831b9234f9575f3b95e1afe21a56', value: Number(amount), coin }, gasCoin, memo);
      return broadcast.prepare(chain, 'seed', 'minterTx', [tx], { title: 'Minter Hub: вывод', to, amount: `${amount} ${coin}`, txType: 'SEND', coin, gasCoin, warnings: ['Адрес Minter Hub: Mx68f4839d7f32831b9234f9575f3b95e1afe21a56.', `Memo: ${memo}`] });
    });

    bindOperationForm(chain, 'minter-coin-form', (form) => {
      const mode = String(form.get('mode') || 'CREATE_TOKEN');
      const symbol = normalizeCoinInput(form.get('symbol'), 'Symbol');
      const amount = normalizeAmountInput(form.get('amount'), 'Сумма');
      let data;
      if (mode === 'EDIT_COIN_OWNER') {
        data = { symbol, newOwner: broadcast.validateAddress(chain, form.get('newOwner'), 'Новый владелец') };
      } else if (mode === 'CREATE_COIN' || mode === 'RECREATE_COIN') {
        data = { name: String(form.get('name') || symbol).trim(), symbol, initialAmount: Number(amount), maxSupply: Number(normalizeAmountInput(form.get('max'), 'Максимальная эмиссия')), constantReserveRatio: Number(form.get('crr') || 10), initialReserve: Number(normalizeAmountInput(form.get('reserve'), 'Начальный резерв')) };
      } else if (mode === 'CREATE_TOKEN' || mode === 'RECREATE_TOKEN') {
        data = { name: String(form.get('name') || symbol).trim(), symbol, initialAmount: Number(amount), maxSupply: Number(normalizeAmountInput(form.get('max'), 'Максимальная эмиссия')), mintable: true, burnable: true };
      } else if (mode === 'MINT_TOKEN' || mode === 'BURN_TOKEN') {
        data = { coin: symbol, value: Number(amount) };
      } else {
        throw new Error('Неподдерживаемая операция Minter coin/token.');
      }
      return broadcast.prepare(chain, 'seed', 'minterTx', [minterTx(mode, data, 'BIP', '')], { title: `Minter ${mode}`, amount: `${amount} ${symbol}`, txType: mode, coin: symbol });
    });

    bindOperationForm(chain, 'decimal-convert-form', (form) => {
      const from = String(form.get('from') || '').trim();
      const to = String(form.get('to') || '').trim();
      if (!from || !to) throw new Error('Для Decimal convert нужны исходный и целевой активы. Используйте DEL или адрес токена 0x.');
      if (from.toUpperCase() !== 'DEL' && !/^0x[0-9a-fA-F]{40}$/.test(from)) throw new Error('Исходный актив должен быть DEL или адресом токена 0x.');
      if (to.toUpperCase() !== 'DEL' && !/^0x[0-9a-fA-F]{40}$/.test(to)) throw new Error('Целевой актив должен быть DEL или адресом токена 0x.');
      const amount = normalizeAmountInput(form.get('amount'), 'Сумма конвертации');
      const minAmount = String(form.get('minAmount') || '0').trim().replace(',', '.');
      if (!/^\d(?:\.\d{1,18})?$/.test(minAmount)) throw new Error('Минимальная сумма получения должна быть неотрицательным числом.');
      return broadcast.prepare(chain, 'seed', 'decimalConvert', [{ from, to, amount, minAmount, fromDecimals: Number(form.get('fromDecimals') || 18), toDecimals: Number(form.get('toDecimals') || 18) }], { title: 'Decimal convert', amount: `${amount} ${from} → ${to}` });
    });

    bindOperationForm(chain, 'decimal-token-form', (form) => broadcast.prepare(chain, 'seed', 'decimalCreateToken', [{
      title: String(form.get('title') || '').trim(),
      symbol: normalizeCoinInput(form.get('symbol'), 'Symbol'),
      initSupply: normalizeAmountInput(form.get('initSupply'), 'Начальная эмиссия'),
      maxSupply: normalizeAmountInput(form.get('maxSupply'), 'Максимальная эмиссия'),
      reserve: '0',
      crr: 0
    }], { title: 'Decimal: создание токена' }));

    bindOperationForm(chain, 'decimal-nft-form', async (form) => {
      const validator = broadcast.validateDecimalValidator(form.get('validator'), 'Валидатор');
      const nftId = String(form.get('nftId') || '').trim();
      const collection = await resolveDecimalNftCollectionAddress(chain, form.get('collection'), nftId);
      const amount = String(form.get('amount') || '1').trim().replace(',', '.');
      if (!/^\d+$/.test(amount) || Number(amount) <= 0) throw new Error('Количество NFT должно быть положительным целым числом.');
      if (!nftId) throw new Error('Нужен NFT ID.');
      const op = form.get('mode') === 'unbond' ? 'decimalUnbondNFT' : 'decimalDelegateNFT';
      return broadcast.prepare(chain, 'seed', op, [{ collection, nftId, amount, validator }], { title: op, validator, nft: `${collection}/${nftId}` });
    });
  }


  function parseJsonInput(value, label) {
    try {
      return JSON.parse(String(value || '').trim());
    } catch (error) {
      throw new Error(`${label || 'JSON'} должен быть корректным JSON.`);
    }
  }

  function renderMinterBroadcast(chain) {
    appEl.innerHTML = `<section class="panel">
      <h2>Minter: отправка</h2>
      <p>Отправка готовой Minter-транзакции: signed TX не требует seed, multisig принимает транзакцию и внешние подписи.</p>
      <details id="minter-signed-tx-details" class="operation-details"><summary>Готовая signed TX — Проверить signed TX перед отправкой</summary><form id="minter-signed-tx-form" class="stacked-form"><fieldset>
        <legend>Готовая signed TX</legend>
        <p class="notice">Опасная внешняя транзакция: сначала проверьте содержимое, затем отправляйте только если signed TX получена из доверенного кошелька.</p>
        <div class="field"><label for="minter-signed-tx">Signed TX hex/base64</label><textarea id="minter-signed-tx" name="tx" rows="4" required></textarea></div>
        <button type="submit" name="intent" value="preview">Проверить signed TX</button><button type="submit" name="intent" value="send">Отправить signed TX в сеть</button>
        <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
      </fieldset></form></details>
      <details id="minter-multisig-details" class="operation-details"><summary>Multisig — проверить перед отправкой</summary><form id="minter-multisig-form" class="stacked-form"><fieldset>
        <legend>Multisig: отправка транзакции</legend>
        <p class="notice">Проверьте адрес multisig, JSON транзакции и количество подписей перед отправкой во внешнюю Minter сеть.</p>
        <div class="field"><label for="minter-multisig-address">Адрес multisig</label><input id="minter-multisig-address" name="multisig" type="text" required></div>
        <div class="field"><label for="minter-multisig-tx">JSON транзакции</label><textarea id="minter-multisig-tx" name="txJson" rows="6" required></textarea></div>
        <div class="field"><label for="minter-multisig-signatures">Подписи, по одной на строку</label><textarea id="minter-multisig-signatures" name="signatures" rows="5" required></textarea></div>
        <button type="submit" name="intent" value="preview">Проверить multisig submit</button><button type="submit" name="intent" value="send">Отправить multisig в сеть</button>
        <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
      </fieldset></form></details>
    </section>`;

    bindOperationForm(chain, 'minter-signed-tx-form', (form) => {
      const tx = String(form.get('tx') || '').trim();
      if (!tx) throw new Error('Нужна signed TX.');
      const decoded = global.minterSDK && typeof global.minterSDK.decodeTx === 'function' ? global.minterSDK.decodeTx(tx) : null;
      return broadcast.prepareExternal(chain, 'minterSignedTx', [{ tx }], { title: 'Minter: готовая signed TX', warnings: decoded ? [`Расшифрованная транзакция: ${JSON.stringify(broadcast.sanitizeResult(decoded))}`] : ['Расшифровка signed TX недоступна; можно отправить готовую signed TX без просмотра содержимого.'] });
    });

    bindOperationForm(chain, 'minter-multisig-form', (form) => {
      const multisig = broadcast.validateAddress(chain, form.get('multisig'), 'Адрес multisig');
      const tx = parseJsonInput(form.get('txJson'), 'JSON транзакции');
      const signatures = String(form.get('signatures') || '').split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
      if (!signatures.length) throw new Error('Нужна хотя бы одна multisig-подпись.');
      return broadcast.prepareExternal(chain, 'minterMultisigSubmit', [{ multisig, tx, signatures }], { title: 'Minter multisig submit', to: multisig, warnings: [`Подписей: ${signatures.length}`] });
    });

    setStatus('Minter: отправка signed TX и multisig готова.', 'ok');
  }

  function longUrl(path, params = {}) {
    const base = global.location && global.location.origin ? global.location.origin : 'https://dpos.blinddev.xyz';
    const url = new URL(`${LONG_API_BASE}${path || ''}`, base);
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, value);
    });
    return url.pathname + url.search;
  }

  function parseJsonMaybeText(text, sourceLabel) {
    let value = text;
    for (let attempt = 0; attempt < 2 && typeof value === 'string'; attempt++) {
      const trimmed = value.trim();
      if (!trimmed) return null;
      try {
        value = JSON.parse(trimmed);
      } catch (error) {
        throw new Error(`${sourceLabel || 'API'} вернул не JSON: ${error.message}`);
      }
    }
    return value;
  }

  async function fetchJsonText(url, sourceLabel, options = {}) {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), 10000) : null;
    const headers = Object.assign({ accept: 'application/json, text/plain;q=0.9, */*;q=0.1' }, options.headers || {});
    try {
      const response = await fetch(url, Object.assign({}, options, { headers, signal: controller ? controller.signal : options.signal }));
      if (!response.ok) throw new Error(`${sourceLabel || 'API'} HTTP ${response.status}`);
      const text = await response.text();
      return parseJsonMaybeText(text, sourceLabel);
    } catch (error) {
      if (error && error.name === 'AbortError') throw new Error(`${sourceLabel || 'API'} не ответил за 10 секунд.`);
      throw error;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  async function fetchLongJson(path, params) {
    return fetchJsonText(longUrl(path, params), 'LONG backend');
  }

  async function fetchMinterLongPool() {
    try {
      return await fetchJsonText(MINTER_LONG_POOL_URL, 'Minter pool API');
    } catch (error) {
      console.warn('Minter LONG pool API unavailable', error);
      return null;
    }
  }

  function longPageHash(page, extra = {}) {
    return appHash(Object.assign({ chain: 'minter', app: 'long', longPage: page }, extra));
  }

  function renderLongNav(activePage) {
    const items = [
      ['main', 'Обзор и рейтинг'],
      ['bids', 'Ставки'],
      ['deferred-txs', 'Отложенные транзакции']
    ];
    return `<nav class="subnav" aria-label="LONG"><ul>${items.map(([page, title]) => `<li>${page === activePage ? `<strong>${escapeHtml(title)}</strong>` : `<a href="${escapeHtml(longPageHash(page))}">${escapeHtml(title)}</a>`}</li>`).join('')}</ul></nav>`;
  }

  function toNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  }

  function formatLongNumber(value, digits = 3) {
    const number = toNumber(value);
    return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: digits }).format(number);
  }

  function calcLongPoolStats(pool) {
    if (!pool) return null;
    const divider = 10 ** 18;
    const bip = toNumber(pool.amount0) / divider;
    const long = toNumber(pool.amount1) / divider;
    const liquidity = toNumber(pool.liquidity) / divider;
    const price = long > 0 ? bip / long : toNumber(pool.price);
    if (!bip && !long && !liquidity && !price) return null;
    return { bip, long, liquidity, price };
  }

  function getLongLockDays(data, provider) {
    const locks = data && data.locks && typeof data.locks === 'object' ? data.locks : {};
    const lock = locks[provider.address];
    const liquidity = toNumber(provider.liquidity);
    if (!lock || !liquidity || !toNumber(lock.count)) return 0;
    return (toNumber(lock.days) / toNumber(lock.count)) * (toNumber(lock.amount) / liquidity);
  }

  function calcLongSuper(provider, index) {
    const investDays = toNumber(provider.invest_days) + 1;
    if (index > 99 || toNumber(provider.get_counter) > 50) return { supersCounter: 0, power: 0 };
    let supersCounter = 0;
    let power = 0;
    const start = Math.floor(toNumber(provider.bonus_invest_days)) + 1;
    for (let day = start; day <= investDays; day++) {
      if (day % 50 === 0) {
        supersCounter = day / 50;
        power += toNumber(provider.liquidity) * supersCounter;
      }
    }
    return { supersCounter, power };
  }

  function calcLongProviderRows(data, poolStats) {
    const providers = Array.isArray(data.providers) ? data.providers : [];
    const maxPrize = toNumber(data.max_prize);
    const maxAmount = toNumber(data.max_amount);
    const farmingAmount = Math.max(0, maxAmount - (maxPrize * 2));
    const fallbackLiquidity = providers.reduce((sum, item) => sum + toNumber(item.liquidity), 0) || 1;
    const totalLiquidity = poolStats && poolStats.liquidity ? poolStats.liquidity : fallbackLiquidity;
    const topProviders = providers.slice(0, 99);
    const totalSupers = topProviders.reduce((sum, provider, index) => sum + calcLongSuper(provider, index + 1).power, 0) || 1;
    const experienced = providers.map((provider, index) => {
      const baseDays = toNumber(provider.invest_days) * (toNumber(provider.multiply) || 1);
      const investDays = baseDays + getLongLockDays(data, provider);
      const experience = toNumber(provider.liquidity) * (1 + (investDays / 100));
      const liquidityShare = toNumber(provider.liquidity) / totalLiquidity;
      const providerLong = poolStats ? poolStats.long * liquidityShare : 0;
      const providerBip = poolStats ? poolStats.bip * liquidityShare : 0;
      const superData = calcLongSuper(provider, index + 1);
      return Object.assign({}, provider, { investDays, experience, liquidityShare, providerLong, providerBip, supersCounter: superData.supersCounter, superPower: superData.power });
    });
    const totalExperience = experienced.slice(0, 99).reduce((sum, item) => sum + item.experience, 0) || experienced.reduce((sum, item) => sum + item.experience, 0) || 1;
    return { providers: experienced, farmingAmount, totalLiquidity, totalExperience, totalSupers, maxPrize };
  }

  function renderLongProvidersTable(data, poolStats) {
    const { providers, farmingAmount, totalExperience, totalSupers, maxPrize } = calcLongProviderRows(data, poolStats);
    if (!providers.length) return '<p class="muted">Backend не вернул список провайдеров.</p>';
    return `<div class="table-wrap"><table aria-label="Рейтинг провайдеров LONG"><caption>Рейтинг провайдеров LONG по данным backend</caption><thead><tr><th scope="col">#</th><th scope="col">Адрес</th><th scope="col">Ликвидность</th><th scope="col">Инвест. дни × множитель</th><th scope="col">Получения</th><th scope="col">Будущий фарминг</th><th scope="col">Бонус 50 дней</th><th scope="col">Реферер</th></tr></thead><tbody>${providers.map((provider, index) => {
      const share = provider.experience / totalExperience;
      const calculatedPart = farmingAmount * share;
      const longBase = provider.providerLong ? provider.providerLong * 2 : 0;
      const providerPercent = longBase ? (calculatedPart / longBase) * 100 : 0;
      let bonusValue = 0;
      if (provider.superPower > 0) {
        bonusValue = maxPrize * (provider.superPower / totalSupers);
        if (bonusValue > calculatedPart * 10) bonusValue = calculatedPart * 10;
      }
      const poolParts = provider.providerLong || provider.providerBip ? `<br><span class="muted">${formatLongNumber(provider.providerLong)} LONG и ${formatLongNumber(provider.providerBip)} BIP</span>` : '';
      return `<tr><td>${index + 1}</td><td>${renderAccountCell(chains.minter, provider.address)}</td><td>${formatLongNumber(provider.liquidity)} LP${poolParts}<br><span class="muted">${formatLongNumber(provider.liquidityShare * 100, 4)}% пула</span></td><td>${formatLongNumber(provider.investDays)} × ${escapeHtml(provider.multiply || 1)}</td><td>${formatLongNumber(provider.get_amount)} LONG<br><span class="muted">${formatLongNumber(provider.get_counter)} начислений</span></td><td>${formatLongNumber(calculatedPart)} LONG<br><span class="muted">${formatLongNumber(providerPercent, 3)}%</span></td><td>${formatLongNumber(bonusValue)}</td><td>${provider.referer ? renderAccountCell(chains.minter, provider.referer) : '<span class="muted">—</span>'}</td></tr>`;
    }).join('')}</tbody></table></div>`;
  }

  function renderLongPoolSummary(poolStats) {
    if (!poolStats) return '<p class="muted">Публичный Minter API пула сейчас недоступен. Откройте Chainik или explorer Minter для ручной проверки BIP/LONG.</p>';
    return `<ul>
      <li><strong>Пул BIP/LONG:</strong> ${formatLongNumber(poolStats.liquidity)} LP</li>
      <li><strong>Резервы:</strong> ${formatLongNumber(poolStats.bip)} BIP и ${formatLongNumber(poolStats.long)} LONG</li>
      <li><strong>Курс:</strong> 1 LONG ≈ ${formatLongNumber(poolStats.price, 8)} BIP</li>
    </ul>`;
  }

  function renderLongStaticNonGoals() {
    return `<article class="card" role="status" aria-live="polite"><h3>Backend/indexer-only non-goals</h3>
      <p>Legacy LONG строил рейтинг провайдеров, лотереи, ставки, опросы, драконов и отложенные отправки из приватного smartfarm backend и PHP-шаблонов. Static v3 не добавляет hidden server API, PHP runtime, indexer, daemon или hosted helper app.</p>
      <ul>
        <li><strong>Рейтинг провайдеров</strong> недоступен без legacy backend; показываем только проверяемый публичный пул BIP/LONG и адреса.</li>
        <li><strong>Ставки, Опросы, Лотереи, RPS, драконы, семейный калькулятор и Отложенные транзакции</strong> требуют серверного состояния или индексированных списков. Они оставлены как документированные static-only non-goals.</li>
        <li><strong>Direct wallet actions</strong> для LONG не добавлены в этот раздел: используйте Minter кошелёк/swap только для уже поддержанных явных операций.</li>
      </ul></article>`;
  }

  async function renderLongMain() {
    appEl.innerHTML = '<section class="panel"><h2>Minter LONG</h2><p>Загружаю обзор и рейтинг LONG...</p></section>';
    setStatus('Загружаю LONG: обзор и рейтинг...', 'loading');
    const [data, pool] = await Promise.all([fetchLongJson(''), fetchMinterLongPool()]);
    const poolStats = calcLongPoolStats(pool);
    const { farmingAmount, totalExperience } = calcLongProviderRows(data, poolStats);
    appEl.innerHTML = `<section class="panel"><h2>Minter LONG</h2>${renderLongNav('main')}
      <p>Раздел показывает параметры LONG по данным активного backend <code>/api/smartfarm</code> и публичной сети Minter. Это информационный расчёт: итоговые значения зависят от состояния блокчейна, ликвидности, правил сервиса и доступности backend.</p>
      <p><a href="https://t.me/long_project" target="_blank" rel="noopener">Новости LONG</a> · <a href="https://t.me/long_project_chat" target="_blank" rel="noopener">Обсуждение</a> · <a href="https://chainik.io/pool/BIP/LONG" target="_blank" rel="noopener">Пул BIP/LONG</a></p>
      <article class="card"><h3>Кошелёк рассылки</h3><p>Кошелёк отправки фарминга и бонуса за инвест. дни, кратные 50: ${accountLink(chains.minter, LONG_FARMING_SENDER)}</p><p class="muted">Фактические начисления и отложенные отправки сверяйте по транзакциям адреса в публичном explorer.</p></article>
      <article class="card"><h3>Основные параметры</h3><ul>
        <li><strong>Максимальная дневная сумма по backend:</strong> ${formatLongNumber(data.max_amount)} LONG</li>
        <li><strong>Резерв для лотереи и бонусных инвест. дней:</strong> ${formatLongNumber(toNumber(data.max_prize) * 2)} LONG</li>
        <li><strong>Расчётная часть для распределения:</strong> ${formatLongNumber(farmingAmount)} LONG</li>
        <li><strong>Суммарный опыт провайдеров:</strong> ${formatLongNumber(totalExperience)}</li>
        ${poolStats ? `<li><strong>Пул BIP/LONG:</strong> ${formatLongNumber(poolStats.liquidity)} LP, ${formatLongNumber(poolStats.bip)} BIP и ${formatLongNumber(poolStats.long)} LONG</li><li><strong>Курс:</strong> 1 LONG ≈ ${formatLongNumber(poolStats.price, 8)} BIP</li>` : '<li><strong>Пул BIP/LONG:</strong> Minter API сейчас недоступен, показываю backend-данные без состава пула.</li>'}
      </ul></article>
      <article class="card"><h3>Как читать расчёты</h3><p>Инвест. дни, множитель, LP и накопленные значения берутся из backend. Таблица ниже помогает проверить рейтинг и текущую формулу; она не является обещанием результата и не заменяет проверку транзакций в сети.</p></article>
      ${renderLongProvidersTable(data, poolStats)}
      ${rawJsonDetails('Исходные данные LONG backend', data)}
      ${pool ? rawJsonDetails('Исходные данные Minter pool API', pool) : ''}
    </section>`;
    setStatus('LONG: обзор и рейтинг загружены из /api/smartfarm.', 'ok');
  }

  function renderLongProjects(projects) {
    const entries = Object.entries(projects || {});
    if (!entries.length) return '<p class="muted">Активные токены и пулы не найдены.</p>';
    return `<div class="table-wrap"><table aria-label="Активные токены и пулы LONG bids"><caption>Активные токены и пулы для ставок</caption><thead><tr><th scope="col">Токен/пул</th><th scope="col">Текущее значение</th></tr></thead><tbody>${entries.map(([name, price]) => `<tr><td>${escapeHtml(name)}</td><td>${formatLongNumber(price, 8)}</td></tr>`).join('')}</tbody></table></div>`;
  }

  function renderLongAllowedCoins(data, selectedCoin) {
    const coins = String(data.allowedCoins || '').split(',').map((item) => item.trim()).filter(Boolean);
    const mins = String(data.minAmountsAllowedCoins || '').split(',').map((item) => item.trim());
    if (!coins.length) return '<p class="muted">Backend не вернул список разрешённых монет.</p>';
    return `<ul>${coins.map((coin, index) => `<li>${coin === selectedCoin ? `<strong>${escapeHtml(coin)}</strong>` : `<a href="${escapeHtml(longPageHash('bids', { coin }))}">${escapeHtml(coin)}</a>`} — минимум ${escapeHtml(mins[index] || 'не указан')}</li>`).join('')}</ul>`;
  }

  function renderLongActiveBids(rows, coin) {
    if (!Array.isArray(rows) || !rows.length) return `<p class="muted">Активных ставок${coin ? ` для ${escapeHtml(coin)}` : ''} сейчас нет или backend вернул пустой список.</p>`;
    return `<div class="table-wrap"><table aria-label="Активные ставки LONG"><caption>Активные ставки${coin ? `: ${escapeHtml(coin)}` : ''}</caption><thead><tr><th scope="col">Токен</th><th scope="col">Адрес</th><th scope="col">Сумма</th><th scope="col">Направление</th></tr></thead><tbody>${rows.map((row) => `<tr><td>${escapeHtml(row.token || row.coin || row.name || coin || '')}</td><td>${renderAccountCell(chains.minter, row.address || row.sender || row.from)}</td><td>${escapeHtml([formatLongNumber(row.amount || row.value, 8), row.send_coin || row.coin].filter(Boolean).join(' '))}</td><td>${escapeHtml(row.direction || row.predict || row.side || '')}</td></tr>`).join('')}</tbody></table></div>`;
  }

  async function renderLongBids() {
    const state = parseHash();
    const coin = String(state.coin || '').trim();
    appEl.innerHTML = '<section class="panel"><h2>LONG: ставки</h2><p>Загружаю LONG bids...</p></section>';
    setStatus('Загружаю LONG bids...', 'loading');
    const data = await fetchLongJson('/bids', coin ? { coin } : {});
    let activeBids = [];
    if (coin) {
      try { activeBids = await fetchLongJson('/bids/active', { coin }); } catch (error) { activeBids = []; }
    }
    const address = data.address || LONG_FARMING_SENDER;
    appEl.innerHTML = `<section class="panel"><h2>LONG: ставки на токены и пулы</h2>${renderLongNav('bids')}
      <p>Сервис принимает транзакции Minter с memo. Перед отправкой проверяйте монету, сумму, адрес и memo в кошельке.</p>
      <article class="card"><h3>Разрешённые монеты для отправки</h3>${renderLongAllowedCoins(data, coin)}</article>
      <article class="card"><h3>Инструкция memo</h3><p>Адрес получателя: <code>${escapeHtml(address)}</code></p><p>Memo: <code>lbid BTC +</code> или <code>lbid BTC -</code>. Вместо BTC укажите токен или пул из списка активных.</p><p class="muted">Если выбранная монета поддерживается вашим Minter-кошельком, используйте раздел «Кошелёк» и сначала сделайте предпросмотр операции.</p></article>
      <h3>Активные токены и пулы</h3>${renderLongProjects(data.projects)}
      ${coin ? `<h3>Активные ставки: ${escapeHtml(coin)}</h3>${renderLongActiveBids(Array.isArray(activeBids) ? activeBids : (activeBids.items || activeBids.bids || []), coin)}` : '<p>Выберите монету выше, чтобы открыть список активных ставок по ней.</p>'}
      ${data.file ? `<details><summary>Описание сервиса из backend</summary><div class="longtext">${escapeHtml(data.file)}</div></details>` : ''}
      ${rawJsonDetails('Исходные данные LONG bids', data)}
    </section>`;
    setStatus('LONG bids загружен из /api/smartfarm.', 'ok');
  }

  async function renderLongDeferredTxs() {
    appEl.innerHTML = '<section class="panel"><h2>LONG: отложенные транзакции</h2><p>Загружаю отложенные транзакции...</p></section>';
    setStatus('Загружаю LONG: отложенные транзакции...', 'loading');
    const data = await fetchLongJson('/deferred-txs');
    const rows = Array.isArray(data) ? data : (data.items || data.txs || []);
    appEl.innerHTML = `<section class="panel"><h2>LONG: отложенные транзакции</h2>${renderLongNav('deferred-txs')}
      <p>Таблица показывает накопленные backend отложенные отправки. Перед любыми действиями сверяйте фактическую транзакцию в Minter explorer.</p>
      ${rows.length ? `<div class="table-wrap"><table aria-label="Отложенные транзакции LONG"><caption>Отложенные транзакции LONG</caption><thead><tr><th scope="col">Адрес</th><th scope="col">Сумма</th><th scope="col">Memo</th></tr></thead><tbody>${rows.map((tx) => `<tr><td>${renderAccountCell(chains.minter, tx.to || tx.address || tx.recipient)}</td><td>${escapeHtml([formatLongNumber(tx.value || tx.amount, 8), tx.coin].filter(Boolean).join(' '))}</td><td class="longtext">${escapeHtml(tx.memo || tx.payload || '')}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">Отложенных транзакций нет или backend вернул пустой список.</p>'}
      ${rawJsonDetails('Исходные данные deferred-txs', data)}
    </section>`;
    setStatus(`LONG: отложенные транзакции загружены (${rows.length}).`, 'ok');
  }

  async function renderMinterLong() {
    const state = parseHash();
    const page = state.longPage || 'main';
    if (page === 'bids') return renderLongBids();
    if (page === 'deferred-txs') return renderLongDeferredTxs();
    return renderLongMain();
  }

  function compareDecimalStakeDesc(a, b) {
    const left = String(a && a.stake !== undefined ? a.stake : '0').replace(/\D/g, '') || '0';
    const right = String(b && b.stake !== undefined ? b.stake : '0').replace(/\D/g, '') || '0';
    if (left.length === right.length) return right.localeCompare(left);
    return right.length - left.length;
  }

  function sortDecimalValidatorsByStake(items) {
    return items.slice().sort(compareDecimalStakeDesc);
  }

  function formatDecimalPercent(value) {
    const numeric = Number(value || 0) * 100;
    if (!Number.isFinite(numeric)) return '';
    return `${Number(numeric.toFixed(2))}%`;
  }

  async function renderCosmosValidators(chain) {
    appEl.innerHTML = `<section class="panel"><h2>${escapeHtml(chain.title)} валидаторы</h2><p>Загружаю...</p></section>`;
    setStatus(`${chain.title} валидаторы: загружаю список...`, 'loading');
    const url = chain.id === 'minter' ? `${chain.explorerBase}/validators` : `${chain.apiBase}/validators/validators`;

    try {
      const controller = new AbortController();
      const timeoutId = global.setTimeout(() => controller.abort(), 8000);
      const response = await fetch(url, { signal: controller.signal });
      global.clearTimeout(timeoutId);
      if (!response.ok) throw new Error(`Validators API HTTP ${response.status}`);
      const data = await response.json();
      const source = chain.id === 'decimal' ? (data.Result || data.result || data.data || data) : data;
      const rawList = source.validators || source.data || source.result || data.validators || [];
      const list = chain.id === 'decimal' ? sortDecimalValidatorsByStake(rawList) : rawList.slice().sort((a, b) => Number(b.stake || b.power || 0) - Number(a.stake || a.power || 0));
      const renderRows = (items) => items.map((v, index) => {
        const key = chain.id === 'decimal' ? (v.evmAddress || v.address || v.operator_address || '') : (v.public_key || v.address || v.operator_address || '');
        const name = v.name || v.moniker || '';
        const icon = v.icon_url ? `<img src="${escapeHtml(v.icon_url)}" alt="" width="48" height="48" loading="lazy"> ` : '';
        const title = v.site_url && name && name !== key ? `<a href="${escapeHtml(v.site_url)}" target="_blank" rel="noopener">${icon}${escapeHtml(name)}</a>` : `${icon}${escapeHtml(name === key ? '' : name)}`;
        const minStake = v.min_stake || v.minStake || '';
        const stake = chain.id === 'decimal' ? formatDecimalAmount(v.stake || 0, 3) : formatMinterAmount(v.stake || v.power || 0);
        const minimum = chain.id === 'decimal' ? (v.mins ? formatDecimalAmount(v.mins, 3) : '') : (minStake ? formatMinterAmount(minStake) : '');
        const commission = chain.id === 'decimal' ? formatDecimalPercent(v.fee) : `${v.commission ?? ''}%`;
        const skipped = chain.id === 'decimal' ? `<td>${escapeHtml(v.skippedBlocks ?? 0)}</td>` : '';
        const symbol = chain.id === 'decimal' ? 'DEL' : 'BIP';
        return `<tr><td>${index + 1}</td><td><code id="validator-${index + 1}-key">${escapeHtml(key)}</code> <button type="button" class="copy-validator-key" data-key="${escapeHtml(key)}">копировать</button></td><td>${title}</td><td>${escapeHtml(stake)} ${symbol}${minimum ? ` (Мин. ${escapeHtml(minimum)})` : ''}</td><td>${escapeHtml(commission)}</td>${skipped}</tr>`;
      }).join('');
      const active = chain.id === 'decimal' ? list.filter((validator) => validator.kind === 'Approved') : list.filter((validator) => Number(validator.status) === 2 || validator.status === '2');
      const candidates = chain.id === 'decimal' ? list.filter((validator) => validator.kind !== 'Approved') : list.filter((validator) => Number(validator.status) === 1 || validator.status === '1');
      const keyHeader = chain.id === 'decimal' ? 'Адрес' : 'Публичный ключ';
      const skippedHeader = chain.id === 'decimal' ? '<th scope="col">Пропущено блоков</th>' : '';
      const validatorsTable = (title, rows, empty) => `<section class="subpanel"><h3>${escapeHtml(title)}</h3>${rows ? `<div class="table-wrap"><table><caption>${escapeHtml(title)}</caption><thead><tr><th scope="col">№</th><th scope="col">${keyHeader}</th><th scope="col">Название</th><th scope="col">Stake</th><th scope="col">Комиссия</th>${skippedHeader}</tr></thead><tbody>${rows}</tbody></table></div>` : `<p class="muted">${escapeHtml(empty)}</p>`}</section>`;
      const notice = chain.id === 'minter'
        ? '<p class="notice">Legacy Minter validators читали публичный endpoint https://explorer-api.minter.network/api/v2/validators, делили список на «Активные валидаторы» и «Кандидаты», сортировали по stake и позволяли копировать публичный ключ. v3 делает то же без PHP/backend runtime.</p>'
        : '<p class="notice">Legacy Decimal validators читали публичный endpoint https://api.decimalchain.com/api/v1/validators/validators из PHP, делили список по kind Approved/кандидаты, сортировали по stake и позволяли копировать evmAddress. v3 делает тот же read-only просмотр напрямую из браузера, без PHP/backend runtime.</p>';
      appEl.innerHTML = `<section class="panel"><h2>${escapeHtml(chain.title)} валидаторы</h2><p>Формы делегирования/анбонда доступны в разделах «Кошелёк» и «Отправка».</p><div id="validators-copy-status" class="muted" role="status" aria-live="polite"></div>${notice}${validatorsTable('Активные валидаторы', renderRows(active), 'Активные валидаторы не найдены.')}${validatorsTable('Кандидаты', renderRows(candidates), 'Кандидаты не найдены.')}${rawJsonDetails('Исходные данные валидаторов', data)}</section>`;
      appEl.querySelectorAll('.copy-validator-key').forEach((button) => {
        button.addEventListener('click', async () => {
          const status = document.getElementById('validators-copy-status');
          try {
            await navigator.clipboard.writeText(button.dataset.key || '');
            if (status) status.textContent = 'Публичный ключ валидатора скопирован.';
          } catch (error) {
            if (status) status.textContent = 'Не удалось скопировать публичный ключ автоматически.';
          }
        });
      });
      setStatus(`${chain.title} валидаторы загружены: ${list.length}.`, 'ok');
    } catch (error) {
      appEl.innerHTML = `<section class="panel warning-panel"><h2>${escapeHtml(chain.title)} валидаторы</h2><p>Не удалось загрузить список валидаторов из публичного API: ${escapeHtml(profiles.formatError(error))}</p><p>Формы делегирования/анбонда доступны в разделах «Кошелёк» и «Отправка». Проверьте API позже или откройте старую страницу валидаторов, если она ещё доступна.</p></section>`;
      setStatus(`${chain.title} валидаторы: публичный API недоступен.`, 'warning');
    }
  }

  async function loadDecimalExplorerOverview(chain) {
    const [blocksData, statusData] = await Promise.all([
      fetchJsonText(`${chain.apiBase}/blocks?limit=10&offset=0`, 'Decimal blocks API'),
      fetchJsonText(`${chain.apiBase}/rpc/node_info`, 'Decimal node info API').catch((error) => ({ _error: error.message }))
    ]);
    return { blocks: decimalPayloadList(blocksData, ['blocks']), status: statusData, raw: { blocksData, statusData } };
  }

  function renderDecimalExplorerOverview(chain, overview) {
    const blocks = (overview.blocks || []).slice(0, 10);
    const latest = blocks[0] || {};
    const status = overview.status || {};
    const nodeInfo = status.default_node_info || status.node_info || {};
    const rows = blocks.map((block) => {
      const height = block.height || block.number || block.id || '';
      const txsCount = block.txsCount ?? block.tx_count ?? block.transactions_count ?? 0;
      const emission = formatDecimalAmount(block.emission || 0, 3);
      return `<li>${explorerLink(chain, 'block', height, String(height))} (${escapeHtml(txsCount)} транзакций, эмиссия ${escapeHtml(emission)} DEL)</li>`;
    }).join('');
    return `<article class="card decimal-explorer-overview"><h3>Введите номер блока или хэш-сумму транзакции</h3><p>Форма выше открывает адрес, блок или транзакцию Decimal через публичные API.</p><h3 id="last_blocks">Последние блоки</h3><ul>${rows || '<li class="muted">Последние блоки не найдены.</li>'}</ul><h3 id="status">Статус</h3><ul><li>Сеть: ${escapeHtml(nodeInfo.network || status.network || '')}</li><li>Хеш последнего блока: ${escapeHtml(latest.hash || '')}</li><li>Номер последнего блока: ${escapeHtml(latest.height || '')}</li><li>Дата и время последнего блока: ${escapeHtml(latest.date || latest.timestamp || '')}</li></ul>${rawJsonDetails('Исходные данные проводника Decimal', overview.raw)}</article>`;
  }

  async function renderCosmosExplorer(chain, account) {
    const state = parseHash();
    const isDecimal = chain.id === 'decimal';
    appEl.innerHTML = `<section class="panel"><h2>${escapeHtml(isDecimal ? 'Decimal проводник' : `${chain.title} проводник`)}</h2>
      <p>${isDecimal ? 'Введите номер блока или хэш-сумму транзакции Decimal, либо адрес аккаунта. Основные данные показаны первыми; исходные данные доступны отдельно для проверки.' : 'Откройте адрес, транзакцию или блок. Основные данные показаны первыми; исходные данные доступны отдельно для проверки.'}</p>
      <form id="explorer-form" class="route-form"><div class="field"><label for="explorer-kind">Что открыть</label><select id="explorer-kind" name="kind"><option value="address" ${state.kind === 'address' ? 'selected' : ''}>Адрес</option><option value="tx" ${state.kind === 'tx' ? 'selected' : ''}>Транзакция</option><option value="block" ${state.kind === 'block' ? 'selected' : ''}>Блок</option></select></div><div class="field field-grow"><label for="explorer-value">Адрес, tx hash или номер блока</label><input id="explorer-value" name="value" type="text" value="${escapeHtml(state.value || account)}"></div><button type="submit">Открыть</button></form>
      <div id="explorer-result" class="operation-result" role="status" aria-live="polite">${isDecimal ? 'Последние блоки и Статус загрузятся автоматически; либо выберите, что открыть, и введите адрес, tx hash или номер блока.' : 'Выберите, что открыть, и введите адрес, tx hash или номер блока.'}</div></section>`;
    document.getElementById('explorer-form').addEventListener('submit', (event) => { event.preventDefault(); const form = new FormData(event.currentTarget); navigate({ chain: chain.id, app: 'explorer', account, kind: form.get('kind'), value: String(form.get('value') || '').trim() }); });
    if (!state.kind || !state.value) {
      if (chain.id === 'decimal') {
        const overview = await loadDecimalExplorerOverview(chain);
        document.getElementById('explorer-result').innerHTML = renderDecimalExplorerOverview(chain, overview);
        setStatus('Decimal проводник: последние блоки и статус загружены через публичные API.', 'ok');
        return;
      }
      if (chain.id === 'minter') {
        const overview = await loadMinterExplorerOverview(chain);
        document.getElementById('explorer-result').innerHTML = renderMinterExplorerOverview(chain, overview);
        setStatus('Minter проводник: последние блоки и статус загружены через публичные API.', 'ok');
        return;
      }
      setStatus(`${chain.title} проводник готов.`, 'info');
      return;
    }
    if (chain.id === 'minter') {
      if (state.kind === 'block') {
        const block = await loadMinterExplorerBlock(chain, state.value);
        document.getElementById('explorer-result').innerHTML = renderMinterExplorerBlock(chain, block, state.value);
        setStatus('Minter проводник: блок загружен через публичный API.', 'ok');
        return;
      }
      if (state.kind === 'tx') {
        const tx = await loadMinterExplorerTx(chain, state.value);
        document.getElementById('explorer-result').innerHTML = renderMinterExplorerTx(chain, tx, state.value);
        setStatus('Minter проводник: транзакция загружена через публичный explorer API.', 'ok');
        return;
      }
    }
    let url;
    if (chain.id === 'minter') {
      const base = chain.explorerBase;
      url = `${base}/addresses/${state.value}`;
    } else if (chain.id === 'decimal') {
      const base = chain.apiBase;
      url = state.kind === 'tx' ? `${chain.apiBase}/txs/${state.value}` : state.kind === 'block' ? `${chain.apiBase}/blocks/${state.value}` : `${chain.apiBase}/addresses/${state.value}/balances`;
    } else {
      const base = chain.apiBase;
      url = state.kind === 'tx' ? `${base}/txs/${state.value}` : state.kind === 'block' ? `${base}/blocks/${state.value}` : `${base}/addresses/${state.value}/balances`;
    }
    const response = await fetch(url);
    if (!response.ok) throw new Error(`API проводника HTTP ${response.status}`);
    const result = await response.json();
    document.getElementById('explorer-result').innerHTML = renderExplorerResult(chain, state.kind, state.value, result);
    setStatus(`${chain.title} проводник загружен.`, 'ok');
  }

  function renderCosmosCalculator(chain) {
    appEl.innerHTML = `<section class="panel"><h2>${escapeHtml(chain.title)} калькулятор</h2><form id="calculator-form" class="stacked-form"><fieldset><legend>Расчёт суммы</legend><div class="field"><label for="calc-amount">Сумма</label><input id="calc-amount" name="amount" type="text" value="1"></div><button type="submit">Перевести в единицы 10^18</button><div class="operation-result" data-operation-result role="status" aria-live="polite"></div></fieldset></form></section>`;
    document.getElementById('calculator-form').addEventListener('submit', (event) => { event.preventDefault(); const form = event.currentTarget; const amount = normalizeAmountInput(new FormData(form).get('amount'), 'Сумма'); const wei = amount.replace('.', '').padEnd((amount.split('.')[0] || '').length + 18, '0'); setOperationResult(form, `${amount} ${chain.liquidSymbol} ≈ ${wei} минимальных единиц`, 'ok'); });
    setStatus(`${chain.title} калькулятор готов.`, 'ok');
  }

  function hasExplicitRouteState(state) {
    return Object.keys(state || {}).some((key) => String(state[key] || '').trim() !== '');
  }

  function bytesToBase64(bytes) {
    let binary = '';
    const chunk = 0x8000;
    for (let index = 0; index < bytes.length; index += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(index, index + chunk));
    }
    return global.btoa(binary);
  }

  function base64ToBytes(value) {
    const binary = global.atob(String(value || ''));
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes;
  }

  function getCryptoApi() {
    const cryptoApi = global.crypto && global.crypto.subtle ? global.crypto : null;
    if (!cryptoApi) throw new Error('WebCrypto недоступен в этом браузере. Откройте сайт по HTTPS или localhost.');
    return cryptoApi;
  }

  function validateBackupPassword(password, context = {}) {
    const text = String(password || '');
    const lower = text.toLowerCase();
    const errors = [];
    const common = ['123456', '123456789', 'qwerty', 'йцукен', 'password', 'пароль', 'letmein', 'admin', 'dpos', 'dposspace', 'backup', 'denis', 'denis2026'];
    const contextWords = Object.values(context).flat().filter(Boolean).map((item) => String(item).toLowerCase()).filter((item) => item.length >= 4);
    if (text.length < 12) errors.push('Минимум 12 символов. Лучше длинная фраза из нескольких слов.');
    if (/^\d+$/.test(text)) errors.push('Пароль не должен состоять только из цифр.');
    if (/^[a-zа-яё]+$/i.test(text)) errors.push('Пароль не должен состоять только из букв без пробелов, дефисов или других символов.');
    if (/(.)\1{4,}/.test(text)) errors.push('Слишком много одинаковых символов подряд.');
    if (/(?:012345|123456|234567|345678|456789|abcdef|qwerty|йцукен)/i.test(text)) errors.push('Не используйте очевидные последовательности вроде 123456 или qwerty.');
    if (common.some((item) => lower.includes(item))) errors.push('Пароль похож на популярный или слишком очевидный пароль.');
    if (contextWords.some((item) => lower.includes(item))) errors.push('Пароль не должен содержать логин, название сети или сайта.');
    const classes = [/[a-zа-яё]/.test(text), /[A-ZА-ЯЁ]/.test(text), /\d/.test(text), /[^a-zа-яё\d]/i.test(text)].filter(Boolean).length;
    if (text.length < 20 && classes < 3) errors.push('Для короткого пароля нужны разные типы символов. Проще использовать длинную фразу.');
    return { ok: errors.length === 0, errors };
  }

  function dposBackupStorageKeys() {
    if (!global.localStorage) return [];
    const chainIds = Object.keys(chains || {});
    const keys = [];
    for (let index = 0; index < global.localStorage.length; index += 1) {
      const key = global.localStorage.key(index);
      if (!key) continue;
      const chainScoped = chainIds.some((chainId) => key === `${chainId}_users` || key === `${chainId}_current_user` || key.startsWith(`${chainId}_`));
      const appScoped = key.startsWith('dpos_') || key === 'viz_transfer_templates' || /^(?:[A-Z0-9]{2,12})_(?:transfer|donate)_templates$/.test(key);
      if (chainScoped || appScoped) keys.push(key);
    }
    return keys.sort();
  }

  function collectDposBackupStorage() {
    const storage = {};
    dposBackupStorageKeys().forEach((key) => { storage[key] = global.localStorage.getItem(key); });
    return storage;
  }

  async function deriveBackupKey(password, salt, iterations) {
    const cryptoApi = getCryptoApi();
    const encoded = new TextEncoder().encode(String(password || ''));
    const material = await cryptoApi.subtle.importKey('raw', encoded, 'PBKDF2', false, ['deriveKey']);
    return cryptoApi.subtle.deriveKey({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }

  async function encryptDposBackup(password) {
    const cryptoApi = getCryptoApi();
    const salt = cryptoApi.getRandomValues(new Uint8Array(16));
    const iv = cryptoApi.getRandomValues(new Uint8Array(12));
    const iterations = 600000;
    const payload = {
      version: 1,
      createdAt: new Date().toISOString(),
      origin: global.location.origin,
      storage: collectDposBackupStorage()
    };
    const key = await deriveBackupKey(password, salt, iterations);
    const encrypted = await cryptoApi.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(payload)));
    return {
      app: 'dpos.space',
      type: 'encrypted-localstorage-backup',
      version: 1,
      createdAt: payload.createdAt,
      warning: 'DPoS Space support will never ask for this backup file, private keys, or backup password. Do not send them to anyone.',
      kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations, salt: bytesToBase64(salt) },
      cipher: { name: 'AES-GCM', iv: bytesToBase64(iv) },
      payload: bytesToBase64(new Uint8Array(encrypted))
    };
  }

  async function decryptDposBackup(fileText, password) {
    let backup;
    try { backup = JSON.parse(fileText); } catch (error) { throw new Error('Файл backup не похож на JSON DPoS Space.'); }
    if (!backup || backup.app !== 'dpos.space' || backup.type !== 'encrypted-localstorage-backup' || !backup.payload) {
      throw new Error('Это не зашифрованный backup DPoS Space.');
    }
    if (!backup.kdf || backup.kdf.name !== 'PBKDF2' || !backup.cipher || backup.cipher.name !== 'AES-GCM') {
      throw new Error('Формат шифрования backup не поддерживается этой версией сайта.');
    }
    const key = await deriveBackupKey(password, base64ToBytes(backup.kdf.salt), Number(backup.kdf.iterations || 600000));
    let decrypted;
    try {
      decrypted = await getCryptoApi().subtle.decrypt({ name: 'AES-GCM', iv: base64ToBytes(backup.cipher.iv) }, key, base64ToBytes(backup.payload));
    } catch (error) {
      throw new Error('Не удалось расшифровать backup. Проверьте пароль и файл.');
    }
    const payload = JSON.parse(new TextDecoder().decode(decrypted));
    if (!payload || payload.version !== 1 || !payload.storage || typeof payload.storage !== 'object') throw new Error('Расшифрованный backup имеет неподдерживаемый формат.');
    return payload;
  }

  function importDposBackupStorage(storage) {
    if (!global.localStorage) throw new Error('localStorage недоступен в этом браузере.');
    const allowed = Object.entries(storage || {}).filter(([key]) => {
      const chainIds = Object.keys(chains || {});
      return chainIds.some((chainId) => key === `${chainId}_users` || key === `${chainId}_current_user` || key.startsWith(`${chainId}_`))
        || key.startsWith('dpos_') || key === 'viz_transfer_templates' || /^(?:[A-Z0-9]{2,12})_(?:transfer|donate)_templates$/.test(key);
    });
    allowed.forEach(([key, value]) => { global.localStorage.setItem(key, String(value ?? '')); });
    return { imported: allowed.length, skipped: Object.keys(storage || {}).length - allowed.length };
  }

  function backupPasswordContext() {
    const logins = [];
    Object.values(chains || {}).forEach((chain) => auth.getUsers(chain).forEach((user) => logins.push(auth.getUserLogin(user))));
    return { words: ['dpos', 'space', 'backup'].concat(Object.keys(chains || {}), logins) };
  }

  function renderDposBackupPage() {
    appEl.innerHTML = `<section class="panel">
      <h2>Резервное копирование</h2>
      <p>Здесь можно перенести локальные данные DPoS Space на другое устройство: аккаунты, настройки, уведомления, сохранённые ключи и локальные зашифрованные данные.</p>
      <p class="notice"><strong>Важно:</strong> поддержка DPoS Space никогда не просит backup-файл, приватные ключи или пароль от backup-а. Никому не отправляйте файл и пароль.</p>
      <div class="cards-grid">
        <article class="card">
          <h3>Экспорт</h3>
          <form id="backup-export-form" class="stacked-form">
            <div class="field"><label for="backup-password">Пароль backup-файла</label><input id="backup-password" name="password" type="password" required autocomplete="new-password"></div>
            <div class="field"><label for="backup-password-repeat">Повторите пароль</label><input id="backup-password-repeat" name="repeat" type="password" required autocomplete="new-password"></div>
            <p class="muted">Слабый пароль не принимается: украденный backup можно пытаться подбирать offline.</p>
            <div class="button-row">
              <button type="submit" name="exportMode" value="download">Скачать зашифрованную резервную копию</button>
              <button type="submit" name="exportMode" value="share">Поделиться backup-файлом</button>
            </div>
            <p class="muted">Кнопка «Поделиться» открывает системное меню Android/iOS/браузера, если оно поддерживает отправку файлов. Пароль передавайте отдельно.</p>
            <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
          </form>
        </article>
        <article class="card">
          <h3>Импорт</h3>
          <form id="backup-import-form" class="stacked-form">
            <div class="field"><label for="backup-file">Backup-файл DPoS Space</label><input id="backup-file" name="file" type="file" accept="application/json,.json" required></div>
            <div class="field"><label for="backup-import-password">Пароль backup-файла</label><input id="backup-import-password" name="password" type="password" required autocomplete="current-password"></div>
            <button type="submit">Импортировать резервную копию</button>
            <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
          </form>
        </article>
      </div>
    </section>`;

    const exportForm = document.getElementById('backup-export-form');
    exportForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const data = new FormData(exportForm);
      const password = String(data.get('password') || '');
      const repeat = String(data.get('repeat') || '');
      try {
        if (password !== repeat) throw new Error('Пароли не совпадают.');
        const validation = validateBackupPassword(password, backupPasswordContext());
        if (!validation.ok) throw new Error(validation.errors.join(' '));
        const keys = dposBackupStorageKeys();
        if (!keys.length) throw new Error('В localStorage пока нет данных DPoS Space для backup-а.');
        setOperationResult(exportForm, 'Шифрую backup локально в браузере...', 'loading');
        const backup = await encryptDposBackup(password);
        const date = new Date().toISOString().slice(0, 10);
        const filename = `dpos-space-backup-${date}.json`;
        const backupText = JSON.stringify(backup, null, 2);
        const exportMode = event.submitter && event.submitter.value === 'share' ? 'share' : 'download';
        if (exportMode === 'share') {
          try {
            await shareBackupFile(filename, backupText);
            setOperationResult(exportForm, `Системное меню отправки открыто для ${keys.length} локальных записей. Пароль backup-а передайте отдельно.`, 'ok');
          } catch (shareError) {
            if (shareError && shareError.name === 'AbortError') {
              setOperationResult(exportForm, 'Отправка backup-файла отменена. Файл не был скачан автоматически.', 'info');
            } else {
              downloadTextFile(filename, backupText);
              setOperationResult(exportForm, `${profiles.formatError(shareError)} Backup скачан как файл: ${keys.length} локальных записей.`, 'info');
            }
          }
        } else {
          downloadTextFile(filename, backupText);
          setOperationResult(exportForm, `Backup создан: ${keys.length} локальных записей. Храните файл и пароль отдельно.`, 'ok');
        }
      } catch (error) {
        setOperationResult(exportForm, profiles.formatError(error), 'error');
      }
    });

    const importForm = document.getElementById('backup-import-form');
    importForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const data = new FormData(importForm);
      const file = data.get('file');
      const password = String(data.get('password') || '');
      try {
        if (!file || typeof file.text !== 'function') throw new Error('Выберите backup-файл.');
        if (!password) throw new Error('Введите пароль backup-файла.');
        setOperationResult(importForm, 'Расшифровываю backup локально в браузере...', 'loading');
        const payload = await decryptDposBackup(await file.text(), password);
        const result = importDposBackupStorage(payload.storage);
        setOperationResult(importForm, `Импорт завершён: записей импортировано ${result.imported}${result.skipped ? `, пропущено ${result.skipped}` : ''}. Обновите страницу, если данные не появились сразу.`, 'ok');
      } catch (error) {
        setOperationResult(importForm, profiles.formatError(error), 'error');
      }
    });
    setStatus('Резервное копирование DPoS Space готово. Шифрование и импорт выполняются локально.', 'info');
  }

  function renderHome() {
    const featured = [
      ['Golos: история операций', appHash({ chain: 'golos', app: 'history' })],
      ['Golos: ленты и посты', appHash({ chain: 'golos', app: 'feeds' })],
      ['Golos: автоапвоутер', appHash({ chain: 'golos', app: 'auto-upvoter' })],
      ['VIZ: профиль', appHash({ chain: 'viz', app: 'profiles' })],
      ['Minter: кошелёк', appHash({ chain: 'minter', app: 'wallet' })],
      ['Decimal: кошелёк', appHash({ chain: 'decimal', app: 'wallet' })]
    ];
    const accountServices = Object.values(chains).map((chain) => [
      `${chain.title}: аккаунты`,
      appHash({ chain: chain.id, app: 'accounts' })
    ]);
    appEl.innerHTML = `<section class="panel">
      <h2>Главная</h2>
      <p>Выберите блокчейн и раздел выше или откройте один из быстрых переходов.</p>
      <h3>Быстрые переходы</h3>
      <ul>${featured.map(([label, href]) => `<li><a href="${escapeHtml(href)}">${escapeHtml(label)}</a></li>`).join('')}</ul>
      <h3>Аккаунты по блокчейнам</h3>
      <ul>${accountServices.map(([label, href]) => `<li><a href="${escapeHtml(href)}">${escapeHtml(label)}</a></li>`).join('')}</ul>
    </section>`;
    setStatus('Главная страница DPOS.space готова. Выберите блокчейн и раздел.', 'info');
  }

  async function renderHistory(chain, account) {
    appEl.innerHTML = '<section class="panel"><h2>Загрузка истории</h2><p>Читаю последние операции аккаунта...</p></section>';
    setStatus(`Загружаю историю ${chain.title}: @${account}...`, 'loading');

    const state = parseHash();
    const selectedOps = state.ops ? state.ops.split(',').map((item) => item.trim()).filter(Boolean) : [];
    const query = state.query || '';
    const connection = await getConnection(chain);
    let items = await history.fetchAccountHistory(connection, account, { limit: 100, ops: selectedOps });

    if (query) {
      const needle = query.toLowerCase();
      items = items.filter((item) => JSON.stringify(item).toLowerCase().includes(needle));
    }

    appEl.innerHTML = `
      <section class="panel">
        <h2>${escapeHtml(chain.title)}: история @${escapeHtml(account)}</h2>
        <form id="history-filter" class="route-form">
          <div class="field field-grow">
            <label for="history-ops">Операции</label>
            <select id="history-ops" name="ops" multiple size="8">
              ${renderOperationSelectOptions(chain, selectedOps)}
            </select>
            <small class="muted">Выберите одну или несколько операций. Названия соответствуют старой версии; в скобках показан технический код.</small>
          </div>
          <div class="field field-grow">
            <label for="history-query">Поиск по данным операции</label>
            <input id="history-query" name="query" type="text" value="${escapeHtml(query)}" placeholder="memo или аккаунт">
          </div>
          <button type="submit">Фильтровать</button>
        </form>
        ${renderHistoryTable(items, chain, 'Операции не найдены в последней выборке.')}
      </section>
    `;

    document.getElementById('history-filter').addEventListener('submit', (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const selectedOps = Array.from(document.getElementById('history-ops').selectedOptions).map((option) => option.value);
      navigate({
        chain: chain.id,
        app: 'history',
        account,
        ops: selectedOps.join(','),
        query: String(form.get('query') || '').trim()
      });
    });

    setStatus(`История @${account} загружена: ${items.length} операций.`, 'ok');
  }

  async function renderProfileRoute(chain, account) {
    appEl.innerHTML = '<section class="panel"><h2>Загрузка профиля</h2><p>Подключаю библиотеку и публичную ноду...</p></section>';
    const initialLabel = chain.id === 'minter' || chain.id === 'decimal' ? account : `@${account}`;
    setStatus(`Загружаю ${chain.title}: ${initialLabel}...`, 'loading');

    if (chain.id === 'minter' || chain.id === 'decimal') {
      await loadScript(chain.cryptoPath);
      if (chain.walletPath) await loadScript(chain.walletPath);
    }
    const resolvedAccount = (chain.id === 'minter' || chain.id === 'decimal') ? resolveSeedWalletAddress(chain, account) : account;
    const connection = await getConnection(chain);
    const rawAccount = await profiles.fetchAccount(connection, resolvedAccount);
    if (chain.id === 'golos') {
      rawAccount.uiaBalances = await fetchGolosUiaBalances(connection, account);
      rawAccount.golosProfileExtras = await fetchGolosProfileExtras(connection, account);
    } else if (chain.id === 'steem') {
      rawAccount.steemProfileExtras = await fetchSteemProfileExtras(connection, account);
    } else if (chain.id === 'hive') {
      rawAccount.hiveProfileExtras = await fetchHiveProfileExtras(connection, account);
    }
    const enrichedAccount = await profiles.enrichAccount(connection, rawAccount);
    renderProfile(profiles.normalizeAccount(connection, enrichedAccount));
    const accountLabel = chain.id === 'minter' || chain.id === 'decimal' ? resolvedAccount : `@${account}`;
    setStatus(`Профиль ${chain.title}: ${accountLabel} загружен.`, 'ok');
  }

  function renderNotificationsPage(chain, account) {
    if (!notifications || !notifications.supportsChain(chain)) {
      appEl.innerHTML = `<section class="panel"><h2>Уведомления недоступны</h2><p>Для ${escapeHtml(chain.title)} нет браузерного сервиса уведомлений без backend.</p></section>`;
      setStatus(`Уведомления ${chain.title}: сервис недоступен.`, 'info');
      return;
    }
    const items = notifications.filteredNotifications({ direction: 'all' });
    const rows = items.length ? `<ul class="notifications-list notifications-list-full">${items.map((item) => `<li><a href="${escapeHtml(item.url || '#')}"><strong>${escapeHtml(item.title)}</strong><br><span>${escapeHtml(item.chainTitle || item.chainId)} / @${escapeHtml(item.account)}: ${escapeHtml(item.text || '')}</span></a><br><span class="muted">${escapeHtml(history.formatDate(item.timestamp) || item.timestamp || `операция #${item.sourceIndex}`)}</span></li>`).join('')}</ul>` : '<p class="muted">Непрочитанных уведомлений нет. Откройте верхнюю панель и нажмите «Обновить», если нужно проверить сейчас.</p>';
    appEl.innerHTML = `<section class="panel">
      <h2>Все непрочитанные уведомления</h2>
      <p>Показываются локально сохранённые уведомления для аккаунтов Golos из браузера. Награды не включены, чтобы не создавать шум.</p>
      <p><button type="button" data-notifications-page-read>Отметить всё прочитанным</button></p>
      ${rows}
    </section>`;
    const readButton = appEl.querySelector('[data-notifications-page-read]');
    if (readButton) readButton.addEventListener('click', () => {
      notifications.markAllRead();
      renderNotificationsPage(chain, account);
      setStatus('Все уведомления отмечены прочитанными.', 'ok');
    });
    setStatus(`Уведомления ${chain.title}: показано ${items.length}.`, 'ok');
  }

  async function renderRoute() {
    const state = parseHash();
    if (!hasExplicitRouteState(state)) {
      const chain = chains.golos || Object.values(chains)[0];
      const app = chain.apps[0];
      fillChainSelect(chain.id);
      fillAppSelect(chain, app.id);
      updateAccountField(app, chain);
      accountInput.value = '';
      renderHome();
      return;
    }

    if (state.app === 'backup' && !state.chain) {
      const chain = chains.golos || Object.values(chains)[0];
      const app = chain.apps[0];
      fillChainSelect(chain.id);
      fillAppSelect(chain, app.id);
      updateAccountField(app, chain);
      accountInput.value = '';
      renderDposBackupPage();
      return;
    }

    const chain = chains[state.chain] || chains.viz;
    const requestedAppId = legacyAppTarget(chain, state.app);
    const app = chain.apps.find((item) => item.id === requestedAppId) || chain.apps[0];
    const effectiveAppId = app.id;
    const account = getRouteAccount(state, chain);

    fillChainSelect(chain.id);
    fillAppSelect(chain, app.id);
    updateAccountField(app, chain);
    accountInput.value = account;

    try {
      if (chain.id === 'minter' && effectiveAppId === 'broadcast') {
        renderMinterBroadcast(chain);
      } else if (chain.id === 'decimal' && effectiveAppId === 'broadcast') {
        await renderDecimalWallet(chain, account);
      } else if (chain.id === 'minter' && (effectiveAppId === 'wallet' || effectiveAppId === 'swap' || effectiveAppId === 'my-coin')) {
        await renderMinterWallet(chain, account);
      } else if (chain.id === 'decimal' && (effectiveAppId === 'wallet' || effectiveAppId === 'swap' || effectiveAppId === 'my-coin')) {
        await renderDecimalWallet(chain, account);
      } else if (isCosmosChain(chain) && (effectiveAppId === 'wallet' || effectiveAppId === 'swap' || effectiveAppId === 'my-coin')) {
        renderCosmosWallet(chain, account);
      } else if (isCosmosChain(chain) && effectiveAppId === 'validators') {
        await renderCosmosValidators(chain);
      } else if (isCosmosChain(chain) && effectiveAppId === 'explorer') {
        await renderCosmosExplorer(chain, account);
      } else if (isCosmosChain(chain) && effectiveAppId === 'calculator') {
        renderCosmosCalculator(chain);
      } else if (isCosmosChain(chain) && effectiveAppId === 'randomblockchain') {
        renderRandomBlockchain(chain);
      } else if (chain.id === 'minter' && effectiveAppId === 'long') {
        await renderMinterLong();
      } else if (effectiveAppId === 'profiles') {
        await renderProfileRoute(chain, account);
      } else if (effectiveAppId === 'accounts') {
        await renderAccounts(chain);
      } else if (effectiveAppId === 'wallet') {
        await renderGrapheneWalletByChain(chain, account);
      } else if (effectiveAppId === 'history') {
        await renderHistory(chain, account);
      } else if (effectiveAppId === 'broadcast') {
        await renderBroadcast(chain);
      } else if (chain.id === 'viz' && effectiveAppId === 'award') {
        renderVizAward(chain, state);
      } else if (chain.id === 'viz' && effectiveAppId === 'analytics') {
        renderVizAnalytics(chain);
      } else if (chain.id === 'viz' && effectiveAppId === 'polls') {
        renderVizPolls(chain);
      } else if (chain.id === 'viz' && effectiveAppId === 'projects') {
        renderVizProjects(chain);
      } else if (chain.id === 'viz' && effectiveAppId === 'custom-generator') {
        renderVizCustomGenerator(chain);
      } else if ((chain.id === 'golos' || isHiveOrSteem(chain)) && effectiveAppId === 'auto-upvoter') {
        await renderGolosAutoUpvoter(chain);
      } else if (chain.id === 'golos' && effectiveAppId === 'feeds') {
        await renderGolosFeedsPage(chain, state);
      } else if (chain.id === 'golos' && effectiveAppId === 'notifications') {
        renderNotificationsPage(chain, account);
      } else if (chain.id === 'golos' && effectiveAppId === 'post') {
        await renderGolosPostPage(chain, state);
      } else if (isHiveOrSteem(chain) && effectiveAppId === 'feeds') {
        await renderSocialFeedsPage(chain, state);
      } else if (isHiveOrSteem(chain) && effectiveAppId === 'post') {
        await renderSocialPostPage(chain, state);
      } else if (chain.id === 'golos' && effectiveAppId === 'donate') {
        await renderGolosDonate(chain, state);
      } else if (chain.id === 'viz' && effectiveAppId === 'search') {
        renderVizSearch(chain, state);
      } else if (chain.id === 'viz' && effectiveAppId === 'voice-import') {
        renderVizVoiceImport(chain);
      } else if (chain.id === 'viz' && effectiveAppId === 'vmp') {
        renderVizVmp(chain);
      } else if (chain.id === 'viz' && effectiveAppId === 'top') {
        renderVizTop(chain);
      } else if (chain.id === 'golos' && effectiveAppId === 'top') {
        renderGolosTop(chain);
      } else if (chain.id === 'golos' && effectiveAppId === 'witnesses-rewards') {
        renderGolosWitnessesRewards(chain);
      } else if (chain.id === 'viz' && effectiveAppId === 'witnesses-rewards') {
        renderVizWitnessesRewards(chain);
      } else if (chain.id === 'steem' && effectiveAppId === 'backup') {
        await renderSteemBackup(chain, account);
      } else if (chain.id === 'hive' && effectiveAppId === 'backup') {
        await renderHiveBackup(chain, account);
      } else if (effectiveAppId === 'editor') {
        renderEditor(chain, state);
      } else if (effectiveAppId === 'calculator') {
        await renderCalculator(chain, account);
      } else if (effectiveAppId === 'manage') {
        renderManage(chain);
      } else if (effectiveAppId === 'explorer') {
        await renderExplorer(chain, account);
      } else if (chain.id === 'viz' && effectiveAppId === 'exchanges') {
        renderVizExchanges(chain);
      } else if (chain.id === 'minter' && effectiveAppId === 'help') {
        renderMinterHelp(chain);
      } else if (chain.id === 'viz' && effectiveAppId === 'help') {
        renderVizHelp(chain);
      } else if (chain.id === 'steem' && effectiveAppId === 'help') {
        renderSteemHelp(chain);
      } else if (effectiveAppId === 'import') {
        renderImport(chain);
      } else if (effectiveAppId === 'instant-view') {
        renderInstantView(chain);
      } else if (effectiveAppId === 'swap') {
        renderSwap(chain);
      } else if (effectiveAppId === 'register' || effectiveAppId === 'registration') {
        renderRegister(chain);
      } else if (effectiveAppId === 'randomblockchain') {
        renderRandomBlockchain(chain);
      } else {
        renderServicePlaceholder(chain, app);
      }
      if (appRequiresAccount(app) && !appUsesAuthorizedAccount(app)) rememberRecentAccount(chain, account);
    } catch (error) {
      appEl.innerHTML = `
        <section class="panel error-panel">
          <h2>Не удалось загрузить раздел</h2>
          <p>${escapeHtml(profiles.formatError(error))}</p>
          <p>Возможные причины: публичная нода недоступна, WebSocket/CORS ограничен, аккаунт не найден.</p>
        </section>
      `;
      setStatus(`Ошибка загрузки: ${profiles.formatError(error)}`, 'error');
      console.error(error);
    }
  }

  chainSelect.addEventListener('change', () => {
    const chain = chains[chainSelect.value];
    const app = chain.apps[0];
    fillAppSelect(chain, app.id);
    updateAccountField(app, chain);
    accountInput.value = auth.getCurrentLogin(chain) || chain.defaultAccount || '';
  });

  appSelect.addEventListener('change', () => {
    const chain = chains[chainSelect.value];
    const app = chain.apps.find((item) => item.id === appSelect.value) || chain.apps[0];
    updateAccountField(app, chain);
  });

  if (accountSelect) {
    accountSelect.addEventListener('change', () => {
      const chain = chains[chainSelect.value];
      const login = selectSavedAccount(chain, accountSelect.value);
      if (login && !accountInput.disabled) accountInput.value = login;
    });
  }

  routeForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const chain = chains[chainSelect.value];
    const app = chain.apps.find((item) => item.id === appSelect.value) || chain.apps[0];
    const selectedLogin = accountSelect && !accountSelect.disabled ? selectSavedAccount(chain, accountSelect.value) : '';
    const typedLogin = appRequiresAccount(app) && !accountInput.disabled ? accountInput.value.trim().replace(/^@/, '') : '';
    if (typedLogin && !appUsesAuthorizedAccount(app)) rememberRecentAccount(chain, typedLogin);
    navigate({
      chain: chainSelect.value,
      app: appSelect.value,
      account: appRequiresAccount(app) || appUsesAuthorizedAccount(app) ? (selectedLogin || typedLogin || null) : null
    });
  });

  global.addEventListener('hashchange', () => {
    renderRoute();
    if (notificationsController && typeof notificationsController.refresh === 'function') notificationsController.refresh();
    else if (notifications && notificationsPanel) notifications.renderPanel(notificationsPanel, chains, '');
  });
  if (notifications && notificationsPanel) {
    notificationsController = notifications.init(notificationsPanel, chains, { setStatus });
  }
  if (pwa && pwaPanel && typeof pwa.init === 'function') {
    pwa.init(pwaPanel);
  }
  global.DposV3 = Object.freeze({
    navigate,
    renderRoute,
    appRequiresAccount,
    backup: Object.freeze({ validateBackupPassword, dposBackupStorageKeys, makeShareFile, canShareBackupFile }),
    transactions: Object.freeze({ summarizeMinterMultisend, renderMinterMultisendDetailsHtml }),
    long: Object.freeze({ parseJsonMaybeText, calcLongPoolStats, calcLongProviderRows })
  });

  renderRoute();
})(window);
