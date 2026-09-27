const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { webcrypto } = require('crypto');
const { TextEncoder, TextDecoder } = require('util');

const root = path.resolve(__dirname, '..');
const appSource = fs.readFileSync(path.join(root, 'v3/js/app.js'), 'utf8');
const vaultSource = fs.readFileSync(path.join(root, 'v3/js/vault.js'), 'utf8');
const sjclSource = fs.readFileSync(path.join(root, 'v3/vendor/golos/sjcl.min.js'), 'utf8');
const PASSWORD = 'quiet forest mango river 47!';

function fakeElement(extra = {}) {
  return Object.assign({
    innerHTML: '', textContent: '', value: '', disabled: false, hidden: false,
    dataset: {}, style: {},
    addEventListener() {}, setAttribute() {}, removeAttribute() {}, appendChild() {},
    querySelector: () => null, querySelectorAll: () => [], closest: () => null,
    hasAttribute: () => false
  }, extra);
}

function storageFrom(map, hooks = {}) {
  return {
    get length() { return map.size; },
    key(index) { return Array.from(map.keys())[index] || null; },
    getItem(key) { return map.has(key) ? map.get(key) : null; },
    setItem(key, value) {
      if (hooks.failSet && hooks.failSet(key, String(value))) throw new Error(`QuotaExceededError:${key}`);
      if (hooks.ignoreSet && hooks.ignoreSet(key, String(value))) return;
      map.set(key, String(value));
    },
    removeItem(key) {
      if (hooks.failRemove && hooks.failRemove(key)) throw new Error(`RemoveError:${key}`);
      map.delete(key);
    }
  };
}

function makeRealVaultContext(map, hooks = {}) {
  const context = {
    console, crypto: webcrypto, TextEncoder, TextDecoder,
    localStorage: storageFrom(map, hooks),
    location: { origin: 'https://dpos.test' },
    navigator: { locks: { request(_name, action) { return action(); } } },
    addEventListener() {}, dispatchEvent() {}, CustomEvent: function CustomEvent(type) { this.type = type; }
  };
  context.window = context;
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(sjclSource, context, { filename: 'sjcl.min.js' });
  vm.runInContext(vaultSource, context, { filename: 'v3/js/vault.js' });
  return context;
}

function makeContext(map, options = {}) {
  const accountState = options.accountState || {
    golos_users: [{ login: 'before' }],
    golos_current_user: { login: 'before' }
  };
  const vault = {
    status: () => ({ state: 'unlocked' }),
    export: () => JSON.parse(JSON.stringify(accountState)),
    async import(records) {
      if (options.failVaultImport) throw new Error('vault import rejected');
      const normalized = JSON.parse(JSON.stringify(records));
      for (const [key, value] of Object.entries(normalized)) {
        if (typeof value === 'string' && /_(?:users|current_user)$/.test(key)) normalized[key] = JSON.parse(value);
      }
      Object.keys(accountState).forEach(key => delete accountState[key]);
      Object.assign(accountState, normalized);
    },
    async importWithStorageTransaction(records, ordinary) {
      const before = ordinary.map(([key]) => [key, map.has(key), map.get(key)]);
      map.set('dpos_vault_restore_test_journal', JSON.stringify(before));
      for (const [key, value] of ordinary) {
        map.set(key, value);
        if (options.interruptAfterSetting === key) throw new Error('simulated process interruption');
      }
      await this.import(records);
      map.delete('dpos_vault_restore_test_journal');
    },
    recoverStorageTransaction() {
      const raw = map.get('dpos_vault_restore_test_journal');
      if (!raw) return;
      for (const [key, existed, value] of JSON.parse(raw)) {
        if (existed) map.set(key, value); else map.delete(key);
      }
      map.delete('dpos_vault_restore_test_journal');
    }
  };
  if (!options.transactionalVault) delete vault.importWithStorageTransaction;
  vault.recoverStorageTransaction();
  const context = {
    console,
    crypto: webcrypto,
    TextEncoder,
    TextDecoder,
    URLSearchParams,
    Blob,
    btoa: value => Buffer.from(value, 'binary').toString('base64'),
    atob: value => Buffer.from(value, 'base64').toString('binary'),
    localStorage: storageFrom(map, options.storageHooks),
    location: { hash: '#app=backup', origin: 'https://dpos.test', hostname: 'dpos.test', pathname: '/' },
    navigator: {},
    addEventListener() {},
    document: {
      getElementById(id) {
        if (id === 'status') return fakeElement();
        return fakeElement();
      },
      querySelector: () => null,
      createElement: () => fakeElement({ click() {}, remove() {} }),
      body: fakeElement(), head: fakeElement()
    },
    DposChains: {
      golos: { id: 'golos', title: 'Golos', apps: [{ id: 'profiles', title: 'Профиль' }], defaultAccount: '' },
      viz: { id: 'viz', title: 'VIZ', apps: [{ id: 'profiles', title: 'Профиль' }], defaultAccount: '' }
    },
    DposAuth: {
      getUsers: () => [], getCurrentUser: () => null, getCurrentLogin: () => '',
      getUserLogin: user => user && user.login || '', getUserType: () => 'standard'
    },
    DposBroadcast: {},
    DposProfiles: { formatError: error => error.message },
    DposHistory: {},
    DposNotifications: null,
    DposVault: vault
  };
  context.window = context;
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(appSource, context, { filename: 'v3/js/app.js' });
  return { context, accountState };
}

