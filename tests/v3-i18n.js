const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

class FakeNode {
  constructor(type) { this.nodeType = type; this.parentNode = null; this.childNodes = []; }
  appendChild(node) {
    node.parentNode = this;
    this.childNodes.push(node);
    FakeMutationObserver.emit({ type: 'childList', target: this, addedNodes: [node] });
    return node;
  }
  get textContent() { return this.nodeType === 3 ? this.data : this.childNodes.map((node) => node.textContent).join(''); }
  set textContent(value) {
    if (this.nodeType === 3) { this.data = String(value); return; }
    this.childNodes = [];
    this.appendChild(new FakeText(String(value)));
  }
}

class FakeText extends FakeNode {
  constructor(data) { super(3); this._data = String(data); }
  get data() { return this._data; }
  set data(value) {
    this._data = String(value);
    FakeMutationObserver.emit({ type: 'characterData', target: this });
  }
}

class FakeElement extends FakeNode {
  constructor(tag, attributes = {}) {
    super(1);
    this.tagName = tag.toUpperCase();
    this.attributes = new Map();
    this.listeners = {};
    this.value = '';
    Object.entries(attributes).forEach(([name, value]) => this.setAttribute(name, value));
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.has(name) ? this.attributes.get(name) : null; }
  hasAttribute(name) { return this.attributes.has(name); }
  addEventListener(type, listener) { (this.listeners[type] ||= []).push(listener); }
  dispatchEvent(event) { (this.listeners[event.type] || []).forEach((listener) => listener.call(this, event)); }
  matches(selector) {
    if (selector === '[data-i18n-root]') return this.hasAttribute('data-i18n-root');
    return false;
  }
  querySelectorAll(selector) {
    const found = [];
    const visit = (node) => {
      if (node !== this && node.nodeType === 1 && node.matches(selector)) found.push(node);
      node.childNodes.forEach(visit);
    };
    visit(this);
    return found;
  }
  focus() { this.ownerDocument.activeElement = this; }
}

class FakeDocument extends FakeElement {
  constructor() {
    super('document');
    this.nodeType = 9;
    this.documentElement = new FakeElement('html');
    this.documentElement.ownerDocument = this;
    this.appendChild(this.documentElement);
    this.activeElement = null;
    this.readyState = 'loading';
  }
  createElement(tag) { const node = new FakeElement(tag); node.ownerDocument = this; return node; }
  createTextNode(text) { const node = new FakeText(text); node.ownerDocument = this; return node; }
}

class FakeMutationObserver {
  static observers = [];
  constructor(callback) { this.callback = callback; }
  observe(target, options) { this.target = target; this.options = options; FakeMutationObserver.observers.push(this); }
  disconnect() { FakeMutationObserver.observers = FakeMutationObserver.observers.filter((item) => item !== this); }
  static emit(record) {
    for (const observer of [...FakeMutationObserver.observers]) {
      let node = record.target;
      while (node && node !== observer.target) node = node.parentNode;
      if (node && observer.options[record.type]) observer.callback([record]);
    }
  }
}

function text(document, value) { return document.createTextNode(value); }
function element(document, tag, attrs, value) {
  const node = document.createElement(tag);
  Object.entries(attrs || {}).forEach(([name, attrValue]) => node.setAttribute(name, attrValue));
  if (value !== undefined) node.appendChild(text(document, value));
  return node;
}

const document = new FakeDocument();
const storage = new Map();
const dialogCalls = [];
const context = {
  console,
  confirm(message) { dialogCalls.push(message); return false; },
  alert(message) { dialogCalls.push(message); },
  prompt(message, value) { dialogCalls.push(message); return value; },
  document,
  MutationObserver: FakeMutationObserver,
  navigator: { language: 'en-US' },
  localStorage: {
    getItem(key) { return storage.has(key) ? storage.get(key) : null; },
    setItem(key, value) { storage.set(key, String(value)); }
  },
  DposEnglish: {
    'Кошелёк': 'Wallet',
    'Отправить': 'Send',
    'Адрес получателя': 'Recipient address',
    'Сумма ⟦0⟧ для ⟦1⟧': 'Amount ⟦0⟧ for ⟦1⟧',
    'Опасный <img src=x onerror=attack()>': 'Safe <img src=x onerror=attack()>'
  }
};
context.window = context;
context.globalThis = context;

