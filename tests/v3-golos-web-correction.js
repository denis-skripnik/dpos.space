const assert=require('assert');
const h=require('../v3/js/auto-upvoter.js');
const values=new Map();global.localStorage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)};
const binding='a'.repeat(64),key='dpos_golos_event_backlog_v1_'+binding;
const settings=[{account:'alice',enabled:true,curators:['healthy','broken'],favorites:['bob'],minEnergy:2500,currentEnergy:10000}];
const eligible=(a,p)=>({author:a,permlink:p,parent_author:'',allow_votes:true,last_payout:'1970-01-01T00:00:00',cashout_time:'2099-01-01T00:00:00',created:'2026-01-01T00:00:00',last_update:'2026-01-01T00:00:00',num_changes:0,active_votes:[]});
const row=(i,kind,name)=>[i,{op:[kind,kind==='vote'?{voter:name,author:'carol',permlink:'vote-'+i,weight:10000}:{author:name,parent_author:'',permlink:'post-'+i}]}];
const histories={healthy:Array.from({length:65},(_,i)=>row(i+1,'vote','healthy')),bob:Array.from({length:55},(_,i)=>row(i+1,'comment','bob'))};
let gap=false,hang=false;
const adapter={sourceBinding:binding,getAccountHistory:async(a,l,f=-1)=>{if(a==='broken'){if(hang)return new Promise(()=>{});throw Error('offline');}let rows=histories[a].filter(r=>f===-1||r[0]<=f).slice(-l);return gap&&a==='healthy'?rows.filter((_,i)=>i!==5):rows;},getContent:async(a,p)=>eligible(a,p),getAccount:async()=>({voting_power:10000}),getDynamicGlobalProperties:async()=>({time:'2026-01-01T00:00:00'})};
(async()=>{
 const acquired=new Set();for(let i=0;i<6;i++)for(const e of await h.collectDurableGolosEvents(adapter,settings,{sourceTimeoutMs:15}))acquired.add(e.backlogId);
 assert.equal(acquired.size,120);const saved=h.readBacklog(binding);assert.equal(saved.sources['curator:healthy'].high,65);assert.equal(saved.sources['favorite:bob'].high,55);assert.equal(Object.keys(saved.inbox).length,120);
 // Restart: only persistent inbox/source progress, no lost events.
 const state={seen:new Set()};let sends=0;for(let i=0;i<5;i++)await h.runScannerTick({id:'golos'},settings,adapter,state,{sourceTimeoutMs:15,broadcaster:async()=>{sends++;return {ok:true};}});
 assert.equal(sends,120);assert.equal(Object.keys(h.readBacklog(binding).inbox).length,0);
 histories.healthy.push(row(66,'vote','healthy'));histories.bob.push(row(56,'comment','bob'));gap=true;hang=true;
 const t=Date.now();await h.collectDurableGolosEvents(adapter,settings,{sourceTimeoutMs:15});assert(Date.now()-t<500);assert.equal(h.readBacklog(binding).sources['curator:healthy'].high,65);assert.equal(h.readBacklog(binding).sources['favorite:bob'].high,56);
 gap=false;await h.collectDurableGolosEvents(adapter,settings,{sourceTimeoutMs:15});assert.equal(h.readBacklog(binding).sources['curator:healthy'].high,66);
 // Inactive data archived, healthy source remains independent.
 const inactive=[{...settings[0],curators:[],favorites:['bob']}];await h.collectDurableGolosEvents(adapter,inactive,{sourceTimeoutMs:15});assert.equal(h.readBacklog(binding).sources['curator:healthy'].active,false);assert(Object.values(h.readBacklog(binding).inbox).some(e=>e.source==='curator:healthy'));
 const other={...adapter,sourceBinding:'b'.repeat(64)};await h.collectDurableGolosEvents(other,settings,{sourceTimeoutMs:15});assert.equal(h.readBacklog(other.sourceBinding).sources['curator:healthy'].from,36);assert.equal(h.readBacklog(binding).sources['curator:healthy'].high,66);
 // Per-source saturation must not advance its source or block a healthy source.
 const capacity=h.readBacklog(binding);for(let i=0;i<1000;i++)capacity.inbox['cap-'+i]={source:'curator:healthy',event:{onlyAccount:'alice',author:'carol',permlink:'cap-'+i}};
 values.set(key,JSON.stringify(capacity));histories.healthy.push(row(67,'vote','healthy'));histories.bob.push(row(57,'comment','bob'));
 await h.collectDurableGolosEvents(adapter,settings,{sourceTimeoutMs:15});assert.equal(h.readBacklog(binding).sources['curator:healthy'].high,66);assert.equal(h.readBacklog(binding).sources['favorite:bob'].high,57);assert.equal(h.readBacklog(binding).sources['curator:healthy'].warning,'capacity-backpressure');
 const before=values.get(key);let locked=false;global.DposVault={lock:()=>locked=true};const original=global.localStorage.setItem;global.localStorage.setItem=()=>{throw Error('quota');};await assert.rejects(h.collectDurableGolosEvents(adapter,settings,{sourceTimeoutMs:15}),/storage unavailable/);assert.equal(values.get(key),before);assert(locked);global.localStorage.setItem=original;delete global.DposVault;
 // Retry unsent battery/cancellation, never lose unread candidate.
 const fresh={...adapter,sourceBinding:'c'.repeat(64)},retryState={seen:new Set()};let finalCalls=0;
 await h.runScannerTick({id:'golos'},[{...settings[0],curators:[],favorites:['bob']}],fresh,retryState,{broadcaster:async()=>({skipped:true,reason:'battery-unavailable'})});assert.equal(retryState.seen.size,0);
 for(let i=0;i<3;i++)await h.runScannerTick({id:'golos'},[{...settings[0],curators:[],favorites:['bob']}],fresh,retryState,{broadcaster:async()=>{finalCalls++;return {ok:true};}});assert.equal(finalCalls,57);
 const c=eligible('bob','p');assert.equal(h.voteEligibilitySkipReason({...c,num_changes:1}, {author:'bob',permlink:'p',source:'favorite'}),'favorite-edited');assert.equal(h.voteEligibilitySkipReason({...c,active:'2098-01-01T00:00:00'}, {author:'bob',permlink:'p',source:'favorite'}),null);
 assert.equal(h.voteEligibilitySkipReason({...c,allow_votes:false},{author:'bob',permlink:'p'}),'votes-disabled');assert.equal(h.voteEligibilitySkipReason({...c,cashout_time:'malformed'},{author:'bob',permlink:'p'}),'eligibility-unknown');
 // Fresh head intake is independent of a long historical sweep and fresh gaps.
 const longRows=Array.from({length:200},(_,i)=>row(i+1,'vote','healthy'));
 const long={...adapter,sourceBinding:'d'.repeat(64),getAccountHistory:async(a,l,f)=>longRows.filter(r=>f===-1||r[0]<=f).slice(-l)};
 const only=[{...settings[0],curators:['healthy'],favorites:[]}];
 await h.collectDurableGolosEvents(long,only,{});longRows.push(row(201,'vote','healthy'));
 const live=await h.collectDurableGolosEvents(long,only,{});assert(live.some(e=>e.permlink==='vote-201'));assert(h.readBacklog(long.sourceBinding).sources['curator:healthy'].from>0);
 for(let i=202;i<=280;i++)longRows.push(row(i,'vote','healthy'));
 await h.collectDurableGolosEvents(long,only,{});assert.equal(h.readBacklog(long.sourceBinding).sources['curator:healthy'].high,201);assert.equal(h.readBacklog(long.sourceBinding).sources['curator:healthy'].headFrom,250);
 for(let i=0;i<2;i++)await h.collectDurableGolosEvents(long,only,{});assert.equal(h.readBacklog(long.sourceBinding).sources['curator:healthy'].high,280);
 console.log(JSON.stringify({freshHeadIndependentOfBackfill:true,burstBackfillRestartEvents:sends,gapsRetainProgress:true,healthySourceAndTimeoutIsolation:true,inactiveAndEndpointScoped:true,capacityNoEvictionHealthyWork:true,atomicStorageFailureNoProgress:true,transientBatteryRetryOnce:finalCalls}));
})().catch(e=>{console.error(e);process.exitCode=1;});
