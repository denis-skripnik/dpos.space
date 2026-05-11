const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const context = { window: null };
context.window = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root, 'v3/js/chains.js'), 'utf8'), context, { filename: 'v3/js/chains.js' });

const chains = context.DposChains;
const appSource = fs.readFileSync(path.join(root, 'v3/js/app.js'), 'utf8');
const chainsSource = fs.readFileSync(path.join(root, 'v3/js/chains.js'), 'utf8');
const broadcastSource = fs.readFileSync(path.join(root, 'v3/js/broadcast.js'), 'utf8');
const profilesSource = fs.readFileSync(path.join(root, 'v3/js/profiles.js'), 'utf8');
const historySource = fs.readFileSync(path.join(root, 'v3/js/history.js'), 'utf8');
const planSource = fs.readFileSync(path.join(root, 'plan.md'), 'utf8');

const hive = chains.hive;
assert(hive, 'Hive chain exists');
assert(hive.apps.some((app) => app.id === 'manage' && app.title === 'Управление'), 'Hive manage route is registered through social apps');
assert.strictEqual(hive.libraryGlobal, 'hive', 'Hive manage uses browser Hive library');
assert.strictEqual(hive.libraryPath, 'v3/vendor/hive/hive.min.js', 'Hive manage uses vendored browser library');
assert.strictEqual(hive.cryptoPath, 'v3/vendor/hive/sjcl.min.js', 'Hive manage keeps legacy SJCL auth compatibility');

const manageRenderer = (appSource.match(/function renderManage\(chain\)[\s\S]*?\n  async function renderExplorer/) || [''])[0];
const profilePrefill = (appSource.match(/async function prefillManageProfile[\s\S]*?\n  async function loadManageWitnessSettings/) || [''])[0];
const witnessSettings = (appSource.match(/async function loadManageWitnessSettings[\s\S]*?\n  async function loadGolosFollowingList/) || [''])[0];
const witnessList = (appSource.match(/async function loadWitnessVoteList[\s\S]*?\n  function downloadTextFile/) || [''])[0];
const hiveRuntimeSlice = [
  chainsSource.match(/hive:\s*\{[\s\S]*?\n    minter:/)?.[0] || '',
  profilePrefill,
  witnessSettings,
  witnessList,
  manageRenderer
].join('\n');

assert(manageRenderer.includes('function renderManage(chain)'), 'Hive manage uses the shared manage renderer');
assert(appSource.includes("effectiveAppId === 'manage'") && appSource.includes('renderManage(chain)'), 'router dispatches manage app to renderer');

for (const marker of [
  'Управление блокчейном и профилем',
  'Профиль',
  'Делегаты / witness votes',
  'Управление делегатом',
  'manage-profile-form',
  'manage-proxy-form',
  'manage-witness-form',
  'manage-witnesses-batch-form',
  'manage-witness-update-form',
  'manage-profile-image',
  'manage-profile-cover-image',
  'manage-profile-gender',
  'manage-profile-mail',
  'manage-profile-telegram',
  'manage-profile-whatsapp',
  'role="status" aria-live="polite"'
]) {
  assert(hiveRuntimeSlice.includes(marker), `Hive manage keeps legacy UI/control marker: ${marker}`);
}

for (const marker of [
  "broadcast.prepare(chain, 'active', 'accountWitnessProxy'",
  "broadcast.prepare(chain, 'active', 'accountWitnessVote'",
  "broadcast.prepare(chain, 'active', 'witnessUpdate'",
  "broadcast.prepare(chain, 'active', 'accountUpdate'",
  "broadcast.prepare(chain, 'active', 'sendOperations'",
  "['account_witness_vote'",
  'getWitnessesByVote',
  'getWitnessByAccount',
  'fetchChainAccount(chain, account)',
  "chain.id === 'hive'",
  'HIVE1111111111111111111111111111111114T1Anm'
]) {
  assert(hiveRuntimeSlice.includes(marker), `Hive manage keeps static-safe operation behavior: ${marker}`);
}

assert(profilePrefill.includes("chain.id !== 'golos' && chain.id !== 'hive' && chain.id !== 'steem'"), 'Hive manage preloads current profile metadata like legacy footer.js');
assert(manageRenderer.includes('manage-profile-prefill-result'), 'Hive manage exposes profile preload status');
assert(witnessList.includes("chain.id !== 'golos' && chain.id !== 'viz' && chain.id !== 'hive' && chain.id !== 'steem'"), 'Hive manage can load witness list via public RPC');
assert(manageRenderer.includes("chain.id === 'golos' || chain.id === 'viz' || chain.id === 'hive' || chain.id === 'steem'"), 'Hive manage exposes batch witness voting and witness preload controls');
for (const marker of ['manage-proxy-details', 'manage-witness-details', 'manage-witnesses-batch-details', 'manage-witness-update-details', 'manage-authority-details', 'manage-profile-details']) {
  assert(manageRenderer.includes(`id="${marker}" class="operation-details"`), `Hive manage wraps broadcast form in details: ${marker}`);
}
assert(broadcastSource.includes("hive: { posting: 'posting"), 'Hive broadcast authority map supports posting/active authorities');
assert(profilesSource.includes('fetchAccount'), 'Hive manage can fetch accounts through shared profiles helpers');
assert(historySource.includes('account_witness_vote'), 'History labels include witness vote operations for account history navigation');

assert(!/backend\.dpos\.space|178\.20\.43\.121|hidden server API|new indexer|daemon|\.php\b|XMLHttpRequest|sendAjax\(/.test(hiveRuntimeSlice), 'Hive manage v3 runtime slice has no private/PHP/backend dependency or hidden service');
assert(!hiveRuntimeSlice.includes('blockchains/hive/apps/manage'), 'Hive manage runtime does not reference legacy runtime paths');

assert(planSource.includes('### Rigorous parity: Hive / manage'), 'plan.md contains required Hive/manage rigorous parity section');
for (const evidence of [
  'blockchains/hive/apps/manage/config.json',
  'blockchains/hive/apps/manage/content.php',
  'blockchains/hive/apps/manage/index.php',
  'blockchains/hive/apps/manage/js/app.js',
  'blockchains/hive/apps/manage/pages/profile/content.php',
  'blockchains/hive/apps/manage/pages/profile/footer.js',
  'blockchains/hive/apps/manage/pages/witnesses/content.php',
  'blockchains/hive/apps/manage/pages/witnesses/footer.js',
  'blockchains/hive/apps/manage/pages/witness/content.php',
  'blockchains/hive/apps/manage/pages/witness/footer.js',
  'blockchains/hive/js/blockchain.js',
  'blockchains/hive/js/modal-accounts.js',
  'hive.broadcast.accountWitnessProxy(active_key, hive_login, proxy_login, cb)',
  'hive.broadcast.accountWitnessVote(active_key, hive_login, witness_login, true, cb)',
  'hive.broadcast.accountUpdate(active_key, hive_login, undefined, undefined, undefined, memo, json_metadata, cb)',
  'hive.broadcast.witnessUpdate(active_key, hive_login, url, blockSigningKey, props, fee, cb)',
  'hive.broadcast.send({extensions: [], operations}, [active_key], cb)',
  'hive.api.getWitnessesByVote(from, 100, cb)',
  'tests/v3-hive-manage-smoke.js'
]) {
  assert(planSource.includes(evidence), `plan.md records Hive manage evidence: ${evidence}`);
}

console.log('v3 Hive manage smoke passed');
