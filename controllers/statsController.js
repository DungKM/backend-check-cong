const { asyncHandler } = require('../utils/asyncHandler');
const statsService = require('../services/statsService');

const getOverview = asyncHandler(async (req, res) => {
  const result = await statsService.getOverview();
  res.json(result);
});

module.exports = { getOverview };