const root = element(document, 'main', { 'data-i18n-root': '' });
document.documentElement.appendChild(root);
const heading = element(document, 'h1', {}, 'Кошелёк');
const button = element(document, 'button', { title: 'Отправить', 'aria-label': 'Отправить' }, 'Отправить');
button.value = 'SENTINEL_VALUE';
button.setAttribute('data-address', 'SENTINEL_DATASET');
let clicks = 0;
button.addEventListener('click', () => { clicks += 1; });
const input = element(document, 'input', { placeholder: 'Адрес получателя' });
input.value = 'USER_TYPED_SECRET';
const languageSelect = element(document, 'select', { id: 'language-select', 'aria-label': 'Язык', translate: 'no' });
languageSelect.value = 'ru';
const dynamic = element(document, 'p', {}, 'Сумма 12.50 VIZ для alice');
const unsafe = element(document, 'p', {}, 'Опасный <img src=x onerror=attack()>');
const skipped = element(document, 'section', { 'data-i18n-skip': '' }, 'Кошелёк');
const userContent = element(document, 'article', { class: 'user-content' }, 'Кошелёк');
const editable = element(document, 'div', { contenteditable: 'true' }, 'Кошелёк');
const code = element(document, 'code', {}, 'Кошелёк');
const implicitOption = element(document, 'option', {}, 'Кошелёк');
root.appendChild(implicitOption);
const outside = element(document, 'aside', {}, 'Кошелёк');
const outsideLocale = element(document, 'select', { 'data-i18n-locale': '' });
outsideLocale.value = 'SENTINEL_LOCALE_CONTROL';
[root, heading, button, input, languageSelect, dynamic, unsafe, skipped, userContent, editable, code].slice(1).forEach((node) => root.appendChild(node));
document.documentElement.appendChild(outside);
document.documentElement.appendChild(outsideLocale);
button.focus();

vm.runInNewContext(fs.readFileSync('v3/js/i18n.js', 'utf8'), context, { filename: 'v3/js/i18n.js' });
assert(context.DposI18n, 'runtime must expose DposI18n');
assert.strictEqual(context.DposI18n.t('Кошелёк'), 'Кошелёк');
document.dispatchEvent({ type: 'DOMContentLoaded' });
assert.strictEqual(document.documentElement.getAttribute('lang'), 'en');
assert.strictEqual(storage.get('dpos_locale'), 'en');
assert.strictEqual(languageSelect.value, 'en');
assert.strictEqual(heading.textContent, 'Wallet');
assert.strictEqual(button.textContent, 'Send');
assert.strictEqual(button.getAttribute('title'), 'Send');
assert.strictEqual(button.getAttribute('aria-label'), 'Send');
assert.strictEqual(input.getAttribute('placeholder'), 'Recipient address');
assert.strictEqual(dynamic.textContent, 'Amount 12.50 VIZ for alice');
assert.strictEqual(unsafe.textContent, 'Safe <img src=x onerror=attack()>');
assert.strictEqual(unsafe.childNodes.length, 1, 'translation must not create markup');
assert.strictEqual(skipped.textContent, 'Кошелёк');
assert.strictEqual(userContent.textContent, 'Кошелёк');
assert.strictEqual(editable.textContent, 'Кошелёк');
assert.strictEqual(code.textContent, 'Кошелёк');
assert.strictEqual(outside.textContent, 'Кошелёк');
assert.strictEqual(implicitOption.textContent, 'Кошелёк', 'option text is its submitted value unless an explicit value exists');
assert.strictEqual(outsideLocale.value, 'SENTINEL_LOCALE_CONTROL', 'must not touch controls outside designated roots');
assert.strictEqual(button.value, 'SENTINEL_VALUE');
assert.strictEqual(input.value, 'USER_TYPED_SECRET');
assert.strictEqual(button.getAttribute('data-address'), 'SENTINEL_DATASET');
assert.strictEqual(document.activeElement, button, 'locale switch must preserve focus');
button.dispatchEvent({ type: 'click' });
assert.strictEqual(clicks, 1, 'locale switch must preserve listeners and node identity');
assert.strictEqual(context.DposI18n.t('Сумма 9 VIZ для bob'), 'Amount 9 VIZ for bob');
assert.strictEqual(context.DposI18n.t('Сумма\n9\tVIZ для bob'), 'Amount 9\tVIZ for bob');
assert.strictEqual(context.DposI18n.t('Префикс Кошелёк суффикс'), 'Префикс Кошелёк суффикс', 'must not substring-replace');
languageSelect.value = 'ru';
languageSelect.dispatchEvent({ type: 'change' });
assert.strictEqual(context.DposI18n.getLocale(), 'ru', 'native selector must switch locale');
context.DposI18n.setLocale('en');

