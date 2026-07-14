const assert = require('node:assert/strict');
const test = require('node:test');

const { NotFoundError } = require('../../src/app/utils/errors');
const { createApplication } = require('../../src/app/application/create-application');

function createLogger() {
  return { info() {}, warn() {}, error() {}, debug() {} };
}

test('caso de uso de discovery cria dispositivo e retorna eventos sem MQTT', async () => {
  const calls = [];
  const application = createApplication({
    logger: createLogger(),
    clock: () => '2026-07-13 12:34:56',
    platformResolver: () => 'ESP32',
    deviceApi: {
      getDevice: async () => {
        throw new NotFoundError('not found');
      },
      createDevice: async (device) => {
        calls.push({ type: 'createDevice', device });
        return { status: 201 };
      },
      getCapability: async () => {
        throw new NotFoundError('not found');
      },
      createCapabilities: async (_deviceId, capabilities) => {
        calls.push({ type: 'createCapabilities', capabilities });
        return { status: 201 };
      },
    },
  });

  const result = await application.processDiscovery({
    device_id: 'device-01',
    properties: [],
    capabilities: [{ capability_name: 'on_off', type: 'boolean', value: false }],
  });

  assert.equal(calls[0].type, 'createDevice');
  assert.equal(calls[0].device.platform, 'ESP32');
  assert.equal(calls[1].capabilities[0].value, false);
  assert.deepEqual(result.events, [
    {
      type: 'capability_received',
      payload: { device_id: 'device-01', capability_name: 'on_off', type: 'boolean', value: false },
    },
  ]);
});

test('caso de uso de capability retorna evento após atualização persistida', async () => {
  const application = createApplication({
    logger: createLogger(),
    deviceApi: {
      updateCapabilityValue: async () => ({ status: 200 }),
    },
  });

  const result = await application.processCapabilityUpdate({
    device_id: 'device-01',
    capability_name: 'on_off',
    value: true,
  });

  assert.deepEqual(result, {
    action: 'capability_updated',
    events: [
      { type: 'capability_updated', deviceId: 'device-01', capabilityName: 'on_off', value: true },
    ],
  });
});

test('caso de uso de propriedade trata device_state como patch de dispositivo', async () => {
  let patches;
  const application = createApplication({
    logger: createLogger(),
    deviceApi: {
      updateDevice: async (_deviceId, receivedPatches) => {
        patches = receivedPatches;
        return { status: 200 };
      },
    },
  });

  const result = await application.processPropertyUpdate({
    deviceId: 'device-01',
    propertyName: 'device_state',
    value: 'online',
  });

  assert.deepEqual(patches, [{ op: 'replace', path: 'state', value: 'online' }]);
  assert.equal(result.action, 'device_updated');
});
