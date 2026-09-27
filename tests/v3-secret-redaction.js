const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const WIF = `5${'A'.repeat(50)}`;
const MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const ORDINARY_MEMO = 'we reviewed the public proposal and agreed to publish final notes tomorrow';
const ORDINARY_MEMOS = [
  ORDINARY_MEMO,
  'we reviewed the public proposal and agreed to publish final notes tomorrow because everyone wanted a clear record for the community meeting next week',
  'abandon ability able about above absent absorb abstract absurd abuse access accident'
];

function loadRuntime() {
  const context = {
    window: null,
    console,
    DposAuth: {
      getCurrentUser: () => null,
      getUserLogin: () => '',
      getUserType: () => 'standard'
    }
  };
  context.window = context;
  vm.createContext(context);
  for (const file of ['v3/js/bip39.js', 'v3/js/broadcast.js', 'v3/js/profiles.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
  }
  return context;
}

async function run() {
  const context = loadRuntime();
  const broadcast = context.DposBroadcast;
  assert(!broadcast.sanitizeDiagnostic(`RPC: ${MNEMONIC.toUpperCase()}; failed`).includes('ABANDON'), 'embedded uppercase mnemonic is redacted');
  assert.strictEqual(broadcast.sanitizeDiagnostic({ privateSigningKey: 'fixture', encryptionSeed: 'fixture' }).privateSigningKey, '[redacted]', 'qualified private-key fields are redacted');
  assert.strictEqual(broadcast.sanitizeDiagnostic({ encryptionSeed: 'fixture' }).encryptionSeed, '[redacted]', 'qualified seed fields are redacted');
  assert(!broadcast.sanitizeDiagnostic('RPC password=fixture-value failed').includes('fixture-value'), 'plain diagnostic credential assignment is redacted');
  assert(!broadcast.sanitizeDiagnostic('Authorization: Bearer fixture-token').includes('fixture-token'), 'authorization header is redacted');

  assert.strictEqual(
    broadcast.sanitizeDiagnostic(`RPC failed for ${WIF} while retrying`),
    'RPC failed for [redacted-wif] while retrying',
    'embedded WIF is removed from diagnostic strings'
  );
  assert.strictEqual(
    broadcast.sanitizeDiagnostic(`seed phrase: ${MNEMONIC}; do not share`),
    'seed phrase: [redacted-seed]; do not share',
    'embedded checksum-valid mnemonic is removed from diagnostic strings'
  );
  for (const memo of ORDINARY_MEMOS) {
    assert.strictEqual(
      broadcast.sanitizeDiagnostic(memo),
      memo,
      'ordinary prose and checksum-invalid wordlist phrases are not treated as seeds'
    );
  }
  assert.strictEqual(
    broadcast.sanitizeDiagnostic('RPC payload: {"password":"diagnostic-only","account":"alice"}'),
    'RPC payload: {"password":"[redacted]","account":"alice"}',
    'credentials in embedded JSON are redacted without hiding public fields'
  );

  const serialized = JSON.stringify({
    token: 'DEL',
    tokenAddress: `0x${'a'.repeat(40)}`,
    nested: { password: 'hunter-example', credential: WIF },
    error: `bad signer ${WIF}`
  });
  const sanitizedSerialized = broadcast.sanitizeDiagnostic(serialized);
  const parsed = JSON.parse(sanitizedSerialized);
  assert.strictEqual(parsed.token, 'DEL', 'public token symbols remain visible');
  assert.strictEqual(parsed.tokenAddress, `0x${'a'.repeat(40)}`, 'public token addresses remain visible');
  assert.strictEqual(parsed.nested.password, '[redacted]', 'nested passwords are redacted');
  assert.strictEqual(parsed.nested.credential, '[redacted]', 'nested credentials are redacted');
  assert(!sanitizedSerialized.includes(WIF), 'serialized JSON does not leak embedded WIF values');

  const structured = broadcast.sanitizeDiagnostic({
    apiToken: 'opaque-credential-value-1234567890',
    token: 'USDT',
    symbol: 'VIZ',
    publicKey: 'GLS1111111111111111111111111111111114T1Anm',
    contractAddress: `0x${'b'.repeat(40)}`
  });
  assert.strictEqual(structured.apiToken, '[redacted]', 'credential token fields are redacted');
  assert.strictEqual(structured.token, 'USDT', 'ordinary public token field is preserved');
  assert.strictEqual(structured.symbol, 'VIZ', 'public symbol field is preserved');
  assert.strictEqual(structured.publicKey, 'GLS1111111111111111111111111111111114T1Anm', 'intentional public key exports remain visible');
  assert.strictEqual(structured.contractAddress, `0x${'b'.repeat(40)}`, 'public address field is preserved');

  const formattedError = context.DposProfiles.formatError({
    message: `RPC rejected ${WIF}`,
    password: 'not-for-output'
  });
  assert(!formattedError.includes(WIF), 'profile error formatting sanitizes embedded WIF');
  assert(formattedError.includes('[redacted-wif]'), 'profile errors retain useful redaction marker');

  const prepared = broadcast.prepareExternal(
    { id: 'viz' },
    'custom',
    ['alice', 7, JSON.stringify({ memo: `publish ${WIF}` })]
  );
  assert(prepared.meta.warnings.some((warning) => /secret|WIF|секрет/i.test(warning)), 'public custom payload gets an accidental-secret warning');
  assert.strictEqual(prepared.params[2], JSON.stringify({ memo: `publish ${WIF}` }), 'warning does not mutate intended transaction data');

  await assert.rejects(
    broadcast.broadcast({ id: 'viz' }, prepared, { confirmExecute: true }),
    /секрет|secret|WIF/i,
    'real broadcast rejects accidental secret in public custom payload'
  );

  const prosePrepared = broadcast.prepareExternal(
    { id: 'viz' },
    'custom',
    ['external-signed-payload', 7, ORDINARY_MEMO],
    { signerType: 'vizonator' }
  );
  assert.strictEqual(prosePrepared.meta.warnings.length, 1, 'ordinary prose does not add a secret warning');
  context.vizonator = {
    get_account: (callback) => callback(null, { login: 'external-signed-payload' }),
    custom: (_payload, callback) => callback(null, { accepted: true })
  };
  assert.deepStrictEqual(
    await broadcast.broadcast({ id: 'viz' }, prosePrepared, { confirmExecute: true }),
    { accepted: true },
    'ordinary 12-word memo reaches the injected no-network broadcaster'
  );

  for (const payload of [
    `memo before ${MNEMONIC} memo after`,
    'status {"password":"do-not-publish","account":"alice"}'
  ]) {
    const guarded = broadcast.prepareExternal({ id: 'viz' }, 'custom', ['alice', 7, payload]);
    await assert.rejects(
      broadcast.broadcast({ id: 'viz' }, guarded, { confirmExecute: true }),
      /секрет|secret|credential/i,
      `broadcast rejects protected public payload: ${payload.slice(0, 24)}`
    );
  }

  console.log('v3 secret redaction: ok');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
