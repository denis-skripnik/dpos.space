const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const appSource = fs.readFileSync(path.join(root, 'v3/js/app.js'), 'utf8');
const SECRET = `5${'K'.repeat(50)}`;

function element() {
  const listeners = {};
  return {
    innerHTML: '', textContent: '', value: '', disabled: false, hidden: false,
    dataset: {}, style: {}, options: [], elements: {},
    classList: { add() {}, remove() {}, toggle() {} },
    addEventListener(name, callback) { listeners[name] = callback; },
    async dispatch(name, event = {}) { return listeners[name] && listeners[name](Object.assign({ preventDefault() {}, currentTarget: this, submitter: null }, event)); },
    setAttribute() {}, removeAttribute() {}, appendChild() {}, focus() {},
    querySelector: () => null, querySelectorAll: () => [], closest: () => null,
    hasAttribute: () => false
  };
}

function profile(chainId, name) {
  return {
    chainId, chain: chainId === 'decimal' ? 'Decimal' : 'Minter', name, displayName: name,
    node: 'fixture', balances: [], metadataJson: {}, postingMetadataJson: {}, restRows: [['Nonce', 7]], raw: { nonce: 7 }
  };
}

function runtime() {
  const elements = new Map();
  const get = id => elements.has(id) ? elements.get(id) : (elements.set(id, element()), elements.get(id));
  get('decimal-rewards-form').elements.days_counter = { value: '1' };
  const chains = {
    decimal: { id: 'decimal', title: 'Decimal', apps: [
      { id: 'profiles', title: 'Profile', requiresAccount: true },
      { id: 'wallet', title: 'Wallet', requiresAccount: true },
      { id: 'explorer', title: 'Explorer', requiresAccount: false },
      { id: 'help', title: 'Help', requiresAccount: false }
    ], nodes: ['https://decimal.invalid'], apiBase: 'https://decimal.invalid/api', gateUrl: 'https://decimal.invalid/gate', defaultAccount: 'd0fixture' },
    minter: { id: 'minter', title: 'Minter', apps: [
      { id: 'wallet', title: 'Wallet', requiresAccount: true },
      { id: 'help', title: 'Help', requiresAccount: false }
    ], nodes: ['https://minter.invalid'], explorerBase: 'https://minter.invalid/api', defaultAccount: 'Mxfixture' }
  };
  let fetchAccount = async (_connection, account) => ({ name: account, nonce: 7 });
  let rewards = async () => ({});
  const context = {
    console, URLSearchParams, Blob, AbortController, setTimeout, clearTimeout,
    location: { hash: '#chain=decimal&app=help', origin: 'https://dpos.test', hostname: 'dpos.test', pathname: '/', search: '' },
    history: { replaceState() {} },
    navigator: { clipboard: { writeText: async () => {} } },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {}, key: () => null, length: 0 },
    addEventListener() {},
    document: { getElementById: get, querySelector: () => null, querySelectorAll: () => [], createElement: element, body: element(), head: element(), activeElement: null },
    DposChains: chains,
    DposAuth: {
      getUsers: () => [], getCurrentUser: chain => ({ type: 'bip.to', address: chain.id === 'decimal' ? 'd0fixture' : 'Mxfixture' }),
      getCurrentLogin: chain => chain.id === 'decimal' ? 'd0fixture' : 'Mxfixture',
      getUserLogin: user => user && user.address || '', getUserType: user => user && user.type || 'standard',
      getKeyStatus: () => ({ available: false })
    },
    DposBroadcast: {
      sanitizeDiagnostic(value) { return typeof value === 'string' ? value.replace(/5[1-9A-HJ-NP-Za-km-z]{45,55}/g, '[redacted-wif]') : value; },
      validateAddress: (_chain, value) => value
    },
    DposProfiles: {
      formatError: error => error && error.message ? error.message : String(error),
      connect: async chain => ({ chain, node: chain.nodes[0], rest: true }),
      fetchAccount: (...args) => fetchAccount(...args),
      enrichAccount: async (_connection, account) => account,
      normalizeAccount: (connection, account) => profile(connection.chain.id, account.name),
      fetchDecimalRewards: (...args) => rewards(...args)
    },
    DposHistory: { operationTitle: value => value, formatDate: value => value, fetchAccountHistory: async () => [] },
    DposNotifications: null
  };
  context.window = context; context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(appSource, context, { filename: 'v3/js/app.js' });
  return {
    context, get,
    setFetchAccount(fn) { fetchAccount = fn; },
    setRewards(fn) { rewards = fn; }
  };
}

function assertRedacted(value, label) {
  assert(!String(value).includes(SECRET), `${label} must not expose the secret-bearing diagnostic`);
  assert(String(value).includes('[redacted-wif]'), `${label} keeps a useful redaction marker`);
}

(async () => {
  const { context, get, setRewards } = runtime();

  context.location.hash = '#chain=decimal&app=profiles&account=d0fixture';
  await context.DposV3.renderRoute();
  context.navigator.clipboard.writeText = async () => { throw new Error(`clipboard rejected ${SECRET}`); };
  await get('copy-decimal-nonce').dispatch('click');
  assertRedacted(get('copy-decimal-nonce-status').textContent, 'nonce clipboard status');

  setRewards(async () => { throw new Error(`rewards rejected ${SECRET}`); });
  await get('decimal-rewards-form').dispatch('submit');
  assertRedacted(get('decimal-rewards-result').innerHTML, 'Decimal rewards result');

  context.fetch = async url => {
    if (String(url).endsWith('/addresses/Mxfixture')) return { ok: true, text: async () => JSON.stringify({ data: { balances: [] } }) };
    throw new Error(`Minter partial API rejected ${SECRET}`);
  };
  context.location.hash = '#chain=minter&app=wallet&account=Mxfixture';
  await context.DposV3.renderRoute();
  assertRedacted(get('app').innerHTML, 'Minter partial wallet errors');

  context.fetch = async () => { throw new Error(`Decimal partial API rejected ${SECRET}`); };
  context.location.hash = '#chain=decimal&app=wallet&account=d0fixture';
  await context.DposV3.renderRoute();
  assertRedacted(get('app').innerHTML, 'Decimal partial wallet errors');

  context.DposNative = { available: () => true, needsUpdate: () => false, request: async () => `malformed bridge ${SECRET}` };
  const bridgeResult = await context.DposV3.securityOperations.callAndroidWorkerBridge('checkNow');
  assertRedacted(bridgeResult.reason, 'malformed native bridge reason');

  context.fetch = async url => String(url).includes('/blocks?')
    ? { ok: true, text: async () => JSON.stringify({ blocks: [] }) }
    : Promise.reject(new Error(`node info rejected ${SECRET}`));
  context.location.hash = '#chain=decimal&app=explorer';
  await context.DposV3.renderRoute();
  assertRedacted(get('explorer-result').innerHTML, 'Decimal explorer node-info diagnostic');

  console.log('v3 app diagnostic sinks sanitize callback and renderer errors');
})().catch(error => { console.error(error); process.exit(1); });
