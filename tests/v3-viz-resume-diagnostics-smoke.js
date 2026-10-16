const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const root = require('path').join(__dirname, '..');
const storage = new Map();
const w = {URL, localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},
  navigator:{}, document:{currentScript:{src:'https://fixture.invalid/v3/js/diagnostics.js?v=page-new'},querySelectorAll:()=>[]},
  DposBroadcast:{sanitizeDiagnostic:s=>s},DposBip39:{}, addEventListener(){},
  DposVault:{diagnosticSnapshot:()=>({state:'locked',resume:{reason:'capability_missing'}})},
  DposAutomationContinuity:{diagnosticSnapshot:()=>({savedStart:true,reason:'vault_locked',nextAt:123})}};
w.window=w;
vm.runInNewContext(fs.readFileSync(root+'/v3/js/diagnostics.js','utf8'),w);
(async()=>{
  let text=await w.DposDiagnostics.exportText();
  assert(text.includes('Loaded runtime snapshot'),text);
  assert(text.includes('capability_missing') && text.includes('vault_locked'),text);
  assert(text.includes('20261016-viz-safe-diagnostics'),text);
  assert(text.includes('page-new'),text);
  w.__dposVizSelfAwardRuntime={running:true,diagnosticCheckStarted:'CANARY_PRIVATE_PAYLOAD',diagnosticCheckCompleted:Infinity,diagnosticBlockedReason:'CANARY_PRIVATE_PAYLOAD',diagnosticResumeOutcome:'CANARY_PRIVATE_PAYLOAD'};
  text=await w.DposDiagnostics.exportText();
  assert(!text.includes('CANARY_PRIVATE_PAYLOAD'));
  assert(text.includes('waiting_for_deadline'));
  w.DposNative={available:()=>true};
  assert.strictEqual(w.DposDiagnostics.runtimeSnapshot().executionMode,'native_bridge_available');
  delete w.DposNative;
  w.DposAndroidTransport={};
  assert.strictEqual(w.DposDiagnostics.runtimeSnapshot().executionMode,'native_transport_present');
  delete w.DposAndroidTransport;
  w.DposVault.diagnosticSnapshot=()=>{throw Error('CANARY_PRIVATE_PAYLOAD');};
  text=await w.DposDiagnostics.exportText();
  assert(!text.includes('CANARY_PRIVATE_PAYLOAD'));
  for(let i=0;i<600;i++) await w.DposDiagnostics.record('info','bounded.test',{n:i});
  const summary=await w.DposDiagnostics.summary();
  assert(summary.entries<=400 && summary.dropped>0);
  assert(JSON.stringify([...storage.values()]).length<50000);
  console.log('VIZ safe resume diagnostics export/bounds/nonthrow: PASS');
})().catch(e=>{console.error(e);process.exitCode=1;});
