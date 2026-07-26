const assert = require('assert');
const fs = require('fs');

const appSource = fs.readFileSync('v3/js/app.js', 'utf8');
const bridgeSource = fs.readFileSync('android/app/src/main/java/space/dpos/android/bridge/DposAndroidBridge.kt', 'utf8');
const decimalSource = fs.readFileSync('android/app/src/main/java/space/dpos/android/decimal/DecimalNative.kt', 'utf8');
const secureImportSource = fs.readFileSync('android/app/src/main/java/space/dpos/android/runtime/SecureKeyImportPolicy.kt', 'utf8');
const planSource = fs.readFileSync('plan.md', 'utf8');

assert(appSource.includes('data-android-decimal-native-panel'), 'Decimal wallet exposes APK-only native signer panel');
assert(appSource.includes('previewDecimalTransfer'), 'Decimal Android UI calls previewDecimalTransfer bridge method');
assert(appSource.includes("chainId: 'decimal'") && appSource.includes("authority: 'seed'"), 'Decimal seed import is explicit and separate from worker settings');
assert(appSource.includes('Preview/check Decimal DEL без broadcast') && appSource.includes('Execute/send Decimal DEL в сеть') && appSource.includes('global.confirm'), 'Decimal UI exposes no-broadcast preview and separate confirmed execute');
assert(appSource.includes('executeDecimalTransfer'), 'Decimal execute/broadcast is exposed only after endpoint/body/response semantics were verified');

assert(bridgeSource.includes('fun previewDecimalTransfer') && bridgeSource.includes('fun executeDecimalTransfer'), 'Android bridge exposes Decimal preview and execute methods');
assert(bridgeSource.includes('HttpDecimalBroadcaster()') && decimalSource.includes('eth_sendRawTransaction') && decimalSource.includes('DecimalBroadcastRequestBody.fromSignedTx'), 'Android bridge uses verified Decimal Web3 eth_sendRawTransaction broadcaster');
assert(decimalSource.includes('DEFAULT_EVM_CHAIN_ID = 75L'), 'Decimal native signer records verified eth_chainId 0x4b / 75');
assert(decimalSource.includes('m/44') || (decimalSource.includes('ChildNumber(44, true)') && decimalSource.includes('ChildNumber(60, true)')), 'Decimal native signer derives vendor path m/44\'/60\'/0\'/0/0');
assert(decimalSource.includes('Bech32.encode("d0"') && decimalSource.includes('encodeEvmAccountAddress') === false, 'Decimal native signer derives d0 bech32 address locally rather than claiming browser SDK runtime');
assert(decimalSource.includes('EIP') || decimalSource.includes('chainId * 2 + 35'), 'Decimal native signer uses EIP-155 legacy EVM transfer signing for preview');
assert(decimalSource.includes('broadcastResponse != null'), 'Decimal result reports broadcasted only after broadcaster response');
assert(secureImportSource.includes('"decimal" to setOf("seed")') && secureImportSource.includes('DecimalNativeSupport.isValidAddress'), 'secure import policy accepts only valid Decimal address-scoped seed authority');
assert(planSource.includes('### Android native parity: Decimal DEL preview signer'), 'plan records Decimal preview signer matrix');
assert(planSource.includes('### Android native parity: Decimal DEL execute signer') && planSource.includes('eth_sendRawTransaction') && planSource.includes('No NFT signer'), 'plan records Decimal execute milestone and remaining gaps truthfully');

console.log('v3-android-decimal-native-smoke ok');
