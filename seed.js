require('dotenv').config();
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const User = require('./models/User');
const { logger } = require('./utils/logger');

async function seed() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not set. Copy .env.example to .env and configure it.');
  }

  await mongoose.connect(uri);
  logger.info('Connected to MongoDB for seeding');

  const existingCount = await User.countDocuments();
  if (existingCount > 0) {
    logger.info(`Collection 'users' already has ${existingCount} document(s), skipping seed.`);
  } else {
    const passwordHash = await bcrypt.hash('123456', 10);
    await User.create({ username: 'admin', passwordHash, role: 'admin' });
    logger.info("Đã tạo tài khoản demo: admin / 123456");
  }

  await mongoose.disconnect();
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    logger.error('Seed thất bại:', err);
    process.exit(1);
  });
