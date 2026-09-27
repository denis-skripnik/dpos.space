const assert=require('assert'),fs=require('fs'),vm=require('vm'),path=require('path');
const root=path.join(__dirname,'..');
function boot(storage,options={}) {
 const events={};const c={Date,JSON,Promise,Map,Set,URL,setTimeout,clearTimeout,TextEncoder,TextDecoder,Uint8Array,console:{warn(){},error(){}},location:{hash:'#chain=golos&app=auto-upvoter',origin:'https://dpos.test'},navigator:{},localStorage:storage,addEventListener(n,f){events[n]=f;}};
 c.window=c;vm.createContext(c);
 for(const f of ['bip39.js','broadcast.js','diagnostics.js'])vm.runInContext(fs.readFileSync(path.join(root,'v3/js',f),'utf8'),c,{filename:f});
 return {api:c.DposDiagnostics,c,events};
}
(async()=>{
 const values=new Map();const storage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)};
 const {api,c,events}=boot(storage);assert(api);
 await api.record('info','test',{message:'ordinary status',password:'not-for-disk',signedTransaction:{signatures:['do-not-store'],operations:['raw-op']}});
 const seed=Array(11).fill('abandon').concat('about').join(' ');
 await api.record('error','rpc',`failed ${seed}`);
 await api.record('error','rpc','request https://user:password@example.org/path?token=not-for-disk');
 await api.record('error','rpc','privateKey: private-key-fixture');
 await api.record('error','rpc','0x'+'ab'.repeat(32));
 for(const input of ['token=inline-token-fixture','key=inline-key-fixture','RPC failed: {"operations":["embedded-op-fixture"]}', 'RPC failed: {"\\u0070assword":"encoded-pass-fixture"}']) await api.record('error','credential',input);
 await api.record('info','nested',{details:JSON.stringify({signedTransaction:{raw:'nested-signed-fixture'},message:'safe nested marker'})});
 const raw=[...values.values()].join('');
 for(const secret of ['inline-token-fixture','inline-key-fixture','embedded-op-fixture','encoded-pass-fixture','nested-signed-fixture'])assert(!raw.includes(secret),secret+' persisted');
 for(const secret of ['not-for-disk','do-not-store','raw-op',seed,'private-key-fixture','ab'.repeat(32),'user:password'])assert(!raw.includes(secret),secret+' persisted');
 assert((await api.exportText()).includes('ordinary status'));
 assert((await boot(storage).api.exportText()).includes('ordinary status'),'reload retains log');
 c.console.error('test console failure');events.unhandledrejection({reason:new Error('test rejection')});
 assert((await api.exportText()).includes('test console failure'));
 for(let i=0;i<180;i++)await api.record('info','bounded',`${i}:`+'x'.repeat(500));
 const text=await api.exportText();assert(text.length<80000);assert(text.includes('179:'));assert((await api.summary()).dropped>0);
 const bad=boot({getItem(){throw Error('denied')},setItem(){throw Error('quota')}}).api;
 await bad.record('info','memory','in-memory-safe');assert((await bad.exportText()).includes('in-memory-safe'));assert(!(await bad.summary()).persistent);
 console.log('Diagnostic journal redaction-before-storage, reload, retention and storage failure passed');
})().catch(e=>{console.error(e);process.exitCode=1});
