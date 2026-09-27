const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const rootPath = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(rootPath, 'v3/js/golos-wallet-swap.js'), 'utf8');

class FakeNode {
  constructor(tag, document) {
    this.tagName = tag;
    this.ownerDocument = document;
    this.children = [];
    this.attributes = {};
    this.textContent = '';
    this.href = '';
  }
  appendChild(node) { this.children.push(node); return node; }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  querySelector(selector) {
    if (selector === 'strong') return this.strong || null;
    if (selector === '[data-golos-wallet-swap]') {
      return this.children.find((node) => node.attributes && node.attributes['data-golos-wallet-swap']) || null;
    }
    return null;
  }
}

function fixture() {
  const document = {
    createElement(tag) { return new FakeNode(tag, document); },
    createTextNode(text) { return { nodeType: 3, textContent: text, ownerDocument: document }; }
  };
  const rows = [];
  const root = {
    ownerDocument: document,
    querySelectorAll(selector) { return selector === '.wallet-golos-balances li' ? rows : []; }
  };
  function row(label) {
    const node = new FakeNode('li', document);
    node.strong = new FakeNode('strong', document);
    node.strong.textContent = `${label}:`;
    rows.push(node);
    return node;
  }
  const context = { window: null, document, setTimeout, clearTimeout, Promise, URLSearchParams };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(source, context, { filename: 'v3/js/golos-wallet-swap.js' });
  return { api: context.DposGolosWalletSwap, root, row };
}

