const { AsyncLocalStorage } = require('async_hooks');
const crypto = require('crypto');

const storage = new AsyncLocalStorage();

function generateId() {
  // simple 32-char hex id
  return crypto.randomBytes(16).toString('hex');
}

function runWithId(id, fn) {
  const correlationId = id || generateId();
  return storage.run({ correlationId }, fn);
}

function getId() {
  const store = storage.getStore();
  return store ? store.correlationId : null;
}

module.exports = {
  generateId,
  runWithId,
  getId,
};
