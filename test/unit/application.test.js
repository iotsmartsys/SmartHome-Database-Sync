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

test('caso de uso de métricas converte o payload MQTT para o contrato da API', async () => {
  let persisted;
  const application = createApplication({
    logger: createLogger(),
    deviceApi: {
      createDeviceMetrics: async (deviceId, metrics) => {
        persisted = { deviceId, metrics };
        return { status: 204 };
      },
    },
  });

  const result = await application.processDeviceMetrics({
    device_id: 'esp32c6-FFFE17',
    uptime_ms: 432758344,
    cpu_cores: 1,
    cpu_percent: 99.8,
    memory_percent: 34.9,
    temperature_c: 52.6,
    frequency_mhz: 160,
    network: {
      rssi: -46,
      last_desconnected: 176666,
      desconnected_rason: 0,
      connection_count: 2,
    },
  });

  assert.deepEqual(persisted, {
    deviceId: 'esp32c6-FFFE17',
    metrics: {
      device_id: 'esp32c6-FFFE17',
      uptime_ms: 432758344,
      cpu_cores: 1,
      cpu_percent: 99.8,
      memory_percent: 34.9,
      temperature_c: 52.6,
      frequency_mhz: 160,
      network: {
        rssi: -46,
        last_disconnection_uptime_ms: 176666,
        disconnection_reason: 0,
        connection_count: 2,
      },
    },
  });
  assert.deepEqual(result, { action: 'device_metrics_persisted' });
});
