const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const appSource = fs.readFileSync(path.join(root, 'v3/js/app.js'), 'utf8');
const catalogSource = fs.readFileSync(path.join(root, 'v3/js/i18n-en.js'), 'utf8');
const i18nSource = fs.readFileSync(path.join(root, 'v3/js/i18n.js'), 'utf8');

function extractFunction(source, name) {
  const marker = `function ${name}(`;
  const start = source.indexOf(marker);
  assert(start >= 0, `${name} exists`);
  const next = source.indexOf('\n  function ', start + marker.length);
  assert(next > start, `function following ${name} exists`);
  return source.slice(start, next).trim();
}

const functions = [
  'escapeHtml', 'appHash', 'golosPostRouteLink', 'renderGolosDonateMemoHtml',
  'decimalStringAdd', 'minterMultisendEntriesFromData', 'minterMultisendEntries',
  'summarizeMinterMultisend', 'formatMinterMultisendTotals', 'renderMinterMultisendDetailsHtml',
  'renderAccountCell', 'accountLink', 'getPathValue', 'normalizeTransactionRow', 'transactionDetails',
  'renderTransactionDetailsHtml', 'explorerLink', 'renderTransactionsTable',
  'renderTemplateSelect', 'renderGolosUiaDepositSection', 'renderGolosUiaWithdrawSection',
  'syncGolosWithdrawFields', 'setOperationResult'
];

const context = {
  URLSearchParams,
  console,
  history: {
    formatValue: String,
    formatDate: value => String(value),
    formatChainAmount: (_chain, _key, value) => String(value),
    operationTitle: value => String(value)
  },
  broadcast: { sanitizePrepared: value => value, sanitizeResult: value => value },
  rawJsonDetails: () => '',
  renderPrepared: () => '',
  operationSummary: () => '',
  setStatus: () => {},
  getGolosBuiltInTemplates: () => [],
  readGolosCustomTemplates: () => [{ name: 'Кошелёк', to: 'receiver', memo: 'Memo клиента' }],
  getGolosGatewayOptions: gateways => gateways,
  golosGatewayHasDepositAction: () => true,
  golosMainBalanceMap: () => new Map([['USDT', '12.000 USDT']]),
  operationDetails: (_title, body) => body,
  copyButton: () => '',
  window: null,
  document: {},
  navigator: { language: 'en-US' },
  localStorage: { getItem: () => 'en', setItem: () => {} },
  MutationObserver: class { observe() {} },
  addEventListener() {}
};
context.window = context;
context.globalThis = context;
vm.runInNewContext(functions.map(name => extractFunction(appSource, name)).join('\n'), context, { filename: 'app-boundary-functions.js' });
vm.runInNewContext(catalogSource, context, { filename: 'i18n-en.js' });
vm.runInNewContext(i18nSource, context, { filename: 'i18n.js' });
context.DposI18n.setLocale('en');

