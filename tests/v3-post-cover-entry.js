'use strict';
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
class Element {
  constructor() { this.value = ''; this.textContent = ''; this.innerHTML = ''; this.hidden = false; this.disabled = false; this.checked = false; this.isConnected = true; this.dataset = {}; this.style = {}; this.listeners = {}; this.attributes = {}; this.children = []; }
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
  appendChild(node) { this.children.push(node); }
  replaceChildren() { this.children = []; }
  remove() {}
}
const watchdog = setTimeout(() => { console.error('post-cover entry test stalled'); process.exit(1); }, 5000);
(async () => {
  const elements = new Map();
  const element = id => { if (!elements.has(id)) elements.set(id, new Element()); return elements.get(id); };
  const root = new Element(), form = element('editor-form');
  const parts = new Map(); root.querySelector = selector => { if (!parts.has(selector)) parts.set(selector, new Element()); return parts.get(selector); };
  root.closest = () => form;
  const suggestionRoot = new Element(), suggestionParts = new Map();
  suggestionRoot.closest = () => form;
  suggestionRoot.querySelector = selector => { if (!suggestionParts.has(selector)) suggestionParts.set(selector, new Element()); return suggestionParts.get(selector); };
  form.querySelector = selector => selector.startsWith('#') ? element(selector.slice(1)) : null;
  element('app').querySelector = selector => selector === '[data-post-cover]' ? root : selector === '[data-title-suggestions]' ? suggestionRoot : null;
  const calls = []; let downloadCount = 0; const revoked = [];
  const context = {
    console, URLSearchParams, TextEncoder, TextDecoder, Blob, Intl, AbortController, setTimeout, clearTimeout,
    URL: class extends URL { static createObjectURL() { return 'blob:entry-cover'; } static revokeObjectURL(url) { revoked.push(url); } },
    Event: class { constructor(type) { this.type = type; } },
    location: { hash: '#app=diagnostics', origin: 'https://example.test', hostname: 'example.test', pathname: '/' },
    DposDiagnosticsUI: { render() {} },
    addEventListener() {}, removeEventListener() {}, navigator: {},
    DposVault: { status: () => ({ state: 'unlocked' }), issueGuard: () => 1, assertGuard() {}, getServiceKey: () => 'fixture-only-groq-key' },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    FormData: class {
      constructor(target) {
        this.entries = target ? [...element('app').innerHTML.matchAll(/<(?:input|select|textarea)\b[^>]*\bname="([^"]+)"[^>]*>/g)].map(match => {
          const id = match[0].match(/\bid="([^"]+)"/); return [match[1], id ? element(id[1]).value : ''];
        }) : [];
      }
      append(name, value) { assert.equal(name, 'image'); assert.equal(value.type, 'image/png'); }
    },
    fetch: async (url, options) => {
      assert.equal(options.method, 'POST');
      if (url === 'https://api.groq.com/openai/v1/chat/completions') {
        titleCalls.push({ url, options }); let read = false;
        const bytes = new TextEncoder().encode(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ titles: ['Выбранный заголовок', 'Другой заголовок', 'Третий заголовок'] }) } }] }));
        return { ok: true, headers: { get: () => null }, body: { getReader: () => ({ read: async () => read ? { done: true } : (read = true, { value: bytes, done: false }), cancel: async () => {} }) } };
      }
      calls.push({ url, options }); assert.equal(url, 'https://api.imgur.com/3/image.json'); return { ok: true, json: async () => ({ success: true, data: { link: 'https://i.imgur.com/entry-cover.png' } }) };
    },
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
  let voiceMounts = [], titleCalls = [];
  root.ownerDocument = suggestionRoot.ownerDocument = context.document; context.window = context; vm.createContext(context);
  for (const file of ['chains.js', 'i18n-en.js', 'i18n.js', 'post-cover.js', 'title-suggestions.js', 'app.js']) vm.runInContext(fs.readFileSync('v3/js/' + file, 'utf8'), context, { filename: file });
  await new Promise(setImmediate);
  const part = name => root.querySelector(`[data-cover-${name}]`);
  for (const chain of ['golos', 'steem', 'hive']) {
    context.location.hash = `#chain=${chain}&app=editor`; await context.DposV3.renderRoute();
    assert(element('app').innerHTML.includes('data-post-cover'), `${chain}: actual renderEditor includes cover controls`);
    assert(element('app').innerHTML.includes('editor-body'), `${chain}: Markdown textarea retained`);
    element('editor-title').value = 'Заголовок ' + chain; element('editor-body').value = 'Existing post'; element('editor-tags').value = 'tag1 tag2'; element('editor-image').value = 'https://example.test/original.png';
    const legacyFields = ['title','permlink','tags','image','body','payouts','beneficiary_account','beneficiary_weight', ...(chain === 'golos' ? ['category','curation_percent'] : chain === 'hive' ? ['category'] : [])].sort();
    const before = new context.FormData(form).entries;
    assert.deepEqual(before.map(entry => entry[0]).sort(), legacyFields, chain + ': unchanged legacy FormData fieldset');
    assert.equal(titleCalls.length, 2 * ['golos','steem','hive'].indexOf(chain), 'render never calls Groq');
    root.open = true; await root.fire('toggle');
    assert(!element('app').innerHTML.includes('data-cover-title'));
    await part('create').fire('click');
    assert(part('description').textContent.includes('Заголовок ' + chain));
    assert.equal(calls.length, ['golos','steem','hive'].indexOf(chain), 'create does not POST');
    await part('download').fire('click');
    assert.equal(calls.length, ['golos','steem','hive'].indexOf(chain), 'download does not POST');
    await suggestionRoot.querySelector('[data-title-request]').fire('click');
    assert.equal(element('editor-title').value, 'Заголовок ' + chain, 'request alone never replaces title');
    assert.deepEqual(new context.FormData(form).entries, before, 'request preserves complete publication FormData');
    const choice = suggestionRoot.querySelector('[data-title-choices]').children[0]; await choice.fire('click');
    assert.equal(element('editor-title').value, 'Выбранный заголовок');
    assert.equal(part('upload').disabled, true, 'choosing title invalidates canonical cover');
    assert.equal(part('preview').hidden, true);
    const selected = new context.FormData(form).entries;
    assert.deepEqual(selected.filter(entry => entry[0] !== 'title'), before.filter(entry => entry[0] !== 'title'));
    await part('create').fire('click'); assert(part('description').textContent.includes('Выбранный заголовок'));
    await part('upload').fire('click');
    assert.equal(element('editor-body').value, '![](https://i.imgur.com/entry-cover.png)\n\nExisting post');
    assert.equal(element('editor-image').value, 'https://example.test/original.png');
    assert.equal(element('editor-title').value, 'Выбранный заголовок'); assert.equal(element('editor-tags').value, 'tag1 tag2');
    const staleChoiceTask = suggestionRoot.querySelector('[data-title-request]').fire('click'); await staleChoiceTask;
    const staleChoice = suggestionRoot.querySelector('[data-title-choices]').children[0];
    element('editor-body').value = 'New current draft'; await element('editor-body').fire('input'); await staleChoice.fire('click');
    assert.equal(element('editor-title').value, 'Выбранный заголовок'); assert.equal(element('editor-body').value, 'New current draft');

  }
  context.location.hash = '#app=diagnostics'; await context.DposV3.renderRoute();
  assert.equal(revoked.length, 6, 'title selection and route lifecycle revoke every cover URL');
  assert.equal(calls.length, 3); assert.equal(downloadCount, 3);
  assert.equal(titleCalls.length, 6, 'exactly the two explicit title requests per chain');
  assert.deepEqual(voiceMounts, ['golos','steem','hive']);
  context.DposI18n.setLocale('en');
  for (const [ru,en] of [['Создать обложку','Create cover'],['Скачать PNG','Download PNG'],['Обложка без текста.','Cover without text.'],['Предложить заголовки','Suggest titles']]) assert.equal(context.DposI18n.t(ru), en);
  console.log('title/cover actual app entry: Golos/Steem/Hive, legacy fieldsets unchanged, explicit choose -> canonical title -> cover, stale draft, shared Imgur, no automatic POST, voice mount, route cleanup and EN passed');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => clearTimeout(watchdog));
