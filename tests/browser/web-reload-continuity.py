"""Isolated real Chromium, synthetic keys + SDK signing, entirely fake RPC.
No outgoing network is permitted; all page files are served from this checkout.
"""
import json, mimetypes
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright
root = Path(__file__).resolve().parents[2]
origin = 'https://continuity-fixture.invalid'
INIT = r"""
(() => {
 const WIF='5HpHagT65TZzG1PH3CSu63k8DbpvD8s5ip4nEB3kEsreAvUcVfH';
 window.fixtureWif=WIF;
 for(const name of ['viz','golos','hive','steem']) {
  let sdk;
  Object.defineProperty(window,name,{configurable:true,get:()=>sdk,set:value=>{
   sdk=value;
   if(!sdk || !sdk.api || sdk.fixturePatched)return;
   sdk.fixturePatched=true;
   const account=n=>({name:n,energy:10000,voting_power:10000,last_vote_time:new Date().toISOString().slice(0,19),regular:{weight_threshold:1,key_auths:[[sdk.auth.wifToPublic(WIF),1]],account_auths:[]},posting:{weight_threshold:1,key_auths:[[sdk.auth.wifToPublic(WIF),1]],account_auths:[]},active:{weight_threshold:1,key_auths:[[sdk.auth.wifToPublic(WIF),1]],account_auths:[]}});
   sdk.api.getAccountsAsync=async names=>{
    window.fixtureAccountsCalls=(window.fixtureAccountsCalls||0)+1;
    if(localStorage.fixtureHold==='accounts') await new Promise(resolve=>{window.fixtureReleaseAccounts=resolve;});
    return names.map(account);
   };
   sdk.api.getDynamicGlobalPropertiesAsync=async()=>({time:new Date().toISOString().slice(0,19),head_block_number:100,head_block_id:'000000640000007b'+'0'.repeat(24),last_irreversible_block_num:localStorage.fixtureMode==='reversible'?98:100});
   sdk.api.getContentAsync=async(a,p)=>({author:a,permlink:p,parent_author:'',active_votes:[],title:'Fixture'});
   sdk.api.getDiscussionsByBlogAsync=async()=>[{author:'bob',permlink:localStorage.fixturePost||'fixture-post',parent_author:'',created:new Date().toISOString().slice(0,19),active_votes:[]}];
   sdk.api.getAccountHistoryAsync=async()=>[];
   sdk.api.getBlockHeaderAsync=async()=>({previous:'000000620000007b'+'0'.repeat(24)});
   sdk.api.getBlockAsync=async()=>({previous:'000000620000007b'+'0'.repeat(24),transaction_ids:[(localStorage.fixtureMode==='wrong-id'?'2':'1').repeat(40)],transactions:[JSON.parse(localStorage.fixtureTransaction||'null')]});
   sdk.api.broadcastTransactionSynchronous=(tx,cb)=>{
    if(!Array.isArray(tx.signatures) || tx.signatures.length!==1 || !/^[a-f0-9]{130}$/i.test(tx.signatures[0])) throw new Error('actual SDK signature required');
    if(!Number.isInteger(tx.ref_block_num) || !Number.isInteger(tx.ref_block_prefix) || !tx.expiration) throw new Error('actual SDK TAPOS required');
    localStorage.fixtureSends=String(Number(localStorage.fixtureSends||0)+1);
    localStorage.fixtureLastOperation=JSON.stringify(tx.operations);
    const unsigned={...tx};delete unsigned.signatures;localStorage.fixtureTransaction=JSON.stringify(unsigned);
    if(localStorage.fixtureMode==='hang')return;
    const receipt=localStorage.fixtureMode==='unknown'?{}:{id:'1'.repeat(40),block_num:99,trx_num:0,expired:false};
    setTimeout(()=>cb(null,receipt),50);
   };
  }});
 }
})();
"""
# Current Golos endpoint/schema fixture; original multi-chain fixture above remains
# separately usable by the frozen pre-correction RED harness.
INIT += r"""
(() => {
 const descriptor=Object.getOwnPropertyDescriptor(window,'golos');
 Object.defineProperty(window,'golos',{configurable:true,get:descriptor.get,set:sdk=>{
  descriptor.set(sdk); if(!sdk || !sdk.api)return;
  const content=sdk.api.getContentAsync,block=sdk.api.getBlockAsync,send=sdk.api.broadcastTransactionSynchronous;
  sdk.api.getContentAsync=async(a,p)=>({...await content(a,p),allow_votes:true,last_payout:'1970-01-01T00:00:00',cashout_time:'2099-01-01T00:00:00',created:'2026-01-01T00:00:00',last_update:'2026-01-01T00:00:00',num_changes:0});
  sdk.api.getAccountHistoryAsync=async(a,from,limit)=>{
   if(a!=='bob')return [];
   const posts=JSON.parse(localStorage.fixtureHistoryPosts||'[]'),post=localStorage.fixturePost||'fixture-post';
   if(!posts.includes(post)){posts.push(post);localStorage.fixtureHistoryPosts=JSON.stringify(posts);}
   return posts.map((p,i)=>[i+1,{op:['comment',{author:'bob',permlink:p,parent_author:''}]}]).filter(r=>from===-1||r[0]<=from).slice(-limit);
  };
  sdk.api.getBlockAsync=async n=>{const result=await block(n);if(n===98)return {previous:result.previous};if(result.transactions?.[0])result.transaction_ids=[localStorage.fixtureMode==='wrong-id'?'2'.repeat(40):sdk.auth.unsignedTransactionId(result.transactions[0])];return result;};
  sdk.api.broadcastTransactionSynchronous=(tx,cb)=>send(tx,(error,receipt)=>{if(receipt?.id)receipt.id=sdk.auth.unsignedTransactionId(tx);cb(error,receipt);});
 }});
})();
"""
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
    context = browser.new_context(service_workers='block')
    external = []
    def route(r):
        u = urlsplit(r.request.url)
        file = (root/(u.path.lstrip('/') or 'index.html')).resolve()
        if u.netloc == urlsplit(origin).netloc and root in file.parents and file.is_file():
            r.fulfill(path=str(file), content_type=mimetypes.guess_type(str(file))[0] or 'text/plain')
        else:
            external.append(r.request.url)
            assert not (r.request.method == 'POST' and 'broadcast' in str(r.request.post_data)), 'external broadcast blocked'
            r.fulfill(content_type='application/json',body=json.dumps({'result':[], 'data':[]}))
    context.route('**/*',route)
    context.add_init_script(INIT)
    page=context.new_page()
    def wait(expression):
        try: page.wait_for_function('() => ('+expression+')')
        except Exception:
            print(json.dumps({'wait':expression,'errors':errors,'feed':page.locator('#app').inner_text()[:6000], 'fixture':page.evaluate('() => ({viz:window.viz?.fixturePatched,golos:window.golos?.fixturePatched,sends:localStorage.fixtureSends,transaction:localStorage.fixtureTransaction,pending:window.DposAutomationContinuity?.pending("viz-self-award","alice"),running:window.__dposVizSelfAwardRuntime?.running})')}))
            raise
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(origin+'/#chain=viz&app=accounts')
    wait('!!window.DposV3')
    page.evaluate("""async()=>{
      await DposVault.setup({password:'fixture-only-browser-password'});
      for(const [id,role] of [['viz','regular'],['golos','posting'],['hive','posting'],['steem','posting']]) {
        const user=DposAuth.createKeyUser({id},'alice',{[role]:fixtureWif});await DposAuth.saveUser({id},user);
      }
      await DposV3.renderRoute();
      for(const id of ['viz','golos','hive','steem']) DposNotifications.saveSettings(DposChains[id],'alice',{ops:[],androidNative:false,intervalMinutes:15});
      DposNotifications.upsertNotifications([{id:'fixture-unread',direction:'incoming',read:false,chain:'golos',account:'alice',timestamp:new Date().toISOString(),message:'retained fixture'}]);
      const notice=JSON.parse(localStorage.getItem(DposNotifications.STORAGE_KEY));notice.accounts['golos:alice']={cursor:123};localStorage.setItem(DposNotifications.STORAGE_KEY,JSON.stringify(notice));
    }""")
    def open_app(chain, app):
        page.evaluate("async ([chain,app])=>{location.hash=`#chain=${chain}&app=${app}`;await DposV3.renderRoute();DposI18n.setLocale('ru');}",[chain,app])
    def sends(): return page.evaluate("Number(localStorage.fixtureSends||0)")
    def force_due(scope):
        page.evaluate("scope=>{const key=DposAutomationContinuity.storageKey(scope);const run=JSON.parse(localStorage.getItem(key));run.nextAt=Date.now()-1;localStorage.setItem(key,JSON.stringify(run));}",scope)
    def viz_start():
        open_app('viz','viz-self-award')
        page.locator('[data-viz-self-award-account] [name="enabled"]').check()
        page.locator('#viz-self-award-start').click()
    def reload():
        page.reload();wait('!!window.DposV3 && DposVault.status().state==="unlocked"')
        assert page.evaluate('DposNotifications.countUnread()')==1
        assert page.evaluate("JSON.parse(localStorage.getItem(DposNotifications.STORAGE_KEY)).accounts['golos:alice'].cursor")==123
        assert page.evaluate("DposNotifications.getSettings(DposChains.golos,'alice').ops.length")==0
    def assert_read_failure_controls(scope, control_id):
        before=sends()
        page.evaluate(r'''([scope,id])=>{
          const key=DposAutomationContinuity.storageKey(scope)+'_control';
          const get=Storage.prototype.getItem;
          Storage.prototype.getItem=function(k){if(k===key)throw new Error('fixture storage read denied');return get.call(this,k);};
          dispatchEvent(new StorageEvent('storage',{key,newValue:null}));
          Storage.prototype.getItem=get;
        }''',[scope,control_id])
        assert page.locator('#'+control_id+'-start').is_disabled()
        assert page.locator('#'+control_id+'-stop').is_disabled()
        assert sends()==before
        page.evaluate('scope=>{const r=scope==="viz-self-award"?__dposVizSelfAwardRuntime:__dposAutoUpvoterRuntimes.golos;if(r.running || !r.feedStorageError)throw new Error("storage read must failclosed");r.feedStorageError="";r.renderUI();}',scope)
    checks=[]
    viz_start()
    wait("DposAutomationContinuity.pending('viz-self-award','alice')?.state==='confirmed'")
    assert sends()==1
    assert 'OK @alice' in page.locator('#viz-self-award-feed').inner_text()
    next_at=page.evaluate("DposAutomationContinuity.readRun('viz-self-award').nextAt")
    for _ in range(3):
        reload()
        wait('__dposVizSelfAwardRuntime?.running')
        assert page.evaluate("DposAutomationContinuity.readRun('viz-self-award').nextAt")==next_at
        assert sends()==1
    assert 'Следующая проверка через' in page.locator('#viz-self-award-feed').inner_text()
    checks.append('real signed VIZ Start + irreversible exact proof + repeated refresh keeps remaining 432s cadence')
    # Independently opened tabs share the session cookie, not a cloned tab ordinal.
    other=context.new_page();other.on('pageerror',lambda e:errors.append(str(e)))
    other.goto(origin+'/#chain=viz&app=viz-self-award')
    other.wait_for_function('() => DposVault?.status().state==="unlocked" && __dposVizSelfAwardRuntime?.running')
    assert sends()==1
    with page.expect_popup() as popup_info:
        page.evaluate("window.open(location.href,'_blank')")
    cloned=popup_info.value
    cloned.wait_for_function('() => window.DposVault?.status().state==="unlocked" && window.__dposVizSelfAwardRuntime?.running')
    assert sends()==1
    cloned.close()
    cookie=next(c for c in context.cookies() if c['name']=='__Host-dpos_vault_browser_session_v1')
    assert cookie['expires']==-1 and cookie['secure'] and cookie['sameSite']=='Strict'
    assert not page.evaluate("Object.values(localStorage).join('').includes('fixture-only-browser-password') || Object.values(localStorage).join('').includes(window.fixtureWif)")
    other.bring_to_front();page.bring_to_front()
    other.locator('#viz-self-award-stop').click()
    wait('!__dposVizSelfAwardRuntime.running')
    assert page.locator('#viz-self-award-start').is_enabled()
    assert page.locator('#viz-self-award-stop').is_disabled()
    assert_read_failure_controls('viz-self-award','viz-self-award')
    page.locator('#viz-self-award-start').click()
    wait('__dposVizSelfAwardRuntime.running')
    assert page.locator('#viz-self-award-start').is_disabled()
    assert page.locator('#viz-self-award-stop').is_enabled()
    page.locator('#viz-self-award-stop').click()
    reload();assert not page.evaluate('__dposVizSelfAwardRuntime.running')
    checks.append('independent/cloned-equivalent new tab unlocked; tab reordering irrelevant; global Stop controls before refresh, direct restart and storage-read failclosed')
    # Start + late RPC Stop must cancel before signature/send.
    page.evaluate("localStorage.fixtureHold='accounts'")
    viz_start();force_due('viz-self-award');wait('!!window.fixtureReleaseAccounts')
    page.locator('#viz-self-award-stop').click()
    page.evaluate("()=>{delete localStorage.fixtureHold;fixtureReleaseAccounts();}")
    wait('!__dposVizSelfAwardRuntime.tickPromise')
    assert sends()==1
    checks.append('Stop cancels delayed RPC before signing')
    # Browser auto-upvoter uses same durable mechanism, separate exact vote target.
    open_app('golos','auto-upvoter')
    page.locator('[data-auto-upvoter-account] [name="enabled"]').check()
    page.locator('[data-auto-upvoter-account] [name="favorites"]').fill('bob')
    page.locator('#auto-upvoter-start').click()
    wait("DposAutomationContinuity.pending('upvoter:golos','alice/bob/fixture-post')?.state==='confirmed'")
    assert sends()==2
    auto_next=page.evaluate("DposAutomationContinuity.readRun('upvoter:golos').nextAt")
    # Refresh on a completely unrelated route hydrates the already-approved task.
    open_app('viz','accounts');reload()
    wait('window.__dposAutoUpvoterRuntimes?.golos?.running')
    assert page.evaluate("DposAutomationContinuity.readRun('upvoter:golos').nextAt")==auto_next
    assert sends()==2
    open_app('golos','auto-upvoter')
    other.evaluate("async()=>{location.hash='#chain=golos&app=auto-upvoter';await DposV3.renderRoute();}")
    other.wait_for_function('window.__dposAutoUpvoterRuntimes?.golos?.running')
    other.locator('#auto-upvoter-stop').click()
    wait('!window.__dposAutoUpvoterRuntimes.golos.running')
    assert page.locator('#auto-upvoter-start').is_enabled()
    assert page.locator('#auto-upvoter-stop').is_disabled()
    assert_read_failure_controls('upvoter:golos','auto-upvoter')
    page.locator('#auto-upvoter-start').click()
    wait('window.__dposAutoUpvoterRuntimes.golos.running')
    assert page.locator('#auto-upvoter-start').is_disabled()
    assert page.locator('#auto-upvoter-stop').is_enabled()
    page.locator('#auto-upvoter-stop').click()
    checks.append('real signed browser upvoter + exact proof + unrelated-route hydration + retained 60s cadence; remote Stop controls before refresh, direct restart and storage-read failclosed')
    # Lock is origin-global and revokes delayed work as well as reload capabilities.
    page.evaluate("localStorage.fixtureHold='accounts'")
    viz_start();force_due('viz-self-award');wait('!!window.fixtureReleaseAccounts')
    other.evaluate('DposVault.lock()')
    wait('DposVault.status().state==="locked"')
    page.evaluate("()=>{delete localStorage.fixtureHold;fixtureReleaseAccounts();}")
    wait('!__dposVizSelfAwardRuntime.tickPromise')
    assert sends()==2
    page.reload();wait('DposVault?.status().state==="locked"')
    page.evaluate("async()=>{await DposVault.unlock({password:'fixture-only-browser-password'});await DposV3.renderRoute();}")
    assert not page.evaluate('DposAutomationContinuity.readRun("viz-self-award").running')
    other.wait_for_function('() => DposVault.status().state==="unlocked"')
    checks.append('global Lock revokes all tabs + late work + existing Start grants; subsequent unlock shared')
    # Remove a known confirmed award fixture to exercise a wholly new send.
    page.evaluate("()=>{const k=DposAutomationContinuity.storageKey('viz-self-award');const x=JSON.parse(localStorage.getItem(k));x.intents={};localStorage.setItem(k,JSON.stringify(x));localStorage.fixtureMode='hang';}")
    viz_start();force_due('viz-self-award');wait('Number(localStorage.fixtureSends)===3')
    assert page.evaluate("DposAutomationContinuity.pending('viz-self-award','alice').state")== 'pending'
    exclusion=other.evaluate("async()=>DposAutomationContinuity.exclusive('viz-self-award',async()=>({unexpected:true}))")
    assert exclusion.get('reason')=='overlap',exclusion
    assert 'Pending @alice' in page.evaluate("DposAutomationFeed.read('viz-self-award').join(' ')")
    reload();force_due('viz-self-award')
    page.wait_for_timeout(1400)
    assert sends()==3
    for _ in range(2): reload()
    assert sends()==3
    checks.append('refresh during send leaves durable pending, repeated refresh/due checks never replay unknown')
    page.locator('#viz-self-award-stop').click()
    # Revision/account mutation invalidates all old guards/grants and stale wrapper.
    for mode in ['reversible','wrong-id']:
        target=mode+'-post'
        page.evaluate("([mode,target])=>{localStorage.fixtureMode=mode;localStorage.fixturePost=target;}",[mode,target])
        open_app('golos','auto-upvoter')
        before=sends()
        page.locator('#auto-upvoter-start').click()
        force_due('upvoter:golos')
        wait('Number(localStorage.fixtureSends)==='+str(before+1))
        wait('!window.__dposAutoUpvoterRuntimes.golos.scanPromise')
        assert page.evaluate("t=>DposAutomationContinuity.pending('upvoter:golos','alice/bob/'+t).state",target)=='pending'
        assert not page.evaluate("t=>DposAutomationFeed.read('upvoter:golos').some(r=>r.type==='success' && r.action?.permlink===t)",target)
        reload();force_due('upvoter:golos');page.wait_for_timeout(1300)
        assert sends()==before+1
        page.locator('#auto-upvoter-stop').click()
    open_app('viz','viz-self-award')
    checks.append('reversible inclusion and wrong exact transaction ID remain pending, never success/replay')
    for chain in ['hive','steem']:
        page.evaluate("chain=>{localStorage.fixtureMode='normal';localStorage.fixturePost=chain+'-fixture-post';}",chain)
        open_app(chain,'auto-upvoter')
        page.locator('[data-auto-upvoter-account] [name="enabled"]').check()
        page.locator('[data-auto-upvoter-account] [name="favorites"]').fill('bob')
        before=sends();page.locator('#auto-upvoter-start').click()
        wait("DposAutomationContinuity.pending('upvoter:"+chain+"','alice/bob/"+chain+"-fixture-post')?.state==='confirmed'")
        assert sends()==before+1
        deadline=page.evaluate("chain=>DposAutomationContinuity.readRun('upvoter:'+chain).nextAt",chain)
        reload();wait("window.__dposAutoUpvoterRuntimes?."+chain+"?.running")
        assert page.evaluate("chain=>DposAutomationContinuity.readRun('upvoter:'+chain).nextAt",chain)==deadline
        page.locator('#auto-upvoter-stop').click()
    open_app('viz','viz-self-award')
    checks.append('Hive/Steem real signed auto-upvoter and same-session refresh retain explicit Start/cadence')
    open_app('golos','auto-upvoter')
    page.locator('[data-auto-upvoter-account] [name="autoDonate"]').check()
    page.locator('[data-auto-upvoter-account] [name="autoDonatePoolPercent"]').fill('10')
    page.evaluate("()=>{const k=DposAutomationContinuity.storageKey('upvoter:golos');const x=JSON.parse(localStorage.getItem(k));x.nextAt=Date.now()+60000;localStorage.setItem(k,JSON.stringify(x));}")
    page.locator('#auto-upvoter-start').click()
    wait('window.__dposAutoUpvoterRuntimes.golos.running && !window.__dposAutoUpvoterRuntimes.golos.scanPromise')
    before=sends()
    donation_result=page.evaluate("""async()=>{
      const scope='upvoter:golos',runtime=__dposAutoUpvoterRuntimes.golos,feed=runtime.scannerState.feed;
      const action={type:'vote',account:'alice',author:'bob',permlink:'donate-fixture-post',weight:100,source:'fixture',donate:{enabled:true,amount:1}};
      let checkpoints=0;
      const rows=await DposAutomationContinuity.exclusive(scope,()=>DposGolosAutoUpvoter.executePlannedActions(DposChains.golos,[action],runtime.scannerState,{feed,broadcastOptions:{continuityScope:scope,beforeSend:()=>{feed.push({type:'info',message:'Pending donation checkpoint '+(++checkpoints)});DposAutomationFeed.save(scope,feed);}},onResult:()=>runtime.renderUI()}));
      return {ok:rows[0].ok,donations:rows[0].result?.donations?.length,checkpoints};
    }""")
    assert donation_result=={'ok':True,'donations':2,'checkpoints':3},donation_result
    assert sends()==before+3
    for target in ['alice/bob/donate-fixture-post','alice/bob/donate-fixture-post/donate/bob','alice/bob/donate-fixture-post/donate/denis-skripnik']:
        assert page.evaluate("t=>DposAutomationContinuity.pending('upvoter:golos',t).state",target)=='confirmed'
    page.locator('#auto-upvoter-stop').click()
    open_app('viz','viz-self-award')
    checks.append('confirmed vote then both Golos donation legs each have durable pending/feed/proof before next send')
    old_bundle=page.evaluate("localStorage.getItem('dpos_vault_session_resume_v1')")
    page.evaluate("async()=>{await DposVault.mutate(r=>{r.viz_users[0].fixtureRevision='changed';});}")
    page.evaluate("v=>localStorage.setItem('dpos_vault_session_resume_v1',v)",old_bundle)
    page.reload();wait('DposVault?.status().state==="locked"')
    checks.append('stale envelope/revision/account-binding does not restore unlock')
    page.evaluate("async()=>{await DposVault.unlock({password:'fixture-only-browser-password'});await DposV3.renderRoute();}")
    # Simulate session-cookie loss in the SAME persistent origin, not unload deletion.
    context.clear_cookies()
    page.reload();wait('DposVault?.status().state==="locked"')
    checks.append('loss of session cookie locks with durable ciphertext still present')
    page.evaluate("async()=>{await DposVault.unlock({password:'fixture-only-browser-password'});await DposV3.renderRoute();}")
    before_failure=sends()
    page.evaluate("""()=>{window.originalSet=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k.startsWith('dpos_web_automation_continuity_'))throw Error('quota fixture');return originalSet.call(this,k,v);};}""")
    viz_start();wait('DposVault.status().state==="locked"')
    assert sends()==before_failure
    checks.append('intent storage failure failclosed before any send')
    assert errors==[], errors
    print(json.dumps({'checks':checks,'pageErrors':errors,'syntheticSignedSends':sends(),'mainnetBroadcasts':0,'externalRequestsFulfilledLocally':len(external)}))
    context.close();browser.close()
