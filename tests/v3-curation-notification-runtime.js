'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = name => fs.readFileSync(`v3/js/${name}.js`, 'utf8');
function boot() {
  const data = new Map(), calls = [];
  const context = {console, URLSearchParams, setTimeout, clearTimeout, Date, Map, Set, BigInt,
    localStorage:{getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)},
    golos:{},steem:{},hive:{},
    DposChains:Object.fromEntries(['golos','steem','hive'].map(id=>[id,{id,libraryGlobal:id}])),
    DposProfiles:{connect:async chain=>chain,apiCall:async chain=>{calls.push(chain.id);return props(chain.id)}},
  };
  context.window=context;vm.createContext(context);
  vm.runInContext(source('reward-display'),context);vm.runInContext(source('notifications'),context);
  return {context,api:context.DposNotifications,data,calls};
}
function props(id) {
  return id==='hive' ? {total_vesting_fund_hive:'3000.000 HIVE',total_vesting_shares:'1000.000000 VESTS'}
    : {total_vesting_fund_steem:`${id==='golos'?'1000.000 GOLOS':'2000.000 STEEM'}`,total_vesting_shares:`1000.000000 ${id==='golos'?'GESTS':'VESTS'}`};
}
function container(items) {
  const nodes=items.map(()=>({textContent:'pending',isConnected:true}));
  return {nodes,querySelector:selector=>nodes[Number(selector.match(/"(\d+)"/)[1])]};
}
const items=['golos','steem','hive'].flatMap(id=>[0,1].map(index=>({id:`${id}:${index}`,chainId:id,type:'curation_reward',text:`1.000000 ${id==='golos'?'GESTS':'VESTS'}`,direction:'incoming',read:index===1,url:`#chain=${id}&app=history&ops=curation_reward`})));
(async()=>{
  const t=boot();t.api.upsertNotifications(items);const before=JSON.stringify([...t.data]);
  const list=container(items);
  await t.api.hydrateRewardDisplay(list,items);
  assert.deepEqual(t.calls.sort(),['golos','hive','steem']);
  assert.deepEqual(list.nodes.map(n=>n.textContent),[
    '≈ +1.000 СГ (по текущему соотношению)','≈ +1.000 СГ (по текущему соотношению)',
    '≈ +2.000 SP (по текущему соотношению)','≈ +2.000 SP (по текущему соотношению)',
    '≈ +3.000 HP (по текущему соотношению)','≈ +3.000 HP (по текущему соотношению)']);
  assert.equal(JSON.stringify([...t.data]),before,'display does not rewrite records/read flags/cursors');
  await t.api.hydrateRewardDisplay(list,items);assert.equal(t.calls.length,3,'deduplicate current rate');
  const native=items.map(item=>({route:item.url,text:item.text,title:'Кураторская награда',read:false}));
  const nativeList=container(native);await t.api.hydrateRewardDisplay(nativeList,native);
  assert.deepEqual(nativeList.nodes.map(n=>n.textContent),list.nodes.map(n=>n.textContent));
  const failed=boot();let rejected=true;failed.context.DposProfiles.apiCall=async chain=>{if(rejected)throw Error('offline');return props(chain.id)};
  const failList=container([items[0]]);await failed.api.hydrateRewardDisplay(failList,[items[0]]);
  assert.equal(failList.nodes[0].textContent,'Пересчёт кураторской награды в СГ недоступен.');
  rejected=false;await failed.api.hydrateRewardDisplay(failList,[items[0]]);assert(failList.nodes[0].textContent.includes('+1.000 СГ'),'failure is retryable, not cached for one minute');
  const stale=boot();let finish;stale.context.DposProfiles.apiCall=()=>new Promise(resolve=>{finish=resolve});
  const old=container([items[0]]);let current=true;const pending=stale.api.hydrateRewardDisplay(old,[items[0]],()=>current);
  while(!finish) await new Promise(resolve=>setImmediate(resolve));
  current=false;finish(props('golos'));await pending;assert.equal(old.nodes[0].textContent,'pending');
  const disconnected=container([items[0]]);disconnected.nodes[0].isConnected=false;
  await t.api.hydrateRewardDisplay(disconnected,[items[0]]);assert.equal(disconnected.nodes[0].textContent,'pending');
  const unrelated={type:'transfer',chainId:'golos',text:'5.000 GOLOS <b>'};
  assert.equal(t.api.rewardInitialText(unrelated),unrelated.text);assert.equal(t.api.rewardDetailsHtml(unrelated),'');
  assert(t.api.rewardDetailsHtml(items[0]).includes('1.000000 GESTS'));
  console.log('Curation connected presentation: browser/native payloads, three-chain batching, cache, read-state preservation, failure recovery and stale/disconnected nodes passed');
})().catch(error=>{console.error(error);process.exitCode=1});
