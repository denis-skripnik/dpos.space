'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const window = {};
vm.runInNewContext(fs.readFileSync('v3/js/reward-display.js', 'utf8'), { window, URLSearchParams, BigInt });
const api = window.DposRewardDisplay;
for (const [chainId, symbol, power, liquid, fundField] of [
  ['golos','GESTS','СГ','GOLOS','total_vesting_fund_steem'],
  ['steem','VESTS','SP','STEEM','total_vesting_fund_steem'],
  ['hive','VESTS','HP','HIVE','total_vesting_fund_hive']
]) {
  const event = {chainId,type:'curation_reward',text:`1.234567 ${symbol}`,read:false,id:'stable'};
  const props = {[fundField]:`1000.000 ${liquid}`,total_vesting_shares:`2000.000000 ${symbol}`};
  const view = api.present(event, props);
  assert.equal(view.text, `≈ +0.617 ${power} (по текущему соотношению)`);
  assert.equal(view.details, event.text);
  assert.equal(event.text, `1.234567 ${symbol}`);
  assert.equal(api.present({...event,text:`0.000000 ${symbol}`},props).text,`0.000 ${power}`);
  assert.equal(api.present({...event,text:`0.000001 ${symbol}`},props).text,`<0.001 ${power} (по текущему соотношению)`);
  assert.equal(api.present(event,{}).text,`Пересчёт кураторской награды в ${power} недоступен.`);
  assert.equal(api.present(event,{...props,total_vesting_shares:`0.000000 ${symbol}`}).text,`Пересчёт кураторской награды в ${power} недоступен.`);
  assert.equal(api.present(event,{...props,[fundField]:`1000.000 WRONG`}).text,`Пересчёт кураторской награды в ${power} недоступен.`);
  const native = {route:`#chain=${chainId}&app=history&account=alice&ops=curation_reward`,text:event.text,title:'Кураторская награда',read:false};
  assert.equal(api.present(native,props).text,view.text);
  assert.equal(api.identify({...event,type:'author_reward'}),null);
  assert.equal(api.identify({...event,text:`1.000000 ${symbol} extra`}),null);
  assert.equal(api.identify({...event,text:`-1.000000 ${symbol}`}),null);
  assert.equal(api.identify({...event,text:`1.000000 ${liquid}`}),null);
}
const huge={chainId:'hive',type:'curation_reward',text:'9007199254740993.000000 VESTS'};
assert.equal(api.present(huge,{total_vesting_fund_hive:'1.000 HIVE',total_vesting_shares:'1.000000 VESTS'}).text,'≈ +9007199254740993.000 HP (по текущему соотношению)');
assert.equal(api.identify({chainId:'viz',type:'curation_reward',text:'1.000000 SHARES'}),null);
assert.equal(api.identify({chainId:'golos',type:'curation_reward',text:'1.000000 VESTS'}),null);
assert.equal(api.present({chainId:'golos',type:'curation_reward',text:'1.000000 GESTS'},{total_vesting_fund_hive:'1.000 HIVE',total_vesting_shares:'1.000000 GESTS'}).text,'Пересчёт кураторской награды в СГ недоступен.');
console.log('Curation display: three-chain exact conversion, native routes, tiny/zero/large values, invalid rates and preserved source passed');
