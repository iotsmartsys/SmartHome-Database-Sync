const assert = require('node:assert/strict');
const test = require('node:test');

const { createConfig, validateConfig } = require('../../src/app/utils/config');

function validEnvironment(overrides = {}) {
  return {
    MQTT_HOST: 'broker.local',
    MQTT_PORT: '8883',
    MQTT_PROTOCOL: 'mqtts',
    MQTT_USER_NAME: 'service',
    MQTT_PASSWORD: 'secret',
    API_URL: 'https://api.example.com',
    ...overrides,
  };
}

test('configuração é normalizada, validada e imutável', () => {
  const config = createConfig(validEnvironment());

  assert.equal(config.host_port_mqtt, 8883);
  assert.equal(config.mqtt_topic, 'device/state');
  assert.equal(validateConfig(config), config);
  assert.equal(Object.isFrozen(config), true);
});

test('configuração acumula erros e falha antes da inicialização', () => {
  const config = createConfig({
    MQTT_PORT: 'invalid',
    MQTT_PROTOCOL: 'tcp',
    API_URL: 'ftp://api.example.com',
  });

  assert.throws(
    () => validateConfig(config),
    (error) => {
      assert.match(error.message, /MQTT_HOST é obrigatório/);
      assert.match(error.message, /MQTT_PORT deve ser um número inteiro/);
      assert.match(error.message, /MQTT_PROTOCOL deve ser um de/);
      assert.match(error.message, /API_URL deve ser uma URL HTTP ou HTTPS válida/);
      return true;
    }
  );
});

test('usuário e senha MQTT devem ser fornecidos juntos', () => {
  const config = createConfig(validEnvironment({ MQTT_PASSWORD: undefined }));

  assert.throws(
    () => validateConfig(config),
    /MQTT_USER_NAME e MQTT_PASSWORD devem ser informados juntos/
  );
});

test('credenciais MQTT são opcionais quando ambas estão ausentes', () => {
  const config = createConfig(
    validEnvironment({ MQTT_USER_NAME: undefined, MQTT_PASSWORD: undefined })
  );

  assert.doesNotThrow(() => validateConfig(config));
});
