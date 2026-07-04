const assert = require('assert');
const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');

const root = path.resolve(__dirname, '..');
const appSource = fs.readFileSync(path.join(root, 'v3/js/app.js'), 'utf8');
const chainsSource = fs.readFileSync(path.join(root, 'v3/js/chains.js'), 'utf8');
const profilesSource = fs.readFileSync(path.join(root, 'v3/js/profiles.js'), 'utf8');
const planSource = fs.readFileSync(path.join(root, 'plan.md'), 'utf8');

function readLegacyFile(relativePath) {
  const localPath = path.resolve(root, '../dpos.space', relativePath);
  if (fs.existsSync(localPath)) return fs.readFileSync(localPath, 'utf8');
  return childProcess.execFileSync('git', ['show', `master:${relativePath}`], { cwd: root, encoding: 'utf8' });
}

const legacyIndex = readLegacyFile('blockchains/viz/apps/profiles/index.php');
const legacyContent = readLegacyFile('blockchains/viz/apps/profiles/content.php');
const legacyUserinfo = readLegacyFile('blockchains/viz/apps/profiles/page/userinfo.php');
const legacyHistoryJs = readLegacyFile('blockchains/viz/apps/profiles/js/app.js');

assert(legacyContent.includes('Введите логин без @'), 'legacy profile search form inspected');
assert(legacyIndex.includes('/transfers') && legacyIndex.includes('/receive-awards') && legacyIndex.includes('/subscriptions'), 'legacy profile subpage nav inspected');
assert(legacyIndex.includes('award_modal/ajax.php'), 'legacy modal award dependency inspected');
assert(legacyUserinfo.includes('get_dynamic_global_properties') && legacyUserinfo.includes('CHAIN_ENERGY_REGENERATION_SECONDS'), 'legacy profile RPC snippets inspected');
assert(legacyHistoryJs.includes("'receive_award'") && legacyHistoryJs.includes("'paid_subscribe'"), 'legacy VIZ history operation map inspected');

assert(chainsSource.includes("id: 'profiles'") && chainsSource.includes("Профили"), 'profiles app is registered in v3 chain apps');
assert(appSource.includes('async function renderProfileRoute(chain, account)'), 'v3 has dedicated profile route renderer');
assert(appSource.includes('function vizLegacyProfileLinks(account)'), 'VIZ profiles expose a legacy subpage to static history-link mapper');
assert(appSource.includes("'Переводы средств'") && appSource.includes("transfer,transfer_to_vesting,create_invite,claim_invite_balance,use_invite_balance"), 'VIZ transfers subpage maps to public history filters');
assert(appSource.includes("'Соц. капитал'") && appSource.includes("delegate_vesting_shares,transfer_to_vesting,withdraw_vesting,return_vesting_delegation"), 'VIZ shares subpage maps to history filters');
assert(appSource.includes("'ДАО'") && appSource.includes("committee_worker_create_request,committee_vote_request,committee_pay_request"), 'VIZ DAO subpage maps to history filters');
assert(appSource.includes("'Отправленные награды'") && appSource.includes("award,fixed_award"), 'VIZ awards subpage maps to history filters');
assert(appSource.includes("'Полученные награды'") && appSource.includes("receive_award"), 'VIZ receive awards subpage maps to history filters');
assert(appSource.includes("'Бенефициарские'") && appSource.includes("benefactor_award"), 'VIZ benefactor awards subpage maps to history filters');
assert(appSource.includes("'Платные подписки'") && appSource.includes("set_paid_subscription,paid_subscribe,paid_subscription_action,cancel_paid_subscription"), 'VIZ subscriptions subpage maps to history filters');
assert(appSource.includes("'Наградить пользователя'") && appSource.includes("app: 'award'"), 'VIZ profile page points award action to static award app');
assert(appSource.includes("'Изменить профиль'") && appSource.includes("app: 'manage'"), 'VIZ profile page points edit action to static manage app');
assert(appSource.includes("'Быстрые переходы по профилю VIZ'"), 'VIZ profile links use user-facing labels');
const profileSliceStart = appSource.indexOf('function vizLegacyProfileLinks(account)');
const profileSliceEnd = appSource.indexOf('function renderGolosUiaProfileSection(profile)');
const profileRuntimeSlice = appSource.slice(profileSliceStart, profileSliceEnd);
assert(!/backend\.dpos\.space|blockchains\/viz\/apps\/profiles\/award_modal\/ajax\.php|profiles\/page\/[^'\"]+\.php/.test(profileRuntimeSlice), 'v3 runtime does not call legacy PHP/private backend for VIZ profiles');
assert(!/bindOperationForm\(chain, 'profiles/.test(appSource), 'VIZ profiles route remains read-only and does not bind broadcast forms');
assert(profilesSource.includes("if (chainId === 'viz')"), 'profile normalizer has VIZ-specific fields');
assert(planSource.includes('### Rigorous parity: VIZ / profiles'), 'plan contains VIZ profiles parity section');
assert(planSource.includes('award_modal/ajax.php') && planSource.includes('static award app'), 'plan documents legacy award modal replacement');
assert(planSource.includes('profiles/page/transfers.php') && planSource.includes('history filters'), 'plan documents legacy PHP profile subpages as static history filters');

console.log('v3 VIZ profiles smoke passed');
