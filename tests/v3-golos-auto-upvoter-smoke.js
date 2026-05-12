const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const context = { window: null, console, setTimeout, clearTimeout };
context.window = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root, 'v3/js/chains.js'), 'utf8'), context, { filename: 'v3/js/chains.js' });
vm.runInContext(fs.readFileSync(path.join(root, 'v3/js/auto-upvoter.js'), 'utf8'), context, { filename: 'v3/js/auto-upvoter.js' });
vm.runInContext(fs.readFileSync(path.join(root, 'v3/js/broadcast.js'), 'utf8'), context, { filename: 'v3/js/broadcast.js' });

const chains = context.DposChains;
const helpers = context.DposGolosAutoUpvoter;
const appSource = fs.readFileSync(path.join(root, 'v3/js/app.js'), 'utf8');
const chainsSource = fs.readFileSync(path.join(root, 'v3/js/chains.js'), 'utf8');
const indexSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const helperSource = fs.readFileSync(path.join(root, 'v3/js/auto-upvoter.js'), 'utf8');

assert(chains.golos, 'Golos chain is registered');
const autoApp = chains.golos.apps.find((app) => app.id === 'auto-upvoter');
assert(autoApp, 'Golos auto-upvoter app is registered');
assert(/авто/i.test(autoApp.title), 'Golos auto-upvoter title is Russian and descriptive');
assert(/posting/i.test(autoApp.description), 'Golos auto-upvoter description warns about posting key use');
assert(/локаль/i.test(autoApp.description), 'Golos auto-upvoter description explains local browser runtime');
assert(chainsSource.includes("id: 'auto-upvoter'"), 'Golos registry contains auto-upvoter id');
assert(indexSource.includes('v3/js/auto-upvoter.js'), 'Auto-upvoter helper is loaded by index before app.js');
assert(appSource.includes("effectiveAppId === 'auto-upvoter'"), 'App router has dedicated auto-upvoter route');
assert(appSource.includes('renderGolosAutoUpvoter'), 'App has Golos auto-upvoter renderer');
assert(appSource.includes('DposAuth.getUsers(chain)'), 'UI reads all authorized Golos accounts');
assert(appSource.includes('const GOLOS_AUTO_UPVOTER_SETTINGS_KEY') && appSource.includes('function readGolosAutoUpvoterSettings') && appSource.includes('function writeGolosAutoUpvoterSettings'), 'auto-upvoter persists settings in localStorage');
assert(appSource.includes('const storedSettings = readGolosAutoUpvoterSettings()') && appSource.includes('applyAutoUpvoterStoredSettings(storedSettings)') && appSource.includes('writeGolosAutoUpvoterSettings(settings)'), 'auto-upvoter restores settings into fields and saves collected settings');
assert(appSource.includes('form.addEventListener(\'input\', persistAutoUpvoterSettings)') && appSource.includes("form.addEventListener('change', (event)"), 'auto-upvoter saves form edits before page refresh');
assert(appSource.includes('async function renderGolosAutoUpvoter') && appSource.includes('await loadScript(chain.cryptoPath);') && appSource.includes('await renderGolosAutoUpvoter(chain)'), 'auto-upvoter loads SJCL before checking saved posting-key availability');
assert(appSource.includes('type="checkbox"'), 'UI renders account checkboxes, not only the top account selector');
assert(appSource.includes('Start') || appSource.includes('Запустить'), 'UI includes start affordance');
assert(appSource.includes('Stop') || appSource.includes('Остановить'), 'UI includes stop affordance');
assert(/расшифр/i.test(appSource) && /posting/i.test(appSource), 'UI warns posting keys are decrypted locally');
assert(appSource.includes('min-energy') || appSource.includes('minEnergy'), 'UI exposes min energy setting');
assert(appSource.includes('curator-coefficient') || appSource.includes('curatorCoefficient'), 'UI exposes curator coefficient setting');
assert(appSource.includes('favorites-percent') || appSource.includes('favoritesPercent'), 'UI exposes favorites percent setting');
assert(appSource.includes('auto-donate') || appSource.includes('autoDonate'), 'UI exposes auto-donate setting/cap');
assert(appSource.includes('Ручной донат автору') && appSource.includes('golosDonationPageUrl({ to: action && action.author'), 'auto-upvoter feed exposes manual donate link to normal confirmed donate flow');
assert(appSource.includes('Отменить апвот с подтверждением') && appSource.includes("'vote', [account, author, permlink, 0]") && appSource.includes('global.confirm(`Отменить апвот'), 'auto-upvoter feed exposes manual unvote with confirmation and weight=0');
assert(appSource.includes('data-auto-upvoter-vote') && appSource.includes('autoUpvoterPercentOptions') && appSource.includes('Голосовать с подтверждением'), 'manual unvote state is replaced by a vote control with -100..100 percent select');
assert(appSource.includes('manualVoteState.set(autoUpvoterActionKey') && appSource.includes('manualVoteState.get(autoUpvoterActionKey'), 'feed toggles manual state between vote and unvote after successful actions');
assert(appSource.includes('loadAutoUpvoterBatterySummary') && appSource.includes('auto-upvoter-battery') && appSource.includes('Перед списком постов'), 'auto-upvoter shows current battery before Start/Stop and before feed list');
assert((appSource.match(/await loadAutoUpvoterBatterySummary\(settings\)/g) || []).length >= 2, 'auto-upvoter refreshes battery after scanner ticks, not only before start');
assert(appSource.includes('setInterval') && appSource.includes('clearInterval'), 'Start/Stop wires a real local interval scanner');
assert(appSource.includes('runScannerTick'), 'UI Start calls scanner tick helper');
assert(appSource.includes('getAccountHistory') && appSource.includes('getDiscussionsByBlog'), 'UI scanner adapter uses Golos history/discussion RPC methods');
assert(appSource.includes('denis-skripnik') && /0\.2%|0,2%/.test(appSource), 'UI clearly shows auto-donate fee recipient and split');
assert(appSource.includes('Личный пул автодоната GOLOS'), 'UI names old personal-pool auto-donate model');
assert(appSource.includes('name="autoDonatePoolPercent"') && appSource.includes('name="autoDonatePoolCoefficient"'), 'UI splits old bot personal-pool value into separate percent and coefficient fields');
assert(appSource.includes('data-auto-donate-settings') && appSource.includes('syncAutoDonatePoolVisibility'), 'UI hides personal-pool fields until auto-donate checkbox is enabled');
assert(appSource.includes('joinAutoDonatePoolSettings') && appSource.includes('splitAutoDonatePoolSettings'), 'UI keeps backward-compatible legacy pool string while exposing split fields');
assert(appSource.includes('% дневной эмиссии') && appSource.includes('коэффициент'), 'UI explains old personal-pool percent/coefficient meaning without requiring bot-style combined input');
assert(helperSource.includes('broadcast.vote') || helperSource.includes("operationName: 'vote'"), 'Runner skeleton plans real Golos vote broadcast');
assert(/broadcast\.donate|operationName: 'donate'/.test(helperSource), 'Runner skeleton explicitly handles Golos donate broadcast availability');
assert(!appSource.includes('broadcastPlannedAction(scanChain, action, { confirmExecute: true })'), 'auto runner does not force per-action DposBroadcast confirmation after Start');

