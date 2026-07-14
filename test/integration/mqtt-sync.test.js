const assert = require('node:assert/strict');
const http = require('node:http');
const test = require('node:test');

const { createDeviceApi } = require('../../src/app/infrastructure/http/device-api');
const { NotFoundError } = require('../../src/app/utils/errors');
const { createApplication } = require('../../src/app/application/create-application');
const { createHandlers } = require('../../src/app/mqtt/handlers');

async function startApiServer(handler) {
  const server = http.createServer(handler);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

function createFetchClient(baseUrl) {
  async function request(method, path, body) {
    const response = await fetch(`${baseUrl}/${path}`, {
      method,
      headers: { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok) {
      const error = new Error(`HTTP ${response.status}`);
      error.response = { status: response.status, data };
      throw error;
    }
    return { status: response.status, data };
  }

  return {
    get: (path) => request('GET', path),
    post: (path, body) => request('POST', path, body),
    put: (path, body) => request('PUT', path, body),
    patch: (path, body) => request('PATCH', path, body),
  };
}

test('fluxo MQTT → aplicação → API local → publicação mantém o contrato', async () => {
  const requests = [];
  const server = await startApiServer(async (request, response) => {
    let body = '';
    for await (const chunk of request) body += chunk;
    requests.push({ method: request.method, url: request.url, body: body ? JSON.parse(body) : undefined });
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ ok: true }));
  });

  try {
    const deviceApi = createDeviceApi(createFetchClient(server.url));
    const application = createApplication({
      deviceApi,
      logger: { info() {}, warn() {}, error() {}, debug() {} },
    });
    const handlers = createHandlers({
      application,
      topics: { capability: 'capability/input', discovery: 'discovery/input' },
      appLogger: { info() {}, warn() {}, error() {} },
    });
    const client = {
      published: [],
      publish(topic, message, callback) {
        this.published.push({ topic, payload: JSON.parse(message) });
        callback();
      },
    };

    await handlers.handleMessage(client, 'capability/input', Buffer.from(JSON.stringify({
      device_id: 'device/01',
      capability_name: 'on_off',
      value: false,
    })));

    assert.deepEqual(requests, [{
      method: 'PATCH',
      url: '/devices/device%2F01/capabilities/value',
      body: { capability_name: 'on_off', value: false },
    }]);
    assert.deepEqual(client.published, [{
      topic: 'device/updated',
      payload: { device_id: 'device/01', capability_name: 'on_off', value: false },
    }]);
  } finally {
    await server.close();
  }
});

test('adapter HTTP traduz 404 real do servidor local em NotFoundError', async () => {
  const server = await startApiServer((_request, response) => {
    response.writeHead(404, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ message: 'not found' }));
  });

  try {
    const deviceApi = createDeviceApi(createFetchClient(server.url));
    await assert.rejects(() => deviceApi.getDevice('missing'), NotFoundError);
  } finally {
    await server.close();
  }
});
