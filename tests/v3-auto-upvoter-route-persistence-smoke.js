const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const appSource = fs.readFileSync(path.join(root, 'v3/js/app.js'), 'utf8');

assert(appSource.includes('function getAutoUpvoterRuntime'), 'auto-upvoter has a tab-level runtime getter');
assert(appSource.includes('global.__dposAutoUpvoterRuntimes'), 'auto-upvoter runtime is stored on window, not in one render call only');
assert(appSource.includes('runtime.running') && appSource.includes('runtime.settings'), 'runtime stores running state and start settings across SPA route changes');
assert(appSource.includes('if (runtime.running &&') && appSource.includes('startButton.disabled = true') && appSource.includes('stopButton.disabled = false'), 'returning to auto-upvoter page restores running Start/Stop UI state');
assert(appSource.includes('runtime.scannerInterval = setInterval') && appSource.includes('clearInterval(runtime.scannerInterval)'), 'scanner interval handle is persisted and stoppable after route changes');
assert(appSource.includes('runtime.runnerLock = helper.claimRunnerLocks') && appSource.includes('helper.releaseRunnerLocks(chain, runtime.runnerLock.accounts, runtime.runnerLock.owner)'), 'runner lock owner survives re-render so Stop can release it');
assert(!appSource.includes('let scannerInterval = null;'), 'scanner interval is no longer a per-render local that is lost on navigation');

console.log('v3 auto-upvoter route persistence smoke passed');