assert.strictEqual(typeof helpers.historyRowToCuratorVoteEvent, 'function', 'historyRowToCuratorVoteEvent helper exported');
assert.strictEqual(typeof helpers.discussionRowToFavoritePostEvent, 'function', 'discussionRowToFavoritePostEvent helper exported');
assert.strictEqual(typeof helpers.collectEventsFromAdapter, 'function', 'collectEventsFromAdapter helper exported');
assert.strictEqual(typeof helpers.planActionsForEvents, 'function', 'planActionsForEvents helper exported');
assert.strictEqual(typeof helpers.executePlannedActions, 'function', 'executePlannedActions helper exported');
assert.strictEqual(typeof helpers.runScannerTick, 'function', 'runScannerTick helper exported');
assert.strictEqual(typeof helpers.dedupePlannedActions, 'function', 'dedupePlannedActions helper exported');
assert.strictEqual(typeof helpers.upsertRunnerState, 'function', 'upsertRunnerState helper exported');
assert.strictEqual(typeof helpers.claimRunnerLocks, 'function', 'claimRunnerLocks helper exported for one runner per account/origin');
assert.strictEqual(typeof helpers.releaseRunnerLocks, 'function', 'releaseRunnerLocks helper exported');
assert.strictEqual(typeof helpers.buildDonateOperations, 'function', 'buildDonateOperations helper exported');
assert.strictEqual(typeof context.DposBroadcast.prepareForUser, 'function', 'prepareForUser helper supports per-account signing without global account switch');

