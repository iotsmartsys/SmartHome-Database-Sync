const assert = require('node:assert/strict');
const test = require('node:test');

const http = require('../../src/app/utils/http');
const { formatDate } = require('../../src/app/utils/date');
const { mapPayloadToCreate } = require('../../src/app/managers/devices');
const {
  buildZigbeeDiscoveryPayload,
  createCapability,
} = require('../../src/app/managers/capabilities');
const { createConnectionLogContext } = require('../../src/app/mqtt/client');

test('contexto de log MQTT não expõe credenciais', () => {
  const context = createConnectionLogContext({
    host: 'broker.local',
    port: 8883,
    protocol: 'mqtts',
    username: 'user',
    password: 'secret',
    clientId: 'database-sync',
    rejectUnauthorized: true,
  });

  assert.deepEqual(context, {
    host: 'broker.local',
    port: 8883,
    protocol: 'mqtts',
    clientId: 'database-sync',
    rejectUnauthorized: true,
    authenticated: true,
  });
  assert.equal(JSON.stringify(context).includes('secret'), false);
  assert.equal(Object.hasOwn(context, 'password'), false);
  assert.equal(Object.hasOwn(context, 'username'), false);
});

test('discovery mapeia propriedades e preserva valores falsy', () => {
  const mapped = mapPayloadToCreate(
    {
      device_id: 'device/01',
      ip_address: '192.168.1.10',
      properties: [
        { name: 'enabled', value: false },
        { name: 'counter', value: 0 },
      ],
    },
    'ESP32'
  );

  assert.deepEqual(mapped.properties, [
    { name: 'enabled', description: 'enabled', value: false },
    { name: 'counter', description: 'counter', value: 0 },
  ]);
});

test('discovery aceita properties ausente', () => {
  const mapped = mapPayloadToCreate({ device_id: 'device-01' }, 'ESP32');
  assert.deepEqual(mapped.properties, []);
});

test('discovery rejeita device_id ausente antes de construir URL', () => {
  assert.throws(
    () => mapPayloadToCreate({ properties: [] }, 'ESP32'),
    /device_id deve ser uma string não vazia/
  );
});

test('criação de capability preserva false e codifica device_id', async () => {
  const originalPost = http.post;
  let request;
  http.post = async (url, body) => {
    request = { url, body };
    return { status: 201, data: {} };
  };

  try {
    const result = await createCapability('device/01', {
      capability_name: 'enabled',
      type: 'boolean',
      value: false,
    });

    assert.equal(result.status, 201);
    assert.equal(request.url, 'devices/device%2F01/capabilities');
    assert.equal(request.body[0].value, false);
  } finally {
    http.post = originalPost;
  }
});

test('criação de capability preserva zero', async () => {
  const originalPost = http.post;
  let requestBody;
  http.post = async (_url, body) => {
    requestBody = body;
    return { status: 201, data: {} };
  };

  try {
    await createCapability('device-01', {
      capability_name: 'counter',
      type: 'number',
      value: 0,
    });
    assert.equal(requestBody[0].value, 0);
  } finally {
    http.post = originalPost;
  }
});

test('datas usam um único formato', () => {
  assert.equal(formatDate(new Date('2026-07-13T12:34:56.789Z')), '2026-07-13 12:34:56');

  const discovery = buildZigbeeDiscoveryPayload('zigbee-AABBCCDDEEFF');
  assert.match(discovery.last_active, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  assert.equal(discovery.mac_address, 'AA:BB:CC:DD:EE:FF');
});
