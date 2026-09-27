import json,mimetypes,os
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[2];origin='https://dpos.blinddev.xyz';live=os.getenv('LIVE')=='1'
exports=['enhanceWalletForms','walletOperationFormData','bindMaxButtons','bindGrapheneWalletQuickActions','renderGolosWalletForms','renderVizWalletForms','renderHiveWalletForms','renderSteemWalletForms','renderMinterWalletForms','renderDecimalWalletForms','normalizeAssetInput','normalizeHumanAssetInput','walletExactAsset']
with sync_playwright() as p:
 b=p.chromium.connect_over_cdp('http://127.0.0.1:18800');c=b.new_context(service_workers='block');errors=[]
 def route(r):
  u=urlsplit(r.request.url);f=(root/(u.path.lstrip('/') or 'index.html')).resolve()
  if u.netloc==urlsplit(origin).netloc and root in f.parents and f.is_file():
   if u.path=='/v3/js/app.js':r.fulfill(body=(r.fetch().text() if live else f.read_text()).replace('  global.DposV3 = Object.freeze({','  global.walletQA={'+','.join(exports)+'};\n  global.DposV3 = Object.freeze({'),content_type='application/javascript')
   elif live:r.continue_()
   else:r.fulfill(path=str(f),content_type=mimetypes.guess_type(str(f))[0] or 'text/plain')
  else:r.fulfill(status=200,content_type='application/json',body='{"data":[],"result":[]}')
 c.route('**/*',route)
 try:
  page=c.new_page();page.on('pageerror',lambda e:errors.append(str(e)));page.goto(origin+'/#chain=viz&app=help');page.wait_for_function('!!window.walletQA')
  results=[]
  for chain in ['golos','viz','hive','steem','minter','decimal']:
   result=page.evaluate('''chain=>{
    const q=walletQA,c=DposChains[chain], name=chain[0].toUpperCase()+chain.slice(1);
    const profile={raw:{name:'viewed-other',balance:'12.345 '+c.liquidSymbol,vesting_shares:'100.000000 '+(c.vestingSymbol||'SHARES'),sbd_balance:'2.000 '+(c.debtSymbol||'GBG'),tip_balance:'1000.000 FINCOIN'},balances:[]};
    const html=q['render'+name+'WalletForms'](c,profile,[],[],[]);
    const root=document.createElement('div');root.id='qa-wallet';document.querySelector('#qa-wallet')?.remove();document.body.append(root);root.innerHTML=html;
    const me=chain==='minter'?'Mx'+'1'.repeat(40):chain==='decimal'?'0x'+'1'.repeat(40):'authorized-user';
    q.enhanceWalletForms(c,root,me);q.bindMaxButtons(root);
    const recipientInputs=[...root.querySelectorAll('form input')].filter(i=>/^(to|delegatee|receiver|newOwner)$/.test(i.name)&&!/(swap|convert|liquidity)-(from|to)|coin[01]?$/i.test(i.id));
    for(const i of recipientInputs){const b=i.parentElement.querySelector('[data-wallet-fill-me]');if(!b)throw Error(chain+' missing Me '+i.id);if(i.id==='minter-hub-to'){if(!b.disabled)throw Error('unsafe bridge recipient');continue;}b.click();if(i.value!==me)throw Error(chain+' wrong Me '+i.id);}
    const amounts=[...root.querySelectorAll('input[data-wallet-precision]')];if(!amounts.length)throw Error(chain+' no amounts');
    for(const i of amounts){if(i.type!=='number')throw Error('not number '+i.id);if(/[A-Za-zА-Яа-я]/.test(i.placeholder))throw Error('raw asset placeholder '+i.id+': '+i.placeholder);}
    return {chain,recipients:recipientInputs.length,amounts:amounts.length};
   }''',chain)
   results.append(result)
  assert not errors,errors
  print(json.dumps({'wallet_forms':results,'assets':'live' if live else 'local','broadcasts':0}))
 finally:c.close()
