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
const broadcastSource = fs.readFileSync(path.join(root, 'v3/js/broadcast.js'), 'utf8');

const app = chains.viz.apps.find((item) => item.id === 'viz-self-award');
assert(app, 'VIZ self-award app route is registered');
assert.strictEqual(app.title, 'Автонаграда себе', 'VIZ self-award has user-facing title');
assert.strictEqual(app.accountField, false, 'VIZ self-award uses saved account list, not a free account input');

for (const marker of [
  'function renderVizSelfAward(chain)',
  'data-viz-self-award-account',
  'auth.getUsers(chain)',
  'Regular-ключ',
  'Скопировать минимум на все аккаунты',
  'viz-self-award-auto-start',
  'Запускать автоматически при открытии Android-приложения',
  'VIZ_SELF_AWARD_TICK_MS = 432000',
  'VIZ_SELF_AWARD_REGENERATION_SECONDS = 432000',
  'VIZ_SELF_AWARD_MAX_SPEND = 10',
  "VIZ_SELF_AWARD_MEMO = 'dpos.space: VIZ self-award'",
  'Android native VIZ self-award включён',
  'function syncAndroidVizSelfAwardSettings(settings)',
  'function autoSyncStoredVizSelfAwardForAndroid()',
  '__dposVizSelfAwardGlobalAutoSynced',
  'Android native VIZ self-award auto-sync',
  "callAndroidWorkerBridge('syncVizSelfAwardSettings'",
  'enabled: Boolean(row.enabled)',
  'autoStart: Boolean(row.autoStart)',
  "authority: 'regular'",
  "callAndroidWorkerBridge('importSecureKey'",
  "callAndroidWorkerBridge('startWorker'",
  "broadcast.prepareForUser(chain, user, 'regular', 'award'",
  "feature: 'viz-self-award'",
  "autoConsent: 'viz-self-award-start'",
  "initiator и receiver совпадают"
]) {
  assert(appSource.includes(marker), `VIZ self-award implementation marker exists: ${marker}`);
}

assert(appSource.includes("effectiveAppId === 'viz-self-award'"), 'router dispatches VIZ self-award page');
assert(appSource.includes("'viz-self-award'].includes(app.id)"), 'authorized account selector includes VIZ self-award');
assert(broadcastSource.includes("settings.autoConsent === 'viz-self-award-start'") && broadcastSource.includes("prepared.meta.feature === 'viz-self-award'"), 'broadcast auto-consent is narrowly allowed for VIZ self-award only');
assert(!/id=\"viz-self-award-account\"|name=\"account\"/.test(appSource.slice(appSource.indexOf('function renderVizSelfAward'), appSource.indexOf('const GOLOS_AUTO_UPVOTER_SETTINGS_KEY'))), 'VIZ self-award renderer does not add a free account text input');

console.log('v3 VIZ self-award smoke passed');
