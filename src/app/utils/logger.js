const pino = require('pino');
const correlation = require('./correlation');

const log_level = process.env.LOG_LEVEL || 'info';
const service_name = process.env.MQTT_CLIENT_ID || 'smart-home-database-sync';
const env = process.env.NODE_ENV || process.env.ENV || 'prod';

const baseLogger = pino({
  level: log_level,
  base: { service: service_name, env },
  messageKey: 'message',
  formatters: {
    level(label) {
      return { level: label };
    }
  }
});

const methods = ['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent'];
const logger = {};

function injectCorrelation(args) {
  const id = correlation.getId();
  if (!id) return args;

  const first = args[0];
  const isPlainObject = first && typeof first === 'object' && !Array.isArray(first) && !(first instanceof Error);
  if (isPlainObject) {
    const meta = Object.assign({ correlationId: id }, first);
    const rest = args.slice(1);
    return [meta, ...rest];
  }

  return [{ correlationId: id }, ...args];
}

methods.forEach((m) => {
  logger[m] = (...args) => baseLogger[m](...injectCorrelation(args));
});

logger.log = (...args) => baseLogger.info(...injectCorrelation(args));

logger.child = (...args) => baseLogger.child(...args);
logger.level = baseLogger.level;
logger.flush = baseLogger.flush ? baseLogger.flush.bind(baseLogger) : undefined;

module.exports = logger;
