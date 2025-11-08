const correlation = require('./correlation');

function prefixWithCorrelation(args) {
  const id = correlation.getId();
  if (!id) return args;
  const prefix = `[correlationId:${id}]`;
  // If first arg is string, prefix it, else add prefix as first arg
  if (typeof args[0] === 'string') {
    args[0] = `${prefix} ${args[0]}`;
    return args;
  }
  return [prefix, ...args];
}

function info(...args) {
  console.info(...prefixWithCorrelation(args));
}

function warn(...args) {
  console.warn(...prefixWithCorrelation(args));
}

function error(...args) {
  console.error(...prefixWithCorrelation(args));
}

function log(...args) {
  console.log(...prefixWithCorrelation(args));
}

function debug(...args) {
  if (console.debug) console.debug(...prefixWithCorrelation(args));
  else console.log(...prefixWithCorrelation(args));
}

module.exports = {
  info,
  warn,
  error,
  log,
  debug,
};
