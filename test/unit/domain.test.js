const assert = require('node:assert/strict');
const test = require('node:test');

const {
  mapDiscoveryToDevice,
  buildDevicePatches,
  buildPropertyUpdate,
} = require('../../src/app/domain/device-mapper');
const {
  buildCapabilityToCreate,
  buildCapabilityUpdate,
  buildZigbeeDiscoveryPayload,
  isDeviceNotFoundResponse,
} = require('../../src/app/domain/capability-rules');

test('mapeador de dispositivo é puro e usa a data fornecida', () => {
  const date = '2026-07-13 12:34:56';
  const payload = {
    device_id: 'device-01',
    ip_address: '192.168.1.20',
    properties: [{ name: 'enabled', value: false }],
  };

  const device = mapDiscoveryToDevice(payload, 'ESP32', date);

  assert.equal(device.last_active, date);
  assert.equal(device.power_on, date);
  assert.deepEqual(device.properties, [{ name: 'enabled', description: 'enabled', value: false }]);
  assert.deepEqual(buildDevicePatches(payload, date), [
    { op: 'replace', path: 'ip_address', value: '192.168.1.20' },
    { op: 'replace', path: 'power_on', value: date },
  ]);
  assert.deepEqual(buildPropertyUpdate('counter', 0), {
    name: 'counter',
    description: 'counter',
    value: 0,
  });
});

test('regras de capability preservam valores falsy e recebem data explicitamente', () => {
  assert.deepEqual(buildCapabilityUpdate('enabled', false), {
    capability_name: 'enabled',
    value: false,
  });
  assert.deepEqual(buildCapabilityToCreate('device-01', {
    capability_name: 'counter',
    type: 'number',
    value: 0,
  })[0], {
    capability_name: 'counter',
    description: 'counter',
    owner: 'device-01',
    device_id: 'device-01',
    type: 'number',
    value: 0,
  });

  const discovery = buildZigbeeDiscoveryPayload('zigbee-AABBCCDDEEFF', '2026-07-13 12:34:56');
  assert.equal(discovery.last_active, '2026-07-13 12:34:56');
  assert.equal(discovery.mac_address, 'AA:BB:CC:DD:EE:FF');
  assert.equal(isDeviceNotFoundResponse({ message: 'Device not found' }), true);
});
