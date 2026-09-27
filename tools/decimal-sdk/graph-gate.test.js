const assert = require('assert');
const config = require('./webpack.config.cjs');
const gate = config.plugins.find(plugin => plugin.constructor.name === 'EvmOnlyGraphGatePlugin');
assert(gate);
function rejected(resource) {
  const compilation = { errors: [], hooks: { finishModules: { tap(_name, run) {
    run([{ resource, identifier: () => resource }]);
  } } } };
  gate.apply({ hooks: { thisCompilation: { tap(_name, run) { run(compilation); } } } });
  return compilation.errors.length > 0;
}
for (const module of ['@cosmjs/stargate', '@confio/ics23', 'protobufjs', '@tendermint/sig', 'secp256k1', 'web3', 'web3-bzz', 'web3-core-helpers', 'swarm-js', 'request', 'tar']) {
  assert(rejected(`/fixture/node_modules/${module}/index.js`), `${module} must be rejected before bundle emission`);
}
for (const module of ['ethers', 'bech32', 'axios', 'elliptic']) {
  assert(!rejected(`/fixture/node_modules/${module}/index.js`), `${module} must remain allowed`);
}
assert(!rejected('/fixture/node_modules/@ethersproject/providers/lib.esm/web3-provider.js'), 'ethers provider adapter is not the legacy web3 package');
console.log('Decimal graph gate rejects forbidden dependencies and permits required implementations');
