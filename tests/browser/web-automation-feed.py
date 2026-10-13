"""Local synthetic Chromium checks: no external RPC or real user vault."""
import json, mimetypes
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright
root = Path(__file__).resolve().parents[2]
origin = 'https://reload-continuity.invalid'
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
    context = browser.new_context(service_workers='block')
    external = []
    def route(r):
        u = urlsplit(r.request.url)
        f = (root / (u.path.lstrip('/') or 'index.html')).resolve()
        if u.netloc == urlsplit(origin).netloc and root in f.parents and f.is_file():
            r.fulfill(path=str(f), content_type=mimetypes.guess_type(str(f))[0] or 'text/plain')
        else:
            external.append(r.request.url)
            if r.request.method == 'POST':
                assert 'broadcast' not in str(r.request.post_data), 'External broadcast blocked'
            r.fulfill(content_type='application/json', body=json.dumps({'result': [], 'data': []}))
    context.route('**/*', route)
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(origin + '/#chain=viz&app=accounts')
    page.wait_for_function('!!window.DposV3 && !!window.DposAutomationFeed')
    page.add_script_tag(url=origin+'/v3/vendor/viz/viz.min.js')
    page.evaluate("""()=>{
      const keys=viz.auth.getPrivateKeys('alice','offline-reload-fixture-only',['regular','active']);
      const users=[{login:'alice', regular:sjcl.encrypt('dpos.space_viz_alice_regularKey',keys.regular)}];
      localStorage.setItem('viz_users',JSON.stringify(users));localStorage.setItem('viz_current_user',JSON.stringify(users[0]));
      const golosUsers=[{login:'alice',posting:sjcl.encrypt('dpos.space_golos_alice_postingKey',keys.regular)}];
      localStorage.setItem('golos_users',JSON.stringify(golosUsers));localStorage.setItem('golos_current_user',JSON.stringify(golosUsers[0]));
    }""")
    page.reload()
    page.wait_for_function('DposVault.status().state==="legacy"')
    page.evaluate("async()=>{await DposVault.migrate({password:'offline-fixture-password-never-real'});}")
    def open_route(chain, app):
        page.evaluate("async ([chain,app])=>{location.hash=`#chain=${chain}&app=${app}`;await DposV3.renderRoute();DposI18n.setLocale('ru');}", [chain, app])
    page.evaluate("""()=>{
      DposAutomationFeed.save('viz-self-award', ['VIZ retained history']);
      DposAutomationFeed.save('upvoter:golos',[{type:'info',message:'Golos retained history', action:{account:'alice',author:'bob',permlink:'post'},result:{privateKey:'NOT-STORED'}}]);
    }""")
    open_route('viz', 'viz-self-award')
    assert 'VIZ retained history' in page.locator('#viz-self-award-feed').inner_text()
    assert page.locator('#viz-self-award-stop').is_disabled()
    page.add_script_tag(url=origin+'/v3/vendor/viz/viz.min.js')
    page.evaluate("""()=>{
      __dposScriptLoads.set('v3/vendor/viz/viz.min.js',Promise.resolve());
      viz.api.getDynamicGlobalPropertiesAsync=async()=>({time:'2026-10-13T00:00:00'});
      viz.api.getAccountsAsync=async names=>names.map(name=>({name,energy:0,last_vote_time:new Date().toISOString()}));
    }""")
    page.locator('[data-viz-self-award-account] [name="enabled"]').check()
    page.locator('#viz-self-award-start').click()
    page.wait_for_function('()=>__dposVizSelfAwardRuntime.running && !__dposVizSelfAwardRuntime.tickPromise')
    page.locator('#viz-self-award-stop').click()
    assert not page.evaluate('__dposVizSelfAwardRuntime.running')
    assert 'VIZ retained history' in page.locator('#viz-self-award-feed').inner_text()
    page.reload()
    page.wait_for_function('DposVault.status().state==="unlocked"')
    assert page.evaluate("DposAutomationFeed.read('viz-self-award').includes('VIZ retained history')")
    page.evaluate("async()=>{await DposVault.unlock({password:'offline-fixture-password-never-real'});await DposV3.renderRoute();}")
    assert 'VIZ retained history' in page.locator('#viz-self-award-feed').inner_text()
    assert page.locator('#viz-self-award-stop').is_disabled()
    open_route('golos', 'auto-upvoter')
    assert 'Golos retained history' in page.locator('#auto-upvoter-feed').inner_text()
    assert page.locator('[data-auto-upvoter-unvote]').count() == 0
    assert page.locator('[data-auto-upvoter-vote]').count() == 0
    other = context.new_page()
    other.goto(origin+'/#chain=viz&app=viz-self-award')
    other.wait_for_function('!!window.DposVault')
    assert other.evaluate('DposVault.status().state') == 'unlocked'
    assert other.evaluate("DposAutomationFeed.read('viz-self-award').includes('VIZ retained history')")
    other.close()
    page.evaluate('DposVault.lock()')
    assert page.evaluate("DposAutomationFeed.read('upvoter:golos')[0].message") == 'Golos retained history'
    page.evaluate("async()=>{await DposVault.unlock({password:'offline-fixture-password-never-real'});}")
    open_route('viz','viz-self-award')
    # Real storage prototype failure, not mocked feed helper.
    page.evaluate("""()=>{window.originalSet=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key.startsWith('dpos_web_automation_feed_'))throw Error('quota fixture');return originalSet.call(this,key,value);};}""")
    page.evaluate("__dposVizSelfAwardRuntime.feed.push('quota checkpoint')")
    open_route('viz','viz-self-award')
    assert 'Не удалось сохранить' in page.locator('#viz-self-award-feed').inner_text()
    assert page.locator('#viz-self-award-start').is_disabled()
    assert not page.evaluate('__dposVizSelfAwardRuntime.running')
    page.evaluate("()=>{Storage.prototype.setItem=originalSet;}")
    # Corrupt history remains untouched, blocks Start, never imports consent.
    page.evaluate("localStorage.setItem(DposAutomationFeed.storageKey('viz-self-award'),'{broken')")
    page.reload()
    page.wait_for_function('DposVault.status().state==="unlocked"')
    page.evaluate("async()=>{await DposVault.unlock({password:'offline-fixture-password-never-real'});await DposV3.renderRoute();}")
    assert 'повреждена' in page.locator('#viz-self-award-feed').inner_text()
    assert page.locator('#viz-self-award-start').is_disabled()
    assert page.evaluate("localStorage.getItem(DposAutomationFeed.storageKey('viz-self-award'))") == '{broken'
    assert errors == [], errors
    print(json.dumps({'checks':['VIZ feed same-tab reload/manual unlock','Golos display-only restored feed','new tab shares browser-session unlock','Lock preserves nonsecret history','quota prevents Start','corrupt history not overwritten'], 'pageErrors':errors, 'mainnetBroadcasts':0, 'externalRequestsFulfilledLocally':len(external)}))
    context.close()
    browser.close()
