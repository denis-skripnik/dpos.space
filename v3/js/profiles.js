(function exposeProfiles(global) {
  'use strict';

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
          if (error) {
            reject(error);
            return;
          }
          resolve(result);
        });
      });
    }

    return Promise.reject(new Error(`API method ${method} is not available.`));
  }

  function setNode(chain, nodeUrl) {
    const api = chain.client && chain.client.api;

    if (api && typeof api.stop === 'function') {
      try {
        api.stop();
      } catch (error) {
        // Some libraries throw when there is no active connection yet.
      }
    }

    if (chain.client && chain.client.config && typeof chain.client.config.set === 'function') {
      chain.client.config.set('websocket', nodeUrl);
      return;
    }

    if (api && typeof api.setOptions === 'function') {
      api.setOptions({ url: nodeUrl });
    }
  }

  async function connect(chainConfig) {
    if (chainConfig.id === 'minter' || chainConfig.id === 'decimal') {
      return { config: chainConfig, client: global[chainConfig.libraryGlobal] || {}, node: chainConfig.apiBase || chainConfig.nodes[0], rest: true };
    }

    const client = global[chainConfig.libraryGlobal];

    if (!client) {
      throw new Error(`Library ${chainConfig.libraryGlobal} is not loaded.`);
    }

    const chain = {
      config: chainConfig,
      client,
      node: null
    };

    let lastError = null;

    const storedNode = global.localStorage.getItem(`${chainConfig.id}_node`);
    const nodes = storedNode && chainConfig.nodes.includes(storedNode)
      ? [storedNode, ...chainConfig.nodes.filter((nodeUrl) => nodeUrl !== storedNode)]
      : chainConfig.nodes;

    for (const nodeUrl of nodes) {
      try {
        setNode(chain, nodeUrl);
        await callApi(chain, 'getDynamicGlobalProperties', []);
        chain.node = nodeUrl;
        global.localStorage.setItem(`${chainConfig.id}_node`, nodeUrl);
        return chain;
      } catch (error) {
        lastError = error;
      }
    }

    throw new Error(`No working public node found for ${chainConfig.title}. Last error: ${formatError(lastError)}`);
  }

  async function fetchAccount(chain, accountName) {
    if (chain.config.id === 'minter') {
      const response = await fetch(`${chain.config.explorerBase}/addresses/${encodeURIComponent(accountName)}`);
      if (!response.ok) throw new Error(`Minter address API HTTP ${response.status}`);
      const data = await response.json();
      return Object.assign({ name: accountName }, data.data || data);
    }
    if (chain.config.id === 'decimal') {
      const response = await fetch(`${chain.config.apiBase}/addresses/${encodeURIComponent(accountName)}/balances`);
      if (!response.ok) throw new Error(`Decimal address API HTTP ${response.status}`);
      const data = await response.json();
      return { name: accountName, address: accountName, balances: data.balances || (data.result && data.result.balances) || [] };
    }

    const accounts = await callApi(chain, 'getAccounts', [[accountName]]);

    if (!Array.isArray(accounts) || accounts.length === 0) {
      throw new Error(`Account @${accountName} was not found.`);
    }

    return accounts[0];
  }

  function parseJsonField(value) {
    if (!value || typeof value !== 'string') {
      return null;
    }

    try {
      return JSON.parse(value);
    } catch (error) {
      return null;
    }
  }

  function getProfileMetadata(account) {
    const metadata = parseJsonField(account.json_metadata) || parseJsonField(account.posting_json_metadata) || {};
    return metadata.profile || metadata;
  }

  function pickDisplayName(account) {
    const profile = getProfileMetadata(account);
    return profile.name || profile.nickname || profile.about || account.name;
  }

  function getBalances(chain, account) {
    const chainId = chain.config.id;

    if (chainId === 'golos') {
      return [
        ['GOLOS', account.balance],
        ['GBG', account.sbd_balance || account.gbg_balance],
        ['СГ / vesting', account.vesting_shares],
        ['Делегировано', account.delegated_vesting_shares],
        ['Получено делегированием', account.received_vesting_shares],
        ['TIP-баланс', account.tip_balance],
        ['Награды', account.reward_balance || account.reward_vesting_balance]
      ].filter((item) => item[1]);
    }

    if (chainId === 'viz') {
      return [
        ['VIZ', account.balance],
        ['SHARES', account.vesting_shares],
        ['Делегировано', account.delegated_vesting_shares],
        ['Получено делегированием', account.received_vesting_shares],
        ['Энергия', typeof account.energy !== 'undefined' ? `${account.energy / 100}%` : ''],
        ['Награды', account.reward_balance || account.reward_vesting_balance]
      ].filter((item) => item[1]);
    }

    if (chainId === 'minter') {
      const balances = account.balances || [];
      return balances.map((item) => [item.coin && item.coin.symbol || item.symbol || item.coin || 'coin', item.amount || item.value]).filter((item) => item[1]);
    }

    if (chainId === 'decimal') {
      const balances = account.balances || [];
      return balances.map((item) => [item.denom || item.symbol || item.coin || item.ticker || 'coin', item.amount]).filter((item) => item[1]);
    }

    if (chainId === 'hive') {
      return [
        ['HIVE', account.balance],
        ['HBD', account.hbd_balance],
        ['HP / VESTS', account.vesting_shares],
        ['Savings HIVE', account.savings_balance],
        ['Savings HBD', account.savings_hbd_balance],
        ['Делегировано', account.delegated_vesting_shares],
        ['Получено делегированием', account.received_vesting_shares],
        ['Reward HIVE', account.reward_hive_balance],
        ['Reward HBD', account.reward_hbd_balance],
        ['Reward VESTS', account.reward_vesting_balance]
      ].filter((item) => item[1]);
    }

    return [
      ['STEEM', account.balance],
      ['SBD', account.sbd_balance],
      ['SP / VESTS', account.vesting_shares],
      ['Savings STEEM', account.savings_balance],
      ['Savings SBD', account.savings_sbd_balance],
      ['Делегировано', account.delegated_vesting_shares],
      ['Получено делегированием', account.received_vesting_shares],
      ['Reward STEEM', account.reward_steem_balance],
      ['Reward SBD', account.reward_sbd_balance],
      ['Reward VESTS', account.reward_vesting_balance]
    ].filter((item) => item[1]);
  }

  function normalizeAccount(chain, account) {
    const profile = getProfileMetadata(account);

    return {
      chain: chain.config.title,
      node: chain.node,
      name: account.name,
      displayName: (chain.config.id === 'minter' || chain.config.id === 'decimal') ? (account.address || account.name) : pickDisplayName(account),
      about: profile.about || profile.description || '',
      location: profile.location || '',
      website: profile.website || '',
      created: account.created,
      lastVoteTime: account.last_vote_time,
      proxy: account.proxy,
      witnessVotes: account.witness_votes || [],
      balances: getBalances(chain, account),
      raw: account
    };
  }

  function formatError(error) {
    if (!error) {
      return 'unknown error';
    }

    if (error.message) {
      return error.message;
    }

    return String(error);
  }

  global.DposProfiles = Object.freeze({
    apiCall: callApi,
    connect,
    fetchAccount,
    formatError,
    normalizeAccount
  });
})(window);
