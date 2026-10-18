const { createClient } = require('redis');

const KEY = 'notes';

async function createRedisStore(url) {
  const client = createClient({ url });
  client.on('error', (e) => console.error(JSON.stringify({ msg: 'redis error', error: e.message })));
  await client.connect();
  return {
    async add(text) {
      const note = { id: await client.incr('notes:id'), text, createdAt: new Date().toISOString() };
      await client.rPush(KEY, JSON.stringify(note));
      return note;
    },
    async ping() {
      await client.ping();
    },
    async list() {
      return (await client.lRange(KEY, 0, -1)).map((n) => JSON.parse(n));
    },
  };
}

function createMemoryStore() {
  const notes = [];
  return {
    async add(text) {
      const note = { id: notes.length + 1, text, createdAt: new Date().toISOString() };
      notes.push(note);
      return note;
    },
    async ping() {},
    async list() {
      return notes;
    },
  };
}

module.exports = { createRedisStore, createMemoryStore };
