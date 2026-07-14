const assert = require('node:assert/strict');
const test = require('node:test');

const { InfrastructureError, NotFoundError } = require('../../src/app/utils/errors');
const { createDeviceApi } = require('../../src/app/infrastructure/http/device-api');

test('deviceApi centraliza método, URL e codificação de identificadores', async () => {
  const calls = [];
  const api = createDeviceApi({
    get: async (url) => {
      calls.push({ method: 'get', url });
      return { status: 200 };
    },
    post: async (url, body) => {
      calls.push({ method: 'post', url, body });
      return { status: 201 };
    },
    patch: async (url, body) => {
      calls.push({ method: 'patch', url, body });
      return { status: 200 };
    },
    put: async (url, body) => {
      calls.push({ method: 'put', url, body });
      return { status: 200 };
    },
  });

  await api.getDevice('device/01');
  await api.updateDevice('device/01', [{ op: 'replace', path: 'state', value: 'online' }]);
  await api.upsertProperty('device/01', { name: 'wifi_ssid', value: 'home' });
  await api.getCapability('device/01', 'switch/on');
  await api.updateCapabilityValue('device/01', { capability_name: 'switch/on', value: true });
  await api.createCapabilities('device/01', [{ capability_name: 'switch/on', type: 'boolean' }]);

  assert.deepEqual(
    calls.map(({ method, url }) => ({ method, url })),
    [
      { method: 'get', url: 'devices/device%2F01' },
      { method: 'patch', url: 'devices/device%2F01' },
      { method: 'put', url: 'devices/device%2F01/properties' },
      { method: 'get', url: 'devices/device%2F01/capabilities/switch%2Fon' },
      { method: 'patch', url: 'devices/device%2F01/capabilities/value' },
      { method: 'post', url: 'devices/device%2F01/capabilities' },
    ],
  );
});

test('deviceApi traduz falhas HTTP para erros da aplicação', async () => {
  const api = createDeviceApi({
    get: async () => {
      const error = new Error('not found');
      error.response = { status: 404, data: { message: 'not found' } };
      throw error;
    },
  });

  await assert.rejects(() => api.getDevice('device-01'), NotFoundError);

  const unavailableApi = createDeviceApi({
    patch: async () => {
      const error = new Error('unavailable');
      error.response = { status: 503, data: {} };
      throw error;
    },
  });
  await assert.rejects(
    () => unavailableApi.updateDevice('device-01', []),
    (error) => error instanceof InfrastructureError && error.retryable === true,
  );
});
