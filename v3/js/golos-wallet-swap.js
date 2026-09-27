(function (global) {
  'use strict';

  const SYMBOL_RE = /^[A-Z][A-Z0-9]{1,15}$/;
  const DEFAULT_TIMEOUT_MS = 5000;
  const DEFAULT_CONCURRENCY = 3;
  const DEFAULT_MAX_SOURCES = 16;
  const DEFAULT_MAX_TARGETS = 24;

  function symbolOf(value) {
    const symbol = String(value || '').trim().toUpperCase();
    return SYMBOL_RE.test(symbol) ? symbol : '';
  }

  function decimalAsset(value, explicitSymbol) {
    const text = String(value === undefined || value === null ? '' : value).trim();
    const match = text.match(/^(\d+)(?:\.(\d+))?(?:\s+([A-Za-z][A-Za-z0-9]{1,15}))?$/);
    const symbol = symbolOf(explicitSymbol || (match && match[3]));
    if (!match || !symbol) return null;
    const parsedSymbol = symbolOf(match[3]);
    if (parsedSymbol && parsedSymbol !== symbol) return null;
    const fraction = match[2] || '';
    const scale = 10n ** BigInt(fraction.length);
    const units = (BigInt(match[1]) * scale) + BigInt(fraction || '0');
    if (units <= 0n) return null;
    return { symbol, units, scale, precision: fraction.length };
  }

  function formatUnits(units, asset) {
    const whole = units / asset.scale;
    if (!asset.precision) return `${whole} ${asset.symbol}`;
    const fraction = String(units % asset.scale).padStart(asset.precision, '0');
    return `${whole}.${fraction} ${asset.symbol}`;
  }

  function trialAmounts(asset) {
    const trials = [];
    const add = (units) => {
      if (units <= 0n || units > asset.units || trials.includes(units)) return;
      trials.push(units);
    };
    add(asset.scale); // A normal-size quote avoids rejecting a liquid pair because a dust balance was sampled.
    add(10n * asset.scale);
    add(asset.units);
    return trials.map((units) => formatUnits(units, asset));
  }

  function withTimeout(work, timeoutMs) {
    let timer;
    return Promise.race([
      Promise.resolve().then(work),
      new Promise((resolve, reject) => {
        timer = global.setTimeout(() => reject(new Error('Golos DEX quote timeout')), timeoutMs);
      })
    ]).finally(() => global.clearTimeout(timer));
  }

  function assetSymbol(asset) {
    if (typeof asset === 'string') return symbolOf(asset);
    if (!asset || typeof asset !== 'object') return '';
    const direct = symbolOf(asset.symbol || asset.asset || asset.name);
    if (direct) return direct;
    const supply = String(asset.max_supply || asset.maxSupply || '').trim().split(/\s+/);
    return symbolOf(supply[supply.length - 1]);
  }

  function candidateSymbols(balances, whitelist) {
    const result = [];
    const add = (value) => {
      const symbol = symbolOf(value);
      if (symbol && !result.includes(symbol)) result.push(symbol);
    };
    (balances || []).forEach((balance) => add(balance && balance.symbol));
    add('GOLOS');
    add('GBG');
    (whitelist || []).forEach((asset) => {
      add(assetSymbol(asset));
      if (asset && Array.isArray(asset.symbols_whitelist)) asset.symbols_whitelist.forEach(add);
    });
    return result;
  }

  function usablePath(quote, target) {
    const paths = [quote && quote.direct, quote && quote.best, quote];
    let winner = null;
    let winnerAsset = null;
    paths.forEach((path) => {
      if (!path || !Array.isArray(path.steps) || !path.steps.length) return;
      const result = decimalAsset(path.res, target);
      if (!result || result.symbol !== target) return;
      if (!winnerAsset || result.units * winnerAsset.scale > winnerAsset.units * result.scale) {
        winner = path;
        winnerAsset = result;
      }
    });
    return winner;
  }

  async function validatePath(dex, path, account, timeoutMs) {
    if (!dex || typeof dex.makeExchangeTx !== 'function') return false;
    try {
      const operations = await withTimeout(
        () => dex.makeExchangeTx(path.steps, { owner: account, fill_or_kill: true }),
        timeoutMs
      );
      return Array.isArray(operations) && operations.length > 0;
    } catch (error) {
      return false;
    }
  }

  async function eligibilityFor(source, targets, context) {
    const asset = decimalAsset(source.amount, source.symbol);
    if (!asset || source.balanceType === 'tip' || source.kind === 'tip') return null;
    for (const target of targets) {
      if (target === asset.symbol) continue;
      for (const amount of trialAmounts(asset)) {
        if (!context.isCurrent() || Date.now() >= context.deadline) return null;
        let quote;
        try {
          quote = await withTimeout(() => context.dex.getExchange({
            node: context.chain.wsEndpoint,
            amount,
            symbol: target,
            direction: 'sell'
          }), context.timeoutMs);
        } catch (error) {
          continue;
        }
        const path = usablePath(quote, target);
        if (path && await validatePath(context.dex, path, context.account, context.timeoutMs)) {
          return { source: asset.symbol, target, amount, path };
        }
      }
    }
    return null;
  }

  async function mapLimited(items, limit, mapper) {
    const results = new Array(items.length);
    let next = 0;
    async function worker() {
      while (next < items.length) {
        const index = next;
        next += 1;
        results[index] = await mapper(items[index], index);
      }
    }
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
    return results;
  }

  function normalizeBalances(balances, maxSources) {
    const seen = new Set();
    const normalized = [];
    (balances || []).forEach((balance) => {
      const symbol = symbolOf(balance && balance.symbol);
      const type = String(balance && (balance.balanceType || balance.type) || 'main').toLowerCase();
      if (!symbol || type !== 'main' || seen.has(symbol) || !decimalAsset(balance.amount, symbol)) return;
      seen.add(symbol);
      normalized.push(Object.assign({}, balance, { symbol }));
    });
    return normalized.slice(0, Math.max(1, Number(maxSources) || DEFAULT_MAX_SOURCES));
  }

  async function findEligible(options) {
    const settings = options || {};
    const chain = settings.chain || {};
    if (chain.id !== 'golos' || !chain.wsEndpoint || typeof settings.ensureDex !== 'function') return [];
    const timeoutMs = Math.max(100, Number(settings.timeoutMs) || DEFAULT_TIMEOUT_MS);
    let dex;
    try {
      dex = await withTimeout(() => settings.ensureDex(chain), timeoutMs);
    } catch (error) {
      return [];
    }
    if (!dex || typeof dex.getExchange !== 'function' || typeof dex.makeExchangeTx !== 'function') return [];
    const sources = normalizeBalances(settings.balances, settings.maxSources || DEFAULT_MAX_SOURCES);
    let whitelist = settings.whitelist || [];
    if (typeof settings.loadAssets === 'function') {
      try {
        whitelist = await withTimeout(() => settings.loadAssets(chain), timeoutMs);
      } catch (error) {
        // Balance symbols and GOLOS/GBG remain useful live-quote candidates.
      }
    }
    const targetBalances = settings.candidateBalances || settings.balances;
    const targets = candidateSymbols(targetBalances, whitelist)
      .slice(0, Math.max(1, Number(settings.maxTargets) || DEFAULT_MAX_TARGETS));
    const concurrency = Math.min(8, Math.max(1, Number(settings.concurrency) || DEFAULT_CONCURRENCY));
    const context = {
      chain, account: String(settings.account || ''), dex, timeoutMs,
      isCurrent: typeof settings.isCurrent === 'function' ? settings.isCurrent : () => true,
      deadline: Date.now() + 15000
    };
    return mapLimited(sources, concurrency, async (source, index) => {
      const item = await eligibilityFor(source, targets, context);
      if (item && context.isCurrent() && typeof settings.onEligible === 'function') settings.onEligible(item, index);
      return item;
    });
  }

  function routeHref(source, target) {
    return `#chain=golos&app=swap&token=${encodeURIComponent(source)}&buySymbol=${encodeURIComponent(target)}`;
  }

  function rowFor(root, balance) {
    if (balance.row && typeof balance.row.appendChild === 'function') return balance.row;
    if (!root || typeof root.querySelectorAll !== 'function') return null;
    const wanted = balance.symbol === 'GOLOS' || balance.symbol === 'GBG'
      ? balance.symbol
      : `UIA ${balance.symbol} (основной)`;
    return Array.from(root.querySelectorAll('.wallet-golos-balances li')).find((row) => {
      const strong = row.querySelector && row.querySelector('strong');
      return String(strong && strong.textContent || '').replace(/:\s*$/, '').trim() === wanted;
    }) || null;
  }

  function appendLink(root, balance, eligible) {
    const row = rowFor(root, balance);
    if (!row || (row.querySelector && row.querySelector('[data-golos-wallet-swap]'))) return false;
    const doc = row.ownerDocument || (root && root.ownerDocument) || global.document;
    if (!doc || typeof doc.createElement !== 'function') return false;
    const separator = doc.createTextNode ? doc.createTextNode(' — ') : doc.createElement('span');
    if (separator && separator.nodeType !== 3) separator.textContent = ' — ';
    const link = doc.createElement('a');
    link.href = routeHref(eligible.source, eligible.target);
    link.textContent = `Обменять на ${eligible.target}`;
    link.setAttribute('data-golos-wallet-swap', eligible.source);
    row.appendChild(separator);
    row.appendChild(link);
    return true;
  }

  async function attach(root, options) {
    const settings = options || {};
    const isCurrent = typeof settings.isCurrent === 'function' ? settings.isCurrent : () => true;
    if (!root || !isCurrent()) return [];
    const inputBalances = settings.balances || [];
    const balances = normalizeBalances(inputBalances, settings.maxSources || DEFAULT_MAX_SOURCES)
      .map((balance) => Object.assign({}, balance, { row: rowFor(root, balance) }));
    const attached = [];
    await findEligible(Object.assign({}, settings, {
      balances,
      candidateBalances: inputBalances,
      onEligible: (item, index) => {
        if (isCurrent() && appendLink(root, balances[index], item)) attached.push(item);
      }
    }));
    if (!isCurrent()) return [];
    return attached;
  }

  global.DposGolosWalletSwap = Object.freeze({
    attach,
    findEligible,
    routeHref
  });
}(typeof window !== 'undefined' ? window : globalThis));
