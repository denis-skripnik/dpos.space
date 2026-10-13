const assert = require('assert'), fs = require('fs'), vm = require('vm');
const { webcrypto } = require('crypto');
function storage(map) { return { getItem: k => map.get(k) || null, setItem: (k,v) => map.set(k,String(v)), removeItem: k => map.delete(k) }; }
function page(local, cookies) {
  const document = { get cookie() { return cookies.value || ''; }, set cookie(value) { cookies.value = value.includes('Max-Age=0') ? '' : value.split(';')[0]; } };
  const c = { crypto:webcrypto,TextEncoder,TextDecoder,document,localStorage:storage(local),navigator:{locks:{request:async(n,f)=>f()}},location:{origin:'https://fixture.invalid'},addEventListener(){} };
  c.window=c; vm.createContext(c);
  for (const f of ['v3/vendor/golos/sjcl.min.js','v3/js/vault.js']) vm.runInContext(fs.readFileSync(f,'utf8'),c);
  return c.DposVault;
}
(async()=>{
  const local=new Map(), cookies={}; let v=page(local,cookies);
  await v.setup({password:'fixture-only-password'});
  v=page(local,cookies); await v.ready; assert.equal(v.status().state,'unlocked','refresh resumes');
  const independent=page(local,cookies); await independent.ready; assert.equal(independent.status().state,'unlocked','independent new tab shares browser session');
  const noSession=page(local,{}); await noSession.ready; assert.equal(noSession.status().state,'locked','cookie loss ends session even with encrypted resume retained');
  const guard=independent.issueGuard(); v.lock(); assert.throws(()=>independent.assertGuard(guard),/Vault|vault/);
  v=page(local,cookies); await v.ready; assert.equal(v.status().state,'locked','global Lock revokes refresh');
  await v.unlock({password:'fixture-only-password'});
  const oldResume=local.get('dpos_vault_session_resume_v1'), oldCookie=cookies.value;
  await v.mutate(r=>{r.viz_users=[{login:'alice'}];});
  const stale=new Map(local); stale.set('dpos_vault_session_resume_v1',oldResume);
  const stalePage=page(stale,{value:oldCookie}); await stalePage.ready; assert.equal(stalePage.status().state,'locked','stale envelope cannot resume');
  const fresh=page(local,cookies); await fresh.ready; assert.equal(fresh.status().state,'unlocked');
  assert(![...local.values()].join('').includes('fixture-only-password'));
  await v.import({viz_users:[{login:'replacement'}]});
  assert.equal(v.status().state,'unlocked','import remains usable in memory');
  const afterImport = page(local,cookies); await afterImport.ready;
  assert.equal(afterImport.status().state,'locked','import revokes session resume');
  assert.equal(v.read('viz_users')[0].login,'replacement');
  await v.unlock({password:'fixture-only-password'});
  await v.importWithStorageTransaction({viz_users:[{login:'transactional'}]},[['fixture_setting','preserved']]);
  assert.equal(v.read('viz_users')[0].login,'transactional');
  const transactionReload=page(local,cookies); await transactionReload.ready;
  assert.equal(transactionReload.status().state,'locked','transactional import also revokes resume');
  await v.unlock({password:'fixture-only-password'});
  const rotatedStorage=new Map(); const rotated=page(rotatedStorage,{});
  await rotated.setup({password:'new-fixture-only-password'});
  local.set('dpos_vault_v1',rotatedStorage.get('dpos_vault_v1'));
  const rotatedReload=page(local,cookies); await rotatedReload.ready;
  assert.equal(rotatedReload.status().state,'locked','changed password/envelope rejects old capability');
  await assert.rejects(()=>rotatedReload.unlock({password:'fixture-only-password'}));
  await rotatedReload.unlock({password:'new-fixture-only-password'});
  console.log('web vault browser-session resume PASS');
})().catch(e=>{console.error(e);process.exitCode=1;});
