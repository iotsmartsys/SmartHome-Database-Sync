const http = require('../utils/http');
const { getCurrentFormattedDate } = require('../utils/date');
const { getPlatformFromDeviceId } = require('../utils/platform');
const { processCapabilities } = require('./capabilities');
const logger = require('../utils/logger');

async function processDiscoveryDevice(devicePayload) {
  validateDeviceId(devicePayload?.device_id);
  const deviceId = devicePayload.device_id;
  const properties = devicePayload.properties || [];
  logger.info({ device_id: devicePayload.device_id }, 'Verificando existência do dispositivo');
  const checkUrl = `devices/${encodeURIComponent(deviceId)}`;
  try {
    logger.debug({ url: checkUrl, baseURL: http.defaults.baseURL }, 'Verificando URL do dispositivo');
    await http.get(checkUrl);
    logger.info({ device_id: devicePayload.device_id }, 'Dispositivo já existe');

    const patches = [];
    if (devicePayload.mac_address) {
      patches.push(createPatch('mac_address', devicePayload.mac_address));
    }
    patches.push(createPatch('ip_address', devicePayload.ip_address));
    patches.push(createPatch('power_on', getCurrentFormattedDate()));
    logger.debug(
      { device_id: devicePayload.device_id, patches },
      'Patches do dispositivo a serem atualizados'
    );
    await updateDevice(deviceId, patches);

    logger.info({ device_id: devicePayload.device_id }, 'Verificando propriedades do dispositivo');
    for (const prop of properties) {
      await updateProperty(
        deviceId,
        prop.name,
        prop.value,
        prop.name
      );
    }
    logger.info(
      { device_id: deviceId, count: properties.length },
      'Propriedades atualizadas para o dispositivo'
    );


    logger.info({ device_id: devicePayload.device_id }, 'Atualizacao do dispositivo processada com sucesso');
  } catch (err) {
    if (err.response && err.response.status === 404) {
      await createDevice(devicePayload);
    } else {
      logger.error(
        {
          device_id: devicePayload.device_id,
          url: checkUrl,
          status: err?.response?.status,
          response: err?.response?.data,
          err,
        },
        'Erro ao verificar existência do dispositivo'
      );
    }
  }

  await processCapabilities(devicePayload);
}

async function createDevice(devicePayload) {
  let platform = devicePayload.platform;
  if (!platform) {
    logger.warn(
      `Plataforma não especificada para o dispositivo ${devicePayload.device_id}. Tentando determinar a partir do device_id.`
    );
    platform = getPlatformFromDeviceId(devicePayload.device_id);
  }

  const newDevice = mapPayloadToCreate(devicePayload, platform);

  logger.debug({ device_id: devicePayload.device_id, payload: newDevice }, 'Payload de criação do dispositivo');
  try {
    const response = await http.post('devices', newDevice);
    logger.info(
      { device_id: devicePayload.device_id, status: response.status, response: response.data },
      'Dispositivo criado com sucesso'
    );
  } catch (postErr) {
    logger.error(
      {
        device_id: devicePayload.device_id,
        status: postErr?.response?.status,
        response: postErr?.response?.data,
        err: postErr,
      },
      'Erro ao criar dispositivo'
    );
  }
}

function mapPayloadToCreate(devicePayload, platform) {
  validateDeviceId(devicePayload?.device_id);
  const currentDate = getCurrentFormattedDate();
  const macAddress = devicePayload.mac_address || '00:00:00:00:00:00';
  const properties = [];
  for (const prop of devicePayload.properties || []) {
    properties.push({
      name: prop.name,
      description: prop.name,
      value: prop.value,
    });
  }
  return {
    device_id: devicePayload.device_id,
    device_name: devicePayload.device_id,
    description: devicePayload.device_id,
    last_active: currentDate,
    state: 'Active',
    mac_address: macAddress,
    ip_address: devicePayload.ip_address,
    protocol: 'MQTT',
    platform: platform,
    capabilities: [],
    properties: properties,
    power_on: currentDate,
  };
}

function createPatch(name, value) {
  return { op: 'replace', path: name, value };
}

async function updateDevice(deviceId, properties) {
  validateDeviceId(deviceId);
  logger.debug({ device_id: deviceId, patches: properties }, 'Payload de atualizacao do dispositivo');
  try {
    const response = await http.patch(`devices/${encodeURIComponent(deviceId)}`, properties);
    logger.info(
      { device_id: deviceId, status: response.status, response: response.data },
      'Dispositivo atualizado com sucesso'
    );
  } catch (err) {
    logger.error(
      {
        device_id: deviceId,
        status: err?.response?.status,
        response: err?.response?.data,
        err,
      },
      'Erro ao atualizar dispositivo'
    );
  }
}

async function updateProperty(deviceId, propertyName, value, description) {
  validateDeviceId(deviceId);
  const updatePayload = {
    name: propertyName,
    description: description || propertyName,
    value,
  };

  logger.debug(
    { device_id: deviceId, property_name: propertyName, value, description, payload: updatePayload },
    'Payload de atualizacao da propriedade'
  );

  try {
    const response = await http.put(`devices/${encodeURIComponent(deviceId)}/properties`, updatePayload);
    logger.info(
      { device_id: deviceId, property_name: propertyName, status: response.status, response: response.data },
      'Propriedade atualizada com sucesso'
    );
  } catch (err) {
    logger.error(
      {
        device_id: deviceId,
        property_name: propertyName,
        status: err?.response?.status,
        response: err?.response?.data,
        err,
      },
      'Erro ao atualizar propriedade'
    );
  }
}

function validateDeviceId(deviceId) {
  if (typeof deviceId !== 'string' || deviceId.trim() === '') {
    throw new TypeError('device_id deve ser uma string não vazia');
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
