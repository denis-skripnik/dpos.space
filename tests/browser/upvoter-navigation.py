import json,os,secrets,mimetypes
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[2];origin='https://dpos.blinddev.xyz'
with sync_playwright() as p:
 b=p.chromium.connect_over_cdp('http://127.0.0.1:18800');c=b.new_context(service_workers='block');errors=[]
 c.add_init_script("""window.qaCalls=[];window.DposAndroidTransport={postMessage(raw){const r=JSON.parse(raw);qaCalls.push(r.method);if(r.method!=='getWorkerStatus')throw new Error('Unexpected native side effect: '+r.method);queueMicrotask(()=>this.onmessage({data:JSON.stringify({version:2,id:r.id,ok:true,result:{ok:true,workerEnabled:false,running:false,activeAccounts:0}})}));}};""")
 def route(r):
  u=urlsplit(r.request.url);f=(root/(u.path.lstrip('/') or 'index.html')).resolve()
  if u.netloc==urlsplit(origin).netloc and root in f.parents and f.is_file():
   if os.environ.get('LIVE')=='1':r.continue_()
   else:r.fulfill(path=str(f),content_type=mimetypes.guess_type(str(f))[0] or 'text/plain')
  else:r.fulfill(status=200,content_type='application/json',body='{"data":[],"result":[]}')
 c.route('**/*',route)
 try:
  page=c.new_page();page.on('pageerror',lambda e:errors.append(str(e)));page.goto(origin+'/#chain=viz&app=help')
  page.evaluate('async password=>{await DposVault.setup({password});await DposV3.renderRoute()}',secrets.token_urlsafe(24))
  for chain in ['golos','steem','hive']:
   page.evaluate("async chain=>{await DposAuth.saveUser(DposChains[chain],{login:'qa-account',posting:sjcl.encrypt('dpos.space_'+chain+'_qa-account_postingKey','non-signing-qa-fixture')})}",chain)
   result=page.evaluate("""async chain=>{location.hash='#chain='+chain+'&app=auto-upvoter';return await Promise.race([DposV3.renderRoute().then(()=>({complete:true,form:!!document.querySelector('#auto-upvoter-form')})),new Promise(resolve=>setTimeout(()=>resolve({complete:false,form:!!document.querySelector('#auto-upvoter-form'),sjclLoaded:typeof sjcl.encrypt==='function',scriptPresent:!!document.querySelector('script[src="v3/vendor/golos/sjcl.min.js"]')}),3000))])}""",chain)
   assert result.get('complete') and result.get('form'),(chain,result)
   page.locator('#support-copy-diagnostics').wait_for(state='visible',timeout=3000)
   form_state=page.evaluate("""chain=>({donate:!!document.querySelector('#auto-upvoter-form input[name=autoDonate][type=checkbox]'), copy:document.querySelector('#auto-upvoter-form')?.textContent.includes('@denis-skripnik')})""",chain)
   assert form_state['donate']==(chain=='golos'),(chain,form_state)
   assert form_state['copy']==(chain=='golos'),(chain,form_state)
   if chain=='golos':
    page.locator('#auto-upvoter-form input[name=autoDonate]').check()
    assert page.locator('#auto-upvoter-form [data-auto-donate-settings]').is_visible()
    page.locator('#auto-upvoter-form input[name=autoDonate]').uncheck()
    assert not page.locator('#auto-upvoter-form [data-auto-donate-settings]').is_visible()
  assert not errors,errors
  assert set(page.evaluate('qaCalls'))<= {'getWorkerStatus'}
  print(json.dumps({'golos_steem_hive_saved_account_navigation':'PASS','android_diagnostics_visible':'PASS','native_mutations':0,'assets':'production' if os.environ.get('LIVE')=='1' else 'local'}))
 finally:c.close()
