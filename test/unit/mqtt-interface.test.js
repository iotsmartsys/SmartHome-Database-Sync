const assert = require('node:assert/strict');
const test = require('node:test');

const { createMessageRouter } = require('../../src/app/interfaces/mqtt/message-router');
const { createMqttEventPublisher } = require('../../src/app/interfaces/mqtt/event-publisher');
const { createHandlers } = require('../../src/app/mqtt/handlers');

test('router encaminha por tópico e ignora tópicos desconhecidos', async () => {
  const received = [];
  const warnings = [];
  const router = createMessageRouter({
    topics: { capability: 'capability/topic', discovery: 'discovery/topic' },
    logger: { warn: (meta) => warnings.push(meta) },
    handlers: {
      capability: async () => received.push('capability'),
      discovery: async () => received.push('discovery'),
    },
  });

  await router.route({}, 'capability/topic', Buffer.from('{}'));
  await router.route({}, 'unknown/topic', Buffer.from('{}'));

  assert.deepEqual(received, ['capability']);
  assert.deepEqual(warnings, [{ topic: 'unknown/topic' }]);
});

test('publicador MQTT traduz eventos de saída em publicações', async () => {
  const calls = [];
  const publisher = createMqttEventPublisher({
    client: {},
    topics: { capability: 'capability/topic', discovery: 'discovery/topic' },
    publish: async (_client, topic, payload) => calls.push({ type: 'publish', topic, payload }),
    publishCapabilityUpdate: async (_client, deviceId, capabilityName, value) => {
      calls.push({ type: 'capability', deviceId, capabilityName, value });
    },
  });

  await publisher.publishEvents([
    { type: 'capability_received', payload: { value: true } },
    { type: 'capability_updated', deviceId: 'device-01', capabilityName: 'on_off', value: false },
    { type: 'discovery_requested', payload: { device_id: 'zigbee-01' } },
  ]);

  assert.deepEqual(calls, [
    { type: 'publish', topic: 'capability/topic', payload: { value: true } },
    { type: 'capability', deviceId: 'device-01', capabilityName: 'on_off', value: false },
    { type: 'publish', topic: 'discovery/topic', payload: { device_id: 'zigbee-01' } },
  ]);
});

test('handler usa a aplicação injetada', async () => {
  let payload;
  const handlers = createHandlers({
    topics: { capability: 'capability/topic', discovery: 'discovery/topic' },
    appLogger: { info() {}, warn() {}, error() {} },
    application: {
      processCapabilityUpdate: async (receivedPayload) => {
        payload = receivedPayload;
        return { events: [] };
      },
      processDiscovery: async () => ({ events: [] }),
      processPropertyUpdate: async () => ({ events: [] }),
    },
  });

  await handlers.handleMessage(
    {},
    'capability/topic',
    Buffer.from('{"device_id":"device-01","capability_name":"on_off","value":true}'),
  );
  assert.deepEqual(payload, { device_id: 'device-01', capability_name: 'on_off', value: true });
});

test('handler de métricas encaminha payload validado para a aplicação', async () => {
  let payload;
  const handlers = createHandlers({
    topics: {
      capability: 'capability/topic',
      discovery: 'discovery/topic',
      metrics: 'device/metrics',
    },
    appLogger: { info() {}, warn() {}, error() {} },
    application: {
      processDeviceMetrics: async (receivedPayload) => {
        payload = receivedPayload;
        return { action: 'device_metrics_persisted' };
      },
    },
  });
  const message = {
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
  };

  await handlers.handleMessage({}, 'device/metrics', Buffer.from(JSON.stringify(message)));
  assert.deepEqual(payload, message);
});
