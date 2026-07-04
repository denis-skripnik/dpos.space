const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const appSource = fs.readFileSync(path.join(root, 'v3/js/app.js'), 'utf8');
const planSource = fs.readFileSync(path.join(root, 'plan.md'), 'utf8');

assert(appSource.includes('function buildGenericEditorOperations'), 'Steem/Hive editor has generic payload builder');
assert(appSource.includes("if (!tags.includes('dpos-post')) tags.push('dpos-post');"), 'Steem/Hive editor appends legacy dpos-post tag');
assert(appSource.includes("const permlink = manualPermlink || golosLegacyTransform(title, '-');"), 'Steem/Hive editor can generate permlink from title like legacy post app');
assert(appSource.includes("const metadata = { tags, app: chain.id === 'steem' ? 'dpos.space/post' : 'dpos.space/v3', format: 'markdown', image: images };"), 'Steem/Hive editor includes preview image metadata and chain-specific app marker');
assert(appSource.includes("percent_steem_dollars: chain.id === 'steem' ? payoutPercent : undefined"), 'Steem editor sends user-selected percent_steem_dollars');
assert(appSource.includes("percent_hbd: chain.id === 'hive' ? payoutPercent : undefined"), 'Hive editor sends user-selected percent_hbd');
assert(appSource.includes('Сообщество / parent_permlink') && appSource.includes('hive-179017') && appSource.includes('hive-167922'), 'Hive editor exposes legacy community/parent_permlink choices');
assert(appSource.includes('editor-beneficiary-account') && appSource.includes("extensions: [[0, { beneficiaries }]]"), 'Steem/Hive editor exposes and sends beneficiaries extension');
assert(appSource.includes('100% в ${escapeHtml(chain.powerTitle || \'HP\')}'), 'Steem/Hive editor exposes 100% power payout option');
assert(appSource.includes('id="editor-operation-details" class="operation-modal-source"'), 'Steem/Hive editor publish form is available as modal-upgraded operation source');
assert(appSource.includes('<summary>Публикация поста — preview перед отправкой</summary>'), 'Steem/Hive editor modal trigger title makes preview-before-send explicit');
assert(appSource.includes("if (chain.id !== 'golos' && !isHiveOrSteem(chain)) return '';"), 'Steem/Hive editor accepts direct author/permlink edit autoload URLs');
assert(appSource.includes("if ((isGolos || isHiveOrSteem(chain)) && initialEditUrl) editorAutoLoadEdit"), 'Steem/Hive editor auto-loads direct edit URLs');
assert(appSource.includes("if (isEdit) return [commentOperation];"), 'Steem/Hive edit submit is comment-only without comment_options');
assert(appSource.includes('renderMarkdownEditorField(draft && draft.body ? draft.body : \'\')'), 'Steem/Hive editor renders the shared Markdown editor field');
assert(appSource.includes('markdownToPreviewHtml') && appSource.includes('safeMarkdownUrl') && appSource.includes('tableCells'), 'Markdown preview is rendered client-side with URL sanitizing and table support');
assert(appSource.includes('uploadEditorImageToImgur') && appSource.includes('Фото загружено и вставлено в текст поста'), 'Social editor ports image upload into Markdown insertion flow');
assert(appSource.includes("if (previewImageInput && !String(previewImageInput.value || '').trim()) previewImageInput.value = link;"), 'Uploaded image also fills empty preview image metadata');
assert(appSource.includes("if (key === 'b')") && appSource.includes("if (key === 'k')"), 'Markdown editor supports keyboard shortcuts');
assert(planSource.includes('### UX polish: Editor swap and broadcast forms'), 'plan documents editor/swap/broadcast UX pass');
assert(planSource.includes('Steem/Hive editor/post deep pass'), 'plan documents Steem/Hive editor/post parity pass');
assert(planSource.includes('Steem/Hive own post-page edit links') && planSource.includes('editor autoloads author/permlink hash for Steem/Hive') && planSource.includes('edit sends comment only/no comment_options'), 'plan documents Steem/Hive direct post edit follow-up');

console.log('v3 social editor smoke passed');
