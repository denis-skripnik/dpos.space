const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}
function fakeElement(extra = {}) {
  return Object.assign({
    innerHTML: '', textContent: '', value: '', disabled: false, hidden: false,
    dataset: {}, style: {}, addEventListener() {}, setAttribute() {}, removeAttribute() {}, appendChild() {}, querySelector: () => null, querySelectorAll: () => [], closest: () => fakeElement()
  }, extra);
}
function loadOperations() {
  const context = {
    console, URLSearchParams, TextEncoder, TextDecoder, Blob,
    location: { hash: '#chain=golos&app=help', origin: 'https://example.test', hostname: 'example.test', pathname: '/' },
    addEventListener() {}, confirm: () => true,
    localStorage: { getItem: () => null, setItem() {}, removeItem() {}, key: () => null, length: 0 },
    navigator: {}, FormData: class {},
    document: { getElementById: () => fakeElement({ dataset: {} }), querySelector: () => null, createElement: () => fakeElement({ click() {}, remove() {} }), body: fakeElement(), head: fakeElement() },
    DposChains: { golos: { id: 'golos', title: 'Golos', apps: [{ id: 'help', title: 'Help' }], defaultAccount: '' } },
    DposAuth: { getUsers: () => [], getCurrentUser: () => null, getCurrentLogin: () => '', getUserLogin: () => '', getUserType: () => 'standard' },
    DposBroadcast: {}, DposProfiles: { formatError: (error) => error.message }, DposHistory: {}, DposNotifications: null
  };
  context.globalThis = context;
  context.window = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync('v3/js/app.js', 'utf8'), context, { filename: 'v3/js/app.js' });
  return context.DposV3.securityOperations;
}

(async () => {
  const operations = loadOperations();
  assert(operations && typeof operations.createOperationSubmitHandler === 'function', 'operation submission behavior is testable');
  const nativeStartGuard = operations.captureAndroidStartGuard();
  nativeStartGuard();
  await operations.callAndroidWorkerBridge('stopWorker');
  assert.throws(nativeStartGuard, /отменён/);
  operations.captureAndroidStartGuard()();
  const gate = deferred();
  const buttons = [{ disabled: false }, { disabled: false }];
  const form = { querySelectorAll: () => buttons };
  let mutableAmount = '1.000 GOLOS';
  let broadcasts = 0;
  let confirmedPrepared;
  let sentPrepared;
  const handler = operations.createOperationSubmitHandler({
    chain: { id: 'golos' }, form,
    makeFormData: () => new Map([['amount', mutableAmount]]),
    loadDependencies: async () => { await gate.promise; },
    buildPrepared: (snapshot) => ({ amount: snapshot.get('amount'), nonce: {} }),
    summary: (prepared) => { confirmedPrepared = prepared; return prepared.amount; },
    confirm: () => true,
    connect: async () => {},
    broadcast: async (_chain, prepared) => { broadcasts += 1; sentPrepared = prepared; return { ok: true }; },
    setResult() {}, refresh() {}, getHash: () => '#same', formatError: (error) => error.message
  });

  const sendPromise = handler({ preventDefault() {}, submitter: { value: 'send' } });
  assert(buttons.every((button) => button.disabled), 'all submit controls lock synchronously before the first await');
  mutableAmount = '999.000 GOLOS';
  await handler({ preventDefault() {}, submitter: { value: 'preview' } });
  assert(buttons.every((button) => button.disabled), 'a concurrent Preview cannot unlock the active Send');
  gate.resolve();
  await sendPromise;
  assert.strictEqual(broadcasts, 1, 'only one broadcaster invocation is allowed');
  assert.strictEqual(sentPrepared.amount, '1.000 GOLOS', 'the submission uses the synchronous FormData snapshot');
  assert.strictEqual(sentPrepared, confirmedPrepared, 'the exact prepared payload shown to confirm is broadcast');
  assert(buttons.every((button) => !button.disabled), 'the owning submission unlocks controls when finished');
  const stale = operations.createOperationSubmitHandler({
    chain: { id: 'viz' }, form, makeFormData: () => new Map(), loadDependencies: async () => {},
    buildPrepared: () => ({ beforeBroadcast: async () => { throw new Error('authority changed'); } }),
    summary: () => '', confirm: () => true, connect: async () => {},
    broadcast: async () => { broadcasts += 1; }, setResult() {}, refresh() {}, getHash: () => '#same', formatError: error => error.message
  });
  await stale({ preventDefault() {}, submitter: { value: 'send' } });
  assert.strictEqual(broadcasts, 1, 'changed on-chain authority must abort before sending');
  console.log('v3 security operations single-flight passed');
})().catch((error) => { console.error(error); process.exit(1); });
