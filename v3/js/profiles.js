(function exposeProfiles(global) {
  'use strict';

  function callApi(chain, method, args) {
    const api = chain.client && chain.client.api;
    const asyncName = `${method}Async`;

    if (!api) {
      return Promise.reject(new Error('Библиотека Blockchain API недоступна.'));
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

    return Promise.reject(new Error(`Метод API ${method} недоступен.`));
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
      throw new Error(`Библиотека ${chainConfig.libraryGlobal} не загружена.`);
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

    throw new Error(`Не найдена рабочая публичная нода для ${chainConfig.title}. Последняя ошибка: ${formatError(lastError)}`);
  }

  async function fetchJson(url, options) {
    const response = await fetch(url, options);
    if (!response.ok) throw new Error(`${url} HTTP ${response.status}`);
    return response.json();
  }

  async function fetchOptional(url, options) {
    try {
      return await fetchJson(url, options);
    } catch (error) {
      return null;
    }
  }

  function unwrapRestData(data) {
    if (!data || typeof data !== 'object') return data;
    return data.data || data.result || data;
  }

  function yesterdayIsoDate() {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - 1);
    return date.toISOString().slice(0, 10);
  }

  async function fetchMinterAccount(chain, accountName) {
    const address = accountName;
    const [addressData, delegationsData, transactionsData, rewardsData] = await Promise.all([
      fetchJson(`${chain.config.explorerBase}/addresses/${encodeURIComponent(address)}`),
      fetchOptional(`${chain.config.explorerBase}/addresses/${encodeURIComponent(address)}/delegations`),
      fetchOptional(`${chain.config.explorerBase}/addresses/${encodeURIComponent(address)}/transactions?page=1`),
      fetchOptional(`${chain.config.explorerBase}/addresses/${encodeURIComponent(address)}/statistics/rewards?start_time=${yesterdayIsoDate()}&end_time=${yesterdayIsoDate()}`)
    ]);
    const unwrapped = unwrapRestData(addressData) || {};
    return Object.assign({ name: address, address }, unwrapped, {
      balances: unwrapped.balances || unwrapped.balance || [],
      delegations: unwrapRestData(delegationsData) || unwrapped.delegations || [],
      transactions: unwrapRestData(transactionsData) || [],
      rewards: unwrapRestData(rewardsData) || null,
      rawApi: {
        address: addressData,
        delegations: delegationsData,
        transactions: transactionsData,
        rewards: rewardsData
      }
    });
  }

  async function fetchDecimalAccount(chain, accountName) {
    const address = accountName;
    const [addressData, balancesData, transactionsData, rewardsData, nftsData] = await Promise.all([
      fetchOptional(`${chain.config.apiBase}/addresses/${encodeURIComponent(address)}`),
      fetchOptional(`${chain.config.apiBase}/addresses/${encodeURIComponent(address)}/balances`),
      fetchOptional(`${chain.config.apiBase}/txs/txs-by-address/${encodeURIComponent(address)}?limit=10&offset=0`),
      fetchOptional(`${chain.config.apiBase}/rewards/${encodeURIComponent(address)}?limit=20&offset=0`),
      fetchOptional(`${chain.config.apiBase}/nfts/${encodeURIComponent(address)}?limit=20&offset=0`)
    ]);
    const unwrappedAddress = unwrapRestData(addressData) || {};
    const addressObject = unwrappedAddress.address || unwrappedAddress;
    const unwrappedBalances = unwrapRestData(balancesData) || {};
    return Object.assign({ name: address, address }, addressObject, {
      balances: unwrappedBalances.balances || unwrappedBalances.balance || addressObject.balance || [],
      transactions: (unwrapRestData(transactionsData) || {}).txs || unwrapRestData(transactionsData) || [],
      rewards: (unwrapRestData(rewardsData) || {}).rewards || unwrapRestData(rewardsData) || [],
      nfts: (unwrapRestData(nftsData) || {}).nfts || unwrapRestData(nftsData) || [],
      rawApi: {
        address: addressData,
        balances: balancesData,
        transactions: transactionsData,
        rewards: rewardsData,
        nfts: nftsData
      }
    });
  }

  async function fetchAccount(chain, accountName) {
    if (chain.config.id === 'minter') {
      return fetchMinterAccount(chain, accountName);
    }
    if (chain.config.id === 'decimal') {
      return fetchDecimalAccount(chain, accountName);
    }

    const accounts = await callApi(chain, 'getAccounts', [[accountName]]);

    if (!Array.isArray(accounts) || accounts.length === 0) {
      throw new Error(`Аккаунт @${accountName} не найден.`);
    }

    return accounts[0];
  }

  async function enrichAccount(chain, account) {
    if (chain.config.id === 'minter' || chain.config.id === 'decimal') {
      return account;
    }

    const [dynamicProperties, chainProperties, config, followCount, rewardFund] = await Promise.all([
      callApi(chain, 'getDynamicGlobalProperties', []).catch(() => null),
      callApi(chain, 'getChainProperties', []).catch(() => null),
      callApi(chain, 'getConfig', []).catch(() => null),
      callApi(chain, 'getFollowCount', [account.name]).catch(() => null),
      callApi(chain, 'getRewardFund', ['post']).catch(() => null)
    ]);

    return Object.assign({}, account, {
      _v3ProfileContext: {
        dynamicProperties,
        chainProperties,
        config,
        followCount,
        rewardFund
      }
    });
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

  function getMetadata(account) {
    return {
      json: parseJsonField(account.json_metadata) || {},
      posting: parseJsonField(account.posting_json_metadata) || {}
    };
  }

  function getProfileMetadata(account) {
    const metadata = getMetadata(account);
    const profileSource = Object.keys(metadata.posting).length ? metadata.posting : metadata.json;
    return profileSource.profile || profileSource || {};
  }

  function pickDisplayName(account) {
    const profile = getProfileMetadata(account);
    return profile.name || profile.nickname || profile.about || account.name;
  }

  function present(value) {
    if (value === undefined || value === null || value === '') return false;
    if (Array.isArray(value) && value.length === 0) return false;
    if (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0) return false;
    return true;
  }

  function addField(rows, label, value) {
    if (present(value)) rows.push([label, value]);
  }

  function assetAmount(value) {
    if (!present(value)) return 0;
    const match = String(value).match(/-?\d+(?:\.\d+)?/);
    return match ? Number(match[0]) : 0;
  }

  function formatPercentHundredths(value) {
    if (!present(value)) return '';
    return `${Math.round(Number(value)) / 100}%`;
  }

  function numericAsset(value, digits) {
    if (!present(value)) return '';
    const number = assetAmount(value);
    if (!Number.isFinite(number)) return '';
    return Number(number.toFixed(digits || 3));
  }

  function currentMana(account, rawValue, regenSeconds, nowTime) {
    if (!present(rawValue)) return '';
    const lastVote = Date.parse(account.last_vote_time || account.last_vote || 0);
    const now = nowTime ? Date.parse(nowTime) : Date.now();
    const regen = Number(regenSeconds) || 432000;
    const value = Number(rawValue) + Math.max(0, (now - lastVote) / 1000) * (10000 / regen);
    return `${Math.min(100, Math.round(value) / 100)}%`;
  }

  function getRegenSeconds(chainId, context) {
    const config = context.config || {};
    if (chainId === 'viz') return config.CHAIN_ENERGY_REGENERATION_SECONDS || 432000;
    if (chainId === 'hive') return config.HIVE_VOTING_MANA_REGENERATION_SECONDS || 432000;
    if (chainId === 'steem') return config.STEEM_VOTING_MANA_REGENERATION_SECONDS || 432000;
    return config.STEEMIT_VOTE_REGENERATION_SECONDS || 432000;
  }

  function vestingFundField(chainId) {
    if (chainId === 'viz') return 'total_vesting_fund';
    if (chainId === 'hive') return 'total_vesting_fund_hive';
    return 'total_vesting_fund_steem';
  }

  function computePower(chain, account, field) {
    const context = account._v3ProfileContext || {};
    const props = context.dynamicProperties || {};
    const fund = assetAmount(props[vestingFundField(chain.config.id)]);
    const totalVests = assetAmount(props.total_vesting_shares);
    const vests = assetAmount(account[field]);
    if (!fund || !totalVests || !vests) return '';
    return `${(vests * fund / totalVests).toFixed(3)} ${chain.config.liquidSymbol || chain.config.powerTitle || ''}`.trim();
  }

  function computeEffectivePower(chain, account) {
    const own = assetAmount(account.vesting_shares);
    const received = assetAmount(account.received_vesting_shares);
    const delegated = assetAmount(account.delegated_vesting_shares);
    const context = account._v3ProfileContext || {};
    const props = context.dynamicProperties || {};
    const fund = assetAmount(props[vestingFundField(chain.config.id)]);
    const totalVests = assetAmount(props.total_vesting_shares);
    if (!fund || !totalVests || (!own && !received && !delegated)) return '';
    return `${((own + received - delegated) * fund / totalVests).toFixed(3)} ${chain.config.liquidSymbol || chain.config.powerTitle || ''}`.trim();
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
        ['Emission delegated', account.emission_delegated_vesting_shares],
        ['Emission received', account.emission_received_vesting_shares],
        ['TIP-баланс', account.tip_balance],
        ['Savings GOLOS', account.savings_balance],
        ['Savings GBG', account.savings_sbd_balance],
        ['Reward GOLOS', account.reward_steem_balance || account.reward_balance],
        ['Reward GBG', account.reward_sbd_balance],
        ['Reward VESTS', account.reward_vesting_balance]
      ].filter((item) => present(item[1]));
    }

    if (chainId === 'viz') {
      return [
        ['VIZ', account.balance],
        ['SHARES', account.vesting_shares],
        ['Делегировано', account.delegated_vesting_shares],
        ['Получено делегированием', account.received_vesting_shares],
        ['Энергия', formatPercentHundredths(account.energy)],
        ['Reward balance', account.reward_balance],
        ['Reward SHARES', account.reward_vesting_balance]
      ].filter((item) => present(item[1]));
    }

    if (chainId === 'minter') {
      return normalizeRestBalances(account.balances, ['coin.symbol', 'symbol', 'coin'], ['amount', 'value']);
    }

    if (chainId === 'decimal') {
      return normalizeRestBalances(account.balances, ['denom', 'symbol', 'coin', 'ticker', 'currency'], ['amount', 'value']);
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
      ].filter((item) => present(item[1]));
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
    ].filter((item) => present(item[1]));
  }

  function valueAtPath(item, path) {
    return path.split('.').reduce((value, key) => value && value[key], item);
  }

  function formatRestMinimalUnits(value) {
    const text = String(value || '').trim();
    if (text.includes('.') || !/^\d+$/.test(text) || text.length < 19) return value;
    const whole = text.slice(0, -18) || '0';
    const fraction = text.slice(-18).replace(/0+$/, '');
    return fraction ? `${whole}.${fraction}` : whole;
  }

  function normalizeRestBalances(balances, labelPaths, valuePaths) {
    if (!present(balances)) return [];
    if (!Array.isArray(balances) && typeof balances === 'object') {
      return Object.entries(balances).map(([symbol, amount]) => [symbol, formatRestMinimalUnits(amount)]);
    }
    return balances.map((item) => {
      const label = labelPaths.map((path) => valueAtPath(item, path)).find(present) || 'coin';
      const value = valuePaths.map((path) => valueAtPath(item, path)).find(present);
      return [label, formatRestMinimalUnits(value)];
    }).filter((item) => present(item[1]));
  }

  function extractSocials(profile) {
    const services = profile.services && typeof profile.services === 'object' ? profile.services : {};
    const keys = ['vk', 'facebook', 'instagram', 'twitter', 'telegram', 'skype', 'whatsapp', 'viber', 'github'];
    return keys.map((key) => [key, services[key] || profile[key]]).filter((item) => present(item[1]));
  }

  function profileRows(chain, account) {
    const profile = getProfileMetadata(account);
    const rows = [];
    addField(rows, 'Отображаемое имя', profile.name || profile.nickname || account.name || account.address);
    addField(rows, 'О себе', profile.about || profile.description);
    addField(rows, 'Локация', profile.location);
    addField(rows, 'Сайт', profile.website || profile.site);
    addField(rows, 'День рождения', profile.birthday);
    addField(rows, 'Интересы / теги', Array.isArray(profile.interests) ? profile.interests.join(', ') : profile.interests);
    addField(rows, 'Выбранные теги', Array.isArray(profile.select_tags) ? profile.select_tags.join(', ') : profile.select_tags);
    addField(rows, 'Изображение профиля', profile.profile_image);
    addField(rows, 'Cover image', profile.cover_image);
    return rows;
  }

  function economyRows(chain, account) {
    const chainId = chain.config.id;
    const context = account._v3ProfileContext || {};
    const props = context.dynamicProperties || {};
    const rows = [];
    if (chainId === 'viz') {
      addField(rows, 'Актуальная энергия', currentMana(account, account.energy, getRegenSeconds(chainId, context), props.time));
      addField(rows, 'Энергия в аккаунте', formatPercentHundredths(account.energy));
      addField(rows, 'Личный соцкапитал', computePower(chain, account, 'vesting_shares'));
      addField(rows, 'Получено соцкапитала', computePower(chain, account, 'received_vesting_shares'));
      addField(rows, 'Делегировано соцкапитала', computePower(chain, account, 'delegated_vesting_shares'));
      addField(rows, 'Итоговый соцкапитал', computeEffectivePower(chain, account));
      addField(rows, 'Vesting withdraw rate', account.vesting_withdraw_rate);
      addField(rows, 'Следующий вывод', account.next_vesting_withdrawal);
      addField(rows, 'Пропускная способность, average_bandwidth', account.average_bandwidth);
      addField(rows, 'custom_sequence', account.custom_sequence);
      addField(rows, 'custom_sequence_block_num', account.custom_sequence_block_num);
      return rows;
    }

    if (['golos', 'hive', 'steem'].includes(chainId)) {
      addField(rows, 'Актуальная батарейка', currentMana(account, account.voting_power, getRegenSeconds(chainId, context), props.time));
      addField(rows, 'Voting power в аккаунте', formatPercentHundredths(account.voting_power));
      addField(rows, `Личная ${chain.config.powerTitle || 'power'}`, computePower(chain, account, 'vesting_shares'));
      addField(rows, 'Получено делегированием', computePower(chain, account, 'received_vesting_shares'));
      addField(rows, 'Делегировано', computePower(chain, account, 'delegated_vesting_shares'));
      addField(rows, `Итоговая ${chain.config.powerTitle || 'power'}`, computeEffectivePower(chain, account));
      addField(rows, 'Vesting withdraw rate', account.vesting_withdraw_rate);
      addField(rows, 'Следующий вывод', account.next_vesting_withdrawal);
      addField(rows, 'Savings withdraw requests', account.savings_withdraw_requests);
      addField(rows, 'Post bandwidth', account.post_bandwidth);
      if (chainId === 'golos') addField(rows, 'Frozen', account.frozen);
    }

    return rows;
  }

  function governanceRows(chain, account) {
    const rows = [];
    addField(rows, 'Прокси', account.proxy);
    addField(rows, 'Голосов за делегатов', account.witnesses_voted_for);
    addField(rows, 'Голоса за witness', account.witness_votes);
    addField(rows, 'Proxied VSF votes', account.proxied_vsf_votes);
    addField(rows, 'Witness owner', account.owner || account.witness_owner);
    return rows;
  }

  function authorityRows(chain, account) {
    const rows = [];
    const regularLabel = chain.config.id === 'viz' ? 'Regular authority' : 'Posting authority';
    addField(rows, 'Owner authority', account.owner);
    addField(rows, 'Active authority', account.active);
    addField(rows, regularLabel, account.regular || account.posting);
    addField(rows, 'Публичный memo-ключ', account.memo_key || account.memoKey);
    return rows;
  }

  function activityRows(account) {
    const rows = [];
    addField(rows, 'Создан', account.created);
    addField(rows, 'Последнее обновление аккаунта', account.last_account_update);
    addField(rows, 'Последнее голосование / награда', account.last_vote_time);
    addField(rows, 'Последний пост', account.last_post);
    addField(rows, 'Количество постов', account.post_count);
    addField(rows, 'Репутация raw', account.reputation);
    addField(rows, 'Recovery account / регистратор', account.recovery_account);
    addField(rows, 'Reset account', account.reset_account);
    addField(rows, 'Last owner update', account.last_owner_update);
    addField(rows, 'Mined', account.mined);
    const followCount = account._v3ProfileContext && account._v3ProfileContext.followCount;
    if (followCount) {
      addField(rows, 'Подписчиков', followCount.follower_count);
      addField(rows, 'Подписок', followCount.following_count);
    }
    return rows;
  }

  function restRows(account) {
    const rows = [];
    addField(rows, 'Адрес', account.address || account.name);
    addField(rows, 'Nonce', account.nonce || account.transaction_count || account.tx_count);
    addField(rows, 'Общий баланс', formatRestMinimalUnits(account.total_balance_sum || account.totalBalance || account.balance_sum));
    addField(rows, 'Делегировано', formatRestMinimalUnits(account.delegated || account.delegated_amount));
    addField(rows, 'Unbonding', formatRestMinimalUnits(account.unbonding || account.unbonding_amount));
    addField(rows, 'Multisig', account.multisig);
    addField(rows, 'Validator public key', account.public_key || account.validator_public_key || account.validatorPubKey);
    addField(rows, 'Validator status', account.status || account.validator_status);
    return uniqueRows(rows);
  }

  function uniqueRows(rows) {
    const seen = new Set();
    return rows.filter(([label, value]) => {
      const key = `${label}\u0000${typeof value === 'object' ? JSON.stringify(value) : String(value)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function previewList(items, limit) {
    if (!Array.isArray(items)) return [];
    return items.slice(0, limit || 10).map((item) => {
      if (typeof item === 'string') return item;
      if (item && typeof item === 'object') {
        return item.coin && item.value ? `${formatRestMinimalUnits(item.value)} ${item.coin.symbol || item.coin}` : JSON.stringify(item);
      }
      return String(item);
    });
  }

  function previewRawItems(items, limit) {
    if (!Array.isArray(items)) return [];
    return items.slice(0, limit || 10);
  }

  function normalizeAccount(chain, account) {
    const profile = getProfileMetadata(account);
    const metadata = getMetadata(account);
    const isRestChain = chain.config.id === 'minter' || chain.config.id === 'decimal';

    return {
      chain: chain.config.title,
      chainId: chain.config.id,
      node: chain.node,
      name: account.name || account.address,
      displayName: isRestChain ? (account.address || account.name) : pickDisplayName(account),
      about: profile.about || profile.description || '',
      location: profile.location || '',
      website: profile.website || profile.site || '',
      created: account.created,
      lastVoteTime: account.last_vote_time,
      proxy: account.proxy,
      witnessVotes: account.witness_votes || [],
      balances: getBalances(chain, account),
      profileRows: profileRows(chain, account),
      economyRows: economyRows(chain, account),
      governanceRows: governanceRows(chain, account),
      authorityRows: authorityRows(chain, account),
      activityRows: activityRows(account),
      restRows: isRestChain ? restRows(account) : [],
      socials: extractSocials(profile),
      metadataJson: metadata.json,
      postingMetadataJson: metadata.posting,
      rawLists: {
        delegations: previewList(account.delegations, 20),
        transactions: previewRawItems(account.transactions, 20),
        rewards: previewList(Array.isArray(account.rewards) ? account.rewards : (account.rewards && account.rewards.data) || [], 20),
        nfts: previewList(account.nfts, 20)
      },
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
    enrichAccount,
    fetchAccount,
    formatError,
    normalizeAccount
  });
})(window);
