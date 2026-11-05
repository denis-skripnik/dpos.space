'use strict';
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
class Element {
  constructor() { this.value = ''; this.textContent = ''; this.innerHTML = ''; this.hidden = false; this.disabled = false; this.checked = false; this.isConnected = true; this.dataset = {}; this.style = {}; this.listeners = {}; this.attributes = {}; }
  addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
  removeEventListener(type, fn) { this.listeners[type] = (this.listeners[type] || []).filter(f => f !== fn); }
  async fire(type) { for (const fn of this.listeners[type] || []) await fn({ target: this }); }
  dispatchEvent(event) { void this.fire(event.type); }
  setAttribute(key, value) { this.attributes[key] = value; }
  removeAttribute(key) { delete this.attributes[key]; }
  hasAttribute(key) { return key in this.attributes; }
  querySelectorAll() { return []; }
  querySelector() { return null; }
  closest() { return new Element(); }
  focus() {}
  remove() {}
}
const watchdog = setTimeout(() => { console.error('post-cover entry test stalled'); process.exit(1); }, 5000);
(async () => {
  const elements = new Map();
  const element = id => { if (!elements.has(id)) elements.set(id, new Element()); return elements.get(id); };
  const root = new Element(), form = element('editor-form');
  const parts = new Map(); root.querySelector = selector => { if (!parts.has(selector)) parts.set(selector, new Element()); return parts.get(selector); };
  root.closest = () => form;
  form.querySelector = selector => selector.startsWith('#') ? element(selector.slice(1)) : null;
  element('app').querySelector = selector => selector === '[data-post-cover]' ? root : null;
  const calls = []; let downloadCount = 0; const revoked = [];
  const context = {
    console, URLSearchParams, TextEncoder, TextDecoder, Blob, Intl, setTimeout, clearTimeout,
    URL: class extends URL { static createObjectURL() { return 'blob:entry-cover'; } static revokeObjectURL(url) { revoked.push(url); } },
    Event: class { constructor(type) { this.type = type; } },
    location: { hash: '#app=diagnostics', origin: 'https://example.test', hostname: 'example.test', pathname: '/' },
    DposDiagnosticsUI: { render() {} },
    addEventListener() {}, navigator: {},
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    FormData: class { append(name, value) { assert.equal(name, 'image'); assert.equal(value.type, 'image/png'); } },
    fetch: async (url, options) => { calls.push({ url, options }); assert.equal(url, 'https://api.imgur.com/3/image.json'); assert.equal(options.method, 'POST'); return { ok: true, json: async () => ({ success: true, data: { link: 'https://i.imgur.com/entry-cover.png' } }) }; },
    FontFace: class { load() { return Promise.resolve(this); } },
    Image: class { set src(value) { this.naturalWidth = 1200; this.naturalHeight = 675; queueMicrotask(() => this.onload()); } },
    document: {
      getElementById: element, querySelector: () => null, fonts: { add() {}, ready: Promise.resolve() },
      createElement: tag => tag === 'canvas' ? { getContext: () => ({ drawImage() {}, measureText: text => ({ width: text.length * 32 }), save() {}, restore() {}, beginPath() {}, rect() {}, clip() {}, fillText() {} }), toBlob: callback => callback(new Blob(['png'], { type: 'image/png' })) } : Object.assign(new Element(), { click() { downloadCount++; } }),
      head: { appendChild() {} }, body: { appendChild() {} }
    },
    DposAuth: { getCurrentLogin: () => '', getCurrentUser: () => null, getUsers: () => [], getUserLogin: () => '', getUserType: () => 'standard', selectUser: () => null },
    DposBroadcast: {}, DposProfiles: { formatError: error => error.message }, DposHistory: {},
    DposVoiceUI: { mountEditor: (app, { chain, openEditor }) => { assert.equal(app, element('app')); assert.equal(typeof openEditor, 'function'); voiceMounts.push(chain.id); } }
  };
  let voiceMounts = [];
  root.ownerDocument = context.document; context.window = context; vm.createContext(context);
  for (const file of ['chains.js', 'i18n-en.js', 'i18n.js', 'post-cover.js', 'app.js']) vm.runInContext(fs.readFileSync('v3/js/' + file, 'utf8'), context, { filename: file });
  await new Promise(setImmediate);
  const part = name => root.querySelector(`[data-cover-${name}]`);
  for (const chain of ['golos', 'steem', 'hive']) {
    context.location.hash = `#chain=${chain}&app=editor`; await context.DposV3.renderRoute();
    assert(element('app').innerHTML.includes('data-post-cover'), `${chain}: actual renderEditor includes cover controls`);
    assert(element('app').innerHTML.includes('editor-body'), `${chain}: Markdown textarea retained`);
    element('editor-title').value = 'Заголовок ' + chain; element('editor-body').value = 'Existing post'; element('editor-tags').value = 'tag1 tag2'; element('editor-image').value = 'https://example.test/original.png';
    root.open = true; await root.fire('toggle');
    assert.equal(part('title').value, 'Заголовок ' + chain);
    await part('create').fire('click');
    assert.equal(calls.length, ['golos','steem','hive'].indexOf(chain), 'create does not POST');
    await part('download').fire('click');
    assert.equal(calls.length, ['golos','steem','hive'].indexOf(chain), 'download does not POST');
    await part('upload').fire('click');
    assert.equal(element('editor-body').value, '![](https://i.imgur.com/entry-cover.png)\n\nExisting post');
    assert.equal(element('editor-image').value, 'https://example.test/original.png');
    assert.equal(element('editor-title').value, 'Заголовок ' + chain); assert.equal(element('editor-tags').value, 'tag1 tag2');
  }
  context.location.hash = '#app=diagnostics'; await context.DposV3.renderRoute();
  assert.equal(revoked.length, 3, 'route lifecycle revokes every cover URL');
  assert.equal(calls.length, 3); assert.equal(downloadCount, 3);
  assert.deepEqual(voiceMounts, ['golos','steem','hive']);
  context.DposI18n.setLocale('en');
  for (const [ru,en] of [['Создать обложку','Create cover'],['Скачать PNG','Download PNG'],['Обложка без текста.','Cover without text.']]) assert.equal(context.DposI18n.t(ru), en);
  console.log('post-cover actual app entry: Golos/Steem/Hive, shared Imgur callback, no POST on create/download, preservation, route cleanup, voice mount and EN passed');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => clearTimeout(watchdog));
