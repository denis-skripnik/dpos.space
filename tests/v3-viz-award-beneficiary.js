const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const user = {login:'alice', regular:'test-only-encrypted', posting:'test-only-encrypted'};
const window = {DposAuth:{getCurrentUser:()=>user,getUserType:()=>'',getUserLogin:u=>u.login},sjcl:{decrypt:()=> 'test-only-key'}};
vm.runInNewContext(fs.readFileSync('v3/js/broadcast.js','utf8'),{window,console});
const chain={id:'viz'};
function prepare(rows=[],fixed=false){return window.DposBroadcast.prepare(chain,'regular',fixed?'fixedAward':'award',fixed?['alice','bob','1.000 VIZ',10,0,'memo',rows]:['alice','bob',10,0,'memo',rows],{});}
function plain(v){return JSON.parse(JSON.stringify(v));}
assert.deepStrictEqual(plain(prepare().params[5]),[{account:'denis-skripnik',weight:100}]);
assert.deepStrictEqual(plain(prepare([],true).params[6]),[{account:'denis-skripnik',weight:100}]);
const input=[{account:'zebra',weight:1000},{account:'denis-skripnik',weight:100}];
assert.deepStrictEqual(plain(prepare(input).params[5]),[{account:'denis-skripnik',weight:100},{account:'zebra',weight:1000}]);
assert.strictEqual(input[0].account,'zebra');
assert.strictEqual(prepare([{account:'denis-skripnik',weight:500}]).params[5][0].weight,500);
assert.throws(()=>prepare([{account:'zebra',weight:10000}]));
assert.throws(()=>prepare([{account:'zebra',weight:0.5}]));
assert.throws(()=>prepare([{account:'zebra',weight:100},{account:'zebra',weight:100}]));
const self=window.DposBroadcast.prepareForUser(chain,user,'regular','award',['alice','alice',10,0,'memo',[]],{});
assert.deepStrictEqual(plain(self.params[5]),[{account:'denis-skripnik',weight:100}]);
assert(self.meta.warnings.some(x=>x.includes('1%')&&x.includes('denis-skripnik')));
const own=window.DposBroadcast.prepare(chain,'regular','award',['denis-skripnik','denis-skripnik',10,0,'memo',[]],{});
assert.strictEqual(own.params[5].length,1);
const other=window.DposBroadcast.prepare({id:'golos'},'posting','vote',['alice','bob','post',7000],{});
assert.deepStrictEqual(plain(other.params),['alice','bob','post',7000]);
console.log('VIZ award/fixedAward/self-award beneficiary, sorting, no duplication, limits, disclosure PASS');
