"""Browser DOM + real router regression; deterministic quotes, never signs/broadcasts."""
import json, mimetypes, os
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[2]
origin='https://dpos.blinddev.xyz'
live=os.getenv('LIVE')=='1'
with sync_playwright() as p:
 b=p.chromium.connect_over_cdp('http://127.0.0.1:18800'); c=b.new_context(service_workers='block'); errors=[]
 def route(r):
  u=urlsplit(r.request.url); f=(root/(u.path.lstrip('/') or 'index.html')).resolve()
  if u.netloc==urlsplit(origin).netloc and root in f.parents and f.is_file():
   if u.path=='/v3/js/app.js':
    source=(r.fetch().text() if live else f.read_text())
    source=source.replace('  global.DposV3 = Object.freeze({','  global.swapQA={renderGolosWalletBalances};\n  global.DposV3 = Object.freeze({')
    r.fulfill(body=source,content_type='application/javascript')
   elif live:r.continue_()
   else:r.fulfill(path=str(f),content_type=mimetypes.guess_type(str(f))[0] or 'text/plain')
  else:r.fulfill(status=200,content_type='application/json',body='{"data":[],"result":[]}')
 c.route('**/*',route)
 try:
  page=c.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(origin+'/#chain=golos&app=help');page.wait_for_function('!!window.swapQA && !!window.DposGolosWalletSwap')
  page.locator('#language-select').select_option('ru')
  page.evaluate('''async()=>{
    const root=document.createElement('div');root.id='swap-qa';root.setAttribute('data-i18n-root','');document.body.append(root);
    root.innerHTML=swapQA.renderGolosWalletBalances({raw:{balance:'12.000 GOLOS',sbd_balance:'2.000 GBG'}},[
     ['GOLD','20.000 GOLD',{kind:'uia',symbol:'GOLD',balanceType:'main'}],
     ['GOLD','5.000 GOLD',{kind:'uia',symbol:'GOLD',balanceType:'tip'}],
     ['EMPTY','1.000 EMPTY',{kind:'uia',symbol:'EMPTY',balanceType:'main'}]]);
    const dex={getExchange:async r=>r.amount.endsWith(' GOLD')&&r.symbol==='GOLOS'?{best:{res:'2.000 GOLOS',steps:[['limit_order_create',{}]]}}:null,makeExchangeTx:async s=>s};
    await DposGolosWalletSwap.attach(root,{chain:{...DposChains.golos,wsEndpoint:'wss://api-full.golos.id/ws'},account:'alice',ensureDex:async()=>dex,
     balances:[{symbol:'GOLD',amount:'20.000 GOLD',balanceType:'main'},{symbol:'GOLD',amount:'5.000 GOLD',balanceType:'tip'},{symbol:'EMPTY',amount:'1.000 EMPTY',balanceType:'main'}]});
  }''')
  assert page.locator('#swap-qa [data-golos-wallet-swap]').count()==1
  link=page.locator('#swap-qa [data-golos-wallet-swap="GOLD"]')
  assert 'основной' in link.locator('..').inner_text()
  page.locator('#language-select').select_option('en')
  page.wait_for_function("()=>document.querySelector('#swap-qa [data-golos-wallet-swap]').textContent==='Swap to GOLOS'")
  link.press('Enter')
  page.wait_for_selector('#swap-direct-sell-symbol',state='attached')
  assert page.locator('#swap-direct-sell-symbol').input_value()=='GOLD'
  assert page.locator('#swap-direct-buy-symbol').input_value()=='GOLOS'
  assert page.locator('#swap-direct-sell-amount').get_attribute('type')=='number'
  assert not errors,errors
  print(json.dumps({'wallet_swap_link':'PASS','main_only_and_no_quote_hidden':'PASS','RU_EN':'PASS','keyboard_route_prefill':'GOLD -> GOLOS','assets':'live' if live else 'local','broadcasts':0}))
 finally:c.close()
