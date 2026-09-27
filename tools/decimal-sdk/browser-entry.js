/* dsc-js-sdk 2.1.1 EVM-only browser entry. */
const DecimalEVMModule = require('dsc-js-sdk/src/decimalevm/index.ts');
const { NETWORKS } = require('dsc-js-sdk/src/endpoints.ts');
const { Wallet, verifyAddress } = require('./wallet-compat');

const DecimalEVM = DecimalEVMModule.default || DecimalEVMModule;
const DecimalNetworks = Object.freeze({
  devnet: NETWORKS.DEVNET,
  testnet: NETWORKS.TESTNET,
  mainnet: NETWORKS.MAINNET
});
const DecimalSDK = Object.freeze({ Wallet, DecimalEVM, DecimalNetworks, verifyAddress });

if (typeof window === 'undefined') {
  throw new Error('Decimal SDK browser bundle requires window');
}
window.DecimalSDK = DecimalSDK;
