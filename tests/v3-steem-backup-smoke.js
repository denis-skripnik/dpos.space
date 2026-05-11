const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const appSource = fs.readFileSync(path.join(root, 'v3/js/app.js'), 'utf8');
const chainsSource = fs.readFileSync(path.join(root, 'v3/js/chains.js'), 'utf8');
const broadcastSource = fs.readFileSync(path.join(root, 'v3/js/broadcast.js'), 'utf8');
const profilesSource = fs.readFileSync(path.join(root, 'v3/js/profiles.js'), 'utf8');
const historySource = fs.readFileSync(path.join(root, 'v3/js/history.js'), 'utf8');
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

const routeAlias = extractFunction(appSource, 'legacyAppTarget');
const renderBackup = extractFunction(appSource, 'renderSteemBackup');
const downloadHelper = extractFunction(appSource, 'downloadTextFile');
const bindHelper = extractFunction(appSource, 'bindSteemBackupForm');
const loadHelper = extractFunction(appSource, 'loadSteemBackupPosts');
const filterHelper = extractFunction(appSource, 'filterSteemBackupPosts');
const formatHelper = extractFunction(appSource, 'formatSteemBackupPost');
const tagsHelper = extractFunction(appSource, 'parseSteemBackupTags');
const renderRouterStart = appSource.indexOf('async function renderRoute');
const renderRouterEnd = appSource.indexOf("chainSelect.addEventListener('change'", renderRouterStart);
assert(renderRouterStart >= 0 && renderRouterEnd > renderRouterStart, 'renderApp router slice exists');
const renderRouter = appSource.slice(renderRouterStart, renderRouterEnd);

assert(chainsSource.includes("const steemApps = socialApps.concat"), 'Steem has its own app list for backup without widening Hive');
assert(chainsSource.includes("{ id: 'backup', title: 'Бекап постов'"), 'Steem backup app is registered');
assert(chainsSource.includes('apps: apps(steemApps)'), 'Steem uses steemApps route list');
assert(!chainsSource.slice(chainsSource.indexOf('hive: {')).includes('apps: apps(steemApps)'), 'Hive does not inherit Steem backup by accident');
assert(routeAlias.includes("backup: 'backup'"), 'legacy backup route remains directly covered');
assert(renderRouter.includes("chain.id === 'steem' && effectiveAppId === 'backup'"), 'router dispatches Steem backup to dedicated renderer');
assert(renderRouter.includes('await renderSteemBackup(chain, account)'), 'router awaits Steem backup renderer');

for (const marker of [
  'steem-backup-form',
  'steem-backup-user',
  'steem-backup-reblogs',
  'steem-backup-format',
  'Markdown',
  'HTML',
  'role="status" aria-live="polite"',
  'downloadTextFile(`steem-posts-${safeAccount}.${extension}`',
  'getDiscussionsByBlog',
  'filterSteemBackupPosts',
  'formatSteemBackupPost'
]) {
  assert(renderBackup.includes(marker) || bindHelper.includes(marker) || loadHelper.includes(marker) || filterHelper.includes(marker) || formatHelper.includes(marker) || tagsHelper.includes(marker), `Steem backup renderer/helper covers marker ${marker}`);
}

for (const legacyCopy of [
  'Бекап постов',
  'Имя пользователя (логин) на Steem',
  'Скачивать ли репосты?',
  'Нет: только посты моего аккаунта',
  'Да: все репосты',
  'Выберите формат сохранения материалов',
  'Запуск',
  'скачать только записи, доступные публичной Steem RPC-ноде'
]) {
  assert(renderBackup.includes(legacyCopy), `Steem backup preserves static-safe legacy copy: ${legacyCopy}`);
}

for (const marker of [
  "profiles.apiCall(connection, 'getDiscussionsByBlog'",
  "tag: account",
  "limit: STEEM_BACKUP_LIMIT",
  "start_author",
  "start_permlink",
  "includeReblogs === 'yes3'",
  "post.author === account",
  "json_metadata",
  "downloadTextFile",
  "setOperationResult"
]) {
  assert(bindHelper.includes(marker) || renderBackup.includes(marker) || loadHelper.includes(marker) || filterHelper.includes(marker) || formatHelper.includes(marker) || tagsHelper.includes(marker), `Steem backup local/public helper evidence: ${marker}`);
}

const runtimeSlice = routeAlias + renderRouter + renderBackup + bindHelper + loadHelper + filterHelper + formatHelper + tagsHelper + downloadHelper;
for (const forbidden of ['backend.dpos.space', '178.20.43.121', '/vendor/autoload.php', 'blockchains/steem/apps/backup', 'archives/', 'users/', 'ZipArchive', 'ajax.php']) {
  assert(!runtimeSlice.includes(forbidden), `Steem backup runtime does not depend on ${forbidden}`);
}
assert(!runtimeSlice.includes('broadcast.prepare'), 'Steem backup does not prepare transactions');
assert(!runtimeSlice.includes('broadcast.broadcast'), 'Steem backup does not broadcast transactions');
assert(!runtimeSlice.includes('localStorage.setItem'), 'Steem backup does not store exported content or keys in localStorage');
assert(!runtimeSlice.includes('privateKey') && !runtimeSlice.includes('PostingKey') && !runtimeSlice.includes('sjcl.decrypt'), 'Steem backup does not read or export private keys');
assert(broadcastSource.includes('steem') && profilesSource.includes('apiCall') && historySource.includes('steem'), 'shared Steem helpers remain available while backup is local/export-only');

for (const evidence of [
  '### Rigorous parity: Steem / backup',
  'blockchains/steem/apps/backup/config.json',
  'blockchains/steem/apps/backup/content.php',
  'blockchains/steem/apps/backup/index.php',
  'blockchains/steem/apps/backup/page/config.json',
  'blockchains/steem/apps/backup/page/content.php',
  'blockchains/steem/apps/backup/page/functions.php',
  'blockchains/steem/apps/backup/page/GetDiscussionsByLogin.php',
  'GetAccountHistoryCommand',
  'GetDiscussionsByBlogCommand',
  'ZipArchive',
  'server-side archive',
  'static-safe local download',
  'tests/v3-steem-backup-smoke.js'
]) {
  assert(planSource.includes(evidence), `plan.md records Steem backup evidence: ${evidence}`);
}

console.log('v3 Steem backup smoke passed');
