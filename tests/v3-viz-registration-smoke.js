const assert = require('assert');
const fs = require('fs');

const appSource = fs.readFileSync('v3/js/app.js', 'utf8');
const broadcastSource = fs.readFileSync('v3/js/broadcast.js', 'utf8');

const renderRegister = (appSource.match(/function renderRegister[\s\S]*?\n  async function hashRandomBlockchainSeeds/) || [''])[0];

assert(renderRegister.includes('id="viz-register-generate-private-key"'), 'VIZ registration renders generate private WIF button');
assert(renderRegister.includes('id="viz-register-generated-private-key"'), 'VIZ registration shows generated private WIF in backup UI');
assert(renderRegister.includes('data-copy-value'), 'VIZ registration supports copying the generated private WIF backup');
assert(renderRegister.includes('viz-register-download-backup'), 'VIZ registration supports downloading generated key backup');
assert(renderRegister.includes('viz-register-private-key-saved'), 'VIZ registration requires saved private key confirmation');
assert(renderRegister.includes('generateVizRegistrationKey'), 'VIZ registration generates a local private WIF');
assert(appSource.includes('client.auth.wifToPublic(privateKey)'), 'VIZ registration derives public key from generated private WIF');
assert(renderRegister.includes('register-public-key'), 'manual public-key registration path remains available');
assert(renderRegister.includes("'inviteRegistration'"), 'VIZ registration prepares inviteRegistration route');
assert(renderRegister.includes('id="register-form-details" class="operation-modal-source"'), 'registration account create form is available as modal-upgraded operation source');
assert(renderRegister.includes('id="golos-register-delegation-details" class="operation-modal-source"'), 'Golos delegation registration form is available as modal-upgraded operation source');
assert(renderRegister.includes('viz-register-check-name'), 'VIZ registration can check account-name availability like legacy');
assert(appSource.includes("chain.id === 'viz' && (appId === 'calc' || appId === 'awards')"), 'VIZ legacy calc/awards aliases stay active without breaking registration route');
assert(renderRegister.includes('getAccounts'), 'VIZ registration availability check uses public RPC getAccounts');
assert(renderRegister.includes('context.intent === \'send\''), 'backup confirmation gates only real send, not preview/manual entry');
assert(renderRegister.includes('downloadTextFile(`viz-account-${name}.txt`'), 'download backup includes account-specific filename');
assert(!renderRegister.includes('localStorage.setItem'), 'VIZ generated private WIF is not stored in localStorage by registration UI');
assert(!renderRegister.includes('sessionStorage.setItem'), 'VIZ generated private WIF is not stored in sessionStorage by registration UI');
assert(broadcastSource.includes('sanitizePrepared'), 'operation preview uses sanitized prepared output');

console.log('v3 VIZ registration smoke passed');
