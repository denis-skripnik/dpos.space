const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const source = fs.readFileSync('sw.js', 'utf8');
const cacheVersion = (source.match(/const DPOS_CACHE_VERSION = '([^']+)'/) || [])[1];
assert(cacheVersion, 'service worker declares its current cache version');
const origin = 'https://dpos.example';
const handlers = {};
const fetchCalls = [];
const cachePutCalls = [];
const failedNetworkUrls = new Set();
const deletedCacheNames = [];

function response(body) {
  return {
    ok: true,
    body,
    clone() { return response(body); }
  };
}

const initialEntries = new Map([
  [`${origin}/api/smartfarm`, response('stale-financial-data')],
  [`${origin}/api/smartfarm/loto?date=2026-09-19`, response('stale-lottery-data')],
  [`${origin}/api/balance`, response('stale-balance-data')],
  [`${origin}/downloads/dpos-space-latest-debug.apk`, response('stale-apk')],
  [`${origin}/v3/js/i18n-en.js?v=catalog`, response('cached-catalog')]
]);

function cacheKey(request) {
  const value = typeof request === 'string' ? request : request.url;
  return new URL(value, origin).href;
}

function makeCache(entries = new Map()) {
  return {
    entries,
    async addAll() {},
    async match(request) { return entries.get(cacheKey(request)); },
    async put(request, value) {
      cachePutCalls.push(cacheKey(request));
      entries.set(cacheKey(request), value);
    },
    async keys() { return [...entries.keys()].map((url) => ({ url })); },
    async delete(request) { return entries.delete(cacheKey(request)); }
  };
}

const currentCache = makeCache(initialEntries);
const oldCache = makeCache(new Map([[`${origin}/index.html`, response('old-shell')]]));
const unrelatedCache = makeCache(new Map([[`${origin}/account-settings`, response('unrelated')]]));
const cacheStores = new Map([
  [cacheVersion, currentCache],
  ['dpos-space-v3-old', oldCache],
  ['unrelated-user-cache', unrelatedCache]
]);

const context = {
  URL,
  Promise,
  console,
  self: {
    location: { origin },
    clients: { claim: async () => {}, matchAll: async () => [], openWindow: async () => {} },
    skipWaiting: async () => {},
    addEventListener(type, handler) { handlers[type] = handler; }
  },
  caches: {
    async open(name) {
      if (!cacheStores.has(name)) cacheStores.set(name, makeCache());
      return cacheStores.get(name);
    },
    async keys() { return [...cacheStores.keys()]; },
    async delete(name) {
      deletedCacheNames.push(name);
      return cacheStores.delete(name);
    }
  },
  async fetch(request, options) {
    fetchCalls.push({ url: request.url, options });
    if (failedNetworkUrls.has(request.url)) throw new Error(`offline: ${request.url}`);
    if (request.url.endsWith('/api/smartfarm')) return response('fresh-financial-data');
    if (request.url.includes('/api/smartfarm/')) return response('fresh-lottery-data');
    if (request.url.endsWith('/api/balance')) return response('fresh-balance-data');
    if (new URL(request.url).pathname.endsWith('.apk')) return response('fresh-apk');
    throw new Error(`unexpected network request: ${request.url}`);
  }
};

vm.runInNewContext(source, context, { filename: 'sw.js' });

async function dispatchFetch(pathname) {
  let handled;
  handlers.fetch({
    request: { method: 'GET', mode: 'same-origin', url: `${origin}${pathname}` },
    respondWith(value) { handled = value; }
  });
  assert(handled, `service worker handles ${pathname}`);
  return handled;
}

