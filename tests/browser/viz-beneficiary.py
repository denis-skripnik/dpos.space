import json, os, mimetypes
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[2];origin='https://dpos.blinddev.xyz';live=os.getenv('LIVE')=='1'
with sync_playwright() as p:
 b=p.chromium.connect_over_cdp('http://127.0.0.1:18800');c=b.new_context(service_workers='block');errors=[]
 def route(r):
  u=urlsplit(r.request.url);f=(root/(u.path.lstrip('/') or 'index.html')).resolve()
  if u.netloc==urlsplit(origin).netloc and root in f.parents and f.is_file():
   if live:r.continue_()
   else:r.fulfill(path=str(f),content_type=mimetypes.guess_type(str(f))[0] or 'text/plain')
  else:r.fulfill(status=200,content_type='application/json',body='{"result":[],"data":[]}')
 c.route('**/*',route)
 try:
  page=c.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(origin+'/#chain=viz&app=awards')
  page.locator('#award-beneficiaries').wait_for()
  page.select_option('#language-select','ru')
  page.get_by_text('Бенефициарские отчисления сервису: 1% награды — @denis-skripnik. Добавляются автоматически, без отдельной галочки.',exact=True).wait_for()
  assert page.locator('#award-beneficiaries').input_value()=='denis-skripnik:1'
  assert '1% награды' in page.locator('#app').inner_text()
  page.evaluate("location.hash='#chain=viz&app=awards&awardPage=builder'")
  page.locator('#builder-app-beneficiary').wait_for()
  assert page.locator('#builder-app-beneficiary-enabled').get_attribute('type')=='hidden'
  assert page.locator('#builder-app-beneficiary-enabled').input_value()=='on'
  assert page.locator('#builder-app-beneficiary-percent').input_value()=='1'
  page.evaluate("location.hash='#chain=viz&app=viz-self-award'")
  page.locator('#viz-self-award-heading').wait_for()
  assert '1% награды' in page.locator('#app').inner_text()
  page.select_option('#language-select','en')
  page.get_by_text('Service beneficiary allocation: 1% of the reward to @denis-skripnik. Included automatically, with no separate checkbox.',exact=True).wait_for()
  assert not errors,errors
  print(json.dumps({'awards_defaults':'PASS','builder_default':'PASS','self_award_disclosure_RU_EN':'PASS','broadcasts':0,'assets':'production' if live else 'local'}))
 finally:c.close()
