const http = require('../utils/http');
const logger = require('../utils/logger');
const { getCurrentFormattedDate } = require('../utils/date');
const {
  ValidationError,
  isNotFoundError,
  toInfrastructureError,
} = require('../utils/errors');

async function updateCapability(capabilityName, newValue, payload = {}) {
  const deviceId = payload.device_id;
  validateCapabilityUpdate(deviceId, capabilityName, newValue);

  const patchData = { capability_name: capabilityName, value: newValue };
  try {
    const response = await http.patch(
      `devices/${encodeURIComponent(deviceId)}/capabilities/value`,
      patchData
    );
    logger.info({ device_id: deviceId, capabilityName, status: response.status }, 'Capability atualizada via API');
    return { action: 'updated' };
  } catch (error) {
    if (!isNotFoundError(error)) {
      throw toInfrastructureError(error, 'Erro ao atualizar capability', { deviceId, capabilityName });
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
      const discoveryPayload = buildZigbeeDiscoveryPayload(deviceId);
      logger.warn({ device_id: deviceId, capabilityName }, 'Device Zigbee inexistente. Solicitação de discovery montada');
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
      await http.get(
        `devices/${encodeURIComponent(deviceId)}/capabilities/${encodeURIComponent(capabilityName)}`
      );
    } catch (error) {
      if (!isNotFoundError(error)) {
        throw toInfrastructureError(error, 'Erro ao verificar capability', { deviceId, capabilityName });
      }
      await createCapability(deviceId, capability);
    }
  }
}

async function createCapability(deviceId, capability) {
  validateDeviceId(deviceId);
  if (!capability?.capability_name || !capability.type) {
    throw new ValidationError('Dados inválidos para criação da capability', { deviceId, capability });
  }

  const payload = [{
    capability_name: capability.capability_name,
    description: capability.description || capability.capability_name,
    owner: capability.owner || deviceId,
    device_id: deviceId,
    type: capability.type,
    value: capability.value ?? '',
  }];

  try {
    const response = await http.post(`devices/${encodeURIComponent(deviceId)}/capabilities`, payload);
    logger.info({ device_id: deviceId, capabilityName: capability.capability_name, status: response.status }, 'Capability criada com sucesso');
    return response;
  } catch (error) {
    throw toInfrastructureError(error, 'Erro ao criar capability', {
      deviceId,
      capabilityName: capability.capability_name,
    });
  }
}

function validateCapabilityUpdate(deviceId, capabilityName, value) {
  validateDeviceId(deviceId);
  if (typeof capabilityName !== 'string' || capabilityName.trim() === '') {
    throw new ValidationError('capability_name deve ser uma string não vazia', { deviceId });
  }
  if (value === undefined) {
    throw new ValidationError('value é obrigatório para atualizar uma capability', { deviceId, capabilityName });
  }
}

function validateDeviceId(deviceId) {
  if (typeof deviceId !== 'string' || deviceId.trim() === '') {
    throw new ValidationError('device_id deve ser uma string não vazia');
  }
}

function isZigbeeDeviceId(deviceId = '') {
  return /^zigbee-/i.test(deviceId);
}

function isDeviceNotFoundResponse(response) {
  if (typeof response === 'string') return /not found/i.test(response);
  if (response && typeof response === 'object') return /not found/i.test(JSON.stringify(response));
  return false;
}

function buildZigbeeDiscoveryPayload(deviceId) {
  return {
    device_id: deviceId,
    device_name: deviceId,
    description: deviceId,
    last_active: getCurrentFormattedDate(),
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
  updateCapability,
  processCapabilities,
  createCapability,
  buildZigbeeDiscoveryPayload,
};
