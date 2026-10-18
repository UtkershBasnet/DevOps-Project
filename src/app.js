const express = require('express');

// store: { add(text) -> note, list() -> notes[] }
function createApp(store) {
  const app = express();
  app.use(express.json());

  app.get('/notes', async (req, res) => {
    res.json(await store.list());
  });

  app.post('/notes', async (req, res) => {
    const text = req.body && req.body.text;
    if (typeof text !== 'string' || text.trim() === '') {
      return res.status(400).json({ error: 'text is required' });
    }
    res.status(201).json(await store.add(text.trim()));
  });

  return app;
}

module.exports = { createApp };
