// Wrapper de compatibilidade: use ./index.js
const logger = require('./utils/logger');
logger.warn('[main_sync] Este arquivo foi refatorado. Utilize index.js como entrypoint.');
const { start } = require('./index');
start();
