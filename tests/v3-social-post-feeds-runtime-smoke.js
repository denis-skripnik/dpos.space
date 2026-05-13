const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');

function element(id) {
  return {
    id,
    value: '',
    innerHTML: '',
    textContent: '',
    dataset: {},
    hidden: false,
    disabled: false,
    checked: false,
    tabIndex: 0,
    style: {},
    closest: () => ({ hidden: false, setAttribute() {} }),
    setAttribute() {},
    removeAttribute() {},
    focus() {},
    addEventListener() {},
    querySelector: () => null,
    querySelectorAll: () => []
  };
}

const elements = new Map();
function getElement(id) {
  if (!elements.has(id)) elements.set(id, element(id));
  return elements.get(id);
}
['chain-select', 'app-select', 'route-form', 'account-input', 'account-select-field', 'account-select', 'status', 'app'].forEach(getElement);

const calls = [];
const post = {
  author: 'alice',
  permlink: 'hello-hive',
  title: 'Hello <Hive>',
  body: 'Body **markdown**<br>second line with <script>bad()</script> https://example.com/path?x=1 and https://dpos.blinddev.xyz/#chain=golos&amp;app=editor @carol',
  json_metadata: JSON.stringify({ tags: ['test', 'hive'] }),
  created: '2026-05-12T16:31:42',
  children: 1,
  net_votes: 7,
  active_votes: [{ voter: 'bob', percent: '10000' }],
  pending_payout_value: '1.234 HBD',
  total_payout_value: '0.000 HBD',
  parent_author: '',
  parent_permlink: 'test'
};
const reply = {
  author: 'carol',
  permlink: 're-hello-hive',
  title: '',
  body: 'Reply body with https://reply.example/path and @alice',
  json_metadata: '{}',
  created: '2026-05-12T16:40:00',
  children: 0,
  active_votes: []
};
const feedRow = {
  author: 'feedauthor',
  permlink: 'feed-post',
  title: 'Feed post',
  body: 'Feed body text',
  json_metadata: JSON.stringify({ tags: ['feed'] }),
  created: '2026-05-12T16:50:00',
  children: 2,
  active_votes: [],
  pending_payout_value: '0.456 HBD',
  total_payout_value: '0.000 HBD',
  percent_hbd: 10000,
  percent_steem_dollars: 10000
};

const storage = new Map();
const context = {
  console,
  URL,
  URLSearchParams,
  Intl,
  setTimeout,
  clearTimeout,
  FormData: function FormData() { return { get: (name) => (name === 'feed' ? 'blog' : 'alice') }; },
  document: {
    getElementById: getElement,
    createElement: (tag) => {
      const node = element(tag);
      node.tagName = String(tag).toUpperCase();
      return node;
    },
    head: { appendChild(script) { if (script && typeof script.onload === 'function') script.onload(); } }
  },
  location: { origin: 'https://dpos.blinddev.xyz', pathname: '/', hash: '#chain=hive&app=post&author=alice&permlink=hello-hive' },
  localStorage: {
    getItem: (key) => storage.has(key) ? storage.get(key) : null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: (key) => storage.delete(key)
  },
  addEventListener() {}
};
context.window = context;

vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root, 'v3/js/chains.js'), 'utf8'), context, { filename: 'v3/js/chains.js' });
context.DposAuth = {
  getCurrentLogin: () => 'bob',
  getCurrentUser: () => null,
  getUsers: () => [],
  getUserLogin: () => '',
  getUserType: () => 'standard',
  selectUser: () => null
};
context.DposBroadcast = {
  prepare: (_chain, authority, op, params, meta) => ({ authority, op, params, meta }),
  broadcast: async () => ({ ok: true })
};
context.DposProfiles = {
  connect: async (chain) => ({ config: chain, node: chain.nodes && chain.nodes[0] }),
  fetchAccount: async () => ({}),
  apiCall: async (_connection, method, args) => {
    calls.push([method, args]);
    if (method === 'getDynamicGlobalProperties') return {};
    if (method === 'getContent') return post;
    if (method === 'getContentReplies') return args[0] === 'alice' ? [reply] : [];
    if (method === 'getDiscussionsByBlog') return [feedRow];
    if (method === 'getDiscussionsByFeed') return [feedRow];
    if (method === 'getDiscussionsByCreated') return [feedRow];
    if (method === 'getDiscussionsByHot') return [feedRow];
    if (method === 'getDiscussionsByTrending') return [feedRow];
    throw new Error(`unexpected api method ${method}`);
  },
  formatError: (error) => error && error.message || String(error)
};
context.DposHistory = {
  formatChainAmount: (_chain, _key, value) => String(value),
  formatValue: (value) => String(value),
  formatDate: (value) => String(value || ''),
  operationTitle: (value) => String(value || '')
};

