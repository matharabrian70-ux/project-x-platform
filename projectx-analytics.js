const DEFAULT_HOST = 'https://us.i.posthog.com';

async function capture(event, properties = {}) {
  const apiKey = process.env.POSTHOG_API_KEY;
  if (!apiKey) return false;

  const host = (process.env.POSTHOG_HOST || DEFAULT_HOST).replace(/\/$/, '');
  try {
    const response = await fetch(`${host}/capture/`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        event,
        distinct_id: process.env.POSTHOG_DISTINCT_ID || 'project-x-platform',
        properties: { ...properties, source: 'project-x-platform' }
      })
    });
    return response.ok;
  } catch (_) {
    // Analytics must never take the application down.
    return false;
  }
}

module.exports = { capture };
