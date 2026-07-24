const mongoose = require('mongoose');
const { logger } = require('../utils/logger');

async function connectDb() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not set. Copy .env.example to .env and configure it.');
  }
  await mongoose.connect(uri);
  logger.info('Connected to MongoDB');
  return mongoose.connection;
}

module.exports = { connectDb };
