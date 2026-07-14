function buildCapabilityUpdate(capabilityName, value) {
  return { capability_name: capabilityName, value };
}

function buildCapabilityToCreate(deviceId, capability) {
  return [
    {
      capability_name: capability.capability_name,
      description: capability.description || capability.capability_name,
      owner: capability.owner || deviceId,
      device_id: deviceId,
      type: capability.type,
      value: capability.value ?? '',
    },
  ];
}

function isZigbeeDeviceId(deviceId = '') {
  return /^zigbee-/i.test(deviceId);
}

function isDeviceNotFoundResponse(response) {
  if (typeof response === 'string') return /not found/i.test(response);
  if (response && typeof response === 'object') return /not found/i.test(JSON.stringify(response));
  return false;
}

function buildZigbeeDiscoveryPayload(deviceId, currentDate) {
  return {
    device_id: deviceId,
    device_name: deviceId,
    description: deviceId,
    last_active: currentDate,
    state: 'online',
    mac_address: normalizeMacAddress(deviceId.replace(/^zigbee-/i, '')),
    ip_address: 'Zigbee',
    protocol: 'Zigbee',
    platform: 'Zigbee',
    capabilities: [],
    properties: [],
  };
}

function normalizeMacAddress(rawValue = '') {
  const hex = rawValue.replace(/[^a-fA-F0-9]/g, '').toUpperCase();
  return (hex.match(/.{1,2}/g) || []).join(':');
}

module.exports = {
  buildCapabilityUpdate,
  buildCapabilityToCreate,
  isZigbeeDeviceId,
  isDeviceNotFoundResponse,
  buildZigbeeDiscoveryPayload,
  normalizeMacAddress,
};
