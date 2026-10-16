"""Real production assets + SDK, synthetic local RPC only, fresh Chromium storage.
Diagnostic exports are checked in memory; secrets/capabilities are never printed.
"""
import ast
import json
import mimetypes
import subprocess
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright

root = Path(__file__).resolve().parents[2]
tree = ast.parse((root / 'tests/browser/web-reload-continuity.py').read_text())
INIT = next(ast.literal_eval(n.value) for n in tree.body if isinstance(n, ast.Assign)
            and any(isinstance(t, ast.Name) and t.id == 'INIT' for t in n.targets))
retry = ast.parse((root / 'tests/browser/viz-start-retry.py').read_text())
INIT += next(ast.literal_eval(n.value) for n in retry.body if isinstance(n, ast.AugAssign)
             and isinstance(n.target, ast.Name) and n.target.id == 'INIT')
origin = 'https://viz-diagnostics-fixture.invalid'
BUILD = '20261016-viz-safe-diagnostics'
checks = []
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
    context = browser.new_context(service_workers='block')
    errors, external = [], []
    old_assets = {}
    def route(r):
        u = urlsplit(r.request.url)
        f = (root / (u.path.lstrip('/') or 'index.html')).resolve()
        if u.netloc == urlsplit(origin).netloc and root in f.parents and f.is_file():
            if u.path in old_assets:
                r.fulfill(body=old_assets[u.path], content_type='application/javascript')
            else:
                r.fulfill(path=str(f), content_type=mimetypes.guess_type(str(f))[0] or 'text/plain')
        else:
            external.append(r.request.url)
            r.abort()
    context.route('**/*', route)
    context.add_init_script(INIT)
    page = context.new_page()
    page.on('pageerror', lambda e: errors.append(str(e)))
    def wait(expr):
        page.wait_for_function('() => (' + expr + ')')
    def snap():
        return page.evaluate('DposDiagnostics.runtimeSnapshot()')
    def report():
        return page.evaluate('DposDiagnostics.exportText()')
    def sends():
        return page.evaluate('Number(localStorage.fixtureSends||0)')
    def ready():
        wait('window.__dposVizSelfAwardRuntime?.running && !!__dposVizSelfAwardRuntime.interval && !__dposVizSelfAwardRuntime.tickPromise')
    def unlock():
        page.evaluate("async()=>{await DposVault.unlock({password:'fixture-only-browser-password'});dispatchEvent(new CustomEvent('dpos-vault-ready'));}")
        wait('!!document.querySelector("#viz-self-award-start")')
    def start():
        page.locator('[name="enabled"]').check()
        page.locator('#viz-self-award-start').click()
        ready()
    def due():
        page.evaluate("()=>{const k=DposAutomationContinuity.storageKey('viz-self-award');const r=JSON.parse(localStorage.getItem(k));r.nextAt=Date.now()-1;localStorage.setItem(k,JSON.stringify(r));}")
    page.goto(origin + '/#chain=viz&app=accounts')
    wait('!!window.DposV3')
    page.evaluate("""async()=>{
      await DposVault.setup({password:'fixture-only-browser-password'});
      await DposAuth.saveUser({id:'viz'},DposAuth.createKeyUser({id:'viz'},'alice',{regular:fixtureWif}));
      DposNotifications.saveSettings(DposChains.viz,'alice',{ops:[],androidNative:false,intervalMinutes:15});
      location.hash='#chain=viz&app=viz-self-award';await DposV3.renderRoute();
      localStorage.syntheticPrivatePayload='CANARY_DIAGNOSTIC_PRIVATE_STORAGE';
    }""")
    wait('!!document.querySelector("#viz-self-award-start")')
    assert snap()['savedRun']['reason']=='missing_consent'
    start()
    assert sends()==1
    deadline=snap()['savedRun']['nextAt']
    page.reload();ready()
    s=snap()
    assert s['savedRun']['reason']=='eligible' and s['savedRun']['nextAt']==deadline
    assert s['appBuild']=='20261016-viz-manual-unlock' and s['profilesBuild']==BUILD and s['diagnosticsBuild']==BUILD
    assert s['vizRuntime']['resumeOutcome']=='automatic_resume_scheduled'
    assert s['executionMode']=='browser_no_native_bridge (physical APK unknown)'
    assert any(h['reason']=='auto_resume_succeeded' for h in s['vault']['history'])
    before=page.evaluate('DposDiagnostics.summary()')
    page.wait_for_timeout(2600)
    after=page.evaluate('DposDiagnostics.summary()')
    assert before['entries']==after['entries'], (before,after)
    checks.append('cookie-present reload preserves consent/deadline; no per-second journal spam')

    page.evaluate("localStorage.fixtureEnergy='100'")
    completed=snap()['vizRuntime']['lastCheckCompleted']
    due()
    wait(f'__dposVizSelfAwardRuntime.diagnosticCheckCompleted>{completed} && !__dposVizSelfAwardRuntime.tickPromise')
    assert snap()['vizRuntime']['blockedReason']=='low_energy' and sends()==1
    assert snap()['vizRuntime']['cycle']=='waiting_for_deadline'
    page.evaluate('delete localStorage.fixtureEnergy')
    checks.append('low-energy skip exported as enum with completed check and next deadline; no send')

    # Cookie loss happens BEFORE vault.initialize, not only after an unlocked runtime.
    context.clear_cookies();page.reload()
    wait('window.DposVault && DposVault.status().state==="locked" && !!window.DposDiagnostics')
    s=snap();assert s['savedRun']['reason']=='vault_locked' and s['savedRun']['savedStart']
    assert any(h['reason']=='capability_missing' for h in s['vault']['history'])
    assert 'capability_missing' in report() and sends()==1
    unlock()
    s=snap()
    ready();s=snap()
    assert s['savedRun']['reason']=='eligible' and s['savedRun']['savedStart']
    assert s['vizRuntime'].get('running',False) and sends()==1
    assert 'manual_unlock_requested' in report() and 'manual_unlock_succeeded' in report()
    # A read-only export must not call issueGuard/assertGuard, cancel or consume old evidence.
    state_before=page.evaluate("""JSON.stringify([localStorage.dpos_vault_session_resume_v1,localStorage.getItem(DposAutomationContinuity.storageKey('viz-self-award')+'_control'),DposVault.status().state])""")
    text=report()
    state_after=page.evaluate("""JSON.stringify([localStorage.dpos_vault_session_resume_v1,localStorage.getItem(DposAutomationContinuity.storageKey('viz-self-award')+'_control'),DposVault.status().state])""")
    assert state_before==state_after and 'viz_rebind_succeeded' in text
    canaries=page.evaluate("()=>[fixtureWif,'fixture-only-browser-password',localStorage.syntheticPrivatePayload,...document.cookie.split(';').map(x=>x.trim().split('=').slice(1).join('=')),...Object.values(JSON.parse(localStorage.dpos_vault_session_resume_v1)).filter(x=>typeof x==='string' && x.length>16)]")
    assert all(not c or c not in text for c in canaries), 'Secret canary appeared in export'
    checks.append('authenticated cookie-loss manual unlock resumes without deadline reset; export read-only and secret-free')

    assert sends()==1  # unchanged durable deadline/confirmed intent
    due();page.evaluate("localStorage.fixtureFailure='accounts'");page.reload()
    wait('window.fixtureReadFailures>0 && !!window.__dposVizSelfAwardRuntime?.interval && !__dposVizSelfAwardRuntime.tickPromise')
    s=snap()
    assert s['savedRun']['savedStart'] and s['vizRuntime']['running']
    assert s['vizRuntime']['blockedReason']=='rpc_read_failed_retry_scheduled'
    assert s['vizRuntime']['lastCheckStarted']>0 and s['vizRuntime']['lastCheckCompleted']>=s['vizRuntime']['lastCheckStarted']
    assert sends()==1 and 'rpc_read_failed_retry_scheduled' in report()
    page.evaluate('delete localStorage.fixtureFailure')
    checks.append('restored network failure distinguishable from locked/missing consent, cadence retained')

    # Capability preserved but actual restored execution cannot acquire Web Locks.
    context.add_init_script("if(localStorage.fixtureNoLocks==='yes') Object.defineProperty(navigator,'locks',{configurable:true,value:undefined});")
    page.evaluate("localStorage.fixtureNoLocks='yes'");due();page.reload()
    wait('window.__dposVizSelfAwardRuntime?.startupError && !__dposVizSelfAwardRuntime.running')
    s=snap();text=report()
    assert s['vault']['state']=='unlocked' and s['vault']['capabilityPresent']
    assert s['vizRuntime']['blockedReason']=='web_locks_unavailable'
    assert 'viz.start_failed_before_invalidation' in text and '"savedStart":true' in text and sends()==1
    checks.append('preserved capability + runtime resume failure retains pre-invalidation Start evidence')
    page.evaluate('delete localStorage.fixtureNoLocks');page.reload()
    wait('!!document.querySelector("#viz-self-award-start")')
    assert snap()['savedRun']['reason']=='missing_consent'
    start()
    page.locator('#viz-self-award-stop').click();wait('!__dposVizSelfAwardRuntime.running')
    assert snap()['savedRun']['reason']=='missing_consent' and 'viz.stop_before_invalidation' in report()
    start()
    page.evaluate('DposVault.lock()')
    assert 'lock_invoked_before_revocation' in report()
    assert snap()['vault']['state']=='locked'
    unlock();assert not snap()['vizRuntime']['running'] and sends()==1
    checks.append('Stop/Lock remain revocations; unlock never revives revoked Start')

    # Successful vault capability resume does not imply storage/runtime admission.
    start()
    context.add_init_script("""if(localStorage.fixtureNodeWriteFault==='yes') {
      const set=Storage.prototype.setItem;
      Storage.prototype.setItem=function(k,v){if(k==='viz_node')throw Error('secret=CANARY_PRIVATE_STORAGE_EXCEPTION');return set.call(this,k,v);};
    }""")
    page.evaluate("localStorage.fixtureNodeWriteFault='yes'");due();page.reload()
    wait('window.__dposVizSelfAwardRuntime?.startupError && !__dposVizSelfAwardRuntime.running')
    s=snap()
    assert s['vault']['state']=='unlocked' and s['vizRuntime']['blockedReason']=='storage_unavailable'
    assert 'CANARY_PRIVATE_STORAGE_EXCEPTION' not in report()
    assert 'viz.start_failed_before_invalidation' in report() and sends()==1
    page.evaluate('delete localStorage.fixtureNodeWriteFault');page.reload()
    wait('!!document.querySelector("#viz-self-award-start")')
    checks.append('preserved capability + node storage write failure distinguishes storage from network')

    # Exact refusal categories, not a generic locked message; only synthetic metadata is changed.
    for field,value,reason in [('binding','synthetic-mismatch','envelope_binding_mismatch'),
                               ('revocation','synthetic-revoked','revocation_mismatch'),
                               ('revision',999999,'envelope_revision_mismatch'),
                               ('ciphertext','AAAA','decrypt_failed')]:
        start()
        page.evaluate("""([field,value])=>{const k='dpos_vault_session_resume_v1';const r=JSON.parse(localStorage.getItem(k));r[field]=value;localStorage.setItem(k,JSON.stringify(r));}""",[field,value])
        page.reload();wait('DposVault?.status().state==="locked" && !!window.DposDiagnostics')
        assert any(h['reason']==reason for h in snap()['vault']['history']),reason
        assert reason in report() and sends()==1
        unlock();assert not snap()['vizRuntime'].get('running',False)
    checks.append('envelope binding/revision, revocation and decrypt refusal categories; zero resumed sends')

    # Actual old production bytes under a NEW requested URL must not masquerade as a new build.
    for name in ['profiles', 'app']:
        old_assets['/v3/js/'+name+'.js']=subprocess.check_output(['git','show','HEAD^:v3/js/'+name+'.js'],cwd=root).decode()
    page.reload();wait('!!window.DposV3 && !!document.querySelector("#viz-self-award-start")')
    s=snap()
    assert s['profilesBuild'].startswith('unknown') and s['appBuild'].startswith('unknown')
    assert any(BUILD in x for x in s['pageRequestedAssets'])
    assert s['appLoadedSource']=='unknown' and s['profilesLoadedSource']=='unknown'
    assert s['diagnosticsBuild']==BUILD
    checks.append('mixed old app/profiles + new page URLs: execution identity unknown, not latest-label guess')
    assert errors==[] and external==[], (errors,external)
    print(json.dumps({'checks':checks,'pageErrors':errors,'externalRequests':external,'mainnetBroadcasts':0},ensure_ascii=False))
    context.close();browser.close()
