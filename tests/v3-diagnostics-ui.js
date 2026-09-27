const assert=require('assert'),fs=require('fs'),vm=require('vm'),path=require('path');
const source=fs.readFileSync(path.join(__dirname,'../v3/js/diagnostics-ui.js'),'utf8');
function setup(native,reply={ok:true},available=true){
 const nodes=new Map(),calls=[],downloads=[];
 function el(){return {textContent:'',disabled:false,addEventListener(n,f){this[n]=f}}}
 const container={innerHTML:'',querySelector(s){if(!nodes.has(s))nodes.set(s,el());return nodes.get(s)}};
 let text='retained-event\n'.repeat(600);
 const c={Date,Promise,Map,Error,setTimeout,clearTimeout,Blob:class{constructor(parts){this.parts=parts}},URL:{createObjectURL(b){downloads.push(b.parts.join(''));return 'blob:fixture'},revokeObjectURL(){}},document:{body:{appendChild(){}},createElement(){return {click(){},remove(){}}}},DposDiagnostics:{summary:async()=>({entries:600,dropped:2,persistent:true}),record:async()=>{},exportText:async()=>text,sanitize:x=>x},DposNative:{available:()=>native,request:async(method,payload)=>{calls.push({method,payload});if(method==='getAppInfo')return {diagnosticLogExport:available};if(method==='saveDiagnosticLog')return reply;throw Error('unexpected method')}}};
 if(!native)c.setTimeout=(f)=>{return 0};
 c.window=c;vm.createContext(c);vm.runInContext(source,c);c.DposDiagnosticsUI.render(container);
 return {nodes,calls,downloads,text};
}
(async()=>{
 for(const reply of [{ok:true},{ok:false,cancelled:true},{ok:false,reason:'save-failed'}]){
  const t=setup(true,reply);await new Promise(setImmediate);
  assert(t.calls.every(x=>x.method==='getAppInfo'),'opening diagnostics never starts work');
  await t.nodes.get('[data-diag-download]').click();
  const saved=t.calls.find(x=>x.method==='saveDiagnosticLog');assert(saved);assert.strictEqual(saved.payload.webReport,t.text,'full retained report, not 4000 chars');
  assert.strictEqual(t.nodes.get('[data-diag-download]').disabled,false);
  const status=t.nodes.get('[data-diag-result]').textContent;
  assert(reply.cancelled?status.includes('отменено'):reply.ok?status.includes('сохранён'):status.includes('save-failed'));
 }
 const old=setup(true,{},false);await new Promise(setImmediate);await old.nodes.get('[data-diag-download]').click();assert(!old.calls.some(x=>x.method==='saveDiagnosticLog'));
 const web=setup(false);await new Promise(setImmediate);await web.nodes.get('[data-diag-download]').click();assert.deepStrictEqual(web.downloads,[web.text]);
 console.log('Diagnostic page explicit export, full retained text, Android cancel/error and browser download passed');
})().catch(e=>{console.error(e);process.exitCode=1});
