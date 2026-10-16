const assert=require('assert'),fs=require('fs'),vm=require('vm');
const data=new Map();let now=1000,active=false;
const c={Date:{now:()=>now},localStorage:{getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)},DposVault:{status:()=>({state:'unlocked'}),issueGuard:()=>({}),assertGuard(){}},navigator:{locks:{request:async(n,o,f)=>{if(active)return f(null);active=true;try{return await f({name:n});}finally{active=false;}}}}};
c.window=c;vm.createContext(c);
assert(fs.existsSync('v3/js/automation-continuity.js'),'durable automation continuity is missing');
vm.runInContext(fs.readFileSync('v3/js/automation-continuity.js','utf8'),c);
(async()=>{
 data.set('dpos_vault_session_resume_v1',JSON.stringify({binding:'vault-a'}));
 const a=c.DposAutomationContinuity;
 // VIZ now requires the private authenticated vault admission, even for an
 // otherwise well-formed plaintext legacy control with a matching binding.
 c.DposVault.vizAutomationAdmitted=()=>false;
 data.set(a.storageKey('viz-self-award')+'_control',JSON.stringify({version:1,running:true,epoch:1,binding:'vault-a|undefined',settings:[]}));
 assert(!a.readRun('viz-self-award').running,'plaintext legacy VIZ Start is not authority');
 assert.throws(()=>a.start('viz-self-award',[]),/startVizAutomation/);
 a.start('upvoter:steem',[]);assert(a.readRun('upvoter:steem').running);
 let sends=0;await assert.rejects(()=>a.exclusive('upvoter:steem',async()=>{a.schedule('upvoter:steem',432000);await a.send('upvoter:steem','alice','award',()=>{},async()=>{sends++;return {};},async()=>false);}),/unknown/);
 assert.equal(sends,1);assert(a.pending('upvoter:steem','alice'));assert.equal(a.remaining('upvoter:steem'),432000);
 await a.exclusive('upvoter:steem',async()=>{await a.send('upvoter:steem','alice','award',()=>{},async()=>{sends++;},async()=>true);});assert.equal(sends,1,'unknown never replayed');
 now+=1000;assert.equal(a.remaining('upvoter:steem'),431000);
 const guard=a.guard('upvoter:steem');a.stop('upvoter:steem');assert.throws(guard,/cancel|отмен/i);assert(!a.readRun('upvoter:steem').running);assert(a.pending('upvoter:steem','alice'),'Stop retains unresolved pending');
 data.set('dpos_vault_session_resume_v1',JSON.stringify({binding:'vault-b'}));assert(!a.readRun('upvoter:steem').running);
 a.start('upvoter:hive',[]);
 let release; const flight=a.exclusive('upvoter:hive',()=>a.send('upvoter:hive','alice/bob/post','vote',()=>{},()=>new Promise(r=>{release=r;}),async()=>true));
 const overlap=await a.exclusive('upvoter:hive',()=>{throw Error('overlap ran');});
 assert.equal(overlap.reason,'overlap','held ownership does not expire');
 a.stop('upvoter:hive');release({id:'1'.repeat(40),block_num:99,trx_num:0,expired:false});await flight;
 assert(!a.readRun('upvoter:hive').running,'late result cannot resurrect Stop');
 assert.equal(a.pending('upvoter:hive','alice/bob/post').state,'confirmed');
 a.start('upvoter:hive',[]);let replayed=0;
 await a.exclusive('upvoter:hive',()=>a.send('upvoter:hive','alice/bob/post','vote',()=>{},async()=>{replayed++;},async()=>true));
 assert.equal(replayed,0,'confirmed target never replays after new Start');
 console.log('web automation continuity PASS');
})().catch(e=>{console.error(e);process.exitCode=1;});
