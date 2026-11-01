'use strict';
const assert=require('assert'),fs=require('fs'),vm=require('vm'),crypto=require('crypto');
(async()=>{
  for(const id of ['viz','golos']){
    const c={console,setTimeout,clearTimeout,TextEncoder,TextDecoder,URL,Buffer,AbortController,crypto:crypto.webcrypto,fetch:()=>{throw Error('No network in signing test');}};
    c.window=c;c.self=c;c.global=c;vm.createContext(c);
    vm.runInContext(fs.readFileSync(`v3/vendor/${id}/${id}.min.js`,'utf8'),c);
    vm.runInContext(fs.readFileSync('v3/js/broadcast.js','utf8'),c);
    const sdk=c[id],chain={id,libraryGlobal:id},authority=id==='viz'?'regular':'posting';
    const key=sdk.auth.toWif('qa-fixture','isolated-sync-signing-fixture',authority),publicKey=sdk.auth.wifToPublic(key);
    sdk.api.getAccountsAsync=async()=>[{[id==='viz'?'regular_authority':'posting']:{weight_threshold:1,key_auths:[[publicKey,1]],account_auths:[]}}];
    let current=true,stage='normal',signs=0,sends=0,preparedTx;
    const sign=sdk.auth.signTransaction;
    sdk.auth.signTransaction=(...args)=>{signs++;return sign(...args);};
    sdk.broadcast._prepareTransaction=async tx=>{
      preparedTx=tx;
      if(stage==='change-during-tapos')current=false;
      return {...tx,ref_block_num:1,ref_block_prefix:2,expiration:'2026-11-01T00:00:00'};
    };
    sdk.api[id==='viz'?'broadcastTransaction':'broadcastTransactionSynchronous']=(tx,cb)=>{
      sends++;
      if(stage==='uncertain')cb(new Error('uncertain network result'));
      else cb(null,{fixture:true});
    };
    const build=()=>{
      const p=c.DposBroadcast.prepareWithPrivateKey(chain,'qa-fixture',authority,key,id==='viz'?'custom':'customJson',[[],['qa-fixture'],'dpos.space.settings','{"fixture":true}'],{feature:'settings-sync'});
      p.beforeBroadcast=()=>{if(!current)throw Error('stale route/source/current account');};return p;
    };
    await c.DposBroadcast.broadcast(chain,build(),{confirmExecute:true});
    assert.strictEqual(signs,1);assert.strictEqual(sends,1);
    assert.strictEqual(preparedTx.operations[0][0],id==='viz'?'custom':'custom_json');
    assert.deepStrictEqual(JSON.parse(JSON.stringify(preparedTx.operations[0][1])),{[id==='viz'?'required_active_auths':'required_auths']:[],[id==='viz'?'required_regular_auths':'required_posting_auths']:['qa-fixture'],id:'dpos.space.settings',json:'{"fixture":true}'});
    stage='change-during-tapos';await assert.rejects(c.DposBroadcast.broadcast(chain,build(),{confirmExecute:true}),/stale/);assert.strictEqual(signs,1);assert.strictEqual(sends,1);
    current=true;stage='uncertain';await assert.rejects(c.DposBroadcast.broadcast(chain,build(),{confirmExecute:true}),/uncertain/);assert.strictEqual(sends,2,'uncertain broadcast must not be retried');
    stage='normal';const secret=build();secret.params[3]='{"password":"must-not-publish-fixture"}';await assert.rejects(c.DposBroadcast.broadcast(chain,secret,{confirmExecute:true}),/секрет/);assert.strictEqual(sends,2);
  }
  console.log('settings guarded signing: actual SDK fixture signatures, exact authorities, stale TAPOS cancellation, no retry, public-secret rejection PASS; no network');
})().catch(e=>{console.error(e);process.exitCode=1;});
