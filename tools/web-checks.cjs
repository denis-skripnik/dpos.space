#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const tests = fs.readdirSync(path.join(root, 'tests')).filter(name => /^v3-.*\.js$/.test(name)).sort();
const sources = fs.readdirSync(path.join(root, 'v3/js')).filter(name => name.endsWith('.js')).map(name => `v3/js/${name}`);
const failures = [];
function check(label, args) {
  const result = spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8', timeout: 120000, maxBuffer: 10 * 1024 * 1024 });
  if (result.error || result.status !== 0) {
    failures.push(label);
    console.error(`FAIL ${label}\n${result.error ? result.error.message : ''}\n${result.stdout || ''}${result.stderr || ''}`);
  }
}
if (!tests.length || !sources.length) throw new Error('Web checks discovered no tests or application sources');
for (const source of [...sources, 'sw.js']) check(`syntax:${source}`, ['--check', source]);
for (const test of tests) check(`tests/${test}`, ['--no-experimental-fetch', `tests/${test}`]);
console.log(JSON.stringify({ syntaxChecks: sources.length + 1, testFiles: tests.length, failures }, null, 2));
process.exitCode = failures.length ? 1 : 0;
