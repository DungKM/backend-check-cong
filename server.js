require('dotenv').config();
const { createApp } = require('./app');
const { connectDb } = require('./config/db');
const { logger } = require('./utils/logger');

async function start() {
  await connectDb();
  const app = createApp();
  const port = process.env.PORT || 4000;
  app.listen(port, () => {
    logger.info(`API đang chạy tại http://localhost:${port}`);
  });
}

start().catch((err) => {
  logger.error('Không thể khởi động server:', err);
  process.exit(1);
});
