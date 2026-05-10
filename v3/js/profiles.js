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

    if (chain.client && chain.client.config && typeof chain.client.config.set === 'function') {
      chain.client.config.set('websocket', nodeUrl);
      return;
    }

    if (api && typeof api.setOptions === 'function') {
      api.setOptions({ url: nodeUrl });
    }
  }

  async function connect(chainConfig) {
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

    for (const nodeUrl of chainConfig.nodes) {
      try {
        setNode(chain, nodeUrl);
        await callApi(chain, 'getDynamicGlobalProperties', []);
        chain.node = nodeUrl;
        return chain;
      } catch (error) {
        lastError = error;
      }
    }

    throw new Error(`No working public node found for ${chainConfig.title}. Last error: ${formatError(lastError)}`);
  }

  async function fetchAccount(chain, accountName) {
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

  function getBalances(account) {
    return [
      ['Баланс', account.balance],
      ['Сбережения', account.savings_balance],
      ['Golos/VIZ/Hive Power / vesting', account.vesting_shares],
      ['Делегировано', account.delegated_vesting_shares],
      ['Получено делегированием', account.received_vesting_shares],
      ['Награды', account.reward_balance || account.reward_vesting_balance],
      ['HBD/SBD/GBG', account.hbd_balance || account.sbd_balance || account.sbd_seconds_last_update]
    ].filter((item) => item[1]);
  }

  function normalizeAccount(chain, account) {
    const profile = getProfileMetadata(account);

    return {
      chain: chain.config.title,
      node: chain.node,
      name: account.name,
      displayName: pickDisplayName(account),
      about: profile.about || profile.description || '',
      location: profile.location || '',
      website: profile.website || '',
      created: account.created,
      lastVoteTime: account.last_vote_time,
      proxy: account.proxy,
      witnessVotes: account.witness_votes || [],
      balances: getBalances(account),
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
    connect,
    fetchAccount,
    formatError,
    normalizeAccount
  });
})(window);
