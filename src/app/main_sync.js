// Wrapper de compatibilidade: use ./app.js
const logger = require('./utils/logger');
logger.warn('[main_sync] Este arquivo foi refatorado. Utilize app.js como entrypoint.');
const { start } = require('./app');
start();
