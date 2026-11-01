'use strict';
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const values = new Map();
let writes = 0, failAt = -1;
const storage = { getItem: k => values.has(k) ? values.get(k) : null, setItem: (k,v) => { if (++writes === failAt) throw new Error('quota'); values.set(k,v); }, removeItem: k => values.delete(k) };
const context = { window: { localStorage: storage }, TextEncoder, console, URLSearchParams, Set, Map };
for (const file of ['notifications','settings-sync']) vm.runInNewContext(fs.readFileSync(`v3/js/${file}.js`,'utf8'), context);
const sync = context.window.DposSettingsSync;
const notify = context.window.DposNotifications;
const plain = value => JSON.parse(JSON.stringify(value));
const empty = () => ({format:sync.FORMAT, version:1, notifications:[], autoUpvoter:{golos:[],hive:[],steem:[]}, vizSelfAward:[]});
const up = (account='alice') => ({account,enabled:true,curators:'curator',favorites:'favorite',minEnergy:'25',curatorMode:'repeat',curatorCoefficient:'100',favoritesPercent:'70',autoDonate:false,autoDonatePoolPercent:'0',autoDonatePoolCoefficient:'1'});
const set = (key,value) => storage.setItem(key,JSON.stringify(value));
const get = key => JSON.parse(storage.getItem(key));
function seed() {
  values.clear();
  set('viz_users',[{login:'private-account',regular:'CIPHERTEXT'}]);
  set('dpos_vault_v1',{encrypted:'VAULT'});
  set('dpos_notifications_v1',{settings:{'viz:alice':{ops:['transfer'],androidNative:true,intervalMinutes:37}},notifications:[{id:'preserve',read:false}],accounts:{'viz:alice':{cursor:123,baselineDone:true}}});
  for (const chain of ['golos','hive','steem']) set(`dpos_${chain}_auto_upvoter_settings`,{schemaVersion:2,minEnergyUnit:'percent',accounts:{alice:up(),stale:up('stale')},autoStart:false,localDevice:'keep'});
  set('dpos_viz_self_award_settings',{accounts:{alice:{enabled:true,minEnergy:'9500'},stale:{enabled:true,minEnergy:'9900'}},autoStart:false});
  set('dpos_web_automation_continuity_v1_upvoter:golos_control',{running:false,epoch:3,settings:[up()]});
  set('dpos_web_automation_continuity_v1_upvoter:golos',{intents:{pending:{state:'pending'}},nextAt:123});
}
(async () => {
  let wire;
  Object.assign(context.window,{AbortController,setTimeout,clearTimeout,fetch:async(url,options)=>{assert.strictEqual(url,'https://fixture.invalid');wire=JSON.parse(options.body);return {ok:true,json:async()=>({result:{custom_sequence:0,custom_sequence_block_num:0}})};}});
  const transport=await sync.createRpc({id:'viz',libraryPath:'fixture-sdk.js'},{loadScript:async path=>assert.strictEqual(path,'fixture-sdk.js'),connect:async()=>({node:'https://fixture.invalid'})});
  await transport('custom_protocol_api','get_account',['alice',sync.ID]);
  assert.deepStrictEqual(wire,{jsonrpc:'2.0',id:1,method:'call',params:['custom_protocol_api','get_account',['alice',sync.ID]]});
  seed();
  const exported = sync.exportSnapshot();
  assert(!JSON.stringify(exported).includes('CIPHERTEXT'));
  assert(!JSON.stringify(exported).includes('private-account'));
  assert(!JSON.stringify(exported).includes('androidNative'));
  assert(!JSON.stringify(exported).includes('autoStart'));
  assert(!JSON.stringify(exported).includes('cursor'));
  const snapshot = empty(); snapshot.autoUpvoter.golos=[Object.assign(up(),{curators:'',favorites:''})]; snapshot.vizSelfAward=[{account:'alice',enabled:false,minEnergy:'9700'}]; snapshot.notifications=[{chain:'viz',account:'alice',ops:[],showAutoAwards:true}];
  const protectedKeys = [...values.keys()].filter(k=> !['dpos_notifications_v1','dpos_golos_auto_upvoter_settings','dpos_hive_auto_upvoter_settings','dpos_steem_auto_upvoter_settings','dpos_viz_self_award_settings'].includes(k));
  const protectedBefore = protectedKeys.map(k=>[k,values.get(k)]);
  sync.replace(snapshot);
  assert.deepStrictEqual(Object.keys(get('dpos_golos_auto_upvoter_settings').accounts),['alice']);
  assert.strictEqual(get('dpos_golos_auto_upvoter_settings').accounts.alice.curators,'');
  assert.strictEqual(get('dpos_golos_auto_upvoter_settings').accounts.alice.favorites,'');
  assert.deepStrictEqual(Object.keys(get('dpos_hive_auto_upvoter_settings').accounts),[]);
  assert.deepStrictEqual(Object.keys(get('dpos_viz_self_award_settings').accounts),['alice']);
  assert.strictEqual(get('dpos_viz_self_award_settings').autoStart,false);
  assert.strictEqual(get('dpos_notifications_v1').settings['viz:alice'].androidNative,true);
  assert.strictEqual(get('dpos_notifications_v1').settings['viz:alice'].intervalMinutes,37);
  assert.deepStrictEqual(get('dpos_notifications_v1').accounts,{'viz:alice':{cursor:123,baselineDone:true}});
  assert.strictEqual(get('dpos_notifications_v1').notifications[0].id,'preserve');
  assert.deepStrictEqual(protectedKeys.map(k=>[k,values.get(k)]),protectedBefore);
  assert.deepStrictEqual(plain(sync.exportSnapshot()),snapshot);
  sync.replace(empty());
  assert.deepStrictEqual(plain(notify.getSettings({id:'viz'},'alice').ops),[],'empty snapshot must not revive defaults');
  assert.strictEqual(get('dpos_notifications_v1').deviceSettings['viz:alice'].intervalMinutes,37);
  for (const mutate of [s=>s.version=99,s=>s.keys='secret',s=>s.autoUpvoter.golos.push({...up(),privateKey:'bad'}),s=>s.autoUpvoter.golos.push({...up(),enabled:'yes'}),s=>s.autoUpvoter.golos.push({...up(),favorites:'<script>alert(1)</script>'}),s=>s.vizSelfAward.push({account:'alice',enabled:true,minEnergy:'10000'}),s=>s.notifications.push({chain:'viz',account:'alice',ops:['evil'],showAutoAwards:false}),s=>s.autoUpvoter.golos.push(up(),up())]) {
    const invalid=empty();mutate(invalid);const before=[...values];assert.throws(()=>sync.replace(invalid));assert.deepStrictEqual([...values],before);
  }
  const oversized=empty();oversized.autoUpvoter.golos=Array.from({length:7},(_,i)=>({...up(`large-${i}`),curators:'curator '.repeat(1400),favorites:''}));
  assert.throws(()=>sync.encoded(oversized),/60/);
  assert.throws(()=>sync.encoded(empty(),-1));assert.throws(()=>sync.encoded(empty(),'12'));
  seed(); const before=[...values]; failAt=writes+3; assert.throws(()=>sync.replace(empty()),/не изменены/);assert.deepStrictEqual([...values],before); failAt=-1;
  assert.throws(()=>sync.replace(empty(),{isCurrent:()=>false}),/изменились/);
  const op = (chain,author='alice',data=empty()) => [chain==='viz'?'custom':'custom_json',{id:sync.ID,[chain==='viz'?'required_regular_auths':'required_posting_auths']:[author],json:sync.encoded(data,chain==='viz'?0:undefined)}];
  let calls=[];
  const golosRpc = async (api,method,args) => {calls.push([api,method,args]);return args[1]===-1 ? [[500,{op:op('golos','mallory')}],[300,{op:['custom_json',{id:'other'}]}]] : [[100,{block:42,op:op('golos')}]];};
  assert.strictEqual((await sync.latest('golos','alice',golosRpc)).block,42);
  assert.strictEqual(calls.length,2);assert.strictEqual(calls[1][2][1],299);assert.deepStrictEqual(plain(calls[0][2][3]),{select_ops:['custom_json']});
  for (const badIndex of [{custom_sequence:0,custom_sequence_block_num:0},{custom_sequence:1,custom_sequence_block_num:-3},{custom_sequence:1,custom_sequence_block_num:'12'},null]) {
    let history=0;
    const result=await sync.latest('viz','alice',async (api,method,args)=> {
      if(api==='custom_protocol_api'){assert.deepStrictEqual(plain(args),['alice',sync.ID]);return badIndex;}
      history++;return [[3,{block:9,op:op('viz')}]];
    });assert.strictEqual(result.block,9);assert.strictEqual(history,1);
  }
  for (const wrong of [op('viz','mallory'),['custom',{id:'other',required_regular_auths:['alice'],json:'{}'}]]) {
    let history=0;await sync.latest('viz','alice',async (api,method)=>api==='custom_protocol_api'?{custom_sequence:1,custom_sequence_block_num:99}:method==='get_block'?{transactions:[{operations:[wrong]}]}:(history++,[[1,{op:op('viz') }]]));assert.strictEqual(history,1);
  }
  calls=[];let indexed=await sync.latest('viz','alice',async (api,method)=> {calls.push(method);return method==='get_account'?{custom_sequence:2,custom_sequence_block_num:8}:{transactions:[{operations:[op('viz')]}]};});assert.strictEqual(indexed.block,8);assert.strictEqual(calls.length,2);
  const unknown=empty();unknown.version=2;
  await assert.rejects(sync.latest('viz','alice',async (api,method)=>method==='get_account'?{custom_sequence:2,custom_sequence_block_num:8}:{transactions:[{operations:[['custom',{id:sync.ID,required_regular_auths:['alice'],json:JSON.stringify({p:0,d:unknown})}]]}]}),/снимок/);
  await assert.rejects(sync.latest('golos','alice',async()=>[[0,{op:op('golos','mallory')}]]),/не найдены/);
  let sourceCurrent=true;await assert.rejects(sync.latest('golos','alice',async()=>{sourceCurrent=false;return [[1,{op:op('golos')}]];},{isCurrent:()=>sourceCurrent}),/изменились/);
  calls=[];await assert.rejects(sync.latest('golos','alice',async(api,method,args)=>{calls.push(args);return args[1]===-1?[[1,{op:['transfer',{}]}]]:[[0,{op:['transfer',{}]}]];}),/не найдены/);assert.strictEqual(calls[1][1],0);assert.strictEqual(calls[1][2],0);
  seed();const runtime={running:true,settings:[up()],runners:{pending:'preserve'}};context.window.__dposAutoUpvoterRuntimes={golos:runtime,hive:{running:false,settings:[up()]}};
  context.window.DposAutomationContinuity={readRun:()=>({settings:[up()]})};
  const change=empty();change.autoUpvoter.golos=[{...up(),favorites:'new-favorite',autoDonate:true,autoDonatePoolPercent:'1'}];sync.replace(change);sync.refreshRuntime();assert.strictEqual(runtime.settings[0].favorites,'new-favorite');assert.strictEqual(runtime.settings[0].autoDonate,false);assert.strictEqual(runtime.running,true);assert.deepStrictEqual(runtime.runners,{pending:'preserve'});assert.strictEqual(context.window.__dposAutoUpvoterRuntimes.hive.running,false);
  assert.strictEqual(sync.forGrantedRows('upvoter:golos',[{...up(),enabled:false}])[0].enabled,false);
  const original=[{...up(),autoDonate:true},{...up('never-granted'),enabled:false}];
  context.window.DposAutomationContinuity={readRun:()=>({settings:original})};
  const pinned=sync.settingsGuard('upvoter:golos');
  sync.replace(empty());sync.refreshRuntime();assert(!pinned());assert(!runtime.settings[0].enabled);
  sync.replace(change);sync.refreshRuntime();assert(runtime.settings[0].enabled);assert(runtime.settings[0].autoDonate);assert(!runtime.settings[1].enabled);
  change.autoUpvoter.golos[0].autoDonate=false;sync.replace(change);sync.refreshRuntime();assert(!runtime.settings[0].autoDonate);
  change.autoUpvoter.golos[0].autoDonate=true;sync.replace(change);sync.refreshRuntime();assert(runtime.settings[0].autoDonate);
  assert.deepStrictEqual(plain(runtime.settings),plain(sync.forGrantedRows('upvoter:golos',original)),'same effective rows after reload');
  const acrossTabs=sync.settingsGuard('upvoter:golos');
  const other={window:{localStorage:storage,DposNotifications:notify},TextEncoder};
  vm.runInNewContext(fs.readFileSync('v3/js/settings-sync.js','utf8'),other);
  other.window.DposSettingsSync.replace(empty());other.window.DposSettingsSync.replace(change);
  assert(!acrossTabs(),'persisted revision invalidates ABA even without this tab refreshing');
  // Execute the production legacy upgrade path with an older APK transport. A
  // synced row is never a legacy local opt-in, including after ordinary saves.
  const app=fs.readFileSync('v3/js/app.js','utf8');
  const declaration=name=>{
    const start=app.indexOf(`  function ${name}(`)>=0?app.indexOf(`  function ${name}(`):app.indexOf(`  async function ${name}(`);
    const end=app.indexOf('\n  function ',start+5), asyncEnd=app.indexOf('\n  async function ',start+5);
    return app.slice(start,Math.min(...[end,asyncEnd].filter(i=>i>start)));
  };
  const legacyCalls=[];
  const legacy={global:{localStorage:storage,DposVault:{status:()=>({state:'unlocked'})}},chains:{golos:{id:'golos'}},auth:{getUsers:()=>[{login:'alice'}],getUserLogin:u=>u.login},nativeAndroidWorkerBridge:()=>({}),callAndroidWorkerBridge:async(...args)=>{legacyCalls.push(args);return {};},GOLOS_AUTO_UPVOTER_SETTINGS_KEY:'dpos_golos_auto_upvoter_settings',AUTO_UPVOTER_SETTINGS_SCHEMA_VERSION:2};
  for(const name of ['autoUpvoterSettingsKey','autoUpvoterEnergyPercent','readGolosAutoUpvoterSettings','migrateSavedGolosDonateOnOpen','splitAutoDonatePoolSettings','joinAutoDonatePoolSettings','writeGolosAutoUpvoterSettings'])vm.runInNewContext(declaration(name),legacy);
  await legacy.migrateSavedGolosDonateOnOpen();assert.deepStrictEqual(legacyCalls,[]);
  legacy.writeGolosAutoUpvoterSettings({id:'golos'},sync.forGrantedRows('upvoter:golos',original),false);
  assert.strictEqual(get('dpos_golos_auto_upvoter_settings').settingsImported,true);
  await legacy.migrateSavedGolosDonateOnOpen();assert.deepStrictEqual(legacyCalls,[]);
  assert.strictEqual(legacy.readGolosAutoUpvoterSettings({id:'golos'}).settingsImported,true);
  // Local pre-sync legacy opt-ins retain their upgrade path.
  const local=get('dpos_golos_auto_upvoter_settings');delete local.settingsImported;set('dpos_golos_auto_upvoter_settings',local);
  await legacy.migrateSavedGolosDonateOnOpen();assert.strictEqual(legacyCalls.length,1);assert.strictEqual(legacyCalls[0][0],'migrateGolosDonateSettings');
  const viz={id:'viz'}, event={index:1,type:'receive_award',data:{initiator:'alice',receiver:'alice',memo:'dpos.space: VIZ self-award',shares:'1 SHARES'}};
  assert.strictEqual(notify.toNotification(viz,'alice',event),null);
  notify.saveSettings(viz,'alice',{ops:['receive_award'],showAutoAwards:true});assert(notify.toNotification(viz,'alice',event));
  notify.saveSettings(viz,'alice',{ops:['receive_award'],showAutoAwards:false});assert(notify.toNotification(viz,'alice',{...event,data:{...event.data,initiator:'bob'}}));assert(notify.toNotification(viz,'alice',{...event,data:{...event.data,memo:'manual'}}));
  assert(notify.toNotification(viz,'bob',{...event,type:'benefactor_award',data:{...event.data,benefactor:'bob'}}));assert.strictEqual(notify.toNotification(viz,'alice',{...event,type:'benefactor_award',data:{...event.data,benefactor:'bob'}}),null);
  console.log('settings sync: whitelist/schema, replacement/empty rows, rollback, protected state, Golos pagination, VIZ indexed/fallback/author, races, grant-bounded runtime, notification filters PASS');
})().catch(error=>{console.error(error);process.exitCode=1;});
