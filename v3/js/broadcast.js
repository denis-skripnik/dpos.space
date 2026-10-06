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
    return Boolean(global.DposBip39 && global.DposBip39.isValidMnemonic(value));
  }

  const EMBEDDED_WIF_PATTERN = /5[1-9A-HJ-NP-Za-km-z]{45,55}/g;
  const EMBEDDED_JSON_CREDENTIAL_PATTERN = /("(?:private(?:key)?|wif|secret|seed(?:phrase)?|mnemonic|password|passphrase|credential(?:s)?|api[_-]?(?:key|token)|access[_-]?token|auth[_-]?token|bearer|authorization)"\s*:\s*)"(?:\\.|[^"\\])*"/gi;
  const SENSITIVE_FIELD_PATTERN = /(?:^|_)(?:private(?:key)?|wif|secret|seed(?:phrase)?|mnemonic|password|passphrase|credential|api[_-]?key|access[_-]?token|auth[_-]?token|bearer)(?:$|_)/i;
  const INLINE_CREDENTIAL_PATTERN = /(\b(?:password|passphrase|api[_ -]?(?:key|token)|access[_ -]?token|auth[_ -]?token|credential)\s*[:=]\s*)(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[^\s,;]+)/gi;
  const BEARER_PATTERN = /(\bBearer\s+)[a-z0-9._~+\/-]+=*/gi;
  const SENSITIVE_FIELD_NAMES = new Set([
    'private', 'privatekey', 'wif', 'secret', 'seed', 'seedphrase', 'mnemonic',
    'password', 'passphrase', 'credential', 'credentials', 'apikey', 'apitoken',
    'accesstoken', 'authtoken', 'bearer', 'authorization'
  ]);
  const SENSITIVE_FIELD_SUFFIX_PATTERN = /(?:privatekey|wif|secret|seedphrase|mnemonic|password|passphrase|credentials?|apikey|apitoken|accesstoken|authtoken|bearer|authorization)$/;

  function redactDiagnosticString(value) {
    const text = String(value);
    const trimmed = text.trim();
    if (/^[{[]/.test(trimmed)) {
      try {
        return JSON.stringify(sanitizeDiagnostic(JSON.parse(trimmed)));
      } catch (error) {
        // Keep malformed RPC text useful and apply inline redaction below.
      }
    }
    if (isLikelyWif(trimmed)) return '[redacted-wif]';
    if (isLikelyMnemonic(trimmed)) return '[redacted-seed]';
    let redacted = text
      .replace(EMBEDDED_WIF_PATTERN, '[redacted-wif]')
      .replace(INLINE_CREDENTIAL_PATTERN, '$1[redacted]')
      .replace(BEARER_PATTERN, '$1[redacted]')
      .replace(EMBEDDED_JSON_CREDENTIAL_PATTERN, '$1"[redacted]"');
    const ranges = global.DposBip39 ? global.DposBip39.findMnemonicRanges(redacted) : [];
    for (let index = ranges.length - 1; index >= 0; index -= 1) {
      const range = ranges[index];
      redacted = `${redacted.slice(0, range.start)}[redacted-seed]${redacted.slice(range.end)}`;
    }
    return redacted;
  }

  function shouldRedactField(key, value) {
    const field = String(key);
    const normalized = field.replace(/[^a-z0-9]/gi, '').toLowerCase();
    if (/private|wif|secret|seed|mnemonic|password|passphrase|credential/i.test(field) || SENSITIVE_FIELD_PATTERN.test(field) || SENSITIVE_FIELD_NAMES.has(normalized) || SENSITIVE_FIELD_SUFFIX_PATTERN.test(normalized)) return true;
    if (!/^token$/i.test(field)) return false;
    const text = String(value || '').trim();
    return text.length > 24 && !/^(?:0x|dx)[0-9a-f]{40}$/i.test(text);
  }

  function sanitizeDiagnostic(value, seen) {
    if (typeof value === 'string') return redactDiagnosticString(value);
    if (!value || typeof value !== 'object') return value;
    const visited = seen || new WeakSet();
    if (visited.has(value)) return '[circular]';
    visited.add(value);
    if (Array.isArray(value)) return value.map((item) => sanitizeDiagnostic(item, visited));
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [
      key,
      shouldRedactField(key, item) ? '[redacted]' : sanitizeDiagnostic(item, visited)
    ]));
  }

  function containsSecret(value) {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (value.match(INLINE_CREDENTIAL_PATTERN) || value.match(BEARER_PATTERN)) return true;
      if (isLikelyWif(trimmed) || EMBEDDED_WIF_PATTERN.test(value)) {
        EMBEDDED_WIF_PATTERN.lastIndex = 0;
        return true;
      }
      EMBEDDED_WIF_PATTERN.lastIndex = 0;
      if (isLikelyMnemonic(trimmed)) return true;
      if (global.DposBip39 && global.DposBip39.findMnemonicRanges(value).length) return true;
      if (EMBEDDED_JSON_CREDENTIAL_PATTERN.test(value)) {
        EMBEDDED_JSON_CREDENTIAL_PATTERN.lastIndex = 0;
        return true;
      }
      EMBEDDED_JSON_CREDENTIAL_PATTERN.lastIndex = 0;
      if (/^[{[]/.test(trimmed)) {
        try { return containsSecret(JSON.parse(trimmed)); } catch (error) { return false; }
      }
      return false;
    }
    if (Array.isArray(value)) return value.some(containsSecret);
    if (!value || typeof value !== 'object') return false;
    return Object.entries(value).some(([key, item]) => shouldRedactField(key, item) || containsSecret(item));
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


  function hasValidBech32Checksum(value, expectedHrp) {
    const text = String(value || '');
    if (!text || text !== text.toLowerCase() || text.length > 90) return false;
    const separator = text.lastIndexOf('1');
    if (separator < 1 || separator + 7 > text.length) return false;
    const hrp = text.slice(0, separator);
    if (hrp !== expectedHrp) return false;
    const charset = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
    const values = [];
    for (let i = 0; i < hrp.length; i += 1) values.push(hrp.charCodeAt(i) >> 5);
    values.push(0);
    for (let i = 0; i < hrp.length; i += 1) values.push(hrp.charCodeAt(i) & 31);
    for (const character of text.slice(separator + 1)) {
      const index = charset.indexOf(character);
      if (index < 0) return false;
      values.push(index);
    }
    let checksum = 1;
    for (const value of values) {
      const top = checksum >>> 25;
      checksum = ((checksum & 0x1ffffff) << 5) ^ value;
      if (top & 1) checksum ^= 0x3b6a57b2;
      if (top & 2) checksum ^= 0x26508e6d;
      if (top & 4) checksum ^= 0x1ea119fa;
      if (top & 8) checksum ^= 0x3d4233dd;
      if (top & 16) checksum ^= 0x2a1462b3;
    }
    return checksum === 1;
  }

  function decimalBech32ToEvmAddress(value, expectedHrp) {
    const text = String(value || '').trim();
    if (!hasValidBech32Checksum(text, expectedHrp)) return '';
    const charset = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
    const separator = text.lastIndexOf('1');
    const words = Array.from(text.slice(separator + 1, -6), (character) => charset.indexOf(character));
    const bytes = [];
    let accumulator = 0;
    let bits = 0;
    for (const word of words) {
      accumulator = (accumulator << 5) | word;
      bits += 5;
      while (bits >= 8) {
        bits -= 8;
        bytes.push((accumulator >> bits) & 0xff);
      }
    }
    if (bytes.length !== 20 || (bits > 0 && ((accumulator << (8 - bits)) & 0xff) !== 0)) return '';
    return `0x${bytes.map((byte) => byte.toString(16).padStart(2, '0')).join('')}`;
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
    if (chain.id === 'decimal' && /^d0/.test(text)) {
      if (!hasValidBech32Checksum(text, 'd0')) {
        throw new Error(`${label || 'Address'} должен иметь корректную Decimal checksum.`);
      }
    }
    return text;
  }

  function validateDecimalValidator(value, label) {
    const text = String(value || '').trim();
    if (!text) throw new Error(`${label || 'Валидатор'} is required.`);
    if (/^(dx|0x)[0-9a-fA-F]{40}$/.test(text)) return text;
    if (/^d0valoper[0-9a-z]+$/.test(text) && hasValidBech32Checksum(text, 'd0valoper')) return text;
    throw new Error(`${label || 'Валидатор'} должен быть EVM address или корректным d0valoper address.`);
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
    const publicPayload = publicPayloadFor(prepared);
    if (publicPayload !== null && publicPayload !== undefined && containsSecret(publicPayload)) {
      warnings.push('В публичных параметрах операции обнаружен возможный секрет (WIF/seed/credential). Проверьте memo/custom payload: реальная отправка будет остановлена.');
    }
    if (/memo/i.test(text) && text.length > 2048) {
      warnings.push('Memo/JSON выглядит длинным: проверьте, что это не приватные данные.');
    }
    return warnings;
  }

  function publicPayloadFor(prepared) {
    const params = prepared && prepared.params || [];
    if (prepared.operationName === 'transfer') return params[3];
    if (prepared.operationName === 'award') return params[4];
    if (prepared.operationName === 'fixedAward') return params[5];
    if (prepared.operationName === 'custom') return params[2];
    if (prepared.operationName === 'sendOperations') {
      return (params[0] || []).map((operation) => operation && operation[1] && {
        memo: operation[1].memo,
        json: operation[1].json,
        json_metadata: operation[1].json_metadata,
        posting_json_metadata: operation[1].posting_json_metadata,
        body: operation[1].body
      });
    }
    return null;
  }

  function assertNoPublicSecrets(prepared) {
    const payload = publicPayloadFor(prepared || {});
    if (payload !== null && payload !== undefined && containsSecret(payload)) {
      throw new Error('Отправка остановлена: публичный memo/custom payload содержит возможный секрет (WIF/seed/credential). Удалите секрет и повторите проверку.');
    }
  }

  function vizAwardBeneficiaries(rows) {
    if (!Array.isArray(rows)) throw new Error('JSON beneficiaries должен быть массивом.');
    const result = rows.map(row => ({ account: validateAccountName({ id: 'viz' }, row.account, 'Бенефициар'), weight: Number(row.weight) }));
    if (result.some(row => !Number.isInteger(row.weight) || row.weight <= 0) || new Set(result.map(row => row.account)).size !== result.length) {
      throw new Error('Бенефициары должны быть уникальными, с положительным целым весом.');
    }
    const service = result.find(row => row.account === 'denis-skripnik');
    if (service) service.weight = Math.max(100, service.weight);
    else result.push({ account: 'denis-skripnik', weight: 100 });
    if (result.reduce((sum, row) => sum + row.weight, 0) > 10000) throw new Error('Суммарный вес beneficiaries не должен превышать 100%.');
    return result.sort((a, b) => a.account < b.account ? -1 : a.account > b.account ? 1 : 0);
  }

  function createPrepared(chain, from, authority, privateKey, operationName, params, meta, guard) {
    const vizAward = chain.id === 'viz' && (operationName === 'award' || operationName === 'fixedAward');
    if (vizAward) {
      params = params.slice();
      const index = operationName === 'award' ? 5 : 6;
      params[index] = vizAwardBeneficiaries(params[index] || []);
    }
    const prepared = {
      chain: chain.id,
      from,
      authority,
      operationName,
      params,
      meta: Object.assign({ warnings: [] }, meta || {})
    };
    prepared.meta.warnings = prepared.meta.warnings.concat(operationWarnings(prepared));
    if (vizAward) prepared.meta.warnings.push('Бенефициарские отчисления сервису: 1% награды — @denis-skripnik (включены в список бенефициаров).');

    Object.defineProperty(prepared, 'getPrivateKey', {
      enumerable: false,
      value() {
        if (guard && global.DposVault) global.DposVault.assertGuard(guard);
        return privateKey;
      }
    });
    Object.defineProperty(prepared, 'assertValid', {
      enumerable: false,
      value() {
        if (guard && global.DposVault) global.DposVault.assertGuard(guard);
        return true;
      }
    });

    return prepared;
  }

  function prepare(chain, requestedAuthority, operationName, params, meta) {
    const user = global.DposAuth.getCurrentUser(chain);
    const guard = global.DposVault && global.DposVault.status().state === 'unlocked' ? global.DposVault.issueGuard(chain, user) : null;
    if (chain.id === 'viz' && global.DposAuth.getUserType(user) === 'vizonator') {
      const login = global.DposAuth.getUserLogin(user);
      if (!login) throw new Error('Vizonator-аккаунт не выбран или расширение не вернуло login.');
      const authority = getAuthorityName(chain, requestedAuthority);
      return createPrepared(chain, login, authority, '', operationName, params, Object.assign({ signerType: 'vizonator', warnings: [
        'Операция будет отправлена через расширение Vizonator после отдельного подтверждения. Локальный WIF не используется.'
      ] }, meta || {}), guard);
    }
    const keys = decryptLegacyKey(chain, user, requestedAuthority);
    return createPrepared(chain, keys.login, keys.authority, keys.privateKey, operationName, params, meta, guard);
  }

  function prepareForUser(chain, user, requestedAuthority, operationName, params, meta) {
    const keys = decryptLegacyKey(chain, user, requestedAuthority);
    const guard = global.DposVault && global.DposVault.status().state === 'unlocked' ? global.DposVault.issueGuard(chain, user) : null;
    return createPrepared(chain, keys.login, keys.authority, keys.privateKey, operationName, params, meta, guard);
  }

  function prepareWithPrivateKey(chain, from, requestedAuthority, privateKey, operationName, params, meta) {
    const signer = validateAccountName(chain, from, 'Signer account');
    const key = String(privateKey || '').trim();
    if (!key) {
      throw new Error('Для этой invite/service операции нужен приватный WIF подписанта. Он используется только в памяти для broadcast и не сохраняется.');
    }
    const authority = getAuthorityName(chain, requestedAuthority);
    let guard = null;
    if (global.DposVault) {
      const vaultStatus = global.DposVault.status().state;
      if (vaultStatus === 'locked' || vaultStatus === 'error') {
        throw new Error('Vault заблокирован. Разблокируйте его перед подготовкой приватного ключа.');
      }
      if (vaultStatus === 'unlocked') guard = global.DposVault.issueGuard();
    }
    return createPrepared(chain, signer, authority, key, operationName, params, meta, guard);
  }

  function prepareExternal(chain, operationName, params, meta) {
    return createPrepared(chain, 'external-signed-payload', 'signed-payload', '', operationName, params, Object.assign({ warnings: [
      'Операция использует уже подписанную транзакцию или внешние подписи; seed для этого не нужен.'
    ] }, meta || {}));
  }

  function amountToWeiString(amount) {
    return amountToDecimalUnitsString(amount, 18, 'Сумма');
  }

  function amountToDecimalUnitsString(amount, decimals, label, allowZero = false) {
    const raw = String(amount ?? '').trim().replace(',', '.');
    const text = allowZero && /^0+(?:\.0+)?$/.test(raw) ? raw : validateAmount(amount, label || 'Сумма');
    const precision = Number(decimals);
    if (!Number.isSafeInteger(precision) || precision < 0 || precision > 255) {
      throw new Error('Decimal token precision is unavailable or invalid.');
    }
    const [whole, frac = ''] = text.split('.');
    if (frac.length > precision) {
      throw new Error(`${label || 'Сумма'} превышает precision токена: максимум ${precision} знаков после точки.`);
    }
    return `${whole}${frac.padEnd(precision, '0')}`.replace(/^0+(?=\d)/, '') || '0';
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

  function toDecimalEvmAddress(sdk, value, label) {
    const address = String(value || '').trim();
    if (/^0x[0-9a-fA-F]{40}$/.test(address)) return address;
    if (/^dx[0-9a-fA-F]{40}$/.test(address)) return `0x${address.slice(2)}`;
    if (/^d0[0-9a-z]{39}$/.test(address)) {
      if (!hasValidBech32Checksum(address, 'd0') || (typeof sdk.verifyAddress === 'function' && !sdk.verifyAddress(address, 'd0'))) {
        throw new Error(`${label || 'Decimal address'} содержит некорректную checksum.`);
      }
      const decoded = decimalBech32ToEvmAddress(address, 'd0');
      if (decoded) return decoded;
    }
    throw new Error(`${label || 'Decimal address'} должен преобразовываться в EVM address 0x.`);
  }

  function toDecimalValidatorEvmAddress(sdk, value) {
    const address = String(value || '').trim();
    if (/^0x[0-9a-fA-F]{40}$/.test(address)) return address;
    if (/^dx[0-9a-fA-F]{40}$/.test(address)) return `0x${address.slice(2)}`;
    if (/^d0valoper[0-9a-z]+$/.test(address)) {
      if (typeof sdk.verifyAddress === 'function' && !sdk.verifyAddress(address, 'd0valoper')) {
        throw new Error('Decimal validator содержит некорректную checksum.');
      }
      const decoded = decimalBech32ToEvmAddress(address, 'd0valoper');
      if (decoded) return decoded;
    }
    throw new Error('Decimal validator должен преобразовываться в EVM address 0x.');
  }

  async function resolveDecimalToken(evm, sdk, coin) {
    const value = String(coin || '').trim();
    let address = value;
    if (!/^(0x|dx)[0-9a-fA-F]{40}$/.test(value)) {
      const symbol = validateCoinSymbol(value, 'Decimal token');
      if (typeof evm.getAddressTokenBySymbol !== 'function') {
        throw new Error('Decimal SDK не поддерживает поиск token contract по ticker.');
      }
      const found = await evm.getAddressTokenBySymbol(symbol);
      address = found && typeof found === 'object' ? (found.address || found.token || found.contract) : found;
    }
    const tokenAddress = toDecimalEvmAddress(sdk, address, 'Decimal token contract');
    if (/^0x0{40}$/i.test(tokenAddress)) throw new Error(`Decimal token ${value || '[пусто]'} не найден.`);
    if (typeof evm.getContract !== 'function') throw new Error('Decimal SDK не позволяет проверить precision токена.');
    const token = await evm.getContract(tokenAddress, evm.abis && evm.abis.token);
    const contract = token && (token.contract || token);
    if (!contract || typeof contract.decimals !== 'function') {
      throw new Error('Decimal token contract не сообщает precision; отправка остановлена.');
    }
    const decimals = Number(String(await contract.decimals()));
    if (!Number.isSafeInteger(decimals) || decimals < 0 || decimals > 255) {
      throw new Error('Decimal token contract вернул некорректную precision.');
    }
    return { address: tokenAddress, decimals };
  }

  async function executeDecimal(chain, prepared) {
    const sdk = getClient(chain);
    if (!sdk.Wallet || !sdk.DecimalEVM) throw new Error('Библиотека Decimal недоступна.');
    const wallet = new sdk.Wallet(prepared.getPrivateKey());
    const networkId = chain.network === 'testnet' ? 'testnet' : 'mainnet';
    const network = sdk.DecimalNetworks ? sdk.DecimalNetworks[networkId] : undefined;
    const evm = new sdk.DecimalEVM(wallet, network);
    // SDK methods initialize their own contract pack; native DEL needs none.
    const p = prepared.params[0] || {};
    const validator = /^decimal(?:Delegate|Unbond)/.test(prepared.operationName)
      ? toDecimalValidatorEvmAddress(sdk, p.validator)
      : '';
    let txPayload;
    if (prepared.operationName === 'decimalSend') {
      const recipient = toDecimalEvmAddress(sdk, p.to, 'Получатель');
      if (String(p.coin || '').toUpperCase() === 'DEL') {
        if (typeof evm.sendDEL !== 'function') throw new Error('Decimal SDK не поддерживает sendDEL.');
        txPayload = await evm.sendDEL(recipient, amountToWeiString(p.amount));
      } else {
        if (typeof evm.transferToken !== 'function') throw new Error('Decimal SDK не поддерживает transferToken.');
        const token = await resolveDecimalToken(evm, sdk, p.coin);
        const amount = amountToDecimalUnitsString(p.amount, token.decimals, 'Сумма');
        txPayload = await evm.transferToken(token.address, recipient, amount);
      }
    } else if (prepared.operationName === 'decimalDelegate') {
      if (String(p.coin || '').toUpperCase() === 'DEL') {
        if (typeof evm.delegateDEL !== 'function') throw new Error('Decimal SDK не поддерживает delegateDEL.');
        txPayload = await evm.delegateDEL(validator, amountToWeiString(p.amount));
      } else {
        if (typeof evm.delegateToken !== 'function' || typeof evm.getSignPermitToken !== 'function' || typeof evm.getDecimalContractAddress !== 'function') {
          throw new Error('Decimal SDK не поддерживает безопасную token delegation через permit.');
        }
        const token = await resolveDecimalToken(evm, sdk, p.coin);
        const amount = amountToDecimalUnitsString(p.amount, token.decimals, 'Stake');
        const delegation = await evm.getDecimalContractAddress('delegation');
        const sign = await evm.getSignPermitToken(token.address, delegation, amount);
        txPayload = await evm.delegateToken(validator, token.address, amount, sign);
      }
    } else if (prepared.operationName === 'decimalUnbond') {
      if (typeof evm.withdrawStakeToken !== 'function') throw new Error('Decimal SDK не поддерживает withdrawStakeToken.');
      if (String(p.coin || '').toUpperCase() === 'DEL') {
        txPayload = await evm.withdrawStakeToken(validator, '0x0000000000000000000000000000000000000000', amountToWeiString(p.amount));
      } else {
        const token = await resolveDecimalToken(evm, sdk, p.coin);
        txPayload = await evm.withdrawStakeToken(validator, token.address, amountToDecimalUnitsString(p.amount, token.decimals, 'Stake'));
      }
    } else if (prepared.operationName === 'decimalCreateToken') {
      if (typeof evm.createTokenReserveless !== 'function') throw new Error('Decimal SDK не поддерживает createTokenReserveless.');
      const name = String(p.title || p.name || '').trim();
      if (!name) throw new Error('Название Decimal token обязательно.');
      const symbol = validateCoinSymbol(p.symbol, 'Symbol');
      const initialMint = amountToWeiString(p.initSupply);
      const cap = amountToWeiString(p.maxSupply);
      if (BigInt(cap) < BigInt(initialMint)) throw new Error('Максимальная эмиссия не может быть меньше начальной.');
      txPayload = await evm.createTokenReserveless(name, symbol, true, true, initialMint, cap, '');
    } else if (prepared.operationName === 'decimalDelegateNFT') {
      const nft = normalizeDecimalNftParams(p);
      if (typeof evm.delegateDRC721 !== 'function' || typeof evm.delegateDRC1155 !== 'function' || typeof evm.getDecimalContractAddress !== 'function') {
        throw new Error('Decimal SDK не поддерживает Decimal NFT delegation.');
      }
      const delegation = await evm.getDecimalContractAddress('delegation-nft');
      try {
        if (typeof evm.getSignPermitDRC721 !== 'function') throw new Error('Decimal SDK не поддерживает DRC721 permit.');
        const sign = await evm.getSignPermitDRC721(nft.collection, delegation, nft.nftId);
        txPayload = await evm.delegateDRC721(validator, nft.collection, nft.nftId, sign);
      } catch (error) {
        if (!isOnlyForNftTypeError(error, 'DRC721')) throw error;
        if (typeof evm.getSignPermitDRC1155 !== 'function') throw new Error('Decimal SDK не поддерживает DRC1155 permit.');
        const sign = await evm.getSignPermitDRC1155(nft.collection, delegation);
        txPayload = await evm.delegateDRC1155(validator, nft.collection, nft.nftId, nft.amount, sign);
      }
    } else if (prepared.operationName === 'decimalUnbondNFT') {
      const nft = normalizeDecimalNftParams(p);
      if (typeof evm.withdrawStakeNFT !== 'function') {
        throw new Error('Decimal SDK не поддерживает withdrawStakeNFT в загруженной сборке.');
      }
      txPayload = await evm.withdrawStakeNFT(validator, nft.collection, nft.nftId, nft.amount);
    } else if (prepared.operationName === 'decimalConvert') {
      const isFromDEL = String(p.from || '').toUpperCase() === 'DEL';
      const isToDEL = String(p.to || '').toUpperCase() === 'DEL';
      if (isFromDEL && isToDEL) throw new Error('Decimal convert DEL → DEL is not valid.');
      const fromToken = isFromDEL ? null : await resolveDecimalToken(evm, sdk, p.from);
      const toToken = isToDEL ? null : await resolveDecimalToken(evm, sdk, p.to);
      const amountIn = amountToDecimalUnitsString(p.amount, fromToken ? fromToken.decimals : 18, 'Decimal convert amount');
      const amountOutMin = amountToDecimalUnitsString(p.minAmount || '0', toToken ? toToken.decimals : 18, 'Минимальная сумма получения', true);
      const recipient = wallet.evmAddress;
      if (!/^0x[0-9a-fA-F]{40}$/.test(String(recipient || ''))) throw new Error('Decimal wallet не предоставил EVM recipient address.');
      if (!isFromDEL && isToDEL) {
        if (typeof evm.sellExactTokensForDEL !== 'function') throw new Error('Продажа токена за DEL недоступна в загруженной библиотеке Decimal.');
        txPayload = await evm.sellExactTokensForDEL(fromToken.address, amountIn, amountOutMin, recipient);
      } else if (isFromDEL && !isToDEL) {
        if (typeof evm.buyTokenForExactDEL !== 'function') throw new Error('Покупка токена за DEL недоступна в загруженной библиотеке Decimal.');
        txPayload = await evm.buyTokenForExactDEL(toToken.address, amountIn, amountOutMin, recipient);
      } else {
        if (typeof evm.convertToken !== 'function' || typeof evm.getSignPermitToken !== 'function' || typeof evm.getDecimalContractAddress !== 'function') {
          throw new Error('Конвертация токенов через permit недоступна в загруженной библиотеке Decimal.');
        }
        const tokenCenter = await evm.getDecimalContractAddress('token-center');
        const sign = await evm.getSignPermitToken(fromToken.address, tokenCenter, amountIn);
        txPayload = await evm.convertToken(fromToken.address, toToken.address, amountIn, amountOutMin, recipient, sign);
      }
    } else {
      throw new Error(`Операция Decimal ${prepared.operationName} пока недоступна.`);
    }
    return txPayload;
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

  function configureGrapheneNode(chain, client, nodeUrl) {
    if (!nodeUrl || !client) return false;
    if (client.api && typeof client.api.stop === 'function') {
      try { client.api.stop(); } catch (error) { /* optional */ }
    }
    if (client.config && typeof client.config.set === 'function') {
      client.config.set('websocket', nodeUrl);
      if (global.localStorage && chain && chain.id) global.localStorage.setItem(`${chain.id}_node`, nodeUrl);
      return true;
    }
    if (client.api && typeof client.api.setOptions === 'function') {
      client.api.setOptions({ url: nodeUrl });
      if (global.localStorage && chain && chain.id) global.localStorage.setItem(`${chain.id}_node`, nodeUrl);
      return true;
    }
    return false;
  }

  function isStoppedNodeBroadcastError(error) {
    const message = String(error && (error.message || error) || '');
    return /node is stopped|cannot broadcast/i.test(message);
  }

  function alternateGrapheneNodes(chain) {
    const nodes = Array.isArray(chain && chain.nodes) ? chain.nodes.filter(Boolean) : [];
    if (!nodes.length) return [];
    const stored = global.localStorage && chain && chain.id ? global.localStorage.getItem(`${chain.id}_node`) : '';
    const current = String((stored || '')).replace(/\/$/, '');
    const normalized = nodes.map((nodeUrl) => String(nodeUrl).replace(/\/$/, ''));
    const index = normalized.indexOf(current);
    if (index >= 0) return nodes.slice(index + 1).concat(nodes.slice(0, index));
    return nodes;
  }

  async function retryStoppedNodeBroadcast(chain, client, operationFn, originalError) {
    if (!isStoppedNodeBroadcastError(originalError)) throw originalError;
    for (const nodeUrl of alternateGrapheneNodes(chain)) {
      try {
        if (!configureGrapheneNode(chain, client, nodeUrl)) continue;
        return await operationFn();
      } catch (error) {
        if (!isStoppedNodeBroadcastError(error)) throw error;
      }
    }
    throw originalError;
  }

  async function broadcast(chain, prepared, options) {
    if (prepared && typeof prepared.assertValid === 'function') prepared.assertValid();
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

    const autoConsentAllowed = (
      settings.autoConsent === 'golos-auto-upvoter-start' && prepared.meta && prepared.meta.feature === 'golos-auto-upvoter'
    ) || (
      settings.autoConsent === 'viz-self-award-start' && prepared.meta && prepared.meta.feature === 'viz-self-award'
    );
    if (!settings.confirmExecute && !autoConsentAllowed) {
      throw new Error('Реальный broadcast требует явного подтверждения в UI.');
    }

    assertNoPublicSecrets(prepared);

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
      const operationFn = () => {
        if (typeof client.broadcast.sendOperationsAsync === 'function') {
          return client.broadcast.sendOperationsAsync(prepared.params[0], key);
        }

        if (typeof client.broadcast.send === 'function') {
          return toCallbackPromise(client.broadcast.send, client.broadcast, [{ extensions: [], operations: prepared.params[0] }, [key]]);
        }
        throw new Error(`Метод broadcast.${prepared.operationName} недоступен в ${chain.libraryGlobal}.`);
      };
      try {
        return await operationFn();
      } catch (error) {
        return retryStoppedNodeBroadcast(chain, client, operationFn, error);
      }
    }

    if (chain.id === 'viz' && prepared.operationName === 'setAgentPermission') {
      const names = ['account', 'agent_name', 'agent_key', 'operations', 'expiration', 'addons', 'extensions'];
      const permission = Object.fromEntries(names.map((name, index) => [name, prepared.params[index]]));
      if (prepared.authority !== 'active' || permission.account !== prepared.from) throw new Error('VIZ agent permission требует active authority выбранного аккаунта.');
      const tx = await client.broadcast._prepareTransaction({ extensions: [], operations: [['set_agent_permission', permission]] });
      // Limited grants must not turn into evaluator revocations during async preparation.
      // Keep the captured permission deadline unchanged; only shorten transaction validity.
      const limited = permission.expiration !== '1970-01-01T00:00:00' && (permission.operations.length || permission.addons.length);
      if (limited) {
        const parseUtc = value => {
          if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(value)) return NaN;
          const time = Date.parse(`${value}Z`);
          return Number.isFinite(time) && new Date(time).toISOString().slice(0, 19) === value ? time : NaN;
        };
        const properties = await client.api.getDynamicGlobalPropertiesAsync();
        const deadline = parseUtc(permission.expiration);
        const head = parseUtc(properties && properties.time);
        // SDK TAPOS uses a Date, while protocol permission/head timestamps are strings.
        // Date.prototype accepts valid dates from the SDK's realm without coercing inputs.
        const sdkExpiration = Object.prototype.toString.call(tx.expiration) === '[object Date]'
          ? Date.prototype.getTime.call(tx.expiration) : parseUtc(tx.expiration);
        const expiration = Math.floor(Math.min(sdkExpiration, deadline - 1000) / 1000) * 1000;
        const now = Date.now();
        if (![deadline, head, expiration, now].every(Number.isFinite) || deadline <= Math.max(head, now) || expiration <= Math.max(head, now)) {
          throw new Error('Срок разрешения истёк или безопасный срок транзакции недоступен. Проверьте дату UTC заново.');
        }
        tx.expiration = new Date(expiration).toISOString().slice(0, 19);
      }
      // Recheck all live guards after the last await, BEFORE generating any signature.
      prepared.assertValid();
      const signed = client.auth.signTransaction(tx, { active: prepared.getPrivateKey() });
      prepared.assertValid();
      // One attempt only: failed/unknown receipts reject, retaining the generated handoff.
      let receipt;
      try {
        receipt = await toCallbackPromise(client.api.broadcastTransactionSynchronous, client.api, [signed]);
      } catch (_) {
        throw new Error('Результат отправки ключа агента неизвестен. Проверьте разрешения перед новой отправкой; автоматического повтора нет.');
      }
      if (receipt && (receipt.expired === true || receipt.trx_num === -1)) {
        throw new Error('Транзакция ключа агента не включена: срок транзакции истёк. Автоматического повтора нет.');
      }
      if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt) || typeof receipt.id !== 'string' || !/^[0-9a-f]{40}$/i.test(receipt.id)
          || !Number.isInteger(receipt.block_num) || receipt.block_num <= 0 || receipt.block_num > 2147483647
          || !Number.isInteger(receipt.trx_num) || receipt.trx_num < 0 || receipt.trx_num > 2147483647 || receipt.expired !== false) {
        throw new Error('Результат отправки ключа агента неизвестен. Проверьте разрешения перед новой отправкой; автоматического повтора нет.');
      }
      return receipt;
    }

    const operationFn = () => {
      const method = client.broadcast[`${prepared.operationName}Async`];

      if (typeof method === 'function') {
        return method.call(client.broadcast, key, ...prepared.params);
      }

      if (typeof client.broadcast[prepared.operationName] === 'function') {
        return toCallbackPromise(client.broadcast[prepared.operationName], client.broadcast, [key, ...prepared.params]);
      }
      throw new Error(`Метод broadcast.${prepared.operationName} недоступен в ${chain.libraryGlobal}.`);
    };

    try {
      return await operationFn();
    } catch (error) {
      return retryStoppedNodeBroadcast(chain, client, operationFn, error);
    }
  }

  function sanitizeValue(value) {
    return sanitizeDiagnostic(value);
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
    return sanitizeDiagnostic(value);
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
    prepareForUser,
    prepareWithPrivateKey,
    sanitizeDiagnostic,
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
