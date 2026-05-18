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
    const normalizedStoredNode = storedNode && storedNode.replace(/\/$/, '');
    const shouldPreferStoredNode = chainConfig.id !== 'viz';
    const nodes = shouldPreferStoredNode && normalizedStoredNode && chainConfig.nodes.includes(normalizedStoredNode)
      ? [normalizedStoredNode, ...chainConfig.nodes.filter((nodeUrl) => nodeUrl !== normalizedStoredNode)]
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

  function minterAddressToEvm(address) {
    const text = String(address || '').trim();
    return /^Mx[0-9a-fA-F]{40}$/.test(text) ? `0x${text.slice(2)}` : '';
  }

  async function fetchMinterHubBalance(address, chainName, contractAddress) {
    const evmAddress = minterAddressToEvm(address);
    if (!evmAddress) return null;
    const host = chainName === 'bsc' ? 'api.bscscan.com' : 'api.etherscan.io';
    const data = await fetchOptional(`https://${host}/api?module=account&action=tokenbalance&contractaddress=${contractAddress}&address=${evmAddress}&tag=latest`);
    const raw = data && data.result;
    if (raw === undefined || raw === null || raw === '') return null;
    return formatRestMinimalUnits(raw);
  }

  async function fetchMinterHubBalances(address) {
    const [ethereumHub, bscHub] = await Promise.all([
      fetchMinterHubBalance(address, 'ethereum', '0x8e9a29e7ed21db7c5b2e1cd75e676da0236dfb45'),
      fetchMinterHubBalance(address, 'bsc', '0x8ac0a467f878f3561d309cf9b0994b0530b0a9d2')
    ]);
    return { ethereumHub, bscHub };
  }

  async function fetchMinterAccount(chain, accountName) {
    const address = accountName;
    const [addressData, delegationsData, transactionsData, rewardsData, hubBalances] = await Promise.all([
      fetchJson(`${chain.config.explorerBase}/addresses/${encodeURIComponent(address)}`),
      fetchOptional(`${chain.config.explorerBase}/addresses/${encodeURIComponent(address)}/delegations`),
      fetchOptional(`${chain.config.explorerBase}/addresses/${encodeURIComponent(address)}/transactions?page=1`),
      fetchOptional(`${chain.config.explorerBase}/addresses/${encodeURIComponent(address)}/statistics/rewards?start_time=${yesterdayIsoDate()}&end_time=${yesterdayIsoDate()}`),
      fetchMinterHubBalances(address)
    ]);
    const unwrapped = unwrapRestData(addressData) || {};
    return Object.assign({ name: address, address }, unwrapped, {
      balances: unwrapped.balances || unwrapped.balance || [],
      delegations: unwrapRestData(delegationsData) || unwrapped.delegations || [],
      transactions: unwrapRestData(transactionsData) || [],
      rewards: unwrapRestData(rewardsData) || null,
      hubBalances: hubBalances || {},
      rawApi: {
        address: addressData,
        delegations: delegationsData,
        transactions: transactionsData,
        rewards: rewardsData,
        hubBalances: hubBalances || {}
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
      fetchOptional(`${(chain.config.gateUrl || 'https://mainnet-gate.decimalchain.com/api/').replace(/\/$/, '')}/address/${encodeURIComponent(address)}/nfts?limit=20&offset=0`)
    ]);
    const unwrappedAddress = unwrapRestData(addressData) || {};
    const addressObject = unwrappedAddress.address || unwrappedAddress;
    const unwrappedBalances = unwrapRestData(balancesData) || {};
    return Object.assign({ name: address, address }, addressObject, {
      balances: unwrappedBalances.balances || unwrappedBalances.balance || addressObject.balance || [],
      transactions: (unwrapRestData(transactionsData) || {}).txs || unwrapRestData(transactionsData) || [],
      rewards: (unwrapRestData(rewardsData) || {}).rewards || unwrapRestData(rewardsData) || [],
      nfts: (unwrapRestData(nftsData) || {}).tokens || (unwrapRestData(nftsData) || {}).nfts || unwrapRestData(nftsData) || [],
      rawApi: {
        address: addressData,
        balances: balancesData,
        transactions: transactionsData,
        rewards: rewardsData,
        nfts: nftsData
      }
    });
  }

  async function fetchDecimalRewards(chain, address, days) {
    const safeDays = Math.max(1, Math.min(Number(days) || 1, 3650));
    const endTime = Date.now() - (86400000 * safeDays);
    const totals = {};
    let offset = 0;
    let shouldContinue = true;

    while (shouldContinue) {
      const page = await fetchOptional(`${chain.config.apiBase}/rewards/${encodeURIComponent(address)}?limit=200&offset=${offset}`);
      const rewards = (unwrapRestData(page) || {}).rewards || unwrapRestData(page) || [];
      if (!Array.isArray(rewards) || !rewards.length) break;

      shouldContinue = false;
      for (const reward of rewards) {
        const rewardTime = Date.parse(reward.date || reward.timestamp || reward.created_at || '');
        if (Number.isFinite(rewardTime) && rewardTime < endTime) continue;
        shouldContinue = true;
        const currency = reward.currency || reward.coin || reward.symbol || 'DEL';
        const amount = Number(formatRestMinimalUnits(reward.value || reward.amount || 0));
        if (!Number.isFinite(amount)) continue;
        totals[currency] = (totals[currency] || 0) + amount;
      }

      if (rewards.length < 200) break;
      offset += 200;
    }

    return totals;
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

  function timeUntilFullMana(account, rawValue, regenSeconds, nowTime) {
    if (!present(rawValue)) return '';
    const lastVote = Date.parse(account.last_vote_time || account.last_vote || 0);
    const now = nowTime ? Date.parse(nowTime) : Date.now();
    const regen = Number(regenSeconds) || 432000;
    const value = Math.min(10000, Number(rawValue) + Math.max(0, (now - lastVote) / 1000) * (10000 / regen));
    if (!Number.isFinite(value)) return '';
    if (value >= 9999.5) return 'Сейчас';
    const seconds = Math.ceil((10000 - value) * regen / 10000);
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.ceil((seconds % 3600) / 60);
    const parts = [];
    if (days) parts.push(`${days} д.`);
    if (hours) parts.push(`${hours} ч.`);
    if (minutes && parts.length < 2) parts.push(`${minutes} мин.`);
    const date = new Date(now + seconds * 1000).toISOString().replace('T', ' ').slice(0, 16);
    return `${parts.join(' ') || '< 1 мин.'} (${date} UTC)`;
  }

  function formatShortDuration(seconds) {
    const safeSeconds = Math.max(0, Math.ceil(Number(seconds) || 0));
    const hours = Math.floor(safeSeconds / 3600);
    const minutes = Math.floor((safeSeconds % 3600) / 60);
    const restSeconds = safeSeconds % 60;
    const parts = [];
    if (hours) parts.push(`${hours} ч.`);
    if (minutes) parts.push(`${minutes} мин.`);
    if (restSeconds && parts.length === 0) parts.push(`${restSeconds} сек.`);
    if (parts.length === 0) parts.push('0 сек.');
    return parts.join(' ');
  }

  function parseChainTimestamp(value) {
    if (!present(value)) return NaN;
    const text = String(value).trim();
    const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(text);
    return Date.parse(hasTimezone ? text : `${text}Z`);
  }

  function computeGolosPostQuota(account) {
    if (!account || !present(account.post_bandwidth)) return null;
    const postBandwidth = Number(account.post_bandwidth);
    if (!Number.isFinite(postBandwidth) || postBandwidth < 0) return null;
    const context = account._v3ProfileContext || {};
    const props = context.dynamicProperties || {};
    const now = props.time ? parseChainTimestamp(props.time) : Date.now();
    const lastPost = parseChainTimestamp(account.last_post || 0);
    if (!Number.isFinite(now) || !Number.isFinite(lastPost)) return null;

    const secondsPerDay = 86400;
    const elapsed = Math.max(0, (now - lastPost) / 1000);
    if (elapsed >= secondsPerDay || postBandwidth <= 0) {
      return { remaining: 4, text: '4', nextText: '', currentBandwidth: 10000 };
    }

    const currentBandwidth = ((secondsPerDay - elapsed) / secondsPerDay * postBandwidth) + 10000;
    if (!Number.isFinite(currentBandwidth) || currentBandwidth <= 10000) {
      return { remaining: 4, text: '4', nextText: '', currentBandwidth };
    }

    const bands = [
      { max: 20000, remaining: 3, nextRemaining: 4, target: 10000 },
      { max: 30000, remaining: 2, nextRemaining: 3, target: 20000 },
      { max: 40000, remaining: 1, nextRemaining: 2, target: 30000 },
      { max: Infinity, remaining: 0, nextRemaining: 1, target: 40000 }
    ];
    const band = bands.find((item) => currentBandwidth <= item.max) || bands[bands.length - 1];
    const decayPerSecond = postBandwidth / secondsPerDay;
    const secondsUntilNext = decayPerSecond > 0 ? (currentBandwidth - band.target) / decayPerSecond : 0;
    const safeSecondsUntilNext = Math.max(0, Math.ceil(secondsUntilNext));
    const durationText = formatShortDuration(safeSecondsUntilNext);
    const nextText = band.remaining === 0
      ? `Опубликовать пост без штрафа возможно через ${durationText}`
      : `${band.nextRemaining} станет через ${durationText}`;
    return {
      remaining: band.remaining,
      nextRemaining: band.nextRemaining,
      secondsUntilNext: safeSecondsUntilNext,
      text: `${band.remaining}. ${nextText}`,
      nextText,
      currentBandwidth
    };
  }

  function calculateReputation(raw) {
    if (!present(raw)) return '';
    const value = Number(raw);
    if (!Number.isFinite(value) || value === 0) return '0';
    const score = Math.max(Math.log10(Math.abs(value)) - 9, 0);
    const signed = value < 0 ? -score : score;
    return (signed * 9 + 25).toFixed(2);
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


  function golosPowerRate(account) {
    const context = account._v3ProfileContext || {};
    const props = context.dynamicProperties || {};
    const fund = assetAmount(props.total_vesting_fund_steem);
    const totalVests = assetAmount(props.total_vesting_shares);
    if (!fund || !totalVests) return 0;
    return 1000000 * fund / totalVests;
  }

  function formatGolosPower(account, field, digits) {
    const rate = golosPowerRate(account);
    const vests = assetAmount(account[field]);
    if (!rate || !vests) return account[field] || '';
    const decimals = digits === undefined ? 6 : digits;
    const formatted = (vests / 1000000 * rate).toFixed(decimals);
    return `${digits === undefined ? formatted : Number(formatted)} СГ`;
  }

  function formatRussianUtcDateTime(value) {
    const timestamp = parseChainTimestamp(value);
    if (!Number.isFinite(timestamp) || timestamp <= 0) return '';
    const date = new Date(timestamp);
    if (date.getUTCFullYear() <= 1970) return '';
    const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
    const day = String(date.getUTCDate()).padStart(2, '0');
    const month = months[date.getUTCMonth()];
    const year = date.getUTCFullYear();
    const time = [date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds()]
      .map((part) => String(part).padStart(2, '0'))
      .join(':');
    return `${day} ${month} ${year} г. ${time}`;
  }

  function isNonZeroAsset(value) {
    return present(value) && Math.abs(assetAmount(value)) > 0;
  }

  function getBalances(chain, account) {
    const chainId = chain.config.id;

    if (chainId === 'golos') {
      return [
        ['GOLOS', account.balance],
        ['GBG', account.sbd_balance || account.gbg_balance],
        ['СГ', formatGolosPower(account, 'vesting_shares')],
        ['Делегировано СГ', formatGolosPower(account, 'delegated_vesting_shares')],
        ['Получено делегированием СГ', formatGolosPower(account, 'received_vesting_shares')],
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
      addField(rows, 'Репутация', calculateReputation(account.reputation));
      addField(rows, '100% батарейка', timeUntilFullMana(account, account.voting_power, getRegenSeconds(chainId, context), props.time));
      addField(rows, 'Voting power в аккаунте', formatPercentHundredths(account.voting_power));
      addField(rows, `Личная ${chain.config.powerTitle || 'power'}`, computePower(chain, account, 'vesting_shares'));
      addField(rows, 'Получено делегированием', computePower(chain, account, 'received_vesting_shares'));
      addField(rows, 'Делегировано', computePower(chain, account, 'delegated_vesting_shares'));
      addField(rows, `Итоговая ${chain.config.powerTitle || 'power'}`, computeEffectivePower(chain, account));
      if (chainId === 'golos' && isNonZeroAsset(account.vesting_withdraw_rate)) {
        addField(rows, 'Сумма вывода из СГ', formatGolosPower(account, 'vesting_withdraw_rate', 3));
        addField(rows, 'Следующий вывод', formatRussianUtcDateTime(account.next_vesting_withdrawal));
      } else if (chainId !== 'golos') {
        addField(rows, 'Vesting withdraw rate', account.vesting_withdraw_rate);
        addField(rows, 'Следующий вывод', account.next_vesting_withdrawal);
      }
      addField(rows, 'Savings withdraw requests', account.savings_withdraw_requests);
      if (chainId === 'golos') {
        const postQuota = computeGolosPostQuota(account);
        addField(rows, 'Количество постов, которое можно опубликовать без штрафа', postQuota && postQuota.text);
      }
      if (chainId !== 'golos') addField(rows, 'Post bandwidth', account.post_bandwidth);
      if (chainId === 'golos' && account.frozen === true) addField(rows, 'Аккаунт заморожен', 'Да');
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
    if (account.hubBalances) {
      addField(rows, 'HUB в Ethereum', account.hubBalances.ethereumHub);
      addField(rows, 'HUB в BSC', account.hubBalances.bscHub);
    }
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
      profileImage: profile.profile_image || profile.avatar || '',
      coverImage: profile.cover_image || profile.background_image || '',
      rawLists: {
        delegations: previewList(account.delegations, 20),
        transactions: previewRawItems(account.transactions, 20),
        rewards: previewList(Array.isArray(account.rewards) ? account.rewards : (account.rewards && account.rewards.data) || [], 20),
        nfts: previewList(account.nfts, 20),
        uiaBalances: previewRawItems(account.uiaBalances, 50)
      },
      raw: account
    };
  }

  function formatError(error) {
    if (!error) {
      return 'unknown error';
    }

    const errorName = String(error.errorName || (error.error && error.error.errorName) || '');
    const errorSignature = String(error.errorSignature || (error.error && error.error.errorSignature) || '');
    const message = String(error.message || error.reason || error.data || error || '');
    if (errorName === 'EnforcedPause' || errorSignature === 'EnforcedPause()' || message.includes('EnforcedPause')) {
      return 'Операция сейчас недоступна: Decimal NFT staking contract вернул EnforcedPause. Это on-chain pause смарт-контракта, а не ошибка полей формы; транзакцию нельзя отправить, пока контракт не будет разблокирован в сети.';
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
    fetchDecimalRewards,
    formatError,
    golosPowerRate,
    computeGolosPostQuota,
    normalizeAccount
  });
})(window);