const donateOps = helpers.buildDonateOperations({ account: 'alice', author: 'favorite', permlink: 'two', donate: { enabled: true, cap: 1.5 } });
assert.strictEqual(donateOps.length, 2, 'auto-donate creates author and fee donate operations');
assert.strictEqual(JSON.stringify(donateOps.map((op) => op.params.slice(0, 4))), JSON.stringify([
  ['alice', 'favorite', '1.497 GOLOS', '{"app":"dpos.space/auto-upvoter","type":"post_donate","author":"favorite","permlink":"two"}'],
  ['alice', 'denis-skripnik', '0.003 GOLOS', '{"app":"dpos.space/auto-upvoter","type":"fee_donate","author":"favorite","permlink":"two"}']
]), 'auto-donate split, recipient, amount, and memo follow stakebot-like rules');
assert.strictEqual(JSON.stringify(donateOps.map((op) => op.params[4])), JSON.stringify([[], []]), 'Golos donate params include empty extensions array');
assert.strictEqual(helpers.buildDonateOperations({ account: 'alice', author: 'favorite', permlink: 'two', donate: { enabled: true, cap: 0.49 } }).length, 0, 'auto-donate below old 0.5 GOLOS minimum is skipped without blocking the vote');
const oldPoolAmount = helpers.calculateDonateFromEmission('10 1.1', {
  vesting_shares: '1000.000000 GESTS',
  emission_delegated_vesting_shares: '100.000000 GESTS',
  emission_received_vesting_shares: '50.000000 GESTS'
}, {
  accumulative_emission_per_day: '200.000 GOLOS',
  total_vesting_shares: '10000.000000 GESTS'
}, 5000);
assert(Math.abs(oldPoolAmount - 0.886381341959967) < 0.000000001, 'personal pool matches old stakebot emission-percent/coefficient formula');
const enrichedDonate = helpers.enrichActionDonateFromEmission({ account: 'alice', author: 'favorite', permlink: 'pool', weight: 10000, donate: { enabled: true, pool: '10 1' } }, {
  vesting_shares: '1000.000000 GESTS',
  emission_delegated_vesting_shares: '0.000000 GESTS',
  emission_received_vesting_shares: '0.000000 GESTS',
  tip_balance: '100.000 GOLOS'
}, {
  accumulative_emission_per_day: '100.000 GOLOS',
  total_vesting_shares: '10000.000000 GESTS'
});
assert.strictEqual(enrichedDonate.donate.amount, 1, 'personal pool converts to calculated donate amount before broadcasting');

const settings = [
  { account: 'alice', enabled: true, curators: ['curator'], favorites: ['favorite'], minEnergy: 2500, curatorMode: 'repeat', curatorCoefficient: 50, favoritesPercent: 75, autoDonate: true, autoDonateCap: '10 1.1' },
  { account: 'bob', enabled: true, curators: ['curator'], favorites: ['favorite'], minEnergy: 5000, curatorMode: 'full', curatorCoefficient: 100, favoritesPercent: 80, autoDonate: false },
  { account: 'carol', enabled: false, curators: ['curator'], favorites: ['favorite'] }
];
const events = [
  { kind: 'curator_vote', voter: 'curator', author: 'post-author', permlink: 'one', weight: 6000, accountEnergy: 8000, source: 'history:1' },
  { kind: 'curator_vote', voter: 'curator', author: 'low-energy', permlink: 'skip', weight: 10000, accountEnergy: 1000, source: 'history:low-energy' },
  { kind: 'favorite_post', author: 'favorite', permlink: 'two', accountEnergy: 8000, source: 'feed:1' },
  { kind: 'favorite_post', author: 'favorite', permlink: 'two', accountEnergy: 8000, source: 'feed:1' }
];
const planned = helpers.planActionsForEvents(settings, events, { seen: new Set() });
assert(planned.some((action) => action.account === 'alice' && action.type === 'vote' && action.weight === 3000), 'repeat curator mode applies coefficient');
assert(!planned.some((action) => action.author === 'low-energy'), 'min energy is checked against account energy/charge, not incoming vote weight');
assert(planned.some((action) => action.account === 'bob' && action.type === 'vote' && action.weight === 10000), 'full curator mode plans full vote');
assert(planned.some((action) => action.account === 'alice' && action.source === 'favorite' && action.weight === 7500), 'favorite match uses favorites percent');
assert(!planned.some((action) => action.account === 'carol'), 'disabled accounts are ignored');

const deduped = helpers.dedupePlannedActions(planned.concat(planned), new Set());
const aliceFavoriteVotes = deduped.filter((action) => action.account === 'alice' && action.author === 'favorite' && action.permlink === 'two');
assert.strictEqual(aliceFavoriteVotes.length, 1, 'dedupe prevents repeated account/post/source action');
const crossSourceDuplicates = helpers.dedupePlannedActions([
  { type: 'vote', account: 'alice', source: 'favorite', author: 'same-author', permlink: 'same-post', weight: 7500 },
  { type: 'vote', account: 'alice', source: 'curator', author: 'same-author', permlink: 'same-post', weight: 3000 }
], new Set());
assert.strictEqual(crossSourceDuplicates.length, 1, 'dedupe prevents repeated vote for same account/post even when sources differ');

