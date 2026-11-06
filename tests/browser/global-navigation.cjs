'use strict';
// Start a static server first. Node 22+, existing loopback Chromium CDP.
// DPOS_TEST_URL=http://127.0.0.1:18765/ node tests/browser/global-navigation.cjs
const assert = require('node:assert/strict');
const base = process.env.DPOS_TEST_URL || 'http://127.0.0.1:18765/';
const cdp = process.env.DPOS_TEST_CDP || 'http://127.0.0.1:18800';

(async () => {
  const tab = await (await fetch(`${cdp}/json/new?about:blank`, { method: 'PUT' })).json();
  const socket = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let sequence = 0;
  const pending = new Map();
  const errors = [];
  socket.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text);
    if (!message.id) return;
    const waiter = pending.get(message.id);
    pending.delete(message.id);
    clearTimeout(waiter.timer);
    message.error ? waiter.reject(Error(JSON.stringify(message.error))) : waiter.resolve(message.result);
  };
  const call = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => reject(Error(`CDP timeout: ${method}`)), 10000);
    pending.set(id, { resolve, reject, timer });
    socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async expression => {
    const result = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  const wait = async expression => {
    for (let attempt = 0; attempt < 100; attempt++) {
      if (await evaluate(expression)) return;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw Error(`UI timeout: ${expression}`);
  };
  const header = () => evaluate(`(() => {
    const chain = document.querySelector('#chain-select');
    const app = document.querySelector('#app-select');
    return { chains: chain.options.length, apps: app.options.length,
      chain: chain.value, app: app.value, disabled: chain.disabled || app.disabled };
  })()`);
  try {
    await call('Page.enable');
    await call('Runtime.enable');
    await call('Network.enable');
    await call('Network.setCacheDisabled', { cacheDisabled: true });
    await call('Network.setBypassServiceWorker', { bypass: true });
    // Cold entry uses the same global hash as the Android push destination.
    for (const route of ['notifications', 'settings-sync']) {
      await call('Page.navigate', { url: `${base}#app=${route}` });
      await wait(`document.readyState === 'complete' && document.querySelector('main h2') !== null`);
      const initial = await header();
      assert.equal(initial.chains, 6, `${route}: supported blockchains`);
      assert(initial.apps > 1, `${route}: service options`);
      assert.equal(initial.disabled, false);
      await evaluate(`(() => {const select=document.querySelector('#chain-select'); select.value='viz'; select.dispatchEvent(new Event('change', {bubbles:true}));})()`);
      await wait(`document.querySelector('#chain-select').value === 'viz' && document.querySelector('#app-select').options.length > 1`);
      await evaluate(`(() => {const select=document.querySelector('#app-select'); select.value='accounts'; select.dispatchEvent(new Event('change', {bubbles:true}));})()`);
      await wait(`document.querySelector('#app-select').value === 'accounts'`);
      await evaluate(`document.querySelector('#chain-select').closest('form').requestSubmit()`);
      await wait(`location.hash.includes('app=accounts')`);
      const selected = await header();
      await evaluate(`location.hash='app=${route}'`);
      await wait(`location.hash === '#app=${route}' && document.querySelector('main h2') !== null`);
      assert.deepEqual(await header(), selected, `${route}: preserve warm navigation`);
      console.log(`${route}: cold options, chain/service changes and warm preservation passed`);
    }
    assert.deepEqual(errors, [], 'uncaught browser exceptions');
  } finally {
    for (const waiter of pending.values()) clearTimeout(waiter.timer);
    socket.close();
    await fetch(`${cdp}/json/close/${tab.id}`);
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
