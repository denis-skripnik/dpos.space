const assert=require('assert'),fs=require('fs'),vm=require('vm');
const values=new Map();let held=false,locked=false;
const c={Date,setTimeout,clearTimeout,localStorage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)},DposVault:{status:()=>({state:locked?'locked':'unlocked'}),lock:()=>locked=true,issueGuard:()=>({}),assertGuard:()=>{if(locked)throw Error('locked');}},navigator:{locks:{request:async(n,o,fn)=>{if(held)return fn(null);held=true;try{return await fn({name:n});}finally{held=false;}}}}};c.window=c;vm.createContext(c);vm.runInContext(fs.readFileSync('v3/js/automation-continuity.js','utf8'),c);
(async()=>{
 const a=c.DposAutomationContinuity,scope='upvoter:golos';values.set('dpos_vault_session_resume_v1',JSON.stringify({binding:'synthetic'}));a.start(scope,[{account:'alice',enabled:true}]);
 const key=a.storageKey(scope),ledger={version:1,nextAt:0,intents:{}};
 for(let i=0;i<40;i++)ledger.intents['alice/bob/p'+i]={state:'pending',id:(i+1).toString(16).padStart(40,'0'),operation:['vote',{voter:'alice',author:'bob',permlink:'p'+i,weight:10000}],transaction:{fixture:i}};
 values.set(key,JSON.stringify(ledger));const visited=new Set();
 for(let i=0;i<5;i++)await a.exclusive(scope,()=>a.reconcile(scope,async intent=>{visited.add(intent.transaction.fixture);intent.historyFrom=123;return false;},()=>false,8));assert.equal(visited.size,40);
 let sends=0;await a.exclusive(scope,()=>a.send(scope,'alice/bob/p0',['vote',{voter:'alice'}],()=>{},async()=>{sends++;},async()=>false));assert.equal(sends,0);
 await a.exclusive(scope,()=>a.reconcile(scope,async()=>true,()=>false,8));assert.equal(Object.values(JSON.parse(values.get(key)).intents).filter(i=>i.state==='confirmed').length,8);assert.equal(sends,0);
 // Cancelled reconciliation may not overwrite control or metadata.
 const before=values.get(key);await a.exclusive(scope,()=>a.reconcile(scope,async intent=>{intent.historyFrom=999;return true;},()=>true,8));assert.equal(values.get(key),before);
 // Explicitly tracked pre-send failure releases only its own durable reservation.
 await assert.rejects(a.exclusive(scope,()=>a.send(scope,'alice/bob/unsent',['vote',{voter:'alice'}],()=>{},async()=>{throw Error('preparation failed');},async()=>false,true)),/preparation failed/);assert.equal(a.pending(scope,'alice/bob/unsent'),null);
 // After durable attempted marker, a transport exception is permanently unknown.
 await assert.rejects(a.exclusive(scope,()=>a.send(scope,'alice/bob/unknown',['vote',{voter:'alice'}],()=>{},async mark=>{mark();sends++;throw Error('transport lost');},async()=>false,true)),/transport lost/);assert.equal(a.pending(scope,'alice/bob/unknown').state,'pending');assert.equal(sends,1);
 const capacity=JSON.parse(values.get(key));for(let i=Object.keys(capacity.intents).length;i<5000;i++)capacity.intents['capacity'+i]={state:'pending'};values.set(key,JSON.stringify(capacity));
 await assert.rejects(a.exclusive(scope,()=>a.send(scope,'alice/bob/new',['vote',{voter:'alice'}],()=>{},async()=>sends++,async()=>true,true)),/capacity/);assert.equal(sends,1);
 const set=c.localStorage.setItem;c.localStorage.setItem=()=>{throw Error('quota');};await assert.rejects(a.exclusive(scope,()=>a.reconcile(scope,async()=>true,()=>false,8)),/storage unavailable/);assert(locked);c.localStorage.setItem=set;
 console.log(JSON.stringify({fairRecoveryVisited:visited.size,recoveryNoSends:true,unknownTargetNoReplay:true,unsentReservationReleased:true,attemptedTransportUnknownRetained:true,capacity5000Failclosed:true,storageFailureLocks:true}));
})().catch(e=>{console.error(e);process.exitCode=1});
