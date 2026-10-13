"""Four independent review regressions. Actual SDK, rendered Start, synthetic RPC.
GOLOS_REVIEW_BASELINE optionally serves saved pre-correction files for RED.
Each case is a fresh isolated browser. No network escapes the route fixture.
"""
import os,sys
from pathlib import Path
root=Path(__file__).resolve().parents[2]
source=(root/'tests/browser/golos-web-correction.py').read_text()
prefix=source.split(" page.goto(origin+'/#chain=golos&app=accounts')")[0]
prefix=prefix.replace('root=Path(__file__).resolve().parents[2]',f'root=Path({str(root)!r})')
prefix=prefix.replace("if u.netloc==urlsplit(origin).netloc and root in f.parents and f.is_file():r.fulfill", "saved=Path(os.environ.get('GOLOS_REVIEW_BASELINE','/nonexistent'))/f.relative_to(root) if root in f.parents else Path('/nonexistent');f=saved if saved.is_file() else f\n  if u.netloc==urlsplit(origin).netloc and f.is_file():r.fulfill")
extra=r'''
 page.goto(origin+'/#chain=golos&app=accounts');wait('!!window.DposV3')
 ev("""async()=>{await DposVault.setup({password:'fixture-only-browser-password'});await DposAuth.saveUser({id:'golos'},DposAuth.createKeyUser({id:'golos'},'alice',{posting:fixtureWif}));DposNotifications.saveSettings(DposChains.golos,'alice',{ops:[],androidNative:false,intervalMinutes:15});location.hash='#chain=golos&app=auto-upvoter';await DposV3.renderRoute();DposI18n.setLocale('ru');}""")
 page.locator('[name=enabled]').check();page.locator('[name=favorites]').fill('bob')
 add('warmup');page.locator('#auto-upvoter-start').click();wait('DposAutomationContinuity.pending("upvoter:golos","alice/bob/warmup")?.state==="confirmed"');wait('!__dposAutoUpvoterRuntimes.golos.scanPromise');page.locator('#auto-upvoter-stop').click()
 initialSends=sends()
 def start():page.locator('#auto-upvoter-start').click();wait('__dposAutoUpvoterRuntimes.golos.running');tick()
 def stop():page.locator('#auto-upvoter-stop').click()
 def seen(post):return ev('p=>__dposAutoUpvoterRuntimes.golos.scannerState.seen.has("alice|bob|"+p)',post)
 def inbox(post):return ev('p=>Object.entries(localStorage).filter(([k])=>k.startsWith("dpos_golos_event_backlog_v1_")).some(([k,v])=>Object.values(JSON.parse(v).inbox).some(e=>JSON.stringify(e).includes(p)))',post)
 case=sys.argv[1] if len(sys.argv)>1 else 'receipt'
 if case=='receipt':
  ev("""()=>{const send=golos.api.broadcastTransactionSynchronous;golos.api.broadcastTransactionSynchronous=(signed,cb)=>send(signed,(err,r)=>{if(err)return cb(err,r);window.reviewOriginal=JSON.parse(JSON.stringify(signed));delete reviewOriginal.signatures;window.reviewOriginalId=golos.auth.unsignedTransactionId(reviewOriginal);const altered=JSON.parse(JSON.stringify(reviewOriginal));altered.operations[0][1].weight=5000;window.reviewAlteredId=golos.auth.unsignedTransactionId(altered);window.reviewBlock=r.block_num;const blocks=JSON.parse(localStorage.fixtureBlocks);blocks[r.block_num]=altered;localStorage.fixtureBlocks=JSON.stringify(blocks);cb(null,{...r,id:reviewAlteredId,transaction:altered,operation:altered.operations[0]});});}""")
  add('override');start();x=intent('override');print('RECEIPT',json.dumps(x),flush=True)
  assert x['state']=='pending' and x['id']==ev('reviewOriginalId') and x['id']!=ev('reviewAlteredId')
  assert x['transaction']['operations'][0][1]['weight']==10000 and x['operation'][1]['weight']==10000
  before=sends();tick();assert intent('override')['state']=='pending' and sends()==before
  # Only canonical ORIGINAL intent can recover; fake receipt never changes intent.
  ev("()=>{const blocks=JSON.parse(localStorage.fixtureBlocks);blocks[reviewBlock]=reviewOriginal;localStorage.fixtureBlocks=JSON.stringify(blocks);}");tick();assert intent('override')['state']=='confirmed' and sends()==before
 elif case in ['receipt-fields','receipt-same-id-alternate']:
  ev("""mode=>{const send=golos.api.broadcastTransactionSynchronous;golos.api.broadcastTransactionSynchronous=(signed,cb)=>send(signed,(err,r)=>{if(err)return cb(err,r);const altered=JSON.parse(JSON.stringify(signed));delete altered.signatures;altered.operations[0][1].weight=5000;if(mode==='receipt-same-id-alternate'){const blocks=JSON.parse(localStorage.fixtureBlocks);blocks[r.block_num]=altered;localStorage.fixtureBlocks=JSON.stringify(blocks);}cb(null,{...r,transaction:altered,operation:altered.operations[0],nodeBinding:'attacker',attempted:false,state:'confirmed'});});}""",case)
  add(case);start();x=intent(case);print('RECEIPT_FIELDS',json.dumps(x),flush=True)
  assert x['state']==('confirmed' if case=='receipt-fields' else 'pending') and x['attempted'] and x['operation'][1]['weight']==10000 and x['transaction']['operations'][0][1]['weight']==10000 and x['nodeBinding']!='attacker'
  before=sends();tick();assert sends()==before
 elif case in ['stop','lock']:
  ev("""()=>{const prepare=golos.broadcast._prepareTransaction;golos.broadcast._prepareTransaction=async(...a)=>{const tx=await prepare(...a);if(!window.reviewHeld){window.reviewHeld=true;await new Promise(r=>window.reviewRelease=r);}return tx;};}""")
  add('first');add('second');before=sends();sig=ev('window.fixtureSignatures||0');page.locator('#auto-upvoter-start').click();wait('__dposAutoUpvoterRuntimes.golos.running');due();wait('typeof reviewRelease==="function"')
  if case=='stop':stop()
  else:ev('()=>DposVault.lock()')
  ev('()=>reviewRelease()');wait('!__dposAutoUpvoterRuntimes.golos.scanPromise')
  print('INTERRUPTED',json.dumps({'sends':sends()-before,'seen':ev('()=>[...__dposAutoUpvoterRuntimes.golos.scannerState.seen]'),'firstInbox':inbox('first'),'secondInbox':inbox('second')}),flush=True)
  assert sends()==before and ev('window.fixtureSignatures||0')==sig and not seen('first') and not seen('second') and inbox('first') and inbox('second')
  if case=='lock':ev("async()=>{await DposVault.unlock({password:'fixture-only-browser-password'});await DposV3.renderRoute();}")
  start();assert sends()==before+2 and intent('first')['state']=='confirmed' and intent('second')['state']=='confirmed';tick();assert sends()==before+2
 elif case in ['prepare','authority','tapos','attempted']:
  add(case);before=sends()
  if case=='prepare':
   ev("()=>{window.reviewBroadcast=DposBroadcast;window.DposBroadcast={...reviewBroadcast,prepareForUser(){throw Error('explicitly unsent prepare failure');}};}")
   restore='()=>window.DposBroadcast=reviewBroadcast'
  elif case=='authority':
   ev("""()=>{window.reviewPrepare=DposBroadcast.prepareForUser;window.reviewAccounts=golos.api.getAccountsAsync;window.DposBroadcast={...DposBroadcast,prepareForUser(...a){const x=reviewPrepare(...a);window.reviewAuthority=true;return x;}};golos.api.getAccountsAsync=(...a)=>{if(window.reviewAuthority)throw Error('authority read failed before reservation');return reviewAccounts(...a);};}""")
   restore='()=>{window.reviewAuthority=false;golos.api.getAccountsAsync=reviewAccounts;window.DposBroadcast={...DposBroadcast,prepareForUser:reviewPrepare};}'
  elif case=='tapos':
   ev("()=>{window.reviewPrepare=golos.broadcast._prepareTransaction;golos.broadcast._prepareTransaction=async()=>{throw Error('unsent TAPOS failure');};}")
   restore='()=>golos.broadcast._prepareTransaction=reviewPrepare'
  else:
   ev("()=>{window.reviewSend=golos.api.broadcastTransactionSynchronous;golos.api.broadcastTransactionSynchronous=(tx,cb)=>{localStorage.fixtureSends=Number(localStorage.fixtureSends||0)+1;cb(Error('unknown transport after RPC invocation'));};}")
   restore='()=>golos.api.broadcastTransactionSynchronous=reviewSend'
  start();print('FAILURE',json.dumps({'intent':intent(case),'seen':seen(case),'inbox':inbox(case),'sendDelta':sends()-before}),flush=True)
  ev(restore)
  if case=='attempted':
   assert intent(case)['state']=='pending' and intent(case)['attempted'] and seen(case) and sends()==before+1
   tick();assert sends()==before+1 and intent(case)['state']=='pending'
  else:
   assert intent(case) is None and not seen(case) and inbox(case) and sends()==before
   tick();assert intent(case)['state']=='confirmed' and sends()==before+1;tick();assert sends()==before+1
 elif case in ['clock-initial','clock-presend','clock-final','clock-content']:
  # Two connection probes precede intake head (3) and pre-send head (4).
  # Post-TAPOS uses the actual SDK preparation marker; content ages separately.
  add(case)
  ev("""stage=>{window.reviewOffset=0;window.reviewHeadCount=0;window.reviewTime=new Date().toISOString().slice(0,19);window.reviewCashout=new Date(Date.parse(reviewTime+'Z')+90000).toISOString().slice(0,19);const monotonic=performance.now.bind(performance);Object.defineProperty(performance,'now',{value:()=>monotonic()+reviewOffset});const head=golos.api.getDynamicGlobalPropertiesAsync;golos.api.getDynamicGlobalPropertiesAsync=async()=>{const stack=new Error().stack;const x=await head();x.time=reviewTime;reviewHeadCount++;(window.reviewStacks ||= []).push(stack);if((stage==='clock-initial'&&reviewHeadCount===3)||(stage==='clock-presend'&&reviewHeadCount===4)||(stage==='clock-final'&&window.preparedMarker&&!window.reviewDelayed)){reviewOffset+=45000;window.reviewDelayed=true;window.reviewDelayedAt=reviewHeadCount;}return x;};const content=golos.api.getContentAsync;golos.api.getContentAsync=async(...a)=>{const x=await content(...a);if(stage==='clock-content'&&window.preparedMarker&&!window.reviewDelayed){reviewOffset+=45000;window.reviewDelayed=true;}return {...x,cashout_time:reviewCashout};};}""",case)
  before=sends();sig=ev('window.fixtureSignatures||0');start();print('CLOCK',json.dumps({'stage':case,'offsetMs':ev('reviewOffset'),'signatures':ev('window.fixtureSignatures||0')-sig,'sendDelta':sends()-before,'delayedHeadOrdinal':ev('window.reviewDelayedAt')}),flush=True)
  assert ev('reviewOffset')==45000 and sends()==before and ev('window.fixtureSignatures||0')==sig and intent(case) is None
 else:raise ValueError(case)
 assert errors==[] and external==[],(errors,external)
 print(json.dumps({'case':case,'PASS':True,'pageErrors':errors,'externalRequests':len(external),'liveBroadcasts':0}),flush=True)
 c.close();b.close()
'''
exec(compile(prefix+extra,__file__,'exec'))
