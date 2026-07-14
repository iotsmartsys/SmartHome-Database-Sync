function createProcessDeviceMetrics({ deviceApi, logger }) {
  return async function processDeviceMetrics(payload) {
    const deviceId = payload.device_id;
    const metrics = {
      device_id: deviceId,
      uptime_ms: payload.uptime_ms,
      cpu_cores: payload.cpu_cores,
      cpu_percent: payload.cpu_percent,
      memory_percent: payload.memory_percent,
      temperature_c: payload.temperature_c,
      frequency_mhz: payload.frequency_mhz,
      network: {
        rssi: payload.network.rssi,
        last_disconnection_uptime_ms: payload.network.last_desconnected,
        disconnection_reason: payload.network.desconnected_rason,
        connection_count: payload.network.connection_count,
      },
    };

    await deviceApi.createDeviceMetrics(deviceId, metrics);
    logger.info({ device_id: deviceId }, 'Métricas do dispositivo persistidas via API');
    return { action: 'device_metrics_persisted' };
  };
}

module.exports = { createProcessDeviceMetrics };
