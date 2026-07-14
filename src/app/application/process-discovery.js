const { mapDiscoveryToDevice, buildDevicePatches } = require('../domain/device-mapper');
const { buildCapabilityToCreate } = require('../domain/capability-rules');
const { isNotFoundError } = require('../utils/errors');
const { validateDeviceId } = require('./validation');

function createProcessDiscovery({ deviceApi, processPropertyUpdate, clock, platformResolver, logger }) {
  return async function processDiscovery(payload) {
    validateDeviceId(payload?.device_id);
    const deviceId = payload.device_id;
    let exists = true;
    try {
      await deviceApi.getDevice(deviceId);
    } catch (error) {
      if (!isNotFoundError(error)) throw error;
      exists = false;
    }

    if (exists) {
      await deviceApi.updateDevice(deviceId, buildDevicePatches(payload, clock()));
      for (const property of payload.properties || []) {
        await processPropertyUpdate({
          deviceId,
          propertyName: property.name,
          value: property.value,
          description: property.name,
        });
      }
    } else {
      const platform = payload.platform || platformResolver(deviceId);
      await deviceApi.createDevice(mapDiscoveryToDevice(payload, platform, clock()));
    }

    for (const capability of payload.capabilities || []) {
      if (!capability.capability_name || capability.value === undefined) continue;
      try {
        await deviceApi.getCapability(deviceId, capability.capability_name);
      } catch (error) {
        if (!isNotFoundError(error)) throw error;
        await deviceApi.createCapabilities(deviceId, buildCapabilityToCreate(deviceId, capability));
      }
    }

    logger.info({ device_id: deviceId }, 'Discovery do dispositivo processado com sucesso');
    return {
      action: 'synchronized',
      events: (payload.capabilities || []).map((capability) => ({
        type: 'capability_received',
        payload: {
          device_id: deviceId,
          capability_name: capability.capability_name,
          value: capability.value,
          type: capability.type,
        },
      })),
    };
  };
}

module.exports = { createProcessDiscovery };
