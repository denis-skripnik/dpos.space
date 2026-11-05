(function (global) {
  'use strict';
  let database;
  function open() {
    if (!database) database = new Promise((resolve, reject) => {
      if (!global.indexedDB) { reject(new Error('storage')); return; }
      const request = global.indexedDB.open('dpos-voice-local', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('recordings');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error('storage'));
      request.onblocked = () => reject(new Error('storage'));
    });
    return database;
  }
  async function transaction(mode, operation) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('recordings', mode);
      const request = operation(tx.objectStore('recordings'));
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = tx.onabort = () => reject(new Error('storage'));
    });
  }
  global.DposVoiceStore = Object.freeze({
    read: () => transaction('readonly', store => store.get('current')),
    write: value => transaction('readwrite', store => store.put(value, 'current')),
    remove: () => transaction('readwrite', store => store.delete('current'))
  });
})(window);
