const assert=require('assert'),fs=require('fs'),vm=require('vm'),crypto=require('crypto');
const c={console,setTimeout,clearTimeout,TextEncoder,TextDecoder,URL,Buffer,AbortController,crypto:crypto.webcrypto,fetch:()=>{throw Error('No network in serializer test');}};c.window=c;c.self=c;c.global=c;
vm.createContext(c);try { vm.runInContext(fs.readFileSync('v3/vendor/golos/golos.min.js','utf8'),c); } catch (error) { throw new Error('SDK loader: '+error.message); }
const transaction={ref_block_num:1,ref_block_prefix:2,expiration:'2026-01-01T00:00:00',operations:[['vote',{voter:'alice',author:'bob',permlink:'p',weight:10000}]],extensions:[]};
const fixed=Buffer.alloc(10);fixed.writeUInt16LE(1,0);fixed.writeUInt32LE(2,2);fixed.writeUInt32LE(Date.parse(transaction.expiration+'Z')/1000,6);
const text=s=>Buffer.concat([Buffer.from([Buffer.byteLength(s)]),Buffer.from(s)]),weight=Buffer.alloc(2);weight.writeInt16LE(10000);
// Independent normative vector: unsigned transaction, no chain prefix/signatures.
const bytes=Buffer.concat([fixed,Buffer.from([1,0]),text('alice'),text('bob'),text('p'),weight,Buffer.from([0])]);
const expected=crypto.createHash('sha256').update(bytes).digest('hex').slice(0,40);
assert.equal(c.golos.auth.unsignedTransactionId(transaction),expected);
assert.equal(c.golos.auth.unsignedTransactionId({...transaction,signatures:['not included in ID']}),expected);
assert.notEqual(c.golos.auth.unsignedTransactionId({...transaction,ref_block_prefix:3}),expected);
console.log(JSON.stringify({actualVendoredSDKUnsignedVectorId:expected,serializedHex:bytes.toString('hex'),signaturesExcluded:true,chainPrefixExcluded:true}));
