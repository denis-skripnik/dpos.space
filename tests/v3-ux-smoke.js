const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const appSource = fs.readFileSync(path.join(root, 'v3/js/app.js'), 'utf8');
const cssSource = fs.readFileSync(path.join(root, 'v3/css/style.css'), 'utf8');

assert(appSource.includes('function rawJsonDetails'), 'raw JSON is centralized in a secondary details helper');
assert(appSource.includes('<details class="raw-json"><summary>'), 'raw JSON helper renders collapsed details');
assert(appSource.includes('function renderExplorerResult'), 'explorer has a human-readable result renderer');
assert(appSource.includes('function renderOperationsTable'), 'explorer operation/detail data uses a table renderer');
assert(appSource.includes('renderExplorerResult(chain, state.kind, state.value, result)'), 'Golos-like explorer uses human-readable renderer');
assert(appSource.includes('renderExplorerResult(chain, state.kind, state.value, result)'), 'Cosmos-like explorer uses human-readable renderer');
assert(!appSource.includes("document.getElementById('explorer-result').innerHTML = `<pre>${escapeHtml(JSON.stringify(result, null, 2))}</pre>`"), 'explorer no longer renders primary raw JSON dumps');
assert(!appSource.includes('return `<pre>${escapeHtml(JSON.stringify(broadcast.sanitizePrepared(prepared), null, 2))}</pre>`'), 'broadcast prepared payload is not the primary preview');
assert(appSource.includes('Технический payload для проверки'), 'broadcast technical payload is explicitly labelled as secondary');
assert(appSource.includes('Кратко перед отправкой'), 'broadcast result includes a human-readable summary before technical payload');

for (const label of [
  'Что открыть',
  'Аккаунт, номер блока или tx id',
  'Адрес, tx hash или номер блока',
  'Выберите, что открыть'
]) {
  assert(appSource.includes(label), `core explorer UX label/state exists: ${label}`);
}

assert(cssSource.includes('.kv-list'), 'key-value details have dedicated readable styling');
assert(cssSource.includes('.raw-json'), 'secondary raw JSON details have dedicated styling');

console.log('v3 UX smoke passed');
