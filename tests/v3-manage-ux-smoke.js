const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const appSource = fs.readFileSync(path.join(root, 'v3/js/app.js'), 'utf8');
const cssSource = fs.readFileSync(path.join(root, 'v3/css/style.css'), 'utf8');

assert(appSource.includes('function manageNullSigningKey'), 'manage has chain-specific null signing key helper');
assert(appSource.includes('function renderWitnessChoice'), 'manage renders witness choices with metadata');
assert(appSource.includes('witness-choice-grid'), 'batch witness vote uses a grid instead of a plain label stream');
assert(cssSource.includes('.witness-choice-grid'), 'CSS styles witness batch grid');
assert(cssSource.includes('repeat(auto-fit, minmax(18rem, 1fr))'), 'witness grid is responsive and roughly 3 columns on desktop');
assert(appSource.includes('активный делегат') && appSource.includes('неактивный делегат'), 'witness batch list shows active/inactive delegate text');
assert(appSource.includes('GOLOS1111111111111111111111111111111114T1Anm'), 'Golos legacy null signing key is detected for inactive witnesses');
assert(appSource.includes('GLS1111111111111111111111111111111114T1Anm'), 'Golos deactivate operation keeps GLS null signing key');
assert(appSource.includes('VIZ1111111111111111111111111111111114T1Anm'), 'VIZ null signing key is detected for inactive witnesses');
assert(appSource.includes('Настройки witness / параметры сети'), 'witness props/settings are separated from activation');
assert(appSource.includes('Активация или деактивация witness'), 'witness activation/deactivation has its own form copy');
assert(appSource.includes('loadManageWitnessSettings(chain)'), 'witness settings preload is wired');
assert(appSource.includes('function renderWitnessPropsFields'), 'witness props render as field forms instead of JSON-only textarea');
assert(appSource.includes('fillWitnessPropsForm(propsForm, chain, props)'), 'witness props preload fills dedicated field form');
assert(appSource.includes('manage-witness-props-load') && appSource.includes('viz-witness-props-load'), 'witness props preload buttons are wired for shared chains and VIZ');
assert(appSource.includes('collectWitnessPropsFromForm(chain, form)'), 'witness props operation collects named fields plus extra JSON');
assert(appSource.includes('manage-workers-vote-section'), 'Golos workers has a separate vote section');
assert(appSource.includes('manage-workers-history-section'), 'Golos workers has a separate history section');
assert(appSource.includes('manage-workers-create-section'), 'Golos workers has a separate create section');
assert(appSource.includes('loadGolosWorkerRequestDetail'), 'Golos worker detail page loader exists');
assert(appSource.includes('manage-worker-detail-back'), 'Golos worker detail page has a back button');
assert(appSource.includes('viz-committee-vote-section'), 'VIZ committee has a separate vote section');
assert(appSource.includes('viz-committee-history-section'), 'VIZ committee has a separate history section');
assert(appSource.includes('viz-committee-create-section'), 'VIZ committee has a separate create section');
assert(appSource.includes('loadVizCommitteeRequestDetail'), 'VIZ committee detail page loader exists');
assert(appSource.includes('viz-committee-detail-back'), 'VIZ committee detail page has a back button');

console.log('v3 manage UX smoke passed');
