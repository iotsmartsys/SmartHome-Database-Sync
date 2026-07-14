const { ValidationError } = require('../utils/errors');

function validateDeviceId(deviceId) {
  if (typeof deviceId !== 'string' || deviceId.trim() === '') {
    throw new ValidationError('device_id deve ser uma string não vazia');
  }
}

function validateCapability(deviceId, capabilityName, value) {
  validateDeviceId(deviceId);
  if (typeof capabilityName !== 'string' || capabilityName.trim() === '') {
    throw new ValidationError('capability_name deve ser uma string não vazia', { deviceId });
  }
  if (value === undefined) {
    throw new ValidationError('value é obrigatório para atualizar uma capability', {
      deviceId,
      capabilityName,
    });
  }
}

module.exports = { validateDeviceId, validateCapability };