async function run() {
  const initial = new Map([
    ['golos_node', 'https://old.node'],
    ['viz_transfer_templates', '["old"]'],
    ['unrelated_key', 'keep']
  ]);
  const { context } = makeContext(initial);
  const backup = context.DposV3.backup;
  for (const name of ['encryptDposBackup', 'decryptDposBackup', 'importDposBackupStorage']) {
    assert.strictEqual(typeof backup[name], 'function', `${name} is exposed for behavioral regression coverage`);
  }

  const encrypted = await backup.encryptDposBackup(PASSWORD);
  const decrypted = await backup.decryptDposBackup(JSON.stringify(encrypted), PASSWORD);
  assert.strictEqual(decrypted.version, 1, 'existing version-1 password backup remains readable');
  assert.strictEqual(decrypted.storage.golos_node, 'https://old.node', 'real encrypted round-trip preserves ordinary settings');
  assert(JSON.parse(decrypted.storage.golos_users).some(user => user.login === 'before'), 'real encrypted round-trip preserves vault account export shape');

  const invalidMap = new Map(initial);
  const invalid = makeContext(invalidMap);
  await assert.rejects(
    () => invalid.context.DposV3.backup.importDposBackupStorage({
      golos_node: 'https://new.node',
      golos_users: '{broken json'
    }),
    /backup|аккаунт|JSON|запис/i
  );
  assert.strictEqual(invalidMap.get('golos_node'), 'https://old.node', 'full validation happens before the first storage mutation');

  let failOnce = true;
  const failureMap = new Map(initial);
  const failed = makeContext(failureMap, {
    storageHooks: {
      failSet(key) {
        if (failOnce && key === 'viz_transfer_templates') {
          failOnce = false;
          return true;
        }
        return false;
      }
    }
  });
  const incoming = {
    golos_node: 'https://new.node',
    viz_transfer_templates: '["new"]',
    golos_users: JSON.stringify([{ login: 'restored' }]),
    golos_current_user: JSON.stringify({ login: 'restored' }),
    unrelated_key: 'must-not-import'
  };
  await assert.rejects(() => failed.context.DposV3.backup.importDposBackupStorage(incoming), /QuotaExceededError|сохран|restore/i);
  assert.strictEqual(failureMap.get('golos_node'), 'https://old.node', 'mid-restore storage failure rolls back an already written key');
  assert.strictEqual(failureMap.get('viz_transfer_templates'), '["old"]', 'mid-restore failure preserves the old value at the failing key');
  assert.strictEqual(failureMap.get('unrelated_key'), 'keep', 'restore never mutates unrelated origin storage');
  assert.strictEqual(failed.accountState.golos_users[0].login, 'before', 'vault import is not attempted after an ordinary storage failure');

  const recovered = await failed.context.DposV3.backup.importDposBackupStorage(incoming);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(recovered)), { imported: 4, skipped: 1 }, 'a clean retry succeeds after rollback');
  assert.strictEqual(failureMap.get('golos_node'), 'https://new.node');
  assert.strictEqual(failureMap.get('viz_transfer_templates'), '["new"]');
  assert.strictEqual(failed.accountState.golos_users[0].login, 'restored', 'successful restore imports account records through the vault');
  assert.strictEqual(failureMap.get('unrelated_key'), 'keep');

  const silentMap = new Map(initial);
  const silent = makeContext(silentMap, {
    storageHooks: { ignoreSet: (key, value) => key === 'golos_node' && value === 'https://new.node' }
  });
  await assert.rejects(() => silent.context.DposV3.backup.importDposBackupStorage(incoming), /golos_node|резервной копии/i);
  assert.strictEqual(silentMap.get('golos_node'), 'https://old.node', 'read-back verification detects a silent failed write');
  assert.strictEqual(silent.accountState.golos_users[0].login, 'before', 'silent storage failure aborts before vault import');

  const vaultFailureMap = new Map(initial);
  const vaultFailure = makeContext(vaultFailureMap, { failVaultImport: true });
  await assert.rejects(() => vaultFailure.context.DposV3.backup.importDposBackupStorage(incoming), /vault import rejected/);
  assert.strictEqual(vaultFailureMap.get('golos_node'), 'https://old.node', 'vault rejection rolls ordinary settings back');
  assert.strictEqual(vaultFailureMap.get('viz_transfer_templates'), '["old"]', 'vault rejection preserves all prior ordinary values');
  assert.strictEqual(vaultFailure.accountState.golos_users[0].login, 'before', 'failed vault import preserves previous accounts');

  const interruptedMap = new Map(initial);
  const interruptedAccounts = { golos_users: [{ login: 'before' }], golos_current_user: { login: 'before' } };
  const interrupted = makeContext(interruptedMap, { accountState: interruptedAccounts, transactionalVault: true, interruptAfterSetting: 'viz_transfer_templates' });
  await assert.rejects(() => interrupted.context.DposV3.backup.importDposBackupStorage(incoming), /interruption/);
  assert.strictEqual(interruptedMap.get('golos_node'), 'https://new.node', 'interruption fixture really leaves a partial ordinary restore on disk');
  makeContext(interruptedMap, { accountState: interruptedAccounts });
  assert.strictEqual(interruptedMap.get('golos_node'), 'https://old.node', 'reload recovery rolls a partial ordinary restore back durably');
  assert.strictEqual(interruptedMap.get('viz_transfer_templates'), '["old"]', 'reload recovery restores every staged ordinary setting');
  assert.strictEqual(interruptedAccounts.golos_users[0].login, 'before', 'accounts are not activated before the durable settings transaction commits');

  const durableMap = new Map([['golos_node', 'https://old.node'], ['viz_transfer_templates', '["old"]']]);
  let stagingWrites = 0;
  let failRollback = true;
  const durable = makeRealVaultContext(durableMap, {
    failSet(key, value) {
      if (key === 'dpos_vault_v1_staging' && ++stagingWrites === 3) return true;
      if (failRollback && key === 'golos_node' && value === 'https://old.node') {
        failRollback = false;
        return true;
      }
      return false;
    }
  });
  await durable.DposVault.setup({ password: PASSWORD });
  const newAccounts = JSON.parse(JSON.stringify(durable.DposVault.export()));
  newAccounts.golos_users = [{ login: 'restored' }];
  newAccounts.golos_current_user = { login: 'restored' };
  await assert.rejects(() => durable.DposVault.importWithStorageTransaction(newAccounts, [
    ['golos_node', 'https://new.node'], ['viz_transfer_templates', '["new"]']
  ]), /QuotaExceededError|vault|backup/i);
  assert.strictEqual(durableMap.get('golos_node'), 'https://new.node', 'forced rollback failure leaves a real partial setting for reload recovery');
  const activeJournal = durableMap.get('dpos_vault_v1');
  assert(activeJournal && !activeJournal.includes('restored') && !activeJournal.includes('https://old.node'), 'durable journal does not persist logical accounts or settings in plaintext');
  const reloaded = makeRealVaultContext(durableMap);
  await reloaded.DposVault.unlock({ password: PASSWORD });
  assert.strictEqual(durableMap.get('golos_node'), 'https://old.node', 'real vault reload retries and completes failed rollback');
  assert.strictEqual(durableMap.get('viz_transfer_templates'), '["old"]', 'real vault reload restores the full ordinary settings snapshot');
  assert.strictEqual(reloaded.DposVault.export().golos_users.length, 0, 'real reload keeps pre-import accounts until settings commit');
  await reloaded.DposVault.importWithStorageTransaction(newAccounts, [
    ['golos_node', 'https://new.node'], ['viz_transfer_templates', '["new"]']
  ]);
  assert.strictEqual(durableMap.get('golos_node'), 'https://new.node', 'verified transaction commits ordinary settings');
  assert.strictEqual(reloaded.DposVault.export().golos_users[0].login, 'restored', 'verified transaction activates accounts only at commit');

  const importRaceMap = new Map([['golos_node', 'https://old.node']]);
  let importRaceVault;
  let importRaceStagingWrites = 0;
  const importRace = makeRealVaultContext(importRaceMap, {
    failSet(key) {
      if (key === 'dpos_vault_v1_staging' && ++importRaceStagingWrites === 3) importRaceVault.DposVault.lock();
      return false;
    }
  });
  importRaceVault = importRace;
  await importRace.DposVault.setup({ password: PASSWORD });
  const raceAccounts = JSON.parse(JSON.stringify(importRace.DposVault.export()));
  raceAccounts.golos_users = [{ login: 'race-import' }];
  raceAccounts.golos_current_user = { login: 'race-import' };
  await assert.rejects(() => importRace.DposVault.importWithStorageTransaction(raceAccounts, [
    ['golos_node', 'https://new.node']
  ]), /заблокирован|изменён|отмен/i, 'locking during final crypto/staging must cancel the in-memory import completion');
  assert.strictEqual(importRace.DposVault.status().state, 'locked', 'a stale import completion cannot reopen a locked vault');
  assert.strictEqual(importRaceMap.get('golos_node'), 'https://old.node', 'pre-commit lock rolls ordinary settings back');
  await importRace.DposVault.unlock({ password: PASSWORD });
  assert.strictEqual(importRace.DposVault.export().golos_users.length, 0, 'pre-commit lock preserves old encrypted accounts');

  const unlockRaceMap = new Map([['golos_node', 'https://old.node']]);
  let journalStagingWrites = 0;
  let journalRollbackFailure = true;
  const journalVault = makeRealVaultContext(unlockRaceMap, {
    failSet(key, value) {
      if (key === 'dpos_vault_v1_staging' && ++journalStagingWrites === 3) return true;
      if (journalRollbackFailure && key === 'golos_node' && value === 'https://old.node') {
        journalRollbackFailure = false;
        return true;
      }
      return false;
    }
  });
  await journalVault.DposVault.setup({ password: PASSWORD });
  const journalAccounts = JSON.parse(JSON.stringify(journalVault.DposVault.export()));
  journalAccounts.golos_users = [{ login: 'never-committed' }];
  await assert.rejects(() => journalVault.DposVault.importWithStorageTransaction(journalAccounts, [['golos_node', 'https://new.node']]));

  let unlockRaceVault;
  let lockDuringRecovery = true;
  const unlockRace = makeRealVaultContext(unlockRaceMap, {
    failSet(key) {
      if (lockDuringRecovery && key === 'dpos_vault_v1_staging') {
        lockDuringRecovery = false;
        unlockRaceVault.DposVault.lock();
      }
      return false;
    }
  });
  unlockRaceVault = unlockRace;
  await assert.rejects(() => unlockRace.DposVault.unlock({ password: PASSWORD }), /изменено|отмен|заблокирован/i, 'lock during durable recovery must invalidate unlock completion');
  assert.strictEqual(unlockRace.DposVault.status().state, 'locked', 'recovery completion cannot reopen a vault locked during its await');
  await unlockRace.DposVault.unlock({ password: PASSWORD });
  assert.strictEqual(unlockRaceMap.get('golos_node'), 'https://old.node', 'a later unlock observes completed durable settings recovery');
  assert.strictEqual(unlockRace.DposVault.export().golos_users.length, 0, 'recovery retains pre-import accounts');

  const cleanupMap = new Map([['golos_node', 'https://old.node']]);
  let stagingRemovals = 0;
  const cleanupVault = makeRealVaultContext(cleanupMap, {
    failRemove(key) {
      return key === 'dpos_vault_v1_staging' && ++stagingRemovals === 2;
    }
  });
  await cleanupVault.DposVault.setup({ password: PASSWORD });
  const cleanupAccounts = JSON.parse(JSON.stringify(cleanupVault.DposVault.export()));
  cleanupAccounts.golos_users = [{ login: 'committed' }];
  cleanupAccounts.golos_current_user = { login: 'committed' };
  await cleanupVault.DposVault.importWithStorageTransaction(cleanupAccounts, [['golos_node', 'https://new.node']]);
  assert.strictEqual(cleanupMap.get('golos_node'), 'https://new.node', 'staging cleanup failure does not roll back committed settings');
  assert.strictEqual(cleanupVault.DposVault.export().golos_users[0].login, 'committed', 'staging cleanup failure does not roll back committed accounts');

  const commitRaceMap = new Map([['golos_node', 'https://old.node']]);
  let commitRaceVault;
  let activeWrites = 0;
  const commitRace = makeRealVaultContext(commitRaceMap, {
    failSet(key) {
      if (key === 'dpos_vault_v1' && ++activeWrites === 3) commitRaceVault.DposVault.lock();
      return false;
    }
  });
  commitRaceVault = commitRace;
  await commitRace.DposVault.setup({ password: PASSWORD });
  const committedRaceAccounts = JSON.parse(JSON.stringify(commitRace.DposVault.export()));
  committedRaceAccounts.golos_users = [{ login: 'commit-race' }];
  committedRaceAccounts.golos_current_user = { login: 'commit-race' };
  await assert.rejects(() => commitRace.DposVault.importWithStorageTransaction(committedRaceAccounts, [['golos_node', 'https://new.node']]), /заблокирован|изменено|отмен/i);
  assert.strictEqual(commitRace.DposVault.status().state, 'locked', 'lock at the final active write remains authoritative');
  assert.strictEqual(commitRaceMap.get('golos_node'), 'https://new.node', 'a lock after the commit point does not roll committed settings back');
  await commitRace.DposVault.unlock({ password: PASSWORD });
  assert.strictEqual(commitRace.DposVault.export().golos_users[0].login, 'commit-race', 'the committed encrypted accounts remain recoverable after a commit-point lock');

  console.log('v3 backup transactional restore tests passed');
}

run().catch(error => {
  console.error(error);
  process.exit(1);
});
