const assert = require('assert');
const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');

const root = path.resolve(__dirname, '..');
const appSource = fs.readFileSync(path.join(root, 'v3/js/app.js'), 'utf8');
const chainsSource = fs.readFileSync(path.join(root, 'v3/js/chains.js'), 'utf8');
const planSource = fs.readFileSync(path.join(root, 'plan.md'), 'utf8');

function readLegacyFile(relativePath) {
  const localPath = path.resolve(root, '../dpos.space', relativePath);
  if (fs.existsSync(localPath)) return fs.readFileSync(localPath, 'utf8');
  return childProcess.execFileSync('git', ['show', `master:${relativePath}`], { cwd: root, encoding: 'utf8' });
}

const legacyConfig = readLegacyFile('blockchains/viz/apps/help/config.json');
const legacyContent = readLegacyFile('blockchains/viz/apps/help/content.php');
const legacyIndex = readLegacyFile('blockchains/viz/apps/help/index.php');

assert(legacyConfig.includes('Справка по dpos.space') && legacyConfig.includes('Справка'), 'legacy help config inspected');
assert(legacyContent.includes('location.replace') && legacyContent.includes('https://viz.media/obzor-servisov-dpos-space-viz/'), 'legacy redirect URL inspected');
assert(legacyIndex.includes('NOTLOAD') && !legacyIndex.includes('require'), 'legacy index has no app runtime beyond guard');

assert(chainsSource.includes("id: 'help'") && chainsSource.includes('Справка'), 'VIZ help app route registered');
assert(appSource.includes('function renderVizHelp(chain)'), 'v3 has dedicated help renderer');
assert(appSource.includes('https://viz.media/obzor-servisov-dpos-space-viz/') && appSource.includes('Обзор сервисов dpos.space'), 'v3 preserves legacy help destination as explicit link');
assert(appSource.includes("chain.id === 'viz' && effectiveAppId === 'help'"), 'router dispatches VIZ help renderer');
const helpStart = appSource.indexOf('function renderVizHelp');
const helpEnd = appSource.indexOf('function renderVizExchanges', helpStart);
const helpSlice = appSource.slice(helpStart, helpEnd);
assert(!/location\.replace\(|backend\.dpos\.space|178\.20\.43\.121|blockchains\/viz\/apps\/help|\.php/.test(helpSlice), 'VIZ help runtime does not auto-redirect or call PHP/private backend paths');
assert(!/broadcast\.prepare|bindOperationForm|fetch\(/.test(helpSlice), 'VIZ help remains static read-only link only');
assert(planSource.includes('### Rigorous parity: VIZ / help'), 'plan contains VIZ help parity section');
assert(planSource.includes('location.replace') && planSource.includes('explicit accessible link') && planSource.includes('read-only'), 'plan documents redirect replacement as accessible link');

console.log('v3 VIZ help smoke passed');
