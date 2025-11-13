const { processDiscoveryDevice, updateDevice, updateProperty, createPatch } = require('../managers/devices');
const { updateCapability } = require('../managers/capabilities');
const { mqtt_topic, mqtt_topic_discovery } = require('../utils/config');
const { publish, publishCapabilityUpdate } = require('./publisher');
const correlation = require('../utils/correlation');
const logger = require('../utils/logger');

function registerHandlers(client) {
  // Subscriptions
  client.subscribe(mqtt_topic, (err) => {
    if (err) {
      logger.error('Erro ao subscrever ao tópico:', mqtt_topic, err.message);
    } else {
      logger.info('Subscrito ao tópico:', mqtt_topic);
    }
  });

  client.subscribe(mqtt_topic_discovery, (err) => {
    if (err) {
      logger.error('Erro ao subscrever ao tópico smarthome.discovery:', err.message);
    } else {
      logger.info(`Subscrito ao tópico ${mqtt_topic_discovery}`);
    }
  });

  client.on('message', (topic, message) => {
    const id = correlation.generateId();
    // run handler inside AsyncLocalStorage context so all logs include correlationId
    correlation.runWithId(id, async () => {
      try {
        await handleMessage(client, topic, message);
      } catch (err) {
        logger.error('Erro no processamento da mensagem:', err);
      }
    });
  });
}

async function handleMessage(client, topic, message) {
  switch (topic) {
    case mqtt_topic:
      logger.info('Mensagem recebida no tópico principal:', message.toString());
      await handleCapabilityMessage(client, message);
      break;
    case mqtt_topic_discovery:
      logger.info('Mensagem recebida no tópico de discovery:', message.toString());
      await handleDiscoveryMessage(client, message);
      break;
    default:
      logger.warn('Mensagem recebida em tópico desconhecido:', topic);
      return;
  }
}

async function handleDiscoveryMessage(client, message) {
  logger.info('Mensagem de discovery recebida:', message.toString());
  try {
    const devicePayload = JSON.parse(message.toString());
    if (devicePayload.type && devicePayload.type == 'property') {
      await processPropertiesAsync([devicePayload]);
      return;
    }
    await processDiscoveryDevice(devicePayload);
    logger.info('Notificando a atualização com sucesso para outros consumers');
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
    logger.error('Erro ao processar mensagem de discovery:', err.message);
  }
}

async function processPropertiesAsync(properties) {
  for (const prop of properties) {

    switch (prop.property_name) {
      case 'device_state': {
        const device_active_date = new Date().toLocaleString('sv-SE');
        await updateDevice(prop.device_id, [createPatch('last_active', device_active_date)]);
        logger.info(`Estado do dispositivo atualizado para ${device_active_date} no dispositivo ${prop.device_id}`);
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
    switch (capabilityName) {
      case 'device_state': {
        const device_active_date = new Date().toLocaleString('sv-SE');
        await updateDevice(payload.device_id, [createPatch('last_active', device_active_date)]);
        logger.log(`Estado do dispositivo atualizado para ${device_active_date} no dispositivo ${payload.device_id}`);
        break;
      }
      case 'wifi_signal':
        await updateProperty(payload.device_id, 'wifi_signal', newValue, 'Sinal Wi-Fi');
        logger.log(`Sinal Wi-Fi atualizado para ${newValue} no dispositivo ${payload.device_id}`);
        break;
      case 'wifi_ssid':
        await updateProperty(payload.device_id, 'wifi_ssid', newValue, 'SSID Wi-Fi');
        logger.log(`SSID Wi-Fi atualizado para ${newValue} no dispositivo ${payload.device_id}`);
        break;
      default: {
        if (capabilityName.includes('battery_level')) {
          await updateProperty(payload.device_id, 'battery_level', newValue, 'Nível da Bateria');
          logger.log(`Nível da bateria atualizado para ${newValue} no dispositivo ${payload.device_id}`);
          break;
        }
        await updateCapability(capabilityName, newValue, payload);
        publishCapabilityUpdate(client, payload.device_id, capabilityName, newValue);
        logger.log(`Capability '${capabilityName}' atualizada para ${newValue} no dispositivo ${payload.device_id}`);
        break;
      }
    }
  } catch (err) {
    logger.error('Erro ao processar mensagem MQTT:', err);
  }
}

module.exports = {
  registerHandlers,
};
