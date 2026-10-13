"""Real vendored SDK + rendered scanner; all network intercepted, no live sends."""
import ast,json,mimetypes
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[2]
tree=ast.parse((root/'tests/browser/web-reload-continuity.py').read_text())
INIT=next(ast.literal_eval(n.value) for n in tree.body if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='INIT' for t in n.targets))
INIT=INIT.replace("['viz','golos','hive','steem']", "['golos']")
INIT=INIT.replace("sdk.api.getContentAsync=async(a,p)=>({author:a,permlink:p,parent_author:'',active_votes:[],title:'Fixture'});", """
   const content=(a,p)=>({author:a,permlink:p,parent_author:'',allow_votes:true,last_payout:'1970-01-01T00:00:00',cashout_time:'2099-01-01T00:00:00',created:'2026-01-01T00:00:00',last_update:'2026-01-01T00:00:00',num_changes:0,active_votes:[],title:'Fixture'});
   sdk.api.getContentAsync=async(a,p)=>{
    window.contentCalls=window.contentCalls||{};window.contentCalls[p]=(window.contentCalls[p]||0)+1;
    const x=content(a,p),mode=localStorage.fixturePolicy;
    if(mode==='disabled')x.allow_votes=false;
    if(mode==='paid')x.last_payout='2026-01-01T00:00:00';
    if(mode==='cashout')x.cashout_time=new Date(Date.now()+30000).toISOString().slice(0,19);
    if(mode==='edited' || (mode==='final-edit'&&window.contentCalls[p]>=3)){x.num_changes=1;x.last_update='2026-01-02T00:00:00';}
    if(mode==='reply-active')x.active='2026-05-01T00:00:00';
    if(localStorage.fixtureOwnVote==='yes')x.active_votes=[{voter:'alice',percent:10000}];
    return x;
   };
   const sign=sdk.auth.signTransaction;sdk.auth.signTransaction=function(...args){window.fixtureSignatures=(window.fixtureSignatures||0)+1;return sign.apply(this,args);};
   const prepare=sdk.broadcast._prepareTransaction;sdk.broadcast._prepareTransaction=async(...args)=>{const tx=await prepare.apply(sdk.broadcast,args);window.preparedMarker=true;return tx;};
   const accounts=sdk.api.getAccountsAsync;sdk.api.getAccountsAsync=async(...args)=>{if(localStorage.fixtureBattery==='fail'&&window.preparedMarker)return [];return accounts(...args);};
""")
INIT=INIT.replace("sdk.api.getAccountHistoryAsync=async()=>[];", """sdk.api.getAccountHistoryAsync=async(account,from,limit)=>{
    if(account==='broken')throw Error('fixture offline');
    let rows=JSON.parse(localStorage.fixtureRows||'[]');
    rows=rows.filter(r=>r[1].op[1].author===account || r[1].op[1].voter===account);
    if(from!==-1)rows=rows.filter(r=>r[0]<=from);
    rows=rows.slice(-limit);
    if(localStorage.fixtureGap==='yes'&&account==='healthy')rows=rows.filter((_,i)=>i!==5);
    return rows;
   };""")
INIT=INIT.replace("last_irreversible_block_num:localStorage.fixtureMode==='reversible'?98:100", "last_irreversible_block_num:localStorage.fixtureMode==='reversible'?0:100000")
INIT=INIT.replace("sdk.api.getBlockAsync=async()=>({previous:'000000620000007b'+'0'.repeat(24),transaction_ids:[(localStorage.fixtureMode==='wrong-id'?'2':'1').repeat(40)],transactions:[JSON.parse(localStorage.fixtureTransaction||'null')]});", """sdk.api.getBlockAsync=async n=>{
    window.blockReads=(window.blockReads||0)+1;
    const tx=JSON.parse(localStorage.fixtureBlocks||'{}')[n];
    const block={previous:'000000620000007b'+'0'.repeat(24),transactions:tx?[tx]:[]};
    if(localStorage.fixtureMode==='wrong-id')block.transaction_ids=['2'.repeat(40)];
    if(localStorage.fixtureMode==='wrong-operation'&&tx)tx.operations[0][1].weight=9999;
    return block;
   };
   sdk.api.getTransactionAsync=async id=>{const entries=Object.entries(JSON.parse(localStorage.fixtureBlocks||'{}'));const found=entries.find(([n,t])=>sdk.auth.unsignedTransactionId(t)===id);return found?{transaction_id:id,block_num:Number(found[0]),transaction_num:0}:null;};""")
