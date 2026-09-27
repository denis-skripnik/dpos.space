"""Exercise editor submission/modal UI with a fake broadcaster: no network transactions."""
import json,mimetypes,os
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[2];origin='https://dpos.blinddev.xyz';live=os.environ.get('LIVE')=='1'
with sync_playwright() as p:
 b=p.chromium.connect_over_cdp('http://127.0.0.1:18800');c=b.new_context(service_workers='block');errors=[]
 def route(r):
  u=urlsplit(r.request.url);f=(root/(u.path.lstrip('/') or 'index.html')).resolve()
  if u.netloc==urlsplit(origin).netloc and f.is_file() and root in f.parents:
   if u.path=='/v3/js/app.js':
    s=r.fetch().text() if live else f.read_text()
    s=s.replace('const auth = global.DposAuth;',"const auth = {...global.DposAuth,getCurrentLogin:()=> 'alice',getCurrentUser:()=>({login:'alice'}),getUsers:()=>[{login:'alice'}]};")
    s=s.replace('const broadcast = global.DposBroadcast;',"const broadcast = {...global.DposBroadcast,prepare:(c,a,n,params)=>({chain:c.id,authority:a,operationName:n,params,meta:{}}),broadcast:async(c,p,s)=>{if(s.dryRun)return {message:'Preview'};global.qaSends=(global.qaSends||0)+1;global.qaPost=p.params[0][0][1];if(global.qaFail)throw Error('test unknown');return {ok:true};}};")
    s=s.replace('const profiles = global.DposProfiles;',"const profiles = {...global.DposProfiles,connect:async()=>({}),apiCall:async()=>global.qaPost};")
    s=s.replace('  global.DposV3 = Object.freeze({','  global.editorQA={renderEditor,upgradeOperationDetailsToModals};\n  global.DposV3 = Object.freeze({')
    r.fulfill(body=s,content_type='application/javascript')
   elif live:r.continue_()
   else:r.fulfill(path=str(f),content_type=mimetypes.guess_type(str(f))[0] or 'text/plain')
  else:r.fulfill(status=200,content_type='application/json',body='{}')
 c.route('**/*',route)
 try:
  accept=[True];page=c.new_page();page.on('pageerror',lambda e:errors.append(str(e)));page.on('dialog',lambda d:d.accept() if accept[0] else d.dismiss())
  page.goto(origin+'/#chain=golos&app=help');page.wait_for_function('()=>!!window.editorQA');page.locator('#language-select').select_option('ru')
  for chain in ['golos','hive','steem']:
   page.evaluate("chain=>{editorQA.renderEditor(DposChains[chain],{});editorQA.upgradeOperationDetailsToModals(document.getElementById('app'));}",chain)
   page.locator('[data-app-modal-open="editor-operation-details"]').click()
   page.locator('#editor-title').fill('Publication test');page.locator('#editor-permlink').fill('publication-test');page.locator('#editor-body').fill('Test body');page.locator('#editor-tags').fill('test')
   if chain=='golos':
    accept[0]=False;page.locator('#editor-form button[value="send"]').click()
    page.wait_for_function("()=>document.querySelector('#editor-form [data-operation-result]').textContent.includes('отменена')")
    assert page.locator('#editor-publication-result').is_hidden();assert page.evaluate('window.qaSends||0')==0;accept[0]=True
   page.locator('#editor-form button[value="send"]').click()
   page.wait_for_function("()=>document.getElementById('editor-publication-result').textContent.includes('Пост опубликован.')")
   page.keyboard.press('Escape')
   link=page.locator('#editor-publication-result a');assert link.is_visible();assert 'chain='+chain in link.get_attribute('href');assert 'permlink=publication-test' in link.get_attribute('href')
   assert page.locator('#editor-title').input_value()=='Publication test'
  assert page.evaluate('qaSends')==3
  page.locator('#language-select').select_option('en');page.wait_for_function("()=>document.querySelector('#editor-publication-result a').textContent==='Open post in DPoS Space'")
  assert not errors,errors
  print(json.dumps({'chains':['golos','hive','steem'],'modal_close_link_and_draft_preserved':'PASS','RU_EN':'PASS','real_broadcasts':0,'assets':'live' if live else 'local'}))
 finally:c.close()
