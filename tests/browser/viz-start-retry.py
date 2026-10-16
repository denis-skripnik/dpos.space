"""Production index.html/app.js, real SDK signing; isolated Chromium + local fake RPC.
No outgoing network, no real user storage. Optional --status-only isolates current-status RED.
Reuses the literal SDK RPC fixture without executing its test driver.
"""
import ast
import json
import mimetypes
import sys
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright

root = Path(__file__).resolve().parents[2]
fixture_tree = ast.parse((root / 'tests/browser/web-reload-continuity.py').read_text())
INIT = next(ast.literal_eval(node.value) for node in fixture_tree.body
            if isinstance(node, ast.Assign) and any(isinstance(t, ast.Name) and t.id == 'INIT' for t in node.targets))
INIT += r"""
(() => {
 const descriptor=Object.getOwnPropertyDescriptor(window,'viz');
 Object.defineProperty(window,'viz',{configurable:true,get:descriptor.get,set:sdk=>{
  descriptor.set(sdk);if(!sdk?.api)return;
  const accounts=sdk.api.getAccountsAsync,dgp=sdk.api.getDynamicGlobalPropertiesAsync;
  sdk.api.getAccountsAsync=async names=>{
   if(localStorage.fixtureFailure==='accounts') {window.fixtureReadFailures=(window.fixtureReadFailures||0)+1;throw Error('fixture disconnected accounts');}
   const rows=await accounts(names);
   if(localStorage.fixtureEnergy)rows.forEach(r=>{r.energy=Number(localStorage.fixtureEnergy);});
   return rows;
  };
  sdk.api.getDynamicGlobalPropertiesAsync=async()=>{
   if(localStorage.fixtureFailure==='connect') {window.fixtureReadFailures=(window.fixtureReadFailures||0)+1;throw Error('fixture disconnected connect');}
   return dgp();
  };
 }});
})();
"""
origin = 'https://viz-retry-fixture.invalid'
checks = []
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
    context = browser.new_context(service_workers='block')
    blocked = []
    def route(r):
        u = urlsplit(r.request.url)
        file = (root / (u.path.lstrip('/') or 'index.html')).resolve()
        if u.netloc == urlsplit(origin).netloc and root in file.parents and file.is_file():
            r.fulfill(path=str(file), content_type=mimetypes.guess_type(str(file))[0] or 'text/plain')
        else:
            blocked.append(r.request.url)
            r.fulfill(content_type='application/json', body=json.dumps({'result': [], 'data': []}))
    context.route('**/*', route)
    context.add_init_script(INIT)
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    def wait(expression):
        page.wait_for_function('() => (' + expression + ')')
    def sends():
        return page.evaluate('Number(localStorage.fixtureSends||0)')
    def state():
        return page.evaluate("""() => ({running:__dposVizSelfAwardRuntime.running,
          interval:!!__dposVizSelfAwardRuntime.interval,consent:DposAutomationContinuity.readRun('viz-self-award').running,
          epoch:DposAutomationContinuity.readRun('viz-self-award').epoch,nextAt:DposAutomationContinuity.readRun('viz-self-award').nextAt,
          sends:Number(localStorage.fixtureSends||0),feed:document.querySelector('#viz-self-award-feed')?.innerText})""")
    def due():
        page.evaluate("""()=>{const k=DposAutomationContinuity.storageKey('viz-self-award');const run=JSON.parse(localStorage.getItem(k));run.nextAt=Date.now()-1;localStorage.setItem(k,JSON.stringify(run));}""")
    def open_app():
        page.evaluate("async()=>{location.hash='#chain=viz&app=viz-self-award';await DposV3.renderRoute();DposI18n.setLocale('ru');}")
    def start():
        page.locator('[name="enabled"]').check()
        page.locator('#viz-self-award-start').click()
    def stop():
        page.locator('#viz-self-award-stop').click()
        wait('!__dposVizSelfAwardRuntime.running')
    def fresh_intent():
        # Test-only reset of confirmed fixture, NEVER a runtime recovery path.
        page.evaluate("""()=>{const k=DposAutomationContinuity.storageKey('viz-self-award');const run=JSON.parse(localStorage.getItem(k));run.intents={};run.nextAt=0;localStorage.setItem(k,JSON.stringify(run));}""")
    page.goto(origin + '/#chain=viz&app=accounts')
    wait('!!window.DposV3')
    page.evaluate("""async()=>{
      await DposVault.setup({password:'fixture-only-browser-password'});
      await DposAuth.saveUser({id:'viz'},DposAuth.createKeyUser({id:'viz'},'alice',{regular:fixtureWif}));
      await DposV3.renderRoute();
      DposNotifications.saveSettings(DposChains.viz,'alice',{ops:[],androidNative:false,intervalMinutes:15});
    }""")
    open_app()
    if '--unknown-only' in sys.argv:
        page.evaluate("localStorage.fixtureMode='unknown'")
        start();wait('Number(localStorage.fixtureSends)===1 && !__dposVizSelfAwardRuntime.tickPromise')
        assert page.evaluate("DposAutomationContinuity.pending('viz-self-award','alice').state")=='pending'
        due();page.wait_for_timeout(1500)
        assert sends()==1
        page.reload();wait('window.__dposVizSelfAwardRuntime?.running && !!__dposVizSelfAwardRuntime.interval')
        due();page.wait_for_timeout(1500)
        result=state()
        assert sends()==1 and 'pending/confirmed' in result['feed'],result
        assert errors==[] and blocked==[],(errors,blocked)
        print(json.dumps({'unknownNoReplay':result,'pageErrors':errors,'externalRequests':blocked},ensure_ascii=False),flush=True)
        context.close();browser.close();sys.exit(0)
    if '--safety-case' in sys.argv:
        case = sys.argv[sys.argv.index('--safety-case') + 1]
        before=0
        if case in ['restored-locks','restored-node-storage','interval-locks']:
            start();wait("DposAutomationContinuity.pending('viz-self-award','alice')?.state==='confirmed'")
            before=sends()
            if case.startswith('restored-'):
                if case=='restored-locks':
                    context.add_init_script("window.fixtureLocks=navigator.locks;Object.defineProperty(navigator,'locks',{configurable:true,value:undefined})")
                else:
                    context.add_init_script("""const set=Storage.prototype.setItem;window.fixtureSetItem=set;
                      Storage.prototype.setItem=function(k,v){
                        if(k==='viz_node'){window.fixtureStorageFaults=(window.fixtureStorageFaults||0)+1;throw Error('fixture write denied');}
                        return set.call(this,k,v);
                      };""")
                due();page.reload();wait('!!window.__dposVizSelfAwardRuntime')
            else:
                page.evaluate("Object.defineProperty(navigator,'locks',{configurable:true,value:undefined})")
                due()
        elif case == 'missing-locks':
            page.evaluate("Object.defineProperty(navigator,'locks',{configurable:true,value:undefined})")
        elif case.endswith('-storage'):
            page.evaluate(r"""caseName=>{
              const set=Storage.prototype.setItem;
              const key=DposAutomationContinuity.storageKey('viz-self-award');
              Storage.prototype.setItem=function(k,v){
                const fail=(caseName==='start-storage' && k===key+'_control') ||
                  (caseName==='schedule-storage' && k===key) ||
                  (caseName==='node-storage' && k==='viz_node') ||
                  (caseName==='proof-storage' && k===key && JSON.parse(v).intents?.alice?.state==='confirmed');
                if(fail){window.fixtureStorageFaults=(window.fixtureStorageFaults||0)+1;throw Error('fixture write denied');}
                return set.call(this,k,v);
              };
            }""", case)
        else:
            raise AssertionError('Unknown safety case: '+case)
        if not before:
            start()
        wait('!__dposVizSelfAwardRuntime.tickPromise')
        page.wait_for_timeout(2300)
        result=page.evaluate("""()=>({running:__dposVizSelfAwardRuntime.running,
          interval:!!__dposVizSelfAwardRuntime.interval,vault:DposVault.status().state,
          control:JSON.parse(localStorage.getItem(DposAutomationContinuity.storageKey('viz-self-award')+'_control')||'null'),
          faults:window.fixtureStorageFaults||0,sends:Number(localStorage.fixtureSends||0),
          feed:document.querySelector('#viz-self-award-feed')?.innerText})""")
        print(json.dumps({'safetyCase':case,'state':result,'pageErrors':errors,'externalRequests':blocked},ensure_ascii=False),flush=True)
        assert not result['running'] and not result['interval'],result
        assert result['sends']==(1 if case=='proof-storage' else before),result
        assert not result['feed'] or 'Работает в этой вкладке.' not in result['feed'],result
        if case.endswith('locks'):
            assert not result['control']['running'],result
        else:
            assert result['faults']>0,result
            if case in ['node-storage','restored-node-storage']:
                assert not result['control']['running'],result
            else:
                assert result['vault']=='locked',result
        if case.endswith('locks') or case in ['node-storage','restored-node-storage']:
            reason = 'Web Locks required' if case.endswith('locks') else 'fixture write denied'
            # Inspect after startup's final render, then after an explicit full rerender.
            assert reason in result['feed'],result
            page.evaluate("async()=>{await DposV3.renderRoute();DposI18n.setLocale('ru');}")
            assert reason in state()['feed'],state()
            assert reason in page.locator('#status').inner_text()
            assert page.locator('#status').get_attribute('data-state')=='error'
            # Stop/rerender cannot restart or erase the current fatal reason.
            page.evaluate("document.querySelector('#viz-self-award-stop').dispatchEvent(new Event('click'))")
            page.evaluate("async()=>{await DposV3.renderRoute();DposI18n.setLocale('ru');}")
            assert not state()['running'] and not state()['interval'] and sends()==before
            assert reason in state()['feed'],state()
        if case.startswith('restored-'):
            restore = ("() => {Object.defineProperty(navigator,'locks',{configurable:true,value:fixtureLocks});}"
                       if case=='restored-locks' else "() => {Storage.prototype.setItem=fixtureSetItem;}")
            page.evaluate(restore)
            if case=='restored-locks':
                other=context.new_page();other.goto(origin+'/#chain=viz&app=viz-self-award')
                other.wait_for_function("() => !!document.querySelector('#viz-self-award-start')")
                other.evaluate(restore)
                other.locator('#viz-self-award-start').click()
                other.wait_for_function('() => window.__dposVizSelfAwardRuntime?.running && !!__dposVizSelfAwardRuntime.interval')
                wait('!__dposVizSelfAwardRuntime.startupError')
                assert reason not in state()['feed'] and not state()['running'],state()
                assert page.locator('#status').get_attribute('data-state')!='error'
                other.locator('#viz-self-award-stop').click();other.close()
            # Explicit successful new Start clears the old reason, with no replay.
            start();wait('__dposVizSelfAwardRuntime.running && !!__dposVizSelfAwardRuntime.interval')
            page.evaluate("async()=>{await DposV3.renderRoute();DposI18n.setLocale('ru');}")
            assert reason not in state()['feed'] and not page.evaluate('!!__dposVizSelfAwardRuntime.startupError'),state()
            assert sends()==before and page.locator('#status').get_attribute('data-state')!='error'
            stop()
        assert errors==[] and blocked==[],(errors,blocked)
        print(json.dumps({'safetyAssertions':'PASS','case':case},ensure_ascii=False),flush=True)
        context.close();browser.close();sys.exit(0)
    if '--status-only' in sys.argv:
        start();wait("DposAutomationContinuity.pending('viz-self-award','alice')?.state==='confirmed'")
        stop();page.reload();wait('!!window.DposV3 && DposVault.status().state==="unlocked"')
        wait('!!document.querySelector("#viz-self-award-feed")')
        current=state()
        assert 'Остановлено.' in current['feed'], current
        assert not current['running'] and not current['consent']
        print(json.dumps({'status':current,'pageErrors':errors},ensure_ascii=False))
        context.close();browser.close();sys.exit(0)
    # RED: failures outside per-account try used to revoke consent/no interval forever.
    for failure in ['connect', 'accounts']:
        page.evaluate('v=>localStorage.fixtureFailure=v', failure)
        start()
        wait('window.fixtureReadFailures>0 && !__dposVizSelfAwardRuntime.tickPromise')
        page.wait_for_timeout(150)
        failed=state()
        print(json.dumps({'initialFailure':failure,'state':failed},ensure_ascii=False),flush=True)
        assert failed['running'] and failed['interval'] and failed['consent'], failed
        assert sends()==0
        epoch, next_at = failed['epoch'], failed['nextAt']
        assert 'Ошибка проверки' in failed['feed'] and 'повтор' in failed['feed'].lower(),failed
        page.evaluate('delete localStorage.fixtureFailure')
        page.wait_for_timeout(1200)
        assert sends()==0 and state()['nextAt']==next_at  # no early retries/catch-up
        due()
        wait("DposAutomationContinuity.pending('viz-self-award','alice')?.state==='confirmed'")
        assert sends()==1 and state()['epoch']==epoch
        stop();fresh_intent();page.evaluate('delete localStorage.fixtureSends;window.fixtureReadFailures=0')
        checks.append('manual '+failure+' failure retains Start + bounded cadence + reconnect without Start')
    # Restored session with a due network failure must remain scheduled too.
    start();wait("DposAutomationContinuity.pending('viz-self-award','alice')?.state==='confirmed'")
    next_at=state()['nextAt']
    page.reload();wait('window.__dposVizSelfAwardRuntime?.running && !!__dposVizSelfAwardRuntime.interval')
    assert sends()==1 and state()['nextAt']==next_at
    page.evaluate("localStorage.fixtureFailure='accounts'");due();page.reload()
    wait('window.fixtureReadFailures>0 && !!window.__dposVizSelfAwardRuntime?.interval && !__dposVizSelfAwardRuntime.tickPromise')
    assert state()['consent'] and sends()==1
    page.evaluate('delete localStorage.fixtureFailure');due();page.wait_for_timeout(1500)
    assert sends()==1  # confirmed at most once within 432 seconds
    checks.append('connected reload preserves exact cadence; due disconnected reload retries without replay')
    # Browser Web Locks exclusion across tabs; Stop must cancel late read before send.
    stop();fresh_intent();before=sends()
    page.evaluate("localStorage.fixtureHold='accounts'");start()
    wait('!!window.fixtureReleaseAccounts')
    other=context.new_page();other.goto(origin+'/#chain=viz&app=viz-self-award')
    other.wait_for_function('() => window.__dposVizSelfAwardRuntime?.running && !!__dposVizSelfAwardRuntime.interval')
    result=other.evaluate("async()=>DposAutomationContinuity.exclusive('viz-self-award',()=>({unexpected:true}))")
    assert result.get('reason')=='overlap',result
    stop();page.evaluate("()=>{delete localStorage.fixtureHold;fixtureReleaseAccounts();}")
    wait('!__dposVizSelfAwardRuntime.tickPromise')
    assert sends()==before
    other.wait_for_function('!__dposVizSelfAwardRuntime.running')
    checks.append('cross-tab Web Lock retained through RPC await; Stop suppresses delayed signing')
    page.evaluate('delete window.fixtureReleaseAccounts;localStorage.fixtureHold="accounts"');fresh_intent();start()
    wait('!!window.fixtureReleaseAccounts')
    page.evaluate('DposVault.lock()')
    page.evaluate("()=>{delete localStorage.fixtureHold;fixtureReleaseAccounts();}")
    wait('!__dposVizSelfAwardRuntime.tickPromise')
    assert sends()==before
    # Late unlock is not fresh Start; wrapper/session binding changes intentionally.
    page.evaluate("async()=>{await DposVault.unlock({password:'fixture-only-browser-password'});dispatchEvent(new CustomEvent('dpos-vault-ready'));}")
    wait('DposVault.status().state==="unlocked" && !!document.querySelector("#viz-self-award-start")')
    assert not state()['consent'] and not state()['running']
    other.close()
    checks.append('Lock suppresses late send; late manual unlock does not resurrect old Start')
    fresh_intent();start();wait("DposAutomationContinuity.pending('viz-self-award','alice')?.state==='confirmed'")
    before=sends();context.clear_cookies();page.reload();wait('DposVault?.status().state==="locked"')
    page.evaluate("async()=>{await DposVault.unlock({password:'fixture-only-browser-password'});dispatchEvent(new CustomEvent('dpos-vault-ready'));}")
    wait('!!document.querySelector("#viz-self-award-start")')
    assert not state()['running'] and not state()['consent'] and sends()==before
    checks.append('lost session cookie + later unlock requires explicit new Start')
    # No regular key or insufficient energy must never become a send.
    fresh_intent();page.evaluate("localStorage.fixtureEnergy='9000'");start()
    wait('!__dposVizSelfAwardRuntime.tickPromise && !!__dposVizSelfAwardRuntime.interval')
    assert sends()==before and 'SKIP @alice' in state()['feed']
    stop();page.evaluate("delete localStorage.fixtureEnergy")
    page.evaluate("async()=>{await DposVault.mutate(records=>{delete records.viz_users[0].regular;});}")
    open_app();fresh_intent();start();wait('!__dposVizSelfAwardRuntime.tickPromise && !!__dposVizSelfAwardRuntime.interval')
    assert sends()==before and 'ERROR @alice' in state()['feed']
    stop();checks.append('low energy and missing regular key produce zero sends')
    assert errors==[], errors
    print(json.dumps({'checks':checks,'pageErrors':errors,'mainnetBroadcasts':0,'externalRequestsFulfilledLocally':len(blocked)},ensure_ascii=False))
    context.close();browser.close()
