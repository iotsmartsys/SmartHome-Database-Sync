const { mqtt_publish_topic } = require('../utils/config');
const logger = require('../utils/logger');

function publish(client, topic, payload) {
  return new Promise((resolve, reject) => {
    client.publish(topic, JSON.stringify(payload), (err) => {
      if (err) {
        reject(err);
        return;
      }
      logger.info({ topic }, 'Mensagem publicada no tópico');
      resolve();
    });
  });
}

function publishCapabilityUpdate(client, deviceId, capabilityName, value) {
  const message = { device_id: deviceId, capability_name: capabilityName, value };
  return publish(client, mqtt_publish_topic, message);
}

module.exports = {
  publish,
  publishCapabilityUpdate,
};
