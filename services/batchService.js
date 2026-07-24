const Batch = require('../models/Batch');

async function listBatches() {
  return Batch.find().sort({ createdAt: -1 }).lean();
}

async function getBatch(batchId) {
  return Batch.findOne({ batchId }).lean();
}

module.exports = { listBatches, getBatch };
