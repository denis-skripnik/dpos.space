const path = require('path');
const NodePolyfillPlugin = require('node-polyfill-webpack-plugin');

const forbiddenModules = [
  ['legacy Cosmos SDK', /(?:@confio\/ics23|@cosmjs\/|cosmjs-types|dsc-js-sdk\/src\/(?:decimal(?:[\\/]|\.ts)|transaction(?:[\\/]|\.ts)|wallet(?:[\\/]|\.ts)|txTypesNew(?:[\\/]|\.ts)|types\/(?:cosmos|tendermint)(?:[\\/]|$)|utils\/walletUtils(?:[\\/]|\.ts)))/i],
  ['protobuf', /(?:^|[\\/])protobufjs(?:[\\/]|$)/i],
  ['Tendermint signing', /(?:^|[\\/])@tendermint[\\/]sig(?:[\\/]|$)/i],
  ['native secp256k1', /(?:^|[\\/])secp256k1(?:[\\/]|$)/i],
  ['Web3', /(?:^|[\\/])node_modules[\\/]web3(?:-[^\\/]+)?(?:[\\/]|$)/i],
  ['Swarm', /(?:^|[\\/])swarm-js(?:[\\/]|$)/i],
  ['request', /(?:^|[\\/])request(?:[\\/]|$)/i],
  ['tar', /(?:^|[\\/])tar(?:[\\/]|$)/i]
];

class EvmOnlyGraphGatePlugin {
  apply(compiler) {
    compiler.hooks.thisCompilation.tap('EvmOnlyGraphGatePlugin', (compilation) => {
      compilation.hooks.finishModules.tap('EvmOnlyGraphGatePlugin', (modules) => {
        const violations = [];
        for (const module of modules) {
          const identity = `${module.resource || ''} ${module.identifier()}`;
          for (const [label, pattern] of forbiddenModules) {
            if (pattern.test(identity)) violations.push(`${label}: ${identity}`);
          }
        }
        if (violations.length) {
          compilation.errors.push(new Error(`Decimal EVM-only build graph gate failed:\n${violations.join('\n')}`));
        }
      });
    });
  }
}

module.exports = {
  mode: 'production',
  target: ['web', 'es2020'],
  entry: path.resolve(__dirname, 'browser-entry.js'),
  resolve: { extensions: ['.ts', '.js'] },
  module: {
    rules: [{
      test: /\.ts$/,
      include: path.resolve(__dirname, 'node_modules/dsc-js-sdk/src'),
      use: { loader: 'ts-loader', options: { transpileOnly: true } }
    }]
  },
  output: {
    path: path.resolve(__dirname, '../../v3/vendor/decimal'),
    filename: 'decimal-sdk-web.js'
  },
  plugins: [new NodePolyfillPlugin(), new EvmOnlyGraphGatePlugin()],
  performance: { hints: false },
  optimization: { minimize: true }
};
