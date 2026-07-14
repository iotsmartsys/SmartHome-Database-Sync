const { createPatch, buildPropertyUpdate } = require('../domain/device-mapper');
const { ValidationError } = require('../utils/errors');
const { validateDeviceId } = require('./validation');

function createProcessPropertyUpdate({ deviceApi, logger }) {
  return async function processPropertyUpdate({ deviceId, propertyName, value, description }) {
    validateDeviceId(deviceId);
    if (typeof propertyName !== 'string' || propertyName.trim() === '') {
      throw new ValidationError('property_name deve ser uma string não vazia', { deviceId });
    }

    if (propertyName === 'device_state') {
      const response = await deviceApi.updateDevice(deviceId, [createPatch('state', value)]);
      logger.info(
        { device_id: deviceId, state: value, status: response.status },
        'Estado do dispositivo atualizado',
      );
      return { action: 'device_updated', deviceId };
    }

    const response = await deviceApi.upsertProperty(
      deviceId,
      buildPropertyUpdate(propertyName, value, description || propertyName),
    );
    logger.info(
      { device_id: deviceId, property_name: propertyName, status: response.status },
      'Propriedade do dispositivo atualizada',
    );
    return { action: 'property_updated', deviceId, propertyName };
  };
}

module.exports = { createProcessPropertyUpdate };
