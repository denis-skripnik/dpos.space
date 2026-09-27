const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function deferred() { let resolve; let reject; const promise = new Promise((done, fail) => { resolve = done; reject = fail; }); return { promise, resolve, reject }; }
function withTimeout(promise, label, ms = 1500) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms); })
  ]).finally(() => clearTimeout(timer));
}
function element() {
  return {
    innerHTML: '', textContent: '', value: '', disabled: false, hidden: false,
    dataset: {}, style: {}, options: [],
    addEventListener() {}, setAttribute() {}, removeAttribute() {}, appendChild() {},
    querySelector: () => null, querySelectorAll: () => [], closest: () => null,
    hasAttribute: () => false
  };
}

(async () => {
  const root = path.resolve(__dirname, '..');
  const appSource = fs.readFileSync(path.join(root, 'v3/js/app.js'), 'utf8');
  const elements = new Map();
  const get = id => elements.has(id) ? elements.get(id) : (elements.set(id, element()), elements.get(id));
  const accountGate = deferred();
  let fetchStarted = false;
  let historyStarted = false;
  const loggedErrors = [];
  const listeners = {};
  const context = {
    console: Object.assign({}, console, { error(value) { loggedErrors.push(String(value)); } }), URLSearchParams, Blob, setTimeout, clearTimeout,
    location: { hash: '#chain=golos&app=profiles&account=alice', origin: 'https://dpos.test', hostname: 'dpos.test', pathname: '/' },
    navigator: {}, localStorage: { getItem: () => null, setItem() {}, removeItem() {}, key: () => null, length: 0 },
    addEventListener(name, callback) { listeners[name] = callback; },
    document: { getElementById: get, querySelector: () => null, querySelectorAll: () => [], createElement: element, body: element(), head: element() },
    DposChains: { golos: { id: 'golos', title: 'Golos', apps: [{ id: 'profiles', title: 'Profile' }, { id: 'wallet', title: 'Wallet' }, { id: 'explorer', title: 'Explorer' }, { id: 'post', title: 'Post' }, { id: 'history', title: 'History' }, { id: 'help', title: 'Help' }], defaultAccount: '' } },
    DposAuth: { getUsers: () => [], getCurrentUser: () => null, getCurrentLogin: () => '', getUserLogin: () => '', getUserType: () => 'standard', getKeyStatus: () => ({}) },
    DposBroadcast: {
      sanitizeDiagnostic(value) { return String(value).replace(/5[1-9A-HJ-NP-Za-km-z]{45,55}/g, '[redacted-wif]'); }
    },
    DposProfiles: {
      formatError: error => error.message,
      async connect(chain) { return { chain }; },
      async fetchAccount() { fetchStarted = true; return accountGate.promise; },
      async enrichAccount(_connection, account) { return account; },
      normalizeAccount(_connection, account) { return Object.assign({ balances: [], node: 'stub-node', raw: {} }, account); }
    },
    DposHistory: {
      operationTitle: value => value,
      formatDate: value => value,
      async fetchAccountHistory() { return []; }
    }, DposNotifications: null
  };
  context.window = context; context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(appSource, context, { filename: 'v3/js/app.js' });
  for (let turn = 0; turn < 10 && !fetchStarted; turn += 1) await Promise.resolve();
  assert(fetchStarted, 'the old profile route reached a real delayed async renderer boundary');

  context.location.hash = '#chain=golos&app=help';
  await context.DposV3.renderRoute();
  const freshHtml = get('app').innerHTML;
  assert(!freshHtml.includes('Загрузка профиля') && freshHtml.includes('Help'), 'new route rendered while old profile request remained pending');

  accountGate.resolve({ name: 'alice', login: 'alice' });
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.strictEqual(get('app').innerHTML, freshHtml, 'late old-route success cannot overwrite the newer route');

  const errorGate = deferred();
  let errorFetchStarted = false;
  context.DposProfiles.fetchAccount = () => { errorFetchStarted = true; return errorGate.promise; };
  context.location.hash = '#chain=golos&app=profiles&account=old-error';
  const oldErrorRoute = context.DposV3.renderRoute();
  for (let turn = 0; turn < 10 && !errorFetchStarted; turn += 1) await Promise.resolve();
  assert(errorFetchStarted, 'the stale error case reached its delayed fetch boundary');
  context.location.hash = '#chain=golos&app=help';
  await context.DposV3.renderRoute();
  const freshAfterError = get('app').innerHTML;
  errorGate.reject(new Error('late failure'));
  await oldErrorRoute;
  assert.strictEqual(get('app').innerHTML, freshAfterError, 'late old-route error cannot overwrite the newer route with an error panel');

  const historyGate = deferred();
  context.DposHistory.fetchAccountHistory = () => { historyStarted = true; return historyGate.promise; };
  context.location.hash = '#chain=golos&app=history&account=old-history';
  const oldHistoryRoute = context.DposV3.renderRoute();
  for (let turn = 0; turn < 10 && !historyStarted; turn += 1) await Promise.resolve();
  assert(historyStarted, 'the stale non-profile route reached its delayed history boundary');
  context.location.hash = '#chain=golos&app=help';
  await context.DposV3.renderRoute();
  const freshAfterHistory = get('app').innerHTML;
  historyGate.resolve([]);
  await withTimeout(oldHistoryRoute, 'stale history route');
  assert.strictEqual(get('app').innerHTML, freshAfterHistory, 'late non-profile route success cannot overwrite the newer section');

  const walletGate = deferred();
  let walletStarted = false;
  context.DposProfiles.fetchAccount = () => { walletStarted = true; return walletGate.promise; };
  context.DposProfiles.apiCall = async () => [];
  context.location.hash = '#chain=golos&app=wallet&account=old-wallet';
  const oldWalletRoute = context.DposV3.renderRoute();
  for (let turn = 0; turn < 10 && !walletStarted; turn += 1) await Promise.resolve();
  assert(walletStarted, 'the stale wallet route reached its delayed account boundary');
  context.location.hash = '#chain=golos&app=help';
  await withTimeout(context.DposV3.renderRoute(), 'fresh route during wallet delay');
  const freshAfterWallet = get('app').innerHTML;
  walletGate.resolve({ name: 'old-wallet' });
  await withTimeout(oldWalletRoute, 'stale wallet route');
  assert.strictEqual(get('app').innerHTML, freshAfterWallet, 'late wallet success cannot overwrite the newer section');

  const explorerGate = deferred();
  let explorerStarted = false;
  context.DposProfiles.fetchAccount = () => { explorerStarted = true; return explorerGate.promise; };
  context.location.hash = '#chain=golos&app=explorer&kind=account&value=old-explorer';
  const oldExplorerRoute = context.DposV3.renderRoute();
  for (let turn = 0; turn < 10 && !explorerStarted; turn += 1) await Promise.resolve();
  assert(explorerStarted, 'the stale explorer route reached its delayed public-read boundary');
  context.location.hash = '#chain=golos&app=help';
  await withTimeout(context.DposV3.renderRoute(), 'fresh route during explorer delay');
  const freshAfterExplorer = get('app').innerHTML;
  explorerGate.resolve({ name: 'old-explorer' });
  await withTimeout(oldExplorerRoute, 'stale explorer route');
  assert.strictEqual(get('app').innerHTML, freshAfterExplorer, 'late explorer success cannot overwrite the newer section');

  const postGate = deferred();
  let postStarted = false;
  context.DposProfiles.apiCall = async (_connection, method) => {
    if (method === 'getContent') { postStarted = true; return postGate.promise; }
    return [];
  };
  context.location.hash = '#chain=golos&app=post&author=old-author&permlink=old-post';
  const oldPostRoute = context.DposV3.renderRoute();
  for (let turn = 0; turn < 10 && !postStarted; turn += 1) await Promise.resolve();
  assert(postStarted, 'the stale post route reached its delayed content boundary');
  context.location.hash = '#chain=golos&app=help';
  await withTimeout(context.DposV3.renderRoute(), 'fresh route during post delay');
  const freshAfterPost = get('app').innerHTML;
  postGate.resolve({ author: 'old-author', permlink: 'old-post', body: 'stale post' });
  await withTimeout(oldPostRoute, 'stale post route');
  assert.strictEqual(get('app').innerHTML, freshAfterPost, 'late post success cannot overwrite the newer section');

  const validatorsGate = deferred();
  let validatorsStarted = false;
  context.AbortController = AbortController;
  context.DposChains.minter = { id: 'minter', title: 'Minter', apps: [{ id: 'validators', title: 'Validators' }], nodes: [], explorerBase: 'https://fixture.invalid' };
  context.fetch = () => { validatorsStarted = true; return validatorsGate.promise; };
  context.location.hash = '#chain=minter&app=validators';
  const oldValidatorsRoute = context.DposV3.renderRoute();
  for (let turn = 0; turn < 20 && !validatorsStarted; turn += 1) await Promise.resolve();
  assert(validatorsStarted, 'validator route reached delayed public fetch');
  context.location.hash = '#chain=golos&app=help';
  await context.DposV3.renderRoute();
  const freshAfterValidators = get('app').innerHTML;
  validatorsGate.resolve({ ok: true, json: async () => ({ data: [] }) });
  await withTimeout(oldValidatorsRoute, 'stale validator route');
  assert.strictEqual(get('app').innerHTML, freshAfterValidators, 'late validator response cannot replace the newer route');

  const secret = `5${'K'.repeat(50)}`;
  context.DposProfiles.fetchAccount = async () => { throw new Error(`RPC rejected ${secret}`); };
  context.location.hash = '#chain=golos&app=profiles&account=diagnostic';
  await context.DposV3.renderRoute();
  assert(!get('app').innerHTML.includes(secret) && !get('status').textContent.includes(secret), 'diagnostic UI sinks do not expose a WIF-like value');
  assert(get('app').innerHTML.includes('[redacted-wif]') && get('status').textContent.includes('[redacted-wif]'), 'diagnostic UI sinks retain a useful redaction marker');
  assert(loggedErrors.length && loggedErrors.every(value => !value.includes(secret)), 'console diagnostics are sanitized too');

  console.log('v3 route generation guards delayed profile, history, wallet, explorer and post results and sanitizes diagnostics');
})().catch(error => { console.error(error); process.exit(1); });
