import json, os, mimetypes
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[2]; origin='https://dpos.blinddev.xyz';live=os.getenv('LIVE')=='1'
with sync_playwright() as p:
 b=p.chromium.connect_over_cdp('http://127.0.0.1:18800');c=b.new_context(service_workers='block');errors=[]
 c.add_init_script("""window.inboxCalls=[];window.inboxUnread=35;window.DposAndroidTransport={postMessage(raw){const r=JSON.parse(raw);inboxCalls.push(r.method);let result;if(r.method==='getAppInfo')result={notificationInbox:true};else if(r.method==='getNotificationInbox')result={ok:true,unreadCount:inboxUnread,events:[{id:'fixture',title:'VIZ: награда',text:'Получена награда 1.734 VIZ',route:'#chain=viz&app=notifications',read:inboxUnread===0}]};else if(r.method==='markAllNotificationsRead'){inboxUnread=0;result={ok:true,unreadCount:0};}else throw Error('Unexpected '+r.method);queueMicrotask(()=>this.onmessage({data:JSON.stringify({version:2,id:r.id,ok:true,result})}));}};""")
 def route(r):
  u=urlsplit(r.request.url);f=(root/(u.path.lstrip('/') or 'index.html')).resolve()
  if u.netloc==urlsplit(origin).netloc and root in f.parents and f.is_file():
   if live:r.continue_()
   else:r.fulfill(path=str(f),content_type=mimetypes.guess_type(str(f))[0] or 'text/plain')
  else:r.fulfill(status=200,content_type='application/json',body='{"data":[],"result":[]}')
 c.route('**/*',route)
 try:
  page=c.new_page();page.on('pageerror',lambda e:errors.append(str(e)));page.goto(origin+'/#app=notifications')
  page.wait_for_function("document.querySelector('[data-inbox-count]')?.textContent==='35'")
  assert page.evaluate('inboxUnread')==35
  assert 'markAllNotificationsRead' not in page.evaluate('inboxCalls')
  assert '1.734 VIZ' in page.locator('[data-inbox-events]').inner_text()
  page.select_option('#language-select','en')
  page.get_by_role('heading',name='Notifications from all blockchains',exact=True).wait_for()
  page.locator('[data-inbox-read]').click()
  page.wait_for_function("document.querySelector('[data-inbox-count]')?.textContent==='0'")
  assert page.evaluate("inboxCalls.filter(x=>x==='markAllNotificationsRead').length")==1
  assert not errors,errors
  print(json.dumps({'global_inbox':'PASS','retained_total':35,'read_all':'PASS','RU_EN':'PASS','automatic_mark_read':False,'native':'mock','assets':'production' if live else 'local'}))
 finally:c.close()
