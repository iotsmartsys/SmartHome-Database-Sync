const http = require('../utils/http');

async function updateCapability(capabilityName, newValue, payload = {}) {
  const patchData = { capability_name: capabilityName, value: newValue };
  try {
    const url = 'capabilities';
    console.info(`Atualizando capability '${capabilityName}' com valor: ${newValue}`);
    console.info(`PATCH: ${http.defaults.baseURL}${url} Payload: ${JSON.stringify(patchData)}`);
    const patchResponse = await http.patch(url, patchData);
    console.info(`Atualizado via PATCH na API: ${capabilityName}`, patchResponse.data);
  } catch (err) {
    const status = err?.response?.status;
    if (status === 404) {
      console.warn(`Capability '${capabilityName}' não encontrada (404). Tentando criar...`);
      const owner_id = payload?.device_id;
      const type = payload?.type;
      if (!owner_id || !type) {
        console.error(
          `Não foi possível criar a capability '${capabilityName}': device_id ou type ausente no payload.`,
          JSON.stringify({ owner_id, type })
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

    console.error(
      `Erro ao atualizar capability '${capabilityName}':`,
      err.message,
      err.response ? err.response.data : ''
    );
  }
}

async function processCapabilities(devicePayload) {
  const capabilities = devicePayload.capabilities || [];
  for (const capability of capabilities) {
    const capabilityName = capability.capability_name;
    const newValue = capability.value;

    if (!capabilityName || newValue === undefined) continue;

    try {
      const url = `capabilities/${capabilityName}`;
      console.info(`Verificando existência da capability '${capabilityName}'...`);
      console.info(`GET: ${http.defaults.baseURL}${url} Payload de verificação: ${JSON.stringify(devicePayload)}`);
      await http.get(url);
      console.log(`Capability '${capabilityName}' já existe.`);
    } catch (err) {
      if (err.response && err.response.status === 404) {
        console.log(`Capability '${capabilityName}' não existe. Criando...`);
        await createCapability(devicePayload.device_id, capability);
      } else {
        console.error('Erro ao verificar existência do capability:', err.message, err.response ? err.response.data : '');
      }
    }
  }
}

async function createCapability(owner_id, capability) {
  if (!capability || !capability.capability_name || !capability.type) {
    console.error('Dados inválidos para criação da capability:', capability);
    return;
  }
  const newCapability = {
    capability_name: capability.capability_name,
    description: capability.description || capability.capability_name,
    owner: owner_id,
    type: capability.type,
    value: capability.value || '',
  };
  const capabilities = [newCapability];
  try {
    const json = JSON.stringify(capabilities, null, 2);
    console.log('Payload de criação da capability:', json);
    const response = await http.post(`devices/${owner_id}/capabilities`, capabilities);
    console.log('Capability criada com sucesso:', response.data);
  } catch (postErr) {
    console.error('Erro ao criar capability:', postErr.message, postErr.response ? postErr.response.data : '');
  }
}

module.exports = {
  updateCapability,
  processCapabilities,
};
