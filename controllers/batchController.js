const { asyncHandler } = require('../utils/asyncHandler');
const batchService = require('../services/batchService');

const listBatches = asyncHandler(async (req, res) => {
  const { page, pageSize } = req.query;
  const result = await batchService.listBatches({ page: Number(page) || 1, pageSize: Number(pageSize) || 20 });
  res.json(result);
});

module.exports = { listBatches };
