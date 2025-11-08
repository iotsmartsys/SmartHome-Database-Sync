const { processDiscoveryDevice, updateDevice, updateProperty, createPatch } = require('../managers/devices');
const { updateCapability } = require('../managers/capabilities');
const { mqtt_topic, mqtt_topic_discovery } = require('../utils/config');
const { publish, publishCapabilityUpdate } = require('./publisher');

function registerHandlers(client) {
  // Subscriptions
  client.subscribe(mqtt_topic, (err) => {
    if (err) {
      console.error('Erro ao subscrever ao tópico:', mqtt_topic, err.message);
    } else {
      console.log('Subscrito ao tópico:', mqtt_topic);
    }
  });

  client.subscribe(mqtt_topic_discovery, (err) => {
    if (err) {
      console.error('Erro ao subscrever ao tópico smarthome.discovery:', err.message);
    } else {
      console.log(`Subscrito ao tópico ${mqtt_topic_discovery}`);
    }
  });

  client.on('message', (topic, message) => handleMessage(client, topic, message));
}

async function handleMessage(client, topic, message) {

  switch (topic) {
    case mqtt_topic:
      console.info('Mensagem recebida no tópico principal:', message.toString());
      await handleCapabilityMessage(client, message);
      break;
    case mqtt_topic_discovery:
      console.info('Mensagem recebida no tópico de discovery:', message.toString());
      await handleDiscoveryMessage(client, message);
      break;
    default:
      console.warn('Mensagem recebida em tópico desconhecido:', topic);
      return;
  }
}

async function handleDiscoveryMessage(client, message) {
  console.info('Mensagem de discovery recebida:', message.toString());
  try {
    const devicePayload = JSON.parse(message.toString());
    if (devicePayload.type && devicePayload.type !== 'property') {
      await processPropertiesAsync(devicePayload);

    }
    await processDiscoveryDevice(devicePayload);
    console.info('Notificando a atualização com sucesso para outros consumers');
    const capabilities = devicePayload.capabilities || [];
    for (const capability of capabilities) {
      const toSend = {
        device_id: devicePayload.device_id,
        capability_name: capability.capability_name,
        value: capability.value,
      };
      publish(client, mqtt_topic, toSend);
    }
  } catch (err) {
    console.error('Erro ao processar mensagem de discovery:', err.message);
  }
}

async function processPropertiesAsync(properties) {
  for (const prop of properties) {

    switch (prop.property_name) {
      case 'device_state': {
        const device_active_date = new Date().toLocaleString('sv-SE');
        await updateDevice(prop.device_id, [createPatch('last_active', device_active_date)]);
        console.log(`Estado do dispositivo atualizado para ${device_active_date} no dispositivo ${prop.device_id}`);
        break;
      }
      default:
        await updateProperty(prop.device_id, prop.property_name, prop.value, prop.property_name);
        break;
    }
  }
}

async function handleCapabilityMessage(client, message) {
  try {
    const payload = JSON.parse(message.toString());
    const capabilityName = payload.capability_name;
    const newValue = payload.value;
    if (!capabilityName || newValue === undefined) return;

    await updateCapability(capabilityName, newValue, payload);
    publishCapabilityUpdate(client, payload.device_id, capabilityName, newValue);
    console.log(`Capability '${capabilityName}' atualizada para ${newValue} no dispositivo ${payload.device_id}`);
  } catch (err) {
    console.error('Erro ao processar mensagem MQTT:', err);
  }
}

module.exports = {
  registerHandlers,
};