(async () => {
  const apiFirst = await dispatchFetch('/api/smartfarm');
  const apiSecond = await dispatchFetch('/api/smartfarm');
  assert.strictEqual(apiFirst.body, 'fresh-financial-data', 'financial API does not return a stale cache hit');
  assert.strictEqual(apiSecond.body, 'fresh-financial-data', 'financial API rechecks the network on every request');
  assert.strictEqual(fetchCalls.filter((call) => call.url.endsWith('/api/smartfarm')).length, 2);

  const lottery = await dispatchFetch('/api/smartfarm/loto?date=2026-09-19');
  assert.strictEqual(lottery.body, 'fresh-lottery-data', 'financial API subpaths also bypass stale cache entries');

  const balance = await dispatchFetch('/api/balance');
  assert.strictEqual(balance.body, 'fresh-balance-data', 'all API endpoints bypass stale cache entries');

  await dispatchFetch('/downloads/dpos-space-3.1.0.apk');
  assert.strictEqual(fetchCalls.at(-1).options?.cache, 'no-store', 'stable release APK also bypasses HTTP/SW caches');
  assert(!cachePutCalls.some(url => url.endsWith('/downloads/dpos-space-3.1.0.apk')));
  const apkFirst = await dispatchFetch('/downloads/dpos-space-latest-debug.apk');
  const apkSecond = await dispatchFetch('/downloads/dpos-space-latest-debug.apk');
  assert.strictEqual(apkFirst.body, 'fresh-apk', 'latest APK alias does not return a stale cached APK');
  assert.strictEqual(apkSecond.body, 'fresh-apk', 'latest APK alias rechecks the network on every request');
  assert.strictEqual(fetchCalls.filter((call) => call.url.endsWith('/downloads/dpos-space-latest-debug.apk')).length, 2);

  assert.strictEqual((await currentCache.match('/api/smartfarm')).body, 'stale-financial-data', 'fresh financial responses are not written to Cache Storage');
  assert.strictEqual((await currentCache.match('/downloads/dpos-space-latest-debug.apk')).body, 'stale-apk', 'fresh latest-APK responses are not written to Cache Storage');
  assert(!cachePutCalls.some((url) => url.includes('/api/') || url.endsWith('/downloads/dpos-space-latest-debug.apk')), 'freshness-sensitive responses are never cached');

  failedNetworkUrls.add(`${origin}/api/smartfarm`);
  failedNetworkUrls.add(`${origin}/api/balance`);
  failedNetworkUrls.add(`${origin}/downloads/dpos-space-latest-debug.apk`);
  await assert.rejects(dispatchFetch('/api/smartfarm'), /offline/, 'offline financial API rejects instead of serving stale data');
  await assert.rejects(dispatchFetch('/api/balance'), /offline/, 'offline API rejects instead of serving stale data');
  await assert.rejects(dispatchFetch('/downloads/dpos-space-latest-debug.apk'), /offline/, 'offline latest APK rejects instead of serving a stale binary');

  const freshnessCalls = fetchCalls.filter((call) => /\/api\/|latest-debug\.apk/.test(call.url));
  assert(freshnessCalls.every((call) => call.options && call.options.cache === 'no-store'), 'freshness-sensitive requests bypass the browser HTTP cache');

  const catalog = await dispatchFetch('/v3/js/i18n-en.js?v=catalog');
  assert.strictEqual(catalog.body, 'cached-catalog', 'offline static catalog remains available when its network refresh fails');
  assert(fetchCalls.some((call) => call.url.includes('i18n-en.js')), 'runtime catalog still uses its existing network-first refresh policy');

  let activation;
  handlers.activate({ waitUntil(value) { activation = value; } });
  await activation;
  assert(deletedCacheNames.includes('dpos-space-v3-old'), 'old versioned shell cache is still cleaned up');
  assert(cacheStores.has('unrelated-user-cache'), 'unrelated cache storage is not deleted');
  assert.strictEqual((await unrelatedCache.match('/account-settings')).body, 'unrelated', 'unrelated user data remains intact');
  assert(await currentCache.match('/v3/js/i18n-en.js?v=catalog'), 'current offline static catalog remains cached');
  assert.strictEqual(await currentCache.match('/api/smartfarm'), undefined, 'activation removes stale financial API entries');
  assert.strictEqual(await currentCache.match('/api/smartfarm/loto?date=2026-09-19'), undefined, 'activation removes stale financial API subpath entries');
  assert.strictEqual(await currentCache.match('/api/balance'), undefined, 'activation removes stale entries for every API endpoint');
  assert.strictEqual(await currentCache.match('/downloads/dpos-space-latest-debug.apk'), undefined, 'activation removes stale latest-APK entries');

  console.log('v3 service-worker financial/APK freshness passed');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
