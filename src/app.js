const express = require('express');
const client = require('prom-client');

const VERSION = process.env.APP_VERSION || 'dev';
const COMMIT = process.env.GIT_SHA || 'unknown';

// store: { add(text) -> note, list() -> notes[], ping() -> void }
function createApp(store, { log = defaultLog } = {}) {
  const app = express();
  const registry = new client.Registry();
  client.collectDefaultMetrics({ register: registry });

  const httpDuration = new client.Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request latency',
    labelNames: ['method', 'route', 'status'],
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5],
    registers: [registry],
  });
  new client.Gauge({
    name: 'notes_app_build_info',
    help: 'Build metadata',
    labelNames: ['version', 'commit'],
    registers: [registry],
  }).set({ version: VERSION, commit: COMMIT }, 1);

  app.use(express.json());

  // structured access log + latency metric
  app.use((req, res, next) => {
    const start = process.hrtime.bigint();
    res.on('finish', () => {
      const seconds = Number(process.hrtime.bigint() - start) / 1e9;
      const route = req.route ? req.baseUrl + req.route.path : 'unmatched';
      httpDuration.observe({ method: req.method, route, status: res.statusCode }, seconds);
      if (route !== '/healthz' && route !== '/readyz' && route !== '/metrics') {
        log({ msg: 'request', method: req.method, route, status: res.statusCode, ms: +(seconds * 1000).toFixed(1) });
      }
    });
    next();
  });

  // liveness: process is up. readiness: dependencies reachable.
  app.get('/healthz', (req, res) => res.json({ status: 'ok' }));
  app.get('/readyz', async (req, res) => {
    try {
      await store.ping();
      res.json({ status: 'ready' });
    } catch (err) {
      res.status(503).json({ status: 'not ready' });
    }
  });
  app.get('/version', (req, res) => res.json({ version: VERSION, commit: COMMIT }));
  app.get('/metrics', async (req, res) => {
    res.set('Content-Type', registry.contentType);
    res.send(await registry.metrics());
  });

  app.get('/notes', async (req, res, next) => {
    try { res.json(await store.list()); } catch (e) { next(e); }
  });

  app.post('/notes', async (req, res, next) => {
    const text = req.body && req.body.text;
    if (typeof text !== 'string' || text.trim() === '') {
      return res.status(400).json({ error: 'text is required' });
    }
    try { res.status(201).json(await store.add(text.trim())); } catch (e) { next(e); }
  });

  app.use((err, req, res, next) => {
    log({ msg: 'error', error: err.message });
    res.status(500).json({ error: 'internal error' });
  });

  return app;
}

function defaultLog(entry) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), ...entry }));
}

module.exports = { createApp };
