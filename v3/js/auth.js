(function exposeAuth(global) {
  'use strict';

  function safeJsonParse(value, fallback) {
    if (!value) return fallback;
    try {
      return JSON.parse(value);
    } catch (error) {
      return fallback;
    }
  }

  function getKeys(chain) {
    return {
      current: `${chain.id}_current_user`,
      users: `${chain.id}_users`
    };
  }

  function getUsers(chain) {
    const keys = getKeys(chain);
    const users = safeJsonParse(global.localStorage.getItem(keys.users), []);
    return Array.isArray(users) ? users : [];
  }

  function getCurrentUser(chain) {
    const keys = getKeys(chain);
    return safeJsonParse(global.localStorage.getItem(keys.current), null);
  }

  function getUserLogin(user) {
    if (!user) return '';
    if (user.type === 'vizonator') return user.last_login || '';
    return user.login || '';
  }

  function getUserType(user) {
    if (!user) return 'standard';
    if (user.type === 'vizonator') return 'vizonator';
    if (user.type === 'golos.app') return 'golos.app';
    return 'standard';
  }

  function isSameUser(a, b) {
    return getUserLogin(a) === getUserLogin(b) && getUserType(a) === getUserType(b);
  }

  function getCurrentLogin(chain) {
    return getUserLogin(getCurrentUser(chain));
  }

  function setUsers(chain, users) {
    global.localStorage.setItem(getKeys(chain).users, JSON.stringify(Array.isArray(users) ? users : []));
  }

  function setCurrentUser(chain, user) {
    if (!user) {
      global.localStorage.removeItem(getKeys(chain).current);
      return;
    }
    global.localStorage.setItem(getKeys(chain).current, JSON.stringify(toLegacyCurrentUser(chain, user)));
  }

  function hasSameStoredIdentity(chain, a, b) {
    if (isSameUser(a, b)) return true;
    if ((chain.id === 'minter' || chain.id === 'decimal') && a && b && a.seed && b.seed) return a.seed === b.seed;
    return false;
  }

  function saveUser(chain, user) {
    const users = getUsers(chain);
    if (users.some((item) => hasSameStoredIdentity(chain, item, user))) {
      throw new Error(`Аккаунт ${getUserLogin(user)} уже добавлен. Чтобы изменить ключи, сначала удалите старую запись.`);
    }

    users.push(user);
    setUsers(chain, users);
    setCurrentUser(chain, user);
    return user;
  }

  function removeUser(chain, login, type) {
    const users = getUsers(chain);
    const nextUsers = users.filter((user) => !(getUserLogin(user) === login && getUserType(user) === type));
    setUsers(chain, nextUsers);

    const current = getCurrentUser(chain);
    if (current && getUserLogin(current) === login && getUserType(current) === type) {
      setCurrentUser(chain, nextUsers[0] || null);
    }

    if (!nextUsers.length) {
      global.localStorage.removeItem(getKeys(chain).users);
      global.localStorage.removeItem(getKeys(chain).current);
    }

    return nextUsers;
  }

  function getSeedChains() {
    const result = [];
    for (let index = 0; index < global.localStorage.length; index += 1) {
      const key = global.localStorage.key(index);
      if (!key || !key.endsWith('_users')) continue;
      const chainId = key.slice(0, -'_users'.length);
      const users = safeJsonParse(global.localStorage.getItem(key), []);
      if (Array.isArray(users) && users.some((user) => user && user.seed)) {
        result.push({ chainId, users: users.filter((user) => user && user.seed) });
      }
    }
    return result;
  }

  function encryptKey(passphrase, value) {
    if (!value) return '';
    if (!global.sjcl || typeof global.sjcl.encrypt !== 'function') {
      throw new Error('Не удалось загрузить модуль шифрования ключей.');
    }
    return global.sjcl.encrypt(passphrase, value);
  }

  function createKeyUser(chain, login, keys) {
    const user = { login };
    const regularOrPosting = chain.id === 'viz' ? 'regular' : 'posting';
    const mainKey = keys && keys[regularOrPosting];
    if (!login) throw new Error('Введите логин аккаунта.');
    if (!mainKey) throw new Error(`Введите ${regularOrPosting}-ключ.`);
    user[regularOrPosting] = encryptKey(`dpos.space_${chain.id}_${login}_${regularOrPosting}Key`, mainKey);
    if (keys && keys.active) user.active = encryptKey(`dpos.space_${chain.id}_${login}_activeKey`, keys.active);
    return user;
  }

  function createSeedUser(chain, login, seed, importFrom) {
    if (!login) throw new Error(chain.id === 'minter' || chain.id === 'decimal' ? 'Введите имя/адрес аккаунта.' : 'Введите логин аккаунта.');
    if (!seed) throw new Error('Введите seed-фразу.');
    const sourceChain = importFrom || chain.id;
    const user = {
      login,
      seed: encryptKey(`dpos.space_${sourceChain}_${login}_seed`, seed)
    };
    if (importFrom) user.importFrom = importFrom;
    return user;
  }

  function toLegacyCurrentUser(chain, user) {
    if ((chain.id === 'minter' || chain.id === 'decimal') && user.seed) {
      return {
        login: user.login,
        seed: user.seed,
        importFrom: user.importFrom,
        type: user.type,
        address: user.address
      };
    }

    if (chain.id === 'viz' && user.type === 'vizonator') {
      return {
        type: 'vizonator',
        last_login: user.last_login,
        isActive: user.isActive
      };
    }

    if (chain.id === 'viz') {
      return {
        login: user.login,
        regular: user.regular,
        active: user.active,
        memo: user.memo_key
      };
    }

    const result = {
      login: user.login,
      posting: user.posting,
      active: user.active,
      memo: user.memo_key
    };

    if (chain.id === 'golos' && user.type === 'golos.app') {
      result.type = 'golos.app';
    }

    return result;
  }

  function selectUser(chain, login, type) {
    const users = getUsers(chain);
    const user = users.find((item) => getUserLogin(item) === login && getUserType(item) === type);

    if (!user) {
      throw new Error(`Аккаунт ${login} не найден в ${getKeys(chain).users}.`);
    }

    global.localStorage.setItem(getKeys(chain).current, JSON.stringify(toLegacyCurrentUser(chain, user)));
    return user;
  }

  function tryDecrypt(password, encrypted) {
    if (!encrypted || !global.sjcl || typeof global.sjcl.decrypt !== 'function') {
      return false;
    }

    try {
      return Boolean(global.sjcl.decrypt(password, encrypted));
    } catch (error) {
      return false;
    }
  }

  function getKeyStatus(chain, user) {
    const login = getUserLogin(user);
    const type = getUserType(user);

    if (!user || !login) {
      return {
        login: '',
        type: 'none',
        regularOrPostingLabel: chain.id === 'viz' ? 'regular' : (chain.id === 'minter' || chain.id === 'decimal' ? 'seed' : 'posting'),
        hasRegularOrPosting: false,
        hasActive: false,
        source: 'none'
      };
    }

    if (chain.id === 'golos' && type === 'golos.app') {
      return {
        login,
        type,
        regularOrPostingLabel: 'posting',
        hasRegularOrPosting: typeof user.posting !== 'undefined',
        hasActive: typeof user.active !== 'undefined',
        source: 'golos.app OAuth'
      };
    }

    if (chain.id === 'viz' && type === 'vizonator') {
      return {
        login,
        type,
        regularOrPostingLabel: 'regular',
        hasRegularOrPosting: true,
        hasActive: user.isActive === true,
        source: 'Vizonator'
      };
    }

    if (chain.id === 'viz') {
      return {
        login,
        type,
        regularOrPostingLabel: 'regular',
        hasRegularOrPosting: tryDecrypt(`dpos.space_viz_${login}_regularKey`, user.regular),
        hasActive: tryDecrypt(`dpos.space_viz_${login}_activeKey`, user.active),
        source: 'сохранённый аккаунт браузера'
      };
    }

    if (chain.id === 'minter' || chain.id === 'decimal') {
      const sourceChain = user.importFrom || chain.id;
      const hasSeed = tryDecrypt(`dpos.space_${sourceChain}_${login}_seed`, user.seed);
      return {
        login,
        type: user.type || 'seed',
        regularOrPostingLabel: 'seed',
        hasRegularOrPosting: hasSeed,
        hasActive: hasSeed,
        source: user.type === 'bip.to' ? 'BIP wallet link' : `сохранённый seed ${sourceChain}`
      };
    }

    return {
      login,
      type,
      regularOrPostingLabel: 'posting',
      hasRegularOrPosting: tryDecrypt(`dpos.space_${chain.id}_${login}_postingKey`, user.posting),
      hasActive: tryDecrypt(`dpos.space_${chain.id}_${login}_activeKey`, user.active),
      source: 'сохранённый аккаунт браузера'
    };
  }

  global.DposAuth = Object.freeze({
    createKeyUser,
    createSeedUser,
    encryptKey,
    getCurrentLogin,
    getCurrentUser,
    getKeyStatus,
    getSeedChains,
    getUserLogin,
    getUserType,
    getUsers,
    tryDecrypt,
    isSameUser,
    removeUser,
    saveUser,
    selectUser
  });
})(window);
