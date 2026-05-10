(function exposeBroadcast(global) {
  'use strict';

  const AUTHORITY_BY_CHAIN = Object.freeze({
    golos: { posting: 'posting', regular: 'posting', active: 'active' },
    viz: { posting: 'regular', regular: 'regular', active: 'active' },
    hive: { posting: 'posting', regular: 'posting', active: 'active' },
    steem: { posting: 'posting', regular: 'posting', active: 'active' },
    minter: { posting: 'seed', regular: 'seed', active: 'seed', seed: 'seed' },
    decimal: { posting: 'seed', regular: 'seed', active: 'seed', seed: 'seed' }
  });

  function getAuthorityName(chain, requestedAuthority) {
    const map = AUTHORITY_BY_CHAIN[chain.id] || AUTHORITY_BY_CHAIN.golos;
    return map[requestedAuthority] || requestedAuthority;
  }

  function getEncryptedField(user, authority) {
    if (!user) return '';
    if (authority === 'regular') return user.regular || '';
    if (authority === 'posting') return user.posting || '';
    if (authority === 'active') return user.active || '';
    return user[authority] || '';
  }

  function getPassphrase(chain, login, authority) {
    if (chain.id === 'viz' && authority === 'regular') {
      return `dpos.space_viz_${login}_regularKey`;
    }

    return `dpos.space_${chain.id}_${login}_${authority}Key`;
  }

  function decryptLegacyKey(chain, user, requestedAuthority) {
    const login = global.DposAuth.getUserLogin(user);
    const type = global.DposAuth.getUserType(user);
    const authority = getAuthorityName(chain, requestedAuthority);
    const encrypted = (chain.id === 'minter' || chain.id === 'decimal') ? (user && user.seed) : getEncryptedField(user, authority);

    if (!login) {
      throw new Error('Legacy-аккаунт не выбран. Откройте раздел «Аккаунты» и выберите сохранённый аккаунт.');
    }

    if (type === 'vizonator') {
      throw new Error('Vizonator-аккаунт найден, но v3 не извлекает приватный ключ из расширения. Для отправки используйте старый интерфейс или legacy localStorage-аккаунт.');
    }

    if (type === 'golos.app') {
      throw new Error('golos.app OAuth найден, но v3 пока не умеет отправлять операции через OAuth. Нужен legacy localStorage-аккаунт с зашифрованным ключом.');
    }

    if ((chain.id === 'minter' || chain.id === 'decimal') && type === 'bip.to') {
      throw new Error('BIP wallet linked account has no local seed in v3. Use preview/deep link in old interface or select a seed account.');
    }

    if (!encrypted) {
      throw new Error(`В legacy localStorage нет зашифрованного ${authority}-ключа для @${login}.`);
    }

    if (!global.sjcl || typeof global.sjcl.decrypt !== 'function') {
      throw new Error('SJCL не загружен: невозможно расшифровать legacy-ключ.');
    }

    try {
      const passphrase = (chain.id === 'minter' || chain.id === 'decimal')
        ? `dpos.space_${(user && user.importFrom) || chain.id}_${login}_seed`
        : getPassphrase(chain, login, authority);
      return {
        login,
        authority,
        privateKey: global.sjcl.decrypt(passphrase, encrypted)
      };
    } catch (error) {
      throw new Error(`Не удалось расшифровать ${authority}-ключ @${login} по старой passphrase-схеме.`);
    }
  }

  function getAvailableKeys(chain, user) {
    const status = global.DposAuth.getKeyStatus(chain, user);
    const regularName = getAuthorityName(chain, 'regular');

    return {
      login: status.login,
      type: status.type,
      regularOrPosting: status.hasRegularOrPosting,
      regularOrPostingLabel: regularName,
      active: status.hasActive,
      source: status.source
    };
  }

  function getClient(chain) {
    const client = global[chain.libraryGlobal];

    if (chain.id === 'minter' || chain.id === 'decimal') {
      if (!client) throw new Error(`SDK ${chain.libraryGlobal} недоступен.`);
      return client;
    }

    if (!client || !client.broadcast) {
      throw new Error(`Broadcast API ${chain.libraryGlobal}.broadcast недоступен.`);
    }

    return client;
  }

  function toCallbackPromise(fn, context, args) {
    return new Promise((resolve, reject) => {
      fn.call(context, ...args, (error, result) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(result);
      });
    });
  }

  function derivePublicKey(chain, privateKey) {
    const client = global[chain.libraryGlobal];
    if (client && client.auth && typeof client.auth.wifToPublic === 'function') {
      return client.auth.wifToPublic(privateKey);
    }
    return '';
  }

  function isLikelyWif(value) {
    return /^5[1-9A-HJ-NP-Za-km-z]{45,55}$/.test(String(value || ''));
  }

  function isLikelyMnemonic(value) {
    const words = String(value || '').trim().split(/\s+/).filter(Boolean);
    return words.length >= 12 && words.length <= 24;
  }

  function getAuthorityObject(account, authority) {
    if (!account) return null;
    if (authority === 'regular') return account.regular || account.posting || null;
    return account[authority] || null;
  }

  function publicKeyMatchesAuthority(publicKey, authorityObject) {
    if (!publicKey || !authorityObject || !Array.isArray(authorityObject.key_auths)) return false;
    return authorityObject.key_auths.some((item) => Array.isArray(item) && item[0] === publicKey && Number(item[1]) > 0);
  }

  async function verifyPreparedAuthority(chain, prepared) {
    const key = prepared.getPrivateKey();
    const warnings = [];
    if (chain.id === 'minter' || chain.id === 'decimal') {
      if (!isLikelyMnemonic(key) && !isLikelyWif(key)) {
        throw new Error('Расшифрованный seed/private key не похож на legacy seed/WIF. Broadcast остановлен.');
      }
      warnings.push('Для Minter/Decimal v3 проверяет legacy decrypt и формат seed/key; SDK сам выводит адрес и подпись из seed в памяти.');
      return { checked: true, publicKeyMatched: false, warnings };
    }
    if (!isLikelyWif(key)) {
      throw new Error('Расшифрованный ключ не похож на WIF. Broadcast остановлен до отправки.');
    }

    const client = getClient(chain);
    let account = null;
    if (client.api && typeof client.api.getAccountsAsync === 'function') {
      const accounts = await client.api.getAccountsAsync([prepared.from]);
      account = accounts && accounts[0];
    } else if (client.api && typeof client.api.getAccounts === 'function') {
      const accounts = await toCallbackPromise(client.api.getAccounts, client.api, [[prepared.from]]);
      account = accounts && accounts[0];
    }

    if (!account) {
      throw new Error(`Не удалось проверить authority @${prepared.from}: аккаунт не получен с ноды.`);
    }

    const authorityObject = getAuthorityObject(account, prepared.authority);
    if (!authorityObject) {
      throw new Error(`У аккаунта @${prepared.from} нет authority ${prepared.authority}, нужной для операции.`);
    }

    const publicKey = derivePublicKey(chain, key);
    if (publicKey) {
      if (!publicKeyMatchesAuthority(publicKey, authorityObject)) {
        throw new Error(`Публичный ключ расшифрованного ${prepared.authority}-ключа не найден в authority @${prepared.from}. Broadcast остановлен.`);
      }
      return { checked: true, publicKeyMatched: true, warnings };
    }

    warnings.push(`Библиотека ${chain.libraryGlobal}.auth.wifToPublic недоступна: выполнена только проверка формата WIF и наличия authority ${prepared.authority} у аккаунта.`);
    return { checked: true, publicKeyMatched: false, warnings };
  }

  function validateAccountName(chain, value, label) {
    const text = String(value || '').trim().replace(/^@/, '');
    if (chain.id === 'minter') return validateAddress(chain, text, label || 'Minter address');
    if (chain.id === 'decimal') return validateAddress(chain, text, label || 'Decimal address');
    const pattern = chain.id === 'hive' || chain.id === 'steem'
      ? /^(?=.{3,16}$)[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)*$/
      : /^(?=.{3,25}$)[a-z0-9][a-z0-9.-]*[a-z0-9]$/;
    if (!pattern.test(text)) {
      throw new Error(`${label || 'Аккаунт'} должен быть корректным именем ${chain.title}: ${text || '[пусто]'}.`);
    }
    return text;
  }


  function validateAddress(chain, value, label) {
    const text = String(value || '').trim();
    const patterns = {
      minter: /^Mx[0-9a-fA-F]{40}$/,
      decimal: /^(dx|0x)[0-9a-fA-F]{40}$/
    };
    if (!patterns[chain.id] || !patterns[chain.id].test(text)) {
      throw new Error(`${label || 'Address'} должен быть корректным ${chain.title} address.`);
    }
    return text;
  }

  function validateCoinSymbol(value, label) {
    const text = String(value || '').trim().toUpperCase();
    if (!/^[A-Z][A-Z0-9]{1,14}$/.test(text)) {
      throw new Error(`${label || 'Coin'} должен быть coin/ticker symbol 2-15 A-Z/0-9.`);
    }
    return text;
  }

  function validateAmount(value, label) {
    const text = String(value || '').trim().replace(',', '.');
    if (!/^\d+(?:\.\d{1,18})?$/.test(text) || Number(text) <= 0) {
      throw new Error(`${label || 'Amount'} должен быть положительным числом.`);
    }
    return text;
  }

  function validateAsset(chain, value, allowedSymbols, label) {
    const text = String(value || '').trim().replace(',', '.');
    const match = /^(\d+(?:\.\d+)?)\s+([A-Z]+)$/.exec(text);
    if (!match) {
      throw new Error(`${label || 'Сумма'} должна быть в формате "1.000 SYMBOL".`);
    }
    const symbols = Array.isArray(allowedSymbols) ? allowedSymbols : [allowedSymbols];
    if (!symbols.includes(match[2])) {
      throw new Error(`${label || 'Сумма'} использует символ ${match[2]}, ожидалось: ${symbols.join(', ')}.`);
    }
    const decimals = (match[1].split('.')[1] || '').length;
    const expectedDecimals = match[2] === (chain.vestingSymbol || 'VESTS') ? 6 : 3;
    if (decimals !== expectedDecimals) {
      throw new Error(`${label || 'Сумма'} должна иметь ${expectedDecimals} знаков после точки для ${match[2]}.`);
    }
    if (Number(match[1]) < 0) {
      throw new Error(`${label || 'Сумма'} не может быть отрицательной.`);
    }
    return `${match[1]} ${match[2]}`;
  }

  function validateRequestId(value) {
    const id = Number(value);
    if (!Number.isSafeInteger(id) || id < 0) {
      throw new Error('Request ID должен быть целым неотрицательным числом.');
    }
    return id;
  }

  function operationWarnings(prepared) {
    const warnings = [];
    const text = JSON.stringify(prepared.params || []);
    if (/5[1-9A-HJ-NP-Za-km-z]{45,55}/.test(text)) {
      warnings.push('В параметрах операции обнаружена строка, похожая на private WIF. Проверьте memo/поля перед отправкой.');
    }
    if (/memo/i.test(text) && text.length > 2048) {
      warnings.push('Memo/JSON выглядит длинным: проверьте, что это не приватные данные.');
    }
    return warnings;
  }

  function createPrepared(chain, from, authority, privateKey, operationName, params, meta) {
    const prepared = {
      chain: chain.id,
      from,
      authority,
      operationName,
      params,
      meta: Object.assign({ warnings: [] }, meta || {})
    };
    prepared.meta.warnings = prepared.meta.warnings.concat(operationWarnings(prepared));

    Object.defineProperty(prepared, 'getPrivateKey', {
      enumerable: false,
      value() {
        return privateKey;
      }
    });

    return prepared;
  }

  function prepare(chain, requestedAuthority, operationName, params, meta) {
    const user = global.DposAuth.getCurrentUser(chain);
    const keys = decryptLegacyKey(chain, user, requestedAuthority);
    return createPrepared(chain, keys.login, keys.authority, keys.privateKey, operationName, params, meta);
  }

  function prepareWithPrivateKey(chain, from, requestedAuthority, privateKey, operationName, params, meta) {
    const signer = validateAccountName(chain, from, 'Signer account');
    const key = String(privateKey || '').trim();
    if (!key) {
      throw new Error('Private WIF signer key is required for this invite/service operation. It is used only in memory for broadcast and is not stored.');
    }
    const authority = getAuthorityName(chain, requestedAuthority);
    return createPrepared(chain, signer, authority, key, operationName, params, meta);
  }

  function amountToWeiString(amount) {
    const text = validateAmount(amount, 'Amount');
    const [whole, frac = ''] = text.split('.');
    return `${whole}${frac.padEnd(18, '0')}`.replace(/^0+(?=\d)/, '');
  }

  async function executeMinter(chain, prepared) {
    const sdk = getClient(chain);
    const Minter = sdk.Minter;
    const txType = sdk.TX_TYPE || {};
    if (!Minter) throw new Error('minterSDK.Minter недоступен.');
    const minter = new Minter({ apiType: 'node', baseURL: chain.apiBase || 'https://api.minter.one/v2' });
    const tx = Object.assign({ chainId: 1, gasCoin: prepared.meta.gasCoin || prepared.meta.coin || 'BIP' }, prepared.params[0] || {});
    if (typeof minter.replaceCoinSymbol === 'function') {
      tx.type = tx.type || txType[prepared.meta.txType] || prepared.meta.txType;
      const idTx = await minter.replaceCoinSymbol(tx);
      return minter.postTx(idTx, { seedPhrase: prepared.getPrivateKey() });
    }
    throw new Error('minterSDK replaceCoinSymbol/postTx недоступны.');
  }

  async function executeDecimal(chain, prepared) {
    const sdk = getClient(chain);
    if (!sdk.Wallet || !sdk.DecimalEVM) throw new Error('DecimalSDK Wallet/DecimalEVM недоступны.');
    const wallet = new sdk.Wallet(prepared.getPrivateKey());
    const network = sdk.DecimalNetworks ? sdk.DecimalNetworks.mainnet : undefined;
    const evm = new sdk.DecimalEVM(wallet, network);
    if (typeof evm.connect === 'function') {
      try { await evm.connect(); } catch (error) { /* optional in browser build */ }
    }
    const p = prepared.params[0] || {};
    let txPayload;
    if (prepared.operationName === 'decimalSend') {
      txPayload = p.coin === 'DEL' && typeof evm.sendDEL === 'function'
        ? await evm.sendDEL({ to: p.to, amount: amountToWeiString(p.amount) })
        : await evm.transferToken({ to: p.to, coin: p.coin, amount: amountToWeiString(p.amount) });
    } else if (prepared.operationName === 'decimalDelegate') {
      txPayload = p.coin === 'DEL' && typeof evm.delegateDEL === 'function'
        ? await evm.delegateDEL(p.validator, BigInt(amountToWeiString(p.amount)))
        : await evm.delegateToken(p.validator, p.coin, BigInt(amountToWeiString(p.amount)));
    } else if (prepared.operationName === 'decimalUnbond') {
      const coinAddress = p.coin === 'DEL' ? '0x0000000000000000000000000000000000000000' : p.coin;
      txPayload = await evm.withdrawStakeToken(p.validator, coinAddress, amountToWeiString(p.amount));
    } else if (prepared.operationName === 'decimalCreateToken') {
      txPayload = await evm.createToken(p);
    } else if (prepared.operationName === 'decimalDelegateNFT') {
      txPayload = await evm.delegateNFT({ nftId: p.nftId, address: p.validator });
    } else if (prepared.operationName === 'decimalUnbondNFT') {
      txPayload = await evm.withdrawStakeNFT({ nftId: p.nftId, address: p.validator });
    } else {
      throw new Error(`Decimal operation ${prepared.operationName} is not implemented in v3 helper.`);
    }
    return typeof evm.broadcast === 'function' ? evm.broadcast(txPayload) : txPayload;
  }

  async function broadcast(chain, prepared, options) {
    const settings = Object.assign({ dryRun: false, confirmExecute: false }, options);

    if (settings.dryRun) {
      return {
        dryRun: true,
        message: 'Preview готов: операция не отправлена. Нажмите кнопку реальной отправки, чтобы выполнить broadcast.',
        operationName: prepared.operationName,
        authority: prepared.authority,
        params: prepared.params
      };
    }

    if (!settings.confirmExecute) {
      throw new Error('Реальный broadcast требует явного подтверждения в UI.');
    }

    const client = getClient(chain);
    const authorityCheck = await verifyPreparedAuthority(chain, prepared);
    if (authorityCheck.warnings.length) {
      prepared.meta.warnings = prepared.meta.warnings.concat(authorityCheck.warnings);
    }
    const key = prepared.getPrivateKey();

    if (chain.id === 'minter') return executeMinter(chain, prepared);
    if (chain.id === 'decimal') return executeDecimal(chain, prepared);

    if (prepared.operationName === 'sendOperations') {
      if (typeof client.broadcast.sendOperationsAsync === 'function') {
        return client.broadcast.sendOperationsAsync(prepared.params[0], key);
      }

      if (typeof client.broadcast.send === 'function') {
        return toCallbackPromise(client.broadcast.send, client.broadcast, [{ extensions: [], operations: prepared.params[0] }, [key]]);
      }
    }

    const method = client.broadcast[`${prepared.operationName}Async`];

    if (typeof method === 'function') {
      return method.call(client.broadcast, key, ...prepared.params);
    }

    if (typeof client.broadcast[prepared.operationName] === 'function') {
      return toCallbackPromise(client.broadcast[prepared.operationName], client.broadcast, [key, ...prepared.params]);
    }

    throw new Error(`Метод broadcast.${prepared.operationName} недоступен в ${chain.libraryGlobal}.`);
  }

  function sanitizeValue(value) {
    if (typeof value === 'string' && isLikelyWif(value)) {
      return '[redacted-wif]';
    }

    if (typeof value === 'string' && isLikelyMnemonic(value)) {
      return '[redacted-seed]';
    }

    if (Array.isArray(value)) {
      return value.map(sanitizeValue);
    }

    if (!value || typeof value !== 'object') {
      return value;
    }

    return Object.fromEntries(Object.entries(value).map(([key, item]) => {
      if (/private|wif|secret|seed|mnemonic/i.test(key)) {
        return [key, '[redacted]'];
      }

      return [key, sanitizeValue(item)];
    }));
  }

  function sanitizePrepared(prepared) {
    return {
      chain: prepared.chain,
      from: prepared.from,
      authority: prepared.authority,
      operationName: prepared.operationName,
      params: sanitizeValue(prepared.params),
      meta: sanitizeValue(prepared.meta)
    };
  }

  function sanitizeResult(value) {
    if (Array.isArray(value)) {
      return value.map(sanitizeResult);
    }

    if (!value || typeof value !== 'object') {
      return typeof value === 'string' && isLikelyWif(value) ? '[redacted-wif]' : value;
    }

    return sanitizeValue(value);
  }

  global.DposBroadcast = Object.freeze({
    broadcast,
    decryptLegacyKey,
    getAuthorityName,
    getAvailableKeys,
    derivePublicKey,
    isLikelyWif,
    prepare,
    prepareWithPrivateKey,
    sanitizePrepared,
    sanitizeResult,
    validateAccountName,
    validateAsset,
    validateRequestId,
    validateAddress,
    validateAmount,
    validateCoinSymbol,
    verifyPreparedAuthority
  });
})(window);
