const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const ACTIVE_WIF = '5AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const POSTING_WIF = '5BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB';
const REGULAR_WIF = '5CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC';
const SERVICE_WIF = '5DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD';

function publicFromWif(key) {
  return `PUB_${key.slice(1, 12)}`;
}

function createLocalStorage() {
  const store = new Map();
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    }
  };
}

function createContext() {
  const localStorage = createLocalStorage();
  const context = {
    window: null,
    localStorage,
    sjcl: {
      encrypt(passphrase, value) {
        return JSON.stringify({ passphrase, value });
      },
      decrypt(passphrase, encrypted) {
        const parsed = JSON.parse(encrypted);
        if (parsed.passphrase !== passphrase) {
          throw new Error('wrong passphrase');
        }
        return parsed.value;
      }
    }
  };
  context.window = context;
  vm.createContext(context);
  for (const file of ['v3/js/auth.js', 'v3/js/broadcast.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
  }
  return context;
}

function seedLegacy(context, chainId, login) {
  const authority = chainId === 'viz' ? 'regular' : 'posting';
  const signingWif = authority === 'regular' ? REGULAR_WIF : POSTING_WIF;
  const user = {
    login,
    active: context.sjcl.encrypt(`dpos.space_${chainId}_${login}_activeKey`, ACTIVE_WIF)
  };
  user[authority] = context.sjcl.encrypt(`dpos.space_${chainId}_${login}_${authority}Key`, signingWif);
  context.localStorage.setItem(`${chainId}_users`, JSON.stringify([user]));
  context.localStorage.setItem(`${chainId}_current_user`, JSON.stringify(user));
  context.localStorage.setItem(`${chainId}_node`, `https://${chainId}.example`);
  return user;
}

async function run() {
  const context = createContext();
  const chains = {
    golos: { id: 'golos', title: 'Golos', libraryGlobal: 'golos', liquidSymbol: 'GOLOS', debtSymbol: 'GBG', vestingSymbol: 'GESTS' },
    viz: { id: 'viz', title: 'VIZ', libraryGlobal: 'viz', liquidSymbol: 'VIZ', vestingSymbol: 'SHARES' },
    hive: { id: 'hive', title: 'Hive', libraryGlobal: 'hive', liquidSymbol: 'HIVE', debtSymbol: 'HBD', vestingSymbol: 'VESTS' },
    steem: { id: 'steem', title: 'Steem', libraryGlobal: 'steem', liquidSymbol: 'STEEM', debtSymbol: 'SBD', vestingSymbol: 'VESTS' }
  };

  for (const [chainId, chain] of Object.entries(chains)) {
    const login = `${chainId}-user`;
    seedLegacy(context, chainId, login);

    assert.strictEqual(context.DposAuth.getUsers(chain)[0].login, login, `${chainId}: reads legacy users`);
    assert.strictEqual(context.DposAuth.getCurrentLogin(chain), login, `${chainId}: reads current user`);

    const authority = chainId === 'viz' ? 'regular' : 'posting';
    const expectedSigningKey = authority === 'regular' ? REGULAR_WIF : POSTING_WIF;
    const prepared = context.DposBroadcast.prepare(chain, 'posting', 'transfer', [login, 'receiver', `1.000 ${chain.liquidSymbol}`, 'memo']);
    assert.strictEqual(prepared.authority, authority, `${chainId}: authority mapping`);
    assert.strictEqual(prepared.getPrivateKey(), expectedSigningKey, `${chainId}: decrypts legacy ${authority}`);

    const preview = JSON.stringify(context.DposBroadcast.sanitizePrepared(prepared));
    assert(!preview.includes('private'), `${chainId}: preview has no private key field`);
    assert(!preview.includes(expectedSigningKey), `${chainId}: preview has no private key value`);

    const calls = [];
    context[chain.libraryGlobal] = {
      auth: {
        wifToPublic: publicFromWif
      },
      api: {
        getAccountsAsync(accounts) {
          return Promise.resolve(accounts.map((account) => ({
            name: account,
            posting: { key_auths: [[publicFromWif(POSTING_WIF), 1]] },
            regular: { key_auths: [[publicFromWif(REGULAR_WIF), 1]] },
            active: { key_auths: [[publicFromWif(ACTIVE_WIF), 1], [publicFromWif(SERVICE_WIF), 1]] }
          })));
        }
      },
      broadcast: {
        transferAsync(key, ...args) {
          calls.push(['transferAsync', key, ...args]);
          return Promise.resolve({ id: `${chainId}-tx`, privateKey: key, nested: { wif: key } });
        },
        inviteRegistrationAsync(key, ...args) {
          calls.push(['inviteRegistrationAsync', key, ...args]);
          return Promise.resolve({ id: `${chainId}-invite`, privateKey: key });
        },
        accountCreateWithInviteAsync(key, ...args) {
          calls.push(['accountCreateWithInviteAsync', key, ...args]);
          return Promise.resolve({ id: `${chainId}-invite`, privateKey: key });
        },
        sendOperationsAsync(operations, key) {
          calls.push(['sendOperationsAsync', operations, key]);
          return Promise.resolve({ id: `${chainId}-ops` });
        }
      }
    };

    const result = await context.DposBroadcast.broadcast(chain, prepared, { confirmExecute: true });
    assert.strictEqual(calls[0][0], 'transferAsync', `${chainId}: calls async broadcast method`);
    assert.strictEqual(calls[0][1], expectedSigningKey, `${chainId}: signs with decrypted key`);
    const sanitizedResult = JSON.stringify(context.DposBroadcast.sanitizeResult(result));
    assert(!sanitizedResult.includes(expectedSigningKey), `${chainId}: result sanitizer redacts key echoes`);

    await context.DposBroadcast.broadcast(chain, context.DposBroadcast.prepare(chain, 'active', 'sendOperations', [[['vote', { voter: login }]]]), { confirmExecute: true });
    assert.strictEqual(calls[1][0], 'sendOperationsAsync', `${chainId}: sendOperations uses library helper`);
    assert.strictEqual(calls[1][2], ACTIVE_WIF, `${chainId}: sendOperations uses active key when requested`);

    assert.strictEqual(context.DposBroadcast.validateAccountName(chain, login, 'Account'), login, `${chainId}: validates account`);
    assert.strictEqual(context.DposBroadcast.validateAsset(chain, `1.000 ${chain.liquidSymbol}`, chain.liquidSymbol, 'Amount'), `1.000 ${chain.liquidSymbol}`, `${chainId}: validates liquid amount`);
    assert.throws(() => context.DposBroadcast.validateRequestId(-1), /Request ID/, `${chainId}: validates request id`);
  }

  const golos = chains.golos;
  const publicKey = 'GLS_PUBLIC_NEW_ACCOUNT_KEY';
  const authObject = { weight_threshold: 1, account_auths: [], key_auths: [[publicKey, 1]] };
  const golosInvite = context.DposBroadcast.prepareWithPrivateKey(golos, 'dpos.space-reg', 'active', SERVICE_WIF, 'accountCreateWithInvite', [
    'invite-secret', 'dpos.space-reg', 'new-golos-user', authObject, authObject, authObject, publicKey, '', []
  ], { title: 'Golos account_create_with_invite' });
  assert.strictEqual(golosInvite.getPrivateKey(), SERVICE_WIF, 'golos invite registration uses explicit service WIF');
  assert(!JSON.stringify(context.DposBroadcast.sanitizePrepared(golosInvite)).includes(SERVICE_WIF), 'golos invite preview does not leak explicit service WIF');
  await context.DposBroadcast.broadcast(golos, golosInvite, { confirmExecute: true });
  assert.strictEqual(context.golos.broadcast.accountCreateWithInviteAsync ? 'available' : 'missing', 'available', 'golos invite broadcast method is mocked');

  const viz = chains.viz;
  const vizInvite = context.DposBroadcast.prepareWithPrivateKey(viz, 'invite', 'active', SERVICE_WIF, 'inviteRegistration', [
    'invite', 'new-viz-user', 'invite-secret', 'VIZ_PUBLIC_NEW_ACCOUNT_KEY'
  ], { title: 'VIZ invite registration' });
  assert.strictEqual(vizInvite.getPrivateKey(), SERVICE_WIF, 'viz invite registration uses explicit invite/service WIF');
  assert(!JSON.stringify(context.DposBroadcast.sanitizePrepared(vizInvite)).includes(SERVICE_WIF), 'viz invite preview does not leak explicit service WIF');
  const vizResult = await context.DposBroadcast.broadcast(viz, vizInvite, { confirmExecute: true });
  assert(!JSON.stringify(context.DposBroadcast.sanitizeResult(vizResult)).includes(SERVICE_WIF), 'viz invite result does not leak explicit service WIF');

  const sourceFiles = fs.readdirSync(path.join(root, 'v3/js')).map((file) => path.join(root, 'v3/js', file))
    .concat([path.join(root, 'tests/v3-auth-broadcast-smoke.js')]);
  const forbiddenLegacyWifs = [
    '5KjRPYZw' + '3YUcmWydxS55xg7FE9t6aAZzrdHQSph9343u92qpDLX',
    '5KcfoRu' + 'DfkhrLCxVcE9x51J6KN9aM9fpb78tLrvvFckxVV6FyFW'
  ];
  for (const file of sourceFiles) {
    const text = fs.readFileSync(file, 'utf8');
    for (const forbidden of forbiddenLegacyWifs) {
      assert(!text.includes(forbidden), `${path.relative(root, file)} must not contain legacy hardcoded WIF ${forbidden.slice(0, 8)}...`);
    }
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
