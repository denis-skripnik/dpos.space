'use strict';
// Node22; run a static server and an existing loopback Chromium CDP relay.
// DPOS_TEST_URL=http://127.0.0.1:18765/ node tests/browser/curation-rewards.cjs
const assert = require('node:assert/strict');
const base = process.env.DPOS_TEST_URL || 'http://127.0.0.1:18765/';
(async () => {
  const endpoint = await (await fetch('http://127.0.0.1:18800/json/version')).json();
  const socket = new WebSocket(endpoint.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;});
  let sequence=0;const pending=new Map();const errors=[];const blocked=[];
  const send=(method,params={},sessionId)=>new Promise((resolve,reject)=>{
    const id=++sequence;const timer=setTimeout(()=>reject(Error('CDP timeout '+method)),15000);
    pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));
  });
  socket.onmessage=message=>{
    const event=JSON.parse(message.data);
    if(event.id){const p=pending.get(event.id);pending.delete(event.id);clearTimeout(p.timer);event.error?p.reject(Error(JSON.stringify(event.error))):p.resolve(event.result);return;}
    if(event.method==='Runtime.exceptionThrown')errors.push(event.params.exceptionDetails);
    if(event.method==='Fetch.requestPaused'){
      const {request,requestId}=event.params;const allowed=request.method==='GET'&&new URL(request.url).origin===new URL(base).origin;
      if(!allowed)blocked.push({url:request.url,method:request.method});
      void send(allowed?'Fetch.continueRequest':'Fetch.failRequest',allowed?{requestId}:{requestId,errorReason:'BlockedByClient'},event.sessionId).catch(error=>errors.push(String(error)));
    }
  };
  const {browserContextId}=await send('Target.createBrowserContext',{disposeOnDetach:true});
  try{
    const {targetId}=await send('Target.createTarget',{url:'about:blank',browserContextId});
    const {sessionId}=await send('Target.attachToTarget',{targetId,flatten:true});
    const call=(method,params)=>send(method,params,sessionId);
    const ev=async expression=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
    const wait=async expression=>{for(let i=0;i<150;i++){if(await ev(expression))return;await new Promise(r=>setTimeout(r,100));}throw Error('UI timeout '+expression);};
    await call('Page.enable');await call('Runtime.enable');await call('Network.enable');
    await call('Network.setCacheDisabled',{cacheDisabled:true});await call('Network.setBypassServiceWorker',{bypass:true});await call('Fetch.enable',{patterns:[{urlPattern:'*'}]});
    await call('Page.addScriptToEvaluateOnNewDocument',{source:`
      localStorage.setItem('dpos_locale','ru');
      window.__ratesRead={};
      const fixtures={golos:{total_vesting_fund_steem:'1000.000 GOLOS',total_vesting_shares:'1000.000000 GESTS'},steem:{total_vesting_fund_steem:'2000.000 STEEM',total_vesting_shares:'1000.000000 VESTS'},hive:{total_vesting_fund_hive:'3000.000 HIVE',total_vesting_shares:'1000.000000 VESTS'}};
      for(const id of Object.keys(fixtures)) window[id]={api:{setOptions(){},getDynamicGlobalPropertiesAsync:async()=>{window.__ratesRead[id]=(window.__ratesRead[id]||0)+1;return fixtures[id]}}};
    `});
    await call('Page.navigate',{url:base+'?curation_check=1#app=notifications'});
    await wait(`document.readyState==='complete'&&window.DposRewardDisplay&&window.DposNotificationInbox`);
    const before=await ev(`JSON.stringify(localStorage)`);
    await ev(`(async()=>{
      window.__events=['golos','steem','hive'].map(chainId=>({id:chainId,chainId,type:'curation_reward',title:'Кураторская награда',account:'alice',text:'1.000000 '+(chainId==='golos'?'GESTS':'VESTS'),route:'#chain='+chainId+'&app=history&ops=curation_reward',read:false,direction:'incoming'}));
      // Browser source records use the actual notification persistence API.
      DposNotifications.upsertNotifications(__events);
      window.__storedBefore=localStorage.getItem(DposNotifications.STORAGE_KEY);
      await DposNotificationInbox.render(document.querySelector('main'));
    })()`);
    await wait(`document.querySelector('[data-reward-text="2"]')?.textContent.includes('+3.000 HP')`);
    const browser=await ev(`Array.from(document.querySelectorAll('[data-reward-text]')).map(n=>n.textContent)`);
    assert.deepEqual(browser,['≈ +1.000 СГ (по текущему соотношению)','≈ +2.000 SP (по текущему соотношению)','≈ +3.000 HP (по текущему соотношению)']);
    assert.equal(await ev(`localStorage.getItem(DposNotifications.STORAGE_KEY)===__storedBefore`),true);
    // Hydration must retain the actual focused link and expose raw units only in details.
    await ev(`document.querySelector('[data-inbox-events] a').focus();window.__focus=document.activeElement`);
    await ev(`DposNotifications.hydrateRewardDisplay(document.querySelector('[data-inbox-events]'),__events)`);
    assert.equal(await ev(`document.activeElement===__focus&&__focus.isConnected`),true);
    const raw=await ev(`Array.from(document.querySelectorAll('[data-inbox-events] details')).map(n=>n.textContent)`);
    assert(raw[0].includes('GESTS')&&raw[1].includes('VESTS')&&raw[2].includes('VESTS'));
    for (const [chainId,amount] of [['golos','+1.000 СГ'],['steem','+2.000 SP'],['hive','+3.000 HP']]) {
      await ev(`location.hash='chain=${chainId}&app=notifications&account=alice'`);
      await wait(`document.querySelector('main h2')?.textContent.includes('alice')&&document.querySelector('main [data-reward-text="0"]')?.textContent.includes(${JSON.stringify(amount)})`);
    }
    await ev(`(async()=>{
      window.__nativeCalls=[];
      DposNative={available:()=>true,request:async method=>{__nativeCalls.push(method);if(method==='getAppInfo')return{notificationInbox:true};if(method==='getNotificationInbox')return{ok:true,unreadCount:3,events:__events.map(e=>({id:e.id,title:e.title,text:e.text,route:e.route,read:e.read}))};throw Error('Unexpected native mutation '+method)}};
      await DposNotificationInbox.render(document.querySelector('main'));
    })()`);
    await wait(`document.querySelector('[data-reward-text="2"]')?.textContent.includes('+3.000 HP')`);
    const native=await ev(`Array.from(document.querySelectorAll('[data-reward-text]')).map(n=>n.textContent)`);
    assert.deepEqual(native,browser);
    assert.deepEqual(await ev(`__nativeCalls`),['getAppInfo','getNotificationInbox']);
    assert.equal(await ev(`localStorage.getItem(DposNotifications.STORAGE_KEY)===__storedBefore`),true);
    await ev(`(()=>{
      DposAuth={getUsers:()=>[{login:'alice'}],getUserLogin:user=>user.login};
      DposVault={status:()=>({state:'unlocked'})};
      const aside=document.createElement('aside');aside.id='curation-header-test';document.body.appendChild(aside);
      DposNotifications.renderPanel(aside,DposChains,'');
    })()`);
    await wait(`document.querySelector('#curation-header-test [data-reward-text="2"]')?.textContent.includes('+3.000 HP')`);
    assert.deepEqual(await ev(`Array.from(document.querySelectorAll('#curation-header-test [data-reward-text]')).map(n=>n.textContent)`),browser);
    await ev(`DposI18n.setLocale('en');DposNotifications.hydrateRewardDisplay(document.querySelector('main [data-inbox-events]'),__events)`);
    await wait(`document.querySelector('main [data-reward-text="0"]')?.textContent.includes('at the current ratio')`);
    assert.deepEqual(errors,[]);assert.deepEqual(blocked,[]);
    console.log(JSON.stringify({result:'PASS',transport:'local-runtime',rates:'synthetic SDK public-read fixtures',browser,native,header:true,per_chain_routes:true,english:true,raw_details:raw,focus_preserved:true,read_state_preserved:true,no_native_write:true,errors,blocked,prior_storage:before},null,2));
  }finally{await send('Target.disposeBrowserContext',{browserContextId});for(const p of pending.values())clearTimeout(p.timer);socket.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
