#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const Module = require('module');

function loadAcorn() {
  const source = process.binding('natives')['internal/deps/acorn/acorn/dist/acorn'];
  if (!source) throw new Error('Node internal Acorn source is unavailable');
  const mod = new Module('_acorn');
  mod.filename = 'acorn.js';
  mod.paths = module.paths;
  mod._compile(source, mod.filename);
  return mod.exports;
}

const CYRILLIC_RE = /[А-Яа-яЁё]/;
const HUMAN_ATTRS = new Set(['placeholder', 'title', 'aria-label']);

function normalizeText(value) {
  return String(value)
    .replace(/\r\n?/g, '\n')
    .replace(/[\t\f\v ]+/g, ' ')
    .replace(/ *\n */g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeEntities(value) {
  const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  return value.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (match, entity) => {
    if (entity[0] !== '#') return named[entity.toLowerCase()] || match;
    const radix = entity[1].toLowerCase() === 'x' ? 16 : 10;
    const digits = radix === 16 ? entity.slice(2) : entity.slice(1);
    const point = Number.parseInt(digits, radix);
    return Number.isFinite(point) ? String.fromCodePoint(point) : match;
  });
}

function isCodeLike(text) {
  if (!CYRILLIC_RE.test(text)) return true;
  if (/^(?:https?:|wss?:|data:|javascript:|\/\/)/i.test(text)) return true;
  if (/^[.#][\w\u0400-\u04ff-]+$/.test(text)) return true;
  if (/^(?:const|let|var|function|return|class|import|export)\b/.test(text)) return true;
  if (/^[\w-]+\s*[:=]\s*[^ ]+;?$/.test(text)) return true;
  if (/^[{\[]|[}\]]$/.test(text) && /[":,]/.test(text)) return true;
  return false;
}

function addHumanText(output, seen, raw) {
  const text = normalizeText(decodeEntities(raw));
  if (!text || isCodeLike(text) || seen.has(text)) return;
  seen.add(text);
  output.push(text);
}

function extractHtmlText(html) {
  const output = [];
  const seen = new Set();
  const tokenRe = /<!--[\s\S]*?-->|<![^>]*>|<\/?[A-Za-z][^>]*>|[^<]+/g;
  const skipStack = [];
  let token;

  while ((token = tokenRe.exec(String(html)))) {
    const value = token[0];
    if (/^<\//.test(value)) {
      const match = /^<\/\s*([\w:-]+)/.exec(value);
      if (match && skipStack[skipStack.length - 1] === match[1].toLowerCase()) skipStack.pop();
      continue;
    }
    if (/^</.test(value)) {
      const tagMatch = /^<\s*([\w:-]+)/.exec(value);
      if (!tagMatch || /^<!/.test(value)) continue;
      const tag = tagMatch[1].toLowerCase();
      if (skipStack.length) {
        if (tag === skipStack[skipStack.length - 1] && !/\/>\s*$/.test(value)) skipStack.push(tag);
        continue;
      }
      if (tag === 'script' || tag === 'style' || tag === 'code' || tag === 'pre') {
        if (!/\/>\s*$/.test(value)) skipStack.push(tag);
        continue;
      }
      const attrRe = /([^\s=/>]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
      let attr;
      while ((attr = attrRe.exec(value))) {
        if (HUMAN_ATTRS.has(attr[1].toLowerCase())) addHumanText(output, seen, attr[2] ?? attr[3] ?? '');
      }
      continue;
    }
    if (!skipStack.length) addHumanText(output, seen, value);
  }
  return output;
}

function templateText(node, source) {
  let text = '';
  for (let index = 0; index < node.quasis.length; index += 1) {
    text += node.quasis[index].value.cooked ?? node.quasis[index].value.raw;
    if (index < node.expressions.length) text += `⟦${index}⟧`;
  }
  return text;
}

function extractCandidate(raw) {
  if (/<\/?[A-Za-z][^>]*>/.test(raw)) return extractHtmlText(raw);
  const output = [];
  addHumanText(output, new Set(), raw);
  return output;
}

function extractSourceText(source, options = {}) {
  const acorn = loadAcorn();
  const ast = acorn.parse(source, {
    ecmaVersion: 'latest',
    sourceType: options.sourceType || 'script',
    allowHashBang: true
  });
  const candidates = [];

  function isSemanticDataName(name) {
    return /(?:passwords?|tokenSymbols?|chainIds?|protocolIds?|identifiers?|assetSymbols?)$/i.test(name || '');
  }

  function isSemanticDataArray(node) {
    if (!node || node.type !== 'ArrayExpression') return false;
    const values = node.elements
      .filter((item) => item && item.type === 'Literal' && typeof item.value === 'string')
      .map((item) => item.value.toLowerCase());
    const passwordSignals = values.filter((value) => ['123456', 'qwerty', 'йцукен', 'password', 'пароль', 'letmein'].includes(value));
    return passwordSignals.length >= 2;
  }

  function walk(node, semanticData = false) {
    if (!node || typeof node !== 'object') return;
    let childSemanticData = semanticData || isSemanticDataArray(node);
    if (node.type === 'VariableDeclarator' && node.id && node.id.type === 'Identifier') {
      childSemanticData = childSemanticData || isSemanticDataName(node.id.name);
    }
    if (!semanticData && node.type === 'Literal' && typeof node.value === 'string') {
      candidates.push({ start: node.start, text: node.value });
    } else if (!semanticData && node.type === 'TemplateLiteral') {
      candidates.push({ start: node.start, text: templateText(node, source) });
    }
    for (const [key, value] of Object.entries(node)) {
      if (key === 'start' || key === 'end' || key === 'loc' || key === 'range' || key === 'raw') continue;
      if (Array.isArray(value)) value.forEach((item) => walk(item, childSemanticData));
      else if (value && typeof value === 'object' && typeof value.type === 'string') walk(value, childSemanticData);
    }
  }

  walk(ast);
  candidates.sort((a, b) => a.start - b.start);
  const output = [];
  const seen = new Set();
  for (const candidate of candidates) {
    for (const text of extractCandidate(candidate.text)) {
      if (!seen.has(text)) {
        seen.add(text);
        output.push(text);
      }
    }
  }
  return output;
}

function discoverActiveSources(indexPath) {
  const absoluteIndex = path.resolve(indexPath);
  const root = path.dirname(absoluteIndex);
  const html = fs.readFileSync(absoluteIndex, 'utf8');
  const sources = [absoluteIndex];
  const scriptRe = /<script\b[^>]*\bsrc\s*=\s*(?:"([^"]+)"|'([^']+)')[^>]*>/gi;
  let match;
  while ((match = scriptRe.exec(html))) {
    const src = (match[1] || match[2]).split(/[?#]/, 1)[0];
    if (!src || /^(?:https?:)?\/\//i.test(src) || src.startsWith('data:')) continue;
    const file = path.resolve(root, src);
    const relative = path.relative(root, file).split(path.sep).join('/');
    if (relative === 'v3/js/i18n-en.js' || relative.startsWith('../') || relative.includes('/vendor/') || relative.startsWith('v3/vendor/')) continue;
    if (fs.existsSync(file) && fs.statSync(file).isFile()) sources.push(file);
  }
  return sources;
}

function extractInventory(indexPath) {
  const sources = discoverActiveSources(indexPath);
  const output = [];
  const seen = new Set();
  for (const file of sources) {
    const source = fs.readFileSync(file, 'utf8');
    const texts = file.endsWith('.html') ? extractHtmlText(source) : extractSourceText(source, { filename: file });
    for (const text of texts) {
      if (!seen.has(text)) {
        seen.add(text);
        output.push(text);
      }
    }
  }
  return output;
}

function parseArgs(argv) {
  const args = { index: 'index.html', output: null };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--index') args.index = argv[++i];
    else if (argv[i] === '--output') args.output = argv[++i];
    else if (argv[i] === '--help') args.help = true;
    else throw new Error(`Unknown argument: ${argv[i]}`);
  }
  return args;
}

function main(argv) {
  const args = parseArgs(argv);
  if (args.help) {
    process.stdout.write('Usage: node tools/i18n-extract.cjs [--index index.html] [--output catalog.json]\n');
    return;
  }
  const json = `${JSON.stringify(extractInventory(args.index), null, 2)}\n`;
  if (args.output) fs.writeFileSync(path.resolve(args.output), json);
  else process.stdout.write(json);
}

if (require.main === module) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`i18n-extract: ${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = { discoverActiveSources, extractHtmlText, extractInventory, extractSourceText };
