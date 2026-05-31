const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const appSource = fs.readFileSync(path.join(root, 'v3/js/app.js'), 'utf8');

assert(appSource.includes('manage-profile-image'), 'Golos manage profile includes profile_image URL field');
assert(appSource.includes('manage-profile-cover-image'), 'Golos manage profile includes cover_image URL field');
assert(appSource.includes('manage-profile-gender'), 'Golos manage profile includes gender field');
assert(appSource.includes('manage-profile-select-tags'), 'Golos manage profile includes select_tags/interests field');
assert(appSource.includes('manage-profile-mail'), 'Golos manage profile includes mail field');
assert(appSource.includes('manage-profile-telegram'), 'Golos manage profile includes telegram field');
assert(appSource.includes('manage-profile-whatsapp'), 'Golos manage profile includes whatsapp field');
assert(appSource.includes('manage-profile-viber'), 'Golos manage profile includes viber field');
assert(appSource.includes('profile_image: String(form.get'), 'Golos manage serializes profile_image metadata');
assert(appSource.includes('cover_image: String(form.get'), 'Golos manage serializes cover_image metadata');
assert(appSource.includes('select_tags: chain.id === \'golos\' ? normalizeGolosProfileTags'), 'Golos manage serializes select_tags as normalized array for Golos');
assert(appSource.includes('GLS1111111111111111111111111111111114T1Anm'), 'Golos witness update supports blank signing key as null/deactivate key');
assert(appSource.includes('manage-follow-form'), 'Golos manage exposes follow/unfollow form');
assert(appSource.includes("['custom_json'"), 'Golos follow/unfollow uses raw custom_json operation through sendOperations');
assert(appSource.includes("id: 'follow'"), 'Golos follow/unfollow uses follow custom_json id');
assert(appSource.includes('what: followMode ==='), 'Golos follow/unfollow toggles blog follow vs empty what');
assert(appSource.includes("broadcast.prepare(chain, 'posting', 'sendOperations'"), 'Golos follow/unfollow prepares posting sendOperations');
assert(appSource.includes('manage-reset-keys-form'), 'Golos manage exposes reset keys form');
assert(appSource.includes('function generateGolosResetKeys'), 'Golos manage can generate replacement Golos keys');
assert(appSource.includes('crypto.getRandomValues'), 'Golos reset keys use browser cryptographic randomness');
assert(appSource.includes("getPrivateKeys(account, seed, ['owner', 'active', 'posting', 'memo'])"), 'Golos reset uses legacy-compatible getPrivateKeys roles');
assert(appSource.includes('downloadTextFile(`golos-account-${account}.txt`'), 'Golos reset offers downloadable key backup');
assert(appSource.includes('resetKeys.pendingKeys'), 'Golos reset keeps generated private keys in runtime state only');
assert(appSource.includes('resetKeys.backupConfirmed'), 'Golos reset tracks saved backup confirmation');
assert(appSource.includes('manage-reset-saved'), 'Golos reset UI requires saved-keys confirmation');
assert(appSource.includes('current.json_metadata'), 'Golos reset/profile preserves existing json_metadata');
assert(appSource.includes('normalizeGolosProfileTags'), 'Golos profile converts select_tags to normalized array');
assert(appSource.includes("broadcast.prepareWithPrivateKey(chain, account, 'owner', ownerWif, 'accountUpdate'"), 'Golos reset broadcasts accountUpdate with explicit owner WIF');
assert(appSource.includes('prefillGolosManageProfile'), 'Golos manage preloads current profile metadata into the form');
assert(appSource.includes('manage-profile-prefill-result'), 'Golos manage exposes profile preload status');
assert(appSource.includes('manage-workers-vote-form'), 'Golos manage exposes a dedicated worker vote form');
assert(appSource.includes('manage-workers-create-form'), 'Golos manage exposes a dedicated worker create form');
assert(appSource.includes('manage-workers-active-list'), 'Golos manage separates active worker requests for voting');
assert(appSource.includes('manage-workers-history-list'), 'Golos manage separates historical worker requests');
assert(appSource.includes('manage-worker-detail-page'), 'Golos manage renders a non-modal worker request detail page');
assert(appSource.includes('getWorkerRequestVotes'), 'Golos manage loads worker request voters on the detail page');
assert(appSource.includes("['worker_request'"), 'Golos manage can prepare worker_request operation');
assert(appSource.includes("['worker_request_vote'"), 'Golos manage can prepare worker_request_vote operation');
assert(appSource.includes('getWorkerRequests'), 'Golos manage can load worker requests through public RPC');
assert(appSource.includes('manage-witness-props-form'), 'Golos manage exposes witness chain_properties_update form');
assert(appSource.includes("['chain_properties_update'"), 'Golos manage can prepare chain_properties_update operation');
assert(appSource.includes('getWitnessByAccount'), 'Golos manage can preload witness settings');
assert(appSource.includes('getFollowing'), 'Golos manage can load following list through public RPC');
assert(appSource.includes('data-following-action="unfollow"'), 'Golos following list can prefill unfollow action');
assert(!appSource.includes("effectiveAppId === 'donates'"), 'Golos backend-dependent donates route is not dispatched in v3');
assert(!appSource.includes('renderGolosDonates'), 'Golos backend-dependent donates renderer is not present in v3');
assert(!appSource.includes('golos-donates-calculator-form'), 'Golos backend-dependent donates UI is not present in v3');
assert(appSource.includes('manage-create-account-form'), 'Golos manage exposes account creation form');
assert(appSource.includes('accountCreateWithDelegation'), 'Golos manage can prepare accountCreateWithDelegation');
assert(appSource.includes('createAccountState.pendingKeys'), 'Golos account creation keeps generated keys in runtime state only');
assert(appSource.includes('manage-create-saved'), 'Golos account creation requires saved backup confirmation');
assert(appSource.includes('manage-witnesses-batch-form'), 'Golos manage exposes batch witness voting form');
assert(appSource.includes('getWitnessesByVote'), 'Golos manage can load witness list via public RPC');
assert(appSource.includes("const opName = chain.id === 'viz' ? 'account_validator_vote' : 'account_witness_vote'"), 'Golos manage batch voting prepares account_witness_vote operations outside VIZ');
assert(appSource.includes('witnessVoteState.proxy'), 'Golos manage warns when proxy exists during manual witness voting');

[
  'manage-proxy-details',
  'manage-witness-details',
  'manage-witnesses-batch-details',
  'manage-witness-update-details',
  'manage-authority-details',
  'manage-profile-details',
  'manage-create-account-details',
  'manage-reset-keys-details',
  'manage-follow-details',
  'manage-workers-details',
  'manage-witness-props-details'
].forEach((marker) => assert(appSource.includes(`id="${marker}" class="operation-details"`), `Golos manage wraps dangerous form in details: ${marker}`));

console.log('v3 Golos manage smoke passed');
