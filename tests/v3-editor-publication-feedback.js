const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}
function fakeElement(extra = {}) {
  return Object.assign({
    innerHTML: '', textContent: '', value: '', disabled: false, hidden: false,
    dataset: {}, style: {}, addEventListener() {}, setAttribute() {}, removeAttribute() {}, appendChild() {}, querySelector: () => null, querySelectorAll: () => [], closest: () => fakeElement()
  }, extra);
}
function loadOperations() {
  const context = {
    console, URLSearchParams, TextEncoder, TextDecoder, Blob,
    location: { hash: '#chain=golos&app=help', origin: 'https://example.test', hostname: 'example.test', pathname: '/' },
    addEventListener() {}, confirm: () => true,
    localStorage: { getItem: () => null, setItem() {}, removeItem() {}, key: () => null, length: 0 },
    navigator: {}, FormData: class {},
    document: { getElementById: () => fakeElement({ dataset: {} }), querySelector: () => null, createElement: () => fakeElement({ click() {}, remove() {} }), body: fakeElement(), head: fakeElement() },
    DposChains: { golos: { id: 'golos', title: 'Golos', apps: [{ id: 'help', title: 'Help' }], defaultAccount: '' } },
    DposAuth: { getUsers: () => [], getCurrentUser: () => null, getCurrentLogin: () => '', getUserLogin: () => '', getUserType: () => 'standard' },
    DposBroadcast: {}, DposProfiles: { formatError: (error) => error.message }, DposHistory: {}, DposNotifications: null
  };
  context.globalThis = context;
  context.window = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync('v3/js/app.js', 'utf8'), context, { filename: 'v3/js/app.js' });
  return context.DposV3.securityOperations;
}

(async () => {
 const api=loadOperations();
 assert.equal(typeof api.createEditorPublicationFeedback,'function');
 for(const chain of ['golos','hive','steem']) {
  const box={isConnected:true,hidden:true,innerHTML:''};let content=null;let reads=0;
  const feedback=api.createEditorPublicationFeedback({id:chain},box,async()=>{reads++;return content;});
  const op=['comment',{parent_author:'',author:'alice',permlink:'generated-post',title:'Title',body:'Body'}];
  feedback.capture([op],false);
  await feedback.broadcast(async()=>({}),{}, {},{dryRun:true});
  assert.equal(reads,0);assert.equal(box.hidden,true);
  content=op[1];
  const result={ok:true};assert.equal(await feedback.broadcast(async()=>result,{}, {},{dryRun:false}),result);
  await new Promise(setImmediate);
  assert(box.innerHTML.includes('Пост опубликован.'));
  assert(box.innerHTML.includes('chain='+chain));assert(box.innerHTML.includes('permlink=generated-post'));
  feedback.capture([op],true);await feedback.broadcast(async()=>({}),{},{},{dryRun:false});await new Promise(setImmediate);assert(box.innerHTML.includes('Изменения сохранены.'));
  content={...op[1],body:'old body'};feedback.capture([op],true);
  await feedback.broadcast(async()=>({}),{}, {},{dryRun:false});await new Promise(setImmediate);
  assert(!box.innerHTML.includes('Изменения сохранены.'));assert(box.innerHTML.includes('Проверить пост'));
  const error=new Error('network lost');
  await assert.rejects(feedback.broadcast(async()=>{throw error;},{},{},{dryRun:false}),e=>e===error);
  assert(box.innerHTML.includes('Проверить пост'));
  let resolve;const late={isConnected:true,hidden:true,innerHTML:''};
  const delayed=api.createEditorPublicationFeedback({id:chain},late,()=>new Promise(r=>resolve=r));delayed.capture([op],false);
  await delayed.broadcast(async()=>({}),{},{},{dryRun:false});
  late.isConnected=false;const before=late.innerHTML;resolve(op[1]);await new Promise(setImmediate);assert.equal(late.innerHTML,before);
 }
 console.log('editor publication feedback checks passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
