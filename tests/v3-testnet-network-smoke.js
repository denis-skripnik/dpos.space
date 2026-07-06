const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const indexSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const chainsSource = fs.readFileSync(path.join(root, 'v3/js/chains.js'), 'utf8');
const appSource = fs.readFileSync(path.join(root, 'v3/js/app.js'), 'utf8');
const authSource = fs.readFileSync(path.join(root, 'v3/js/auth.js'), 'utf8');
const profilesSource = fs.readFileSync(path.join(root, 'v3/js/profiles.js'), 'utf8');
const broadcastSource = fs.readFileSync(path.join(root, 'v3/js/broadcast.js'), 'utf8');

const context = { window: null };
context.window = context;
vm.createContext(context);
vm.runInContext(chainsSource, context, { filename: 'v3/js/chains.js' });
const chains = context.DposChains;

assert(indexSource.includes('id="network-field"'), 'route form has a network field container');
assert(indexSource.includes('id="network-select"'), 'route form has a network select');
assert(indexSource.includes('<option value="testnet">Testnet</option>'), 'network select exposes Testnet option when JS enables it');

assert(chains.viz.testnet, 'VIZ has an explicit testnet object');
assert.strictEqual(JSON.stringify(chains.viz.testnet.nodes), JSON.stringify(['https://testnet.viz.world/']), 'VIZ testnet uses the confirmed testnet.viz.world endpoint');
for (const chainId of ['golos', 'steem', 'hive', 'minter', 'decimal']) {
  assert(!chains[chainId].testnet || Object.keys(chains[chainId].testnet).length === 0, `${chainId}: testnet switch remains disabled until a complete public testnet config is confirmed`);
}

assert(appSource.includes('function hasTestnetConfig'), 'app detects non-empty optional chain.testnet configs');
assert(appSource.includes('function resolveChainNetwork'), 'app overlays testnet fields without restructuring chains.js');
assert(appSource.includes("network: 'testnet'"), 'resolved chain carries network=testnet marker for internal connection logic');
assert(appSource.includes('delete state.network'), 'network is ignored in URL/hash state and remains a local selector preference');
assert(!appSource.includes("network: network === 'testnet' ? 'testnet' : null"), 'route submit does not write network=testnet into URL');
assert(appSource.includes("appHash({ chain: chain.id, app: app.id })"), 'chain overview links do not persist network in URL');
assert(appSource.includes("dpos_network_${chain.id}"), 'per-chain selected network is persisted as local UI preference');
assert(appSource.includes("`${chain.id}_recent_accounts`"), 'recent account suggestions stay shared for the chain');

assert(authSource.includes("`${chain.id}_current_user`"), 'authorized current user storage stays shared for the chain');
assert(authSource.includes("`${chain.id}_users`"), 'authorized user list storage stays shared for the chain');
assert(!authSource.includes("_testnet"), 'authorized users are not isolated by testnet');
assert(profilesSource.includes("nodeStorageKey = `${chainConfig.id}${chainConfig.network === 'testnet' ? '_testnet' : ''}_node`"), 'selected RPC node storage remains network-scoped because endpoints differ');
assert(broadcastSource.includes("const networkId = chain.network === 'testnet' ? 'testnet' : 'mainnet'"), 'Decimal SDK broadcast path is future-proofed for testnet network selection');

console.log('v3 testnet network smoke passed');
