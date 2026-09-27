# Decimal browser SDK build

This directory reproducibly builds the EVM-only static browser artifact used by v3.

## Provenance and security

- Upstream EVM implementation: `dsc-js-sdk@2.1.1` from the npm registry.
- Registry tarball: `https://registry.npmjs.org/dsc-js-sdk/-/dsc-js-sdk-2.1.1.tgz`.
- Published integrity: `sha512-89FAE1srTcLoiNOoBMALLauC7fjN8722E9bdX4MjCO3cbSfYBz0jxRCerXoUNj4jwp3Br5+Oz9K8K2DqxcAXbg==`.
- `package-lock.json` pins the complete build graph, including direct `ethers`, `bech32`, and patched `axios` runtime dependencies.
- `browser-entry.js` imports only the upstream `src/decimalevm/index.ts` implementation and `src/endpoints.ts` network constants. It does not import the SDK-wide `src/index.ts` entry.
- `wallet-compat.js` uses ethers for BIP-39 validation/generation and `m/44'/60'/0'/0/0` EVM derivation. It exposes only the wallet fields consumed by the app and strict Bech32 conversion.
- The webpack build fails if its emitted module graph contains legacy Cosmos SDK code, ICS23, protobuf, Tendermint signing, native secp256k1, Web3, Swarm, request, or tar.
- Output: `v3/vendor/decimal/decimal-sdk-web.js`, exposing the frozen minimal namespace `window.DecimalSDK` with `Wallet`, `DecimalEVM`, `DecimalNetworks`, and `verifyAddress`.

## Rebuild and verify

```sh
npm ci --ignore-scripts
npm test
```

`npm test` rebuilds through the module-graph gate, checks the frozen namespace and wallet identities, then runs the existing Decimal SDK contract suite. Tests use inert transport harnesses and do not broadcast or require network access.

`node_modules/` is build-only and ignored. The shipped site has no npm runtime dependency.