const historyEvent = helpers.historyRowToCuratorVoteEvent([42, { op: ['vote', { voter: 'curator', author: 'post-author', permlink: 'hist', weight: 4500 }], timestamp: '2026-01-01T00:00:00' }]);
assert.deepStrictEqual({ kind: historyEvent.kind, voter: historyEvent.voter, author: historyEvent.author, permlink: historyEvent.permlink, weight: historyEvent.weight }, { kind: 'curator_vote', voter: 'curator', author: 'post-author', permlink: 'hist', weight: 4500 }, 'history row extracts curator vote event');
assert(historyEvent.source.includes('history:42'), 'history event includes stable row source');
assert.strictEqual(helpers.historyRowToCuratorVoteEvent([43, { op: ['transfer', {}] }]), null, 'non-vote history row is ignored');

const discussionEvent = helpers.discussionRowToFavoritePostEvent({ author: 'favorite', permlink: 'new-post', created: '2026-01-01T00:00:00' }, 'favorite');
assert.deepStrictEqual({ kind: discussionEvent.kind, author: discussionEvent.author, permlink: discussionEvent.permlink }, { kind: 'favorite_post', author: 'favorite', permlink: 'new-post' }, 'discussion row extracts favorite post event');
assert(discussionEvent.source.includes('favorite'), 'favorite event includes source');
assert.strictEqual(helpers.discussionRowToFavoritePostEvent({ author: '', permlink: '' }, 'favorite'), null, 'incomplete discussion row is ignored');

