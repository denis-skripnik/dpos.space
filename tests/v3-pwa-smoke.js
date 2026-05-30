const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const indexSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const pwaSource = fs.readFileSync(path.join(root, 'v3/js/pwa.js'), 'utf8');
const swSource = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const appSource = fs.readFileSync(path.join(root, 'v3/js/app.js'), 'utf8');
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
assert(indexSource.indexOf('v3/js/pwa.js') < indexSource.indexOf('v3/js/app.js'), 'PWA helper loads before app.js');

assert(swSource.includes("const DPOS_CACHE_VERSION = 'dpos-space-v3-"), 'service worker has explicit versioned cache');
assert(swSource.includes("'/v3/js/pwa.js'"), 'service worker caches PWA helper');
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

assert(appSource.includes('const pwa = global.DposPwa'), 'app.js wires PWA helper');
assert(appSource.includes('pwa.init(pwaPanel)'), 'app.js initializes PWA panel');
assert(appSource.includes("pwa.notify('Автоапвоутер запущен'"), 'auto-upvoter start sends local notification when allowed');
assert(appSource.includes("pwa.notify('Автоапвоутер остановлен'"), 'auto-upvoter stop sends local notification when allowed');
assert(appSource.includes("pwa.notify('Ошибка автоапвоутера'"), 'auto-upvoter scan errors send local notification when allowed');
assert(appSource.includes('visibilitychange') && appSource.includes('notifyVisibilityRuntime'), 'auto-upvoter has visibility-aware foreground runtime notice');
assert(planSource.includes('## Previous focused pass — PWA install shell and foreground runtime notifications'), 'plan records PWA foreground pass');
assert(planSource.includes('No backend Web Push'), 'plan records no backend push non-goal');

console.log('v3 PWA foreground smoke passed');
