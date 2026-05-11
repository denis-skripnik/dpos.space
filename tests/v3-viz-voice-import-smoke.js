const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const context = { window: null };
context.window = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root, 'v3/js/chains.js'), 'utf8'), context, { filename: 'v3/js/chains.js' });

const appSource = fs.readFileSync(path.join(root, 'v3/js/app.js'), 'utf8');
const plan = fs.readFileSync(path.join(root, 'plan.md'), 'utf8');
const runtimeStart = appSource.indexOf('function buildVizVoicePostPayload');
const runtimeEnd = appSource.indexOf('function buildTelegramInstantViewUrl');
const runtimeSlice = appSource.slice(runtimeStart, runtimeEnd);

const viz = context.DposChains.viz;
assert(viz.apps.some((app) => app.id === 'voice-import'), 'VIZ voice-import route is registered');
assert(appSource.includes('function renderVizVoiceImport'), 'VIZ voice-import has a dedicated renderer');
assert(appSource.includes("chain.id === 'viz' && effectiveAppId === 'voice-import'"), 'VIZ voice-import has route dispatch');

for (const marker of ['telegra.ph', 'mirror.xyz', 'readdle.me', 'Voice', 'url-input', 'import-button', 'posting_auth_msg']) {
  assert(runtimeSlice.includes(marker), `VIZ voice-import preserves legacy marker ${marker}`);
}
assert(runtimeSlice.includes('buildVizVoicePostPayload'), 'VIZ voice-import builds Voice custom payload locally');
assert(runtimeSlice.includes("broadcast.prepare(chain, 'regular', 'custom'"), 'VIZ voice-import uses explicit regular custom operation');
assert(runtimeSlice.includes("'V', payload"), 'VIZ voice-import preserves legacy custom protocol V');
assert(runtimeSlice.includes('custom_sequence_block_num'), 'VIZ voice-import reads account custom_sequence_block_num before publish');
assert(runtimeSlice.includes('role="status" aria-live="polite"'), 'VIZ voice-import exposes accessible status');
assert(runtimeSlice.includes('id="viz-voice-publish-details" class="operation-details"'), 'Voice publish operation form is separated in an accessible spoiler');
assert(runtimeSlice.includes('backend-only non-goal') && runtimeSlice.includes('CORS proxy'), 'VIZ voice-import documents removed proxy/backend dependency');

assert(!/178\.20\.43\.121|backend\.dpos\.space|file_get_contents|fetch\([^)]*proxy|proxy\.php|api\.imgur\.com/.test(runtimeSlice), 'VIZ voice-import runtime does not use private/PHP/proxy/imgur dependencies');

assert(plan.includes('### Rigorous parity: VIZ / voice-import'), 'plan has exact VIZ voice-import parity section');
assert(plan.includes('VIZ / voice-import / publish Voice custom'), 'plan records voice-import operation form UX polish coverage');
assert(plan.includes('blockchains/viz/apps/voice-import/content.php'), 'plan records legacy voice-import content inspection');
assert(plan.includes('blockchains/viz/apps/voice-import/js/app.js'), 'plan records legacy voice-import JS inspection');
assert(plan.includes('blockchains/viz/apps/voice-import/proxy.php'), 'plan records exact proxy dependency inspection');
assert(plan.includes('tests/v3-viz-voice-import-smoke.js'), 'plan records focused voice-import smoke coverage');
assert(plan.includes('custom_sequence_block_num') && plan.includes('protocol `V`') && plan.includes('Imgur Client-ID'), 'plan matrix captures Voice payload, protocol, and removed image upload dependency');

console.log('v3 VIZ voice-import smoke passed');
