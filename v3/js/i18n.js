(function exposeI18n(global) {
  'use strict';

  const STORAGE_KEY = 'dpos_locale';
  const TRANSLATED_ATTRIBUTES = ['placeholder', 'title', 'aria-label'];
  const SKIPPED_TAGS = new Set(['INPUT', 'TEXTAREA', 'CODE', 'PRE', 'SCRIPT', 'STYLE']);
  const originals = new WeakMap();
  const ownValues = new WeakMap();
  const boundLocaleControls = new WeakSet();
  let locale = 'ru';
  let observer = null;
  let catalogSource = null;
  let exactMessages = new Map();
  let templates = [];

  function normalizeLocale(value) {
    return String(value || '').toLowerCase().split('-')[0] === 'en' ? 'en' : 'ru';
  }

  function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
  }

  function compileTemplate(source, translated) {
    const marker = /⟦(\d+)⟧/g;
    let cursor = 0;
    let match;
    let pattern = '^';
    const indexes = [];
    while ((match = marker.exec(source))) {
      pattern += escapeRegExp(source.slice(cursor, match.index)) + '([\\s\\S]*?)';
      indexes.push(Number(match[1]));
      cursor = match.index + match[0].length;
    }
    if (!indexes.length) return null;
    pattern += escapeRegExp(source.slice(cursor)) + '$';
    return { regex: new RegExp(pattern), indexes, translated, specificity: source.replace(/⟦\d+⟧/g, '').length };
  }

  function refreshCatalog() {
    const source = global.DposEnglish || {};
    if (source === catalogSource) return;
    catalogSource = source;
    exactMessages = new Map();
    templates = [];
    const entries = [];
    function addEntries(value) {
      if (!value || typeof value !== 'object') return;
      Object.keys(value).forEach((key) => {
        if (typeof value[key] === 'string') entries.push([key, value[key]]);
      });
    }
    addEntries(source.messages);
    addEntries(source.templates);
    Object.keys(source).forEach((key) => {
      if (key !== 'messages' && key !== 'templates' && typeof source[key] === 'string') entries.push([key, source[key]]);
    });
    entries.forEach(([russian, english]) => {
      const markers = (text) => (text.match(/⟦\d+⟧/g) || []).sort().join('|');
      if (markers(russian) !== markers(english)) return;
      const template = compileTemplate(russian, english);
      if (template) templates.push(template);
      else exactMessages.set(russian.replace(/\s+/g, ' ').trim(), english);
    });
    templates.sort((a, b) => b.specificity - a.specificity);
  }

  function translateRussian(text) {
    refreshCatalog();
    const normalized = text.replace(/\s+/g, ' ').trim();
    if (exactMessages.has(normalized)) return exactMessages.get(normalized);
    if (!/[А-Яа-яЁё]/.test(text)) return text;
    for (const template of templates) {
      const match = template.regex.exec(text);
      if (!match) continue;
      const captures = {};
      template.indexes.forEach((index, position) => { captures[index] = match[position + 1]; });
      return template.translated.replace(/⟦(\d+)⟧/g, (token, index) => (
        Object.prototype.hasOwnProperty.call(captures, index) ? captures[index] : token
      ));
    }
    return text;
  }

  function translatePreservingWhitespace(value) {
    const match = /^(\s*)([\s\S]*?)(\s*)$/.exec(String(value));
    if (!match || !match[2]) return String(value);
    return match[1] + translateRussian(match[2]) + match[3];
  }

  function t(text) {
    const value = String(text == null ? '' : text);
    return locale === 'en' ? translatePreservingWhitespace(value) : value;
  }

  function elementClassContains(element, name) {
    const value = element.getAttribute && element.getAttribute('class');
    return value ? value.split(/\s+/).includes(name) : false;
  }

  function isSkippedElement(element, allowFormAttributes = false) {
    if (!element || element.nodeType !== 1) return false;
    const translate = element.getAttribute && element.getAttribute('translate');
    const editable = element.getAttribute && element.getAttribute('contenteditable');
    return (SKIPPED_TAGS.has(element.tagName) && !(allowFormAttributes && ['INPUT', 'TEXTAREA'].includes(element.tagName)))
      || (element.tagName === 'OPTION' && !element.hasAttribute('value'))
      || String(translate || '').toLowerCase() === 'no'
      || (element.hasAttribute && element.hasAttribute('data-i18n-skip'))
      || (element.hasAttribute && element.hasAttribute('data-user-content'))
      || (element.hasAttribute && element.hasAttribute('data-i18n-user-content'))
      || elementClassContains(element, 'user-content')
      || (editable !== null && String(editable).toLowerCase() !== 'false');
  }

  function hasSkippedAncestor(node, boundary) {
    if (!node) return false;
    let current = node.nodeType === 1 ? node : node.parentNode;
    while (current) {
      if (isSkippedElement(current)) return true;
      if (current === boundary) break;
      current = current.parentNode;
    }
    return false;
  }

  function isI18nRoot(node) {
    return Boolean(node && node.nodeType === 1 && node.hasAttribute && node.hasAttribute('data-i18n-root'));
  }

  function containingRoot(node) {
    let current = node && (node.nodeType === 1 ? node : node.parentNode);
    while (current) {
      if (isI18nRoot(current)) return current;
      current = current.parentNode;
    }
    return null;
  }

  function remember(node, key, value) {
    let record = originals.get(node);
    if (!record) {
      record = {};
      originals.set(node, record);
    }
    if (!Object.prototype.hasOwnProperty.call(record, key)) record[key] = value;
    return record;
  }

  function setOwnValue(node, key, value, setter) {
    let record = ownValues.get(node);
    if (!record) {
      record = {};
      ownValues.set(node, record);
    }
    record[key] = value;
    setter(value);
  }

  function applyText(node, boundary) {
    if (!node || node.nodeType !== 3 || hasSkippedAncestor(node, boundary)) return;
    const current = String(node.data);
    const expected = ownValues.get(node);
    let record = originals.get(node);
    if (record && (!expected || current !== expected.text)) record.text = current;
    record = remember(node, 'text', current);
    const next = locale === 'en' ? translatePreservingWhitespace(record.text) : record.text;
    if (current !== next) setOwnValue(node, 'text', next, (value) => { node.data = value; });
  }

  function applyAttribute(element, name) {
    if (!element.hasAttribute || !element.hasAttribute(name)) return;
    const current = element.getAttribute(name);
    const key = `attr:${name}`;
    const expected = ownValues.get(element);
    let record = originals.get(element);
    if (record && (!expected || current !== expected[key])) record[key] = current;
    record = remember(element, key, current);
    const next = locale === 'en' ? translatePreservingWhitespace(record[key]) : record[key];
    if (current !== next) setOwnValue(element, key, next, (value) => { element.setAttribute(name, value); });
  }

  function isLocaleControl(element) {
    if (!element || element.nodeType !== 1 || element.tagName !== 'SELECT') return false;
    return (element.hasAttribute && (element.hasAttribute('data-i18n-locale') || element.hasAttribute('data-locale-select')))
      || (element.getAttribute && ['locale-select', 'language-select'].includes(element.getAttribute('id')));
  }

  function bindLocaleControl(element) {
    if (!isLocaleControl(element)) return;
    element.value = locale;
    if (boundLocaleControls.has(element) || !element.addEventListener) return;
    boundLocaleControls.add(element);
    element.addEventListener('change', () => setLocale(element.value));
  }

  function processTree(node, boundary) {
    if (!node) return;
    if (node.nodeType === 3) {
      applyText(node, boundary);
      return;
    }
    if (node.nodeType !== 1 && node.nodeType !== 9 && node.nodeType !== 11) return;
    if (node.nodeType === 1) {
      if (hasSkippedAncestor(node.parentNode, boundary)) return;
      bindLocaleControl(node);
      if (isSkippedElement(node)) {
        if (['INPUT', 'TEXTAREA'].includes(node.tagName) && !isSkippedElement(node, true)) {
          TRANSLATED_ATTRIBUTES.forEach((name) => applyAttribute(node, name));
        }
        return;
      }
      TRANSLATED_ATTRIBUTES.forEach((name) => applyAttribute(node, name));
      bindLocaleControl(node);
    }
    Array.from(node.childNodes || []).forEach((child) => processTree(child, boundary));
  }

  function collectDesignatedRoots(node, found) {
    if (!node) return;
    if (isI18nRoot(node)) {
      found.push(node);
      return;
    }
    Array.from(node.childNodes || []).forEach((child) => collectDesignatedRoots(child, found));
  }

  function apply(root) {
    const target = root || global.document;
    const ancestorRoot = containingRoot(target);
    if (ancestorRoot) {
      processTree(target, ancestorRoot);
      return target;
    }
    const roots = [];
    collectDesignatedRoots(target, roots);
    roots.forEach((item) => processTree(item, item));
    return target;
  }

  function observeMutations(records) {
    records.forEach((record) => {
      if (record.type === 'childList') {
        Array.from(record.addedNodes || []).forEach((node) => apply(node));
      } else if (record.type === 'attributes') {
        apply(record.target);
      } else if (record.type === 'characterData') {
        const boundary = containingRoot(record.target);
        if (!boundary || hasSkippedAncestor(record.target, boundary)) return;
        const expected = ownValues.get(record.target);
        if (expected && String(record.target.data) === expected.text) return;
        let source = originals.get(record.target);
        if (!source) {
          source = {};
          originals.set(record.target, source);
        }
        source.text = String(record.target.data);
        applyText(record.target, boundary);
      }
    });
  }

  function ensureObserver() {
    if (observer || !global.MutationObserver || !global.document || !global.document.documentElement) return;
    observer = new global.MutationObserver(observeMutations);
    observer.observe(global.document.documentElement, { childList: true, characterData: true, attributes: true, attributeFilter: TRANSLATED_ATTRIBUTES, subtree: true });
  }

  function setLocale(nextLocale) {
    locale = normalizeLocale(nextLocale);
    if (global.localStorage) {
      try { global.localStorage.setItem(STORAGE_KEY, locale); } catch (error) { /* storage may be unavailable */ }
    }
    if (global.document && global.document.documentElement) {
      global.document.documentElement.setAttribute('lang', locale);
      apply(global.document);
    }
    ensureObserver();
    return locale;
  }

  function getLocale() {
    return locale;
  }

  function init() {
    let saved = null;
    if (global.localStorage) {
      try { saved = global.localStorage.getItem(STORAGE_KEY); } catch (error) { /* storage may be unavailable */ }
    }
    if (saved !== 'ru' && saved !== 'en') {
      const browserLanguage = global.navigator && (global.navigator.language || (global.navigator.languages && global.navigator.languages[0]));
      saved = String(browserLanguage || '').toLowerCase().startsWith('en') ? 'en' : 'ru';
    }
    return setLocale(saved);
  }

  // Native dialogs have no DOM to observe. Only the message is localized;
  // return values and prompt defaults keep the original browser semantics.
  ['confirm', 'alert', 'prompt'].forEach((name) => {
    const original = global[name];
    if (typeof original !== 'function') return;
    global[name] = function localizedDialog(message, ...args) {
      return original.call(global, t(message), ...args);
    };
  });

  global.DposI18n = Object.freeze({ t, apply, setLocale, getLocale, init });
  if (global.document && global.document.readyState === 'loading' && global.document.addEventListener) {
    global.document.addEventListener('DOMContentLoaded', init, { once: true });
  } else if (global.document) {
    init();
  }
}(typeof window !== 'undefined' ? window : globalThis));
