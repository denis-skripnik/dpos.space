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