function localizeRenderedHtml(html) {
  const stack = [];
  return String(html).split(/(<[^>]+>)/g).map(part => {
    if (!part.startsWith('<')) return stack.some(Boolean) ? part : context.DposI18n.t(part);
    const closing = /^<\//.test(part);
    if (closing) stack.pop();
    else if (!/^<\s*(?:br|hr|img|input|meta|link)\b/i.test(part)) stack.push(stack.some(Boolean) || /\b(?:data-i18n-skip|translate=["']no["'])\b/i.test(part) || /^<\s*(?:code|pre|textarea)\b/i.test(part));
    return part;
  }).join('');
}

{
  const resultEl = { dataset: {}, innerHTML: '' };
  context.setOperationResult({ querySelector: () => resultEl }, 'ok', 'info', {
    meta: { warnings: ['Опасная операция валидатора: меняет chain properties; проверьте поля перед отправкой.'] }
  });
  const english = localizeRenderedHtml(resultEl.innerHTML);
  assert(english.includes('Dangerous validator operation: changes chain properties; check the fields before submission.'), 'first-party security warning is translated');
}

{
  const html = context.renderTemplateSelect('transfer', 'GOLOS', 'alice', 'template');
  const english = localizeRenderedHtml(html);
  assert(english.includes('data-i18n-skip value="1"') && english.includes('>Кошелёк</option>'), 'custom template name remains exact');
  assert(!english.includes('>Wallet</option>'), 'custom template name is not translated');
}

const gateways = [{
  symbol: 'USDT',
  deposit: { details: 'Кошелёк', min_amount: 'Кошелёк', fee: '1.25 USDT', to_type: 'fixed', to_fixed: 'Кошелёк', memo_fixed: 'Комментарий' },
  withdraw: {
    account: 'Кошелёк', details: 'Кошелёк', min_amount: 'Кошелёк', fee: '2 USDT',
    ways: [{ name: 'Кошелёк', memo: 'Кошелёк', postfix_title: 'Кошелёк', postfix: 'Кошелёк', prefix: 'withdraw' }]
  }
}];

{
  const english = localizeRenderedHtml(context.renderGolosUiaDepositSection(gateways));
  assert(english.includes('<p data-i18n-skip>Кошелёк</p>'), 'deposit details remain exact UGC');
  assert(english.includes('Minimum amount: Кошелёк'), 'deposit first-party label translates while amount remains exact');
  assert(english.includes('Fee: 1.25 USDT'), 'deposit fee label translates while amount remains exact');
  assert(english.includes('Address/recipient:'), 'fixed deposit label translates');
  assert(english.includes('<code>Кошелёк</code>'), 'deposit address remains exact');
}

{
  const english = localizeRenderedHtml(context.renderGolosUiaWithdrawSection(gateways, []));
  assert(english.includes('USDT — Кошелёк — maximum 12.000 USDT'), 'withdraw way name remains exact inside translated option text');
  assert(english.includes('— maximum 12.000 USDT'), 'withdraw first-party maximum label translates');
  assert(english.includes('<span data-i18n-skip>Кошелёк</span>'), 'withdraw details remain exact UGC');
  assert(english.includes('Minimum amount: Кошелёк'), 'withdraw label translates while amount remains exact');
  assert(english.includes('Gateway account: Кошелёк'), 'gateway label translates while account remains exact');
}

{
  function element() {
    return { textContent: '', placeholder: '', attrs: new Set(), toggleAttribute(name, on) { if (on) this.attrs.add(name); else this.attrs.delete(name); } };
  }
  const main = element();
  const postfixLabel = element();
  const postfixInput = element();
  const postfixField = { hidden: true };
  const selected = { dataset: { memoLabel: 'Кошелёк', postfixLabel: 'Кошелёк', postfixPlaceholder: 'Кошелёк' } };
  const nodes = {
    '[data-withdraw-main-label]': main,
    '[data-withdraw-postfix-field]': postfixField,
    '[data-withdraw-postfix-label]': postfixLabel,
    '#wallet-golos-uia-withdraw-postfix': postfixInput
  };
  context.syncGolosWithdrawFields({ selectedOptions: [selected] }, { querySelector: selector => nodes[selector] });
  assert.strictEqual(main.textContent, 'Кошелёк');
  assert(main.attrs.has('data-i18n-skip'), 'custom memo label is marked as UGC');
  assert.strictEqual(postfixLabel.textContent, 'Кошелёк');
  assert(postfixLabel.attrs.has('data-i18n-skip'), 'custom postfix label is marked as UGC');
  assert(postfixInput.attrs.has('data-i18n-skip'), 'custom postfix placeholder is marked as UGC');
  context.syncGolosWithdrawFields({ selectedOptions: [{ dataset: {} }] }, { querySelector: selector => nodes[selector] });
  assert.strictEqual(main.textContent, 'Данные для вывода');
  assert(!main.attrs.has('data-i18n-skip'), 'first-party fallback memo label remains translatable');
  assert.strictEqual(postfixLabel.textContent, 'Дополнительно');
  assert(!postfixLabel.attrs.has('data-i18n-skip'), 'first-party fallback postfix label remains translatable');
}

{
  const minter = { id: 'minter', title: 'Minter' };
  const html = context.renderTransactionsTable([{ type: 13, data: { list: [
    { to: 'Mx1111111111111111111111111111111111111111', value: '1.25', coin: 'BIP' },
    { to: 'Mx2222222222222222222222222222222222222222', value: '2.5', coin: 'BIP' }
  ] } }], minter);
  const english = localizeRenderedHtml(html);
  assert(english.includes('<strong>Total:</strong>'), 'multisend total label translates');
  assert(english.includes('<strong>Recipients:</strong>'), 'multisend recipient label translates');
  assert(english.includes('<span data-i18n-skip>3.75 BIP</span>'), 'multisend total remains exact');
  assert(english.includes('<span data-i18n-skip>1.25 BIP</span>'), 'multisend amount remains exact');
  assert(english.includes('Mx1111111111111111111111111111111111111111'), 'multisend address remains exact');
}

{
  const golos = { id: 'golos', title: 'Golos' };
  const html = context.renderTransactionsTable([{ type: 'donate', data: { from: 'alice', to: 'bob', amount: 'Кошелёк', coin: 'GOLOS', memo: {
    target: { author: 'Кошелёк', permlink: 'Комментарий' }, type: 'fee_donate', comment: 'Кошелёк', app: 'Приложение', version: '1'
  } } }], golos);
  const english = localizeRenderedHtml(html);
  assert(english.includes('<strong>Post:</strong>'), 'donation post label translates');
  assert(english.includes('<strong>Comment:</strong>'), 'donation comment label translates');
  assert(english.includes('<strong>Application:</strong>'), 'donation app label translates');
  assert(english.includes('>Кошелёк</span>'), 'donation memo remains exact');
  assert(english.includes('@Кошелёк/Комментарий'), 'donation target address and permlink remain exact');
  assert(english.includes('<td data-i18n-skip>Кошелёк GOLOS</td>'), 'transaction amount remains exact');
}

console.log('v3 app i18n boundary behavioral tests passed');
