"""Connected Chromium HF15 QA; synthetic keys/RPC, every broadcaster intercepted."""
import json, mimetypes, secrets, time, os
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright
root = Path(__file__).resolve().parents[2]
origin = 'https://dpos.blinddev.xyz'
def wait(page, expression):
    deadline = time.monotonic() + 20
    while time.monotonic() < deadline:
        if page.evaluate(expression): return
        page.wait_for_timeout(100)
    raise AssertionError(expression + ': ' + page.locator('#app').inner_text()[-1800:])
with sync_playwright() as p:
    standalone = os.getenv('DPOS_QA_STANDALONE') == '1'
    owner = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox', '--remote-debugging-port=18815']) if standalone else None
    b = p.chromium.connect_over_cdp('http://127.0.0.1:18815' if standalone else os.getenv('DPOS_QA_CDP', 'http://127.0.0.1:18800'), timeout=15000)
    c = b.new_context(service_workers='block', timezone_id='America/Los_Angeles')
    c.add_init_script('window.confirmMessages=[];window.confirmAnswer=true;window.confirm=m=>{confirmMessages.push(m);return confirmAnswer;};')
    requests=[]
    def route(r):
        u=urlsplit(r.request.url); f=(root/(u.path.lstrip('/') or 'index.html')).resolve()
        if u.netloc==urlsplit(origin).netloc and root in f.parents and f.is_file():
            r.fulfill(path=str(f),content_type=mimetypes.guess_type(str(f))[0] or 'text/plain')
        else:
            payload=r.request.post_data_json if r.request.method=='POST' else {}
            assert 'broadcast' not in json.dumps(payload or {}), 'Unexpected network broadcast'
            requests.append(payload or {})
            r.fulfill(content_type='application/json',body=json.dumps({'id':(payload or {}).get('id'),'result':[],'data':[]}))
    c.route('**/*',route)
    try:
        page=c.new_page();errors=[];logs=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.on('console',lambda e:logs.append(e.text))
        page.goto(origin+'/#chain=viz&app=accounts');wait(page,'!!window.DposVault && !!window.sjcl && !!window.DposV3')
        page.add_script_tag(url=origin+'/v3/vendor/viz/viz.min.js')
        page.evaluate("""()=>{
          window.fixtureKeys=viz.auth.getPrivateKeys('alice','offline-agent-qa-not-a-real-key',['active','regular']);
          const users=['alice','bob'].map(login=>({login,active:sjcl.encrypt('dpos.space_viz_'+login+'_activeKey',fixtureKeys.active),regular:sjcl.encrypt('dpos.space_viz_'+login+'_regularKey',fixtureKeys.regular)}));
          localStorage.setItem('viz_users',JSON.stringify(users));localStorage.setItem('viz_current_user',JSON.stringify(users[0]));
        }""")
        page.reload(); wait(page,'DposVault.status().state==="legacy"')
        page.add_script_tag(url=origin+'/v3/vendor/viz/viz.min.js')
        password=secrets.token_urlsafe(24)
        page.evaluate('async password=>{await DposVault.migrate({password});await DposV3.renderRoute()}',password)
        page.evaluate("""()=>{
          window.__dposScriptLoads = window.__dposScriptLoads || new Map();
          __dposScriptLoads.set('v3/vendor/viz/viz.min.js', Promise.resolve());
          window.fixtureKeys=viz.auth.getPrivateKeys('alice','offline-agent-qa-not-a-real-key',['active','regular']);
          window.sent=[];window.totalBroadcasts=0;window.rpcCount=0;window.readDelay=false;window.taposDelay=false;
          window.fixtureRows=[{account:'alice',agent_name:'fixture-bot',agent_key:fixtureKeys.regularPubkey,operations:['transfer','pm_place_bet'],expiration:'2030-01-01T00:00:00',addons:['vizhub'],expired:false}];
          DposProfiles.connect=async()=>({client:viz,node:'fixture'});
          viz.api.getAgentPermissionsAsync=async()=>{rpcCount++;if(readDelay)await new Promise((resolve,reject)=>{window.finishRead=()=>resolve(fixtureRows);window.failRead=()=>reject(Error('delayed failure'));});return fixtureRows;};
          window.originalNow=Date.now;window.clockNow=null;Date.now=()=>clockNow===null?originalNow():clockNow;
          window.chainTime='2029-01-01T00:00:00';window.authorityDelay=false;window.signCount=0;
          window.includedReceipt={id:'a'.repeat(40),block_num:1,trx_num:0,expired:false};window.receipt=includedReceipt;window.transportError=false;
          window.originalSign=viz.auth.signTransaction;viz.auth.signTransaction=(...args)=>{signCount++;return originalSign(...args);};
          viz.api.getAccountsAsync=async names=>{if(authorityDelay)await new Promise(resolve=>window.finishAuthority=resolve);return names.map(name=>({name,active_authority:{weight_threshold:1,key_auths:[[fixtureKeys.activePubkey,1]],account_auths:[]}}));};
          viz.api.getDynamicGlobalPropertiesAsync=async()=>({time:chainTime,head_block_number:123,head_block_id:'0000007b11223344'+'0'.repeat(24)});
          window.originalPrepare=viz.broadcast._prepareTransaction;
          viz.broadcast._prepareTransaction=async tx=>{if(taposDelay)await new Promise(resolve=>window.finishTapos=resolve);const prepared=await originalPrepare(tx);if(Object.prototype.toString.call(prepared.expiration)!=='[object Date]')throw Error('SDK TAPOS must return Date');return prepared;};
          viz.api.broadcastTransactionSynchronous=(tx,callback)=>{sent.push(tx);totalBroadcasts++;callback(transportError?Error('node is stopped'):null,receipt);};
        }""")
        def open_agents():
            page.evaluate("async()=>{location.hash='#chain=viz&app=manage';await DposV3.renderRoute();DposI18n.setLocale('ru');}")
            page.locator('#viz-manage-nav [data-app-modal-open="viz-agent-keys-details"]').click()
            page.locator('#viz-agent-keys-details').wait_for(state='visible')
            assert page.evaluate("location.hash==='#chain=viz&app=manage'")
        def preview():
            page.locator('#viz-agent-form button[value=preview]').click()
            wait(page,"!document.querySelector('#viz-agent-form button[value=preview]').disabled")
        def send():
            page.locator('#viz-agent-form button[value=send]').click()
            wait(page,"!document.querySelector('#viz-agent-form button[value=send]').disabled")
        open_agents()
        modal=page.locator('#viz-agent-keys-details')
        assert modal.get_attribute('role')=='dialog'
        assert page.evaluate("document.activeElement.hasAttribute('data-app-modal-close')")
        page.keyboard.press('Shift+Tab');assert page.evaluate("document.activeElement===document.querySelector('#viz-agent-keys-details .app-modal-footer button')")
        page.keyboard.press('Tab');assert page.evaluate("document.activeElement===document.querySelector('#viz-agent-keys-details .app-modal-header button')")
        page.locator('#viz-agents-load').click();wait(page,"document.querySelector('#viz-agents-result').dataset.state==='ok'")
        assert 'fixture-bot' in page.locator('#viz-agents-list').inner_text()
        page.evaluate("()=>{window.permissionLookup=viz.api.getAgentPermissionsAsync;viz.api.getAgentPermissionsAsync=async()=>{throw Object.assign(Error('method not found'),{code:-32601});};}")
        page.locator('#viz-agents-load').click();wait(page,"document.querySelector('#viz-agents-result').dataset.state==='error'")
        assert 'HF15' in page.locator('#viz-agents-result').inner_text()
        assert page.locator('[data-agent-edit]').count()==0
        page.evaluate('viz.api.getAgentPermissionsAsync=permissionLookup')
        page.evaluate("fixtureRows.push({account:'alice',agent_name:'expired-bot',agent_key:fixtureKeys.activePubkey,operations:[],expiration:'2000-01-01T00:00:00',addons:['vizhub'],expired:true})")
        page.locator('#viz-agents-load').click();wait(page,"document.querySelector('#viz-agents-result').dataset.state==='ok'")
        assert '(истёк)' in page.locator('#viz-agents-list').inner_text()
        page.locator('[data-agent-edit="0"]').click()
        assert page.locator('#viz-agent-name').input_value()=='fixture-bot'
        assert not page.locator('#viz-agent-unlimited').is_checked()
        assert page.get_by_role('listbox',name='Разрешённые операции',exact=True).count()==1
        page.locator('#viz-agent-operations').select_option(['transfer'])
        preview()
        assert 'pm_place_bet' not in page.locator('#viz-agent-form [data-operation-result]').inner_text()
        page.locator('#viz-agent-operations').select_option(['transfer','pm_place_bet'])
        preview();assert '2030-01-01T00:00:00' in page.locator('#viz-agent-form [data-operation-result]').inner_text(), page.locator('#viz-agent-form [data-operation-result]').inner_text()
        assert page.evaluate('sent.length')==0
        page.locator('#viz-agent-name').fill('safe-generated')
        page.locator('#viz-agent-generate').click();wait(page,"!!document.querySelector('#viz-agent-private').value")
        assert page.locator('#viz-agent-private').get_attribute('type')=='password'
        assert page.evaluate("!new FormData(document.querySelector('#viz-agent-form')).has('privateKey') && !document.querySelector('#viz-agent-private').name")
        preview();assert 'подтвердите' in page.locator('#viz-agent-form [data-operation-result]').inner_text()
        page.locator('#viz-agent-saved').check();preview()
        # The key may occur only in the handoff input's live value, never in public summaries/storage/requests/logs.
        assert page.evaluate("()=>{const key=document.querySelector('#viz-agent-private').value;return !document.body.innerText.includes(key)&&!document.documentElement.outerHTML.includes(key)&&!JSON.stringify({...localStorage}).includes(key)&&!JSON.stringify({...sessionStorage}).includes(key)&&!JSON.stringify(confirmMessages).includes(key);}")
        assert page.evaluate('key=>!JSON.stringify(key.logs).includes(document.querySelector("#viz-agent-private").value)&&!JSON.stringify(key.requests).includes(document.querySelector("#viz-agent-private").value)',{'logs':logs,'requests':requests})
        page.evaluate('confirmAnswer=false');send();assert page.evaluate('sent.length')==0
        page.evaluate('confirmAnswer=true;window.handoffKey=document.querySelector("#viz-agent-private").value')
        assert page.locator('#viz-agent-operations').get_attribute('multiple') is not None
        assert page.locator('#viz-agent-form input[name=operations]').count()==0
        for retired in ['vote','content','delete_content','cancel_paid_subscription']:
            assert page.locator('#viz-agent-operations option[value='+retired+']').count()==0
        assert page.evaluate("Array.from(document.querySelector('#viz-agent-operations').selectedOptions).map(x=>x.value).sort().join(',')==='pm_place_bet,transfer'")
        # Invalid/expired/unknown receipts must be error, one attempt, and retain handoff.
        failures=[{'id':'a'*40,'block_num':1,'trx_num':-1,'expired':True}, {}, None, {'id':'a'*40,'block_num':1,'trx_num':0}, 'transport']
        for bad in failures:
            page.evaluate("bad=>{receipt=bad;transportError=bad==='transport';sent=[];}",bad)
            send()
            assert page.evaluate('sent.length')==1, 'must not retry unknown send'
            assert page.locator('#viz-agent-form [data-operation-result]').get_attribute('data-state')=='error', 'bad receipt reported success'
            assert page.evaluate('document.querySelector("#viz-agent-private").value===handoffKey && document.querySelector("#viz-agent-saved").checked'), 'failed/unknown cleared handoff'
        # Deadline passes while confirmation, authority lookup or TAPOS is pending.
        for stage in ['confirmation','authority','TAPOS','chain-ahead']:
            page.locator('#viz-agent-expiration').fill('2030-01-01T00:00')
            page.evaluate("()=>{clockNow=Date.parse('2029-12-31T23:59:50Z');chainTime='2029-12-31T23:59:50';receipt=includedReceipt;transportError=false;sent=[];signCount=0;finishAuthority=null;finishTapos=null;}")
            if stage=='confirmation':
                page.evaluate("()=>{window.savedConfirm=window.confirm;window.confirm=m=>{clockNow=Date.parse('2030-01-01T00:00:00Z');return savedConfirm(m);};}")
            elif stage=='authority': page.evaluate('authorityDelay=true')
            elif stage=='TAPOS': page.evaluate('taposDelay=true')
            else: page.evaluate("chainTime='2030-01-01T00:00:00'")
            page.locator('#viz-agent-form button[value=send]').click()
            if stage in ['authority','TAPOS']:
                callback='finishAuthority' if stage=='authority' else 'finishTapos'
                wait(page,'typeof '+callback+'==="function"')
                page.evaluate("clockNow=Date.parse('2030-01-01T00:00:00Z');"+callback+'()')
            wait(page,"!document.querySelector('#viz-agent-form button[value=send]').disabled")
            assert page.evaluate('signCount===0 && sent.length===0'), stage+' elapsed deadline signed/broadcast'
            assert page.locator('#viz-agent-form [data-operation-result]').get_attribute('data-state')=='error'
            assert page.evaluate('document.querySelector("#viz-agent-private").value===handoffKey'), 'deadline rejection cleared handoff'
            page.evaluate("authorityDelay=false;taposDelay=false;if(window.savedConfirm){window.confirm=savedConfirm;savedConfirm=null;}")
        # Limited grant near deadline is actually signed with a strictly earlier tx expiry.
        page.evaluate("clockNow=Date.parse('2029-12-31T23:59:50Z');chainTime='2029-12-31T23:59:50';sent=[];signCount=0")
        send();assert page.evaluate('sent.length')==1
        assert page.evaluate("sent[0].expiration==='2029-12-31T23:59:59' && sent[0].operations[0][1].expiration==='2030-01-01T00:00:00' && signCount===1")
        page.evaluate("clockNow=null;chainTime='2029-01-01T00:00:00';handoffKey=''")
        assert page.evaluate("sent[0].operations[0][0]==='set_agent_permission' && sent[0].operations[0][1].account==='alice' && sent[0].signatures.length===1")
        assert page.locator('#viz-agent-private').input_value()==''
        assert 'safe-generated' in page.evaluate('confirmMessages.at(-1)')
        page.locator('[data-agent-revoke="0"]').click();preview()
        assert page.evaluate("document.querySelector('#viz-agent-mode').value==='revoke'")
        send();assert page.evaluate('sent.length')==2
        assert page.evaluate("sent[1].operations[0][1].operations.length===0&&sent[1].operations[0][1].addons.length===0&&sent[1].operations[0][1].agent_key===DposVizAgents.nullKey")
        # Addon-only grant; no chain scopes silently added.
        page.select_option('#viz-agent-mode','grant');page.locator('#viz-agent-name').fill('addon-only')
        page.locator('#viz-agent-public').fill(page.evaluate('fixtureKeys.regularPubkey'))
        page.locator('#viz-agent-operations').select_option([])
        page.locator('#viz-agent-addons').fill('vizhub');page.locator('#viz-agent-unlimited').check();send()
        assert page.evaluate('sent.length')==3
        assert page.evaluate("sent[2].operations[0][1].operations.length===0&&sent[2].operations[0][1].expiration===DposVizAgents.epoch")
        # Update an existing name, with all replacement fields and an explicit UTC date.
        page.locator('[data-agent-edit="0"]').click()
        page.locator('#viz-agent-expiration').fill('2031-02-03T04:05:06')
        send(); assert page.evaluate('sent.length') == 4
        assert page.evaluate("sent[3].operations[0][1].agent_name==='fixture-bot'&&sent[3].operations[0][1].expiration==='2031-02-03T04:05:06'&&sent[3].operations[0][1].agent_key===fixtureKeys.regularPubkey")
        # A saved signing key absent from active authority must never reach TAPOS/broadcast.
        page.evaluate("()=>{window.accountLookup=viz.api.getAccountsAsync;viz.api.getAccountsAsync=async names=>names.map(name=>({name,active_authority:{weight_threshold:1,key_auths:[[fixtureKeys.regularPubkey,1]],account_auths:[]}}));}")
        send(); assert page.evaluate('sent.length') == 4
        assert 'не найден' in page.locator('#viz-agent-form [data-operation-result]').inner_text()
        page.evaluate('()=>{viz.api.getAccountsAsync=accountLookup;}')
        # Duplicate submit and route switch while TAPOS is pending: no signing/broadcast continuation.
        page.evaluate('taposDelay=true;finishTapos=null')
        page.locator('#viz-agent-form button[value=send]').click();wait(page,'typeof finishTapos==="function"')
        page.evaluate("document.querySelector('#viz-agent-form').requestSubmit(document.querySelector('#viz-agent-form button[value=send]'))")
        page.evaluate("async()=>{location.hash='#chain=golos&app=manage';await DposV3.renderRoute();finishTapos();}")
        page.wait_for_timeout(300);assert page.evaluate('sent.length')==4
        assert page.locator('#viz-agent-form').count()==0
        assert 'Ключи агента' not in page.locator('#app').inner_text()
        # Account switch during TAPOS also blocks.
        page.evaluate('taposDelay=true');open_agents()
        page.select_option('#viz-agent-mode','grant');page.locator('#viz-agent-name').fill('stale-account');page.locator('#viz-agent-public').fill(page.evaluate('fixtureKeys.regularPubkey'));page.locator('#viz-agent-addons').fill('vizhub')
        page.evaluate('finishTapos=null');page.locator('#viz-agent-form button[value=send]').click();wait(page,'typeof finishTapos==="function"')
        page.evaluate("async()=>{await DposAuth.selectUser(DposChains.viz,'bob','standard');finishTapos();}")
        page.wait_for_timeout(300);assert page.evaluate('sent.length')==4
        page.evaluate("async()=>{await DposAuth.selectUser(DposChains.viz,'alice','standard');taposDelay=false;}")
        open_agents()
        # Secret cleanup on close and vault lock; focus restoration.
        page.locator('#viz-agent-generate').click();wait(page,"!!document.querySelector('#viz-agent-private').value")
        page.keyboard.press('Escape');assert page.locator('#viz-agent-private').input_value()==''
        assert page.evaluate("document.activeElement.dataset.appModalOpen==='viz-agent-keys-details'")
        page.locator('#viz-manage-nav [data-app-modal-open="viz-agent-keys-details"]').click()
        page.locator('#viz-agent-generate').click();wait(page,"!!document.querySelector('#viz-agent-private').value")
        page.evaluate('()=>{window.handoffBeforeLock=document.querySelector("#viz-agent-private");DposVault.lock();}')
        assert page.evaluate("handoffBeforeLock.value === ''")
        assert page.evaluate("DposVault.status().state==='locked'")
        page.evaluate('async password=>{await DposVault.unlock({password});}', password)
        open_agents()
        page.evaluate("DposI18n.setLocale('en')")
        wait(page,"document.querySelector('#viz-agent-keys-details-title').textContent==='Agent keys'")
        for text in ['Срок разрешения истёк или безопасный срок транзакции недоступен. Проверьте дату UTC заново.', 'Результат отправки ключа агента неизвестен. Проверьте разрешения перед новой отправкой; автоматического повтора нет.', 'Транзакция ключа агента не включена: срок транзакции истёк. Автоматического повтора нет.']:
            assert page.evaluate('text=>DposI18n.t(text)!==text',text)
        assert 'Generate a key locally' in modal.inner_text()
        page.locator('#viz-agent-name').fill('english-preview')
        page.locator('#viz-agent-public').fill(page.evaluate('fixtureKeys.regularPubkey'))
        page.locator('#viz-agent-addons').fill('vizhub')
        page.evaluate('confirmAnswer=false'); send()
        assert 'Agent key:' in page.evaluate('confirmMessages.at(-1)')
        assert 'Agent operations:' in page.evaluate('confirmMessages.at(-1)')
        assert page.evaluate('sent.length') == 4
        # Delayed read must not repaint a newer route.
        page.evaluate('readDelay=true;finishRead=null');page.locator('#viz-agents-load').click();wait(page,'typeof finishRead==="function"')
        page.evaluate("async()=>{location.hash='#chain=viz&app=accounts';await DposV3.renderRoute();finishRead();}")
        page.wait_for_timeout(200);assert page.locator('#viz-agents-list').count()==0
        open_agents();page.evaluate('readDelay=true;failRead=null')
        page.locator('#viz-agents-load').click();wait(page,'typeof failRead==="function"')
        page.evaluate("async()=>{location.hash='#chain=viz&app=accounts';await DposV3.renderRoute();failRead();}")
        page.wait_for_timeout(200);assert page.locator('#viz-agents-result').count()==0
        assert not errors,errors
        assert page.evaluate('totalBroadcasts')==9
        print(json.dumps({'connected_cdp':True,'synthetic_signed_broadcasts':page.evaluate('totalBroadcasts'),'included_receipts':4,'failed_unknown_receipts':5,'real_broadcasts':0,'strict_receipt_no_retry_preserved_handoff':'PASS','async_deadline_zero_signatures_chain_ahead_bounded_validity':'PASS','virtual_cancel_excluded':'PASS','grant_update_revoke_addon_only':'PASS','single_flight_stale_route_account_tapos':'PASS','key_handoff_redaction_cleanup':'PASS','RU_EN_focus_trap_restore':'PASS','stale_read':'PASS','page_errors':errors}))
    finally:
        c.close()
        if owner: owner.close()
