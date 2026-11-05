'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
class Element {
  constructor(value = '') { this.value = value; this.hidden = false; this.disabled = false; this.checked = false; this.isConnected = true; this.listeners = {}; this.attributes = {}; this.textContent = ''; }
  addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
  removeEventListener(type, fn) { this.listeners[type] = (this.listeners[type] || []).filter(f => f !== fn); }
  async fire(type) { await Promise.all((this.listeners[type] || []).map(fn => fn({ target: this }))); }
  setAttribute(key, value) { this.attributes[key] = value; }
  removeAttribute(key) { delete this.attributes[key]; }
  dispatchEvent(event) { void this.fire(event.type); }
  remove() {}
}
function fixture(options = {}) {
  const fields = Object.fromEntries(['title','body','tags','image'].map(n => ['#editor-' + n, new Element(n + ' original')]));
  const parts = Object.fromEntries(['no-text','create','download','upload','replace','status','preview','description','open'].map(n => ['[data-cover-' + n + ']', new Element()]));
  const root = new Element(); root.open = false;
  root.querySelector = s => parts[s];
  const form = new Element(); form.querySelector = s => fields[s]; root.closest = () => form;
  const doc = { fonts: { add() {}, ready: Promise.resolve() }, createElement: name => name === 'canvas' ? canvas : Object.assign(new Element(), { click() { downloads++; } }), body: { appendChild() {} } };
  root.ownerDocument = doc;
  let downloads = 0, draws = [], fontLoads = 0, revokes = [], creates = 0, uploads = 0;
  const canvas = { getContext: () => ({ set font(value) { assert.equal(value, '700 64px DposCoverTitle'); }, measureText: s => ({ width: Array.from(s).length * 32 }), drawImage: () => draws.push('base'), fillText: (s,x,y) => { assert(x === 72 && x + Array.from(s).length * 32 <= 680); assert(y >= 120 && y + 64 <= 560); draws.push({s,x,y}); }, save() {}, restore() {}, beginPath() {}, rect(x,y,w,h) { assert.deepEqual([x,y,w,h], [72,120,608,440]); }, clip() {} }), toBlob: cb => options.encode ? options.encode.promise.then(cb) : cb(new Blob(['png'], { type: 'image/png' })) };
  const env = { console, Intl, Blob, URL: class extends URL { static createObjectURL() { return 'blob:' + (++creates); } static revokeObjectURL(url) { revokes.push(url); } }, location: { hash: '#chain=golos&app=editor' }, Event: class { constructor(type) { this.type = type; } }, setTimeout, clearTimeout,
    FontFace: class { constructor(family, source, descriptor) { assert.equal(family, 'DposCoverTitle'); assert(source.includes('/v3/assets/covers/cover-title.ttf')); assert.equal(descriptor.weight, '700'); } async load() { fontLoads++; if (options.fontError) throw Error('font missing'); if (options.font) await options.font.promise; return this; } },
    Image: class { set src(value) { assert.equal(value, '/v3/assets/covers/winged-head.webp'); this.naturalWidth = 1200; this.naturalHeight = 675; queueMicrotask(() => options.imageError ? this.onerror() : this.onload()); } }
  };
  env.globalThis = env; vm.createContext(env); vm.runInContext(fs.readFileSync('v3/js/post-cover.js', 'utf8'), env);
  const upload = async blob => { uploads++; assert.equal(blob.type, 'image/png'); if (options.uploadError) throw Error('HTTP failure'); return options.upload ? options.upload.promise : 'https://i.imgur.com/cover.png'; };
  const dispose = env.DposPostCover.mount(root, { upload });
  const part = name => parts['[data-cover-' + name + ']'];
  const open = async () => { root.open = true; await root.fire('toggle'); };
  return { env, fields, parts, root, form, part, open, dispose, draws, revokes, canvas, counts: () => ({ downloads, fontLoads, creates, uploads }) };
}
(async () => {
  const font = deferred(); const f = fixture({ font }); await f.open();
  f.fields['#editor-title'].value = '<b>canonical</b>';
  const creating = f.part('create').fire('click'); await Promise.resolve();
  assert.equal(f.draws.length, 0, 'must wait for local font'); assert.equal(f.part('create').disabled, true);
  await f.part('create').fire('click'); font.resolve(); await creating;
  assert.equal(f.canvas.width, 1200); assert.equal(f.canvas.height, 675);
  assert.equal(f.counts().creates, 1); assert.equal(f.counts().uploads, 0);
  assert(f.part('description').textContent.includes('<b>canonical</b>'));
  assert.equal(f.fields['#editor-title'].value, '<b>canonical</b>');
  await f.part('download').fire('click'); assert.equal(f.counts().downloads, 1); assert.equal(f.counts().uploads, 0);
  await f.part('upload').fire('click'); assert.equal(f.counts().uploads, 1);
  assert.equal(f.fields['#editor-image'].value, 'image original');
  assert.equal(f.fields['#editor-body'].value, '![](https://i.imgur.com/cover.png)\n\nbody original');
  assert.equal(f.fields['#editor-tags'].value, 'tags original');
  await f.part('upload').fire('click'); assert.equal(f.counts().uploads, 1, 'no double insert');
  f.part('no-text').checked = true; await f.part('no-text').fire('change');
  assert.deepEqual(f.revokes, ['blob:1']); assert.equal(f.part('download').disabled, true);
  await f.part('create').fire('click'); assert(f.part('description').textContent.includes('без текста'));
  f.dispose(); assert.deepEqual(f.revokes, ['blob:1','blob:2']);
  for (const type of ['fontError','imageError']) {
    const failed = fixture({ [type]: true }); await failed.open(); await failed.part('create').fire('click');
    assert.equal(failed.counts().creates, 0); assert.equal(failed.part('download').disabled, true); assert(failed.part('status').textContent.includes('Не удалось'));
  }
  const pending = deferred(), stale = fixture({ upload: pending }); await stale.open(); await stale.part('create').fire('click');
  const uploading = stale.part('upload').fire('click'); await stale.part('upload').fire('click');
  stale.fields['#editor-body'].value = 'new draft'; pending.resolve('https://i.imgur.com/stale.png'); await uploading;
  assert.equal(stale.counts().uploads, 1); assert.equal(stale.fields['#editor-body'].value, 'new draft'); assert.equal(stale.fields['#editor-image'].value, 'image original');
  const route = deferred(), late = fixture({ encode: route }); await late.open(); const lateCreate = late.part('create').fire('click');
  await new Promise(setImmediate); late.env.location.hash = '#chain=hive&app=editor'; route.resolve(new Blob(['png'])); await lateCreate;
  assert.equal(late.counts().creates, 0, 'stale route may not allocate URL');
  const consent = fixture(); await consent.open(); await consent.part('create').fire('click'); consent.part('replace').checked = true;
  await consent.part('upload').fire('click'); assert.equal(consent.fields['#editor-image'].value, 'https://i.imgur.com/cover.png');
  const reset = fixture(); await reset.open(); await reset.part('create').fire('click'); await reset.form.fire('reset'); assert.deepEqual(reset.revokes, ['blob:1']);
  for (const event of ['input', 'change']) {
    const canonical = fixture(); await canonical.part('create').fire('click');
    canonical.fields['#editor-title'].value = 'Changed title'; await canonical.fields['#editor-title'].fire(event);
    assert.equal(canonical.part('download').disabled, true); assert.equal(canonical.part('upload').disabled, true); assert.equal(canonical.part('preview').hidden, true);
    assert.deepEqual(canonical.revokes, ['blob:1']); await canonical.part('upload').fire('click'); assert.equal(canonical.counts().uploads, 0);
    await canonical.part('create').fire('click'); assert(canonical.part('description').textContent.includes('Changed title')); canonical.dispose();
    const pendingTitle = deferred(), pendingCover = fixture({ encode: pendingTitle }); const task = pendingCover.part('create').fire('click');
    await new Promise(setImmediate); pendingCover.fields['#editor-title'].value = 'New title'; await pendingCover.fields['#editor-title'].fire(event);
    pendingTitle.resolve(new Blob(['png'])); await task; assert.equal(pendingCover.counts().creates, 0); pendingCover.dispose();
    const pendingUpload = deferred(), uploadingCover = fixture({ upload: pendingUpload }); await uploadingCover.part('create').fire('click');
    const uploadingTask = uploadingCover.part('upload').fire('click'); uploadingCover.fields['#editor-title'].value = 'Chosen suggestion'; await uploadingCover.fields['#editor-title'].fire(event);
    pendingUpload.resolve('https://i.imgur.com/stale-title.png'); await uploadingTask; assert.equal(uploadingCover.fields['#editor-body'].value, 'body original'); assert.equal(uploadingCover.fields['#editor-image'].value, 'image original'); uploadingCover.dispose();
  }
  const blank = fixture(); await blank.open(); blank.fields['#editor-title'].value = '   '; await blank.part('create').fire('click');
  assert(blank.part('status').textContent.includes('без текста')); assert.deepEqual(blank.draws, ['base']); blank.dispose();
  const long = fixture(); await long.open(); long.fields['#editor-title'].value = 'слово '.repeat(80); await long.part('create').fire('click');
  assert(long.part('description').textContent.includes('…')); assert(long.part('description').textContent.includes('сокращён')); long.dispose();
  const android = fixture(); await android.open(); await android.part('create').fire('click'); android.env.DposNative = { available: () => true };
  await android.part('download').fire('click'); assert.equal(android.counts().downloads, 0); assert.equal(android.counts().uploads, 0); assert(android.part('status').textContent.includes('Android')); android.dispose();
  const emptyPreview = fixture(); await emptyPreview.open(); emptyPreview.fields['#editor-image'].value = ''; await emptyPreview.part('create').fire('click'); await emptyPreview.part('upload').fire('click'); assert.equal(emptyPreview.fields['#editor-image'].value, 'https://i.imgur.com/cover.png'); emptyPreview.dispose();
  const failedUpload = fixture({ uploadError: true }); await failedUpload.open(); await failedUpload.part('create').fire('click'); await failedUpload.part('upload').fire('click');
  assert.equal(failedUpload.fields['#editor-body'].value, 'body original'); assert.equal(failedUpload.fields['#editor-image'].value, 'image original'); assert.equal(failedUpload.part('download').disabled, false); failedUpload.dispose();
  const inFlight = deferred(), disposed = fixture({ encode: inFlight }); await disposed.open(); const pendingCreate = disposed.part('create').fire('click');
  await new Promise(setImmediate); disposed.dispose(); inFlight.resolve(new Blob(['png'])); await pendingCreate; assert.equal(disposed.counts().creates, 0);
  const lateUpload = deferred(), detached = fixture({ upload: lateUpload }); await detached.open(); await detached.part('create').fire('click'); const pendingUpload = detached.part('upload').fire('click');
  detached.dispose(); lateUpload.resolve('https://i.imgur.com/late.png'); await pendingUpload; assert.equal(detached.fields['#editor-body'].value, 'body original');
  console.log('post-cover UI: local font/base, canvas/export, safe upload, preservation, stale route, reset/disposal passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
