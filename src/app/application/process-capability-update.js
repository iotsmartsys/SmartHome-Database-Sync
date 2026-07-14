const {
  buildCapabilityUpdate,
  buildCapabilityToCreate,
  isZigbeeDeviceId,
  isDeviceNotFoundResponse,
  buildZigbeeDiscoveryPayload,
} = require('../domain/capability-rules');
const { ValidationError, isNotFoundError } = require('../utils/errors');
const { validateCapability } = require('./validation');

function createProcessCapabilityUpdate({ deviceApi, processPropertyUpdate, clock, logger }) {
  return async function processCapabilityUpdate(payload) {
    const deviceId = payload?.device_id;
    const capabilityName = payload?.capability_name;
    const value = payload?.value;
    validateCapability(deviceId, capabilityName, value);

    if (capabilityName === 'device_state') {
      return processPropertyUpdate({ deviceId, propertyName: capabilityName, value });
    }
    if (capabilityName === 'wifi_signal') {
      return processPropertyUpdate({
        deviceId,
        propertyName: capabilityName,
        value,
        description: 'Sinal Wi-Fi',
      });
    }
    if (capabilityName === 'wifi_ssid') {
      return processPropertyUpdate({
        deviceId,
        propertyName: capabilityName,
        value,
        description: 'SSID Wi-Fi',
      });
    }
    if (capabilityName.includes('battery_level')) {
      return processPropertyUpdate({
        deviceId,
        propertyName: 'battery_level',
        value,
        description: 'Nível da Bateria',
      });
    }

    try {
      await deviceApi.updateCapabilityValue(deviceId, buildCapabilityUpdate(capabilityName, value));
      logger.info({ device_id: deviceId, capabilityName }, 'Capability atualizada via API');
      return capabilityUpdated(deviceId, capabilityName, value);
    } catch (error) {
      if (!isNotFoundError(error)) throw error;
    }

    if (!payload.type) {
      throw new ValidationError('type é obrigatório para criar uma capability inexistente', {
        deviceId,
        capabilityName,
      });
    }

    try {
      await deviceApi.createCapabilities(
        deviceId,
        buildCapabilityToCreate(deviceId, {
          capability_name: capabilityName,
          description: capabilityName,
          type: payload.type,
          value,
          owner: payload.owner || deviceId,
        }),
      );
      logger.info({ device_id: deviceId, capabilityName }, 'Capability criada com sucesso');
      return capabilityUpdated(deviceId, capabilityName, value);
    } catch (error) {
      if (
        isNotFoundError(error) &&
        isZigbeeDeviceId(deviceId) &&
        isDeviceNotFoundResponse(error.response)
      ) {
        return {
          action: 'discovery_required',
          events: [
            {
              type: 'discovery_requested',
              payload: buildZigbeeDiscoveryPayload(deviceId, clock()),
            },
          ],
        };
      }
      throw error;
    }
  };
}

function capabilityUpdated(deviceId, capabilityName, value) {
  return {
    action: 'capability_updated',
    events: [{ type: 'capability_updated', deviceId, capabilityName, value }],
  };
}

module.exports = { createProcessCapabilityUpdate };
