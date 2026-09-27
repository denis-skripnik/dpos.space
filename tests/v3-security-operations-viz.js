const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

function fakeElement(extra = {}) {
  return Object.assign({ innerHTML: '', textContent: '', value: '', disabled: false, hidden: false, dataset: {}, style: {}, addEventListener() {}, setAttribute() {}, removeAttribute() {}, appendChild() {}, querySelector: () => null, querySelectorAll: () => [], closest: () => fakeElement() }, extra);
}
let loadedContext;
function loadOperations() {
  const context = {
    console, URLSearchParams, TextEncoder, TextDecoder, Blob, setTimeout, clearTimeout, crypto: require('crypto').webcrypto,
    location: { hash: '#chain=viz&app=manage', origin: 'https://example.test', hostname: 'example.test', pathname: '/' },
    addEventListener() {}, localStorage: { getItem: () => null, setItem() {}, removeItem() {}, key: () => null, length: 0 }, navigator: {}, FormData: class {},
    document: { getElementById: () => fakeElement({ dataset: {} }), querySelector: () => null, createElement: () => fakeElement({ click() {}, remove() {} }), body: fakeElement(), head: fakeElement() },
    DposChains: { viz: { id: 'viz', title: 'VIZ', apps: [{ id: 'manage', title: 'Manage' }], defaultAccount: '' } },
    DposAuth: { getUsers: () => [], getCurrentUser: () => null, getCurrentLogin: () => 'alice', getUserLogin: () => '', getUserType: () => 'standard' },
    DposBroadcast: {}, DposProfiles: { formatError: (error) => error.message }, DposHistory: {}, DposNotifications: null
  };
  context.globalThis = context; context.window = context; vm.createContext(context);
  vm.runInContext(fs.readFileSync('v3/vendor/viz/viz.min.js', 'utf8'), context);
  vm.runInContext(fs.readFileSync('v3/js/app.js', 'utf8'), context, { filename: 'v3/js/app.js' });
  loadedContext = context;
  return context.DposV3.securityOperations;
}

