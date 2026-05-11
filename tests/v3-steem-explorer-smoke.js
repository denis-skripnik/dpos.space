const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const appSource = fs.readFileSync(path.join(root, 'v3/js/app.js'), 'utf8');
const chainsSource = fs.readFileSync(path.join(root, 'v3/js/chains.js'), 'utf8');
const planSource = fs.readFileSync(path.join(root, 'plan.md'), 'utf8');
const legacyConfig = fs.readFileSync(path.resolve(root, '../dpos.space/blockchains/steem/apps/explorer/config.json'), 'utf8');
const legacyContent = fs.readFileSync(path.resolve(root, '../dpos.space/blockchains/steem/apps/explorer/content.php'), 'utf8');
const legacyIndex = fs.readFileSync(path.resolve(root, '../dpos.space/blockchains/steem/apps/explorer/index.php'), 'utf8');
const legacyBlock = fs.readFileSync(path.resolve(root, '../dpos.space/blockchains/steem/apps/explorer/pages/block/content.php'), 'utf8');
const legacyBlockRpc = fs.readFileSync(path.resolve(root, '../dpos.space/blockchains/steem/apps/explorer/pages/block/block.php'), 'utf8');
const legacyTx = fs.readFileSync(path.resolve(root, '../dpos.space/blockchains/steem/apps/explorer/pages/tx/content.php'), 'utf8');
const legacyTxRpc = fs.readFileSync(path.resolve(root, '../dpos.space/blockchains/steem/apps/explorer/pages/tx/get_transaction.php'), 'utf8');

assert(legacyConfig.includes('Блок-эксплорер') && legacyConfig.includes('Explorer'), 'legacy config inspected');
assert(legacyContent.includes('last_irreversible_block_num') && legacyContent.includes('head_block_number') && legacyContent.includes('get_chain_properties'), 'legacy explorer overview inspected');
assert(legacyIndex.includes('steem/explorer/block/') && legacyIndex.includes('steem/explorer/tx/'), 'legacy explorer redirect router inspected');
assert(legacyBlockRpc.includes('GetOpsInBlock') && legacyBlockRpc.includes('GetBlockHeaderCommand'), 'legacy block RPC inspected');
assert(legacyBlock.includes('Блок №') && legacyBlock.includes('Подписал делегат') && legacyBlock.includes('convert_operation_data'), 'legacy block rendering inspected');
assert(legacyTxRpc.includes('GetTransaction') && legacyTx.includes('Транзакция') && legacyTx.includes('operations'), 'legacy tx rendering inspected');

assert(chainsSource.includes("{ id: 'explorer'") && chainsSource.includes('Проводник'), 'Steem explorer route registered through social apps');
assert(appSource.includes('async function loadSteemExplorerOverview(chain, connection)'), 'v3 has Steem explorer overview loader');
assert(appSource.includes('function renderSteemExplorerOverview(data)'), 'v3 renders Steem overview');
assert(appSource.includes('last_irreversible_block_num') && appSource.includes('Последние блоки с необратимого'), 'v3 shows irreversible block links');
assert(appSource.includes('head_block_number') && appSource.includes('Последние блоки с последнего'), 'v3 shows head block links');
assert(appSource.includes("profiles.apiCall(connection, 'getOpsInBlock'") && appSource.includes("profiles.apiCall(connection, 'getBlockHeader'"), 'v3 block route uses public block header and ops RPC');
assert(appSource.includes("profiles.apiCall(connection, 'getTransaction'"), 'v3 tx route uses public getTransaction RPC');
assert(appSource.includes("chain.id === 'steem' && state.kind === 'block'"), 'renderExplorer dispatches Steem block loader');
assert(appSource.includes("chain.id === 'steem'") && appSource.includes('Steem проводник: последние блоки и параметры загружены через публичную ноду.'), 'renderExplorer dispatches Steem overview loader');
const explorerStart = appSource.indexOf('async function loadSteemExplorerOverview');
const explorerEnd = appSource.indexOf('function renderVizHelp', explorerStart);
assert(explorerStart >= 0 && explorerEnd > explorerStart, 'Steem explorer runtime slice is bounded');
const explorerSlice = appSource.slice(explorerStart, explorerEnd);
assert(!/backend\.dpos\.space|178\.20\.43\.121|blockchains\/steem\/apps\/explorer|\.php/.test(explorerSlice), 'Steem explorer runtime does not call legacy PHP/private backend paths');
assert(!/broadcast\.prepare|bindOperationForm/.test(explorerSlice), 'Steem explorer remains read-only');
assert(planSource.includes('### Rigorous parity: Steem / explorer'), 'plan contains Steem explorer parity section');
assert(planSource.includes('GetOpsInBlock') && planSource.includes('getOpsInBlock') && planSource.includes('read-only'), 'plan documents legacy/v3 public RPC block mapping');
assert(planSource.includes('get_dynamic_global_properties.php') && planSource.includes('getChainProperties'), 'plan documents PHP wrappers replaced by public RPC');

console.log('v3 Steem explorer smoke passed');
