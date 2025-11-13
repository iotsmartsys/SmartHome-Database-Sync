const mqtt = require('mqtt');
const {
  host_name_mqtt,
  host_port_mqtt,
  mqtt_protocol,
  mqtt_user_name,
  mqtt_password,
  mqtt_client_id,
} = require('../utils/config');
const logger = require('../utils/logger');

function createClient() {
  const options = {
    host: host_name_mqtt,
    port: host_port_mqtt,
    protocol: mqtt_protocol,
    username: mqtt_user_name,
    password: mqtt_password,
    clientId: mqtt_client_id,
    rejectUnauthorized: mqtt_protocol === "mqtts" // valida o certificado do servidor
  };
  logger.info("Configurações MQTT:", options);
  const client = mqtt.connect(options);

  client.on('connect', () => {
    logger.info('Conectado ao MQTT com autenticação');
  });
  client.on('error', (err) => {
    logger.error('Erro no cliente MQTT:', err);
  });
  client.on('offline', () => {
    logger.info('Cliente MQTT está offline');
  });
  client.on('reconnect', () => {
    logger.info('Cliente MQTT está tentando reconectar');
  });

  return client;
}

module.exports = { createClient };

