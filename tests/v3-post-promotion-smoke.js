const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const appSource = fs.readFileSync(path.join(root, 'v3/js/app.js'), 'utf8');
const planSource = fs.readFileSync(path.join(root, 'plan.md'), 'utf8');

const promotionSlice = (appSource.match(/function renderPostPromotionForm[\s\S]*?\n  async function renderGolosPostPage/) || [''])[0];
const golosPostPageSlice = (appSource.match(/async function renderGolosPostPage[\s\S]*?\n  async function loadGolosRepliesTree/) || [''])[0];
const submitSlice = (appSource.match(/async function submitPostPromotion[\s\S]*?\n  function bindGolosPostActions/) || [''])[0];
const socialPostSlice = (appSource.match(/async function renderSocialPostPage[\s\S]*?\n  async function loadSocialRepliesTree/) || [''])[0];

assert(planSource.includes('post promotion spoiler'), 'plan.md records the focused post promotion pass');
assert(appSource.includes('fetchPostPromotionInfo'), 'post page fetches promotion info from public RPC');
assert(appSource.includes('fetchPromotedDiscussions'), 'promotion helper reads promoted discussion queue');
assert(appSource.includes("'getDiscussionsByPromoted'"), 'promotion helper tries library getDiscussionsByPromoted');
assert(appSource.includes("'tags', 'get_discussions_by_promoted'"), 'promotion helper has Golos tags API JSON-RPC fallback');
assert(appSource.includes("'condenser_api.get_discussions_by_promoted'"), 'promotion helper has Hive/Steem condenser API JSON-RPC fallback');
assert(promotionSlice.includes('data-post-promotion-details'), 'promotion UI renders as a details/spoiler block');
assert(promotionSlice.includes('<summary>Продвигать</summary>'), 'promotion spoiler summary is named Продвигать');
assert(promotionSlice.includes('keyStatus.hasActive'), 'promotion form is rendered only for a selected account with active key');
assert(promotionSlice.includes('data-post-promotion-form'), 'promotion form has a dedicated data hook');
assert(promotionSlice.includes('data-post-promotion-max'), 'promotion form exposes a maximum balance helper');
assert(promotionSlice.includes('data-post-promotion-current-top'), 'promotion form shows current maximum bid');
assert(promotionSlice.includes('Продвинуть вверх'), 'promotion form uses the requested submit button text');
assert(submitSlice.includes("broadcast.prepare(chain, 'active', 'transfer'"), 'promotion uses active transfer authority');
assert(submitSlice.includes("'null'"), 'promotion burns funds by transferring to null');
assert(submitSlice.includes('`@${author}/${permlink}`'), 'promotion memo targets @author/permlink');
assert(submitSlice.includes('global.confirm'), 'promotion requires explicit confirmation before broadcast');
assert(submitSlice.includes('normalizeGolosTokenAmount(chain, amount, symbol'), 'promotion amount is normalized to the chain debt token');
assert(appSource.includes("querySelectorAll('[data-post-promotion-form]')"), 'post actions bind promotion form submit handlers');
assert(appSource.includes('renderPostPromotionForm(chain, author, permlink, promotionInfo)'), 'Golos post page renders the promotion spoiler');
assert(golosPostPageSlice.includes('await loadScript(chain.cryptoPath);') && golosPostPageSlice.indexOf('await loadScript(chain.cryptoPath);') < golosPostPageSlice.indexOf('fetchPostPromotionInfo'), 'Golos post page loads SJCL before checking whether active key is decryptable');
assert(socialPostSlice.includes('renderPostPromotionForm(chain, author, permlink, promotionInfo)'), 'Hive/Steem post page renders the promotion spoiler');
assert(socialPostSlice.includes('await loadScript(chain.cryptoPath);') && socialPostSlice.indexOf('await loadScript(chain.cryptoPath);') < socialPostSlice.indexOf('fetchPostPromotionInfo'), 'Hive/Steem post page loads SJCL before checking whether active key is decryptable');

console.log('v3 post promotion smoke passed');
