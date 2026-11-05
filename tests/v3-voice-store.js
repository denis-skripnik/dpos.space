const assert=require('assert');const fs=require('fs');const vm=require('vm');
function fixture(){
  let current;let fail=false;let opens=0;
  const db={createObjectStore(){},transaction(){const tx={};let value;let write=false;
    const request=()=>{const r={};queueMicrotask(()=>{if(fail){tx.onabort();return;}if(write)current=value;r.result=current;tx.oncomplete();});return r;};
    tx.objectStore=()=>({get:()=>request(),put:v=>{value=v;write=true;return request();},delete:()=>{value=undefined;write=true;return request();}});return tx;}};
  const indexedDB={open(name,version){assert.equal(name,'dpos-voice-local');assert.equal(version,1);opens++;const req={result:db};queueMicrotask(()=>{if(opens===1)req.onupgradeneeded();req.onsuccess();});return req;}};
  function load(){const c={indexedDB};c.window=c;vm.createContext(c);vm.runInContext(fs.readFileSync('v3/js/voice-store.js','utf8'),c);return c.DposVoiceStore;}
  return {load,setFailure:v=>{fail=v;}};
}
(async()=>{
  const f=fixture();const store=f.load();assert.equal(await store.read(),undefined);
  const audio=new Blob(['fixture recording'],{type:'audio/webm'});await store.write({audio,durationMs:500,mode:'raw',transcript:'safe fixture',result:'safe fixture'});
  const restored=await f.load().read();assert.equal(await restored.audio.text(),'fixture recording');assert.equal(restored.durationMs,500);
  f.setFailure(true);await assert.rejects(store.remove());f.setFailure(false);assert.equal((await store.read()).audio.size,audio.size);
  await store.remove();assert.equal(await store.read(),undefined);
  const c={window:{}};vm.runInNewContext(fs.readFileSync('v3/js/voice-store.js','utf8'),c);await assert.rejects(c.window.DposVoiceStore.read());
  console.log('voice IndexedDB adapter behavior checks passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
