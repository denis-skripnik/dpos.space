const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.resolve(__dirname, '..');
(async () => {
  const handlers = {};
  let installed;
  const network = [];
  const c = { URL, self: { location: { origin: 'https://local.test' }, addEventListener: (name, fn) => { handlers[name] = fn; }, skipWaiting() {} },
    caches: { open: async () => ({ addAll: async (assets) => { installed = assets; }, match: async () => { throw Error('sensitive data consulted cache'); } }) },
    fetch: async (request, options) => { network.push({ url: request.url, options }); return { ok: true }; }
  };
  vm.createContext(c); vm.runInContext(fs.readFileSync(path.join(root, 'sw.js'), 'utf8'), c);
  let done;
  handlers.install({ waitUntil: (promise) => { done = promise; } }); await done;
  const scripts = [...fs.readFileSync(path.join(root, 'index.html'), 'utf8').matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]);
  const helper = scripts.findIndex((s) => s.startsWith('v3/js/long-archive.js?'));
  const app = scripts.findIndex((s) => s.startsWith('v3/js/app.js?'));
  assert(helper >= 0 && app > helper, 'canonical index loads reader before app');
  for (const i of [helper, app]) assert(installed.includes('/' + scripts[i]), 'shell asset matches canonical version');
  for (const name of ['/v3/data/long/manifest.json', '/v3/data/long/snapshot.json', '/v3/data/long/loto/2026-10-31.txt', '/api/smartfarm', '/downloads/dpos-space-3.1.3.apk']) {
    let promise;
    handlers.fetch({ request: { url: 'https://local.test' + name, method: 'GET', mode: 'cors' }, respondWith: (p) => { promise = p; } });
    await promise;
    assert.equal(network.at(-1).options.cache, 'no-store');
  }
  console.log('PASS v3-long-archive-shell: load order/version coupling, archive/API/APK network-only');
})().catch((error) => { console.error(error); process.exitCode = 1; });
