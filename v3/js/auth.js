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
        regularOrPostingLabel: chain.id === 'viz' ? 'regular' : 'posting',
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
        source: 'legacy localStorage'
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
        source: user.type === 'bip.to' ? 'BIP wallet link' : `legacy ${sourceChain} seed localStorage`
      };
    }

    return {
      login,
      type,
      regularOrPostingLabel: 'posting',
      hasRegularOrPosting: tryDecrypt(`dpos.space_${chain.id}_${login}_postingKey`, user.posting),
      hasActive: tryDecrypt(`dpos.space_${chain.id}_${login}_activeKey`, user.active),
      source: 'legacy localStorage'
    };
  }

  global.DposAuth = Object.freeze({
    getCurrentLogin,
    getCurrentUser,
    getKeyStatus,
    getUserLogin,
    getUserType,
    getUsers,
    tryDecrypt,
    isSameUser,
    selectUser
  });
})(window);
