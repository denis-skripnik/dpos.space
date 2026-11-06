const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const indexSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const pwaSource = fs.readFileSync(path.join(root, 'v3/js/pwa.js'), 'utf8');
const swSource = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const appSource = fs.readFileSync(path.join(root, 'v3/js/app.js'), 'utf8');
const styleSource = fs.readFileSync(path.join(root, 'v3/css/style.css'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.webmanifest'), 'utf8'));
const planSource = fs.readFileSync(path.join(root, 'plan.md'), 'utf8');

assert.strictEqual(manifest.display, 'standalone', 'PWA manifest uses standalone display');
assert.strictEqual(manifest.scope, '/', 'PWA manifest scope covers the static app');
assert(manifest.icons.some((icon) => icon.sizes === '192x192' && icon.purpose.includes('maskable')), 'manifest has 192 maskable icon');
assert(manifest.icons.some((icon) => icon.sizes === '512x512' && icon.purpose.includes('maskable')), 'manifest has 512 maskable icon');
assert(fs.existsSync(path.join(root, 'v3/assets/icons/dpos-space-192.png')), '192 icon exists');
assert(fs.existsSync(path.join(root, 'v3/assets/icons/dpos-space-512.png')), '512 icon exists');

assert(indexSource.includes('<link rel="manifest" href="/manifest.webmanifest">'), 'index links web manifest');
assert(indexSource.includes('name="theme-color"'), 'index exposes theme color');
assert(indexSource.includes('id="pwa-panel"'), 'index has accessible PWA status panel');
assert(indexSource.includes('class="pwa-shell"'), 'PWA panel has a normal in-flow shell');
assert(indexSource.indexOf('id="app"') < indexSource.indexOf('id="pwa-panel"'), 'PWA panel is rendered after main app content');
assert(indexSource.indexOf('id="pwa-panel"') < indexSource.indexOf('<footer'), 'PWA panel stays near the end before footer');
assert(indexSource.indexOf('v3/js/pwa.js') < indexSource.indexOf('v3/js/app.js'), 'PWA helper loads before app runtime');
assert(pwaSource.includes('data-pwa-dismiss'), 'PWA panel has a close button');
assert(pwaSource.includes('PANEL_DISMISSED_KEY'), 'PWA close state is persisted locally');
assert(pwaSource.includes('container.hidden = true'), 'PWA close hides only the PWA panel container');
assert(styleSource.includes('.pwa-panel {\n  position: static;'), 'PWA panel is not fixed over the page');
assert(!/\.pwa-panel\s*\{[^}]*position:\s*(fixed|sticky)/.test(styleSource), 'PWA panel must not overlay app content');

assert(swSource.includes("const DPOS_CACHE_VERSION = 'dpos-space-v3-"), 'service worker has explicit versioned cache');
assert(swSource.includes("'/v3/js/vault.js?v=") && swSource.includes("'/v3/js/native-bridge.js?v="), 'protected account shell is available with the cached runtime');
assert(swSource.includes("'/v3/js/pwa.js?v="), 'service worker caches versioned PWA helper');
assert(swSource.includes("'/v3/js/app.wallet-notifications.js'"), 'service worker caches physically versioned app runtime');
assert(indexSource.includes('v3/js/app.js?v=') && indexSource.includes('v3/css/style.css?v='), 'index uses versioned app runtime and CSS to bypass stale browser/WebView/CDN cache');
assert(indexSource.includes('v3/js/app.js?v='), 'index requests the refreshed VIZ prediction markets app runtime marker');
assert(swSource.includes('networkFirst(request)') && swSource.includes('isRuntimeAsset(request)'), 'service worker uses network-first for runtime JS/CSS/manifest');
assert(swSource.includes('notificationclick'), 'service worker focuses or opens app from local notifications');
assert(!/setInterval|setTimeout\s*\(/.test(swSource), 'service worker does not pretend to run a background scanner timer');

const context = {
  window: null,
  navigator: { serviceWorker: { register: (url) => Promise.resolve({ scope: url, showNotification: () => Promise.resolve() }) } },
  location: { href: 'https://dpos.blinddev.xyz/', origin: 'https://dpos.blinddev.xyz' },
  isSecureContext: true,
  matchMedia: () => ({ matches: false }),
  addEventListener: () => {},
  document: { addEventListener: () => {}, visibilityState: 'visible' },
  Notification: { permission: 'granted', requestPermission: () => Promise.resolve('granted') }
};
context.window = context;
vm.createContext(context);
vm.runInContext(pwaSource, context, { filename: 'v3/js/pwa.js' });
assert(context.DposPwa, 'DposPwa helper is exposed');
assert.strictEqual(context.DposPwa.notificationPermission(), 'granted', 'PWA helper reads notification permission');
assert(context.DposPwa.foregroundRuntimeMessage('Автоапвоутер').includes('Автоапвоутер'), 'foreground runtime message includes active feature label');

let bridgeCall = null;
const androidContext = {
  window: null,
  navigator: {},
  location: { href: 'https://dpos.blinddev.xyz/#chain=golos&app=notifications', hash: '#chain=golos&app=notifications' },
  isSecureContext: true,
  matchMedia: () => ({ matches: false }),
  addEventListener: () => {},
  document: { addEventListener: () => {}, visibilityState: 'visible' },
  DposNative: { available: () => true, request: async (method, payload) => { assert.strictEqual(method, 'notify'); bridgeCall = { ...payload }; return { ok: true }; } }
};
androidContext.window = androidContext;
vm.createContext(androidContext);
vm.runInContext(pwaSource, androidContext, { filename: 'v3/js/pwa.js' });
androidContext.DposPwa.notify('Android native', { body: 'Bridge body', tag: 'bridge', data: { url: 'https://dpos.blinddev.xyz/#chain=golos&app=wallet' } });
assert.deepStrictEqual(bridgeCall, { title: 'Android native', body: 'Bridge body', tag: 'bridge', route: '#chain=golos&app=wallet' }, 'PWA notify routes to Android bridge when present');

const apkUrl = pwaSource.match(/ANDROID_APK_LATEST_URL = '([^']+)'/)[1];
assert.strictEqual(apkUrl, '/downloads/dpos-space-3.1.13.apk', 'stable APK uses the 3.1.13 public naming convention');
assert(pwaSource.includes("ANDROID_APK_VERSION = '3.1.13'"), 'stable download version matches');
assert(pwaSource.includes('download="dpos-space-3.1.13.apk"'), 'suggested download name matches public URL');
assert(fs.existsSync(path.join(root, apkUrl)), 'linked Android APK exists in the static site');
assert.deepStrictEqual(fs.readdirSync(path.join(root, 'downloads')).filter(name => name.endsWith('.apk')), ['dpos-space-3.1.13.apk'], 'public downloads retain only the current stable APK');
const upgradeAssignment = appSource.match(/appEl\.innerHTML = '<section class="panel"><h2>Обновите приложение Android[\s\S]*?';/)[0];
const upgradeView = { innerHTML: '' };
vm.runInNewContext(upgradeAssignment, { appEl: upgradeView });
assert(upgradeView.innerHTML.includes(`href="${apkUrl}"`), 'legacy Android upgrade screen links the retained stable APK, not a removed debug alias');
const footer = indexSource.match(/<footer\b[^>]*>([\s\S]*?)<\/footer>/)[1];
const footerLabel = 'DPoS Space. Веб-интерфейс 3.1.13. Публичный APK 3.1.13.';
assert(footer.includes(footerLabel), 'footer distinguishes current web interface from unchanged public APK');
const english = {};
vm.runInNewContext(fs.readFileSync(path.join(root, 'v3/js/i18n-en.js'), 'utf8'), { window: english });
assert.strictEqual(english.DposEnglish[footerLabel], 'DPoS Space. Web interface 3.1.13. Public APK 3.1.13.', 'English footer preserves both explicit release labels');
const pwaMarker = 'v3/js/pwa.js?v=20261105-release-3-1-13';
assert(indexSource.includes(pwaMarker) && swSource.includes('/' + pwaMarker), 'PWA helper cache markers agree');
assert(swSource.includes("DPOS_CACHE_VERSION = 'dpos-space-v3-20261106-latest-apk-only'"), 'service worker cache bumped for the current-only APK upgrade link');
const coverMarker = 'v3/js/post-cover.js?v=20261105-editor-titles';
assert(indexSource.includes(coverMarker) && swSource.includes('/' + coverMarker), 'cover module load and offline cache markers agree');
assert(indexSource.indexOf(coverMarker) < indexSource.indexOf('v3/js/app.js'), 'cover module loads before app entry');
for (const name of ['title-suggestions', 'vault', 'i18n-en', 'app', 'voice-ui']) {
  const marker = `v3/js/${name}.js?v=${name === 'app' ? '20261106-latest-apk-only' : '20261105-editor-titles'}`;
  assert(indexSource.includes(marker) && swSource.includes('/' + marker), `${name}: coupled cache markers`);
}
assert(indexSource.indexOf('v3/js/title-suggestions.js?') < indexSource.indexOf('v3/js/app.js?'), 'focused title module loads before canonical app entry');
for (const asset of ['winged-head.webp', 'cover-title.ttf']) {
  assert(swSource.includes('/v3/assets/covers/' + asset), 'cover asset is available offline: ' + asset);
  assert(fs.existsSync(path.join(root, 'v3/assets/covers', asset)), 'bundled cover asset exists: ' + asset);
}
for (const name of ['voice-store', 'voice-input']) {
  const marker = `v3/js/${name}.js?v=20261105-voice-input`;
  assert(indexSource.includes(marker) && swSource.includes('/' + marker), `${name} load and offline cache markers agree`);
  assert(indexSource.indexOf(marker) < indexSource.indexOf('v3/js/app.js'), `${name} loads before the app entry point`);
}
assert(swSource.includes("pathname.startsWith('/downloads/') && pathname.endsWith('.apk')") && swSource.includes('event.respondWith(networkOnly(request))'), 'APK bypasses SW cache');
assert(pwaSource.includes('лучше использовать мобильное приложение DPoS Space, а не PWA'), 'Android foreground guidance is retained');

assert(appSource.includes('const pwa = global.DposPwa'), 'app.js wires PWA helper');
assert(appSource.includes('pwa.init(pwaPanel)'), 'app.js initializes PWA panel');
assert(appSource.includes("pwa.notify('Автоапвоутер запущен'"), 'auto-upvoter start sends local notification when allowed');
assert(appSource.includes("pwa.notify('Автоапвоутер остановлен'"), 'auto-upvoter stop sends local notification when allowed');
assert(appSource.includes("pwa.notify('Ошибка автоапвоутера'"), 'auto-upvoter scan errors send local notification when allowed');
assert(appSource.includes('visibilitychange') && appSource.includes('notifyVisibilityRuntime'), 'auto-upvoter has visibility-aware foreground runtime notice');
assert(planSource.includes('## Previous focused pass — PWA install shell and foreground runtime notifications'), 'plan records PWA foreground pass');
assert(planSource.includes('No backend Web Push'), 'plan records no backend push non-goal');

console.log('v3 PWA foreground smoke passed');
