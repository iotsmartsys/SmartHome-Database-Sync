const { getCurrentFormattedDate } = require('../utils/date');
const { getPlatformFromDeviceId } = require('../utils/platform');
const { createProcessPropertyUpdate } = require('./process-property-update');
const { createProcessCapabilityUpdate } = require('./process-capability-update');
const { createProcessDiscovery } = require('./process-discovery');

function createApplication({
  deviceApi,
  logger,
  clock = getCurrentFormattedDate,
  platformResolver = getPlatformFromDeviceId,
}) {
  const processPropertyUpdate = createProcessPropertyUpdate({ deviceApi, logger });
  return {
    processPropertyUpdate,
    processCapabilityUpdate: createProcessCapabilityUpdate({
      deviceApi,
      processPropertyUpdate,
      clock,
      logger,
    }),
    processDiscovery: createProcessDiscovery({
      deviceApi,
      processPropertyUpdate,
      clock,
      platformResolver,
      logger,
    }),
  };
}

module.exports = { createApplication };
