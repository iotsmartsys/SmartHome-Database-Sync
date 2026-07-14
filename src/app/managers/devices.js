const { deviceApi } = require('../infrastructure/http/device-api');
const { getCurrentFormattedDate } = require('../utils/date');
const { getPlatformFromDeviceId } = require('../utils/platform');
const { processCapabilities } = require('./capabilities');
const { ValidationError, isNotFoundError } = require('../utils/errors');
const logger = require('../utils/logger');
const {
  mapDiscoveryToDevice,
  buildDevicePatches,
  buildPropertyUpdate,
} = require('../domain/device-mapper');

async function processDiscoveryDevice(devicePayload) {
  validateDeviceId(devicePayload?.device_id);
  const deviceId = devicePayload.device_id;
  const properties = devicePayload.properties || [];

  let deviceExists = true;
  try {
    await deviceApi.getDevice(deviceId);
  } catch (error) {
    if (!isNotFoundError(error)) {
      throw error;
    }
    deviceExists = false;
  }

  if (deviceExists) {
    logger.info({ device_id: deviceId }, 'Dispositivo já existe');
    await updateDevice(deviceId, buildDevicePatches(devicePayload, getCurrentFormattedDate()));

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

  const response = await deviceApi.createDevice(newDevice);
  logger.info({ device_id: deviceId, status: response.status }, 'Dispositivo criado com sucesso');
  return response;
}

function mapPayloadToCreate(devicePayload, platform) {
  validateDeviceId(devicePayload?.device_id);
  return mapDiscoveryToDevice(devicePayload, platform, getCurrentFormattedDate());
}

async function updateDevice(deviceId, patches) {
  validateDeviceId(deviceId);
  const response = await deviceApi.updateDevice(deviceId, patches);
  logger.info({ device_id: deviceId, status: response.status }, 'Dispositivo atualizado com sucesso');
  return response;
}

async function updateProperty(deviceId, propertyName, value, description) {
  validateDeviceId(deviceId);
  if (typeof propertyName !== 'string' || propertyName.trim() === '') {
    throw new ValidationError('property_name deve ser uma string não vazia', { deviceId });
  }

  const payload = buildPropertyUpdate(propertyName, value, description || propertyName);

  const response = await deviceApi.upsertProperty(deviceId, payload);
  logger.info({ device_id: deviceId, property_name: propertyName, status: response.status }, 'Propriedade atualizada com sucesso');
  return response;
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
  mapPayloadToCreate,
};
