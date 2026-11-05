'use strict';
const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
class Element {
  constructor() { this.value = ''; this.textContent = ''; this.children = []; this.listeners = {}; this.isConnected = true; this.disabled = false; }
  addEventListener(name, fn) { (this.listeners[name] ||= []).push(fn); }
  removeEventListener(name, fn) { this.listeners[name] = (this.listeners[name] || []).filter(f => f !== fn); }
  async fire(type) { await Promise.all((this.listeners[type] || []).slice().map(fn => fn({ target: this }))); }
  dispatchEvent(event) { void this.fire(event.type); }
  replaceChildren() { this.children = []; }
  appendChild(node) { this.children.push(node); }
  focus() { this.focused = true; }
}
const titles = ['<b>Первый</b>','Второй заголовок','Третий заголовок'];
function fixture(options = {}) {
  const env = new Element(), root = new Element(), form = new Element();
  const fields = { title: new Element(), body: new Element(), tags: new Element(), image: new Element() };
  Object.entries(fields).forEach(([name, node]) => { node.value = 'original ' + name; });
  const parts = { request: new Element(), status: new Element(), choices: new Element() };
  root.closest = () => form; form.querySelector = s => fields[s.replace('#editor-', '')];
  root.querySelector = s => parts[s.replace('[data-title-', '').replace(']', '')];
  root.ownerDocument = { createElement: () => new Element() };
  let requests = 0, epoch = 1;
  Object.assign(env, { AbortController, TextDecoder, setTimeout, clearTimeout, location: { hash: '#chain=golos&app=editor' }, Event: class { constructor(type) { this.type = type; } },
    DposVault: { status: () => ({ state: 'unlocked' }), issueGuard: () => epoch, assertGuard(value) { if (epoch !== value) throw Error('stale vault'); }, getServiceKey: () => 'fixture-only-key' },
    fetch: async (url, init) => {
      requests++; if (options.wait) await options.wait.promise;
      if (options.error) throw Error('raw provider error contains secret');
      let read = false; const bytes = new TextEncoder().encode(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ titles }) } }] }));
      return { ok: true, headers: { get: () => null }, body: { getReader: () => ({ read: async () => read ? { done: true } : (read = true, { value: bytes, done: false }), cancel: async () => {} }) } };
    }
  });
  env.window = env; vm.createContext(env); vm.runInContext(fs.readFileSync('v3/js/title-suggestions.js', 'utf8'), env);
  const dispose = env.DposTitleSuggestions.mount(root);
  return { env, root, form, fields, parts, dispose, count: () => requests, rotate: () => epoch++ };
}
const watchdog = setTimeout(() => { console.error('title UI stalled'); process.exit(1); }, 10000);
(async () => {
  const f = fixture(); assert.equal(f.count(), 0); await f.form.fire('submit'); assert.equal(f.count(), 0);
  await f.parts.request.fire('click'); assert.equal(f.count(), 1); assert.equal(f.parts.choices.children.length, 3);
  assert.equal(f.parts.choices.children[0].textContent, titles[0]); assert.equal(f.fields.title.value, 'original title');
  let changes = 0; f.fields.title.addEventListener('input', () => changes++);
  await f.parts.choices.children[0].fire('click'); assert.equal(f.fields.title.value, titles[0]); assert.equal(changes, 1); assert.equal(f.parts.choices.children.length, 0);
  assert.equal(f.fields.body.value, 'original body'); assert.equal(f.fields.tags.value, 'original tags'); assert.equal(f.fields.image.value, 'original image'); assert.equal(f.fields.title.focused, true);
  for (const kind of ['input','change','reset','route','dispose','lock','unlock','key','guard','programmatic']) {
    const s = fixture(); await s.parts.request.fire('click'); const choice = s.parts.choices.children[0];
    if (kind === 'input' || kind === 'change') { s.fields.body.value = 'new draft'; await s.fields.body.fire(kind); }
    if (kind === 'reset') await s.form.fire('reset');
    if (kind === 'route') s.env.location.hash = '#app=accounts';
    if (kind === 'dispose') s.dispose();
    if (kind === 'lock') await s.env.fire('dpos-vault-lock');
    if (kind === 'unlock') await s.env.fire('dpos-vault-ready');
    if (kind === 'key') await s.env.fire('dpos-service-key-change');
    if (kind === 'guard') s.rotate();
    if (kind === 'programmatic') s.fields.body.value = 'changed without event';
    await choice.fire('click'); assert.equal(s.fields.title.value, 'original title', kind + ': stale choice cannot apply'); s.dispose();
  }
  for (const event of ['input', 'reset', 'dpos-vault-lock', 'dpos-vault-ready', 'dpos-service-key-change', 'hashchange']) {
    const wait = deferred(), s = fixture({ wait }); const task = s.parts.request.fire('click'); await new Promise(setImmediate);
    await s.parts.request.fire('click'); assert.equal(s.count(), 1, 'single flight');
    if (event === 'input') { s.fields.body.value = 'new'; await s.fields.body.fire(event); }
    else if (event === 'reset') await s.form.fire(event); else await s.env.fire(event);
    wait.resolve(); await task; assert.equal(s.parts.choices.children.length, 0, event); assert.equal(s.fields.title.value, 'original title'); s.dispose();
  }
  const fail = fixture({ error: true }); await fail.parts.request.fire('click'); assert(!fail.parts.status.textContent.includes('secret')); assert(fail.parts.status.textContent.includes('Черновик сохранён')); assert.equal(fail.fields.body.value, 'original body'); assert.equal(fail.count(), 1);
  console.log('title UI: explicit only, text buttons, choose/input, complete draft preservation, singleflight and stale body/reset/route/lock/unlock/key guards passed');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => clearTimeout(watchdog));
