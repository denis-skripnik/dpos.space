/* Static LONG schema-1 reader. Only a manifest HTTP 404 permits live mode. */
(function (global) {
  'use strict';
  const BASE = '/v3/data/long/';
  let activated = false;
  const ADDRESS = /^Mx[0-9a-fA-F]{40}$/;
  const HASH = /^Mt[0-9a-fA-F]{64}$/;
  const DECIMAL = /^(?:0|[1-9]\d*)(?:\.\d+)?$/;
  const INTEGER = /^(?:0|[1-9]\d*)$/;
  const escape = (value) => String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function requireValue(ok, label) {
    if (!ok) throw new Error(`Некорректный архив LONG: ${label}`);
  }
  function numberString(value, label, integer = false) {
    requireValue(typeof value === 'string' && (integer ? INTEGER : DECIMAL).test(value), label);
  }
  function iso(value) {
    return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) && Number.isFinite(Date.parse(value));
  }
  function date(value) {
    return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
  }
  function safeFile(path) {
    if (['snapshot.json', 'payments.json', 'lotteries.json'].includes(path)) return true;
    const match = /^loto\/(\d{4}-\d{2}-\d{2})\.txt$/.exec(path);
    return Boolean(match && date(match[1]));
  }
  function validateManifest(m) {
    requireValue(m && m.schema_version === 1 && ['preview', 'final'].includes(m.state), 'schema/state');
    requireValue(iso(m.captured_at) && m.cutoff_at === '2026-11-10T11:00:00.000Z', 'capture/cutoff');
    requireValue(m.files && typeof m.files === 'object' && !Array.isArray(m.files), 'files');
    for (const name of ['snapshot.json', 'payments.json', 'lotteries.json']) requireValue(Object.hasOwn(m.files, name), name);
    requireValue(Object.keys(m.files).length <= 20000, 'too many files');
    for (const [name, meta] of Object.entries(m.files)) {
      requireValue(safeFile(name), 'unsafe file path');
      requireValue(meta && /^[a-f0-9]{64}$/.test(meta.sha256) && Number.isSafeInteger(meta.bytes) && meta.bytes >= 0 && meta.bytes <= 32000000, `metadata ${name}`);
    }
    for (const key of ['providers', 'payments', 'lotteries']) requireValue(m.counts && Number.isSafeInteger(m.counts[key]) && m.counts[key] >= 0, `count ${key}`);
  }
  function validateSnapshot(s, m) {
    requireValue(s && s.schema_version === 1 && s.state === m.state && s.captured_at === m.captured_at && s.cutoff_at === m.cutoff_at, 'snapshot identity');
    requireValue(Array.isArray(s.providers) && s.providers.length === m.counts.providers && Array.isArray(s.locks), 'providers/locks');
    for (const key of ['max_amount', 'max_prize', 'cap_effective_days']) numberString(s.params && s.params[key], `params.${key}`);
    const addresses = new Set();
    s.providers.forEach((p, i) => {
      requireValue(p.rank === i + 1 && ADDRESS.test(p.address) && !addresses.has(p.address.toLowerCase()), 'provider identity/rank');
      addresses.add(p.address.toLowerCase());
      for (const key of ['liquidity', 'invest_days', 'bonus_invest_days', 'multiply', 'get_counter', 'get_amount', 'burned']) numberString(p[key], key);
      requireValue(p.referer === '' || ADDRESS.test(p.referer), 'referer');
    });
    for (const lock of s.locks) {
      requireValue(ADDRESS.test(lock.address), 'lock address');
      for (const key of ['amount', 'lock_block', 'unlock_block']) numberString(lock[key], key, key !== 'amount');
    }
    const p = s.pool;
    requireValue(p && p.id === '683' && p.lp_coin_id === '2783' && p.coin0 && p.coin0.id === '0' && p.coin0.symbol === 'BIP' && p.coin1 && p.coin1.id === '2782' && p.coin1.symbol === 'LONG', 'pool identity');
    for (const key of ['amount0', 'amount1', 'liquidity', 'height']) numberString(p[key], `pool.${key}`, true);
    requireValue(p.height !== '0' && /^[a-fA-F0-9]{64}$/.test(p.block_hash) && iso(p.block_time) && iso(p.captured_at), 'pool provenance');
    numberString(s.backend_cursor_height, 'backend cursor', true);
  }
  function validatePayments(p, m) {
    requireValue(p && p.schema_version === 1 && p.state === m.state && Array.isArray(p.compensation) && Array.isArray(p.final), 'payments identity');
    const hashes = new Set();
    for (const kind of ['compensation', 'final']) for (const tx of p[kind]) {
      requireValue(tx.kind === kind && HASH.test(tx.hash) && !hashes.has(tx.hash.toLowerCase()) && ADDRESS.test(tx.sender), 'receipt identity');
      hashes.add(tx.hash.toLowerCase());
      for (const key of ['height', 'nonce', 'gas_coin_id', 'gas_price', 'fee_coin_id', 'fee_amount_pip']) numberString(tx[key], key, true);
      requireValue(tx.height !== '0' && typeof tx.memo === 'string' && Array.isArray(tx.outputs) && tx.outputs.length > 0, 'confirmed receipt');
      for (const out of tx.outputs) {
        requireValue(ADDRESS.test(out.to) && out.coin_id === '2782' && out.coin_symbol === 'LONG', 'payment output');
        numberString(out.amount, 'payment amount');
      }
    }
    requireValue(hashes.size === m.counts.payments, 'payments count');
  }
  async function fetchBytes(name, signal) {
    const response = await global.fetch(BASE + name, { cache: 'no-store', redirect: 'error', credentials: 'omit', signal });
    if (name === 'manifest.json' && response.status === 404) return null;
    requireValue(response.ok, `${name}: HTTP ${response.status}`);
    return new Uint8Array(await response.arrayBuffer());
  }
  const decode = (bytes) => new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  async function load(signal) {
    const bytes = await fetchBytes('manifest.json', signal);
    if (bytes === null) {
      requireValue(!activated, 'manifest исчез после активации архива');
      return null;
    }
    const manifestText = decode(bytes);
    const m = JSON.parse(manifestText);
    validateManifest(m);
    activated = true;
    requireValue(global.crypto && global.crypto.subtle, 'WebCrypto недоступен; используйте HTTPS или localhost');
    const files = Object.create(null);
    // Validate every indexed byte, including reports, before presenting any archive data.
    for (const [name, meta] of Object.entries(m.files)) {
      const data = await fetchBytes(name, signal);
      requireValue(data && data.byteLength === meta.bytes, `bytes ${name}`);
      const digest = new Uint8Array(await global.crypto.subtle.digest('SHA-256', data));
      const hash = Array.from(digest, (b) => b.toString(16).padStart(2, '0')).join('');
      requireValue(hash === meta.sha256, `SHA-256 ${name}`);
      files[name] = decode(data);
    }
    const snapshot = JSON.parse(files['snapshot.json']);
    const payments = JSON.parse(files['payments.json']);
    const lotteries = JSON.parse(files['lotteries.json']);
    validateSnapshot(snapshot, m);
    validatePayments(payments, m);
    requireValue(lotteries && lotteries.schema_version === 1 && Array.isArray(lotteries.items) && lotteries.items.length === m.counts.lotteries, 'lotteries count');
    let previous = '';
    for (const item of lotteries.items) {
      requireValue(date(item.date) && item.date > previous && item.path === `loto/${item.date}.txt` && Object.hasOwn(files, item.path), 'lottery index');
      previous = item.date;
    }
    requireValue(Object.keys(files).length === 3 + lotteries.items.length, 'unindexed files');
    const last = await fetchBytes('manifest.json', signal);
    requireValue(last && decode(last) === manifestText, 'manifest изменился при загрузке; обновите страницу');
    return { manifest: m, snapshot, payments, lotteries, files };
  }
  function table(caption, headers, rows) {
    return `<div class="table-wrap"><table><caption>${escape(caption)}</caption><thead><tr>${headers.map((h) => `<th scope="col">${escape(h)}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((v) => `<td>${escape(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  }
  function receipts(payments) {
    return ['compensation', 'final'].map((kind) => `<h3>${kind === 'final' ? 'Подтверждённые финальные выплаты' : 'Подтверждённая компенсация'}</h3>${payments[kind].map((tx) => `<article><p><a href="https://explorer.minter.network/transactions/${escape(tx.hash)}" target="_blank" rel="noopener noreferrer">${escape(tx.hash)}</a> — блок ${escape(tx.height)}</p><p>Отправитель: ${escape(tx.sender)}. Memo: ${escape(tx.memo)}</p>${table('Получатели: подтверждённые суммы', ['Адрес', 'Сумма LONG'], tx.outputs.map((o) => [o.to, o.amount]))}</article>`).join('') || '<p>В этом снимке подтверждённых квитанций нет.</p>'}`).join('');
  }
  function humanPip(value) {
    const digits = value.padStart(19, '0');
    const fraction = digits.slice(-18).replace(/0+$/, '');
    return digits.slice(0, -18) + (fraction ? '.' + fraction : '');
  }
  function render(data, options) {
    const { manifest: m, snapshot: s, payments, lotteries, files } = data;
    const page = options.page === 'lotto' ? 'loto' : options.page;
    const link = (p, d) => `#chain=minter&app=long&long_page=${p}${d ? `&date=${encodeURIComponent(d)}` : ''}`;
    const nav = `<nav aria-label="LONG архив"><ul>${[['main', 'Обзор и рейтинг'], ['bids', 'Ставки'], ['deferred-txs', 'Отложенные транзакции'], ['loto', 'Лотерея']].map(([p, t]) => `<li><a href="${escape(link(p))}">${t}</a></li>`).join('')}</ul></nav>`;
    const final = m.state === 'final';
    let body;
    if (page === 'bids') body = '<h3>Ставки закрыты в архивном интерфейсе</h3><p>Новые ставки и денежные запросы здесь не принимаются.</p>';
    else if (page === 'deferred-txs') body = `<h3>Отложенные транзакции</h3><p>${final ? 'Финальный архив: подтверждённые финальные выплаты выполнены, очередь обычных наград перед снимком пуста. Квитанции приведены ниже.' : 'Предварительный снимок: финальный расчёт ещё не подтверждён этим архивом. Обязательства могут оставаться в ожидании.'}</p>${table('Учтённые блокировки снимка', ['Адрес', 'Сумма', 'Блок начала', 'Блок окончания'], s.locks.map((l) => [l.address, l.amount, l.lock_block, l.unlock_block]))}${receipts(payments)}`;
    else if (page === 'loto') {
      const selected = options.date || (lotteries.items.length ? lotteries.items[lotteries.items.length - 1].date : '');
      const item = lotteries.items.find((entry) => entry.date === selected);
      body = `<h3>История лотереи</h3><ul>${lotteries.items.map((entry) => `<li><a href="${escape(link('loto', entry.date))}">${escape(entry.date)}</a></li>`).join('')}</ul>${item ? `<h3>${escape(item.date)}</h3><pre class="longtext">${escape(files[item.path])}</pre>` : '<p>Отчёт за выбранную дату отсутствует в архиве.</p>'}`;
    } else {
      body = table('Публичные параметры на момент снимка (не прогноз)', ['Параметр', 'Значение'], [['Максимум распределения за сутки, LONG', s.params.max_amount], ['Максимальный приз, LONG', s.params.max_prize], ['Ограничение эффективных инвест. дней', s.params.cap_effective_days]])
        + table('BIP/LONG: состояние пула на момент снимка', ['Пул', 'LP coin', 'BIP', 'LONG', 'LP', 'Блок', 'Хэш блока', 'Время блока', 'Время получения'], [[s.pool.id, s.pool.lp_coin_id, humanPip(s.pool.amount0), humanPip(s.pool.amount1), humanPip(s.pool.liquidity), s.pool.height, s.pool.block_hash, s.pool.block_time, s.pool.captured_at]])
        + `<p>Курсор backend: ${escape(s.backend_cursor_height)}. Блок пула и время снимка не обозначают состояние ровно на cutoff.</p><p>Учётные показатели сервиса — не фактически выплаченные деньги. Фактические выплаты приведены отдельно в подтверждённых квитанциях.</p>`
        + table('Рейтинг провайдеров LONG — учётный снимок', ['№', 'Адрес', 'Учтённые LP', 'Инвест. дни', 'Бонусные инвест. дни (учёт)', 'Множитель', 'Счётчик начислений', 'Учётная сумма сервиса, LONG', 'Сожжённые LP (учёт)', 'Реферер'], s.providers.map((p) => [p.rank, p.address, p.liquidity, p.invest_days, p.bonus_invest_days, p.multiply, p.get_counter, p.get_amount, p.burned, p.referer])) + receipts(payments);
    }
    return `<section class="panel"><h2>Minter LONG — ${final ? 'финальный архив' : 'предварительный снимок (preview)'}</h2><p>${final ? 'Финальный расчёт завершён.' : 'Это не финальный архив. Снимок не утверждает, что сервис остановлен или финальные выплаты выполнены.'}</p><p>Дата снимка: ${escape(m.captured_at)}. Cutoff (граница расчёта): ${escape(m.cutoff_at)}.</p>${nav}${body}</section>`;
  }
  async function tryRender(options = {}) {
    const controller = new AbortController();
    const timer = global.setTimeout(() => controller.abort(), 60000);
    try {
      const data = await load(controller.signal);
      if (!data) return { active: false };
      return { active: true, html: render(data, options), status: 'LONG: статический архив проверен.', error: false };
    } catch (error) {
      return { active: true, error: true, status: 'LONG: архив недоступен или повреждён; live API отключены.', html: `<section class="panel error-panel"><h2>Архив LONG недоступен</h2><p role="status" aria-live="polite">${escape(error.message || error)}</p><p>Live финансовые API не используются. Проверьте целостность папки архива и обновите страницу.</p></section>` };
    } finally {
      global.clearTimeout(timer);
    }
  }
  global.DposLongArchive = Object.freeze({ tryRender });
})(window);
