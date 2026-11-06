'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = name => fs.readFileSync(`v3/js/${name}.js`, 'utf8');
async function check(responding) {
  const calls = [], saved = new Map();let endpoint;
  const chain = {id:'golos',title:'Golos',libraryGlobal:'golos',nodes:['https://primary.invalid','https://secondary.invalid']};
  const context = {console,URLSearchParams,Map,Set,BigInt,Date,Promise,
    // Proportionally accelerate actual 8s/10s production deadlines, not logic.
    setTimeout:(fn,ms)=>setTimeout(fn,ms/100),clearTimeout,
    localStorage:{getItem:key=>saved.get(key)||null,setItem:(key,value)=>saved.set(key,value)},
    DposChains:{golos:chain},
    golos:{api:{setOptions:options=>{endpoint=options.url},getDynamicGlobalPropertiesAsync:()=>{
      calls.push(endpoint);
      return !responding || endpoint===chain.nodes[0]?new Promise(()=>{}):Promise.resolve({total_vesting_fund_steem:'1000.000 GOLOS',total_vesting_shares:'1000.000000 GESTS'});
    }}}
  };
  context.window=context;vm.createContext(context);
  for(const name of ['profiles','reward-display','notifications'])vm.runInContext(source(name),context);
  const node={textContent:'pending',isConnected:true};const container={querySelector:()=>node};
  const event={chainId:'golos',type:'curation_reward',text:'1.000000 GESTS'};
  await context.DposNotifications.hydrateRewardDisplay(container,[event]);
  assert.equal(node.textContent,responding?'≈ +1.000 СГ (по текущему соотношению)':'Пересчёт кураторской награды в СГ недоступен.','bounded failover must use a healthy secondary or report total unavailability');
  assert(calls.includes(chain.nodes[0])&&calls.includes(chain.nodes[1]));
  if (responding) assert.equal(saved.get('golos_node'),chain.nodes[1]);
}
(async()=>{
  await check(true);
  await check(false);
  console.log('Curation RPC failover through actual profiles.connect: hung primary, healthy secondary, and bounded all-nodes failure passed');
})().catch(error=>{console.error(error);process.exitCode=1});
