const assert = require('assert'), fs = require('fs'), vm = require('vm');
function boot(native = true, capability = true) {
  const calls = []; let localRead = 0; let fail = false;
  const nodes = new Map();
  const node = key => { if (!nodes.has(key)) nodes.set(key, {textContent:'',innerHTML:'',disabled:false,addEventListener(type, fn){ this[type]=fn; }}); return nodes.get(key); };
  const container = {innerHTML:'',querySelector:node};
  const state = {ok:true,unreadCount:35,events:[{id:'event',title:'VIZ: награда',text:'1.734 VIZ <img onerror=x>',route:'#chain=viz&app=history',read:false}]};
  const context = {console, Set, Map, Number, Error, Promise, DposNotifications:{filteredNotifications:()=>[{id:'web',text:'web'}],markAllRead:()=>{localRead++;}},DposNative:{available:()=>native,request:async method=>{
    calls.push(method);
    if(method==='getAppInfo') return {notificationInbox:capability};
    if(method==='getNotificationInbox') return state;
    if(method==='markAllNotificationsRead'){ if(fail) return {ok:false}; state.unreadCount=0;state.events=[];return {ok:true,unreadCount:0}; }
    throw Error(method);
  }}};
  context.window=context;vm.createContext(context);vm.runInContext(fs.readFileSync('v3/js/notification-inbox.js','utf8'),context);
  return {api:context.DposNotificationInbox,calls,nodes,node,container,state,setFail:()=>{fail=true;},localRead:()=>localRead};
}
(async()=>{
 const t=boot(); await t.api.render(t.container);
 assert.equal(t.node('[data-inbox-count]').textContent,'35');
 assert(t.node('[data-inbox-events]').innerHTML.includes('&lt;img'));
 assert(t.node('[data-inbox-status]').textContent.includes('Счётчик включает все'));
 assert.deepEqual(t.calls,['getAppInfo','getNotificationInbox']);
 await t.api.markAllRead(); assert.equal(t.localRead(),1); assert.equal((await t.api.read()).unreadCount,0);
 const failed=boot(); failed.setFail(); await assert.rejects(()=>failed.api.markAllRead()); assert.equal(failed.localRead(),0);
 const old=boot(true,false); await old.api.markAllRead();assert.deepEqual(old.calls,['getAppInfo']);assert.equal(old.localRead(),1);
 const browser=boot(false);assert.equal((await browser.api.read()).unreadCount,1);assert.equal(browser.calls.length,0);
 const stale=boot();await stale.api.render(stale.container,{isCurrent:()=>false});assert.equal(stale.calls.length,0);
 console.log('Notification inbox: authoritative total, safe rendering, no auto-ack, read-all failure, old APK/browser fallback and stale route passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
