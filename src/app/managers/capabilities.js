const { deviceApi } = require('../infrastructure/http/device-api');
const logger = require('../utils/logger');
const { getCurrentFormattedDate } = require('../utils/date');
const { ValidationError, isNotFoundError } = require('../utils/errors');
const {
  buildCapabilityUpdate,
  buildCapabilityToCreate,
  isZigbeeDeviceId,
  isDeviceNotFoundResponse,
  buildZigbeeDiscoveryPayload,
} = require('../domain/capability-rules');

async function updateCapability(capabilityName, newValue, payload = {}) {
  const deviceId = payload.device_id;
  validateCapabilityUpdate(deviceId, capabilityName, newValue);

  const patchData = buildCapabilityUpdate(capabilityName, newValue);
  try {
    const response = await deviceApi.updateCapabilityValue(deviceId, patchData);
    logger.info(
      { device_id: deviceId, capabilityName, status: response.status },
      'Capability atualizada via API',
    );
    return { action: 'updated' };
  } catch (error) {
    if (!isNotFoundError(error)) {
      throw error;
    }
  }

  if (!payload.type) {
    throw new ValidationError('type é obrigatório para criar uma capability inexistente', {
      deviceId,
      capabilityName,
    });
  }

  try {
    await createCapability(deviceId, {
      capability_name: capabilityName,
      description: capabilityName,
      type: payload.type,
      value: newValue,
      owner: payload.owner || deviceId,
    });
    return { action: 'created' };
  } catch (error) {
    if (
      isNotFoundError(error) &&
      isZigbeeDeviceId(deviceId) &&
      isDeviceNotFoundResponse(error.response)
    ) {
      const discoveryPayload = buildZigbeeDiscoveryPayload(deviceId, getCurrentFormattedDate());
      logger.warn(
        { device_id: deviceId, capabilityName },
        'Device Zigbee inexistente. Solicitação de discovery montada',
      );
      return { action: 'discovery_required', discoveryPayload };
    }
    throw error;
  }
}

async function processCapabilities(devicePayload) {
  const deviceId = devicePayload?.device_id;
  validateDeviceId(deviceId);

  for (const capability of devicePayload.capabilities || []) {
    const capabilityName = capability.capability_name;
    if (!capabilityName || capability.value === undefined) continue;

    try {
      await deviceApi.getCapability(deviceId, capabilityName);
    } catch (error) {
      if (!isNotFoundError(error)) {
        throw error;
      }
      await createCapability(deviceId, capability);
    }
  }
}

async function createCapability(deviceId, capability) {
  validateDeviceId(deviceId);
  if (!capability?.capability_name || !capability.type) {
    throw new ValidationError('Dados inválidos para criação da capability', {
      deviceId,
      capability,
    });
  }

  const payload = buildCapabilityToCreate(deviceId, capability);

  const response = await deviceApi.createCapabilities(deviceId, payload);
  logger.info(
    { device_id: deviceId, capabilityName: capability.capability_name, status: response.status },
    'Capability criada com sucesso',
  );
  return response;
}

function validateCapabilityUpdate(deviceId, capabilityName, value) {
  validateDeviceId(deviceId);
  if (typeof capabilityName !== 'string' || capabilityName.trim() === '') {
    throw new ValidationError('capability_name deve ser uma string não vazia', { deviceId });
  }
  if (value === undefined) {
    throw new ValidationError('value é obrigatório para atualizar uma capability', {
      deviceId,
      capabilityName,
    });
  }
}

function validateDeviceId(deviceId) {
  if (typeof deviceId !== 'string' || deviceId.trim() === '') {
    throw new ValidationError('device_id deve ser uma string não vazia');
  }
}

module.exports = {
  updateCapability,
  processCapabilities,
  createCapability,
};
