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

const legacyCatalog = readLegacyFile('blockchains/viz/apps/projects/pages/catalog/content.php');
const legacyTasks = readLegacyFile('blockchains/viz/apps/projects/pages/tasks/content.php');
const legacyAdd = readLegacyFile('blockchains/viz/apps/projects/pages/add/content.php');
const legacyNewTask = readLegacyFile('blockchains/viz/apps/projects/pages/new-task/content.php');
const legacyJs = readLegacyFile('blockchains/viz/apps/projects/js/app.js');

assert(legacyCatalog.includes('service=viz-projects&type=projects'), 'legacy catalog backend dependency inspected');
assert(legacyTasks.includes('service=viz-projects&type=tasks'), 'legacy tasks backend dependency inspected');
assert(legacyAdd.includes('sendTransfer(`project`') && legacyAdd.includes('1 VIZ'), 'legacy add-project transfer inspected');
assert(legacyNewTask.includes('sendTransfer(`task`'), 'legacy new-task transfer inspected');
assert(legacyJs.includes("'viz-projects'") && legacyJs.includes('sendCustom'), 'legacy viz-projects JS protocol inspected');

assert(chainsSource.includes("{ id: 'projects'") && chainsSource.includes('viz-projects'), 'VIZ projects app route registered');
assert(appSource.includes('function buildVizProjectMemo(type, data)'), 'v3 builds viz-projects transfer memos');
assert(appSource.includes('function renderVizProjects(chain)'), 'v3 has dedicated VIZ projects renderer');
assert(appSource.includes('viz-projects-catalog') && appSource.includes('Каталог проектов'), 'renderer keeps catalog section');
assert(appSource.includes('viz-projects-tasks') && appSource.includes('Список задач'), 'renderer keeps tasks section');
assert(appSource.includes('viz-projects-add-project-form') && appSource.includes('Стоимость добавления проекта: 1.000 VIZ'), 'renderer keeps add-project form and fee');
assert(appSource.includes('viz-projects-add-task-form') && appSource.includes('Стоимость добавления задачи: 1.000 VIZ'), 'renderer keeps add-task form and fee');
assert(appSource.includes('id="viz-projects-add-project-details" class="operation-modal-source"'), 'add-project operation form is rendered as a modal-upgraded source');
assert(appSource.includes('id="viz-projects-add-task-details" class="operation-modal-source"'), 'add-task operation form is rendered as a modal-upgraded source');
assert(appSource.includes("broadcast.prepare(chain, 'active', 'transfer'") && appSource.includes("'viz-projects'") && appSource.includes("'1.000 VIZ'"), 'v3 prepares legacy paid transfer to viz-projects');
assert(appSource.includes("['project', data]") && appSource.includes("['task', data]"), 'v3 memo format preserves legacy [type,data] JSON');
assert(appSource.includes("app: 'history'") && appSource.includes('query: \'viz-projects\''), 'v3 gives public history fallback for indexed lists');
assert(appSource.includes("chain.id === 'viz' && effectiveAppId === 'projects'"), 'router dispatches VIZ projects renderer');
const projectsStart = appSource.indexOf('function buildVizProjectMemo');
const projectsEnd = appSource.indexOf('function buildVizPollCreateMemo', projectsStart);
const projectsSlice = appSource.slice(projectsStart, projectsEnd);
assert(!/178\.20\.43\.121|backend\.dpos\.space|file_get_contents|blockchains\/viz\/apps\/projects/.test(projectsSlice), 'VIZ projects runtime does not call private legacy backend/PHP paths');
assert(planSource.includes('### Rigorous parity: VIZ / projects'), 'plan contains VIZ projects parity section');
assert(planSource.includes('### UX polish: Non-wallet operation forms'), 'plan contains non-wallet operation forms UX polish section');
assert(planSource.includes('VIZ / projects / add project+task'), 'plan records projects operation form UX polish coverage');
assert(planSource.includes('service=viz-projects&type=types') && planSource.includes('backend/indexer-only'), 'plan documents indexed project catalog backend dependency');
assert(planSource.includes('sendTransfer(`project`') && planSource.includes('static-safe paid transfer'), 'plan documents static-safe project/task transfer');

console.log('v3 VIZ projects smoke passed');
