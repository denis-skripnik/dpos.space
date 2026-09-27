import json, mimetypes, secrets
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright

root = Path(__file__).resolve().parents[2]
origin = 'https://dpos.blinddev.xyz'
with sync_playwright() as p:
    browser = p.chromium.connect_over_cdp('http://127.0.0.1:18800')
    context = browser.new_context(service_workers='block')
    errors = []
    context.add_init_script("""window.qaCalls=[];window.DposAndroidTransport={postMessage(raw){const r=JSON.parse(raw);qaCalls.push({method:r.method,payload:r.payload});if(!['getWorkerStatus','migrateGolosDonateSettings'].includes(r.method))throw new Error('Unexpected mutation '+r.method);queueMicrotask(()=>this.onmessage({data:JSON.stringify({version:2,id:r.id,ok:true,result:{ok:true,migrated:r.method==='migrateGolosDonateSettings',workerEnabled:true,running:true,activeAccounts:1}})}));}};""")
    def route(r):
        url = urlsplit(r.request.url)
        file = (root / (url.path.lstrip('/') or 'index.html')).resolve()
        if url.netloc == urlsplit(origin).netloc and root in file.parents and file.is_file():
            r.fulfill(path=str(file), content_type=mimetypes.guess_type(str(file))[0] or 'text/plain')
        else:
            r.fulfill(status=200, content_type='application/json', body='{"data":[],"result":[]}')
    context.route('**/*', route)
    try:
        page = context.new_page()
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(origin + '/#chain=viz&app=help')
        password = secrets.token_urlsafe(24)  # disposable local fixture, never an account credential
        page.evaluate('async password=>{await DposVault.setup({password});await DposV3.renderRoute()}', password)
        page.evaluate("""async()=>{
            await DposAuth.saveUser(DposChains.golos,{login:'qa-alice',posting:sjcl.encrypt('dpos.space_golos_qa-alice_postingKey','non-signing-fixture')});
            localStorage.setItem('dpos_golos_auto_upvoter_settings',JSON.stringify({schemaVersion:2,minEnergyUnit:'percent',accounts:{'qa-alice':{enabled:true,autoDonate:true,autoDonateCap:'10 1.1'},'qa-orphan':{enabled:true,autoDonate:true,autoDonateCap:'90 2'}}}));
        }""")
        page.reload()
        page.evaluate('async password=>{await DposVault.unlock({password});await DposV3.renderRoute()}', password)
        page.wait_for_function("() => qaCalls.some(x=>x.method==='migrateGolosDonateSettings')")
        calls = page.evaluate("qaCalls.filter(x=>x.method==='migrateGolosDonateSettings')")
        assert calls == [{'method':'migrateGolosDonateSettings','payload':{'account':'qa-alice','pool':'10 1.1'}}], calls
        assert not errors, errors
        print(json.dumps({'browser_startup_migration':'PASS','eligible_calls':len(calls),'real_broadcasts':0}))
    finally:
        context.close()
