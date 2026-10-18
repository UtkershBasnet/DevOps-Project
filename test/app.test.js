const test = require('node:test');
const assert = require('node:assert');
const { createApp } = require('../src/app');
const { createMemoryStore } = require('../src/store');

async function withServer(fn) {
  const server = createApp(createMemoryStore()).listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  try { await fn(base); } finally { server.close(); }
}

test('create and list notes', async () => {
  await withServer(async (base) => {
    const r = await fetch(`${base}/notes`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: 'hello' }),
    });
    assert.strictEqual(r.status, 201);
    const list = await (await fetch(`${base}/notes`)).json();
    assert.strictEqual(list.length, 1);
    assert.strictEqual(list[0].text, 'hello');
  });
});

test('rejects empty text', async () => {
  await withServer(async (base) => {
    const r = await fetch(`${base}/notes`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: '  ' }),
    });
    assert.strictEqual(r.status, 400);
  });
});