(() => {
  const operations = loadOperations();
  const state = operations.createVizInviteBatchState();
  let serial = 0;
  operations.generateVizInviteBatch(state, { count: 2, amount: '1.000 VIZ' }, () => `secret-${++serial}`, (secret) => `public-${secret}`);
  assert.throws(() => operations.buildVizCreateInviteOperations(state, { count: 2, account: 'alice', amount: '1.000 VIZ' }), /backup/i, 'create batch cannot be sent before backup acknowledgement');
  const pendingSnapshot = JSON.stringify(state);
  assert.throws(() => operations.resetVizInviteBatch(state), /backup/i);
  assert.throws(() => operations.generateVizInviteBatch(state, { count: 3, amount: '2.000 VIZ' }, () => 'new', s => s), /backup/i);
  assert.strictEqual(JSON.stringify(state), pendingSnapshot, 'edits and regeneration cannot discard an unbacked batch');
  assert.throws(() => operations.downloadVizInviteBatch(state, () => { throw new Error('download failed'); }), /download failed/);
  assert.strictEqual(JSON.stringify(state), pendingSnapshot, 'failed download does not mark backup or erase secrets');
  let downloaded;
  operations.downloadVizInviteBatch(state, text => { downloaded = text; });
  assert.strictEqual(downloaded, 'secret-1\r\nsecret-2');
  assert.strictEqual(state.backedUpBatchId, null, 'download initiation is not proof that the file was saved');
  const backedUp = operations.acknowledgeVizInviteBatchBackup(state);
  assert.deepStrictEqual(Array.from(backedUp), ['secret-1', 'secret-2'], 'backup acknowledgement covers the exact generated secrets');
  const ops = operations.buildVizCreateInviteOperations(state, { count: 2, account: 'alice', amount: '1.000 VIZ' });
  assert.deepStrictEqual(JSON.parse(JSON.stringify(ops)), [
    ['create_invite', { creator: 'alice', balance: '1.000 VIZ', invite_key: 'public-secret-1' }],
    ['create_invite', { creator: 'alice', balance: '1.000 VIZ', invite_key: 'public-secret-2' }]
  ], 'send uses the acknowledged generated batch without generating secrets');
  assert.throws(() => operations.buildVizCreateInviteOperations(state, { count: 3, account: 'alice', amount: '1.000 VIZ' }), /сгенерируйте/i, 'changing batch count requires a new Generate step');
  assert.throws(() => operations.buildVizCreateInviteOperations(state, { count: 2, account: 'alice', amount: '2.000 VIZ' }), /сгенерируйте/i, 'changing batch amount requires a new Generate step');
  operations.resetVizInviteBatch(state);
  assert.throws(() => operations.buildVizCreateInviteOperations(state, { count: 2, account: 'alice', amount: '1.000 VIZ' }), /сгенерируйте/i, 'switching away from create mode clears the secret batch');
  operations.generateVizInviteBatch(state, { count: 1, amount: '3.000 VIZ' }, () => `secret-${++serial}`, (secret) => `public-${secret}`);
  assert.throws(() => operations.buildVizCreateInviteOperations(state, { count: 1, account: 'alice', amount: '3.000 VIZ' }), /backup/i, 'regeneration invalidates prior backup acknowledgement');

  const cached = operations.getVizInviteBatchState('alice');
  operations.generateVizInviteBatch(cached, { count: 1, amount: '1.000 VIZ' }, () => 'cached-secret', s => 'pub-' + s);
  assert.strictEqual(operations.getVizInviteBatchState('alice'), cached, 'route redraw retains the same batch');
  assert.notStrictEqual(operations.getVizInviteBatchState('bob'), cached, 'another account cannot replace this batch');

  const current = {
    name: 'alice',
    master_authority: { weight_threshold: 1, account_auths: [], key_auths: [['VIZMASTER', 1]] },
    active_authority: { weight_threshold: 2, account_auths: [['old-active', 2]], key_auths: [['VIZACTIVE', 1]] },
    regular_authority: { weight_threshold: 1, account_auths: [], key_auths: [['VIZREGULAR', 1]] },
    memo_key: 'VIZMEMO', json_metadata: '{"profile":{"name":"Alice"}}'
  };
  const update = operations.buildVizAuthorityUpdate(current, 'regular', 2, [['bob', 1], ['carol', 1]]);
  assert.strictEqual(update.active, undefined, 'unselected active authority is omitted so concurrent changes cannot be overwritten');
  assert.deepStrictEqual(JSON.parse(JSON.stringify(update.regular)), { weight_threshold: 2, account_auths: [['bob', 1], ['carol', 1]], key_auths: [] }, 'selected regular authority is replaced');
  assert.strictEqual(update.memoKey, current.memo_key, 'memo key is preserved');
  assert.strictEqual(update.jsonMetadata, current.json_metadata, 'metadata is preserved');
  assert(update.diff.includes('До') && update.diff.includes('После') && update.diff.includes('@bob: 1'), 'authority update provides a readable before/after diff');
  assert.throws(() => operations.buildVizAuthorityUpdate(current, 'regular', 3, [['bob', 1], ['carol', 1]]), /порог/i, 'unsatisfiable authority threshold is rejected');

  const replacementKeys = vm.runInContext(`(() => {
    const generated = viz.auth.getPrivateKeys('alice', 'full reset fixture', ['master', 'active', 'regular', 'memo']);
    return { masterPubkey: generated.masterPubkey, activePubkey: generated.activePubkey, regularPubkey: generated.regularPubkey, memoPubkey: generated.memoPubkey };
  })()`, loadedContext);
  const reset = operations.buildVizFullKeyReset(current, 'alice', replacementKeys);
  assert.strictEqual(reset.args[5], current.json_metadata, 'full reset preserves metadata byte-for-byte');
  assert.strictEqual(reset.args[0], 'alice');
  assert.strictEqual(reset.args[1].key_auths[0][0], replacementKeys.masterPubkey, 'real vendored SDK accepts a generated master public key');
  assert.throws(() => operations.buildVizFullKeyReset(current, 'alice', Object.assign({}, replacementKeys, { activePubkey: 'VIZ-not-a-key' })), /active.*публичн/i, 'malformed manual public key is rejected before preparation/signing');
  assert.throws(() => operations.buildVizFullKeyReset(Object.assign({}, current, { json_metadata: null }), 'alice', replacementKeys), /metadata/i, 'non-string metadata is never coerced to empty JSON');
  const emptyMetadataReset = operations.buildVizFullKeyReset(Object.assign({}, current, { json_metadata: '' }), 'alice', replacementKeys);
  assert.strictEqual(emptyMetadataReset.args[5], '', 'an exact empty metadata string is preserved rather than replaced');
  assert.doesNotThrow(() => operations.assertVizFullKeyResetCurrent(reset.expectedRevision, current, 'alice'));
  assert.throws(() => operations.assertVizFullKeyResetCurrent(reset.expectedRevision, Object.assign({}, current, { memo_key: 'VIZCHANGED' }), 'alice'), /изменились/i, 'old preview is rejected when memo changes');
  assert.throws(() => operations.assertVizFullKeyResetCurrent(reset.expectedRevision, Object.assign({}, current, { active_authority: { weight_threshold: 1, account_auths: [], key_auths: [['VIZCHANGED', 1]] } }), 'alice'), /изменились/i, 'old preview is rejected when an authority changes');
  assert.throws(() => operations.assertVizFullKeyResetCurrent(reset.expectedRevision, Object.assign({}, current, { json_metadata: '{}' }), 'alice'), /изменились/i, 'old preview is rejected when metadata changes');
  assert.throws(() => operations.assertVizFullKeyResetCurrent(reset.expectedRevision, Object.assign({}, current, { name: 'mallory' }), 'alice'), /аккаунт/i, 'old preview cannot be sent for a different account');

  for (const threshold of [NaN, 0, -1, 1.5, 4294967296]) {
    assert.throws(() => operations.buildVizAuthorityUpdate(current, 'regular', threshold, [['bob', 2]]), /порог/i);
  }
  for (const rows of [[['bob', 1], ['bob', 1]], [['bob', 0.5]], [['bob', 65536]]]) {
    assert.throws(() => operations.buildVizAuthorityUpdate(current, 'regular', 1, rows), /вес|повтор/i);
  }

  const sdk = { console, setTimeout, clearTimeout, crypto: require('crypto').webcrypto };
  sdk.updateJson = JSON.stringify(update);
  sdk.resetArgsJson = JSON.stringify(reset.args);
  sdk.window = sdk; vm.createContext(sdk);
  vm.runInContext(fs.readFileSync('v3/vendor/viz/viz.min.js', 'utf8'), sdk);
  const result = vm.runInContext(`(() => {
    const wif = viz.auth.toWif('alice', 'serializer fixture', 'active');
    const publicKey = viz.auth.wifToPublic(wif);
    const candidate = JSON.parse(updateJson);
    const tx = { ref_block_num: 1, ref_block_prefix: 1, expiration: '2030-01-01T00:00:00', operations: [
      ['account_update', { account: 'alice', master: undefined, active: candidate.active, regular: candidate.regular, memo_key: publicKey, json_metadata: candidate.jsonMetadata }]
    ], extensions: [] };
    const signed = viz.auth.signTransaction(tx, [wif]);
    const resetArgs = JSON.parse(resetArgsJson);
    const resetTx = { ref_block_num: 1, ref_block_prefix: 1, expiration: '2030-01-01T00:00:00', operations: [
      ['account_update', { account: resetArgs[0], master: resetArgs[1], active: resetArgs[2], regular: resetArgs[3], memo_key: resetArgs[4], json_metadata: resetArgs[5] }]
    ], extensions: [] };
    const signedReset = viz.auth.signTransaction(resetTx, [wif]);
    return { validKey: viz.auth.isPubkey(publicKey), signatures: signed.signatures.length, active: signed.operations[0][1].active, resetSignatures: signedReset.signatures.length, resetMetadata: signedReset.operations[0][1].json_metadata };
  })()`, sdk);
  assert.strictEqual(result.validKey, true, 'real browser bundle accepts its public keys in a browser realm');
  assert.strictEqual(result.signatures, 1, 'actual VIZ serializer signs optional-master/active authority update without broadcasting');
  assert.strictEqual(result.active, undefined, 'omitted active authority is not serialized as an empty authority');
  assert.strictEqual(result.resetSignatures, 1, 'actual vendored VIZ serializer signs the validated full-reset operation');
  assert.strictEqual(result.resetMetadata, current.json_metadata, 'actual serializer retains exact full-reset metadata');
  console.log('v3 security VIZ invite and authority operations passed');
})();
