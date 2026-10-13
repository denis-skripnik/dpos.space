(function exposeVault(global) {
  'use strict';

  const CHAINS = Object.freeze(['golos', 'viz', 'steem', 'hive', 'minter', 'decimal']);
  const STORAGE_KEYS = Object.freeze({
    active: 'dpos_vault_v1',
    staging: 'dpos_vault_v1_staging'
  });
  const VERSION = 1;
  const PASSWORD_ITERATIONS = 600000;
  const encoder = new global.TextEncoder();
  const decoder = new global.TextDecoder();
  let state = 'empty';
  let detail = '';
  let memoryRecords = null;
  let cryptoKey = null;
  let loadedRevision = 0;
  let generation = 0;
  let sessionEpoch = 0;
  let lastEnvelopeText = '';
  let cleanupSnapshot = {};
  let writeQueue = Promise.resolve();
  const RESUME_KEY = 'dpos_vault_session_resume_v1';
  const REVOCATION_KEY = 'dpos_vault_session_revocation_v1';
  const keyMaterial = new WeakMap();
  let loadedRevocation = null;
  let loadedSessionCookie = null;
  const COOKIE_KEY = '__Host-dpos_vault_browser_session_v1';
  const browserResume = () => Boolean(global.document && typeof global.document.cookie === 'string' && !global.DposAndroidTransport && !global.DposAndroid);
  function resumeCookie() {
    return (global.document.cookie.split(';').map(value => value.trim()).find(value => value.startsWith(`${COOKIE_KEY}=`)) || '').slice(COOKIE_KEY.length + 1);
  }
  function setResumeCookie(value) {
    global.document.cookie = `${COOKIE_KEY}=${value}; Path=/; SameSite=Strict; Secure${value ? '' : '; Max-Age=0'}`;
  }

  async function importVaultKey(raw) {
    const key = await requireCrypto().subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
    keyMaterial.set(key, new Uint8Array(raw));
    return key;
  }

  async function envelopeBinding(text) {
    return bytesToBase64(new Uint8Array(await requireCrypto().subtle.digest('SHA-256', encoder.encode(text))));
  }

  function removeResume() {
    try { if (browserResume()) setResumeCookie(''); global.localStorage.removeItem(RESUME_KEY); } catch (_) {}
  }

  async function saveResume() {
    if (!browserResume()) return;
    const requestedGeneration = generation;
    const text = lastEnvelopeText;
    const revocation = global.localStorage.getItem(REVOCATION_KEY);
    const binding = await envelopeBinding(text);
    const wrapBytes = randomBytes(32);
    const wrapKey = await requireCrypto().subtle.importKey('raw', wrapBytes, 'AES-GCM', false, ['encrypt']);
    const iv = randomBytes(12);
    const raw = keyMaterial.get(cryptoKey);
    if (!raw) throw vaultError('Session resume key недоступен.');
    const cipher = await requireCrypto().subtle.encrypt({ name: 'AES-GCM', iv, additionalData: encoder.encode(JSON.stringify([global.location.origin, binding, revocation])) }, wrapKey, raw);
    if (generation !== requestedGeneration || state !== 'unlocked' || global.localStorage.getItem(STORAGE_KEYS.active) !== text || global.localStorage.getItem(REVOCATION_KEY) !== revocation) throw vaultError('Session resume отменён: vault изменён.');
    const value = JSON.stringify({ version: 1, binding, revision: loadedRevision, revocation, iv: bytesToBase64(iv), ciphertext: bytesToBase64(new Uint8Array(cipher)) });
    setResumeCookie(bytesToBase64(wrapBytes));
    if (resumeCookie() !== bytesToBase64(wrapBytes)) throw vaultError('Browser session cookie недоступен.');
    global.localStorage.setItem(RESUME_KEY, value);
    if (global.localStorage.getItem(RESUME_KEY) !== value) throw vaultError('Session resume storage проверка не пройдена.');
    loadedRevocation = revocation;
    loadedSessionCookie = resumeCookie();
  }

  async function resume() {
    if (!browserResume() || state !== 'locked') return;
    const requestedGeneration = generation;
    try {
      const value = global.localStorage.getItem(RESUME_KEY);
      if (!value || !resumeCookie()) return;
      const item = JSON.parse(value);
      const text = global.localStorage.getItem(STORAGE_KEYS.active);
      const envelope = readActiveEnvelope();
      const revocation = global.localStorage.getItem(REVOCATION_KEY);
      if (item.version !== 1 || item.revision !== envelope.revision || item.revocation !== revocation || item.binding !== await envelopeBinding(text)) throw new Error('stale resume');
      const wrapKey = await requireCrypto().subtle.importKey('raw', base64ToBytes(resumeCookie()), 'AES-GCM', false, ['decrypt']);
      const raw = await requireCrypto().subtle.decrypt({ name: 'AES-GCM', iv: base64ToBytes(item.iv), additionalData: encoder.encode(JSON.stringify([global.location.origin, item.binding, revocation])) }, wrapKey, base64ToBytes(item.ciphertext));
      const key = await importVaultKey(raw);
      const payload = await decryptEnvelope(envelope, key);
      if (payload.storageRestore || generation !== requestedGeneration || global.localStorage.getItem(STORAGE_KEYS.active) !== text || global.localStorage.getItem(REVOCATION_KEY) !== revocation) throw new Error('resume cancelled');
      memoryRecords = materializeLegacy(payload.records);
      cryptoKey = key;
      loadedRevision = envelope.revision;
      loadedRevocation = revocation;
      loadedSessionCookie = resumeCookie();
      lastEnvelopeText = text;
      cleanupSnapshot = clone(payload.legacySnapshot || {});
      state = 'unlocked';
      sessionEpoch += 1;
      generation += 1;
      notify('session-resumed');
      if (typeof global.dispatchEvent === 'function' && typeof global.CustomEvent === 'function') global.dispatchEvent(new global.CustomEvent('dpos-vault-ready'));
    } catch (_) { /* Preserve the authoritative vault and other tabs' fresh resume. */ }
  }

  function vaultError(message, cause) {
    const error = new Error(message);
    if (cause) error.cause = cause;
    return error;
  }

  function requireCrypto() {
    if (!global.crypto || !global.crypto.subtle || typeof global.crypto.getRandomValues !== 'function') {
      throw vaultError('WebCrypto недоступен. Vault закрыт; сохранение и чтение секретов запрещено.');
    }
    return global.crypto;
  }

  function bytesToBase64(bytes) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    let result = '';
    for (let index = 0; index < bytes.length; index += 3) {
      const a = bytes[index];
      const b = index + 1 < bytes.length ? bytes[index + 1] : 0;
      const c = index + 2 < bytes.length ? bytes[index + 2] : 0;
      const value = (a << 16) | (b << 8) | c;
      result += alphabet[(value >>> 18) & 63];
      result += alphabet[(value >>> 12) & 63];
      result += index + 1 < bytes.length ? alphabet[(value >>> 6) & 63] : '=';
      result += index + 2 < bytes.length ? alphabet[value & 63] : '=';
    }
    return result;
  }

  function base64ToBytes(text) {
    if (typeof text !== 'string' || !text.length || text.length % 4 !== 0 || /[^A-Za-z0-9+/=]/.test(text)) {
      throw vaultError('Запись vault повреждена: некорректный base64.');
    }
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    const output = [];
    for (let index = 0; index < text.length; index += 4) {
      const chars = text.slice(index, index + 4);
      const values = chars.split('').map((char) => char === '=' ? 0 : alphabet.indexOf(char));
      if (values.some((value) => value < 0)) throw vaultError('Запись vault повреждена: некорректный base64.');
      const packed = (values[0] << 18) | (values[1] << 12) | (values[2] << 6) | values[3];
      output.push((packed >>> 16) & 255);
      if (chars[2] !== '=') output.push((packed >>> 8) & 255);
      if (chars[3] !== '=') output.push(packed & 255);
    }
    return new Uint8Array(output);
  }

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function accountKeys(chainId) {
    return { users: `${chainId}_users`, current: `${chainId}_current_user` };
  }

  function loginOf(user) {
    if (!user) return '';
    return user.type === 'vizonator' ? (user.last_login || '') : (user.login || '');
  }

  function typeOf(user) {
    if (!user) return 'standard';
    if (user.type === 'vizonator' || user.type === 'golos.app') return user.type;
    return user.type || 'standard';
  }

  function sameIdentity(a, b) {
    return loginOf(a) === loginOf(b) && typeOf(a) === typeOf(b);
  }

  function emptyRecords() {
    const records = {};
    CHAINS.forEach((chainId) => {
      const keys = accountKeys(chainId);
      records[keys.users] = [];
      records[keys.current] = null;
    });
    return records;
  }

  function parseLegacyRecord(key, fallback) {
    const raw = global.localStorage.getItem(key);
    if (raw == null || raw === '') return fallback;
    try {
      return JSON.parse(raw);
    } catch (error) {
      throw vaultError(`Legacy-запись ${key} повреждена. Миграция остановлена без удаления данных.`, error);
    }
  }

  function captureLegacyRecords() {
    const records = emptyRecords();
    const snapshot = {};
    CHAINS.forEach((chainId) => {
      const keys = accountKeys(chainId);
      const usersRaw = global.localStorage.getItem(keys.users);
      const currentRaw = global.localStorage.getItem(keys.current);
      if (usersRaw !== null) snapshot[keys.users] = usersRaw;
      if (currentRaw !== null) snapshot[keys.current] = currentRaw;
      let users;
      let current;
      try {
        users = usersRaw == null || usersRaw === '' ? [] : JSON.parse(usersRaw);
        current = currentRaw == null || currentRaw === '' ? null : JSON.parse(currentRaw);
      } catch (error) {
        throw vaultError(`Legacy-запись ${chainId} повреждена. Миграция остановлена без удаления данных.`, error);
      }
      if (!Array.isArray(users)) throw vaultError(`Legacy-запись ${keys.users} должна быть массивом.`);
      if (current !== null && (typeof current !== 'object' || Array.isArray(current))) {
        throw vaultError(`Legacy-запись ${keys.current} повреждена.`);
      }
      records[keys.users] = users;
      records[keys.current] = current;
      if (current && !users.some((user) => sameIdentity(user, current))) users.push(clone(current));
    });
    return { records, snapshot };
  }

  function secretFields(chainId, user) {
    if (!user || user.type === 'vizonator' || user.type === 'golos.app') return [];
    if (chainId === 'minter' || chainId === 'decimal') return user.seed ? ['seed'] : [];
    if (chainId === 'viz') return ['regular', 'active'].filter((field) => user[field]);
    return ['posting', 'active'].filter((field) => user[field]);
  }

  function legacyPassphrase(chainId, user, field) {
    const login = loginOf(user);
    if (field === 'seed') return `dpos.space_${user.importFrom || chainId}_${login}_seed`;
    return `dpos.space_${chainId}_${login}_${field}Key`;
  }

  function requireSjcl() {
    if (!global.sjcl || typeof global.sjcl.encrypt !== 'function' || typeof global.sjcl.decrypt !== 'function') {
      throw vaultError('SJCL недоступен: legacy-ключи нельзя безопасно проверить или восстановить.');
    }
  }

  function transformRecords(records, transformSecret) {
    const output = emptyRecords();
    CHAINS.forEach((chainId) => {
      const keys = accountKeys(chainId);
      const users = records[keys.users];
      const current = records[keys.current];
      if (!Array.isArray(users) || (current !== null && (typeof current !== 'object' || Array.isArray(current)))) {
        throw vaultError(`Данные vault для ${chainId} имеют неверный формат.`);
      }
      const transformUser = (source) => {
        if (!source || typeof source !== 'object' || Array.isArray(source)) throw vaultError(`Аккаунт ${chainId} имеет неверный формат.`);
        const user = clone(source);
        secretFields(chainId, user).forEach((field) => {
          user[field] = transformSecret(chainId, user, field, user[field]);
        });
        return user;
      };
      output[keys.users] = users.map(transformUser);
      output[keys.current] = current ? transformUser(current) : null;
      if (output[keys.current] && !output[keys.users].some((user) => sameIdentity(user, output[keys.current]))) {
        output[keys.users].push(clone(output[keys.current]));
      }
    });
    return output;
  }

  function canonicalizeLegacy(records) {
    requireSjcl();
    return transformRecords(records, (chainId, user, field, encrypted) => {
      try {
        const plaintext = global.sjcl.decrypt(legacyPassphrase(chainId, user, field), encrypted);
        if (!plaintext || typeof plaintext !== 'string') throw new Error('empty secret');
        return plaintext;
      } catch (error) {
        throw vaultError(`Legacy-секрет ${chainId}/${loginOf(user)}/${field} не прошёл проверку. Миграция остановлена.`, error);
      }
    });
  }

  function materializeLegacy(records) {
    requireSjcl();
    return transformRecords(records, (chainId, user, field, plaintext) => {
      if (!plaintext || typeof plaintext !== 'string') throw vaultError(`Секрет ${chainId}/${loginOf(user)}/${field} повреждён.`);
      return global.sjcl.encrypt(legacyPassphrase(chainId, user, field), plaintext);
    });
  }

  function validateEnvelope(envelope) {
    if (!envelope || envelope.version !== VERSION || !Number.isSafeInteger(envelope.revision) || envelope.revision < 1 ||
        !envelope.kdf || !['password', 'passkey-prf'].includes(envelope.kdf.type) ||
        typeof envelope.iv !== 'string' || typeof envelope.ciphertext !== 'string') {
      throw vaultError('Активная запись vault повреждена или имеет неподдерживаемую версию.');
    }
    return envelope;
  }

  function readActiveEnvelope() {
    const text = global.localStorage.getItem(STORAGE_KEYS.active);
    if (!text) return null;
    try {
      return validateEnvelope(JSON.parse(text));
    } catch (error) {
      if (error && /vault/.test(error.message)) throw error;
      throw vaultError('Активная запись vault повреждена.', error);
    }
  }

  async function passwordKey(password, kdf) {
    const crypto = requireCrypto();
    if (typeof password !== 'string' || password.length < 10) throw vaultError('Новый пароль vault должен содержать не менее 10 символов.');
    const iterations = Number(kdf.iterations || PASSWORD_ITERATIONS);
    if (!Number.isSafeInteger(iterations) || iterations < 210000) throw vaultError('Параметры PBKDF2 vault небезопасны или повреждены.');
    const material = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
    return importVaultKey(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: base64ToBytes(kdf.salt), iterations }, material, 256));
  }

  async function hkdfKey(prfBytes, kdf) {
    const crypto = requireCrypto();
    if (!(prfBytes instanceof Uint8Array) || prfBytes.byteLength < 16) throw vaultError('Passkey PRF не вернул криптографический результат.');
    const material = await crypto.subtle.importKey('raw', prfBytes, 'HKDF', false, ['deriveBits']);
    return importVaultKey(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: base64ToBytes(kdf.hkdfSalt), info: encoder.encode('dpos.space browser vault v1') }, material, 256));
  }

  function randomBytes(length) {
    const bytes = new Uint8Array(length);
    requireCrypto().getRandomValues(bytes);
    return bytes;
  }

  async function createPasswordProtection(options) {
    const kdf = { type: 'password', hash: 'SHA-256', iterations: PASSWORD_ITERATIONS, salt: bytesToBase64(randomBytes(16)) };
    return { kdf, key: await passwordKey(options.password, kdf) };
  }

  function credentialId(credential) {
    if (credential.rawId) return bytesToBase64(new Uint8Array(credential.rawId));
    if (credential.id) return credential.id;
    throw vaultError('Passkey не вернул credential id.');
  }

  function prfResult(credential) {
    const extensions = credential && typeof credential.getClientExtensionResults === 'function' ? credential.getClientExtensionResults() : null;
    const first = extensions && extensions.prf && extensions.prf.results && extensions.prf.results.first;
    if (!first) throw vaultError('Этот passkey/браузер не поддерживает WebAuthn PRF. Используйте пароль.');
    return new Uint8Array(first);
  }

  async function createPasskeyProtection(options) {
    requireCrypto();
    if (!global.navigator || !global.navigator.credentials || typeof global.navigator.credentials.create !== 'function') {
      throw vaultError('WebAuthn passkey недоступен. Используйте пароль.');
    }
    const prfSalt = randomBytes(32);
    const userId = randomBytes(32);
    let credential;
    try {
      credential = await global.navigator.credentials.create({ publicKey: {
        challenge: randomBytes(32),
        rp: { name: 'DPoS Space', id: options.rpId || (global.location && global.location.hostname) || undefined },
        user: { id: userId, name: 'dpos.space vault', displayName: 'DPoS Space vault' },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
        authenticatorSelection: { residentKey: 'preferred', userVerification: 'required' },
        timeout: 60000,
        attestation: 'none',
        extensions: { prf: { eval: { first: prfSalt } } }
      } });
    } catch (error) {
      throw vaultError('Создание passkey отменено или завершилось ошибкой. Legacy-данные не изменены.', error);
    }
    const kdf = {
      type: 'passkey-prf',
      credentialId: credentialId(credential),
      prfSalt: bytesToBase64(prfSalt),
      hkdfSalt: bytesToBase64(randomBytes(32))
    };
    return { kdf, key: await hkdfKey(prfResult(credential), kdf) };
  }

  async function unlockPasskey(envelope) {
    requireCrypto();
    if (!global.navigator || !global.navigator.credentials || typeof global.navigator.credentials.get !== 'function') {
      throw vaultError('WebAuthn passkey недоступен.');
    }
    let credential;
    try {
      credential = await global.navigator.credentials.get({ publicKey: {
        challenge: randomBytes(32),
        allowCredentials: [{ type: 'public-key', id: base64ToBytes(envelope.kdf.credentialId) }],
        userVerification: 'required', timeout: 60000,
        extensions: { prf: { eval: { first: base64ToBytes(envelope.kdf.prfSalt) } } }
      } });
    } catch (error) {
      throw vaultError('Разблокировка passkey отменена или завершилась ошибкой.', error);
    }
    return hkdfKey(prfResult(credential), envelope.kdf);
  }

  async function encryptPayload(payload, key, kdf) {
    const iv = randomBytes(12);
    const aad = encoder.encode(`dpos.space-vault:${VERSION}:${payload.revision}`);
    const ciphertext = await requireCrypto().subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aad }, key, encoder.encode(JSON.stringify(payload)));
    return { version: VERSION, revision: payload.revision, kdf: clone(kdf), iv: bytesToBase64(iv), ciphertext: bytesToBase64(new Uint8Array(ciphertext)) };
  }

  async function decryptEnvelope(envelope, key) {
    try {
      const aad = encoder.encode(`dpos.space-vault:${VERSION}:${envelope.revision}`);
      const plaintext = await requireCrypto().subtle.decrypt({ name: 'AES-GCM', iv: base64ToBytes(envelope.iv), additionalData: aad }, key, base64ToBytes(envelope.ciphertext));
      const payload = JSON.parse(decoder.decode(plaintext));
      if (!payload || payload.version !== VERSION || payload.revision !== envelope.revision || !payload.records) throw new Error('payload mismatch');
      transformRecords(payload.records, (chainId, user, field, value) => value);
      return payload;
    } catch (error) {
      throw vaultError('Vault не удалось расшифровать: неверный пароль/passkey или запись повреждена.', error);
    }
  }

  function writeStorage(key, value, message) {
    try {
      global.localStorage.setItem(key, value);
    } catch (error) {
      throw vaultError(message || 'Не удалось сохранить vault в хранилище браузера.', error);
    }
    if (global.localStorage.getItem(key) !== value) throw vaultError('Проверка записи vault в хранилище не пройдена.');
  }

  async function activate(canonicalRecords, protection, legacySnapshot, requestedGeneration = generation) {
    const checkGeneration = () => { if (generation !== requestedGeneration) throw vaultError('Изменение отменено: хранилище заблокировано.'); };
    checkGeneration();
    const payload = { version: VERSION, revision: 1, records: canonicalRecords, legacySnapshot: clone(legacySnapshot || {}) };
    const envelope = await encryptPayload(payload, protection.key, protection.kdf);
    const text = JSON.stringify(envelope);
    checkGeneration();
    writeStorage(STORAGE_KEYS.staging, text, 'Не удалось сохранить staging vault; исходные данные оставлены без изменений.');
    const staged = validateEnvelope(JSON.parse(global.localStorage.getItem(STORAGE_KEYS.staging)));
    const checked = await decryptEnvelope(staged, protection.key);
    if (JSON.stringify(checked) !== JSON.stringify(payload)) throw vaultError('Проверка staging vault не совпала с исходными данными.');
    checkGeneration();
    if (global.localStorage.getItem(STORAGE_KEYS.active)) throw vaultError('Хранилище уже создано в другой вкладке.');
    if (!legacySnapshotStillMatches(legacySnapshot)) {
      throw vaultError('Legacy-данные изменены в другой вкладке во время миграции; активация отменена без удаления данных.');
    }
    writeStorage(STORAGE_KEYS.active, text, 'Не удалось активировать vault; исходные данные оставлены без изменений.');
    const active = readActiveEnvelope();
    const activeChecked = await decryptEnvelope(active, protection.key);
    if (JSON.stringify(activeChecked) !== JSON.stringify(payload)) throw vaultError('Проверка активного vault не пройдена; исходные данные оставлены.');
    checkGeneration();
    memoryRecords = materializeLegacy(canonicalRecords);
    cryptoKey = protection.key;
    loadedRevision = 1;
    lastEnvelopeText = text;
    cleanupSnapshot = clone(payload.legacySnapshot);
    state = 'unlocked';
    sessionEpoch += 1;
    detail = '';
    generation += 1;
    cleanupLegacyRecords(cleanupSnapshot);
    global.localStorage.removeItem(STORAGE_KEYS.staging);
    try { await saveResume(); } catch (error) { lock(); throw error; }
    return status();
  }

  function legacySnapshotStillMatches(snapshot) {
    return Object.keys(snapshot || {}).every((key) => global.localStorage.getItem(key) === snapshot[key]);
  }

  function cleanupLegacyRecords(snapshot) {
    Object.keys(snapshot || {}).forEach((key) => {
      if (global.localStorage.getItem(key) === snapshot[key]) global.localStorage.removeItem(key);
    });
  }

  function hasLegacyRecords() {
    return CHAINS.some((chainId) => {
      const keys = accountKeys(chainId);
      return global.localStorage.getItem(keys.users) !== null || global.localStorage.getItem(keys.current) !== null;
    });
  }

  async function protectionForSetup(options) {
    if (options && options.passkey) return createPasskeyProtection(options);
    return createPasswordProtection(options || {});
  }

  async function setup(options) {
    const requestedGeneration = generation;
    if (readActiveEnvelope()) throw vaultError('Vault уже создан.');
    if (hasLegacyRecords()) throw vaultError('Найдены legacy-аккаунты: используйте migrate(), чтобы сохранить их.');
    return activate(canonicalizeLegacy(emptyRecords()), await protectionForSetup(options), undefined, requestedGeneration);
  }

  async function migrate(options) {
    const requestedGeneration = generation;
    if (readActiveEnvelope()) throw vaultError('Vault уже создан.');
    const legacy = captureLegacyRecords();
    const canonical = canonicalizeLegacy(legacy.records);
    const protection = await protectionForSetup(options);
    return activate(canonical, protection, legacy.snapshot, requestedGeneration);
  }

  async function unlock(options) {
    const requestedGeneration = generation;
    const activeText = global.localStorage.getItem(STORAGE_KEYS.active);
    const envelope = readActiveEnvelope();
    if (!envelope) throw vaultError('Активный vault не найден.');
    let key;
    if (envelope.kdf.type === 'password') key = await passwordKey((options || {}).password, envelope.kdf);
    else key = await unlockPasskey(envelope);
    let payload = await decryptEnvelope(envelope, key);
    if (generation !== requestedGeneration || global.localStorage.getItem(STORAGE_KEYS.active) !== activeText) throw vaultError('Разблокировка отменена: состояние хранилища изменено.');
    if (payload.storageRestore) {
      const recovered = await recoverStorageRestore(payload, envelope, key);
      payload = recovered.payload;
      if (generation !== requestedGeneration || global.localStorage.getItem(STORAGE_KEYS.active) !== JSON.stringify(recovered.envelope)) {
        throw vaultError('Разблокировка отменена: состояние хранилища изменено.');
      }
    }
    memoryRecords = materializeLegacy(payload.records);
    cryptoKey = key;
    loadedRevision = payload.revision;
    lastEnvelopeText = global.localStorage.getItem(STORAGE_KEYS.active);
    cleanupSnapshot = clone(payload.legacySnapshot || {});
    state = 'unlocked';
    sessionEpoch += 1;
    detail = '';
    generation += 1;
    cleanupLegacyRecords(cleanupSnapshot);
    global.localStorage.removeItem(STORAGE_KEYS.staging);
    try { await saveResume(); } catch (error) { lock(); throw error; }
    return status();
  }

  // Observing another tab's change only invalidates this tab's memory/guards.
  // Never republish revocation or delete a newer shared resume capability.
  function invalidateLocal() {
    loadedRevocation = global.localStorage.getItem(REVOCATION_KEY);
    lastEnvelopeText = global.localStorage.getItem(STORAGE_KEYS.active);
    loadedSessionCookie = browserResume() ? resumeCookie() : null;
    sessionEpoch += 1;
    if (cryptoKey) { const raw = keyMaterial.get(cryptoKey); if (raw) raw.fill(0); keyMaterial.delete(cryptoKey); }
    memoryRecords = null;
    cryptoKey = null;
    loadedRevision = 0;
    cleanupSnapshot = {};
    generation += 1;
    state = global.localStorage.getItem(STORAGE_KEYS.active) ? 'locked' : (hasLegacyRecords() ? 'legacy' : 'empty');
    if (typeof global.dispatchEvent === 'function' && typeof global.CustomEvent === 'function') global.dispatchEvent(new global.CustomEvent('dpos-vault-lock'));
    return status();
  }

  function lock() {
    removeResume();
    if (browserResume()) {
      try { global.localStorage.setItem(REVOCATION_KEY, bytesToBase64(randomBytes(16))); } catch (_) {}
    }
    return invalidateLocal();
  }

  function status() {
    if ((state === 'empty' || state === 'legacy') && !global.localStorage.getItem(STORAGE_KEYS.active)) {
      state = hasLegacyRecords() ? 'legacy' : 'empty';
    }
    return Object.freeze({ state, version: VERSION, revision: loadedRevision, method: (() => {
      try { const envelope = readActiveEnvelope(); return envelope ? envelope.kdf.type : null; } catch (error) { return null; }
    })(), detail });
  }

  function requireUnlocked() {
    if (state === 'unlocked' && (global.localStorage.getItem(STORAGE_KEYS.active) !== lastEnvelopeText || (browserResume() && (global.localStorage.getItem(REVOCATION_KEY) !== loadedRevocation || resumeCookie() !== loadedSessionCookie)))) {
      invalidateLocal();
      throw vaultError('Vault изменён в другой вкладке; текущая копия устарела и заблокирована.');
    }
    if (state !== 'unlocked' || !memoryRecords || !cryptoKey) throw vaultError('Vault заблокирован. Разблокируйте его перед чтением или подписью.');
  }

  function read(key) {
    requireUnlocked();
    if (typeof key === 'string') return clone(memoryRecords[key]);
    return clone(memoryRecords);
  }

  function mutate(mutator, persistResume = true) {
    const operation = writeQueue.then(async () => {
      requireUnlocked();
      const requestedGeneration = generation;
      const checkGeneration = () => { if (generation !== requestedGeneration || state !== 'unlocked') throw vaultError('Изменение отменено: хранилище заблокировано.'); };
      const activeText = global.localStorage.getItem(STORAGE_KEYS.active);
      const active = readActiveEnvelope();
      if (!active || active.revision !== loadedRevision || activeText !== lastEnvelopeText) {
        lock();
        throw vaultError('Vault изменён в другой вкладке; текущая копия устарела и заблокирована. Разблокируйте заново.');
      }
      const draft = clone(memoryRecords);
      const result = await mutator(draft);
      const canonical = canonicalizeLegacy(draft);
      const nextRevision = loadedRevision + 1;
      const payload = { version: VERSION, revision: nextRevision, records: canonical, legacySnapshot: clone(cleanupSnapshot) };
      const envelope = await encryptPayload(payload, cryptoKey, active.kdf);
      const text = JSON.stringify(envelope);
      checkGeneration();
      writeStorage(STORAGE_KEYS.staging, text, 'Не удалось сохранить изменение vault; прежняя версия остаётся активной.');
      const stagedPayload = await decryptEnvelope(validateEnvelope(JSON.parse(global.localStorage.getItem(STORAGE_KEYS.staging))), cryptoKey);
      if (JSON.stringify(stagedPayload) !== JSON.stringify(payload)) throw vaultError('Проверка изменения vault не пройдена.');
      checkGeneration();
      const latest = readActiveEnvelope();
      if (!latest || latest.revision !== loadedRevision || global.localStorage.getItem(STORAGE_KEYS.active) !== activeText) {
        global.localStorage.removeItem(STORAGE_KEYS.staging);
        lock();
        throw vaultError('Vault изменён в другой вкладке; запись отменена.');
      }
      writeStorage(STORAGE_KEYS.active, text, 'Не удалось активировать изменение vault; прежняя версия остаётся доступной.');
      const verified = await decryptEnvelope(readActiveEnvelope(), cryptoKey);
      if (JSON.stringify(verified) !== JSON.stringify(payload)) throw vaultError('Read-back проверка изменения vault не пройдена.');
      checkGeneration();
      global.localStorage.removeItem(STORAGE_KEYS.staging);
      memoryRecords = materializeLegacy(canonical);
      loadedRevision = nextRevision;
      lastEnvelopeText = text;
      generation += 1;
      if (persistResume) { try { await saveResume(); } catch (error) { lock(); throw error; } }
      return result;
    });
    writeQueue = operation.catch(() => undefined);
    return operation;
  }

  function exportLegacy() {
    requireUnlocked();
    return clone(memoryRecords);
  }

  function restoreOrdinaryStorage(entries) {
    const failures = [];
    for (const entry of (entries || []).slice().reverse()) {
      try {
        if (entry.existed) global.localStorage.setItem(entry.key, entry.value);
        else global.localStorage.removeItem(entry.key);
        const expected = entry.existed ? entry.value : null;
        if (global.localStorage.getItem(entry.key) !== expected) failures.push(entry.key);
      } catch (_) {
        failures.push(entry.key);
      }
    }
    if (failures.length) {
      const error = vaultError(`Не удалось восстановить настройки резервной копии: ${failures.join(', ')}.`);
      error.rollbackFailedKeys = failures;
      throw error;
    }
  }

  async function recoverStorageRestore(payload, envelope, key) {
    restoreOrdinaryStorage(payload.storageRestore.before);
    const cleanPayload = {
      version: VERSION,
      revision: envelope.revision + 1,
      records: payload.records,
      legacySnapshot: clone(payload.legacySnapshot || {})
    };
    const cleanEnvelope = await encryptPayload(cleanPayload, key, envelope.kdf);
    const cleanText = JSON.stringify(cleanEnvelope);
    writeStorage(STORAGE_KEYS.staging, cleanText, 'Не удалось подготовить восстановление настроек vault.');
    const checked = await decryptEnvelope(validateEnvelope(JSON.parse(global.localStorage.getItem(STORAGE_KEYS.staging))), key);
    if (JSON.stringify(checked) !== JSON.stringify(cleanPayload)) throw vaultError('Проверка восстановления настроек vault не пройдена.');
    writeStorage(STORAGE_KEYS.active, cleanText, 'Не удалось завершить восстановление настроек vault.');
    try { global.localStorage.removeItem(STORAGE_KEYS.staging); } catch (_) {}
    return { payload: cleanPayload, envelope: cleanEnvelope };
  }

  function normalizeImportedRecords(input) {
    let parsed = typeof input === 'string' ? JSON.parse(input) : clone(input);
    if (parsed && parsed.storage && typeof parsed.storage === 'object') parsed = parsed.storage;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw vaultError('Legacy backup имеет неверный формат.');
    const imported = emptyRecords();
    CHAINS.forEach((chainId) => {
      const keys = accountKeys(chainId);
      if (Object.prototype.hasOwnProperty.call(parsed, keys.users)) {
        const value = typeof parsed[keys.users] === 'string' ? JSON.parse(parsed[keys.users]) : parsed[keys.users];
        if (!Array.isArray(value)) throw vaultError(`Backup ${keys.users} повреждён.`);
        imported[keys.users] = value;
      }
      if (Object.prototype.hasOwnProperty.call(parsed, keys.current)) {
        imported[keys.current] = typeof parsed[keys.current] === 'string' ? JSON.parse(parsed[keys.current]) : parsed[keys.current];
      }
      if (imported[keys.current] && !imported[keys.users].some((user) => sameIdentity(user, imported[keys.current]))) imported[keys.users].push(clone(imported[keys.current]));
    });
    return canonicalizeLegacy(imported);
  }

  function importWithStorageTransaction(input, ordinaryEntries) {
    const operation = writeQueue.then(async () => {
      requireUnlocked();
      removeResume();
      loadedSessionCookie = browserResume() ? resumeCookie() : null;
      if (typeof global.dispatchEvent === 'function' && typeof global.CustomEvent === 'function') global.dispatchEvent(new global.CustomEvent('dpos-vault-lock'));
      const requestedGeneration = generation;
      const operationKey = cryptoKey;
      const checkGeneration = () => {
        if (generation !== requestedGeneration || state !== 'unlocked') throw vaultError('Импорт отменён: хранилище заблокировано или изменено.');
      };
      const activeText = global.localStorage.getItem(STORAGE_KEYS.active);
      const active = readActiveEnvelope();
      if (!active || active.revision !== loadedRevision || activeText !== lastEnvelopeText) {
        lock();
        throw vaultError('Vault изменён в другой вкладке; импорт отменён.');
      }
      const ordinary = (ordinaryEntries || []).map((entry) => {
        if (!Array.isArray(entry) || typeof entry[0] !== 'string' || typeof entry[1] !== 'string' || entry[0].startsWith('dpos_vault_') || CHAINS.some((chainId) => Object.values(accountKeys(chainId)).includes(entry[0]))) {
          throw vaultError('Транзакция backup содержит недопустимую запись настроек.');
        }
        return [entry[0], entry[1]];
      });
      const targetRecords = normalizeImportedRecords(input);
      const oldRecords = canonicalizeLegacy(memoryRecords);
      const before = ordinary.map(([key]) => ({ key, existed: global.localStorage.getItem(key) !== null, value: global.localStorage.getItem(key) }));
      const pendingPayload = {
        version: VERSION,
        revision: loadedRevision + 1,
        records: oldRecords,
        legacySnapshot: clone(cleanupSnapshot),
        storageRestore: { before }
      };
      let pendingActive = false;
      let committed = false;
      let pendingEnvelope;
      let pendingText;
      try {
        pendingEnvelope = await encryptPayload(pendingPayload, operationKey, active.kdf);
        checkGeneration();
        pendingText = JSON.stringify(pendingEnvelope);
        writeStorage(STORAGE_KEYS.staging, pendingText, 'Не удалось сохранить журнал восстановления backup.');
        const checkedPending = await decryptEnvelope(validateEnvelope(JSON.parse(global.localStorage.getItem(STORAGE_KEYS.staging))), operationKey);
        checkGeneration();
        if (JSON.stringify(checkedPending) !== JSON.stringify(pendingPayload)) throw vaultError('Проверка журнала восстановления backup не пройдена.');
        if (global.localStorage.getItem(STORAGE_KEYS.active) !== activeText) throw vaultError('Vault изменён во время импорта backup.');
        writeStorage(STORAGE_KEYS.active, pendingText, 'Не удалось активировать журнал восстановления backup.');
        pendingActive = true;
        checkGeneration();
        for (const [key, value] of ordinary) {
          global.localStorage.setItem(key, value);
          if (global.localStorage.getItem(key) !== value) throw vaultError(`Некорректная запись резервной копии: ${key}.`);
        }
        const finalPayload = { version: VERSION, revision: loadedRevision + 2, records: targetRecords, legacySnapshot: clone(cleanupSnapshot) };
        const finalEnvelope = await encryptPayload(finalPayload, operationKey, active.kdf);
        checkGeneration();
        if (global.localStorage.getItem(STORAGE_KEYS.active) !== pendingText) throw vaultError('Vault изменён во время импорта backup.');
        const finalText = JSON.stringify(finalEnvelope);
        writeStorage(STORAGE_KEYS.staging, finalText, 'Не удалось подготовить новые аккаунты backup.');
        const checkedFinal = await decryptEnvelope(validateEnvelope(JSON.parse(global.localStorage.getItem(STORAGE_KEYS.staging))), operationKey);
        checkGeneration();
        if (global.localStorage.getItem(STORAGE_KEYS.active) !== pendingText) throw vaultError('Vault изменён во время импорта backup.');
        if (JSON.stringify(checkedFinal) !== JSON.stringify(finalPayload)) throw vaultError('Проверка аккаунтов backup не пройдена.');
        writeStorage(STORAGE_KEYS.active, finalText, 'Не удалось активировать аккаунты backup.');
        committed = true;
        checkGeneration();
        memoryRecords = materializeLegacy(targetRecords);
        loadedRevision = finalPayload.revision;
        lastEnvelopeText = finalText;
        generation += 1;
        try { global.localStorage.removeItem(STORAGE_KEYS.staging); } catch (_) {}
      } catch (error) {
        if (pendingActive && !committed) {
          try {
            restoreOrdinaryStorage(before);
            if (global.localStorage.getItem(STORAGE_KEYS.active) !== pendingText) throw vaultError('Vault изменён во время отката backup.');
            const recovered = await recoverStorageRestore(pendingPayload, pendingEnvelope, operationKey);
            loadedRevision = recovered.payload.revision;
            lastEnvelopeText = global.localStorage.getItem(STORAGE_KEYS.active);
          } catch (rollbackError) {
            error.rollbackError = rollbackError;
            error.rollbackFailedKeys = rollbackError.rollbackFailedKeys || [];
          }
          lock();
        } else if (!committed) global.localStorage.removeItem(STORAGE_KEYS.staging);
        else {
          try { global.localStorage.removeItem(STORAGE_KEYS.staging); } catch (_) {}
        }
        throw error;
      }
    });
    writeQueue = operation.catch(() => undefined);
    return operation;
  }

  async function importLegacy(input, options) {
    removeResume();
    loadedSessionCookie = browserResume() ? resumeCookie() : null;
    if (typeof global.dispatchEvent === 'function' && typeof global.CustomEvent === 'function') global.dispatchEvent(new global.CustomEvent('dpos-vault-lock'));
    const imported = normalizeImportedRecords(input);
    if (!global.localStorage.getItem(STORAGE_KEYS.active)) return activate(imported, await protectionForSetup(options));
    const materialized = materializeLegacy(imported);
    await mutate((records) => {
      CHAINS.forEach((chainId) => {
        const keys = accountKeys(chainId);
        records[keys.users] = materialized[keys.users];
        records[keys.current] = materialized[keys.current];
      });
    }, false);
    removeResume();
  }

  function issueGuard(chain, user) {
    requireUnlocked();
    if (!chain) return Object.freeze({ generation, revision: loadedRevision, sessionOnly: true });
    return Object.freeze({ generation, revision: loadedRevision, chainId: chain.id, login: loginOf(user), type: typeOf(user) });
  }

  function assertGuard(guard) {
    requireUnlocked();
    if (!guard || guard.generation !== generation || guard.revision !== loadedRevision) {
      throw vaultError('Аккаунт или vault изменён после подготовки операции; подпись отозвана.');
    }
    if (guard.sessionOnly) return true;
    const users = memoryRecords[`${guard.chainId}_users`] || [];
    if (!users.some((user) => loginOf(user) === guard.login && typeOf(user) === guard.type)) {
      throw vaultError('Подготовленный аккаунт удалён; подпись отозвана.');
    }
    return true;
  }

  function initialize() {
    try {
      loadedRevocation = global.localStorage.getItem(REVOCATION_KEY);
      const envelope = readActiveEnvelope();
      if (envelope) {
        state = 'locked';
        lastEnvelopeText = global.localStorage.getItem(STORAGE_KEYS.active);
      } else state = hasLegacyRecords() ? 'legacy' : 'empty';
    } catch (error) {
      state = 'error';
      detail = error.message;
    }
    if (typeof global.addEventListener === 'function') {
      global.addEventListener('storage', (event) => {
        if (!event) return;
        // Storage events are queued snapshots, not current authority. A delayed
        // removal/revoke must not cancel a password unlock issued afterwards.
        if (browserResume() && event.key === RESUME_KEY) {
          const current = global.localStorage.getItem(RESUME_KEY);
          if (!current && state === 'unlocked') invalidateLocal();
          else if (current) {
            if (state === 'unlocked' && resumeCookie() !== loadedSessionCookie) invalidateLocal();
            if (state === 'locked') void resume();
          }
          return;
        }
        if ((event.key === STORAGE_KEYS.active && global.localStorage.getItem(STORAGE_KEYS.active) !== lastEnvelopeText) ||
            (event.key === REVOCATION_KEY && global.localStorage.getItem(REVOCATION_KEY) !== loadedRevocation)) {
          invalidateLocal();
          detail = 'Vault изменён в другой вкладке и был заблокирован.';
          if (browserResume()) void resume();
        }
      });
    }
  }

  initialize();
  const ready = resume();

  function withStorageLock(action) {
    return (...args) => {
      const requestedEpoch = sessionEpoch;
      return Promise.resolve().then(() => {
        requireCrypto();
        if (!global.navigator || !global.navigator.locks || typeof global.navigator.locks.request !== 'function') {
          throw vaultError('Для безопасной записи аккаунтов обновите браузер или Android WebView. Исходные данные не изменены.');
        }
        return global.navigator.locks.request('dpos-space-vault-v1', async () => {
          if (sessionEpoch !== requestedEpoch) throw vaultError('Действие отменено: хранилище изменено или заблокировано.');
          return action(...args);
        });
      });
    };
  }

  global.DposVault = Object.freeze({
    ready,
    setup: withStorageLock(setup),
    migrate: withStorageLock(migrate),
    unlock: withStorageLock(unlock),
    lock,
    status,
    read,
    mutate: withStorageLock(mutate),
    import: withStorageLock(importLegacy),
    importWithStorageTransaction: withStorageLock(importWithStorageTransaction),
    export: exportLegacy,
    issueGuard,
    assertGuard,
    storageKeys: STORAGE_KEYS
  });
})(window);
