"""Isolated Chromium acceptance; local assets, fixture RPC, NO live broadcasts."""
import json, mimetypes, os, secrets
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright

root=Path(__file__).resolve().parents[2]
origin='https://dpos.blinddev.xyz'
artifact=Path(os.environ.get('DPOS_SYNC_ARTIFACT_DIR','/home/assistent/.hermes/plans/dpos-settings-sync'))
artifact.mkdir(parents=True,exist_ok=True)
empty={'format':'dpos.space/settings','version':1,'notifications':[],'autoUpvoter':{'golos':[],'hive':[],'steem':[]},'vizSelfAward':[]}
remote=json.loads(json.dumps(empty))
remote['notifications']=[{'chain':'viz','account':'alice','ops':[],'showAutoAwards':True}]
remote['autoUpvoter']['golos']=[{'account':'alice','enabled':True,'curators':'','favorites':'new-author','minEnergy':'95','curatorMode':'repeat','curatorCoefficient':'100','favoritesPercent':'50','autoDonate':False,'autoDonatePoolPercent':'0','autoDonatePoolCoefficient':'1'}]
remote['vizSelfAward']=[{'account':'alice','enabled':True,'minEnergy':'9900'},{'account':'binding-only','enabled':True,'minEnergy':'9800'}]
with sync_playwright() as p:
    browser=p.chromium.connect_over_cdp('http://127.0.0.1:18800')
    context=browser.new_context(service_workers='block',locale='ru-RU')
    context.add_init_script("""window.qaCalls=[];window.DposAndroidTransport={postMessage(raw){const r=JSON.parse(raw);qaCalls.push(r);if(!['getWorkerStatus','getAppInfo','replaceSettingsPreferences'].includes(r.method))throw Error('Unexpected native mutation: '+r.method);const unsupported=window.qaOldApk&&r.method==='replaceSettingsPreferences';queueMicrotask(()=>this.onmessage({data:JSON.stringify(unsupported?{version:2,id:r.id,ok:false,error:{code:'unsupported_method',message:'unsupported bridge method'}}:{version:2,id:r.id,ok:true,result:{ok:true,activeAccounts:0}})}));}};""")
    context.add_init_script("""window.qaDelay=false;window.qaRelease=null;const qaFetch=window.fetch.bind(window);window.fetch=async(url,options)=>{const response=await qaFetch(url,options);let body;try{body=JSON.parse(options?.body||'{}')}catch(_){}if(window.qaDelay&&body?.method==='call'&&body.params?.[1]==='get_account_history')await new Promise(resolve=>window.qaRelease=resolve);return response;};""")
    errors=[];rpc_calls=[];broadcast_calls=[];dialogs=[];state={'snapshot':remote,'unknown':False}
    def route(r):
        u=urlsplit(r.request.url)
        f=(root/(u.path.lstrip('/') or 'index.html')).resolve()
        if u.netloc==urlsplit(origin).netloc and root in f.parents and f.is_file():
            r.fulfill(path=str(f),content_type=mimetypes.guess_type(str(f))[0] or 'text/plain');return
        try: body=r.request.post_data_json
        except Exception: body={}
        if isinstance(body,dict) and body.get('method')=='call':
            api,method,args=body['params'];rpc_calls.append([api,method,args])
            if 'broadcast' in method.lower():
                broadcast_calls.append(body);r.abort();return
            if method=='get_dynamic_global_properties': result={'head_block_number':100,'head_block_id':'00'*20,'time':'2026-11-01T00:00:00'}
            elif method=='get_account': result={'custom_sequence':0,'custom_sequence_block_num':0}
            elif method=='get_account_history':
                chain='viz' if 'viz' in u.netloc else 'golos'
                snapshot=json.loads(json.dumps(state['snapshot']))
                if state['unknown']: snapshot['version']=99
                op=['custom' if chain=='viz' else 'custom_json',{'id':'dpos.space.settings','required_regular_auths' if chain=='viz' else 'required_posting_auths':['alice'],'json':json.dumps({'p':0,'d':snapshot} if chain=='viz' else snapshot)}]
                result=[[5,{'block':30,'op':op}]]
            elif method=='get_accounts':result=[]
            else:result=[]
            r.fulfill(status=200,content_type='application/json',body=json.dumps({'jsonrpc':'2.0','id':body.get('id',1),'result':result}));return
        r.fulfill(status=200,content_type='application/json',body='{"result":[],"data":[]}')
    context.route('**/*',route)
    page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
    def dialog(d):
        dialogs.append(d.message)
        if 'Заменить' in d.message or 'Replace all' in d.message:d.accept()
        else:d.dismiss() # exercise the real Save confirmation but NEVER broadcast
    page.on('dialog',dialog)
    def flush():page.evaluate('()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))')
    try:
        page.goto(origin+'/#app=settings-sync')
        password=secrets.token_urlsafe(24)
        page.evaluate('async password=>{await DposVault.setup({password});await DposV3.renderRoute()}',password)
        page.locator('#settings-sync-read').wait_for()
        page.evaluate("""async()=>{
          await DposAuth.saveUser(DposChains.viz,{login:'alice',regular:sjcl.encrypt('dpos.space_viz_alice_regularKey','non-signing-qa-fixture')});
          await DposAuth.saveUser(DposChains.viz,{login:'bob',regular:sjcl.encrypt('dpos.space_viz_bob_regularKey','non-signing-qa-fixture')});
          await DposAuth.selectUser(DposChains.viz,'alice','standard');
          await DposAuth.saveUser(DposChains.golos,{login:'alice',posting:sjcl.encrypt('dpos.space_golos_alice_postingKey','non-signing-qa-fixture')});
          localStorage.setItem('dpos_notifications_v1',JSON.stringify({settings:{'viz:alice':{ops:['transfer'],androidNative:true,intervalMinutes:37}},notifications:[{id:'keep-inbox',read:false}],accounts:{'viz:alice':{cursor:77}}}));
          for(const chain of ['golos','hive','steem'])localStorage.setItem(`dpos_${chain}_auto_upvoter_settings`,JSON.stringify({schemaVersion:2,minEnergyUnit:'percent',accounts:{alice:{enabled:true,curators:'old-curator',favorites:'old-favorite',minEnergy:'25'},stale:{enabled:true}},autoStart:false}));
          localStorage.setItem('dpos_viz_self_award_settings',JSON.stringify({accounts:{alice:{enabled:false,minEnergy:'9500'},stale:{enabled:true}},autoStart:true}));
          window.qaProtected=JSON.stringify(DposAuth.getUsers(DposChains.viz));
          qaCalls=[];await DposV3.renderRoute();
        }""")
        page.locator('#settings-sync-source').fill('alice')
        page.locator('#settings-sync-read').click()
        page.wait_for_function("() => document.querySelector('#settings-sync-status').textContent.includes('заменены последним')")
        assert page.evaluate("JSON.parse(localStorage.getItem('dpos_golos_auto_upvoter_settings')).accounts.alice.favorites")=='new-author'
        assert page.evaluate("Object.keys(JSON.parse(localStorage.getItem('dpos_hive_auto_upvoter_settings')).accounts).length")==0
        assert page.evaluate("JSON.parse(localStorage.getItem('dpos_notifications_v1')).accounts['viz:alice'].cursor")==77
        assert page.evaluate("JSON.parse(localStorage.getItem('dpos_notifications_v1')).notifications[0].id")=='keep-inbox'
        assert page.evaluate('JSON.stringify(DposAuth.getUsers(DposChains.viz))===qaProtected')
        methods=page.evaluate("qaCalls.map(r=>r.method)")
        assert methods==['replaceSettingsPreferences'],methods
        # Saving follows the real guarded operation form, with confirmation cancelled.
        page.locator('#settings-sync-save-form button').click()
        page.wait_for_function("() => document.querySelector('#settings-sync-save-form').textContent.includes('отменена')")
        assert any('реальную транзакцию' in d for d in dialogs),dialogs
        assert not broadcast_calls
        # Wrong-source and unknown-schema rejection do not modify settings.
        state['unknown']=True
        before=page.evaluate("localStorage.getItem('dpos_golos_auto_upvoter_settings')")
        page.locator('#settings-sync-read').click()
        page.wait_for_function("() => document.querySelector('#settings-sync-status').textContent.includes('повреждённый')")
        assert page.evaluate("localStorage.getItem('dpos_golos_auto_upvoter_settings')")==before
        state['unknown']=False
        mutations_before_races=page.evaluate("qaCalls.filter(r=>r.method==='replaceSettingsPreferences').length")
        # Source changes while RPC is pending invalidate the response.
        page.evaluate('qaDelay=true');page.locator('#settings-sync-read').click()
        page.wait_for_function('() => typeof qaRelease === \"function\"')
        page.locator('#settings-sync-source').fill('bob')
        page.evaluate('qaDelay=false;qaRelease();qaRelease=null')
        flush();assert page.evaluate("localStorage.getItem('dpos_golos_auto_upvoter_settings')")==before
        assert page.evaluate("qaCalls.filter(r=>r.method==='replaceSettingsPreferences').length")==mutations_before_races
        # Current authorized account changes also invalidate an in-flight read.
        page.locator('#settings-sync-source').fill('alice');page.evaluate('qaDelay=true')
        page.locator('#settings-sync-read').click();page.wait_for_function('() => typeof qaRelease === \"function\"')
        page.evaluate("async()=>{await DposAuth.selectUser(DposChains.viz,'bob','standard');await DposAuth.selectUser(DposChains.viz,'alice','standard')}")
        page.evaluate('qaDelay=false;qaRelease();qaRelease=null')
        flush();assert page.evaluate("localStorage.getItem('dpos_golos_auto_upvoter_settings')")==before
        assert page.evaluate("qaCalls.filter(r=>r.method==='replaceSettingsPreferences').length")==mutations_before_races
        page.evaluate("async()=>{await DposAuth.selectUser(DposChains.viz,'alice','standard')}")
        # A route race also must not apply a fetched snapshot.
        page.locator('#settings-sync-source').fill('alice');page.evaluate('qaDelay=true')
        page.locator('#settings-sync-read').click();page.wait_for_function('() => typeof qaRelease === \"function\"')
        page.evaluate("location.hash='#chain=viz&app=help'");page.locator('#settings-sync-read').wait_for(state='detached')
        page.evaluate('qaDelay=false;qaRelease();qaRelease=null')
        flush();assert page.evaluate("localStorage.getItem('dpos_golos_auto_upvoter_settings')")==before
        assert page.evaluate("qaCalls.filter(r=>r.method==='replaceSettingsPreferences').length")==mutations_before_races
        # Round-trip to synchronization and reload retain preferences and no start.
        page.evaluate("location.hash='#app=settings-sync'");page.locator('#settings-sync-read').wait_for()
        page.reload()
        page.evaluate('async password=>{await DposVault.ready;if(DposVault.status().state!=="unlocked")await DposVault.unlock({password});await DposV3.renderRoute()}',password)
        page.locator('#settings-sync-read').wait_for()
        assert page.evaluate("localStorage.getItem('dpos_golos_auto_upvoter_settings')")==before
        # Golos selection consumes its filtered history contract, no silent writes.
        page.locator('#settings-sync-chain').select_option('golos');page.locator('#settings-sync-source').fill('alice')
        page.locator('#settings-sync-read').click();page.wait_for_function("() => document.querySelector('#settings-sync-status').textContent.includes('заменены последним')")
        assert any(len(c[2])==4 and c[2][3]=={'select_ops':['custom_json']} for c in rpc_calls)
        viz_before=page.evaluate("localStorage.getItem('dpos_viz_self_award_settings')")
        page.evaluate("location.hash='#chain=viz&app=viz-self-award'")
        page.locator('#viz-self-award-form').wait_for();flush()
        assert page.evaluate("localStorage.getItem('dpos_viz_self_award_settings')")==viz_before
        assert page.evaluate("JSON.parse(localStorage.getItem('dpos_viz_self_award_settings')).accounts['binding-only'].enabled")
        page.evaluate("location.hash='#chain=viz&app=notifications&account=alice'")
        page.locator('#notifications-settings-form').wait_for();flush()
        assert page.locator('#notifications-settings-form [name="androidNative"]').is_checked()
        assert page.locator('#notifications-settings-form [name="showAutoAwards"]').is_checked()
        assert page.locator('#notifications-settings-form [name="intervalMinutes"]').input_value()=='37'
        page.evaluate("location.hash='#app=settings-sync'");page.locator('#settings-sync-read').wait_for()
        # Old APK cannot replace native parameters. Synced enabled donation rows
        # still must NEVER enter the legacy migration (which can create a grant).
        state['snapshot']['autoUpvoter']['golos'][0]['autoDonate']=True
        state['snapshot']['autoUpvoter']['golos'][0]['autoDonatePoolPercent']='1'
        page.evaluate('window.qaOldApk=true')
        page.locator('#settings-sync-chain').select_option('golos');page.locator('#settings-sync-source').fill('alice')
        page.locator('#settings-sync-read').click()
        page.wait_for_function("()=>document.querySelector('#settings-sync-status').textContent.includes('Android не обновил параметры')")
        assert page.evaluate("JSON.parse(localStorage.getItem('dpos_golos_auto_upvoter_settings')).settingsImported")
        page.evaluate("location.hash='#chain=golos&app=auto-upvoter'")
        page.locator('#auto-upvoter-form').wait_for();flush()
        assert not any(r['method']=='migrateGolosDonateSettings' for r in page.evaluate('qaCalls'))
        page.reload()
        page.evaluate('async password=>{await DposVault.ready;if(DposVault.status().state!=="unlocked")await DposVault.unlock({password});await DposV3.renderRoute()}',password)
        page.locator('#auto-upvoter-form').wait_for();flush()
        assert page.evaluate("JSON.parse(localStorage.getItem('dpos_golos_auto_upvoter_settings')).settingsImported")
        assert not any(r['method']=='migrateGolosDonateSettings' for r in page.evaluate('qaCalls'))
        assert not broadcast_calls and not errors,(broadcast_calls,errors)
        assert not any(r['method'] in ['startWorker','stopWorker','importSecureKey','importWorkerSettings','syncAutoUpvoterSettings','syncVizSelfAwardSettings'] for r in page.evaluate('qaCalls'))
        page.screenshot(path=str(artifact/'settings-sync-browser.png'),full_page=True)
        result={'settings_replace':'PASS','empty_lists':'PASS','protected_auth_cursor_inbox':'PASS','native_preferences_only':'PASS','old_apk_no_donation_grant_migration_after_reload':'PASS','real_save_confirmation_cancelled':'PASS','source_route_races':'PASS','unknown_schema':'PASS','reload':'PASS','golos_filter':'PASS','broadcasts':len(broadcast_calls),'page_errors':errors,'assets':'isolated local checkout','native':'mock transport only'}
        (artifact/'browser-qa.json').write_text(json.dumps(result,indent=2));print(json.dumps(result))
    except Exception:
        print(json.dumps({'status':page.locator('#settings-sync-status').text_content() if page.locator('#settings-sync-status').count() else page.locator('#app').inner_text()[:1500],'errors':errors,'rpc_methods':[c[1] for c in rpc_calls],'native_methods':page.evaluate('qaCalls.map(r=>r.method)')}))
        raise
    finally:
        context.unroute_all(behavior="ignoreErrors")
        context.close()