(async () => {
  const adapterCalls = [];
  const eventsFromAdapter = await helpers.collectEventsFromAdapter({
    async getAccountHistory(account) {
      adapterCalls.push(['history', account]);
      return [[7, { op: ['vote', { voter: account, author: 'target', permlink: `${account}-vote`, weight: 2000 }] }]];
    },
    async getFavoritePosts(account) {
      adapterCalls.push(['favorite', account]);
      return [{ author: account, permlink: `${account}-post` }];
    }
  }, settings);
  assert(eventsFromAdapter.some((event) => event.kind === 'curator_vote' && event.voter === 'curator'), 'adapter collects curator history events');
  assert(eventsFromAdapter.some((event) => event.kind === 'favorite_post' && event.author === 'favorite'), 'adapter collects favorite discussion events');
  assert.deepStrictEqual(adapterCalls.sort(), [['favorite', 'favorite'], ['history', 'curator']].sort(), 'adapter scans unique enabled curators/favorites');

  const tickState = { seen: new Set() };
  const executed = [];
  const firstTick = await helpers.runScannerTick({ id: 'golos' }, settings, {
    async getAccountHistory() { return [[9, { op: ['vote', { voter: 'curator', author: 'target', permlink: 'once', weight: 10000 }] }]]; },
    async getFavoritePosts() { return []; }
  }, tickState, {
    async broadcaster(chain, action) { executed.push(`${action.account}:${action.author}/${action.permlink}`); return { ok: true }; }
  });
  const secondTick = await helpers.runScannerTick({ id: 'golos' }, settings, {
    async getAccountHistory() { return [[9, { op: ['vote', { voter: 'curator', author: 'target', permlink: 'once', weight: 10000 }] }]]; },
    async getFavoritePosts() { return []; }
  }, tickState, {
    async broadcaster(chain, action) { executed.push(`repeat:${action.account}`); return { ok: true }; }
  });
  assert(firstTick.actions.length >= 2, 'runner plans actions for multiple enabled accounts');
  assert.strictEqual(secondTick.actions.length, 0, 'seen keys prevent repeats across ticks');
  assert(executed.includes('alice:target/once') && executed.includes('bob:target/once'), 'runner executes per account');

  const voteCalls = [];
  const donateCalls = [];
  const broadcastOptions = [];
  let failDonates = false;
  context.DposAuth = {
    getUsers() { return [{ login: 'alice', posting: 'enc-a' }, { login: 'bob', posting: 'enc-b' }]; },
    getUserLogin(user) { return user.login; },
    getUserType() { return 'standard'; }
  };
  context.sjcl = { decrypt(passphrase, encrypted) { return encrypted === 'enc-b' ? '5HueCGU8rMjxEXxiPuD5BDuRaD4SLQ44yd8SAt5yFPiFoUiTtBn' : '5KQwrPbwdL6PhXujxW37FSSQKgB2Q5DRYXdA7w6v9CAbxvZV4Hq'; } };
  context.golos = {
    auth: { wifToPublic() { return 'GLS111'; } },
    api: { async getAccountsAsync() { return [{ posting: { key_auths: [['GLS111', 1]] } }]; } },
    broadcast: {
      async donateAsync(key, from, to, amount, memo, extensions) {
        donateCalls.push({ key, from, to, amount, memo, extensions });
        if (failDonates) throw new Error('insufficient balance for donate');
        return { to, amount };
      },
      async voteAsync(key, voter, author, permlink, weight) {
        voteCalls.push({ key, voter, author, permlink, weight });
        return { voter };
      }
    }
  };
  const realBroadcast = context.DposBroadcast.broadcast;
  context.DposBroadcast = Object.assign({}, context.DposBroadcast, {
    async broadcast(chain, prepared, options) {
      broadcastOptions.push({ operationName: prepared.operationName, options });
      return realBroadcast(chain, prepared, options);
    }
  });
  await helpers.broadcastPlannedAction({ id: 'golos', libraryGlobal: 'golos' }, { type: 'vote', account: 'bob', author: 'target', permlink: 'signed-by-bob', weight: 10000, source: 'curator' });
  assert.deepStrictEqual(voteCalls.map((call) => call.voter), ['bob'], 'per-account signing uses prepareForUser for the action account, not current account only');
  await helpers.broadcastPlannedAction({ id: 'golos', libraryGlobal: 'golos' }, { type: 'vote', account: 'alice', author: 'favorite', permlink: 'donated-post', weight: 7500, source: 'favorite', donate: { enabled: true, cap: 1 } });
  assert.deepStrictEqual(voteCalls.map((call) => call.voter), ['bob', 'alice'], 'auto-donate no longer blocks the planned vote when donate is available');
  assert.strictEqual(JSON.stringify(donateCalls.map((call) => [call.from, call.to, call.amount, call.extensions])), JSON.stringify([
    ['alice', 'favorite', '0.998 GOLOS', []],
    ['alice', 'denis-skripnik', '0.002 GOLOS', []]
  ]), 'auto-donate broadcasts author donate then denis-skripnik fee');
  failDonates = true;
  const skippedDonateResult = await helpers.broadcastPlannedAction({ id: 'golos', libraryGlobal: 'golos' }, { type: 'vote', account: 'alice', author: 'favorite', permlink: 'no-donate-balance', weight: 7500, source: 'favorite', donate: { enabled: true, cap: 1 } });
  assert.deepStrictEqual(voteCalls.map((call) => call.voter), ['bob', 'alice', 'alice'], 'insufficient donate balance does not block the vote or the next action');
  assert.strictEqual(skippedDonateResult.donateSkipped.length, 1, 'insufficient donate balance is reported as skipped donate, not action failure');
  assert(/insufficient/i.test(skippedDonateResult.donateSkipped[0].error), 'skipped donate preserves the insufficient-balance reason');
  assert.strictEqual(JSON.stringify(broadcastOptions.map((call) => [call.operationName, call.options && call.options.confirmExecute])), JSON.stringify([
    ['vote', false],
    ['vote', false],
    ['donate', false],
    ['donate', false],
    ['vote', false],
    ['donate', false]
  ]), 'auto runner broadcasts vote/donate without per-action confirmExecute true and stops donate attempts after insufficient balance');

  const storageMap = new Map();
  const storage = {
    getItem(key) { return storageMap.has(key) ? storageMap.get(key) : null; },
    setItem(key, value) { storageMap.set(key, value); },
    removeItem(key) { storageMap.delete(key); }
  };
  const firstLock = helpers.claimRunnerLocks({ id: 'golos' }, ['alice'], 'tab-a', storage, 1000, 90000);
  assert.strictEqual(firstLock.accounts.join(','), 'alice', 'runner lock claims account');
  assert.throws(() => helpers.claimRunnerLocks({ id: 'golos' }, ['alice'], 'tab-b', storage, 2000, 90000), /already running/, 'second tab cannot claim the same active account');
  helpers.claimRunnerLocks({ id: 'golos' }, ['alice'], 'tab-a', storage, 3000, 90000);
  helpers.releaseRunnerLocks({ id: 'golos' }, ['alice'], 'tab-a', storage);
  helpers.claimRunnerLocks({ id: 'golos' }, ['alice'], 'tab-b', storage, 4000, 90000);

  console.log('Golos auto-upvoter MVP smoke passed');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
