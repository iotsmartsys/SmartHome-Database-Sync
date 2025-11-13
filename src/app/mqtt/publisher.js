const { mqtt_publish_topic } = require('../utils/config');
const logger = require('../utils/logger');

function publish(client, topic, payload) {
  client.publish(topic, JSON.stringify(payload), (err) => {
    if (err) {
      logger.error(`Erro ao publicar no tópico ${topic}:`, err.message);
    } else {
      logger.info(`Mensagem publicada no tópico ${topic}`);
    }
  });
}

function publishCapabilityUpdate(client, device_id, capability_name, value) {
  const message = { device_id, capability_name, value };
  publish(client, mqtt_publish_topic, message);
}

module.exports = {
  publish,
  publishCapabilityUpdate,
};

