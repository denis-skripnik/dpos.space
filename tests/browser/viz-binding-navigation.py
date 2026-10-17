"""Connected authority regression: production index/SDK -> route form -> export/reload.
Synthetic RPC and isolated storage only. python3 tests/browser/viz-binding-navigation.py [case ...]
"""
import importlib.util
import json
import mimetypes
import sys
from urllib.parse import urlsplit
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('manual',Path(__file__).with_name('viz-manual-unlock.py'))
assert spec and spec.loader
manual=importlib.util.module_from_spec(spec)
spec.loader.exec_module(manual)
CASES=['confirmed','manual-unlock','pending-reconcile','pending-unknown','peer-navigation','real-change','stop','lock']
TRACE=r"""(()=>{window.fixtureWrites=[];const set=Storage.prototype.setItem;
 Storage.prototype.setItem=function(key,value){
  if(['dpos_vault_v1','dpos_vault_session_resume_v1','dpos_network_viz'].includes(key))fixtureWrites.push({key,stack:new Error().stack});
  return set.call(this,key,value);
 };})();"""
def run_case(browser,case):
 context=browser.new_context(service_workers='block')
 external=[]
 errors=[]
 def route(request):
  url=urlsplit(request.request.url)
  file=(ROOT/(url.path.lstrip('/') or 'index.html')).resolve()
  if url.netloc==urlsplit(manual.ORIGIN).netloc and ROOT in file.parents and file.is_file():
   request.fulfill(path=str(file),content_type=mimetypes.guess_type(str(file))[0] or 'text/plain')
  else:
   external.append(request.request.resource_type)
   request.abort()
 context.route('**/*',route)
 context.route_web_socket('**/*',lambda socket:socket.close())
 # Keep a real receipt ID, withhold canonical block proof until the next check.
 init=manual.INIT.replace("transactions:[JSON.parse(localStorage.fixtureTransaction||'null')]","transactions:localStorage.fixtureReconcileHold?[]:[JSON.parse(localStorage.fixtureTransaction||'null')]")
 assert init!=manual.INIT
 context.add_init_script(init)
 context.add_init_script(TRACE)
 page=context.new_page()
 page.on('pageerror',lambda error:errors.append(str(error)))
 page.set_default_timeout(12000)
 def wait(expr,target=None):(target or page).wait_for_function('()=>('+expr+')')
 def snap(target=None):
  return (target or page).evaluate("""()=>({envelope:localStorage.dpos_vault_v1,resume:localStorage.dpos_vault_session_resume_v1,
   control:localStorage.getItem(DposAutomationContinuity.storageKey('viz-self-award')+'_control'),
   ledger:localStorage.getItem(DposAutomationContinuity.storageKey('viz-self-award')),
   settings:localStorage.dpos_viz_self_award_settings,network:localStorage.getItem('dpos_network_viz')})""")
 def state(target=None):
  return (target or page).evaluate("""()=>({snapshot:DposAutomationContinuity.diagnosticSnapshot(),vault:DposVault.status().state,
   running:__dposVizSelfAwardRuntime.running,timer:!!__dposVizSelfAwardRuntime.interval,
   admitted:DposVault.vizAutomationAdmitted(),readRun:DposAutomationContinuity.readRun('viz-self-award').running,
   sends:Number(localStorage.fixtureSends||0),signatures:Number(localStorage.fixtureSignatures||0),writes:fixtureWrites})""")
 def nav(target=None):
  target=target or page
  target.locator('#route-form').evaluate('(form)=>form.requestSubmit()')
  target.wait_for_timeout(1200)
 def export_reload():
  page.evaluate("location.hash='#app=diagnostics'")
  page.wait_for_selector('[data-diag-download]')
  before=snap()
  with page.expect_download() as download:page.locator('[data-diag-download]').click()
  assert download.value.suggested_filename.endswith('.log')
  assert snap()==before,'export cannot rewrite authority/cadence'
  page.reload()
  wait('window.DposV3 && __dposVizSelfAwardRuntime?.running && !!__dposVizSelfAwardRuntime.interval')
  assert snap()==before,'same-cookie reload cannot rotate authority/cadence'
 try:
  page.goto(manual.ORIGIN+'/#chain=viz&app=accounts')
  wait('!!window.DposV3')
  page.evaluate("""async password=>{await DposVault.setup({password});
   await DposAuth.saveUser(DposChains.viz,DposAuth.createKeyUser(DposChains.viz,'alice',{regular:fixtureWif}));
   location.hash='#chain=viz&app=viz-self-award';await DposV3.renderRoute();}""",manual.PASSWORD)
  if case=='pending-unknown':page.evaluate("localStorage.fixtureMode='unknown'")
  if case=='pending-reconcile':page.evaluate("localStorage.fixtureReconcileHold='yes'")
  page.locator('[name="enabled"]').check()
  page.locator('#viz-self-award-start').click()
  wait('__dposVizSelfAwardRuntime.running && !__dposVizSelfAwardRuntime.tickPromise && Number(localStorage.fixtureSends)===1')
  assert page.evaluate("DposAutomationContinuity.pending('viz-self-award','alice').state")==('pending' if case.startswith('pending-') else 'confirmed')
  if case=='manual-unlock':
   context.clear_cookies();page.reload()
   page.wait_for_selector('#vault-password')
   page.locator('#vault-password').fill(manual.PASSWORD)
   page.locator('#vault-form [type="submit"]').click()
   wait('window.__dposVizSelfAwardRuntime?.running && !!window.__dposVizSelfAwardRuntime.interval')
   assert page.evaluate('DposVault.diagnosticSnapshot().vizResumeOutcome')=='rebound'
  before=snap()
  page.evaluate('fixtureWrites.length=0')
  nav()
  observed=state()
  print(json.dumps({'case':case,'stage':'after-navigation','observed':observed}),flush=True)
  assert observed['snapshot']['bindingMatches'],'normal route form invalidated saved Start'
  assert observed['running'] and observed['timer'] and observed['admitted'] and observed['readRun'],'normal route form stopped actual runtime'
  assert snap()==before,'same-account route must preserve exact authority/ledger/settings/network bytes'
  if case=='peer-navigation':
   peer=context.new_page();peer.goto(manual.ORIGIN+'/#chain=viz&app=viz-self-award')
   wait('window.DposV3 && __dposVizSelfAwardRuntime?.running && !!__dposVizSelfAwardRuntime.interval',peer)
   nav(peer)
   assert snap()==before and state()['running'] and state(peer)['running'],'peer no-op cannot revoke either runtime'
   peer.close()
  export_reload()
  assert state()['sends']==1
  if case in ['real-change','stop','lock']:
   page.evaluate("location.hash='#chain=viz&app=viz-self-award'")
   page.wait_for_selector('#viz-self-award-stop')
   if case=='real-change':
    page.evaluate("async()=>{await DposAuth.saveUser(DposChains.viz,DposAuth.createKeyUser(DposChains.viz,'bob',{regular:fixtureWif}));}")
    assert snap()['envelope']!=before['envelope'] and snap()['resume']!=before['resume']
    wait('!__dposVizSelfAwardRuntime.running && !__dposVizSelfAwardRuntime.interval')
    assert not page.evaluate("DposAutomationContinuity.readRun('viz-self-award').running"),'real account/key change must revoke'
   elif case=='stop':
    page.locator('#viz-self-award-stop').click()
    assert not page.evaluate("DposAutomationContinuity.readRun('viz-self-award').running")
   else:
    page.locator('#vault-lock').click()
    assert page.evaluate('DposVault.status().state')=='locked'
   assert snap()['ledger']==before['ledger'],'revocation must retain exact receipt/deadline'
   page.wait_for_timeout(1200)
   assert page.evaluate('Number(localStorage.fixtureSends)')==1
  else:
   if case=='pending-reconcile':page.evaluate('delete localStorage.fixtureReconcileHold')
   due_at=page.evaluate('DposAutomationContinuity.diagnosticSnapshot().nextAt')
   page.clock.install();page.clock.fast_forward(432001);page.clock.run_for(2000)
   wait(f'__dposVizSelfAwardRuntime.diagnosticCheckStarted >= {due_at} && !__dposVizSelfAwardRuntime.tickPromise && __dposVizSelfAwardRuntime.diagnosticCheckCompleted >= __dposVizSelfAwardRuntime.diagnosticCheckStarted')
   print(json.dumps({'case':case,'stage':'after-due','observed':state(),'pendingState':page.evaluate("DposAutomationContinuity.pending('viz-self-award','alice').state"),'now':page.evaluate('Date.now()')}),flush=True)
   if case.startswith('pending-'):
    assert state()['sends']==1,'pending reconciliation/unknown must not resend'
    if case=='pending-reconcile':assert page.evaluate("DposAutomationContinuity.pending('viz-self-award','alice').state")=='confirmed'
    else:assert json.loads(snap()['ledger'])['intents']==json.loads(before['ledger'])['intents']
   else:assert state()['sends']==2,'one due full check must send exactly once through real SDK'
   page.evaluate("location.hash='#chain=viz&app=viz-self-award'")
   page.wait_for_selector('#viz-self-award-start')
   due=snap();nav()
   assert snap()==due and state()['running'] and state()['timer'],'post-tick navigation must preserve authority'
   export_reload()
   assert state()['sends']==(1 if case.startswith('pending-') else 2)
  assert not page.evaluate("Object.values(localStorage).join('').includes(fixtureWif) || Object.values(localStorage).join('').includes('fixture-only-browser-password')")
  assert external==[] and errors==[],'external RPC or production page errors'
  return {'case':case,'result':'PASS','syntheticSignedSends':page.evaluate('Number(localStorage.fixtureSends)'),'mainnetBroadcasts':0}
 finally:context.close()
def main():
 cases=sys.argv[1:] or CASES
 assert all(case in CASES for case in cases)
 results=[]
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
  try:
   for case in cases:
    try:result=run_case(browser,case)
    except Exception as error:result={'case':case,'result':'FAIL','errorType':type(error).__name__,'reason':str(error)}
    results.append(result);print(json.dumps(result),flush=True)
  finally:browser.close()
 failed=sum(result['result']=='FAIL' for result in results)
 print(json.dumps({'cases':len(results),'failed':failed,'mainnetBroadcasts':0}),flush=True)
 return bool(failed)
if __name__=='__main__':sys.exit(main())
