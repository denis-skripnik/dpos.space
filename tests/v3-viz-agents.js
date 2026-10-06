/* HF15 protocol regression: real browser SDK, offline only. */
const fs = require('fs'), vm = require('vm'), assert = require('assert');
const context = { console, TextEncoder, TextDecoder, setTimeout, clearTimeout, crypto: require('crypto').webcrypto };
context.window = context; context.globalThis = context; vm.createContext(context);
vm.runInContext(fs.readFileSync('v3/vendor/viz/viz.min.js', 'utf8'), context);
const viz = context.viz;
assert.strictEqual(typeof viz.api.getAgentPermissionsAsync, 'function', 'HF15 read method');
assert.strictEqual(typeof viz.broadcast.setAgentPermissionAsync, 'function', 'HF15 grant method');
vm.runInContext(fs.readFileSync('v3/js/viz-agents.js', 'utf8'), context);
const agents = context.DposVizAgents;
const key = viz.auth.getPrivateKeys('alice', 'offline-agent-test-fixture', ['active']);
const input = { account: 'alice', name: 'trade-bot', publicKey: key.activePubkey, operations: ['transfer','pm_place_bet'], unlimited: true, addons: 'vizhub' };
const grant = agents.build(input);
assert.deepStrictEqual(JSON.parse(JSON.stringify(grant)), ['set_agent_permission', { account: 'alice', agent_name: 'trade-bot', agent_key: key.activePubkey, operations: ['pm_place_bet','transfer'], expiration: '1970-01-01T00:00:00', addons: ['vizhub'], extensions: [] }]);
assert.strictEqual(agents.build({...input, operations: [], addons: 'vizhub'})[1].operations.length, 0, 'addon-only grant');
for (const name of ['set_agent_permission','account_update','proposal_update','recover_account','change_recovery_account','set_account_price','set_subaccount_price','target_account_sale','witness_update','hardfork','pm_lp_payout','pm_*','made_up']) {
  assert.throws(() => agents.build({...input, operations: [name]}), /операц/i, name);
  assert(!agents.operations.includes(name));
}
for (const name of ['', 'ABC', 'space name', 'a'.repeat(33)]) assert.throws(() => agents.build({...input, name}), /имя/i);
assert.throws(() => agents.build({...input, publicKey: key.active}), /публич/i);
assert.throws(() => agents.build({...input, publicKey: 'VIZ-not-valid'}), /публич/i);
assert.throws(() => agents.build({...input, publicKey: agents.nullKey}), /публич/i);
assert.throws(() => agents.build({...input, operations: [], addons: ''}), /прав/i);
assert.throws(() => agents.build({...input, addons: Array.from({length:11}, (_,i) => 's'+i).join(',')}), /addons/i);
assert.throws(() => agents.build({...input, addons: 'я'.repeat(32)}), /addons/i);
assert.throws(() => agents.build({...input, addons: 'vizhub,,scope'}), /addons/i);
assert.throws(() => agents.build({...input, unlimited: false, expiration: '2000-01-01T00:00'}), /дат/i);
assert.throws(() => agents.build({...input, unlimited: false, expiration: '2027-02-30T12:00'}), /дат/i);
assert.throws(() => agents.build({...input, unlimited: false, expiration: '2200-01-01T00:00'}), /дат/i);
assert.strictEqual(agents.build({...input, unlimited: false, expiration: '2028-01-01T12:30'})[1].expiration, '2028-01-01T12:30:00', 'UTC, not local time');
const revoke = agents.build({ account: 'alice', name: 'trade-bot', revoke: true });
assert.deepStrictEqual(JSON.parse(JSON.stringify(revoke)), ['set_agent_permission', {account:'alice',agent_name:'trade-bot',agent_key:agents.nullKey,operations:[],expiration:'1970-01-01T00:00:00',addons:[],extensions:[]}]);
// Serialize through the actual SDK signer; independently construct ALL consensus bytes.
const tx = {ref_block_num:1,ref_block_prefix:2,expiration:'2028-01-01T00:00:00',operations:[grant],extensions:[]};
const trace = [];
context.console = { log: (...args) => trace.push(args), error: (...args) => trace.push(args) };
const signed = viz.auth.signTransaction(tx, [key.active], true);
const actualHex = trace.find(args => args[0] === 'raw transaction')[1];
const uint = (n, bytes) => { const b = Buffer.alloc(bytes); b.writeUIntLE(n, 0, bytes); return b; };
const varint = n => { const bytes=[]; do { const low=n & 127; n >>>= 7; bytes.push(low | (n ? 128 : 0)); } while(n); return Buffer.from(bytes); };
const string = s => { const bytes=Buffer.from(s,'utf8'); return Buffer.concat([varint(bytes.length),bytes]); };
const flatset = a => Buffer.concat([varint(a.length),...a.map(string)]);
function decodePublic(publicKey) {
  const alphabet='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let n=0n; for (const char of publicKey.slice(3)) n=n*58n+BigInt(alphabet.indexOf(char));
  const hex=n.toString(16);const decoded=Buffer.from(hex.length % 2 ? '0'+hex : hex,'hex');
  assert.strictEqual(decoded.length,37);
  return decoded.subarray(0,33);
}
const expected = Buffer.concat([
  uint(1,2),uint(2,4),uint(Date.parse('2028-01-01T00:00:00Z')/1000,4),varint(1),varint(105),
  string('alice'),string('trade-bot'),decodePublic(key.activePubkey),flatset(['pm_place_bet','transfer']),
  uint(0,4),flatset(['vizhub']),varint(0),varint(0)
]);
assert.strictEqual(actualHex,expected.toString('hex'),'full wire bytes: ID105, exact field order, operations/addons flat sets, epoch and empty extensions');
const originalSend=viz.broadcast.send;
let wrapped;
viz.broadcast.send=(tx,keys,callback)=>{wrapped={tx,keys};callback(null,tx);};
const body=grant[1];
viz.broadcast.setAgentPermission(key.active,body.account,body.agent_name,body.agent_key,body.operations,body.expiration,body.addons,body.extensions,()=>{});
assert.deepStrictEqual(JSON.parse(JSON.stringify(wrapped.tx.operations)),JSON.parse(JSON.stringify([grant])),'SDK positional wrapper fields');
assert.strictEqual(wrapped.keys.active,key.active,'grant wrapper requires active');
viz.broadcast.send=originalSend;
assert.throws(()=>agents.build({...input,addons:key.active}),/addons/i,'private key must never become a public addon');
const generated=agents.generate();
assert(viz.auth.isWif(generated.privateKey));
assert.strictEqual(viz.auth.wifToPublic(generated.privateKey),generated.publicKey);
assert.notStrictEqual(agents.generate().publicKey,generated.publicKey,'fresh random key per generation');
assert.strictEqual(signed.signatures.length, 1);
assert.strictEqual(signed.signatures[0].length, 130);
assert(!JSON.stringify(signed).includes(key.active));
const app = fs.readFileSync('v3/js/app.js','utf8');
assert(app.includes('function renderVizAgentKeys('));
assert(app.includes('function bindVizAgentKeys('));
assert(app.includes("chain.id === 'viz' ? renderVizAgentKeys() : ''"));
assert(app.includes('clearVizAgentSecrets'));
// Independently frozen from protocol ac7b98d operations.hpp, virtual_operation
// inheritance in chain_virtual_operations.hpp / pm_virtual_operations.hpp, and
// never_delegable_operation_names() in agent_operations.cpp (not from UI/SDK).
const canonicalBroadcastable = `vote content transfer transfer_to_vesting withdraw_vesting account_update validator_update account_validator_vote account_validator_proxy delete_content custom set_withdraw_vesting_route request_account_recovery recover_account change_recovery_account escrow_transfer escrow_dispute escrow_release escrow_approve delegate_vesting_shares account_create account_metadata proposal_create proposal_update proposal_delete chain_properties_update committee_worker_create_request committee_worker_cancel_request committee_vote_request create_invite claim_invite_balance invite_registration versioned_chain_properties_update award set_paid_subscription paid_subscribe set_account_price set_subaccount_price buy_account use_invite_balance fixed_award target_account_sale set_reward_sharing pm_oracle_register pm_oracle_update pm_create_market pm_oracle_accept_market pm_place_bet pm_commit_bet pm_reveal_bet pm_cancel_bet pm_add_liquidity pm_withdraw_liquidity pm_resolve_market pm_no_contest pm_dispute_create pm_dispute_vote pm_dispute_resolve pm_transfer_position pm_lazy_deposit pm_lazy_withdraw pm_leverage_open pm_leverage_close pm_leverage_convert pm_dispute_oracle_respond pm_unban set_agent_permission`.split(' ');
const forbidden = `set_agent_permission proposal_update account_update recover_account change_recovery_account set_account_price set_subaccount_price target_account_sale`.split(' ');
(async () => {
  // Collect all delta regressions so RED exposes every independent defect.
  const failures = [];
  const check = async (name, run) => { try { await run(); } catch (_) { failures.push(name); } };
  await check('exact canonical broadcastable-minus-forbidden (59 scopes)', async () => {
    assert.strictEqual(canonicalBroadcastable.length,67);
    assert.deepStrictEqual(Array.from(agents.operations).sort(),canonicalBroadcastable.filter(op=>!forbidden.includes(op)).sort());
    assert.throws(()=>agents.build({...input,operations:['cancel_paid_subscription']}), /операц/i);
    for (const op of agents.operations) assert.deepStrictEqual(Array.from(agents.build({...input,operations:[op],addons:''})[1].operations),[op]);
  });
  vm.runInContext(fs.readFileSync('v3/js/broadcast.js','utf8'),context);
  const chain = {id:'viz',libraryGlobal:'viz'};
  const realSign = viz.auth.signTransaction;
  const realPrepare = viz.broadcast._prepareTransaction;
  const realNow = Date.now;
  const base = Date.parse('2028-01-01T00:00:00Z');
  const iso = ms => new Date(ms).toISOString().slice(0,19);
  const receipt = {id:'a'.repeat(40),block_num:123,trx_num:0,expired:false};
  let now, head, txExpiry, signedCount, broadcastCount, accountHook, taposHook, headHook, answer, transportError;
  function reset() {
    now=base;head=iso(base);txExpiry=iso(base+60000);signedCount=0;broadcastCount=0;
    accountHook=taposHook=headHook=()=>{};answer=receipt;transportError=null;
  }
  const preparedFor = body => ({chain:'viz',from:'alice',authority:'active',operationName:'setAgentPermission',params:Object.values(body),meta:{warnings:[]},getPrivateKey:()=>key.active,assertValid:()=>{}});
  const limited = {...grant[1],expiration:iso(base+10000)};
  viz.api.getAccountsAsync=async()=>{accountHook();return [{active_authority:{key_auths:[[key.activePubkey,1]]}}];};
  viz.broadcast._prepareTransaction=async tx=>{taposHook();return {...tx,ref_block_num:1,ref_block_prefix:2,expiration:txExpiry};};
  viz.api.getDynamicGlobalPropertiesAsync=async()=>{headHook();return {time:head};};
  viz.auth.signTransaction=tx=>{signedCount++;return {...tx,signatures:['offline-counter-fixture']};};
  viz.api.broadcastTransactionSynchronous=(tx,cb)=>{broadcastCount++;cb(transportError,answer);};
  // VM Date is separate: control only the clock, keep parsing/UTC serialization real.
  context.__fixtureNow=()=>now++;
  vm.runInContext('Date.now = () => __fixtureNow()',context);
  const send = body => context.DposBroadcast.broadcast(chain,preparedFor(body),{confirmExecute:true});
  for (const bad of [{...receipt,expired:true,trx_num:-1},{...receipt,trx_num:-1},null,{},[],{...receipt,id:'bad'},{...receipt,block_num:0},{...receipt,trx_num:'0'},{...receipt,expired:undefined}]) {
    await check('reject failed/malformed receipt '+JSON.stringify(bad),async()=>{reset();answer=bad;await assert.rejects(()=>send(grant[1]));assert.strictEqual(broadcastCount,1);});
  }
  await check('transport uncertainty never retries',async()=>{reset();transportError=Error('node is stopped');await assert.rejects(()=>send(grant[1]));assert.strictEqual(broadcastCount,1);});
  for (const stage of ['confirmation','authority','TAPOS','chain lookup']) {
    await check('elapsed during '+stage+' zero signatures/broadcasts',async()=>{
      reset();const expire=()=>{now=base+10000;};
      if(stage==='confirmation')expire();if(stage==='authority')accountHook=expire;if(stage==='TAPOS')taposHook=expire;if(stage==='chain lookup')headHook=expire;
      await assert.rejects(()=>send(limited));assert.strictEqual(signedCount,0);assert.strictEqual(broadcastCount,0);
    });
  }
  await check('chain ahead local rejects elapsed deadline',async()=>{reset();head=iso(base+10000);await assert.rejects(()=>send(limited));assert.strictEqual(signedCount,0);assert.strictEqual(broadcastCount,0);});
  for (const invalid of [null,'bad','2028-02-30T00:00:00']) {
    await check('malformed head fails closed '+invalid,async()=>{reset();head=invalid;await assert.rejects(()=>send(limited));assert.strictEqual(signedCount,0);assert.strictEqual(broadcastCount,0);});
    await check('malformed transaction expiration fails closed '+invalid,async()=>{reset();txExpiry=invalid;await assert.rejects(()=>send(limited));assert.strictEqual(signedCount,0);assert.strictEqual(broadcastCount,0);});
  }
  await check('unavailable fresh chain time zero signatures/broadcasts',async()=>{reset();headHook=()=>{throw Error('offline chain clock');};await assert.rejects(()=>send(limited));assert.strictEqual(signedCount,0);assert.strictEqual(broadcastCount,0);});
  await check('expired SDK validity cannot be extended',async()=>{reset();txExpiry=iso(base);await assert.rejects(()=>send(limited));assert.strictEqual(signedCount,0);assert.strictEqual(broadcastCount,0);});
  await check('no safe strictly earlier window',async()=>{reset();head=iso(base+9000);await assert.rejects(()=>send(limited));assert.strictEqual(signedCount,0);assert.strictEqual(broadcastCount,0);});
  for (const expiry of [base+60000,base+5000]) await check('limited validity bounded without extending permission '+expiry,async()=>{
    reset();txExpiry=iso(expiry);let captured;viz.api.broadcastTransactionSynchronous=(tx,cb)=>{captured=tx;broadcastCount++;cb(null,receipt);};
    assert.strictEqual(await send(limited),receipt);assert.strictEqual(captured.expiration,iso(Math.min(expiry,base+9000)));assert.strictEqual(captured.operations[0][1].expiration,limited.expiration);assert.strictEqual(signedCount,1);assert.strictEqual(broadcastCount,1);
  });
  for (const body of [grant[1],revoke[1]]) await check('unlimited/explicit revoke unchanged',async()=>{
    reset();let captured;viz.api.broadcastTransactionSynchronous=(tx,cb)=>{captured=tx;broadcastCount++;cb(null,receipt);};
    assert.strictEqual(await send(body),receipt);assert.strictEqual(captured.expiration,txExpiry);assert.deepStrictEqual(JSON.parse(JSON.stringify(captured.operations)),[JSON.parse(JSON.stringify(['set_agent_permission',body]))]);
  });
  // Integration regression: keep real SDK TAPOS and mock only its read-only RPC.
  const fixturePrepare = viz.broadcast._prepareTransaction;
  viz.broadcast._prepareTransaction = realPrepare;
  viz.api.getDynamicGlobalPropertiesAsync = async () => {
    headHook();
    return {time:head,head_block_number:123,head_block_id:'0000007b11223344'+'0'.repeat(24)};
  };
  for (const offset of [10000,120000]) await check('real SDK Date limited validity '+offset,async()=>{
    reset();
    const body={...limited,expiration:iso(base+offset)};
    const sdkTx=await realPrepare({extensions:[],operations:[['set_agent_permission',body]]});
    assert.strictEqual(Object.prototype.toString.call(sdkTx.expiration),'[object Date]');
    let captured;
    viz.api.broadcastTransactionSynchronous=(tx,cb)=>{captured=tx;broadcastCount++;cb(null,receipt);};
    assert.strictEqual(await send(body),receipt);
    assert.strictEqual(captured.expiration,iso(Math.min(sdkTx.expiration.getTime(),base+offset-1000)));
    assert.strictEqual(captured.operations[0][1].expiration,body.expiration);
    assert.strictEqual(signedCount,1);assert.strictEqual(broadcastCount,1);
  });
  await check('real SDK chain-ahead elapsed deadline',async()=>{
    reset();head=iso(base+10000);await assert.rejects(()=>send(limited));
    assert.strictEqual(signedCount,0);assert.strictEqual(broadcastCount,0);
  });
  viz.broadcast._prepareTransaction=fixturePrepare;
  await check('invalid SDK Date fails closed',async()=>{
    reset();txExpiry=new Date(NaN);await assert.rejects(()=>send(limited));
    assert.strictEqual(signedCount,0);assert.strictEqual(broadcastCount,0);
  });
  await check('expired SDK Date fails closed',async()=>{
    reset();txExpiry=new Date(base);await assert.rejects(()=>send(limited));
    assert.strictEqual(signedCount,0);assert.strictEqual(broadcastCount,0);
  });
  viz.auth.signTransaction=realSign;
  Date.now=realNow;
  if(failures.length) throw new Error('HF15 delta RED: '+failures.join('; '));
  console.log('HF15 deltas: exact 59 scopes, strict receipt/no retry, async deadline/chain-time guards with zero signatures, bounded limited validity, unlimited/revoke preservation: PASS');
  const row = {account:'alice',agent_name:'trade-bot',agent_key:key.activePubkey,operations:['transfer'],expiration:agents.epoch,addons:['vizhub'],expired:false};
  const rpc = rows => ({api:{getAgentPermissionsAsync: async account => { assert.strictEqual(account,'alice'); return rows; }}});
  assert.strictEqual((await agents.read(rpc([row]),'alice')).length,1);
  assert.strictEqual((await agents.read(rpc([]),'alice')).length,0);
  for (const rows of [null,Array(17).fill(row),[{...row,account:'bob'}],[{...row,agent_key:key.active}],[{...row,operations:['account_update']}],[{...row,addons:[key.active]}],[{...row,expired:'false'}]]) await assert.rejects(()=>agents.read(rpc(rows),'alice'));
  await assert.rejects(()=>agents.read({api:{getAgentPermissionsAsync:async()=>{throw Object.assign(new Error('method not found'),{code:-32601});}}},'alice'),/HF15/);
  console.log('VIZ HF15 validation, ID105 exact full serialization, wrapper, revoke/addon-only, random generation, read schema and real SDK offline signing: PASS');
})().catch(error => { console.error(error); process.exitCode=1; });