INIT=INIT.replace("const receipt=localStorage.fixtureMode==='unknown'?{}:{id:'1'.repeat(40),block_num:99,trx_num:0,expired:false};", """const number=200+Number(localStorage.fixtureSends),blocks=JSON.parse(localStorage.fixtureBlocks||'{}');blocks[number]=unsigned;localStorage.fixtureBlocks=JSON.stringify(blocks);
    const receipt=localStorage.fixtureMode==='unknown'?{}:{id:sdk.auth.unsignedTransactionId(unsigned),block_num:number,trx_num:0,expired:false};""")
origin='https://golos-correction-fixture.invalid'
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 c=b.new_context(service_workers='block'); external=[]; errors=[]
 def route(r):
  u=urlsplit(r.request.url); f=(root/(u.path.lstrip('/') or 'index.html')).resolve()
  if u.netloc==urlsplit(origin).netloc and root in f.parents and f.is_file():r.fulfill(path=str(f),content_type=mimetypes.guess_type(str(f))[0] or 'text/plain')
  else:
   external.append(r.request.url)
   assert not (r.request.method=='POST' and 'broadcast' in str(r.request.post_data))
   r.fulfill(content_type='application/json',body='{"result":[],"data":[]}')
 c.route('**/*',route);c.add_init_script(INIT);page=c.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
 def wait(expr):
  try:page.wait_for_function('()=>('+expr+')',timeout=60000)
  except Exception:
   print('BLOCKER',expr,page.locator('#app').inner_text()[:6000],errors,ev('()=>({vault:DposVault.status(),running:window.__dposAutoUpvoterRuntimes?.golos?.running,feedError:window.__dposAutoUpvoterRuntimes?.golos?.feedStorageError,control:JSON.parse(localStorage.getItem(DposAutomationContinuity.storageKey("upvoter:golos")+"_control")||"{}").running})'),flush=True);raise
 def ev(code,arg=None):return page.evaluate(code,arg)
 def due():ev("()=>{const k=DposAutomationContinuity.storageKey('upvoter:golos'),x=JSON.parse(localStorage.getItem(k));x.nextAt=0;localStorage.setItem(k,JSON.stringify(x));}")
 def add(post,policy='normal',mode='normal'):
  ev("""([post,policy,mode])=>{localStorage.fixturePolicy=policy;localStorage.fixtureMode=mode;delete localStorage.fixtureOwnVote;window.preparedMarker=false;const rows=JSON.parse(localStorage.fixtureRows||'[]');rows.push([rows.filter(r=>r[1].op[1].author==='bob').length+1,{op:['comment',{author:'bob',permlink:post,parent_author:''}]}]);localStorage.fixtureRows=JSON.stringify(rows);}""",[post,policy,mode])
 def intent(post):return ev("post=>DposAutomationContinuity.pending('upvoter:golos','alice/bob/'+post)",post)
 def tick():due();wait('!__dposAutoUpvoterRuntimes.golos.scanPromise && DposAutomationContinuity.remaining("upvoter:golos")>0')
 def sends():return ev('Number(localStorage.fixtureSends||0)')
 page.goto(origin+'/#chain=golos&app=accounts');wait('!!window.DposV3')
 ev("""async()=>{await DposVault.setup({password:'fixture-only-browser-password'});await DposAuth.saveUser({id:'golos'},DposAuth.createKeyUser({id:'golos'},'alice',{posting:fixtureWif}));DposNotifications.saveSettings(DposChains.golos,'alice',{ops:[],androidNative:false,intervalMinutes:15});location.hash='#chain=golos&app=auto-upvoter';await DposV3.renderRoute();DposI18n.setLocale('ru');}""")
 page.locator('[name=enabled]').check();page.locator('[name=favorites]').fill('bob')
 add('canonical');page.locator('#auto-upvoter-start').click();wait('DposAutomationContinuity.pending("upvoter:golos","alice/bob/canonical")?.state==="confirmed"');wait('!__dposAutoUpvoterRuntimes.golos.scanPromise')
 assert sends()==1
 add('late',mode='reversible');tick();assert intent('late')['state']=='pending';before=sends()
 ev("()=>{localStorage.fixtureMode='normal';localStorage.fixtureOwnVote='yes';}");tick();assert intent('late')['state']=='confirmed' and sends()==before
 add('reload-late',mode='reversible');tick();assert intent('reload-late')['state']=='pending';before=sends()
 ev("()=>{localStorage.fixtureMode='normal';localStorage.fixtureOwnVote='yes';}");page.reload();wait('DposVault.status().state==="unlocked" && __dposAutoUpvoterRuntimes?.golos?.running');tick();assert intent('reload-late')['state']=='confirmed' and sends()==before
 # No receipt metadata: SDK-derived ID was durable before RPC; exact lookup supplies position.
 add('lookup',mode='unknown');tick();assert intent('lookup')['state']=='pending';before=sends();ev("()=>localStorage.fixtureMode='normal'");tick();assert intent('lookup')['state']=='confirmed' and sends()==before
 policy=[]
 for reason in ['disabled','paid','cashout','edited','final-edit']:
  before=sends();sig=ev('window.fixtureSignatures||0');add('policy-'+reason,reason);tick();assert sends()==before and ev('window.fixtureSignatures||0')==sig;assert intent('policy-'+reason) is None;policy.append(reason)
 add('reply-active','reply-active');tick();assert intent('reply-active')['state']=='confirmed'
 before=sends();add('battery');ev("()=>localStorage.fixtureBattery='fail'");tick();assert sends()==before and intent('battery') is None
 ev("()=>{delete localStorage.fixtureBattery;window.preparedMarker=false;}");tick();assert sends()==before+1 and intent('battery')['state']=='confirmed';tick();assert sends()==before+1
 # Optional IDs and full operation cannot contradict the recomputed canonical ID.
 for mode in ['wrong-id','wrong-operation']:
  add(mode,mode=mode);tick();assert intent(mode)['state']=='pending'
 ev("()=>localStorage.fixtureMode='normal'");before=sends();tick();assert sends()==before and all(intent(m)['state']=='confirmed' for m in ['wrong-id','wrong-operation'])
 # Paginated favorite/comment and curator intake, real rendered Start + SDK signing.
 page.locator('#auto-upvoter-stop').click();page.locator('[name=curators]').fill('healthy, broken')
 ev("""()=>{const rows=JSON.parse(localStorage.fixtureRows);const base=rows.filter(r=>r[1].op[1].author==='bob').length;
 for(let i=1;i<=55;i++)rows.push([base+i,{op:['comment',{author:'bob',permlink:'burst-f-'+i,parent_author:''}]}]);
 for(let i=1;i<=65;i++)rows.push([i,{op:['vote',{voter:'healthy',author:'carol',permlink:'burst-c-'+i,weight:10000}]}]);
 localStorage.fixtureRows=JSON.stringify(rows);localStorage.fixtureGap='yes';}""")
 page.locator('#auto-upvoter-start').click();wait('!__dposAutoUpvoterRuntimes.golos.scanPromise');tick()
 assert ev("()=>Object.keys(DposAutomationContinuity.readRun('upvoter:golos').intents).filter(k=>k.includes('burst-c-')).length")==0
 ev("()=>delete localStorage.fixtureGap");page.reload();wait('DposVault.status().state==="unlocked" && __dposAutoUpvoterRuntimes?.golos?.running')
 for _ in range(9):tick()
 burst=ev("()=>Object.entries(DposAutomationContinuity.readRun('upvoter:golos').intents).filter(([k,v])=>k.includes('/burst-')&&v.state==='confirmed').map(([k])=>k)")
 assert len(set(burst))==120,len(burst)
 # Exact older history continuation survives reload and fresh-head rechecks.
 add('history-older',mode='unknown');tick();assert intent('history-older')['state']=='pending';before=sends()
 history_init="""()=>{golos.api.getTransactionAsync=async()=>null;const intent=DposAutomationContinuity.pending('upvoter:golos','alice/bob/history-older');const txs=JSON.parse(localStorage.fixtureBlocks);const block=Number(Object.keys(txs).find(n=>golos.auth.unsignedTransactionId(txs[n])===intent.id));
 const original=golos.api.getAccountHistoryAsync;golos.api.getAccountHistoryAsync=async(a,f,l)=>{if(a!=='alice')return original(a,f,l);const rows=Array.from({length:90},(_,i)=>[i+1,{op:['custom_json',{id:'noise'}]}]);rows[2]=[3,{trx_id:intent.id,block,trx_in_block:0,op:intent.operation}];return rows.filter(r=>f===-1||r[0]<=f).slice(-l);};}"""
 ev(history_init);ev("()=>localStorage.fixtureMode='normal'");tick();assert intent('history-older')['historyFrom']==60
 page.reload();wait('DposVault.status().state==="unlocked" && __dposAutoUpvoterRuntimes?.golos?.running');ev(history_init);tick();assert intent('history-older')['historyFrom']==30;tick();assert intent('history-older')['state']=='confirmed' and sends()==before
 # Fresh vote donation dependency and no late catch-up.
 page.locator('#auto-upvoter-stop').click();page.locator('[name=autoDonate]').check();page.locator('#auto-upvoter-start').click();wait('!__dposAutoUpvoterRuntimes.golos.scanPromise')
 donation=ev("""async()=>{const scope='upvoter:golos',a={type:'vote',account:'alice',author:'bob',permlink:'donation-fresh',weight:100,source:'favorite',donate:{enabled:true,amount:1}};
 const before=Number(localStorage.fixtureSends);const r=await DposAutomationContinuity.exclusive(scope,()=>DposGolosAutoUpvoter.broadcastPlannedAction(DposChains.golos,a,{continuityScope:scope}));return {sends:Number(localStorage.fixtureSends)-before,count:r.donations.length};}""")
 assert donation=={'sends':3,'count':2},donation
 late_donation=ev("""async()=>{localStorage.fixtureMode='reversible';const scope='upvoter:golos',a={type:'vote',account:'alice',author:'bob',permlink:'donation-late',weight:100,source:'favorite',donate:{enabled:true,amount:1}};try{await DposAutomationContinuity.exclusive(scope,()=>DposGolosAutoUpvoter.broadcastPlannedAction(DposChains.golos,a,{continuityScope:scope}));}catch(_){}return DposAutomationContinuity.pending(scope,'alice/bob/donation-late').state;}""")
 assert late_donation=='pending';before=sends();ev("()=>localStorage.fixtureMode='normal'");tick();assert intent('donation-late')['state']=='confirmed' and sends()==before
 # Lifetime Web Lock and stale Stop/Lock from a second real same-origin tab.
 page2=c.new_page();page2.goto(origin+'/#chain=golos&app=auto-upvoter');page2.wait_for_function('()=>DposVault.status().state==="unlocked"&&!!window.__dposAutoUpvoterRuntimes?.golos')
 before=sends();sig=ev('window.fixtureSignatures||0');add('cross-tab-stop');ev("()=>localStorage.fixtureHold='accounts'");due();wait('typeof window.fixtureReleaseAccounts==="function"')
 assert page2.evaluate("async()=>DposAutomationContinuity.exclusive('upvoter:golos',()=>({bad:true}))")=={'skipped':True,'reason':'overlap'}
 page2.evaluate("()=>DposAutomationContinuity.stop('upvoter:golos')");ev("()=>{delete localStorage.fixtureHold;fixtureReleaseAccounts();}");wait('!__dposAutoUpvoterRuntimes.golos.scanPromise');assert sends()==before and ev('window.fixtureSignatures||0')==sig and intent('cross-tab-stop') is None
 page.locator('#auto-upvoter-start').click();tick();assert intent('cross-tab-stop')['state']=='confirmed' and sends()==before+1
 before=sends();sig=ev('window.fixtureSignatures||0');add('cross-tab-lock');ev("()=>{delete window.fixtureReleaseAccounts;localStorage.fixtureHold='accounts';}");due();wait('typeof window.fixtureReleaseAccounts==="function"')
 page2.evaluate('()=>DposVault.lock()');ev("()=>{delete localStorage.fixtureHold;fixtureReleaseAccounts();}");wait('!__dposAutoUpvoterRuntimes.golos.scanPromise');assert sends()==before and ev('window.fixtureSignatures||0')==sig and intent('cross-tab-lock') is None
 page2.close()
 # Actual browser quota failure at atomic intake commit must precede signing.
 ev("async()=>{await DposVault.unlock({password:'fixture-only-browser-password'});await DposV3.renderRoute();}")
 before=sends();sig=ev('window.fixtureSignatures||0');add('storage-failure')
 ev("()=>{window.fixtureStorageSet=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k.startsWith('dpos_golos_event_backlog_v1_'))throw Error('synthetic quota');return fixtureStorageSet.call(this,k,v);};}")
 page.locator('#auto-upvoter-start').click();due();wait('DposVault.status().state==="locked"');wait('!__dposAutoUpvoterRuntimes.golos.scanPromise')
 assert sends()==before and ev('window.fixtureSignatures||0')==sig and intent('storage-failure') is None
 ev('()=>Storage.prototype.setItem=fixtureStorageSet')
 assert errors==[],errors
 print(json.dumps({'canonicalNoIds':'confirmed','normalTickAndReloadLateProof':'confirmed-no-rebroadcast','metadataLessExactLookup':'confirmed-no-rebroadcast','terminalAndFinalReadPoliciesZeroSignatures':policy,'replyActivityNotEdit':True,'transientBatteryRetry':'once','optionalIdAndFullOperationMismatch':'pending-then-recovered','burstBackfillRestartConfirmed':len(set(burst)),'historyOlderContinuationAfterReload':True,'freshDonation':donation,'lateDonationCatchup':0,'atomicIntakeStorageFailure':'zero-signatures/sends-locked','twoTabLifetimeLockAndStaleStopLock':'zero-stale-signatures/sends','sends':sends(),'pageErrors':errors,'externalBlocked':len(external),'liveBroadcasts':0}))
 c.close();b.close()
