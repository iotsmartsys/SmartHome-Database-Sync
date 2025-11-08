const http = require('../utils/http');
const { getCurrentFormatedDate } = require('../utils/date');
const { getPlatformFromDeviceId } = require('../utils/platform');
const { processCapabilities } = require('./capabilities');

async function processDiscoveryDevice(devicePayload) {
  console.info(`Verificando existência do dispositivo com device_id: ${devicePayload.device_id}`);
  const checkUrl = `devices/${devicePayload.device_id}`;
  try {
    console.info(`Verificando URL: ${http.defaults.baseURL}${checkUrl}`);
    await http.get(checkUrl);
    console.info(`Dispositivo '${devicePayload.device_id}' já existe.`);

    const patches = [];
    if (devicePayload.mac_address) {
      patches.push(createPatch('mac_address', devicePayload.mac_address));
    }
    patches.push(createPatch('ip_address', devicePayload.ip_address));
    patches.push(createPatch('power_on', new Date().toLocaleString('sv-SE')));
    console.info(
      `Propriedades do dispositivo '${devicePayload.device_id}' a serem atualizadas:`,
      JSON.stringify(patches, null, 2)
    );
    await updateDevice(devicePayload.device_id, patches);
    console.info(`Dispositivo '${devicePayload.device_id}' atualizado com sucesso.`);

    for (const prop in devicePayload.properties) {
      await updateProperty(
      devicePayload.device_id,
        prop.property_name,
        prop.value,
        prop.property_name 
      );
    }
    

    console.info(`Dispositivo '${devicePayload.device_id}' atualizado com sucesso.`);
  } catch (err) {
    if (err.response && err.response.status === 404) {
      await createDevice(devicePayload);
    } else {
      console.error(
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
    console.warn(
      `Plataforma não especificada para o dispositivo ${devicePayload.device_id}. Tentando determinar a partir do device_id.`
    );
    platform = getPlatformFromDeviceId(devicePayload.device_id);
  }

  const newDevice = mapPayloadToCreate(devicePayload, platform);

  console.info('Payload de criação do dispositivo:', JSON.stringify(newDevice, null, 2));
  try {
    const response = await http.post('devices', newDevice);
    console.info('Dispositivo criado com sucesso:', response.data);
  } catch (postErr) {
    console.error('Erro ao criar dispositivo:', postErr.message, postErr.response ? postErr.response.data : '');
  }
}

function mapPayloadToCreate(devicePayload, platform) {
  const current_date = getCurrentFormatedDate();
  const mac_address = devicePayload.mac_address || '00:00:00:00:00:00';
  const properties = [];
  for (const prop in devicePayload.properties) {
    properties.push({
      name: prop.property_name,
      description: prop.property_name,
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
  console.info(`Payload de atualização do dispositivo ${device_id}:`, JSON.stringify(properties, null, 2));
  try {
    const response = await http.patch(`devices/${device_id}`, properties);
    console.info('Dispositivo atualizado com sucesso:', response.data);
  } catch (err) {
    console.error('Erro ao atualizar dispositivo:', err.message, err.response ? err.response.data : '');
  }
}

async function updateProperty(device_id, property_name, value, description) {
  const updatePayload = {
    name: property_name,
    description: description || property_name,
    value: value,
  };

  console.info(`Payload de atualização do dispositivo ${device_id}:`, JSON.stringify(updatePayload, null, 2));

  try {
    const response = await http.put(`devices/${device_id}/properties`, updatePayload);
    console.info('Dispositivo atualizado com sucesso:', response.data);
  } catch (err) {
    console.error('Erro ao atualizar dispositivo:', err.message, err.response ? err.response.data : '');
  }
}

module.exports = {
  processDiscoveryDevice,
  createDevice,
  updateDevice,
  updateProperty,
  createPatch,
};

