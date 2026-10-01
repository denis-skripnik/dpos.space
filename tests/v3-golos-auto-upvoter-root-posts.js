const assert = require('assert');
const helper = require('../v3/js/auto-upvoter.js');
const settings = [{account:'reader',enabled:true,curators:['curator'],favorites:['author'],minEnergy:2500,currentEnergy:10000,autoDonate:true,autoDonateCap:'10 1'}];
const history = p => [1,{op:['vote',{voter:'curator',author:'author',permlink:p,weight:5000}]}];
(async () => {
  const contents = {
    post:{author:'author',permlink:'post',parent_author:''},
    comment:{author:'author',permlink:'comment',parent_author:'parent'},
    missing:{author:'author',permlink:'missing'},
    nullParent:{author:'author',permlink:'nullParent',parent_author:null},
    mismatch:{author:'other',permlink:'mismatch',parent_author:''},
    wrongLink:{author:'author',permlink:'different',parent_author:''}
  };
  const sent = [], calls = [];
  const adapter = {
    getAccountHistory:async()=>Object.keys(contents).concat('offline').map(history),
    getFavoritePosts:async()=>Object.keys(contents).map(permlink=>({author:'author',permlink})),
    getAccount:async()=>({voting_power:10000}),
    getContent:async(author,permlink)=>{calls.push(permlink);if(permlink==='offline')throw Error('unavailable');return contents[permlink];}
  };
  const state = {seen:new Set()};
  const tick = await helper.runScannerTick({id:'golos'},settings,adapter,state,{broadcaster:async(chain,action)=>{sent.push(action);return {ok:true};}});
  assert.deepStrictEqual(sent.map(a=>a.permlink),['post']);
  assert(sent[0].donate.enabled);
  assert.strictEqual(sent[0].weight,5000);
  assert.strictEqual(calls.filter(p=>p==='post').length,1,'same target fetched once per scan');
  assert(!state.seen.has('reader|author|offline'),'unavailable content can be retried');
  assert.strictEqual(tick.events.length,2,'both valid curator and favorite events remain');
  const absent = await helper.runScannerTick({id:'golos'},settings,{...adapter,getContent:undefined},{},{broadcaster:async()=>{throw Error('must not broadcast');}});
  assert.strictEqual(absent.actions.length,0);
  const other = await helper.runScannerTick({id:'hive'},settings,{...adapter,getContent:undefined},{},{broadcaster:async()=>({ok:true})});
  assert(other.actions.length>0,'other chain policy unchanged');
  contents.offline={author:'author',permlink:'offline',parent_author:''};
  adapter.getContent=async(a,p)=>contents[p];
  const retry=await helper.runScannerTick({id:'golos'},settings,adapter,state,{broadcaster:async(c,a)=>({ok:true})});
  assert(retry.actions.some(a=>a.permlink==='offline'),'transient lookup failure is not remembered as voted');
  assert.strictEqual(helper.rootPostSkipReason(contents.post,{author:'author',permlink:'post'}),null);
  assert.strictEqual(helper.rootPostSkipReason(contents.comment,{author:'author',permlink:'comment'}),'not-root-post');
  for (const permlink of ['missing','nullParent','mismatch','wrongLink']) {
    assert.strictEqual(helper.rootPostSkipReason(contents[permlink],{author:'author',permlink}),'root-post-unknown');
  }
  const tight = await helper.runScannerTick({id:'golos'},[{...settings[0],minEnergy:9800}],{...adapter,getAccountHistory:async()=>[history('comment'),history('post')],getFavoritePosts:async()=>[]},{},{broadcaster:async()=>({ok:true})});
  assert.deepStrictEqual(tight.actions.map(a=>a.permlink),['post'],'comment does not consume energy before root planning');
  const retryState = {seen:new Set()};
  let immediateFail = true, broadcasts = 0;
  const beforeBroadcast = async(c,a)=>{
    const content = immediateFail ? null : await adapter.getContent(a.author,a.permlink);
    if (!helper.isRootPost(content,a)) return {skipped:true,reason:'root-post-unknown'};
    broadcasts += 1;
    return {ok:true};
  };
  const singleAdapter = {...adapter,getAccountHistory:async()=>[history('post')],getFavoritePosts:async()=>[]};
  await helper.runScannerTick({id:'golos'},settings,singleAdapter,retryState,{broadcaster:beforeBroadcast});
  assert.strictEqual(broadcasts,0);
  assert(!retryState.seen.has('reader|author|post'),'second lookup failure must release seen reservation');
  immediateFail = false;
  await helper.runScannerTick({id:'golos'},settings,singleAdapter,retryState,{broadcaster:beforeBroadcast});
  assert.strictEqual(broadcasts,1,'valid root retries after prebroadcast content lookup recovers');
  assert(retryState.seen.has('reader|author|post'));
  console.log('Golos root-post-only connected scanner tests passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
