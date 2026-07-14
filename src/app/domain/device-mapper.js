function mapDiscoveryToDevice(devicePayload, platform, currentDate) {
  return {
    device_id: devicePayload.device_id,
    device_name: devicePayload.device_id,
    description: devicePayload.device_id,
    last_active: currentDate,
    state: 'Active',
    mac_address: devicePayload.mac_address || '00:00:00:00:00:00',
    ip_address: devicePayload.ip_address,
    protocol: 'MQTT',
    platform,
    capabilities: [],
    properties: (devicePayload.properties || []).map(mapProperty),
    power_on: currentDate,
  };
}

function buildDevicePatches(devicePayload, currentDate) {
  const patches = [];
  if (devicePayload.mac_address) {
    patches.push(createPatch('mac_address', devicePayload.mac_address));
  }
  patches.push(createPatch('ip_address', devicePayload.ip_address));
  patches.push(createPatch('power_on', currentDate));
  return patches;
}

function buildPropertyUpdate(name, value, description = name) {
  return { name, description, value };
}

function mapProperty(property) {
  return buildPropertyUpdate(property.name, property.value);
}

function createPatch(name, value) {
  return { op: 'replace', path: name, value };
}

module.exports = {
  mapDiscoveryToDevice,
  buildDevicePatches,
  buildPropertyUpdate,
  createPatch,
};
