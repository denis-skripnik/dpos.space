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
  'checkNow',
  'previewAutoVote'
];

for (const method of requiredBridgeMethods) {
  assert(appSource.includes(`'${method}'`) || appSource.includes(`"${method}"`) || appSource.includes(`DposAndroid.${method}`) || appSource.includes(`bridge.${method}`), `app.js references Android bridge method ${method}`);
}

assert(appSource.includes('data-android-worker-panel'), 'auto-upvoter renders a dedicated Android native worker panel');
assert(appSource.includes('aria-live="polite"') && appSource.includes('android-worker-status'), 'Android worker status is TalkBack-friendly');
assert(appSource.includes('data-android-import-settings'), 'UI has an explicit settings import button');
assert(appSource.includes('data-android-import-secure-key'), 'UI has a separate secure-key import button');
assert(appSource.includes('data-android-start-worker') && appSource.includes('data-android-stop-worker'), 'UI has Android native start/stop controls');
assert(appSource.includes('data-android-check-now'), 'UI has Android native check-now control');
assert(appSource.includes('data-android-preview-vote'), 'UI has Android native preview/check vote control');
assert(appSource.includes('secret-like fields are not accepted') || appSource.includes('settings import does not include keys') || appSource.includes('secret payload is sent only to importSecureKey'), 'normal settings import is documented as key-free');
assert(appSource.includes('nativeAndroidWorkerBridge') && appSource.includes('global.DposAndroid') && appSource.includes("hasAndroidWorkerBridge ? '' : 'hidden'"), 'browser/PWA fallback hides Android-only controls when bridge is absent');

assert(planSource.includes('### Android parity matrix — native bridge worker controls'), 'plan.md records Android bridge parity matrix');
assert(planSource.includes('| Golos |') && planSource.includes('| VIZ |') && planSource.includes('| Hive |') && planSource.includes('| Steem |') && planSource.includes('| Minter |') && planSource.includes('| Decimal |'), 'plan matrix separates every supported web chain');
assert(planSource.includes('WebView UI coverage') && planSource.includes('native bridge UI coverage') && planSource.includes('native background/worker/signing coverage'), 'plan matrix has required coverage columns');

console.log('v3 Android bridge UI smoke passed');
