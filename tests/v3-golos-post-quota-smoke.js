const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const appSource = fs.readFileSync(path.join(root, 'v3/js/app.js'), 'utf8');
const profilesSource = fs.readFileSync(path.join(root, 'v3/js/profiles.js'), 'utf8');
const planSource = fs.readFileSync(path.join(root, 'plan.md'), 'utf8');

const context = { window: null, Date };
context.window = context;
vm.createContext(context);
vm.runInContext(profilesSource, context, { filename: 'v3/js/profiles.js' });

const account = (postBandwidth, lastPost, extra = {}) => ({
  post_bandwidth: postBandwidth,
  last_post: lastPost,
  _v3ProfileContext: { dynamicProperties: { time: '2026-05-14T12:00:00' } },
  ...extra
});

assert.strictEqual(
  context.DposProfiles.computeGolosPostQuota(account(50000, '2026-05-13T10:00:00')).text,
  '4',
  'more than one day after the last post restores all 4 penalty-free posts'
);
assert.strictEqual(
  context.DposProfiles.computeGolosPostQuota(account(40000, '2026-05-14T12:00:00')).text,
  '0. Опубликовать пост без штрафа возможно через 6 ч.',
  'high current post bandwidth reports 0 posts and time until one post is safe'
);
assert.strictEqual(
  context.DposProfiles.computeGolosPostQuota(account(20000, '2026-05-14T00:00:00')).text,
  '3. 4 станет через 12 ч.',
  'legacy middle band reports remaining posts and next restoration time'
);
assert.strictEqual(
  context.DposProfiles.computeGolosPostQuota(account(10000, '2026-05-13T15:50:00')).text,
  '3. 4 станет через 3 ч. 50 мин.',
  'one post almost a day ago restores the fourth safe post after the remaining part of the day'
);

const normalized = context.DposProfiles.normalizeAccount({ config: { id: 'golos', powerTitle: 'СГ' }, node: 'test' }, account(20000, '2026-05-14T00:00:00'));
assert(
  normalized.economyRows.some(([label, value]) => label === 'Количество постов, которое можно опубликовать без штрафа' && value === '3. 4 станет через 12 ч.'),
  'Golos profile economy rows include the legacy post quota statistic'
);
assert(
  !normalized.economyRows.some(([label]) => label === 'Post bandwidth'),
  'Golos profile does not expose raw technical post_bandwidth value from RPC'
);
assert(
  !normalized.economyRows.some(([label]) => label === 'Frozen'),
  'Golos profile does not expose raw frozen=false value from RPC'
);
assert(
  !normalized.economyRows.some(([label]) => label === 'Vesting withdraw rate' || label === 'Следующий вывод'),
  'Golos profile hides empty vesting withdraw values and sentinel dates'
);

const withdrawingAccount = account(20000, '2026-05-14T00:00:00', {
  vesting_withdraw_rate: '1000000.000000 GESTS',
  next_vesting_withdrawal: '2026-05-20T12:34:56',
  frozen: true,
  _v3ProfileContext: {
    dynamicProperties: {
      time: '2026-05-14T12:00:00',
      total_vesting_fund_steem: '100.000 GOLOS',
      total_vesting_shares: '100000000.000000 GESTS'
    }
  }
});
const withdrawing = context.DposProfiles.normalizeAccount({ config: { id: 'golos', powerTitle: 'СГ', liquidSymbol: 'GOLOS' }, node: 'test' }, withdrawingAccount);
assert(
  withdrawing.economyRows.some(([label, value]) => label === 'Сумма вывода из СГ' && value === '1 СГ'),
  'Golos vesting withdraw rate is converted from raw GESTS to readable SG'
);
assert(
  withdrawing.economyRows.some(([label, value]) => label === 'Следующий вывод' && value === '20 мая 2026 г. 12:34:56'),
  'Golos next vesting withdrawal date is shown in the old readable Russian format'
);
assert(
  withdrawing.economyRows.some(([label, value]) => label === 'Аккаунт заморожен' && value === 'Да'),
  'Golos frozen status is shown only when it matters'
);

for (const marker of [
  'id="editor-post-quota"',
  'profiles.computeGolosPostQuota(enrichedAccount)',
  'Можно опубликовать без штрафа:',
  'updateGolosEditorPostQuota(chain)',
  'role="status" aria-live="polite"'
]) {
  assert(appSource.includes(marker), `Golos editor exposes quota marker: ${marker}`);
}

assert(appSource.includes('select id="history-ops"') && appSource.includes('renderOperationSelectOptions(chain, selectedOps)'), 'history uses select with human-readable operation labels');
assert(planSource.includes('Golos post quota without penalty'), 'plan records current Golos post quota focus');
assert(planSource.includes('Количество постов, которое можно опубликовать без штрафа'), 'plan records the restored legacy profile statistic');

console.log('v3-golos-post-quota-smoke ok');
