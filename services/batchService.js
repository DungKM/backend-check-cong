const Batch = require('../models/Batch');

async function listBatches({ page = 1, pageSize = 20 } = {}) {
  const skip = (Math.max(1, page) - 1) * pageSize;
  const [items, total] = await Promise.all([
    Batch.find().sort({ createdAt: -1 }).skip(skip).limit(pageSize).lean(),
    Batch.countDocuments(),
  ]);
  return { items, total, page: Number(page), pageSize: Number(pageSize) };
}

async function getBatch(batchId) {
  return Batch.findOne({ batchId }).lean();
}

module.exports = { listBatches, getBatch };
