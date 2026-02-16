const { processDiscoveryDevice, updateDevice, updateProperty, createPatch } = require('../managers/devices');
const { updateCapability } = require('../managers/capabilities');
const { mqtt_topic, mqtt_topic_discovery } = require('../utils/config');
const { publish, publishCapabilityUpdate } = require('./publisher');
const correlation = require('../utils/correlation');
const logger = require('../utils/logger');

function summarizeMessage(message) {
  const raw = message.toString();
  return {
    length: raw.length,
    preview: raw.slice(0, 300),
  };
}

function registerHandlers(client) {
  // Subscriptions
  client.subscribe(mqtt_topic, (err) => {
    if (err) {
      logger.error({ topic: mqtt_topic, message: err.message }, 'Erro ao subscrever ao tópico');
    } else {
      logger.info({ topic: mqtt_topic }, 'Subscrito ao tópico');
    }
  });

  client.subscribe(mqtt_topic_discovery, (err) => {
    if (err) {
      logger.error({ topic: mqtt_topic_discovery, message: err.message }, 'Erro ao subscrever ao tópico');
    } else {
      logger.info({ topic: mqtt_topic_discovery }, 'Subscrito ao tópico');
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
      logger.info(
        { topic, message: summarizeMessage(message) },
        'Mensagem recebida no tópico principal'
      );
      await handleCapabilityMessage(client, message);
      break;
    case mqtt_topic_discovery:
      logger.info(
        { topic, message: summarizeMessage(message) },
        'Mensagem recebida no tópico de discovery'
      );
      await handleDiscoveryMessage(client, message);
      break;
    default:
      logger.warn({ topic }, 'Mensagem recebida em tópico desconhecido');
      return;
  }
}

async function handleDiscoveryMessage(client, message) {
  logger.info({ message: summarizeMessage(message) }, 'Mensagem de discovery recebida');
  try {
    const devicePayload = JSON.parse(message.toString());
    logger.debug(
      {
        device_id: devicePayload.device_id,
        type: devicePayload.type,
        capabilitiesCount: (devicePayload.capabilities || []).length,
      },
      'Discovery parseada'
    );
    if (devicePayload.type && devicePayload.type == 'property') {
      await processPropertiesAsync([devicePayload]);
      return;
    }
    await processDiscoveryDevice(devicePayload);
    logger.info(
      { device_id: devicePayload.device_id, capabilities: (devicePayload.capabilities || []).length },
      'Notificando a atualização para outros consumers'
    );
    const capabilities = devicePayload.capabilities || [];
    for (const capability of capabilities) {
      const toSend = {
        device_id: devicePayload.device_id,
        capability_name: capability.capability_name,
        value: capability.value,
        type: capability.type
      };
      logger.debug(
        { device_id: toSend.device_id, capabilityName: toSend.capability_name },
        'Publicando capability no tópico principal'
      );
      publish(client, mqtt_topic, toSend);
    }
  } catch (err) {
    logger.error({ message: err.message }, 'Erro ao processar mensagem de discovery');
  }
}

async function processPropertiesAsync(properties) {
  for (const prop of properties) {
    logger.debug(
      { device_id: prop.device_id, property: prop.property_name, value: prop.value },
      'Processando propriedade recebida'
    );
    switch (prop.property_name) {
      case 'device_state': {
        await updateDevice(prop.device_id, [createPatch('state', prop.value)]);
        logger.info(
          { device_id: prop.device_id, state: prop.value },
          'Estado do dispositivo atualizado'
        );
        break;
      }
      default:
        await updateProperty(prop.device_id, prop.property_name, prop.value, prop.property_name);
        logger.info(
          { device_id: prop.device_id, property: prop.property_name, value: prop.value },
          'Propriedade do dispositivo atualizada'
        );
        break;
    }
  }
}

async function handleCapabilityMessage(client, message) {
  try {
    const payload = JSON.parse(message.toString());
    logger.debug(
      { device_id: payload.device_id, capabilityName: payload.capability_name, value: payload.value },
      'Payload de capability parseado'
    );
    const capabilityName = payload.capability_name;
    const newValue = payload.value;
    if (!capabilityName || newValue === undefined) return;
    switch (capabilityName) {
      case 'device_state': {
        await updateDevice(payload.device_id, [createPatch('state', newValue)]);
        logger.info(
          { device_id: payload.device_id, state: newValue },
          'Estado do dispositivo atualizado'
        );
        break;
      }
      case 'wifi_signal':
        await updateProperty(payload.device_id, 'wifi_signal', newValue, 'Sinal Wi-Fi');
        logger.info(
          { device_id: payload.device_id, wifi_signal: newValue },
          'Sinal Wi-Fi atualizado'
        );
        break;
      case 'wifi_ssid':
        await updateProperty(payload.device_id, 'wifi_ssid', newValue, 'SSID Wi-Fi');
        logger.info(
          { device_id: payload.device_id, wifi_ssid: newValue },
          'SSID Wi-Fi atualizado'
        );
        break;
      default: {
        if (capabilityName.includes('battery_level')) {
          await updateProperty(payload.device_id, 'battery_level', newValue, 'Nível da Bateria');
          logger.info(
            { device_id: payload.device_id, battery_level: newValue },
            'Nível da bateria atualizado'
          );
          break;
        }
        const updateResult = await updateCapability(capabilityName, newValue, payload);
        if (updateResult?.action === 'discovery_required' && updateResult?.discoveryPayload) {
          publish(client, mqtt_topic_discovery, updateResult.discoveryPayload);
          logger.info(
            { device_id: payload.device_id, capabilityName },
            'Payload de discovery Zigbee publicado por device inexistente'
          );
        }
        publishCapabilityUpdate(client, payload.device_id, capabilityName, newValue);
        logger.info(
          { device_id: payload.device_id, capabilityName, value: newValue },
          'Capability atualizada'
        );
        break;
      }
    }
  } catch (err) {
    logger.error({ message: err.message }, 'Erro ao processar mensagem MQTT');
  }
}

module.exports = {
  registerHandlers,
};
