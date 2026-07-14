const defaultHttpClient = require('./http-client');
const { toInfrastructureError } = require('../../utils/errors');

function createDeviceApi(httpClient = defaultHttpClient) {
  return {
    getDevice(deviceId) {
      return request(
        () => httpClient.get(`devices/${encodeURIComponent(deviceId)}`),
        'Erro ao buscar dispositivo',
        { deviceId },
      );
    },

    createDevice(device) {
      return request(() => httpClient.post('devices', device), 'Erro ao criar dispositivo', {
        deviceId: device.device_id,
      });
    },

    updateDevice(deviceId, patches) {
      return request(
        () => httpClient.patch(`devices/${encodeURIComponent(deviceId)}`, patches),
        'Erro ao atualizar dispositivo',
        { deviceId },
      );
    },

    upsertProperty(deviceId, property) {
      return request(
        () => httpClient.put(`devices/${encodeURIComponent(deviceId)}/properties`, property),
        'Erro ao atualizar propriedade',
        { deviceId, propertyName: property.name },
      );
    },

    getCapability(deviceId, capabilityName) {
      return request(
        () =>
          httpClient.get(
            `devices/${encodeURIComponent(deviceId)}/capabilities/${encodeURIComponent(capabilityName)}`,
          ),
        'Erro ao verificar capability',
        { deviceId, capabilityName },
      );
    },

    updateCapabilityValue(deviceId, capability) {
      return request(
        () =>
          httpClient.patch(
            `devices/${encodeURIComponent(deviceId)}/capabilities/value`,
            capability,
          ),
        'Erro ao atualizar capability',
        { deviceId, capabilityName: capability.capability_name },
      );
    },

    createCapabilities(deviceId, capabilities) {
      return request(
        () => httpClient.post(`devices/${encodeURIComponent(deviceId)}/capabilities`, capabilities),
        'Erro ao criar capability',
        { deviceId, capabilityName: capabilities[0]?.capability_name },
      );
    },

    createDeviceMetrics(deviceId, metrics) {
      return request(
        () => httpClient.post(`devices/${encodeURIComponent(deviceId)}/metrics`, metrics),
        'Erro ao persistir métricas do dispositivo',
        { deviceId },
      );
    },
  };
}

async function request(operation, message, details) {
  try {
    return await operation();
  } catch (error) {
    throw toInfrastructureError(error, message, details);
  }
}

module.exports = {
  createDeviceApi,
  deviceApi: createDeviceApi(),
};
