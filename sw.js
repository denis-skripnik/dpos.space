/* DPoS Space static PWA service worker.
 * Scope: installable shell + safe offline fallback, not a background scanner.
 */
const DPOS_CACHE_VERSION = 'dpos-space-v3-20261006-viz-agents-current-multilist';
const DPOS_SHELL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/v3/js/i18n-en.js?v=20261006-viz-agents-current-multilist',
  '/v3/js/i18n.js?v=20260919-audit-integration',
  '/v3/js/app.js?v=20261006-viz-agents-current-multilist',
  '/v3/js/viz-agents.js?v=20261006-viz-agents-current-multilist',
  '/v3/vendor/viz/viz.min.js',
  '/v3/js/golos-wallet-swap.js?v=20260923-release-3-1-0',
  '/v3/css/style.css?v=20260919-audit-integration',
  '/v3/vendor/golos/sjcl.min.js',
  '/v3/js/vault.js?v=20260919-audit-integration',
  '/v3/js/vault-ui.js?v=20261001-vault-explanation',
  '/v3/js/native-bridge.js?v=20260921-notification-summary',
  '/v3/js/chains.js?v=20260919-audit-integration',
  '/v3/js/auth.js?v=20260919-audit-integration',
  '/v3/js/bip39.js?v=20260919-audit-integration',
  '/v3/js/broadcast.js?v=20261006-viz-agents-current-multilist',
  '/v3/js/diagnostics.js?v=20260923-release-3-1-0',
  '/v3/js/diagnostics-ui.js?v=20260921-notification-summary',
  '/v3/js/profiles.js?v=20260919-audit-integration',
  '/v3/js/history.js?v=20260919-audit-integration',
  '/v3/js/notifications.js?v=20260921-notification-summary',
  '/v3/js/notification-inbox.js?v=20260921-notification-summary',
  '/v3/js/auto-upvoter.js?v=20261001-golos-root-posts',
  '/v3/js/pwa.js?v=20261001-release-3-1-3',
  '/v3/js/app.wallet-notifications.js',
  '/v3/assets/icons/dpos-space-192.png',
  '/v3/assets/icons/dpos-space-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(DPOS_CACHE_VERSION)
      .then((cache) => cache.addAll(DPOS_SHELL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        .filter((key) => key.startsWith('dpos-space-v3-') && key !== DPOS_CACHE_VERSION)
        .map((key) => caches.delete(key))))
      .then(() => caches.open(DPOS_CACHE_VERSION))
      .then((cache) => purgeFreshnessSensitiveEntries(cache))
      .then(() => self.clients.claim())
  );
});

function sameOrigin(request) {
  try {
    return new URL(request.url).origin === self.location.origin;
  } catch (_error) {
    return false;
  }
}

function isRuntimeAsset(request) {
  try {
    const url = new URL(request.url);
    return url.pathname.endsWith('.js') || url.pathname.endsWith('.css') || url.pathname.endsWith('.webmanifest');
  } catch (_error) {
    return false;
  }
}

function isFreshnessSensitiveRequest(request) {
  try {
    const pathname = new URL(request.url).pathname;
    return pathname.startsWith('/api/')
      || (pathname.startsWith('/downloads/') && pathname.endsWith('.apk'));
  } catch (_error) {
    return false;
  }
}

async function purgeFreshnessSensitiveEntries(cache) {
  const requests = await cache.keys();
  await Promise.all(requests
    .filter((request) => isFreshnessSensitiveRequest(request))
    .map((request) => cache.delete(request)));
}

async function networkFirst(request) {
  const cache = await caches.open(DPOS_CACHE_VERSION);
  try {
    const response = await fetch(request);
    if (response && response.ok && sameOrigin(request)) cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;
    if (request.mode === 'navigate') return cache.match('/index.html');
    throw error;
  }
}

function networkOnly(request) {
  return fetch(request, { cache: 'no-store' });
}

async function cacheFirst(request) {
  const cache = await caches.open(DPOS_CACHE_VERSION);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && response.ok && sameOrigin(request)) cache.put(request, response.clone());
  return response;
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || !sameOrigin(request)) return;
  if (isFreshnessSensitiveRequest(request)) {
    event.respondWith(networkOnly(request));
    return;
  }
  if (request.mode === 'navigate' || isRuntimeAsset(request)) {
    event.respondWith(networkFirst(request));
    return;
  }
  event.respondWith(cacheFirst(request));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((client) => client.url && client.url.startsWith(self.location.origin));
      if (existing) return existing.focus();
      return self.clients.openWindow('/');
    })
  );
});
