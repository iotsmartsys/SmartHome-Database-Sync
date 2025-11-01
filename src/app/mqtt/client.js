const mqtt = require('mqtt');
const {
  host_name_mqtt,
  mqtt_user_name,
  mqtt_password,
  mqtt_client_id,
} = require('../utils/config');

function createClient() {
  const mqttOptions = {
    host: host_name_mqtt,
    port: 1883,
    username: mqtt_user_name,
    password: mqtt_password,
    clientId: mqtt_client_id,
  };

  const client = mqtt.connect(mqttOptions);

  client.on('connect', () => {
    console.log('Conectado ao MQTT com autenticação');
  });
  client.on('error', (err) => {
    console.error('Erro no cliente MQTT:', err);
  });
  client.on('offline', () => {
    console.log('Cliente MQTT está offline');
  });
  client.on('reconnect', () => {
    console.log('Cliente MQTT está tentando reconectar');
  });

  return client;
}

module.exports = { createClient };

