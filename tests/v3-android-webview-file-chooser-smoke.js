const fs = require('fs');
const assert = require('assert');

const appSource = fs.readFileSync('v3/js/app.js', 'utf8');
const mainActivitySource = fs.readFileSync('android/app/src/main/java/space/dpos/android/ui/MainActivity.kt', 'utf8');

assert(appSource.includes('id="backup-file" name="file" type="file"'), 'backup import keeps a real file input');
assert(appSource.includes('accept="application/json,.json"'), 'backup import accepts JSON backup files');
assert(appSource.includes("if (!file || typeof file.text !== 'function') throw new Error('Выберите backup-файл.')"), 'backup import reports missing file explicitly');

assert(mainActivitySource.includes('override fun onShowFileChooser'), 'Android WebView implements file chooser bridge for input type=file');
assert(mainActivitySource.includes('ValueCallback<Array<Uri>>'), 'Android file chooser stores the WebView URI callback');
assert(mainActivitySource.includes('fileChooserParams?.createIntent()'), 'Android file chooser uses WebChromeClient file chooser params');
assert(mainActivitySource.includes('Intent.ACTION_GET_CONTENT'), 'Android file chooser has ACTION_GET_CONTENT fallback');
assert(mainActivitySource.includes('Intent.CATEGORY_OPENABLE'), 'Android file chooser fallback restricts to openable documents');
assert(mainActivitySource.includes('startActivityForResult(intent, FILE_CHOOSER_REQUEST_CODE)'), 'Android file chooser launches a system picker');
assert(mainActivitySource.includes('WebChromeClient.FileChooserParams.parseResult(resultCode, data)'), 'Android file chooser returns picked URI(s) to WebView');
assert(mainActivitySource.includes('fileChooserCallback?.onReceiveValue(null)'), 'Android file chooser cancels stale callbacks safely');
assert(mainActivitySource.includes('WebViewFeature.WEB_AUTHENTICATION'), 'Android WebView checks passkey/WebAuthn support for passkey backups');
assert(mainActivitySource.includes('WebSettingsCompat.setWebAuthenticationSupport'), 'Android WebView enables WebAuthentication support when available');

console.log('v3 Android WebView file chooser smoke passed');
