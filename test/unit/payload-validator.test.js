const assert = require('node:assert/strict');
const test = require('node:test');

const { ValidationError } = require('../../src/app/utils/errors');
const {
  parseJsonMessage,
  validateCapabilityPayload,
  validateDiscoveryPayload,
  validateMetricsPayload,
  MAX_MESSAGE_BYTES,
} = require('../../src/app/interfaces/mqtt/payload-validator');
const { createHandlers } = require('../../src/app/mqtt/handlers');

test('validador preserva false, zero e null quando o campo value existe', () => {
  for (const value of [false, 0, null, '']) {
    const payload = validateCapabilityPayload({
      device_id: 'device-01',
      capability_name: 'sensor',
      value,
    });
    assert.equal(payload.value, value);
  }
});

test('campos opcionais vazios são tratados como não informados', () => {
  assert.doesNotThrow(() =>
    validateCapabilityPayload({
      device_id: 'device-01',
      capability_name: 'sensor',
      value: true,
      type: '',
      owner: '',
    }),
  );
  assert.doesNotThrow(() =>
    validateDiscoveryPayload({
      device_id: 'device-01',
      platform: '',
      capabilities: [{ capability_name: 'sensor', value: true, type: '' }],
    }),
  );
});

test('validador rejeita JSON, campos e estruturas inválidas', () => {
  assert.throws(() => parseJsonMessage(Buffer.from('{')), ValidationError);
  assert.throws(
    () => validateCapabilityPayload({ device_id: 'device-01', capability_name: 'sensor' }),
    /value é obrigatório/,
  );
  assert.throws(
    () => validateDiscoveryPayload({ device_id: 'device-01', properties: {} }),
    /properties deve ser uma lista/,
  );
  assert.throws(
    () => parseJsonMessage(Buffer.from('a'.repeat(MAX_MESSAGE_BYTES + 1))),
    /excede o limite/,
  );
});

test('handler não chama a aplicação com payload MQTT inválido', async () => {
  let called = false;
  const handlers = createHandlers({
    topics: { capability: 'capability/topic', discovery: 'discovery/topic' },
    appLogger: { info() {}, warn() {}, error() {} },
    application: {
      processCapabilityUpdate: async () => {
        called = true;
      },
      processDiscovery: async () => {
        called = true;
      },
      processPropertyUpdate: async () => {
        called = true;
      },
    },
  });

  await assert.rejects(
    () => handlers.handleMessage({}, 'capability/topic', Buffer.from('{"device_id":"device-01"}')),
    ValidationError,
  );
  assert.equal(called, false);
});

test('validador de métricas aceita o contrato MQTT e rejeita campos numéricos inválidos', () => {
  const payload = {
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

  assert.equal(validateMetricsPayload(payload), payload);
  assert.throws(
    () => validateMetricsPayload({ ...payload, uptime_ms: 1.5 }),
    /uptime_ms deve ser um número inteiro seguro/,
  );
  assert.throws(
    () => validateMetricsPayload({ ...payload, cpu_percent: '99.8' }),
    /cpu_percent deve ser um número finito/,
  );
  assert.throws(
    () => validateMetricsPayload({ ...payload, network: undefined }),
    /network deve ser um objeto/,
  );
});
