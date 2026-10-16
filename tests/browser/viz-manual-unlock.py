"""VIZ manual-unlock authority: canonical entry, real SDK, synthetic RPC only.

Run: python3 tests/browser/viz-manual-unlock.py [case ...]
Each case uses a new nonpersistent browser context. No mainnet RPC can escape.
Includes authenticated restoration, exact sender admission and stale-await races.
"""
import json
import mimetypes
import sys
from pathlib import Path
from urllib.parse import urlsplit

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
ORIGIN = 'https://viz-manual-unlock-fixture.invalid'
PASSWORD = 'fixture-only-browser-password'
SCOPE = 'viz-self-award'
INIT = r"""
(() => {
 // Same explicitly synthetic scalar-one SDK fixture as web-reload-continuity.
 const WIF='5HpHagT65TZzG1PH3CSu63k8DbpvD8s5ip4nEB3kEsreAvUcVfH';
 window.fixtureWif=WIF;
 let sdk;
 Object.defineProperty(window,'viz',{configurable:true,get:()=>sdk,set:value=>{
  sdk=value;
  if(!sdk?.api || sdk.fixturePatched)return;
  sdk.fixturePatched=true;
  const sign=sdk.auth.signTransaction.bind(sdk.auth);
  sdk.auth.signTransaction=(...args)=>{localStorage.fixtureSignatures=String(Number(localStorage.fixtureSignatures||0)+1);return sign(...args);};
  const prepare=sdk.broadcast._prepareTransaction.bind(sdk.broadcast);
  sdk.broadcast._prepareTransaction=async(...args)=>{window.fixtureStage='prepare';if(localStorage.fixtureHoldPrepare)await new Promise((resolve,reject)=>{window.fixtureReleasePrepare=()=>reject(Error('fixture stale prepare failure'));});const result=await prepare(...args);window.fixtureStage='prepared';return result;};
  sdk.api.getAccountsAsync=async names=>names.map(name=>({name,energy:10000,
   last_vote_time:new Date().toISOString().slice(0,19),
   regular:{weight_threshold:1,key_auths:[[sdk.auth.wifToPublic(WIF),1]],account_auths:[]}}));
  sdk.api.getDynamicGlobalPropertiesAsync=async()=>({time:new Date().toISOString().slice(0,19),
   head_block_number:100,head_block_id:'000000640000007b'+'0'.repeat(24),last_irreversible_block_num:100});
  sdk.api.getAccountHistoryAsync=async()=>[];
  sdk.api.getBlockHeaderAsync=async()=>({previous:'000000620000007b'+'0'.repeat(24)});
  sdk.api.getBlockAsync=async()=>({previous:'000000620000007b'+'0'.repeat(24),
   transaction_ids:['1'.repeat(40)],transactions:[JSON.parse(localStorage.fixtureTransaction||'null')]});
  sdk.api.broadcastTransactionSynchronous=(tx,cb)=>{
   if(tx.signatures?.length!==1 || !/^[a-f0-9]{130}$/i.test(tx.signatures[0]))throw Error('real SDK signature required');
   if(!Number.isInteger(tx.ref_block_num)||!Number.isInteger(tx.ref_block_prefix)||!tx.expiration)throw Error('real SDK TAPOS required');
   if(tx.operations.length!==1 || tx.operations[0][0]!=='award' || tx.operations[0][1].initiator!=='alice' || tx.operations[0][1].receiver!=='alice')throw Error('only fixture self-award allowed');
   localStorage.fixtureSends=String(Number(localStorage.fixtureSends||0)+1);
   const unsigned={...tx};delete unsigned.signatures;
   localStorage.fixtureTransaction=JSON.stringify(unsigned);
   setTimeout(()=>cb(null,localStorage.fixtureMode==='unknown'?{}:{id:'1'.repeat(40),block_num:99,trx_num:0,expired:false}),10);
  };
 }});
})();
"""
CASES = [
    'valid', 'pending-unknown', 'no-start', 'legacy', 'settings-whitespace',
    'settings-value', 'settings-malformed', 'settings-null', 'settings-absent',
    'node-drift', 'network-drift', 'envelope-drift', 'stop-before', 'lock-before',
    'wrong-password', 'stop-during-password', 'lock-during-password',
    'ordinary-reload', 'ordinary-tamper', 'observer', 'observer-tamper',
    'live-settings', 'live-sdk', 'live-proof', 'fresh-after-drift', 'cache-node',
    'start-stop-success', 'start-stop-failure', 'verify-stop', 'verify-lock',
    'sign-stop', 'sign-lock', 'two-tab-verify-stop', 'two-tab-sign-stop',
    'post-save-stop', 'late-write-stop', 'proof-tamper', 'control-tamper',
    'resume-mixed', 'control-write-failure', 'restore-stop-success',
    'restore-stop-failure', 'two-tab-unlock', 'two-tab-start-rebind',
    'sdk-chain-drift', 'sdk-prefix-drift', 'no-mac-oracle', 'testnet-valid',
    'unusable-regular', 'control-corrupt', 'resume-corrupt', 'import-revoke',
    'passkey-valid', 'passkey-wrong', 'sender-stale-failure', 'control-extra', 'resume-ciphertext', 'start-resume-corrupt',
]


