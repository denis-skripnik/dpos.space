import json, os, mimetypes
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[2];origin='https://dpos.blinddev.xyz';live=os.getenv('LIVE')=='1'
with sync_playwright() as p:
 browser=p.chromium.connect_over_cdp('http://127.0.0.1:18800')
 for native in [False,True]:
  c=browser.new_context(service_workers='block',accept_downloads=True);errors=[]
  if native:
   c.add_init_script("""window.diagCalls=[];window.DposAndroidTransport={postMessage(raw){const r=JSON.parse(raw);diagCalls.push(r);const result=r.method==='getAppInfo'?{diagnosticLogExport:true}:{ok:true,filename:'fixture.log'};queueMicrotask(()=>this.onmessage({data:JSON.stringify({version:2,id:r.id,ok:true,result})}));}};""")
  def route(r):
   u=urlsplit(r.request.url);f=(root/(u.path.lstrip('/') or 'index.html')).resolve()
   if u.netloc==urlsplit(origin).netloc and root in f.parents and f.is_file():
    if live:r.continue_()
    else:r.fulfill(path=str(f),content_type=mimetypes.guess_type(str(f))[0] or 'application/javascript')
   else:r.fulfill(status=200,content_type='application/json',body='{"data":[],"result":[]}')
  c.route('**/*',route)
  try:
   page=c.new_page();page.on('pageerror',lambda e:errors.append(str(e)));page.goto(origin+'/')
   page.locator('footer a[href="#app=diagnostics"]').click()
   page.locator('[data-diag-download]').wait_for()
   assert page.evaluate("()=>DposVault.status().state!=='unlocked'"),'page must work without unlocking'
   page.evaluate("async()=>{await DposDiagnostics.record('info','fixture',{message:'download-complete-marker',password:'do-not-export-fixture'});await DposDiagnostics.record('error','fixture','abandon '.repeat(11)+'about');}")
   page.reload();page.locator('[data-diag-download]').wait_for()
   assert page.evaluate("async()=>(await DposDiagnostics.exportText()).includes('download-complete-marker')")
   page.select_option('#language-select','en')
   page.get_by_role('button',name='Download .log',exact=True).wait_for()
   if native:
    page.get_by_text('Android: saving will include background service events and the state of all configured accounts.',exact=True).wait_for()
    page.locator('[data-diag-download]').click()
    page.get_by_text('Log file saved. You can send it to the developer as a document.',exact=True).wait_for()
    calls=page.evaluate('()=>diagCalls');assert all(x['method'] in ['getAppInfo','saveDiagnosticLog'] for x in calls)
    text=next(x['payload']['webReport'] for x in calls if x['method']=='saveDiagnosticLog')
   else:
    with page.expect_download() as pending:page.locator('[data-diag-download]').press('Enter')
    download=pending.value;assert download.suggested_filename.endswith('.log');text=Path(download.path()).read_text()
   assert 'download-complete-marker' in text and 'do-not-export-fixture' not in text and ('abandon '*11+'about') not in text
   assert not errors,errors
   print(json.dumps({'native_mock':native,'diagnostics_without_unlock':'PASS','RU_EN':'PASS','safe_log_export':'PASS','assets':'production' if live else 'local'}))
  finally:c.close()
