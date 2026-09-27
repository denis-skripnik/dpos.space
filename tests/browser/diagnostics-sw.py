"""Read-only production SW/diagnostic offline QA in an isolated browser context."""
from playwright.sync_api import sync_playwright
import json
origin = 'https://dpos.blinddev.xyz'
with sync_playwright() as p:
    browser = p.chromium.connect_over_cdp('http://127.0.0.1:18800')
    context = browser.new_context(accept_downloads=True)
    errors = []
    try:
        page = context.new_page()
        page.set_default_timeout(30000)
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.goto(origin + '/dpos-sw-qa-bootstrap-missing.html')
        page.evaluate("async()=>{const c=await caches.open('dpos-space-v3-upgrade-fixture');await c.put('/api/qa-stale',new Response('{}'));}")
        page.goto(origin + '/#app=diagnostics')
        page.locator('[data-diag-download]').wait_for()
        page.evaluate("async()=>{await Promise.race([navigator.serviceWorker.ready,new Promise((_,reject)=>setTimeout(()=>reject(new Error('SW readiness timeout')),25000))]);if(!navigator.serviceWorker.controller)await new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true}));}")
        keys = page.evaluate('()=>caches.keys()')
        assert 'dpos-space-v3-upgrade-fixture' not in keys, keys
        shells = [k for k in keys if k.startswith('dpos-space-v3-')]
        assert len(shells) == 1, keys
        cached = page.evaluate("async name=>{const c=await caches.open(name);return(await c.keys()).map(r=>new URL(r.url).pathname)}", shells[0])
        assert '/v3/js/diagnostics.js' in cached and '/v3/js/diagnostics-ui.js' in cached
        assert not any(x.startswith('/api/') for x in cached)
        context.set_offline(True)
        page.reload()
        page.locator('[data-diag-download]').wait_for()
        with page.expect_download() as pending:
            page.locator('[data-diag-download]').press('Enter')
        assert pending.value.suggested_filename.endswith('.log')
        assert not errors, errors
        print(json.dumps({'production_service_worker': 'active', 'old_cache_removed': True, 'offline_diagnostics_and_download': 'PASS', 'page_errors': errors}))
    finally:
        context.set_offline(False)
        context.close()
