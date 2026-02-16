const http = require('../utils/http');
const logger = require('../utils/logger');

async function updateCapability(capabilityName, newValue, payload = {}) {
  const patchData = { capability_name: capabilityName, value: newValue };
  try {
    const url = 'capabilities';
    logger.info({ capabilityName, newValue }, 'Atualizando capability');
    logger.debug({ url, baseURL: http.defaults.baseURL, patchData }, 'Enviando PATCH de capability');
    const patchResponse = await http.patch(url, patchData);
    logger.info(
      { capabilityName, status: patchResponse.status, response: patchResponse.data },
      'Capability atualizada via API'
    );
    return { action: 'updated' };
  } catch (err) {
    const status = err?.response?.status;
    if (status === 404) {
      logger.warn({ capabilityName }, 'Capability não encontrada (404). Tentando criar');
      const device_id = payload?.device_id;
      const owner = payload?.owner || device_id;
      const type = payload?.type;
      if (!device_id || !type) {
        logger.error(
          { capabilityName, owner_id: device_id, type },
          'Não foi possível criar a capability: device_id ou type ausente no payload'
        );
        return { action: 'create_skipped' };
      }

      const capabilityToCreate = {
        capability_name: capabilityName,
        description: capabilityName,
        type,
        value: newValue,
        owner,
      };
      const createResult = await createCapability(device_id, capabilityToCreate);
      if (createResult?.ok) {
        return { action: 'created' };
      }

      if (
        createResult?.status === 404 &&
        isZigbeeDeviceId(device_id) &&
        isDeviceNotFoundResponse(createResult?.response)
      ) {
        const discoveryPayload = buildZigbeeDiscoveryPayload(device_id);
        logger.warn(
          { device_id, capabilityName, discoveryPayload },
          'Device Zigbee inexistente. Solicitação de discovery montada'
        );
        return { action: 'discovery_required', discoveryPayload };
      }

      return { action: 'create_failed' };
    }

    logger.error(
      {
        capabilityName,
        status,
        message: err.message,
        response: err.response ? err.response.data : undefined,
        err,
      },
      'Erro ao atualizar capability'
    );
    return { action: 'update_failed' };
  }
}

async function processCapabilities(devicePayload) {
  const capabilities = devicePayload.capabilities || [];
  logger.info(
    { device_id: devicePayload.device_id, count: capabilities.length },
    'Processando capabilities do device'
  );
  for (const capability of capabilities) {
    const capabilityName = capability.capability_name;
    const newValue = capability.value;

    if (!capabilityName || newValue === undefined) continue;

    try {
      const url = `capabilities/${capabilityName}`;
      logger.debug(
        { capabilityName, url, baseURL: http.defaults.baseURL, device_id: devicePayload.device_id },
        'Verificando existência da capability'
      );
      await http.get(url);
      logger.info({ capabilityName, device_id: devicePayload.device_id }, 'Capability já existe');
    } catch (err) {
      if (err.response && err.response.status === 404) {
        logger.info({ capabilityName, device_id: devicePayload.device_id }, 'Capability não existe. Criando');
        await createCapability(devicePayload.device_id, capability);
      } else {
        logger.error(
          {
            capabilityName,
            device_id: devicePayload.device_id,
            message: err.message,
            response: err.response ? err.response.data : undefined,
            err,
          },
          'Erro ao verificar existência da capability'
        );
      }
    }
  }
}

async function createCapability(device_id, capability) {
  if (!capability || !capability.capability_name || !capability.type) {
    logger.error({ device_id: device_id, capability }, 'Dados inválidos para criação da capability');
    return { ok: false, status: null, response: 'invalid capability payload' };
  }

  var owner = capability.owner || device_id;
  const newCapability = {
    capability_name: capability.capability_name,  
    description: capability.description || capability.capability_name,
    owner: owner,
    device_id: device_id,
    type: capability.type,
    value: capability.value || '',
  };
  const capabilities = [newCapability];
  try {
    logger.info(
      { owner_id: device_id, capabilityName: capability.capability_name, type: capability.type },
      'Criando capability'
    );
    logger.debug({ owner_id: device_id, capabilities }, 'Payload de criação da capability');
    const response = await http.post(`devices/${device_id}/capabilities`, capabilities);
    logger.info(
      { owner_id: device_id, capabilityName: capability.capability_name, status: response.status, response: response.data },
      'Capability criada com sucesso'
    );
    return { ok: true, status: response.status, response: response.data };
  } catch (postErr) {
    logger.error(
      {
        owner_id: device_id,
        capabilityName: capability.capability_name,
        message: postErr.message,
        response: postErr.response ? postErr.response.data : undefined,
        err: postErr,
      },
      'Erro ao criar capability'
    );
    return {
      ok: false,
      status: postErr?.response?.status || null,
      response: postErr?.response?.data,
    };
  }
}

function isZigbeeDeviceId(device_id = '') {
  return /^zigbee-/i.test(device_id);
}

function isDeviceNotFoundResponse(response) {
  if (typeof response === 'string') {
    return /not found/i.test(response);
  }
  if (response && typeof response === 'object') {
    return /not found/i.test(JSON.stringify(response));
  }
  return false;
}

function buildZigbeeDiscoveryPayload(device_id) {
  return {
    device_id,
    device_name: device_id,
    description: device_id,
    last_active: getFormattedNow(),
    state: 'online',
    mac_address: normalizeMacAddress(device_id.replace(/^zigbee-/i, '')),
    ip_address: 'Zigbee',
    protocol: 'Zigbee',
    platform: 'Zigbee',
    capabilities: [],
    properties: [],
  };
}

function normalizeMacAddress(rawValue = '') {
  const hex = rawValue.replace(/[^a-fA-F0-9]/g, '').toUpperCase();
  if (!hex) return '';
  const pairs = hex.match(/.{1,2}/g) || [];
  return pairs.join(':');
}

function getFormattedNow() {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
}

module.exports = {
  updateCapability,
  processCapabilities,
};
