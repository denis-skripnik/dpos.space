"""Connected Chromium: real Start, sync UI, timer, SDK TAPOS/signing.
All assets local; RPC/signature transport fixture only, no external broadcasts.
Reuse the existing canonical Golos SDK fixture rather than a second fake scanner.
"""
from pathlib import Path
root=Path(__file__).resolve().parents[2]
source=(root/'tests/browser/golos-web-correction.py').read_text()
prefix=source.split(" page.goto(origin+'/#chain=golos&app=accounts')")[0]
prefix=prefix.replace("b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])", "b=p.chromium.connect_over_cdp('http://127.0.0.1:18800')")
extra=r'''
 try:
  page.goto(origin+'/#chain=golos&app=accounts');wait('!!window.DposV3')
  ev("""async()=>{await DposVault.setup({password:'fixture-only-browser-password'});await DposAuth.saveUser({id:'golos'},DposAuth.createKeyUser({id:'golos'},'alice',{posting:fixtureWif}));DposNotifications.saveSettings(DposChains.golos,'alice',{ops:[],androidNative:false,intervalMinutes:15});location.hash='#chain=golos&app=auto-upvoter';await DposV3.renderRoute();DposI18n.setLocale('ru');}""")
  page.locator('[name=enabled]').check();page.locator('[name=favorites]').fill('bob')
  page.locator('[name=autoDonate]').check()
  page.locator('[name=autoDonatePoolPercent]').fill('1')
  page.locator('[name=autoDonatePoolCoefficient]').fill('1')
  # A real explicit Start supplies the immutable original spending consent.
  page.locator('#auto-upvoter-start').click();wait('__dposAutoUpvoterRuntimes.golos.running');wait('!__dposAutoUpvoterRuntimes.golos.scanPromise')
  ev("""()=>{window.qaOriginalControl=localStorage.getItem(DposAutomationContinuity.storageKey('upvoter:golos')+'_control');window.qaSnapshot=DposSettingsSync.exportSnapshot();const row=qaSnapshot.autoUpvoter.golos[0];row.autoDonate=false;row.autoDonatePoolPercent='1';window.qaFetch=fetch;window.fetch=async(url,opts)=>{let body;try{body=JSON.parse(opts?.body||'{}')}catch(_){}if(body?.params?.[1]==='get_account_history')return new Response(JSON.stringify({result:[[5,{block:30,op:['custom_json',{id:'dpos.space.settings',required_posting_auths:['alice'],json:JSON.stringify(qaSnapshot)}]}]]}),{status:200});return qaFetch(url,opts);};}""")
  # Observe the real scanner's history/RPC consumer, not a detached runtime field.
  ev("""()=>{window.qaReads=[];const history=golos.api.getAccountHistoryAsync;golos.api.getAccountHistoryAsync=async(...args)=>{qaReads.push(args[0]);return history(...args);};}""")
  page.on('dialog',lambda d:d.accept())
  def sync():
   ev("async()=>{location.hash='#app=settings-sync';await DposV3.renderRoute()}")
   page.locator('#settings-sync-chain').select_option('golos');page.locator('#settings-sync-source').fill('alice');page.locator('#settings-sync-read').click()
   page.wait_for_function("()=>document.querySelector('#settings-sync-status').textContent.includes('заменены последним')")
  ev("()=>qaSnapshot.autoUpvoter.golos[0].favorites='carol'");sync()
  ev('()=>qaReads=[]');tick()
  assert 'carol' in ev('qaReads') and 'bob' not in ev('qaReads'),ev('qaReads')
  assert ev("localStorage.getItem(DposAutomationContinuity.storageKey('upvoter:golos')+'_control')===qaOriginalControl")
  # Empty -> enabled and true -> false -> true restore only original grants.
  ev('()=>{window.qaRow=qaSnapshot.autoUpvoter.golos[0];qaSnapshot.autoUpvoter.golos=[]}');sync();tick()
  assert not ev('__dposAutoUpvoterRuntimes.golos.settings[0].enabled')
  assert ev('__dposAutoUpvoterRuntimes.golos.running')
  ev("()=>{qaRow.favorites='bob';qaRow.autoDonate=true;qaSnapshot.autoUpvoter.golos=[qaRow,{...qaRow,account:'ungranted'}]}");sync()
  assert ev('__dposAutoUpvoterRuntimes.golos.settings[0].enabled && __dposAutoUpvoterRuntimes.golos.settings[0].autoDonate')
  assert ev('__dposAutoUpvoterRuntimes.golos.settings.length')==1
  ev('()=>qaRow.autoDonate=false');sync();assert not ev('__dposAutoUpvoterRuntimes.golos.settings[0].autoDonate')
  ev('()=>qaRow.autoDonate=true');sync();assert ev('__dposAutoUpvoterRuntimes.golos.settings[0].autoDonate')
  # Pause real TAPOS then synchronize changed favorites before SDK signing.
  ev("""()=>{qaRow.autoDonate=false;window.qaPrepare=golos.broadcast._prepareTransaction;golos.broadcast._prepareTransaction=async(...args)=>{const tx=await qaPrepare(...args);if(!window.qaHeld){window.qaHeld=true;await new Promise(r=>window.qaRelease=r);}return tx;};}""");sync()
  add('revoked-tapos');before=sends();sig=ev('window.fixtureSignatures||0');due();wait('typeof qaRelease==="function"')
  ev("()=>qaRow.favorites='carol'");sync();ev('()=>qaRelease()');wait('!__dposAutoUpvoterRuntimes.golos.scanPromise')
  assert sends()==before and ev('window.fixtureSignatures||0')==sig
  assert intent('revoked-tapos') is None
  assert ev('__dposAutoUpvoterRuntimes.golos.running')
  # Next tick uses changed settings, no stale retry, Start evidence unchanged.
  ev('()=>qaReads=[]');tick();assert 'carol' in ev('qaReads') and sends()==before
  assert ev("localStorage.getItem(DposAutomationContinuity.storageKey('upvoter:golos')+'_control')===qaOriginalControl")
  ev("()=>qaRow.favorites='bob'");sync();tick()
  assert intent('revoked-tapos')['state']=='confirmed' and sends()==before+1
  tick();assert sends()==before+1
  # A send already attempted before sync retains its exact durable evidence.
  add('attempted-before-sync',mode='reversible');tick()
  attempted=intent('attempted-before-sync');assert attempted['state']=='pending' and attempted['attempted']
  attempted_sends=sends()
  ev("()=>qaRow.favorites='carol'");sync()
  assert intent('attempted-before-sync')==attempted
  ev("()=>localStorage.fixtureMode='normal'");tick()
  assert sends()==attempted_sends and intent('attempted-before-sync')['state']=='confirmed'
  ev("()=>qaRow.favorites='bob'");sync()
  # Reload intersects original consent again, no extra Start and no replay.
  original_control=ev('qaOriginalControl')
  page.reload();wait('DposVault.status().state==="unlocked" && __dposAutoUpvoterRuntimes?.golos?.running');tick()
  assert sends()==attempted_sends and ev('__dposAutoUpvoterRuntimes.golos.settings[0].favorites')=='bob'
  assert ev("localStorage.getItem(DposAutomationContinuity.storageKey('upvoter:golos')+'_control')")==original_control
  assert not errors and not external,(errors,external)
  print(json.dumps({'realStartSyncTimer':'PASS','emptyEnabledRestore':'PASS','donateRestoreOriginalConsentOnly':'PASS','taposRevokedZeroSignaturesSends':'PASS','nextTickRetryOnce':'PASS','attemptedEvidencePreservedNoReplay':'PASS','reloadNoReplay':'PASS','liveBroadcasts':0,'pageErrors':errors}))
 finally:
  c.unroute_all(behavior='ignoreErrors');c.close()
'''
exec(compile(prefix+extra,__file__,'exec'))
