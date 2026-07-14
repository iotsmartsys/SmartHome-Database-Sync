const { mqtt_topic, mqtt_topic_discovery } = require('../utils/config');
const { publish, publishCapabilityUpdate } = require('./publisher');
const correlation = require('../utils/correlation');
const logger = require('../utils/logger');
const { deviceApi } = require('../infrastructure/http/device-api');
const { createApplication } = require('../application/create-application');
const { createMessageRouter } = require('../interfaces/mqtt/message-router');
const { createMqttEventPublisher } = require('../interfaces/mqtt/event-publisher');
const payloadValidator = require('../interfaces/mqtt/payload-validator');

const defaultApplication = createApplication({ deviceApi, logger });
const defaultTopics = { capability: mqtt_topic, discovery: mqtt_topic_discovery };

function createHandlers({
  application = defaultApplication,
  topics = defaultTopics,
  appLogger = logger,
  correlationContext = correlation,
  validator = payloadValidator,
} = {}) {
  async function handleDiscoveryMessage(client, message) {
    const payload = validator.validateDiscoveryPayload(validator.parseJsonMessage(message));
    if (payload.type === 'property') {
      return application.processPropertyUpdate({
        deviceId: payload.device_id,
        propertyName: payload.property_name,
        value: payload.value,
        description: payload.property_name,
      });
    }
    const result = await application.processDiscovery(payload);
    await createMqttEventPublisher({ client, topics, publish, publishCapabilityUpdate })
      .publishEvents(result.events || []);
    return result;
  }

  async function handleCapabilityMessage(client, message) {
    const payload = validator.validateCapabilityPayload(validator.parseJsonMessage(message));
    const result = await application.processCapabilityUpdate(payload);
    await createMqttEventPublisher({ client, topics, publish, publishCapabilityUpdate })
      .publishEvents(result.events || []);
    return result;
  }

  const router = createMessageRouter({
    topics,
    logger: appLogger,
    handlers: {
      capability: handleCapabilityMessage,
      discovery: handleDiscoveryMessage,
    },
  });

  function registerHandlers(client) {
    subscribe(client, topics.capability, appLogger);
    subscribe(client, topics.discovery, appLogger);
    client.on('message', (topic, message) => {
      correlationContext.runWithId(correlationContext.generateId(), async () => {
        try {
          await router.route(client, topic, message);
        } catch (err) {
          appLogger.error({ err, code: err.code, retryable: err.retryable, details: err.details }, 'Erro no processamento da mensagem');
        }
      });
    });
  }

  return { registerHandlers, handleMessage: router.route, handleDiscoveryMessage, handleCapabilityMessage };
}

function subscribe(client, topic, appLogger) {
  client.subscribe(topic, (err) => {
    if (err) appLogger.error({ topic, err }, 'Erro ao subscrever ao tópico');
    else appLogger.info({ topic }, 'Subscrito ao tópico');
  });
}

const defaultHandlers = createHandlers();

module.exports = {
  createHandlers,
  ...defaultHandlers,
};
