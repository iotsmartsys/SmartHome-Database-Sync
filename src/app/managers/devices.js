const http = require('../utils/http');
const { getCurrentFormatedDate } = require('../utils/date');
const { getPlatformFromDeviceId } = require('../utils/platform');
const { processCapabilities } = require('./capabilities');
const logger = require('../utils/logger');

async function processDiscoveryDevice(devicePayload) {
  logger.info(`Verificando existência do dispositivo com device_id: ${devicePayload.device_id}`);
  const checkUrl = `devices/${devicePayload.device_id}`;
  try {
    logger.info(`Verificando URL: ${http.defaults.baseURL}${checkUrl}`);
    await http.get(checkUrl);
    logger.info(`Dispositivo '${devicePayload.device_id}' já existe.`);

    const patches = [];
    if (devicePayload.mac_address) {
      patches.push(createPatch('mac_address', devicePayload.mac_address));
    }
    patches.push(createPatch('ip_address', devicePayload.ip_address));
    patches.push(createPatch('power_on', new Date().toLocaleString('sv-SE')));
    logger.info(
      `Dados do dispositivo '${devicePayload.device_id}' a serem atualizadas:`,
      JSON.stringify(patches, null, 2)
    );
    await updateDevice(devicePayload.device_id, patches);

    logger.info(`Verificando propriedades do dispositivo '${devicePayload.device_id}'...`);
    for (const prop of devicePayload.properties) {
      await updateProperty(
        devicePayload.device_id,
        prop.name,
        prop.value,
        prop.name
      );
    }
    logger.info(`${devicePayload.properties.length} propriedades atualizadas para o dispositivo '${devicePayload.device_id}'.`);


    logger.info(`Atualização do dispositivo '${devicePayload.device_id}' processada com sucesso.`);
  } catch (err) {
    if (err.response && err.response.status === 404) {
      await createDevice(devicePayload);
    } else {
      logger.error(
        'Erro ao verificar existência do dispositivo:',
        err.message,
        err.response ? err.response.data : ''
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

  logger.info('Payload de criação do dispositivo:', JSON.stringify(newDevice, null, 2));
  try {
    const response = await http.post('devices', newDevice);
    logger.info('Dispositivo criado com sucesso:', response.data);
  } catch (postErr) {
    logger.error('Erro ao criar dispositivo:', postErr.message, postErr.response ? postErr.response.data : '');
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
  logger.info(`Payload de atualização do dispositivo ${device_id}:`, JSON.stringify(properties, null, 2));
  try {
    const response = await http.patch(`devices/${device_id}`, properties);
    logger.info('Dispositivo atualizado com sucesso:', response.data);
  } catch (err) {
    logger.error('Erro ao atualizar dispositivo:', err.message, err.response ? err.response.data : '');
  }
}

async function updateProperty(device_id, property_name, value, description) {
  const updatePayload = {
    name: property_name,
    description: description || property_name,
    value: value,
  };

  logger.info(`Payload de atualização das properties do device_id ${device_id}:`, JSON.stringify(updatePayload, null, 2));

  try {
    const response = await http.put(`devices/${device_id}/properties`, updatePayload);
    logger.info('Propriedade atualizada com sucesso:', response.data);
  } catch (err) {
    logger.error('Erro ao atualizar propriedade:', err.message, err.response ? err.response.data : '');
  }
}

module.exports = {
  processDiscoveryDevice,
  createDevice,
  updateDevice,
  updateProperty,
  createPatch,
};

