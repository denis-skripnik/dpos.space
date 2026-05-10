(function exposeHistory(global) {
  'use strict';

  const walletOps = {
    golos: new Set([
      'transfer', 'transfer_to_vesting', 'transfer_from_tip', 'transfer_to_tip', 'donate', 'claim',
      'delegate_vesting_shares', 'delegate_vesting_shares_with_interest', 'delegation_reward',
      'curation_reward', 'author_reward', 'comment_benefactor_reward', 'producer_reward', 'fill_order'
    ]),
    viz: new Set([
      'transfer', 'transfer_to_vesting', 'withdraw_vesting', 'delegate_vesting_shares',
      'award', 'receive_award', 'benefactor_award', 'witness_reward', 'committee_pay_request'
    ]),
    steem: new Set([
      'transfer', 'transfer_to_vesting', 'withdraw_vesting', 'curation_reward', 'author_reward',
      'comment_benefactor_reward', 'producer_reward', 'fill_order'
    ]),
    minter: new Set(['send', 'delegate', 'unbond', 'sell', 'sell_swap_pool', 'add_liquidity', 'remove_liquidity', 'create_coin', 'mint_token', 'burn_token']),
    decimal: new Set(['send', 'delegate', 'unbond', 'create_token', 'transfer_token', 'nft']),
    hive: new Set([
      'transfer', 'transfer_to_vesting', 'withdraw_vesting', 'curation_reward', 'author_reward',
      'comment_benefactor_reward', 'producer_reward', 'fill_order'
    ])
  };

  const opNames = {
    account_create: 'Создание аккаунта',
    account_metadata: 'Обновление метаданных',
    account_update: 'Обновление аккаунта',
    account_witness_proxy: 'Прокси делегатского голоса',
    account_witness_vote: 'Голос за делегата',
    author_reward: 'Авторская награда',
    award: 'Награда',
    benefactor_award: 'Бенефициарская награда',
    claim: 'Получение награды',
    comment_benefactor_reward: 'Бенефициарская награда',
    curation_reward: 'Кураторская награда',
    delegate_vesting_shares: 'Делегирование доли',
    fill_order: 'Исполнение ордера',
    receive_award: 'Получение награды',
    transfer: 'Перевод',
    transfer_from_savings: 'Перевод из сбережений',
    transfer_from_tip: 'Перевод из tip-баланса',
    transfer_to_savings: 'Перевод в сбережения',
    transfer_to_tip: 'Перевод в tip-баланс',
    transfer_to_vesting: 'Перевод в соцкапитал',
    withdraw_vesting: 'Вывод соцкапитала',
    witness_reward: 'Награда делегата'
  };

  function callApi(chain, method, args) {
    const api = chain.client && chain.client.api;
    const asyncName = `${method}Async`;

    if (!api) {
      return Promise.reject(new Error('Blockchain API library is not available.'));
    }

    if (typeof api[asyncName] === 'function') {
      return api[asyncName](...args);
    }

    if (typeof api[method] === 'function') {
      return new Promise((resolve, reject) => {
        api[method](...args, (error, result) => {
          if (error) reject(error);
          else resolve(result);
        });
      });
    }

    return Promise.reject(new Error(`API method ${method} is not available.`));
  }

  async function fetchAccountHistory(chain, accountName, options = {}) {
    const limit = Math.max(1, Math.min(Number(options.limit) || 100, 1000));
    const from = Number.isFinite(Number(options.from)) ? Number(options.from) : -1;
    const selectedOps = Array.isArray(options.ops) ? options.ops.filter(Boolean) : [];
    const args = [accountName, from, limit];

    if (chain.config.id === 'golos' && selectedOps.length > 0) {
      args.push({ select_ops: selectedOps });
    }

    if (chain.config.id === 'minter') {
      const response = await fetch(`${chain.config.explorerBase}/addresses/${encodeURIComponent(accountName)}/transactions?page=1`);
      if (!response.ok) throw new Error(`Minter history API HTTP ${response.status}`);
      const data = await response.json();
      return normalizeRestHistory(data.data || data.transactions || []);
    }
    if (chain.config.id === 'decimal') {
      const response = await fetch(`${chain.config.apiBase}/addresses/${encodeURIComponent(accountName)}/txs`);
      if (!response.ok) throw new Error(`Decimal history API HTTP ${response.status}`);
      const data = await response.json();
      return normalizeRestHistory(data.txs || data.result || []);
    }

    const raw = await callApi(chain, 'getAccountHistory', args);
    const normalized = normalizeHistory(raw);

    return selectedOps.length > 0 && chain.config.id !== 'golos'
      ? normalized.filter((item) => selectedOps.includes(item.type))
      : normalized;
  }

  function normalizeHistory(raw) {
    if (!Array.isArray(raw)) return [];

    return raw.map((item) => {
      const index = item[0];
      const body = item[1] || {};
      const op = body.op || [];
      return {
        index,
        type: op[0] || 'unknown',
        data: op[1] || {},
        timestamp: body.timestamp || '',
        trxId: body.trx_id || '',
        block: body.block || body.block_num || body.blockNumber || '',
        raw: item
      };
    }).sort((a, b) => {
      if (a.timestamp === b.timestamp) return Number(b.index) - Number(a.index);
      return String(b.timestamp).localeCompare(String(a.timestamp));
    });
  }

  function normalizeRestHistory(raw) {
    if (!Array.isArray(raw)) return [];
    return raw.map((item, index) => ({
      index,
      type: item.type || item.tx_type || item.transaction_type || item.message_type || 'transaction',
      data: item.data || item.message || item,
      timestamp: item.timestamp || item.time || item.created_at || '',
      trxId: item.hash || item.tx_hash || item.id || '',
      block: item.block || item.block_id || item.blockId || item.block_number || item.height || '',
      raw: item
    }));
  }

  function isWalletOperation(chain, item) {
    const set = walletOps[chain.id] || new Set(['transfer']);
    const data = item.data || {};
    return set.has(item.type) || Boolean(data.from && data.to && data.amount);
  }

  function getWalletOperations(chain, items) {
    return items.filter((item) => isWalletOperation(chain, item));
  }

  function operationTitle(type) {
    return opNames[type] || type;
  }

  function formatDate(timestamp) {
    if (!timestamp) return '';
    const date = new Date(`${timestamp}.000Z`);
    if (Number.isNaN(date.getTime())) return timestamp;
    return date.toLocaleString('ru-RU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  function formatValue(value) {
    if (value === null || typeof value === 'undefined') return '';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }

  global.DposHistory = Object.freeze({
    fetchAccountHistory,
    formatDate,
    formatValue,
    getWalletOperations,
    operationTitle
  });
})(window);
