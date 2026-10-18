const { createApp } = require('./app');
const { createRedisStore } = require('./store');

const PORT = process.env.PORT || 3000;
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

createRedisStore(REDIS_URL).then((store) => {
  createApp(store).listen(PORT, () => console.log(`listening on ${PORT}`));
});
