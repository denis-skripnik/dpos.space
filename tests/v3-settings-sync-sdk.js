'use strict';
const assert = require('assert'), fs = require('fs'), vm = require('vm'), crypto = require('crypto');
for (const chain of ['viz','golos']) {
  const c = { console, setTimeout, clearTimeout, TextEncoder, TextDecoder, URL, Buffer, AbortController, crypto:crypto.webcrypto,
    fetch:() => { throw Error('No network in settings SDK contract test'); } };
  c.window=c;c.self=c;c.global=c;vm.createContext(c);
  vm.runInContext(fs.readFileSync(`v3/vendor/${chain}/${chain}.min.js`,'utf8'),c);
  const sdk=c[chain];
  const payload=JSON.stringify({format:'dpos.space/settings',version:1,notifications:[],autoUpvoter:{golos:[],hive:[],steem:[]},vizSelfAward:[]});
  const op=chain==='viz' ? ['custom',{required_active_auths:[],required_regular_auths:['qa-fixture'],id:'dpos.space.settings',json:JSON.stringify({p:0,d:JSON.parse(payload)})}]
    : ['custom_json',{required_auths:[],required_posting_auths:['qa-fixture'],id:'dpos.space.settings',json:payload}];
  const transaction={ref_block_num:1,ref_block_prefix:2,expiration:'2026-11-01T00:00:00',operations:[op],extensions:[]};
  // Generated fixture material is not an authorized mainnet account. Sign locally
  // to exercise the ACTUAL vendored serializers; never invoke any broadcaster.
  const key=sdk.auth.toWif('qa-fixture','isolated-settings-sync-unit-fixture',chain==='viz'?'regular':'posting');
  const signed=sdk.auth.signTransaction(transaction,{[chain==='viz'?'regular':'posting']:key});
  assert(Array.isArray(signed.signatures) && signed.signatures.length===1);
  assert.strictEqual(signed.signatures[0].length,130);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(signed.operations)),[op]);
  if(chain==='golos')assert.match(sdk.auth.unsignedTransactionId(transaction),/^[a-f0-9]{40}$/);
}
console.log('settings sync actual VIZ custom/Golos custom_json serializers and local fixture signing PASS; no network/broadcast');
