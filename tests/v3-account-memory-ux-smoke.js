const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const indexSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const appSource = fs.readFileSync(path.join(root, 'v3/js/app.js'), 'utf8');
const planSource = fs.readFileSync(path.join(root, 'plan.md'), 'utf8');

const accountSelectorVisibleSlice = (appSource.match(/function accountSelectorVisible[\s\S]*?\n  }/) || [''])[0];
const updateAccountFieldSlice = (appSource.match(/function updateAccountField[\s\S]*?\n  }/) || [''])[0];
const routeSubmitSlice = (appSource.match(/routeForm\.addEventListener\('submit'[\s\S]*?\n  \}\);/) || [''])[0];

assert(indexSource.includes('<datalist id="recent-account-list"></datalist>'), 'global account input has native datalist for recent viewed account suggestions');
assert(indexSource.includes('list="recent-account-list"'), 'account input is wired to the recent-account datalist');

assert(appSource.includes('RECENT_ACCOUNT_LIMIT = 15'), 'recent viewed account list is capped');
assert(appSource.includes('recentAccountsKey(chain)'), 'recent viewed accounts use per-chain localStorage keys');
assert(appSource.includes("`${chain.id}_recent_accounts`"), 'recent viewed account storage key stays separate from legacy authorized users');
assert(appSource.includes('rememberRecentAccount(chain, typedLogin);'), 'route submit stores only the manually typed login from the account field');
assert(appSource.includes('rememberRecentAccount(chain, account);'), 'successful read-only render stores deep-link/current account names too');
assert(!appSource.includes('rememberRecentAccount(chain, selectedLogin);'), 'authorized account selector changes are not copied into read-only recent history');

assert(accountSelectorVisibleSlice.includes('appUsesAuthorizedAccount(app)') && !accountSelectorVisibleSlice.includes('appRequiresAccount(app) || appUsesAuthorizedAccount(app)'), 'saved authorized-account select is visible only for routes that need the authorized account context');
assert(updateAccountFieldSlice.includes('fillRecentAccountList(chain)') && updateAccountFieldSlice.includes('inputVisible'), 'read-only account input refreshes recent-account suggestions when shown');

for (const appId of ['wallet', 'broadcast', 'manage', 'award', 'donate', 'editor', 'feeds', 'post', 'notifications', 'swap', 'auto-upvoter']) {
  assert(appSource.includes(`'${appId}'`), `${appId} remains in authorized-account routing context`);
}
assert(routeSubmitSlice.includes('selectedLogin || typedLogin || null'), 'authorized-account apps still prefer the selected saved login on submit');

assert(planSource.includes('Graphene account memory UX') && planSource.includes('read-only account routes') && planSource.includes('authorized-account selector'), 'plan documents read-only account memory scope and guardrails');

console.log('v3 account memory UX smoke passed');
