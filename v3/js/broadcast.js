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
      throw new Error('Аккаунт не выбран. Откройте раздел «Аккаунты» и выберите сохранённый аккаунт.');
    }

    if (type === 'vizonator') {
      throw new Error('Vizonator-аккаунт найден, но приватный ключ из расширения недоступен. Для отправки выберите сохранённый аккаунт с локальным ключом.');
    }

    if (type === 'golos.app') {
      throw new Error('golos.app OAuth найден, но отправка через OAuth здесь недоступна. Выберите сохранённый аккаунт с локальным ключом.');
    }

    if ((chain.id === 'minter' || chain.id === 'decimal') && type === 'bip.to') {
      throw new Error('У подключённого BIP wallet аккаунта нет локального seed. Выберите аккаунт с seed для отправки.');
    }

    if (!encrypted) {
      throw new Error(`Для @${login} нет доступного ${authority}-ключа.`);
    }

    if (!global.sjcl || typeof global.sjcl.decrypt !== 'function') {
      throw new Error('Не удалось загрузить модуль расшифровки ключа.');
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
      if (!client) throw new Error('Библиотека для этой сети недоступна.');
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
    if (authority === 'regular') return account.regular_authority || account.regular || account.posting || null;
    if (authority === 'active') return account.active_authority || account.active || null;
    return account[authority] || account[`${authority}_authority`] || null;
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
        throw new Error('Расшифрованный seed/private key имеет неожиданный формат. Отправка остановлена.');
      }
      warnings.push('Для Minter/Decimal seed используется только в памяти; адрес и подпись формируются библиотекой перед отправкой.');
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
      decimal: /^(dx|0x)[0-9a-fA-F]{40}$|^d0[0-9a-z]{39}$/
    };
    if (!patterns[chain.id] || !patterns[chain.id].test(text)) {
      throw new Error(`${label || 'Address'} должен быть корректным ${chain.title} address.`);
    }
    return text;
  }

  function validateDecimalValidator(value, label) {
    const text = String(value || '').trim();
    if (!text) throw new Error(`${label || 'Валидатор'} is required.`);
    if (/^(dx|0x)[0-9a-fA-F]{40}$/.test(text)) return text;
    if (/^[A-Za-z0-9:_./+-]{8,128}$/.test(text)) return text;
    throw new Error(`${label || 'Валидатор'} должен быть non-empty Decimal validator id/address.`);
  }

  function validateCoinSymbol(value, label) {
    const text = String(value || '').trim().toUpperCase();
    if (!/^[A-Z][A-Z0-9]{1,14}$/.test(text)) {
      throw new Error(`${label || 'Монета'}: нужен coin/ticker symbol 2-15 A-Z/0-9.`);
    }
    return text;
  }

  function validateAmount(value, label) {
    const text = String(value || '').trim().replace(',', '.');
    if (!/^\d+(?:\.\d{1,18})?$/.test(text) || Number(text) <= 0) {
      throw new Error(`${label || 'Сумма'}: нужно положительное число.`);
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
      throw new Error('ID запроса должен быть целым неотрицательным числом.');
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
    if (chain.id === 'viz' && global.DposAuth.getUserType(user) === 'vizonator') {
      const login = global.DposAuth.getUserLogin(user);
      if (!login) throw new Error('Vizonator-аккаунт не выбран или расширение не вернуло login.');
      const authority = getAuthorityName(chain, requestedAuthority);
      return createPrepared(chain, login, authority, '', operationName, params, Object.assign({ signerType: 'vizonator', warnings: [
        'Операция будет отправлена через расширение Vizonator после отдельного подтверждения. Локальный WIF не используется.'
      ] }, meta || {}));
    }
    const keys = decryptLegacyKey(chain, user, requestedAuthority);
    return createPrepared(chain, keys.login, keys.authority, keys.privateKey, operationName, params, meta);
  }

  function prepareWithPrivateKey(chain, from, requestedAuthority, privateKey, operationName, params, meta) {
    const signer = validateAccountName(chain, from, 'Signer account');
    const key = String(privateKey || '').trim();
    if (!key) {
      throw new Error('Для этой invite/service операции нужен приватный WIF подписанта. Он используется только в памяти для broadcast и не сохраняется.');
    }
    const authority = getAuthorityName(chain, requestedAuthority);
    return createPrepared(chain, signer, authority, key, operationName, params, meta);
  }

  function prepareExternal(chain, operationName, params, meta) {
    return createPrepared(chain, 'external-signed-payload', 'signed-payload', '', operationName, params, Object.assign({ warnings: [
      'Операция использует уже подписанную транзакцию или внешние подписи; seed для этого не нужен.'
    ] }, meta || {}));
  }

  function amountToWeiString(amount) {
    const text = validateAmount(amount, 'Сумма');
    const [whole, frac = ''] = text.split('.');
    return `${whole}${frac.padEnd(18, '0')}`.replace(/^0+(?=\d)/, '');
  }

  function decimalToMinimalString(amount, label, allowZero) {
    const text = String(amount ?? '').trim().replace(',', '.');
    if (!/^\d+(?:\.\d{1,18})?$/.test(text) || (!allowZero && Number(text) <= 0)) {
      throw new Error(`${label || 'Сумма'}: нужно ${allowZero ? 'неотрицательное' : 'положительное'} число.`);
    }
    const [whole, frac = ''] = text.split('.');
    return `${whole}${frac.padEnd(18, '0')}`.replace(/^0+(?=\d)/, '') || '0';
  }

  async function executeMinter(chain, prepared) {
    const sdk = getClient(chain);
    const Minter = sdk.Minter;
    const txType = sdk.TX_TYPE || {};
    if (!Minter) throw new Error('Библиотека Minter недоступна.');
    const minter = new Minter({ apiType: 'node', baseURL: chain.apiBase || 'https://api.minter.one/v2' });

    if (prepared.operationName === 'minterSignedTx') {
      const signedTx = String((prepared.params[0] && prepared.params[0].tx) || '').trim();
      if (!signedTx) throw new Error('Нужна signed TX.');
      if (typeof minter.postSignedTx !== 'function') throw new Error('Отправка signed TX недоступна в загруженной библиотеке Minter.');
      return minter.postSignedTx(signedTx);
    }

    if (prepared.operationName === 'minterMultisigSubmit') {
      const payload = prepared.params[0] || {};
      if (!payload.multisig || !payload.tx || !Array.isArray(payload.signatures) || payload.signatures.length === 0) {
        throw new Error('Для multisig submit нужны адрес multisig, JSON транзакции и хотя бы одна подпись.');
      }
      if (typeof minter.getNonce === 'function') payload.tx.nonce = await minter.getNonce(payload.multisig);
      payload.tx.signatureType = 2;
      payload.tx.signatureData = { multisig: payload.multisig, signatures: payload.signatures };
      if (typeof minter.postTx !== 'function') throw new Error('Отправка multisig TX недоступна в загруженной библиотеке Minter.');
      return minter.postTx(payload.tx);
    }

    const tx = Object.assign({ chainId: 1, gasCoin: prepared.meta.gasCoin || prepared.meta.coin || 'BIP' }, prepared.params[0] || {});
    if (typeof minter.replaceCoinSymbol === 'function') {
      tx.type = tx.type || txType[prepared.meta.txType] || prepared.meta.txType;
      const idTx = await minter.replaceCoinSymbol(tx);
      return minter.postTx(idTx, { seedPhrase: prepared.getPrivateKey() });
    }
    throw new Error('Нужные методы Minter для отправки транзакции недоступны.');
  }

  function normalizeDecimalNftParams(params) {
    const collection = String(params.collection || params.nftCollection || params.contract || params.address || '').trim();
    const nftId = String(params.nftId || params.tokenId || params.id || '').trim();
    const validator = String(params.validator || params.address || '').trim();
    const rawAmount = String(params.amount || '1').trim().replace(',', '.');
    if (!/^\d+$/.test(rawAmount) || BigInt(rawAmount) <= 0n) throw new Error('Количество NFT должно быть положительным целым числом.');
    const amount = BigInt(rawAmount);
    if (!collection) throw new Error('Для Decimal NFT операции нужна коллекция / contract address NFT.');
    if (!/^0x[0-9a-fA-F]{40}$/.test(collection)) throw new Error('Decimal NFT collection должна быть EVM contract address 0x, а не названием коллекции. Выберите NFT из списка заново или вставьте адрес контракта коллекции.');
    if (!nftId) throw new Error('Для Decimal NFT операции нужен NFT ID.');
    if (!/^\d+$/.test(nftId)) throw new Error('Decimal NFT ID должен быть числовым tokenId, а не hash/id из API. Выберите NFT из списка заново после обновления страницы.');
    if (!validator) throw new Error('Для Decimal NFT операции нужен валидатор.');
    return { collection, nftId, validator, amount };
  }

  function isOnlyForNftTypeError(error, type) {
    return String(error && (error.message || error)).includes(`Only for ${type}`);
  }

  async function executeDecimal(chain, prepared) {
    const sdk = getClient(chain);
    if (!sdk.Wallet || !sdk.DecimalEVM) throw new Error('Библиотека Decimal недоступна.');
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
      const nft = normalizeDecimalNftParams(p);
      if (typeof evm.delegateDRC721 !== 'function' || typeof evm.delegateDRC1155 !== 'function') {
        throw new Error('Decimal SDK не поддерживает delegateDRC721/delegateDRC1155 в загруженной сборке.');
      }
      try {
        txPayload = await evm.delegateDRC721(nft.validator, nft.collection, nft.nftId);
      } catch (error) {
        if (!isOnlyForNftTypeError(error, 'DRC721')) throw error;
        txPayload = await evm.delegateDRC1155(nft.validator, nft.collection, nft.nftId, nft.amount);
      }
    } else if (prepared.operationName === 'decimalUnbondNFT') {
      const nft = normalizeDecimalNftParams(p);
      if (typeof evm.withdrawStakeNFT !== 'function') {
        throw new Error('Decimal SDK не поддерживает withdrawStakeNFT в загруженной сборке.');
      }
      txPayload = await evm.withdrawStakeNFT(nft.validator, nft.collection, nft.nftId, nft.amount);
    } else if (prepared.operationName === 'decimalConvert') {
      const isFromDEL = String(p.from || '').toUpperCase() === 'DEL';
      const isToDEL = String(p.to || '').toUpperCase() === 'DEL';
      if (isFromDEL && isToDEL) throw new Error('Decimal convert DEL → DEL is not valid.');
      const amountIn = typeof evm.parseUnits === 'function' ? evm.parseUnits(String(p.amount), Number(p.fromDecimals || 18)) : decimalToMinimalString(p.amount, 'Decimal convert amount');
      const amountOutMin = typeof evm.parseUnits === 'function' ? evm.parseUnits(String(p.minAmount || '0'), Number(p.toDecimals || 18)) : decimalToMinimalString(p.minAmount || '0', 'Минимальная сумма получения', true);
      const recipient = wallet.evmAddress || wallet.address;
      if (!isFromDEL && isToDEL) {
        if (typeof evm.sellExactTokensForDEL !== 'function') throw new Error('Продажа токена за DEL недоступна в загруженной библиотеке Decimal.');
        txPayload = await evm.sellExactTokensForDEL(p.from, amountIn, amountOutMin, recipient);
      } else if (isFromDEL && !isToDEL) {
        if (typeof evm.buyTokenForExactDEL !== 'function') throw new Error('Покупка токена за DEL недоступна в загруженной библиотеке Decimal.');
        txPayload = await evm.buyTokenForExactDEL(p.to, amountIn, amountOutMin, recipient);
      } else {
        if (typeof evm.convertToken !== 'function') throw new Error('Конвертация токенов недоступна в загруженной библиотеке Decimal.');
        txPayload = await evm.convertToken(p.from, p.to, amountIn, amountOutMin, recipient);
      }
    } else {
      throw new Error(`Операция Decimal ${prepared.operationName} пока недоступна.`);
    }
    return typeof evm.broadcast === 'function' ? evm.broadcast(txPayload) : txPayload;
  }

  async function executeVizonator(prepared) {
    const bridge = global.vizonator;
    if (!bridge) throw new Error('Расширение Vizonator не найдено: window.vizonator недоступен.');
    if (typeof bridge.get_account !== 'function') throw new Error('Vizonator bridge не поддерживает get_account.');
    const account = await toCallbackPromise(bridge.get_account, bridge, []);
    if (!account || account.login !== prepared.from) {
      throw new Error(`Vizonator авторизован как @${account && account.login ? account.login : 'unknown'}, а выбран аккаунт @${prepared.from}.`);
    }

    const [from, to, amount, memo] = prepared.params;
    const operationMap = {
      transfer: ['transfer', { to, amount, memo: memo || '', force_memo_encoding: false }],
      transferToVesting: ['transfer_to_vesting', { to, amount }],
      withdrawVesting: ['withdraw_vesting', { vesting_shares: prepared.params[1] }],
      delegateVestingShares: ['delegate_vesting_shares', { delegatee: prepared.params[1], vesting_shares: prepared.params[2] }],
      award: ['award', {
        receiver: prepared.params[1],
        energy: prepared.params[2],
        custom_sequence: prepared.params[3],
        memo: prepared.params[4] || '',
        beneficiaries: JSON.stringify(prepared.params[5] || [])
      }],
      fixedAward: ['fixed_award', {
        receiver: prepared.params[1],
        reward_amount: prepared.params[2],
        energy: prepared.params[3],
        custom_sequence: prepared.params[4],
        memo: prepared.params[5] || '',
        beneficiaries: JSON.stringify(prepared.params[6] || [])
      }],
      custom: ['custom', { protocol_id: prepared.params[1], json: prepared.params[2] }],
      committeeVoteRequest: ['committee_vote_request', { request_id: prepared.params[1], vote_percent: prepared.params[2] }]
    };
    const mapped = operationMap[prepared.operationName];
    if (!mapped) {
      throw new Error(`Vizonator не поддерживает операцию ${prepared.operationName}. Выберите аккаунт с локальным ключом для этой операции.`);
    }
    const method = bridge[mapped[0]];
    if (typeof method !== 'function') throw new Error(`Vizonator bridge не поддерживает метод ${mapped[0]}.`);
    return toCallbackPromise(method, bridge, [mapped[1]]);
  }

  async function broadcast(chain, prepared, options) {
    const settings = Object.assign({ dryRun: false, confirmExecute: false }, options);

    if (settings.dryRun) {
      return {
        dryRun: true,
        message: 'Проверка готова: операция не отправлена. Нажмите кнопку отправки в сеть, чтобы выполнить её.',
        operationName: prepared.operationName,
        authority: prepared.authority,
        params: prepared.params
      };
    }

    if (!settings.confirmExecute) {
      throw new Error('Реальный broadcast требует явного подтверждения в UI.');
    }

    if (chain.id === 'viz' && prepared.meta && prepared.meta.signerType === 'vizonator') {
      return executeVizonator(prepared);
    }

    const client = getClient(chain);
    if (chain.id === 'minter' && (prepared.operationName === 'minterSignedTx' || prepared.operationName === 'minterMultisigSubmit')) {
      return executeMinter(chain, prepared);
    }
    if (chain.id === 'minter') return executeMinter(chain, prepared);
    if (chain.id === 'decimal') return executeDecimal(chain, prepared);

    if (prepared.operationName === 'broadcastTransactionSynchronous') {
      const tx = prepared.params[0];
      if (!tx || typeof tx !== 'object') throw new Error('Signed transaction JSON обязателен.');
      if (typeof client.api.broadcastTransactionSynchronousAsync === 'function') {
        return client.api.broadcastTransactionSynchronousAsync(tx);
      }
      if (typeof client.api.broadcastTransactionSynchronous === 'function') {
        return toCallbackPromise(client.api.broadcastTransactionSynchronous, client.api, [tx]);
      }
      if (typeof client.broadcast.send === 'function') {
        return toCallbackPromise(client.broadcast.send, client.broadcast, [tx]);
      }
      throw new Error(`Метод broadcastTransactionSynchronous недоступен в ${chain.libraryGlobal}.`);
    }

    const authorityCheck = await verifyPreparedAuthority(chain, prepared);
    if (authorityCheck.warnings.length) {
      prepared.meta.warnings = prepared.meta.warnings.concat(authorityCheck.warnings);
    }
    const key = prepared.getPrivateKey();

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
    prepareExternal,
    prepareWithPrivateKey,
    sanitizePrepared,
    sanitizeResult,
    validateAccountName,
    validateAsset,
    validateRequestId,
    validateAddress,
    validateDecimalValidator,
    validateAmount,
    validateCoinSymbol,
    verifyPreparedAuthority
  });
})(window);
