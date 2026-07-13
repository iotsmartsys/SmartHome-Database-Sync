const http = require('../utils/http');
const logger = require('../utils/logger');
const { getCurrentFormattedDate } = require('../utils/date');

async function updateCapability(capabilityName, newValue, payload = {}) {
  const deviceId = payload?.device_id;
  if (!isValidDeviceId(deviceId)) {
    logger.error({ capabilityName }, 'Não foi possível atualizar a capability: device_id ausente');
    return { action: 'update_skipped' };
  }
  const patchData = { capability_name: capabilityName, value: newValue };
  try {
    const url = `devices/${encodeURIComponent(deviceId)}/capabilities/value`;
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
      const owner = payload?.owner || deviceId;
      const type = payload?.type;
      if (!type) {
        logger.error(
          { capabilityName, owner_id: deviceId, type },
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
      const createResult = await createCapability(deviceId, capabilityToCreate);
      if (createResult?.ok) {
        return { action: 'created' };
      }

      if (
        createResult?.status === 404 &&
        isZigbeeDeviceId(deviceId) &&
        isDeviceNotFoundResponse(createResult?.response)
      ) {
        const discoveryPayload = buildZigbeeDiscoveryPayload(deviceId);
        logger.warn(
          { device_id: deviceId, capabilityName, discoveryPayload },
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
  const deviceId = devicePayload?.device_id;
  if (!isValidDeviceId(deviceId)) {
    logger.error('Não foi possível processar capabilities: device_id ausente');
    return;
  }
  const capabilities = devicePayload.capabilities || [];
  logger.info(
    { device_id: devicePayload.device_id, count: capabilities.length },
    'Processando capabilities do device'
  );
  for (const capability of capabilities) {
    const capabilityName = capability.capability_name;
    const newValue = capability.value;
    if (!capabilityName || newValue === undefined)
      continue;

    try {
      const url = `devices/${encodeURIComponent(deviceId)}/capabilities/${encodeURIComponent(capabilityName)}`;
      logger.debug(
        { capabilityName, url, baseURL: http.defaults.baseURL, device_id: deviceId },
        'Verificando existência da capability'
      );
      await http.get(url);
      logger.info({ capabilityName, device_id: deviceId }, 'Capability já existe');
    } catch (err) {
      if (err.response && err.response.status === 404) {
        logger.info({ capabilityName, device_id: deviceId }, 'Capability não existe. Criando');
        await createCapability(deviceId, capability);
      } else {
        logger.error(
          {
            capabilityName,
            device_id: deviceId,
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

async function createCapability(deviceId, capability) {
  if (!isValidDeviceId(deviceId) || !capability || !capability.capability_name || !capability.type) {
    logger.error({ device_id: deviceId, capability }, 'Dados inválidos para criação da capability');
    return { ok: false, status: null, response: 'invalid capability payload' };
  }

  const owner = capability.owner || deviceId;
  const newCapability = {
    capability_name: capability.capability_name,
    description: capability.description || capability.capability_name,
    owner,
    device_id: deviceId,
    type: capability.type,
    value: capability.value ?? '',
  };
  const capabilities = [newCapability];
  try {
    logger.info(
      { owner_id: deviceId, capabilityName: capability.capability_name, type: capability.type },
      'Criando capability'
    );
    logger.debug({ owner_id: deviceId, capabilities }, 'Payload de criação da capability');
    const response = await http.post(`devices/${encodeURIComponent(deviceId)}/capabilities`, capabilities);
    logger.info(
      { owner_id: deviceId, capabilityName: capability.capability_name, status: response.status, response: response.data },
      'Capability criada com sucesso'
    );
    return { ok: true, status: response.status, response: response.data };
  } catch (postErr) {
    logger.error(
      {
        owner_id: deviceId,
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

function isZigbeeDeviceId(deviceId = '') {
  return /^zigbee-/i.test(deviceId);
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
  if (!hex) return '';
  const pairs = hex.match(/.{1,2}/g) || [];
  return pairs.join(':');
}

function isValidDeviceId(deviceId) {
  return typeof deviceId === 'string' && deviceId.trim() !== '';
}

module.exports = {
  updateCapability,
  processCapabilities,
  createCapability,
  buildZigbeeDiscoveryPayload,
};
