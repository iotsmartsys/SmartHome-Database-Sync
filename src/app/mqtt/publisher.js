const { mqtt_publish_topic } = require('../utils/config');

function publish(client, topic, payload) {
  client.publish(topic, JSON.stringify(payload), (err) => {
    if (err) {
      console.error(`Erro ao publicar no tópico ${topic}:`, err.message);
    } else {
      console.log(`Mensagem publicada no tópico ${topic}`);
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