def run_case(browser, case):
    context = browser.new_context(service_workers='block')
    external = []
    errors = []

    def route(request):
        url = urlsplit(request.request.url)
        file = (ROOT / (url.path.lstrip('/') or 'index.html')).resolve()
        if url.netloc == urlsplit(ORIGIN).netloc and ROOT in file.parents and file.is_file():
            request.fulfill(path=str(file), content_type=mimetypes.guess_type(str(file))[0] or 'text/plain')
        else:
            # Never contact an external node, including websocket/HTTP SDK RPC.
            external.append(request.request.resource_type)
            request.fulfill(content_type='application/json', body='{"result":[],"data":[]}')

    context.route('**/*', route)
    context.route_web_socket('**/*', lambda socket: socket.close())
    if case.startswith('passkey-'):
        context.add_init_script("""(()=>{
          window.fixturePasskey=true;
          const credential=()=>({rawId:Uint8Array.of(1,2,3,4).buffer,getClientExtensionResults:()=>({prf:{enabled:true,results:{first:new Uint8Array(32).fill(localStorage.fixtureWrongPrf?8:7).buffer}}})});
          Object.defineProperty(navigator,'credentials',{configurable:true,value:{create:async()=>credential(),get:async()=>credential()}});
        })();""")
    context.add_init_script(INIT)
    page = context.new_page()
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.set_default_timeout(12000)

    def wait(expression):
        try:
            page.wait_for_function('() => (' + expression + ')')
        except Exception:
            print(json.dumps({'waitFailed': expression, 'diagnostic': page.evaluate("""() => ({stage:window.fixtureStage,vault:DposVault.status().state,admitted:DposVault.vizAutomationAdmitted(),runtime:{running:window.__dposVizSelfAwardRuntime?.running,tick:!!window.__dposVizSelfAwardRuntime?.tickPromise,reason:window.__dposVizSelfAwardRuntime?.diagnosticBlockedReason},nextAt:DposAutomationContinuity.diagnosticSnapshot().nextAt,now:Date.now(),sends:Number(localStorage.fixtureSends||0)})""")}), flush=True)
            raise

    def sends():
        return page.evaluate('Number(localStorage.fixtureSends||0)')

    def snapshot():
        return page.evaluate("""() => {
          const k=DposAutomationContinuity.storageKey('viz-self-award');
          return {ledger:localStorage.getItem(k),control:localStorage.getItem(k+'_control'),
            settings:localStorage.getItem('dpos_viz_self_award_settings'),
            envelope:localStorage.getItem('dpos_vault_v1'),
            resume:localStorage.getItem('dpos_vault_session_resume_v1')};
        }""")

    try:
        page.goto(ORIGIN + '/#chain=viz&app=accounts')
        wait('!!window.DposV3')
        if case == 'testnet-valid':
            page.evaluate("localStorage.dpos_network_viz='testnet'")
        page.evaluate("""async password => {
          await DposVault.setup(window.fixturePasskey?{passkey:true}:{password});
          const user=DposAuth.createKeyUser({id:'viz'},'alice',{regular:fixtureWif});
          await DposAuth.saveUser({id:'viz'},user);
          location.hash='#chain=viz&app=viz-self-award';
          await DposV3.renderRoute();
        }""", PASSWORD)
        if case == 'unusable-regular':
            page.evaluate("""async()=>{await DposVault.mutate(r=>{r.viz_users=[{type:'vizonator',last_login:'alice'}];r.viz_current_user=null;});await DposV3.renderRoute();}""")
            assert page.evaluate('DposAuth.getKeyStatus(DposChains.viz,DposAuth.getUsers(DposChains.viz)[0]).hasRegularOrPosting'), 'fixture must expose misleading external-account regular capability'
            page.locator('[data-viz-self-award-account] [name="enabled"]').check()
            page.locator('#viz-self-award-start').click()
            wait('__dposVizSelfAwardRuntime.startupError && !__dposVizSelfAwardRuntime.running')
            assert sends() == 0 and not json.loads(snapshot()['control'] or '{}').get('evidence'), 'unusable external regular key cannot mint consent'
            assert errors == []
            return {'case':case,'result':'PASS','syntheticSignedSends':0,'externalRequestsFulfilledLocally':len(external)}
        if case != 'no-start':
            if case == 'pending-unknown':
                page.evaluate("localStorage.fixtureMode='unknown'")
            page.locator('[data-viz-self-award-account] [name="enabled"]').check()
            page.locator('#viz-self-award-start').click()
            wait("__dposVizSelfAwardRuntime?.running && !__dposVizSelfAwardRuntime.tickPromise && Number(localStorage.fixtureSends)===1")
            expected = 'pending' if case == 'pending-unknown' else 'confirmed'
            assert page.evaluate("DposAutomationContinuity.pending('viz-self-award','alice').state") == expected
            if case == 'pending-unknown':
                # VIZ conservatively treats every reserved send as attempted;
                # only Golos persists a separate attempted flag in current code.
                assert page.evaluate("!!DposAutomationContinuity.pending('viz-self-award','alice').transaction"), 'unknown fixture must retain the SDK-normalized unsigned transaction'
        initial = snapshot()
        before = sends()
        signatures_before = page.evaluate('Number(localStorage.fixtureSignatures||0)')
        assert signatures_before == before, 'fixture must count actual SDK signatures'
        def passed():
            assert page.evaluate('Number(localStorage.fixtureSignatures||0)') == signatures_before, 'no stale signing in rejected/restored-await races'
            assert errors == [], 'unexpected production page errors'
            assert external == [], 'all fixture RPC must stay synthetic'
            return {'case': case, 'result': 'PASS', 'syntheticSignedSends': sends(), 'externalRequestsFulfilledLocally': len(external)}

        if case == 'sender-stale-failure':
            page.evaluate("localStorage.fixtureHoldPrepare='yes'")
            page.clock.install()
            page.clock.fast_forward(432001)
            page.clock.run_for(1000)
            wait('!!window.fixtureReleasePrepare')
            page.locator('#viz-self-award-stop').click()
            page.locator('#viz-self-award-start').click()
            wait('DposAutomationContinuity.readRun("viz-self-award").running && !!__dposVizSelfAwardRuntime.interval')
            accepted = snapshot()['control']
            page.evaluate('fixtureReleasePrepare()')
            wait('!__dposVizSelfAwardRuntime.tickPromise')
            assert snapshot()['control'] == accepted and page.evaluate('__dposVizSelfAwardRuntime.running')
            assert 'fixture stale prepare failure' not in page.locator('#viz-self-award-feed').inner_text(), 'old sender failure cannot repaint newer run'
            return passed()
        if case == 'start-resume-corrupt':
            page.locator('#viz-self-award-stop').click()
            page.evaluate("const r=JSON.parse(localStorage.dpos_vault_session_resume_v1);r.ciphertext='AAAA';localStorage.dpos_vault_session_resume_v1=JSON.stringify(r);")
            page.locator('#viz-self-award-start').click()
            wait('__dposVizSelfAwardRuntime.startupError || !!__dposVizSelfAwardRuntime.interval')
            assert not page.evaluate('DposAutomationContinuity.readRun("viz-self-award").running'), 'explicit Start cannot certify corrupt resume storage'
            return passed()
        if case == 'no-mac-oracle':
            assert not page.evaluate("Object.keys(DposVault).some(k=>/mac|derive|sign|material|cryptokey/i.test(k))"), 'no general key/MAC/signing oracle is exported'
            page.evaluate("async()=>{try{await DposVault.startVizAutomation([{payload:'arbitrary'}]);}catch(_){}}")
            assert snapshot()['control'] == initial['control'], 'fixed VIZ Start rejects arbitrary MAC payloads'
            return passed()

        if case.startswith('restore-stop-'):
            context.add_init_script("""(()=>{const original=crypto.subtle.verify.bind(crypto.subtle);crypto.subtle.verify=async(...args)=>{
              if((args[0]?.name||args[0])==='HMAC' && !window.fixtureHeldVerify){window.fixtureHeldVerify=true;await new Promise((resolve,reject)=>{window.fixtureReleaseCrypto=()=>window.fixtureFailCrypto?reject(Error('fixture delayed verify failure')):resolve();});}
              return original(...args);
            };})();""")
            page.reload(wait_until='domcontentloaded')
            wait('!!window.fixtureReleaseCrypto && !!document.querySelector("#viz-self-award-stop")')
            assert not page.locator('#viz-self-award-stop').is_disabled(), 'restored Stop must be installed before proof verification'
            page.locator('#viz-self-award-stop').click()
            page.locator('#viz-self-award-start').click()
            page.evaluate("kind=>{window.fixtureFailCrypto=kind==='restore-stop-failure';fixtureReleaseCrypto();}", case)
            wait('DposAutomationContinuity.readRun("viz-self-award").running && !!__dposVizSelfAwardRuntime.interval')
            page.wait_for_timeout(500)
            assert not page.locator('#viz-self-award-stop').is_disabled() and sends() == before
            return passed()

        if case in ['ordinary-reload', 'ordinary-tamper', 'observer', 'observer-tamper']:
            if case.endswith('tamper'):
                page.evaluate("""()=>{const k=DposAutomationContinuity.storageKey('viz-self-award')+'_control';const c=JSON.parse(localStorage.getItem(k));c.settings[0].minEnergy='9900';localStorage.setItem(k,JSON.stringify(c));const s=JSON.parse(localStorage.dpos_viz_self_award_settings);s.accounts.alice.minEnergy='9900';localStorage.dpos_viz_self_award_settings=JSON.stringify(s);}""")
            target = page
            if case.startswith('observer'):
                target = context.new_page()
                target.goto(ORIGIN + '/#chain=viz&app=viz-self-award')
            else:
                page.reload()
            target.wait_for_function('window.DposV3 && DposVault.status().state==="unlocked" && !!window.__dposVizSelfAwardRuntime')
            target.wait_for_timeout(900)
            admitted = target.evaluate("DposAutomationContinuity.readRun('viz-self-award').running")
            assert admitted == (not case.endswith('tamper')), 'all restored admissions must authenticate exact settings/proof'
            assert sends() == before, 'restoration cannot skip cadence'
            return passed()

        if case in ['live-settings', 'live-sdk', 'live-proof', 'fresh-after-drift', 'cache-node']:
            page.evaluate("""kind=>{
              window.fixtureGuard=DposAutomationContinuity.guard('viz-self-award');
              if(kind==='live-sdk')viz.config.set('chain_id','0'.repeat(64));
              else if(kind==='cache-node')localStorage.viz_node='https://node.viz.cx';
              else if(kind==='live-proof'){const k=DposAutomationContinuity.storageKey('viz-self-award')+'_control';const c=JSON.parse(localStorage.getItem(k));c.evidence.mac='A'.repeat(44);localStorage.setItem(k,JSON.stringify(c));}
              else localStorage.dpos_viz_self_award_settings+=' ';
            }""", case)
            guarded = page.evaluate("()=>{try{fixtureGuard();return true;}catch(_){return false;}}")
            assert guarded == (case == 'cache-node'), 'sender guard must synchronously invalidate mutated exact authority, not cache writes'
            if case == 'fresh-after-drift':
                page.evaluate("async()=>{await DposV3.renderRoute();}")
                wait('!__dposVizSelfAwardRuntime.running')
                page.locator('[name="minEnergy"]').fill('99')
                page.locator('#viz-self-award-start').click()
                wait('DposAutomationContinuity.readRun("viz-self-award").running && !!__dposVizSelfAwardRuntime.interval')
                assert str(page.evaluate('DposAutomationContinuity.readRun("viz-self-award").settings[0].minEnergy')) == '9900'
            assert sends() == before
            return passed()

        if case.startswith('start-stop-'):
            page.locator('#viz-self-award-stop').click()
            page.evaluate("""()=>{const original=crypto.subtle.sign.bind(crypto.subtle);crypto.subtle.sign=async(...args)=>{
              if(args[0]==='HMAC')await new Promise((resolve,reject)=>{window.fixtureReleaseCrypto=()=>window.fixtureFailCrypto?reject(Error('fixture delayed crypto failure')):resolve();});
              return original(...args);
            };}""")
            page.locator('#viz-self-award-start').click()
            wait('!!window.fixtureReleaseCrypto')
            assert not page.locator('#viz-self-award-stop').is_disabled(), 'Stop must be usable while explicit Start awaits HMAC'
            page.locator('#viz-self-award-stop').click()
            # Queue a newer Start while the older vault-serialized attempt is held.
            # Stop invalidates the older attempt; restore native signing for the new one.
            page.evaluate("""()=>{window.fixtureHeldSign=crypto.subtle.sign;crypto.subtle.sign=SubtleCrypto.prototype.sign.bind(crypto.subtle);}""")
            page.locator('#viz-self-award-start').click()
            page.evaluate("kind=>{window.fixtureFailCrypto=kind==='start-stop-failure';fixtureReleaseCrypto();}", case)
            wait('DposAutomationContinuity.readRun("viz-self-award").running && !!__dposVizSelfAwardRuntime.interval')
            newer = snapshot()['control']
            page.wait_for_timeout(500)
            assert snapshot()['control'] == newer, 'late older result cannot stop or repaint newer Start'
            assert page.evaluate('__dposVizSelfAwardRuntime.running && !!__dposVizSelfAwardRuntime.interval')
            assert page.locator('#viz-self-award-start').is_disabled() and not page.locator('#viz-self-award-stop').is_disabled()
            assert sends() == before
            return passed()

        mutations = {
            'resume-ciphertext': "const r=JSON.parse(localStorage.dpos_vault_session_resume_v1);r.ciphertext='AAAA';localStorage.dpos_vault_session_resume_v1=JSON.stringify(r);",
            'control-extra': "const k=DposAutomationContinuity.storageKey('viz-self-award')+'_control',c=JSON.parse(localStorage.getItem(k));c.unapproved='extra';localStorage.setItem(k,JSON.stringify(c));",
            'passkey-wrong': "localStorage.fixtureWrongPrf='yes';",
            'control-corrupt': "localStorage.setItem(DposAutomationContinuity.storageKey('viz-self-award')+'_control','{');",
            'resume-corrupt': "localStorage.dpos_vault_session_resume_v1='{';",
            'proof-tamper': "const k=DposAutomationContinuity.storageKey('viz-self-award')+'_control',c=JSON.parse(localStorage.getItem(k));c.evidence.mac='A'.repeat(44);localStorage.setItem(k,JSON.stringify(c));",
            'control-tamper': "const k=DposAutomationContinuity.storageKey('viz-self-award')+'_control',c=JSON.parse(localStorage.getItem(k));c.epoch+=5;localStorage.setItem(k,JSON.stringify(c));",
            'resume-mixed': "const r=JSON.parse(localStorage.dpos_vault_session_resume_v1);r.iv='A'.repeat(16);localStorage.dpos_vault_session_resume_v1=JSON.stringify(r);",
            'legacy': "const k=DposAutomationContinuity.storageKey('viz-self-award')+'_control',c=JSON.parse(localStorage.getItem(k));localStorage.setItem(k,JSON.stringify(Object.fromEntries(['version','running','epoch','binding','settings'].map(key=>[key,c[key]]))));",
            'settings-whitespace': "localStorage.dpos_viz_self_award_settings+=' ';",
            'settings-value': "const s=JSON.parse(localStorage.dpos_viz_self_award_settings);s.accounts.alice.minEnergy='9900';localStorage.dpos_viz_self_award_settings=JSON.stringify(s);",
            'settings-malformed': "localStorage.dpos_viz_self_award_settings='{';",
            'settings-null': "localStorage.dpos_viz_self_award_settings='null';",
            'settings-absent': "localStorage.removeItem('dpos_viz_self_award_settings');",
            'network-drift': "localStorage.dpos_network_viz='testnet';",
            'stop-before': "DposAutomationContinuity.stop('viz-self-award');",
            'lock-before': "DposVault.lock();",
        }
        if case in mutations:
            page.evaluate('() => {' + mutations[case] + '}')
        if case == 'import-revoke':
            page.evaluate('async()=>{await DposVault.import(DposVault.export());}')
        if case == 'envelope-drift':
            page.evaluate("async()=>{await DposVault.mutate(r=>{r.viz_users[0].fixtureRevision='changed';});}")
        if case == 'node-drift':
            context.add_init_script("""(()=>{let chains;Object.defineProperty(window,'DposChains',{configurable:true,get:()=>chains,set:value=>{chains=value;value.viz.nodes.reverse();}});})();""")
        if case in ['sdk-chain-drift', 'sdk-prefix-drift']:
            context.add_init_script("""(()=>{const descriptor=Object.getOwnPropertyDescriptor(window,'viz');Object.defineProperty(window,'viz',{configurable:true,get:descriptor.get,set:sdk=>{descriptor.set(sdk);if(sdk?.config)sdk.config.set(localStorage.fixtureSdkDrift==='chain'?'chain_id':'address_prefix',localStorage.fixtureSdkDrift==='chain'?'0'.repeat(64):'BAD');}});})();""")
            page.evaluate("kind=>{localStorage.fixtureSdkDrift=kind==='sdk-chain-drift'?'chain':'prefix';}", case)
        # Cookie is lost BEFORE vault initialization, not after a successful resume.
        context.clear_cookies()
        page.reload()
        wait('window.DposVault?.status().state==="locked" && !!window.DposV3')
        saved = snapshot()
        assert saved['ledger'] == initial['ledger'], 'cookie loss must not rewrite ledger/deadline'
        rejected = False
        if case in ['two-tab-unlock', 'two-tab-start-rebind']:
            peer = context.new_page()
            peer.goto(ORIGIN + '/#chain=viz&app=accounts')
            peer.wait_for_function('window.DposV3 && DposVault.status().state==="locked"')
            page.evaluate("""password=>{const original=crypto.subtle.sign.bind(crypto.subtle);crypto.subtle.sign=async(...args)=>{
              if((args[0]?.name||args[0])==='HMAC')await new Promise(resolve=>{window.fixtureReleaseCrypto=resolve;});return original(...args);
            };window.fixtureUnlock=DposVault.unlock({password}).then(()=>true,()=>false);}""", PASSWORD)
            wait('!!window.fixtureReleaseCrypto')
            peer.wait_for_function('DposVault.status().state==="unlocked"')
            if case == 'two-tab-start-rebind':
                peer.evaluate("""()=>{DposAutomationContinuity.stop('viz-self-award');window.fixtureNewStart=DposAutomationContinuity.start('viz-self-award',[{account:'alice',enabled:true,minEnergy:9500}]).then(()=>true,()=>false);}""")
            page.evaluate('fixtureReleaseCrypto()')
            assert page.evaluate('fixtureUnlock'), 'valid unlock must finish without deadlock'
            if case == 'two-tab-start-rebind':
                assert peer.evaluate('fixtureNewStart'), 'new explicit Start queued behind rebind must own current Stop token'
            else:
                peer.evaluate('async()=>{await DposV3.renderRoute();}')
                peer.wait_for_function('DposAutomationContinuity.readRun("viz-self-award").running')
            assert snapshot()['ledger'] == saved['ledger'] and sends() == before
            # Both tabs must independently verify the one current authority.
            page.evaluate('async()=>{await DposV3.renderRoute();}')
            assert page.evaluate('DposAutomationContinuity.readRun("viz-self-award").running')
            return passed()
        if case in ['verify-stop', 'verify-lock', 'sign-stop', 'sign-lock', 'two-tab-verify-stop', 'two-tab-sign-stop', 'post-save-stop', 'late-write-stop', 'control-write-failure']:
            peer = None
            if case.startswith('two-tab'):
                peer = context.new_page()
                peer.goto(ORIGIN + '/#chain=viz&app=accounts')
                peer.wait_for_function('window.DposV3 && DposVault.status().state==="locked"')
            if case in ['late-write-stop', 'control-write-failure']:
                page.evaluate("""kind=>{
                  const set=Storage.prototype.setItem,k=DposAutomationContinuity.storageKey('viz-self-award')+'_control';
                  Storage.prototype.setItem=function(key,value){
                    if(key===k && JSON.parse(value).running && !window.fixtureWriteInterleaved){
                      window.fixtureWriteInterleaved=true;
                      if(kind==='control-write-failure')throw Error('fixture control unavailable');
                      DposAutomationContinuity.stop('viz-self-award');
                    }
                    return set.call(this,key,value);
                  };
                }""", case)
                page.evaluate("async password=>{try{await DposVault.unlock({password});}catch(_){}}", PASSWORD)
                assert page.evaluate('!!window.fixtureWriteInterleaved'), 'must reach post-HMAC control write'
            else:
                method = 'verify' if 'verify' in case else 'sign'
                page.evaluate("""([password,method])=>{
                  const original=crypto.subtle[method].bind(crypto.subtle);
                  crypto.subtle[method]=async(...args)=>{
                    if((args[0]?.name || args[0])==='HMAC')await new Promise(resolve=>{window.fixtureReleaseCrypto=resolve;});
                    return original(...args);
                  };
                  window.fixtureUnlock=DposVault.unlock({password}).then(()=>true,()=>false);
                }""", [PASSWORD, method])
                wait('!!window.fixtureReleaseCrypto')
                if method == 'sign':
                    assert snapshot()['resume'] != saved['resume'], 'held sign must be AFTER saveResume rotation'
                actor = peer or page
                elapsed = actor.evaluate("""kind=>{const t=performance.now();if(kind.endsWith('lock'))DposVault.lock();else DposAutomationContinuity.stop('viz-self-award');return performance.now()-t;}""", case)
                assert elapsed < 1000, 'Stop/Lock cannot wait for vault serialization or crypto'
                stopped = snapshot()['control']
                page.evaluate('fixtureReleaseCrypto()')
                page.evaluate('fixtureUnlock')
                assert snapshot()['control'] == stopped, 'late verify/sign cannot overwrite Stop control/epoch'
            assert snapshot()['ledger'] == saved['ledger'], 'races cannot alter pending/deadline/cursor bytes'
            if page.evaluate('DposVault.status().state') == 'unlocked':
                assert not page.evaluate('DposAutomationContinuity.readRun("viz-self-award").running'), 'late write cannot revive separate Stop authority'
            page.wait_for_timeout(500)
            assert sends() == before
            return passed()
        if case.endswith('during-password'):
            page.evaluate("""password => {
              const original=crypto.subtle.deriveBits.bind(crypto.subtle);
              crypto.subtle.deriveBits=async(...args)=>{
                if(args[0].name==='PBKDF2')await new Promise(resolve=>{window.fixtureReleasePassword=resolve;});
                return original(...args);
              };
              window.fixtureUnlock=DposVault.unlock({password}).then(()=>true,()=>false);
            }""", PASSWORD)
            wait('!!window.fixtureReleasePassword')
            stopped = page.evaluate("""kind => {
              const started=performance.now();
              if(kind==='stop-during-password')DposAutomationContinuity.stop('viz-self-award');
              else DposVault.lock();
              return {elapsed:performance.now()-started,control:localStorage.getItem(DposAutomationContinuity.storageKey('viz-self-award')+'_control')};
            }""", case)
            assert stopped['elapsed'] < 1000, 'Stop/Lock must not wait for credential crypto or vault lock'
            page.evaluate('fixtureReleasePassword()')
            rejected = not page.evaluate('fixtureUnlock')
            if case.startswith('stop-'):
                assert snapshot()['control'] == stopped['control'], 'late unlock must not overwrite Stop or its epoch'
        else:
            rejected = not page.evaluate("""async ([password,wrong]) => {
              try {await DposVault.unlock({password:wrong?'definitely-wrong-fixture-password':password});return true;}
              catch (_) {return false;}
            }""", [PASSWORD, case == 'wrong-password'])
        after = snapshot()
        assert after['ledger'] == saved['ledger'], 'unlock/rebind must preserve exact ledger/deadline/recovery cursor bytes'
        assert after['envelope'] == saved['envelope'], 'unlock cannot rewrite account/key envelope'
        if case in ['valid', 'pending-unknown', 'testnet-valid', 'passkey-valid']:
            assert not rejected, 'valid credentials must unlock'
            assert page.evaluate("DposAutomationContinuity.readRun('viz-self-award').running"), 'authenticated saved Start must rebind after cookie loss and manual unlock'
            old_control = json.loads(saved['control'])
            new_control = json.loads(after['control'])
            assert new_control['epoch'] > old_control['epoch'], 'rebind must advance current authority epoch'
            assert new_control['settings'] == old_control['settings'], 'rebind cannot reinterpret selected settings'
            assert new_control['binding'] != old_control['binding'], 'session capability must rotate'
            assert after['settings'] == saved['settings'], 'ordinary settings bytes must not change'
            await_render = "async()=>{await DposV3.renderRoute();}"
            page.evaluate(await_render)
            wait('__dposVizSelfAwardRuntime?.running && !!__dposVizSelfAwardRuntime.interval')
            assert snapshot()['ledger'] == saved['ledger'], 'production resume must keep remaining deadline'
            page.wait_for_timeout(1200)
            assert sends() == before, 'manual unlock must not send an immediate extra award'
            if case in ['valid', 'testnet-valid', 'passkey-valid']:
                # Advance the browser clock, not the durable deadline or runtime.
                page.clock.install()
                page.clock.fast_forward(432001)
                page.clock.run_for(1500)
                wait("Number(localStorage.fixtureSends)===2 && !__dposVizSelfAwardRuntime.tickPromise")
                page.wait_for_timeout(1100)
                assert sends() == 2, 'one eligible future interval must send exactly one SDK-signed award'
            else:
                page.clock.install()
                page.clock.fast_forward(432001)
                page.wait_for_timeout(1200)
                assert sends() == before, 'attempted unknown transaction must never replay after rebind/due tick'
                pending = json.loads(snapshot()['ledger'])['intents']['alice']
                assert pending == json.loads(saved['ledger'])['intents']['alice'], 'unknown intent must remain exact and pending'
        else:
            if case in ['wrong-password', 'lock-during-password', 'passkey-wrong']:
                assert rejected, 'wrong credentials or concurrent Lock must reject unlock'
            if page.evaluate('DposVault.status().state') == 'unlocked':
                assert not page.evaluate("()=>{try{return DposAutomationContinuity.readRun('viz-self-award').running;}catch(_){return false;}}"), 'unsafe/legacy saved Start must require a new explicit Start'
            if case in ['wrong-password', 'no-start', 'legacy']:
                assert after['control'] == saved['control'], 'unlock must never mint/backfill a legacy Start proof'
            page.wait_for_timeout(1100)
            assert sends() == before, 'rejected authority must not send'
            assert page.evaluate('Number(localStorage.fixtureSignatures||0)') == signatures_before, 'rejected authority must not sign'
        assert not page.evaluate("Object.values(localStorage).join('').includes(window.fixtureWif) || Object.values(localStorage).join('').includes('fixture-only-browser-password')"), 'plaintext fixture secrets must not persist'
        assert errors == [], 'unexpected production page errors'
        return {'case': case, 'result': 'PASS', 'syntheticSignedSends': sends(), 'externalRequestsFulfilledLocally': len(external)}
    finally:
        context.close()


def main():
    cases = sys.argv[1:] or CASES
    assert all(case in CASES for case in cases), 'unknown fixture case'
    results = []
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
        try:
            for case in cases:
                try:
                    result = run_case(browser, case)
                except Exception as error:
                    # Do not emit page storage, proof, account records or keys.
                    result = {'case': case, 'result': 'FAIL', 'errorType': type(error).__name__,
                              'reason': str(error) if isinstance(error, AssertionError) else 'fixture execution error (inspect locally)'}
                results.append(result)
                print(json.dumps(result), flush=True)
        finally:
            browser.close()
    failed = sum(row['result'] == 'FAIL' for row in results)
    print(json.dumps({'cases': len(results), 'failed': failed, 'mainnetBroadcasts': 0}), flush=True)
    return bool(failed)


if __name__ == '__main__':
    sys.exit(main())
