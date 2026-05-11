const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const appSource = fs.readFileSync(path.join(root, 'v3/js/app.js'), 'utf8');
const chainsSource = fs.readFileSync(path.join(root, 'v3/js/chains.js'), 'utf8');
const broadcastSource = fs.readFileSync(path.join(root, 'v3/js/broadcast.js'), 'utf8');
const planSource = fs.readFileSync(path.join(root, 'plan.md'), 'utf8');

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}`);
  assert(start >= 0, `${name} exists`);
  let depth = 0;
  let seenBody = false;
  for (let i = start; i < source.length; i += 1) {
    if (source[i] === '{') {
      depth += 1;
      seenBody = true;
    } else if (source[i] === '}') {
      depth -= 1;
      if (seenBody && depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error(`Unable to extract ${name}`);
}

const legacyRoot = path.resolve(root, '../dpos.space/blockchains/hive/apps/backup');
const legacyConfig = fs.readFileSync(path.join(legacyRoot, 'config.json'), 'utf8');
const legacyContent = fs.readFileSync(path.join(legacyRoot, 'content.php'), 'utf8');
const legacyIndex = fs.readFileSync(path.join(legacyRoot, 'index.php'), 'utf8');

assert(legacyConfig.includes('Бекап постов') && legacyConfig.includes('tools'), 'legacy Hive backup config inspected');
assert(legacyContent.includes('0.5 HBD или 1 HIVE') && legacyContent.includes('posts;') && legacyContent.includes('reblogs'), 'legacy Hive payment/reblog form inspected');
assert(legacyContent.includes('Markdown') && legacyContent.includes('HTML') && legacyContent.includes('service" value="backup"'), 'legacy Hive backup format controls inspected');
assert(legacyIndex.includes('functions.php') && legacyIndex.includes('page/content.php'), 'legacy Hive backup index/PHP page dependency inspected');

const routeAlias = extractFunction(appSource, 'legacyAppTarget');
const renderBackup = extractFunction(appSource, 'renderHiveBackup');
const bindHelper = extractFunction(appSource, 'bindHiveBackupForm');
const loadHelper = extractFunction(appSource, 'loadSteemBackupPosts');
const filterHelper = extractFunction(appSource, 'filterSteemBackupPosts');
const formatHelper = extractFunction(appSource, 'formatSteemBackupPost');
const downloadHelper = extractFunction(appSource, 'downloadTextFile');
const renderRouterStart = appSource.indexOf('async function renderRoute');
const renderRouterEnd = appSource.indexOf("chainSelect.addEventListener('change'", renderRouterStart);
assert(renderRouterStart >= 0 && renderRouterEnd > renderRouterStart, 'render router slice exists');
const renderRouter = appSource.slice(renderRouterStart, renderRouterEnd);

assert(chainsSource.includes('const hiveApps = socialApps.concat') && chainsSource.includes("{ id: 'backup', title: 'Бекап постов'"), 'Hive backup app is registered without using Steem app list');
assert(chainsSource.includes('apps: apps(hiveApps)'), 'Hive uses hiveApps route list');
assert(routeAlias.includes("backup: 'backup'"), 'legacy backup route remains directly covered');
assert(renderRouter.includes("chain.id === 'hive' && effectiveAppId === 'backup'"), 'router dispatches Hive backup to dedicated renderer');
assert(renderRouter.includes('await renderHiveBackup(chain, account)'), 'router awaits Hive backup renderer');

for (const marker of [
  'hive-backup-form',
  'hive-backup-user',
  'hive-backup-reblogs',
  'hive-backup-format',
  'Markdown',
  'HTML',
  'role="status" aria-live="polite"',
  'downloadTextFile(`hive-posts-${safeAccount}.${extension}`',
  'getDiscussionsByBlog',
  'filterSteemBackupPosts',
  'formatSteemBackupPost'
]) {
  assert(renderBackup.includes(marker) || bindHelper.includes(marker) || loadHelper.includes(marker) || filterHelper.includes(marker) || formatHelper.includes(marker), `Hive backup renderer/helper covers marker ${marker}`);
}

for (const legacyCopy of [
  'Бекап постов',
  'Имя пользователя (логин) на Hive',
  'Скачивать ли репосты?',
  'Нет: только посты моего аккаунта',
  'Да: все репосты',
  'Выберите формат сохранения материалов',
  'Запуск',
  'скачать только записи, доступные публичной Hive RPC-ноде'
]) {
  assert(renderBackup.includes(legacyCopy), `Hive backup preserves static-safe legacy copy: ${legacyCopy}`);
}

const runtimeSlice = routeAlias + renderRouter + renderBackup + bindHelper + loadHelper + filterHelper + formatHelper + downloadHelper;
for (const forbidden of ['backend.dpos.space', '178.20.43.121', '/vendor/autoload.php', 'blockchains/hive/apps/backup', 'archives/', 'users/', 'ZipArchive', 'ajax.php']) {
  assert(!runtimeSlice.includes(forbidden), `Hive backup runtime does not depend on ${forbidden}`);
}
assert(!runtimeSlice.includes('broadcast.prepare'), 'Hive backup does not prepare transactions');
assert(!runtimeSlice.includes('broadcast.broadcast'), 'Hive backup does not broadcast transactions');
assert(!runtimeSlice.includes('localStorage.setItem'), 'Hive backup does not store exported content or keys in localStorage');
assert(!runtimeSlice.includes('privateKey') && !runtimeSlice.includes('PostingKey') && !runtimeSlice.includes('sjcl.decrypt'), 'Hive backup does not read or export private keys');
assert(!/prepareHive.*backup|broadcastHive.*backup/.test(broadcastSource), 'broadcast layer has no Hive backup operation');

for (const evidence of [
  '### Rigorous parity: Hive / backup',
  'blockchains/hive/apps/backup/config.json',
  'blockchains/hive/apps/backup/content.php',
  'blockchains/hive/apps/backup/index.php',
  '0.5 HBD или 1 HIVE',
  'server-side archive',
  'static-safe local download',
  'tests/v3-hive-backup-smoke.js'
]) {
  assert(planSource.includes(evidence), `plan.md records Hive backup evidence: ${evidence}`);
}

console.log('v3 Hive backup smoke passed');
