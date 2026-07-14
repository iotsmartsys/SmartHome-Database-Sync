const http = require('../utils/http');
const { getCurrentFormattedDate } = require('../utils/date');
const { getPlatformFromDeviceId } = require('../utils/platform');
const { processCapabilities } = require('./capabilities');
const { ValidationError, isNotFoundError, toInfrastructureError } = require('../utils/errors');
const logger = require('../utils/logger');

async function processDiscoveryDevice(devicePayload) {
  validateDeviceId(devicePayload?.device_id);
  const deviceId = devicePayload.device_id;
  const properties = devicePayload.properties || [];

  let deviceExists = true;
  try {
    await http.get(`devices/${encodeURIComponent(deviceId)}`);
  } catch (error) {
    if (!isNotFoundError(error)) {
      throw toInfrastructureError(error, 'Erro ao sincronizar dispositivo de discovery', { deviceId });
    }
    deviceExists = false;
  }

  if (deviceExists) {
    logger.info({ device_id: deviceId }, 'Dispositivo já existe');
    await updateDevice(deviceId, buildDevicePatches(devicePayload));

    for (const property of properties) {
      await updateProperty(deviceId, property.name, property.value, property.name);
    }
    logger.info({ device_id: deviceId, count: properties.length }, 'Propriedades atualizadas para o dispositivo');
  } else {
    await createDevice(devicePayload);
  }

  await processCapabilities(devicePayload);
  logger.info({ device_id: deviceId }, 'Discovery do dispositivo processado com sucesso');
  return { action: 'synchronized', deviceId };
}

async function createDevice(devicePayload) {
  validateDeviceId(devicePayload?.device_id);
  const deviceId = devicePayload.device_id;
  const platform = devicePayload.platform || getPlatformFromDeviceId(deviceId);
  const newDevice = mapPayloadToCreate(devicePayload, platform);

  if (!devicePayload.platform) {
    logger.warn({ device_id: deviceId, platform }, 'Plataforma não especificada para o dispositivo');
  }

  try {
    const response = await http.post('devices', newDevice);
    logger.info({ device_id: deviceId, status: response.status }, 'Dispositivo criado com sucesso');
    return response;
  } catch (error) {
    throw toInfrastructureError(error, 'Erro ao criar dispositivo', { deviceId });
  }
}

function mapPayloadToCreate(devicePayload, platform) {
  validateDeviceId(devicePayload?.device_id);
  const currentDate = getCurrentFormattedDate();
  const properties = (devicePayload.properties || []).map((property) => ({
    name: property.name,
    description: property.name,
    value: property.value,
  }));

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
    properties,
    power_on: currentDate,
  };
}

function buildDevicePatches(devicePayload) {
  const patches = [];
  if (devicePayload.mac_address) {
    patches.push(createPatch('mac_address', devicePayload.mac_address));
  }
  patches.push(createPatch('ip_address', devicePayload.ip_address));
  patches.push(createPatch('power_on', getCurrentFormattedDate()));
  return patches;
}

function createPatch(name, value) {
  return { op: 'replace', path: name, value };
}

async function updateDevice(deviceId, patches) {
  validateDeviceId(deviceId);
  try {
    const response = await http.patch(`devices/${encodeURIComponent(deviceId)}`, patches);
    logger.info({ device_id: deviceId, status: response.status }, 'Dispositivo atualizado com sucesso');
    return response;
  } catch (error) {
    throw toInfrastructureError(error, 'Erro ao atualizar dispositivo', { deviceId });
  }
}

async function updateProperty(deviceId, propertyName, value, description) {
  validateDeviceId(deviceId);
  if (typeof propertyName !== 'string' || propertyName.trim() === '') {
    throw new ValidationError('property_name deve ser uma string não vazia', { deviceId });
  }

  const payload = {
    name: propertyName,
    description: description || propertyName,
    value,
  };

  try {
    const response = await http.put(`devices/${encodeURIComponent(deviceId)}/properties`, payload);
    logger.info({ device_id: deviceId, property_name: propertyName, status: response.status }, 'Propriedade atualizada com sucesso');
    return response;
  } catch (error) {
    throw toInfrastructureError(error, 'Erro ao atualizar propriedade', { deviceId, propertyName });
  }
}

function validateDeviceId(deviceId) {
  if (typeof deviceId !== 'string' || deviceId.trim() === '') {
    throw new ValidationError('device_id deve ser uma string não vazia');
  }
}

module.exports = {
  processDiscoveryDevice,
  createDevice,
  updateDevice,
  updateProperty,
  createPatch,
  mapPayloadToCreate,
};
