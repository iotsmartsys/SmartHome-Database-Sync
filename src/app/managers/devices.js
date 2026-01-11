const http = require('../utils/http');
const { getCurrentFormatedDate } = require('../utils/date');
const { getPlatformFromDeviceId } = require('../utils/platform');
const { processCapabilities } = require('./capabilities');
const logger = require('../utils/logger');

async function processDiscoveryDevice(devicePayload) {
  logger.info({ device_id: devicePayload.device_id }, 'Verificando existência do dispositivo');
  const checkUrl = `devices/${devicePayload.device_id}`;
  try {
    logger.debug({ url: checkUrl, baseURL: http.defaults.baseURL }, 'Verificando URL do dispositivo');
    await http.get(checkUrl);
    logger.info({ device_id: devicePayload.device_id }, 'Dispositivo já existe');

    const patches = [];
    if (devicePayload.mac_address) {
      patches.push(createPatch('mac_address', devicePayload.mac_address));
    }
    patches.push(createPatch('ip_address', devicePayload.ip_address));
    patches.push(createPatch('power_on', new Date().toLocaleString('sv-SE')));
    logger.debug(
      { device_id: devicePayload.device_id, patches },
      'Patches do dispositivo a serem atualizados'
    );
    await updateDevice(devicePayload.device_id, patches);

    logger.info({ device_id: devicePayload.device_id }, 'Verificando propriedades do dispositivo');
    for (const prop of devicePayload.properties) {
      await updateProperty(
        devicePayload.device_id,
        prop.name,
        prop.value,
        prop.name
      );
    }
    logger.info(
      { device_id: devicePayload.device_id, count: devicePayload.properties.length },
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
  const current_date = getCurrentFormatedDate();
  const mac_address = devicePayload.mac_address || '00:00:00:00:00:00';
  const properties = [];
  for (const prop in devicePayload.properties) {
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
    last_active: current_date,
    state: 'Active',
    mac_address: mac_address,
    ip_address: devicePayload.ip_address,
    protocol: 'MQTT',
    platform: platform,
    capabilities: [],
    properties: properties,
    power_on: current_date,
  };
}

function createPatch(name, value) {
  return { op: 'replace', path: name, value };
}

async function updateDevice(device_id, properties) {
  logger.debug({ device_id, patches: properties }, 'Payload de atualizacao do dispositivo');
  try {
    const response = await http.patch(`devices/${device_id}`, properties);
    logger.info(
      { device_id, status: response.status, response: response.data },
      'Dispositivo atualizado com sucesso'
    );
  } catch (err) {
    logger.error(
      {
        device_id,
        status: err?.response?.status,
        response: err?.response?.data,
        err,
      },
      'Erro ao atualizar dispositivo'
    );
  }
}

async function updateProperty(device_id, property_name, value, description) {
  const updatePayload = {
    name: property_name,
    description: description || property_name,
    value: value,
  };

  logger.debug(
    { device_id, property_name, value, description, payload: updatePayload },
    'Payload de atualizacao da propriedade'
  );

  try {
    const response = await http.put(`devices/${device_id}/properties`, updatePayload);
    logger.info(
      { device_id, property_name, status: response.status, response: response.data },
      'Propriedade atualizada com sucesso'
    );
  } catch (err) {
    logger.error(
      {
        device_id,
        property_name,
        status: err?.response?.status,
        response: err?.response?.data,
        err,
      },
      'Erro ao atualizar propriedade'
    );
  }
}

module.exports = {
  processDiscoveryDevice,
  createDevice,
  updateDevice,
  updateProperty,
  createPatch,
};
