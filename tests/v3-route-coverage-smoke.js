const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const context = { window: null };
context.window = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root, 'v3/js/chains.js'), 'utf8'), context, { filename: 'v3/js/chains.js' });

const chains = context.DposChains;
const appSource = fs.readFileSync(path.join(root, 'v3/js/app.js'), 'utf8');

assert.deepStrictEqual(Object.keys(chains).sort(), ['decimal', 'golos', 'hive', 'minter', 'steem', 'viz'], 'v3 exposes only the six requested chains');
assert(!Object.prototype.hasOwnProperty.call(chains, 'cyber'), 'Cyber is not enabled in v3 chains');
assert(!Object.prototype.hasOwnProperty.call(chains, 'evm'), 'EVM is not enabled in v3 chains');

for (const chain of Object.values(chains)) {
  assert(fs.existsSync(path.join(root, chain.libraryPath)), `${chain.id}: libraryPath exists`);
  assert(fs.existsSync(path.join(root, chain.cryptoPath)), `${chain.id}: cryptoPath exists`);
  if (chain.walletPath) assert(fs.existsSync(path.join(root, chain.walletPath)), `${chain.id}: walletPath exists`);

  for (const app of chain.apps) {
    const routeMentioned = appSource.includes(`app.id === '${app.id}'`) ||
      appSource.includes(`app.id === \"${app.id}\"`) ||
      appSource.includes(`app.id === '${app.id}' ||`) ||
      appSource.includes(`|| app.id === '${app.id}'`) ||
      appSource.includes(`chain.id === '${chain.id}' && app.id === '${app.id}'`);
    const placeholderCovered = appSource.includes('renderServicePlaceholder(chain, app)');
    assert(routeMentioned || placeholderCovered, `${chain.id}/${app.id}: route has handler or explicit placeholder fallback`);
  }
}

const sourceBundle = [
  'index.html',
  'v3/js/chains.js',
  'v3/js/app.js',
  'v3/js/auth.js',
  'v3/js/broadcast.js',
  'v3/js/profiles.js',
  'v3/js/history.js'
].map((file) => fs.readFileSync(path.join(root, file), 'utf8')).join('\n');

assert(!/blockchains\/(cyber|evm)\//i.test(sourceBundle), 'v3 source does not load Cyber/EVM assets');
assert(/confirmExecute:\s*true/.test(appSource), 'UI has confirmed real broadcast path');
assert(/dryRun:\s*true/.test(appSource), 'UI keeps preview/dry-run path');

assert(appSource.includes('manage-witness-update-form'), 'manage includes witness settings update form');
assert(appSource.includes('manage-authority-form'), 'manage includes authority/access update form');
assert(appSource.includes('accountCreateWithDelegation'), 'Golos registration includes account_create_with_delegation flow');
assert(appSource.includes("prepareWithPrivateKey(chain, account, 'owner'"), 'authority update uses explicit owner WIF in memory only');
assert(appSource.includes('Owner WIF is used only in memory'), 'authority update warns about owner WIF handling');

assert(appSource.includes('renderTransactionsTable'), 'profiles/history use shared accessible transaction table renderer');
assert(appSource.includes('<caption>'), 'transaction tables include captions');
assert(appSource.includes('scope=\"col\"'), 'transaction tables include scoped column headers');
assert(appSource.includes("explorerLink(chain, 'tx'"), 'transaction rows link tx values to explorer route');
assert(appSource.includes("explorerLink(chain, 'block'"), 'transaction rows link block values to explorer route');
assert(appSource.includes("accountLink(chain"), 'transaction rows link account-like values to profiles route');
assert(appSource.includes('renderMinterBroadcast(chain)'), 'Minter broadcast has a separate route and does not collapse to wallet');
assert(appSource.includes('minter-liquidity-form'), 'Minter liquidity/create pool form is present');
assert(appSource.includes('minter-hub-withdraw-form'), 'Minter hub withdraw static transaction form is present');
assert(appSource.includes('EDIT_COIN_OWNER'), 'Minter edit coin owner operation is present');
assert(appSource.includes('decimal-convert-form'), 'Decimal convert/swap form is present');
assert(appSource.includes('validateDecimalValidator'), 'Decimal validators do not reuse account-address-only validation');

assert(appSource.includes('function renderMinterBroadcast'), 'Minter broadcast route has dedicated renderMinterBroadcast');
assert(appSource.includes('Raw signed TX'), 'Minter broadcast route labels raw signed TX controls');
assert(appSource.includes('Multisig controls'), 'Minter broadcast route labels multisig controls');
assert(appSource.includes("chain.id === 'minter' && app.id === 'broadcast'"), 'Minter broadcast does not collapse to generic wallet route');
assert(appSource.includes("chain.id === 'decimal' && app.id === 'broadcast'"), 'Decimal broadcast uses Decimal wallet/SDK forms instead of Graphene wallet forms');
