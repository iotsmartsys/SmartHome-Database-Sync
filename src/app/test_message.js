const handlers = require('./mqtt/handlers');
const { mqtt_topic_discovery } = require('./utils/config');

// fake client with subscribe/on/emit
function createFakeClient() {
  const listeners = {};
  return {
    subscribe(topic, cb) {
      // call subscribe callback with no error
      setImmediate(() => cb && cb(null));
    },
    on(event, cb) {
      listeners[event] = listeners[event] || [];
      listeners[event].push(cb);
    },
    emit(event, ...args) {
      const fns = listeners[event] || [];
      for (const fn of fns) fn(...args);
    }
  };
}

const client = createFakeClient();
handlers.registerHandlers(client);

const discoveryMessage = JSON.stringify({
  device_id: 'test-device-123',
  platform: 'test',
  mac_address: '11:22:33:44:55:66',
  ip_address: '192.168.0.100',
  capabilities: [{ capability_name: 'on_off', value: true }],
  properties: [],
});

// emit a discovery message
client.emit('message', mqtt_topic_discovery, Buffer.from(discoveryMessage));

// wait a moment for async processing
setTimeout(() => process.exit(0), 500);
