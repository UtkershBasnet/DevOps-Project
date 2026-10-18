const { createApp } = require('./app');
const { createRedisStore } = require('./store');

const PORT = process.env.PORT || 3000;
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

createRedisStore(REDIS_URL).then((store) => {
  const server = createApp(store).listen(PORT, () =>
    console.log(JSON.stringify({ msg: 'listening', port: PORT })));
  // graceful shutdown so rolling updates drop no requests
  process.on('SIGTERM', () => server.close(() => process.exit(0)));
});
