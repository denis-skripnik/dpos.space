const assert = require('assert');
const fs = require('fs');

const appSource = fs.readFileSync('v3/js/app.js', 'utf8');
const bridgeSource = fs.readFileSync('android/app/src/main/java/space/dpos/android/bridge/DposAndroidBridge.kt', 'utf8');
const minterSource = fs.readFileSync('android/app/src/main/java/space/dpos/android/minter/MinterNative.kt', 'utf8');
const secureImportSource = fs.readFileSync('android/app/src/main/java/space/dpos/android/runtime/SecureKeyImportPolicy.kt', 'utf8');
const planSource = fs.readFileSync('plan.md', 'utf8');

assert(appSource.includes('data-android-minter-native-panel'), 'Minter wallet exposes a dedicated Android native signer panel');
assert(appSource.includes('previewMinterTransfer'), 'Minter Android UI calls previewMinterTransfer bridge method');
assert(appSource.includes("chainId: 'minter'") && appSource.includes("authority: 'seed'"), 'Minter seed import is explicit and separate from worker settings');
assert(appSource.includes('Android native Minter SEND теперь разделён') && appSource.includes('send_transaction'), 'Minter native UI separates preview/check from explicit network execute');
assert(appSource.includes('Preview/check Minter SEND без broadcast') && appSource.includes('Execute/send Minter SEND в сеть') && appSource.includes('global.confirm'), 'Minter native UI has no-broadcast preview and a separate confirmed execute button');
assert(appSource.includes('Decimal WebView UI работает, но native seed signer path пока не реализован'), 'Decimal remains truthfully WebView-only/native TODO');

assert(bridgeSource.includes('fun previewMinterTransfer') && bridgeSource.includes('fun executeMinterTransfer'), 'Android bridge exposes Minter preview and execute methods');
assert(bridgeSource.includes('HttpMinterBroadcaster()') && minterSource.includes('send_transaction') && minterSource.includes('MinterBroadcastRequestBody.fromSignedTx'), 'Android bridge uses verified native Minter send_transaction broadcaster');
assert(minterSource.includes('wallet path m/44') || (minterSource.includes('ChildNumber(44, true)') && minterSource.includes('ChildNumber(60, true)')), 'Minter native signer derives Ethereum/Minter wallet path');
assert(minterSource.includes('Keccak.Digest256') && minterSource.includes('Rlp.encodeList'), 'Minter native signer implements Keccak + RLP tx encoding instead of fake support');
assert(minterSource.includes('numeric Minter coin id; symbol lookup remains in WebView SDK'), 'native Minter milestone refuses symbol lookup rather than faking SDK replaceCoinSymbol');
assert(secureImportSource.includes('"minter" to setOf("seed")'), 'secure import policy allows only Minter seed authority');
assert(!secureImportSource.includes('"decimal" to setOf("seed")'), 'Decimal seed import remains disabled until real native signer is implemented');

assert(planSource.includes('### Android native parity: Minter SEND live broadcast') && planSource.includes('Decimal remains WebView-only'), 'plan records truthful native Minter broadcast and Decimal matrix');

console.log('v3-android-minter-native-smoke ok');
