(function bootstrapDposV3(global) {
  'use strict';

  const chains = global.DposChains;
  const profiles = global.DposProfiles;
  const chainSelect = document.getElementById('chain-select');
  const appSelect = document.getElementById('app-select');
  const routeForm = document.getElementById('route-form');
  const accountInput = document.getElementById('account-input');
  const statusEl = document.getElementById('status');
  const appEl = document.getElementById('app');
  const loadedScripts = new Set();

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function setStatus(message, type) {
    statusEl.textContent = message;
    statusEl.dataset.type = type || 'info';
  }

  function parseHash() {
    const raw = global.location.hash.replace(/^#/, '');
    return Object.fromEntries(new URLSearchParams(raw));
  }

  function navigate(nextState) {
    const params = new URLSearchParams(parseHash());
    Object.entries(nextState).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') params.delete(key);
      else params.set(key, value);
    });
    global.location.hash = params.toString();
  }

  function loadScript(src) {
    if (loadedScripts.has(src)) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.async = false;
      script.onload = () => {
        loadedScripts.add(src);
        resolve();
      };
      script.onerror = () => reject(new Error(`Не удалось загрузить библиотеку: ${src}`));
      document.head.appendChild(script);
    });
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

  function renderProfile(profile) {
    const balances = profile.balances.map(([label, value]) => (
      `<li><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</li>`
    )).join('');

    const witnessVotes = profile.witnessVotes.length
      ? `<details><summary>Голоса за делегатов (${profile.witnessVotes.length})</summary><p>${profile.witnessVotes.map(escapeHtml).join(', ')}</p></details>`
      : '';

    appEl.innerHTML = `
      <section class="panel">
        <h2>${escapeHtml(profile.chain)}: @${escapeHtml(profile.name)}</h2>
        <p><strong>Нода:</strong> ${escapeHtml(profile.node)}</p>
        <div class="cards">
          <article class="card">
            <h3>Профиль</h3>
            <ul>
              <li><strong>Отображаемое имя:</strong> ${escapeHtml(profile.displayName)}</li>
              ${profile.about ? `<li><strong>О себе:</strong> ${escapeHtml(profile.about)}</li>` : ''}
              ${profile.location ? `<li><strong>Локация:</strong> ${escapeHtml(profile.location)}</li>` : ''}
              ${profile.website ? `<li><strong>Сайт:</strong> <a href="${escapeHtml(profile.website)}" target="_blank" rel="noopener">${escapeHtml(profile.website)}</a></li>` : ''}
              ${profile.created ? `<li><strong>Создан:</strong> ${escapeHtml(profile.created)}</li>` : ''}
              ${profile.lastVoteTime ? `<li><strong>Последнее голосование:</strong> ${escapeHtml(profile.lastVoteTime)}</li>` : ''}
            </ul>
          </article>
          <article class="card">
            <h3>Балансы</h3>
            <ul>${balances || '<li>Нет данных о балансах.</li>'}</ul>
          </article>
        </div>
        ${profile.proxy ? `<p><strong>Прокси:</strong> ${escapeHtml(profile.proxy)}</p>` : ''}
        ${witnessVotes}
        <details>
          <summary>Сырой JSON аккаунта</summary>
          <pre>${escapeHtml(JSON.stringify(profile.raw, null, 2))}</pre>
        </details>
      </section>
    `;
  }

  function renderUnsupported(chain, app) {
    appEl.innerHTML = `
      <section class="panel">
        <h2>${escapeHtml(chain.title)}: ${escapeHtml(app.title)}</h2>
        <p>Этот раздел пока не перенесён в статическую версию.</p>
      </section>
    `;
  }

  async function renderRoute() {
    const state = parseHash();
    const chain = chains[state.chain] || chains.viz;
    const app = chain.apps.find((item) => item.id === state.app) || chain.apps[0];
    const account = state.account || chain.defaultAccount || '';

    fillChainSelect(chain.id);
    fillAppSelect(chain, app.id);
    accountInput.value = account;

    if (app.id !== 'profiles') {
      renderUnsupported(chain, app);
      setStatus('Раздел пока не перенесён.', 'info');
      return;
    }

    appEl.innerHTML = '<section class="panel"><h2>Загрузка профиля</h2><p>Подключаю библиотеку и публичную ноду...</p></section>';
    setStatus(`Загружаю ${chain.title}: @${account}...`, 'loading');

    try {
      await loadScript(chain.libraryPath);
      const connection = await profiles.connect(chain);
      const rawAccount = await profiles.fetchAccount(connection, account);
      renderProfile(profiles.normalizeAccount(connection, rawAccount));
      setStatus(`Профиль ${chain.title}: @${account} загружен.`, 'ok');
    } catch (error) {
      appEl.innerHTML = `
        <section class="panel error-panel">
          <h2>Не удалось загрузить профиль</h2>
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
    fillAppSelect(chain, chain.apps[0].id);
    accountInput.value = chain.defaultAccount || '';
  });

  routeForm.addEventListener('submit', (event) => {
    event.preventDefault();
    navigate({
      chain: chainSelect.value,
      app: appSelect.value,
      account: accountInput.value.trim().replace(/^@/, '')
    });
  });

  global.addEventListener('hashchange', renderRoute);
  global.DposV3 = Object.freeze({ navigate, renderRoute });

  renderRoute();
})(window);
