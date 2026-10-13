import json
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[2]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 c=b.new_context(service_workers='block')
 def route(r):
  if r.request.url.endswith('/vault.js'): r.fulfill(path=str(root/'v3/js/vault.js'),content_type='text/javascript; charset=utf-8')
  elif r.request.url.endswith('/sjcl.js'): r.fulfill(path=str(root/'v3/vendor/golos/sjcl.min.js'),content_type='text/javascript')
  else: r.fulfill(body='<script src="/sjcl.js"></script><script src="/vault.js"></script>',content_type='text/html')
 c.route('**/*',route)
 c.add_init_script("window.events=0;window.locks=0;addEventListener('storage',()=>events++);addEventListener('dpos-vault-lock',()=>locks++);")
 a=c.new_page();a.goto('https://review.invalid/');a.evaluate("async()=>{await DposVault.setup({password:'review-fixture-password'});}")
 z=c.new_page();z.goto('https://review.invalid/');z.wait_for_function("DposVault.status().state==='unlocked'")
 a.evaluate('window.oldGuard=DposVault.issueGuard();DposVault.lock()');a.wait_for_timeout(500)
 def state(page):return page.evaluate("()=>({state:DposVault.status().state,events,locks,revocation:localStorage.dpos_vault_session_revocation_v1})")
 print('afterLock',json.dumps([state(a),state(z)]))
 settled=[state(a),state(z)];a.wait_for_timeout(300)
 assert [state(a),state(z)]==settled, 'revocation events must settle'
 assert all(x['state']=='locked' for x in settled)
 try:a.evaluate("async()=>{await DposVault.unlock({password:'review-fixture-password'});}")
 except Exception as e:print('unlockError',str(e)[:200])
 a.wait_for_timeout(500)
 print('afterUnlock',json.dumps([state(a),state(z)]))
 assert all(state(t)['state']=='unlocked' for t in [a,z])
 assert a.evaluate("()=>{try{DposVault.assertGuard(oldGuard);return false;}catch(_){return true;}}")
 fresh=a.evaluate("localStorage.dpos_vault_session_resume_v1")
 for t in [a,z]:
  t.evaluate("old=>{dispatchEvent(new StorageEvent('storage',{key:'dpos_vault_session_revocation_v1',newValue:old}));dispatchEvent(new StorageEvent('storage',{key:'dpos_vault_session_resume_v1',newValue:null}));}",'obsolete-revocation-event')
 a.wait_for_timeout(300)
 assert a.evaluate("localStorage.dpos_vault_session_resume_v1")==fresh
 assert all(state(t)['state']=='unlocked' for t in [a,z])
 z.evaluate("async()=>{await DposVault.unlock({password:'review-fixture-password'});}")
 a.wait_for_timeout(500)
 assert all(state(t)['state']=='unlocked' for t in [a,z])
 for t in [a,z]:t.evaluate('DposVault.read();DposVault.assertGuard(DposVault.issueGuard())')
 settled=[state(a),state(z)];a.wait_for_timeout(300)
 assert [state(a),state(z)]==settled
 print('PASS settled two-tab lock, manual unlock each tab, stale events preserve fresh capability')
 c.close();b.close()
