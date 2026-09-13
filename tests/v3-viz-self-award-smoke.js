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
assert(appSource.includes('Что вводить:') && appSource.includes('обычный процент энергии') && appSource.includes('При 95%') && appSource.includes('при 99%') && appSource.includes('при 99.9%'), 'VIZ self-award explains threshold choices in plain language with concrete examples');
assert(appSource.includes('Если энергия равна выбранному порогу или ниже, сервис ничего не отправляет'), 'VIZ self-award explains the inactive threshold case');
assert(appSource.includes('Точный параметр сети: 100% энергии восстанавливается за 432000 секунд'), 'VIZ self-award retains the exact mathematical network explanation');
assert(appSource.includes('function vizSelfAwardMinEnergyPercent') && appSource.includes("vizSelfAwardMinEnergyPercent(saved.minEnergy || '9500')"), 'legacy basis-point settings are displayed as ordinary percent values');
assert(appSource.includes('Минимальная энергия, %') && !appSource.includes('Минимальная энергия, % или шкала 0–10000'), 'VIZ self-award field asks only for an ordinary percent');
assert(appSource.includes('max="99.99" step="0.01"') && appSource.includes('value="95"'), 'VIZ self-award percent controls expose understandable limits and default');
assert(appSource.includes('input.value = vizSelfAwardMinEnergyPercent(value)'), 'apply-to-all keeps visible values in percent while saving internal basis points');

const energyHelpersSource = appSource.slice(
  appSource.indexOf('function normalizeVizSelfAwardMinEnergy'),
  appSource.indexOf('function currentVizEnergy')
) + '\nthis.__vizEnergyHelpers = { normalizeVizSelfAwardMinEnergy, vizSelfAwardMinEnergyPercent };';
vm.runInContext(energyHelpersSource, context, { filename: 'v3/js/app.js#viz-self-award-energy-helpers' });
assert.strictEqual(context.__vizEnergyHelpers.normalizeVizSelfAwardMinEnergy('95'), 9500, 'visible 95 percent still saves as internal 9500');
assert.strictEqual(context.__vizEnergyHelpers.normalizeVizSelfAwardMinEnergy('99.9'), 9990, 'visible 99.9 percent still saves as internal 9990');
assert.strictEqual(context.__vizEnergyHelpers.vizSelfAwardMinEnergyPercent('9500'), '95', 'legacy stored 9500 displays as 95 percent');
assert.strictEqual(context.__vizEnergyHelpers.vizSelfAwardMinEnergyPercent('9900'), '99', 'legacy stored 9900 displays as 99 percent');
assert.strictEqual(context.__vizEnergyHelpers.vizSelfAwardMinEnergyPercent('9990'), '99.9', 'stored 9990 displays as 99.9 percent');

console.log('v3 VIZ self-award smoke passed');
