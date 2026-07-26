const assert = require('assert');
const fs = require('fs');

const appSource = fs.readFileSync('v3/js/app.js', 'utf8');
const bridgeSource = fs.readFileSync('android/app/src/main/java/space/dpos/android/bridge/DposAndroidBridge.kt', 'utf8');
const minterSource = fs.readFileSync('android/app/src/main/java/space/dpos/android/minter/MinterNative.kt', 'utf8');
const secureImportSource = fs.readFileSync('android/app/src/main/java/space/dpos/android/runtime/SecureKeyImportPolicy.kt', 'utf8');
const planSource = fs.readFileSync('plan.md', 'utf8');

assert(!appSource.includes('data-android-minter-native-panel'), 'Minter wallet does not expose a separate APK native signer panel');
assert(!appSource.includes('data-android-minter-import-seed') && !appSource.includes('Import Minter seed'), 'Minter UI does not expose separate native seed import');
assert(!appSource.includes('data-android-minter-preview-send') && !appSource.includes('data-android-minter-execute-send'), 'Minter UI does not expose duplicate native preview/execute buttons');
assert(appSource.includes('id="minter-send-form"') && appSource.includes('Проверить перевод') && appSource.includes('Отправить перевод в сеть'), 'Minter SEND uses the normal wallet preview/send form');
assert(!appSource.includes('data-android-decimal-native-panel'), 'Decimal wallet does not expose a separate APK native signer panel');

assert(bridgeSource.includes('fun previewMinterTransfer') && bridgeSource.includes('fun executeMinterTransfer'), 'Android bridge exposes Minter preview and execute methods');
assert(bridgeSource.includes('HttpMinterBroadcaster()') && minterSource.includes('send_transaction') && minterSource.includes('MinterBroadcastRequestBody.fromSignedTx'), 'Android bridge uses verified native Minter send_transaction broadcaster');
assert(minterSource.includes('wallet path m/44') || (minterSource.includes('ChildNumber(44, true)') && minterSource.includes('ChildNumber(60, true)')), 'Minter native signer derives Ethereum/Minter wallet path');
assert(minterSource.includes('Keccak.Digest256') && minterSource.includes('Rlp.encodeList'), 'Minter native signer implements Keccak + RLP tx encoding instead of fake support');
assert(minterSource.includes('numeric Minter coin id; symbol lookup remains in WebView SDK'), 'native Minter milestone refuses symbol lookup rather than faking SDK replaceCoinSymbol');
assert(secureImportSource.includes('"minter" to setOf("seed")'), 'secure import policy allows Minter seed authority');
assert(secureImportSource.includes('"decimal" to setOf("seed")'), 'secure import policy allows Decimal seed authority only after real preview signer implementation');

assert(planSource.includes('### Android native parity: Minter SEND live broadcast') && planSource.includes('### Android native parity: Decimal DEL preview signer'), 'plan records truthful native Minter broadcast and Decimal preview matrix');

console.log('v3-android-minter-native-smoke ok');
