const correlation = require('../src/app/utils/correlation');
const logger = require('../src/app/utils/logger');

console.log('--- Test logger: sem correlation ---');
logger.info('Log sem correlation');

const id = correlation.generateId();
correlation.runWithId(id, () => {
  console.log('\n--- Test logger: dentro do runWithId ---');
  logger.info('Log com correlation (sync)');
  logger.error(new Error('Erro de teste'));

  setTimeout(() => {
    logger.info('Log com correlation (async via setTimeout)');
  }, 50);
});

// keep process alive um pouco para ver o setTimeout
setTimeout(() => process.exit(0), 200);
