function createMessageRouter({ topics, handlers, logger }) {
  const routes = new Map([
    [topics.capability, handlers.capability],
    [topics.discovery, handlers.discovery],
  ]);

  return {
    async route(client, topic, message) {
      const handler = routes.get(topic);
      if (!handler) {
        logger.warn({ topic }, 'Mensagem recebida em tópico desconhecido');
        return { action: 'ignored' };
      }
      return handler(client, message);
    },
  };
}

module.exports = { createMessageRouter };
