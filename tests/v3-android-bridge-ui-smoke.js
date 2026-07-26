const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const appSource = fs.readFileSync(path.join(root, 'v3/js/app.js'), 'utf8');
const planSource = fs.readFileSync(path.join(root, 'plan.md'), 'utf8');

const requiredBridgeMethods = [
  'getWorkerStatus',
  'importWorkerSettings',
  'importSecureKey',
  'startWorker',
  'stopWorker',
  'checkNow'
];

const autoUpvoterSlice = appSource.slice(appSource.indexOf('async function renderGolosAutoUpvoter'), appSource.indexOf('const GOLOS_FEEDS_SETTINGS_KEY'));
assert(autoUpvoterSlice.length > 10000, 'auto-upvoter runtime slice is found');

for (const method of requiredBridgeMethods) {
  assert(autoUpvoterSlice.includes(`'${method}'`) || autoUpvoterSlice.includes(`"${method}"`) || autoUpvoterSlice.includes(`DposAndroid.${method}`) || autoUpvoterSlice.includes(`bridge.${method}`), `auto-upvoter references Android bridge method ${method}`);
}

assert(autoUpvoterSlice.includes('data-android-worker-panel'), 'auto-upvoter renders an Android native worker status panel');
assert(autoUpvoterSlice.includes('aria-live="polite"') && autoUpvoterSlice.includes('android-worker-status'), 'Android worker status is TalkBack-friendly');
assert(!autoUpvoterSlice.includes('data-android-import-settings'), 'auto-upvoter UI no longer exposes a separate settings import button');
assert(!autoUpvoterSlice.includes('data-android-import-secure-key'), 'auto-upvoter UI no longer exposes a separate secure-key import button');
assert(!autoUpvoterSlice.includes('data-android-start-worker') && !autoUpvoterSlice.includes('Start native worker'), 'auto-upvoter UI no longer exposes separate native start controls');
assert(!autoUpvoterSlice.includes('data-android-check-now'), 'auto-upvoter UI no longer exposes separate native check-now control');
assert(!autoUpvoterSlice.includes('data-android-preview-vote'), 'auto-upvoter UI no longer exposes separate native preview/check controls');
assert(autoUpvoterSlice.includes('startAndroidAutoUpvoter(settings)') && autoUpvoterSlice.includes('hasAndroidWorkerBridge && nativeAutoVoteSupported'), 'shared Start button routes to Android native worker inside APK');
assert(autoUpvoterSlice.includes("callAndroidWorkerBridge('importSecureKey'") && autoUpvoterSlice.includes("broadcast.decryptLegacyKey(chain, user, 'posting')"), 'APK Start automatically imports stored posting key into Android secure storage');
assert(autoUpvoterSlice.includes("callAndroidWorkerBridge('importWorkerSettings'") && autoUpvoterSlice.includes("callAndroidWorkerBridge('startWorker'") && autoUpvoterSlice.includes("callAndroidWorkerBridge('checkNow'"), 'APK Start syncs settings, starts native worker, and queues check-now');
assert(autoUpvoterSlice.includes('stopAndroidAutoUpvoter()') && autoUpvoterSlice.includes("callAndroidWorkerBridge('stopWorker'"), 'shared Stop button routes to Android native worker inside APK');
assert(autoUpvoterSlice.includes("data-android-worker-panel ${hasAndroidWorkerBridge ? '' : 'hidden'}") && appSource.includes('nativeAndroidWorkerBridge') && appSource.includes('global.DposAndroid'), 'browser/PWA fallback hides Android-only status when bridge is absent');
assert(appSource.includes("['golos', 'hive', 'steem'].includes(chain.id)"), 'Android native auto-upvoter enables only implemented Graphene vote chains');
assert(autoUpvoterSlice.includes('В Android-приложении эта же кнопка Start автоматически запускает native worker'), 'Android worker copy explains one-button native mode');

assert(planSource.includes('### Android parity matrix — native bridge worker controls'), 'plan.md records Android bridge parity matrix');
assert(planSource.includes('| Golos |') && planSource.includes('| VIZ |') && planSource.includes('| Hive |') && planSource.includes('| Steem |') && planSource.includes('| Minter |') && planSource.includes('| Decimal |'), 'plan matrix separates every supported web chain');
assert(planSource.includes('WebView UI coverage') && planSource.includes('native bridge UI coverage') && planSource.includes('native background/worker/signing coverage'), 'plan matrix has required coverage columns');
assert(planSource.includes('beeab0de00000000000000000000000000000000000000000000000000000000') && planSource.includes('Steem chain id `0000000000000000000000000000000000000000000000000000000000000000`'), 'plan records verified Hive/Steem native chain ids');
assert(planSource.includes('VIZ auto-upvoter/signing is not claimed') && planSource.includes('native VIZ award/vote signing remains blocked') && planSource.includes('| Minter |') && planSource.includes('| Decimal |'), 'plan keeps native-only limits explicit instead of claiming fake full parity');

console.log('v3 Android bridge UI smoke passed');
