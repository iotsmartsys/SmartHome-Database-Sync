const { createClient } = require('./mqtt/client');
const { registerHandlers } = require('./mqtt/handlers');
const config = require('./utils/config');

function start() {
  config.validateConfig(config);
  const client = createClient();
  registerHandlers(client);
  return client;
}

// Inicia imediatamente quando executado diretamente
if (require.main === module) {
  start();
}

module.exports = { start };