(async () => {
  {
    const { api, root, row } = fixture();
    const golosRow = row('GOLOS');
    const tipRow = row('UIA GOLD TIP');
    const calls = [];
    const dex = {
      async getExchange(request) {
        calls.push(request);
        if (request.amount === '1.000 GOLOS' && request.symbol === 'GBG') {
          return { direct: { res: '2.500 GBG', steps: [['limit_order_create', {}]] } };
        }
        return {};
      },
      async makeExchangeTx(steps, options) {
        assert.strictEqual(options.owner, 'alice');
        assert.strictEqual(options.fill_or_kill, true);
        return steps.length ? [['limit_order_create', {}]] : [];
      }
    };
    const attached = await api.attach(root, {
      chain: { id: 'golos', wsEndpoint: 'wss://golos.example' },
      account: 'alice',
      balances: [
        { symbol: 'GOLOS', amount: '12.345 GOLOS', balanceType: 'main', row: golosRow },
        { symbol: 'GOLD', amount: '9.000 GOLD', balanceType: 'tip', row: tipRow }
      ],
      whitelist: [{ max_supply: '1000000.000 GOLD', symbols_whitelist: ['GOLOS'] }],
      ensureDex: async () => dex,
      isCurrent: () => true,
      timeoutMs: 200
    });
    assert.strictEqual(attached.length, 1, 'a live, executable quote adds one swap action');
    const link = golosRow.querySelector('[data-golos-wallet-swap]');
    assert(link, 'the main GOLOS row receives the swap link');
    assert.strictEqual(link.href, '#chain=golos&app=swap&token=GOLOS&buySymbol=GBG');
    assert.strictEqual(link.textContent, 'Обменять на GBG');
    assert.strictEqual(tipRow.children.length, 0, 'TIP rows never receive links or quote work');
    assert(calls.every((call) => call.node === 'wss://golos.example' && call.direction === 'sell'), 'quotes use the configured live node and sell direction');
    assert(calls.some((call) => call.amount === '1.000 GOLOS'), 'a reasonable amount is tried before the full balance');
    assert(calls.every((call) => Number(call.amount.split(' ')[0]) <= 12.345), 'no quote exceeds the available balance');
  }

  {
    const { api, root, row } = fixture();
    const invalidRow = row('GBG');
    let makeCalls = 0;
    const dex = {
      async getExchange() { return { best: { res: '4.000 GOLOS', steps: [['x', {}]] } }; },
      async makeExchangeTx() { makeCalls += 1; return []; }
    };
    const result = await api.attach(root, {
      chain: { id: 'golos', wsEndpoint: 'wss://node' }, account: 'alice',
      balances: [{ symbol: 'GBG', amount: '3.000 GBG', balanceType: 'main', row: invalidRow }],
      ensureDex: async () => dex, timeoutMs: 200
    });
    assert.strictEqual(result.length, 0, 'an empty makeExchangeTx result is not eligible');
    assert(makeCalls > 0, 'the quote is checked by actually building its unsigned operation list');
    assert.strictEqual(invalidRow.children.length, 0, 'invalid operation builders add no button');
  }

  {
    const { api, root, row } = fixture();
    const noQuoteRow = row('UIA SILVER (основной)');
    const dex = { async getExchange() { return null; }, async makeExchangeTx() { throw new Error('must not run'); } };
    const result = await api.attach(root, {
      chain: { id: 'golos', wsEndpoint: 'wss://node' }, account: 'alice',
      balances: [{ symbol: 'SILVER', amount: '0.000123 SILVER', balanceType: 'main', row: noQuoteRow }],
      ensureDex: async () => dex, timeoutMs: 200
    });
    assert.strictEqual(result.length, 0, 'no live quotes means no swap action');
    assert.strictEqual(noQuoteRow.children.length, 0);
  }

  {
    const { api, root, row } = fixture();
    const preciseRow = row('UIA MICRO (основной)');
    const amounts = [];
    let active = true;
    const dex = {
      async getExchange(request) {
        amounts.push(request.amount);
        active = false;
        return { best: { res: '0.000001 GOLOS', steps: [['x', {}]] } };
      },
      async makeExchangeTx() { return [['x', {}]]; }
    };
    const result = await api.attach(root, {
      chain: { id: 'golos', wsEndpoint: 'wss://node' }, account: 'alice',
      balances: [{ symbol: 'MICRO', amount: '0.000123 MICRO', balanceType: 'main', row: preciseRow }],
      ensureDex: async () => dex, isCurrent: () => active, timeoutMs: 200
    });
    assert(amounts.includes('0.000123 MICRO'), 'tiny balances retain exact token precision');
    assert.strictEqual(result.length, 0, 'a stale wallet view is not modified');
    assert.strictEqual(preciseRow.children.length, 0, 'stale async completion appends nothing');
  }

  {
    const { api } = fixture();
    assert.strictEqual(
      api.routeHref('A&B', 'X Y'),
      '#chain=golos&app=swap&token=A%26B&buySymbol=X%20Y',
      'route values are escaped rather than interpolated as extra hash parameters'
    );
    const invalid = await api.findEligible({
      chain: { id: 'golos', wsEndpoint: 'wss://node' }, account: 'alice',
      balances: [{ symbol: 'BAD&token', amount: '1.000 BAD' }],
      ensureDex: async () => ({ getExchange() { throw new Error('must not quote'); }, makeExchangeTx() { return []; } })
    });
    assert.strictEqual(invalid.length, 0, 'invalid symbols cannot become routes or quotes');
  }

  {
    const { api, root, row } = fixture();
    const main = row('UIA GOLD (основной)');
    await api.attach(root, {
      chain: {id:'golos',wsEndpoint:'https://node'},account:'alice',
      balances:[{symbol:'GOLD',amount:'1.000 GOLD',balanceType:'main'}],
      ensureDex: async () => {
        main.strong.textContent='UIA GOLD (main):';
        return {getExchange:async()=>({best:{res:'2.000 GOLOS',steps:[['x',{}]]}}),makeExchangeTx:async()=>[['x',{}]]};
      }
    });
    assert(main.querySelector('[data-golos-wallet-swap]'),'translation during a quote must not lose the row');
  }
  {
    const {api,root,row}=fixture(); row('GOLOS');let current=true,calls=0;
    await api.attach(root,{chain:{id:'golos',wsEndpoint:'https://node'},account:'alice',
      balances:[{symbol:'GOLOS',amount:'20.000 GOLOS'}],isCurrent:()=>current,
      ensureDex:async()=>({getExchange:async()=>{calls++;current=false;return null;},makeExchangeTx:async()=>[]})});
    assert.strictEqual(calls,1,'leaving the wallet stops further quote requests');
  }
  console.log('v3 Golos wallet swap behavioral checks passed');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
