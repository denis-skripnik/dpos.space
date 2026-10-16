const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const data = new Map();
const context = {setTimeout, clearTimeout, localStorage: {
  getItem: key => data.get(key) || null,
  setItem: (key, value) => data.set(key, value)
}};
context.window = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync('v3/js/profiles.js', 'utf8'), context);
const profiles = context.DposProfiles;
const config = {id:'viz', libraryGlobal:'viz', nodes:['https://fixture.invalid'], title:'VIZ'};
const rpcFailure = new Error('same text is not provenance');
(async () => {
  const read = {client:{api:{getAccountsAsync:async () => {throw rpcFailure;}}}};
  await assert.rejects(() => profiles.apiCall(read, 'getAccounts', [['alice']]),
    error => error instanceof profiles.ReadOnlyRpcError && error.cause === rpcFailure);
  const callback = {client:{api:{getAccounts:(_names, done) => done(rpcFailure)}}};
  await assert.rejects(() => profiles.apiCall(callback, 'getAccounts', [['alice']]),
    error => error instanceof profiles.ReadOnlyRpcError && error.cause === rpcFailure);
  await assert.rejects(() => profiles.apiCall({client:{api:{}}}, 'getAccounts', [[]]),
    error => !(error instanceof profiles.ReadOnlyRpcError));
  assert.throws(() => profiles.apiCall({client:{api:{getAccountsAsync:() => {throw rpcFailure;}}}}, 'getAccounts', [[]]),
    error => error === rpcFailure, 'synchronous SDK guards are not RPC rejections');
  await assert.rejects(() => profiles.apiCall({client:{api:{getAccounts:() => {throw rpcFailure;}}}}, 'getAccounts', [[]]),
    error => error === rpcFailure, 'synchronous callback SDK guards are not RPC rejections');
  await assert.rejects(() => profiles.apiCall({client:{api:{broadcastTransactionAsync:async () => {throw rpcFailure;}}}}, 'broadcastTransaction', []),
    error => error === rpcFailure, 'write errors must never acquire read-only provenance');
  context.viz = {api:{getDynamicGlobalPropertiesAsync:async () => {throw rpcFailure;}}};
  await assert.rejects(() => profiles.connect(config), error => error instanceof profiles.ReadOnlyRpcError);
  context.viz.api.getDynamicGlobalPropertiesAsync = async () => ({});
  const set = context.localStorage.setItem;
  context.localStorage.setItem = () => {throw rpcFailure;};
  await assert.rejects(() => profiles.connect(config), error => error === rpcFailure,
    'node persistence errors must propagate without read-only provenance');
  context.localStorage.setItem = set;
  const get = context.localStorage.getItem;
  context.localStorage.getItem = () => {throw rpcFailure;};
  await assert.rejects(() => profiles.connect(config), error => error === rpcFailure);
  context.localStorage.getItem = get;
  context.viz.api = {};
  await assert.rejects(() => profiles.connect(config), error => !(error instanceof profiles.ReadOnlyRpcError));
  context.setTimeout = callback => {queueMicrotask(callback); return 1;};
  context.clearTimeout = () => {};
  await assert.rejects(() => profiles.apiCall({client:{api:{getAccountsAsync:() => new Promise(() => {})}}}, 'getAccounts', [[]]),
    error => error instanceof profiles.ReadOnlyRpcError, 'a read-only deadline retains provenance');
  console.log('VIZ read-only retry provenance PASS');
})().catch(error => { console.error(error); process.exitCode = 1; });
