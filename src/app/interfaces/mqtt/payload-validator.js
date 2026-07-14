const { ValidationError } = require('../../utils/errors');

const MAX_MESSAGE_BYTES = 64 * 1024;
const MAX_IDENTIFIER_LENGTH = 128;
const MAX_COLLECTION_SIZE = 100;

function parseJsonMessage(message) {
  const raw = message.toString();
  if (Buffer.byteLength(raw, 'utf8') > MAX_MESSAGE_BYTES) {
    throw new ValidationError(`Mensagem MQTT excede o limite de ${MAX_MESSAGE_BYTES} bytes`);
  }
  try {
    return JSON.parse(raw);
  } catch {
    throw new ValidationError('Mensagem MQTT contém JSON inválido');
  }
}

function validateCapabilityPayload(payload) {
  assertObject(payload, 'payload de capability');
  assertIdentifier(payload.device_id, 'device_id');
  assertIdentifier(payload.capability_name, 'capability_name');
  assertOwnProperty(payload, 'value');
  assertOptionalIdentifier(payload.type, 'type');
  assertOptionalIdentifier(payload.owner, 'owner');
  return payload;
}

function validateDiscoveryPayload(payload) {
  assertObject(payload, 'payload de discovery');
  assertIdentifier(payload.device_id, 'device_id');

  if (payload.type === 'property') {
    assertIdentifier(payload.property_name, 'property_name');
    assertOwnProperty(payload, 'value');
    return payload;
  }

  assertOptionalIdentifier(payload.platform, 'platform');
  assertCollection(payload.properties, 'properties', validateDiscoveryProperty);
  assertCollection(payload.capabilities, 'capabilities', validateDiscoveryCapability);
  return payload;
}

function validateDiscoveryProperty(property) {
  assertObject(property, 'propriedade de discovery');
  assertIdentifier(property.name, 'properties[].name');
  assertOwnProperty(property, 'value');
}

function validateDiscoveryCapability(capability) {
  assertObject(capability, 'capability de discovery');
  assertIdentifier(capability.capability_name, 'capabilities[].capability_name');
  assertOwnProperty(capability, 'value');
  assertOptionalIdentifier(capability.type, 'capabilities[].type');
}

function assertCollection(value, name, validateItem) {
  if (value === undefined) return;
  if (!Array.isArray(value)) throw new ValidationError(`${name} deve ser uma lista`);
  if (value.length > MAX_COLLECTION_SIZE) {
    throw new ValidationError(`${name} não pode conter mais de ${MAX_COLLECTION_SIZE} itens`);
  }
  value.forEach(validateItem);
}

function assertObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ValidationError(`${name} deve ser um objeto`);
  }
}

function assertIdentifier(value, name) {
  if (typeof value !== 'string' || value.trim() === '' || value.length > MAX_IDENTIFIER_LENGTH) {
    throw new ValidationError(
      `${name} deve ser uma string não vazia de até ${MAX_IDENTIFIER_LENGTH} caracteres`,
    );
  }
}

function assertOptionalIdentifier(value, name) {
  if (value === undefined || value === '') return;
  assertIdentifier(value, name);
}

function assertOwnProperty(object, name) {
  if (!Object.hasOwn(object, name)) throw new ValidationError(`${name} é obrigatório`);
}

module.exports = {
  parseJsonMessage,
  validateCapabilityPayload,
  validateDiscoveryPayload,
  MAX_MESSAGE_BYTES,
};
