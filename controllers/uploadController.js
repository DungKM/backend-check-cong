const { asyncHandler } = require('../utils/asyncHandler');
const uploadService = require('../services/uploadService');

const uploadClaimXml = asyncHandler(async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ message: 'Vui lòng chọn ít nhất một file hồ sơ giám định (.xml/.zip)' });
  }
  const result = await uploadService.ingestClaimXml({
    batchId: req.body.batchId,
    userId: req.user.id,
    files: req.files,
  });
  res.json(result);
});

module.exports = { uploadClaimXml };
