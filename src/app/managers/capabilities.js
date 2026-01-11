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
  } catch (err) {
    const status = err?.response?.status;
    if (status === 404) {
      logger.warn({ capabilityName }, 'Capability não encontrada (404). Tentando criar');
      const owner_id = payload?.device_id;
      const type = payload?.type;
      if (!owner_id || !type) {
        logger.error(
          { capabilityName, owner_id, type },
          'Não foi possível criar a capability: device_id ou type ausente no payload'
        );
        return;
      }

      const capabilityToCreate = {
        capability_name: capabilityName,
        description: capabilityName,
        type,
        value: newValue,
      };
      await createCapability(owner_id, capabilityToCreate);
      return;
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

async function createCapability(owner_id, capability) {
  if (!capability || !capability.capability_name || !capability.type) {
    logger.error({ owner_id, capability }, 'Dados inválidos para criação da capability');
    return;
  }
  const newCapability = {
    capability_name: capability.capability_name,
    description: capability.description || capability.capability_name,
    owner: owner_id,
    device_id: owner_id,
    type: capability.type,
    value: capability.value || '',
  };
  const capabilities = [newCapability];
  try {
    logger.info(
      { owner_id, capabilityName: capability.capability_name, type: capability.type },
      'Criando capability'
    );
    logger.debug({ owner_id, capabilities }, 'Payload de criação da capability');
    const response = await http.post(`devices/${owner_id}/capabilities`, capabilities);
    logger.info(
      { owner_id, capabilityName: capability.capability_name, status: response.status, response: response.data },
      'Capability criada com sucesso'
    );
  } catch (postErr) {
    logger.error(
      {
        owner_id,
        capabilityName: capability.capability_name,
        message: postErr.message,
        response: postErr.response ? postErr.response.data : undefined,
        err: postErr,
      },
      'Erro ao criar capability'
    );
  }
}

module.exports = {
  updateCapability,
  processCapabilities,
};
