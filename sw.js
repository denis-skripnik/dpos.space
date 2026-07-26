/* DPoS Space static PWA service worker.
 * Scope: installable shell + safe offline fallback, not a background scanner.
 */
const DPOS_CACHE_VERSION = 'dpos-space-v3-20260726-passkey-download';
const DPOS_SHELL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/v3/css/style.css?v=20260726-passkey-download',
  '/v3/js/chains.js?v=20260726-passkey-download',
  '/v3/js/auth.js?v=20260726-passkey-download',
  '/v3/js/broadcast.js?v=20260726-passkey-download',
  '/v3/js/profiles.js?v=20260726-passkey-download',
  '/v3/js/history.js?v=20260726-passkey-download',
  '/v3/js/notifications.js?v=20260726-passkey-download',
  '/v3/js/auto-upvoter.js?v=20260726-passkey-download',
  '/v3/js/pwa.js?v=20260726-passkey-download',
  '/v3/js/app.passkey-download.js',
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
