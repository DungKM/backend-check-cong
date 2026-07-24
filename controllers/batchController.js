const { asyncHandler } = require('../utils/asyncHandler');
const batchService = require('../services/batchService');

const listBatches = asyncHandler(async (req, res) => {
  const batches = await batchService.listBatches();
  res.json({ batches });
});

module.exports = { listBatches };
