const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { capture } = require('../projectx-analytics');

test('PostHog capture sends a structured event without exposing the API key in properties', async () => {
  const received = [];
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      received.push(JSON.parse(body));
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end('{"status":1}');
    });
  });
  await new Promise(resolve => server.listen(0, resolve));

  const original = {
    apiKey: process.env.POSTHOG_API_KEY,
    host: process.env.POSTHOG_HOST,
    distinctId: process.env.POSTHOG_DISTINCT_ID
  };
  const port = server.address().port;
  process.env.POSTHOG_API_KEY = 'test-secret';
  process.env.POSTHOG_HOST = `http://127.0.0.1:${port}`;
  process.env.POSTHOG_DISTINCT_ID = 'test-project-x';

  try {
    assert.equal(await capture('project_x_test_event', { suite: 'analytics' }), true);
    assert.equal(received.length, 1);
    assert.equal(received[0].event, 'project_x_test_event');
    assert.equal(received[0].distinct_id, 'test-project-x');
    assert.equal(received[0].properties.suite, 'analytics');
    assert.equal(received[0].properties.api_key, undefined);
  } finally {
    if (original.apiKey === undefined) delete process.env.POSTHOG_API_KEY; else process.env.POSTHOG_API_KEY = original.apiKey;
    if (original.host === undefined) delete process.env.POSTHOG_HOST; else process.env.POSTHOG_HOST = original.host;
    if (original.distinctId === undefined) delete process.env.POSTHOG_DISTINCT_ID; else process.env.POSTHOG_DISTINCT_ID = original.distinctId;
    await new Promise(resolve => server.close(resolve));
  }
});
