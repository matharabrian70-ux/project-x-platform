const http = require('node:http');

const originalEmit = http.Server.prototype.emit;
let sentStart = false;

async function capture(event, properties = {}) {
  const apiKey = process.env.POSTHOG_API_KEY;
  if (!apiKey) return;
  const host = (process.env.POSTHOG_HOST || 'https://us.i.posthog.com').replace(/\/$/, '');
  try {
    await fetch(`${host}/capture/`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        event,
        distinct_id: process.env.POSTHOG_DISTINCT_ID || 'project-x-platform',
        properties: { ...properties, source: 'project-x-platform' }
      })
    });
  } catch (_) {
    // Analytics must never take the application down.
  }
}

if (!sentStart) {
  sentStart = true;
  capture('project_x_service_started');
}

http.Server.prototype.emit = function (type, request, response) {
  if (type === 'request' && request && request.url) {
    const route = request.url.split('?')[0];
    if (route === '/' || route === '/health' || route.startsWith('/api/')) {
      capture('project_x_http_request', { method: request.method, route });
    }
  }
  return originalEmit.apply(this, arguments);
};
