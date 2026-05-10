(function bootstrapDposV3(global) {
  'use strict';

  const chains = global.DposChains;
  const auth = global.DposAuth;
  const broadcast = global.DposBroadcast;
  const profiles = global.DposProfiles;
  const history = global.DposHistory;
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

  function setStatus(message, state) {
    statusEl.textContent = message;
    statusEl.dataset.state = state || 'info';
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
    if (!src || loadedScripts.has(src)) return Promise.resolve();
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

  function getRouteAccount(state, chain) {
    return state.account || auth.getCurrentLogin(chain) || chain.defaultAccount || '';
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
    return `<details class="raw-json"><summary>${escapeHtml(title || 'Raw JSON')}</summary><pre>${escapeHtml(JSON.stringify(value, null, 2))}</pre></details>`;
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
      return `<article class="card"><h3>Транзакция ${escapeHtml(value)}</h3>${profileRows(summaryRows)}</article>${renderOperationsTable(operations, chain, `Операции транзакции ${value}`)}${rawJsonDetails('Raw JSON транзакции', result)}`;
    }
    if (kind === 'block') {
      const block = result.result || result.data || result;
      const transactions = block.transactions || block.ops || block.operations || [];
      return `<article class="card"><h3>Блок ${escapeHtml(value)}</h3>${renderExplorerFields(chain, block, { skip: ['transactions', 'ops', 'operations'] })}</article>${transactions.length ? renderOperationsTable(transactions, chain, `Операции блока ${value}`) : '<p class="muted">В блоке нет операций или API не вернул их списком.</p>'}${rawJsonDetails('Raw JSON блока', result)}`;
    }
    return `<article class="card"><h3>${chain.id === 'minter' || chain.id === 'decimal' ? 'Адрес' : 'Аккаунт'} ${escapeHtml(value)}</h3>${renderExplorerFields(chain, result.result || result.data || result)}</article>${rawJsonDetails('Raw JSON аккаунта', result)}`;
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
      if (['from', 'sender', 'address', 'delegator', 'owner', 'account', 'creator', 'to', 'recipient', 'receiver', 'target', 'validator', 'amount', 'value', 'stake', 'coin', 'denom', 'symbol', 'memo', 'payload', 'comment', 'title', 'url'].includes(key)) continue;
      if (value === undefined || value === null || value === '') continue;
      details.push(`${key}: ${history.formatValue(value)}`);
      if (details.length >= 4) break;
    }
    return details.join('; ');
  }

  function renderAccountCell(chain, value) {
    const text = String(value || '').trim();
    if (!text) return '';
    if (chain.id === 'minter') return /^Mx[0-9a-fA-F]{40}$/.test(text) ? accountLink(chain, text) : escapeHtml(text);
    if (chain.id === 'decimal') return /^(dx|0x)[0-9a-fA-F]{40}$/.test(text) ? accountLink(chain, text) : escapeHtml(text);
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
              <th scope="col">Block</th>
              <th scope="col">Tx</th>
            </tr>
          </thead>
          <tbody>${rows.map((row) => {
            const displayAmount = history.formatChainAmount ? history.formatChainAmount(chain, 'amount', row.amount) : row.amount;
            const amount = [displayAmount, row.coin].filter(Boolean).join(' ');
            const details = row.memo || transactionDetails(row);
            return `<tr>
              <td>${escapeHtml(history.formatDate(row.timestamp))}</td>
              <td><code>${escapeHtml(row.type)}</code><br><span class="muted">${escapeHtml(history.operationTitle(row.type))}</span></td>
              <td>${renderAccountCell(chain, row.from)}</td>
              <td>${renderAccountCell(chain, row.to)}</td>
              <td>${escapeHtml(amount)}</td>
              <td class="longtext">${escapeHtml(details)}</td>
              <td>${row.block ? explorerLink(chain, 'block', row.block, String(row.block)) : ''}</td>
              <td>${row.trxId ? explorerLink(chain, 'tx', row.trxId, String(row.trxId).slice(0, 12)) : ''}</td>
            </tr>`;
          }).join('')}</tbody>
        </table>
      </div>`;
  }

  function renderProfile(profile) {
    const balanceRows = profile.balances.map(([label, value]) => [label, value]);
    const socialRows = profile.socials.map(([label, value]) => [label, value]);
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
        ${detailsSection('Балансы', balanceRows, 'Нет данных о балансах.')}
        ${detailsSection('Экономика / vesting / staking', profile.economyRows, 'Нет доступных экономических полей.')}
        ${detailsSection('Профиль и публичная metadata', profile.profileRows, 'Профильная metadata не заполнена.')}
        ${socialRows.length ? detailsSection('Социальные ссылки из metadata', socialRows) : ''}
        ${profile.restRows && profile.restRows.length ? detailsSection('Адрес / REST-детали', profile.restRows) : ''}
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
            <summary>JSON metadata</summary>
            ${Object.keys(profile.metadataJson || {}).length ? `<h3>json_metadata</h3><pre>${escapeHtml(JSON.stringify(profile.metadataJson, null, 2))}</pre>` : ''}
            ${Object.keys(profile.postingMetadataJson || {}).length ? `<h3>posting_json_metadata</h3><pre>${escapeHtml(JSON.stringify(profile.postingMetadataJson, null, 2))}</pre>` : ''}
          </details>` : ''}
        <details>
          <summary>Сырой JSON аккаунта/API</summary>
          <pre>${escapeHtml(JSON.stringify(profile.raw, null, 2))}</pre>
        </details>
      </section>
    `;
  }

  function renderUnsupported(chain, app) {
    appEl.innerHTML = `
      <section class="panel">
        <h2>${escapeHtml(chain.title)}: ${escapeHtml(app.title)}</h2>
        <p>Этот раздел не входит в текущий статический перенос или требует отдельного подтверждённого flow.</p>
      </section>
    `;
  }

  function renderPrepared(prepared) {
    return rawJsonDetails('Технический payload для проверки', broadcast.sanitizePrepared(prepared));
  }

  function setOperationResult(form, message, state, prepared, result) {
    const resultEl = form.querySelector('[data-operation-result]');
    resultEl.dataset.state = state || 'info';
    const warnings = prepared && prepared.meta && prepared.meta.warnings && prepared.meta.warnings.length
      ? `<ul class="warnings">${prepared.meta.warnings.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
      : '';
    const summary = prepared ? `<p><strong>Кратко перед отправкой:</strong> ${escapeHtml(operationSummary(prepared))}</p>` : '';
    const resultBlock = result ? rawJsonDetails('Технический ответ broadcast', broadcast.sanitizeResult(result)) : '';
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

  function bindMaxButtons(root) {
    root.querySelectorAll('[data-fill-target]').forEach((button) => {
      button.addEventListener('click', () => {
        const target = root.querySelector(`#${button.dataset.fillTarget}`);
        if (target) target.value = button.dataset.fillValue || '';
      });
    });
  }

  function normalizeAccountInput(chain, value, label) {
    return broadcast.validateAccountName(chain, value, label);
  }

  function normalizeAssetInput(chain, value, symbols, label) {
    return broadcast.validateAsset(chain, value, symbols, label);
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
        const prepared = buildPrepared(new FormData(form));
        const submitter = event.submitter;
        const intent = submitter && submitter.value === 'send' ? 'send' : 'preview';

        if (intent === 'preview') {
          const result = await broadcast.broadcast(chain, prepared, { dryRun: true });
          setOperationResult(form, result.message, 'ok', prepared);
          return;
        }

        const confirmed = global.confirm(`Отправить реальную транзакцию?\n${operationSummary(prepared)}\nПроверьте получателя, сумму и memo перед отправкой.`);
        if (!confirmed) {
          setOperationResult(form, 'Отправка отменена пользователем. Preview операции ниже.', 'info', prepared);
          return;
        }

        if (submitter) submitter.disabled = true;
        setOperationResult(form, 'Подключаю публичную ноду для broadcast...', 'loading', prepared);
        await profiles.connect(chain);
        setOperationResult(form, 'Отправляю транзакцию в сеть...', 'loading', prepared);
        const result = await broadcast.broadcast(chain, prepared, { dryRun: false, confirmExecute: true });
        setOperationResult(form, 'Транзакция отправлена. Ответ сети ниже.', 'ok', prepared, result);
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

  async function renderAccounts(chain) {
    await loadScript(chain.cryptoPath);
    const users = auth.getUsers(chain);
    const current = auth.getCurrentUser(chain);
    const currentLogin = auth.getUserLogin(current);
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
        </li>`;
    }).join('');

    appEl.innerHTML = `
      <section class="panel">
        <h2>${escapeHtml(chain.title)}: legacy-аккаунты</h2>
        <p>v3 читает те же ключи localStorage, что и старый сайт: <code>${escapeHtml(chain.id)}_current_user</code> и <code>${escapeHtml(chain.id)}_users</code>. Новая схема не создаётся.</p>
        ${currentLogin ? `<p><strong>Текущий аккаунт:</strong> @${escapeHtml(currentLogin)}. ${escapeHtml(keyStatusText(auth.getKeyStatus(chain, current)))}</p>` : '<p><strong>Текущий аккаунт не выбран.</strong></p>'}
        ${users.length ? `
          <form id="legacy-account-form">
            <fieldset>
              <legend>Сохранённые аккаунты</legend>
              <ul>${rows}</ul>
            </fieldset>
            <button type="submit">Выбрать аккаунт</button>
          </form>` : '<p>В legacy localStorage для этой сети аккаунты не найдены.</p>'}
        <p class="notice">Добавление и удаление аккаунтов в v3 пока не реализованы, чтобы не сломать старый формат. Используйте старый интерфейс для изменения списка.</p>
      </section>
    `;

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
        setStatus(`Аккаунт @${auth.getUserLogin(user)} выбран в legacy localStorage.`, 'ok');
      });
    }

    setStatus(users.length ? 'Список legacy-аккаунтов загружен.' : 'Legacy-аккаунты не найдены.', users.length ? 'ok' : 'info');
  }

  function renderHistoryTable(items, chain, emptyText) {
    return renderTransactionsTable(items, chain, {
      caption: `История операций ${chain.title}`,
      emptyText: emptyText || 'Операции не найдены.'
    });
  }

  async function getConnection(chain) {
    await loadScript(chain.libraryPath);
    return profiles.connect(chain);
  }

  async function renderWallet(chain, account) {
    appEl.innerHTML = '<section class="panel"><h2>Загрузка кошелька</h2><p>Подключаю публичную ноду...</p></section>';
    setStatus(`Загружаю кошелёк ${chain.title}: @${account}...`, 'loading');

    await loadScript(chain.cryptoPath);
    const current = auth.getCurrentUser(chain);
    const connection = await getConnection(chain);
    const rawAccount = await profiles.fetchAccount(connection, account);
    const profile = profiles.normalizeAccount(connection, rawAccount);
    const items = await history.fetchAccountHistory(connection, account, { limit: 100 });
    const walletItems = history.getWalletOperations(chain, items).slice(0, 50);

    appEl.innerHTML = `
      <section class="panel">
        <h2>${escapeHtml(chain.title)}: кошелёк @${escapeHtml(account)}</h2>
        <p><strong>Нода:</strong> ${escapeHtml(profile.node)}</p>
        <p><strong>Legacy auth:</strong> ${escapeHtml(keyStatusText(auth.getKeyStatus(chain, current)))}</p>
        <p class="notice">Формы ниже умеют делать preview и реальный broadcast. Реальная отправка запускается отдельной кнопкой и обычным confirm в браузере.</p>
        <h3>Балансы</h3>
        <ul>${profile.balances.map(([label, value]) => `<li><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</li>`).join('') || '<li>Нет данных о балансах.</li>'}</ul>
        ${walletCapabilities(chain)}
        ${walletPrepareForms(chain, profile)}
        <h3>Последние финансовые операции</h3>
        ${renderHistoryTable(walletItems, chain, 'Финансовые операции не найдены в последней выборке.')}
      </section>
    `;

    bindWalletForms(chain);
    bindMaxButtons(appEl);
    setStatus(`Кошелёк @${account} загружен: доступны preview, Max buttons и real broadcast формы.`, 'ok');
  }

  function walletCapabilities(chain) {
    const capabilities = {
      golos: ['GOLOS/GBG balances', 'vesting/СГ', 'delegation', 'transfer', 'transfer_to_vesting', 'donate там, где старый API доступен', 'TIP операции pending'],
      viz: ['VIZ balance', 'SHARES', 'energy/awards', 'transfer', 'transfer_to_vesting', 'delegate_vesting_shares', 'invite operations pending'],
      hive: ['HIVE/HBD balances', 'HP/VESTS', 'savings', 'reward claim', 'delegations', 'transfer', 'transfer_to_vesting'],
      steem: ['STEEM/SBD balances', 'SP/VESTS', 'savings', 'reward claim', 'delegations', 'transfer', 'transfer_to_vesting']
    }[chain.id] || [];

    return `
      <h3>Особенности кошелька ${escapeHtml(chain.title)}</h3>
      <ul>${capabilities.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
  }

  function walletPrepareForms(chain, profile) {
    const liquid = chain.liquidSymbol || 'TOKEN';
    const debt = chain.debtSymbol || 'TOKEN';
    const vesting = chain.vestingSymbol || 'VESTS';
    const supportsClaim = chain.id === 'golos' || chain.id === 'hive' || chain.id === 'steem';
    const supportsSavings = chain.id !== 'viz';
    const liquidMax = profile ? pickBalance(profile, liquid) : '';
    const debtMax = profile && debt ? pickBalance(profile, debt) : '';
    const vestingMax = profile ? pickBalance(profile, vesting) : '';
    return `
      <h3>Операции кошелька</h3>
      <form id="wallet-transfer-form" class="stacked-form">
        <fieldset>
          <legend>Transfer (${escapeHtml(liquid)})</legend>
          <div class="field"><label for="wallet-transfer-to">Получатель</label><input id="wallet-transfer-to" name="to" type="text" required autocomplete="off"></div>
          <div class="field"><label for="wallet-transfer-amount">Сумма с символом</label><input id="wallet-transfer-amount" name="amount" type="text" required placeholder="1.000 ${escapeHtml(liquid)}">${liquidMax ? ` <button type="button" data-fill-target="wallet-transfer-amount" data-fill-value="${escapeHtml(liquidMax)}">Max ${escapeHtml(liquidMax)}</button>` : ''}</div>
          <div class="field"><label for="wallet-transfer-memo">Memo</label><input id="wallet-transfer-memo" name="memo" type="text"></div>
          <button type="submit" name="intent" value="preview">Preview transfer</button>
          <button type="submit" name="intent" value="send">Отправить transfer реально</button>
          <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
        </fieldset>
      </form>
      <form id="wallet-vesting-form" class="stacked-form">
        <fieldset>
          <legend>Transfer_to_vesting / power up</legend>
          <div class="field"><label for="wallet-vesting-to">Получатель power up</label><input id="wallet-vesting-to" name="to" type="text" autocomplete="off" placeholder="пусто = текущий аккаунт"></div>
          <div class="field"><label for="wallet-vesting-amount">Сумма с символом</label><input id="wallet-vesting-amount" name="amount" type="text" required placeholder="1.000 ${escapeHtml(liquid)}">${liquidMax ? ` <button type="button" data-fill-target="wallet-vesting-amount" data-fill-value="${escapeHtml(liquidMax)}">Max ${escapeHtml(liquidMax)}</button>` : ''}</div>
          <button type="submit" name="intent" value="preview">Preview transfer_to_vesting</button>
          <button type="submit" name="intent" value="send">Отправить power up реально</button>
          <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
        </fieldset>
      </form>
      <form id="wallet-withdraw-vesting-form" class="stacked-form">
        <fieldset>
          <legend>Withdraw vesting / power down</legend>
          <div class="field"><label for="wallet-withdraw-vesting-amount">Сумма vesting с символом</label><input id="wallet-withdraw-vesting-amount" name="vesting" type="text" required placeholder="0.000000 ${escapeHtml(vesting)}">${vestingMax ? ` <button type="button" data-fill-target="wallet-withdraw-vesting-amount" data-fill-value="${escapeHtml(vestingMax)}">Max ${escapeHtml(vestingMax)}</button>` : ''}</div>
          <button type="submit" name="intent" value="preview">Preview withdraw_vesting</button>
          <button type="submit" name="intent" value="send">Отправить power down реально</button>
          <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
        </fieldset>
      </form>
      <form id="wallet-delegation-form" class="stacked-form">
        <fieldset>
          <legend>Delegation</legend>
          <div class="field"><label for="wallet-delegation-to">Кому делегировать</label><input id="wallet-delegation-to" name="delegatee" type="text" required autocomplete="off"></div>
          <div class="field"><label for="wallet-delegation-vesting">Сумма vesting с символом</label><input id="wallet-delegation-vesting" name="vesting" type="text" required placeholder="0.000000 ${escapeHtml(vesting)}">${vestingMax ? ` <button type="button" data-fill-target="wallet-delegation-vesting" data-fill-value="${escapeHtml(vestingMax)}">Max ${escapeHtml(vestingMax)}</button>` : ''}</div>
          <button type="submit" name="intent" value="preview">Preview delegate_vesting_shares</button>
          <button type="submit" name="intent" value="send">Отправить delegation реально</button>
          <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
        </fieldset>
      </form>
      ${supportsClaim ? `<form id="wallet-claim-form" class="stacked-form">
        <fieldset>
          <legend>Claim rewards</legend>
          <p class="muted">Введите reward balances ровно в формате сети. Для Golos: liquid/vesting/to; для Hive/Steem: liquid, debt и vesting rewards.</p>
          <div class="field"><label for="wallet-claim-liquid">Liquid reward</label><input id="wallet-claim-liquid" name="liquid" type="text" required placeholder="0.000 ${escapeHtml(liquid)}"></div>
          <div class="field"><label for="wallet-claim-debt">Debt reward</label><input id="wallet-claim-debt" name="debt" type="text" placeholder="0.000 ${escapeHtml(debt)}"></div>
          <div class="field"><label for="wallet-claim-vesting">Vesting reward</label><input id="wallet-claim-vesting" name="vesting" type="text" required placeholder="0.000000 ${escapeHtml(vesting)}"></div>
          ${chain.id === 'golos' ? '<div class="field"><label for="wallet-claim-to">Получатель claim</label><input id="wallet-claim-to" name="to" type="text" placeholder="пусто = текущий аккаунт"></div>' : ''}
          <button type="submit" name="intent" value="preview">Preview claim</button>
          <button type="submit" name="intent" value="send">Claim rewards реально</button>
          <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
        </fieldset>
      </form>` : ''}
      ${supportsSavings ? `<form id="wallet-savings-to-form" class="stacked-form">
        <fieldset>
          <legend>Transfer to savings</legend>
          <div class="field"><label for="wallet-savings-to">Получатель savings</label><input id="wallet-savings-to" name="to" type="text" autocomplete="off" placeholder="пусто = текущий аккаунт"></div>
          <div class="field"><label for="wallet-savings-amount">Сумма с символом</label><input id="wallet-savings-amount" name="amount" type="text" required placeholder="1.000 ${escapeHtml(liquid)}"></div>
          <div class="field"><label for="wallet-savings-memo">Memo</label><input id="wallet-savings-memo" name="memo" type="text"></div>
          <button type="submit" name="intent" value="preview">Preview transfer_to_savings</button>
          <button type="submit" name="intent" value="send">Отправить в savings реально</button>
          <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
        </fieldset>
      </form>
      <form id="wallet-savings-from-form" class="stacked-form">
        <fieldset>
          <legend>Transfer from savings</legend>
          <div class="field"><label for="wallet-savings-request-id">Request ID</label><input id="wallet-savings-request-id" name="requestId" type="number" min="0" step="1" required value="0"></div>
          <div class="field"><label for="wallet-savings-from-to">Получатель</label><input id="wallet-savings-from-to" name="to" type="text" autocomplete="off" placeholder="пусто = текущий аккаунт"></div>
          <div class="field"><label for="wallet-savings-from-amount">Сумма с символом</label><input id="wallet-savings-from-amount" name="amount" type="text" required placeholder="1.000 ${escapeHtml(liquid)}"></div>
          <div class="field"><label for="wallet-savings-from-memo">Memo</label><input id="wallet-savings-from-memo" name="memo" type="text"></div>
          <button type="submit" name="intent" value="preview">Preview transfer_from_savings</button>
          <button type="submit" name="intent" value="send">Вывести из savings реально</button>
          <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
        </fieldset>
      </form>
      <form id="wallet-savings-cancel-form" class="stacked-form">
        <fieldset>
          <legend>Cancel transfer from savings</legend>
          <div class="field"><label for="wallet-savings-cancel-request-id">Request ID</label><input id="wallet-savings-cancel-request-id" name="requestId" type="number" min="0" step="1" required value="0"></div>
          <button type="submit" name="intent" value="preview">Preview cancel_transfer_from_savings</button>
          <button type="submit" name="intent" value="send">Отменить вывод реально</button>
          <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
        </fieldset>
      </form>` : ''}`;
  }

  function bindWalletForms(chain) {
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

    bindOperationForm(chain, 'wallet-withdraw-vesting-form', (form) => broadcast.prepare(chain, 'active', 'withdrawVesting', [
      auth.getCurrentLogin(chain),
      normalizeAssetInput(chain, form.get('vesting'), chain.vestingSymbol, 'Сумма vesting')
    ], { title: 'Withdraw vesting', amount: normalizeAssetInput(chain, form.get('vesting'), chain.vestingSymbol, 'Сумма vesting') }));

    bindOperationForm(chain, 'wallet-delegation-form', (form) => broadcast.prepare(chain, 'active', 'delegateVestingShares', [
      auth.getCurrentLogin(chain),
      normalizeAccountInput(chain, form.get('delegatee'), 'Delegatee'),
      normalizeAssetInput(chain, form.get('vesting'), chain.vestingSymbol, 'Сумма delegation')
    ], { title: 'Delegation', to: normalizeAccountInput(chain, form.get('delegatee'), 'Delegatee'), amount: normalizeAssetInput(chain, form.get('vesting'), chain.vestingSymbol, 'Сумма delegation') }));

    bindOperationForm(chain, 'wallet-claim-form', (form) => {
      const account = auth.getCurrentLogin(chain);
      if (chain.id === 'golos') {
        return broadcast.prepare(chain, 'posting', 'claim', [
          account,
          String(form.get('to') || '').trim().replace(/^@/, '') || account,
          normalizeAssetInput(chain, form.get('liquid'), chain.liquidSymbol, 'Liquid reward'),
          normalizeAssetInput(chain, form.get('vesting'), chain.vestingSymbol, 'Vesting reward'),
          []
        ]);
      }

      return broadcast.prepare(chain, 'posting', 'claimRewardBalance', [
        account,
        normalizeAssetInput(chain, form.get('liquid'), chain.liquidSymbol, 'Liquid reward'),
        normalizeAssetInput(chain, form.get('debt'), chain.debtSymbol, 'Debt reward'),
        normalizeAssetInput(chain, form.get('vesting'), chain.vestingSymbol, 'Vesting reward')
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
        <h2>${escapeHtml(chain.title)}: broadcast layer</h2>
        <p>v3 использует старые localStorage ключи и старые passphrase: без миграции и без новой схемы хранения.</p>
        <ul>
          <li><strong>Аккаунт:</strong> ${keys.login ? `@${escapeHtml(keys.login)}` : 'не выбран'}</li>
          <li><strong>${escapeHtml(keys.regularOrPostingLabel)}:</strong> ${keys.regularOrPosting ? 'доступен' : 'нет или не расшифрован'}</li>
          <li><strong>active:</strong> ${keys.active ? 'доступен' : 'нет или не расшифрован'}</li>
          <li><strong>Источник:</strong> ${escapeHtml(keys.source)}</li>
        </ul>
        <p class="notice">Приватные ключи не выводятся в UI, не попадают в JSON preview и не логируются.</p>
        ${walletPrepareForms(chain)}
      </section>`;
    bindWalletForms(chain);
    bindMaxButtons(appEl);
    setStatus('Broadcast helper загружен: доступны preview и real broadcast.', 'ok');
  }

  function renderVizAward(chain) {
    appEl.innerHTML = `
      <section class="panel">
        <h2>VIZ: award</h2>
        <p>Перенесённая форма award через legacy regular key: preview или реальная отправка.</p>
        <form id="viz-award-form" class="stacked-form">
          <fieldset>
            <legend>Award</legend>
            <div class="field"><label for="award-target">Кого наградить</label><input id="award-target" name="target" type="text" required autocomplete="off"></div>
            <div class="field"><label for="award-energy">Энергия, %</label><input id="award-energy" name="energy" type="number" min="0.01" max="100" step="0.01" required></div>
            <div class="field"><label for="award-memo">Memo</label><textarea id="award-memo" name="memo" rows="4"></textarea></div>
            <button type="submit" name="intent" value="preview">Preview award</button>
            <button type="submit" name="intent" value="send">Отправить award реально</button>
            <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
          </fieldset>
        </form>
      </section>`;
    bindOperationForm(chain, 'viz-award-form', (form) => broadcast.prepare(chain, 'regular', 'award', [
      auth.getCurrentLogin(chain),
      String(form.get('target') || '').trim().replace(/^@/, ''),
      Number(form.get('energy')) * 100,
      0,
      String(form.get('memo') || ''),
      []
    ]));
    setStatus('VIZ award готов: preview или real broadcast.', 'ok');
  }

  function renderGolosDonate(chain) {
    appEl.innerHTML = `
      <section class="panel">
        <h2>Golos: донат</h2>
        <p>Перенесённая форма donate через legacy posting key: preview или реальная отправка.</p>
        <form id="golos-donate-form" class="stacked-form">
          <fieldset>
            <legend>Donate</legend>
            <div class="field"><label for="donate-to">Получатель</label><input id="donate-to" name="to" type="text" required autocomplete="off"></div>
            <div class="field"><label for="donate-amount">Сумма</label><input id="donate-amount" name="amount" type="text" required placeholder="1.000 GOLOS"></div>
            <div class="field"><label for="donate-memo">Комментарий</label><textarea id="donate-memo" name="memo" rows="4"></textarea></div>
            <button type="submit" name="intent" value="preview">Preview donate</button>
            <button type="submit" name="intent" value="send">Отправить donate реально</button>
            <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
          </fieldset>
        </form>
      </section>`;
    bindOperationForm(chain, 'golos-donate-form', (form) => broadcast.prepare(chain, 'posting', 'donate', [
      auth.getCurrentLogin(chain),
      String(form.get('to') || '').trim().replace(/^@/, ''),
      String(form.get('amount') || '').trim(),
      { app: 'dpos-space', version: 3, comment: String(form.get('memo') || ''), target: { type: 'personal_donate' } },
      []
    ]));
    setStatus('Golos donate готов: preview или real broadcast.', 'ok');
  }

  function renderEditor(chain) {
    const debt = chain.debtSymbol || 'HBD';
    let draft = null;
    try { draft = JSON.parse(localStorage.getItem(`${chain.id}_v3_import_draft`) || 'null'); } catch (error) { draft = null; }
    appEl.innerHTML = `
      <section class="panel">
        <h2>${escapeHtml(chain.title)}: редактор</h2>
        <p>Перенесённый редактор: операции comment/comment_options через posting key, preview или реальная отправка.</p>
        <form id="editor-form" class="stacked-form">
          <fieldset>
            <legend>Публикация поста</legend>
            <div class="field"><label for="editor-title">Заголовок</label><input id="editor-title" name="title" type="text" required value="${escapeHtml(draft && draft.title ? draft.title : '')}"></div>
            <div class="field"><label for="editor-permlink">Permlink</label><input id="editor-permlink" name="permlink" type="text" required></div>
            <div class="field"><label for="editor-tags">Теги через пробел</label><input id="editor-tags" name="tags" type="text" placeholder="dpos space"></div>
            <div class="field"><label for="editor-body">Текст поста</label><textarea id="editor-body" name="body" rows="8" required>${escapeHtml(draft && draft.body ? draft.body : '')}</textarea></div>
            <button type="submit" name="intent" value="preview">Preview публикации</button>
            <button type="submit" name="intent" value="send">Опубликовать реально</button>
            <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
          </fieldset>
        </form>
        ${draft ? `<p class="notice">Загружен draft из import: ${escapeHtml(draft.sourceUrl || draft.importedAt || '')}</p>` : ''}
        <p class="muted">Для ${escapeHtml(chain.title)} max payout будет подготовлен как 1000000.000 ${escapeHtml(debt)}; тонкая настройка beneficiaries/payout — следующий этап.</p>
      </section>`;
    bindOperationForm(chain, 'editor-form', (form) => {
      const author = auth.getCurrentLogin(chain);
      const tags = String(form.get('tags') || '').split(/\s+/).filter(Boolean);
      const permlink = String(form.get('permlink') || '').trim();
      const operations = [
        ['comment', {
          parent_author: '',
          parent_permlink: tags[0] || 'dpos',
          author,
          permlink,
          title: String(form.get('title') || '').trim(),
          body: String(form.get('body') || ''),
          json_metadata: JSON.stringify({ tags, app: 'dpos.space/v3' })
        }],
        ['comment_options', {
          author,
          permlink,
          max_accepted_payout: `1000000.000 ${debt}`,
          percent_steem_dollars: chain.id === 'steem' ? 10000 : undefined,
          percent_hbd: chain.id === 'hive' ? 10000 : undefined,
          allow_votes: true,
          allow_curation_rewards: true,
          extensions: []
        }]
      ].map(([name, payload]) => [name, Object.fromEntries(Object.entries(payload).filter(([, value]) => typeof value !== 'undefined'))]);
      return broadcast.prepare(chain, 'posting', 'sendOperations', [operations]);
    });
    setStatus(`${chain.title} editor готов: preview или real broadcast.`, 'ok');
  }

  async function renderCalculator(chain, account) {
    appEl.innerHTML = '<section class="panel"><h2>Загрузка калькулятора</h2><p>Читаю chain properties...</p></section>';
    const connection = await getConnection(chain);
    const props = await profiles.apiCall(connection, 'getDynamicGlobalProperties', []);
    const totalFund = parseFloat(props.total_vesting_fund_steem || props.total_vesting_fund_hive || props.total_vesting_fund || '0');
    const totalShares = parseFloat(props.total_vesting_shares || '0');
    const perMillion = totalFund && totalShares ? (1000000 * totalFund / totalShares) : 0;

    appEl.innerHTML = `
      <section class="panel">
        <h2>${escapeHtml(chain.title)}: калькулятор ${escapeHtml(chain.powerTitle || chain.vestingSymbol)}</h2>
        <p>Быстрый перенос vesting-калькулятора из старых Hive/Steem/Golos/VIZ сервисов. Формула использует текущие dynamic global properties.</p>
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
    setStatus(`${chain.title} calculator загружен для @${account}.`, 'ok');
  }

  function renderManage(chain) {
    appEl.innerHTML = `
      <section class="panel">
        <h2>${escapeHtml(chain.title)}: управление</h2>
        <p>Рабочий перенос manage: proxy, witness vote, witness settings, profile metadata и authority update. Для VIZ добавлены committee/invite flows из старого wallet/manage.</p>
        <form id="manage-proxy-form" class="stacked-form">
          <fieldset>
            <legend>Witness proxy</legend>
            <div class="field"><label for="manage-proxy-login">Прокси-аккаунт</label><input id="manage-proxy-login" name="proxy" type="text" autocomplete="off" placeholder="пусто = снять proxy"></div>
            <button type="submit" name="intent" value="preview">Preview proxy</button>
            <button type="submit" name="intent" value="send">Установить proxy реально</button>
            <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
          </fieldset>
        </form>
        <form id="manage-witness-form" class="stacked-form">
          <fieldset>
            <legend>Witness vote</legend>
            <div class="field"><label for="manage-witness-login">Witness</label><input id="manage-witness-login" name="witness" type="text" required autocomplete="off"></div>
            <label class="inline-choice"><input name="approve" type="checkbox" checked> approve vote</label>
            <button type="submit" name="intent" value="preview">Preview vote</button>
            <button type="submit" name="intent" value="send">Отправить vote реально</button>
            <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
          </fieldset>
        </form>
        <form id="manage-witness-update-form" class="stacked-form">
          <fieldset>
            <legend>Witness settings / activation</legend>
            <p class="muted">Перенос старых witness settings: URL, signing key и fee/properties. Пустые custom properties будут взяты из текущих chain properties библиотекой/нодой, если метод это поддерживает.</p>
            <div class="field"><label for="manage-witness-url">Witness URL</label><input id="manage-witness-url" name="url" type="url" required></div>
            <div class="field"><label for="manage-witness-key">Block signing public key</label><input id="manage-witness-key" name="signingKey" type="text" required></div>
            <div class="field"><label for="manage-witness-fee">Fee</label><input id="manage-witness-fee" name="fee" type="text" required placeholder="0.000 ${escapeHtml(chain.liquidSymbol)}"></div>
            <div class="field"><label for="manage-witness-props">Props JSON (optional)</label><textarea id="manage-witness-props" name="props" rows="4" placeholder='{"account_creation_fee":"3.000 ${escapeHtml(chain.liquidSymbol)}"}'></textarea></div>
            <button type="submit" name="intent" value="preview">Preview witness update</button>
            <button type="submit" name="intent" value="send">Обновить witness реально</button>
            <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
          </fieldset>
        </form>
        <form id="manage-authority-form" class="stacked-form">
          <fieldset>
            <legend>Authority / access update</legend>
            <p class="muted">Статический безопасный перенос authority ops: v3 не генерирует и не показывает приватные ключи. Введите готовые public keys/account auths и owner WIF только для подписи в памяти.</p>
            <div class="field"><label for="manage-authority-owner-wif">Owner private WIF текущего аккаунта</label><input id="manage-authority-owner-wif" name="ownerWif" type="password" autocomplete="off" required></div>
            <div class="field"><label for="manage-authority-memo">Memo public key</label><input id="manage-authority-memo" name="memoKey" type="text" required></div>
            <div class="field"><label for="manage-authority-owner-key">Owner public key</label><input id="manage-authority-owner-key" name="ownerKey" type="text" required></div>
            <div class="field"><label for="manage-authority-active-key">Active public key</label><input id="manage-authority-active-key" name="activeKey" type="text" required></div>
            <div class="field"><label for="manage-authority-posting-key">Posting/regular public key</label><input id="manage-authority-posting-key" name="postingKey" type="text" required></div>
            <div class="field"><label for="manage-authority-json">json_metadata</label><textarea id="manage-authority-json" name="jsonMetadata" rows="3" placeholder="{}"></textarea></div>
            <button type="submit" name="intent" value="preview">Preview authority update</button>
            <button type="submit" name="intent" value="send">Обновить authority реально</button>
            <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
          </fieldset>
        </form>
        <form id="manage-profile-form" class="stacked-form">
          <fieldset>
            <legend>Profile metadata</legend>
            <div class="field"><label for="manage-profile-name">Display name</label><input id="manage-profile-name" name="name" type="text"></div>
            <div class="field"><label for="manage-profile-about">About</label><textarea id="manage-profile-about" name="about" rows="3"></textarea></div>
            <div class="field"><label for="manage-profile-location">Location</label><input id="manage-profile-location" name="location" type="text"></div>
            <div class="field"><label for="manage-profile-website">Website</label><input id="manage-profile-website" name="website" type="url"></div>
            <button type="submit" name="intent" value="preview">Preview profile update</button>
            <button type="submit" name="intent" value="send">Обновить profile реально</button>
            <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
          </fieldset>
        </form>
        ${chain.id === 'viz' ? `<form id="viz-create-invite-form" class="stacked-form"><fieldset>
          <legend>VIZ create invite</legend>
          <div class="field"><label for="viz-invite-balance">Баланс инвайта</label><input id="viz-invite-balance" name="balance" type="text" required placeholder="1.000 VIZ"></div>
          <div class="field"><label for="viz-invite-public">Invite public key</label><input id="viz-invite-public" name="publicKey" type="text" required></div>
          <button type="submit" name="intent" value="preview">Preview create_invite</button><button type="submit" name="intent" value="send">Создать invite реально</button>
          <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
        </fieldset></form>
        <form id="viz-use-invite-form" class="stacked-form"><fieldset>
          <legend>VIZ use/claim invite balance</legend>
          <div class="field"><label for="viz-use-invite-secret">Invite secret</label><input id="viz-use-invite-secret" name="secret" type="text" required></div>
          <div class="field"><label for="viz-use-invite-receiver">Receiver</label><input id="viz-use-invite-receiver" name="receiver" type="text" placeholder="пусто = текущий аккаунт"></div>
          <label class="inline-choice"><input name="toVesting" type="checkbox" checked> use_invite_balance в SHARES; иначе claim_invite_balance в VIZ</label>
          <button type="submit" name="intent" value="preview">Preview invite use/claim</button><button type="submit" name="intent" value="send">Использовать invite реально</button>
          <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
        </fieldset></form>
        <form id="viz-committee-form" class="stacked-form"><fieldset>
          <legend>VIZ committee worker request/vote</legend>
          <div class="field"><label for="viz-committee-mode">Mode</label><select id="viz-committee-mode" name="mode"><option value="create">create request</option><option value="vote">vote request</option></select></div>
          <div class="field"><label for="viz-committee-id">Request ID for vote</label><input id="viz-committee-id" name="requestId" type="number" min="0" step="1" value="0"></div>
          <div class="field"><label for="viz-committee-url">URL</label><input id="viz-committee-url" name="url" type="url"></div>
          <div class="field"><label for="viz-committee-worker">Worker</label><input id="viz-committee-worker" name="worker" type="text"></div>
          <div class="field"><label for="viz-committee-min">Reward min</label><input id="viz-committee-min" name="min" type="text" placeholder="1.000 VIZ"></div>
          <div class="field"><label for="viz-committee-max">Reward max</label><input id="viz-committee-max" name="max" type="text" placeholder="2.000 VIZ"></div>
          <div class="field"><label for="viz-committee-days">Duration days</label><input id="viz-committee-days" name="days" type="number" min="1" step="1" value="5"></div>
          <div class="field"><label for="viz-committee-vote">Vote percent</label><input id="viz-committee-vote" name="vote" type="number" min="-100" max="100" step="1" value="100"></div>
          <button type="submit" name="intent" value="preview">Preview committee</button><button type="submit" name="intent" value="send">Отправить committee реально</button>
          <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
        </fieldset></form>` : ''}
      </section>`;

    bindOperationForm(chain, 'manage-proxy-form', (form) => broadcast.prepare(chain, 'active', 'accountWitnessProxy', [
      auth.getCurrentLogin(chain),
      String(form.get('proxy') || '').trim().replace(/^@/, '')
    ]));
    bindOperationForm(chain, 'manage-witness-form', (form) => broadcast.prepare(chain, 'active', 'accountWitnessVote', [
      auth.getCurrentLogin(chain),
      normalizeAccountInput(chain, form.get('witness'), 'Witness'),
      form.get('approve') === 'on'
    ], { title: 'Witness vote', to: normalizeAccountInput(chain, form.get('witness'), 'Witness') }));

    bindOperationForm(chain, 'manage-witness-update-form', (form) => {
      const account = auth.getCurrentLogin(chain);
      const url = String(form.get('url') || '').trim();
      const signingKey = String(form.get('signingKey') || '').trim();
      const fee = normalizeAssetInput(chain, form.get('fee'), chain.liquidSymbol, 'Witness fee');
      let props = {};
      const rawProps = String(form.get('props') || '').trim();
      if (rawProps) {
        try { props = JSON.parse(rawProps); } catch (error) { throw new Error('Props JSON must be valid JSON.'); }
      }
      if (!signingKey || broadcast.isLikelyWif(signingKey)) throw new Error('Signing key must be a public key, not a private WIF.');
      return broadcast.prepare(chain, 'active', 'witnessUpdate', [account, url, signingKey, props, fee], { title: 'Witness update', amount: fee, warnings: ['Check witness props carefully: wrong chain parameters may make witness settings invalid.'] });
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
        if (!value || broadcast.isLikelyWif(value)) throw new Error('Authority fields accept public keys only; a WIF-looking private key was entered.');
      });
      try { JSON.parse(jsonMetadata); } catch (error) { throw new Error('json_metadata must be valid JSON.'); }
      const owner = { weight_threshold: 1, account_auths: [], key_auths: [[ownerKey, 1]] };
      const active = { weight_threshold: 1, account_auths: [], key_auths: [[activeKey, 1]] };
      const posting = { weight_threshold: 1, account_auths: [], key_auths: [[postingKey, 1]] };
      return broadcast.prepareWithPrivateKey(chain, account, 'owner', ownerWif, 'accountUpdate', [account, owner, active, posting, memoKey, jsonMetadata], { title: 'Authority update', warnings: ['Owner WIF is used only in memory and is excluded from preview/result. Store generated private keys outside dpos.space v3.'] });
    });

    bindOperationForm(chain, 'manage-profile-form', (form) => {
      const account = auth.getCurrentLogin(chain);
      const metadata = { profile: {
        name: String(form.get('name') || '').trim(),
        about: String(form.get('about') || '').trim(),
        location: String(form.get('location') || '').trim(),
        website: String(form.get('website') || '').trim()
      } };
      const json = JSON.stringify(metadata);
      if (chain.id === 'hive' || chain.id === 'steem') {
        return broadcast.prepare(chain, 'active', 'accountUpdate', [account, undefined, undefined, undefined, undefined, json], { title: 'Profile update', warnings: ['Updates json_metadata through account_update; posting_json_metadata is library/version-dependent and not used here.'] });
      }
      return broadcast.prepare(chain, 'posting', 'accountMetadata', [account, json], { title: 'Profile metadata update' });
    });

    bindOperationForm(chain, 'viz-create-invite-form', (form) => broadcast.prepare(chain, 'active', 'createInvite', [
      auth.getCurrentLogin(chain),
      normalizeAssetInput(chain, form.get('balance'), chain.liquidSymbol, 'Invite balance'),
      String(form.get('publicKey') || '').trim()
    ], { title: 'VIZ create invite', amount: normalizeAssetInput(chain, form.get('balance'), chain.liquidSymbol, 'Invite balance'), warnings: ['Use invite public key only. Private invite secret must be stored outside preview/result.'] }));

    bindOperationForm(chain, 'viz-use-invite-form', (form) => {
      const receiver = String(form.get('receiver') || '').trim().replace(/^@/, '') || auth.getCurrentLogin(chain);
      const method = form.get('toVesting') === 'on' ? 'useInviteBalance' : 'claimInviteBalance';
      return broadcast.prepare(chain, 'active', method, [auth.getCurrentLogin(chain), normalizeAccountInput(chain, receiver, 'Receiver'), String(form.get('secret') || '').trim()], { title: method, to: receiver, warnings: ['Invite secret is required for signing this chain operation; it is shown in preview params, so avoid sharing the preview publicly.'] });
    });

    bindOperationForm(chain, 'viz-committee-form', (form) => {
      const mode = String(form.get('mode') || 'create');
      if (mode === 'vote') {
        const requestId = broadcast.validateRequestId(form.get('requestId'));
        const vote = Math.round(Number(form.get('vote') || 0) * 100);
        return broadcast.prepare(chain, 'regular', 'committeeVoteRequest', [auth.getCurrentLogin(chain), requestId, vote], { title: 'VIZ committee vote', requestId });
      }
      const worker = normalizeAccountInput(chain, form.get('worker'), 'Worker');
      const min = normalizeAssetInput(chain, form.get('min'), chain.liquidSymbol, 'Reward min');
      const max = normalizeAssetInput(chain, form.get('max'), chain.liquidSymbol, 'Reward max');
      const duration = Number(form.get('days') || 1) * 86400;
      return broadcast.prepare(chain, 'regular', 'committeeWorkerCreateRequest', [auth.getCurrentLogin(chain), String(form.get('url') || '').trim(), worker, min, max, duration], { title: 'VIZ committee create request', to: worker, amount: `${min}..${max}` });
    });
    setStatus(`${chain.title} manage готов: proxy/witness/settings/authority/profile${chain.id === 'viz' ? '/invite/committee' : ''} preview или real broadcast.`, 'ok');
  }

  async function renderExplorer(chain, account) {
    const state = parseHash();
    appEl.innerHTML = `
      <section class="panel">
        <h2>${escapeHtml(chain.title)}: explorer</h2>
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

    if (!state.kind || !state.value) {
      setStatus(`${chain.title} explorer готов.`, 'info');
      return;
    }

    const connection = await getConnection(chain);
    let result;
    if (state.kind === 'block') {
      result = await profiles.apiCall(connection, 'getBlock', [Number(state.value)]);
    } else if (state.kind === 'tx') {
      result = await profiles.apiCall(connection, 'getTransaction', [String(state.value).trim()]);
    } else {
      result = await profiles.fetchAccount(connection, String(state.value).trim().replace(/^@/, ''));
    }
    document.getElementById('explorer-result').innerHTML = renderExplorerResult(chain, state.kind, state.value, result);
    setStatus(`${chain.title} explorer: ${state.kind} загружен.`, 'ok');
  }


  function renderVizExchanges(chain) {
    appEl.innerHTML = `
      <section class="panel">
        <h2>${escapeHtml(chain.title)}: обмен VIZ</h2>
        <p>Статический перенос legacy <code>blockchains/viz/apps/exchanges/content.php</code>: в старой версии это была информационная страница без broadcast.</p>
        <ol>
          <li><a href="https://swap.viz.world/" target="_blank" rel="noopener">swap.viz.world — покупка VIZ</a></li>
          <li><a href="https://control.viz.world/media/@urri77/покупка-viz-за-usdt-на-бирже-рудекс/" target="_blank" rel="noopener">Инструкция по покупке VIZ за USDT на RuDEX</a></li>
          <li><a href="https://readdle.me/#viz://@denis-skripnik/60937915/publication/" target="_blank" rel="noopener">Материал о шлюзе через Minter</a></li>
        </ol>
      </section>`;
    setStatus('VIZ exchanges загружен как статическая legacy-инфостраница.', 'ok');
  }

  function renderImport(chain) {
    const draftKey = `${chain.id}_v3_import_draft`;
    appEl.innerHTML = `
      <section class="panel">
        <h2>${escapeHtml(chain.title)}: импорт статьи</h2>
        <p>Статический перенос: вставьте URL или текст. URL читается через browser fetch, если сайт разрешает CORS; результат можно сохранить как draft для редактора.</p>
        <form id="import-form" class="stacked-form">
          <fieldset>
            <legend>Источник</legend>
            <div class="field"><label for="import-url">URL статьи</label><input id="import-url" name="url" type="url" placeholder="https://example.com/post"></div>
            <div class="field"><label for="import-text">Или вставьте текст/HTML</label><textarea id="import-text" name="text" rows="10"></textarea></div>
            <button type="submit">Нормализовать preview</button>
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
      if (!source && url) {
        const response = await fetch(url);
        source = await response.text();
      }
      const titleMatch = source.match(/<title[^>]*>([^<]+)<\/title>/i) || source.match(/^#\s+(.+)$/m);
      const title = titleMatch ? titleMatch[1].trim() : '';
      const body = source.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s{3,}/g, '\n\n').trim();
      const draft = { title, body, sourceUrl: url, importedAt: new Date().toISOString() };
      localStorage.setItem(draftKey, JSON.stringify(draft));
      setOperationResult(form, `Draft сохранён в localStorage: ${draftKey}. Откройте редактор ${chain.title}, чтобы скопировать title/body.`, 'ok', { chain: chain.id, from: auth.getCurrentLogin(chain), authority: 'posting', operationName: 'importDraft', params: [{ title, body: body.slice(0, 1000), sourceUrl: url }], meta: { title: 'Import draft', warnings: url ? ['Если fetch упал — сайт не разрешает CORS; вставьте текст вручную.'] : [] } });
    });
    setStatus(`${chain.title} import готов: URL/text → draft/preview.`, 'ok');
  }

  function renderInstantView(chain) {
    appEl.innerHTML = `
      <section class="panel">
        <h2>${escapeHtml(chain.title)}: Instant View</h2>
        <p>Локальная нормализация HTML/Markdown в readable preview без backend и без write-операций.</p>
        <form id="instant-view-form" class="stacked-form">
          <fieldset>
            <legend>Preview</legend>
            <div class="field"><label for="instant-view-source">HTML/Markdown</label><textarea id="instant-view-source" name="source" rows="12" required></textarea></div>
            <button type="submit">Показать Instant View</button>
            <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
          </fieldset>
        </form>
      </section>`;
    document.getElementById('instant-view-form').addEventListener('submit', (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const source = String(new FormData(form).get('source') || '');
      const text = source.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
      setOperationResult(form, 'Instant View preview готов.', 'ok', { chain: chain.id, from: auth.getCurrentLogin(chain), authority: 'posting', operationName: 'instantView', params: [{ text }], meta: { title: 'Instant View preview', warnings: [] } });
    });
    setStatus(`${chain.title} instant-view готов.`, 'ok');
  }

  function renderSwap(chain) {
    if (chain.id === 'viz') {
      renderServicePlaceholder(chain, { id: 'swap', title: 'Swap', description: 'У VIZ в старом коде нет ясного DEX/swap flow.' });
      return;
    }
    appEl.innerHTML = `
      <section class="panel">
        <h2>${escapeHtml(chain.title)}: market/swap</h2>
        <p>Перенос базовых market operations: create_limit_order и cancel_order через active key.</p>
        <form id="swap-create-form" class="stacked-form"><fieldset>
          <legend>Create limit order</legend>
          <div class="field"><label for="swap-order-id">Order ID</label><input id="swap-order-id" name="orderId" type="number" min="0" step="1" required value="0"></div>
          <div class="field"><label for="swap-sell">Sell amount</label><input id="swap-sell" name="sell" type="text" required placeholder="1.000 ${escapeHtml(chain.liquidSymbol)}"></div>
          <div class="field"><label for="swap-buy">Min receive</label><input id="swap-buy" name="buy" type="text" required placeholder="1.000 ${escapeHtml(chain.debtSymbol || chain.liquidSymbol)}"></div>
          <label class="inline-choice"><input name="fillOrKill" type="checkbox"> fill or kill</label>
          <div class="field"><label for="swap-expiration">Expiration UTC</label><input id="swap-expiration" name="expiration" type="datetime-local" required></div>
          <button type="submit" name="intent" value="preview">Preview order</button><button type="submit" name="intent" value="send">Создать order реально</button>
          <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
        </fieldset></form>
        <form id="swap-cancel-form" class="stacked-form"><fieldset>
          <legend>Cancel order</legend>
          <div class="field"><label for="swap-cancel-id">Order ID</label><input id="swap-cancel-id" name="orderId" type="number" min="0" step="1" required></div>
          <button type="submit" name="intent" value="preview">Preview cancel</button><button type="submit" name="intent" value="send">Отменить order реально</button>
          <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
        </fieldset></form>
      </section>`;
    bindOperationForm(chain, 'swap-create-form', (form) => {
      const owner = auth.getCurrentLogin(chain);
      const orderId = broadcast.validateRequestId(form.get('orderId'));
      const sell = normalizeAssetInput(chain, form.get('sell'), [chain.liquidSymbol, chain.debtSymbol].filter(Boolean), 'Sell amount');
      const buy = normalizeAssetInput(chain, form.get('buy'), [chain.liquidSymbol, chain.debtSymbol].filter(Boolean), 'Min receive');
      const expiration = `${String(form.get('expiration') || '').replace('T', ' ')}:00`;
      return broadcast.prepare(chain, 'active', 'createLimitOrder', [owner, orderId, sell, buy, form.get('fillOrKill') === 'on', expiration], { title: 'Create limit order', amount: `${sell} → ${buy}`, requestId: orderId });
    });
    bindOperationForm(chain, 'swap-cancel-form', (form) => {
      const orderId = broadcast.validateRequestId(form.get('orderId'));
      return broadcast.prepare(chain, 'active', 'cancelOrder', [auth.getCurrentLogin(chain), orderId], { title: 'Cancel limit order', requestId: orderId });
    });
    setStatus(`${chain.title} swap/market готов: create/cancel order.`, 'ok');
  }

  function renderRegister(chain) {
    const isGolos = chain.id === 'golos';
    const isViz = chain.id === 'viz';
    appEl.innerHTML = `
      <section class="panel">
        <h2>${escapeHtml(chain.title)}: регистрация</h2>
        ${isGolos || isViz ? `<p>Invite registration в v3 не использует legacy hardcoded WIF. Signer WIF берётся из этого поля только на время broadcast и не сохраняется, не показывается в preview/result/log. Для ${escapeHtml(chain.title)} нужен private WIF service/invite аккаунта, который имеет право выполнить invite registration.</p>` : '<p>Hive/Steem require account creator fee/delegation and generated authorities. v3 prepares the operation only from explicit current active key.</p>'}
        ${isGolos ? '<p class="notice">Также добавлена форма обычного Golos account_create_with_delegation из старого manage/create-account: v3 принимает только публичный ключ нового аккаунта и не генерирует/показывает приватные ключи.</p>' : ''}
        <form id="register-form" class="stacked-form"><fieldset>
          <legend>Create account</legend>
          <div class="field"><label for="register-name">New account</label><input id="register-name" name="name" type="text" required></div>
          ${isGolos || isViz ? '<div class="field"><label for="register-invite">Invite secret/code</label><input id="register-invite" name="invite" type="text" required></div>' : `<div class="field"><label for="register-fee">Fee</label><input id="register-fee" name="fee" type="text" required placeholder="3.000 ${escapeHtml(chain.liquidSymbol)}"></div>`}
          ${isGolos ? '<div class="field"><label for="register-signer">Service signer account</label><input id="register-signer" name="signer" type="text" required value="dpos.space-reg"></div>' : ''}
          ${isViz ? '<div class="field"><label for="register-signer">Invite signer account</label><input id="register-signer" name="signer" type="text" required value="invite"></div>' : ''}
          ${isGolos || isViz ? '<div class="field"><label for="register-signer-wif">Private WIF for service/invite signer</label><input id="register-signer-wif" name="signerWif" type="password" autocomplete="off" required><small>Используется только в памяти для подписи. Не вставляйте сюда ключ нового аккаунта.</small></div>' : ''}
          <div class="field"><label for="register-public-key">Public key for new account authorities</label><input id="register-public-key" name="publicKey" type="text" required></div>
          <button type="submit" name="intent" value="preview">Preview registration</button>
          <button type="submit" name="intent" value="send">Создать аккаунт реально</button>
          <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
        </fieldset></form>
        ${isGolos ? `<form id="golos-register-delegation-form" class="stacked-form"><fieldset>
          <legend>Golos account_create_with_delegation</legend>
          <div class="field"><label for="golos-register-delegation-name">New account</label><input id="golos-register-delegation-name" name="name" type="text" required></div>
          <div class="field"><label for="golos-register-delegation-fee">Fee</label><input id="golos-register-delegation-fee" name="fee" type="text" required value="1.000 GOLOS"></div>
          <div class="field"><label for="golos-register-delegation-vesting">Delegation</label><input id="golos-register-delegation-vesting" name="delegation" type="text" required placeholder="0.000000 GESTS"></div>
          <div class="field"><label for="golos-register-delegation-public-key">Public key for new account authorities</label><input id="golos-register-delegation-public-key" name="publicKey" type="text" required></div>
          <button type="submit" name="intent" value="preview">Preview create with delegation</button>
          <button type="submit" name="intent" value="send">Создать с делегированием реально</button>
          <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
        </fieldset></form>` : ''}
      </section>`;

    bindOperationForm(chain, 'register-form', (form) => {
      const name = normalizeAccountInput(chain, form.get('name'), 'New account');
      const key = String(form.get('publicKey') || '').trim();
      const publicKeyWarning = 'Use a public key for the new account only; never paste the new account private WIF into public-key fields.';

      if (isGolos || isViz) {
        const signer = String(form.get('signer') || '').trim();
        const signerWif = String(form.get('signerWif') || '').trim();
        const inviteSecret = String(form.get('invite') || '').trim();
        if (!inviteSecret) throw new Error('Invite secret/code is required.');
        if (broadcast.isLikelyWif(key)) throw new Error('Public key field contains a WIF-looking private key. Paste the public key instead.');

        if (isViz) {
          return broadcast.prepareWithPrivateKey(chain, signer, 'active', signerWif, 'inviteRegistration', [signer, name, inviteSecret, key], {
            title: 'VIZ invite registration',
            to: name,
            keySource: 'explicit service/invite signer WIF input, used only in memory',
            warnings: [publicKeyWarning, 'Private signer WIF is intentionally excluded from preview/result and is not stored.']
          });
        }

        const authObject = { weight_threshold: 1, account_auths: [], key_auths: [[key, 1]] };
        return broadcast.prepareWithPrivateKey(chain, signer, 'active', signerWif, 'accountCreateWithInvite', [inviteSecret, signer, name, authObject, authObject, authObject, key, '', []], {
          title: 'Golos account_create_with_invite',
          to: name,
          keySource: 'explicit service signer WIF input, used only in memory',
          warnings: [publicKeyWarning, 'Private signer WIF is intentionally excluded from preview/result and is not stored.']
        });
      }

      const creator = auth.getCurrentLogin(chain);
      const authObject = { weight_threshold: 1, account_auths: [], key_auths: [[key, 1]] };
      const fee = normalizeAssetInput(chain, form.get('fee'), chain.liquidSymbol, 'Account creation fee');
      return broadcast.prepare(chain, 'active', 'createAccount', [fee, creator, name, authObject, authObject, authObject, key, ''], { title: 'Create account', to: name, amount: fee, warnings: [publicKeyWarning] });
    });

    bindOperationForm(chain, 'golos-register-delegation-form', (form) => {
      const name = normalizeAccountInput(chain, form.get('name'), 'New account');
      const key = String(form.get('publicKey') || '').trim();
      if (broadcast.isLikelyWif(key)) throw new Error('Public key field contains a WIF-looking private key. Paste the public key instead.');
      const authObject = { weight_threshold: 1, account_auths: [], key_auths: [[key, 1]] };
      const fee = normalizeAssetInput(chain, form.get('fee'), chain.liquidSymbol, 'Account creation fee');
      const delegation = normalizeAssetInput(chain, form.get('delegation'), chain.vestingSymbol, 'Account delegation');
      return broadcast.prepare(chain, 'active', 'accountCreateWithDelegation', [fee, delegation, auth.getCurrentLogin(chain), name, authObject, authObject, authObject, key, '', []], { title: 'Golos account_create_with_delegation', to: name, amount: `${fee}; ${delegation}`, warnings: ['v3 uses only public key input for the new account; private keys are not generated or displayed.'] });
    });

    setStatus(`${chain.title} registration route загружен: preview/send доступен без hardcoded WIF.`, 'ok');
  }

  function renderServicePlaceholder(chain, app) {
    const details = {
      registration: 'VIZ registration: нужен аккуратный перенос invite/create-account flows и валидации ключей.',
      calculator: `${chain.title} calculator: формулы зависят от liquid/vesting symbols и chain properties; UI добавлен, расчёт переносится следующим этапом.`,
      manage: `${chain.title} manage: proxy, witness vote, profile metadata и witness settings требуют отдельных форм и authority checks.`,
      explorer: `${chain.title} explorer: read-only блоки/tx зависят от API методов getBlock/getTransaction и старых PHP snippets.`,
      import: 'Golos import article: нужен безопасный fetch/proxy replacement без PHP или явный backend endpoint.',
      escrow: 'Golos escrow помечен optional: старый UI большой, перенос позже после wallet/editor/donate.',
      'instant-view': 'Golos Instant View: нужен отдельный парсер/preview слой.',
      swap: `${chain.title} swap: market operations требуют отдельной проверки ордеров и precision.`,
      register: `${chain.title} register/account creation: route добавлен, write-flow отложен до отдельной проверки owner/active keys и старых библиотечных методов.`
    };

    if (chain.id === 'hive' || chain.id === 'steem') {
      details.import = `${chain.title} import article: перенесён отдельной формой URL/text → editor draft.`;
      details['instant-view'] = `${chain.title} Instant View: перенесён как локальный preview/normalizer.`;
    }

    appEl.innerHTML = `
      <section class="panel">
        <h2>${escapeHtml(chain.title)}: ${escapeHtml(app.title)}</h2>
        <p>${escapeHtml(details[app.id] || app.description || 'Раздел требует отдельного подтверждённого flow.')}</p>
        <p class="notice">Маршрут не выполняет write-операций без явной перенесённой формы и не ломает старый сайт.</p>
      </section>`;
    setStatus(`${chain.title}: ${app.title} добавлен как pending-раздел.`, 'info');
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

  function renderCosmosWallet(chain, account) {
    const isMinter = chain.id === 'minter';
    const liquid = chain.liquidSymbol;
    appEl.innerHTML = `
      <section class="panel">
        <h2>${escapeHtml(chain.title)}: кошелёк ${escapeHtml(account)}</h2>
        <p><strong>Legacy auth:</strong> ${escapeHtml(keyStatusText(auth.getKeyStatus(chain, auth.getCurrentUser(chain))))}</p>
        <p class="notice">Seed читается из старой localStorage-схемы <code>${escapeHtml(chain.id)}_users</code>/<code>${escapeHtml(chain.id)}_current_user</code> и расшифровывается старой passphrase. В preview/result seed/private key не выводится.</p>
        <form id="cosmos-send-form" class="stacked-form"><fieldset>
          <legend>Transfer</legend>
          <div class="field"><label for="cosmos-send-to">Получатель address</label><input id="cosmos-send-to" name="to" type="text" required></div>
          <div class="field"><label for="cosmos-send-amount">Amount</label><input id="cosmos-send-amount" name="amount" type="text" required placeholder="1.000"></div>
          <div class="field"><label for="cosmos-send-coin">Coin</label><input id="cosmos-send-coin" name="coin" type="text" required value="${escapeHtml(liquid)}"></div>
          ${isMinter ? '<div class="field"><label for="cosmos-send-memo">Memo</label><input id="cosmos-send-memo" name="memo" type="text"></div><div class="field"><label for="cosmos-send-gas">Gas coin</label><input id="cosmos-send-gas" name="gasCoin" type="text" value="BIP"></div>' : ''}
          <button type="submit" name="intent" value="preview">Preview transfer</button><button type="submit" name="intent" value="send">Отправить transfer реально</button>
          <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
        </fieldset></form>
        <form id="cosmos-delegate-form" class="stacked-form"><fieldset>
          <legend>Delegate / unbond</legend>
          <div class="field"><label for="cosmos-validator">Validator ${isMinter ? 'public key MP...' : 'operator id/address'}</label><input id="cosmos-validator" name="validator" type="text" required></div>
          <div class="field"><label for="cosmos-delegate-amount">Amount</label><input id="cosmos-delegate-amount" name="amount" type="text" required placeholder="1.000"></div>
          <div class="field"><label for="cosmos-delegate-coin">Coin</label><input id="cosmos-delegate-coin" name="coin" type="text" required value="${escapeHtml(liquid)}"></div>
          <div class="field"><label for="cosmos-delegate-mode">Operation</label><select id="cosmos-delegate-mode" name="mode"><option value="delegate">delegate</option><option value="unbond">unbond</option></select></div>
          <button type="submit" name="intent" value="preview">Preview stake</button><button type="submit" name="intent" value="send">Отправить stake реально</button>
          <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
        </fieldset></form>
        ${isMinter ? minterSwapForms() : decimalNftForms()}
      </section>`;
    bindCosmosForms(chain);
    setStatus(`${chain.title} wallet/service forms готовы: transfer/delegate/unbond${isMinter ? '/swap/coin' : '/NFT/token'}.`, 'ok');
  }

  function minterSwapForms() {
    return `<form id="minter-swap-form" class="stacked-form"><fieldset>
      <legend>Minter swap / sell</legend>
      <div class="field"><label for="minter-swap-from">Coin to sell</label><input id="minter-swap-from" name="from" type="text" required value="BIP"></div>
      <div class="field"><label for="minter-swap-to">Coin to buy</label><input id="minter-swap-to" name="to" type="text" required></div>
      <div class="field"><label for="minter-swap-amount">Amount to sell</label><input id="minter-swap-amount" name="amount" type="text" required></div>
      <div class="field"><label for="minter-swap-min">Minimum buy amount</label><input id="minter-swap-min" name="min" type="text" value="0"></div>
      <div class="field"><label for="minter-swap-route">Swap pool route (optional comma-separated)</label><input id="minter-swap-route" name="route" type="text"></div>
      <button type="submit" name="intent" value="preview">Preview swap</button><button type="submit" name="intent" value="send">Отправить swap реально</button>
      <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
    </fieldset></form>
    <form id="minter-liquidity-form" class="stacked-form"><fieldset>
      <legend>Minter liquidity / pool</legend>
      <div class="field"><label for="minter-liquidity-mode">Operation</label><select id="minter-liquidity-mode" name="mode"><option value="ADD_LIQUIDITY">add liquidity</option><option value="REMOVE_LIQUIDITY">remove liquidity</option><option value="CREATE_SWAP_POOL">create swap pool</option></select></div>
      <div class="field"><label for="minter-liquidity-coin0">Coin 0</label><input id="minter-liquidity-coin0" name="coin0" type="text" required value="BIP"></div>
      <div class="field"><label for="minter-liquidity-coin1">Coin 1</label><input id="minter-liquidity-coin1" name="coin1" type="text" required></div>
      <div class="field"><label for="minter-liquidity-volume0">Volume 0 / liquidity</label><input id="minter-liquidity-volume0" name="volume0" type="text" required></div>
      <div class="field"><label for="minter-liquidity-volume1">Maximum/initial volume 1</label><input id="minter-liquidity-volume1" name="volume1" type="text" value="0"></div>
      <div class="field"><label for="minter-liquidity-gas">Gas coin</label><input id="minter-liquidity-gas" name="gasCoin" type="text" value="BIP"></div>
      <button type="submit" name="intent" value="preview">Preview liquidity</button><button type="submit" name="intent" value="send">Отправить liquidity реально</button>
      <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
    </fieldset></form>
    <form id="minter-hub-withdraw-form" class="stacked-form"><fieldset>
      <legend>Minter Hub withdraw</legend>
      <p class="notice">Legacy withdraw sends tokens to the Minter Hub address with a JSON memo. v3 preserves that static transaction shape; external hub fees/templates are not fetched automatically.</p>
      <div class="field"><label for="minter-hub-chain">Destination chain id</label><input id="minter-hub-chain" name="chainId" type="text" required placeholder="ethereum or bsc"></div>
      <div class="field"><label for="minter-hub-to">Destination address on external chain</label><input id="minter-hub-to" name="to" type="text" required></div>
      <div class="field"><label for="minter-hub-coin">Coin/token</label><input id="minter-hub-coin" name="coin" type="text" required></div>
      <div class="field"><label for="minter-hub-amount">Amount including hub fee</label><input id="minter-hub-amount" name="amount" type="text" required></div>
      <div class="field"><label for="minter-hub-fee">Hub fee in token units</label><input id="minter-hub-fee" name="hubFee" type="text" value="0"></div>
      <div class="field"><label for="minter-hub-gas">Gas coin</label><input id="minter-hub-gas" name="gasCoin" type="text" value="BIP"></div>
      <button type="submit" name="intent" value="preview">Preview hub withdraw</button><button type="submit" name="intent" value="send">Отправить hub withdraw реально</button>
      <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
    </fieldset></form>
    <form id="minter-coin-form" class="stacked-form"><fieldset>
      <legend>Minter coin/token create/recreate/mint/burn/edit owner</legend>
      <div class="field"><label for="minter-coin-mode">Operation</label><select id="minter-coin-mode" name="mode"><option value="CREATE_COIN">create coin</option><option value="RECREATE_COIN">recreate coin</option><option value="CREATE_TOKEN">create token</option><option value="RECREATE_TOKEN">recreate token</option><option value="MINT_TOKEN">mint token</option><option value="BURN_TOKEN">burn token</option><option value="EDIT_COIN_OWNER">edit owner</option></select></div>
      <div class="field"><label for="minter-coin-symbol">Symbol</label><input id="minter-coin-symbol" name="symbol" type="text" required></div>
      <div class="field"><label for="minter-coin-name">Name</label><input id="minter-coin-name" name="name" type="text"></div>
      <div class="field"><label for="minter-coin-amount">Initial amount / mint / burn amount</label><input id="minter-coin-amount" name="amount" type="text" required></div>
      <div class="field"><label for="minter-coin-max">Max supply</label><input id="minter-coin-max" name="max" type="text" value="1000000"></div>
      <div class="field"><label for="minter-coin-reserve">Initial reserve (CREATE_COIN/RECREATE_COIN)</label><input id="minter-coin-reserve" name="reserve" type="text" value="10000"></div>
      <div class="field"><label for="minter-coin-crr">CRR percent (CREATE_COIN/RECREATE_COIN)</label><input id="minter-coin-crr" name="crr" type="number" min="10" max="100" step="1" value="10"></div>
      <div class="field"><label for="minter-coin-new-owner">New owner address (EDIT_COIN_OWNER)</label><input id="minter-coin-new-owner" name="newOwner" type="text"></div>
      <button type="submit" name="intent" value="preview">Preview coin op</button><button type="submit" name="intent" value="send">Отправить coin op реально</button>
      <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
    </fieldset></form>`;
  }

  function decimalNftForms() {
    return `<form id="decimal-convert-form" class="stacked-form"><fieldset>
      <legend>Decimal convert / swap</legend>
      <p class="notice">For non-DEL assets use Decimal EVM token contract address (0x...) as in the legacy SDK flow.</p>
      <div class="field"><label for="decimal-convert-from">From: DEL or token address</label><input id="decimal-convert-from" name="from" type="text" required value="DEL"></div>
      <div class="field"><label for="decimal-convert-to">To: DEL or token address</label><input id="decimal-convert-to" name="to" type="text" required></div>
      <div class="field"><label for="decimal-convert-amount">Amount to convert</label><input id="decimal-convert-amount" name="amount" type="text" required></div>
      <div class="field"><label for="decimal-convert-min">Minimum receive amount</label><input id="decimal-convert-min" name="minAmount" type="text" value="0"></div>
      <div class="field"><label for="decimal-convert-from-decimals">From token decimals</label><input id="decimal-convert-from-decimals" name="fromDecimals" type="number" min="0" max="36" value="18"></div>
      <div class="field"><label for="decimal-convert-to-decimals">To token decimals</label><input id="decimal-convert-to-decimals" name="toDecimals" type="number" min="0" max="36" value="18"></div>
      <button type="submit" name="intent" value="preview">Preview convert</button><button type="submit" name="intent" value="send">Отправить convert реально</button>
      <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
    </fieldset></form>
    <form id="decimal-token-form" class="stacked-form"><fieldset>
      <legend>Decimal create token</legend>
      <div class="field"><label for="decimal-token-title">Title</label><input id="decimal-token-title" name="title" type="text" required></div>
      <div class="field"><label for="decimal-token-symbol">Symbol</label><input id="decimal-token-symbol" name="symbol" type="text" required></div>
      <div class="field"><label for="decimal-token-init">Initial supply</label><input id="decimal-token-init" name="initSupply" type="text" required></div>
      <div class="field"><label for="decimal-token-max">Max supply</label><input id="decimal-token-max" name="maxSupply" type="text" required></div>
      <button type="submit" name="intent" value="preview">Preview token</button><button type="submit" name="intent" value="send">Создать token реально</button>
      <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
    </fieldset></form>
    <form id="decimal-nft-form" class="stacked-form"><fieldset>
      <legend>Decimal NFT stake</legend>
      <div class="field"><label for="decimal-nft-mode">Operation</label><select id="decimal-nft-mode" name="mode"><option value="delegate">delegate NFT</option><option value="unbond">unbond NFT</option></select></div>
      <div class="field"><label for="decimal-nft-id">NFT ID</label><input id="decimal-nft-id" name="nftId" type="text" required></div>
      <div class="field"><label for="decimal-nft-validator">Validator id/address</label><input id="decimal-nft-validator" name="validator" type="text" required></div>
      <button type="submit" name="intent" value="preview">Preview NFT</button><button type="submit" name="intent" value="send">Отправить NFT op реально</button>
      <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
    </fieldset></form>`;
  }

  function minterTx(typeName, data, gasCoin, memo) {
    const txType = global.minterSDK && global.minterSDK.TX_TYPE;
    return { chainId: 1, type: txType ? txType[typeName] : typeName, data, gasCoin: gasCoin || 'BIP', payload: memo || '' };
  }

  function bindCosmosForms(chain) {
    bindOperationForm(chain, 'cosmos-send-form', (form) => {
      const to = broadcast.validateAddress(chain, form.get('to'), 'Recipient');
      const amount = normalizeAmountInput(form.get('amount'), 'Amount');
      const coin = normalizeCoinInput(form.get('coin'), 'Coin');
      if (chain.id === 'minter') {
        const tx = minterTx('SEND', { to, value: Number(amount), coin }, normalizeCoinInput(form.get('gasCoin') || coin, 'Gas coin'), String(form.get('memo') || ''));
        return broadcast.prepare(chain, 'seed', 'minterTx', [tx], { title: 'Minter send', to, amount: `${amount} ${coin}`, txType: 'SEND', coin, gasCoin: tx.gasCoin });
      }
      return broadcast.prepare(chain, 'seed', 'decimalSend', [{ to, amount, coin }], { title: 'Decimal send', to, amount: `${amount} ${coin}` });
    });

    bindOperationForm(chain, 'cosmos-delegate-form', (form) => {
      const mode = String(form.get('mode') || 'delegate');
      const amount = normalizeAmountInput(form.get('amount'), 'Stake');
      const coin = normalizeCoinInput(form.get('coin'), 'Coin');
      const validator = String(form.get('validator') || '').trim();
      if (chain.id === 'minter') {
        if (!/^Mp[0-9a-fA-F]{64}$/.test(validator)) throw new Error('Minter validator key должен быть MP + 64 hex chars.');
        const txType = mode === 'unbond' ? 'UNBOND' : 'DELEGATE';
        const tx = minterTx(txType, { publicKey: validator, coin, stake: Number(amount) }, coin, '');
        return broadcast.prepare(chain, 'seed', 'minterTx', [tx], { title: `Minter ${mode}`, amount: `${amount} ${coin}`, txType, coin, validator });
      }
      const validated = broadcast.validateDecimalValidator(validator, 'Validator');
      return broadcast.prepare(chain, 'seed', mode === 'unbond' ? 'decimalUnbond' : 'decimalDelegate', [{ validator: validated, amount, coin }], { title: `Decimal ${mode}`, amount: `${amount} ${coin}`, validator: validated, warnings: ['Decimal validator accepts API operator validator ids or validator addresses; account address validation is still enforced for transfers.'] });
    });

    bindOperationForm(chain, 'minter-swap-form', (form) => {
      const from = normalizeCoinInput(form.get('from'), 'Coin to sell');
      const to = normalizeCoinInput(form.get('to'), 'Coin to buy');
      const amount = normalizeAmountInput(form.get('amount'), 'Amount to sell');
      const min = String(form.get('min') || '0').trim().replace(',', '.');
      if (!/^\d+(?:\.\d{1,18})?$/.test(min)) throw new Error('Minimum buy amount должен быть неотрицательным числом.');
      const route = String(form.get('route') || '').split(',').map((item) => item.trim()).filter(Boolean);
      const txType = route.length ? 'SELL_SWAP_POOL' : 'SELL';
      const data = route.length ? { coins: [from].concat(route).concat([to]), valueToSell: Number(amount), minimumValueToBuy: Number(min) } : { coinToSell: from, coinToBuy: to, valueToSell: Number(amount), minimumValueToBuy: Number(min) };
      return broadcast.prepare(chain, 'seed', 'minterTx', [minterTx(txType, data, from, '')], { title: 'Minter swap', amount: `${amount} ${from} → ${to}`, txType, coin: from, warnings: route.length ? [`Route: ${[from].concat(route).concat([to]).join(' → ')}`] : [] });
    });

    bindOperationForm(chain, 'minter-liquidity-form', (form) => {
      const mode = String(form.get('mode') || 'ADD_LIQUIDITY');
      const coin0 = normalizeCoinInput(form.get('coin0'), 'Coin 0');
      const coin1 = normalizeCoinInput(form.get('coin1'), 'Coin 1');
      const volume0 = normalizeAmountInput(form.get('volume0'), mode === 'REMOVE_LIQUIDITY' ? 'Liquidity' : 'Volume 0');
      const volume1 = String(form.get('volume1') || '0').trim().replace(',', '.');
      if (!/^\d+(?:\.\d{1,18})?$/.test(volume1)) throw new Error('Volume 1 должен быть неотрицательным числом.');
      const gasCoin = normalizeCoinInput(form.get('gasCoin') || 'BIP', 'Gas coin');
      const data = mode === 'REMOVE_LIQUIDITY'
        ? { coin0, coin1, liquidity: Number(volume0) }
        : { coin0, coin1, volume0: Number(volume0), [mode === 'CREATE_SWAP_POOL' ? 'volume1' : 'maximumVolume1']: Number(volume1) };
      return broadcast.prepare(chain, 'seed', 'minterTx', [minterTx(mode, data, gasCoin, '')], { title: `Minter ${mode}`, amount: `${volume0} ${coin0} / ${volume1} ${coin1}`, txType: mode, coin: gasCoin });
    });

    bindOperationForm(chain, 'minter-hub-withdraw-form', (form) => {
      const destinationChain = String(form.get('chainId') || '').trim().toLowerCase();
      if (!/^[a-z0-9_-]{2,32}$/.test(destinationChain)) throw new Error('Destination chain id is required, for example ethereum or bsc.');
      const to = String(form.get('to') || '').trim();
      if (!to) throw new Error('Destination address is required.');
      const coin = normalizeCoinInput(form.get('coin'), 'Coin');
      const amount = normalizeAmountInput(form.get('amount'), 'Withdraw amount');
      const hubFee = String(form.get('hubFee') || '0').trim().replace(',', '.');
      if (!/^\d+(?:\.\d{1,18})?$/.test(hubFee)) throw new Error('Hub fee должен быть неотрицательным числом.');
      const gasCoin = normalizeCoinInput(form.get('gasCoin') || 'BIP', 'Gas coin');
      const [feeWhole, feeFrac = ''] = hubFee.split('.');
      const feeMinimal = `${feeWhole}${feeFrac.padEnd(18, '0')}`.replace(/^0+(?=\d)/, '') || '0';
      const memo = JSON.stringify({ recipient: to, type: `send_to_${destinationChain}`, fee: feeMinimal });
      const tx = minterTx('SEND', { to: 'Mx68f4839d7f32831b9234f9575f3b95e1afe21a56', value: Number(amount), coin }, gasCoin, memo);
      return broadcast.prepare(chain, 'seed', 'minterTx', [tx], { title: 'Minter Hub withdraw', to, amount: `${amount} ${coin}`, txType: 'SEND', coin, gasCoin, warnings: ['Legacy hub withdraw address preserved: Mx68f4839d7f32831b9234f9575f3b95e1afe21a56.', `Memo: ${memo}`] });
    });

    bindOperationForm(chain, 'minter-coin-form', (form) => {
      const mode = String(form.get('mode') || 'CREATE_TOKEN');
      const symbol = normalizeCoinInput(form.get('symbol'), 'Symbol');
      const amount = normalizeAmountInput(form.get('amount'), 'Amount');
      let data;
      if (mode === 'EDIT_COIN_OWNER') {
        data = { symbol, newOwner: broadcast.validateAddress(chain, form.get('newOwner'), 'New owner') };
      } else if (mode === 'CREATE_COIN' || mode === 'RECREATE_COIN') {
        data = { name: String(form.get('name') || symbol).trim(), symbol, initialAmount: Number(amount), maxSupply: Number(normalizeAmountInput(form.get('max'), 'Max supply')), constantReserveRatio: Number(form.get('crr') || 10), initialReserve: Number(normalizeAmountInput(form.get('reserve'), 'Initial reserve')) };
      } else if (mode === 'CREATE_TOKEN' || mode === 'RECREATE_TOKEN') {
        data = { name: String(form.get('name') || symbol).trim(), symbol, initialAmount: Number(amount), maxSupply: Number(normalizeAmountInput(form.get('max'), 'Max supply')), mintable: true, burnable: true };
      } else {
        data = { coin: symbol, value: Number(amount) };
      }
      return broadcast.prepare(chain, 'seed', 'minterTx', [minterTx(mode, data, 'BIP', '')], { title: `Minter ${mode}`, amount: `${amount} ${symbol}`, txType: mode, coin: symbol });
    });

    bindOperationForm(chain, 'decimal-convert-form', (form) => {
      const from = String(form.get('from') || '').trim();
      const to = String(form.get('to') || '').trim();
      if (!from || !to) throw new Error('Decimal convert requires from and to assets. Use DEL or token 0x address.');
      if (from.toUpperCase() !== 'DEL' && !/^0x[0-9a-fA-F]{40}$/.test(from)) throw new Error('From asset must be DEL or token 0x address.');
      if (to.toUpperCase() !== 'DEL' && !/^0x[0-9a-fA-F]{40}$/.test(to)) throw new Error('To asset must be DEL or token 0x address.');
      const amount = normalizeAmountInput(form.get('amount'), 'Convert amount');
      const minAmount = String(form.get('minAmount') || '0').trim().replace(',', '.');
      if (!/^\d+(?:\.\d{1,18})?$/.test(minAmount)) throw new Error('Minimum receive amount должен быть неотрицательным числом.');
      return broadcast.prepare(chain, 'seed', 'decimalConvert', [{ from, to, amount, minAmount, fromDecimals: Number(form.get('fromDecimals') || 18), toDecimals: Number(form.get('toDecimals') || 18) }], { title: 'Decimal convert', amount: `${amount} ${from} → ${to}` });
    });

    bindOperationForm(chain, 'decimal-token-form', (form) => broadcast.prepare(chain, 'seed', 'decimalCreateToken', [{
      title: String(form.get('title') || '').trim(),
      symbol: normalizeCoinInput(form.get('symbol'), 'Symbol'),
      initSupply: normalizeAmountInput(form.get('initSupply'), 'Initial supply'),
      maxSupply: normalizeAmountInput(form.get('maxSupply'), 'Max supply'),
      reserve: '0',
      crr: 0
    }], { title: 'Decimal create token' }));

    bindOperationForm(chain, 'decimal-nft-form', (form) => {
      const validator = broadcast.validateDecimalValidator(form.get('validator'), 'Validator');
      const nftId = String(form.get('nftId') || '').trim();
      if (!nftId) throw new Error('NFT ID is required.');
      const op = form.get('mode') === 'unbond' ? 'decimalUnbondNFT' : 'decimalDelegateNFT';
      return broadcast.prepare(chain, 'seed', op, [{ nftId, validator }], { title: op, validator });
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
      <h2>Minter broadcast</h2>
      <p>Отдельный перенос legacy broadcast: raw signed TX отправляется без seed, multisig submit принимает JSON транзакции и внешние подписи.</p>
      <form id="minter-signed-tx-form" class="stacked-form"><fieldset>
        <legend>Raw signed TX</legend>
        <div class="field"><label for="minter-signed-tx">Signed TX hex/base64</label><textarea id="minter-signed-tx" name="tx" rows="4" required></textarea></div>
        <button type="submit" name="intent" value="preview">Preview signed TX</button><button type="submit" name="intent" value="send">Отправить signed TX реально</button>
        <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
      </fieldset></form>
      <form id="minter-multisig-form" class="stacked-form"><fieldset>
        <legend>Multisig controls: transaction submit</legend>
        <div class="field"><label for="minter-multisig-address">Multisig address</label><input id="minter-multisig-address" name="multisig" type="text" required></div>
        <div class="field"><label for="minter-multisig-tx">Transaction JSON</label><textarea id="minter-multisig-tx" name="txJson" rows="6" required></textarea></div>
        <div class="field"><label for="minter-multisig-signatures">Signatures, one per line</label><textarea id="minter-multisig-signatures" name="signatures" rows="5" required></textarea></div>
        <button type="submit" name="intent" value="preview">Preview multisig submit</button><button type="submit" name="intent" value="send">Отправить multisig реально</button>
        <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
      </fieldset></form>
    </section>`;

    bindOperationForm(chain, 'minter-signed-tx-form', (form) => {
      const tx = String(form.get('tx') || '').trim();
      if (!tx) throw new Error('Signed TX is required.');
      const decoded = global.minterSDK && typeof global.minterSDK.decodeTx === 'function' ? global.minterSDK.decodeTx(tx) : null;
      return broadcast.prepareExternal(chain, 'minterSignedTx', [{ tx }], { title: 'Minter raw signed TX', warnings: decoded ? [`Decoded TX: ${JSON.stringify(broadcast.sanitizeResult(decoded))}`] : ['minterSDK.decodeTx is unavailable; v3 can still submit the raw signed TX.'] });
    });

    bindOperationForm(chain, 'minter-multisig-form', (form) => {
      const multisig = broadcast.validateAddress(chain, form.get('multisig'), 'Multisig address');
      const tx = parseJsonInput(form.get('txJson'), 'Transaction JSON');
      const signatures = String(form.get('signatures') || '').split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
      if (!signatures.length) throw new Error('At least one multisig signature is required.');
      return broadcast.prepareExternal(chain, 'minterMultisigSubmit', [{ multisig, tx, signatures }], { title: 'Minter multisig submit', to: multisig, warnings: [`Signatures: ${signatures.length}`] });
    });

    setStatus('Minter broadcast route готов: raw signed TX и multisig submit вынесены отдельно от wallet.', 'ok');
  }

  async function renderCosmosValidators(chain) {
    appEl.innerHTML = `<section class="panel"><h2>${escapeHtml(chain.title)} validators</h2><p>Загружаю...</p></section>`;
    const url = chain.id === 'minter' ? `${chain.explorerBase}/validators` : `${chain.apiBase}/validators`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Validators API HTTP ${response.status}`);
    const data = await response.json();
    const list = data.data || data.result || data.validators || [];
    appEl.innerHTML = `<section class="panel"><h2>${escapeHtml(chain.title)} validators</h2><p>Delegate/unbond формы доступны в Wallet/Broadcast.</p><ul>${list.slice(0, 100).map((v) => `<li><code>${escapeHtml(v.public_key || v.address || v.operator_address || '')}</code> ${escapeHtml(v.name || v.moniker || '')} ${escapeHtml(v.stake || v.power || '')}</li>`).join('') || '<li>Список пуст или API вернул неизвестный формат.</li>'}</ul></section>`;
    setStatus(`${chain.title} validators loaded: ${list.length}.`, 'ok');
  }

  async function renderCosmosExplorer(chain, account) {
    const state = parseHash();
    appEl.innerHTML = `<section class="panel"><h2>${escapeHtml(chain.title)} explorer</h2>
      <p>Откройте адрес, транзакцию или блок. Основные данные показаны первыми; raw JSON спрятан в details для проверки.</p>
      <form id="explorer-form" class="route-form"><div class="field"><label for="explorer-kind">Что открыть</label><select id="explorer-kind" name="kind"><option value="address" ${state.kind === 'address' ? 'selected' : ''}>Адрес</option><option value="tx" ${state.kind === 'tx' ? 'selected' : ''}>Транзакция</option><option value="block" ${state.kind === 'block' ? 'selected' : ''}>Блок</option></select></div><div class="field field-grow"><label for="explorer-value">Адрес, tx hash или номер блока</label><input id="explorer-value" name="value" type="text" value="${escapeHtml(state.value || account)}"></div><button type="submit">Открыть</button></form>
      <div id="explorer-result" class="operation-result" role="status" aria-live="polite">Выберите, что открыть, и введите адрес, tx hash или номер блока.</div></section>`;
    document.getElementById('explorer-form').addEventListener('submit', (event) => { event.preventDefault(); const form = new FormData(event.currentTarget); navigate({ chain: chain.id, app: 'explorer', account, kind: form.get('kind'), value: String(form.get('value') || '').trim() }); });
    if (!state.kind || !state.value) {
      setStatus(`${chain.title} explorer готов.`, 'info');
      return;
    }
    let url;
    if (chain.id === 'minter') {
      const base = chain.explorerBase;
      url = state.kind === 'tx' ? `${base}/transactions/${state.value}` : state.kind === 'block' ? `${base}/blocks/${state.value}` : `${base}/addresses/${state.value}`;
    } else {
      const base = chain.apiBase;
      url = state.kind === 'tx' ? `${base}/txs/${state.value}` : state.kind === 'block' ? `${base}/blocks/${state.value}` : `${base}/addresses/${state.value}/balances`;
    }
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Explorer API HTTP ${response.status}`);
    const result = await response.json();
    document.getElementById('explorer-result').innerHTML = renderExplorerResult(chain, state.kind, state.value, result);
    setStatus(`${chain.title} explorer loaded.`, 'ok');
  }

  function renderCosmosCalculator(chain) {
    appEl.innerHTML = `<section class="panel"><h2>${escapeHtml(chain.title)} calculator</h2><form id="calculator-form" class="stacked-form"><fieldset><legend>Amount helper</legend><div class="field"><label for="calc-amount">Amount</label><input id="calc-amount" name="amount" type="text" value="1"></div><button type="submit">Convert to 10^18 units</button><div class="operation-result" data-operation-result role="status" aria-live="polite"></div></fieldset></form></section>`;
    document.getElementById('calculator-form').addEventListener('submit', (event) => { event.preventDefault(); const form = event.currentTarget; const amount = normalizeAmountInput(new FormData(form).get('amount'), 'Amount'); const wei = amount.replace('.', '').padEnd((amount.split('.')[0] || '').length + 18, '0'); setOperationResult(form, `${amount} ${chain.liquidSymbol} ≈ ${wei} minimal units`, 'ok'); });
    setStatus(`${chain.title} calculator ready.`, 'ok');
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
            <label for="history-ops">Операции через запятую</label>
            <input id="history-ops" name="ops" type="text" value="${escapeHtml(selectedOps.join(','))}" placeholder="transfer,award">
          </div>
          <div class="field field-grow">
            <label for="history-query">Поиск по JSON</label>
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
      navigate({
        chain: chain.id,
        app: 'history',
        account,
        ops: String(form.get('ops') || '').trim(),
        query: String(form.get('query') || '').trim()
      });
    });

    setStatus(`История @${account} загружена: ${items.length} операций.`, 'ok');
  }

  async function renderProfileRoute(chain, account) {
    appEl.innerHTML = '<section class="panel"><h2>Загрузка профиля</h2><p>Подключаю библиотеку и публичную ноду...</p></section>';
    setStatus(`Загружаю ${chain.title}: @${account}...`, 'loading');

    const connection = await getConnection(chain);
    const rawAccount = await profiles.fetchAccount(connection, account);
    const enrichedAccount = await profiles.enrichAccount(connection, rawAccount);
    renderProfile(profiles.normalizeAccount(connection, enrichedAccount));
    const accountLabel = chain.id === 'minter' || chain.id === 'decimal' ? account : `@${account}`;
    setStatus(`Профиль ${chain.title}: ${accountLabel} загружен.`, 'ok');
  }

  async function renderRoute() {
    const state = parseHash();
    const chain = chains[state.chain] || chains.viz;
    const app = chain.apps.find((item) => item.id === state.app) || chain.apps[0];
    const account = getRouteAccount(state, chain);

    fillChainSelect(chain.id);
    fillAppSelect(chain, app.id);
    accountInput.value = account;

    try {
      if (chain.id === 'minter' && app.id === 'broadcast') {
        renderMinterBroadcast(chain);
      } else if (chain.id === 'decimal' && app.id === 'broadcast') {
        renderCosmosWallet(chain, account);
      } else if (isCosmosChain(chain) && (app.id === 'wallet' || app.id === 'swap' || app.id === 'my-coin')) {
        renderCosmosWallet(chain, account);
      } else if (isCosmosChain(chain) && app.id === 'validators') {
        await renderCosmosValidators(chain);
      } else if (isCosmosChain(chain) && app.id === 'explorer') {
        await renderCosmosExplorer(chain, account);
      } else if (isCosmosChain(chain) && app.id === 'calculator') {
        renderCosmosCalculator(chain);
      } else if (isCosmosChain(chain) && app.id === 'randomblockchain') {
        renderServicePlaceholder(chain, app);
      } else if (app.id === 'profiles') {
        await renderProfileRoute(chain, account);
      } else if (app.id === 'accounts') {
        await renderAccounts(chain);
      } else if (app.id === 'wallet') {
        await renderWallet(chain, account);
      } else if (app.id === 'history') {
        await renderHistory(chain, account);
      } else if (app.id === 'broadcast') {
        await renderBroadcast(chain);
      } else if (chain.id === 'viz' && app.id === 'award') {
        renderVizAward(chain);
      } else if (chain.id === 'golos' && app.id === 'donate') {
        renderGolosDonate(chain);
      } else if (app.id === 'editor') {
        renderEditor(chain);
      } else if (app.id === 'calculator') {
        await renderCalculator(chain, account);
      } else if (app.id === 'manage') {
        renderManage(chain);
      } else if (app.id === 'explorer') {
        await renderExplorer(chain, account);
      } else if (chain.id === 'viz' && app.id === 'exchanges') {
        renderVizExchanges(chain);
      } else if (app.id === 'import') {
        renderImport(chain);
      } else if (app.id === 'instant-view') {
        renderInstantView(chain);
      } else if (app.id === 'swap') {
        renderSwap(chain);
      } else if (app.id === 'register' || app.id === 'registration') {
        renderRegister(chain);
      } else {
        renderServicePlaceholder(chain, app);
      }
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
    fillAppSelect(chain, chain.apps[0].id);
    accountInput.value = auth.getCurrentLogin(chain) || chain.defaultAccount || '';
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
