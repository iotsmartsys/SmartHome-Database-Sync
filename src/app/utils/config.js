const ALLOWED_MQTT_PROTOCOLS = new Set(['mqtt', 'mqtts', 'ws', 'wss']);

function parsePort(value) {
  if (value === undefined || value === '') return 1883;
  return Number(value);
}

function createConfig(env = process.env) {
  return Object.freeze({
    host_name_mqtt: env.MQTT_HOST,
    host_port_mqtt: parsePort(env.MQTT_PORT),
    mqtt_protocol: env.MQTT_PROTOCOL || 'mqtt',
    mqtt_user_name: env.MQTT_USER_NAME,
    mqtt_password: env.MQTT_PASSWORD,
    mqtt_client_id: env.MQTT_CLIENT_ID || 'database_sync_local-client',
    mqtt_topic: env.MQTT_TOPIC || 'device/state',
    mqtt_publish_topic: env.MQTT_PUBLISH_TOPIC || 'device/updated',
    mqtt_topic_discovery: env.MQTT_TOPIC_SMARTHOME_DISCOVERY || 'smarthome/discovery',
    mqtt_topic_metrics: env.MQTT_TOPIC_METRICS || 'device/metrics',
    api_url: env.API_URL,
    api_key: env.API_KEY || '',
    api_authorization: env.API_AUTHORIZATION || '',
    log_level: env.LOG_LEVEL || 'info',
    service_name: env.MQTT_CLIENT_ID || 'smart-home-database-sync',
    environment: env.NODE_ENV || env.ENV || 'development',
  });
}

function validateConfig(config) {
  const errors = [];

  if (!isNonEmptyString(config.host_name_mqtt)) {
    errors.push('MQTT_HOST é obrigatório');
  }
  if (
    !Number.isInteger(config.host_port_mqtt) ||
    config.host_port_mqtt < 1 ||
    config.host_port_mqtt > 65535
  ) {
    errors.push('MQTT_PORT deve ser um número inteiro entre 1 e 65535');
  }
  if (!ALLOWED_MQTT_PROTOCOLS.has(config.mqtt_protocol)) {
    errors.push(`MQTT_PROTOCOL deve ser um de: ${[...ALLOWED_MQTT_PROTOCOLS].join(', ')}`);
  }
  if (!isHttpUrl(config.api_url)) {
    errors.push('API_URL deve ser uma URL HTTP ou HTTPS válida');
  }

  for (const [name, value] of [
    ['MQTT_TOPIC', config.mqtt_topic],
    ['MQTT_PUBLISH_TOPIC', config.mqtt_publish_topic],
    ['MQTT_TOPIC_SMARTHOME_DISCOVERY', config.mqtt_topic_discovery],
    ['MQTT_TOPIC_METRICS', config.mqtt_topic_metrics],
    ['MQTT_CLIENT_ID', config.mqtt_client_id],
  ]) {
    if (!isNonEmptyString(value)) errors.push(`${name} não pode ser vazio`);
  }

  const hasUsername = isNonEmptyString(config.mqtt_user_name);
  const hasPassword = isNonEmptyString(config.mqtt_password);
  if (hasUsername !== hasPassword) {
    errors.push('MQTT_USER_NAME e MQTT_PASSWORD devem ser informados juntos');
  }

  if (errors.length > 0) {
    throw new Error(`Configuração inválida:\n- ${errors.join('\n- ')}`);
  }

  return config;
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim() !== '';
}

function isHttpUrl(value) {
  if (!isNonEmptyString(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

const config = createConfig();

module.exports = Object.freeze({
  ...config,
  createConfig,
  validateConfig,
});
