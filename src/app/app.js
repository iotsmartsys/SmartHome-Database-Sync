const { createClient } = require('./mqtt/client');
const { createHandlers } = require('./mqtt/handlers');
const config = require('./utils/config');
const logger = require('./utils/logger');
const { deviceApi } = require('./infrastructure/http/device-api');
const { createApplication } = require('./application/create-application');

function start() {
  config.validateConfig(config);
  const application = createApplication({ deviceApi, logger });
  const client = createClient();
  createHandlers({ application }).registerHandlers(client);
  return client;
}

// Inicia imediatamente quando executado diretamente
if (require.main === module) {
  start();
}

module.exports = { start };
