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

// Wrapper that injects correlationId (from AsyncLocalStorage) into the first meta object
// of every log call. If the first arg is not an object (or is an Error), we prepend
// a meta object containing the correlationId.
const methods = ['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent'];
const logger = {};

function injectCorrelation(args) {
  const id = correlation.getId();
  if (!id) return args;

  // If first arg is a plain object (not Error and not Array), merge correlationId
  const first = args[0];
  const isPlainObject = first && typeof first === 'object' && !Array.isArray(first) && !(first instanceof Error);
  if (isPlainObject) {
    // avoid mutating caller object
    const meta = Object.assign({ correlationId: id }, first);
    const rest = args.slice(1);
    return [meta, ...rest];
  }

  // otherwise prepend a meta object
  return [{ correlationId: id }, ...args];
}

methods.forEach((m) => {
  logger[m] = (...args) => baseLogger[m](...injectCorrelation(args));
});

// alias log -> info for code that used logger.log
logger.log = (...args) => baseLogger.info(...injectCorrelation(args));

// expose child and level control transparently
logger.child = (...args) => baseLogger.child(...args);
logger.level = baseLogger.level;
logger.flush = baseLogger.flush ? baseLogger.flush.bind(baseLogger) : undefined;

module.exports = logger;
