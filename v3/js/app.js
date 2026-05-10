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
  const accountField = accountInput ? accountInput.closest('.field') : null;
  const statusEl = document.getElementById('status');
  const appEl = document.getElementById('app');
  const loadedScripts = new Set();
  const LONG_API_BASE = 'https://backend.dpos.space/smartfarm';
  const MINTER_LONG_POOL_URL = 'https://api-minter.mnst.club/v2/swap_pool/0/2782';

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

  function appRequiresAccount(app) {
    return Boolean(app && app.accountField === true);
  }

  function updateAccountField(app) {
    const visible = appRequiresAccount(app);
    if (!accountField) return;
    accountField.hidden = !visible;
    accountField.setAttribute('aria-hidden', visible ? 'false' : 'true');
    accountInput.disabled = !visible;
    accountInput.tabIndex = visible ? 0 : -1;
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
              <th scope="col">Блок</th>
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
  }

  function renderUnsupported(chain, app) {
    appEl.innerHTML = `
      <section class="panel">
        <h2>${escapeHtml(chain.title)}: ${escapeHtml(app.title)}</h2>
        <p>Этот раздел пока недоступен или требует отдельной безопасной формы подтверждения.</p>
      </section>
    `;
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
          setOperationResult(form, 'Отправка отменена пользователем. Данные операции показаны ниже.', 'info', prepared);
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
        <p><strong>Доступ к аккаунту:</strong> ${escapeHtml(keyStatusText(auth.getKeyStatus(chain, current)))}</p>
        <p class="notice">Перед отправкой можно проверить операцию. Реальная отправка запускается отдельной кнопкой и подтверждается в браузере.</p>
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
    setStatus(`Кошелёк @${account} загружен: доступны проверка операций, кнопки «Максимум» и отправка в сеть.`, 'ok');
  }

  function walletCapabilities(chain) {
    const capabilities = {
      golos: ['балансы GOLOS/GBG', 'vesting/СГ', 'делегирование', 'перевод', 'power up', 'донат', 'TIP операции пока недоступны'],
      viz: ['баланс VIZ', 'SHARES', 'энергия/награды', 'перевод', 'power up', 'делегирование', 'invite операции пока недоступны'],
      hive: ['балансы HIVE/HBD', 'HP/VESTS', 'savings', 'получение наград', 'делегирование', 'перевод', 'power up'],
      steem: ['балансы STEEM/SBD', 'SP/VESTS', 'savings', 'получение наград', 'делегирование', 'перевод', 'power up']
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
          <legend>Перевод (${escapeHtml(liquid)})</legend>
          <div class="field"><label for="wallet-transfer-to">Получатель</label><input id="wallet-transfer-to" name="to" type="text" required autocomplete="off"></div>
          <div class="field"><label for="wallet-transfer-amount">Сумма с символом</label><input id="wallet-transfer-amount" name="amount" type="text" required placeholder="1.000 ${escapeHtml(liquid)}">${liquidMax ? ` <button type="button" data-fill-target="wallet-transfer-amount" data-fill-value="${escapeHtml(liquidMax)}">Максимум ${escapeHtml(liquidMax)}</button>` : ''}</div>
          <div class="field"><label for="wallet-transfer-memo">Memo</label><input id="wallet-transfer-memo" name="memo" type="text"></div>
          <button type="submit" name="intent" value="preview">Проверить перевод</button>
          <button type="submit" name="intent" value="send">Отправить перевод в сеть</button>
          <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
        </fieldset>
      </form>
      <form id="wallet-vesting-form" class="stacked-form">
        <fieldset>
          <legend>Перевод в соцкапитал / power up</legend>
          <div class="field"><label for="wallet-vesting-to">Получатель power up</label><input id="wallet-vesting-to" name="to" type="text" autocomplete="off" placeholder="пусто = текущий аккаунт"></div>
          <div class="field"><label for="wallet-vesting-amount">Сумма с символом</label><input id="wallet-vesting-amount" name="amount" type="text" required placeholder="1.000 ${escapeHtml(liquid)}">${liquidMax ? ` <button type="button" data-fill-target="wallet-vesting-amount" data-fill-value="${escapeHtml(liquidMax)}">Максимум ${escapeHtml(liquidMax)}</button>` : ''}</div>
          <button type="submit" name="intent" value="preview">Проверить перевод в соцкапитал</button>
          <button type="submit" name="intent" value="send">Отправить power up в сеть</button>
          <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
        </fieldset>
      </form>
      <form id="wallet-withdraw-vesting-form" class="stacked-form">
        <fieldset>
          <legend>Вывод vesting / power down</legend>
          <div class="field"><label for="wallet-withdraw-vesting-amount">Сумма vesting с символом</label><input id="wallet-withdraw-vesting-amount" name="vesting" type="text" required placeholder="0.000000 ${escapeHtml(vesting)}">${vestingMax ? ` <button type="button" data-fill-target="wallet-withdraw-vesting-amount" data-fill-value="${escapeHtml(vestingMax)}">Максимум ${escapeHtml(vestingMax)}</button>` : ''}</div>
          <button type="submit" name="intent" value="preview">Проверить вывод vesting</button>
          <button type="submit" name="intent" value="send">Отправить power down в сеть</button>
          <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
        </fieldset>
      </form>
      <form id="wallet-delegation-form" class="stacked-form">
        <fieldset>
          <legend>Делегирование</legend>
          <div class="field"><label for="wallet-delegation-to">Кому делегировать</label><input id="wallet-delegation-to" name="delegatee" type="text" required autocomplete="off"></div>
          <div class="field"><label for="wallet-delegation-vesting">Сумма vesting с символом</label><input id="wallet-delegation-vesting" name="vesting" type="text" required placeholder="0.000000 ${escapeHtml(vesting)}">${vestingMax ? ` <button type="button" data-fill-target="wallet-delegation-vesting" data-fill-value="${escapeHtml(vestingMax)}">Максимум ${escapeHtml(vestingMax)}</button>` : ''}</div>
          <button type="submit" name="intent" value="preview">Проверить делегирование</button>
          <button type="submit" name="intent" value="send">Отправить делегирование в сеть</button>
          <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
        </fieldset>
      </form>
      ${supportsClaim ? `<form id="wallet-claim-form" class="stacked-form">
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
      </form>` : ''}
      ${supportsSavings ? `<form id="wallet-savings-to-form" class="stacked-form">
        <fieldset>
          <legend>Перевод в savings</legend>
          <div class="field"><label for="wallet-savings-to">Получатель savings</label><input id="wallet-savings-to" name="to" type="text" autocomplete="off" placeholder="пусто = текущий аккаунт"></div>
          <div class="field"><label for="wallet-savings-amount">Сумма с символом</label><input id="wallet-savings-amount" name="amount" type="text" required placeholder="1.000 ${escapeHtml(liquid)}"></div>
          <div class="field"><label for="wallet-savings-memo">Memo</label><input id="wallet-savings-memo" name="memo" type="text"></div>
          <button type="submit" name="intent" value="preview">Проверить перевод в savings</button>
          <button type="submit" name="intent" value="send">Отправить в savings в сеть</button>
          <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
        </fieldset>
      </form>
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
      </form>
      <form id="wallet-savings-cancel-form" class="stacked-form">
        <fieldset>
          <legend>Отмена вывода из savings</legend>
          <div class="field"><label for="wallet-savings-cancel-request-id">ID запроса</label><input id="wallet-savings-cancel-request-id" name="requestId" type="number" min="0" step="1" required value="0"></div>
          <button type="submit" name="intent" value="preview">Проверить отмену вывода из savings</button>
          <button type="submit" name="intent" value="send">Отменить вывод в сети</button>
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
        ${walletPrepareForms(chain)}
      </section>`;
    bindWalletForms(chain);
    bindMaxButtons(appEl);
    setStatus('Отправка операций готова: доступны проверка и отправка в сеть.', 'ok');
  }

  function renderVizAward(chain) {
    appEl.innerHTML = `
      <section class="panel">
        <h2>VIZ: награда</h2>
        <p>Награждение VIZ: сначала проверка операции, затем отправка по подтверждению.</p>
        <form id="viz-award-form" class="stacked-form">
          <fieldset>
            <legend>Награда</legend>
            <div class="field"><label for="award-target">Кого наградить</label><input id="award-target" name="target" type="text" required autocomplete="off"></div>
            <div class="field"><label for="award-energy">Энергия, %</label><input id="award-energy" name="energy" type="number" min="0.01" max="100" step="0.01" required></div>
            <div class="field"><label for="award-memo">Memo</label><textarea id="award-memo" name="memo" rows="4"></textarea></div>
            <button type="submit" name="intent" value="preview">Проверить награду</button>
            <button type="submit" name="intent" value="send">Отправить награду в сеть</button>
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
    setStatus('VIZ-награда готова: проверка или отправка по подтверждению.', 'ok');
  }

  function renderGolosDonate(chain) {
    appEl.innerHTML = `
      <section class="panel">
        <h2>Golos: донат</h2>
        <p>Донат GOLOS: сначала проверка операции, затем отправка по подтверждению.</p>
        <form id="golos-donate-form" class="stacked-form">
          <fieldset>
            <legend>Донат</legend>
            <div class="field"><label for="donate-to">Получатель</label><input id="donate-to" name="to" type="text" required autocomplete="off"></div>
            <div class="field"><label for="donate-amount">Сумма</label><input id="donate-amount" name="amount" type="text" required placeholder="1.000 GOLOS"></div>
            <div class="field"><label for="donate-memo">Комментарий</label><textarea id="donate-memo" name="memo" rows="4"></textarea></div>
            <button type="submit" name="intent" value="preview">Проверить донат</button>
            <button type="submit" name="intent" value="send">Отправить донат в сеть</button>
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
    setStatus('Golos-донат готов: проверка или отправка по подтверждению.', 'ok');
  }

  function renderEditor(chain) {
    const debt = chain.debtSymbol || 'HBD';
    let draft = null;
    try { draft = JSON.parse(localStorage.getItem(`${chain.id}_v3_import_draft`) || 'null'); } catch (error) { draft = null; }
    appEl.innerHTML = `
      <section class="panel">
        <h2>${escapeHtml(chain.title)}: редактор</h2>
        <p>Редактор публикаций: подготовка поста, проверка операции и отправка по подтверждению.</p>
        <form id="editor-form" class="stacked-form">
          <fieldset>
            <legend>Публикация поста</legend>
            <div class="field"><label for="editor-title">Заголовок</label><input id="editor-title" name="title" type="text" required value="${escapeHtml(draft && draft.title ? draft.title : '')}"></div>
            <div class="field"><label for="editor-permlink">Permlink</label><input id="editor-permlink" name="permlink" type="text" required></div>
            <div class="field"><label for="editor-tags">Теги через пробел</label><input id="editor-tags" name="tags" type="text" placeholder="dpos space"></div>
            <div class="field"><label for="editor-body">Текст поста</label><textarea id="editor-body" name="body" rows="8" required>${escapeHtml(draft && draft.body ? draft.body : '')}</textarea></div>
            <button type="submit" name="intent" value="preview">Проверить публикацию</button>
            <button type="submit" name="intent" value="send">Опубликовать в сеть</button>
            <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
          </fieldset>
        </form>
        ${draft ? `<p class="notice">Загружен черновик из импорта: ${escapeHtml(draft.sourceUrl || draft.importedAt || '')}</p>` : ''}
        <p class="muted">Параметры выплат выставлены по умолчанию. Перед отправкой проверьте итоговые данные операции.</p>
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
    setStatus(`${chain.title} редактор готов: проверка или отправка по подтверждению.`, 'ok');
  }

  async function renderCalculator(chain, account) {
    appEl.innerHTML = '<section class="panel"><h2>Загрузка калькулятора</h2><p>Читаю параметры сети...</p></section>';
    const connection = await getConnection(chain);
    const props = await profiles.apiCall(connection, 'getDynamicGlobalProperties', []);
    const totalFund = parseFloat(props.total_vesting_fund_steem || props.total_vesting_fund_hive || props.total_vesting_fund || '0');
    const totalShares = parseFloat(props.total_vesting_shares || '0');
    const perMillion = totalFund && totalShares ? (1000000 * totalFund / totalShares) : 0;

    appEl.innerHTML = `
      <section class="panel">
        <h2>${escapeHtml(chain.title)}: калькулятор ${escapeHtml(chain.powerTitle || chain.vestingSymbol)}</h2>
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
        <p>Управление аккаунтом: proxy, голосование за witness, настройки witness, профиль и права доступа. Для VIZ доступны invite и committee операции.</p>
        <form id="manage-proxy-form" class="stacked-form">
          <fieldset>
            <legend>Witness proxy</legend>
            <div class="field"><label for="manage-proxy-login">Прокси-аккаунт</label><input id="manage-proxy-login" name="proxy" type="text" autocomplete="off" placeholder="пусто = снять proxy"></div>
            <button type="submit" name="intent" value="preview">Проверить proxy</button>
            <button type="submit" name="intent" value="send">Установить proxy в сети</button>
            <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
          </fieldset>
        </form>
        <form id="manage-witness-form" class="stacked-form">
          <fieldset>
            <legend>Голосование за witness</legend>
            <div class="field"><label for="manage-witness-login">Witness</label><input id="manage-witness-login" name="witness" type="text" required autocomplete="off"></div>
            <label class="inline-choice"><input name="approve" type="checkbox" checked> подтвердить голос</label>
            <button type="submit" name="intent" value="preview">Проверить голос</button>
            <button type="submit" name="intent" value="send">Отправить голос в сеть</button>
            <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
          </fieldset>
        </form>
        <form id="manage-witness-update-form" class="stacked-form">
          <fieldset>
            <legend>Настройки / активация witness</legend>
            <p class="muted">Настройки witness: URL, публичный signing key и параметры. Пустые параметры будут обработаны библиотекой или нодой, если это поддерживается.</p>
            <div class="field"><label for="manage-witness-url">URL witness</label><input id="manage-witness-url" name="url" type="url" required></div>
            <div class="field"><label for="manage-witness-key">Публичный ключ подписи блоков</label><input id="manage-witness-key" name="signingKey" type="text" required></div>
            <div class="field"><label for="manage-witness-fee">Комиссия</label><input id="manage-witness-fee" name="fee" type="text" required placeholder="0.000 ${escapeHtml(chain.liquidSymbol)}"></div>
            <div class="field"><label for="manage-witness-props">Props JSON (опционально)</label><textarea id="manage-witness-props" name="props" rows="4" placeholder='{"account_creation_fee":"3.000 ${escapeHtml(chain.liquidSymbol)}"}'></textarea></div>
            <button type="submit" name="intent" value="preview">Проверить обновление witness</button>
            <button type="submit" name="intent" value="send">Обновить witness в сети</button>
            <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
          </fieldset>
        </form>
        <form id="manage-authority-form" class="stacked-form">
          <fieldset>
            <legend>Обновление authority / доступа</legend>
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
        </form>
        <form id="manage-profile-form" class="stacked-form">
          <fieldset>
            <legend>Метаданные профиля</legend>
            <div class="field"><label for="manage-profile-name">Отображаемое имя</label><input id="manage-profile-name" name="name" type="text"></div>
            <div class="field"><label for="manage-profile-about">О себе</label><textarea id="manage-profile-about" name="about" rows="3"></textarea></div>
            <div class="field"><label for="manage-profile-location">Локация</label><input id="manage-profile-location" name="location" type="text"></div>
            <div class="field"><label for="manage-profile-website">Сайт</label><input id="manage-profile-website" name="website" type="url"></div>
            <button type="submit" name="intent" value="preview">Проверить обновление профиля</button>
            <button type="submit" name="intent" value="send">Обновить профиль в сети</button>
            <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
          </fieldset>
        </form>
        ${chain.id === 'viz' ? `<form id="viz-create-invite-form" class="stacked-form"><fieldset>
          <legend>VIZ: создание invite</legend>
          <div class="field"><label for="viz-invite-balance">Баланс инвайта</label><input id="viz-invite-balance" name="balance" type="text" required placeholder="1.000 VIZ"></div>
          <div class="field"><label for="viz-invite-public">Публичный ключ invite</label><input id="viz-invite-public" name="publicKey" type="text" required></div>
          <button type="submit" name="intent" value="preview">Проверить create_invite</button><button type="submit" name="intent" value="send">Создать invite в сети</button>
          <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
        </fieldset></form>
        <form id="viz-use-invite-form" class="stacked-form"><fieldset>
          <legend>VIZ: использование/получение invite balance</legend>
          <div class="field"><label for="viz-use-invite-secret">Секрет invite</label><input id="viz-use-invite-secret" name="secret" type="text" required></div>
          <div class="field"><label for="viz-use-invite-receiver">Получатель</label><input id="viz-use-invite-receiver" name="receiver" type="text" placeholder="пусто = текущий аккаунт"></div>
          <label class="inline-choice"><input name="toVesting" type="checkbox" checked> use_invite_balance в SHARES; иначе claim_invite_balance в VIZ</label>
          <button type="submit" name="intent" value="preview">Проверить invite use/claim</button><button type="submit" name="intent" value="send">Использовать invite в сети</button>
          <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
        </fieldset></form>
        <form id="viz-committee-form" class="stacked-form"><fieldset>
          <legend>VIZ committee: заявка воркера / голос</legend>
          <div class="field"><label for="viz-committee-mode">Режим</label><select id="viz-committee-mode" name="mode"><option value="create">создать заявку</option><option value="vote">голосовать за заявку</option></select></div>
          <div class="field"><label for="viz-committee-id">ID запроса для голоса</label><input id="viz-committee-id" name="requestId" type="number" min="0" step="1" value="0"></div>
          <div class="field"><label for="viz-committee-url">URL</label><input id="viz-committee-url" name="url" type="url"></div>
          <div class="field"><label for="viz-committee-worker">Воркер</label><input id="viz-committee-worker" name="worker" type="text"></div>
          <div class="field"><label for="viz-committee-min">Минимальная награда</label><input id="viz-committee-min" name="min" type="text" placeholder="1.000 VIZ"></div>
          <div class="field"><label for="viz-committee-max">Максимальная награда</label><input id="viz-committee-max" name="max" type="text" placeholder="2.000 VIZ"></div>
          <div class="field"><label for="viz-committee-days">Длительность, дней</label><input id="viz-committee-days" name="days" type="number" min="1" step="1" value="5"></div>
          <div class="field"><label for="viz-committee-vote">Процент голоса</label><input id="viz-committee-vote" name="vote" type="number" min="-100" max="100" step="1" value="100"></div>
          <button type="submit" name="intent" value="preview">Проверить committee</button><button type="submit" name="intent" value="send">Отправить committee в сеть</button>
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
    ], { title: 'Голосование за witness', to: normalizeAccountInput(chain, form.get('witness'), 'Witness') }));

    bindOperationForm(chain, 'manage-witness-update-form', (form) => {
      const account = auth.getCurrentLogin(chain);
      const url = String(form.get('url') || '').trim();
      const signingKey = String(form.get('signingKey') || '').trim();
      const fee = normalizeAssetInput(chain, form.get('fee'), chain.liquidSymbol, 'Witness fee');
      let props = {};
      const rawProps = String(form.get('props') || '').trim();
      if (rawProps) {
        try { props = JSON.parse(rawProps); } catch (error) { throw new Error('Props JSON должен быть корректным JSON.'); }
      }
      if (!signingKey || broadcast.isLikelyWif(signingKey)) throw new Error('Signing key должен быть публичным ключом, а не приватным WIF.');
      return broadcast.prepare(chain, 'active', 'witnessUpdate', [account, url, signingKey, props, fee], { title: 'Witness update', amount: fee, warnings: ['Внимательно проверьте witness props: неверные параметры сети могут сделать настройки witness некорректными.'] });
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
        return broadcast.prepare(chain, 'active', 'accountUpdate', [account, undefined, undefined, undefined, undefined, json], { title: 'Profile update', warnings: ['Обновляет json_metadata через account_update; posting_json_metadata зависит от версии библиотеки и здесь не используется.'] });
      }
      return broadcast.prepare(chain, 'posting', 'accountMetadata', [account, json], { title: 'Profile metadata update' });
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

    bindOperationForm(chain, 'viz-committee-form', (form) => {
      const mode = String(form.get('mode') || 'create');
      if (mode === 'vote') {
        const requestId = broadcast.validateRequestId(form.get('requestId'));
        const vote = Math.round(Number(form.get('vote') || 0) * 100);
        return broadcast.prepare(chain, 'regular', 'committeeVoteRequest', [auth.getCurrentLogin(chain), requestId, vote], { title: 'VIZ committee vote', requestId });
      }
      const worker = normalizeAccountInput(chain, form.get('worker'), 'Воркер');
      const min = normalizeAssetInput(chain, form.get('min'), chain.liquidSymbol, 'Минимальная награда');
      const max = normalizeAssetInput(chain, form.get('max'), chain.liquidSymbol, 'Максимальная награда');
      const duration = Number(form.get('days') || 1) * 86400;
      return broadcast.prepare(chain, 'regular', 'committeeWorkerCreateRequest', [auth.getCurrentLogin(chain), String(form.get('url') || '').trim(), worker, min, max, duration], { title: 'VIZ committee создать заявку', to: worker, amount: `${min}..${max}` });
    });
    setStatus(`${chain.title} управление готово: proxy/witness/настройки/authority/профиль${chain.id === 'viz' ? '/invite/committee' : ''}.`, 'ok');
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

    if (!state.kind || !state.value) {
      setStatus(`${chain.title} проводник готов.`, 'info');
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
    setStatus(`${chain.title} проводник: ${state.kind} загружен.`, 'ok');
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

  function renderImport(chain) {
    const draftKey = `${chain.id}_v3_import_draft`;
    appEl.innerHTML = `
      <section class="panel">
        <h2>${escapeHtml(chain.title)}: импорт статьи</h2>
        <p>Вставьте URL или текст статьи. Если сайт разрешает загрузку из браузера, текст будет подготовлен как черновик для редактора.</p>
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
      if (!source && url) {
        const response = await fetch(url);
        source = await response.text();
      }
      const titleMatch = source.match(/<title[^>]*>([^<]+)<\/title>/i) || source.match(/^#\s+(.+)$/m);
      const title = titleMatch ? titleMatch[1].trim() : '';
      const body = source.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s{3,}/g, '\n\n').trim();
      const draft = { title, body, sourceUrl: url, importedAt: new Date().toISOString() };
      localStorage.setItem(draftKey, JSON.stringify(draft));
      setOperationResult(form, `Черновик сохранён. Откройте редактор ${chain.title}, чтобы проверить заголовок и текст.`, 'ok', { chain: chain.id, from: auth.getCurrentLogin(chain), authority: 'posting', operationName: 'importDraft', params: [{ title, body: body.slice(0, 1000), sourceUrl: url }], meta: { title: 'Импорт черновика', warnings: url ? ['Если URL не загрузился из-за ограничений сайта, вставьте текст вручную.'] : [] } });
    });
    setStatus(`${chain.title} импорт готов: URL/text → черновик.`, 'ok');
  }

  function renderInstantView(chain) {
    appEl.innerHTML = `
      <section class="panel">
        <h2>${escapeHtml(chain.title)}: Instant View</h2>
        <p>Показывает очищенный предпросмотр HTML/Markdown без отправки операций.</p>
        <form id="instant-view-form" class="stacked-form">
          <fieldset>
            <legend>Предпросмотр</legend>
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
      setOperationResult(form, 'Instant View готов.', 'ok', { chain: chain.id, from: auth.getCurrentLogin(chain), authority: 'posting', operationName: 'instantView', params: [{ text }], meta: { title: 'Instant View', warnings: [] } });
    });
    setStatus(`${chain.title} Instant View готов.`, 'ok');
  }

  function renderSwap(chain) {
    if (chain.id === 'viz') {
      renderServicePlaceholder(chain, { id: 'swap', title: 'Swap', description: 'У VIZ в старом коде нет ясного DEX/swap flow.' });
      return;
    }
    appEl.innerHTML = `
      <section class="panel">
        <h2>${escapeHtml(chain.title)}: маркет / обмен</h2>
        <p>Создание и отмена рыночных ордеров с подтверждением операции.</p>
        <form id="swap-create-form" class="stacked-form"><fieldset>
          <legend>Создание лимитного ордера</legend>
          <div class="field"><label for="swap-order-id">ID ордера</label><input id="swap-order-id" name="orderId" type="number" min="0" step="1" required value="0"></div>
          <div class="field"><label for="swap-sell">Сумма продажи</label><input id="swap-sell" name="sell" type="text" required placeholder="1.000 ${escapeHtml(chain.liquidSymbol)}"></div>
          <div class="field"><label for="swap-buy">Минимум к получению</label><input id="swap-buy" name="buy" type="text" required placeholder="1.000 ${escapeHtml(chain.debtSymbol || chain.liquidSymbol)}"></div>
          <label class="inline-choice"><input name="fillOrKill" type="checkbox"> fill or kill</label>
          <div class="field"><label for="swap-expiration">Срок действия UTC</label><input id="swap-expiration" name="expiration" type="datetime-local" required></div>
          <button type="submit" name="intent" value="preview">Проверить ордер</button><button type="submit" name="intent" value="send">Создать ордер в сети</button>
          <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
        </fieldset></form>
        <form id="swap-cancel-form" class="stacked-form"><fieldset>
          <legend>Отмена ордера</legend>
          <div class="field"><label for="swap-cancel-id">ID ордера</label><input id="swap-cancel-id" name="orderId" type="number" min="0" step="1" required></div>
          <button type="submit" name="intent" value="preview">Проверить отмену</button><button type="submit" name="intent" value="send">Отменить ордер в сети</button>
          <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
        </fieldset></form>
      </section>`;
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
    setStatus(`${chain.title} swap/market готов: создание/отмена ордера.`, 'ok');
  }

  function renderRegister(chain) {
    const isGolos = chain.id === 'golos';
    const isViz = chain.id === 'viz';
    appEl.innerHTML = `
      <section class="panel">
        <h2>${escapeHtml(chain.title)}: регистрация</h2>
        ${isGolos || isViz ? `<p>Регистрация по invite: WIF подписанта используется только в памяти для отправки и не сохраняется. Для ${escapeHtml(chain.title)} нужен приватный WIF service/invite аккаунта с правом регистрации.</p>` : '<p>Для Hive/Steem укажите fee/delegation и публичные ключи нового аккаунта. Операция отправляется только после подтверждения текущим active key.</p>'}
        ${isGolos ? '<p class="notice">Для Golos также доступно создание аккаунта с делегированием. Вводится только публичный ключ нового аккаунта; приватные ключи не генерируются и не показываются.</p>' : ''}
        <form id="register-form" class="stacked-form"><fieldset>
          <legend>Создание аккаунта</legend>
          <div class="field"><label for="register-name">Новый аккаунт</label><input id="register-name" name="name" type="text" required></div>
          ${isGolos || isViz ? '<div class="field"><label for="register-invite">Секрет/код invite</label><input id="register-invite" name="invite" type="text" required></div>' : `<div class="field"><label for="register-fee">Комиссия</label><input id="register-fee" name="fee" type="text" required placeholder="3.000 ${escapeHtml(chain.liquidSymbol)}"></div>`}
          ${isGolos ? '<div class="field"><label for="register-signer">Аккаунт service-подписанта</label><input id="register-signer" name="signer" type="text" required value="dpos.space-reg"></div>' : ''}
          ${isViz ? '<div class="field"><label for="register-signer">Аккаунт invite-подписанта</label><input id="register-signer" name="signer" type="text" required value="invite"></div>' : ''}
          ${isGolos || isViz ? '<div class="field"><label for="register-signer-wif">Приватный WIF service/invite подписанта</label><input id="register-signer-wif" name="signerWif" type="password" autocomplete="off" required><small>Используется только в памяти для подписи. Не вставляйте сюда ключ нового аккаунта.</small></div>' : ''}
          <div class="field"><label for="register-public-key">Публичный ключ для authority нового аккаунта</label><input id="register-public-key" name="publicKey" type="text" required></div>
          <button type="submit" name="intent" value="preview">Проверить регистрацию</button>
          <button type="submit" name="intent" value="send">Создать аккаунт в сети</button>
          <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
        </fieldset></form>
        ${isGolos ? `<form id="golos-register-delegation-form" class="stacked-form"><fieldset>
          <legend>Golos: создание аккаунта с делегированием</legend>
          <div class="field"><label for="golos-register-delegation-name">Новый аккаунт</label><input id="golos-register-delegation-name" name="name" type="text" required></div>
          <div class="field"><label for="golos-register-delegation-fee">Комиссия</label><input id="golos-register-delegation-fee" name="fee" type="text" required value="1.000 GOLOS"></div>
          <div class="field"><label for="golos-register-delegation-vesting">Делегирование</label><input id="golos-register-delegation-vesting" name="delegation" type="text" required placeholder="0.000000 GESTS"></div>
          <div class="field"><label for="golos-register-delegation-public-key">Публичный ключ для authority нового аккаунта</label><input id="golos-register-delegation-public-key" name="publicKey" type="text" required></div>
          <button type="submit" name="intent" value="preview">Проверить создание с делегированием</button>
          <button type="submit" name="intent" value="send">Создать с делегированием в сети</button>
          <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
        </fieldset></form>` : ''}
      </section>`;

    bindOperationForm(chain, 'register-form', (form) => {
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
      register: `${chain.title}: регистрация аккаунта пока недоступна для этой сети.`
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
    return `<form id="minter-swap-form" class="stacked-form"><fieldset>
      <legend>Minter: обмен / продажа</legend>
      <div class="field"><label for="minter-swap-from">Монета к продаже</label><input id="minter-swap-from" name="from" type="text" required value="BIP"></div>
      <div class="field"><label for="minter-swap-to">Монета к покупке</label><input id="minter-swap-to" name="to" type="text" required></div>
      <div class="field"><label for="minter-swap-amount">Сумма к продаже</label><input id="minter-swap-amount" name="amount" type="text" required></div>
      <div class="field"><label for="minter-swap-min">Минимальная сумма покупки</label><input id="minter-swap-min" name="min" type="text" value="0"></div>
      <div class="field"><label for="minter-swap-route">Маршрут swap pool (опционально, через запятую)</label><input id="minter-swap-route" name="route" type="text"></div>
      <button type="submit" name="intent" value="preview">Проверить swap</button><button type="submit" name="intent" value="send">Отправить swap в сеть</button>
      <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
    </fieldset></form>
    <form id="minter-liquidity-form" class="stacked-form"><fieldset>
      <legend>Minter: ликвидность / pool</legend>
      <div class="field"><label for="minter-liquidity-mode">Операция</label><select id="minter-liquidity-mode" name="mode"><option value="ADD_LIQUIDITY">Добавить ликвидность</option><option value="REMOVE_LIQUIDITY">Убрать ликвидность</option><option value="CREATE_SWAP_POOL">Создать swap pool</option></select></div>
      <div class="field"><label for="minter-liquidity-coin0">Монета 0</label><input id="minter-liquidity-coin0" name="coin0" type="text" required value="BIP"></div>
      <div class="field"><label for="minter-liquidity-coin1">Монета 1</label><input id="minter-liquidity-coin1" name="coin1" type="text" required></div>
      <div class="field"><label for="minter-liquidity-volume0">Объём 0 / ликвидность</label><input id="minter-liquidity-volume0" name="volume0" type="text" required></div>
      <div class="field"><label for="minter-liquidity-volume1">Максимальный/начальный объём 1</label><input id="minter-liquidity-volume1" name="volume1" type="text" value="0"></div>
      <div class="field"><label for="minter-liquidity-gas">Монета газа</label><input id="minter-liquidity-gas" name="gasCoin" type="text" value="BIP"></div>
      <button type="submit" name="intent" value="preview">Проверить ликвидность</button><button type="submit" name="intent" value="send">Отправить liquidity в сеть</button>
      <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
    </fieldset></form>
    <form id="minter-hub-withdraw-form" class="stacked-form"><fieldset>
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
    </fieldset></form>
    <form id="minter-coin-form" class="stacked-form"><fieldset>
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
    </fieldset></form>`;
  }

  function decimalNftForms() {
    return `<form id="decimal-convert-form" class="stacked-form"><fieldset>
      <legend>Decimal: convert / swap</legend>
      <p class="notice">Для активов кроме DEL укажите EVM contract address токена в формате 0x...</p>
      <div class="field"><label for="decimal-convert-from">Из: DEL или адрес токена</label><input id="decimal-convert-from" name="from" type="text" required value="DEL"></div>
      <div class="field"><label for="decimal-convert-to">В: DEL или адрес токена</label><input id="decimal-convert-to" name="to" type="text" required></div>
      <div class="field"><label for="decimal-convert-amount">Сумма для конвертации</label><input id="decimal-convert-amount" name="amount" type="text" required></div>
      <div class="field"><label for="decimal-convert-min">Минимальная сумма получения</label><input id="decimal-convert-min" name="minAmount" type="text" value="0"></div>
      <div class="field"><label for="decimal-convert-from-decimals">Decimals исходного токена</label><input id="decimal-convert-from-decimals" name="fromDecimals" type="number" min="0" max="36" value="18"></div>
      <div class="field"><label for="decimal-convert-to-decimals">Decimals целевого токена</label><input id="decimal-convert-to-decimals" name="toDecimals" type="number" min="0" max="36" value="18"></div>
      <button type="submit" name="intent" value="preview">Проверить конвертацию</button><button type="submit" name="intent" value="send">Отправить convert в сеть</button>
      <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
    </fieldset></form>
    <form id="decimal-token-form" class="stacked-form"><fieldset>
      <legend>Decimal: создание токена</legend>
      <div class="field"><label for="decimal-token-title">Название</label><input id="decimal-token-title" name="title" type="text" required></div>
      <div class="field"><label for="decimal-token-symbol">Символ</label><input id="decimal-token-symbol" name="symbol" type="text" required></div>
      <div class="field"><label for="decimal-token-init">Начальная эмиссия</label><input id="decimal-token-init" name="initSupply" type="text" required></div>
      <div class="field"><label for="decimal-token-max">Максимальная эмиссия</label><input id="decimal-token-max" name="maxSupply" type="text" required></div>
      <button type="submit" name="intent" value="preview">Проверить token</button><button type="submit" name="intent" value="send">Создать token в сети</button>
      <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
    </fieldset></form>
    <form id="decimal-nft-form" class="stacked-form"><fieldset>
      <legend>Decimal: NFT stake</legend>
      <div class="field"><label for="decimal-nft-mode">Операция</label><select id="decimal-nft-mode" name="mode"><option value="delegate">Делегировать NFT</option><option value="unbond">Анбонд NFT</option></select></div>
      <div class="field"><label for="decimal-nft-id">NFT ID</label><input id="decimal-nft-id" name="nftId" type="text" required></div>
      <div class="field"><label for="decimal-nft-validator">ID/адрес валидатора</label><input id="decimal-nft-validator" name="validator" type="text" required></div>
      <button type="submit" name="intent" value="preview">Проверить NFT</button><button type="submit" name="intent" value="send">Отправить NFT-операцию в сеть</button>
      <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
    </fieldset></form>`;
  }

  function minterTx(typeName, data, gasCoin, memo) {
    const txType = global.minterSDK && global.minterSDK.TX_TYPE;
    return { chainId: 1, type: txType ? txType[typeName] : typeName, data, gasCoin: gasCoin || 'BIP', payload: memo || '' };
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
        if (!/^Mp[0-9a-fA-F]{64}$/.test(validator)) throw new Error('Minter validator key должен быть MP + 64 hex chars.');
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
      if (!/^\d+(?:\.\d{1,18})?$/.test(min)) throw new Error('Минимальная сумма покупки должен быть неотрицательным числом.');
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
      if (!/^\d+(?:\.\d{1,18})?$/.test(volume1)) throw new Error('Объём 1 должен быть неотрицательным числом.');
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
      if (!/^\d+(?:\.\d{1,18})?$/.test(hubFee)) throw new Error('Комиссия hub должна быть неотрицательным числом.');
      const gasCoin = normalizeCoinInput(form.get('gasCoin') || 'BIP', 'Монета газа');
      const [feeWhole, feeFrac = ''] = hubFee.split('.');
      const feeMinimal = `${feeWhole}${feeFrac.padEnd(18, '0')}`.replace(/^0+(?=\d)/, '') || '0';
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
      } else {
        data = { coin: symbol, value: Number(amount) };
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
      if (!/^\d+(?:\.\d{1,18})?$/.test(minAmount)) throw new Error('Минимальная сумма получения должна быть неотрицательным числом.');
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

    bindOperationForm(chain, 'decimal-nft-form', (form) => {
      const validator = broadcast.validateDecimalValidator(form.get('validator'), 'Валидатор');
      const nftId = String(form.get('nftId') || '').trim();
      if (!nftId) throw new Error('Нужен NFT ID.');
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
      <h2>Minter: отправка</h2>
      <p>Отправка готовой Minter-транзакции: signed TX не требует seed, multisig принимает транзакцию и внешние подписи.</p>
      <form id="minter-signed-tx-form" class="stacked-form"><fieldset>
        <legend>Готовая signed TX</legend>
        <div class="field"><label for="minter-signed-tx">Signed TX hex/base64</label><textarea id="minter-signed-tx" name="tx" rows="4" required></textarea></div>
        <button type="submit" name="intent" value="preview">Проверить signed TX</button><button type="submit" name="intent" value="send">Отправить signed TX в сеть</button>
        <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
      </fieldset></form>
      <form id="minter-multisig-form" class="stacked-form"><fieldset>
        <legend>Multisig: отправка транзакции</legend>
        <div class="field"><label for="minter-multisig-address">Адрес multisig</label><input id="minter-multisig-address" name="multisig" type="text" required></div>
        <div class="field"><label for="minter-multisig-tx">JSON транзакции</label><textarea id="minter-multisig-tx" name="txJson" rows="6" required></textarea></div>
        <div class="field"><label for="minter-multisig-signatures">Подписи, по одной на строку</label><textarea id="minter-multisig-signatures" name="signatures" rows="5" required></textarea></div>
        <button type="submit" name="intent" value="preview">Проверить multisig submit</button><button type="submit" name="intent" value="send">Отправить multisig в сеть</button>
        <div class="operation-result" data-operation-result role="status" aria-live="polite"></div>
      </fieldset></form>
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
    const url = new URL(`${LONG_API_BASE}${path || ''}`);
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, value);
    });
    return url.toString();
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

  async function fetchJsonText(url, sourceLabel) {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), 10000) : null;
    try {
      const response = await fetch(url, { headers: { accept: 'application/json, text/plain;q=0.9, */*;q=0.1' }, signal: controller ? controller.signal : undefined });
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

  async function renderLongMain() {
    appEl.innerHTML = '<section class="panel"><h2>Minter LONG</h2><p>Загружаю обзор и рейтинг LONG...</p></section>';
    setStatus('Загружаю LONG: обзор и рейтинг...', 'loading');
    const [data, pool] = await Promise.all([fetchLongJson(''), fetchMinterLongPool()]);
    const poolStats = calcLongPoolStats(pool);
    const { farmingAmount, totalExperience } = calcLongProviderRows(data, poolStats);
    appEl.innerHTML = `<section class="panel"><h2>Minter LONG</h2>${renderLongNav('main')}
      <p>Раздел показывает параметры LONG по данным backend и публичной сети Minter. Это информационный расчёт: итоговые значения зависят от состояния блокчейна, ликвидности, правил сервиса и доступности backend.</p>
      <p><a href="https://t.me/long_project" target="_blank" rel="noopener">Новости LONG</a> · <a href="https://t.me/long_project_chat" target="_blank" rel="noopener">Обсуждение</a></p>
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
    setStatus('LONG: обзор и рейтинг загружены.', 'ok');
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
    const address = data.address || 'Mx01029d73e128e2f53ff1fcc2d52a423283ad9439';
    appEl.innerHTML = `<section class="panel"><h2>LONG: ставки на токены и пулы</h2>${renderLongNav('bids')}
      <p>Сервис принимает транзакции Minter с memo. Перед отправкой проверяйте монету, сумму, адрес и memo в кошельке.</p>
      <article class="card"><h3>Разрешённые монеты для отправки</h3>${renderLongAllowedCoins(data, coin)}</article>
      <article class="card"><h3>Инструкция memo</h3><p>Адрес получателя: <code>${escapeHtml(address)}</code></p><p>Memo: <code>lbid BTC +</code> или <code>lbid BTC -</code>. Вместо BTC укажите токен или пул из списка активных.</p><p class="muted">Если выбранная монета поддерживается вашим Minter-кошельком, используйте раздел «Кошелёк» и сначала сделайте предпросмотр операции.</p></article>
      <h3>Активные токены и пулы</h3>${renderLongProjects(data.projects)}
      ${coin ? `<h3>Активные ставки: ${escapeHtml(coin)}</h3>${renderLongActiveBids(Array.isArray(activeBids) ? activeBids : (activeBids.items || activeBids.bids || []), coin)}` : '<p>Выберите монету выше, чтобы открыть список активных ставок по ней.</p>'}
      ${data.file ? `<details><summary>Описание сервиса из backend</summary><div class="longtext">${escapeHtml(data.file)}</div></details>` : ''}
      ${rawJsonDetails('Исходные данные LONG bids', data)}
    </section>`;
    setStatus('LONG bids загружен.', 'ok');
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

  async function renderCosmosValidators(chain) {
    appEl.innerHTML = `<section class="panel"><h2>${escapeHtml(chain.title)} валидаторы</h2><p>Загружаю...</p></section>`;
    setStatus(`${chain.title} валидаторы: загружаю список...`, 'loading');
    const url = chain.id === 'minter' ? `${chain.explorerBase}/validators` : `${chain.apiBase}/validators`;

    try {
      const controller = new AbortController();
      const timeoutId = global.setTimeout(() => controller.abort(), 8000);
      const response = await fetch(url, { signal: controller.signal });
      global.clearTimeout(timeoutId);
      if (!response.ok) throw new Error(`Validators API HTTP ${response.status}`);
      const data = await response.json();
      const list = data.data || data.result || data.validators || [];
      appEl.innerHTML = `<section class="panel"><h2>${escapeHtml(chain.title)} валидаторы</h2><p>Формы делегирования/анбонда доступны в разделах «Кошелёк» и «Отправка».</p><ul>${list.slice(0, 100).map((v) => `<li><code>${escapeHtml(v.public_key || v.address || v.operator_address || '')}</code> ${escapeHtml(v.name || v.moniker || '')} ${escapeHtml(v.stake || v.power || '')}</li>`).join('') || '<li>Список пуст или API вернул неизвестный формат.</li>'}</ul>${rawJsonDetails('Исходные данные валидаторов', data)}</section>`;
      setStatus(`${chain.title} валидаторы загружены: ${list.length}.`, 'ok');
    } catch (error) {
      appEl.innerHTML = `<section class="panel warning-panel"><h2>${escapeHtml(chain.title)} валидаторы</h2><p>Не удалось загрузить список валидаторов из публичного API: ${escapeHtml(profiles.formatError(error))}</p><p>Формы делегирования/анбонда доступны в разделах «Кошелёк» и «Отправка». Проверьте API позже или откройте старую страницу валидаторов, если она ещё доступна.</p></section>`;
      setStatus(`${chain.title} валидаторы: публичный API недоступен.`, 'warning');
    }
  }

  async function renderCosmosExplorer(chain, account) {
    const state = parseHash();
    appEl.innerHTML = `<section class="panel"><h2>${escapeHtml(chain.title)} проводник</h2>
      <p>Откройте адрес, транзакцию или блок. Основные данные показаны первыми; исходные данные доступны отдельно для проверки.</p>
      <form id="explorer-form" class="route-form"><div class="field"><label for="explorer-kind">Что открыть</label><select id="explorer-kind" name="kind"><option value="address" ${state.kind === 'address' ? 'selected' : ''}>Адрес</option><option value="tx" ${state.kind === 'tx' ? 'selected' : ''}>Транзакция</option><option value="block" ${state.kind === 'block' ? 'selected' : ''}>Блок</option></select></div><div class="field field-grow"><label for="explorer-value">Адрес, tx hash или номер блока</label><input id="explorer-value" name="value" type="text" value="${escapeHtml(state.value || account)}"></div><button type="submit">Открыть</button></form>
      <div id="explorer-result" class="operation-result" role="status" aria-live="polite">Выберите, что открыть, и введите адрес, tx hash или номер блока.</div></section>`;
    document.getElementById('explorer-form').addEventListener('submit', (event) => { event.preventDefault(); const form = new FormData(event.currentTarget); navigate({ chain: chain.id, app: 'explorer', account, kind: form.get('kind'), value: String(form.get('value') || '').trim() }); });
    if (!state.kind || !state.value) {
      setStatus(`${chain.title} проводник готов.`, 'info');
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
    updateAccountField(app);
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
      } else if (chain.id === 'minter' && app.id === 'long') {
        await renderMinterLong();
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
    const app = chain.apps[0];
    fillAppSelect(chain, app.id);
    updateAccountField(app);
    accountInput.value = auth.getCurrentLogin(chain) || chain.defaultAccount || '';
  });

  appSelect.addEventListener('change', () => {
    const chain = chains[chainSelect.value];
    const app = chain.apps.find((item) => item.id === appSelect.value) || chain.apps[0];
    updateAccountField(app);
  });

  routeForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const chain = chains[chainSelect.value];
    const app = chain.apps.find((item) => item.id === appSelect.value) || chain.apps[0];
    navigate({
      chain: chainSelect.value,
      app: appSelect.value,
      account: appRequiresAccount(app) ? accountInput.value.trim().replace(/^@/, '') : null
    });
  });

  global.addEventListener('hashchange', renderRoute);
  global.DposV3 = Object.freeze({
    navigate,
    renderRoute,
    appRequiresAccount,
    long: Object.freeze({ parseJsonMaybeText, calcLongPoolStats, calcLongProviderRows })
  });

  renderRoute();
})(window);