vm.runInContext(fs.readFileSync(path.join(root, 'v3/js/app.js'), 'utf8'), context, { filename: 'v3/js/app.js' });

(async () => {
  await context.DposV3.renderRoute();
  let html = getElement('app').innerHTML;
  assert(calls.some(([method]) => method === 'getContent'), 'post viewer calls getContent');
  assert(calls.some(([method]) => method === 'getContentReplies'), 'post viewer calls getContentReplies');
  assert(html.includes('Hello &lt;Hive&gt;'), 'post viewer escapes and renders title');
  assert(html.includes('<strong>markdown</strong><br>second line'), 'post viewer renders literal br tags as line breaks');
  assert(!html.includes('&lt;br&gt;'), 'post viewer does not show literal <br> text');
  assert(html.includes('&lt;script&gt;bad()&lt;/script&gt;'), 'post viewer keeps unsafe HTML escaped');
  assert(html.includes('Reply body'), 'post viewer renders replies');
  assert(html.includes('<a href="https://example.com/path?x=1" target="_blank" rel="noopener noreferrer">https://example.com/path?x=1</a>'), 'post viewer autolinks plain https URLs');
  assert(html.includes('<a href="https://dpos.blinddev.xyz/#chain=golos&amp;app=editor" target="_blank" rel="noopener noreferrer">https://dpos.blinddev.xyz/#chain=golos&amp;app=editor</a>'), 'post viewer normalizes escaped ampersands inside autolinked URLs');
  assert(!html.includes('https://dpos.blinddev.xyz/#chain=golos&amp;amp;app=editor'), 'post viewer does not double-escape ampersands inside autolinked URLs');
  assert(html.includes('#chain=hive&amp;app=profiles&amp;account=carol') && html.includes('>@carol</a>'), 'post viewer links @mentions to in-app profiles');
  assert(html.includes('<a href="https://reply.example/path" target="_blank" rel="noopener noreferrer">https://reply.example/path</a>'), 'comment viewer autolinks plain https URLs');
  assert(html.includes('#chain=hive&amp;app=profiles&amp;account=alice') && html.includes('>@alice</a>'), 'comment viewer links @mentions to in-app profiles');
  assert(html.includes('1.234 HBD'), 'post viewer renders Hive payout field');
  assert(html.includes('data-social-post-vote-form') && html.includes('data-vote-percent') && html.includes('type="range"'), 'post/comment vote UI uses expandable percent slider form');
  assert(html.includes('min="-100"') && html.includes('max="100"') && html.includes('Голосовать'), 'vote slider supports -100..100 percent and explicit submit');
  assert(html.includes('https://hive.blog/@alice/hello-hive'), 'Hive post viewer links to hive.blog');
  assert(!html.includes('Донат'), 'Hive post viewer does not copy Golos donate UI');

  context.location.hash = '#chain=steem&app=feeds&feed=blog&account=alice';
  await context.DposV3.renderRoute();
  html = getElement('app').innerHTML + getElement('social-feeds-result').innerHTML;
  assert(calls.some(([method]) => method === 'getDiscussionsByBlog'), 'Steem feeds call getDiscussionsByBlog for blog feed');
  assert(html.includes('Feed post'), 'Steem feeds render feed card title');
  assert(html.includes('https://steemit.com/@feedauthor/feed-post'), 'Steem feed card links to steemit.com');
  assert(html.includes('#chain=steem&amp;app=post&amp;author=feedauthor&amp;permlink=feed-post'), 'Steem feed card links to in-app post route');
  assert(storage.has('dpos_steem_feeds_settings'), 'Steem feeds persist per-chain settings');
  assert(!html.includes('Донат автору'), 'Steem feeds do not expose Golos donate action');

  console.log('v3 social post/feeds runtime smoke passed');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
