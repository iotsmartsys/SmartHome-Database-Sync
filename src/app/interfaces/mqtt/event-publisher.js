function createMqttEventPublisher({ client, topics, publish, publishCapabilityUpdate }) {
  return {
    async publishEvents(events) {
      for (const event of events) {
        if (event.type === 'capability_received') {
          await publish(client, topics.capability, event.payload);
          continue;
        }
        if (event.type === 'capability_updated') {
          await publishCapabilityUpdate(client, event.deviceId, event.capabilityName, event.value);
          continue;
        }
        if (event.type === 'discovery_requested') {
          await publish(client, topics.discovery, event.payload);
          continue;
        }
        throw new Error(`Evento de saída não suportado: ${event.type}`);
      }
    },
  };
}

module.exports = { createMqttEventPublisher };
