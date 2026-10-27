const test = require('node:test');
const assert = require('node:assert/strict');
const { app } = require('../projectx-server');

let server;
let baseUrl;

test.before(async () => {
  server = app.listen(0);
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

test.after(async () => {
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
});

test('health endpoint reports five products and no database in isolated tests', async () => {
  const response = await fetch(`${baseUrl}/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, database: false, products: 5 });
});

test('records API persists a create and canonical state update for every product', async () => {
  const fixtures = [
    ['agency', { name: 'Test Agency', stage: 'lead', value: 1000 }],
    ['money', { name: 'Test Income', kind: 'income', amount: 100 }],
    ['delivery', { name: 'Test Project', status: 'in_progress', value: 1000 }],
    ['seller', { name: 'Test Product', channel: 'Payhip', gross: 100, refunds: 0 }],
    ['business', { name: 'Test Task', kind: 'task', status: 'open' }]
  ];

  for (const [product, record] of fixtures) {
    const create = await fetch(`${baseUrl}/api/records/${product}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(record)
    });
    assert.equal(create.status, 201);
    const created = await create.json();
    assert.ok(created._id);

    const state = product === 'agency' ? 'lead' : product === 'money' ? 'expense' : product === 'delivery' ? 'qa' : product === 'seller' ? 'Gumroad' : 'done';
    const field = product === 'agency' ? 'stage' : product === 'money' ? 'kind' : product === 'delivery' ? 'status' : product === 'seller' ? 'channel' : 'status';
    const update = await fetch(`${baseUrl}/api/records/${product}/${created._id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ [field]: state })
    });
    assert.equal(update.status, 200);
    const updated = await update.json();
    assert.equal(updated[field], state);
  }
});

test('invalid workflow state is rejected by the API', async () => {
  const response = await fetch(`${baseUrl}/api/records/seller`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Bad Product', channel: 'NotAStore', gross: 1, refunds: 0 })
  });
  assert.equal(response.status, 400);
});

test('market intelligence endpoints are mounted in the Project X app', async () => {
  const response = await fetch(`${baseUrl}/api/market/status`);
  assert.equal(response.status, 200);
  const status = await response.json();
  assert.deepEqual(status.providers.map(provider => provider.id), ['twelve-data', 'massive', 'oanda']);
  assert.equal(status.analyst.provider, 'Groq');
});

test('market intelligence page is served by the existing app', async () => {
  const response = await fetch(`${baseUrl}/market-intelligence`);
  assert.equal(response.status, 200);
  assert.match(await response.text(), /Market Intelligence/);
});
