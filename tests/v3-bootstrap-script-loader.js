const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const Module = require('module');
const parser = new Module('loader-parser');
parser._compile(process.binding('natives')['internal/deps/acorn/acorn/dist/acorn'], 'loader-parser');
const source = fs.readFileSync(require('path').join(__dirname, '../v3/js/app.js'), 'utf8');
let target;
function walk(node) {
  if (!node || typeof node !== 'object') return;
  if (node.type === 'FunctionDeclaration' && node.id.name === 'loadScript') target = node;
  Object.values(node).forEach(value => { if (Array.isArray(value)) value.forEach(walk); else if (value && typeof value === 'object') walk(value); });
}
walk(parser.exports.parse(source, {ecmaVersion: 'latest'}));
assert(target);
function harness(ready, existing = true) {
 const script = {dataset: {}};
 const scope = {Map, Promise, loadedScripts: new Set(), chains: {golos: {cryptoPath:'v3/vendor/golos/sjcl.min.js'}}, global: ready ? {sjcl:{encrypt(){},decrypt(){}}} : {}, document:{querySelector:()=>existing ? script : null,createElement:()=>script,head:{appendChild(){}}}};
 vm.createContext(scope);vm.runInContext(source.slice(target.start,target.end),scope);
 return {scope,script};
}
(async()=>{
 const h=harness(true);let timer;
 try {await Promise.race([h.scope.loadScript('v3/vendor/golos/sjcl.min.js'),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('already loaded bootstrap SJCL blocks route')),150)})]);} finally {clearTimeout(timer);}
 assert(h.scope.loadedScripts.has('v3/vendor/golos/sjcl.min.js'));
 const pending=harness(false);let complete=false;
 const p=pending.scope.loadScript('v3/vendor/golos/sjcl.min.js').then(()=>complete=true);
 await Promise.resolve();assert(!complete,'not-yet-loaded scripts must still wait');pending.script.onload();await p;assert(complete);
 const other=harness(true);let otherComplete=false;const q=other.scope.loadScript('v3/vendor/hive/sjcl.min.js').then(()=>otherComplete=true);
 await Promise.resolve();assert(!otherComplete,'do not mistake unrelated scripts for the bootstrap');other.script.onload();await q;
 const failed=harness(false,false);const failure=failed.scope.loadScript('missing.js');failed.script.onerror();await assert.rejects(failure,/библиотеку/);
 console.log('Bootstrap SJCL reuse, pending loads, unrelated scripts and failures passed');
})().catch(e=>{console.error(e.message);process.exitCode=1;});
