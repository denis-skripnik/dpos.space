const fs = require('fs');
const assert = require('assert');
const html = fs.readFileSync('index.html', 'utf8');
const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
assert(scripts.length > 0);
for (const [, attributes, body] of scripts) {
  const source = (attributes.match(/\bsrc="([^"]+)"/) || [])[1];
  assert(source && !/^(?:[a-z]+:|\/\/)/i.test(source), 'only local reviewed scripts may execute in wallet origin');
  assert.strictEqual(body.trim(), '', 'no inline executable bootstrap');
}
assert(!/mc\.yandex|translate\.yandex|webvisor/i.test(html), 'no tracker or translation widget may observe wallet data');
const policy = (html.match(/http-equiv="Content-Security-Policy"\s+content="([^"]+)"/i) || [])[1];
assert(policy, 'wallet shell has enforced CSP');
assert(/(?:^|;)\s*script-src\s+'self'\s+'wasm-unsafe-eval'\s*;/.test(policy), 'scripts are same-origin only; only WASM compilation, not JS eval, is allowed');
assert(/object-src\s+'none'/.test(policy));
assert(/base-uri\s+'none'/.test(policy));
assert(html.includes('id="language-select"'), 'built-in language selector remains available');
assert(html.includes('value="ru"') && html.includes('value="en"'));
console.log('first-party wallet shell security passed');