const added = element(document, 'button', { title: 'Отправить' }, 'Отправить');
root.appendChild(added);
assert.strictEqual(added.textContent, 'Send', 'observer must translate async additions');
assert.strictEqual(added.getAttribute('title'), 'Send');
heading.childNodes[0].data = 'Отправить';
assert.strictEqual(heading.textContent, 'Send', 'observer must translate external characterData changes');

context.DposI18n.setLocale('ru');
assert.strictEqual(heading.textContent, 'Отправить', 'RU restore must retain latest external source text');
assert.strictEqual(button.textContent, 'Отправить');
assert.strictEqual(button.getAttribute('title'), 'Отправить');
assert.strictEqual(dynamic.textContent, 'Сумма 12.50 VIZ для alice');
assert.strictEqual(document.documentElement.getAttribute('lang'), 'ru');
assert.strictEqual(context.DposI18n.t('Кошелёк'), 'Кошелёк');
assert.strictEqual(button.value, 'SENTINEL_VALUE');
assert.strictEqual(input.value, 'USER_TYPED_SECRET');
assert.strictEqual(document.activeElement, button);

storage.set('dpos_locale', 'en');
context.navigator.language = 'de-DE';
context.DposI18n.init();
assert.strictEqual(context.DposI18n.getLocale(), 'en', 'saved locale must override browser language');
storage.clear();
context.DposI18n.init();
assert.strictEqual(context.DposI18n.getLocale(), 'ru', 'non-English browser language must default to Russian');
context.DposI18n.setLocale('en');
const excludedInput = element(document, 'input', { translate: 'no', placeholder: 'Адрес получателя' });
root.appendChild(excludedInput);
assert.strictEqual(excludedInput.getAttribute('placeholder'), 'Адрес получателя');
assert.strictEqual(context.DposI18n.t('Сумма  для alice'), 'Amount  for alice', 'empty dynamic values must be preserved');
context.DposEnglish = { ...context.DposEnglish, 'Длинная строка': 'Long line', 'Ошибка: ⟦0⟧': 'Error: ⟦0⟧' };
assert.strictEqual(context.DposI18n.t('Длинная\n  строка'), 'Long line', 'HTML source whitespace is insignificant');
const detachedRoot = element(document, 'section', { 'data-i18n-root': '' }, 'Кошелёк');
context.DposI18n.apply(detachedRoot);
assert.strictEqual(detachedRoot.textContent, 'Wallet');
input.setAttribute('placeholder', 'Отправить');
FakeMutationObserver.emit({ type: 'attributes', target: input, attributeName: 'placeholder' });
assert.strictEqual(input.getAttribute('placeholder'), 'Send', 'late attributes must be localized');
context.DposI18n.setLocale('ru');
assert.strictEqual(input.getAttribute('placeholder'), 'Отправить', 'latest source attribute restores');
context.DposI18n.setLocale('en');
assert.strictEqual(context.confirm('Отправить'), false);
assert.strictEqual(dialogCalls.pop(), 'Send');
assert.strictEqual(context.prompt('Отправить', 'USER_DEFAULT'), 'USER_DEFAULT');
assert.strictEqual(dialogCalls.pop(), 'Send');
context.alert('Кошелёк');
assert.strictEqual(dialogCalls.pop(), 'Wallet');
context.DposEnglish = { 'Сумма ⟦0⟧': 'Amount without its value' };
assert.strictEqual(context.DposI18n.t('Сумма 5'), 'Сумма 5', 'invalid catalog must not drop financial parameters');
console.log('v3 i18n behavioral tests passed');
