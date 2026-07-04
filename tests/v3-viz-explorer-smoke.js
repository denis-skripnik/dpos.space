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

const legacyConfig = readLegacyFile('blockchains/viz/apps/explorer/config.json');
const legacyContent = readLegacyFile('blockchains/viz/apps/explorer/content.php');
const legacyIndex = readLegacyFile('blockchains/viz/apps/explorer/index.php');
const legacyBlock = readLegacyFile('blockchains/viz/apps/explorer/pages/block/content.php');
const legacyBlockRpc = readLegacyFile('blockchains/viz/apps/explorer/pages/block/block.php');
const legacyTx = readLegacyFile('blockchains/viz/apps/explorer/pages/tx/content.php');
const legacyTxRpc = readLegacyFile('blockchains/viz/apps/explorer/pages/tx/get_transaction.php');

assert(legacyConfig.includes('Блок-эксплорер') && legacyConfig.includes('Explorer'), 'legacy config inspected');
assert(legacyContent.includes('last_irreversible_block_num') && legacyContent.includes('head_block_number') && legacyContent.includes('get_chain_properties'), 'legacy explorer overview inspected');
assert(legacyIndex.includes('viz/explorer/block/') && legacyIndex.includes('viz/explorer/tx/'), 'legacy explorer redirect router inspected');
assert(legacyBlockRpc.includes('GetOpsInBlock') && legacyBlockRpc.includes('GetBlockHeaderCommand'), 'legacy block RPC inspected');
assert(legacyBlock.includes('Блок №') && legacyBlock.includes('Подписал делегат') && legacyBlock.includes('convert_operation_data'), 'legacy block rendering inspected');
assert(legacyTxRpc.includes('GetTransaction') && legacyTx.includes('Транзакция') && legacyTx.includes('operations'), 'legacy tx rendering inspected');

assert(chainsSource.includes("{ id: 'explorer'") && chainsSource.includes('Проводник'), 'VIZ explorer route registered through base app');
assert(appSource.includes('async function loadVizExplorerOverview(chain, connection)'), 'v3 has VIZ explorer overview loader');
assert(appSource.includes('function renderVizExplorerOverview(data)'), 'v3 renders VIZ overview');
assert(appSource.includes('last_irreversible_block_num') && appSource.includes('Последние блоки с необратимого'), 'v3 shows irreversible block links');
assert(appSource.includes('head_block_number') && appSource.includes('Последние блоки с последнего'), 'v3 shows head block links');
assert(appSource.includes('getChainProperties') && appSource.includes('Основные параметры'), 'v3 loads and renders chain properties');
assert(appSource.includes('async function loadVizExplorerBlock(connection, blockNum)'), 'v3 has VIZ block loader');
assert(appSource.includes("profiles.apiCall(connection, 'getOpsInBlock'") && appSource.includes("profiles.apiCall(connection, 'getBlockHeader'"), 'v3 block route uses public block header and ops RPC');
assert(appSource.includes("profiles.apiCall(connection, 'getTransaction'"), 'v3 tx route uses public getTransaction RPC');
assert(appSource.includes("chain.id === 'viz' && state.kind === 'block'"), 'renderExplorer dispatches VIZ block loader');
const explorerStart = appSource.indexOf('async function loadVizExplorerOverview');
const explorerEnd = appSource.indexOf('function renderVizExchanges', explorerStart);
const explorerSlice = appSource.slice(explorerStart, explorerEnd);
assert(!/backend\.dpos\.space|178\.20\.43\.121|blockchains\/viz\/apps\/explorer|\.php/.test(explorerSlice), 'VIZ explorer runtime does not call legacy PHP/private backend paths');
assert(!/broadcast\.prepare|bindOperationForm/.test(explorerSlice), 'VIZ explorer remains read-only');
assert(planSource.includes('### Rigorous parity: VIZ / explorer'), 'plan contains VIZ explorer parity section');
assert(planSource.includes('GetOpsInBlock') && planSource.includes('getOpsInBlock') && planSource.includes('read-only'), 'plan documents legacy/v3 public RPC block mapping');
assert(planSource.includes('get_dynamic_global_properties.php') && planSource.includes('getChainProperties'), 'plan documents PHP wrappers replaced by public RPC');

console.log('v3 VIZ explorer smoke passed');
