import json, os, secrets, mimetypes
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[2]; origin='https://dpos.blinddev.xyz'; live=os.getenv('LIVE')=='1'
with sync_playwright() as p:
    browser=p.chromium.connect_over_cdp('http://127.0.0.1:18800')
    context=browser.new_context(service_workers='block'); errors=[]
    context.add_init_script("""window.qaCalls=[];window.DposAndroidTransport={postMessage(raw){const r=JSON.parse(raw);qaCalls.push(r);if(!['getWorkerStatus','getAppInfo','importWorkerSettings','startWorker','checkNow'].includes(r.method))throw Error('Unexpected native mutation');queueMicrotask(()=>this.onmessage({data:JSON.stringify({version:2,id:r.id,ok:true,result:{ok:true,status:'checked',accountsChecked:0,activeAccounts:0}})}));}};""")
    def route(r):
        u=urlsplit(r.request.url); f=(root/(u.path.lstrip('/') or 'index.html')).resolve()
        if u.netloc==urlsplit(origin).netloc and root in f.parents and f.is_file():
            if live: r.continue_()
            else: r.fulfill(path=str(f),content_type=mimetypes.guess_type(str(f))[0] or 'text/plain')
        else: r.fulfill(status=200,content_type='application/json',body='{"data":[],"result":[]}')
    context.route('**/*',route)
    def flush(): page.evaluate('()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))')
    def mutations(): return page.evaluate("()=>qaCalls.filter(x=>!['getWorkerStatus','getAppInfo'].includes(x.method))")
    try:
        page=context.new_page(); page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto(origin+'/#chain=viz&app=help')
        page.evaluate('async password=>{await DposVault.setup({password});await DposV3.renderRoute()}',secrets.token_urlsafe(24))
        page.evaluate("async()=>{await DposAuth.saveUser(DposChains.golos,{login:'qa-account',posting:sjcl.encrypt('dpos.space_golos_qa-account_postingKey','non-signing-qa-fixture')});location.hash='#chain=golos&app=notifications&account=qa-account';}")
        page.locator('#notifications-settings-form').wait_for(); flush()
        checkbox=page.locator('#notifications-settings-form [name="androidNative"]')
        assert not checkbox.is_checked() and mutations()==[]
        checkbox.check(); page.locator('#notifications-settings-form button[type="submit"]').click()
        page.wait_for_function("qaCalls.some(x=>x.method==='checkNow')"); flush()
        assert [x['method'] for x in mutations()]==['importWorkerSettings','startWorker','checkNow'],mutations()
        page.evaluate("qaCalls=[];location.hash='#chain=golos&app=help'")
        page.locator('#notifications-settings-form').wait_for(state='detached')
        page.evaluate("location.hash='#chain=golos&app=notifications&account=qa-account'")
        page.locator('#notifications-settings-form').wait_for()
        page.wait_for_function("qaCalls.some(x=>x.method==='startWorker')"); flush()
        assert checkbox.is_checked()
        assert [x['method'] for x in mutations()]==['importWorkerSettings','startWorker'],mutations()
        page.evaluate('qaCalls=[]'); checkbox.uncheck()
        page.locator('#notifications-settings-form button[type="submit"]').click()
        page.wait_for_function("qaCalls.some(x=>x.method==='importWorkerSettings')"); flush()
        calls=mutations(); assert len(calls)==1,calls
        payload=calls[0]['payload']; assert payload['enableNotifications'] is False
        assert 'enableAutoUpvoter' not in payload and 'enableVizSelfAward' not in payload
        assert not errors,errors
        print(json.dumps({'notification_DOM_save_reopen_disable':'PASS','fresh_visit_mutations':0,'double_sync':False,'native':'mock only','assets':'production' if live else 'local'}))
    finally: context.close()
