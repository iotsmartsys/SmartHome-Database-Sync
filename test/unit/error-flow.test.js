const assert = require('node:assert/strict');
const test = require('node:test');

const http = require('../../src/app/utils/http');
const { InfrastructureError, NotFoundError } = require('../../src/app/utils/errors');
const { updateDevice } = require('../../src/app/managers/devices');
const { createCapability } = require('../../src/app/managers/capabilities');
const { publish } = require('../../src/app/mqtt/publisher');
const { handleCapabilityMessage, handleDiscoveryMessage } = require('../../src/app/mqtt/handlers');

function httpError(status, data = { message: 'failed' }) {
  const error = new Error('HTTP request failed');
  error.response = { status, data };
  return error;
}

test('atualização de dispositivo propaga falha HTTP como InfrastructureError', async () => {
  const originalPatch = http.patch;
  http.patch = async () => {
    throw httpError(503);
  };

  try {
    await assert.rejects(
      () => updateDevice('device-01', []),
      (error) => error instanceof InfrastructureError && error.status === 503 && error.retryable === true
    );
  } finally {
    http.patch = originalPatch;
  }
});

test('criação de capability propaga 404 como NotFoundError com resposta', async () => {
  const originalPost = http.post;
  http.post = async () => {
    throw httpError(404, 'device not found');
  };

  try {
    await assert.rejects(
      () => createCapability('zigbee-AA', { capability_name: 'on_off', type: 'boolean', value: true }),
      (error) => error instanceof NotFoundError && error.response === 'device not found'
    );
  } finally {
    http.post = originalPost;
  }
});

test('falha de publicação MQTT rejeita a operação', async () => {
  const client = {
    publish(_topic, _message, callback) {
      callback(new Error('broker offline'));
    },
  };

  await assert.rejects(() => publish(client, 'device/updated', { value: true }), /broker offline/);
});

test('handler não publica atualização quando persistência de capability falha', async () => {
  const originalPatch = http.patch;
  const client = {
    published: [],
    publish(topic, message, callback) {
      this.published.push({ topic, message });
      callback();
    },
  };
  http.patch = async () => {
    throw httpError(500);
  };

  try {
    await assert.rejects(
      () => handleCapabilityMessage(client, Buffer.from(JSON.stringify({
        device_id: 'device-01',
        capability_name: 'on_off',
        value: true,
        type: 'boolean',
      }))),
      InfrastructureError
    );
    assert.deepEqual(client.published, []);
  } finally {
    http.patch = originalPatch;
  }
});

test('discovery não publica capabilities quando a persistência do dispositivo falha', async () => {
  const originalGet = http.get;
  const originalPatch = http.patch;
  const client = {
    published: [],
    publish(topic, message, callback) {
      this.published.push({ topic, message });
      callback();
    },
  };
  http.get = async () => ({ status: 200 });
  http.patch = async () => {
    throw httpError(500);
  };

  try {
    await assert.rejects(
      () => handleDiscoveryMessage(client, Buffer.from(JSON.stringify({
        device_id: 'device-01',
        properties: [],
        capabilities: [{ capability_name: 'on_off', value: true, type: 'boolean' }],
      }))),
      InfrastructureError
    );
    assert.deepEqual(client.published, []);
  } finally {
    http.get = originalGet;
    http.patch = originalPatch;
  }
});

test('capability Zigbee inexistente publica apenas o pedido de discovery', async () => {
  const originalPatch = http.patch;
  const originalPost = http.post;
  const client = {
    published: [],
    publish(topic, message, callback) {
      this.published.push({ topic, payload: JSON.parse(message) });
      callback();
    },
  };
  http.patch = async () => {
    throw httpError(404);
  };
  http.post = async () => {
    throw httpError(404, 'device not found');
  };

  try {
    await handleCapabilityMessage(client, Buffer.from(JSON.stringify({
      device_id: 'zigbee-AABBCCDDEEFF',
      capability_name: 'on_off',
      value: true,
      type: 'boolean',
    })));
    assert.equal(client.published.length, 1);
    assert.equal(client.published[0].topic, 'smarthome/discovery');
    assert.equal(client.published[0].payload.device_id, 'zigbee-AABBCCDDEEFF');
  } finally {
    http.patch = originalPatch;
    http.post = originalPost;
  }
});
